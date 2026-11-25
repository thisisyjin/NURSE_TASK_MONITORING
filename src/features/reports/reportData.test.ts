import { describe, expect, it } from 'vitest'
import { createInitialArtifactState } from '../../domain/artifact/initialState'
import { activityRows, captureWorkSnapshot, reportCsv, supportRows, workloadRows } from './reportData'

describe('리포트', () => {
  it('09:00 스냅샷에 간호사별 대기 분과 업무량을 남긴다', () => {
    const snapshot = captureWorkSnapshot(createInitialArtifactState())
    const kim = snapshot.rows.find((row) => row.name === '김서연')
    expect(snapshot.t).toBe(540)
    expect(kim?.elapsedMin).toBe(95)
    expect(kim?.workloadMin).toBe(127)
    expect(kim?.level).toBe('hi')
  })

  it('필터한 표만 CSV에 넣는다', () => {
    const state = createInitialArtifactState()
    const snapshots = [captureWorkSnapshot(state)]
    const csv = reportCsv([
      { title: '시각별 업무', rows: workloadRows(snapshots, 'n1', 540) },
      { title: '지원 기록', rows: supportRows(state, 'all', null) },
      { title: '수행 기록', rows: activityRows(state, null) },
    ])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('김서연')
    expect(csv).not.toContain('박도윤')
    expect(csv).toContain('지원 기록')
    expect(csv).toContain('수행 기록')
  })
})
