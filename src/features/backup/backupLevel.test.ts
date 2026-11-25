import { describe, expect, it } from 'vitest'
import { backupWaitLabel, backupWorkloadLevel } from './backupLevel'
import type { WorkloadBreakdown } from '../../domain/artifact/types'

function load(now: number, event = false): WorkloadBreakdown {
  return {
    now,
    base: 0,
    vsl: 0,
    pend: now,
    late: 0,
    fc: now,
    sups: [],
    ev: event ? { nurse: 'n1', pid: '1-01', type: '환자 상태 악화', start: 540, end: null } : undefined,
  }
}

describe('백업 화면 표시', () => {
  it('처방 행은 대기 경과만 보여 준다', () => {
    expect(backupWaitLabel(40)).toBe('대기 40분')
    expect(backupWaitLabel(40)).not.toContain('기준')
  })

  it('카드 단계는 현재 업무량 구간을 따른다', () => {
    expect(backupWorkloadLevel(load(29), 'ok')).toBe('ok')
    expect(backupWorkloadLevel(load(30), 'ok')).toBe('mid')
    expect(backupWorkloadLevel(load(50), 'ok')).toBe('mid')
    expect(backupWorkloadLevel(load(51), 'ok')).toBe('hi')
    expect(backupWorkloadLevel(load(10, true), 'ok')).toBe('hi')
    expect(backupWorkloadLevel(null, 'ok')).toBe('ok')
  })
})
