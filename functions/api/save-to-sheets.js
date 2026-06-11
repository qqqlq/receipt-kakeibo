import { appendRow } from '../_lib/sheets.js'
import { jsonResponse, errorResponse } from '../_lib/json.js'

/**
 * POST /api/save-to-sheets
 * リクエスト: { storeName, date, category, items, total, tax }
 * レスポンス: { success: true }
 */
export async function onRequestPost({ request, env }) {
  let body
  try {
    body = await request.json()
  } catch {
    return errorResponse('リクエストボディが不正です', 400)
  }

  const { storeName, date, category, items, total, tax } = body ?? {}

  if (!date || !storeName) {
    return errorResponse('date と storeName は必須です', 400)
  }

  if (!env.SPREADSHEET_ID || !env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
    return errorResponse('Google Sheets の環境変数が設定されていません', 500)
  }

  try {
    await appendRow(env, { storeName, date, category, items, total, tax })
    return jsonResponse({ success: true })
  } catch (err) {
    console.error('save-to-sheets エラー:', err)
    return errorResponse(`スプレッドシートへの保存に失敗しました: ${err.message}`)
  }
}
