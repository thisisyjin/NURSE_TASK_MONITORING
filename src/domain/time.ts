import { demoConfig, type NewsRisk, type WorkloadLevel } from '../config/demoConfig'

export function hhmm(min: number): string {
  const rounded = Math.round(min)
  const h = Math.floor(rounded / 60)
  const m = ((rounded % 60) + 60) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function newsRisk(score: number): NewsRisk {
  if (score >= demoConfig.newsBands.riskMax + 1) return 'highRisk'
  if (score >= demoConfig.newsBands.cautionMax + 1) return 'risk'
  if (score >= demoConfig.newsBands.goodMax + 1) return 'caution'
  return 'good'
}

const NEWS_RANK: Record<NewsRisk, number> = {
  good: 0,
  caution: 1,
  risk: 2,
  highRisk: 3,
}

/** 위험 단계가 올랐을 때만 true. 같은 단계의 점수 상승은 false. */
export function newsRose(previous: number, current: number): boolean {
  return NEWS_RANK[newsRisk(current)] > NEWS_RANK[newsRisk(previous)]
}

export function workloadLevel(totalMin: number, forceHigh: boolean): WorkloadLevel {
  if (forceHigh) return 'high'
  if (totalMin > demoConfig.workloadHighAboveMin) return 'high'
  if (totalMin >= demoConfig.workloadNormalFromMin) return 'normal'
  return 'low'
}

export function levelLabel(level: WorkloadLevel): string {
  if (level === 'high') return '높음'
  if (level === 'normal') return '보통'
  return '여유'
}

export function vitalLabel(intervalMin: number): string {
  if (intervalMin >= 60 && intervalMin % 60 === 0) {
    return `${intervalMin / 60}시간마다`
  }
  return `${intervalMin}분마다`
}
