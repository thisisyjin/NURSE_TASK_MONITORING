import { demoConfig } from '../config/demoConfig'
import { applyDueContent } from '../domain/scenario'
import { staffingAdequacy } from '../domain/staffing'
import type { DemoState, Nurse } from '../domain/types'
import { mergeF2Workloads } from '../services/f2/applyF2Result'
import { runF2Shift } from '../services/f2/f2ApiClient'
import { toF2ShiftInput } from '../services/f2/f2SnapshotAdapter'
import { calculateWorkloadsSync, demoCatalog } from '../services/mock/MockEvaluationService'
import type { EvaluationService, NurseWorkloadResult, OrderDelayResult, SupportEvaluationResult, ZoneDelaySummary } from '../services/evaluation/types'
import type { StaffingResult } from '../domain/staffing'

export interface F2OverlayStatus {
  source: 'mock' | 'api'
  ok: boolean
  message: string
  version?: string
  shiftTotal?: number
  path?: string
}

export interface EvaluationView {
  nurses: Nurse[]
  statsAlerts: number
  alertSeen: Record<string, number>
  workloads: NurseWorkloadResult[]
  delays: OrderDelayResult[]
  zones: ZoneDelaySummary[]
  alerts: SupportEvaluationResult[]
  staffing: StaffingResult
  f2: F2OverlayStatus
}

export interface EvaluationRequest {
  f2Mode?: 'mock' | 'api'
  apiKey?: string
  signal?: AbortSignal
}

function workOrders(state: DemoState) {
  return state.orders.map((order) => ({
    id: order.id,
    patientId: order.patientId,
    name: order.name,
    estimatedDurationMin: order.estimatedDurationMin,
    targetCompletionMin: order.targetCompletionMin,
    issuedAtMin: order.issuedAtMin,
    scheduledAtMin: order.scheduledAtMin,
    status: order.status,
    activated: order.activated,
  }))
}

function workNurses(nurses: Nurse[]) {
  return nurses.map((nurse) => ({
    id: nurse.id,
    name: nurse.name,
    role: nurse.role,
    zone: nurse.zone,
    baseLevel: nurse.baseLevel,
    isPriorityTarget: nurse.isPriorityTarget,
    needHelp: nurse.needHelp,
    unavailableReason: nurse.unavailableReason,
    highSinceMin: nurse.highSinceMin,
  }))
}

function workPatients(state: DemoState) {
  return state.patients.map((patient) => ({
    id: patient.id,
    assignedNurseId: patient.assignedNurseId,
    ktas: patient.ktas,
    news: patient.news,
    previousNews: patient.previousNews,
    vitalIntervalMin: patient.vitalIntervalMin,
    surgeKind: patient.surgeKind,
    deteriorationReason: patient.deteriorationReason,
  }))
}

export function advanceClock(state: DemoState, minutes: number, stamp: (state: DemoState) => DemoState): DemoState {
  let next = state
  const target = state.nowMin + minutes
  while (next.nowMin < target) {
    next = { ...next, nowMin: next.nowMin + 1 }
    next = applyDueContent(next)
    if (next.nowMin % 5 === 0) next = stamp(next)
  }
  return stamp(next)
}

export function stampHighSince(state: DemoState): DemoState {
  const workloads = calculateWorkloadsSync({
    nurses: workNurses(state.nurses),
    patients: workPatients(state),
    orders: workOrders(state),
    currentMinute: state.nowMin,
    patientCapacityMinutes: demoConfig.patientCapacityMin,
  })
  let changed = false
  const nurses = state.nurses.map((nurse) => {
    if (nurse.role !== 'assigned') return nurse
    const level = workloads.find((item) => item.nurseId === nurse.id)?.level
    if (level === 'high') {
      if (nurse.highSinceMin == null) {
        changed = true
        return { ...nurse, highSinceMin: state.nowMin }
      }
      return nurse
    }
    if (nurse.highSinceMin != null) {
      changed = true
      return { ...nurse, highSinceMin: null }
    }
    return nurse
  })
  return changed ? { ...state, nurses } : state
}

export async function runEvaluation(
  service: EvaluationService,
  source: DemoState,
  request: EvaluationRequest = {},
): Promise<EvaluationView> {
  const state = stampHighSince(source)
  const orders = workOrders(state)
  const catalog = demoCatalog()
  const classified = await service.classifyOrders({ orders, catalog })
  const priced = orders.map((order) => {
    const found = classified.find((item) => item.orderId === order.id)
    const estimatedDurationMin =
      found?.matched && found.estimatedDurationMin != null
        ? found.estimatedDurationMin
        : found?.usedDemoFallback
          ? demoConfig.unmatchedOrderMin
          : order.estimatedDurationMin
    return { ...order, estimatedDurationMin }
  })
  let workloads = await service.calculateWorkloads({
    nurses: workNurses(state.nurses),
    patients: workPatients(state),
    orders: priced,
    currentMinute: state.nowMin,
    patientCapacityMinutes: demoConfig.patientCapacityMin,
  })
  let f2: F2OverlayStatus = { source: 'mock', ok: true, message: 'Mock 사용 중' }
  if (request.f2Mode === 'api') {
    try {
      const called = await runF2Shift(toF2ShiftInput(state, `ui_${state.nowMin}`), {
        apiKey: request.apiKey ?? '',
        signal: request.signal,
      })
      workloads = mergeF2Workloads(workloads, called.result)
      f2 = {
        source: 'api',
        ok: true,
        message: 'F2 API 결과',
        version: called.result.calculation_version,
        shiftTotal: called.result.shift_summary.total_minutes,
        path: called.path,
      }
    } catch (error) {
      if (request.signal?.aborted) throw error
      const message = error instanceof Error ? error.message : 'F2 API 호출에 실패했습니다.'
      f2 = { source: 'mock', ok: false, message: `${message} Mock 사용 중` }
    }
  }
  const delayResult = await service.evaluateOrderDelays({
    orders,
    patients: workPatients(state),
    nurses: workNurses(state.nurses),
    currentMinute: state.nowMin,
  })
  const totalByNurse = Object.fromEntries(workloads.map((item) => [item.nurseId, item.totalWorkloadMin]))
  const staffing = staffingAdequacy({
    nurses: state.nurses,
    patients: state.patients,
    totalByNurse,
    extraStaff: state.extraStaff,
  })
  const alerts = await service.evaluateSupport({
    nurses: workNurses(state.nurses),
    patients: workPatients(state),
    workloads,
    delays: delayResult.orders,
    manualSupportRequests: state.nurses.filter((nurse) => nurse.needHelp).map((nurse) => nurse.id),
    existingAssignments: state.supports.map((support) => ({
      targetNurseId: support.targetNurseId,
      helperNurseId: support.helperNurseId,
      status: support.status,
    })),
    staffing,
    currentMinute: state.nowMin,
    priorityAlertAdvanceMin: demoConfig.priorityAlertAdvanceMin,
    highSustainMin: demoConfig.highSustainMin,
  })

  const alertSeen = { ...state.alertSeen }
  let statsAlerts = state.stats.alerts
  for (const alert of alerts) {
    if (alertSeen[alert.id] == null) {
      alertSeen[alert.id] = state.nowMin
      statsAlerts += 1
    }
  }
  for (const key of Object.keys(alertSeen)) {
    if (!alerts.some((alert) => alert.id === key)) delete alertSeen[key]
  }

  return {
    nurses: state.nurses,
    statsAlerts,
    alertSeen,
    workloads,
    delays: delayResult.orders,
    zones: delayResult.zones,
    alerts,
    staffing,
    f2,
  }
}
