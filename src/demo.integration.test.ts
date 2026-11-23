import { describe, expect, it } from 'vitest'
import { ARTIFACT } from './config/artifactConfig'
import { findNurse, loadOf } from './domain/artifact/rules'
import { LangflowEvaluationService } from './services/langflow/LangflowEvaluationService'
import { useDemoStore } from './store/demoStore'

describe('화면 상태', () => {
  it('수행과 시간 진행 뒤 초기화하면 09:00 원본 수치로 돌아온다', () => {
    useDemoStore.getState().reset()
    const order = findNurse(useDemoStore.getState().board, 'n1')?.patients[0]?.orders[0]
    if (!order) throw new Error('order')
    useDemoStore.getState().performOrder('n1', '1-01', order.id, 'n1')
    useDemoStore.getState().stepMinutes(15)
    expect(useDemoStore.getState().board.t).toBe(ARTIFACT.shiftStartMin + 15)
    useDemoStore.getState().reset()
    const board = useDemoStore.getState().board
    const nurse = findNurse(board, 'n1')
    expect(board.t).toBe(ARTIFACT.shiftStartMin)
    expect(board.view).toBe('leader')
    expect(board.supports).toEqual([])
    expect(nurse && loadOf(board, nurse)?.now).toBe(127)
    expect(useDemoStore.getState().autoRunning).toBe(false)
  })
})

describe('서비스 경계', () => {
  it('Langflow 모드는 확정되지 않은 응답을 성공으로 만들지 않는다', async () => {
    const service = new LangflowEvaluationService()
    await expect(service.classifyOrders({ orders: [], catalog: [] })).rejects.toThrow(/명세/)
  })
})
