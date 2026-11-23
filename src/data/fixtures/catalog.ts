export interface CatalogRule {
  id: string
  test: (name: string) => boolean
  label: string
  min: number
}

/** HTML RULES. 가운데점만 화면 문구에서 빼었다. */
export const ORDER_RULES: CatalogRule[] = [
  { id: 'central', test: (name) => /central line/i.test(name), label: 'Central line 삽입 준비 및 보조', min: 30 },
  { id: 'intubation', test: (name) => /intubation|기관 삽관/i.test(name), label: 'Intubation 준비 및 보조', min: 30 },
  { id: 'surgery', test: (name) => name.includes('수술 전'), label: '수술 전 준비', min: 30 },
  { id: 'procedure', test: (name) => name.includes('시술 전'), label: '시술 전 준비(CAG)', min: 25 },
  { id: 'transfusion', test: (name) => /수혈|prbc|ffp/i.test(name), label: '수혈(PRBC)', min: 25 },
  { id: 'aline', test: (name) => /a-line/i.test(name), label: 'A-line 삽입 준비 및 보조', min: 20 },
  { id: 'foley', test: (name) => name.includes('도뇨관'), label: '도뇨관 삽입', min: 15 },
  { id: 'contrast', test: (name) => name.includes('조영 검사 전'), label: '조영 검사 전 준비', min: 15 },
  { id: 'antibiotic', test: (name) => name.includes('항생제'), label: '정맥 항생제', min: 10 },
  { id: 'lab', test: (name) => /채혈|검체/.test(name), label: '채혈 및 검체 채취', min: 10 },
  { id: 'iv', test: (name) => /iv push|정맥 주사|수액/i.test(name), label: '정맥 주사(IV push), 수액', min: 5 },
  { id: 'oral', test: (name) => name.includes('경구'), label: '경구약', min: 3 },
]

export const RANDOM_ORDER_POOL = [
  '정맥 주사(IV push)',
  '채혈',
  '정맥 항생제',
  'A-line 삽입 준비 및 보조',
  'Central line 삽입 준비 및 보조',
  'Intubation 준비 및 보조',
  '수혈(PRBC)',
  '경구약',
  '도뇨관 삽입',
  '검체 채취(소변)',
  '수술 전 준비',
  '수액 교체',
]

export const CATALOG_PREVIEW_COUNT = 9
