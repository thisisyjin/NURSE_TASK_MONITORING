export const evaluationConfig = {
  /** mock일 때는 네트워크를 호출하지 않는다. */
  mode: 'mock' as 'mock' | 'langflow',
  langflow: {
    baseUrl: '',
    flowIds: {
      classifyOrders: '',
      calculateWorkload: '',
      evaluateOrderDelays: '',
      evaluateSupport: '',
    },
  },
}
