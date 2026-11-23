import type { WorkloadLevel } from '../../config/demoConfig'
import type { NurseWorkloadResult } from '../evaluation/types'
import type { F2Result } from './f2Types'

const LEVEL: Record<F2Result['nurses'][number]['workload_level'], WorkloadLevel> = {
  여유: 'low',
  보통: 'normal',
  높음: 'high',
}

/**
 * 카드의 현재 업무량만 F2 값으로 바꾼다.
 * 1시간 뒤 시연값은 Mock에 남겨 둔다.
 */
export function mergeF2Workloads(mockRows: NurseWorkloadResult[], result: F2Result): NurseWorkloadResult[] {
  return mockRows.map((row) => {
    const found = result.nurses.find((nurse) => nurse.nurse_id === row.nurseId)
    if (!found) return row
    return {
      ...row,
      observationMin: found.observation_minutes,
      vitalSignsMin: found.vital_minutes,
      pendingOrdersMin: found.pending_order_minutes,
      pendingCount: found.unfinished_order_count,
      totalWorkloadMin: found.total_minutes,
      level: LEVEL[found.workload_level],
      capacityReferenceMin: found.patient_reference_minutes,
      exceedsCapacityReference: found.exceeds_patient_reference,
      forceHigh: found.has_acute_deterioration,
      demoForecastMin: row.demoForecastMin,
      demoForecastLevel: row.demoForecastLevel,
    }
  })
}
