import { useRef, useState, useCallback, useEffect } from 'react'
import { useStore, computeRows } from '../store.js'
import { fmt, td, addD, parseInputDate } from '../utils/dates.js'
import { SL } from '../utils/constants.js'

export default function TaskPanel({ onScrollSync, scrollRef }) {
  const store = useStore()
  const {
    tasks, phases, exp, sel, filters, favFilter,
    toggleSel, clearSel, selectAll,
    togglePh, toggleChild, openModal,
    addTask, deleteTask, duplicateTask, toggleStar,
    _cur, inlineAdd, _pjs
  } = store

  const pj = store.pj()
  const tpbRef = useRef(null)
  const [stPopup, setStPopup] = useState(null) // { taskId, x, y }
  const [datePickerState, setDatePicker] = useState(null)
  const [asgPicker, setAsgPicker] = useState(null)
  const [inlineState, setInline] = useState(null) // { parentId, afterIdx, name, start, end }
  const [rdrag, setRdrag] = useState(null)
  const [dropIdx, setDropIdx] = useState(-1)
  const [tooltip, setTooltip] = useState(null)

  if (scrollRef) scrollRef.current = tpbRef.current

  const { rows, filtered } = pj
    ? computeRows(pj.tasks, pj.phases, exp, filters, favFilter)
    : { rows: [], filtered: [] }

  // Scroll sync
  useEffect(() => {
    const el = tpbRef.current
    if (!el || !onScrollSync) return
    const handler = () => onScrollSync(el.scrollTop)
    el.addEventListener('scroll', handler, { passive: true })
    return () => el.removeEventListener('scroll', handler)
  }, [onScrollSync])

  function closeStPopup() { setStPopup(null) }
  useEffect(() => {
    if (stPopup) {
      const h = () => closeStPopup()
      document.addEventListener('click', h)
      return () => document.removeEventListener('click', h)
    }
  }, [stPopup])

  function setStatus(taskId, status) {
    const t = tasks().find(x => x.id === taskId); if (!t) return
    const updated = { ...t, status, completedDate: status === 'done' ? (t.completedDate || td()) : null, updatedAt: td() }
    store.updateTask(updated)
    closeStPopup()
  }

  function openDatePickerInline(e, taskId, field) {
    const rect = e.currentTarget.getBoundingClientRect()
    setDatePicker({ taskId, field, x: rect.left, y: rect.bottom + 2 })
    e.stopPropagation()
  }

  function applyDatePicker(val) {
    if (!datePickerState) return
    const { taskId, field } = datePickerState
    const t = tasks().find(x => x.id === taskId); if (!t) return
    const updated = { ...t, [field === 'start' ? 'startDate' : 'endDate']: val, updatedAt: td() }
    store.updateTask(updated)
    setDatePicker(null)
  }

  useEffect(() => {
    if (datePickerState) {
      const h = e => { if (!e.target.closest('.dt-picker-popup')) setDatePicker(null) }
      document.addEventListener('click', h)
      return () => document.removeEventListener('click', h)
    }
  }, [datePickerState])

  function openAsgPickerInline(e, taskId, isPhase) {
    const rect = e.currentTarget.getBoundingClientRect()
    setAsgPicker({ taskId, isPhase, x: rect.left, y: rect.bottom + 2 })
    e.stopPropagation()
  }
  useEffect(() => {
    if (asgPicker) {
      const h = e => { if (!e.target.closest('.asg-picker-popup')) setAsgPicker(null) }
      document.addEventListener('click', h)
      return () => document.removeEventListener('click', h)
    }
  }, [asgPicker])

  function applyAsg(val) {
    if (!asgPicker) return
    const { taskId, isPhase } = asgPicker
    if (isPhase) {
      const ph = phases().find(x => x.id === taskId)
      if (ph) store.updatePhase({ ...ph, assignee: val })
    } else {
      const t = tasks().find(x => x.id === taskId)
      if (t) store.updateTask({ ...t, assignee: val, updatedAt: td() })
    }
    setAsgPicker(null)
  }

  // Inline add
  function startInline(parentId, afterIdx) {
    const today = td()
    setInline({ parentId: parentId || '__root__', afterIdx: afterIdx ?? -1, name: '', start: fmt(today), end: fmt(addD(today, 6)) })
    setTimeout(() => document.getElementById('ia-name')?.focus(), 30)
  }
  function cancelInline() { setInline(null) }
  function submitInline() {
    if (!inlineState?.name?.trim()) return
    const s = parseInputDate(inlineState.start)
    const e2 = parseInputDate(inlineState.end)
    const cur = _cur(); if (!cur) return
    let phaseId = null, parentId = null
    if (inlineState.parentId && inlineState.parentId !== '__root__') {
      parentId = inlineState.parentId
      const par = tasks().find(t => t.id === parentId)
      if (par) phaseId = par.phaseId
    }
    const t = { id: 't_' + Date.now() + '_' + Math.random().toString(36).slice(2,5), phaseId, parentId, name: inlineState.name.trim(), startDate: s, endDate: e2, completedDate: null, status: 'todo', assignee: '', effort: 1, memo: '', starred: false, updatedAt: td() }
    store.addTask(t)
    setInline(null)
  }

  // Row drag (reorder)
  const dragState = useRef(null)
  function onDragStart(e, taskId) {
    dragState.current = { taskId, startY: e.clientY }
    const el = document.getElementById('tr_' + taskId)
    if (el) el.classList.add('dragging')
  }
  function onDragEnd() {
    if (!dragState.current) return
    const el = document.getElementById('tr_' + dragState.current.taskId)
    if (el) el.classList.remove('dragging')
    dragState.current = null
    setDropIdx(-1)
  }

  function getMemberOptions() {
    return store.getMemberCandidates()
  }

  if (!pj) {
    return (
      <div id="tp">
        <div id="tph"><span></span><span></span><span></span><span>タスク名</span><span>ステータス</span><span>開始日</span><span>終了日</span><span>担当者</span><span style={{textAlign:'center'}}>☆</span></div>
        <div id="tpb" ref={tpbRef}>
          <div className="emp"><div className="ic">📋</div><div className="et">プロジェクトを選択してください</div></div>
        </div>
      </div>
    )
  }

  const today = td()

  return (
    <div id="tp">
      <div id="tph">
        <span></span>
        <span><input type="checkbox" id="chkall" style={{accentColor:'var(--ac)',width:15.6,height:15.6}}
          onChange={e => e.target.checked ? selectAll(filtered.map(t=>t.id)) : clearSel()}
          checked={sel.size > 0 && filtered.every(t => sel.has(t.id))} /></span>
        <span></span>
        <span>タスク名</span>
        <span>ステータス</span>
        <span>開始日</span><span>終了日</span>
        <span>担当者</span><span style={{textAlign:'center'}}>☆</span>
      </div>
      <div id="tpb" ref={tpbRef}>
        {rows.length === 0 && inlineState === null && (
          <div className="emp"><div className="ic">✅</div><div className="et">タスクがありません</div><div className="ed">下の「＋ タスクを追加」から追加してください</div></div>
        )}
        {rows.map((row, idx) => (
          <div key={row.type === 'ph' ? row.data.id : row.data.id + '_' + idx}>
            {row.type === 'ph'
              ? <PhaseRow ph={row.data} idx={idx} tasks={tasks()} exp={exp}
                  onToggle={() => togglePh(row.data.id)}
                  onEdit={() => openModal('editPh', { id: row.data.id })}
                  onDelete={() => openModal('delete', { type: 'phase', id: row.data.id, label: row.data.name })}
                  onAsgClick={e => openAsgPickerInline(e, row.data.id, true)}
                  onStartInline={() => startInline(null, idx)}
                  today={today} />
              : <TaskRow t={row.data} ch={row.ch} idx={idx} sel={sel} exp={exp}
                  today={today}
                  onCheck={v => toggleSel(row.data.id, v)}
                  onToggleChild={() => toggleChild(row.data.id)}
                  onStPopup={e => { e.stopPropagation(); const r=e.currentTarget.getBoundingClientRect(); setStPopup({taskId:row.data.id, x:r.left, y:r.bottom+2}) }}
                  onEdit={() => openModal('editTask', { id: row.data.id })}
                  onDup={() => store.dupTask(row.data.id)}
                  onDelete={() => openModal('delete', { type: 'task', id: row.data.id, label: row.data.name })}
                  onStar={() => toggleStar(row.data.id)}
                  onDateClick={openDatePickerInline}
                  onAsgClick={e => openAsgPickerInline(e, row.data.id, false)}
                  onAddChild={() => startInline(row.data.id, idx)}
                  onAddSibling={() => { const p=tasks().find(t=>t.id===row.data.parentId); startInline(row.data.parentId, idx) }}
                  onDragStart={e => onDragStart(e, row.data.id)}
                  onDragEnd={onDragEnd}
                  onNameClick={() => { if(tasks().some(c=>c.parentId===row.data.id)) { toggleChild(row.data.id) } }}
                  tasks={tasks()} />
            }
            {inlineState && inlineState.afterIdx === idx && (
              <InlineAddRow state={inlineState} onChange={setInline} onSubmit={submitInline} onCancel={cancelInline} />
            )}
          </div>
        ))}
        {inlineState && inlineState.afterIdx === -1 && (
          <InlineAddRow state={inlineState} onChange={setInline} onSubmit={submitInline} onCancel={cancelInline} />
        )}
        {/* Add footer */}
        <div className="tpb-add-row" onClick={() => openModal('addTask')}><span className="add-ic">＋</span>タスクを追加...</div>
        <div className="tpb-add-row" onClick={() => openModal('addPh')} style={{borderTop:'1px dashed var(--bd)'}}><span className="add-ic">＋</span>フェーズを追加...</div>
      </div>

      {/* Status popup */}
      {stPopup && (
        <div className="st-popup" style={{left: stPopup.x, top: stPopup.y}} onClick={e => e.stopPropagation()}>
          {Object.entries(SL).map(([v,l]) => (
            <div key={v} onClick={() => setStatus(stPopup.taskId, v)}>{l}</div>
          ))}
        </div>
      )}

      {/* Date picker popup */}
      {datePickerState && (
        <div className="dt-picker-popup" style={{position:'fixed',zIndex:500,left:datePickerState.x,top:datePickerState.y,background:'var(--s1)',border:'1px solid var(--bd2)',borderRadius:6,boxShadow:'0 4px 16px rgba(0,0,0,.15)',padding:'6px 8px'}}>
          <input type="date" autoFocus className="fc"
            defaultValue={datePickerState.field === 'start' ? tasks().find(t=>t.id===datePickerState.taskId)?.startDate : tasks().find(t=>t.id===datePickerState.taskId)?.endDate}
            onChange={e => applyDatePicker(e.target.value)}
            style={{width:140}}
          />
        </div>
      )}

      {/* Assignee picker */}
      {asgPicker && (
        <div className="asg-picker-popup" style={{position:'fixed',zIndex:500,left:asgPicker.x,top:asgPicker.y,background:'var(--s1)',border:'1px solid var(--bd2)',borderRadius:6,boxShadow:'0 4px 16px rgba(0,0,0,.15)',minWidth:120,overflow:'hidden'}}>
          <div style={{padding:'4px 8px',fontSize:10,color:'var(--tx3)',borderBottom:'1px solid var(--bd)'}}>担当者を選択</div>
          <div style={{padding:'3px 8px',fontSize:11,cursor:'pointer',color:'var(--tx3)'}} onClick={() => applyAsg('')}>（未設定）</div>
          {getMemberOptions().map(m => (
            <div key={m} style={{padding:'5px 10px',fontSize:11,cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.background='var(--s2)'} onMouseLeave={e=>e.currentTarget.style.background=''} onClick={() => applyAsg(m)}>{m}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function PhaseRow({ ph, idx, tasks, exp, onToggle, onEdit, onDelete, onAsgClick, onStartInline, today }) {
  const ts2 = tasks.filter(t => t.phaseId === ph.id && !t.parentId)
  const allPh = tasks.filter(t => t.phaseId === ph.id)
  const expanded = exp.has(ph.id)
  let sd = ph.startDate, ed = ph.endDate
  if (ts2.length) {
    const starts = ts2.map(t => t.startDate).filter(Boolean).sort()
    const ends = ts2.map(t => t.endDate).filter(Boolean).sort()
    if (starts.length) sd = starts[0]
    if (ends.length) ed = ends[ends.length - 1]
  }
  let phSt = 'todo'
  if (allPh.length) {
    const allDone = allPh.every(t => t.status === 'done' || t.status === 'cancelled')
    const allTodo = allPh.every(t => t.status === 'todo')
    phSt = allDone ? 'done' : allTodo ? 'todo' : 'inprogress'
  }
  const phStLabel = {todo:'未着手',inprogress:'進行中',done:'完了'}[phSt]

  return (
    <div className="ph-r" data-idx={idx} data-type="ph" data-id={ph.id} onClick={onToggle}>
      <span className="drag-handle" onClick={e=>e.stopPropagation()} title="フェーズを移動">⠿</span>
      <span className={`ptog${expanded?'':' cl'}`} onClick={e=>{e.stopPropagation();onToggle()}}>▾</span>
      <span className="pn" style={{gridColumn:'3/5'}} onDoubleClick={e=>{e.stopPropagation();onEdit()}}>{ph.name}</span>
      <span style={{overflow:'hidden'}}>
        {allPh.length > 0 && <span className={`ph-stbdg ${phSt}`}>{phStLabel}</span>}
      </span>
      <span className="td">{fmt(sd)}</span>
      <span className="td">{fmt(ed)}</span>
      <span className="td" style={{overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis',fontSize:10,color:'var(--tx3)',cursor:'pointer'}}
        onClick={e=>{e.stopPropagation();onAsgClick(e)}}>{ph.assignee||'—'}</span>
      <span></span>
    </div>
  )
}

function TaskRow({ t, ch, idx, sel, exp, today, onCheck, onToggleChild, onStPopup, onEdit, onDup, onDelete, onStar, onDateClick, onAsgClick, onAddChild, onAddSibling, onDragStart, onDragEnd, onNameClick, tasks }) {
  const [nameEdit, setNameEdit] = useState(false)
  const [editVal, setEditVal] = useState(t.name)
  const nameRef = useRef(null)
  const store = useStore()

  const children = tasks.filter(c => c.parentId === t.id)
  const hasC = children.length > 0
  const childExp = exp.has('c_' + t.id)

  // effective dates
  let sd = t.startDate, ed = t.endDate
  if (hasC) {
    const starts = children.map(c => c.startDate).filter(Boolean).sort()
    const ends = children.map(c => c.endDate).filter(Boolean).sort()
    if (starts.length) sd = starts[0]
    if (ends.length) ed = ends[ends.length - 1]
  }

  const isOverdue = ed && ed < today && t.status !== 'done' && t.status !== 'cancelled'
  const isDelayed = !isOverdue && sd && sd < today && t.status === 'todo'
  const selected = sel.has(t.id)

  function finishNameEdit() {
    const v = editVal.trim()
    if (v && v !== t.name) store.updateTask({ ...t, name: v, updatedAt: td() })
    setNameEdit(false)
  }

  let col3
  if (hasC) col3 = (
    <span className="tog" onClick={e=>{e.stopPropagation();onToggleChild()}} title={childExp?'折りたたむ':'展開'}>{childExp?'▾':'▸'}</span>
  )
  else if (ch) col3 = (
    <span className="tog" onClick={e=>{e.stopPropagation();onAddSibling()}} title="同レベルで追加" style={{color:'var(--tx3)'}}>+</span>
  )
  else col3 = (
    <span className="tog" onClick={e=>{e.stopPropagation();onAddChild()}} title="サブタスク追加" style={{color:'var(--tx3)'}}>+</span>
  )

  return (
    <div className={`t-r${ch?' ch':''}${selected?' sel':''}${isOverdue?' overdue':isDelayed?' delayed':''}`}
      data-idx={idx} data-type="t" data-id={t.id} id={`tr_${t.id}`}>
      <span className="drag-handle" draggable onDragStart={onDragStart} onDragEnd={onDragEnd}>⠿</span>
      <span><input type="checkbox" checked={selected} style={{accentColor:'var(--ac)',width:15.6,height:15.6}} onClick={e=>e.stopPropagation()} onChange={e=>onCheck(e.target.checked)} /></span>
      {col3}
      <span className="tn-wrap" style={{display:'flex',alignItems:'center',overflow:'hidden',minWidth:0,paddingLeft:ch?14:0,cursor:hasC?'pointer':'default'}}
        onClick={hasC?e=>{e.stopPropagation();onNameClick()}:undefined}>
        {nameEdit ? (
          <input ref={nameRef} value={editVal} style={{flex:1,minWidth:0,fontSize:12,background:'var(--s1)',border:'1px solid var(--ac)',borderRadius:3,padding:'1px 4px',outline:'none',fontFamily:'var(--f)'}}
            autoFocus onChange={e=>setEditVal(e.target.value)}
            onBlur={finishNameEdit} onKeyDown={e=>{if(e.key==='Enter')finishNameEdit();if(e.key==='Escape'){setEditVal(t.name);setNameEdit(false)}}}
          />
        ) : (
          <span className={`tn${t.status==='done'?' dn':''}`}
            onDoubleClick={e=>{e.stopPropagation();setNameEdit(true);setEditVal(t.name)}}
            title={t.name}>{t.name}</span>
        )}
      </span>
      <span style={{overflow:'hidden'}}>
        <span className={`stbdg ${t.status}`} onClick={onStPopup}>{SL[t.status]}</span>
      </span>
      <span className={`td dt-cell${isDelayed?' start-dt':''}`} onClick={e=>onDateClick(e,t.id,'start')} title="クリックで開始日編集">{fmt(sd)}</span>
      <span className={`td dt-cell${isOverdue?' end-dt':''}`} onClick={e=>onDateClick(e,t.id,'end')} title="クリックで終了日編集">{fmt(ed)}</span>
      <span className="td" style={{overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis',fontSize:10,color:'var(--tx3)',cursor:'pointer'}}
        onClick={e=>onAsgClick(e)} title="クリックで担当者編集">{t.assignee||'—'}</span>
      <span onClick={onStar} style={{display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:14,color:t.starred?'#f59e0b':'#d1d5db',flexShrink:0}}
        title="お気に入り">{t.starred?'★':'☆'}</span>
    </div>
  )
}

function InlineAddRow({ state, onChange, onSubmit, onCancel }) {
  return (
    <div className="inline-add-row">
      <span></span><span></span><span></span>
      <span style={{display:'flex',alignItems:'center',gap:3,minWidth:0,overflow:'hidden'}}>
        <input id="ia-name" type="text" placeholder="タスク名..." value={state.name}
          className="inline-add-input" style={{flex:1,minWidth:0,padding:'3px 5px',fontSize:12}}
          onChange={e=>onChange({...state,name:e.target.value})}
          onKeyDown={e=>{if(e.key==='Enter')onSubmit();if(e.key==='Escape')onCancel()}} />
        <button style={{flexShrink:0,padding:'3px 5px',borderRadius:4,border:'1px solid var(--bd2)',background:'var(--s3)',color:'var(--tx3)',fontSize:12,cursor:'pointer'}} onClick={onCancel}>✕</button>
      </span>
      <span></span>
      <input type="text" value={state.start} className="inline-add-input"
        style={{padding:'2px 3px',fontSize:11,width:'100%',textAlign:'center',fontFamily:'var(--fm)'}}
        onChange={e=>onChange({...state,start:e.target.value})}
        onKeyDown={e=>{if(e.key==='Enter')onSubmit()}} />
      <input type="text" value={state.end} className="inline-add-input"
        style={{padding:'2px 3px',fontSize:11,width:'100%',textAlign:'center',fontFamily:'var(--fm)'}}
        onChange={e=>onChange({...state,end:e.target.value})}
        onKeyDown={e=>{if(e.key==='Enter')onSubmit()}} />
      <button style={{padding:'3px 6px',borderRadius:4,border:'1px solid var(--ac)',background:'var(--ac)',color:'#fff',fontSize:11,cursor:'pointer',fontWeight:600,whiteSpace:'nowrap'}} onClick={onSubmit}>追加</button>
      <span></span>
    </div>
  )
}
