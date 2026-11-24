import { useEffect, useState } from 'react'
import amcLogo from '../../AMC_Logo.webp'
import { NurseGrid } from '../features/dashboard/NurseCard'
import { DemoToolbar } from '../features/simulation/DemoToolbar'
import {
  GuideModal,
  IncomingRequestBanner,
  OrderCatalogModal,
  StaffingPanel,
  SupportAlertPanel,
  SupportHistoryPanel,
  ZoneTimelinessPanel,
} from '../features/support/SupportPanels'
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
    <div className="wrap v3">
      <DemoToolbar />
      <IncomingRequestBanner />
      <div className="main">
        <NurseGrid />
        <aside className="rail">
          <SupportAlertPanel />
          <StaffingPanel />
          <ZoneTimelinessPanel />
          <SupportHistoryPanel />
        </aside>
      </div>
      <footer className="site-foot">
        <div className="site-line">
          <img src={amcLogo} alt="서울아산병원" />
          <strong>간호업무량 실시간 간호지원체계</strong>
          <span className="foot-sep" aria-hidden="true">|</span>
          <button type="button" className="text-link" onClick={() => setGuide(true)}>
            시연 기준 안내
          </button>
          <span className="foot-sep" aria-hidden="true">|</span>
          <button type="button" className="text-link" onClick={() => setCatalog(true)}>
            처방 분류 기준
          </button>
        </div>
      </footer>
      {guide ? <GuideModal onClose={() => setGuide(false)} /> : null}
      {catalog ? <OrderCatalogModal onClose={() => setCatalog(false)} /> : null}
      <Toast />
    </div>
  )
}
