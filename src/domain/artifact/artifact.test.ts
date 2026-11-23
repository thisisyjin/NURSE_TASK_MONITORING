import { describe, expect, it } from 'vitest'
import { ARTIFACT } from '../../config/artifactConfig'
import {
  acceptSupport,
  assignSupport,
  completeOrder,
  declineSupport,
  resetArtifact,
  stepMinutes,
  triggerCpcr,
  triggerSurge,
} from './actions'
import { createInitialArtifactState } from './initialState'
import { buildAlerts, capacityOf, dueOf, findNurse, loadOf, levelOf, minutesLevel, newsRaised, recommendNurse, zoneTimeliness } from './rules'

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
    expect(nurseLoad('n5', state).level).toBe('mid')
    expect(nurseLoad('n6', state).load).toBeNull()
    expect(nurseLoad('n6', state).level).toBe('ok')
  })

  it('인력 적정성은 환자 담당 간호사 5명 x 50분으로 256/250 초과다', () => {
    const capacity = capacityOf(createInitialArtifactState())
    expect(capacity).toMatchObject({ total: 256, limit: 250, n: 5, level: 'hi' })
  })

  it('초기 알림은 3단계, 김서연 2단계, 이하은 1단계다', () => {
    const alerts = buildAlerts(createInitialArtifactState())
    expect(alerts.map((alert) => alert.st)).toEqual([3, 2, 1])
    expect(alerts[1]?.nurse).toBe('n1')
    expect(alerts[2]?.nurse).toBe('n3')
    expect(alerts[1]?.txt).toContain('수행 기준 초과 처방 2건')
    expect(alerts[2]?.txt).toContain("업무량 '높음' 도달")
  })

  it('추천은 여유이면서 업무량이 가장 낮은 한지호다', () => {
    expect(recommendNurse(createInitialArtifactState(), 'n1')?.id).toBe('n6')
    expect(recommendNurse(createInitialArtifactState(), 'n3')?.id).toBe('n6')
  })

  it('구역별 대기는 미완료 처방만 센다', () => {
    expect(zoneTimeliness(createInitialArtifactState())).toEqual([
      { zone: '1구역', pendingCount: 6, maxWaitMin: 40, overdueCount: 2 },
      { zone: '2구역', pendingCount: 2, maxWaitMin: 25, overdueCount: 0 },
      { zone: '3구역', pendingCount: 2, maxWaitMin: 15, overdueCount: 0 },
      { zone: '5구역', pendingCount: 1, maxWaitMin: 5, overdueCount: 0 },
      { zone: '6구역', pendingCount: 2, maxWaitMin: 10, overdueCount: 0 },
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

  it('CPCR 버튼을 누르면 09:00에도 소생실 환자가 생기고 다시 누르면 진행 중 안내만 한다', () => {
    const started = triggerCpcr(createInitialArtifactState())
    expect(started.state.cpr?.start).toBe(ARTIFACT.shiftStartMin)
    expect(findNurse(started.state, 'n6')?.patients).toHaveLength(1)
    const again = triggerCpcr(started.state)
    expect(again.state).toBe(started.state)
    expect(again.toast).toContain('진행 중')
  })
})
