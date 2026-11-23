import { ARTIFACT, FULL_VIEWS, LEVEL_LABEL } from '../../config/artifactConfig'
import { formatClock } from '../../domain/artifact/rules'
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

  return (
    <>
      <header className="top">
        <div>
          <h1>간호업무량 실시간 간호지원체계</h1>
          <div className="sub">응급실 시범, D 근무, 가상 데이터 시연</div>
        </div>
        <div className="clock" aria-live="polite">
          <small>시연 시각</small>
          <span>{formatClock(board.t)}</span>
        </div>
      </header>
      <div className="bar" role="toolbar" aria-label="시연 조작">
        <div className="grp">
          <label className="lbl" htmlFor="viewSel">
            보기
          </label>
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
        </div>
        <div className="sep" />
        <div className="grp">
          <button type="button" className="pri" onClick={() => stepMinutes(ARTIFACT.manualStepMin)}>
            +15분 진행
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
          <button type="button" onClick={reset}>
            초기화
          </button>
        </div>
        <div className="sep" />
        <div className="legend">
          <span>
            <i className="dot s-ok" />
            {LEVEL_LABEL.ok} &lt;30분
          </span>
          <span>
            <i className="dot s-mid" />
            {LEVEL_LABEL.mid} 30–50분
          </span>
          <span>
            <i className="dot s-hi" />
            {LEVEL_LABEL.hi} &gt;50분
          </span>
          <span>막대 옅은 부분 = 1시간 뒤 예측</span>
        </div>
      </div>
    </>
  )
}
