import { useState } from 'react'
import { useStore } from '../../store.js'
import { SL } from '../../utils/constants.js'

export default function BulkEditModal() {
  const store = useStore()
  const { modal, closeModal, sel } = store
  const pj = store.pj()
  const phases = pj?.phases || []
  const tasks = pj?.tasks || []
  const members = store._members()

  const [status, setStatus] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [assignee, setAssignee] = useState('')
  const [phaseId, setPhaseId] = useState('')
  const [parentId, setParentId] = useState('')

  if (modal?.type !== 'bulkEdit') return null

  const selIds = [...sel]
  const selTasks = selIds.map(id => tasks.find(t => t.id === id)).filter(Boolean)

  function handleApply() {
    const changes = {}
    if (status) changes.status = status
    if (startDate) changes.startDate = startDate
    if (endDate) changes.endDate = endDate
    if (assignee !== '') changes.assignee = assignee
    if (phaseId !== '') changes.phaseId = phaseId || null
    if (parentId !== '') changes.parentId = parentId || null

    if (Object.keys(changes).length === 0) return closeModal()
    store.applyBulkEdit(selIds, changes)
    closeModal()
  }

  const parentCandidates = tasks.filter(t => !t.parentId && !selIds.includes(t.id))

  return (
    <div className="ov" onClick={e => e.target === e.currentTarget && closeModal()}>
      <div className="md" style={{ maxWidth: 420 }}>
        <div className="mh">
          <span>一括編集 ({selIds.length}件)</span>
          <button className="cls" onClick={closeModal}>✕</button>
        </div>
        <div className="mb">
          <p style={{ fontSize: 11, color: 'var(--tx3)', margin: '0 0 12px' }}>
            変更したい項目のみ設定してください。空欄の項目は変更されません。
          </p>

          <div className="fg">
            <label>ステータス</label>
            <select value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">（変更しない）</option>
              {Object.entries(SL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
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

          <div className="fg">
            <label>担当者</label>
            <select value={assignee} onChange={e => setAssignee(e.target.value)}>
              <option value="">（変更しない）</option>
              <option value=" ">未担当（クリア）</option>
              {members.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="fg">
            <label>フェーズ</label>
            <select value={phaseId} onChange={e => setPhaseId(e.target.value)}>
              <option value="">（変更しない）</option>
              <option value="__clear__">なし（クリア）</option>
              {phases.map(ph => <option key={ph.id} value={ph.id}>{ph.name}</option>)}
            </select>
          </div>

          <div className="fg">
            <label>親タスク</label>
            <select value={parentId} onChange={e => setParentId(e.target.value)}>
              <option value="">（変更しない）</option>
              <option value="__clear__">なし（トップレベルに変更）</option>
              {parentCandidates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {selTasks.length <= 5 && (
            <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--s3)', borderRadius: 5, fontSize: 11, color: 'var(--tx3)' }}>
              対象: {selTasks.map(t => t.name).join('、')}
            </div>
          )}
        </div>
        <div className="mf">
          <button className="btn" onClick={closeModal}>キャンセル</button>
          <button className="btn p" onClick={handleApply}>適用</button>
        </div>
      </div>
    </div>
  )
}
