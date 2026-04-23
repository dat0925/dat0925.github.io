import { createClient } from '@supabase/supabase-js'
import { _SB_URL, _SB_KEY } from './constants.js'

let _client = null

export function getClient() { return _client }

export function initClient() {
  try {
    _client = createClient(_SB_URL, _SB_KEY, { realtime: { params: { eventsPerSecond: 10 } } })
    return true
  } catch (e) { _client = null; return false }
}

export function tbl(name, adminMode) {
  return adminMode ? `gp6a_${name}` : `gp6_${name}`
}

export async function sbLoad(adminMode) {
  if (!_client) return null
  try {
    const [{ data: pjRows, error: e1 }, { data: phRows, error: e2 }, { data: tkRows, error: e3 }] =
      await Promise.all([
        _client.from(tbl('projects', adminMode)).select('*').order('sort_order'),
        _client.from(tbl('phases', adminMode)).select('*').order('sort_order'),
        _client.from(tbl('tasks', adminMode)).select('*').order('sort_order'),
      ])
    if (e1 || e2 || e3) return null
    const pjs = {}
    ;(pjRows || []).forEach(r => { pjs[r.id] = { name: r.name, tasks: [], phases: [], members: r.members || [] } })
    ;(phRows || []).forEach(r => {
      if (pjs[r.project_id])
        pjs[r.project_id].phases.push({ id: r.id, name: r.name, startDate: r.start_date, endDate: r.end_date, assignee: r.assignee || '' })
    })
    ;(tkRows || []).forEach(r => {
      if (pjs[r.project_id])
        pjs[r.project_id].tasks.push({
          id: r.id, phaseId: r.phase_id, parentId: r.parent_id,
          name: r.name, startDate: r.start_date, endDate: r.end_date,
          completedDate: r.completed_date, status: r.status, assignee: r.assignee,
          effort: r.effort, memo: r.memo, starred: r.starred || false, updatedAt: r.updated_at
        })
    })
    return pjs
  } catch (e) { return null }
}

export async function sbSavePJ(id, pjs, adminMode) {
  if (!_client) return
  const p = pjs[id]; if (!p) return
  await _client.from(tbl('projects', adminMode)).upsert(
    { id, name: p.name, sort_order: Object.keys(pjs).indexOf(id), members: p.members || [] },
    { onConflict: 'id' }
  )
}

export async function sbDeletePJ(id, adminMode) {
  if (!_client) return
  await _client.from(tbl('projects', adminMode)).delete().eq('id', id)
}

function showDbError(msg) {
  let el = document.getElementById('_ph_save_err')
  if (!el) {
    el = document.createElement('div')
    el.id = '_ph_save_err'
    el.style.cssText = [
      'position:fixed', 'bottom:20px', 'left:50%', 'transform:translateX(-50%)',
      'background:#dc2626', 'color:#fff', 'padding:14px 18px', 'border-radius:10px',
      'z-index:99999', 'font-size:13px', 'max-width:90vw', 'word-break:break-all',
      'box-shadow:0 4px 20px rgba(0,0,0,.4)', 'line-height:1.5', 'text-align:center'
    ].join(';')
    document.body.appendChild(el)
  }
  el.innerHTML = `⚠️ フェーズDB保存エラー<br><span style="font-size:11px;opacity:.85">${msg}</span>`
  el.style.display = 'block'
  clearTimeout(el._timer)
  el._timer = setTimeout(() => { el.style.display = 'none' }, 15000)
}

export async function sbSavePH(ph, projectId, pjs, adminMode) {
  if (!_client) { console.warn('[sbSavePH] client not initialized'); return }
  const p = pjs[projectId]; if (!p) { console.warn('[sbSavePH] project not found:', projectId); return }
  const payload = {
    id: ph.id, project_id: projectId, name: ph.name,
    start_date: ph.startDate || null, end_date: ph.endDate || null,
    assignee: ph.assignee || '',
    sort_order: p.phases.findIndex(x => x.id === ph.id)
  }
  console.log('[sbSavePH] saving phase:', ph.id, ph.name, 'to', tbl('phases', adminMode))
  const { error } = await _client.from(tbl('phases', adminMode)).upsert(payload, { onConflict: 'id' })
  if (error) {
    console.error('[sbSavePH] error:', error.code, error.message)
    if (error.code === '23503') {
      // FK違反: プロジェクト保存遅延の場合リトライ
      await new Promise(r => setTimeout(r, 1500))
      const { error: e2 } = await _client.from(tbl('phases', adminMode)).upsert(payload, { onConflict: 'id' })
      if (e2) { showDbError(`FK retry: ${e2.message}`); throw new Error(`sbSavePH retry failed: ${e2.message}`) }
    } else if (error.code === '42703') {
      // assigneeカラムが存在しない場合はassigneeなしでリトライ
      console.warn('[sbSavePH] assignee column missing, retrying without it')
      const { assignee, ...payloadWithoutAssignee } = payload
      const { error: e2 } = await _client.from(tbl('phases', adminMode)).upsert(payloadWithoutAssignee, { onConflict: 'id' })
      if (e2) { showDbError(`no-assignee retry: ${e2.message}`); throw new Error(`sbSavePH (no-assignee) retry failed: ${e2.message}`) }
    } else {
      showDbError(`code=${error.code} ${error.message}`)
      throw new Error(`sbSavePH failed: ${error.message}`)
    }
  } else {
    console.log('[sbSavePH] saved successfully:', ph.id)
  }
}

export async function sbDeletePH(id, adminMode) {
  if (!_client) return
  await _client.from(tbl('phases', adminMode)).delete().eq('id', id)
}

export async function sbSaveTask(t, projectId, pjs, adminMode) {
  if (!_client) return
  const p = pjs[projectId]; if (!p) return
  const payload = {
    id: t.id, project_id: projectId,
    phase_id: t.phaseId || null, parent_id: t.parentId || null,
    name: t.name, start_date: t.startDate || null, end_date: t.endDate || null,
    completed_date: t.completedDate || null, status: t.status,
    assignee: t.assignee || '', effort: t.effort || 1, memo: t.memo || '',
    starred: t.starred || false,
    sort_order: p.tasks.findIndex(x => x.id === t.id),
    updated_at: new Date().toISOString()
  }
  const { error } = await _client.from(tbl('tasks', adminMode)).upsert(payload, { onConflict: 'id' })
  if (error) {
    // FK違反の場合(フェーズ保存が遅延した際など)は少し待ってリトライ
    if (error.code === '23503') {
      await new Promise(r => setTimeout(r, 1500))
      const { error: e2 } = await _client.from(tbl('tasks', adminMode)).upsert(payload, { onConflict: 'id' })
      if (e2) throw new Error(`sbSaveTask retry failed: ${e2.message}`)
    } else {
      throw new Error(`sbSaveTask failed: ${error.message}`)
    }
  }
}

export async function sbDeleteTask(id, adminMode) {
  if (!_client) return
  await _client.from(tbl('tasks', adminMode)).delete().eq('id', id)
}

export async function sbMigrateFromLegacy(adminMode) {
  if (!_client) return
  const { data: existing } = await _client.from('gp6_projects').select('id').limit(1)
  if (existing && existing.length > 0) return
  const { data: legacy } = await _client.from('gantt_data').select('*').eq('id', 'gp6').maybeSingle()
  if (!legacy || !legacy.projects) return
  const pjsLegacy = legacy.projects
  for (const [pjId, p] of Object.entries(pjsLegacy)) {
    await _client.from('gp6_projects').upsert({ id: pjId, name: p.name, sort_order: Object.keys(pjsLegacy).indexOf(pjId) }, { onConflict: 'id' })
    for (const [i, ph] of (p.phases || []).entries())
      await _client.from('gp6_phases').upsert({ id: ph.id, project_id: pjId, name: ph.name, start_date: ph.startDate || null, end_date: ph.endDate || null, sort_order: i }, { onConflict: 'id' })
    for (const [i, t] of (p.tasks || []).entries())
      await _client.from('gp6_tasks').upsert({ id: t.id, project_id: pjId, phase_id: t.phaseId || null, parent_id: t.parentId || null, name: t.name, start_date: t.startDate || null, end_date: t.endDate || null, completed_date: t.completedDate || null, status: t.status || 'todo', assignee: t.assignee || '', effort: t.effort || 1, memo: t.memo || '', sort_order: i, updated_at: t.updatedAt || new Date().toISOString() }, { onConflict: 'id' })
  }
}

export function sbSubscribe(adminMode, onReload) {
  if (!_client) return null
  const ch = adminMode ? 'gp6a-realtime' : 'gp6-realtime'
  const channel = _client.channel(ch)
    .on('postgres_changes', { event: '*', schema: 'public', table: tbl('projects', adminMode) }, onReload)
    .on('postgres_changes', { event: '*', schema: 'public', table: tbl('phases', adminMode) }, onReload)
    .on('postgres_changes', { event: '*', schema: 'public', table: tbl('tasks', adminMode) }, onReload)
    .subscribe()
  return channel
}

export async function sbLoadBackups(adminMode) {
  if (!_client) return []
  const table = adminMode ? 'gp6a_backups' : 'gp6_backups'
  const { data } = await _client.from(table).select('*').order('created_at', { ascending: false }).limit(20)
  return data || []
}

export async function sbSaveBackup(label, data, adminMode) {
  if (!_client) throw new Error('Supabaseクライアントが初期化されていません')
  const table = adminMode ? 'gp6a_backups' : 'gp6_backups'
  const id = crypto.randomUUID()
  const { error } = await _client.from(table).insert({ id, label: label || null, data, created_at: new Date().toISOString() })
  if (error) throw new Error(error.message)
  return true
}

export async function sbDeleteBackup(id, adminMode) {
  if (!_client) return
  const table = adminMode ? 'gp6a_backups' : 'gp6_backups'
  await _client.from(table).delete().eq('id', id)
}
