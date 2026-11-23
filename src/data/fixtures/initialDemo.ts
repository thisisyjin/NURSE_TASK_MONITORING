import { demoConfig } from '../../config/demoConfig'
import type { DemoState, Nurse, Order, Patient } from '../../domain/types'
import { classifyOrderName, durationForWorkload, targetMinFor } from '../../domain/classifyOrder'

const START = demoConfig.shiftStartMin

function nurse(
  partial: Pick<Nurse, 'id' | 'name' | 'role'> &
    Partial<Pick<Nurse, 'zone' | 'baseLevel' | 'preceptorName' | 'isPriorityTarget'>>,
): Nurse {
  return {
    isPriorityTarget: false,
    needHelp: false,
    highSinceMin: null,
    performedMin: 0,
    ...partial,
  }
}

function pending(id: string, patientId: string, name: string, ago: number): Order {
  const classified = classifyOrderName(name)
  return {
    id,
    patientId,
    name,
    category: classified.category,
    matched: classified.matched,
    usedDemoFallback: classified.usedDemoFallback,
    estimatedDurationMin: durationForWorkload(classified),
    targetCompletionMin: targetMinFor(name),
    issuedAtMin: START - ago,
    status: 'pending',
    activated: true,
  }
}

function scheduled(id: string, patientId: string, name: string, atMin: number): Order {
  const classified = classifyOrderName(name)
  return {
    id,
    patientId,
    name,
    category: classified.category,
    matched: classified.matched,
    usedDemoFallback: classified.usedDemoFallback,
    estimatedDurationMin: durationForWorkload(classified),
    targetCompletionMin: targetMinFor(name),
    issuedAtMin: null,
    scheduledAtMin: atMin,
    status: 'pending',
    activated: false,
  }
}

export function createInitialDemoState(): DemoState {
  const nurses: Nurse[] = [
    nurse({ id: 'n1', name: '김서연', role: 'assigned', zone: '1구역' }),
    nurse({
      id: 'n2',
      name: '박도윤',
      role: 'assigned',
      zone: '2구역',
      isPriorityTarget: true,
      preceptorName: '김서연',
    }),
    nurse({ id: 'n3', name: '이하은', role: 'assigned', zone: '3구역' }),
    nurse({ id: 'n4', name: '최민준', role: 'assigned', zone: '4구역' }),
    nurse({ id: 'n5', name: '정유나', role: 'preT', baseLevel: 'normal' }),
    nurse({ id: 'n6', name: '한지호', role: 'supplies', baseLevel: 'low' }),
  ]

  const patients: Patient[] = [
    { id: 'A-01', assignedNurseId: 'n1', ktas: 2, news: 6, previousNews: 5, vitalIntervalMin: 30 },
    { id: 'A-02', assignedNurseId: 'n1', ktas: 3, news: 3, previousNews: 3, vitalIntervalMin: 60 },
    { id: 'A-03', assignedNurseId: 'n1', ktas: 3, news: 2, previousNews: 2, vitalIntervalMin: 60 },
    { id: 'B-01', assignedNurseId: 'n2', ktas: 3, news: 4, previousNews: 4, vitalIntervalMin: 60 },
    { id: 'B-02', assignedNurseId: 'n2', ktas: 4, news: 1, previousNews: 1, vitalIntervalMin: 240 },
    { id: 'C-01', assignedNurseId: 'n3', ktas: 2, news: 4, previousNews: 4, vitalIntervalMin: 30 },
    { id: 'C-02', assignedNurseId: 'n3', ktas: 3, news: 2, previousNews: 2, vitalIntervalMin: 60 },
    { id: 'D-01', assignedNurseId: 'n4', ktas: 4, news: 0, previousNews: 0, vitalIntervalMin: 240 },
    { id: 'D-02', assignedNurseId: 'n4', ktas: 5, news: 0, previousNews: 0, vitalIntervalMin: 240 },
  ]

  const orders: Order[] = [
    pending('a01-prbc', 'A-01', '수혈(PRBC)', 40),
    pending('a01-lab', 'A-01', '채혈', 35),
    pending('a01-abx', 'A-01', '정맥 항생제', 10),
    scheduled('a01-contrast', 'A-01', '조영 검사 전 준비', START + 40),
    pending('a02-op', 'A-02', '수술 전 준비', 5),
    pending('a02-iv', 'A-02', '정맥 주사(IV push)', 5),
    pending('a03-oral', 'A-03', '경구약', 0),
    scheduled('a03-cag', 'A-03', '시술 전 준비(CAG)', START + 30),
    pending('b01-iv', 'B-01', '정맥 주사(IV push)', 5),
    pending('b01-sepsis', 'B-01', '항생제(패혈성 쇼크)', 25),
    scheduled('b02-lab', 'B-02', '채혈', START + 20),
    pending('c01-foley', 'C-01', '도뇨관 삽입', 15),
    pending('c02-lab', 'C-02', '채혈', 5),
    scheduled('c02-contrast', 'C-02', '조영 검사 전 준비', START + 50),
    pending('d02-oral', 'D-02', '경구약', 5),
  ]

  return {
    nowMin: START,
    nurses,
    patients,
    orders,
    supports: [],
    log: [{ t: START, msg: '시연 시작, 응급실 D 근무' }],
    stats: { alerts: 0, assigned: 0, respSum: 0, overdoneDone: 0, doneCount: 0, waitSum: 0, reports: 0 },
    alertSeen: {},
    extraStaff: 0,
    appliedEventIds: [],
    surgeIdx: 0,
    rng: demoConfig.randomSeed,
    idSeq: 1,
    viewerNurseId: null,
  }
}
