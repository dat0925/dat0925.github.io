import { useRef, useEffect } from 'react'
import { useStore } from '../store.js'
import { drawApgChart } from '../utils/ganttCanvas.js'
import { td } from '../utils/dates.js'
import { SL } from '../utils/constants.js'

export default function AllProjectsView() {
  const store = useStore()
  const { _pjs, apgScale, setApgScale, apgSd } = store
  const pjs = _pjs()
  const ids = Object.keys(pjs)
  const canvasRef = useRef(null)
  const namesRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (canvasRef.current && namesRef.current && ids.length > 0) {
      drawApgChart(canvasRef.current, namesRef.current, ids, pjs, apgScale, apgSd)
      // wire click on names panel
      const el = namesRef.current
      function onClick(e) {
        const row = e.target.closest('[data-pj-id]')
        if (row) {
          store.switchPJ(row.dataset.pjId)
          store.setView('gantt')
        }
      }
      el.addEventListener('click', onClick)
      return () => el.removeEventListener('click', onClick)
    }
  }, [pjs, apgScale, apgSd])

  if (ids.length === 0) {
    return (
      <div id="apg" className="show">
        <div className="emp"><div className="ic">📁</div><div className="et">プロジェクトがありません</div></div>
      </div>
    )
  }

  const today = td()

  // Starred tasks across all projects
  const starredTasks = ids.flatMap(id =>
    (pjs[id].tasks || [])
      .filter(t => t.starred && t.status !== 'done' && t.status !== 'cancelled')
      .map(t => ({ ...t, _pjName: pjs[id].name, _pjId: id }))
  )

  // Tasks needing adjustment (overdue or start passed but still todo)
  const needsAdjust = ids.flatMap(id =>
    (pjs[id].tasks || [])
      .filter(t => {
        if (t.status === 'done' || t.status === 'cancelled') return false
        const overdue = t.endDate && t.endDate < today
        const delayed = t.startDate && t.startDate < today && t.status === 'todo'
        return overdue || delayed
      })
      .map(t => ({ ...t, _pjName: pjs[id].name, _pjId: id }))
  )

  function gotoTask(pjId, taskId) {
    store.switchPJ(pjId)
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

  return (
    <div id="apg" className="show">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>全プロジェクト概要</h2>
        <div className="tg" style={{ marginLeft: 'auto' }}>
          {[['week','週'],['month','月'],['day','日']].map(([s,l]) => (
            <div key={s} className={`tab${apgScale===s?' on':''}`} onClick={() => setApgScale(s)}>{l}</div>
          ))}
        </div>
      </div>

      {/* All projects Gantt - split layout: names left, chart right */}
      <div ref={wrapRef} style={{ display: 'flex', marginBottom: 16, border: '1px solid var(--bd2)', borderRadius: 6, overflow: 'hidden', maxHeight: 400 }}>
        <div ref={namesRef} style={{ width: 200, flexShrink: 0, overflowY: 'auto', borderRight: '1px solid var(--bd2)' }}></div>
        <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
          <canvas ref={canvasRef} style={{ display: 'block' }}></canvas>
        </div>
      </div>

      {/* Starred tasks */}
      {starredTasks.length > 0 && (
        <>
          <div className="sst" style={{ color: '#f59e0b' }}>★ お気に入りタスク ({starredTasks.length}件)</div>
          {starredTasks.map(t => (
            <div key={t.id + t._pjId} className="pi" style={{ cursor: 'pointer' }} onClick={() => gotoTask(t._pjId, t.id)}>
              <div>
                <div className="pi-t">{t.name}</div>
                <div className="pi-m">{t._pjName} · {t.assignee || '未担当'} · {t.endDate || '期限なし'}</div>
              </div>
              <span className={`bdg ${t.status}`}>{SL[t.status]}</span>
            </div>
          ))}
        </>
      )}

      {/* Needs adjustment */}
      {needsAdjust.length > 0 && (
        <>
          <div className="sst" style={{ color: '#dc2626' }}>⚠ 要期間調整 ({needsAdjust.length}件)</div>
          {needsAdjust.map(t => {
            const overdue = t.endDate && t.endDate < today
            return (
              <div key={t.id + t._pjId} className={`pi ${overdue ? 'dng' : 'wrn'}`} style={{ cursor: 'pointer' }} onClick={() => gotoTask(t._pjId, t.id)}>
                <div>
                  <div className="pi-t">{t.name}</div>
                  <div className="pi-m">{t._pjName} · {t.assignee || '未担当'} · {t.startDate}〜{t.endDate}</div>
                </div>
                <span className={`bdg ${t.status}`}>{SL[t.status]}</span>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
