import { useState, useEffect } from 'react'
import { useStore } from '../../store.js'
import { sbLoadBackups, sbSaveBackup, sbDeleteBackup } from '../../utils/supabase.js'

export default function BackupModal() {
  const store = useStore()
  const { modal, closeModal } = store
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [label, setLabel] = useState('')

  useEffect(() => {
    if (modal?.type === 'backup') {
      loadBackups()
    }
  }, [modal?.type])

  async function loadBackups() {
    setLoading(true)
    try {
      const list = await sbLoadBackups(store.adminMode)
      setBackups(list || [])
    } catch (e) {
      alert('バックアップ一覧の取得に失敗しました: ' + e.message)
    }
    setLoading(false)
  }

  async function handleSave() {
    const pjs = store._pjs()
    if (!Object.keys(pjs).length) return alert('保存するデータがありません')
    setSaving(true)
    try {
      await sbSaveBackup(label.trim() || undefined, pjs, store.adminMode)
      setLabel('')
      await loadBackups()
    } catch (e) {
      alert('バックアップ保存に失敗しました: ' + e.message)
    }
    setSaving(false)
  }

  async function handleRestore(backup) {
    if (!confirm(`「${backup.label || backup.created_at}」を復元しますか？現在のデータは上書きされます。`)) return
    try {
      const data = typeof backup.data === 'string' ? JSON.parse(backup.data) : backup.data
      store._setPjs(data)
      store.save()
      alert('復元完了')
      closeModal()
    } catch (e) {
      alert('復元に失敗しました: ' + e.message)
    }
  }

  async function handleDelete(backup) {
    if (!confirm(`「${backup.label || backup.created_at}」を削除しますか？`)) return
    try {
      await sbDeleteBackup(backup.id, store.adminMode)
      await loadBackups()
    } catch (e) {
      alert('削除に失敗しました: ' + e.message)
    }
  }

  if (modal?.type !== 'backup') return null

  return (
    <div className="ov" onClick={e => e.target === e.currentTarget && closeModal()}>
      <div className="md" style={{ maxWidth: 460 }}>
        <div className="mh">
          <span>💾 バックアップ管理</span>
          <button className="cls" onClick={closeModal}>✕</button>
        </div>
        <div className="mb">
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input type="text" value={label} onChange={e => setLabel(e.target.value)}
              placeholder="ラベル（任意）" style={{ flex: 1 }} />
            <button className="btn p" onClick={handleSave} disabled={saving}>
              {saving ? '保存中…' : '現在のデータをバックアップ'}
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--tx3)', padding: 20 }}>読み込み中…</div>
          ) : backups.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--tx3)', padding: 20 }}>バックアップがありません</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
              {backups.map(b => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--s3)', borderRadius: 6, border: '1px solid var(--bd)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{b.name || '（ラベルなし）'}</div>
                    <div style={{ fontSize: 10, color: 'var(--tx3)' }}>{b.created_at?.slice(0,16).replace('T',' ')}</div>
                  </div>
                  <button className="btn" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => handleRestore(b)}>復元</button>
                  <button className="btn d" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => handleDelete(b)}>削除</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mf">
          <button className="btn" onClick={closeModal}>閉じる</button>
        </div>
      </div>
    </div>
  )
}
