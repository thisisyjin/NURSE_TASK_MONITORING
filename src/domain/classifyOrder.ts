import { demoConfig } from '../config/demoConfig'
import { ORDER_RULES } from '../data/fixtures/catalog'

export interface ClassifiedOrder {
  category: '높음' | '중간' | '낮음' | null
  estimatedDurationMin: number | null
  matched: boolean
  usedDemoFallback: boolean
  label: string | null
}

export function categoryForMinutes(min: number): '높음' | '중간' | '낮음' {
  if (min >= 20) return '높음'
  if (min >= 10) return '중간'
  return '낮음'
}

/** 처방명 규칙 매칭. 매칭 실패 시 등급을 만들지 않는다. */
export function classifyOrderName(name: string): ClassifiedOrder {
  const rule = ORDER_RULES.find((item) => item.test(name))
  if (!rule) {
    return {
      category: null,
      estimatedDurationMin: null,
      matched: false,
      usedDemoFallback: true,
      label: null,
    }
  }
  return {
    category: categoryForMinutes(rule.min),
    estimatedDurationMin: rule.min,
    matched: true,
    usedDemoFallback: false,
    label: rule.label,
  }
}

export function targetMinFor(name: string): number {
  return name.includes('패혈성') ? demoConfig.sepsisTargetMin : demoConfig.defaultTargetMin
}

export function durationForWorkload(classified: ClassifiedOrder): number {
  if (classified.matched && classified.estimatedDurationMin != null) return classified.estimatedDurationMin
  return demoConfig.unmatchedOrderMin
}
