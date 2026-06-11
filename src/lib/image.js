/**
 * 画像圧縮・変換ユーティリティ
 *
 * - iOS Safari: OS デコーダで HEIC を描画できるため canvas 経由で JPEG 化できる
 * - PC Chrome 等: HEIC をデコードできないため heic2any で変換してから canvas へ
 * - heic2any は動的 import（フォールバック発生時のみロード）
 */

const MAX_LONG_SIDE = 1568
const JPEG_QUALITY = 0.8

/**
 * File/Blob を受け取り、長辺 1568px の JPEG に圧縮して base64 と mimeType を返す
 * @param {File|Blob} file
 * @returns {Promise<{ base64: string, mimeType: string }>}
 */
export async function compressImage(file) {
  // まず通常のデコードを試みる
  let blob = file

  try {
    const imageBase64 = await blobToBase64ViaCanvas(blob)
    return imageBase64
  } catch {
    // canvas デコード失敗 → heic2any でフォールバック（動的 import）
    const heic2any = (await import('heic2any')).default
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: JPEG_QUALITY })
    const convertedBlob = Array.isArray(converted) ? converted[0] : converted
    return blobToBase64ViaCanvas(convertedBlob)
  }
}

/**
 * Blob を canvas でリサイズして JPEG の base64 と mimeType を返す
 */
async function blobToBase64ViaCanvas(blob) {
  const url = URL.createObjectURL(blob)

  try {
    const img = await loadImage(url)
    const { width, height } = calcResizedDimensions(img.naturalWidth, img.naturalHeight)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, width, height)

    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    // "data:image/jpeg;base64," のプレフィックスを除去
    const base64 = dataUrl.split(',')[1]
    return { base64, mimeType: 'image/jpeg' }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * <img> 要素を使って画像を読み込む（エラー時は reject）
 */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
    img.src = url
  })
}

/**
 * 長辺が MAX_LONG_SIDE を超える場合のみリサイズする
 */
function calcResizedDimensions(w, h) {
  const longSide = Math.max(w, h)
  if (longSide <= MAX_LONG_SIDE) return { width: w, height: h }

  const scale = MAX_LONG_SIDE / longSide
  return {
    width: Math.round(w * scale),
    height: Math.round(h * scale),
  }
}
