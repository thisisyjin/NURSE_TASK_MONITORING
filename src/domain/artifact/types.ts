export type LevelCode = 'ok' | 'mid' | 'hi'
export type OrderCategory = 'H' | 'M' | 'L'
export type AlertStage = 'E' | 0 | 1 | 2 | 3 | 4

export type OrderWorkStatus = 'pending' | 'acknowledged' | 'completed'

export interface ArtifactOrder {
  id: number
  name: string
  at: number
  cat: OrderCategory
  min: number
  /** 없으면 대기. 이전 저장 상태와 초기 생성 모두 대기로 본다. */
  status?: OrderWorkStatus
  acknowledgedAt?: number
}

export interface ArtifactPatient {
  id: string
  nm: string
  bed: string
  reg: string
  ktas: number
  news: number | null
  newsPrev: number | null
  vs: number
  avpu: string
  orders: ArtifactOrder[]
  sched: [string, number][]
  cpr?: boolean
}

export interface ArtifactNurse {
  id: string
  name: string
  role: string
  patients: ArtifactPatient[]
  prio?: boolean
  coverBy?: string
}

export interface ArtifactSupport {
  from: string
  to: string
  start: number
  end: number | null
  tasks: number
  accepted: boolean
  cpr?: boolean
  role?: string
}

export interface ArtifactEvent {
  nurse: string
  pid: string
  type: string
  start: number
  end: number | null
}

export interface ArtifactDecline {
  from: string
  to: string
  t: number
  why: string
}

export interface ArtifactCpr {
  start: number
  phase: 0 | 1 | 2
  rosc: number | null
  closed: boolean
}

export type ActivityKind = 'assign' | 'accept' | 'decline' | 'perform' | 'end'

export interface ActivityEntry {
  id: number
  t: number
  kind: ActivityKind
  text: string
}

export interface ArtifactState {
  t: number
  view: string
  /** 없으면 시나리오 1. 09:00 데이터는 같고 시간 진행만 다르다. */
  scenario?: 'original' | 'flow'
  hiSince: Record<string, number>
  help: Record<string, boolean>
  events: ArtifactEvent[]
  supports: ArtifactSupport[]
  done: Record<string, number>
  supMin: Record<string, number>
  cpr: ArtifactCpr | null
  cap3Since: number | null
  decline: ArtifactDecline[]
  demoEvent: number
  nurses: ArtifactNurse[]
  seq: number
  activity: ActivityEntry[]
}

export interface WorkloadBreakdown {
  now: number
  base: number
  vsl: number
  pend: number
  late: number
  fc: number
  sup?: ArtifactSupport
  sups: ArtifactSupport[]
  ev?: ArtifactEvent
}

export interface CapacityResult {
  total: number
  limit: number
  n: number
  level: LevelCode
}

export interface AlertItem {
  st: AlertStage
  txt: string
  act: string
  nurse?: string
  cpr?: boolean
  aplus?: boolean
}

export interface ZoneTimelinessRow {
  zone: string
  pendingCount: number
  maxWaitMin: number
  acknowledgedCount: number
  /** 임시 수행 기준. 발표 화면에는 표시하지 않는다. */
  overdueCount: number
}
