import { useState } from 'react'
import fixture0900 from '../../../samples/f2-input-0900.json'
import { f2Config } from '../../config/f2Config'
import { runF2Shift } from '../../services/f2/f2ApiClient'
import { getF2ApiKey, setF2ApiKey, setF2Mode } from '../../services/f2/f2Credentials'
import type { F2Result, F2ShiftInput } from '../../services/f2/f2Types'
import { useDemoStore } from '../../store/demoStore'

const sample = fixture0900 as F2ShiftInput

export function F2DebugPanel() {
  const f2 = useDemoStore((state) => state.f2)
  const refresh = useDemoStore((state) => state.refresh)
  const [open, setOpen] = useState(false)
  const [keyDraft, setKeyDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [fixture, setFixture] = useState<F2Result | null>(null)
  const [fixtureError, setFixtureError] = useState<string | null>(null)
  const [fixturePath, setFixturePath] = useState('')

  const applyMode = (mode: 'mock' | 'api') => {
    setF2Mode(mode)
    void refresh()
  }

  const callFixture = async () => {
    setF2ApiKey(keyDraft || getF2ApiKey())
    setBusy(true)
    setFixture(null)
    setFixtureError(null)
    try {
      const called = await runF2Shift(sample, { apiKey: getF2ApiKey() })
      setFixture(called.result)
      setFixturePath(called.path || '최상위')
    } catch (error) {
      setFixtureError(error instanceof Error ? error.message : 'F2 샘플 호출에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel panel-extra">
      <button className="ph ph-toggle" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <b>F2 API 연결</b>
        <span>{open ? '접기' : f2.source === 'api' && f2.ok ? 'API 결과' : 'Mock 사용 중, 펼치기'}</span>
      </button>
      {open ? (
        <div className="f2-debug">
          <p className="muted">
            카드의 현재 업무량만 바꿉니다. 지연, 지원, 1시간 뒤 값은 기존 Mock입니다. 키를 비우면 개발 서버가 로컬 설정 키를
            대신 넣습니다. 여기에 입력한 키는 브라우저 요청에 실립니다.
          </p>
          <label className="f2-key">
            API 키
            <input
              type="password"
              autoComplete="off"
              value={keyDraft}
              onChange={(event) => {
                setKeyDraft(event.target.value)
                setF2ApiKey(event.target.value)
              }}
            />
          </label>
          <div className="cf">
            <button type="button" className={f2.source === 'mock' ? 'on' : undefined} onClick={() => applyMode('mock')}>
              Mock
            </button>
            <button type="button" className={f2.source === 'api' && f2.ok ? 'on' : undefined} onClick={() => applyMode('api')}>
              현재 상태 API
            </button>
            <button type="button" onClick={() => void callFixture()} disabled={busy}>
              {busy ? '09:00 샘플 호출 중' : '09:00 샘플 호출'}
            </button>
          </div>
          <p className="muted">
            {f2.message}
            {f2.version ? `, ${f2.version}` : ''}
            {f2.shiftTotal != null ? `, 근무조 ${f2.shiftTotal}분` : ''}
            {f2.path ? `, 응답 위치 ${f2.path}` : ''}
          </p>
          {fixtureError ? <p className="error">{fixtureError}</p> : null}
          {fixture ? (
            <div>
              <p className="muted">
                샘플 합계 {fixture.shift_summary.total_minutes}분, {fixture.calculation_version}
                {fixturePath ? `, ${fixturePath}` : ''}
              </p>
              <ul className="f2-nurses">
                {fixture.nurses.map((nurse) => (
                  <li key={nurse.nurse_id}>
                    {nurse.nurse_name} {nurse.total_minutes}분, {nurse.workload_level}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="muted">
            브라우저 {f2Config.endpoint}, 전달 {f2Config.upstream}
          </p>
        </div>
      ) : null}
    </section>
  )
}
