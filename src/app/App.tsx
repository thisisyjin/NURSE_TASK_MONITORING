import { useEffect, useState } from 'react'
import { NurseGrid } from '../features/dashboard/NurseCard'
import { DemoToolbar } from '../features/simulation/DemoToolbar'
import { OrderCatalogPanel, StaffingPanel, SupportAlertPanel, SupportHistoryPanel, ZoneTimelinessPanel } from '../features/support/SupportPanels'
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
  return (
    <div className="wrap">
      <DemoToolbar />
      <div className="main">
        <NurseGrid />
        <aside className="rail">
          <SupportAlertPanel />
          <SupportHistoryPanel />
          <StaffingPanel />
          <ZoneTimelinessPanel />
          <OrderCatalogPanel />
        </aside>
      </div>
      <div className="note">
        가상 데이터로 만든 시연판이며 실제 환자, 직원 정보는 없습니다. 환자명은 가상 이름이고 등록번호(8자리)도 가상 번호입니다.
        업무량(분) = 환자 상태 관찰 부하(KTAS, NEWS) + 처방된 주기에 따른 활력징후 측정 시간 + 수행 대기 처방의 표준 소요시간 합계입니다.
        NEWS ↑는 이전보다 위험 단계(양호 0–1, 주의 2–4, 위험 5–6, 고위험 7 이상)가 올라갔을 때 표시합니다. 소생실은 비어 있다가 09:30에
        CPCR 환자 1명이 내원합니다(+15분 진행 2회, 또는 CPCR 발생 버튼으로 바로 시작). 환자 상태 악화, 섬망, CPCR 등으로 간호요구량이 많은
        상황이 생기면 담당 간호사를 즉시 높음으로 표시하고 사유를 함께 보여줍니다. 화면 보기: 근무조 리더간호사와 응급전문간호사는 전체를
        보고, 담당간호사는 본인 상세와 동료의 단계만 봅니다. 지원 배정을 수락한 간호사는 지원 대상 간호사의 화면을 함께 봅니다. 단계
        기준(30분, 50분), 처방별 소요시간, 활력징후 회당 3분, 처방 수행 기준(일반 30분, 패혈성 쇼크 항생제 60분)은 시연용 값입니다. 지원
        우선 대상 간호사는 기준을 10분 앞당겨 적용합니다. 인력 기준은 이 시연판에서 담당 환자가 있는 간호사 1명당 50분입니다. 담당 환자
        1명당 50분 기준의 적용 방식은 개발팀과 협의 중입니다. 1시간 뒤 값은 예정 처방과 현재 NEWS 상승을 반영한 시연용 추산이며 AI 예측이
        아닙니다.
      </div>
      <Toast />
    </div>
  )
}
