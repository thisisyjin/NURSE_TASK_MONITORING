import { demoConfig } from '../config/demoConfig'
import { applyDueContent, applySurge, addRandomOrder, clearSurge } from '../domain/scenario'
import type { DemoState, Order, UnavailableReason } from '../domain/types'
import { UNAVAILABLE_LABEL } from '../domain/types'
import { hhmm } from '../domain/time'

function log(state: DemoState, msg: string): DemoState {
  return { ...state, log: [{ t: state.nowMin, msg }, ...state.log] }
}

function nextId(state: DemoState): { state: DemoState; id: string } {
  return { state: { ...state, idSeq: state.idSeq + 1 }, id: `s${state.idSeq}` }
}

export function advanceMinutes(state: DemoState, minutes: number): DemoState {
  let next = state
  const target = state.nowMin + minutes
  while (next.nowMin < target) {
    next = { ...next, nowMin: next.nowMin + 1 }
    next = applyDueContent(next)
  }
  return next
}

export function autoStep(state: DemoState): DemoState {
  const rolled = (state.rng * 1103515245 + 12345) % 2147483648
  let next = advanceMinutes({ ...state, rng: rolled }, demoConfig.autoStepMin)
  if (rolled / 2147483648 < demoConfig.autoOrderChance) next = addRandomOrder(next)
  return next
}

export function completeOrder(state: DemoState, orderId: string, performerId: string): DemoState {
  const order = state.orders.find((item) => item.id === orderId)
  if (!order || order.status !== 'pending' || !order.activated || order.issuedAtMin == null) return state
  const patient = state.patients.find((item) => item.id === order.patientId)
  const performer = state.nurses.find((item) => item.id === performerId)
  if (!patient || !performer) return state
  const ownerId = patient.assignedNurseId
  const support = state.supports.find(
    (item) => item.status === 'accepted' && item.helperNurseId === performerId && item.targetNurseId === ownerId,
  )
  if (performerId !== ownerId && !support) return state
  const wait = state.nowMin - order.issuedAtMin
  const late = wait > order.targetCompletionMin
  const orders: Order[] = state.orders.map((item) =>
    item.id === orderId
      ? { ...item, status: 'completed', completedAtMin: state.nowMin, performerNurseId: performerId }
      : item,
  )
  const nurses = state.nurses.map((item) =>
    item.id === performerId ? { ...item, performedMin: item.performedMin + order.estimatedDurationMin } : item,
  )
  const supports = state.supports.map((item) =>
    support && item.id === support.id && !item.performedOrderIds.includes(orderId)
      ? { ...item, performedOrderIds: [...item.performedOrderIds, orderId] }
      : item,
  )
  const via = performerId === ownerId ? '' : ' 지원'
  return log(
    {
      ...state,
      orders,
      nurses,
      supports,
      stats: {
        ...state.stats,
        doneCount: state.stats.doneCount + 1,
        waitSum: state.stats.waitSum + wait,
        overdoneDone: state.stats.overdoneDone + (late ? 1 : 0),
      },
    },
    `수행, ${patient.id} ${order.name}, 수행자 ${performer.name}${via}, 대기 ${wait}분${late ? ', 기준 초과' : ''}`,
  )
}

export function assignSupport(state: DemoState, targetId: string, helperId: string, alertId?: string): DemoState {
  if (targetId === helperId) return state
  const target = state.nurses.find((item) => item.id === targetId)
  const helper = state.nurses.find((item) => item.id === helperId)
  if (!target || !helper || helper.unavailableReason) return state
  const open = state.supports.some(
    (item) =>
      (item.status === 'assigned' || item.status === 'accepted') &&
      (item.targetNurseId === targetId || item.helperNurseId === helperId || item.targetNurseId === helperId),
  )
  if (open) return state
  const issued = nextId(state)
  const seen = alertId != null ? state.alertSeen[alertId] : undefined
  return log(
    {
      ...issued.state,
      supports: [
        ...issued.state.supports,
        {
          id: issued.id,
          targetNurseId: targetId,
          helperNurseId: helperId,
          status: 'assigned',
          alertId,
          assignedAtMin: state.nowMin,
          performedOrderIds: [],
        },
      ],
      nurses: issued.state.nurses.map((item) => (item.id === targetId ? { ...item, needHelp: false } : item)),
      stats: {
        ...issued.state.stats,
        assigned: issued.state.stats.assigned + 1,
        respSum: issued.state.stats.respSum + (seen != null ? state.nowMin - seen : 0),
      },
    },
    `지원 배정, ${helper.name}에게 ${target.name} 지원 요청`,
  )
}

export function acceptSupport(state: DemoState, supportId: string): DemoState {
  const support = state.supports.find((item) => item.id === supportId)
  if (!support || support.status !== 'assigned') return state
  const helper = state.nurses.find((item) => item.id === support.helperNurseId)
  const target = state.nurses.find((item) => item.id === support.targetNurseId)
  return log(
    {
      ...state,
      supports: state.supports.map((item) =>
        item.id === supportId ? { ...item, status: 'accepted', startedAtMin: state.nowMin } : item,
      ),
    },
    `지원 수락, ${helper?.name ?? ''}가 ${target?.name ?? ''} 지원 시작 ${hhmm(state.nowMin)}`,
  )
}

export function rejectSupport(state: DemoState, supportId: string, reason: string): DemoState {
  const support = state.supports.find((item) => item.id === supportId)
  if (!support || support.status !== 'assigned') return state
  const helper = state.nurses.find((item) => item.id === support.helperNurseId)
  return log(
    {
      ...state,
      supports: state.supports.map((item) =>
        item.id === supportId ? { ...item, status: 'rejected', endedAtMin: state.nowMin, rejectedReason: reason } : item,
      ),
    },
    `지원 거절, ${helper?.name ?? ''}, 사유 ${reason}`,
  )
}

export function endSupport(state: DemoState, supportId: string): DemoState {
  const support = state.supports.find((item) => item.id === supportId)
  if (!support || support.status !== 'accepted' || support.startedAtMin == null) return state
  const helper = state.nurses.find((item) => item.id === support.helperNurseId)
  const target = state.nurses.find((item) => item.id === support.targetNurseId)
  const minutes = state.nowMin - support.startedAtMin
  return log(
    {
      ...state,
      supports: state.supports.map((item) =>
        item.id === supportId ? { ...item, status: 'completed', endedAtMin: state.nowMin } : item,
      ),
    },
    `지원 종료, ${helper?.name ?? ''}가 ${target?.name ?? ''} 지원, ${minutes}분, ${support.performedOrderIds.length}건`,
  )
}

export function reassignPatient(state: DemoState, fromId: string, toId: string): DemoState {
  const from = state.nurses.find((item) => item.id === fromId)
  const to = state.nurses.find((item) => item.id === toId)
  if (!from || !to) return state
  if (to.role !== 'assigned') return log(state, `환자 재배정 불가, ${to.name}은 환자 담당 역할이 아님`)
  const movable = state.patients.filter((patient) => patient.assignedNurseId === fromId && !patient.surgeKind)
  if (movable.length < 2) return log(state, `환자 재배정, ${from.name}의 재배정 가능한 환자가 부족함`)
  const picked = [...movable].sort((a, b) => b.ktas - a.ktas || a.id.localeCompare(b.id))[0]
  return log(
    {
      ...state,
      patients: state.patients.map((patient) =>
        patient.id === picked.id ? { ...patient, assignedNurseId: toId } : patient,
      ),
    },
    `환자 재배정, ${picked.id} ${from.name}에서 ${to.name}`,
  )
}

export function toggleNeedHelp(state: DemoState, nurseId: string): DemoState {
  const nurse = state.nurses.find((item) => item.id === nurseId)
  if (!nurse) return state
  const needHelp = !nurse.needHelp
  return log(
    {
      ...state,
      nurses: state.nurses.map((item) => (item.id === nurseId ? { ...item, needHelp } : item)),
    },
    `${nurse.name} 지원 필요 ${needHelp ? '표시' : '해제'}`,
  )
}

export function togglePriority(state: DemoState, nurseId: string): DemoState {
  const nurse = state.nurses.find((item) => item.id === nurseId)
  if (!nurse || nurse.role !== 'assigned') return state
  const isPriorityTarget = !nurse.isPriorityTarget
  return log(
    {
      ...state,
      nurses: state.nurses.map((item) => (item.id === nurseId ? { ...item, isPriorityTarget } : item)),
    },
    `${nurse.name} 지원 우선 대상 ${isPriorityTarget ? '지정, 지원 알림만 10분 앞당김' : '해제'}`,
  )
}

export function setUnavailable(state: DemoState, nurseId: string, reason: UnavailableReason | null): DemoState {
  const nurse = state.nurses.find((item) => item.id === nurseId)
  if (!nurse) return state
  const nurses = state.nurses.map((item) => {
    if (item.id !== nurseId) return item
    if (reason == null) {
      const { unavailableReason: _removed, ...rest } = item
      return rest
    }
    return { ...item, unavailableReason: reason }
  })
  const label = reason == null ? '해제' : UNAVAILABLE_LABEL[reason]
  return log({ ...state, nurses }, `${nurse.name} 지원 불가 ${label}`)
}

export function clearNurseSurge(state: DemoState, nurseId: string): DemoState {
  return clearSurge(state, nurseId)
}

export function triggerSurge(state: DemoState): DemoState {
  return applySurge(state)
}

export function spawnOrder(state: DemoState): DemoState {
  return addRandomOrder(state)
}

export function reportStaffing(state: DemoState): DemoState {
  return log(
    { ...state, stats: { ...state.stats, reports: state.stats.reports + 1 } },
    '부서장 보고, 근무조 업무량이 인력 기준을 초과',
  )
}

export function addExtraStaff(state: DemoState): DemoState {
  return log(
    { ...state, extraStaff: state.extraStaff + 1 },
    `추가 인력 투입, 인력 기준 +${demoConfig.patientCapacityMin}분`,
  )
}
