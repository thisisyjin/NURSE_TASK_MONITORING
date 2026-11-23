/**
 * HTML 시연판에 있던 숫자다.
 * 간호부가 확정한 임상 계산식이 아니므로 화면 재현용 임시값으로만 쓴다.
 * TODO: nurse-review
 */
export const demoConfig = {
  shiftStartMin: 9 * 60,
  shiftLabel: 'D 근무',

  /** 카드 단계. 30분 이상 보통, 50분 초과 높음. 50분 정각은 보통. */
  workloadNormalFromMin: 30,
  workloadHighAboveMin: 50,

  /** 인력 적정성 비교. 담당 환자 수에 곱한다. 간호사 수에 곱하지 않는다. */
  patientCapacityMin: 50,
  /** HTML의 주의 비율. 시연용. */
  staffingCautionAboveRatio: 0.85,

  /** 지원 알림만 앞당긴다. 처방 목표시간에는 더하지 않는다. */
  priorityAlertAdvanceMin: 10,
  /** 높음 지속 후 2단계. 답변의 15~30분 구간 중 HTML 값. TODO: nurse-review */
  highSustainMin: 15,

  /** 활력 1회 시연용 분. 주기로부터 1시간 분량을 환산할 때 쓴다. TODO: nurse-review */
  vitalMinPerCheck: 3,
  vitalWindowMin: 60,

  /** HTML 관찰 표. TODO: nurse-review */
  observationByKtas: { 1: 25, 2: 15, 3: 8, 4: 4, 5: 2 } as Record<number, number>,
  observationKtasFallback: 4,
  /** NEWS 7 이상, 5 이상, 3 이상, 그 외 */
  observationByNews: [
    { minScore: 7, minutes: 12 },
    { minScore: 5, minutes: 7 },
    { minScore: 3, minutes: 3 },
  ],
  /** 급증 플래그가 있을 때 HTML이 관찰에 더하던 값. TODO: nurse-review */
  surgeObservationExtraMin: 20,

  /** 역할 카드 내부 비교값. 화면에는 단계를 표시하고 이 분을 적지 않는다. */
  roleBaseMin: { low: 15, normal: 40, high: 60 } as const,

  /** 이름 규칙에 없을 때 HTML이 쓰던 분. 등급은 만들지 않는다. */
  unmatchedOrderMin: 5,
  defaultTargetMin: 30,
  sepsisTargetMin: 60,

  /** 시연용 1시간 뒤 값. 예측 모델이 아니다. */
  forecastPendingRemainRatio: 0.6,
  forecastHorizonMin: 60,

  barMaxMin: 160,
  staffingBarMaxRatio: 1.3,

  /** 지연은 경과가 목표보다 클 때. 같으면 초과가 아니다. */
  overdueWhenElapsedGreaterThanTarget: true,

  /** NEWS 단계. 간호부 답변. */
  newsBands: {
    goodMax: 1,
    cautionMax: 4,
    riskMax: 6,
  },

  autoIntervalMs: 2000,
  autoStepMin: 5,
  autoOrderChance: 0.25,
  randomSeed: 20261030,
} as const

export type WorkloadLevel = 'low' | 'normal' | 'high'
export type NewsRisk = 'good' | 'caution' | 'risk' | 'highRisk'
