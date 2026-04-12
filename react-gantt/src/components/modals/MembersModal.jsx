import { useState, useRef } from 'react'
import { useStore } from '../../store.js'

export default function MembersModal() {
  const store = useStore()
  const { modal, closeModal } = store
  const members = store._members()
  const [newName, setNewName] = useState('')
  const inputRef = useRef(null)

  if (modal?.type !== 'members') return null

  function handleAdd() {
    const n = newName.trim()
    if (!n) return
    if (members.includes(n)) {
      alert('同じ名前の担当者がすでに存在します')
      return
    }
    store.addMember(n)
    setNewName('')
    inputRef.current?.focus()
  }

  function handleDelete(name) {
    if (!confirm(`「${name}」を削除しますか？\n（既に割り当て済みのタスクからは削除されません）`)) return
    store.deleteMember(name)
  }

  return (
    <div className="ov" onClick={e => e.target === e.currentTarget && closeModal()}>
      <div className="md" style={{ maxWidth: 360 }}>
        <div className="mh">
          <span>👥 担当者管理</span>
          <button className="cls" onClick={closeModal}>✕</button>
        </div>
        <div className="mb">
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input ref={inputRef} type="text" value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="担当者名を入力" style={{ flex: 1 }} />
            <button className="btn p" onClick={handleAdd}>追加</button>
          </div>

          {members.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--tx3)', padding: '16px 0', fontSize: 12 }}>
              担当者が登録されていません
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {members.map(m => (
                <div key={m} style={{ display: 'flex', alignItems: 'center', padding: '7px 10px', background: 'var(--s3)', borderRadius: 6, border: '1px solid var(--bd)' }}>
                  <span style={{ flex: 1, fontSize: 13 }}>{m}</span>
                  <button className="btn d" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => handleDelete(m)}>削除</button>
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
