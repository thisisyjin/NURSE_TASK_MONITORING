import { demoConfig } from '../config/demoConfig'
import { RANDOM_ORDER_POOL } from '../data/fixtures/catalog'
import { classifyOrderName, durationForWorkload, targetMinFor } from './classifyOrder'
import { newsRisk } from './time'
import type { DemoState, Order, Patient } from './types'

export interface ScenarioAction {
  type: 'setNews' | 'addOrder' | 'admit'
  patientId?: string
  news?: number
  orderName?: string
  admit?: {
    id: string
    nurseId: string
    ktas: number
    news: number
    vitalIntervalMin: number
    orderNames: string[]
  }
}

export interface ScenarioEvent {
  id: string
  atMin: number
  actions: ScenarioAction[]
}

const START = demoConfig.shiftStartMin

/** HTML SCRIPT. 같은 id는 한 번만 적용한다. */
export const SCENARIO_EVENTS: ScenarioEvent[] = [
  {
    id: 'script-0915',
    atMin: START + 15,
    actions: [
      { type: 'setNews', patientId: 'A-01', news: 7 },
      { type: 'addOrder', patientId: 'B-01', orderName: '수액 교체' },
    ],
  },
  {
    id: 'script-0930',
    atMin: START + 30,
    actions: [
      { type: 'setNews', patientId: 'C-01', news: 6 },
      { type: 'addOrder', patientId: 'A-02', orderName: 'A-line 삽입 준비 및 보조' },
    ],
  },
  {
    id: 'script-0945',
    atMin: START + 45,
    actions: [
      {
        type: 'admit',
        admit: {
          id: 'D-03',
          nurseId: 'n4',
          ktas: 3,
          news: 3,
          vitalIntervalMin: 60,
          orderNames: ['채혈', '정맥 주사(IV push)'],
        },
      },
    ],
  },
  {
    id: 'script-1000',
    atMin: START + 60,
    actions: [
      { type: 'setNews', patientId: 'B-01', news: 5 },
      { type: 'addOrder', patientId: 'C-02', orderName: '정맥 항생제' },
    ],
  },
  {
    id: 'script-1015',
    atMin: START + 75,
    actions: [
      { type: 'setNews', patientId: 'A-01', news: 6 },
      { type: 'addOrder', patientId: 'D-01', orderName: '채혈' },
    ],
  },
  {
    id: 'script-1030',
    atMin: START + 90,
    actions: [
      {
        type: 'admit',
        admit: {
          id: 'B-03',
          nurseId: 'n2',
          ktas: 2,
          news: 5,
          vitalIntervalMin: 30,
          orderNames: ['채혈', '정맥 주사(IV push)', 'Central line 삽입 준비 및 보조'],
        },
      },
    ],
  },
]

function nextId(state: DemoState): { state: DemoState; id: string } {
  const id = `x${state.idSeq}`
  return { state: { ...state, idSeq: state.idSeq + 1 }, id }
}

function log(state: DemoState, msg: string): DemoState {
  return { ...state, log: [{ t: state.nowMin, msg }, ...state.log] }
}

export function makeOrder(state: DemoState, patientId: string, name: string, issuedAtMin: number): { state: DemoState; order: Order } {
  const issued = nextId(state)
  const classified = classifyOrderName(name)
  const order: Order = {
    id: issued.id,
    patientId,
    name,
    category: classified.category,
    matched: classified.matched,
    usedDemoFallback: classified.usedDemoFallback,
    estimatedDurationMin: durationForWorkload(classified),
    targetCompletionMin: targetMinFor(name),
    issuedAtMin,
    status: 'pending',
    activated: true,
  }
  return { state: issued.state, order }
}

function applySetNews(state: DemoState, patientId: string, news: number): DemoState {
  const patient = state.patients.find((item) => item.id === patientId)
  if (!patient || patient.news === news) return state
  const previous = patient.news
  const enteredRisk = previous < 5 && news >= 5
  const enteredHighRisk = previous < 7 && news >= 7
  const deteriorationReason =
    enteredHighRisk || enteredRisk ? '환자 악화' : patient.deteriorationReason
  const patients = state.patients.map((item) =>
    item.id === patientId ? { ...item, previousNews: previous, news, deteriorationReason } : item,
  )
  return log({ ...state, patients }, `${patientId} NEWS ${previous}에서 ${news}`)
}

function applyAddOrder(state: DemoState, patientId: string, name: string): DemoState {
  if (!state.patients.some((item) => item.id === patientId)) return state
  const created = makeOrder(state, patientId, name, state.nowMin)
  const classified = classifyOrderName(name)
  const note = classified.matched
    ? `새 처방, ${patientId} ${name} (시연 분류: ${classified.category}, ${classified.estimatedDurationMin}분)`
    : `새 처방, ${patientId} ${name} (규칙 미분류, 시연용 ${demoConfig.unmatchedOrderMin}분)`
  return log({ ...created.state, orders: [...created.state.orders, created.order] }, note)
}

function applyAdmit(state: DemoState, admit: NonNullable<ScenarioAction['admit']>): DemoState {
  if (state.patients.some((item) => item.id === admit.id)) return state
  const patient: Patient = {
    id: admit.id,
    assignedNurseId: admit.nurseId,
    ktas: admit.ktas,
    news: admit.news,
    previousNews: admit.news,
    vitalIntervalMin: admit.vitalIntervalMin,
  }
  const nurse = state.nurses.find((item) => item.id === admit.nurseId)
  let next = log(
    { ...state, patients: [...state.patients, patient] },
    `신규 내원, ${admit.id} KTAS ${admit.ktas}, 담당 ${nurse?.name ?? admit.nurseId}`,
  )
  for (const name of admit.orderNames) next = applyAddOrder(next, admit.id, name)
  return next
}

export function applyScenarioEvent(state: DemoState, event: ScenarioEvent): DemoState {
  if (state.appliedEventIds.includes(event.id)) return state
  if (state.nowMin < event.atMin) return state
  let next: DemoState = { ...state, appliedEventIds: [...state.appliedEventIds, event.id] }
  for (const action of event.actions) {
    if (action.type === 'setNews' && action.patientId != null && action.news != null) {
      next = applySetNews(next, action.patientId, action.news)
    } else if (action.type === 'addOrder' && action.patientId && action.orderName) {
      next = applyAddOrder(next, action.patientId, action.orderName)
    } else if (action.type === 'admit' && action.admit) {
      next = applyAdmit(next, action.admit)
    }
  }
  return next
}

export function releaseDueOrders(state: DemoState): DemoState {
  let next = state
  let changed = false
  const orders = state.orders.map((order) => {
    if (order.activated || order.status !== 'pending' || order.scheduledAtMin == null) return order
    if (order.scheduledAtMin > state.nowMin) return order
    changed = true
    const patient = state.patients.find((item) => item.id === order.patientId)
    next = log(next, `예정 처방 도래, ${patient?.id ?? order.patientId} ${order.name}`)
    return { ...order, activated: true, issuedAtMin: order.scheduledAtMin }
  })
  if (!changed) return state
  return { ...next, orders }
}

export function applyDueContent(state: DemoState): DemoState {
  let next = releaseDueOrders(state)
  const due = SCENARIO_EVENTS.filter((event) => event.atMin <= next.nowMin && !next.appliedEventIds.includes(event.id)).sort(
    (a, b) => a.atMin - b.atMin,
  )
  for (const event of due) next = applyScenarioEvent(next, event)
  return next
}

function nextRandom(rng: number): number {
  return (rng * 1103515245 + 12345) % 2147483648
}

export function addRandomOrder(state: DemoState): DemoState {
  if (state.patients.length === 0) return state
  const rng1 = nextRandom(state.rng)
  const rng2 = nextRandom(rng1)
  const patient = state.patients[Math.floor((rng1 / 2147483648) * state.patients.length)]
  const name = RANDOM_ORDER_POOL[Math.floor((rng2 / 2147483648) * RANDOM_ORDER_POOL.length)]
  return applyAddOrder({ ...state, rng: rng2 }, patient.id, name)
}

const SURGE_KINDS = ['섬망 및 초조 행동', '환자 상태 악화']
/** HTML 순서는 D-01, A-02, C-02, B-02다. 시연 PDF 7페이지 알림은 D-02이므로 첫 대상을 바꾼다. */
const SURGE_ORDER = ['D-02', 'A-02', 'C-02', 'B-02']

/** 첫 적용은 D-02와 환자 상태 악화다. NEWS를 올리는 동작은 HTML surge()를 유지한다. */
export function applySurge(state: DemoState): DemoState {
  let bed: string | null = null
  let surgeIdx = state.surgeIdx
  for (let k = 0; k < SURGE_ORDER.length; k += 1) {
    const candidate = SURGE_ORDER[(surgeIdx + k) % SURGE_ORDER.length]
    const patient = state.patients.find((item) => item.id === candidate)
    if (patient && !patient.surgeKind) {
      bed = candidate
      surgeIdx += k + 1
      break
    }
  }
  if (!bed) return log(state, '간호요구 급증, 시연 환자에 이미 적용됨')
  const kind = SURGE_KINDS[surgeIdx % 2]
  const patients = state.patients.map((patient) => {
    if (patient.id !== bed) return patient
    if (kind.startsWith('환자 상태')) {
      const news = Math.max(patient.news + 4, 7)
      return {
        ...patient,
        surgeKind: kind,
        previousNews: patient.news,
        news,
      }
    }
    return { ...patient, surgeKind: kind }
  })
  const nurse = state.nurses.find((item) => item.id === patients.find((patient) => patient.id === bed)?.assignedNurseId)
  const riskNote = newsRisk(patients.find((patient) => patient.id === bed)?.news ?? 0)
  return log(
    { ...state, patients, surgeIdx },
    `간호요구 급증, ${bed} ${kind}, ${nurse?.name ?? ''} 즉시 높음${riskNote === 'highRisk' ? ', NEWS 고위험' : ''}`,
  )
}

export function clearSurge(state: DemoState, nurseId: string): DemoState {
  let next = state
  const patients = state.patients.map((patient) => {
    if (patient.assignedNurseId !== nurseId || !patient.surgeKind) return patient
    next = log(next, `간호요구 급증 해제, ${patient.id}`)
    const { surgeKind: _removed, ...rest } = patient
    return rest
  })
  return { ...next, patients }
}
