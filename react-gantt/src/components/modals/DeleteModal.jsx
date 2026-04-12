import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store.js'
import { DEL_PJ_PW, PW } from '../../utils/constants.js'

export default function DeleteModal() {
  const store = useStore()
  const { modal, closeModal } = store
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const pwRef = useRef(null)

  const type = modal?.data?.type
  const id = modal?.data?.id
  const ids = modal?.data?.ids
  const label = modal?.data?.label

  useEffect(() => {
    setPw('')
    setErr('')
    if (modal?.type === 'delete' && (type === 'project' || type === 'phase')) {
      setTimeout(() => pwRef.current?.focus(), 50)
    }
  }, [modal?.type, type])

  if (modal?.type !== 'delete') return null

  const needsPw = type === 'project' || type === 'phase'

  function handleConfirm() {
    if (needsPw) {
      const correct = type === 'project' ? DEL_PJ_PW : PW
      if (pw !== correct) {
        setErr('パスワードが違います')
        pwRef.current?.focus()
        return
      }
    }
    if (type === 'task') {
      store.deleteTask(id)
    } else if (type === 'bulk') {
      ids?.forEach(tid => store.deleteTask(tid))
      store.clearSel()
    } else if (type === 'phase') {
      store.deletePhase(id)
    } else if (type === 'project') {
      store.deletePJ(id)
    }
    closeModal()
  }

  const typeLabel = type === 'project' ? 'プロジェクト' : type === 'phase' ? 'フェーズ' : type === 'bulk' ? `${ids?.length}件のタスク` : 'タスク'

  return (
    <div className="ov" onClick={e => e.target === e.currentTarget && closeModal()}>
      <div className="md" style={{ maxWidth: 340 }}>
        <div className="mh">
          <span style={{ color: '#dc2626' }}>🗑 削除確認</span>
          <button className="cls" onClick={closeModal}>✕</button>
        </div>
        <div className="mb">
          <p style={{ fontSize: 13, color: 'var(--tx)', margin: '0 0 10px' }}>
            <strong>{label}</strong> を削除しますか？
          </p>
          <p style={{ fontSize: 11, color: 'var(--tx3)', margin: '0 0 12px' }}>
            {type === 'project' ? 'プロジェクトと全タスク・フェーズが削除されます。' :
             type === 'phase' ? 'フェーズ内のタスクは削除されません（フェーズ割当が解除されます）。' :
             'この操作は元に戻せません。'}
          </p>
          {needsPw && (
            <div className="fg">
              <label>パスワード</label>
              <input ref={pwRef} type="password" value={pw}
                onChange={e => { setPw(e.target.value); setErr('') }}
                onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                placeholder={type === 'project' ? '削除パスワード' : 'パスワード'} />
              {err && <span style={{ color: '#dc2626', fontSize: 11 }}>{err}</span>}
            </div>
          )}
        </div>
        <div className="mf">
          <button className="btn" onClick={closeModal}>キャンセル</button>
          <button className="btn d" onClick={handleConfirm}>削除する</button>
        </div>
      </div>
    </div>
  )
}
