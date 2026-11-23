import type { NewsRisk, WorkloadLevel } from '../config/demoConfig'

export type NurseId = string
export type PatientId = string
export type OrderId = string

export type NurseRole = 'assigned' | 'preT' | 'supplies'
export type UnavailableReason = 'break' | 'criticalPatient' | 'otherTask'
export type OrderStatus = 'pending' | 'completed'
export type SupportStatus = 'assigned' | 'accepted' | 'rejected' | 'completed'

export interface Nurse {
  id: NurseId
  name: string
  role: NurseRole
  zone?: string
  /** 역할 카드의 시연용 기본 단계. 환자 담당은 계산한다. */
  baseLevel?: WorkloadLevel
  preceptorName?: string
  isPriorityTarget: boolean
  needHelp: boolean
  unavailableReason?: UnavailableReason
  highSinceMin: number | null
  performedMin: number
}

export interface Patient {
  id: PatientId
  assignedNurseId: NurseId
  ktas: number
  news: number
  previousNews: number
  vitalIntervalMin: number
  /** HTML 급증 버튼이 붙인 상황. 없으면 비어 있다. */
  surgeKind?: string
  /** 시연 중 NEWS가 위험 이상으로 새로 진입했을 때의 사유. 초기값에는 넣지 않는다. */
  deteriorationReason?: string
}

export interface Order {
  id: OrderId
  patientId: PatientId
  name: string
  /** F1이 매칭한 분류. 미분류는 없다. */
  category: string | null
  matched: boolean
  usedDemoFallback: boolean
  estimatedDurationMin: number
  targetCompletionMin: number
  /** 자정 기준 분. 예정 처방은 예정 시각이 되기 전에는 발생 시각이 없다. */
  issuedAtMin: number | null
  scheduledAtMin?: number
  status: OrderStatus
  /** 예정 시각이 되어 대기 처방이 되면 true */
  activated: boolean
  completedAtMin?: number
  performerNurseId?: NurseId
}

export interface SupportAssignment {
  id: string
  targetNurseId: NurseId
  helperNurseId: NurseId
  status: SupportStatus
  alertId?: string
  assignedAtMin: number
  startedAtMin?: number
  endedAtMin?: number
  rejectedReason?: string
  performedOrderIds: OrderId[]
}

export interface LogEntry {
  t: number
  msg: string
}

export interface DemoStats {
  alerts: number
  assigned: number
  respSum: number
  overdoneDone: number
  doneCount: number
  waitSum: number
  reports: number
}

export interface DemoState {
  nowMin: number
  nurses: Nurse[]
  patients: Patient[]
  orders: Order[]
  supports: SupportAssignment[]
  log: LogEntry[]
  stats: DemoStats
  alertSeen: Record<string, number>
  extraStaff: number
  appliedEventIds: string[]
  surgeIdx: number
  rng: number
  idSeq: number
  viewerNurseId: string | null
}

export interface Viewer {
  kind: 'charge' | 'nurse'
  nurseId?: NurseId
}

export const UNAVAILABLE_LABEL: Record<UnavailableReason, string> = {
  break: '휴식',
  criticalPatient: '중증 환자 전담',
  otherTask: '다른 업무',
}

export type { NewsRisk, WorkloadLevel }
