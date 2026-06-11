import { useRef, useState } from 'react'

/**
 * レシートのアップロード・撮影コンポーネント
 * - カメラ撮影ボタン（スマホ向け）
 * - ギャラリーから選択ボタン
 * - 選択後プレビュー表示
 * - 「読み取る」ボタンで親コンポーネントに処理を委譲
 */
export function ReceiptUploader({ onRead, isLoading }) {
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    const url = URL.createObjectURL(file)
    setPreview(url)
  }

  function handleReset() {
    setPreview(null)
    setSelectedFile(null)
    // input の値をリセット
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    if (galleryInputRef.current) galleryInputRef.current.value = ''
  }

  function handleRead() {
    if (selectedFile) onRead(selectedFile)
  }

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <h1 className="text-xl font-bold text-gray-800">レシートを撮影・選択</h1>

      {/* ファイル入力（非表示） */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ボタン群 */}
      <div className="flex gap-3 w-full max-w-sm">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={isLoading}
          className="flex-1 min-h-[44px] bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-medium rounded-lg px-4 py-3 disabled:opacity-50 transition-colors"
        >
          📷 カメラで撮影
        </button>
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={isLoading}
          className="flex-1 min-h-[44px] bg-gray-200 hover:bg-gray-300 active:bg-gray-400 text-gray-800 font-medium rounded-lg px-4 py-3 disabled:opacity-50 transition-colors"
        >
          🖼 ギャラリー
        </button>
      </div>

      {/* プレビュー */}
      {preview && (
        <div className="flex flex-col items-center gap-3 w-full max-w-sm">
          <img
            src={preview}
            alt="レシートプレビュー"
            className="w-full rounded-lg border border-gray-200 shadow-sm object-contain max-h-96"
          />

          <div className="flex gap-3 w-full">
            <button
              type="button"
              onClick={handleReset}
              disabled={isLoading}
              className="flex-1 min-h-[44px] border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg px-4 py-3 disabled:opacity-50 transition-colors"
            >
              選び直す
            </button>
            <button
              type="button"
              onClick={handleRead}
              disabled={isLoading}
              className="flex-1 min-h-[44px] bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-medium rounded-lg px-4 py-3 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  読み取り中…
                </>
              ) : (
                '✨ 読み取る'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
