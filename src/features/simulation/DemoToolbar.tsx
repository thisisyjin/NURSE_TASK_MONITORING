import { useState } from 'react'
import { ARTIFACT, FULL_VIEWS } from '../../config/artifactConfig'
import { formatClock, levelOf } from '../../domain/artifact/rules'
import { useDemoStore } from '../../store/demoStore'

export function DemoToolbar() {
  const board = useDemoStore((state) => state.board)
  const autoRunning = useDemoStore((state) => state.autoRunning)
  const setView = useDemoStore((state) => state.setView)
  const stepMinutes = useDemoStore((state) => state.stepMinutes)
  const toggleAuto = useDemoStore((state) => state.toggleAuto)
  const spawnRandomOrder = useDemoStore((state) => state.spawnRandomOrder)
  const surge = useDemoStore((state) => state.surge)
  const startCpcr = useDemoStore((state) => state.startCpcr)
  const reset = useDemoStore((state) => state.reset)
  const [open, setOpen] = useState(false)
  const highCount = board.nurses.filter((nurse) => levelOf(board, nurse) === 'hi').length
  const waitingCount = board.supports.filter((support) => !support.end && !support.accepted).length

  return (
    <header className="top demo-head">
      <div>
        <h1>간호업무량 실시간 간호지원체계</h1>
        <div className="sub">응급실 시범, D 근무, 가상 데이터</div>
        <div className="summary-strip">
          높음 {highCount}명, 지원 응답 대기 {waitingCount}건
        </div>
      </div>
      <div className="head-side">
        <div className="clock" aria-live="polite">
          <small>시연 시각</small>
          <span>{formatClock(board.t)}</span>
        </div>
        <label className="view-switch">
          <span>현재 화면</span>
          <select id="viewSel" value={board.view} onChange={(event) => setView(event.target.value)}>
            {Object.entries(FULL_VIEWS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
            {board.nurses.map((nurse) => (
              <option key={nurse.id} value={nurse.id}>
                간호사: {nurse.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grp">
          <button type="button" className="pri" onClick={() => stepMinutes(ARTIFACT.manualStepMin)}>
            +15분
          </button>
          <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            시연 제어
          </button>
        </div>
      </div>
      {open ? (
        <div className="demo-controls" role="toolbar" aria-label="시연 제어">
          <button type="button" className={autoRunning ? 'on' : undefined} aria-pressed={autoRunning} onClick={toggleAuto}>
            {autoRunning ? '자동 진행 중지' : '자동 진행'}
          </button>
          <button type="button" onClick={spawnRandomOrder}>
            처방 발생
          </button>
          <button type="button" className="warn" onClick={surge}>
            간호요구 급증
          </button>
          <button type="button" className="warn" onClick={startCpcr}>
            CPCR 발생
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('09:00 초기 상태로 되돌릴까요?')) reset()
            }}
          >
            초기화
          </button>
        </div>
      ) : null}
    </header>
  )
}
