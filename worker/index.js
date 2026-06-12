import { parseReceipt } from '../functions/_lib/anthropic.js'
import { appendRow, readRows } from '../functions/_lib/sheets.js'
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

    // それ以外は静的アセット（SPA）へ
    return env.ASSETS.fetch(request)
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
