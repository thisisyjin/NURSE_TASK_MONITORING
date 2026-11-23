import { f2Config } from '../../config/f2Config'
import { extractF2Result } from './parseF2Envelope'
import { F2ApiError, type F2Result, type F2ShiftInput } from './f2Types'

export interface F2CallOptions {
  apiKey: string
  endpoint?: string
  signal?: AbortSignal
  timeoutMs?: number
}

function combineSignal(parent: AbortSignal | undefined, timeoutMs: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const onParent = () => controller.abort()
  parent?.addEventListener('abort', onParent)
  if (parent?.aborted) controller.abort()
  return {
    signal: controller.signal,
    cancel: () => {
      clearTimeout(timer)
      parent?.removeEventListener('abort', onParent)
    },
  }
}

function failureMessage(status: number, body: string): F2ApiError {
  const detail = body.replace(/\s+/g, ' ').slice(0, 180)
  if (status === 401 || status === 403) {
    return new F2ApiError('auth', `F2 API 인증 실패 (HTTP ${status})`, status)
  }
  return new F2ApiError('http', `F2 API HTTP ${status}${detail ? `: ${detail}` : ''}`, status)
}

/**
 * Playground와 같은 스냅샷을 chat 입력 문자열로 보낸다.
 * 응답 껍데기 경로는 extractF2Result가 응답을 보고 고른다.
 */
export async function runF2Shift(snapshot: F2ShiftInput, options: F2CallOptions): Promise<{ result: F2Result; path: string }> {
  const timeoutMs = options.timeoutMs ?? f2Config.timeoutMs
  const linked = combineSignal(options.signal, timeoutMs)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.apiKey) headers['x-api-key'] = options.apiKey
  try {
    let response: Response
    try {
      response = await fetch(options.endpoint ?? f2Config.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          input_type: 'chat',
          output_type: 'chat',
          input_value: JSON.stringify(snapshot),
        }),
        signal: linked.signal,
      })
    } catch (error) {
      if (linked.signal.aborted && !options.signal?.aborted) {
        throw new F2ApiError('timeout', `F2 API 응답이 ${timeoutMs}ms 안에 오지 않았습니다.`)
      }
      const message = error instanceof Error ? error.message : '네트워크 오류'
      throw new F2ApiError('network', `F2 API에 연결하지 못했습니다. ${message}`)
    }
    const text = await response.text()
    if (!response.ok) throw failureMessage(response.status, text)
    let envelope: unknown
    try {
      envelope = JSON.parse(text) as unknown
    } catch {
      throw new F2ApiError('envelope', 'F2 API 응답이 JSON이 아닙니다.')
    }
    return extractF2Result(envelope)
  } finally {
    linked.cancel()
  }
}
