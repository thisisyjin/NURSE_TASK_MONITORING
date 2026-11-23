import { demoConfig } from '../../config/demoConfig'
import { categoryForMinutes, classifyOrderName, durationForWorkload } from '../../domain/classifyOrder'
import { demoForecastMin, demoObservationMin, demoVitalMin } from '../../domain/demoLoads'
import { workloadLevel } from '../../domain/time'
import { listHelperOptions, recommendedHelperIds, type HelperSnapshot } from '../../domain/supportRules'
import { ORDER_RULES } from '../../data/fixtures/catalog'
import type {
  CatalogEntry,
  ClassifiedOrderResult,
  EvaluationService,
  NurseWorkloadResult,
  OrderDelayResult,
  SupportEvaluationResult,
  WorkNurse,
  WorkOrder,
  WorkPatient,
  ZoneDelaySummary,
} from '../evaluation/types'

export function demoCatalog(): CatalogEntry[] {
  return ORDER_RULES.map((rule) => ({
    name: rule.label,
    category: categoryForMinutes(rule.min),
    estimatedDurationMin: rule.min,
  }))
}

export function classifyOrdersSync(orders: WorkOrder[], catalog: CatalogEntry[]): ClassifiedOrderResult[] {
  return orders.map((order) => {
    if (catalog.length === 0) {
      return { orderId: order.id, category: null, estimatedDurationMin: null, matched: false, usedDemoFallback: false }
    }
    const found = classifyOrderName(order.name)
    return {
      orderId: order.id,
      category: found.category,
      estimatedDurationMin: found.matched ? found.estimatedDurationMin : null,
      matched: found.matched,
      usedDemoFallback: found.usedDemoFallback,
    }
  })
}

export function orderDuration(order: WorkOrder, classified: ClassifiedOrderResult | undefined): number {
  if (classified?.matched && classified.estimatedDurationMin != null) return classified.estimatedDurationMin
  if (classified && !classified.matched) return durationForWorkload(classifyOrderName(order.name))
  return order.estimatedDurationMin
}

/**
 * F2 업무량. 관찰, 활력, 합계, 단계, 시연용 1시간 뒤, 개인 환자수 기준을 여기서만 계산한다.
 * 화면은 이 결과를 표시하고 식을 다시 돌리지 않는다.
 */
export function calculateWorkloadsSync(input: {
  nurses: WorkNurse[]
  patients: WorkPatient[]
  orders: WorkOrder[]
  currentMinute: number
  patientCapacityMinutes: number
}): NurseWorkloadResult[] {
  const durationOf = (order: WorkOrder) => order.estimatedDurationMin
  return input.nurses.map((nurse) => {
    if (nurse.role !== 'assigned') {
      const total = demoConfig.roleBaseMin[nurse.baseLevel ?? 'low']
      const level = workloadLevel(total, false)
      return {
        nurseId: nurse.id,
        observationMin: 0,
        vitalSignsMin: 0,
        pendingOrdersMin: 0,
        pendingCount: 0,
        totalWorkloadMin: total,
        level,
        demoForecastMin: total,
        demoForecastLevel: level,
        capacityReferenceMin: 0,
        exceedsCapacityReference: false,
        forceHigh: false,
      }
    }
    const mine = input.patients.filter((patient) => patient.assignedNurseId === nurse.id)
    const patientIds = new Set(mine.map((patient) => patient.id))
    const pending = input.orders.filter(
      (order) => patientIds.has(order.patientId) && order.status === 'pending' && order.activated && order.issuedAtMin != null,
    )
    const pendingOrdersMin = pending.reduce((sum, order) => sum + durationOf(order), 0)
    const observationMin = mine.reduce((sum, patient) => sum + demoObservationMin(patient), 0)
    const vitalSignsMin = mine.reduce((sum, patient) => sum + demoVitalMin(patient.vitalIntervalMin), 0)
    const total = observationMin + vitalSignsMin + pendingOrdersMin
    const forceHigh = mine.some((patient) => patient.surgeKind || patient.deteriorationReason)
    const forecastMin = mine.reduce((sum, patient) => {
      const patientPending = pending
        .filter((order) => order.patientId === patient.id)
        .reduce((inner, order) => inner + durationOf(order), 0)
      const scheduled = input.orders
        .filter((order) => order.patientId === patient.id && !order.activated && order.scheduledAtMin != null)
        .map((order) => ({
          name: order.name,
          atMin: order.scheduledAtMin ?? 0,
          durationMin: durationOf(order),
        }))
      return sum + demoForecastMin(patient, patientPending, scheduled, input.currentMinute)
    }, 0)
    const capacityReferenceMin = mine.length * input.patientCapacityMinutes
    return {
      nurseId: nurse.id,
      observationMin,
      vitalSignsMin,
      pendingOrdersMin,
      pendingCount: pending.length,
      totalWorkloadMin: total,
      level: workloadLevel(total, forceHigh),
      demoForecastMin: forecastMin,
      demoForecastLevel: workloadLevel(forecastMin, false),
      capacityReferenceMin,
      exceedsCapacityReference: capacityReferenceMin > 0 && total > capacityReferenceMin,
      forceHigh,
    }
  })
}

export function evaluateOrderDelaysSync(input: {
  orders: WorkOrder[]
  patients: WorkPatient[]
  nurses: WorkNurse[]
  currentMinute: number
}): { orders: OrderDelayResult[]; zones: ZoneDelaySummary[] } {
  const nurseById = new Map(input.nurses.map((nurse) => [nurse.id, nurse]))
  const patientById = new Map(input.patients.map((patient) => [patient.id, patient]))
  const orders: OrderDelayResult[] = input.orders.map((order) => {
    const patient = patientById.get(order.patientId)
    const nurse = patient ? nurseById.get(patient.assignedNurseId) : undefined
    const zone = nurse?.zone ?? '기타'
    const nurseId = patient?.assignedNurseId ?? ''
    const awaiting =
      order.status === 'pending' && order.activated && order.issuedAtMin != null && input.currentMinute >= order.issuedAtMin
    const elapsedMin = awaiting && order.issuedAtMin != null ? input.currentMinute - order.issuedAtMin : 0
    const isOverdue = awaiting && elapsedMin > order.targetCompletionMin
    return {
      orderId: order.id,
      patientId: order.patientId,
      nurseId,
      zone,
      elapsedMin,
      targetCompletionMin: order.targetCompletionMin,
      isOverdue,
      awaiting,
    }
  })
  const zones = new Map<string, ZoneDelaySummary>()
  for (const delay of orders) {
    if (!delay.awaiting) continue
    const zone = zones.get(delay.zone) ?? { zone: delay.zone, pendingCount: 0, overdueCount: 0, maxWaitingMin: 0 }
    zone.pendingCount += 1
    zone.maxWaitingMin = Math.max(zone.maxWaitingMin, delay.elapsedMin)
    if (delay.isOverdue) zone.overdueCount += 1
    zones.set(delay.zone, zone)
  }
  return { orders, zones: [...zones.values()].sort((a, b) => a.zone.localeCompare(b.zone, 'ko')) }
}

function alertThreshold(target: number, priority: boolean, advanceMin: number): number {
  return priority ? target - advanceMin : target
}

export function evaluateSupportSync(input: {
  nurses: WorkNurse[]
  patients: WorkPatient[]
  workloads: NurseWorkloadResult[]
  delays: OrderDelayResult[]
  existingAssignments: { targetNurseId: string; helperNurseId: string; status: 'assigned' | 'accepted' | 'rejected' | 'completed' }[]
  staffing: { level: '적정' | '주의' | '초과'; totalMin: number; capacityMin: number }
  currentMinute: number
  priorityAlertAdvanceMin: number
  highSustainMin: number
}): SupportEvaluationResult[] {
  const alerts: SupportEvaluationResult[] = []
  if (input.staffing.level === '초과') {
    alerts.push({
      id: 'staff-over',
      targetNurseId: null,
      alertStage: 3,
      reasons: ['인력 적정성 초과'],
      recommendedHelperIds: [],
      headline: `3단계, 인력 적정성 초과: 근무조 업무량 ${input.staffing.totalMin}분 / 인력 기준 ${input.staffing.capacityMin}분`,
      detail: '부서장 보고 및 추가 인력 지원 요청',
    })
  }

  const workloadById = new Map(input.workloads.map((item) => [item.nurseId, item]))
  const snapshots: HelperSnapshot[] = input.nurses.map((nurse) => {
    const workload = workloadById.get(nurse.id)
    return {
      id: nurse.id,
      name: nurse.name,
      role: nurse.role,
      unavailableReason: nurse.unavailableReason,
      totalWorkloadMin: workload?.totalWorkloadMin ?? 0,
      level: workload?.level ?? 'low',
    }
  })

  const openTargets = new Set(
    input.existingAssignments
      .filter((item) => item.status === 'assigned' || item.status === 'accepted')
      .map((item) => item.targetNurseId),
  )

  for (const nurse of input.nurses) {
    if (openTargets.has(nurse.id)) continue
    const workload = workloadById.get(nurse.id)
    if (!workload) continue
    const mine = input.patients.filter((patient) => patient.assignedNurseId === nurse.id)
    const surge = mine.find((patient) => patient.surgeKind)
    const deteriorated = mine.find((patient) => patient.deteriorationReason)
    const highRiskBeds = mine
      .filter((patient) => patient.news >= 7 && patient.previousNews < 7)
      .map((patient) => patient.id)
    const overdue = input.delays.filter((delay) => {
      if (delay.nurseId !== nurse.id || !delay.awaiting) return false
      const line = alertThreshold(delay.targetCompletionMin, nurse.isPriorityTarget, input.priorityAlertAdvanceMin)
      return delay.elapsedMin > line
    })
    const sustained =
      nurse.highSinceMin != null && input.currentMinute - nurse.highSinceMin >= input.highSustainMin && workload.level === 'high'

    const reasons: string[] = []
    let stage: 1 | 2 | 3 | 0 = 0
    let headline = ''
    let alertKey = ''
    let detail = '동료 간 자발적 지원'
    const place = nurse.zone ?? (nurse.role === 'preT' ? 'Pre-T' : nurse.role === 'supplies' ? '물품관리' : '')

    if (surge) {
      stage = 2
      alertKey = `surge-${nurse.id}`
      headline = `2단계, ${nurse.name}(${place}), 간호요구 급증 (${surge.id} ${surge.surgeKind})`
      reasons.push('간호요구 급증')
      detail = '근무조 간호사 지원 또는 환자 재배정'
    }
    if (highRiskBeds.length) {
      if (stage < 2) {
        stage = 2
        alertKey = `news-${nurse.id}`
        headline = `2단계, ${nurse.name}(${place}), NEWS 고위험 진입 (${highRiskBeds.join(', ')})`
        detail = '근무조 간호사 지원 또는 환자 재배정'
      }
      reasons.push(`NEWS 고위험 진입 (${highRiskBeds.join(', ')})`)
    }
    if (deteriorated && !surge) {
      if (stage < 2) {
        stage = 2
        alertKey = `worse-${nurse.id}`
        headline = `2단계, ${nurse.name}(${place}), 환자 악화 (${deteriorated.id})`
        detail = '근무조 간호사 지원 또는 환자 재배정'
      }
      reasons.push('환자 악화')
    }
    if (overdue.length) {
      const priorityNote = nurse.isPriorityTarget ? ', 우선 대상 지원 알림 10분 앞당김' : ''
      if (stage < 2) {
        stage = 2
        alertKey = `overdue-${nurse.id}`
        headline = `2단계, ${nurse.name}(${place}), 지연 처방 ${overdue.length}건${priorityNote}`
        detail = '근무조 간호사 지원 또는 환자 재배정'
      }
      reasons.push(`지연 처방 ${overdue.length}건${priorityNote}`)
    }
    if (sustained && !surge) {
      const minutes = nurse.highSinceMin == null ? 0 : input.currentMinute - nurse.highSinceMin
      if (stage < 2) {
        stage = 2
        alertKey = `sustain-${nurse.id}`
        headline = `2단계, ${nurse.name}(${place}), 높음 ${minutes}분 지속`
        detail = '근무조 간호사 지원 또는 환자 재배정'
      }
      reasons.push(`높음 ${minutes}분 지속`)
    }
    if (stage === 0 && (workload.level === 'high' || nurse.needHelp)) {
      stage = 1
      alertKey = `high-${nurse.id}`
      const cause = nurse.needHelp ? '지원 필요 표시' : '업무량 높음 도달'
      headline = `1단계, ${nurse.name}(${place}), ${cause}`
      reasons.push(cause)
      detail = '동료 간 자발적 지원'
    }
    if (stage === 0) continue

    const options = listHelperOptions(nurse.id, snapshots, input.existingAssignments)
    const recommended = recommendedHelperIds(options)
    const top = snapshots.find((item) => item.id === recommended[0])
    alerts.push({
      id: alertKey,
      targetNurseId: nurse.id,
      alertStage: stage,
      reasons,
      recommendedHelperIds: recommended,
      headline,
      detail: top ? `${detail}, 추천: ${top.name} (업무량 최소)` : `${detail}, 지원 가능한 인력 없음`,
    })
  }

  alerts.sort((a, b) => b.alertStage - a.alertStage || a.headline.localeCompare(b.headline, 'ko'))
  return alerts
}

export class MockEvaluationService implements EvaluationService {
  classifyOrders(input: { orders: WorkOrder[]; catalog: CatalogEntry[] }): Promise<ClassifiedOrderResult[]> {
    return Promise.resolve(classifyOrdersSync(input.orders, input.catalog))
  }

  calculateWorkloads(input: Parameters<EvaluationService['calculateWorkloads']>[0]): Promise<NurseWorkloadResult[]> {
    return Promise.resolve(calculateWorkloadsSync(input))
  }

  evaluateOrderDelays(input: {
    orders: WorkOrder[]
    patients: WorkPatient[]
    nurses: WorkNurse[]
    currentMinute: number
  }): Promise<{ orders: OrderDelayResult[]; zones: ZoneDelaySummary[] }> {
    return Promise.resolve(evaluateOrderDelaysSync(input))
  }

  evaluateSupport(input: Parameters<EvaluationService['evaluateSupport']>[0]): Promise<SupportEvaluationResult[]> {
    return Promise.resolve(evaluateSupportSync(input))
  }
}

export const mockEvaluationService = new MockEvaluationService()
