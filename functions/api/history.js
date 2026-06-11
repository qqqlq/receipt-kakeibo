import { readRows } from '../_lib/sheets.js'
import { jsonResponse, errorResponse } from '../_lib/json.js'

/**
 * GET /api/history
 * レスポンス: { rows: [{ date, storeName, category, items, total, tax, recordedAt }] }
 * 直近50件（新しい順）
 */
export async function onRequestGet({ env }) {
  if (!env.SPREADSHEET_ID || !env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
    return errorResponse('Google Sheets の環境変数が設定されていません', 500)
  }

  try {
    const rows = await readRows(env)
    return jsonResponse({ rows })
  } catch (err) {
    console.error('history エラー:', err)
    return errorResponse(`履歴の取得に失敗しました: ${err.message}`)
  }
}
