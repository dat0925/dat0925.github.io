import { useState, useEffect } from 'react'
import { useStore } from '../../store.js'
import { _SB_URL, _SB_KEY } from '../../utils/constants.js'

const LS_URL = 'gantt_sb_url'
const LS_KEY = 'gantt_sb_key'

export default function SupabaseModal() {
  const store = useStore()
  const { modal, closeModal } = store
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (modal?.type === 'supabase') {
      setUrl(localStorage.getItem(LS_URL) || _SB_URL || '')
      setKey(localStorage.getItem(LS_KEY) || _SB_KEY || '')
      setSaved(false)
    }
  }, [modal?.type])

  function handleSave() {
    localStorage.setItem(LS_URL, url.trim())
    localStorage.setItem(LS_KEY, key.trim())
    setSaved(true)
    setTimeout(() => {
      closeModal()
      // Trigger reload to re-init Supabase client
      store.forceReload()
    }, 800)
  }

  function handleReset() {
    localStorage.removeItem(LS_URL)
    localStorage.removeItem(LS_KEY)
    setUrl(_SB_URL || '')
    setKey(_SB_KEY || '')
  }

  if (modal?.type !== 'supabase') return null

  return (
    <div className="ov" onClick={e => e.target === e.currentTarget && closeModal()}>
      <div className="md" style={{ maxWidth: 420 }}>
        <div className="mh">
          <span>🔌 Supabase設定</span>
          <button className="cls" onClick={closeModal}>✕</button>
        </div>
        <div className="mb">
          <p style={{ fontSize: 11, color: 'var(--tx3)', margin: '0 0 12px' }}>
            カスタムSupabaseプロジェクトを使用する場合は以下を設定してください。
            空欄にするとデフォルト設定が使われます。
          </p>
          <div className="fg">
            <label>Supabase URL</label>
            <input type="text" value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://xxxx.supabase.co" />
          </div>
          <div className="fg">
            <label>Anon Key</label>
            <input type="text" value={key} onChange={e => setKey(e.target.value)}
              placeholder="eyJ..." />
          </div>
          {saved && (
            <div style={{ color: '#16a34a', fontSize: 12, fontWeight: 600 }}>✅ 保存しました。再読み込みします…</div>
          )}
        </div>
        <div className="mf">
          <button className="btn" onClick={handleReset} style={{ marginRight: 'auto' }}>デフォルトに戻す</button>
          <button className="btn" onClick={closeModal}>キャンセル</button>
          <button className="btn p" onClick={handleSave}>保存して再接続</button>
        </div>
      </div>
    </div>
  )
}
