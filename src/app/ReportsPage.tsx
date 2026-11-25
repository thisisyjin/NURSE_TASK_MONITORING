import { useMemo, useState } from 'react'
import { formatClock } from '../domain/artifact/rules'
import { activityRows, downloadReport, reportCsv, supportRows, workloadRows } from '../features/reports/reportData'
import { PrettySelect } from '../features/ui/PrettySelect'
import { go, isVer2, usePath } from './navigation'
import { useDemoStore } from '../store/demoStore'

export function ReportsPage() {
  const board = useDemoStore((state) => state.board)
  const snapshots = useDemoStore((state) => state.snapshots)
  const back = isVer2(usePath()) ? '/ver2' : '/'
  const [nurseId, setNurseId] = useState('all')
  const [minute, setMinute] = useState<number | null>(null)
  const times = useMemo(() => [...new Set(snapshots.map((snapshot) => snapshot.t))], [snapshots])
  const workload = workloadRows(snapshots, nurseId, minute)
  const supports = supportRows(board, nurseId, minute)
  const activity = activityRows(board, minute)
  const workloadBody = workload.slice(1)
  const levelCount = { 높음: 0, 보통: 0, 여유: 0 }
  for (const row of workloadBody) {
    const level = row[6]
    if (level === '높음' || level === '보통' || level === '여유') levelCount[level] += 1
  }

  const save = () => {
    const clock = formatClock(board.t).replace(':', '')
    downloadReport(
      `간호업무_리포트_${clock}.csv`,
      reportCsv([
        { title: '시각별 업무', rows: workload },
        { title: '지원 기록', rows: supports },
        { title: '수행 기록', rows: activity },
      ]),
    )
  }

  return (
    <div className="wrap v3 reports">
      <header className="top">
        <div>
          <h1>리포트 보기</h1>
          <div className="sub">시각별 업무, 지원 기록, 수행 기록을 간호사와 시각으로 조회합니다.</div>
        </div>
        <div className="reports-tools">
          <div className="clock" aria-live="polite">
            <small>시연 시각</small>
            <span>{formatClock(board.t)}</span>
          </div>
          <button type="button" className="reports-back" onClick={() => go(back)}>
            대시보드
          </button>
        </div>
      </header>
      <div className="reports-stats">
        <article className="reports-stat">
          <b>{workloadBody.length}</b>
          <span>시각별 업무</span>
        </article>
        <article className="reports-stat">
          <b>{supports.length - 1}</b>
          <span>지원 기록</span>
        </article>
        <article className="reports-stat">
          <b>{activity.length - 1}</b>
          <span>수행 기록</span>
        </article>
      </div>
      <div className="bar">
        <div className="filters">
          <PrettySelect
            label="간호사"
            value={nurseId}
            onChange={setNurseId}
            options={[
              { value: 'all', label: '전체' },
              ...board.nurses.map((nurse) => ({ value: nurse.id, label: nurse.name })),
            ]}
          />
          <PrettySelect
            label="시각"
            value={minute == null ? 'all' : String(minute)}
            onChange={(value) => setMinute(value === 'all' ? null : Number(value))}
            options={[{ value: 'all', label: '전체' }, ...times.map((time) => ({ value: String(time), label: formatClock(time) }))]}
          />
        </div>
        <button type="button" className="pri" onClick={save}>
          리포트 다운로드
        </button>
      </div>
      <section className="box">
        <h2>
          <span className="reports-title">
            시각별 업무<em>{workloadBody.length}건</em>
          </span>
          {workloadBody.length > 0 ? (
            <span className="reports-levels">
              <span className="lvl l-hi">높음 {levelCount.높음}</span>
              <span className="lvl l-mid">보통 {levelCount.보통}</span>
              <span className="lvl l-ok">여유 {levelCount.여유}</span>
            </span>
          ) : null}
        </h2>
        <ReportTable rows={workload} empty="기록된 시각이 없습니다." />
      </section>
      <div className="reports-split">
        <section className="box">
          <h2>
            <span className="reports-title">
              지원 기록<em>{supports.length - 1}건</em>
            </span>
          </h2>
          <ReportTable rows={supports} empty="지원 기록이 없습니다." />
        </section>
        <section className="box">
          <h2>
            <span className="reports-title">
              수행 기록<em>{activity.length - 1}건</em>
            </span>
          </h2>
          <ReportTable rows={activity} empty="수행 기록이 없습니다." />
        </section>
      </div>
    </div>
  )
}

const NUMBER_COLUMNS = new Set(['담당 환자 수', '대기 처방 분', '현재 업무량 분', '수행 건수'])
const NAME_COLUMNS = new Set(['간호사', '지원자'])

function columnClass(header: string) {
  if (NUMBER_COLUMNS.has(header)) return 'num'
  if (NAME_COLUMNS.has(header)) return 'name'
  if (header === '시각') return 'when'
  return ''
}

function levelClass(value: string) {
  if (value === '높음') return 'l-hi'
  if (value === '보통') return 'l-mid'
  if (value === '여유') return 'l-ok'
  return ''
}

function stateClass(value: string) {
  if (value.startsWith('거절')) return 'bad'
  if (value === '진행 중') return 'live'
  if (value === '수락 대기') return 'wait'
  return 'done'
}

function ReportCell({ header, value }: { header: string; value: string }) {
  if (header === '업무 단계' && value) return <span className={`lvl ${levelClass(value)}`}>{value}</span>
  if (header === '상태' && value) return <span className={`rep-state ${stateClass(value)}`}>{value}</span>
  return value
}

function ReportTable({ rows, empty }: { rows: string[][]; empty: string }) {
  const [header, ...body] = rows
  const levelIndex = header.indexOf('업무 단계')
  return (
    <div className="sheet">
      <table>
        <thead>
          <tr>
            {header.map((cell) => (
              <th key={cell} className={columnClass(cell)}>
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.length === 0 ? (
            <tr>
              <td className="empty" colSpan={header.length}>
                {empty}
              </td>
            </tr>
          ) : (
            body.map((row, index) => (
              <tr key={`${row.join('-')}-${index}`} className={levelIndex >= 0 && row[levelIndex] === '높음' ? 'is-hi' : undefined}>
                {row.map((cell, cellIndex) => (
                  <td key={header[cellIndex]} className={columnClass(header[cellIndex])}>
                    <ReportCell header={header[cellIndex]} value={cell} />
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
