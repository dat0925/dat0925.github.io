import { useState, useEffect } from 'react'
import { PW, AUTH_DAYS } from '../utils/constants.js'
import { isAuthed, setAuthed } from '../utils/storage.js'

export default function AuthOverlay({ onAuthed }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [show, setShow] = useState(false)
  const [visible, setVisible] = useState(!isAuthed())

  useEffect(() => {
    if (isAuthed()) { onAuthed(); setVisible(false) }
  }, [])

  if (!visible) return null

  function check() {
    if (pw === PW) {
      setAuthed(AUTH_DAYS)
      setVisible(false)
      onAuthed()
    } else {
      setErr('パスワードが違います')
      setPw('')
      setTimeout(() => setErr(''), 2000)
    }
  }

  return (
    <div id="auth-overlay">
      <div className="auth-box">
        <div className="auth-logo">📋 商品企画部ガントチャート</div>
        <div className="auth-sub">パスワードを入力してください</div>
        <div className="auth-pw-wrap">
          <input
            className="auth-input"
            type={show ? 'text' : 'password'}
            placeholder="••••••••"
            value={pw}
            onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && check()}
            autoFocus
          />
          <button className="auth-pw-toggle" onClick={() => setShow(s => !s)}>{show ? '非表示' : '表示'}</button>
        </div>
        <button className="auth-btn" onClick={check}>入室する</button>
        <div className="auth-err">{err}</div>
      </div>
    </div>
  )
}
