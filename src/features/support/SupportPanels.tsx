import { useEffect, useState } from 'react'
import { ARTIFACT, CAPACITY_LABEL, CATEGORY_LABEL, DECLINE_REASONS, LEVEL_LABEL, ORDER_CATALOG, SURGE_TYPES } from '../../config/artifactConfig'
import {
  activeSupport,
  buildAlerts,
  capacityOf,
  eligibleHelpers,
  findNurse,
  formatClock,
  isFullView,
  levelOf,
  loadOf,
  recommendNurse,
  supportFrom,
  zoneTimeliness,
} from '../../domain/artifact/rules'
import type { AlertItem, ArtifactState } from '../../domain/artifact/types'
import { useDemoStore } from '../../store/demoStore'

function RecommendationCard({ board, alert }: { board: ArtifactState; alert: AlertItem }) {
  const assignHelper = useDemoStore((state) => state.assignHelper)
  const setView = useDemoStore((state) => state.setView)
  const targetId = alert.nurse ?? ''
  const target = findNurse(board, targetId)
  const helpers = eligibleHelpers(board, targetId)
  const recommended = recommendNurse(board, targetId)
  const [chosen, setChosen] = useState(recommended?.id ?? '')
  useEffect(() => {
    setChosen(recommended?.id ?? '')
  }, [recommended?.id, targetId])
  const waiting = board.supports.find((support) => support.to === targetId && !support.end && !support.accepted)
  const chosenNurse = helpers.find((nurse) => nurse.id === chosen) ?? recommended
  const chosenLoad = chosenNurse ? loadOf(board, chosenNurse) : null
  const chosenLevel = chosenNurse ? levelOf(board, chosenNurse) : null

  if (!target) return null
  return (
    <article className="rec-card">
      <div className="rec-kicker">{alert.st === 2 ? '2단계 지원' : '1단계 지원'}</div>
      <h3>
        {target.name} <span>업무 단계: {LEVEL_LABEL[levelOf(board, target)]}</span>
      </h3>
      <p>지원이 필요한 간호사</p>
      {waiting ? (
        <div className="rec-wait">
          <b>응답 대기</b>
          <span>
            {findNurse(board, waiting.from)?.name}에게 배정 요청 ({formatClock(waiting.start)}). 수락 전에는 업무량을 줄이지 않습니다.
          </span>
          <button type="button" className="sm" onClick={() => setView(waiting.from)}>
            {findNurse(board, waiting.from)?.name} 화면에서 응답
          </button>
        </div>
      ) : chosenNurse && chosenLevel ? (
        <>
          <div className="rec-pick">
            <span>업무량 기반 추천 1순위</span>
            <strong>{chosenNurse.name}</strong>
            <ul>
              <li>현재 단계: {LEVEL_LABEL[chosenLevel]}</li>
              <li>담당 업무량 {chosenLoad?.now ?? 0}분</li>
              <li>현재 다른 지원 없음</li>
            </ul>
          </div>
          <label className="rec-select">
            다른 지원자 지정
            <select value={chosen} onChange={(event) => setChosen(event.target.value)}>
              {helpers.map((nurse) => (
                <option key={nurse.id} value={nurse.id}>
                  {nurse.name} ({LEVEL_LABEL[levelOf(board, nurse)]}, {loadOf(board, nurse)?.now ?? 0}분)
                  {nurse.id === recommended?.id ? ' 추천' : ''}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="pri rec-assign" onClick={() => assignHelper(chosenNurse.id, target.id)}>
            배정 요청: {chosenNurse.name}
          </button>
        </>
      ) : (
        <p className="empty">지금 배정 가능한 지원자가 없습니다.</p>
      )}
    </article>
  )
}

function NurseResponse({ board }: { board: ArtifactState }) {
  const acceptAssignment = useDemoStore((state) => state.acceptAssignment)
  const declineAssignment = useDemoStore((state) => state.declineAssignment)
  const finishSupport = useDemoStore((state) => state.finishSupport)
  const mine = supportFrom(board, board.view)
  if (!mine) {
    return <p className="empty">지원 요청은 근무조 리더 화면에 표시됩니다. 동료는 업무 단계와 담당 업무량만 보입니다.</p>
  }
  const target = findNurse(board, mine.to)
  if (!mine.accepted) {
    return (
      <article className="rec-card rec-respond">
        <div className="rec-kicker">응답 대기</div>
        <h3>{target?.name} 지원 요청</h3>
        <p>{formatClock(mine.start)}에 배정되었습니다. 수락하면 지원이 시작됩니다.</p>
        <div className="row">
          <button type="button" className="pri" onClick={() => acceptAssignment(board.view)}>
            수락
          </button>
          {DECLINE_REASONS.map((reason) => (
            <button type="button" className="sm" key={reason} onClick={() => declineAssignment(board.view, reason)}>
              거절: {reason}
            </button>
          ))}
        </div>
      </article>
    )
  }
  return (
    <article className="rec-card">
      <div className="rec-kicker">지원 중</div>
      <h3>{target?.name} 지원 중</h3>
      <p>대신 수행한 처방은 본인 수행으로 기록됩니다. 수행 {mine.tasks}건.</p>
      <button type="button" className="sm" onClick={() => finishSupport(board.view)}>
        지원 종료
      </button>
    </article>
  )
}

export function SupportAlertPanel() {
  const board = useDemoStore((state) => state.board)
  const assignCpr = useDemoStore((state) => state.assignCpr)
  const finishCprTeam = useDemoStore((state) => state.finishCprTeam)
  const addAplus = useDemoStore((state) => state.addAplus)
  const full = isFullView(board.view)
  const alerts = buildAlerts(board)
  const supportAlerts = alerts.filter((alert) => alert.nurse && (alert.st === 1 || alert.st === 2))
  const otherAlerts = alerts.filter((alert) => !supportAlerts.includes(alert))

  return (
    <section className="box hero" aria-label="지원 필요 및 간호사 추천">
      <h2>
        지원 간호사 추천 <span>{full && supportAlerts.length ? `${supportAlerts.length}건` : '업무량 기반 추천'}</span>
      </h2>
      {!full ? <NurseResponse board={board} /> : null}
      {full && supportAlerts.length === 0 ? <p className="empty">지금 지원이 필요한 간호사가 없습니다.</p> : null}
      {full
        ? supportAlerts.map((alert) => <RecommendationCard key={`${alert.nurse}-${alert.st}`} board={board} alert={alert} />)
        : null}
      {full && otherAlerts.length ? (
        <div className="other-alerts">
          {otherAlerts.map((alert) => (
            <div className={`alert a${alert.st}`} key={`${alert.st}-${alert.txt}`}>
              <div>
                <span className="st">{alert.st === 'E' ? '긴급' : alert.st === 3 ? '인력' : `${alert.st}단계`}</span> {alert.txt}
              </div>
              <div className="row">
                {alert.cpr && board.cpr && board.cpr.phase === 0 && !board.supports.some((support) => support.cpr && !support.end) ? (
                  <CprButton onAssign={assignCpr} />
                ) : null}
                {alert.cpr && board.cpr && board.cpr.phase >= 1 && board.supports.some((support) => support.cpr && activeSupport(support)) ? (
                  <button type="button" className="sm" onClick={finishCprTeam}>
                    CPR 팀 지원 종료
                  </button>
                ) : null}
                {alert.aplus ? (
                  <button type="button" className="sm pri" onClick={addAplus}>
                    A-plus팀 지원 요청
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function CprButton({ onAssign }: { onAssign: (firstId: string, secondId: string) => void }) {
  const board = useDemoStore((state) => state.board)
  const first = recommendNurse(board, 'n6')
  const second = first ? recommendNurse(board, 'n6', [first.id]) : undefined
  if (!first) return <span className="empty">CPR 팀에 배정할 수 있는 간호사가 없습니다.</span>
  return (
    <button type="button" className="sm pri" onClick={() => onAssign(first.id, second?.id ?? '')}>
      CPR 팀 배정: {first.name}
      {second ? `, ${second.name}` : ''}
    </button>
  )
}

export function SupportHistoryPanel() {
  const activity = useDemoStore((state) => state.board.activity)
  const [open, setOpen] = useState(false)
  const recent = [...activity].reverse().slice(0, 5)
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <section className="box">
      <h2>
        최근 지원 활동 <span>이번 시연</span>
      </h2>
      {recent.length === 0 ? (
        <p className="empty">아직 지원 활동이 없습니다.</p>
      ) : (
        <ol className="activity">
          {recent.map((item) => (
            <li key={item.id}>
              <b>{formatClock(item.t)}</b> {item.text}
            </li>
          ))}
        </ol>
      )}
      <button type="button" className="text-link" onClick={() => setOpen(true)}>
        전체 지원 기록
      </button>
      {open ? (
        <div className="modal-back" role="presentation" onClick={() => setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="log-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="log-title">전체 지원 기록</h2>
            {activity.length === 0 ? (
              <p className="empty">기록이 없습니다. 새로고침하면 이번 시연의 기록은 사라집니다.</p>
            ) : (
              <ol className="activity">
                {activity.map((item) => (
                  <li key={item.id}>
                    <b>{formatClock(item.t)}</b> {item.text}
                  </li>
                ))}
              </ol>
            )}
            <button type="button" className="sm" onClick={() => setOpen(false)}>
              닫기
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export function StaffingPanel() {
  const board = useDemoStore((state) => state.board)
  const capacity = capacityOf(board)
  return (
    <section className="box compact">
      <h2>
        인력 적정성 <span>시연 기준</span>
      </h2>
      <div className="mrow">
        <span>근무조 업무량 / 인력 기준</span>
        <b>
          {capacity.total}분 / {capacity.limit}분
        </b>
      </div>
      <div className="mrow">
        <span>
          환자 담당 {capacity.n}명 × {ARTIFACT.capacityPerAssignedNurse}분
        </span>
        <span className={`lvl l-${capacity.level}`}>{CAPACITY_LABEL[capacity.level]}</span>
      </div>
    </section>
  )
}

export function ZoneTimelinessPanel() {
  const board = useDemoStore((state) => state.board)
  const rows = zoneTimeliness(board)
  return (
    <section className="box compact">
      <h2>
        구역별 처방 대기 현황 <span>확인중 제외</span>
      </h2>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>구역</th>
              <th className="n">대기</th>
              <th className="n">최장</th>
              <th className="n">확인중</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.zone}>
                <td>{row.zone}</td>
                <td className="n">{row.pendingCount}건</td>
                <td className="n">{row.maxWaitMin}분</td>
                <td className="n">{row.acknowledgedCount}건</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function OrderCatalogModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-back" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="cat-title" onClick={(event) => event.stopPropagation()}>
        <h2 id="cat-title">처방 분류 기준</h2>
        <p className="empty">표준 소요시간은 담당 업무량 계산에 쓰입니다. 화면의 대기 분은 처방 후 경과시간입니다.</p>
        <table>
          <thead>
            <tr>
              <th>처방</th>
              <th>분류</th>
              <th className="n">분</th>
            </tr>
          </thead>
          <tbody>
            {ORDER_CATALOG.map(([name, category, minutes]) => (
              <tr key={name}>
                <td>{name}</td>
                <td className={`cat-${category.toLowerCase()}`}>{CATEGORY_LABEL[category]}</td>
                <td className="n">{minutes}</td>
              </tr>
            ))}
            <tr>
              <td>활력징후 측정</td>
              <td>처방 주기별</td>
              <td className="n">회당 {ARTIFACT.vitalMinutesPerCheck}</td>
            </tr>
            <tr>
              <td>간호요구 급증 ({SURGE_TYPES.join(', ')}, CPCR)</td>
              <td className="cat-h">즉시 높음</td>
              <td className="n">-</td>
            </tr>
          </tbody>
        </table>
        <button type="button" className="sm" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}

export function GuideModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-back" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={(event) => event.stopPropagation()}>
        <h2 id="guide-title">시연 기준 안내</h2>
        <p>
          가상 데이터이며 실제 환자, 직원 정보는 없습니다. 담당 업무량은 관찰 부하, 활력 측정 시간, 아직 수행하지 않은 처방의 표준 소요시간
          합계입니다. 확인중 처방도 수행 전에는 이 합계에 남고, 수행 대기 건수와 최장 대기에서는 빠집니다. 화면의 대기 분은 처방 발생 후
          경과시간입니다.
        </p>
        <p>
          업무 단계는 30분 미만 여유, 30분 이상 50분 이하 보통, 50분 초과 높음입니다. 간호요구 급증이 있으면 업무량과 관계없이 높음입니다.
          지원 추천은 규칙으로 고릅니다. 여유를 먼저 보고, 같으면 담당 업무량이 적은 순입니다. 인공지능 모델이 연결된 상태는 아닙니다.
        </p>
        <p>
          인력 기준은 이 시연에서 담당 환자가 있는 간호사 1명당 50분입니다. 환자 1명당 50분 적용은 아직 협의 중입니다. 수락 전에는 업무량을
          줄이지 않고, 수락 후에만 지원 감산을 적용합니다. 기록은 브라우저 메모리에만 있어 새로고침하면 사라집니다.
        </p>
        <button type="button" className="sm" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}
