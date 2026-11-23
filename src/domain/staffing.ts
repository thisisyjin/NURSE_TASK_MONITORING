import { demoConfig } from '../config/demoConfig'
import type { Nurse, Patient } from './types'

export type StaffingLevel = '적정' | '주의' | '초과'

export interface StaffingResult {
  totalMin: number
  capacityMin: number
  patientCount: number
  nurseCount: number
  extraStaff: number
  ratio: number
  level: StaffingLevel
}

export function staffingAdequacy(input: {
  nurses: Nurse[]
  patients: Patient[]
  totalByNurse: Record<string, number>
  extraStaff: number
}): StaffingResult {
  const active = input.nurses.filter(
    (nurse) => nurse.role === 'assigned' && input.patients.some((patient) => patient.assignedNurseId === nurse.id),
  )
  const totalMin = active.reduce((sum, nurse) => sum + (input.totalByNurse[nurse.id] ?? 0), 0)
  const patientCount = input.patients.length
  const capacityMin = (patientCount + input.extraStaff) * demoConfig.patientCapacityMin
  const ratio = capacityMin === 0 ? 0 : totalMin / capacityMin
  const level: StaffingLevel =
    ratio > 1 ? '초과' : ratio > demoConfig.staffingCautionAboveRatio ? '주의' : '적정'
  return {
    totalMin,
    capacityMin,
    patientCount,
    nurseCount: active.length,
    extraStaff: input.extraStaff,
    ratio,
    level,
  }
}
