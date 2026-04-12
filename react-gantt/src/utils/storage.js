export function saveState(state, adminMode) {
  try {
    if (adminMode) {
      localStorage.setItem('gp6a', JSON.stringify(state.adminPjs))
      localStorage.setItem('gp6ac', state.adminCur || '')
      localStorage.setItem('gp6am', JSON.stringify(state.adminMembers || []))
      const starred = {}
      Object.values(state.adminPjs).forEach(p =>
        (p.tasks || []).forEach(t => { if (t.starred) starred[t.id] = true })
      )
      localStorage.setItem('gp6as', JSON.stringify(starred))
    } else {
      localStorage.setItem('gp6', JSON.stringify(state.pjs))
      localStorage.setItem('gp6c', state.cur || '')
      localStorage.setItem('gp6m', JSON.stringify(state.members || []))
      const starred = {}
      Object.values(state.pjs).forEach(p =>
        (p.tasks || []).forEach(t => { if (t.starred) starred[t.id] = true })
      )
      localStorage.setItem('gp6s', JSON.stringify(starred))
    }
  } catch (e) {}
}

export function loadState() {
  let pjs = {}, cur = null, members = []
  let adminPjs = {}, adminCur = null, adminMembers = []
  try {
    const d = localStorage.getItem('gp6')
    if (d) pjs = JSON.parse(d)
    cur = localStorage.getItem('gp6c') || null
    if (cur && !pjs[cur]) cur = null
    const m = localStorage.getItem('gp6m')
    if (m) members = JSON.parse(m)
    // migrate per-project members to global list
    Object.values(pjs).forEach(p => {
      if (p.members && p.members.length) {
        p.members.forEach(n => { if (!members.includes(n)) members.push(n) })
        p.members = []
      }
    })
  } catch (e) { pjs = {} }
  try {
    const da = localStorage.getItem('gp6a')
    if (da) adminPjs = JSON.parse(da)
    adminCur = localStorage.getItem('gp6ac') || null
    if (adminCur && !adminPjs[adminCur]) adminCur = null
    const ma = localStorage.getItem('gp6am')
    if (ma) adminMembers = JSON.parse(ma)
  } catch (e) { adminPjs = {} }
  return { pjs, cur, members, adminPjs, adminCur, adminMembers }
}

export function applyStarred(pjs, adminMode) {
  try {
    const key = adminMode ? 'gp6as' : 'gp6s'
    const d = localStorage.getItem(key)
    if (!d) return pjs
    const starred = JSON.parse(d)
    const result = JSON.parse(JSON.stringify(pjs))
    Object.values(result).forEach(p =>
      (p.tasks || []).forEach(t => { t.starred = !!starred[t.id] })
    )
    return result
  } catch (e) { return pjs }
}

export function saveExp(cur, exp) {
  try {
    const key = 'gp6_exp_' + (cur || '')
    localStorage.setItem(key, JSON.stringify([...exp]))
  } catch (e) {}
}

export function loadExp(cur) {
  try {
    const key = 'gp6_exp_' + (cur || '')
    const d = localStorage.getItem(key)
    if (d) return new Set(JSON.parse(d))
  } catch (e) {}
  return null
}

export function isAuthed() {
  const exp = localStorage.getItem('gantt_auth_exp')
  if (!exp) return false
  return Date.now() < Number(exp)
}

export function setAuthed(days = 3) {
  localStorage.setItem('gantt_auth_exp', String(Date.now() + days * 24 * 60 * 60 * 1000))
}

export function isAdminAuthed() {
  const exp = localStorage.getItem('gantt_admin_exp')
  if (!exp) return false
  return Date.now() < Number(exp)
}

export function setAdminAuthed(days = 7) {
  localStorage.setItem('gantt_admin_exp', String(Date.now() + days * 86400000))
}
