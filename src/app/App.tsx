import { useEffect, useState } from 'react'
import { NurseGrid } from '../features/dashboard/NurseCard'
import { DemoToolbar } from '../features/simulation/DemoToolbar'
import { GuideModal, OrderCatalogModal, StaffingPanel, SupportAlertPanel, SupportHistoryPanel, ZoneTimelinessPanel } from '../features/support/SupportPanels'
import { useDemoStore } from '../store/demoStore'

function Toast() {
  const toast = useDemoStore((state) => state.toast)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!toast) return
    setVisible(true)
    const timer = window.setTimeout(() => setVisible(false), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  return (
    <div className={visible ? 'toast show' : 'toast'} role="status">
      {toast?.text}
    </div>
  )
}

export function App() {
  const [guide, setGuide] = useState(false)
  const [catalog, setCatalog] = useState(false)
  return (
    <div className="wrap">
      <DemoToolbar />
      <div className="board">
        <div className="board-main">
          <h2 className="section-title">간호사별 업무 현황</h2>
          <NurseGrid />
          <div className="aux">
            <StaffingPanel />
            <ZoneTimelinessPanel />
          </div>
        </div>
        <aside className="rail">
          <SupportAlertPanel />
          <SupportHistoryPanel />
        </aside>
      </div>
      <footer className="foot-links">
        <button type="button" className="text-link" onClick={() => setGuide(true)}>
          시연 기준 안내
        </button>
        <button type="button" className="text-link" onClick={() => setCatalog(true)}>
          처방 분류 기준
        </button>
      </footer>
      {guide ? <GuideModal onClose={() => setGuide(false)} /> : null}
      {catalog ? <OrderCatalogModal onClose={() => setCatalog(false)} /> : null}
      <Toast />
    </div>
  )
}
