import type { WorkloadLevel } from '../config/demoConfig'
import type { NurseRole, UnavailableReason } from './types'
import { UNAVAILABLE_LABEL } from './types'

export interface OpenSupportRef {
  helperNurseId: string
  targetNurseId: string
  status: 'assigned' | 'accepted' | 'rejected' | 'completed'
}

export interface HelperSnapshot {
  id: string
  name: string
  role: NurseRole
  unavailableReason?: UnavailableReason
  totalWorkloadMin: number
  level: WorkloadLevel
}

export interface HelperOption {
  nurseId: string
  name: string
  totalWorkloadMin: number
  level: WorkloadLevel
  recommendable: boolean
  selectable: boolean
  blockReason?: string
}

function isOpen(support: OpenSupportRef): boolean {
  return support.status === 'assigned' || support.status === 'accepted'
}

export function listHelperOptions(
  targetId: string,
  helpers: HelperSnapshot[],
  supports: OpenSupportRef[],
): HelperOption[] {
  const open = supports.filter(isOpen)
  const busy = new Set(open.flatMap((support) => [support.helperNurseId, support.targetNurseId]))
  return helpers
    .filter((helper) => helper.id !== targetId)
    .map((helper) => {
      let blockReason: string | undefined
      if (helper.unavailableReason) blockReason = `지원 불가, ${UNAVAILABLE_LABEL[helper.unavailableReason]}`
      else if (busy.has(helper.id)) blockReason = '이미 지원 중이거나 지원을 받는 중'
      const selectable = blockReason == null
      const recommendable = selectable && helper.level !== 'high'
      if (selectable && helper.level === 'high') blockReason = '업무량 높음, 추천에서는 제외'
      return {
        nurseId: helper.id,
        name: helper.name,
        totalWorkloadMin: helper.totalWorkloadMin,
        level: helper.level,
        recommendable,
        selectable,
        blockReason,
      }
    })
    .sort((a, b) => a.totalWorkloadMin - b.totalWorkloadMin || a.nurseId.localeCompare(b.nurseId))
}

export function recommendedHelperIds(options: HelperOption[]): string[] {
  return options.filter((option) => option.recommendable).map((option) => option.nurseId)
}
