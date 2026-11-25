import { minutesLevel } from '../../domain/artifact/rules'
import type { LevelCode, WorkloadBreakdown } from '../../domain/artifact/types'

/** 백업 화면의 단계 배지는 원본처럼 현재 업무량 기준이다. */
export function backupWorkloadLevel(load: WorkloadBreakdown | null, fallback: LevelCode): LevelCode {
  if (!load) return fallback
  if (load.ev) return 'hi'
  return minutesLevel(load.now)
}

export function backupWaitLabel(elapsedMin: number) {
  return `대기 ${elapsedMin}분`
}
