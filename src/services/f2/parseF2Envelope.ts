import { f2Config } from '../../config/f2Config'
import { F2ApiError, type F2NurseOutput, type F2Result, type F2ShiftSummary } from './f2Types'

const LEVELS = new Set(['여유', '보통', '높음'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readSummary(value: unknown): F2ShiftSummary | null {
  if (!isRecord(value)) return null
  const total = asNumber(value.total_minutes)
  const nurses = asNumber(value.nurse_count)
  const patients = asNumber(value.patient_count)
  if (total == null || nurses == null || patients == null) return null
  return value as unknown as F2ShiftSummary
}

function readNurse(value: unknown): F2NurseOutput | null {
  if (!isRecord(value)) return null
  if (typeof value.nurse_id !== 'string' || typeof value.nurse_name !== 'string') return null
  if (asNumber(value.total_minutes) == null) return null
  if (typeof value.workload_level !== 'string' || !LEVELS.has(value.workload_level)) return null
  return value as unknown as F2NurseOutput
}

/** 최상위 error 문자열이 있고 간호사 결과가 없으면 Flow가 돌려준 계산 오류다. */
export function readFlowError(value: unknown): string | null {
  if (!isRecord(value)) return null
  if (typeof value.error !== 'string' || value.error.length === 0) return null
  if (Array.isArray(value.nurses)) return null
  return value.error
}

export function readF2Result(value: unknown): F2Result | null {
  if (!isRecord(value)) return null
  if (!isRecord(value.scenario) || typeof value.scenario.clock !== 'string') return null
  if (!Array.isArray(value.nurses) || value.nurses.length === 0) return null
  const nurses = value.nurses.map(readNurse)
  if (nurses.some((nurse) => nurse == null)) return null
  const shift = readSummary(value.shift_summary)
  if (!shift) return null
  if (typeof value.calculation_version !== 'string') return null
  return value as unknown as F2Result
}

interface Found {
  result: F2Result
  path: string
}

/**
 * Langflow Envelope의 경로는 호출 전에 확정하지 않는다.
 * 객체와 문자열을 따라가며 v3 결과 JSON만 고른다.
 */
export function extractF2Result(envelope: unknown): { result: F2Result; path: string } {
  const found: Found[] = []
  const flowErrors: string[] = []
  const seen = new Set<unknown>()

  const visit = (value: unknown, path: string, depth: number) => {
    if (depth > 8 || found.length > 4) return
    if (typeof value === 'string') {
      const text = value.trim()
      if (!text.startsWith('{') && !text.startsWith('[')) return
      try {
        visit(JSON.parse(text) as unknown, `${path}(json)`, depth + 1)
      } catch {
        return
      }
      return
    }
    if (!value || typeof value !== 'object') return
    if (seen.has(value)) return
    seen.add(value)
    const flowError = readFlowError(value)
    if (flowError) flowErrors.push(flowError)
    const result = readF2Result(value)
    if (result) found.push({ result, path })
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`, depth + 1))
      return
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      visit(child, path ? `${path}.${key}` : key, depth + 1)
    }
  }

  visit(envelope, '', 0)
  const v3 = found.find((item) => item.result.calculation_version === f2Config.calculationVersion)
  if (v3) return v3
  if (found.length > 0) {
    throw new F2ApiError(
      'flow',
      `calculation_version이 ${found[0].result.calculation_version}입니다. v3(${f2Config.calculationVersion}) 결과가 아닙니다.`,
    )
  }
  if (flowErrors.length > 0) throw new F2ApiError('flow', flowErrors[0])
  throw new F2ApiError('envelope', '응답에서 F2 v3 결과 JSON을 찾지 못했습니다.')
}
