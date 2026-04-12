import { HOLS, DN, HDR, ROW, PHROW, SC } from './constants.js'
import { pd, addD, td, diffD, fmt } from './dates.js'

export function getDays(scale, sd) {
  const n = scale === 'day' ? 90 : scale === 'week' ? 180 : 365
  const start = sd || addD(td(), -7)
  const days = []
  for (let i = 0; i < n; i++) days.push(addD(start, i))
  return { days, start }
}

export function cw(scale) {
  return scale === 'day' ? 28 : scale === 'week' ? 14 : 7
}

function rr(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2
  if (h < 2 * r) r = h / 2
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function drawML(ctx, ms, me, colW, label, mh) {
  const x = ms * colW
  const w = (me - ms) * colW
  ctx.save()
  ctx.beginPath()
  ctx.rect(x + 2, 0, w - 4, mh)
  ctx.clip()
  ctx.font = '700 11px -apple-system,sans-serif'
  ctx.fillStyle = '#374151'
  ctx.textAlign = 'left'
  ctx.fillText(label, x + 5, mh - 4)
  ctx.restore()
}

export function drawHdr(canvas, scale, sd) {
  const { days } = getDays(scale, sd)
  const W = days.length * cw(scale)
  const dpr = window.devicePixelRatio || 1
  const M_H = 17, D_H = 18, W_H = 17
  canvas.width = W * dpr
  canvas.height = HDR * dpr
  canvas.style.width = W + 'px'
  canvas.style.height = HDR + 'px'
  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)
  ctx.fillStyle = '#f0f2f5'
  ctx.fillRect(0, 0, W, HDR)

  const colW = cw(scale)
  const today = td()

  // month row
  let cm = null, ms = 0
  days.forEach((d, i) => {
    const dt = pd(d)
    const m = `${dt.getFullYear()}年${dt.getMonth() + 1}月`
    if (m !== cm) { if (cm) drawML(ctx, ms, i, colW, cm, M_H); cm = m; ms = i }
  })
  if (cm) drawML(ctx, ms, days.length, colW, cm, M_H)
  ctx.strokeStyle = '#d0d5dd'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, M_H); ctx.lineTo(W, M_H); ctx.stroke()

  if (scale === 'day') {
    days.forEach((d, i) => {
      const dt = pd(d); const x = i * colW; const w = colW
      const isT = d === today, isWE = dt.getDay() === 0 || dt.getDay() === 6, isH = HOLS.has(d)
      if (isT) { ctx.fillStyle = 'rgba(220,38,38,.10)'; ctx.fillRect(x, M_H, w, D_H + W_H) }
      else if (isH) { ctx.fillStyle = 'rgba(217,119,6,.08)'; ctx.fillRect(x, M_H, w, D_H + W_H) }
      else if (isWE) { ctx.fillStyle = 'rgba(124,58,237,.05)'; ctx.fillRect(x, M_H, w, D_H + W_H) }
      ctx.strokeStyle = '#d0d5dd'; ctx.lineWidth = .5
      ctx.beginPath(); ctx.moveTo(x + w, M_H); ctx.lineTo(x + w, HDR); ctx.stroke()
      if (w >= 10) {
        const dc = isT ? '#dc2626' : isH ? '#d97706' : isWE ? '#7c3aed' : '#374151'
        const wc = isT ? '#dc2626' : isH ? '#d97706' : isWE ? '#7c3aed' : '#9ca3af'
        ctx.textAlign = 'center'
        ctx.font = '600 11px -apple-system,sans-serif'; ctx.fillStyle = dc
        ctx.fillText(dt.getDate(), x + w / 2, M_H + D_H - 4)
        if (w >= 18) {
          ctx.font = '500 10px -apple-system,sans-serif'; ctx.fillStyle = wc
          ctx.fillText(DN[dt.getDay()], x + w / 2, M_H + D_H + W_H - 4)
        }
      }
    })
  } else if (scale === 'week') {
    days.forEach((d, i) => {
      const dt = pd(d)
      if (dt.getDay() === 1 || i === 0) {
        const x = i * colW
        if (i > 0) {
          ctx.strokeStyle = '#c8cdd8'; ctx.lineWidth = 1
          ctx.beginPath(); ctx.moveTo(x, M_H); ctx.lineTo(x, HDR); ctx.stroke()
        }
        if (colW >= 10) {
          ctx.font = '500 10px -apple-system,sans-serif'; ctx.fillStyle = '#6b7280'; ctx.textAlign = 'left'
          ctx.fillText(`${dt.getMonth() + 1}/${dt.getDate()}`, x + 2, HDR - 5)
        }
      }
      const isWE = dt.getDay() === 0 || dt.getDay() === 6, isH = HOLS.has(d)
      if (isWE || isH) { ctx.fillStyle = isH ? 'rgba(217,119,6,.06)' : 'rgba(124,58,237,.04)'; ctx.fillRect(i * colW, M_H, colW, HDR - M_H) }
    })
  } else {
    days.forEach((d, i) => {
      const dt = pd(d)
      if (dt.getDate() === 1 || i === 0) {
        const x = i * colW
        if (i > 0) {
          ctx.strokeStyle = 'rgba(37,99,235,.3)'; ctx.lineWidth = 1.5
          ctx.beginPath(); ctx.moveTo(x, M_H); ctx.lineTo(x, HDR); ctx.stroke()
        }
        ctx.font = '500 10px -apple-system,sans-serif'; ctx.fillStyle = '#6b7280'; ctx.textAlign = 'left'
        ctx.fillText(`${dt.getMonth() + 1}月`, x + 2, HDR - 5)
      }
    })
  }
}

// ── effective date / status helpers ────────────────────────────────────────
function getEffectiveDates(task, allTasks) {
  const children = allTasks.filter(c => c.parentId === task.id)
  if (children.length) {
    const starts = children.map(c => c.startDate).filter(Boolean).sort()
    const ends   = children.map(c => c.endDate).filter(Boolean).sort()
    return {
      startDate: starts.length ? starts[0] : task.startDate,
      endDate:   ends.length   ? ends[ends.length - 1] : task.endDate
    }
  }
  return { startDate: task.startDate, endDate: task.endDate }
}

function getPhaseEffectiveDates(ph, allTasks) {
  const parentTasks = allTasks.filter(t => t.phaseId === ph.id && !t.parentId)
  if (parentTasks.length) {
    const starts = parentTasks.map(t => getEffectiveDates(t, allTasks).startDate).filter(Boolean).sort()
    const ends   = parentTasks.map(t => getEffectiveDates(t, allTasks).endDate).filter(Boolean).sort()
    if (starts.length || ends.length) return {
      startDate: starts.length ? starts[0] : (ph.startDate || null),
      endDate:   ends.length   ? ends[ends.length - 1] : (ph.endDate || null)
    }
  }
  return { startDate: ph.startDate || null, endDate: ph.endDate || null }
}

function getEffectiveStatus(task, allTasks) {
  const children = allTasks.filter(c => c.parentId === task.id)
  if (!children.length) return task.status
  const allDone = children.every(c => c.status === 'done' || c.status === 'cancelled')
  const allTodo = children.every(c => c.status === 'todo')
  return allDone ? 'done' : allTodo ? 'todo' : 'inprogress'
}

export function drawBody(canvas, rows, scale, sd, allTasks = []) {
  const { days } = getDays(scale, sd)
  const colW = cw(scale)
  const W = days.length * colW
  const H = rows.reduce((s, r) => s + (r.type === 'ph' ? PHROW : ROW), 0) || ROW
  const dpr = window.devicePixelRatio || 1
  const today = td()

  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.style.width = W + 'px'
  canvas.style.height = H + 'px'
  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, W, H)

  const di = {}
  days.forEach((d, i) => di[d] = i)

  let cy = 0
  rows.forEach((row, ri) => {
    const rh = row.type === 'ph' ? PHROW : ROW
    const bg = ri % 2 === 0 ? '#ffffff' : '#f8f9fb'
    ctx.fillStyle = bg; ctx.fillRect(0, cy, W, rh)

    // weekend/holiday columns
    days.forEach((d, i) => {
      const dt = pd(d)
      const isWE = dt.getDay() === 0 || dt.getDay() === 6
      const isH = HOLS.has(d)
      if (isWE || isH) {
        ctx.fillStyle = isH ? 'rgba(217,119,6,.04)' : 'rgba(124,58,237,.03)'
        ctx.fillRect(i * colW, cy, colW, rh)
      }
    })

    // today column
    const ti = di[today]
    if (ti !== undefined) {
      ctx.fillStyle = 'rgba(220,38,38,.04)'
      ctx.fillRect(ti * colW, cy, colW, rh)
    }

    // grid lines
    ctx.strokeStyle = '#e8eaed'; ctx.lineWidth = .5
    ctx.beginPath(); ctx.moveTo(0, cy + rh); ctx.lineTo(W, cy + rh); ctx.stroke()

    if (row.type === 'ph') {
      drawPhaseBar(ctx, row.data, cy, rh, di, colW, allTasks)
    } else {
      drawTaskBar(ctx, row.data, cy, rh, di, colW, today, allTasks)
    }

    cy += rh
  })

  // today line
  const ti2 = di[today]
  if (ti2 !== undefined) {
    const tx = ti2 * colW + colW / 2
    ctx.strokeStyle = 'rgba(220,38,38,.8)'; ctx.lineWidth = 1.5
    ctx.setLineDash([4, 3])
    ctx.beginPath(); ctx.moveTo(tx, 0); ctx.lineTo(tx, H); ctx.stroke()
    ctx.setLineDash([])
    // label
    const lw = 28
    ctx.fillStyle = '#dc2626'
    rr(ctx, tx - lw / 2, 0, lw, 13, 3); ctx.fill()
    ctx.font = '700 9px -apple-system,sans-serif'
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'
    ctx.fillText('今日', tx, 10)
  }
}

function drawPhaseBar(ctx, ph, cy, rh, di, colW, allTasks) {
  const { startDate, endDate } = getPhaseEffectiveDates(ph, allTasks)
  if (!startDate && !endDate) return
  const keys = Object.keys(di)
  const si = startDate in di ? di[startDate] : (startDate < keys[0] ? 0 : keys.length)
  const ei = endDate in di ? di[endDate] : (endDate > keys[keys.length - 1] ? keys.length - 1 : -1)
  if (ei < 0 || si >= keys.length) return
  const bx = si * colW
  const bw = Math.max(colW / 2, (ei - si + 1) * colW)
  const bh = rh * 0.52
  const by = cy + (rh - bh) / 2
  // fill
  ctx.fillStyle = 'rgba(37,99,235,0.10)'
  rr(ctx, bx, by, bw, bh, 3); ctx.fill()
  // border
  ctx.strokeStyle = 'rgba(37,99,235,0.45)'; ctx.lineWidth = 1.2
  rr(ctx, bx, by, bw, bh, 3); ctx.stroke()
  // left accent bar
  ctx.fillStyle = '#2563eb'
  rr(ctx, bx, by, 4, bh, 2); ctx.fill()
  // label
  if (bw > 32) {
    ctx.save()
    ctx.beginPath(); ctx.rect(bx + 8, by, bw - 10, bh); ctx.clip()
    ctx.font = '600 10px -apple-system,sans-serif'
    ctx.fillStyle = '#1d4ed8'
    ctx.textAlign = 'left'
    ctx.fillText(ph.name, bx + 8, by + bh / 2 + 3.5)
    ctx.restore()
  }
}

function drawTaskBar(ctx, t, cy, rh, di, colW, today, allTasks) {
  const { startDate, endDate } = getEffectiveDates(t, allTasks)
  if (!startDate && !endDate) return
  const keys = Object.keys(di)
  const si = startDate in di ? di[startDate] : (startDate < keys[0] ? 0 : keys.length)
  const ei = endDate in di ? di[endDate] : (endDate > keys[keys.length - 1] ? keys.length - 1 : -1)
  if (ei < 0 || si >= keys.length) return

  const effStatus = getEffectiveStatus(t, allTasks)
  const color = SC[effStatus] || '#8a96a8'
  const bx = si * colW
  const bw = Math.max(colW / 2, (ei - si + 1) * colW)
  const bh = rh * 0.55
  const by = cy + (rh - bh) / 2

  // background
  ctx.fillStyle = color + '28'
  rr(ctx, bx, by, bw, bh, 3); ctx.fill()
  // border
  ctx.strokeStyle = color + '80'; ctx.lineWidth = 1
  rr(ctx, bx, by, bw, bh, 3); ctx.stroke()
  // left accent
  ctx.fillStyle = color
  rr(ctx, bx, by, Math.min(4, bw), bh, 2); ctx.fill()
  // done: strikethrough fill
  if (effStatus === 'done') {
    ctx.fillStyle = color + '55'
    rr(ctx, bx, by, bw, bh, 3); ctx.fill()
  }
  // label
  if (bw > 30) {
    ctx.save()
    ctx.beginPath(); ctx.rect(bx + 6, by, bw - 8, bh); ctx.clip()
    ctx.font = '500 10px -apple-system,sans-serif'
    ctx.fillStyle = effStatus === 'done' ? '#6b7280' : '#1a2030'
    ctx.textAlign = 'left'
    ctx.fillText(t.name, bx + 6, by + bh / 2 + 3.5)
    ctx.restore()
  }
  // overdue indicator
  if (endDate < today && effStatus !== 'done' && effStatus !== 'cancelled') {
    ctx.fillStyle = '#dc2626'
    rr(ctx, bx + bw - 6, by, 6, bh, 2); ctx.fill()
  }
}

export function getBarInfo(t, scale, sd) {
  const { days } = getDays(scale, sd)
  const colW = cw(scale)
  const di = {}
  days.forEach((d, i) => di[d] = i)
  const si = di[t.startDate] !== undefined ? di[t.startDate] : (t.startDate < days[0] ? 0 : days.length)
  const ei = di[t.endDate] !== undefined ? di[t.endDate] : (t.endDate > days[days.length - 1] ? days.length - 1 : -1)
  if (ei < 0 || si >= days.length) return null
  return { bx: si * colW, bw: Math.max(colW / 2, (ei - si + 1) * colW) }
}

export function getRowAtY(y, rows) {
  let cy = 0
  for (const r of rows) {
    const rh = r.type === 'ph' ? PHROW : ROW
    if (y >= cy && y < cy + rh) return r
    cy += rh
  }
  return null
}

// All-projects chart
export function drawApgChart(canvas, namesEl, pjIds, pjs, apgScale, apgSd) {
  if (!pjIds.length) return
  const n = apgScale === 'week' ? 84 : apgScale === 'month' ? 180 : 365
  const defaultStart = (() => {
    const all = []
    Object.values(pjs).forEach(p => (p.tasks || []).forEach(t => { if (t.startDate) all.push(t.startDate) }))
    const min = all.length ? all.sort()[0] : null
    return min && min < addD(td(), -30) ? addD(min, -7) : addD(td(), -30)
  })()
  const start = apgSd || defaultStart
  const days = []
  for (let i = 0; i < n; i++) days.push(addD(start, i))
  const apgCw = apgScale === 'week' ? 20 : apgScale === 'month' ? 9 : 5
  const W = days.length * apgCw
  const ROW_H = 36, HDR_H = 44
  const today = td()

  namesEl.innerHTML = pjIds.map((id, i) => {
    const p = pjs[id]
    const ts = p.tasks || []
    const done = ts.filter(t => t.status === 'done').length
    const pct = ts.length ? Math.round(done / ts.length * 100) : 0
    const ov = ts.some(t => t.endDate && t.endDate < today && t.status !== 'done' && t.status !== 'cancelled')
    const pClass = pct >= 80 ? 'var(--gn)' : pct >= 50 ? 'var(--ac)' : 'var(--or)'
    const bg = i % 2 === 0 ? 'var(--s1)' : 'var(--s2)'
    return `<div data-pj-id="${id}" style="height:${ROW_H}px;display:flex;align-items:center;padding:0 10px;gap:6px;background:${bg};border-bottom:1px solid var(--bd);cursor:pointer;transition:background .1s" onmouseenter="this.style.background='var(--ac2)'" onmouseleave="this.style.background='${bg}'">
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;font-weight:600;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
        <div style="font-size:9px;color:var(--tx3);margin-top:1px">${ts.length}タスク${ov ? ' ⚠' : ''}</div>
      </div>
      <div style="font-size:11px;font-weight:700;color:${pClass};flex-shrink:0">${pct}%</div>
    </div>`
  }).join('')

  const dpr = window.devicePixelRatio || 1
  const H = HDR_H + pjIds.length * ROW_H
  canvas.width = W * dpr; canvas.height = H * dpr
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px'
  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, W, H)

  const di = {}
  days.forEach((d, i) => di[d] = i)

  ctx.fillStyle = '#f0f2f5'; ctx.fillRect(0, 0, W, HDR_H)

  const M_H = 20
  let cm = null, ms = 0
  days.forEach((d, i) => {
    const dt = pd(d)
    const m = `${dt.getFullYear()}年${dt.getMonth() + 1}月`
    if (m !== cm) {
      if (cm) {
        ctx.strokeStyle = '#b0b8c8'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(ms * apgCw, 0); ctx.lineTo(ms * apgCw, M_H); ctx.stroke()
        ctx.font = '700 10px -apple-system,sans-serif'; ctx.fillStyle = '#374151'; ctx.textAlign = 'left'
        ctx.fillText(cm, ms * apgCw + 5, M_H - 5)
      }
      cm = m; ms = i
    }
  })
  if (cm) { ctx.font = '700 10px -apple-system,sans-serif'; ctx.fillStyle = '#374151'; ctx.textAlign = 'left'; ctx.fillText(cm, ms * apgCw + 5, M_H - 5) }

  if (apgScale === 'week') {
    days.forEach((d, i) => {
      const dt = pd(d)
      if (dt.getDay() === 1 || i === 0) {
        const x = i * apgCw
        if (i > 0) { ctx.strokeStyle = '#c8cdd8'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(x, M_H); ctx.lineTo(x, HDR_H); ctx.stroke() }
        if (apgCw >= 14) { ctx.font = '500 9px -apple-system,sans-serif'; ctx.fillStyle = '#6b7280'; ctx.textAlign = 'left'; ctx.fillText(`${dt.getMonth() + 1}/${dt.getDate()}`, x + 2, HDR_H - 5) }
      }
    })
  } else {
    days.forEach((d, i) => {
      const dt = pd(d)
      if (dt.getDate() === 1 || i === 0) {
        const x = i * apgCw
        if (i > 0) { ctx.strokeStyle = 'rgba(37,99,235,.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
        if (apgCw >= 5) { ctx.font = '500 9px -apple-system,sans-serif'; ctx.fillStyle = '#6b7280'; ctx.textAlign = 'left'; ctx.fillText(`${dt.getMonth() + 1}月`, x + 2, HDR_H - 5) }
      }
    })
  }

  ctx.strokeStyle = '#b0b8c8'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(0, HDR_H - .75); ctx.lineTo(W, HDR_H - .75); ctx.stroke()

  const COLORS = ['#2563eb','#16a34a','#d97706','#7c3aed','#dc2626','#0891b2','#be185d','#65a30d']
  pjIds.forEach((id, ri) => {
    const p = pjs[id]; const ts = p.tasks || []
    const y = HDR_H + ri * ROW_H
    const bg = ri % 2 === 0 ? '#ffffff' : '#f8f9fb'
    ctx.fillStyle = bg; ctx.fillRect(0, y, W, ROW_H)
    ctx.strokeStyle = '#dde1e8'; ctx.lineWidth = .7
    ctx.beginPath(); ctx.moveTo(0, y + ROW_H); ctx.lineTo(W, y + ROW_H); ctx.stroke()

    const ti = di[today]
    if (ti !== undefined) { ctx.fillStyle = 'rgba(220,38,38,.04)'; ctx.fillRect(ti * apgCw, y, apgCw, ROW_H) }

    const col = COLORS[ri % COLORS.length]
    const phs = p.phases || []
    const starts = ts.map(t => t.startDate).filter(Boolean).sort()
    const ends = ts.map(t => t.endDate).filter(Boolean).sort()
    if (!starts.length || !ends.length) return

    if (phs.length) {
      phs.forEach((ph, pi) => {
        const phTasks = ts.filter(t => t.phaseId === ph.id)
        const phStarts = phTasks.map(t => t.startDate).filter(Boolean).sort()
        const phEnds = phTasks.map(t => t.endDate).filter(Boolean).sort()
        if (!phStarts.length || !phEnds.length) return
        const s = phStarts[0], e = phEnds[phEnds.length - 1]
        const si = di[s] !== undefined ? di[s] : (s < days[0] ? 0 : days.length)
        const ei = di[e] !== undefined ? di[e] : (e > days[days.length - 1] ? days.length - 1 : -1)
        if (ei < 0 || si >= days.length) return
        const bx = si * apgCw, bw = Math.max(apgCw, (ei - si + 1) * apgCw)
        const bh = 14, by = y + (ROW_H - bh) / 2
        const phCol = COLORS[(ri * 3 + pi) % COLORS.length]
        ctx.fillStyle = phCol + '22'; rr(ctx, bx, by, bw, bh, 3); ctx.fill()
        ctx.strokeStyle = phCol + '88'; ctx.lineWidth = 1; rr(ctx, bx, by, bw, bh, 3); ctx.stroke()
        ctx.fillStyle = phCol; rr(ctx, bx, by, Math.min(4, bw), bh, 2); ctx.fill()
        const done = phTasks.filter(t => t.status === 'done').length
        const pct2 = phTasks.length ? done / phTasks.length : 0
        if (pct2 > 0) { ctx.fillStyle = phCol + '55'; rr(ctx, bx, by, Math.max(4, bw * pct2), bh, 3); ctx.fill() }
        if (bw > 30) {
          ctx.save(); ctx.beginPath(); ctx.rect(bx + 6, by, bw - 8, bh); ctx.clip()
          ctx.font = '500 9px -apple-system,sans-serif'; ctx.fillStyle = 'rgba(26,32,48,.85)'; ctx.textAlign = 'left'
          ctx.fillText(ph.name, bx + 6, by + bh / 2 + 3.5); ctx.restore()
        }
      })
    } else {
      const s = starts[0], e = ends[ends.length - 1]
      const si = di[s] !== undefined ? di[s] : (s < days[0] ? 0 : days.length)
      const ei = di[e] !== undefined ? di[e] : (e > days[days.length - 1] ? days.length - 1 : -1)
      if (ei < 0 || si >= days.length) return
      const bx = si * apgCw, bw = Math.max(apgCw, (ei - si + 1) * apgCw)
      const bh = 16, by = y + (ROW_H - bh) / 2
      const colBg = col + '28'
      ctx.fillStyle = colBg; rr(ctx, bx, by, bw, bh, 3); ctx.fill()
      ctx.strokeStyle = col + '88'; ctx.lineWidth = 1; rr(ctx, bx, by, bw, bh, 3); ctx.stroke()
      ctx.fillStyle = col; rr(ctx, bx, by, 4, bh, 2); ctx.fill()
      const done = ts.filter(t => t.status === 'done').length
      const pct2 = ts.length ? done / ts.length : 0
      if (pct2 > 0) { ctx.fillStyle = col + '55'; rr(ctx, bx, by, Math.max(4, bw * pct2), bh, 3); ctx.fill() }
    }
  })

  const ti2 = di[today]
  if (ti2 !== undefined) {
    const tx2 = ti2 * apgCw + apgCw / 2
    ctx.strokeStyle = 'rgba(220,38,38,.75)'; ctx.lineWidth = 1.5
    ctx.setLineDash([4, 3])
    ctx.beginPath(); ctx.moveTo(tx2, HDR_H); ctx.lineTo(tx2, H); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(220,38,38,.9)'
    const tw = 24; rr(ctx, tx2 - tw / 2, HDR_H - 14, tw, 13, 3); ctx.fill()
    ctx.font = '700 9px -apple-system,sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'
    ctx.fillText('今日', tx2, HDR_H - 4)
  }
}
