import { useEffect, useState } from 'react'
import { ARTIFACT, FULL_VIEWS } from '../../config/artifactConfig'
import { formatClock } from '../../domain/artifact/rules'
import { useDemoStore } from '../../store/demoStore'
import { PrettySelect } from '../ui/PrettySelect'

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark')

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [dark])

  return (
    <button type="button" className={dark ? 'theme-toggle is-on' : 'theme-toggle'} aria-pressed={dark} onClick={() => setDark((value) => !value)}>
      다크모드
    </button>
  )
}

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

  return (
    <header className="top demo-head">
      <div>
        <div className="title-row">
          <h1>간호업무량 실시간 간호지원체계</h1>
          <ThemeToggle />
        </div>
        <div className="sub">응급실 시범, D 근무, 가상 데이터</div>
      </div>
      <div className="clock" aria-live="polite">
        <small>시연 시각</small>
        <span>{formatClock(board.t)}</span>
      </div>
      <div className="bar" role="toolbar" aria-label="시연 제어">
        <PrettySelect
          label="현재 화면"
          value={board.view}
          onChange={setView}
          options={[
            ...Object.entries(FULL_VIEWS).map(([value, label]) => ({ value, label })),
            ...board.nurses.map((nurse) => ({ value: nurse.id, label: nurse.name, hint: '간호사' })),
          ]}
        />
        <span className="sep" />
        <div className="grp">
          <button type="button" className="pri" onClick={() => stepMinutes(ARTIFACT.manualStepMin)}>
            +15분
          </button>
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
        <span className="sep" />
        <div className="legend">
          <span>
            <i className="dot s-ok" />
            여유
          </span>
          <span>
            <i className="dot s-mid" />
            보통
          </span>
          <span>
            <i className="dot s-hi" />
            높음
          </span>
        </div>
      </div>
    </header>
  )
}
