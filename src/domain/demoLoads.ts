import { demoConfig } from '../config/demoConfig'
import type { Order } from './types'

/** HTML obsLoad가 읽는 환자 필드. 확정 임상식이 아니다. */
export interface DemoLoadPatient {
  ktas: number
  news: number
  previousNews: number
  vitalIntervalMin: number
  surgeKind?: string
}

/** HTML obsLoad. 시연용 표이며 확정 임상식이 아니다. */
export function demoObservationMin(patient: DemoLoadPatient): number {
  const ktas =
    demoConfig.observationByKtas[patient.ktas] ?? demoConfig.observationKtasFallback
  const band = demoConfig.observationByNews.find((row) => patient.news >= row.minScore)
  const newsMin = band ? band.minutes : 0
  const surge = patient.surgeKind ? demoConfig.surgeObservationExtraMin : 0
  return ktas + newsMin + surge
}

/** HTML vsLoad. */
export function demoVitalMin(intervalMin: number): number {
  return Math.round((demoConfig.vitalWindowMin / intervalMin) * demoConfig.vitalMinPerCheck)
}

export function isPendingWorkload(order: Order, nowMin: number): boolean {
  if (order.status !== 'pending' || !order.activated) return false
  if (order.issuedAtMin == null) return false
  return nowMin >= order.issuedAtMin
}

/**
 * HTML의 1시간 뒤 표시값.
 * 학습된 예측이 아니라 시연 규칙이다.
 */
export function demoForecastMin(
  patient: DemoLoadPatient,
  pendingMin: number,
  scheduled: Array<{ name: string; atMin: number; durationMin: number }>,
  nowMin: number,
): number {
  const trend = patient.news - patient.previousNews
  const futureNews = Math.max(0, patient.news + (trend > 0 ? trend : 0))
  const futurePatient: DemoLoadPatient = { ...patient, news: futureNews }
  const schedMin = scheduled
    .filter((item) => item.atMin <= nowMin + demoConfig.forecastHorizonMin)
    .reduce((sum, item) => sum + item.durationMin, 0)
  const expectedNew = patient.ktas <= 2 ? 8 : patient.ktas === 3 ? 4 : 1
  return (
    demoObservationMin(futurePatient) +
    demoVitalMin(patient.vitalIntervalMin) +
    Math.round(pendingMin * demoConfig.forecastPendingRemainRatio) +
    schedMin +
    expectedNew
  )
}
