import { describe, expect, it, vi } from 'vitest'
import expectedFile from '../samples/f2-expected-0900.json'
import { createInitialDemoState } from './data/fixtures/initialDemo'
import { completeOrder } from './domain/mutations'
import { applySurge } from './domain/scenario'
import { advanceMinutes } from './domain/mutations'
import { mergeF2Workloads } from './services/f2/applyF2Result'
import { extractF2Result } from './services/f2/parseF2Envelope'
import { toF2ShiftInput } from './services/f2/f2SnapshotAdapter'
import type { F2Result } from './services/f2/f2Types'
import { MockEvaluationService } from './services/mock/MockEvaluationService'
import { runEvaluation } from './store/projectState'
import type { NurseWorkloadResult } from './services/evaluation/types'

const sampleResult = expectedFile as F2Result

function row(partial: Partial<NurseWorkloadResult> & Pick<NurseWorkloadResult, 'nurseId'>): NurseWorkloadResult {
  return {
    observationMin: 0,
    vitalSignsMin: 0,
    pendingOrdersMin: 0,
    pendingCount: 0,
    totalWorkloadMin: 0,
    level: 'low',
    demoForecastMin: 164,
    demoForecastLevel: 'high',
    capacityReferenceMin: 0,
    exceedsCapacityReference: false,
    forceHigh: false,
    ...partial,
  }
}

describe('F2 스냅샷', () => {
  it('09:00 상태는 역할 간호사를 빼고 예정 처방을 scheduled로 보낸다', () => {
    const input = toF2ShiftInput(createInitialDemoState(), 'initial_0900')
    expect(input.scenario).toEqual({ id: 'initial_0900', clock: '09:00' })
    expect(input.nurses.map((nurse) => nurse.name)).toEqual(['김서연', '박도윤', '이하은', '최민준'])
    const a01 = input.nurses[0].patients.find((patient) => patient.id === 'A-01')
    expect(a01).toMatchObject({ ktas: 2, news: 6, vital_interval_minutes: 30, acute_deterioration: false })
    expect(a01?.orders.find((order) => order.name.includes('수혈'))).toMatchObject({ status: 'pending', estimated_minutes: 25 })
    expect(a01?.orders.find((order) => order.name.includes('조영'))?.status).toBe('scheduled')
    expect(JSON.stringify(input)).not.toContain('observation_minutes')
  })

  it('완료 처방은 completed, 시각 전의 예정 처방은 scheduled다', () => {
    const done = completeOrder(createInitialDemoState(), 'a01-prbc', 'n1')
    const orders = toF2ShiftInput(done, 'done').nurses[0].patients[0].orders
    expect(orders.find((order) => order.id === 'a01-prbc')?.status).toBe('completed')
    const at0915 = toF2ShiftInput(advanceMinutes(createInitialDemoState(), 15), 't')
    expect(at0915.scenario.clock).toBe('09:15')
    const scheduled = at0915.nurses[1].patients.find((patient) => patient.id === 'B-02')?.orders[0]
    expect(scheduled?.status).toBe('scheduled')
  })

  it('급증 플래그만 acute_deterioration으로 보내고 NEWS 점수만으로는 보내지 않는다', () => {
    const surged = applySurge(createInitialDemoState())
    const d02 = toF2ShiftInput(surged, 'surge').nurses[3].patients.find((patient) => patient.id === 'D-02')
    expect(d02?.acute_deterioration).toBe(true)
    const newsOnly = createInitialDemoState()
    const patient = newsOnly.patients.find((item) => item.id === 'A-01')
    if (!patient) throw new Error('patient')
    patient.news = 7
    const a01 = toF2ShiftInput(newsOnly, 'news').nurses[0].patients[0]
    expect(a01.news).toBe(7)
    expect(a01.acute_deterioration).toBe(false)
  })
})

describe('F2 응답 해석', () => {
  it('서로 다른 껍데기에서 v3 JSON을 찾고 오류 문자열은 실패로 본다', () => {
    const nested = { outputs: [{ outputs: [{ results: { message: { text: JSON.stringify(sampleResult) } } }] }] }
    expect(extractF2Result(nested).result.shift_summary.total_minutes).toBe(241)
    const other = { data: { message: JSON.stringify(sampleResult) } }
    expect(extractF2Result(other).path).toContain('message')
    expect(() => extractF2Result({ outputs: [{ text: '{"error":"입력 오류"}' }] })).toThrow(/입력 오류/)
    const v2 = { ...sampleResult, calculation_version: 'html_demo_f2_v2' }
    expect(() => extractF2Result(v2)).toThrow(/v3/)
  })

  it('API 결과는 현재 업무량만 바꾸고 1시간 뒤 값은 유지한다', () => {
    const merged = mergeF2Workloads([row({ nurseId: 'n1', totalWorkloadMin: 1 }), row({ nurseId: 'n5', totalWorkloadMin: 40 })], sampleResult)
    expect(merged[0]).toMatchObject({ totalWorkloadMin: 136, observationMin: 41, vitalSignsMin: 12, pendingOrdersMin: 83, level: 'high', demoForecastMin: 164 })
    expect(merged[1].totalWorkloadMin).toBe(40)
  })
})

describe('F2 모드', () => {
  it('키를 비우면 헤더 없이 호출하고 개발 서버가 키를 붙일 수 있게 한다', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (!url || !init) throw new Error('request')
      return new Response(JSON.stringify({ payload: JSON.stringify(sampleResult) }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const view = await runEvaluation(new MockEvaluationService(), createInitialDemoState(), { f2Mode: 'api', apiKey: '' })
    const init = fetchMock.mock.calls[0][1]
    const headers = init?.headers as Record<string, string>
    expect(headers['x-api-key']).toBeUndefined()
    expect(view.f2.source).toBe('api')
    expect(view.workloads.find((item) => item.nurseId === 'n1')?.totalWorkloadMin).toBe(136)
    vi.unstubAllGlobals()
  })

  it('샘플 응답을 카드 업무량에 반영하고 키를 결과 객체에 남기지 않는다', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (!url || !init) throw new Error('request')
      return new Response(JSON.stringify({ payload: JSON.stringify(sampleResult) }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const view = await runEvaluation(new MockEvaluationService(), createInitialDemoState(), { f2Mode: 'api', apiKey: 'test-key' })
    expect(view.f2).toMatchObject({ source: 'api', ok: true, shiftTotal: 241, version: 'html_demo_f2_v3_batch' })
    expect(view.workloads.find((item) => item.nurseId === 'n4')?.totalWorkloadMin).toBe(11)
    expect(view.staffing.totalMin).toBe(241)
    const init = fetchMock.mock.calls[0][1]
    if (!init?.headers || Array.isArray(init.headers)) throw new Error('headers')
    const headers = init.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('test-key')
    const body = JSON.parse(String(init.body)) as { input_type: string; input_value: string }
    expect(body.input_type).toBe('chat')
    expect(JSON.parse(body.input_value).nurses).toHaveLength(4)
    expect(JSON.stringify(view.f2)).not.toContain('test-key')
    vi.unstubAllGlobals()
  })

  it('HTTP 200의 Flow 오류는 Mock으로 남기고 실패를 숨기지 않는다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: '{"error":"입력 오류"}' }), { status: 200 })))
    const view = await runEvaluation(new MockEvaluationService(), createInitialDemoState(), { f2Mode: 'api', apiKey: 'test-key' })
    expect(view.f2.ok).toBe(false)
    expect(view.f2.source).toBe('mock')
    expect(view.f2.message).toContain('입력 오류')
    expect(view.f2.message).toContain('Mock 사용 중')
    expect(view.workloads.find((item) => item.nurseId === 'n1')?.totalWorkloadMin).toBe(136)
    vi.unstubAllGlobals()
  })
})
