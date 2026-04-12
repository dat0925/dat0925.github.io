import { useStore } from '../store.js'
import { addD } from '../utils/dates.js'

export default function TabsBar() {
  const {
    view, setView, scale, setScale, goToday, navChart,
    undo, redo, undoStack, redoStack,
    sel, clearSel, filters, setFilters, favFilter, toggleFavFilter, clearFilters,
    tasks, phases, taskIndent, reorderTasks, adminMode,
    expandAllPh, collapseAllPh, exp,
    _pjs, _cur
  } = useStore()

  const selSize = sel.size
  const allPhExpanded = phases().length > 0 && phases().every(p => exp.has(p.id))

  function navPJ(dir) {
    const pjs = _pjs()
    const ids = Object.keys(pjs)
    if (!ids.length) return
    const idx = _cur() ? ids.indexOf(_cur()) : -1
    const next = ids[(idx + dir + ids.length) % ids.length]
    useStore.getState().switchPJ(next)
  }

  function moveSelTask(dir) {
    if (sel.size !== 1) return
    const id = [...sel][0]
    // use store taskMoveUpDown equivalent
    useStore.getState().taskMoveUpDown(id, dir)
  }

  return (
    <div id="tabs">
      <div className="tg" style={{ border: '1.5px solid var(--bd2)', padding: 2, gap: 1 }}>
        {[['gantt','ガント'],['summary','サマリー'],['allprojects','全プロジェクト']].map(([v,l]) => (
          <div key={v} className={`tab${view===v?' on':''}`} onClick={() => setView(v)}
            style={v==='gantt'?{fontWeight:600}:{borderLeft:'1px solid var(--bd2)',borderRight:'1px solid var(--bd2)'}}>
            {l}
          </div>
        ))}
      </div>
      <button className="btn" onClick={() => allPhExpanded ? collapseAllPh() : expandAllPh()}
        title={allPhExpanded ? 'すべて閉じる (Ctrl+↑)' : 'すべて開く (Ctrl+↓)'}
        style={{ padding: '3px 8px', fontSize: 11, marginLeft: 4 }}>
        {allPhExpanded ? '▲ 閉じる' : '▼ 開く'}
      </button>
      <button className="btn" onClick={() => undo()} title="元に戻す (Ctrl+Z)" id="undo-btn"
        style={{ marginLeft: 4, padding: '3px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: undoStack.length ? 1 : 0.4 }}
        disabled={!undoStack.length}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 9h13a5 5 0 0 1 0 10H7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 5L3 9l4 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      <button className="btn" onClick={() => redo()} title="やり直す (Ctrl+Y)" id="redo-btn"
        style={{ padding: '3px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: redoStack.length ? 1 : 0.4 }}
        disabled={!redoStack.length}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 9H8a5 5 0 0 0 0 10h9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M17 5l4 4-4 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      {/* iPad move buttons */}
      {selSize === 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--tx3)', whiteSpace: 'nowrap' }}>選択タスク:</span>
          <button className="btn" onClick={() => moveSelTask(-1)} title="上へ移動 ↑" style={{ padding: '3px 8px', fontSize: 13, fontWeight: 700 }}>↑</button>
          <button className="btn" onClick={() => moveSelTask(1)} title="下へ移動 ↓" style={{ padding: '3px 8px', fontSize: 13, fontWeight: 700 }}>↓</button>
          <button className="btn" onClick={() => taskIndent([...sel][0], true)} title="← 親へ昇格" style={{ padding: '3px 8px', fontSize: 13, fontWeight: 700 }}>←</button>
          <button className="btn" onClick={() => taskIndent([...sel][0], false)} title="→ 子タスクにする" style={{ padding: '3px 8px', fontSize: 13, fontWeight: 700 }}>→</button>
        </div>
      )}
      {/* Bulk inline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 8 }}>
        <span className="bc" style={{ fontSize: 11, color: selSize > 0 ? 'var(--ac)' : 'var(--tx3)', whiteSpace: 'nowrap', fontWeight: 600 }}>{selSize}件選択中</span>
        {selSize > 0 && (
          <>
            <button className="btn p" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => useStore.getState().openModal('bulkEdit')}>一括編集</button>
            <button className="btn" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => clearSel()}>解除</button>
            <button className="btn d" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => {
              const s = useStore.getState()
              if (selSize === 1) {
                const id = [...sel][0]; const t = s.tasks().find(x => x.id === id)
                if (t) s.openModal('delete', { type: 'task', id, label: t.name })
              } else {
                const names = [...sel].map(id => s.tasks().find(t => t.id === id)?.name || id).slice(0, 3).join('、')
                s.openModal('delete', { type: 'bulk', ids: [...sel], label: names + (selSize > 3 ? ` 他${selSize - 3}件` : '') })
              }
            }}>削除</button>
          </>
        )}
      </div>
      <div className="sp" style={{ flex: 1 }}></div>
      {/* Filters */}
      {view === 'gantt' && (
        <div className="rc">
          <div className="fb">
            <input id="search-q-input" placeholder="🔍 タスク検索..." value={filters.q} onChange={e => setFilters({ q: e.target.value })} style={{ width: 110 }} />
            <select value={filters.fs} onChange={e => setFilters({ fs: e.target.value })}>
              <option value="">全ステータス</option>
              <option value="__active__">進行中のみ</option>
              <option value="__needs_adjust__">要期間調整</option>
              {[['todo','未着手'],['inprogress','進行中'],['requested','依頼中'],['done','完了'],['cancelled','不用']].map(([v,l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <select value={filters.fa} onChange={e => setFilters({ fa: e.target.value })}>
              <option value="">全担当者</option>
              {[...new Set(tasks().map(t => t.assignee).filter(Boolean))].map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <button onClick={() => toggleFavFilter()}
              style={{ padding: '3px 7px', borderRadius: 5, border: '1px solid var(--bd2)', fontSize: 13, cursor: 'pointer', background: favFilter ? 'rgba(245,158,11,.12)' : 'var(--s3)', color: favFilter ? '#f59e0b' : 'var(--tx2)' }}
              title="お気に入りフィルタ">
              {favFilter ? '★' : '☆'}
            </button>
            {(filters.q || filters.fs || filters.fa || favFilter) && (
              <button className="btn" onClick={() => clearFilters()}
                style={{ padding: '3px 8px', fontSize: 11, color: 'var(--rd)', borderColor: 'var(--rd)' }}
                title="フィルタ全解除 (Ctrl+Shift+D)">✕ 解除</button>
            )}
          </div>
          <div className="tg" id="sctabs">
            {[['day','日'],['week','週'],['month','月']].map(([s,l]) => (
              <div key={s} className={`tab${scale===s?' on':''}`} onClick={() => setScale(s)}>{l}</div>
            ))}
          </div>
          <button className="btn" onClick={goToday} title="今日へ移動">今日</button>
          <button className="btn" onClick={() => navChart(-1)} title="前へ">◀</button>
          <button className="btn" onClick={() => navChart(1)} title="次へ">▶</button>
        </div>
      )}
    </div>
  )
}
