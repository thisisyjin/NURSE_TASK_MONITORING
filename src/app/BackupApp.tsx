import { useEffect, useState } from 'react'
import amcLogo from '../../AMC_Logo.webp'
import {
  ARTIFACT,
  CAPACITY_LABEL,
  CATEGORY_LABEL,
  DECLINE_REASONS,
  FULL_VIEWS,
  LEVEL_LABEL,
  ORDER_CATALOG,
  SURGE_TYPES,
} from '../config/artifactConfig'
import { backupWaitLabel, backupWorkloadLevel } from '../features/backup/backupLevel'
import {
  activeSupport,
  buildAlerts,
  capacityOf,
  findNurse,
  formatClock,
  isActivePending,
  isFullView,
  levelOf,
  loadOf,
  newsBandLabel,
  newsRaised,
  recommendNurse,
  supportFrom,
  vitalLabel,
  zoneTimeliness,
} from '../domain/artifact/rules'
import type { ArtifactNurse, ArtifactPatient, ArtifactState, ArtifactSupport } from '../domain/artifact/types'
import { go } from './navigation'
import { useBackupStore } from '../store/demoStore'

function Toast() {
  const toast = useBackupStore((state) => state.toast)
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

function BackupToolbar() {
  const board = useBackupStore((state) => state.board)
  const autoRunning = useBackupStore((state) => state.autoRunning)
  const setView = useBackupStore((state) => state.setView)
  const stepMinutes = useBackupStore((state) => state.stepMinutes)
  const toggleAuto = useBackupStore((state) => state.toggleAuto)
  const spawnRandomOrder = useBackupStore((state) => state.spawnRandomOrder)
  const surge = useBackupStore((state) => state.surge)
  const startCpcr = useBackupStore((state) => state.startCpcr)
  const reset = useBackupStore((state) => state.reset)

  return (
    <>
      <header className="top">
        <div>
          <h1>간호업무량 실시간 간호지원체계</h1>
          <div className="sub">응급실 시범, D 근무, 가상 데이터 시연, 기존 화면</div>
        </div>
        <div className="clock" aria-live="polite">
          <small>시연 시각</small>
          <span>{formatClock(board.t)}</span>
        </div>
      </header>
      <div className="bar" role="toolbar" aria-label="시연 조작">
        <div className="grp">
          <label className="lbl" htmlFor="backupView">
            보기
          </label>
          <select id="backupView" value={board.view} onChange={(event) => setView(event.target.value)}>
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
          <button type="button" className="pri" onClick={() => stepMinutes()}>
            +15분 진행
          </button>
          <button type="button" className={autoRunning ? 'on' : undefined} aria-pressed={autoRunning} onClick={toggleAuto}>
            자동 진행
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
          <button type="button" onClick={() => window.confirm('09:00 초기 상태로 되돌릴까요?') && reset()}>
            초기화
          </button>
        </div>
        <div className="sep" />
        <div className="legend">
          <span>
            <i className="dot s-ok" />
            여유 30분 미만
          </span>
          <span>
            <i className="dot s-mid" />
            보통 30분 이상 50분 이하
          </span>
          <span>
            <i className="dot s-hi" />
            높음 50분 초과
          </span>
          <span>카드 단계는 현재 업무량 기준</span>
        </div>
      </div>
    </>
  )
}

function roleLine(nurse: ArtifactNurse, hasLoad: boolean) {
  if (hasLoad) return `${nurse.role}, 환자 ${nurse.patients.length}명`
  if (nurse.coverBy) return `${nurse.role}, 환자 A-plus 지원간호사에게 임시 인계`
  if (nurse.role === '소생실') return `${nurse.role}, 대기 (환자 없음)`
  return `${nurse.role}, 역할 기본 단계`
}

function peerLine(board: ArtifactState, nurse: ArtifactNurse, hasLoad: boolean) {
  if (hasLoad) return '동료 화면에는 업무량 단계만 표시됩니다.'
  if (nurse.role === '소생실') {
    return board.cpr
      ? '소생실 대기 중 (현재 환자 없음)'
      : `소생실 대기 중 (현재 환자 없음), ${formatClock(ARTIFACT.cpcrAtMin)} CPCR 환자 내원 예정 (시연)`
  }
  return '담당 환자 없이 역할 기본 단계로 표시합니다.'
}

function PatientBlock({ board, nurse, patient, helpers }: { board: ArtifactState; nurse: ArtifactNurse; patient: ArtifactPatient; helpers: ArtifactSupport[] }) {
  const performOrder = useBackupStore((state) => state.performOrder)
  const full = isFullView(board.view)
  const canOwn = full || board.view === nurse.id
  const raised = newsRaised(patient)
  const news =
    patient.cpr && patient.news == null ? (
      <span className="cpr">CPR 중</span>
    ) : (
      <span className={raised ? 'news-up' : undefined}>
        {patient.news}
        {raised ? ` ↑ (${newsBandLabel(patient.newsPrev)} → ${newsBandLabel(patient.news)})` : ''}
      </span>
    )
  const upcoming = patient.sched.filter(([, at]) => at - board.t <= ARTIFACT.forecastWindowMin)
  return (
    <div className="pt">
      <div className="pth">
        <b>
          {patient.id} {patient.nm} <span className="ktas">KTAS {patient.ktas}</span>
        </b>
        <span>
          활력 {vitalLabel(patient.vs)}, NEWS {news}
          {patient.avpu !== 'A' ? (
            <>
              , <span className="news-up">AVPU {patient.avpu}</span>
            </>
          ) : null}
        </span>
      </div>
      <div className="pid">
        {patient.bed}, {patient.reg}
      </div>
      {patient.orders.filter(isActivePending).map((order) => {
        const visibleHelpers = helpers.filter((support) => full || board.view === support.from)
        return (
          <div className="ord" key={order.id}>
            <span>
              {order.name} <span className="w">{backupWaitLabel(Math.max(0, board.t - order.at))}</span>
            </span>
            <span className="acts">
              {canOwn ? (
                <button type="button" className="sm" onClick={() => performOrder(nurse.id, patient.id, order.id, nurse.id)}>
                  수행
                </button>
              ) : null}
              {visibleHelpers.map((support) => (
                <button type="button" className="sm" key={support.from} onClick={() => performOrder(nurse.id, patient.id, order.id, support.from)}>
                  {findNurse(board, support.from)?.name} 수행
                </button>
              ))}
            </span>
          </div>
        )
      })}
      {upcoming.map(([name, at]) => (
        <div className="ord" key={`${name}-${at}`}>
          <span>
            예정: {name} <span className="w">{formatClock(at)}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

function NurseArticle({ board, nurse }: { board: ArtifactState; nurse: ArtifactNurse }) {
  const requestHelp = useBackupStore((state) => state.requestHelp)
  const setPriority = useBackupStore((state) => state.setPriority)
  const clearSurge = useBackupStore((state) => state.clearSurge)
  const acceptAssignment = useBackupStore((state) => state.acceptAssignment)
  const declineAssignment = useBackupStore((state) => state.declineAssignment)
  const finishSupport = useBackupStore((state) => state.finishSupport)
  const setView = useBackupStore((state) => state.setView)
  const full = isFullView(board.view)
  const mine = board.supports.find((support) => !full && support.from === board.view && activeSupport(support))
  const detail = full || board.view === nurse.id || mine?.to === nurse.id
  const own = full || board.view === nurse.id
  const load = loadOf(board, nurse)
  const level = backupWorkloadLevel(load, levelOf(board, nurse))
  const outgoing = supportFrom(board, nurse.id)
  const incoming = board.supports.filter((support) => support.to === nurse.id && activeSupport(support))
  const waiting = board.supports.find((support) => support.from === nurse.id && !support.end && !support.accepted)

  return (
    <article className="card">
      <div className={`stripe s-${level}`} />
      <div className="hd">
        <div>
          <div className="name">{nurse.name}</div>
          <div className="role">{roleLine(nurse, Boolean(load))}</div>
        </div>
        <span className={`lvl l-${level}`}>{LEVEL_LABEL[level]}</span>
      </div>
      {detail && load ? (
        <div className="meter">
          <div className="mrow">
            <span>현재 업무량</span>
            <b>{load.now}분</b>
          </div>
          <div className="mrow">
            <span>
              관찰 {load.base}, 활력 {load.vsl}, 대기 처방 {load.pend}
              {load.sup ? ', 지원 반영' : ''}
            </span>
          </div>
          <div className="track" aria-hidden="true">
            <i className={`s-${level}`} style={{ width: `${Math.min(100, (load.now / ARTIFACT.meterScaleMin) * 100)}%` }} />
            <span className="tick" style={{ left: `${(ARTIFACT.levelLowBelow / ARTIFACT.meterScaleMin) * 100}%` }} />
            <span className="tick" style={{ left: `${(ARTIFACT.levelHighAbove / ARTIFACT.meterScaleMin) * 100}%` }} />
          </div>
        </div>
      ) : null}
      <div className="flags">
        {nurse.prio && full ? <span className="chip ac">지원 우선 대상</span> : null}
        {load?.ev ? (
          <span className="chip hi">
            높음 사유: {load.ev.type}, {load.ev.pid}
          </span>
        ) : null}
        {board.help[nurse.id] ? <span className="chip hi">지원 필요 표시</span> : null}
        {incoming.map((support) => (
          <span className="chip ac" key={`${support.from}-${support.role ?? ''}`}>
            {findNurse(board, support.from)?.name} 지원 중{support.role ? ` (${support.role})` : ''}
          </span>
        ))}
        {outgoing ? (
          <span className="chip ac">
            {findNurse(board, outgoing.to)?.name} {outgoing.accepted ? '지원 중' : '지원 배정, 수락 대기'}
          </span>
        ) : null}
      </div>
      {waiting && (board.view === nurse.id || full) ? (
        <div className="req">
          <div>
            <b>지원 배정 알림</b>, {findNurse(board, waiting.to)?.name}({findNurse(board, waiting.to)?.role}) 지원 요청 ({formatClock(waiting.start)})
          </div>
          <div className="row">
            {board.view === nurse.id ? (
              <>
                <button type="button" className="sm pri" onClick={() => acceptAssignment(nurse.id)}>
                  수락
                </button>
                {DECLINE_REASONS.map((reason) => (
                  <button type="button" className="sm" key={reason} onClick={() => declineAssignment(nurse.id, reason)}>
                    거절: {reason}
                  </button>
                ))}
              </>
            ) : (
              <>
                <span className="empty">간호사 화면에서 수락, 거절</span>
                <button type="button" className="sm" onClick={() => setView(nurse.id)}>
                  {nurse.name} 화면 보기
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
      {detail && load ? (
        <div className="pts">
          {nurse.patients.map((patient) => (
            <PatientBlock
              key={patient.id}
              board={board}
              nurse={nurse}
              patient={patient}
              helpers={board.supports.filter((support) => support.to === nurse.id && activeSupport(support))}
            />
          ))}
        </div>
      ) : null}
      {!detail ? <div className="peer">{peerLine(board, nurse, Boolean(load))}</div> : null}
      {detail ? (
        own ? (
          <div className="ft">
            <button type="button" className={board.help[nurse.id] ? 'sm warn' : 'sm'} onClick={() => requestHelp(nurse.id)}>
              {board.help[nurse.id] ? '지원 필요 해제' : '지원 필요'}
            </button>
            {load?.ev ? (
              <button type="button" className="sm" onClick={() => clearSurge(nurse.id)}>
                상황 종료
              </button>
            ) : null}
            {load && full ? (
              <button type="button" className="sm" onClick={() => setPriority(nurse.id)}>
                {nurse.prio ? '우선 대상 해제' : '우선 대상 지정'}
              </button>
            ) : null}
            <span className="grow" />
            {outgoing?.accepted ? (
              <button type="button" className="sm" onClick={() => finishSupport(nurse.id)}>
                지원 종료
              </button>
            ) : null}
          </div>
        ) : (
          <div className="ft">
            <span className="empty">지원 중인 간호사의 화면입니다. 대신 수행하면 수행자는 본인으로 기록됩니다.</span>
          </div>
        )
      ) : null}
    </article>
  )
}

function AlertPanel({ board }: { board: ArtifactState }) {
  const assignHelper = useBackupStore((state) => state.assignHelper)
  const assignCpr = useBackupStore((state) => state.assignCpr)
  const finishCprTeam = useBackupStore((state) => state.finishCprTeam)
  const addAplus = useBackupStore((state) => state.addAplus)
  const full = isFullView(board.view)
  const alerts = buildAlerts(board)
  const mine = board.supports.find((support) => support.from === board.view && activeSupport(support))
  return (
    <section className="box">
      <h2>
        지원 알림 <span>{full && alerts.length ? `${alerts.length}건` : ''}</span>
      </h2>
      {!full ? (
        mine ? (
          <div className="alert a1">
            <div>
              <span className="st">지원 중</span>, {findNurse(board, mine.to)?.name} 간호사 화면이 함께 표시됩니다. 대신 수행한 처방은 본인 수행으로 기록됩니다.
            </div>
          </div>
        ) : (
          <div className="empty">지원 알림은 근무조 리더간호사, 응급전문간호사 화면에 표시됩니다. 동료의 업무량 단계는 카드에서 확인하세요.</div>
        )
      ) : alerts.length === 0 ? (
        <div className="empty">현재 지원이 필요한 간호사가 없습니다.</div>
      ) : (
        alerts.map((alert) => {
          const label = alert.st === 'E' ? '긴급' : alert.st ? `${alert.st}단계` : '예측'
          const recommended = alert.nurse ? recommendNurse(board, alert.nurse) : undefined
          const teamOpen = Boolean(alert.cpr && board.cpr && board.cpr.phase === 0 && !board.supports.some((support) => support.cpr && !support.end))
          const teamLive = Boolean(alert.cpr && board.cpr && board.cpr.phase >= 1 && board.supports.some((support) => support.cpr && !support.end))
          const first = teamOpen ? recommendNurse(board, 'n6') : undefined
          const second = first ? recommendNurse(board, 'n6', [first.id]) : undefined
          return (
            <div className={`alert a${alert.st}`} key={`${alert.st}-${alert.nurse ?? alert.txt}`}>
              <div>
                <span className="st">{label}</span>, {alert.txt}
              </div>
              <div className="row">
                <span className="empty">{alert.act}</span>
                {teamOpen && first ? (
                  <button type="button" className="sm pri" onClick={() => assignCpr(first.id, second?.id ?? '')}>
                    CPR 팀 배정: {first.name}
                    {second ? `, ${second.name}` : ''}
                  </button>
                ) : null}
                {teamLive ? (
                  <button type="button" className="sm" onClick={finishCprTeam}>
                    CPR 팀 지원 종료
                  </button>
                ) : null}
                {alert.aplus ? (
                  <button type="button" className="sm pri" onClick={addAplus}>
                    A-plus팀 지원 요청
                  </button>
                ) : null}
                {recommended && alert.nurse ? (
                  <button type="button" className="sm pri" onClick={() => assignHelper(recommended.id, alert.nurse ?? '')}>
                    {recommended.name} 지원 배정
                  </button>
                ) : null}
              </div>
            </div>
          )
        })
      )}
    </section>
  )
}

function SupportLog({ board }: { board: ArtifactState }) {
  const supports = [...board.supports].reverse()
  return (
    <section className="box">
      <h2>
        지원 기록 <span>수행자 귀속</span>
      </h2>
      <table>
        <thead>
          <tr>
            <th>지원자</th>
            <th>대상</th>
            <th>시작</th>
            <th className="n">시간</th>
            <th className="n">수행</th>
          </tr>
        </thead>
        <tbody>
          {supports.length === 0 && board.decline.length === 0 ? (
            <tr>
              <td className="empty" colSpan={5}>
                아직 지원 기록이 없습니다.
              </td>
            </tr>
          ) : (
            <>
              {supports.map((support) => (
                <tr key={`${support.from}-${support.to}-${support.start}-${support.role ?? ''}`}>
                  <td>{findNurse(board, support.from)?.name}</td>
                  <td>
                    {findNurse(board, support.to)?.name}
                    {support.role ? ` (${support.role})` : ''}
                  </td>
                  <td>{formatClock(support.start)}</td>
                  <td className="n">{!support.accepted ? '수락 대기' : support.end ? `${support.end - support.start}분` : '진행 중'}</td>
                  <td className="n">{support.tasks}건</td>
                </tr>
              ))}
              {board.decline.map((item) => (
                <tr key={`${item.from}-${item.to}-${item.t}`}>
                  <td>{findNurse(board, item.from)?.name}</td>
                  <td>{findNurse(board, item.to)?.name}</td>
                  <td>{formatClock(item.t)}</td>
                  <td className="empty" colSpan={2}>
                    거절: {item.why}
                  </td>
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>
    </section>
  )
}

function StaffingBox({ board }: { board: ArtifactState }) {
  const capacity = capacityOf(board)
  const width = Math.min(100, (capacity.total / (capacity.limit * ARTIFACT.capacityTrackScale)) * 100)
  const mark = 100 / ARTIFACT.capacityTrackScale
  return (
    <section className="box">
      <h2>인력 적정성</h2>
      <div className="mrow">
        <span>근무조 업무량 / 인력 기준</span>
        <b>
          {capacity.total}분 / {capacity.limit}분
        </b>
      </div>
      <div className="track" aria-hidden="true">
        <i className={`s-${capacity.level}`} style={{ width: `${width}%` }} />
        <span className="tick" style={{ left: `${mark}%` }} />
      </div>
      <div className="mrow" style={{ marginTop: 6 }}>
        <span>
          환자 담당 {capacity.n}명 × {ARTIFACT.capacityPerAssignedNurse}분 (시연 기준)
        </span>
        <span className={`lvl l-${capacity.level}`}>{CAPACITY_LABEL[capacity.level]}</span>
      </div>
    </section>
  )
}

function ZoneBox({ board }: { board: ArtifactState }) {
  const rows = zoneTimeliness(board)
  return (
    <section className="box">
      <h2>
        처방 적시성 <span>현재 수행 대기 처방</span>
      </h2>
      <table>
        <thead>
          <tr>
            <th>구역</th>
            <th className="n">대기</th>
            <th className="n">최장</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.zone}>
              <td>{row.zone}</td>
              <td className="n">{row.pendingCount}건</td>
              <td className="n">{row.maxWaitMin}분</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function CatalogModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-back" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="backup-cat" onClick={(event) => event.stopPropagation()}>
        <h2 id="backup-cat">처방 분류</h2>
        <p className="empty">분류만 보여 줍니다. 표준 소요시간과 수행 기준시간은 이 표에 두지 않습니다.</p>
        <table>
          <thead>
            <tr>
              <th>처방</th>
              <th>분류</th>
            </tr>
          </thead>
          <tbody>
            {ORDER_CATALOG.map(([name, category]) => (
              <tr key={name}>
                <td>{name}</td>
                <td>{CATEGORY_LABEL[category]}</td>
              </tr>
            ))}
            <tr>
              <td>활력징후 측정</td>
              <td>처방 주기별</td>
            </tr>
            <tr>
              <td>간호요구 급증 ({SURGE_TYPES.join(', ')}, CPCR)</td>
              <td>즉시 높음</td>
            </tr>
          </tbody>
        </table>
        <button type="button" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}

function GuideModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-back" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="backup-guide" onClick={(event) => event.stopPropagation()}>
        <h2 id="backup-guide">기존 화면 안내</h2>
        <p className="empty">
          가상 데이터입니다. 카드의 현재 업무량은 관찰, 활력, 아직 수행하지 않은 처방 소요시간의 합이고, 단계 배지는 그 합계 기준입니다. 30분 미만은 여유, 30분 이상 50분 이하는 보통, 50분 초과는 높음입니다. 간호요구 급증이 있으면 높음입니다. 처방 행의 대기 분은 발생 후 경과시간입니다. 1시간 뒤 예측과 수행 기준 초과는 표시하지 않습니다. 이 화면의 시간은 1안, 2안과 따로 움직입니다.
        </p>
        <button type="button" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}

export function BackupApp() {
  const board = useBackupStore((state) => state.board)
  const [guide, setGuide] = useState(false)
  const [catalog, setCatalog] = useState(false)
  return (
    <div className="wrap backup">
      <BackupToolbar />
      <div className="main">
        <section className="cards" aria-label="간호사별 업무량">
          {board.nurses.map((nurse) => (
            <NurseArticle key={nurse.id} board={board} nurse={nurse} />
          ))}
        </section>
        <aside className="rail">
          <AlertPanel board={board} />
          <SupportLog board={board} />
          <StaffingBox board={board} />
          <ZoneBox board={board} />
        </aside>
      </div>
      <footer className="site-foot">
        <div className="site-line">
          <img src={amcLogo} alt="서울아산병원" />
          <strong>간호업무량 실시간 간호지원체계</strong>
          <span className="foot-sep" aria-hidden="true">|</span>
          <button type="button" className="text-link" onClick={() => setGuide(true)}>
            기존 화면 안내
          </button>
          <span className="foot-sep" aria-hidden="true">|</span>
          <button type="button" className="text-link" onClick={() => setCatalog(true)}>
            처방 분류
          </button>
          <span className="foot-sep" aria-hidden="true">|</span>
          <button type="button" className="text-link" onClick={() => go('/')}>
            1안
          </button>
          <span className="foot-sep" aria-hidden="true">|</span>
          <a className="text-link" href="https://claude.ai/artifact/Gpcsq5LYU16mRKxATNXdaR" target="_blank" rel="noopener noreferrer">
            Claude 시연화면
          </a>
        </div>
      </footer>
      {guide ? <GuideModal onClose={() => setGuide(false)} /> : null}
      {catalog ? <CatalogModal onClose={() => setCatalog(false)} /> : null}
      <Toast />
    </div>
  )
}
