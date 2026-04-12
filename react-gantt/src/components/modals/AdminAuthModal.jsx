import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store.js'
import { ADMIN_PW } from '../../utils/constants.js'

export default function AdminAuthModal() {
  const store = useStore()
  const { modal, closeModal } = store
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const pwRef = useRef(null)

  useEffect(() => {
    if (modal?.type === 'adminAuth') {
      // Same session: skip password
      if (sessionStorage.getItem('gantt_admin_session') === '1') {
        store.enterAdmin()
        closeModal()
        return
      }
      setPw('')
      setErr('')
      setTimeout(() => pwRef.current?.focus(), 50)
    }
  }, [modal?.type])

  function handleSubmit() {
    if (pw === ADMIN_PW) {
      store.enterAdmin()
      closeModal()
    } else {
      setErr('パスワードが違います')
      setPw('')
      pwRef.current?.focus()
    }
  }

  if (modal?.type !== 'adminAuth') return null

  return (
    <div className="ov" onClick={e => e.target === e.currentTarget && closeModal()}>
      <div className="md" style={{ maxWidth: 320 }}>
        <div className="mh">
          <span>🔒 管理者認証</span>
          <button className="cls" onClick={closeModal}>✕</button>
        </div>
        <div className="mb">
          <div className="fg">
            <label>管理者パスワード</label>
            <input ref={pwRef} type="password" value={pw}
              onChange={e => { setPw(e.target.value); setErr('') }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="パスワードを入力" />
            {err && <span style={{ color: '#dc2626', fontSize: 11 }}>{err}</span>}
          </div>
        </div>
        <div className="mf">
          <button className="btn" onClick={closeModal}>キャンセル</button>
          <button className="btn p" onClick={handleSubmit}>認証</button>
        </div>
      </div>
    </div>
  )
}
