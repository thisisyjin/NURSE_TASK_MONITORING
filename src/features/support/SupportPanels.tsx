import { ARTIFACT, CAPACITY_LABEL, CATEGORY_LABEL, ORDER_CATALOG, SURGE_TYPES } from '../../config/artifactConfig'
import { activeSupport, buildAlerts, capacityOf, findNurse, formatClock, isFullView, recommendNurse, zoneTimeliness } from '../../domain/artifact/rules'
import type { AlertItem } from '../../domain/artifact/types'
import { useDemoStore } from '../../store/demoStore'

function alertLabel(stage: AlertItem['st']): string {
  if (stage === 'E') return '긴급'
  if (stage === 0) return '예측'
  return `${stage}단계`
}

export function SupportAlertPanel() {
  const board = useDemoStore((state) => state.board)
  const assignHelper = useDemoStore((state) => state.assignHelper)
  const assignCpr = useDemoStore((state) => state.assignCpr)
  const finishCprTeam = useDemoStore((state) => state.finishCprTeam)
  const addAplus = useDemoStore((state) => state.addAplus)
  const full = isFullView(board.view)
  const alerts = buildAlerts(board)
  const mySupport = board.supports.find((support) => support.from === board.view && activeSupport(support))

  let body
  if (!full) {
    body = mySupport ? (
      <div className="alert a1">
        <div>
          <span className="st">지원 중</span>, {findNurse(board, mySupport.to)?.name} 간호사 화면이 함께 표시됩니다. 대신 수행한 처방은 본인 수행으로 기록됩니다.
        </div>
      </div>
    ) : (
      <div className="empty">지원 알림은 근무조 리더간호사, 응급전문간호사 화면에 표시됩니다. 동료의 업무량 단계는 카드에서 확인하세요.</div>
    )
  } else if (!alerts.length) {
    body = <div className="empty">현재 지원이 필요한 간호사가 없습니다.</div>
  } else {
    body = alerts.map((alert) => {
      let action = null
      if (alert.cpr && board.cpr && !board.supports.some((support) => support.cpr && !support.end) && board.cpr.phase === 0) {
        const first = recommendNurse(board, 'n6')
        const second = first ? recommendNurse(board, 'n6', [first.id]) : undefined
        action = first ? (
          <button type="button" className="sm pri" onClick={() => assignCpr(first.id, second?.id ?? '')}>
            CPR 팀 배정: {first.name}
            {second ? `, ${second.name}` : ''}
          </button>
        ) : null
      } else if (alert.cpr && board.cpr && board.cpr.phase >= 1 && board.supports.some((support) => support.cpr && !support.end)) {
        action = (
          <button type="button" className="sm" onClick={finishCprTeam}>
            CPR 팀 지원 종료
          </button>
        )
      } else if (alert.aplus) {
        action = (
          <button type="button" className="sm pri" onClick={addAplus}>
            A-plus팀 지원 요청
          </button>
        )
      } else if (alert.nurse) {
        const recommended = recommendNurse(board, alert.nurse)
        action = recommended ? (
          <button type="button" className="sm pri" onClick={() => assignHelper(recommended.id, alert.nurse ?? '')}>
            {recommended.name} 지원 배정
          </button>
        ) : null
      }
      return (
        <div className={`alert a${alert.st}`} key={`${alert.st}-${alert.txt}`}>
          <div>
            <span className="st">{alertLabel(alert.st)}</span>, {alert.txt}
          </div>
          <div className="row">
            <span className="empty">{alert.act}</span>
            {action}
          </div>
        </div>
      )
    })
  }

  return (
    <div className="box">
      <h2>
        지원 알림 <span>{alerts.length && full ? `${alerts.length}건` : ''}</span>
      </h2>
      <div>{body}</div>
    </div>
  )
}

export function SupportHistoryPanel() {
  const board = useDemoStore((state) => state.board)
  const hasRows = board.supports.length > 0 || board.decline.length > 0
  return (
    <div className="box">
      <h2>
        지원 기록 <span>수행자 기준 귀속</span>
      </h2>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>지원자</th>
              <th>대상 (역할)</th>
              <th>시작</th>
              <th className="n">시간</th>
              <th className="n">수행</th>
            </tr>
          </thead>
          <tbody>
            {!hasRows ? (
              <tr>
                <td className="empty" colSpan={5}>
                  아직 지원 기록이 없습니다.
                </td>
              </tr>
            ) : (
              <>
                {[...board.supports].reverse().map((support) => (
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
                  <tr key={`${item.from}-${item.to}-${item.t}-${item.why}`}>
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
      </div>
    </div>
  )
}

export function StaffingPanel() {
  const board = useDemoStore((state) => state.board)
  const capacity = capacityOf(board)
  const width = Math.min(100, (capacity.total / (capacity.limit * ARTIFACT.capacityTrackScale)) * 100)
  const tick = (capacity.limit / (capacity.limit * ARTIFACT.capacityTrackScale)) * 100
  return (
    <div className="box">
      <h2>
        인력 적정성 <span>근무조 업무량 대비</span>
      </h2>
      <div className="mrow">
        <span>근무조 업무량 / 인력 기준</span>
        <b>
          {capacity.total}분 / {capacity.limit}분
        </b>
      </div>
      <div className="track" aria-hidden="true">
        <i className={`s-${capacity.level}`} style={{ width: `${width}%` }} />
        <span className="tick" style={{ left: `${tick}%` }} />
      </div>
      <div className="mrow" style={{ marginTop: 6 }}>
        <span>
          환자 담당 {capacity.n}명 × {ARTIFACT.capacityPerAssignedNurse}분 (시연 기준)
        </span>
        <span className={`lvl l-${capacity.level}`}>{CAPACITY_LABEL[capacity.level]}</span>
      </div>
    </div>
  )
}

export function ZoneTimelinessPanel() {
  const board = useDemoStore((state) => state.board)
  const rows = zoneTimeliness(board)
  return (
    <div className="box">
      <h2>
        처방 적시성 <span>현재 수행 대기 처방</span>
      </h2>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>구역</th>
              <th className="n">대기</th>
              <th className="n">최장 대기</th>
              <th className="n">기준 초과</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.zone}>
                <td>{row.zone}</td>
                <td className="n">{row.pendingCount}건</td>
                <td className="n">{row.maxWaitMin}분</td>
                <td className="n" style={{ color: row.overdueCount ? 'var(--hi)' : 'inherit' }}>
                  {row.overdueCount}건
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function OrderCatalogPanel() {
  return (
    <div className="box">
      <h2>
        처방 분류 기준 <span>표준 소요시간 초기값</span>
      </h2>
      <div className="scroll">
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
              <td className="n">–</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
