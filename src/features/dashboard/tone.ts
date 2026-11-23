import type { WorkloadLevel } from '../../config/demoConfig'

export function tone(level: WorkloadLevel): { badge: string; card: string; color: string } {
  if (level === 'high') return { badge: 'b-high', card: 's-high', color: 'var(--high)' }
  if (level === 'normal') return { badge: 'b-mid', card: 's-mid', color: 'var(--mid)' }
  return { badge: 'b-low', card: 's-low', color: 'var(--low)' }
}

export function roleLabel(role: 'assigned' | 'preT' | 'supplies'): string {
  if (role === 'preT') return 'Pre-T'
  if (role === 'supplies') return '물품관리'
  return '환자 담당'
}
