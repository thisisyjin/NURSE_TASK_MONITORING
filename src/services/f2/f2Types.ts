export type F2OrderStatus = 'pending' | 'in_progress' | 'scheduled' | 'completed'

export interface F2OrderInput {
  id: string
  name: string
  status: F2OrderStatus
  estimated_minutes: number
}

export interface F2PatientInput {
  id: string
  ktas: 1 | 2 | 3 | 4 | 5
  news: number
  vital_interval_minutes: number
  acute_deterioration: boolean
  orders: F2OrderInput[]
}

export interface F2NurseInput {
  id: string
  name: string
  patients: F2PatientInput[]
}

export interface F2ShiftInput {
  scenario: { id: string; clock: string }
  nurses: F2NurseInput[]
}

export interface F2PatientBreakdown {
  patient_id: string
  observation_minutes: number
  vital_minutes: number
  pending_order_minutes: number
  unfinished_order_count: number
}

export interface F2NurseOutput {
  nurse_id: string
  nurse_name: string
  patient_count: number
  observation_minutes: number
  vital_minutes: number
  pending_order_minutes: number
  total_minutes: number
  workload_level: '여유' | '보통' | '높음'
  has_acute_deterioration: boolean
  patient_reference_minutes: number
  exceeds_patient_reference: boolean
  unfinished_order_count: number
  patient_breakdown: F2PatientBreakdown[]
}

export interface F2ShiftSummary {
  nurse_count: number
  patient_count: number
  observation_minutes: number
  vital_minutes: number
  pending_order_minutes: number
  total_minutes: number
  unfinished_order_count: number
  patient_reference_minutes: number
  exceeds_patient_reference: boolean
}

export interface F2Result {
  scenario: { id: string; clock: string }
  nurses: F2NurseOutput[]
  shift_summary: F2ShiftSummary
  calculation_version: string
}

export type F2FailureKind = 'auth' | 'network' | 'timeout' | 'http' | 'envelope' | 'flow'

export class F2ApiError extends Error {
  readonly kind: F2FailureKind
  readonly status?: number

  constructor(kind: F2FailureKind, message: string, status?: number) {
    super(message)
    this.name = 'F2ApiError'
    this.kind = kind
    this.status = status
  }
}
