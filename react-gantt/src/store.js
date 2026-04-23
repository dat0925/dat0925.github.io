import { create } from 'zustand'
import { td, addD, diffD } from './utils/dates.js'
import { saveState, loadState, applyStarred, saveExp, loadExp, isAdminAuthed } from './utils/storage.js'
import {
  initClient, sbLoad, sbSavePJ, sbDeletePJ, sbSavePH, sbDeletePH,
  sbSaveTask, sbDeleteTask, sbMigrateFromLegacy, sbSubscribe
} from './utils/supabase.js'
import { UNDO_MAX } from './utils/constants.js'

// ── pending save guard ─────────────────────────────────────────────────────
// 保存を直列キューで処理することで、フェーズ → タスクの順序を保証し
// FK制約違反によるサイレント消失を防ぐ。
// (並列実行だと「フェーズ未保存のうちにタスクが先にDBへ届く」→ FK違反 → 無視 → reload で消える)
let _saveQueue = Promise.resolve()
let _pendingSave = 0
function sbPending(fn) {
  _pendingSave++
  _saveQueue = _saveQueue
    .then(() => fn())
    .catch(() => {}) // エラーを握りつぶしてキューを継続
    .finally(() => { _pendingSave-- })
}

// ── demo data ──────────────────────────────────────────────────────────────
function createDemoData() {
  return {
    pj_epress: {
      name: 'EPRESSプロジェクト',
      phases: [
        { id: 'ph_1', name: 'フォーム & プロンプト作成', startDate: '', endDate: '' },
        { id: 'ph_2', name: 'AI生成 → アップロード', startDate: '', endDate: '' },
        { id: 'ph_3', name: '管理画面・オプション設定実装', startDate: '', endDate: '' },
        { id: 'ph_4', name: 'プレリリース準備', startDate: '', endDate: '' },
        { id: 'ph_5', name: '開発（関連部署連携）', startDate: '', endDate: '' },
        { id: 'ph_6', name: '企画承認 （3/1～4/15）', startDate: '', endDate: '' },
        { id: 'ph_7', name: '販売準備 （3/25～5/25）', startDate: '', endDate: '' },
      ],
      tasks: [
        { id: 't_1', phaseId: 'ph_1', parentId: null, name: 'ヒアリングフォーム設計・実装（26項目）', startDate: '2026-03-02', endDate: '2026-03-06', completedDate: null, status: 'todo', assignee: '', effort: 1, memo: '', updatedAt: '2026-04-03' },
        { id: 't_2', phaseId: 'ph_1', parentId: null, name: 'Claude（クロード）プログラム自動生成検証', startDate: '2026-03-03', endDate: '2026-03-20', completedDate: null, status: 'todo', assignee: '', effort: 1, memo: '', updatedAt: '2026-04-03' },
        { id: 't_3', phaseId: 'ph_1', parentId: null, name: '画像動画生成検証', startDate: '2026-03-09', endDate: '2026-03-20', completedDate: null, status: 'todo', assignee: '', effort: 1, memo: '', updatedAt: '2026-04-03' },
        { id: 't_6', phaseId: 'ph_2', parentId: null, name: 'ClaudeCode AWS実装', startDate: '2026-04-01', endDate: '2026-04-06', completedDate: null, status: 'todo', assignee: '', effort: 1, memo: '', updatedAt: '2026-04-03' },
        { id: 't_7', phaseId: 'ph_2', parentId: null, name: 'OpenClaw AWS実装', startDate: '2026-04-01', endDate: '2026-04-06', completedDate: null, status: 'todo', assignee: '', effort: 1, memo: '', updatedAt: '2026-04-03' },
        { id: 't_11', phaseId: 'ph_3', parentId: null, name: '管理画面構築', startDate: '2026-04-08', endDate: '2026-04-15', completedDate: null, status: 'todo', assignee: '', effort: 1, memo: '', updatedAt: '2026-04-03' },
        { id: 't_15', phaseId: 'ph_4', parentId: null, name: '本番環境最終アップロード・負荷テスト', startDate: '2026-05-01', endDate: '2026-05-10', completedDate: null, status: 'todo', assignee: '', effort: 1, memo: '', updatedAt: '2026-04-03' },
        { id: 't_23', phaseId: 'ph_6', parentId: null, name: 'SLA確定', startDate: '2026-03-01', endDate: '2026-03-24', completedDate: null, status: 'todo', assignee: '', effort: 1, memo: '', updatedAt: '2026-04-03' },
        { id: 't_27', phaseId: 'ph_7', parentId: null, name: '契約書作成', startDate: '2026-03-25', endDate: '2026-04-10', completedDate: null, status: 'todo', assignee: '', effort: 1, memo: '', updatedAt: '2026-04-03' },
      ]
    }
  }
}

// ── row computation ────────────────────────────────────────────────────────
function getEffForFilter(t, tasks) {
  const children = tasks.filter(c => c.parentId === t.id)
  if (!children.length) return { sd: t.startDate, ed: t.endDate, status: t.status }
  const starts = children.map(c => c.startDate).filter(Boolean).sort()
  const ends = children.map(c => c.endDate).filter(Boolean).sort()
  const allDone = children.every(c => c.status === 'done' || c.status === 'cancelled')
  const allTodo = children.every(c => c.status === 'todo')
  return {
    sd: starts.length ? starts[0] : t.startDate,
    ed: ends.length ? ends[ends.length - 1] : t.endDate,
    status: allDone ? 'done' : allTodo ? 'todo' : 'inprogress'
  }
}

export function computeRows(tasks, phases, exp, filters, favFilter) {
  const { q = '', fs = '', fa = '' } = filters
  const today = td()

  const filtered = tasks.filter(t => {
    if (q && !t.name.toLowerCase().includes(q.toLowerCase())) return false
    if (fa && t.assignee !== fa) return false
    if (favFilter && !t.starred) return false
    if (fs === '__active__') {
      const eff = getEffForFilter(t, tasks)
      if (eff.status === 'done' || eff.status === 'cancelled') return false
    } else if (fs === '__needs_adjust__') {
      const eff = getEffForFilter(t, tasks)
      const overdue = eff.ed && eff.ed < today && eff.status !== 'done' && eff.status !== 'cancelled'
      const delayed = eff.sd && eff.sd < today && eff.status === 'todo'
      if (!overdue && !delayed) return false
    } else if (fs && fs !== '__active__' && fs !== '__needs_adjust__') {
      const eff = getEffForFilter(t, tasks)
      if (eff.status !== fs) return false
    }
    return true
  })

  const forceExpand = favFilter || fs === '__needs_adjust__' || fs === '__active__'
  const rows = []

  phases.forEach(ph => {
    const hasFiltered = forceExpand && filtered.some(t => t.phaseId === ph.id)
    const expanded = exp.has(ph.id) || hasFiltered
    rows.push({ type: 'ph', data: ph })
    if (expanded) {
      filtered.filter(t => t.phaseId === ph.id && !t.parentId).forEach(t => {
        rows.push({ type: 't', data: t, ch: false })
        if (exp.has('c_' + t.id) || forceExpand)
          filtered.filter(c => c.parentId === t.id).forEach(c => rows.push({ type: 't', data: c, ch: true }))
      })
    }
  })
  filtered.filter(t => !t.phaseId && !t.parentId).forEach(t => {
    rows.push({ type: 't', data: t, ch: false })
    if (exp.has('c_' + t.id) || forceExpand)
      filtered.filter(c => c.parentId === t.id).forEach(c => rows.push({ type: 't', data: c, ch: true }))
  })
  return { rows, filtered }
}

// ── store ──────────────────────────────────────────────────────────────────
export const useStore = create((set, get) => ({
  // state
  pjs: {},
  cur: null,
  members: [],
  adminPjs: {},
  adminCur: null,
  adminMembers: [],
  adminMode: false,
  view: 'gantt',
  scale: 'day',
  sd: addD(td(), -7),
  sel: new Set(),
  exp: new Set(),
  favFilter: false,
  filters: { q: '', fs: '', fa: '' },
  modal: null,          // { type, data }
  deleteTarget: null,   // { type, id, label }
  undoStack: [],
  redoStack: [],
  sbStatus: '',         // 'ok' | 'busy' | 'err' | ''
  inlineAdd: null,      // { parentId, afterIdx }
  apgScale: 'month',
  apgSd: null,
  _sbChannel: null,
  _reloadTimer: null,

  // ── helpers ──────────────────────────────────────────────────────────────
  _pjs() { const s = get(); return s.adminMode ? s.adminPjs : s.pjs },
  _cur() { const s = get(); return s.adminMode ? s.adminCur : s.cur },
  _members() { const s = get(); return s.adminMode ? s.adminMembers : s.members },
  pj() { const s = get(); const pjs = s._pjs(); const cur = s._cur(); return cur ? pjs[cur] : null },
  tasks() { return get().pj()?.tasks || [] },
  phases() { return get().pj()?.phases || [] },

  _setPjs(pjs) {
    const s = get()
    if (s.adminMode) set({ adminPjs: pjs })
    else set({ pjs })
  },
  _setCur(cur) {
    const s = get()
    if (s.adminMode) set({ adminCur: cur })
    else set({ cur })
  },
  _setMembers(members) {
    const s = get()
    if (s.adminMode) set({ adminMembers: members })
    else set({ members })
  },

  // ── persistence ──────────────────────────────────────────────────────────
  save() {
    const s = get()
    saveState({
      pjs: s.pjs, cur: s.cur, members: s.members,
      adminPjs: s.adminPjs, adminCur: s.adminCur, adminMembers: s.adminMembers
    }, s.adminMode)
  },
  saveExp() {
    const s = get()
    saveExp(s._cur(), s.exp)
  },

  // ── undo/redo ─────────────────────────────────────────────────────────────
  pushUndo() {
    const s = get()
    const pjs = s._pjs()
    const members = s._members()
    const snap = { pjs: JSON.parse(JSON.stringify(pjs)), members: JSON.parse(JSON.stringify(members)) }
    const stack = [...s.undoStack, snap].slice(-UNDO_MAX)
    set({ undoStack: stack, redoStack: [] })
  },
  undo() {
    const s = get()
    if (!s.undoStack.length) return
    const pjs = s._pjs(); const members = s._members()
    const redoSnap = { pjs: JSON.parse(JSON.stringify(pjs)), members: JSON.parse(JSON.stringify(members)) }
    const stack = [...s.undoStack]
    const snap = stack.pop()
    s._setPjs(snap.pjs); s._setMembers(snap.members)
    const newCur = s._cur()
    if (newCur && !snap.pjs[newCur]) s._setCur(null)
    set({ undoStack: stack, redoStack: [...s.redoStack, redoSnap] })
    s.save()
  },
  redo() {
    const s = get()
    if (!s.redoStack.length) return
    const pjs = s._pjs(); const members = s._members()
    const undoSnap = { pjs: JSON.parse(JSON.stringify(pjs)), members: JSON.parse(JSON.stringify(members)) }
    const stack = [...s.redoStack]
    const snap = stack.pop()
    s._setPjs(snap.pjs); s._setMembers(snap.members)
    set({ undoStack: [...s.undoStack, undoSnap], redoStack: stack })
    s.save()
  },

  // ── init ─────────────────────────────────────────────────────────────────
  async init() {
    const loaded = loadState()
    set({
      pjs: loaded.pjs, cur: loaded.cur, members: loaded.members,
      adminPjs: loaded.adminPjs, adminCur: loaded.adminCur, adminMembers: loaded.adminMembers
    })

    // restore admin session
    if (sessionStorage.getItem('gantt_admin_active') === '1' && isAdminAuthed()) {
      set({ adminMode: true })
    }
    // get state AFTER admin mode is restored so s.adminMode is correct
    const s = get()

    // supabase
    if (initClient()) {
      await sbMigrateFromLegacy(false)
      const localSnap = JSON.parse(JSON.stringify(s._pjs()))
      const remotePjs = await sbLoad(s.adminMode)
      if (remotePjs) {
        // merge: recover phases/tasks missing from remote
        const merged = { ...remotePjs }
        for (const [pid, lp] of Object.entries(localSnap)) {
          if (!merged[pid]) continue
          const sbPhIds = new Set((merged[pid].phases || []).map(p => p.id))
          for (const ph of (lp.phases || []))
            if (!sbPhIds.has(ph.id)) { merged[pid].phases.push(ph); sbSavePH(ph, pid, merged, s.adminMode) }
          const sbTaskMap = new Map((merged[pid].tasks || []).map(t => [t.id, t]))
          for (const lt of (lp.tasks || [])) {
            if (!lt.phaseId) continue
            const st = sbTaskMap.get(lt.id)
            if (st && !st.phaseId) { st.phaseId = lt.phaseId; sbSaveTask(st, pid, merged, s.adminMode) }
          }
        }
        const withStars = applyStarred(merged, s.adminMode)
        s._setPjs(withStars)
      } else {
        const cur2 = s._cur()
        if (!cur2 || !s._pjs()[cur2]) {
          if (!Object.keys(s._pjs()).length) {
            const demo = createDemoData()
            s._setPjs(demo)
            s._setCur('pj_epress')
          }
        }
      }
      set({ sbStatus: remotePjs ? 'ok' : 'err' })
      get()._subscribe()
    } else {
      if (!Object.keys(s._pjs()).length) {
        const demo = createDemoData()
        s._setPjs(demo)
        s._setCur('pj_epress')
      }
    }

    // restore expanded phases
    const cur = get()._cur()
    if (cur) {
      const saved = loadExp(cur)
      if (saved) set({ exp: saved })
      else set({ exp: new Set(get().phases().map(p => p.id)) })
    }

    set({ sd: addD(td(), -7) })
    get().save()
  },

  _subscribe() {
    const s = get()
    const ch = sbSubscribe(s.adminMode, () => get()._scheduleReload())
    set({ _sbChannel: ch })
  },

  _scheduleReload() {
    const s = get()
    clearTimeout(s._reloadTimer)
    const t = setTimeout(async () => {
      if (_pendingSave > 0) { get()._scheduleReload(); return } // 保存中なら再スケジュール
      const s2 = get()
      const remotePjs = await sbLoad(s2.adminMode)
      if (remotePjs) {
        const withStars = applyStarred(remotePjs, s2.adminMode)
        s2._setPjs(withStars)
        s2.save()
        set({ sbStatus: 'ok' })
      }
    }, 600)
    set({ _reloadTimer: t })
  },

  // ── project ops ───────────────────────────────────────────────────────────
  addPJ(name) {
    const s = get()
    const id = 'pj_' + Date.now()
    const pjs = { ...s._pjs(), [id]: { name, tasks: [], phases: [], members: [] } }
    s._setPjs(pjs)
    s._setCur(id)
    set({ sel: new Set(), exp: new Set() })
    s.save()
    sbPending(() => sbSavePJ(id, pjs, s.adminMode))
  },
  renamePJ(name) {
    const s = get()
    const cur = s._cur(); if (!cur) return
    const pjs = { ...s._pjs() }
    pjs[cur] = { ...pjs[cur], name }
    s._setPjs(pjs)
    s.save()
    sbPending(() => sbSavePJ(cur, pjs, s.adminMode))
  },
  deletePJ(id) {
    const s = get()
    const pjs = { ...s._pjs() }
    delete pjs[id]
    s._setPjs(pjs)
    if (s._cur() === id) s._setCur(null)
    set({ sel: new Set(), exp: new Set() })
    s.save()
    sbPending(() => sbDeletePJ(id, s.adminMode))
  },
  switchPJ(id) {
    const s = get()
    s._setCur(id || null)
    set({ sel: new Set(), exp: new Set() })
    if (id) {
      const saved = loadExp(id)
      if (saved) set({ exp: saved })
      else set({ exp: new Set(get().phases().map(p => p.id)) })
    }
    s.save()
  },

  // ── phase ops ─────────────────────────────────────────────────────────────
  addPhase(ph) {
    const s = get()
    const cur = s._cur(); if (!cur) return
    const pjs = JSON.parse(JSON.stringify(s._pjs()))
    pjs[cur].phases.push(ph)
    set({ exp: new Set([...get().exp, ph.id]) })
    s._setPjs(pjs)
    s.save()
    sbPending(() => sbSavePH(ph, cur, pjs, s.adminMode))
  },
  updatePhase(idOrPh, data) {
    const s = get()
    const cur = s._cur(); if (!cur) return
    const pjs = JSON.parse(JSON.stringify(s._pjs()))
    // Support both updatePhase(ph) and updatePhase(id, data)
    const ph = data ? { id: idOrPh, ...data } : idOrPh
    const i = pjs[cur].phases.findIndex(x => x.id === ph.id)
    if (i >= 0) pjs[cur].phases[i] = { ...pjs[cur].phases[i], ...ph }
    s._setPjs(pjs)
    s.save()
    sbPending(() => sbSavePH(pjs[cur].phases[i >= 0 ? i : 0], cur, pjs, s.adminMode))
  },
  deletePhase(id) {
    const s = get()
    const cur = s._cur(); if (!cur) return
    const pjs = JSON.parse(JSON.stringify(s._pjs()))
    const phTasks = pjs[cur].tasks.filter(t => t.phaseId === id).map(t => t.id)
    pjs[cur].tasks = pjs[cur].tasks.filter(t => t.phaseId !== id)
    pjs[cur].phases = pjs[cur].phases.filter(p => p.id !== id)
    const newExp = new Set(get().exp); newExp.delete(id)
    set({ exp: newExp })
    s._setPjs(pjs)
    s.save()
    phTasks.forEach(tid => sbPending(() => sbDeleteTask(tid, s.adminMode)))
    sbPending(() => sbDeletePH(id, s.adminMode))
  },
  reorderPhases(phases) {
    const s = get()
    const cur = s._cur(); if (!cur) return
    const pjs = JSON.parse(JSON.stringify(s._pjs()))
    pjs[cur].phases = phases
    s._setPjs(pjs)
    s.save()
    phases.forEach(ph => sbPending(() => sbSavePH(ph, cur, pjs, s.adminMode)))
  },

  // ── task ops ──────────────────────────────────────────────────────────────
  addTask(t) {
    const s = get()
    const cur = s._cur(); if (!cur) return
    const pjs = JSON.parse(JSON.stringify(s._pjs()))
    pjs[cur].tasks.push(t)
    if (t.parentId) set({ exp: new Set([...get().exp, 'c_' + t.parentId]) })
    s._setPjs(pjs)
    s.save()
    sbPending(() => sbSaveTask(t, cur, pjs, s.adminMode))
  },
  updateTask(idOrT, data) {
    const s = get()
    const cur = s._cur(); if (!cur) return
    const pjs = JSON.parse(JSON.stringify(s._pjs()))
    // Support both updateTask(t) and updateTask(id, data)
    const id = data ? idOrT : idOrT.id
    const patch = data ? data : idOrT
    const i = pjs[cur].tasks.findIndex(x => x.id === id)
    if (i >= 0) {
      pjs[cur].tasks[i] = { ...pjs[cur].tasks[i], ...patch, id, updatedAt: td() }
      const t = pjs[cur].tasks[i]
      // sync child phases
      pjs[cur].tasks.filter(c => c.parentId === id).forEach(c => { c.phaseId = t.phaseId; sbPending(() => sbSaveTask(c, cur, pjs, s.adminMode)) })
      s._setPjs(pjs)
      s.save()
      sbPending(() => sbSaveTask(t, cur, pjs, s.adminMode))
    }
  },
  deleteTask(id) {
    const s = get()
    const cur = s._cur(); if (!cur) return
    const pjs = JSON.parse(JSON.stringify(s._pjs()))
    const toDelete = new Set([id])
    pjs[cur].tasks.filter(t => t.parentId === id).forEach(c => toDelete.add(c.id))
    pjs[cur].tasks = pjs[cur].tasks.filter(t => !toDelete.has(t.id))
    const newSel = new Set(get().sel); toDelete.forEach(i => newSel.delete(i))
    set({ sel: newSel })
    s._setPjs(pjs)
    s.save()
    ;[...toDelete].forEach(tid => sbPending(() => sbDeleteTask(tid, s.adminMode)))
  },
  deleteBulk(ids) {
    const s = get()
    const cur = s._cur(); if (!cur) return
    const pjs = JSON.parse(JSON.stringify(s._pjs()))
    const toDelete = new Set()
    ids.forEach(id => {
      toDelete.add(id)
      pjs[cur].tasks.filter(t => t.parentId === id).forEach(c => toDelete.add(c.id))
    })
    pjs[cur].tasks = pjs[cur].tasks.filter(t => !toDelete.has(t.id))
    set({ sel: new Set() })
    s._setPjs(pjs)
    s.save()
    ;[...toDelete].forEach(tid => sbPending(() => sbDeleteTask(tid, s.adminMode)))
  },
  updateTaskDates(id, startDate, endDate) {
    const s = get()
    const cur = s._cur(); if (!cur) return
    const pjs = JSON.parse(JSON.stringify(s._pjs()))
    const t = pjs[cur].tasks.find(x => x.id === id); if (!t) return
    t.startDate = startDate; t.endDate = endDate; t.updatedAt = td()
    s._setPjs(pjs)
    s.save()
    sbPending(() => sbSaveTask(t, cur, pjs, s.adminMode))
  },
  dupTask(id) {
    const s = get()
    const cur = s._cur(); if (!cur) return
    const pjs = JSON.parse(JSON.stringify(s._pjs()))
    const t = pjs[cur].tasks.find(x => x.id === id); if (!t) return
    const nt = { ...t, id: 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5), name: t.name + ' (複製)', completedDate: null, status: t.status === 'done' ? 'todo' : t.status, updatedAt: td() }
    const idx = pjs[cur].tasks.findIndex(x => x.id === id)
    pjs[cur].tasks.splice(idx + 1, 0, nt)
    s._setPjs(pjs)
    s.save()
    sbPending(() => sbSaveTask(nt, cur, pjs, s.adminMode))
  },
  taskMoveUpDown(id, dir) {
    const s = get()
    const cur = s._cur(); if (!cur) return
    const pjs = JSON.parse(JSON.stringify(s._pjs()))
    const tasks = pjs[cur].tasks
    const { rows } = computeRows(tasks, pjs[cur].phases, get().exp, get().filters, get().favFilter)
    const rowIdx = rows.findIndex(r => r.type === 't' && r.data.id === id)
    if (rowIdx < 0) return
    // Find adjacent visible task row in same parent context
    let targetIdx = -1
    for (let i = rowIdx + dir; i >= 0 && i < rows.length; i += dir) {
      if (rows[i].type === 't') { targetIdx = i; break }
      if (rows[i].type === 'ph') break
    }
    if (targetIdx < 0) return
    const srcTask = rows[rowIdx].data
    const tgtTask = rows[targetIdx].data
    const si = tasks.findIndex(t => t.id === srcTask.id)
    const ti = tasks.findIndex(t => t.id === tgtTask.id)
    if (si < 0 || ti < 0) return
    s.pushUndo()
    const [removed] = tasks.splice(si, 1)
    const newTi = tasks.findIndex(t => t.id === tgtTask.id)
    tasks.splice(dir > 0 ? newTi + 1 : newTi, 0, removed)
    s._setPjs(pjs)
    s.save()
    tasks.forEach(t => sbPending(() => sbSaveTask(t, cur, pjs, s.adminMode)))
  },
  reorderTasks(tasks) {
    const s = get()
    const cur = s._cur(); if (!cur) return
    const pjs = JSON.parse(JSON.stringify(s._pjs()))
    pjs[cur].tasks = tasks
    s._setPjs(pjs)
    s.save()
    tasks.forEach(t => sbPending(() => sbSaveTask(t, cur, pjs, s.adminMode)))
  },
  applyBulkEdit(idsOrChanges, changesArg) {
    const s = get()
    const cur = s._cur(); if (!cur) return
    const pjs = JSON.parse(JSON.stringify(s._pjs()))
    // Support both applyBulkEdit(ids, changes) and applyBulkEdit(changes) using store.sel
    const ids = Array.isArray(idsOrChanges) ? new Set(idsOrChanges) : get().sel
    const { status, startDate, endDate, assignee, phaseId, parentId } = changesArg || idsOrChanges
    pjs[cur].tasks.forEach(t => {
      if (!ids.has(t.id)) return
      if (status) { t.status = status; if (status === 'done' && !t.completedDate) t.completedDate = td(); if (status !== 'done') t.completedDate = null }
      if (startDate) t.startDate = startDate
      if (endDate) t.endDate = endDate
      if (assignee !== undefined && assignee !== '') t.assignee = assignee === ' ' ? '' : assignee
      if (phaseId === '__clear__') t.phaseId = null
      else if (phaseId) t.phaseId = phaseId
      if (parentId === '__clear__') t.parentId = null
      else if (parentId) { t.parentId = parentId; if (!phaseId) { const par = pjs[cur].tasks.find(x => x.id === parentId); if (par) t.phaseId = par.phaseId } }
      t.updatedAt = td()
    })
    s._setPjs(pjs)
    s.save()
    pjs[cur].tasks.filter(t => ids.has(t.id)).forEach(t => sbPending(() => sbSaveTask(t, cur, pjs, s.adminMode)))
  },
  toggleStar(id) {
    const s = get()
    const cur = s._cur(); if (!cur) return
    const pjs = JSON.parse(JSON.stringify(s._pjs()))
    const t = pjs[cur].tasks.find(x => x.id === id); if (!t) return
    t.starred = !t.starred
    s._setPjs(pjs)
    s.save()
    sbPending(() => sbSaveTask(t, cur, pjs, s.adminMode))
  },
  taskIndent(id, dedent) {
    const s = get()
    const cur = s._cur(); if (!cur) return
    const pjs = JSON.parse(JSON.stringify(s._pjs()))
    const t = pjs[cur].tasks.find(x => x.id === id); if (!t) return
    s.pushUndo()
    if (dedent) {
      if (!t.parentId) return
      t.parentId = null
    } else {
      const { rows } = computeRows(pjs[cur].tasks, pjs[cur].phases, get().exp, get().filters, get().favFilter)
      const idx = rows.findIndex(r => r.type === 't' && r.data.id === id)
      if (idx <= 0) return
      const prev = rows[idx - 1]
      if (prev.type !== 't') return
      if (!prev.data.parentId) {
        if (t.parentId === prev.data.id) return
        t.parentId = prev.data.id; t.phaseId = prev.data.phaseId
        set({ exp: new Set([...get().exp, 'c_' + prev.data.id]) })
      } else {
        if (t.parentId === prev.data.parentId) return
        t.parentId = prev.data.parentId; t.phaseId = prev.data.phaseId
        set({ exp: new Set([...get().exp, 'c_' + prev.data.parentId]) })
      }
    }
    s._setPjs(pjs)
    s.save()
    sbPending(() => sbSaveTask(t, cur, pjs, s.adminMode))
  },

  // ── selection ─────────────────────────────────────────────────────────────
  toggleSel(id, v) {
    const sel = new Set(get().sel)
    v ? sel.add(id) : sel.delete(id)
    set({ sel })
  },
  clearSel() { set({ sel: new Set() }) },
  selectAll(ids) { set({ sel: new Set(ids) }) },

  // ── expand/collapse ───────────────────────────────────────────────────────
  togglePh(id) {
    const exp = new Set(get().exp)
    if (exp.has(id)) exp.delete(id); else exp.add(id)
    set({ exp })
    get().saveExp()
  },
  toggleChild(id) {
    const exp = new Set(get().exp)
    const key = 'c_' + id
    if (exp.has(key)) exp.delete(key); else exp.add(key)
    set({ exp })
    get().saveExp()
  },
  expandAllPh() {
    const exp = new Set(get().exp)
    get().phases().forEach(p => exp.add(p.id))
    const tasks = get().tasks()
    const parentIds = new Set(tasks.filter(t => t.parentId).map(t => t.parentId))
    parentIds.forEach(id => exp.add('c_' + id))
    set({ exp }); get().saveExp()
  },
  collapseAllPh() {
    const exp = new Set(get().exp)
    get().tasks().forEach(t => exp.delete('c_' + t.id))
    get().phases().forEach(p => exp.delete(p.id))
    set({ exp }); get().saveExp()
  },

  // ── view/scale ────────────────────────────────────────────────────────────
  setView(v) { set({ view: v }) },
  setScale(s) { set({ scale: s }) },
  setSd(sd) { set({ sd }) },
  navChart(d) {
    const s = get()
    const n = s.scale === 'day' ? 30 : s.scale === 'week' ? 60 : 90
    const next = addD(s.sd || addD(td(), -7), d * n)
    set({ sd: next })
  },
  goToday() { set({ sd: addD(td(), -7) }) },
  cycleView() {
    const views = ['gantt', 'summary', 'allprojects']
    const cur = get().view
    const idx = views.indexOf(cur)
    set({ view: views[(idx + 1) % views.length] })
  },
  setFilters(filters) { set({ filters: { ...get().filters, ...filters } }) },
  toggleFavFilter() { set({ favFilter: !get().favFilter }) },
  clearFilters() { set({ filters: { q: '', fs: '', fa: '' }, favFilter: false }) },

  // ── admin ─────────────────────────────────────────────────────────────────
  async enterAdmin() {
    set({ adminMode: true })
    sessionStorage.setItem('gantt_admin_session', '1')  // 認証済みフラグ（セッション中パスワード不要）
    sessionStorage.setItem('gantt_admin_active', '1')   // アクティブフラグ（リロード時復元用）
    const remotePjs = await sbLoad(true)
    if (remotePjs) {
      const withStars = applyStarred(remotePjs, true)
      set({ adminPjs: withStars })
    }
    if (get().adminCur) {
      const saved = loadExp(get().adminCur)
      if (saved) set({ exp: saved })
      else set({ exp: new Set(get().phases().map(p => p.id)) })
    }
    set({ view: 'gantt', sel: new Set() })
    get()._subscribe()
    get().save()
  },
  exitAdmin() {
    set({ adminMode: false })
    sessionStorage.removeItem('gantt_admin_active')  // アクティブフラグのみ削除（認証済みフラグは残す）
    const s = get()
    const localCur = localStorage.getItem('gp6c') || null
    set({ cur: localCur && s.pjs[localCur] ? localCur : null, view: 'gantt', sel: new Set() })
    get()._subscribe()
  },

  // ── modal ──────────────────────────────────────────────────────────────────
  openModal(type, data = null) { set({ modal: { type, data } }) },
  closeModal() { set({ modal: null }) },

  // ── member management ──────────────────────────────────────────────────────
  getMemberCandidates() {
    const s = get()
    const globalMembers = s._members()
    const fromTasks = [...new Set(s.tasks().map(t => t.assignee).filter(Boolean))]
    return [...new Set([...globalMembers, ...fromTasks])]
  },
  updateMembers(members) {
    const s = get()
    s._setMembers(members)
    s.save()
    const cur = s._cur()
    if (cur) sbPending(() => sbSavePJ(cur, s._pjs(), s.adminMode))
  },
  addMember(name) {
    const s = get()
    const members = [...s._members()]
    if (!members.includes(name)) { members.push(name); s.updateMembers(members) }
  },
  deleteMember(name) {
    const s = get()
    const members = s._members().filter(m => m !== name)
    s.updateMembers(members)
  },

  // ── supabase status ───────────────────────────────────────────────────────
  setSbStatus(status) { set({ sbStatus: status }) },
  async forceReload() {
    const s = get()
    set({ sbStatus: 'busy' })
    const remotePjs = await sbLoad(s.adminMode)
    if (remotePjs) {
      const withStars = applyStarred(remotePjs, s.adminMode)
      s._setPjs(withStars)
      s.save()
      set({ sbStatus: 'ok' })
    } else {
      set({ sbStatus: 'err' })
    }
  },

  // ── apg ───────────────────────────────────────────────────────────────────
  setApgScale(s) { set({ apgScale: s }) },
  setApgSd(sd) { set({ apgSd: sd }) },
}))
