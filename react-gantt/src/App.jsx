import { useEffect, useRef, useState, useCallback } from 'react'
import { useStore } from './store.js'
import AuthOverlay from './components/AuthOverlay.jsx'
import TopBar from './components/TopBar.jsx'
import TabsBar from './components/TabsBar.jsx'
import TaskPanel from './components/TaskPanel.jsx'
import GanttChart from './components/GanttChart.jsx'
import SummaryView from './components/SummaryView.jsx'
import AllProjectsView from './components/AllProjectsView.jsx'
import TaskModal from './components/modals/TaskModal.jsx'
import PhaseModal from './components/modals/PhaseModal.jsx'
import DeleteModal from './components/modals/DeleteModal.jsx'
import BulkEditModal from './components/modals/BulkEditModal.jsx'
import BackupModal from './components/modals/BackupModal.jsx'
import SupabaseModal from './components/modals/SupabaseModal.jsx'
import AdminAuthModal from './components/modals/AdminAuthModal.jsx'
import MembersModal from './components/modals/MembersModal.jsx'
import { isAuthed } from './utils/storage.js'

export default function App() {
  const store = useStore()
  const { view, modal, closeModal, undo, redo, clearFilters, toggleFavFilter,
          expandAllPh, collapseAllPh, cycleView, openModal, adminMode } = store
  const [authed, setAuthed] = useState(false)
  const [tpbScrollTop, setTpbScrollTop] = useState(0)
  const initialized = useRef(false)

  // Init store once
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      store.init().then(() => {
        setAuthed(isAuthed())
      })
    }
  }, [])

  // Auth check
  useEffect(() => {
    if (isAuthed()) setAuthed(true)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const STATUS_CYCLE = ['__active__', '__needs_adjust__', 'requested']

    function onKeyDown(e) {
      // Don't handle when typing in inputs/textareas (except specific combos)
      const tag = document.activeElement?.tagName
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      // Esc: close modal
      if (e.key === 'Escape') {
        if (modal) { closeModal(); return }
      }

      // Ctrl+F: focus search input
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        const el = document.getElementById('search-q-input')
        if (el) { e.preventDefault(); el.focus(); el.select(); return }
      }

      // Ctrl combos
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return }
        if (e.key === 'y') { e.preventDefault(); redo(); return }
        // Ctrl+Shift+z = admin mode toggle
        if ((e.key === 'Z' || e.key === 'z') && e.shiftKey) {
          e.preventDefault()
          const s = useStore.getState()
          if (s.adminMode) s.exitAdmin()
          else openModal('adminAuth')
          return
        }
        // Ctrl+Shift+x = fav filter
        if (e.key === 'X' && e.shiftKey) { e.preventDefault(); toggleFavFilter(); return }
        // Ctrl+Shift+d = clear filters
        if (e.key === 'D' && e.shiftKey) { e.preventDefault(); clearFilters(); return }
        // Ctrl+Shift+← → = cycle status filter
        if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
          e.preventDefault()
          const s = useStore.getState()
          const cur = s.filters.fs || ''
          const idx = STATUS_CYCLE.indexOf(cur)
          const next = e.key === 'ArrowRight'
            ? STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
            : STATUS_CYCLE[(idx - 1 + STATUS_CYCLE.length) % STATUS_CYCLE.length]
          s.setFilters({ fs: next })
          return
        }
        // Ctrl+m = add task modal
        if (e.key === 'm') { e.preventDefault(); openModal('addTask'); return }
        // Ctrl+Shift+f = add phase modal
        if ((e.key === 'F' || e.key === 'f') && e.shiftKey) { e.preventDefault(); openModal('addPh'); return }
        // Ctrl+q = cycle view
        if (e.key === 'q') { e.preventDefault(); cycleView(); return }
        // Ctrl+Arrow (no shift) = expand/collapse / project nav
        if (!e.shiftKey) {
          if (e.key === 'ArrowUp') { e.preventDefault(); collapseAllPh(); return }
          if (e.key === 'ArrowDown') { e.preventDefault(); expandAllPh(); return }
          if (e.key === 'ArrowLeft') { e.preventDefault(); navPJ(-1); return }
          if (e.key === 'ArrowRight') { e.preventDefault(); navPJ(1); return }
        }
        // Ctrl+S = save (no-op in react version, autosaves)
        if (e.key === 's') { e.preventDefault(); return }
      }

      // Arrow keys for selected task (when not in input)
      if (!inInput && !modal) {
        const { sel } = useStore.getState()
        if (e.key === 'ArrowUp' && sel.size === 1) { e.preventDefault(); useStore.getState().taskMoveUpDown([...sel][0], -1); return }
        if (e.key === 'ArrowDown' && sel.size === 1) { e.preventDefault(); useStore.getState().taskMoveUpDown([...sel][0], 1); return }
        if (e.key === 'ArrowLeft' && sel.size === 1) { e.preventDefault(); useStore.getState().taskIndent([...sel][0], true); return }
        if (e.key === 'ArrowRight' && sel.size === 1) { e.preventDefault(); useStore.getState().taskIndent([...sel][0], false); return }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [modal, undo, redo, closeModal, clearFilters, toggleFavFilter, expandAllPh, collapseAllPh, cycleView, openModal])

  function navPJ(dir) {
    const s = useStore.getState()
    const pjs = s._pjs()
    const ids = Object.keys(pjs)
    if (!ids.length) return
    const idx = s._cur() ? ids.indexOf(s._cur()) : -1
    const next = ids[(idx + dir + ids.length) % ids.length]
    s.switchPJ(next)
  }

  const handleScrollSync = useCallback((top) => {
    setTpbScrollTop(top)
  }, [])

  if (!authed) {
    return <AuthOverlay onAuthed={() => setAuthed(true)} />
  }

  return (
    <div id="app">
      <TopBar />
      <TabsBar />
      <div id="main">
        {view === 'gantt' && (
          <div id="gantt-wrap" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <TaskPanel onScrollSync={handleScrollSync} tpbScrollTop={tpbScrollTop} />
            <GanttChart tpbScrollTop={tpbScrollTop} onScrollSync={handleScrollSync} />
          </div>
        )}
        {view === 'summary' && <SummaryView />}
        {view === 'allprojects' && <AllProjectsView />}
      </div>

      {/* Modals */}
      <TaskModal />
      <PhaseModal />
      <DeleteModal />
      <BulkEditModal />
      <BackupModal />
      <SupabaseModal />
      <AdminAuthModal />
      <MembersModal />
    </div>
  )
}
