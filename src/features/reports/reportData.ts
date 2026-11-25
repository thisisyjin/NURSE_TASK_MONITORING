import { LEVEL_LABEL } from '../../config/artifactConfig'
import { elapsedPendingMin, findNurse, formatClock, levelOf, loadOf } from '../../domain/artifact/rules'
import type { ActivityKind, ArtifactState, ArtifactSupport, LevelCode } from '../../domain/artifact/types'

export interface WorkSnapshotRow {
  nurseId: string
  name: string
  zone: string
  patientCount: number
  elapsedMin: number
  workloadMin: number | null
  level: LevelCode
}

export interface WorkSnapshot {
  t: number
  rows: WorkSnapshotRow[]
}

const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  assign: '배정',
  accept: '수락',
  decline: '거절',
  perform: '수행',
  end: '종료',
}

export function captureWorkSnapshot(state: ArtifactState): WorkSnapshot {
  return {
    t: state.t,
    rows: state.nurses.map((nurse) => {
      const load = loadOf(state, nurse)
      return {
        nurseId: nurse.id,
        name: nurse.name,
        zone: nurse.role,
        patientCount: nurse.patients.length,
        elapsedMin: elapsedPendingMin(state, nurse),
        workloadMin: load ? load.now : null,
        level: levelOf(state, nurse),
      }
    }),
  }
}

function supportSpan(support: ArtifactSupport) {
  if (!support.accepted) return '수락 대기'
  if (support.end == null) return '진행 중'
  return `${support.end - support.start}분`
}

export function workloadRows(snapshots: WorkSnapshot[], nurseId: string, minute: number | null) {
  const header = ['간호사', '시각', '구역', '담당 환자 수', '대기 처방 분', '현재 업무량 분', '업무 단계']
  const body = snapshots
    .filter((snapshot) => minute == null || snapshot.t === minute)
    .flatMap((snapshot) =>
      snapshot.rows
        .filter((row) => nurseId === 'all' || row.nurseId === nurseId)
        .map((row) => [
          row.name,
          formatClock(snapshot.t),
          row.zone,
          String(row.patientCount),
          String(row.elapsedMin),
          row.workloadMin == null ? '' : String(row.workloadMin),
          LEVEL_LABEL[row.level],
        ]),
    )
  return [header, ...body]
}

export function supportRows(state: ArtifactState, nurseId: string, minute: number | null) {
  const header = ['시각', '지원자', '대상', '상태', '수행 건수']
  const nurse = nurseId === 'all' ? null : findNurse(state, nurseId)
  const supports = state.supports
    .filter((support) => minute == null || support.start === minute)
    .filter((support) => !nurse || support.from === nurse.id || support.to === nurse.id)
    .map((support) => [
      formatClock(support.start),
      findNurse(state, support.from)?.name ?? support.from,
      `${findNurse(state, support.to)?.name ?? support.to}${support.role ? ` (${support.role})` : ''}`,
      supportSpan(support),
      `${support.tasks}건`,
    ])
  const declines = state.decline
    .filter((item) => minute == null || item.t === minute)
    .filter((item) => !nurse || item.from === nurse.id || item.to === nurse.id)
    .map((item) => [
      formatClock(item.t),
      findNurse(state, item.from)?.name ?? item.from,
      findNurse(state, item.to)?.name ?? item.to,
      `거절: ${item.why}`,
      '',
    ])
  return [header, ...supports, ...declines]
}

export function activityRows(state: ArtifactState, minute: number | null) {
  const header = ['시각', '종류', '내용']
  const body = state.activity
    .filter((item) => minute == null || item.t === minute)
    .map((item) => [formatClock(item.t), ACTIVITY_LABEL[item.kind], item.text])
  return [header, ...body]
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

export function reportCsv(sections: Array<{ title: string; rows: string[][] }>) {
  const lines: string[] = []
  for (const section of sections) {
    lines.push(csvCell(section.title))
    for (const row of section.rows) lines.push(row.map(csvCell).join(','))
    lines.push('')
  }
  return `\uFEFF${lines.join('\r\n')}`
}

export function downloadReport(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
