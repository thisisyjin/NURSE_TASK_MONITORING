import { ARTIFACT, DECLINE_REASONS, LEVEL_LABEL } from '../../config/artifactConfig'
import {
  activeSupport,
  findNurse,
  formatClock,
  isFullView,
  levelOf,
  loadOf,
  minutesLevel,
  newsBandLabel,
  newsRaised,
  supportFrom,
  vitalLabel,
} from '../../domain/artifact/rules'
import type { ArtifactNurse, ArtifactPatient, ArtifactState } from '../../domain/artifact/types'
import { OrderRow } from '../orders/OrderRow'
import { useDemoStore } from '../../store/demoStore'

function roleLine(nurse: ArtifactNurse, hasLoad: boolean): string {
  if (hasLoad) return `${nurse.role}, 환자 ${nurse.patients.length}명`
  if (nurse.coverBy) return `${nurse.role}, 환자 A-plus 지원간호사에게 임시 인계`
  if (nurse.role === '소생실') return '소생실, 대기 (환자 없음)'
  return `${nurse.role}, 역할 기본 단계`
}

function newsText(patient: ArtifactPatient): string {
  if (patient.cpr && patient.news == null) return 'CPR 중'
  const raised = newsRaised(patient)
  if (!raised || patient.news == null || patient.newsPrev == null) return String(patient.news ?? '')
  return `${patient.news} ↑ (${newsBandLabel(patient.newsPrev)} → ${newsBandLabel(patient.news)})`
}

function PatientBlock({ nurse, patient, board }: { nurse: ArtifactNurse; patient: ArtifactPatient; board: ArtifactState }) {
  const performOrder = useDemoStore((state) => state.performOrder)
  const full = isFullView(board.view)
  const helpers = board.supports.filter((support) => support.to === nurse.id && activeSupport(support)).map((support) => ({
    from: support.from,
    name: findNurse(board, support.from)?.name ?? support.from,
    show: full || board.view === support.from,
  }))
  return (
    <div className="pt">
      <div className="pth">
        <b>
          {patient.id} {patient.nm} <span className="ktas">KTAS {patient.ktas}</span>
        </b>
        <span>
          활력 {vitalLabel(patient.vs)}, NEWS{' '}
          <span className={patient.cpr && patient.news == null ? 'cpr' : newsRaised(patient) ? 'news-up' : undefined}>{newsText(patient)}</span>
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
      {patient.orders.map((order) => (
        <OrderRow
          key={order.id}
          nurse={nurse}
          patientId={patient.id}
          order={order}
          nowMin={board.t}
          showOwnerButton={full || board.view === nurse.id}
          helpers={helpers}
          onPerform={performOrder}
        />
      ))}
      {patient.sched
        .filter(([, at]) => at - board.t <= ARTIFACT.forecastWindowMin)
        .map(([name, at]) => (
          <div className="ord" key={`${name}-${at}`}>
            <span>
              예정: {name} <span className="w">{formatClock(at)}</span>
            </span>
          </div>
        ))}
    </div>
  )
}

export function NurseCard({ nurse }: { nurse: ArtifactNurse }) {
  const board = useDemoStore((state) => state.board)
  const requestHelp = useDemoStore((state) => state.requestHelp)
  const setPriority = useDemoStore((state) => state.setPriority)
  const clearSurge = useDemoStore((state) => state.clearSurge)
  const finishSupport = useDemoStore((state) => state.finishSupport)
  const acceptAssignment = useDemoStore((state) => state.acceptAssignment)
  const declineAssignment = useDemoStore((state) => state.declineAssignment)
  const setView = useDemoStore((state) => state.setView)

  const full = isFullView(board.view)
  const mySupport = !full ? board.supports.find((support) => support.from === board.view && activeSupport(support)) : undefined
  const detail = full || board.view === nurse.id || mySupport?.to === nurse.id
  const load = loadOf(board, nurse)
  const level = levelOf(board, nurse)
  const help = Boolean(board.help[nurse.id])
  const outgoing = supportFrom(board, nurse.id)
  const pct = (value: number) => Math.min(100, (value / ARTIFACT.meterScaleMin) * 100)

  const flags = (
    <div className="flags">
      {nurse.prio && full ? <span className="chip ac">지원 우선 대상</span> : null}
      {load?.ev ? (
        <span className="chip hi">
          '높음' 사유: {load.ev.type}, {load.ev.pid}
        </span>
      ) : null}
      {help ? <span className="chip hi">지원 필요 표시</span> : null}
      {load?.sups.map((support) => (
        <span className="chip ac" key={`${support.from}-${support.start}`}>
          {findNurse(board, support.from)?.name} 지원 중{support.role ? ` (${support.role})` : ''}
        </span>
      ))}
      {outgoing ? (
        <span className="chip ac">
          {findNurse(board, outgoing.to)?.name} {outgoing.accepted ? '지원 중' : '지원 배정, 수락 대기'}
        </span>
      ) : null}
      {detail && load && load.late ? <span className="chip hi">수행 기준 초과 {load.late}건</span> : null}
    </div>
  )

  const request =
    outgoing && !outgoing.accepted && (board.view === nurse.id || full) ? (
      <div className="req">
        <div>
          <b>지원 배정 알림</b>, {findNurse(board, outgoing.to)?.name}({findNurse(board, outgoing.to)?.role}) 지원 요청 ({formatClock(outgoing.start)})
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
    ) : null

  const head = (
    <>
      <div className={`stripe s-${level}`} />
      <div className="hd">
        <div>
          <div className="name">{nurse.name}</div>
          <div className="role">{roleLine(nurse, Boolean(load))}</div>
        </div>
        <span className={`lvl l-${level}`}>{LEVEL_LABEL[level]}</span>
      </div>
    </>
  )

  if (!detail) {
    const peer = load
      ? '동료 화면에는 업무량 단계만 표시됩니다.'
      : nurse.role === '소생실'
        ? `소생실 대기 중 (현재 환자 없음)${board.cpr ? '' : `, ${formatClock(ARTIFACT.cpcrAtMin)} CPCR 환자 내원 예정 (시연)`}`
        : '담당 환자 없이 역할 기본 단계로 표시합니다.'
    return (
      <article className="card">
        {head}
        {flags}
        {request}
        <div className="peer">{peer}</div>
      </article>
    )
  }

  const own = full || board.view === nurse.id
  return (
    <article className="card">
      {head}
      {load ? (
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
            <span>
              1시간 뒤 <b>{load.fc}분</b>
            </span>
          </div>
          <div className="track" aria-hidden="true">
            <i className={`fc s-${minutesLevel(load.fc)}`} style={{ width: `${pct(load.fc)}%` }} />
            <i className={`s-${level}`} style={{ width: `${pct(load.now)}%` }} />
            <span className="tick" style={{ left: `${pct(ARTIFACT.levelLowBelow)}%` }} />
            <span className="tick" style={{ left: `${pct(ARTIFACT.levelHighAbove)}%` }} />
          </div>
        </div>
      ) : null}
      {flags}
      {request}
      {load ? (
        <div className="pts">
          {nurse.patients.map((patient) => (
            <PatientBlock key={patient.id} nurse={nurse} patient={patient} board={board} />
          ))}
        </div>
      ) : null}
      {own ? (
        <div className="ft">
          <button type="button" className={help ? 'sm warn' : 'sm'} onClick={() => requestHelp(nurse.id)}>
            {help ? '지원 필요 해제' : '지원 필요'}
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
      )}
    </article>
  )
}

export function NurseGrid() {
  const nurses = useDemoStore((state) => state.board.nurses)
  return (
    <section className="cards" aria-label="간호사별 업무량">
      {nurses.map((nurse) => (
        <NurseCard key={nurse.id} nurse={nurse} />
      ))}
    </section>
  )
}
