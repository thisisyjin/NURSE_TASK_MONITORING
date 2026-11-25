/** 최신 Artifact(app.js)의 시연용 상수. 임상 확정값이 아니다. */

export const ARTIFACT = {
  vitalMinutesPerCheck: 3,
  levelLowBelow: 30,
  levelHighAbove: 50,
  /** 시연용. 이 등급 이하 환자를 담당하면 대기 시간과 관계없이 높음이다. */
  criticalKtasAtOrBelow: 2,
  defaultDueMin: 30,
  priorityEarlyMin: 10,
  minimumDueMin: 5,
  capacityPerAssignedNurse: 50,
  capacityCautionRatio: 0.8,
  supportReliefPerHelper: 0.4,
  supportReliefFloor: 0.35,
  forecastWindowMin: 60,
  forecastNewsRiseMin: 5,
  highSustainedMin: 30,
  capacitySustainedMin: 30,
  minimumSupportMin: 5,
  meterScaleMin: 80,
  capacityTrackScale: 1.4,
  shiftStartMin: 9 * 60,
  cpcrAtMin: 9 * 60 + 30,
  autoEveryMs: 2000,
  autoStepMin: 5,
  manualStepMin: 15,
  overdueStage2Count: 2,
  overdueStage2PriorityCount: 1,
} as const

/** 시연 화면에서 고르는 시간 진행 방식. 09:00 환자 구성은 같다. */
export const DEMO_SCENARIOS = {
  original: { label: '시나리오 1', hint: '원본' },
  flow: { label: '시나리오 2', hint: '진행' },
} as const

export type DemoScenarioId = keyof typeof DEMO_SCENARIOS

export const KTAS_LOAD: Record<number, number> = { 1: 20, 2: 15, 3: 10, 4: 5, 5: 3 }

export const NEWS_BANDS = ['양호', '주의', '위험', '고위험'] as const

export const LEVEL_LABEL = { ok: '여유', mid: '보통', hi: '높음' } as const

export const CAPACITY_LABEL = { ok: '적정', mid: '주의', hi: '초과' } as const

export const CATEGORY_LABEL = { H: '높음', M: '중간', L: '낮음' } as const

export const FULL_VIEWS = {
  leader: '근무조 리더간호사 (전체)',
  np: '응급전문간호사 (전체)',
} as const

export const ROLE_BASE_LEVEL: Record<string, 'ok' | 'mid' | 'hi'> = {
  '6구역': 'mid',
  소생실: 'ok',
  'A-plus 지원': 'ok',
}

export const DUE_BY_ORDER: Record<string, number> = {
  '항생제(패혈성 쇼크)': 60,
  'CPR 진행': 5,
  '에피네프린 투여': 5,
  'Intubation 준비·보조': 10,
}

export const SURGE_TYPES = ['환자 상태 악화', '섬망·초조 행동'] as const

export const DECLINE_REASONS = ['휴식', '중증 환자 전담', '다른 업무'] as const

/** 네 번째 값이 있으면 무작위 처방 후보에서 제외한다. */
export const ORDER_CATALOG: ReadonlyArray<readonly [string, 'H' | 'M' | 'L', number, true?]> = [
  ['CPR 진행', 'H', 42, true],
  ['Central line 삽입 준비·보조', 'H', 30],
  ['Intubation 준비·보조', 'H', 30],
  ['수술 전 준비', 'H', 30],
  ['시술 전 준비(CAG)', 'H', 25],
  ['수혈(PRBC)', 'H', 25],
  ['A-line 삽입 준비·보조', 'H', 20],
  ['도뇨관 삽입', 'M', 15],
  ['중환자실 입원 준비', 'M', 15, true],
  ['정맥 항생제', 'M', 10],
  ['항생제(패혈성 쇼크)', 'M', 10],
  ['승압제 투여 시작', 'M', 10, true],
  ['채혈', 'M', 10],
  ['조영 검사 전 준비', 'M', 10],
  ['정맥 주사(IV push)', 'L', 5],
  ['에피네프린 투여', 'L', 5, true],
  ['수액 교체', 'L', 5],
  ['경구약', 'L', 3],
]

export const CATALOG_MAP: Record<string, { cat: 'H' | 'M' | 'L'; min: number }> = Object.fromEntries(
  ORDER_CATALOG.map(([name, cat, min]) => [name, { cat, min }]),
)
