import {
  ARTIFACT,
  CATALOG_MAP,
  DUE_BY_ORDER,
  FULL_VIEWS,
  KTAS_LOAD,
  NEWS_BANDS,
  ROLE_BASE_LEVEL,
} from '../../config/artifactConfig'
import type {
  AlertItem,
  AlertStage,
  ArtifactNurse,
  ArtifactOrder,
  ArtifactPatient,
  ArtifactState,
  ArtifactSupport,
  CapacityResult,
  LevelCode,
  OrderWorkStatus,
  WorkloadBreakdown,
  ZoneTimelinessRow,
} from './types'

export function formatClock(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
}

export function isFullView(view: string): boolean {
  return view in FULL_VIEWS
}

export function newsBand(value: number | null): number {
  if (value == null) return -1
  if (value >= 7) return 3
  if (value >= 5) return 2
  if (value >= 2) return 1
  return 0
}

export function newsBandLabel(value: number | null): string {
  const band = newsBand(value)
  return band < 0 ? '' : NEWS_BANDS[band]
}

export function newsRaised(patient: ArtifactPatient): boolean {
  return patient.news != null && patient.newsPrev != null && newsBand(patient.news) > newsBand(patient.newsPrev)
}

export function newsLoad(value: number | null): number {
  if (value == null) return 0
  if (value >= 7) return 10
  if (value >= 5) return 5
  return 0
}

export function vitalLoad(patient: ArtifactPatient): number {
  return Math.round((60 / patient.vs) * ARTIFACT.vitalMinutesPerCheck)
}

export function vitalLabel(intervalMin: number): string {
  return intervalMin >= 60 ? `${intervalMin / 60}시간마다` : `${intervalMin}분마다`
}

export function vitalPeriodLabel(intervalMin: number): string {
  if (intervalMin >= 60 && intervalMin % 60 === 0) return `활력 주기: ${intervalMin / 60}시간`
  return `활력 주기: ${intervalMin}분`
}

export function orderStatus(order: ArtifactOrder): OrderWorkStatus {
  return order.status ?? 'pending'
}

export function countsTowardWorkload(order: ArtifactOrder): boolean {
  return orderStatus(order) !== 'completed'
}

export function isActivePending(order: ArtifactOrder): boolean {
  return orderStatus(order) === 'pending'
}

export function dueOf(nurse: ArtifactNurse, order: ArtifactOrder): number {
  const base = DUE_BY_ORDER[order.name] ?? ARTIFACT.defaultDueMin
  return Math.max(ARTIFACT.minimumDueMin, base - (nurse.prio ? ARTIFACT.priorityEarlyMin : 0))
}

export function minutesLevel(minutes: number): LevelCode {
  if (minutes > ARTIFACT.levelHighAbove) return 'hi'
  if (minutes >= ARTIFACT.levelLowBelow) return 'mid'
  return 'ok'
}

export function activeSupport(support: ArtifactSupport): boolean {
  return !support.end && support.accepted
}

export function supportFrom(state: ArtifactState, nurseId: string): ArtifactSupport | undefined {
  return state.supports.find((support) => support.from === nurseId && !support.end)
}

export function findNurse(state: ArtifactState, nurseId: string): ArtifactNurse | undefined {
  return state.nurses.find((nurse) => nurse.id === nurseId)
}

export function loadOf(state: ArtifactState, nurse: ArtifactNurse): WorkloadBreakdown | null {
  if (!nurse.patients.length) return null
  let base = 0
  let vsl = 0
  let pend = 0
  let late = 0
  for (const patient of nurse.patients) {
    base += (KTAS_LOAD[patient.ktas] ?? 0) + newsLoad(patient.news)
    vsl += vitalLoad(patient)
    for (const order of patient.orders) {
      if (!countsTowardWorkload(order)) continue
      pend += order.min
      if (isActivePending(order) && state.t - order.at >= dueOf(nurse, order)) late += 1
    }
  }
  let forecast = base + vsl + pend
  for (const patient of nurse.patients) {
    for (const [name, at] of patient.sched) {
      if (at - state.t <= ARTIFACT.forecastWindowMin) forecast += CATALOG_MAP[name].min
    }
    if (newsRaised(patient)) forecast += ARTIFACT.forecastNewsRiseMin
  }
  const sups = state.supports.filter((support) => support.to === nurse.id && activeSupport(support))
  let now = base + vsl + pend
  if (sups.length) {
    const factor = Math.max(ARTIFACT.supportReliefFloor, 1 - ARTIFACT.supportReliefPerHelper * sups.length)
    now = Math.round(now * factor)
    forecast = Math.round(forecast * factor)
  }
  const ev = state.events.find((event) => event.nurse === nurse.id && !event.end)
  return { now, base, vsl, pend, late, fc: forecast, sup: sups[0], sups, ev }
}

export function levelOf(state: ArtifactState, nurse: ArtifactNurse): LevelCode {
  const load = loadOf(state, nurse)
  if (!load) return ROLE_BASE_LEVEL[nurse.role] || 'ok'
  if (load.ev) return 'hi'
  return minutesLevel(load.now)
}

export function capacityOf(state: ArtifactState): CapacityResult {
  const assigned = state.nurses.filter((nurse) => nurse.patients.length)
  const total = assigned.reduce((sum, nurse) => sum + (loadOf(state, nurse)?.now ?? 0), 0)
  const limit = assigned.length * ARTIFACT.capacityPerAssignedNurse
  const level: LevelCode = total > limit ? 'hi' : total > limit * ARTIFACT.capacityCautionRatio ? 'mid' : 'ok'
  return { total, limit, n: assigned.length, level }
}

export function eligibleHelpers(state: ArtifactState, targetId: string, exclude: string[] = []): ArtifactNurse[] {
  return state.nurses
    .filter(
      (nurse) =>
        nurse.id !== targetId &&
        !exclude.includes(nurse.id) &&
        !supportFrom(state, nurse.id) &&
        !nurse.prio &&
        levelOf(state, nurse) !== 'hi' &&
        !state.decline.some((item) => item.from === nurse.id && item.to === targetId),
    )
    .sort(
      (a, b) =>
        (levelOf(state, a) === 'ok' ? 0 : 1) - (levelOf(state, b) === 'ok' ? 0 : 1) ||
        (loadOf(state, a)?.now ?? 0) - (loadOf(state, b)?.now ?? 0),
    )
}

export function recommendNurse(state: ArtifactState, targetId: string, exclude: string[] = []): ArtifactNurse | undefined {
  return eligibleHelpers(state, targetId, exclude)[0]
}

export function assignmentBlockReason(state: ArtifactState, fromId: string, targetId: string): string | null {
  if (fromId === targetId) return '본인에게는 지원을 배정할 수 없습니다.'
  if (!findNurse(state, fromId) || !findNurse(state, targetId)) return '간호사를 찾지 못했습니다.'
  if (state.supports.some((support) => support.to === targetId && !support.end)) return '이미 응답을 기다리거나 지원이 진행 중입니다.'
  if (!eligibleHelpers(state, targetId).some((nurse) => nurse.id === fromId)) return '이 간호사는 지금 지원 후보가 아닙니다.'
  return null
}

export interface NurseQueueSummary {
  pendingCount: number
  maxWaitMin: number
  acknowledgedCount: number
  ktas1: number
  ktas2: number
}

export function nurseQueue(state: ArtifactState, nurse: ArtifactNurse): NurseQueueSummary {
  const orders = nurse.patients.flatMap((patient) => patient.orders)
  const pending = orders.filter((order) => isActivePending(order))
  const maxWaitMin = pending.reduce((max, order) => Math.max(max, Math.max(0, state.t - order.at)), 0)
  return {
    pendingCount: pending.length,
    maxWaitMin: pending.length ? maxWaitMin : 0,
    acknowledgedCount: orders.filter((order) => orderStatus(order) === 'acknowledged').length,
    ktas1: nurse.patients.filter((patient) => patient.ktas === 1).length,
    ktas2: nurse.patients.filter((patient) => patient.ktas === 2).length,
  }
}

export function buildAlerts(state: ArtifactState): AlertItem[] {
  const list: AlertItem[] = []
  if (state.cpr && !state.cpr.closed) {
    const elapsed = state.t - state.cpr.start
    const phase =
      state.cpr.phase === 0
        ? `CPR 진행 중 (${elapsed}분 경과)`
        : state.cpr.phase === 1
          ? `ROSC (${formatClock(state.cpr.rosc ?? state.t)}), 소생 후 처치`
          : '안정화, 중환자실 입원 준비'
    const team = state.supports.filter((support) => support.to === 'n6' && support.cpr && !support.end)
    const event = state.events.find((item) => item.pid === 'R-01' && !item.end)
    const teamText = team.length
      ? `CPR 팀: ${team.map((support) => `${findNurse(state, support.from)?.name ?? support.from}(${support.role ?? ''})`).join(', ')}, 응급전문간호사 현장 지원`
      : 'CPR 팀 즉시 배정 (흉부압박 교대, 약물 투여 및 기록), 응급전문간호사 현장 지원'
    list.push({
      st: 'E',
      cpr: true,
      txt: `소생실 R-01 CPCR, ${phase}, 한지호 '높음' (사유: ${event ? event.type : 'CPCR'})`,
      act: teamText,
    })
  }
  const capacity = capacityOf(state)
  if (capacity.total > capacity.limit) {
    const sustained = state.cap3Since != null && state.t - state.cap3Since >= ARTIFACT.capacitySustainedMin
    const teamUrgent = Boolean(state.cpr && !state.cpr.closed && state.supports.some((support) => support.cpr && !support.end))
    if (sustained || teamUrgent) {
      list.push({
        st: 4,
        aplus: !findNurse(state, 'n7'),
        txt: `인력 부족 지속${teamUrgent ? ' (CPR 팀 투입으로 구역 공백)' : ' (3단계 30분 이상)'}, 근무조 업무량 ${capacity.total}분 / 인력 기준 ${capacity.limit}분`,
        act: '간호관리자, 부서 간 지원 검토 (A-plus팀)',
      })
    } else {
      list.push({
        st: 3,
        txt: `인력 적정성 초과: 근무조 업무량 ${capacity.total}분 / 인력 기준 ${capacity.limit}분`,
        act: '간호관리자 보고 및 추가 인력 지원 요청',
      })
    }
  }
  for (const nurse of state.nurses) {
    const load = loadOf(state, nurse)
    const level = levelOf(state, nurse)
    const help = state.help[nurse.id]
    if (nurse.id === 'n6' && state.cpr && !state.cpr.closed) continue
    if (load?.ev && !load.sup) {
      list.push({
        st: 2,
        nurse: nurse.id,
        txt: `${nurse.name} (${nurse.role}), 간호요구 급증: ${load.ev.type} (${load.ev.pid})`,
        act: '즉시 근무조 간호사 지원, 담당 환자 재배정',
      })
      continue
    }
    if (load?.sup) continue
    if (level === 'hi' || help) {
      const since = state.hiSince[nurse.id]
      const sustained = since != null && state.t - since >= ARTIFACT.highSustainedMin
      const stage = sustained ? 2 : 1
      const why = help ? '지원 필요 표시' : sustained ? "업무 단계 '높음' 30분 이상" : "업무 단계: 높음"
      list.push({
        st: stage,
        nurse: nurse.id,
        txt: `${nurse.name}, ${why}`,
        act: stage === 2 ? '지원 또는 환자 재배정 검토' : '동료 지원 검토',
      })
    }
  }
  const rank: Record<AlertStage, number> = { E: 9, 4: 4, 3: 3, 2: 2, 1: 1, 0: 0 }
  return list.sort((a, b) => rank[b.st] - rank[a.st])
}

export function zoneTimeliness(state: ArtifactState): ZoneTimelinessRow[] {
  return state.nurses
    .filter((nurse) => nurse.patients.length)
    .map((nurse) => {
      const orders = nurse.patients.flatMap((patient) => patient.orders)
      const pending = orders.filter((order) => isActivePending(order))
      const maxWaitMin = pending.reduce((max, order) => Math.max(max, Math.max(0, state.t - order.at)), 0)
      const overdueCount = pending.filter((order) => state.t - order.at >= dueOf(nurse, order)).length
      return {
        zone: nurse.role,
        pendingCount: pending.length,
        maxWaitMin: pending.length ? maxWaitMin : 0,
        acknowledgedCount: orders.filter((order) => orderStatus(order) === 'acknowledged').length,
        overdueCount,
      }
    })
}

/** 높음 지속 시각과 인력 초과 지속 시각을 시연 시각 기준으로 갱신한다. */
export function trackHigh(state: ArtifactState): void {
  for (const nurse of state.nurses) {
    const high = levelOf(state, nurse) === 'hi'
    if (high && state.hiSince[nurse.id] == null) state.hiSince[nurse.id] = state.t
    if (!high) delete state.hiSince[nurse.id]
  }
  const capacity = capacityOf(state)
  if (capacity.total > capacity.limit) {
    if (state.cap3Since == null) state.cap3Since = state.t
  } else state.cap3Since = null
}
