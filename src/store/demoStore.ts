import { create } from 'zustand'
import { ARTIFACT } from '../config/artifactConfig'
import {
  acceptSupport,
  acknowledgeOrder,
  assignCprTeam,
  assignSupport,
  completeOrder,
  declineSupport,
  endCprTeam,
  endSupport,
  endSurge,
  requestAplus,
  resetArtifact,
  returnOrderToPending,
  spawnOrder,
  stepMinutes,
  toggleHelp,
  togglePriority,
  triggerCpcr,
  triggerSurge,
  withView,
  type ActionResult,
} from '../domain/artifact/actions'
import { createInitialArtifactState } from '../domain/artifact/initialState'
import type { ArtifactState } from '../domain/artifact/types'
import type { F2OverlayStatus } from './projectState'

export interface DemoToast {
  id: number
  text: string
}

export interface DemoStore {
  board: ArtifactState
  toast: DemoToast | null
  autoRunning: boolean
  f2: F2OverlayStatus
  refresh: () => Promise<void>
  setView: (view: string) => void
  stepMinutes: (minutes?: number) => void
  toggleAuto: () => void
  spawnRandomOrder: () => void
  surge: () => void
  startCpcr: () => void
  reset: () => void
  performOrder: (ownerId: string, patientId: string, orderId: number, performerId: string) => void
  acknowledgeOrder: (ownerId: string, patientId: string, orderId: number) => void
  returnOrder: (ownerId: string, patientId: string, orderId: number) => void
  requestHelp: (nurseId: string) => void
  assignHelper: (from: string, to: string) => void
  acceptAssignment: (from: string) => void
  declineAssignment: (from: string, why: string) => void
  setPriority: (nurseId: string) => void
  clearSurge: (nurseId: string) => void
  finishSupport: (from: string) => void
  finishCprTeam: () => void
  assignCpr: (firstId: string, secondId: string) => void
  addAplus: () => void
}

const idleF2: F2OverlayStatus = {
  source: 'mock',
  ok: true,
  message: '이번 단계는 화면 안의 시연 계산을 사용합니다.',
}

let toastSeq = 0
let autoTimer: ReturnType<typeof setInterval> | null = null

function stopAuto(set: (partial: Partial<DemoStore>) => void) {
  if (autoTimer != null) clearInterval(autoTimer)
  autoTimer = null
  set({ autoRunning: false })
}

export const useDemoStore = create<DemoStore>((set, get) => {
  const commit = (result: ActionResult) => {
    set({
      board: result.state,
      toast: result.toast ? { id: ++toastSeq, text: result.toast } : get().toast,
    })
  }

  return {
    board: createInitialArtifactState(),
    toast: null,
    autoRunning: false,
    f2: idleF2,
    refresh: async () => {},
    setView: (view) => commit(withView(get().board, view)),
    stepMinutes: (minutes = ARTIFACT.manualStepMin) => commit(stepMinutes(get().board, minutes)),
    toggleAuto: () => {
      if (autoTimer != null) {
        stopAuto(set)
        return
      }
      set({ autoRunning: true })
      autoTimer = setInterval(() => get().stepMinutes(ARTIFACT.autoStepMin), ARTIFACT.autoEveryMs)
    },
    spawnRandomOrder: () => commit(spawnOrder(get().board)),
    surge: () => commit(triggerSurge(get().board)),
    startCpcr: () => commit(triggerCpcr(get().board)),
    reset: () => {
      stopAuto(set)
      commit(resetArtifact())
    },
    performOrder: (ownerId, patientId, orderId, performerId) => commit(completeOrder(get().board, ownerId, patientId, orderId, performerId)),
    acknowledgeOrder: (ownerId, patientId, orderId) => commit(acknowledgeOrder(get().board, ownerId, patientId, orderId)),
    returnOrder: (ownerId, patientId, orderId) => commit(returnOrderToPending(get().board, ownerId, patientId, orderId)),
    requestHelp: (nurseId) => commit(toggleHelp(get().board, nurseId)),
    assignHelper: (from, to) => commit(assignSupport(get().board, from, to)),
    acceptAssignment: (from) => commit(acceptSupport(get().board, from)),
    declineAssignment: (from, why) => commit(declineSupport(get().board, from, why)),
    setPriority: (nurseId) => commit(togglePriority(get().board, nurseId)),
    clearSurge: (nurseId) => commit(endSurge(get().board, nurseId)),
    finishSupport: (from) => commit(endSupport(get().board, from)),
    finishCprTeam: () => commit(endCprTeam(get().board)),
    assignCpr: (firstId, secondId) => commit(assignCprTeam(get().board, firstId, secondId)),
    addAplus: () => commit(requestAplus(get().board)),
  }
})
