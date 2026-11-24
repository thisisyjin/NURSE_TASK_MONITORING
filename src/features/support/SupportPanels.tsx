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
import type { ArtifactState, ArtifactSupport } from '../../domain/artifact/types'
import { useDemoStore } from '../../store/demoStore'
import { NurseName } from '../ui/NurseName'
import { PrettySelect } from '../ui/PrettySelect'

type NeedItem = { id: string; label: string }

function supportNeeds(board: ArtifactState): NeedItem[] {
  const alerts = buildAlerts(board).filter((alert) => alert.nurse && (alert.st === 1 || alert.st === 2))
  const items: NeedItem[] = alerts.map((alert) => ({
    id: alert.nurse ?? '',
    label: alert.st === 2 ? '2단계' : '1단계',
  }))
  for (const support of board.supports) {
    if (support.end || support.cpr || items.some((item) => item.id === support.to)) continue
    items.push({ id: support.to, label: support.accepted ? '지원 진행' : '응답 대기' })
  }
  return items
}

function withSubject(name: string) {
  const code = name.charCodeAt(name.length - 1)
  const batchim = code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 !== 0 : false
  return `${name}${batchim ? '이' : '가'}`
}

function supportSpan(support: ArtifactSupport) {
  if (!support.accepted) return '수락 대기'
  if (support.end == null) return '진행 중'
  return `${support.end - support.start}분`
}

function supportLog(board: ArtifactState) {
  const supports = board.supports.map((support) => ({
    key: `s-${support.from}-${support.to}-${support.start}-${support.role ?? ''}`,
    at: support.start,
    from: findNurse(board, support.from)?.name ?? support.from,
    target: `${findNurse(board, support.to)?.name ?? support.to}${support.role ? ` (${support.role})` : ''}`,
    span: supportSpan(support),
    tasks: `${support.tasks}건`,
    decline: false,
  }))
  const declines = board.decline.map((item) => ({
    key: `d-${item.from}-${item.to}-${item.t}`,
    at: item.t,
    from: findNurse(board, item.from)?.name ?? item.from,
    target: findNurse(board, item.to)?.name ?? item.to,
    span: `거절: ${item.why}`,
    tasks: '',
    decline: true,
  }))
  return [...supports, ...declines].sort((a, b) => b.at - a.at)
}

function MatchDetail({ board, targetId }: { board: ArtifactState; targetId: string }) {
  const assignHelper = useDemoStore((state) => state.assignHelper)
  const setView = useDemoStore((state) => state.setView)
  const finishSupport = useDemoStore((state) => state.finishSupport)
  const target = findNurse(board, targetId)
  const helpers = eligibleHelpers(board, targetId)
  const recommended = recommendNurse(board, targetId)
  const recommendationKey = `${targetId}:${recommended?.id ?? ''}`
  const [chosen, setChosen] = useState(recommended?.id ?? '')
  const [boundKey, setBoundKey] = useState(recommendationKey)
  if (boundKey !== recommendationKey) {
    setBoundKey(recommendationKey)
    setChosen(recommended?.id ?? '')
  }
  const waiting = board.supports.find((support) => support.to === targetId && !support.end && !support.accepted && !support.cpr)
  const active = board.supports.find((support) => support.to === targetId && activeSupport(support) && !support.cpr)
  const pickedHelper = helpers.find((nurse) => nurse.id === chosen) ?? recommended
  const partnerId = waiting?.from ?? active?.from ?? pickedHelper?.id ?? ''
  const partner = findNurse(board, partnerId)
  const partnerLevel = partner ? levelOf(board, partner) : null
  const partnerLoad = partner ? (loadOf(board, partner)?.now ?? 0) : 0
  const targetLevel = target ? levelOf(board, target) : 'ok'
  const targetLoad = target ? (loadOf(board, target)?.now ?? 0) : 0
  const latestDecline = [...board.decline].reverse().find((item) => item.to === targetId)
  const partnerTitle = waiting || active ? '배정된 간호사' : partner?.id && partner.id === recommended?.id ? '추천 1순위' : '선택한 후보'

  if (!target) return null
  return (
    <div className="match-detail">
      <div className="pair">
        <div className="who">
          <span className="who-kicker">지원 대상</span>
          <div className="who-name">
            <strong>{target.name}</strong>
            <span className={`lvl l-${targetLevel}`}>{LEVEL_LABEL[targetLevel]}</span>
          </div>
          <b className="who-min">{targetLoad}분</b>
        </div>
        <div className="pair-arrow" aria-hidden="true">
          <span>←</span>
        </div>
        <div className="who">
          <span className="who-kicker">{partnerTitle}</span>
          <div className="who-name">
            <strong>
              <NurseName name={partner?.name ?? '없음'} />
            </strong>
            {partnerLevel ? <span className={`lvl l-${partnerLevel}`}>{LEVEL_LABEL[partnerLevel]}</span> : null}
          </div>
          <b className="who-min">{partnerLevel ? `${partnerLoad}분` : '후보 없음'}</b>
        </div>
      </div>
      {waiting ? (
        <p className="match-note">
          {findNurse(board, waiting.from)?.name}에게 요청했습니다.
        </p>
      ) : null}
      {active ? <p className="match-note">지원 진행 중, 수행 {active.tasks}건. 수락 후 업무량 감산이 적용됐습니다.</p> : null}
      {!waiting && !active && latestDecline ? (
        <p className="decline-toast" role="status">
          {withSubject(findNurse(board, latestDecline.from)?.name ?? '간호사')} 거절했습니다. 사유는 {latestDecline.why}이고, 다음 후보를 추천합니다.
        </p>
      ) : null}
      {!waiting && !active && helpers.length > 0 ? (
        <PrettySelect
          label="다른 후보"
          value={partner?.id ?? ''}
          onChange={setChosen}
          options={helpers.map((nurse) => ({
            value: nurse.id,
            label: nurse.name,
            hint: `${LEVEL_LABEL[levelOf(board, nurse)]} ${loadOf(board, nurse)?.now ?? 0}분`,
            mark: nurse.id === recommended?.id ? '추천' : undefined,
          }))}
        />
      ) : null}
      {waiting ? (
        <button type="button" className="pri v3-cta" onClick={() => setView(waiting.from)}>
          {findNurse(board, waiting.from)?.name} 화면에서 응답
        </button>
      ) : null}
      {active ? (
        <button type="button" className="v3-cta" onClick={() => finishSupport(active.from)}>
          지원 종료
        </button>
      ) : null}
      {!waiting && !active && partner ? (
        <button type="button" className="pri v3-cta" onClick={() => assignHelper(partner.id, target.id)}>
          {partner.name}에게 지원 요청
        </button>
      ) : null}
      {!waiting && !active && !partner ? <p className="empty">지금 배정 가능한 지원자가 없습니다.</p> : null}
    </div>
  )
}

function CprMatch() {
  const board = useDemoStore((state) => state.board)
  const assignCpr = useDemoStore((state) => state.assignCpr)
  const finishCprTeam = useDemoStore((state) => state.finishCprTeam)
  const target = findNurse(board, 'n6')
  const targetLevel = target ? levelOf(board, target) : 'hi'
  const targetLoad = target ? (loadOf(board, target)?.now ?? 0) : 0
  const teamReady = Boolean(board.cpr && board.cpr.phase === 0 && !board.supports.some((support) => support.cpr && !support.end))
  const teamLive = Boolean(board.cpr && board.cpr.phase >= 1 && board.supports.some((support) => support.cpr && activeSupport(support)))
  const first = recommendNurse(board, 'n6')
  const second = first ? recommendNurse(board, 'n6', [first.id]) : undefined
  const assigned = board.supports.filter((support) => support.cpr && !support.end).map((support) => findNurse(board, support.from)?.name ?? support.from)
  const names = teamLive ? assigned.join(', ') : [first?.name, second?.name].filter(Boolean).join(', ')

  return (
    <div className="match-detail">
      <div className="pair">
        <div className="who">
          <span className="who-kicker">지원 대상</span>
          <div className="who-name">
            <strong>{target?.name ?? '한지호'}</strong>
            <span className={`lvl l-${targetLevel}`}>{LEVEL_LABEL[targetLevel]}</span>
          </div>
          <b className="who-min">{targetLoad}분</b>
        </div>
        <div className="pair-arrow" aria-hidden="true">
          <span>←</span>
        </div>
        <div className="who">
          <span className="who-kicker">{teamLive ? '배정된 팀' : '추천 1순위'}</span>
          <strong className="who-team">{names || '없음'}</strong>
          <span className="team-label">{teamLive ? '진행 중' : '팀 배정'}</span>
        </div>
      </div>
      {teamReady && first ? (
        <button type="button" className="pri v3-cta" onClick={() => assignCpr(first.id, second?.id ?? '')}>
          팀 지원 요청
        </button>
      ) : null}
      {teamLive ? (
        <button type="button" className="v3-cta" onClick={finishCprTeam}>
          팀 종료
        </button>
      ) : null}
      {teamReady && !first ? <p className="empty">배정할 간호사가 없습니다.</p> : null}
    </div>
  )
}

export function IncomingRequestBanner() {
  const board = useDemoStore((state) => state.board)
  const acceptAssignment = useDemoStore((state) => state.acceptAssignment)
  const declineAssignment = useDemoStore((state) => state.declineAssignment)
  const finishSupport = useDemoStore((state) => state.finishSupport)
  if (isFullView(board.view)) return null
  const mine = supportFrom(board, board.view)
  if (!mine) return null
  const target = findNurse(board, mine.to)
  if (!mine.accepted) {
    return (
      <section className="request-banner" aria-label="받은 지원 요청">
        <div>
          <b>{target?.name} 지원 요청</b>
          <span>{formatClock(mine.start)} 배정. 수락하면 지원이 시작됩니다.</span>
        </div>
        <div className="row">
          <button type="button" className="pri" onClick={() => acceptAssignment(board.view)}>
            수락
          </button>
          {DECLINE_REASONS.map((reason) => (
            <button type="button" key={reason} onClick={() => declineAssignment(board.view, reason)}>
              거절: {reason}
            </button>
          ))}
        </div>
      </section>
    )
  }
  return (
    <section className="request-banner is-live" aria-label="지원 진행">
      <div>
        <b>{target?.name} 지원 중</b>
        <span>수행 {mine.tasks}건. 대신 수행하면 본인 수행으로 기록됩니다.</span>
      </div>
      <button type="button" onClick={() => finishSupport(board.view)}>
        지원 종료
      </button>
    </section>
  )
}

export function SupportAlertPanel() {
  const board = useDemoStore((state) => state.board)
  const full = isFullView(board.view)
  const needs = supportNeeds(board)
  const [picked, setPicked] = useState<string | null>(null)
  const cprOpen = Boolean(board.cpr && !board.cpr.closed)
  const activeId = picked === 'cpr' && cprOpen ? 'cpr' : needs.some((item) => item.id === picked) ? picked : (needs[0]?.id ?? null)
  const cprNurse = findNurse(board, 'n6')
  const cprMinutes = cprNurse ? (loadOf(board, cprNurse)?.now ?? 0) : 0
  const cprLevel = cprNurse ? levelOf(board, cprNurse) : 'hi'
  const teamLive = Boolean(board.cpr && board.cpr.phase >= 1 && board.supports.some((support) => support.cpr && activeSupport(support)))

  return (
    <section className="box" aria-label="지원 매칭 및 배정">
      <h2>
        지원 매칭 및 배정 <span>지원 필요 {needs.length}건</span>
      </h2>
      {!full ? (
        <p className="match-note">지원 배정은 근무조 리더 화면에서 합니다. 받은 요청은 위 알림에서 응답합니다.</p>
      ) : null}
      {full ? (
        <>
          {needs.length === 0 && !cprOpen ? <p className="empty">지금 지원이 필요한 간호사가 없습니다.</p> : null}
          {needs.length > 0 || cprOpen ? (
            <table className="need-table">
              <thead>
                <tr>
                  <th>간호사</th>
                  <th>단계</th>
                  <th className="n">업무량</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {needs.map((item) => {
                  const nurse = findNurse(board, item.id)
                  const level = nurse ? levelOf(board, nurse) : 'ok'
                  const minutes = nurse ? (loadOf(board, nurse)?.now ?? 0) : 0
                  return (
                    <tr
                      key={item.id}
                      className={item.id === activeId ? 'is-pick is-on' : 'is-pick'}
                      onClick={() => setPicked(item.id)}
                    >
                      <td>{nurse?.name}</td>
                      <td>
                        <span className={`lvl l-${level}`}>{LEVEL_LABEL[level]}</span>
                      </td>
                      <td className="n">{minutes}분</td>
                      <td>{item.label}</td>
                    </tr>
                  )
                })}
                {cprOpen ? (
                  <tr className={activeId === 'cpr' ? 'is-pick is-on' : 'is-pick'} onClick={() => setPicked('cpr')}>
                    <td>
                      <span className="cpr-name">
                        {cprNurse?.name ?? '한지호'}
                        <span className="cpr-badge">CPR</span>
                      </span>
                    </td>
                    <td>
                      <span className={`lvl l-${cprLevel}`}>{LEVEL_LABEL[cprLevel]}</span>
                    </td>
                    <td className="n">{cprMinutes}분</td>
                    <td>{teamLive ? '진행 중' : '긴급'}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          ) : null}
          {activeId === 'cpr' ? <CprMatch /> : activeId ? <MatchDetail board={board} targetId={activeId} /> : null}
        </>
      ) : null}
    </section>
  )
}

function SupportLogTable({ rows }: { rows: ReturnType<typeof supportLog> }) {
  return (
    <table className="need-table log-table">
      <thead>
        <tr>
          <th>지원자</th>
          <th>대상 (역할)</th>
          <th className="n">시작</th>
          <th className="n">시간</th>
          <th className="n">수행</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td>{row.from}</td>
            <td>{row.target}</td>
            <td className="n">{formatClock(row.at)}</td>
            {row.decline ? (
              <td className="n" colSpan={2}>
                {row.span}
              </td>
            ) : (
              <>
                <td className="n">{row.span}</td>
                <td className="n">{row.tasks}</td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function SupportHistoryPanel() {
  const board = useDemoStore((state) => state.board)
  const [open, setOpen] = useState(false)
  const rows = supportLog(board)
  const recent = rows.slice(0, 3)
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
        최근 지원
        <button type="button" className="log-all" onClick={() => setOpen(true)}>
          전체 지원 기록
        </button>
      </h2>
      {recent.length === 0 ? <p className="empty log-empty">아직 지원 활동이 없습니다.</p> : <SupportLogTable rows={recent} />}
      {open ? (
        <div className="modal-back" role="presentation" onClick={() => setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="log-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="log-title">전체 지원 기록</h2>
            {rows.length === 0 ? (
              <p className="empty">기록이 없습니다. 새로고침하면 이번 시연의 기록은 사라집니다.</p>
            ) : (
              <SupportLogTable rows={rows} />
            )}
            <button type="button" className="modal-close" onClick={() => setOpen(false)}>
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
  const addAplus = useDemoStore((state) => state.addAplus)
  const capacity = capacityOf(board)
  const width = Math.min(100, (capacity.total / (capacity.limit * ARTIFACT.capacityTrackScale)) * 100)
  const capacityAlert = buildAlerts(board).find((alert) => alert.st === 3 || alert.st === 4)
  const requestText =
    capacityAlert?.st === 4 ? 'A-Plus 팀 지원 요청을 검토합니다.' : '간호관리자에게 추가 인력을 요청합니다.'
  return (
    <section className="box">
      <h2>
        인력 적정성 <span className={`lvl l-${capacity.level}`}>{CAPACITY_LABEL[capacity.level]}</span>
      </h2>
      <div className="mrow">
        <span>근무조 업무량 / 인력 기준</span>
        <b>
          {capacity.total}분 / {capacity.limit}분
        </b>
      </div>
      <div className="track" aria-hidden="true">
        <i className={`s-${capacity.level}`} style={{ width: `${width}%` }} />
        <span className="tick" style={{ left: `${100 / ARTIFACT.capacityTrackScale}%` }} />
      </div>
      {capacityAlert ? (
        <div className="staff-request">
          <div>
            <span className="lvl l-hi">{capacityAlert.st}단계</span>
            <p>{requestText}</p>
          </div>
          {capacityAlert.aplus ? (
            <button type="button" className="sm pri" onClick={addAplus}>
              지원 요청
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

export function ZoneTimelinessPanel() {
  const board = useDemoStore((state) => state.board)
  const rows = zoneTimeliness(board)
  return (
    <section className="box">
      <h2>구역별 대기</h2>
      <div className="scroll">
        <table className="zone-table">
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
        <button type="button" className="modal-close" onClick={onClose}>
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
        <button type="button" className="modal-close" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}
