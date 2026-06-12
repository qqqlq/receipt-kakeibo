import { useState, useEffect } from 'react'
import { CATEGORIES, PAYMENT_METHODS } from '../lib/constants.js'

/**
 * レシート読み取り結果の確認・編集コンポーネント
 * - 店名・日付・カテゴリ・品目リスト（追加・削除可能）・合計（自動計算）
 * - 「スプレッドシートに追加」「やり直し」ボタン
 */
export function ReceiptPreview({ data, onSave, onReset, isSaving }) {
  const [storeName, setStoreName] = useState(data.storeName ?? '')
  const [date, setDate] = useState(data.date ?? '')
  const [category, setCategory] = useState(data.category ?? 'その他')
  const [items, setItems] = useState(
    data.items?.length ? data.items : [{ name: '', price: 0 }]
  )
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0])

  // data が変わったら再初期化（再読み取り後など）
  useEffect(() => {
    setStoreName(data.storeName ?? '')
    setDate(data.date ?? '')
    setCategory(
      CATEGORIES.includes(data.category) ? data.category : 'その他'
    )
    setItems(data.items?.length ? data.items : [{ name: '', price: 0 }])
    setPaymentMethod(PAYMENT_METHODS[0])
  }, [data])

  // 合計を自動計算
  const total = items.reduce((sum, item) => sum + (Number(item.price) || 0), 0)

  function updateItem(index, field, value) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: field === 'price' ? Number(value) : value } : item
      )
    )
  }

  function addItem() {
    setItems((prev) => [...prev, { name: '', price: 0 }])
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSave() {
    onSave({ storeName, date, category, items, total, tax: data.tax ?? 0, paymentMethod })
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 className="text-lg font-bold text-gray-800">読み取り結果を確認</h2>

      {/* 店名 */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">店名</label>
        <input
          type="text"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          className="min-h-[44px] border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="店名を入力"
        />
      </div>

      {/* 日付 */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">日付</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="min-h-[44px] border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* カテゴリ */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">カテゴリ</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="min-h-[44px] border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* 支払方法 */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">支払方法</label>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          className="min-h-[44px] border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* 品目リスト */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">品目</label>
        {items.map((item, index) => (
          <div key={index} className="flex gap-2 items-center">
            <input
              type="text"
              value={item.name}
              onChange={(e) => updateItem(index, 'name', e.target.value)}
              placeholder="品名"
              className="flex-1 min-h-[44px] border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <input
              type="number"
              value={item.price}
              onChange={(e) => updateItem(index, 'price', e.target.value)}
              placeholder="金額"
              min="0"
              className="w-24 min-h-[44px] border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              type="button"
              onClick={() => removeItem(index)}
              disabled={items.length <= 1}
              className="min-h-[44px] w-10 text-red-400 hover:text-red-600 disabled:opacity-30 text-lg"
              aria-label="削除"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addItem}
          className="min-h-[44px] border border-dashed border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
        >
          ＋ 品目を追加
        </button>
      </div>

      {/* 合計（表示のみ） */}
      <div className="flex justify-between items-center py-3 border-t border-gray-200">
        <span className="font-medium text-gray-700">合計</span>
        <span className="text-xl font-bold text-gray-900">
          ¥{total.toLocaleString()}
        </span>
      </div>

      {/* アクションボタン */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onReset}
          disabled={isSaving}
          className="flex-1 min-h-[44px] border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg px-4 py-3 disabled:opacity-50 transition-colors"
        >
          やり直し
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 min-h-[44px] bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-medium rounded-lg px-4 py-3 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              保存中…
            </>
          ) : (
            '📊 スプレッドシートに追加'
          )}
        </button>
      </div>
    </div>
  )
}
