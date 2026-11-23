/** 개발자가 입력한 키. 새로고침하면 사라진다. 스토어와 로그에 넣지 않는다. */
let apiKey = ''
let mode: 'mock' | 'api' = 'mock'

export function getF2Mode(): 'mock' | 'api' {
  return mode
}

export function setF2Mode(next: 'mock' | 'api'): void {
  mode = next
}

export function getF2ApiKey(): string {
  return apiKey
}

export function setF2ApiKey(next: string): void {
  apiKey = next.trim()
}
