import { ARTIFACT, CATALOG_MAP, ORDER_CATALOG, SURGE_TYPES } from '../../config/artifactConfig'
import { findNurse, supportFrom, trackHigh } from './rules'
import { createInitialArtifactState } from './initialState'
import type { ArtifactOrder, ArtifactPatient, ArtifactState, ArtifactSupport } from './types'

export interface ActionResult {
  state: ArtifactState
  toast?: string
}

type Rand = () => number

const randomOf = (rand: Rand = Math.random) => rand

function cloneState(state: ArtifactState): ArtifactState {
  return structuredClone(state)
}

function issue(state: ArtifactState, name: string, at: number): ArtifactOrder {
  const meta = CATALOG_MAP[name]
  state.seq += 1
  return { id: state.seq, name, at, cat: meta.cat, min: meta.min }
}

function pick<T>(items: T[], rand: Rand): T {
  return items[Math.floor(rand() * items.length)]
}

function openSupportFrom(state: ArtifactState, nurseId: string): ArtifactSupport | undefined {
  return supportFrom(state, nurseId)
}

function startSupport(state: ArtifactState, from: string, to: string, extra: Partial<ArtifactSupport> = {}) {
  state.supports.push({
    from,
    to,
    start: state.t,
    end: null,
    tasks: 0,
    accepted: false,
    ...extra,
  })
  delete state.help[to]
}

function advanceCpcr(state: ArtifactState): string | undefined {
  const cpr = state.cpr
  if (!cpr || cpr.closed) return
  const patient = state.nurses.flatMap((nurse) => nurse.patients).find((item) => item.id === 'R-01')
  if (!patient) return
  const owner = state.nurses.find((nurse) => nurse.patients.includes(patient))
  if (!owner) return
  const elapsed = state.t - cpr.start
  if (cpr.phase === 0 && elapsed >= 15) {
    cpr.phase = 1
    cpr.rosc = cpr.start + 15
    patient.orders = patient.orders.filter((order) => order.name !== 'CPR 진행' && order.name !== '에피네프린 투여')
    patient.news = 9
    patient.newsPrev = 9
    patient.vs = 15
    patient.avpu = 'U'
    for (const name of ['A-line 삽입 준비·보조', 'Central line 삽입 준비·보조', '승압제 투여 시작']) {
      patient.orders.push(issue(state, name, state.t))
    }
    const event = state.events.find((item) => item.nurse === owner.id && !item.end)
    if (event) event.type = 'ROSC 후 집중 처치'
    return `R-01 ROSC (${String(Math.floor((cpr.rosc ?? state.t) / 60)).padStart(2, '0')}:${String((cpr.rosc ?? state.t) % 60).padStart(2, '0')}), 소생 후 처치 처방 3건 발생, 한지호 '높음' 유지`
  }
  if (cpr.phase === 1 && elapsed >= 30) {
    cpr.phase = 2
    patient.newsPrev = patient.news
    patient.news = 7
    patient.vs = 30
    patient.orders.push(issue(state, '중환자실 입원 준비', state.t))
    return 'R-01 안정화, 중환자실 입원 준비, CPR 팀 지원 종료 가능'
  }
  return
}

function beginCpcr(state: ArtifactState): string {
  const nurse = findNurse(state, 'n6')
  if (!nurse) return '소생실 담당 간호사를 찾지 못했습니다.'
  const current = openSupportFrom(state, 'n6')
  if (current) {
    if (current.accepted) {
      current.end = Math.max(state.t, current.start + ARTIFACT.minimumSupportMin)
      state.supMin.n6 = (state.supMin.n6 ?? 0) + (current.end - current.start)
    } else {
      state.supports = state.supports.filter((support) => support !== current)
    }
  }
  const patient: ArtifactPatient = {
    id: 'R-01',
    nm: '무명남',
    bed: '소생실 01',
    reg: '49010137 (신원 미확인)',
    ktas: 1,
    news: null,
    newsPrev: null,
    vs: 5,
    avpu: 'U',
    cpr: true,
    orders: [
      issue(state, 'CPR 진행', state.t),
      issue(state, '에피네프린 투여', state.t),
      issue(state, 'Intubation 준비·보조', state.t),
      issue(state, '채혈', state.t),
    ],
    sched: [],
  }
  nurse.patients.push(patient)
  state.events.push({ nurse: 'n6', pid: 'R-01', type: 'CPCR', start: state.t, end: null })
  state.cpr = { start: state.t, phase: 0, rosc: null, closed: false }
  if (!(state.view === 'leader' || state.view === 'np')) state.view = 'leader'
  const clock = `${String(Math.floor(state.t / 60)).padStart(2, '0')}:${String(state.t % 60).padStart(2, '0')}`
  return `${clock} 소생실 R-01 CPCR 환자 내원 (내원 시 심정지), 한지호 즉시 '높음'${current ? ', 진행 중이던 지원 자동 종료' : ''}, 긴급 알림`
}

function addOrder(state: ArtifactState, silent: boolean, rand: Rand): string | undefined {
  const pairs = state.nurses.flatMap((nurse) => nurse.patients.filter((patient) => !patient.cpr).map((patient) => ({ nurse, patient })))
  if (!pairs.length) return silent ? undefined : '처방할 환자가 없습니다.'
  const chosen = pick(pairs, rand)
  const pool = ORDER_CATALOG.filter((item) => !item[3])
  const name = pick(pool, rand)[0]
  const meta = CATALOG_MAP[name]
  if (meta.cat === 'H' && rand() < 0.5) chosen.patient.sched.push([name, state.t + 30 + Math.floor(rand() * 3) * 10])
  else chosen.patient.orders.push(issue(state, name, state.t))
  if (silent) return
  return `${chosen.patient.id} ${chosen.patient.nm} 처방 발생: ${name} (${meta.min}분, 담당 ${chosen.nurse.name})`
}

function moveNews(patient: ArtifactPatient, rand: Rand) {
  if (patient.news == null) return
  patient.newsPrev = patient.news
  if (rand() < 0.18) patient.news = Math.min(9, patient.news + 1 + (rand() < 0.3 ? 1 : 0))
  else if (rand() < 0.15 && patient.news > 0) patient.news -= 1
}

export function withView(state: ArtifactState, view: string): ActionResult {
  const next = cloneState(state)
  next.view = view
  return { state: next }
}

export function stepMinutes(state: ArtifactState, minutes: number, rand: Rand = Math.random): ActionResult {
  const next = cloneState(state)
  const random = randomOf(rand)
  next.t += minutes
  for (const nurse of next.nurses) {
    for (const patient of nurse.patients) {
      if (patient.cpr) continue
      moveNews(patient, random)
      patient.sched = patient.sched.filter(([name, at]) => {
        if (at <= next.t) {
          patient.orders.push(issue(next, name, at))
          return false
        }
        return true
      })
      if (patient.news != null && patient.news >= 7) {
        if (patient.vs > 15) patient.vs = 15
        if (random() < 0.4) {
          patient.orders.push(issue(next, pick(['정맥 주사(IV push)', '채혈', 'A-line 삽입 준비·보조'], random), next.t))
        }
      } else if (patient.news != null && patient.news >= 5 && patient.vs > 60) patient.vs = 60
    }
  }
  let toast: string | undefined
  if (!next.cpr && next.t >= ARTIFACT.cpcrAtMin) toast = beginCpcr(next)
  else toast = advanceCpcr(next)
  if (random() < 0.7) addOrder(next, true, random)
  trackHigh(next)
  return { state: next, toast }
}

export function spawnOrder(state: ArtifactState, rand: Rand = Math.random): ActionResult {
  const next = cloneState(state)
  const toast = addOrder(next, false, randomOf(rand))
  trackHigh(next)
  return { state: next, toast }
}

export function triggerSurge(state: ArtifactState, rand: Rand = Math.random): ActionResult {
  const next = cloneState(state)
  const random = randomOf(rand)
  if (!next.demoEvent) {
    const nurse = findNurse(next, 'n4')
    const patient = nurse?.patients.find((item) => item.id === '5-02')
    if (!nurse || !patient || patient.news == null) return { state, toast: '첫 간호요구 급증 대상 환자를 찾지 못했습니다.' }
    next.demoEvent = 1
    const previous = patient.news
    patient.newsPrev = patient.news
    patient.news = 5
    patient.avpu = 'V'
    if (patient.vs > 60) patient.vs = 60
    next.events.push({ nurse: nurse.id, pid: patient.id, type: '환자 상태 악화', start: next.t, end: null })
    trackHigh(next)
    return {
      state: next,
      toast: `간호요구 급증: 5-02 ${patient.nm} NEWS ${previous} → 5 (양호 → 위험), AVPU A → V, 담당 최민준 즉시 '높음'`,
    }
  }
  const candidates = next.nurses.filter((nurse) => nurse.patients.length && !next.events.some((event) => event.nurse === nurse.id && !event.end))
  if (!candidates.length) return { state, toast: '모든 환자 담당 간호사에게 간호요구 급증 상황이 진행 중입니다.' }
  const nurse = pick(candidates, random)
  const patients = nurse.patients.filter((patient) => !patient.cpr)
  const patient = pick(patients, random)
  const type = pick([...SURGE_TYPES], random)
  next.events.push({ nurse: nurse.id, pid: patient.id, type, start: next.t, end: null })
  trackHigh(next)
  return { state: next, toast: `간호요구 급증: ${type} (${patient.id} ${patient.nm}, 담당 ${nurse.name})` }
}

export function triggerCpcr(state: ArtifactState): ActionResult {
  if (state.cpr) {
    return {
      state,
      toast: state.cpr.closed ? '이번 시연의 CPCR 상황은 종료되었습니다. 초기화 후 다시 시연하세요.' : '소생실 CPCR 상황이 진행 중입니다.',
    }
  }
  const next = cloneState(state)
  const toast = beginCpcr(next)
  trackHigh(next)
  return { state: next, toast }
}

export function completeOrder(state: ArtifactState, ownerId: string, patientId: string, orderId: number, performerId: string): ActionResult {
  const next = cloneState(state)
  const nurse = findNurse(next, ownerId)
  const patient = nurse?.patients.find((item) => item.id === patientId)
  const index = patient?.orders.findIndex((order) => order.id === orderId) ?? -1
  if (!nurse || !patient || index < 0) return { state }
  const [order] = patient.orders.splice(index, 1)
  next.done[performerId] = (next.done[performerId] ?? 0) + order.min
  if (performerId !== ownerId) {
    const support = next.supports.find((item) => item.from === performerId && item.to === ownerId && !item.end && item.accepted)
    if (support) support.tasks += 1
  }
  trackHigh(next)
  return { state: next, toast: `${patient.id} ${order.name} 수행 기록, 수행자 ${findNurse(next, performerId)?.name ?? performerId} (${order.min}분 귀속)` }
}

export function toggleHelp(state: ArtifactState, nurseId: string): ActionResult {
  const next = cloneState(state)
  next.help[nurseId] = !next.help[nurseId]
  if (!next.help[nurseId]) delete next.help[nurseId]
  trackHigh(next)
  return { state: next, toast: next.help[nurseId] ? '"지원 필요"를 표시했습니다.' : '"지원 필요" 표시를 해제했습니다.' }
}

export function assignSupport(state: ArtifactState, from: string, to: string): ActionResult {
  const next = cloneState(state)
  startSupport(next, from, to)
  trackHigh(next)
  return {
    state: next,
    toast: `${findNurse(next, from)?.name ?? from} 간호사에게 지원 배정 알림을 보냈습니다. 간호사 화면에서 수락하면 지원이 시작됩니다.`,
  }
}

export function acceptSupport(state: ArtifactState, from: string): ActionResult {
  const next = cloneState(state)
  const support = openSupportFrom(next, from)
  if (!support) return { state }
  support.accepted = true
  support.start = next.t
  trackHigh(next)
  return { state: next, toast: `${findNurse(next, from)?.name} → ${findNurse(next, support.to)?.name} 지원 수락, ${findNurse(next, support.to)?.name} 화면이 함께 표시됩니다.` }
}

export function declineSupport(state: ArtifactState, from: string, why: string): ActionResult {
  const next = cloneState(state)
  const support = openSupportFrom(next, from)
  if (!support) return { state }
  next.supports = next.supports.filter((item) => item !== support)
  next.decline.push({ from, to: support.to, t: next.t, why })
  trackHigh(next)
  return { state: next, toast: `지원 거절, 사유: ${why}. 근무조 리더간호사 화면에 다른 지원자가 추천됩니다.` }
}

export function togglePriority(state: ArtifactState, nurseId: string): ActionResult {
  const next = cloneState(state)
  const nurse = findNurse(next, nurseId)
  if (!nurse) return { state }
  nurse.prio = !nurse.prio
  trackHigh(next)
  return {
    state: next,
    toast: nurse.prio
      ? `${nurse.name} 간호사를 지원 우선 대상으로 지정했습니다. 알림 기준을 ${ARTIFACT.priorityEarlyMin}분 앞당겨 적용합니다.`
      : `${nurse.name} 간호사의 지원 우선 대상 지정을 해제했습니다.`,
  }
}

export function endSurge(state: ArtifactState, nurseId: string): ActionResult {
  const next = cloneState(state)
  const event = next.events.find((item) => item.nurse === nurseId && !item.end)
  if (!event) return { state }
  event.end = next.t
  if (event.pid === 'R-01' && next.cpr) {
    next.cpr.closed = true
    for (const support of next.supports.filter((item) => item.cpr && !item.end)) {
      support.end = Math.max(next.t, support.start + ARTIFACT.minimumSupportMin)
      next.supMin[support.from] = (next.supMin[support.from] ?? 0) + (support.end - support.start)
    }
    trackHigh(next)
    return { state: next, toast: 'CPCR 상황 종료, CPR 팀 지원 기록을 저장했습니다.' }
  }
  trackHigh(next)
  return { state: next, toast: `간호요구 급증 상황 종료, ${event.type} (${event.pid})` }
}

export function endSupport(state: ArtifactState, from: string): ActionResult {
  const next = cloneState(state)
  const support = openSupportFrom(next, from)
  if (!support) return { state }
  support.end = Math.max(next.t, support.start + ARTIFACT.minimumSupportMin)
  next.supMin[from] = (next.supMin[from] ?? 0) + (support.end - support.start)
  trackHigh(next)
  return { state: next, toast: `지원 종료, ${support.end - support.start}분, 수행 ${support.tasks}건 기록` }
}

export function endCprTeam(state: ArtifactState): ActionResult {
  const next = cloneState(state)
  const team = next.supports.filter((support) => support.cpr && !support.end)
  for (const support of team) {
    support.end = Math.max(next.t, support.start + ARTIFACT.minimumSupportMin)
    next.supMin[support.from] = (next.supMin[support.from] ?? 0) + (support.end - support.start)
  }
  trackHigh(next)
  const summary = team.map((support) => `${findNurse(next, support.from)?.name ?? support.from} ${support.end! - support.start}분`).join(', ')
  return { state: next, toast: `CPR 팀 지원 종료, ${summary} 기록, 원래 구역으로 복귀` }
}

export function assignCprTeam(state: ArtifactState, firstId: string, secondId: string): ActionResult {
  const next = cloneState(state)
  const members: Array<[string, string]> = [
    [firstId, '흉부압박 교대'],
    [secondId, '약물 투여·기록'],
  ]
  for (const [id, role] of members) {
    if (!id) continue
    next.supports.push({ from: id, to: 'n6', start: next.t, end: null, tasks: 0, accepted: true, cpr: true, role })
  }
  trackHigh(next)
  return { state: next, toast: 'CPR 팀 배정 (긴급, 자동 수락), 팀원 구역에 공백이 생겨 4단계 알림을 확인하세요.' }
}

export function requestAplus(state: ArtifactState): ActionResult {
  const next = cloneState(state)
  if (findNurse(next, 'n7')) return { state, toast: 'A-plus 지원간호사가 이미 근무조에 있습니다.' }
  next.nurses.push({ id: 'n7', name: 'A-plus 지원간호사', role: 'A-plus 지원', patients: [] })
  next.done.n7 = 0
  next.supMin.n7 = 0
  const team = next.supports
    .filter((support) => support.cpr && !support.end)
    .map((support) => findNurse(next, support.from))
    .filter((nurse): nurse is NonNullable<typeof nurse> => Boolean(nurse))
    .sort((a, b) => b.patients.length - a.patients.length)
  if (next.cpr && !next.cpr.closed && team.length && team[0].patients.length) {
    const source = team[0]
    const helper = findNurse(next, 'n7')
    if (!helper) return { state }
    helper.patients = source.patients
    source.patients = []
    helper.role = `${source.role} (A-plus 지원)`
    source.coverBy = 'n7'
    trackHigh(next)
    return { state: next, toast: `A-plus팀 지원 도착, ${source.name}(CPR 팀)의 ${source.role} 환자 ${helper.patients.length}명 임시 담당` }
  }
  trackHigh(next)
  return { state: next, toast: 'A-plus팀 지원 간호사가 근무조에 합류했습니다. 지원 배정 대상으로 추천됩니다.' }
}

export function resetArtifact(): ActionResult {
  return { state: createInitialArtifactState(), toast: '초기 상태로 되돌렸습니다.' }
}
