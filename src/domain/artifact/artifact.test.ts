import { describe, expect, it } from 'vitest'
import { ARTIFACT } from '../../config/artifactConfig'
import {
  acceptSupport,
  acknowledgeOrder,
  assignSupport,
  endSupport,
  requestAplus,
  completeOrder,
  declineSupport,
  resetArtifact,
  returnOrderToPending,
  stepMinutes,
  triggerCpcr,
  triggerSurge,
} from './actions'
import { createInitialArtifactState } from './initialState'
import { assignmentBlockReason, buildAlerts, capacityOf, dueOf, elapsedPendingMin, findNurse, loadOf, levelOf, minutesLevel, newsRaised, nurseQueue, recommendNurse, zoneTimeliness } from './rules'

const fixed = () => 0.99

function nurseLoad(id: string, state = createInitialArtifactState()) {
  const nurse = findNurse(state, id)
  if (!nurse) throw new Error(id)
  return { nurse, load: loadOf(state, nurse), level: levelOf(state, nurse) }
}

describe('최신 Artifact 09:00', () => {
  it('간호사별 업무량과 단계가 원본 초기 화면과 같다', () => {
    const state = createInitialArtifactState()
    expect(nurseLoad('n1', state).load).toMatchObject({ base: 40, vsl: 4, pend: 83, now: 127, fc: 167, late: 2 })
    expect(nurseLoad('n1', state).level).toBe('hi')
    expect(nurseLoad('n2', state).load).toMatchObject({ base: 15, vsl: 1, pend: 15, now: 31, fc: 41, late: 0 })
    expect(nurseLoad('n2', state).level).toBe('mid')
    expect(nurseLoad('n3', state).load).toMatchObject({ base: 25, vsl: 3, pend: 25, now: 53, fc: 63, late: 0 })
    expect(nurseLoad('n3', state).level).toBe('hi')
    expect(nurseLoad('n4', state).load).toMatchObject({ base: 8, vsl: 0, pend: 3, now: 11, fc: 11, late: 0 })
    expect(nurseLoad('n4', state).level).toBe('ok')
    expect(nurseLoad('n5', state).load).toMatchObject({ base: 26, vsl: 0, pend: 8, now: 34, fc: 44, late: 0 })
    expect(nurseLoad('n5', state).level).toBe('ok')
    expect(nurseLoad('n6', state).load).toBeNull()
    expect(nurseLoad('n6', state).level).toBe('ok')
    expect(elapsedPendingMin(state, findNurse(state, 'n1')!)).toBe(95)
    expect(elapsedPendingMin(state, findNurse(state, 'n3')!)).toBe(20)
    expect(elapsedPendingMin(state, findNurse(state, 'n6')!)).toBe(0)
  })

  it('인력 적정성은 환자 담당 간호사 5명 x 50분으로 256/250 초과다', () => {
    const capacity = capacityOf(createInitialArtifactState())
    expect(capacity).toMatchObject({ total: 256, limit: 250, n: 5, level: 'hi' })
  })

  it('초기 알림은 인력 3단계와 KTAS 2 담당 간호사 두 명의 1단계다', () => {
    const alerts = buildAlerts(createInitialArtifactState())
    expect(alerts.map((alert) => alert.st)).toEqual([3, 1, 1])
    expect(alerts.some((alert) => alert.st === 0)).toBe(false)
    expect(alerts[1]?.nurse).toBe('n1')
    expect(alerts[2]?.nurse).toBe('n3')
    expect(alerts[1]?.txt).toContain('업무 단계: 높음')
    expect(alerts.some((alert) => alert.txt.includes('수행 기준 초과'))).toBe(false)
  })

  it('추천은 여유이면서 업무량이 가장 낮은 한지호다', () => {
    expect(recommendNurse(createInitialArtifactState(), 'n1')?.id).toBe('n6')
    expect(recommendNurse(createInitialArtifactState(), 'n3')?.id).toBe('n6')
  })

  it('구역별 대기는 미완료 처방만 센다', () => {
    expect(zoneTimeliness(createInitialArtifactState())).toEqual([
      { zone: '1구역', pendingCount: 6, maxWaitMin: 40, acknowledgedCount: 0, overdueCount: 2 },
      { zone: '2구역', pendingCount: 2, maxWaitMin: 25, acknowledgedCount: 0, overdueCount: 0 },
      { zone: '3구역', pendingCount: 2, maxWaitMin: 15, acknowledgedCount: 0, overdueCount: 0 },
      { zone: '5구역', pendingCount: 1, maxWaitMin: 5, acknowledgedCount: 0, overdueCount: 0 },
      { zone: '6구역', pendingCount: 2, maxWaitMin: 10, acknowledgedCount: 0, overdueCount: 0 },
    ])
  })

  it('김가온 NEWS는 주의에서 위험으로 올랐을 때만 화살표 대상이다', () => {
    const patient = findNurse(createInitialArtifactState(), 'n1')?.patients[0]
    expect(patient && newsRaised(patient)).toBe(true)
  })
})

describe('단계와 수행 기준 경계', () => {
  it('29분은 여유, 30분과 50분은 보통, 51분은 높음이다', () => {
    expect(minutesLevel(29)).toBe('ok')
    expect(minutesLevel(30)).toBe('mid')
    expect(minutesLevel(50)).toBe('mid')
    expect(minutesLevel(51)).toBe('hi')
  })

  it('KTAS 1, 2 담당은 대기 시간이 30분 미만이어도 높음이다', () => {
    const state = createInitialArtifactState()
    const lee = findNurse(state, 'n3')
    const jung = findNurse(state, 'n5')
    if (!lee || !jung) throw new Error('nurse')
    expect(elapsedPendingMin(state, lee)).toBe(20)
    expect(lee.patients.some((patient) => patient.ktas <= 2)).toBe(true)
    expect(levelOf(state, lee)).toBe('hi')
    expect(elapsedPendingMin(state, jung)).toBe(15)
    expect(levelOf(state, jung)).toBe('ok')
  })

  it('우선 대상은 수행 기준만 10분 앞당기고 소요시간과 섞지 않는다', () => {
    const park = findNurse(createInitialArtifactState(), 'n2')
    const kim = findNurse(createInitialArtifactState(), 'n1')
    if (!park || !kim) throw new Error('nurse')
    const sepsis = park.patients[0]?.orders[1]
    const iv = park.patients[0]?.orders[0]
    const blood = kim.patients[0]?.orders[0]
    if (!sepsis || !iv || !blood) throw new Error('order')
    expect(sepsis.min).toBe(10)
    expect(dueOf(park, sepsis)).toBe(50)
    expect(dueOf(park, iv)).toBe(20)
    expect(blood.min).toBe(25)
    expect(dueOf(kim, blood)).toBe(30)
  })
})

describe('지원과 이벤트', () => {
  it('수락 전에는 업무량을 감산하지 않고 수락 후에만 60%로 줄인다', () => {
    const assigned = assignSupport(createInitialArtifactState(), 'n6', 'n1').state
    expect(nurseLoad('n1', assigned).load?.now).toBe(127)
    expect(assigned.supports[0]).toMatchObject({ accepted: false, tasks: 0 })
    const accepted = acceptSupport(assigned, 'n6').state
    expect(nurseLoad('n1', accepted).load?.now).toBe(76)
    expect(nurseLoad('n1', accepted).load?.fc).toBe(100)
  })

  it('거절하면 그 간호사를 빼고 다음 여유 간호사를 추천한다', () => {
    const assigned = assignSupport(createInitialArtifactState(), 'n6', 'n1').state
    const declined = declineSupport(assigned, 'n6', '휴식').state
    expect(declined.supports).toHaveLength(0)
    expect(declined.decline[0]).toMatchObject({ from: 'n6', to: 'n1', why: '휴식' })
    expect(recommendNurse(declined, 'n1')?.id).toBe('n4')
  })

  it('처방을 수행하면 대기 소요시간만 줄고 초기화하면 127분으로 돌아온다', () => {
    const initial = createInitialArtifactState()
    const order = findNurse(initial, 'n1')?.patients[0]?.orders[0]
    if (!order) throw new Error('order')
    const done = completeOrder(initial, 'n1', '1-01', order.id, 'n1').state
    expect(nurseLoad('n1', done).load).toMatchObject({ pend: 58, now: 102 })
    const reset = resetArtifact().state
    expect(reset.t).toBe(ARTIFACT.shiftStartMin)
    expect(nurseLoad('n1', reset).load?.now).toBe(127)
    expect(reset.supports).toEqual([])
  })

  it('첫 간호요구 급증은 5-02를 즉시 높음으로 만든다', () => {
    const surged = triggerSurge(createInitialArtifactState()).state
    const choi = nurseLoad('n4', surged)
    const patient = choi.nurse.patients.find((item) => item.id === '5-02')
    expect(patient).toMatchObject({ news: 5, newsPrev: 0, avpu: 'V', vs: 60 })
    expect(choi.level).toBe('hi')
    expect(choi.load?.now).toBe(19)
    expect(buildAlerts(surged).some((alert) => alert.nurse === 'n4' && alert.st === 2)).toBe(true)
  })

  it('난수를 고정하면 15분 진행은 예정 시각 전 처방을 열지 않고 NEWS 상승 표시를 끈다', () => {
    const stepped = stepMinutes(createInitialArtifactState(), 15, fixed).state
    expect(stepped.t).toBe(ARTIFACT.shiftStartMin + 15)
    expect(stepped.cpr).toBeNull()
    const kim = findNurse(stepped, 'n1')
    expect(kim?.patients[0]).toMatchObject({ news: 6, newsPrev: 6, vs: 60 })
    expect(kim && newsRaised(kim.patients[0])).toBe(false)
    expect(nurseLoad('n1', stepped).load?.fc).toBe(163)
    expect(findNurse(stepped, 'n1')?.patients[2]?.sched).toHaveLength(1)
  })

  it('시나리오 2는 15분이 지나면 오래된 대기를 수행으로 반영하고 임의 처방을 더하지 않는다', () => {
    const start = createInitialArtifactState('flow')
    const before = findNurse(start, 'n1')?.patients[0]?.orders.map((order) => order.name)
    const stepped = stepMinutes(start, 15, () => 0).state
    const orders = findNurse(stepped, 'n1')?.patients[0]?.orders ?? []
    expect(before).toContain('수혈(PRBC)')
    expect(orders.find((order) => order.name === '수혈(PRBC)')?.status).toBe('completed')
    expect(orders.filter((order) => order.status !== 'completed')).toHaveLength(2)
    expect(stepped.cpr).toBeNull()
    expect(findNurse(stepped, 'n1')?.patients[0]?.news).toBe(6)
  })

  it('두 번째 15분에는 도래한 예정 처방과 CPCR이 함께 생긴다', () => {
    const first = stepMinutes(createInitialArtifactState(), 15, fixed).state
    const second = stepMinutes(first, 15, fixed).state
    expect(second.t).toBe(ARTIFACT.cpcrAtMin)
    expect(second.cpr).toMatchObject({ phase: 0, closed: false })
    expect(findNurse(second, 'n6')?.patients[0]?.id).toBe('R-01')
    expect(levelOf(second, findNurse(second, 'n6')!)).toBe('hi')
    expect(findNurse(second, 'n2')?.patients[1]?.orders.map((order) => order.name)).toContain('채혈')
    expect(buildAlerts(second)[0]?.st).toBe('E')
  })

  it('시나리오 2도 09:30에는 CPCR 환자가 발생한다', () => {
    const first = stepMinutes(createInitialArtifactState('flow'), 15, () => 0).state
    const second = stepMinutes(first, 15, () => 0).state
    expect(second.t).toBe(ARTIFACT.cpcrAtMin)
    expect(second.cpr).toMatchObject({ phase: 0, closed: false })
    expect(findNurse(second, 'n6')?.patients[0]?.id).toBe('R-01')
  })

  it('CPCR 버튼을 누르면 09:00에도 소생실 환자가 생기고 다시 누르면 진행 중 안내만 한다', () => {
    const started = triggerCpcr(createInitialArtifactState())
    expect(started.state.cpr?.start).toBe(ARTIFACT.shiftStartMin)
    expect(findNurse(started.state, 'n6')?.patients).toHaveLength(1)
    const again = triggerCpcr(started.state)
    expect(again.state).toBe(started.state)
    expect(again.toast).toContain('진행 중')
  })

  it('확인중은 처방을 남기고 활성 대기에서만 빼며 업무량은 유지한다', () => {
    const initial = createInitialArtifactState()
    const order = findNurse(initial, 'n1')?.patients[0]?.orders[0]
    if (!order) throw new Error('order')
    const marked = acknowledgeOrder(initial, 'n1', '1-01', order.id).state
    const kept = findNurse(marked, 'n1')?.patients[0]?.orders.find((item) => item.id === order.id)
    expect(kept).toMatchObject({ status: 'acknowledged', at: order.at })
    expect(nurseLoad('n1', marked).load?.now).toBe(127)
    expect(nurseQueue(marked, findNurse(marked, 'n1')!)).toMatchObject({ pendingCount: 5, maxWaitMin: 35, acknowledgedCount: 1 })
    const back = returnOrderToPending(marked, 'n1', '1-01', order.id).state
    const restored = findNurse(back, 'n1')?.patients[0]?.orders.find((item) => item.id === order.id)
    expect(restored).toMatchObject({ status: 'pending', at: order.at })
    expect(nurseQueue(back, findNurse(back, 'n1')!).pendingCount).toBe(6)
  })

  it('확인중 처방도 수행하면 목록 집계에서 빠지고 두 번은 기록되지 않는다', () => {
    const initial = createInitialArtifactState()
    const order = findNurse(initial, 'n1')?.patients[0]?.orders[0]
    if (!order) throw new Error('order')
    const marked = acknowledgeOrder(initial, 'n1', '1-01', order.id).state
    const done = completeOrder(marked, 'n1', '1-01', order.id, 'n1').state
    expect(findNurse(done, 'n1')?.patients[0]?.orders.find((item) => item.id === order.id)?.status).toBe('completed')
    expect(nurseLoad('n1', done).load?.now).toBe(102)
    expect(done.done.n1).toBe(order.min)
    const twice = completeOrder(done, 'n1', '1-01', order.id, 'n1').state
    expect(twice.done.n1).toBe(order.min)
    expect(twice.activity.filter((item) => item.kind === 'perform')).toHaveLength(1)
  })

  it('본인, 높음, 이미 배정된 대상에는 지원을 넣지 않는다', () => {
    const initial = createInitialArtifactState()
    expect(assignmentBlockReason(initial, 'n1', 'n1')).toContain('본인')
    expect(assignSupport(initial, 'n3', 'n1').state).toBe(initial)
    const waiting = assignSupport(initial, 'n6', 'n1').state
    expect(assignmentBlockReason(waiting, 'n4', 'n1')).toContain('응답')
    expect(assignSupport(waiting, 'n4', 'n1').state).toBe(waiting)
  })

  it('A-plus 지원 종료 후에는 외부 인력이 근무조에서 빠진다', () => {
    const joined = requestAplus(createInitialArtifactState()).state
    expect(findNurse(joined, 'n7')?.name).toBe('A-plus 지원간호사')
    const assigned = assignSupport(joined, 'n7', 'n1').state
    const accepted = acceptSupport(assigned, 'n7').state
    const ended = endSupport(accepted, 'n7').state
    expect(findNurse(ended, 'n7')).toBeUndefined()
    expect(ended.supports.some((support) => support.from === 'n7' && support.end)).toBe(true)
    expect(findNurse(ended, 'n1')).toBeTruthy()
  })
})
