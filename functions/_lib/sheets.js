/**
 * Google Sheets API ユーティリティ
 *
 * Cloudflare Workers ランタイムは Node.js の crypto を持たないため、
 * Web Crypto API (crypto.subtle) で RS256 JWT を手動生成してアクセストークンを取得する。
 */

// アクセストークンのインメモリキャッシュ（同一 isolate 内で再利用）
let cachedToken = null
let tokenExpiresAt = 0

/**
 * base64url エンコード（Web Crypto の標準 btoa は base64 なので変換）
 */
function base64url(buffer) {
  const bytes = new Uint8Array(buffer)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * PKCS#8 PEM 文字列を ArrayBuffer に変換
 * 環境変数では改行が \n でエスケープされているため置換する
 */
function pemToArrayBuffer(pem) {
  // \n リテラルと実改行の両方に対応し、base64 文字以外を全て除去する
  const base64 = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/[^A-Za-z0-9+/=]/g, '')

  const binary = atob(base64)
  const buffer = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i)
  }
  return buffer.buffer
}

/**
 * Google OAuth2 アクセストークンを取得する（JWT Bearer フロー）
 * @param {Object} env - Cloudflare Pages Functions の env オブジェクト
 * @returns {Promise<string>} - アクセストークン
 */
export async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000)

  // キャッシュが有効なら再利用（60秒の余裕を持たせる）
  if (cachedToken && now < tokenExpiresAt - 60) {
    return cachedToken
  }

  const iat = now
  const exp = now + 3600

  // JWT ヘッダー・クレームを base64url エンコード
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const claim = base64url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        iat,
        exp,
      })
    )
  )

  const signingInput = `${header}.${claim}`

  // PKCS#8 PEM → CryptoKey
  const keyBuffer = pemToArrayBuffer(env.GOOGLE_PRIVATE_KEY)
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  // 署名
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(signingInput)
  )

  const jwt = `${signingInput}.${base64url(signature)}`

  // OAuth2 トークンエンドポイントへリクエスト
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    throw new Error(`Google OAuth2 トークン取得失敗 (${tokenRes.status}): ${err}`)
  }

  const tokenData = await tokenRes.json()
  cachedToken = tokenData.access_token
  tokenExpiresAt = now + (tokenData.expires_in ?? 3600)

  return cachedToken
}

/**
 * スプレッドシートの末尾に1行追記する
 * カラム順: 日付 | 店名 | カテゴリ | 品目 | 合計金額 | 消費税 | 記録日時 | 支払方法
 * @param {Object} env
 * @param {Object} data - { date, storeName, category, items, total, tax, paymentMethod }
 */
export async function appendRow(env, { date, storeName, category, items, total, tax, paymentMethod = '' }) {
  const token = await getAccessToken(env)

  // 品目を "品名 ×金額" 形式でカンマ連結
  const itemsSummary = (items ?? [])
    .map((item) => `${item.name} ×${item.price}円`)
    .join('\n')

  // JST 現在時刻
  const recordedAt = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date())

  const values = [[date, storeName, category, itemsSummary, total, tax, recordedAt, paymentMethod]]

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/A:H:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Sheets 書き込み失敗 (${res.status}): ${err}`)
  }

  return await res.json()
}

/**
 * スプレッドシートの全行を取得する
 * @param {Object} env
 * @returns {Promise<Array>} - 直近50件（新しい順）。各要素は { date, storeName, category, items, total, tax, recordedAt }
 */
export async function readRows(env) {
  const token = await getAccessToken(env)

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/A:G`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Sheets 読み取り失敗 (${res.status}): ${err}`)
  }

  const data = await res.json()
  const rows = data.values ?? []

  // 1行目はヘッダーなので除外し、新しい順に並べ直して50件に絞る
  const dataRows = rows.slice(1).reverse().slice(0, 50)

  return dataRows.map(([date, storeName, category, items, total, tax, recordedAt]) => ({
    date: date ?? '',
    storeName: storeName ?? '',
    category: category ?? '',
    items: items ?? '',
    total: total ?? '',
    tax: tax ?? '',
    recordedAt: recordedAt ?? '',
  }))
}

// ─── サブスク管理 ────────────────────────────────────────────────────────────

const SUBS_RANGE = 'subscriptions!A:H'

/**
 * サブスクを subscriptions タブに追加する
 * カラム: サービス名 | 金額 | カテゴリ | 課金日 | 有効 | 課金タイプ | 課金月 | 支払方法
 * 課金タイプ: "毎月" / "毎年"
 * 課金月: 1〜12（毎年の場合のみ使用）
 */
export async function addSubscription(env, { name, amount, category, billingDay, billingType = '毎月', billingMonth = '', paymentMethod = '' }) {
  const token = await getAccessToken(env)
  const values = [[name, amount, category, billingDay, 'TRUE', billingType, billingType === '毎年' ? billingMonth : '', paymentMethod]]
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${encodeURIComponent(SUBS_RANGE)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  })
  if (!res.ok) throw new Error(`サブスク追加失敗 (${res.status}): ${await res.text()}`)
  return res.json()
}

/**
 * 有効なサブスク一覧を取得する
 * 各行にシート行番号（論理削除用）を付けて返す
 */
export async function readSubscriptions(env) {
  const token = await getAccessToken(env)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${encodeURIComponent(SUBS_RANGE)}`

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`サブスク取得失敗 (${res.status}): ${await res.text()}`)

  const data = await res.json()
  const rows = data.values ?? []

  // 1行目はヘッダー。index + 2 がシート行番号
  // 列F(billingType)が空の既存行は「毎月」として扱う（後方互換）
  return rows.slice(1)
    .map(([name, amount, category, billingDay, enabled, billingType, billingMonth, paymentMethod], index) => ({
      rowNumber: index + 2,
      name: name ?? '',
      amount: Number(amount) || 0,
      category: category ?? '',
      billingDay: Number(billingDay) || 1,
      enabled: enabled !== 'FALSE',
      billingType: billingType || '毎月',
      billingMonth: Number(billingMonth) || null,
      paymentMethod: paymentMethod ?? '',
    }))
    .filter((s) => s.enabled)
}

/**
 * サブスクを論理削除する（有効列を FALSE に更新）
 * @param {number} rowNumber - シート行番号（readSubscriptions で取得した値）
 */
export async function disableSubscription(env, rowNumber) {
  const token = await getAccessToken(env)
  const range = encodeURIComponent(`subscriptions!E${rowNumber}`)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`

  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [['FALSE']] }),
  })
  if (!res.ok) throw new Error(`サブスク削除失敗 (${res.status}): ${await res.text()}`)
  return res.json()
}
