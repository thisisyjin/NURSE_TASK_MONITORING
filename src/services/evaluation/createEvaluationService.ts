import { evaluationConfig } from '../../config/evaluationConfig'
import { LangflowEvaluationService } from '../langflow/LangflowEvaluationService'
import { MockEvaluationService } from '../mock/MockEvaluationService'
import type { EvaluationService } from './types'

export function createEvaluationService(mode: 'mock' | 'langflow' = evaluationConfig.mode): EvaluationService {
  if (mode === 'langflow') return new LangflowEvaluationService()
  return new MockEvaluationService()
}
