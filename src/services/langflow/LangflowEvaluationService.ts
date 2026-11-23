import type { EvaluationService } from '../evaluation/types'

const NOT_READY =
  'Agent Builder Flow API 명세가 아직 없습니다. Share 또는 API Access의 실제 요청과 응답을 확인한 뒤 연결해야 하며, 지금은 Mock 모드를 사용합니다.'

function unavailable(): Promise<never> {
  return Promise.reject(new Error(NOT_READY))
}

/**
 * 연구실 Agent Builder의 실제 엔드포인트와 응답 경로는 아직 확정하지 않는다.
 * 가상의 Langflow 응답 스키마를 성공 결과처럼 해석하지 않는다.
 * 인증 비밀은 두지 않는다.
 */
export class LangflowEvaluationService implements EvaluationService {
  classifyOrders(_input: Parameters<EvaluationService['classifyOrders']>[0]): Promise<never> {
    return unavailable()
  }

  calculateWorkloads(_input: Parameters<EvaluationService['calculateWorkloads']>[0]): Promise<never> {
    return unavailable()
  }

  evaluateOrderDelays(_input: Parameters<EvaluationService['evaluateOrderDelays']>[0]): Promise<never> {
    return unavailable()
  }

  evaluateSupport(_input: Parameters<EvaluationService['evaluateSupport']>[0]): Promise<never> {
    return unavailable()
  }
}
