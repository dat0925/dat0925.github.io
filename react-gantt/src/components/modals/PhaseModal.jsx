import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store.js'

export default function PhaseModal() {
  const store = useStore()
  const { modal, closeModal, openModal } = store
  const pj = store.pj()
  const phases = pj?.phases || []
  const isEdit = modal?.type === 'editPh'
  const existingId = modal?.data?.id
  const existing = isEdit ? phases.find(ph => ph.id === existingId) : null

  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const nameRef = useRef(null)

  useEffect(() => {
    if (existing) {
      setName(existing.name || '')
      setStartDate(existing.startDate || '')
      setEndDate(existing.endDate || '')
    } else {
      setName('')
      setStartDate('')
      setEndDate('')
    }
    setTimeout(() => nameRef.current?.focus(), 50)
  }, [existingId, modal?.type])

  function handleSave() {
    const n = name.trim()
    if (!n) return nameRef.current?.focus()
    const data = { name: n, startDate, endDate }
    if (isEdit && existing) {
      store.updatePhase(existingId, data)
    } else {
      store.addPhase({
        id: 'ph_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
        ...data
      })
    }
    closeModal()
  }

  function handleDelete() {
    if (!existing) return
    openModal('delete', { type: 'phase', id: existingId, label: existing.name })
  }

  if (modal?.type !== 'addPh' && modal?.type !== 'editPh') return null

  return (
    <div className="ov" onClick={e => e.target === e.currentTarget && closeModal()}>
      <div className="md" style={{ maxWidth: 380 }}>
        <div className="mh">
          <span>{isEdit ? 'フェーズ編集' : 'フェーズ追加'}</span>
          <button className="cls" onClick={closeModal}>✕</button>
        </div>
        <div className="mb">
          <div className="fg">
            <label>フェーズ名 *</label>
            <input ref={nameRef} type="text" value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()} placeholder="フェーズ名を入力" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="fg">
              <label>開始日</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="fg">
              <label>終了日</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="mf">
          {isEdit && <button className="btn d" onClick={handleDelete}>削除</button>}
          <span style={{ flex: 1 }}></span>
          <button className="btn" onClick={closeModal}>キャンセル</button>
          <button className="btn p" onClick={handleSave}>{isEdit ? '保存' : '追加'}</button>
        </div>
      </div>
    </div>
  )
}
