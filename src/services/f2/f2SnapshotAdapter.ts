import type { DemoState, Order } from '../../domain/types'
import { hhmm } from '../../domain/time'
import type { F2OrderStatus, F2ShiftInput } from './f2Types'

function orderStatus(order: Order): F2OrderStatus {
  if (order.status === 'completed') return 'completed'
  if (!order.activated) return 'scheduled'
  return 'pending'
}

/**
 * 현재 시연 상태를 F2 입력으로 옮긴다.
 * 관찰과 활력 분은 넣지 않는다. 역할 간호사는 빼 둔다.
 */
export function toF2ShiftInput(state: DemoState, scenarioId: string): F2ShiftInput {
  return {
    scenario: { id: scenarioId, clock: hhmm(state.nowMin) },
    nurses: state.nurses
      .filter((nurse) => nurse.role === 'assigned')
      .map((nurse) => ({
        id: nurse.id,
        name: nurse.name,
        patients: state.patients
          .filter((patient) => patient.assignedNurseId === nurse.id)
          .map((patient) => ({
            id: patient.id,
            ktas: patient.ktas as 1 | 2 | 3 | 4 | 5,
            news: patient.news,
            vital_interval_minutes: patient.vitalIntervalMin,
            acute_deterioration: Boolean(patient.surgeKind || patient.deteriorationReason),
            orders: state.orders
              .filter((order) => order.patientId === patient.id)
              .map((order) => ({
                id: order.id,
                name: order.name,
                status: orderStatus(order),
                estimated_minutes: order.estimatedDurationMin,
              })),
          })),
      })),
  }
}
