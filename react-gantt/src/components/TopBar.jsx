import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store.js'
import { td } from '../utils/dates.js'
import { sbSaveTask, sbSavePH } from '../utils/supabase.js'

export default function TopBar() {
  const {
    _pjs, _cur, adminMode, pj, switchPJ, addPJ, renamePJ,
    openModal, forceReload, sbStatus
  } = useStore()
  const pjs = _pjs()
  const cur = _cur()
  const [pjname, setPjname] = useState('')
  const [gearOpen, setGearOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const gearRef = useRef(null)
  const helpRef = useRef(null)

  useEffect(() => {
    function onClick(e) {
      if (gearRef.current && !gearRef.current.contains(e.target)) setGearOpen(false)
      if (helpRef.current && !helpRef.current.contains(e.target)) setHelpOpen(false)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  const sbLabel = sbStatus === 'ok' ? '✅ 保存済' : sbStatus === 'busy' ? '⏳ 保存中…' : sbStatus === 'err' ? '❌ 保存失敗' : '接続中…'

  return (
    <div id="topbar" style={adminMode ? { background: 'linear-gradient(135deg,#0f2a4a 0%,#1a3a6e 100%)', borderBottom: '2px solid rgba(37,99,235,.6)' } : {}}>
      <span className="logo" style={adminMode ? { color: '#fff' } : {}}>{adminMode ? '🔒 管理者' : '📋 商品企画部'}</span>
      <div className="pjs">
        <select value={cur || ''} onChange={e => switchPJ(e.target.value || null)}
          style={{ maxWidth: 170 }}>
          <option value="">プロジェクト選択...</option>
          {Object.entries(pjs).map(([id, p]) => (
            <option key={id} value={id}>{p.name}</option>
          ))}
        </select>
        {cur && (
          <button className="btn" onClick={() => {
            const name = prompt('新しいプロジェクト名を入力してください', pj()?.name)
            if (name === null) return
            const n = name.trim()
            if (!n) return alert('プロジェクト名を入力してください')
            renamePJ(n)
          }}>✏️</button>
        )}
        <input type="text" placeholder="新規プロジェクト名" value={pjname} onChange={e => setPjname(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && pjname.trim()) { addPJ(pjname.trim()); setPjname('') } }} />
        <button className="btn p" onClick={() => { if (pjname.trim()) { addPJ(pjname.trim()); setPjname('') } }}>作成</button>
      </div>
      <div className="tbr">
        {/* Supabase status */}
        <span style={{ fontSize: 11, color: 'var(--tx3)', display: 'flex', alignItems: 'center', gap: 4, padding: '0 4px' }}>
          <span className={`sb-dot${sbStatus ? ' ' + sbStatus : ''}`}></span>
          <span>{sbLabel}</span>
        </span>
        <button className="btn" onClick={forceReload} title="DBから最新データを再読み込み" style={{ fontSize: 11, padding: '2px 7px' }}>🔄</button>
        {/* Gear menu */}
        <div ref={gearRef} style={{ position: 'relative' }}>
          <button id="gear-btn" className="btn" onClick={() => setGearOpen(o => !o)} title="設定"
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', fontSize: 12 }}>
            ⚙️ 設定
          </button>
          {gearOpen && (
            <div style={{ position: 'fixed', zIndex: 2000, background: 'var(--s1)', border: '1px solid var(--bd2)', borderRadius: 8, boxShadow: '0 6px 24px rgba(0,0,0,.18)', minWidth: 200, right: 8, top: 44 }}>
              <div className="gmenu-item" onClick={() => { exportCSVHandler(); setGearOpen(false) }}><span>⬇️</span><div><div style={{ fontWeight: 600 }}>CSVエクスポート</div><div style={{ fontSize: 10, color: 'var(--tx3)' }}>現在のプロジェクトをCSV保存</div></div></div>
              <div className="gmenu-item" onClick={() => { document.getElementById('csv-import-input').click(); setGearOpen(false) }}><span>⬆️</span><div><div style={{ fontWeight: 600 }}>CSVインポート</div></div></div>
              <div className="gmenu-item" onClick={() => { downloadCSVTemplate(); setGearOpen(false) }}><span>📄</span><div><div style={{ fontWeight: 600 }}>CSV雛形ダウンロード</div></div></div>
              <div style={{ height: 1, background: 'var(--bd)', margin: '2px 10px' }}></div>
              <div className="gmenu-item" onClick={() => { openModal('members'); setGearOpen(false) }}><span>👥</span><div><div style={{ fontWeight: 600 }}>担当者管理</div></div></div>
              <div className="gmenu-item" onClick={() => { openModal('backup'); setGearOpen(false) }}><span>💾</span><div><div style={{ fontWeight: 600 }}>バックアップ管理</div></div></div>
              {/* 管理者用セクション */}
              <div style={{ height: 1, background: 'var(--bd)', margin: '2px 10px' }}></div>
              <div style={{ padding: '4px 14px 2px', fontSize: 10, color: 'var(--tx3)', fontWeight: 700, letterSpacing: '.05em' }}>管理者用</div>
              <div className="gmenu-item" onClick={() => { openModal('supabase'); setGearOpen(false) }}><span>🔌</span><div><div style={{ fontWeight: 600 }}>Supabase設定</div></div></div>
              {cur && (
                <div className="gmenu-item" style={{ color: 'var(--rd)' }}
                  onClick={() => { openModal('delete', { type: 'project', id: cur, label: pjs[cur]?.name }); setGearOpen(false) }}>
                  <span>🗑️</span><div><div style={{ fontWeight: 600 }}>プロジェクト削除</div><div style={{ fontSize: 10, color: 'var(--rd)', opacity: .8 }}>パスワード必要</div></div>
                </div>
              )}
              <div className="gmenu-item"
                onClick={() => {
                  const s = useStore.getState()
                  if (s.adminMode) s.exitAdmin(); else openModal('adminAuth')
                  setGearOpen(false)
                }}>
                <span>🔒</span><div><div style={{ fontWeight: 600 }}>管理者モード切替</div><div style={{ fontSize: 10, color: 'var(--tx3)' }}>ショートカット: Ctrl+Shift+Z</div></div>
              </div>
            </div>
          )}
        </div>
        {/* Help */}
        <div ref={helpRef} style={{ position: 'relative' }}>
          <button id="help-btn" className="btn" onClick={() => setHelpOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', padding: 0, fontWeight: 700 }}>?</button>
          {helpOpen && <HelpPopup />}
        </div>
      </div>
      {/* hidden csv input */}
      <input type="file" id="csv-import-input" accept=".csv" style={{ display: 'none' }} onChange={e => importCSVHandler(e)} />
    </div>
  )
}

function HelpPopup() {
  return (
    <div style={{ position: 'fixed', zIndex: 3000, background: 'var(--s1)', border: '1px solid var(--bd2)', borderRadius: 10, boxShadow: '0 6px 24px rgba(0,0,0,.2)', padding: '16px 18px', minWidth: 300, fontSize: 12.5, right: 8, top: 44 }}>
      <div style={{ fontWeight: 700, color: 'var(--tx)', marginBottom: 10, fontSize: 13.5 }}>⌨️ キーボードショートカット</div>
      <table style={{ borderCollapse: 'collapse', width: '100%', lineHeight: 2 }}>
        {[
          ['Ctrl + Z', '元に戻す'], ['Ctrl + Y', 'やり直す'], ['Ctrl + S', 'タスク編集を保存'],
          ['Ctrl + M', 'タスクを追加'], ['Ctrl + Shift + F', 'フェーズを追加'],
          ['Ctrl + q', 'ビュー切替'], ['Ctrl + ↑', 'フェーズをすべて閉じる'], ['Ctrl + ↓', 'フェーズをすべて開く'],
          ['Ctrl + ← →', 'プロジェクト切替'], ['Ctrl + F', '検索欄にフォーカス'],
          ['Ctrl + Shift + ← →', 'ステータスフィルタ切替'],
          ['Ctrl + Shift + x', '☆フィルタ ON/OFF'],
          ['Ctrl + Shift + d', 'フィルタ全解除'], ['Ctrl + Shift + z', '管理者モード切替'],
          ['↑ ↓', '選択タスクを上下移動'], ['← →', '選択タスクの親子切替'], ['Esc', 'モーダルを閉じる'],
        ].map(([key, desc]) => (
          <tr key={key}>
            <td style={{ color: 'var(--tx3)', padding: '2px 10px 2px 0', whiteSpace: 'nowrap' }}>
              <kbd style={{ background: 'var(--s3)', border: '1px solid var(--bd2)', borderRadius: 3, padding: '2px 6px', fontSize: 11 }}>{key}</kbd>
            </td>
            <td style={{ color: 'var(--tx2)' }}>{desc}</td>
          </tr>
        ))}
      </table>
    </div>
  )
}

function exportCSVHandler() {
  const s = useStore.getState()
  const p = s.pj(); if (!p) return alert('プロジェクトを選択してください')
  const hd = ['id','phaseId','parentId','name','startDate','endDate','completedDate','status','assignee','effort','memo','updatedAt']
  const rows = [hd.join(',')]
  p.tasks.forEach(t => rows.push(hd.map(h => `"${String(t[h]||'').replace(/"/g,'""')}"`).join(',')))
  rows.push('','## PHASES ##','id,name,startDate,endDate')
  p.phases.forEach(ph => rows.push(['id','name','startDate','endDate'].map(h => `"${String(ph[h]||'').replace(/"/g,'""')}"`).join(',')))
  const csv = rows.join('\n')
  const bom = new Uint8Array([0xEF,0xBB,0xBF])
  const body = new TextEncoder().encode(csv)
  const m = new Uint8Array(bom.length+body.length); m.set(bom); m.set(body,bom.length)
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([m],{type:'text/csv;charset=utf-8'})); a.download = `${p.name}_${td()}.csv`; a.click()
}

function downloadCSVTemplate() {
  const rows = [
    'id,phaseId,parentId,name,startDate,endDate,completedDate,status,assignee,effort,memo,updatedAt',
    '"t_001","ph_001","","企画・要件定義","2026-05-01","2026-05-10","","todo","田中","8","","2026-05-01"',
    '','## PHASES ##','id,name,startDate,endDate',
    '"ph_001","企画フェーズ","2026-05-01","2026-05-10"',
  ]
  const csv = rows.join('\n')
  const bom = new Uint8Array([0xEF,0xBB,0xBF])
  const body = new TextEncoder().encode(csv)
  const m = new Uint8Array(bom.length+body.length); m.set(bom); m.set(body,bom.length)
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([m],{type:'text/csv;charset=utf-8'})); a.download = 'gantt_import_template.csv'; a.click()
}

function importCSVHandler(ev) {
  const s = useStore.getState()
  if (!s._cur()) return alert('プロジェクトを選択してください')
  const file = ev.target.files[0]; if (!file) return
  const r = new FileReader()
  r.onload = e => {
    try {
      const lines = e.target.result.split('\n'); let mode = 'tasks', hd = null; const nt = [], np = []
      lines.forEach(line => {
        line = line.trim(); if (!line) return
        if (line.startsWith('## PHASES ##')) { mode = 'phases'; hd = null; return }
        const cols = parseCSVLine(line); if (!hd) { hd = cols; return }
        if (mode === 'tasks' && cols[3]) {
          const t = {}; hd.forEach((h, i) => t[h] = cols[i] || '')
          nt.push({ id: t.id||'t_'+Date.now()+Math.random().toString(36).slice(2), phaseId: t.phaseId||null, parentId: t.parentId||null, name: t.name, startDate: t.startDate||'', endDate: t.endDate||'', completedDate: t.completedDate||null, status: t.status||'todo', assignee: t.assignee||'', effort: parseFloat(t.effort)||1, memo: t.memo||'', updatedAt: t.updatedAt||'' })
        } else if (mode === 'phases' && cols[1]) {
          np.push({ id: cols[0]||'ph_'+Date.now(), name: cols[1], startDate: cols[2]||'', endDate: cols[3]||'' })
        }
      })
      const pjs = JSON.parse(JSON.stringify(s._pjs()))
      const cur = s._cur()
      if (confirm(`${nt.length}件タスク、${np.length}件フェーズ。追加統合しますか？（キャンセル=置き換え）`)) {
        pjs[cur].tasks = [...pjs[cur].tasks, ...nt]; pjs[cur].phases = [...pjs[cur].phases, ...np]
      } else { pjs[cur].tasks = nt; pjs[cur].phases = np }
      s._setPjs(pjs); s.save()
      pjs[cur].tasks.forEach(t => sbSaveTask(t, cur, pjs, s.adminMode))
      pjs[cur].phases.forEach(ph => sbSavePH(ph, cur, pjs, s.adminMode))
      alert('インポート完了')
    } catch (err) { alert('CSVエラー: ' + err.message) }
    ev.target.value = ''
  }
  r.readAsText(file, 'Shift-JIS')
}

function parseCSVLine(line) {
  const res = []; let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++ } else inQ = !inQ }
    else if (c === ',' && !inQ) { res.push(cur); cur = '' }
    else cur += c
  }
  res.push(cur); return res
}
