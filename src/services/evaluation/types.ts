import type { WorkloadLevel } from '../../config/demoConfig'
import type { NurseId, OrderId, UnavailableReason } from '../../domain/types'
import type { StaffingResult } from '../../domain/staffing'

export interface CatalogEntry {
  name: string
  category: string
  estimatedDurationMin: number
}

export interface ClassifiedOrderResult {
  orderId: OrderId
  category: string | null
  estimatedDurationMin: number | null
  matched: boolean
  usedDemoFallback: boolean
}

export interface WorkOrder {
  id: OrderId
  patientId: string
  name: string
  estimatedDurationMin: number
  targetCompletionMin: number
  issuedAtMin: number | null
  scheduledAtMin?: number
  status: 'pending' | 'completed'
  activated: boolean
}

export interface WorkNurse {
  id: NurseId
  name: string
  role: 'assigned' | 'preT' | 'supplies'
  zone?: string
  baseLevel?: WorkloadLevel
  isPriorityTarget: boolean
  needHelp: boolean
  unavailableReason?: UnavailableReason
  highSinceMin: number | null
}

export interface WorkPatient {
  id: string
  assignedNurseId: NurseId
  ktas: number
  news: number
  previousNews: number
  vitalIntervalMin: number
  surgeKind?: string
  deteriorationReason?: string
}

export interface NurseWorkloadResult {
  nurseId: NurseId
  observationMin: number
  vitalSignsMin: number
  pendingOrdersMin: number
  pendingCount: number
  totalWorkloadMin: number
  level: WorkloadLevel
  /** 시연용 1시간 뒤. 업무량 단계와 같은 30분, 50분 경계이며 급증 강제 높음은 넣지 않는다. */
  demoForecastMin: number
  demoForecastLevel: WorkloadLevel
  /** 이 간호사의 담당 환자 수 x 환자당 기준분. 업무량 단계와 별개다. */
  capacityReferenceMin: number
  exceedsCapacityReference: boolean
  forceHigh: boolean
}

export interface OrderDelayResult {
  orderId: OrderId
  patientId: string
  nurseId: NurseId
  zone: string
  elapsedMin: number
  targetCompletionMin: number
  isOverdue: boolean
  awaiting: boolean
}

export interface ZoneDelaySummary {
  zone: string
  pendingCount: number
  overdueCount: number
  maxWaitingMin: number
}

export interface SupportAssignmentRef {
  targetNurseId: NurseId
  helperNurseId: NurseId
  status: 'assigned' | 'accepted' | 'rejected' | 'completed'
}

export interface SupportEvaluationResult {
  id: string
  targetNurseId: NurseId | null
  alertStage: 1 | 2 | 3
  reasons: string[]
  recommendedHelperIds: NurseId[]
  headline: string
  detail: string
}

export interface EvaluationService {
  classifyOrders(input: { orders: WorkOrder[]; catalog: CatalogEntry[] }): Promise<ClassifiedOrderResult[]>
  calculateWorkloads(input: {
    nurses: WorkNurse[]
    patients: WorkPatient[]
    orders: WorkOrder[]
    currentMinute: number
    patientCapacityMinutes: number
  }): Promise<NurseWorkloadResult[]>
  evaluateOrderDelays(input: {
    orders: WorkOrder[]
    patients: WorkPatient[]
    nurses: WorkNurse[]
    currentMinute: number
  }): Promise<{ orders: OrderDelayResult[]; zones: ZoneDelaySummary[] }>
  evaluateSupport(input: {
    nurses: WorkNurse[]
    patients: WorkPatient[]
    workloads: NurseWorkloadResult[]
    delays: OrderDelayResult[]
    manualSupportRequests: NurseId[]
    existingAssignments: SupportAssignmentRef[]
    staffing: StaffingResult
    currentMinute: number
    priorityAlertAdvanceMin: number
    highSustainMin: number
  }): Promise<SupportEvaluationResult[]>
}
