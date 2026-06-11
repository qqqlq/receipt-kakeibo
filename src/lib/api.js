/**
 * API 呼び出しユーティリティ
 * Pages Functions と同一オリジンなので相対パスで fetch する
 */

/**
 * レシート画像を解析する
 * @param {string} imageBase64 - base64 エンコード済み画像（プレフィックスなし）
 * @param {string} mimeType - 画像の MIME タイプ
 * @returns {Promise<Object>} - { storeName, date, category, items, total, tax }
 */
export async function parseReceipt(imageBase64, mimeType) {
  const res = await fetch('/api/parse-receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageBase64, mimeType }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? 'レシートの読み取りに失敗しました')
  }

  return res.json()
}

/**
 * レシートデータをスプレッドシートに保存する
 * @param {Object} data - { storeName, date, category, items, total, tax }
 * @returns {Promise<void>}
 */
export async function saveToSheets(data) {
  const res = await fetch('/api/save-to-sheets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? 'スプレッドシートへの保存に失敗しました')
  }
}

/**
 * 記録済み履歴を取得する
 * @returns {Promise<Array>} - 直近50件の配列
 */
export async function getHistory() {
  const res = await fetch('/api/history')

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? '履歴の取得に失敗しました')
  }

  const data = await res.json()
  return data.rows ?? []
}
