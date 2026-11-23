export type LevelCode = 'ok' | 'mid' | 'hi'
export type OrderCategory = 'H' | 'M' | 'L'
export type AlertStage = 'E' | 0 | 1 | 2 | 3 | 4

export interface ArtifactOrder {
  id: number
  name: string
  at: number
  cat: OrderCategory
  min: number
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

export interface ArtifactState {
  t: number
  view: string
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
  overdueCount: number
}
