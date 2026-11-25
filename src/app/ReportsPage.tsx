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
          <h1>시연 리포트</h1>
          <div className="sub">가상 데이터입니다. 새로고침하면 이 기록은 사라집니다. 날짜는 시연 하루이고 시각으로 구분합니다.</div>
        </div>
        <button type="button" className="reports-back" onClick={() => go(back)}>
          대시보드
        </button>
      </header>
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
        <h2>시각별 업무</h2>
        <ReportTable rows={workload} empty="기록된 시각이 없습니다." />
      </section>
      <section className="box">
        <h2>지원 기록</h2>
        <ReportTable rows={supports} empty="지원 기록이 없습니다." />
      </section>
      <section className="box">
        <h2>수행 기록</h2>
        <ReportTable rows={activity} empty="수행 기록이 없습니다." />
      </section>
    </div>
  )
}

function ReportTable({ rows, empty }: { rows: string[][]; empty: string }) {
  const [header, ...body] = rows
  return (
    <div className="sheet">
      <table>
        <thead>
          <tr>
            {header.map((cell) => (
              <th key={cell}>{cell}</th>
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
              <tr key={`${row.join('-')}-${index}`}>
                {row.map((cell, cellIndex) => (
                  <td key={header[cellIndex]}>{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
