import { useState, useEffect } from 'react'
import { MdListAlt } from 'react-icons/md'
import { getHistory } from '../lib/api.js'

/**
 * 記録済み履歴一覧コンポーネント
 * マウント時に GET /api/history を呼び出して直近50件を表示する
 */
export function HistoryList() {
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchHistory() {
      setIsLoading(true)
      setError(null)
      try {
        const data = await getHistory()
        if (!cancelled) setRows(data)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchHistory()
    return () => { cancelled = true }
  }, [])

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <span className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="ml-2 text-gray-500">読み込み中…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        <p>履歴の取得に失敗しました</p>
        <p className="text-sm text-gray-500 mt-1">{error}</p>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400">
        <MdListAlt className="text-5xl mb-3 mx-auto" />
        <p>まだ記録がありません</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      <p className="text-sm text-gray-500 mb-2">直近 {rows.length} 件</p>
      {rows.map((row, index) => (
        <div
          key={index}
          className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium text-gray-800">{row.storeName || '（店名なし）'}</p>
              <p className="text-sm text-gray-500">{row.date}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-900">¥{Number(row.total).toLocaleString()}</p>
              <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                {row.category}
              </span>
            </div>
          </div>
          {row.items && (
            <p className="text-xs text-gray-400 mt-2 whitespace-pre-line line-clamp-2">
              {row.items}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
