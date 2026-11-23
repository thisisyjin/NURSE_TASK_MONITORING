/**
 * F2 Flow의 주소와 ID는 공개 설정이다.
 * API 키는 이 파일에 두지 않는다.
 */
export const f2Config = {
  /** 브라우저가 개발 서버로 보내는 경로. 개발 서버가 위 주소로 전달한다. */
  endpoint: '/f2-api/api/v1/run/0cbe3a7e-2d2c-498f-bc6d-95703ce59380',
  upstream: 'http://192.168.45.149:3001',
  timeoutMs: 20000,
  calculationVersion: 'html_demo_f2_v3_batch',
} as const
