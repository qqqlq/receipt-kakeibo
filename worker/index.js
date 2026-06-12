import { parseReceipt } from '../functions/_lib/anthropic.js'
import { appendRow, readRows, addSubscription, readSubscriptions, disableSubscription } from '../functions/_lib/sheets.js'
import { jsonResponse, errorResponse } from '../functions/_lib/json.js'

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)

    if (pathname === '/api/parse-receipt' && request.method === 'POST') {
      return handleParseReceipt(request, env)
    }
    if (pathname === '/api/save-to-sheets' && request.method === 'POST') {
      return handleSaveToSheets(request, env)
    }
    if (pathname === '/api/history' && request.method === 'GET') {
      return handleHistory(env)
    }
    if (pathname === '/api/subscriptions' && request.method === 'GET') {
      return handleGetSubscriptions(env)
    }
    if (pathname === '/api/subscriptions' && request.method === 'POST') {
      return handleAddSubscription(request, env)
    }
    if (pathname === '/api/subscriptions/disable' && request.method === 'POST') {
      return handleDisableSubscription(request, env)
    }

    // それ以外は静的アセット（SPA）へ
    return env.ASSETS.fetch(request)
  },

  // Cron: 毎日 UTC 0時（JST 9時）に実行し、今日が課金日のサブスクを家計簿に記録
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDailySubscriptionRecord(env))
  },
}

async function handleParseReceipt(request, env) {
  let body
  try { body = await request.json() } catch {
    return errorResponse('リクエストボディが不正です', 400)
  }
  const { image, mimeType } = body ?? {}
  if (!image || !mimeType) return errorResponse('image と mimeType は必須です', 400)
  if (!env.ANTHROPIC_API_KEY) return errorResponse('ANTHROPIC_API_KEY が設定されていません', 500)

  try {
    return jsonResponse(await parseReceipt(image, mimeType, env.ANTHROPIC_API_KEY))
  } catch (err) {
    return errorResponse(`レシートの読み取りに失敗しました: ${err.message}`)
  }
}

async function handleSaveToSheets(request, env) {
  let body
  try { body = await request.json() } catch {
    return errorResponse('リクエストボディが不正です', 400)
  }
  const { storeName, date, category, items, total, tax } = body ?? {}
  if (!date || !storeName) return errorResponse('date と storeName は必須です', 400)
  if (!env.SPREADSHEET_ID || !env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
    return errorResponse('Google Sheets の環境変数が設定されていません', 500)
  }

  try {
    await appendRow(env, { storeName, date, category, items, total, tax })
    return jsonResponse({ success: true })
  } catch (err) {
    return errorResponse(`スプレッドシートへの保存に失敗しました: ${err.message}`)
  }
}

async function handleHistory(env) {
  if (!env.SPREADSHEET_ID || !env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
    return errorResponse('Google Sheets の環境変数が設定されていません', 500)
  }
  try {
    return jsonResponse({ rows: await readRows(env) })
  } catch (err) {
    return errorResponse(`履歴の取得に失敗しました: ${err.message}`)
  }
}

// ─── サブスク API ────────────────────────────────────────────────────────────

function checkSheetsEnv(env) {
  return env.SPREADSHEET_ID && env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_PRIVATE_KEY
}

async function handleGetSubscriptions(env) {
  if (!checkSheetsEnv(env)) return errorResponse('Google Sheets の環境変数が設定されていません', 500)
  try {
    return jsonResponse({ subscriptions: await readSubscriptions(env) })
  } catch (err) {
    return errorResponse(`サブスク取得に失敗しました: ${err.message}`)
  }
}

async function handleAddSubscription(request, env) {
  if (!checkSheetsEnv(env)) return errorResponse('Google Sheets の環境変数が設定されていません', 500)
  let body
  try { body = await request.json() } catch {
    return errorResponse('リクエストボディが不正です', 400)
  }
  const { name, amount, category, billingDay } = body ?? {}
  if (!name || !amount || !billingDay) return errorResponse('name / amount / billingDay は必須です', 400)
  try {
    await addSubscription(env, { name, amount: Number(amount), category: category ?? 'その他', billingDay: Number(billingDay) })
    return jsonResponse({ success: true })
  } catch (err) {
    return errorResponse(`サブスク追加に失敗しました: ${err.message}`)
  }
}

async function handleDisableSubscription(request, env) {
  if (!checkSheetsEnv(env)) return errorResponse('Google Sheets の環境変数が設定されていません', 500)
  let body
  try { body = await request.json() } catch {
    return errorResponse('リクエストボディが不正です', 400)
  }
  const { rowNumber } = body ?? {}
  if (!rowNumber) return errorResponse('rowNumber は必須です', 400)
  try {
    await disableSubscription(env, rowNumber)
    return jsonResponse({ success: true })
  } catch (err) {
    return errorResponse(`サブスク削除に失敗しました: ${err.message}`)
  }
}

// ─── Cron: 毎日の課金日チェック ──────────────────────────────────────────────

async function runDailySubscriptionRecord(env) {
  if (!checkSheetsEnv(env)) return

  // JST の今日の「日」を取得
  const jstDate = new Date().toLocaleDateString('sv', { timeZone: 'Asia/Tokyo' }) // "2026-06-12"
  const [year, month] = jstDate.split('-').map(Number)
  const todayDay = Number(jstDate.split('-')[2])

  // 当月の最終日
  const lastDayOfMonth = new Date(year, month, 0).getDate()

  const subscriptions = await readSubscriptions(env)

  for (const sub of subscriptions) {
    // 課金日の月末補正: 課金日が当月最終日を超える場合は最終日に記録
    const effectiveDay = Math.min(sub.billingDay, lastDayOfMonth)

    if (effectiveDay !== todayDay) continue

    const date = jstDate
    await appendRow(env, {
      storeName: sub.name,
      date,
      category: sub.category,
      items: [{ name: sub.name, price: sub.amount }],
      total: sub.amount,
      tax: 0,
    })
  }
}
