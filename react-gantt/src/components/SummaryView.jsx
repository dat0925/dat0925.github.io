import { useStore } from '../store.js'
import { td, diffD, fmt } from '../utils/dates.js'
import { SL } from '../utils/constants.js'

export default function SummaryView() {
  const store = useStore()
  const pj = store.pj()

  if (!pj) {
    return (
      <div id="sv" className="show">
        <div className="emp"><div className="ic">📊</div><div className="et">プロジェクトを選択してください</div></div>
      </div>
    )
  }

  const ts = pj.tasks, today = td()
  const cnt = { todo: 0, inprogress: 0, requested: 0, done: 0, cancelled: 0 }
  ts.forEach(t => cnt[t.status] = (cnt[t.status] || 0) + 1)
  const total = ts.length, rate = total ? Math.round(cnt.done / total * 100) : 0
  const ov = ts.filter(t => t.endDate && t.endDate < today && t.status !== 'done' && t.status !== 'cancelled')
  const rk = ts.filter(t => {
    if (t.status === 'done' || t.status === 'cancelled') return false
    if (!t.endDate) return false
    const d = diffD(today, t.endDate)
    return d >= 0 && d <= 3
  })

  function gotoTask(taskId) {
    const t = ts.find(x => x.id === taskId)
    if (t) {
      if (t.phaseId) store.togglePh(t.phaseId) // ensure expanded
    }
    store.setView('gantt')
    setTimeout(() => {
      const el = document.getElementById('tr_' + taskId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.style.transition = 'background .2s'
        el.style.background = 'rgba(37,99,235,.12)'
        setTimeout(() => el.style.background = '', 1000)
      }
      store.openModal('editTask', { id: taskId })
    }, 150)
  }

  function scrollToPhase(phId) {
    store.setView('gantt')
    setTimeout(() => {
      const rows = []
      let y = 0
      pj.phases.forEach(ph => {
        if (ph.id === phId) {
          const tb = document.getElementById('tpb')
          const cb = document.getElementById('cbw')
          if (tb) tb.scrollTop = y
          if (cb) cb.scrollTop = y
        }
        y += 35
        pj.tasks.filter(t => t.phaseId === ph.id && !t.parentId).forEach(() => { y += 35 })
      })
    }, 50)
  }

  return (
    <div id="sv" className="show">
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{pj.name} — 進捗サマリー</h2>
      <div className="sg">
        <div className="sc"><div className="sl">総タスク</div><div className="sv2 ac">{total}</div></div>
        <div className="sc"><div className="sl">完了率</div><div className="sv2 gn">{rate}%</div></div>
        <div className="sc"><div className="sl">進行中</div><div className="sv2 ac">{cnt.inprogress}</div></div>
        <div className="sc"><div className="sl">未着手</div><div className="sv2">{cnt.todo}</div></div>
        <div className="sc"><div className="sl">期限切れ</div><div className="sv2 rd">{ov.length}</div></div>
      </div>

      {pj.phases.length > 0 && (
        <>
          <div className="sst">フェーズ別進捗 <span style={{ fontSize: 9, fontWeight: 400, color: 'var(--tx3)', marginLeft: 4 }}>（タップでガント遷移）</span></div>
          {pj.phases.map(ph => {
            const pt = ts.filter(t => t.phaseId === ph.id)
            const done = pt.filter(t => t.status === 'done').length
            const pct = pt.length ? Math.round(done / pt.length * 100) : 0
            const hov = pt.some(t => t.endDate && t.endDate < today && t.status !== 'done' && t.status !== 'cancelled')
            const cls = pct < 30 && hov ? 'dng' : hov ? 'wrn' : ''
            const col = pct >= 80 ? '#16a34a' : pct >= 50 ? '#2563eb' : '#d97706'
            return (
              <div key={ph.id} className={`pi ${cls}`} style={{ cursor: 'pointer' }} onClick={() => scrollToPhase(ph.id)}>
                <div style={{ flex: 1 }}>
                  <div className="pi-t">{ph.name}</div>
                  <div className="pi-m">{done}/{pt.length}件完了 · {ph.startDate}〜{ph.endDate}</div>
                  <div className="pb"><div className="pbf" style={{ width: pct + '%', background: col }}></div></div>
                </div>
                <div className="ppct">{pct}%</div>
              </div>
            )
          })}
        </>
      )}

      {ov.length > 0 && (
        <>
          <div className="sst" style={{ color: '#dc2626' }}>⚠ 期限切れ({ov.length}件)</div>
          {ov.map(t => (
            <div key={t.id} className="pi dng" style={{ cursor: 'pointer' }} onClick={() => gotoTask(t.id)}>
              <div>
                <div className="pi-t">{t.name}</div>
                <div className="pi-m">{t.assignee || '未担当'} · {t.endDate}</div>
              </div>
              <span className={`bdg ${t.status}`}>{SL[t.status]}</span>
            </div>
          ))}
        </>
      )}

      {rk.length > 0 && (
        <>
          <div className="sst" style={{ color: '#d97706' }}>⚡ 期限3日以内({rk.length}件)</div>
          {rk.map(t => (
            <div key={t.id} className="pi wrn" style={{ cursor: 'pointer' }} onClick={() => gotoTask(t.id)}>
              <div>
                <div className="pi-t">{t.name}</div>
                <div className="pi-m">{t.assignee || '未担当'} · {t.endDate}</div>
              </div>
              <span className={`bdg ${t.status}`}>{SL[t.status]}</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
