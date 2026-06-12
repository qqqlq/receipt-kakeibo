import { useState, useEffect } from 'react'
import { MdInbox, MdDeleteOutline } from 'react-icons/md'
import { getSubscriptions, addSubscription, disableSubscription } from '../lib/api.js'
import { CATEGORIES, PAYMENT_METHODS } from '../lib/constants.js'

/**
 * サブスク管理コンポーネント
 * - 登録済みサブスク一覧（削除ボタン付き）
 * - 新規追加フォーム
 */
export function SubscriptionManager() {
  const [subscriptions, setSubscriptions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isAdding, setIsAdding] = useState(false)

  // 追加フォームのstate
  const [form, setForm] = useState({ name: '', amount: '', category: 'その他', billingType: '毎月', billingDay: '', billingMonth: '', paymentMethod: PAYMENT_METHODS[0] })

  useEffect(() => {
    fetchSubscriptions()
  }, [])

  async function fetchSubscriptions() {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getSubscriptions()
      setSubscriptions(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.name || !form.amount || !form.billingDay) return
    const day = Number(form.billingDay)
    if (day < 1 || day > 31) return
    if (form.billingType === '毎年') {
      const m = Number(form.billingMonth)
      if (m < 1 || m > 12) return
    }

    setIsAdding(true)
    try {
      await addSubscription({
        name: form.name,
        amount: Number(form.amount),
        category: form.category,
        billingType: form.billingType,
        billingDay: day,
        billingMonth: form.billingType === '毎年' ? Number(form.billingMonth) : '',
        paymentMethod: form.paymentMethod,
      })
      setForm({ name: '', amount: '', category: 'その他', billingType: '毎月', billingDay: '', billingMonth: '', paymentMethod: PAYMENT_METHODS[0] })
      await fetchSubscriptions()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsAdding(false)
    }
  }

  async function handleDelete(rowNumber, name) {
    if (!confirm(`「${name}」を削除しますか？`)) return
    try {
      await disableSubscription(rowNumber)
      setSubscriptions((prev) => prev.filter((s) => s.rowNumber !== rowNumber))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 className="text-lg font-bold text-gray-800">サブスク管理</h2>
      <p className="text-sm text-gray-500">登録した課金日に毎月自動で家計簿に記録されます。</p>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 登録済み一覧 */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <span className="inline-block w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="py-8 text-center text-gray-400">
          <MdInbox className="text-4xl mb-2 mx-auto" />
          <p>登録済みのサブスクはありません</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {subscriptions.map((sub) => (
            <div key={sub.rowNumber} className="flex items-center justify-between border border-gray-200 rounded-lg p-3 bg-white shadow-sm">
              <div>
                <p className="font-medium text-gray-800">{sub.name}</p>
                <p className="text-sm text-gray-500">
                  {sub.billingType === '毎年'
                    ? `毎年${sub.billingMonth}月${sub.billingDay}日`
                    : `毎月${sub.billingDay}日`} ·
                  <span className="ml-1 font-medium text-gray-700">¥{sub.amount.toLocaleString()}</span>
                  <span className="ml-2 text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{sub.category}</span>
                  {sub.paymentMethod && (
                    <span className="ml-1 text-xs bg-blue-50 text-blue-600 rounded-full px-2 py-0.5">{sub.paymentMethod}</span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(sub.rowNumber, sub.name)}
                className="min-h-[44px] px-3 text-red-400 hover:text-red-600 transition-colors"
                aria-label="削除"
              >
                <MdDeleteOutline className="text-xl" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 追加フォーム */}
      <div className="border border-gray-200 rounded-lg p-4 bg-white mt-2">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">新規追加</h3>
        <form onSubmit={handleAdd} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="サービス名（例: Netflix）"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            className="min-h-[44px] border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <input
            type="number"
            placeholder="金額"
            min="1"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            required
            className="min-h-[44px] border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {/* 課金タイプ */}
          <div className="flex gap-2">
            <select
              value={form.billingType}
              onChange={(e) => setForm((f) => ({ ...f, billingType: e.target.value, billingMonth: '' }))}
              className="flex-1 min-h-[44px] border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="毎月">毎月</option>
              <option value="毎年">毎年（年間）</option>
            </select>
            {form.billingType === '毎年' && (
              <input
                type="number"
                placeholder="月"
                min="1"
                max="12"
                value={form.billingMonth}
                onChange={(e) => setForm((f) => ({ ...f, billingMonth: e.target.value }))}
                required
                className="w-16 min-h-[44px] border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            )}
            <input
              type="number"
              placeholder="日"
              min="1"
              max="31"
              value={form.billingDay}
              onChange={(e) => setForm((f) => ({ ...f, billingDay: e.target.value }))}
              required
              className="w-16 min-h-[44px] border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <select
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className="min-h-[44px] border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            value={form.paymentMethod}
            onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
            className="min-h-[44px] border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isAdding}
            className="min-h-[44px] bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg px-4 py-3 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {isAdding ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                追加中…
              </>
            ) : '＋ 追加'}
          </button>
        </form>
      </div>
    </div>
  )
}
