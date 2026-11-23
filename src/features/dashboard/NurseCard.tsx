import { useState } from 'react'
import { LEVEL_LABEL } from '../../config/artifactConfig'
import {
  activeSupport,
  findNurse,
  formatClock,
  isFullView,
  levelOf,
  loadOf,
  newsBandLabel,
  newsRaised,
  nurseQueue,
  orderStatus,
  supportFrom,
  vitalPeriodLabel,
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
  const activeOrders = patient.orders.filter((order) => orderStatus(order) !== 'completed')
  const pendingCount = activeOrders.filter((order) => orderStatus(order) === 'pending').length
  const [open, setOpen] = useState(activeOrders.length > 0 || patient.sched.some(([, at]) => at - board.t <= 60))
  const full = isFullView(board.view)
  const helpers = board.supports.filter((support) => support.to === nurse.id && activeSupport(support)).map((support) => ({
    from: support.from,
    name: findNurse(board, support.from)?.name ?? support.from,
    show: full || board.view === support.from,
  }))
  return (
    <div className="pt">
      <button type="button" className="pt-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <b>
          {patient.id} {patient.nm} <span className="ktas">KTAS {patient.ktas}</span>
        </b>
        <span>
          NEWS <span className={patient.cpr && patient.news == null ? 'cpr' : newsRaised(patient) ? 'news-up' : undefined}>{newsText(patient)}</span>
          {patient.avpu !== 'A' ? <span className="news-up"> AVPU {patient.avpu}</span> : null}
          {`, ${vitalPeriodLabel(patient.vs)}, 대기 ${pendingCount}건`}
        </span>
      </button>
      <div className="pid">{patient.reg}</div>
      {open ? (
        <>
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
                <span>
                  예정: {name} <span className="w">{formatClock(at)}</span>
                </span>
              </div>
            ))}
        </>
      ) : null}
    </div>
  )
}

export function NurseCard({ nurse }: { nurse: ArtifactNurse }) {
  const board = useDemoStore((state) => state.board)
  const requestHelp = useDemoStore((state) => state.requestHelp)
  const setPriority = useDemoStore((state) => state.setPriority)
  const clearSurge = useDemoStore((state) => state.clearSurge)
  const finishSupport = useDemoStore((state) => state.finishSupport)
  const full = isFullView(board.view)
  const mySupport = !full ? board.supports.find((support) => support.from === board.view && activeSupport(support)) : undefined
  const detail = full || board.view === nurse.id || mySupport?.to === nurse.id
  const load = loadOf(board, nurse)
  const level = levelOf(board, nurse)
  const queue = nurseQueue(board, nurse)
  const help = Boolean(board.help[nurse.id])
  const outgoing = supportFrom(board, nurse.id)
  const own = full || board.view === nurse.id

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
      {load ? (
        <div className="meter">
          <div className="mrow">
            <span>담당 업무량</span>
            <b>{load.now}분</b>
          </div>
          {detail ? (
            <>
              <div className="mrow">
                <span>
                  수행 대기 {queue.pendingCount}건, 가장 오래 대기 {queue.maxWaitMin}분
                  {queue.acknowledgedCount ? `, 확인중 ${queue.acknowledgedCount}건` : ''}
                  {load.sup ? ', 지원 반영' : ''}
                </span>
              </div>
              <div className="ktas-row">
                <span className="chip">KTAS 1 {queue.ktas1}명</span>
                <span className="chip">KTAS 2 {queue.ktas2}명</span>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
      <div className="flags">
        {nurse.prio && full ? <span className="chip ac">지원 우선 대상</span> : null}
        {load?.ev ? (
          <span className="chip hi">
            높음 사유: {load.ev.type}, {load.ev.pid}
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
            {findNurse(board, outgoing.to)?.name} {outgoing.accepted ? '지원 중' : '응답 대기'}
          </span>
        ) : null}
      </div>
      {detail && load ? (
        <div className="pts">
          {nurse.patients.map((patient) => (
            <PatientBlock key={patient.id} nurse={nurse} patient={patient} board={board} />
          ))}
        </div>
      ) : (
        <div className="peer">
          {load
            ? '동료 화면에는 업무 단계와 담당 업무량만 표시됩니다.'
            : nurse.role === '소생실'
              ? '소생실 대기 중 (현재 환자 없음)'
              : '담당 환자 없이 역할 기본 단계로 표시합니다.'}
        </div>
      )}
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
      ) : detail ? (
        <div className="ft">
          <span className="empty">지원 중인 화면입니다. 대신 수행하면 수행자는 본인으로 기록됩니다.</span>
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
