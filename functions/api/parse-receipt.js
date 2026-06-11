import { parseReceipt } from '../_lib/anthropic.js'
import { jsonResponse, errorResponse } from '../_lib/json.js'

/**
 * POST /api/parse-receipt
 * リクエスト: { image: "<base64>", mimeType: "image/jpeg" }
 * レスポンス: { storeName, date, category, items, total, tax }
 */
export async function onRequestPost({ request, env }) {
  let body
  try {
    body = await request.json()
  } catch {
    return errorResponse('リクエストボディが不正です', 400)
  }

  const { image, mimeType } = body ?? {}

  if (!image || !mimeType) {
    return errorResponse('image と mimeType は必須です', 400)
  }

  if (!env.ANTHROPIC_API_KEY) {
    return errorResponse('ANTHROPIC_API_KEY が設定されていません', 500)
  }

  try {
    const result = await parseReceipt(image, mimeType, env.ANTHROPIC_API_KEY)
    return jsonResponse(result)
  } catch (err) {
    console.error('parse-receipt エラー:', err)
    return errorResponse(`レシートの読み取りに失敗しました: ${err.message}`)
  }
}
