/**
 * Claude API 呼び出しユーティリティ
 * Workers ランタイムで動作するよう fetch で直接叩く
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-6'

const CATEGORIES = '食費 / 外食 / 日用品 / 交通費 / 娯楽 / 開発 / 光熱費 / その他'

const PROMPT_TEXT = `日本語のレシート画像を解析してください。画像が横向きや斜めに撮影されている場合も、正しく読み取ってください。

【読み取りルール】
- storeName: 店名（レシート上部または店舗名欄から読み取る）
- date: 購入日（YYYY-MM-DD形式。レシートに記載の日付を使用。年の記載がない場合は西暦で補完）
- category: 「${CATEGORIES}」から最適なものを1つ選ぶ
- items: 購入した各品目のリスト
  - name: 商品名（レシートの文字をそのまま読む）
  - price: 商品の金額（整数、¥や円は除く）。必ず各品目の実際の金額を読み取ること。読めない場合でも推測せず0にする
  - ★小計・合計・税・値引きなどの行はitemsに含めない
- total: レシート末尾の合計金額（税込・整数）
- tax: 消費税額（記載があれば整数、なければ0）

以下のJSON形式のみで返してください（説明文・コードブロック・改行不要）:
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
