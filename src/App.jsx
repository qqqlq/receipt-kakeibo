import { useState, useCallback } from 'react'
import { ReceiptUploader } from './components/ReceiptUploader.jsx'
import { ReceiptPreview } from './components/ReceiptPreview.jsx'
import { HistoryList } from './components/HistoryList.jsx'
import { compressImage } from './lib/image.js'
import { parseReceipt, saveToSheets } from './lib/api.js'

/**
 * アプリのステート遷移
 * idle → uploading → reviewing → saving → done → idle
 */

const TABS = { home: 'ホーム', history: '履歴' }

export default function App() {
  const [phase, setPhase] = useState('idle') // idle | uploading | reviewing | saving | done
  const [receiptData, setReceiptData] = useState(null)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null) // { message, type }
  const [activeTab, setActiveTab] = useState('home')

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  /** レシートファイルを受け取り、圧縮 → API 解析 */
  const handleRead = useCallback(async (file) => {
    setError(null)
    setPhase('uploading')
    try {
      const { base64, mimeType } = await compressImage(file)
      const data = await parseReceipt(base64, mimeType)
      setReceiptData(data)
      setPhase('reviewing')
    } catch (err) {
      setError(err.message)
      setPhase('idle')
    }
  }, [])

  /** 確認画面からスプレッドシートに保存 */
  const handleSave = useCallback(async (data) => {
    setPhase('saving')
    try {
      await saveToSheets(data)
      setPhase('done')
      showToast('スプレッドシートに追加しました！')
      // done → idle に戻す
      setTimeout(() => {
        setPhase('idle')
        setReceiptData(null)
      }, 1500)
    } catch (err) {
      setError(err.message)
      setPhase('reviewing') // 保存失敗したら確認画面に戻す
    }
  }, [])

  /** 手動入力：空データで確認画面を開く */
  const handleManualInput = useCallback(() => {
    setError(null)
    // JST の今日の日付を YYYY-MM-DD で取得
    const today = new Date().toLocaleDateString('sv', { timeZone: 'Asia/Tokyo' })
    setReceiptData({
      storeName: '',
      date: today,
      category: 'その他',
      items: [{ name: '', price: 0 }],
      total: 0,
      tax: 0,
    })
    setPhase('reviewing')
  }, [])

  /** やり直し */
  const handleReset = useCallback(() => {
    setPhase('idle')
    setReceiptData(null)
    setError(null)
  }, [])

  const isUploading = phase === 'uploading'
  const isSaving = phase === 'saving'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center">
        <h1 className="text-lg font-bold text-gray-900">🧾 レシート家計簿</h1>
      </header>

      {/* タブ */}
      <div className="flex border-b border-gray-200 bg-white">
        {Object.entries(TABS).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`flex-1 min-h-[44px] py-3 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-auto">
        {activeTab === 'home' && (
          <>
            {/* エラー表示 */}
            {error && (
              <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* ステートに応じた表示 */}
            {(phase === 'idle' || phase === 'uploading') && (
              <ReceiptUploader onRead={handleRead} onManualInput={handleManualInput} isLoading={isUploading} />
            )}

            {(phase === 'reviewing' || phase === 'saving') && receiptData && (
              <ReceiptPreview
                data={receiptData}
                onSave={handleSave}
                onReset={handleReset}
                isSaving={isSaving}
              />
            )}

            {phase === 'done' && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <p className="text-5xl">✅</p>
                <p className="text-gray-700 font-medium">記録完了！</p>
              </div>
            )}
          </>
        )}

        {activeTab === 'history' && <HistoryList />}
      </main>

      {/* トースト通知 */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full shadow-lg text-white text-sm font-medium transition-all ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
