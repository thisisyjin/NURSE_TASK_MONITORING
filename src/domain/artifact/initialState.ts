import { ARTIFACT, CATALOG_MAP } from '../../config/artifactConfig'
import { trackHigh } from './rules'
import type { ArtifactOrder, ArtifactPatient, ArtifactState } from './types'
import type { DemoScenarioId } from '../../config/artifactConfig'

function makeOrder(state: ArtifactState, name: string, at: number): ArtifactOrder {
  const meta = CATALOG_MAP[name]
  state.seq += 1
  return { id: state.seq, name, at, cat: meta.cat, min: meta.min, status: 'pending' }
}

function makePatient(
  id: string,
  nm: string,
  bed: string,
  reg: string,
  ktas: number,
  news: number | null,
  newsPrev: number | null,
  vs: number,
  orders: ArtifactOrder[],
  sched: [string, number][],
): ArtifactPatient {
  return { id, nm, bed, reg, ktas, news, newsPrev, vs, avpu: 'A', orders, sched }
}

export function createInitialArtifactState(scenario: DemoScenarioId = 'original'): ArtifactState {
  const t0 = ARTIFACT.shiftStartMin
  const state: ArtifactState = {
    t: t0,
    view: 'leader',
    scenario,
    hiSince: {},
    help: {},
    events: [],
    supports: [],
    done: {},
    supMin: {},
    cpr: null,
    cap3Since: null,
    decline: [],
    demoEvent: 0,
    seq: 0,
    nurses: [],
    activity: [],
  }
  state.nurses = [
    {
      id: 'n1',
      name: '김서연',
      role: '1구역',
      patients: [
        makePatient('1-01', '김가온', '1구역 01병상', '41013827', 2, 6, 3, 120, [
          makeOrder(state, '수혈(PRBC)', t0 - 40),
          makeOrder(state, '채혈', t0 - 35),
          makeOrder(state, '정맥 항생제', t0 - 10),
        ], [['조영 검사 전 준비', t0 + 40]]),
        makePatient('1-02', '이나래', '1구역 02병상', '41025164', 3, 3, 3, 240, [
          makeOrder(state, '수술 전 준비', t0 - 5),
          makeOrder(state, '정맥 주사(IV push)', t0 - 5),
        ], []),
        makePatient('1-03', '박도담', '1구역 03병상', '41039402', 3, 2, 2, 240, [
          makeOrder(state, '경구약', t0),
        ], [['시술 전 준비(CAG)', t0 + 30]]),
      ],
    },
    {
      id: 'n2',
      name: '박도윤',
      role: '2구역',
      prio: true,
      patients: [
        makePatient('2-01', '최하람', '2구역 01병상', '42017735', 3, 4, 4, 240, [
          makeOrder(state, '정맥 주사(IV push)', t0 - 5),
          makeOrder(state, '항생제(패혈성 쇼크)', t0 - 25),
        ], []),
        makePatient('2-02', '정새봄', '2구역 02병상', '42026018', 4, 1, 1, 480, [], [['채혈', t0 + 20]]),
      ],
    },
    {
      id: 'n3',
      name: '이하은',
      role: '3구역',
      patients: [
        makePatient('3-01', '강다온', '3구역 01병상', '43018841', 2, 4, 4, 120, [
          makeOrder(state, '도뇨관 삽입', t0 - 15),
        ], []),
        makePatient('3-02', '윤보람', '3구역 02병상', '43023376', 3, 2, 2, 240, [
          makeOrder(state, '채혈', t0 - 5),
        ], [['조영 검사 전 준비', t0 + 50]]),
      ],
    },
    {
      id: 'n4',
      name: '최민준',
      role: '5구역',
      patients: [
        makePatient('5-01', '장누리', '5구역 01병상', '45015290', 4, 0, 0, 480, [], []),
        makePatient('5-02', '임한결', '5구역 02병상', '45027463', 5, 0, 0, 480, [
          makeOrder(state, '경구약', t0 - 5),
        ], []),
      ],
    },
    {
      id: 'n5',
      name: '정유나',
      role: '6구역',
      patients: [
        makePatient('6-01', '한바다', '6구역', '46012958', 4, 0, 0, 480, [makeOrder(state, '수액 교체', t0 - 10)], []),
        makePatient('6-02', '문가윤', '6구역', '46024107', 4, 1, 1, 480, [], []),
        makePatient('6-03', '배시온', '6구역', '46036682', 5, 0, 0, 480, [makeOrder(state, '경구약', t0 - 5)], []),
        makePatient('6-04', '조하늘', '6구역', '46041539', 4, 2, 2, 480, [], [['채혈', t0 + 30]]),
        makePatient('6-05', '홍다빈', '6구역', '46058274', 4, 1, 1, 480, [], []),
        makePatient('6-06', '류지안', '6구역', '46063915', 5, 0, 0, 480, [], []),
      ],
    },
    { id: 'n6', name: '한지호', role: '소생실', patients: [] },
  ]
  for (const nurse of state.nurses) {
    state.done[nurse.id] = 0
    state.supMin[nurse.id] = 0
  }
  trackHigh(state)
  return state
}
