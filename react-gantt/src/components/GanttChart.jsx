import { useRef, useEffect, useCallback } from 'react'
import { useStore, computeRows } from '../store.js'
import { drawHdr, drawBody, getBarInfo, getRowAtY, getDays, cw } from '../utils/ganttCanvas.js'
import { td, addD, diffD } from '../utils/dates.js'
import { ROW, PHROW } from '../utils/constants.js'

export default function GanttChart({ tpbScrollTop, onScrollSync }) {
  const store = useStore()
  const { scale, sd, filters, favFilter, exp, openModal } = store
  const pj = store.pj()

  const hdrRef = useRef(null)
  const bodyRef = useRef(null)
  const hdrWrapRef = useRef(null)
  const bodyWrapRef = useRef(null)

  const cdragRef = useRef({ active: false })
  const syncingRef = useRef(false)

  const { rows } = pj
    ? computeRows(pj.tasks, pj.phases, exp, filters, favFilter)
    : { rows: [] }

  // Draw header
  useEffect(() => {
    if (hdrRef.current) drawHdr(hdrRef.current, scale, sd)
  }, [scale, sd])

  // Draw body
  useEffect(() => {
    if (bodyRef.current) drawBody(bodyRef.current, rows, scale, sd)
  }, [rows, scale, sd])

  // Sync scroll from task panel → chart
  useEffect(() => {
    if (!bodyWrapRef.current) return
    if (!syncingRef.current) {
      syncingRef.current = true
      bodyWrapRef.current.scrollTop = tpbScrollTop || 0
      syncingRef.current = false
    }
  }, [tpbScrollTop])

  // Scroll sync: chart body → task panel + chart header
  useEffect(() => {
    const el = bodyWrapRef.current
    if (!el) return
    function onScroll() {
      if (syncingRef.current) return
      syncingRef.current = true
      if (onScrollSync) onScrollSync(el.scrollTop)
      if (hdrWrapRef.current) hdrWrapRef.current.scrollLeft = el.scrollLeft
      syncingRef.current = false
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [onScrollSync])

  // Chart drag (bar resize/move)
  useEffect(() => {
    const canvas = bodyRef.current
    const wrap = bodyWrapRef.current
    if (!canvas || !wrap) return

    function getRowFromY(y) {
      const r = computeRows(pj?.tasks||[], pj?.phases||[], store.exp, store.filters, store.favFilter).rows
      return getRowAtY(y, r)
    }

    function onMouseMove(e) {
      const cd = cdragRef.current
      if (cd.active) {
        const dx = e.clientX - cd.startX
        const colW = cw(scale)
        const dd = Math.round(dx / colW)
        const pjData = store.pj(); if (!pjData) return
        const t = pjData.tasks.find(x => x.id === cd.taskId); if (!t) return
        // mutate a temp copy for visual
        const tempT = { ...t }
        if (cd.mode === 'move') { const dur = diffD(cd.origStart, cd.origEnd); tempT.startDate = addD(cd.origStart, dd); tempT.endDate = addD(tempT.startDate, dur) }
        else if (cd.mode === 'left') { const ns = addD(cd.origStart, dd); if (ns <= cd.origEnd) tempT.startDate = ns }
        else { const ne = addD(cd.origEnd, dd); if (ne >= cd.origStart) tempT.endDate = ne }
        // re-draw with temp
        const r = computeRows(pjData.tasks.map(x=>x.id===cd.taskId?tempT:x), pjData.phases, store.exp, store.filters, store.favFilter).rows
        if (bodyRef.current) drawBody(bodyRef.current, r, scale, sd)
        return
      }
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left + wrap.scrollLeft
      const y = e.clientY - rect.top + wrap.scrollTop
      const row = getRowAtY(y, computeRows(pj?.tasks||[], pj?.phases||[], store.exp, store.filters, store.favFilter).rows)
      if (row && row.type === 't') {
        const info = getBarInfo(row.data, scale, sd)
        if (info && x >= info.bx && x <= info.bx + info.bw)
          canvas.style.cursor = (x <= info.bx + 8 || x >= info.bx + info.bw - 8) ? 'ew-resize' : 'grab'
        else canvas.style.cursor = 'default'
      } else canvas.style.cursor = 'default'
    }

    function onMouseDown(e) {
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left + wrap.scrollLeft
      const y = e.clientY - rect.top + wrap.scrollTop
      const row = getRowAtY(y, computeRows(pj?.tasks||[], pj?.phases||[], store.exp, store.filters, store.favFilter).rows)
      if (!row || row.type !== 't') return
      const info = getBarInfo(row.data, scale, sd)
      if (!info || x < info.bx || x > info.bx + info.bw) return
      e.preventDefault()
      cdragRef.current = { active: true, taskId: row.data.id, startX: e.clientX, origStart: row.data.startDate, origEnd: row.data.endDate, mode: x <= info.bx + 8 ? 'left' : x >= info.bx + info.bw - 8 ? 'right' : 'move' }
      canvas.style.cursor = cdragRef.current.mode === 'move' ? 'grabbing' : 'ew-resize'
    }

    function endDrag() {
      const cd = cdragRef.current
      if (!cd.active) return
      cd.active = false
      const pjData = store.pj(); if (!pjData) return
      const t = pjData.tasks.find(x => x.id === cd.taskId); if (!t) return
      // apply the final drag position
      const dd = Math.round((window._lastMouseX || 0 - cd.startX) / cw(scale))
      // re-compute actual updated dates from last render
      // find the task in the current rows visual state -- simplest: just save current canvas
      // Actually: recalculate from stored cdrag info
      store.forceReload && (() => {})() // no-op, just trigger re-render
      canvas.style.cursor = 'default'
      cdragRef.current = { active: false }
      store.forceReload ? null : null
      // re-render
      if (bodyRef.current) drawBody(bodyRef.current, computeRows(pjData.tasks, pjData.phases, store.exp, store.filters, store.favFilter).rows, scale, sd)
    }

    function onMouseUpFinal(e) {
      const cd = cdragRef.current
      if (!cd.active) return
      cd.active = false
      const pjData = store.pj(); if (!pjData) return
      const t = pjData.tasks.find(x => x.id === cd.taskId); if (!t) return
      const colW = cw(scale)
      const dx = e.clientX - cd.startX
      const dd = Math.round(dx / colW)
      let newStart = t.startDate, newEnd = t.endDate
      if (cd.mode === 'move') { const dur = diffD(cd.origStart, cd.origEnd); newStart = addD(cd.origStart, dd); newEnd = addD(newStart, dur) }
      else if (cd.mode === 'left') { const ns = addD(cd.origStart, dd); if (ns <= cd.origEnd) newStart = ns }
      else { const ne = addD(cd.origEnd, dd); if (ne >= cd.origStart) newEnd = ne }
      store.updateTaskDates(cd.taskId, newStart, newEnd)
      canvas.style.cursor = 'default'
    }

    function onDblClick(e) {
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left + wrap.scrollLeft
      const y = e.clientY - rect.top + wrap.scrollTop
      const row = getRowAtY(y, computeRows(pj?.tasks||[], pj?.phases||[], store.exp, store.filters, store.favFilter).rows)
      if (!row) return
      if (row.type === 't') {
        const info = getBarInfo(row.data, scale, sd)
        if (info && x >= info.bx && x <= info.bx + info.bw) openModal('editTask', { id: row.data.id })
      } else if (row.type === 'ph') {
        openModal('editPh', { id: row.data.id })
      }
    }

    // Touch events
    function onTouchStart(e) {
      const touch = e.touches[0]
      const rect = canvas.getBoundingClientRect()
      const x = touch.clientX - rect.left + wrap.scrollLeft
      const y = touch.clientY - rect.top + wrap.scrollTop
      const row = getRowAtY(y, computeRows(pj?.tasks||[], pj?.phases||[], store.exp, store.filters, store.favFilter).rows)
      if (!row || row.type !== 't') return
      const info = getBarInfo(row.data, scale, sd)
      if (!info || x < info.bx || x > info.bx + info.bw) return
      e.preventDefault()
      cdragRef.current = { active: true, taskId: row.data.id, startX: touch.clientX, origStart: row.data.startDate, origEnd: row.data.endDate, mode: x <= info.bx + 10 ? 'left' : x >= info.bx + info.bw - 10 ? 'right' : 'move' }
    }
    function onTouchMove(e) {
      const cd = cdragRef.current
      if (!cd.active) return
      e.preventDefault()
      const touch = e.touches[0]
      const dx = touch.clientX - cd.startX
      const colW = cw(scale)
      const dd = Math.round(dx / colW)
      const pjData = store.pj(); if (!pjData) return
      const t = pjData.tasks.find(x => x.id === cd.taskId); if (!t) return
      const tempT = { ...t }
      if (cd.mode === 'move') { const dur = diffD(cd.origStart, cd.origEnd); tempT.startDate = addD(cd.origStart, dd); tempT.endDate = addD(tempT.startDate, dur) }
      else if (cd.mode === 'left') { const ns = addD(cd.origStart, dd); if (ns <= cd.origEnd) tempT.startDate = ns }
      else { const ne = addD(cd.origEnd, dd); if (ne >= cd.origStart) tempT.endDate = ne }
      const r = computeRows(pjData.tasks.map(x=>x.id===cd.taskId?tempT:x), pjData.phases, store.exp, store.filters, store.favFilter).rows
      if (bodyRef.current) drawBody(bodyRef.current, r, scale, sd)
    }
    function onTouchEnd(e) {
      const cd = cdragRef.current
      if (!cd.active) return
      const touch = e.changedTouches[0]
      onMouseUpFinal({ clientX: touch.clientX })
    }

    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUpFinal)
    canvas.addEventListener('dblclick', onDblClick)
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUpFinal)
      canvas.removeEventListener('dblclick', onDblClick)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
    }
  }, [scale, sd, pj, exp, filters, favFilter])

  return (
    <div id="cp">
      <div id="chw" ref={hdrWrapRef} style={{ height: 52 }}>
        <canvas id="chc" ref={hdrRef} style={{ display: 'block' }}></canvas>
      </div>
      <div id="cbw" ref={bodyWrapRef}>
        <canvas id="cbc" ref={bodyRef} style={{ display: 'block' }}></canvas>
      </div>
    </div>
  )
}
