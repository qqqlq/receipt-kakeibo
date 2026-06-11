/**
 * Claude API 呼び出しユーティリティ
 * Workers ランタイムで動作するよう fetch で直接叩く
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5-20251001'

const CATEGORIES = '食費 / 外食 / 日用品 / 交通費 / 娯楽 / その他'

const PROMPT_TEXT = `日本語のレシート画像です。以下のJSON形式のみで返してください（説明文・コードブロック不要）。
カテゴリは「${CATEGORIES}」から最適なものを1つ選んでください。

{"storeName":"","date":"YYYY-MM-DD","category":"食費","items":[{"name":"","price":0}],"total":0,"tax":0}`

/**
 * レシート画像を解析して構造化データを返す
 * @param {string} imageBase64 - base64エンコードされた画像データ
 * @param {string} mimeType - 画像のMIMEタイプ（例: "image/jpeg"）
 * @param {string} apiKey - Anthropic API キー
 * @returns {Promise<Object>} - { storeName, date, category, items, total, tax }
 */
export async function parseReceipt(imageBase64, mimeType, apiKey) {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: PROMPT_TEXT,
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API エラー (${response.status}): ${err}`)
  }

  const data = await response.json()
  const text = data.content?.[0]?.text ?? ''

  // コードブロックや前後テキストを除去して JSON をパース
  const jsonText = extractJson(text)
  return JSON.parse(jsonText)
}

/**
 * テキストから JSON 部分を抽出する
 * コードブロック（```json ... ```）や前後の余分なテキストに対応
 */
function extractJson(text) {
  // コードブロックを除去
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim()
  }

  // { ... } の範囲を抽出
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1) {
    return text.slice(start, end + 1)
  }

  return text.trim()
}
