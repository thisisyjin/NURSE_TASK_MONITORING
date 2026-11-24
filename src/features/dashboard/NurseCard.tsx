import { ARTIFACT, LEVEL_LABEL } from '../../config/artifactConfig'
import {
  activeSupport,
  findNurse,
  formatClock,
  isFullView,
  elapsedPendingMin,
  levelOf,
  loadOf,
  newsRaised,
  nurseQueue,
  orderStatus,
  supportFrom,
} from '../../domain/artifact/rules'
import type { ArtifactNurse, ArtifactPatient, ArtifactState } from '../../domain/artifact/types'
import { OrderRow } from '../orders/OrderRow'
import { NurseName } from '../ui/NurseName'
import { useDemoStore } from '../../store/demoStore'

function newsText(patient: ArtifactPatient): string {
  if (patient.cpr && patient.news == null) return 'CPR'
  const raised = newsRaised(patient)
  if (!raised || patient.news == null) return String(patient.news ?? '')
  return `${patient.news} ↑`
}

function vitalShort(intervalMin: number): string {
  if (intervalMin >= 60 && intervalMin % 60 === 0) return `활력 ${intervalMin / 60}시간`
  return `활력 ${intervalMin}분`
}

function canSeePatients(board: ArtifactState, nurseId: string): boolean {
  if (isFullView(board.view) || board.view === nurseId) return true
  return board.supports.some((support) => support.from === board.view && support.to === nurseId && activeSupport(support))
}

function PatientBlock({ nurse, patient, board }: { nurse: ArtifactNurse; patient: ArtifactPatient; board: ArtifactState }) {
  const activeOrders = patient.orders.filter((order) => orderStatus(order) !== 'completed')
  const full = isFullView(board.view)
  const helpers = board.supports
    .filter((support) => support.to === nurse.id && activeSupport(support))
    .map((support) => ({
      from: support.from,
      name: findNurse(board, support.from)?.name ?? support.from,
      show: full || board.view === support.from,
    }))
  const critical = patient.ktas <= 2
  return (
    <div className={critical ? 'pt is-critical' : 'pt'}>
      <div className="pt-id">
        <span className="name-tip">
          <b className="pt-name" tabIndex={0}>
            {patient.id} {patient.nm}
          </b>
          <span className="reg-tip" role="tooltip">
            <small>환자번호</small>
            {patient.reg}
          </span>
        </span>
        <span className={critical ? 'ktas is-hot' : 'ktas'}>KTAS {patient.ktas}</span>
      </div>
      <div className="pt-meta">
        {patient.cpr && patient.news == null ? (
          <b className="cpr">CPR</b>
        ) : (
          <span>
            NEWS{' '}
            <b className={newsRaised(patient) ? 'news-up' : undefined}>{newsText(patient)}</b>
          </span>
        )}
        {patient.avpu !== 'A' ? (
          <>
            <span className="meta-rule" aria-hidden="true" />
            <span>AVPU {patient.avpu}</span>
          </>
        ) : null}
        <span className="meta-rule" aria-hidden="true" />
        <span>{vitalShort(patient.vs)}</span>
      </div>
      {activeOrders.map((order) => (
        <OrderRow
          key={order.id}
          ownerId={nurse.id}
          patientId={patient.id}
          order={order}
          nowMin={board.t}
          showOwnerButton={full || board.view === nurse.id}
          helpers={helpers}
        />
      ))}
      {patient.sched
        .filter(([, at]) => at - board.t <= 60)
        .map(([name, at]) => (
          <div className="ord" key={`${name}-${at}`}>
            <b className="ord-title">
              예정: {name} {formatClock(at)}
            </b>
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
  const load = loadOf(board, nurse)
  const level = levelOf(board, nurse)
  const queue = nurseQueue(board, nurse)
  const minutes = load?.now ?? 0
  const visible = canSeePatients(board, nurse.id)
  const full = isFullView(board.view)
  const own = full || board.view === nurse.id
  const help = Boolean(board.help[nurse.id])
  const outgoing = supportFrom(board, nurse.id)
  const incoming = board.supports.filter((support) => support.to === nurse.id && !support.end && !support.cpr)
  const width = Math.min(100, (minutes / ARTIFACT.meterScaleMin) * 100)

  return (
    <article className="card">
      <div className={`stripe s-${level}`} />
      <div className="hd">
        <div>
          <div className="name">
            <NurseName name={nurse.name} />
            {nurse.prio ? <span className="prio-label">우선 대상</span> : null}
          </div>
          <div className="role">
            {nurse.patients.length ? `${nurse.role}, 환자 ${nurse.patients.length}명` : `${nurse.role}, 담당 환자 없음`}
          </div>
        </div>
        <span className={`lvl l-${level}`}>{LEVEL_LABEL[level]}</span>
      </div>
      <div className="meter">
        <div className="stat-row">
          <span className={queue.ktas1 > 0 ? 'is-hot' : undefined}>
            <em>KTAS 1</em>
            <b>{queue.ktas1}명</b>
          </span>
          <span className={queue.ktas2 > 0 ? 'is-hot' : undefined}>
            <em>KTAS 2</em>
            <b>{queue.ktas2}명</b>
          </span>
          <span>
            <em>대기처방</em>
            <b>{elapsedPendingMin(board, nurse)}분</b>
          </span>
        </div>
        <div className="track" aria-hidden="true">
          <i className={`s-${level}`} style={{ width: `${width}%` }} />
          <span className="tick" style={{ left: `${(ARTIFACT.levelLowBelow / ARTIFACT.meterScaleMin) * 100}%` }} />
          <span className="tick" style={{ left: `${(ARTIFACT.levelHighAbove / ARTIFACT.meterScaleMin) * 100}%` }} />
        </div>
      </div>
      <div className="flags">
        {queue.acknowledgedCount > 0 ? <span className="chip">확인중 {queue.acknowledgedCount}건</span> : null}
        {help ? <span className="chip hi">지원 필요</span> : null}
        {incoming.map((support) => (
          <span className="chip ac" key={`${support.from}-${support.start}`}>
            {findNurse(board, support.from)?.name} {support.accepted ? '지원 중' : '응답 대기'}
          </span>
        ))}
        {outgoing ? (
          <span className="chip ac">
            {findNurse(board, outgoing.to)?.name} {outgoing.accepted ? '지원 중' : '응답 대기'}
          </span>
        ) : null}
      </div>
      {visible && nurse.patients.length > 0 ? (
        <div className="pts">
          {nurse.patients.map((patient) => (
            <PatientBlock key={patient.id} nurse={nurse} patient={patient} board={board} />
          ))}
        </div>
      ) : null}
      {visible && nurse.patients.length === 0 ? <p className="peer">담당 환자가 없습니다.</p> : null}
      {!visible ? <p className="peer">동료 환자 상세는 이 화면에서 열지 않습니다.</p> : null}
      {visible && !own ? <p className="peer">지원 중인 화면입니다.</p> : null}
      {own ? (
        <div className="ft">
          <button type="button" className={help ? 'warn' : undefined} onClick={() => requestHelp(nurse.id)}>
            {help ? '지원 필요 해제' : '지원 필요'}
          </button>
          {load?.ev ? (
            <button type="button" onClick={() => clearSurge(nurse.id)}>
              상황 종료
            </button>
          ) : null}
          {load && full ? (
            <button type="button" onClick={() => setPriority(nurse.id)}>
              {nurse.prio ? '우선 대상 해제' : '우선 대상 지정'}
            </button>
          ) : null}
          {outgoing?.accepted ? (
            <button type="button" onClick={() => finishSupport(nurse.id)}>
              지원 종료
            </button>
          ) : null}
        </div>
      ) : null}
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
