import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store.js'
import { td, parseInputDate, fmt } from '../../utils/dates.js'
import { SL } from '../../utils/constants.js'

export default function TaskModal() {
  const store = useStore()
  const { modal, closeModal, openModal } = store
  const pj = store.pj()
  const isEdit = modal?.type === 'editTask'
  const existingId = modal?.data?.id

  const tasks = pj?.tasks || []
  const phases = pj?.phases || []
  const members = store._members()

  const existing = isEdit ? tasks.find(t => t.id === existingId) : null

  const [name, setName] = useState('')
  const [phaseId, setPhaseId] = useState('')
  const [parentId, setParentId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState('todo')
  const [assignee, setAssignee] = useState('')
  const [effort, setEffort] = useState('1')
  const [completedDate, setCompletedDate] = useState('')
  const [memo, setMemo] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const nameRef = useRef(null)

  useEffect(() => {
    if (existing) {
      setName(existing.name || '')
      setPhaseId(existing.phaseId || '')
      setParentId(existing.parentId || '')
      setStartDate(existing.startDate || '')
      setEndDate(existing.endDate || '')
      setStatus(existing.status || 'todo')
      setAssignee(existing.assignee || '')
      setEffort(String(existing.effort ?? 1))
      setCompletedDate(existing.completedDate || '')
      setMemo(existing.memo || '')
    } else {
      // New task defaults
      const today = td()
      setName('')
      setPhaseId(modal?.data?.phaseId || '')
      setParentId('')
      setStartDate(today)
      setEndDate(today)
      setStatus('todo')
      setAssignee('')
      setEffort('1')
      setCompletedDate('')
      setMemo('')
    }
    setTimeout(() => nameRef.current?.focus(), 50)
  }, [existingId, modal?.type])

  const parentCandidates = tasks.filter(t => !t.parentId && t.id !== existingId)

  function handleSave() {
    const n = name.trim()
    if (!n) return nameRef.current?.focus()
    const data = {
      name: n, phaseId: phaseId || null, parentId: parentId || null,
      startDate, endDate, status, assignee, effort: parseFloat(effort) || 1,
      completedDate: completedDate || null, memo
    }
    if (isEdit && existing) {
      store.updateTask(existingId, data)
    } else {
      store.addTask({
        id: 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
        ...data,
        starred: false,
        updatedAt: td()
      })
    }
    closeModal()
  }

  function handleDelete() {
    if (!existing) return
    openModal('delete', { type: 'task', id: existingId, label: existing.name })
  }

  function handleDup() {
    if (!existing) return
    store.dupTask(existingId)
    closeModal()
  }

  function insertMemoText(text) {
    setMemo(prev => prev ? prev + '\n' + text : text)
  }

  function insertMemoUrl() {
    const url = prompt('URLを入力してください')
    if (url) insertMemoText(url)
  }

  function insertMemoDatetime() {
    const now = new Date()
    const str = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
    insertMemoText(str + ' ')
  }

  function copyMemo() {
    if (memo) navigator.clipboard?.writeText(memo).catch(() => {})
  }

  function copyTaskLink() {
    const cur = store._cur()
    if (!cur || !existingId) return
    const url = `${location.origin}${location.pathname}#p=${cur}&t=${existingId}`
    navigator.clipboard?.writeText(url).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }).catch(() => {})
  }

  if (modal?.type !== 'addTask' && modal?.type !== 'editTask') return null

  return (
    <div className="ov" onClick={e => e.target === e.currentTarget && closeModal()}
      onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave() } }}>
      <div className="md" style={{ maxWidth: 480 }}>
        <div className="mh">
          <span>{isEdit ? 'タスク編集' : 'タスク追加'}</span>
          {isEdit && (
            <button onClick={copyTaskLink} title="このタスクのリンクをコピー"
              style={{ fontSize: 11, padding: '2px 8px', border: '1px solid var(--bd2)', borderRadius: 4, cursor: 'pointer', background: linkCopied ? 'var(--ac)' : 'var(--s3)', color: linkCopied ? '#fff' : 'var(--tx2)', marginRight: 8, transition: 'background 0.2s' }}>
              {linkCopied ? '✅ コピーしました' : '🔗 リンクをコピー'}
            </button>
          )}
          <button className="cls" onClick={closeModal}>✕</button>
        </div>
        <div className="mb">
          <div className="fg">
            <label>タスク名 *</label>
            <input ref={nameRef} type="text" value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()} placeholder="タスク名を入力" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="fg">
              <label>フェーズ</label>
              <select value={phaseId} onChange={e => setPhaseId(e.target.value)}>
                <option value="">なし</option>
                {phases.map(ph => <option key={ph.id} value={ph.id}>{ph.name}</option>)}
              </select>
            </div>
            <div className="fg">
              <label>親タスク</label>
              <select value={parentId} onChange={e => setParentId(e.target.value)}>
                <option value="">なし（トップレベル）</option>
                {parentCandidates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="fg">
              <label>ステータス</label>
              <select value={status} onChange={e => setStatus(e.target.value)}>
                {Object.entries(SL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="fg">
              <label>担当者</label>
              <select value={assignee} onChange={e => setAssignee(e.target.value)}>
                <option value="">未担当</option>
                {members.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="fg">
              <label>工数（人日）</label>
              <input type="number" value={effort} onChange={e => setEffort(e.target.value)} min="0" step="0.5" />
            </div>
            <div className="fg">
              <label>完了日</label>
              <input type="date" value={completedDate} onChange={e => setCompletedDate(e.target.value)} />
            </div>
          </div>
          <div className="fg">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              メモ
              <button type="button" onClick={insertMemoUrl}
                style={{ fontSize: 10, padding: '1px 6px', border: '1px solid var(--bd2)', borderRadius: 3, cursor: 'pointer', background: 'var(--s3)', color: 'var(--tx2)' }}>URL</button>
              <button type="button" onClick={insertMemoDatetime}
                style={{ fontSize: 10, padding: '1px 6px', border: '1px solid var(--bd2)', borderRadius: 3, cursor: 'pointer', background: 'var(--s3)', color: 'var(--tx2)' }}>日時</button>
              <button type="button" onClick={copyMemo}
                style={{ fontSize: 10, padding: '1px 6px', border: '1px solid var(--bd2)', borderRadius: 3, cursor: 'pointer', background: 'var(--s3)', color: 'var(--tx2)' }}>コピー</button>
            </label>
            <textarea value={memo} onChange={e => setMemo(e.target.value)}
              rows={4} style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 12 }}
              placeholder="メモ・URL・備考など" />
            {memo && <MemoPreview text={memo} />}
          </div>
        </div>
        <div className="mf">
          {isEdit && (
            <>
              <button className="btn d" onClick={handleDelete}>削除</button>
              <button className="btn" onClick={handleDup} style={{ marginRight: 'auto' }}>複製</button>
            </>
          )}
          {!isEdit && <span style={{ flex: 1 }}></span>}
          <button className="btn" onClick={closeModal}>キャンセル</button>
          <button className="btn p" onClick={handleSave}>{isEdit ? '保存' : '追加'}</button>
        </div>
      </div>
    </div>
  )
}

function MemoPreview({ text }) {
  // Parse memo text into segments: plain text, URLs, and markdown links [label](url)
  function parseSegments(str) {
    const parts = []
    // Match [label](url) or bare URLs
    const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s\])"'>,]+)/g
    let last = 0, m
    while ((m = re.exec(str)) !== null) {
      if (m.index > last) parts.push({ type: 'text', value: str.slice(last, m.index) })
      if (m[1]) {
        parts.push({ type: 'link', label: m[1], url: m[2] })
      } else {
        parts.push({ type: 'link', label: m[3], url: m[3] })
      }
      last = m.index + m[0].length
    }
    if (last < str.length) parts.push({ type: 'text', value: str.slice(last) })
    return parts
  }

  const lines = text.split('\n')
  return (
    <div style={{ marginTop: 4, padding: '6px 8px', background: 'var(--s3)', border: '1px solid var(--bd)', borderRadius: 5, fontSize: 12, lineHeight: 1.7, color: 'var(--tx2)', wordBreak: 'break-all' }}>
      {lines.map((line, i) => (
        <div key={i}>
          {parseSegments(line).map((seg, j) =>
            seg.type === 'link'
              ? <a key={j} href={seg.url} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--ac)', textDecoration: 'underline', cursor: 'pointer' }}
                  onClick={e => e.stopPropagation()}>{seg.label}</a>
              : <span key={j}>{seg.value}</span>
          )}
          {i < lines.length - 1 && lines.length > 1 && <br />}
        </div>
      ))}
    </div>
  )
}
