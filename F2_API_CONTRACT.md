# Agent Builder F2 v3 API 연동 명세

## 1. 개요

- 기능: 간호사별 **현재 예상 업무량** 계산 및 근무조 합계 산정
- Flow: Chat Input → Custom Component(v3) → Chat Output
- API: `POST http://192.168.45.149:3001/api/v1/run/0cbe3a7e-2d2c-498f-bc6d-95703ce59380`
- 인증: `x-api-key` 헤더. 키는 문서에 입력하지 않는다.
- 입력과 출력 모두 LLM이 생성한 자연어가 아니라 **JSON 데이터**를 사용한다.
- v3 계산 코드: `references/F2_다중간호사_업무량산정_v3.py`
- Playground 정상 실행: 2026-11-19 이전 사용자가 확인한 `initial_0900` 결과는 전체 241분.
- **외부 HTTP API의 실제 응답 JSON 포맷은 아직 미확인**이다. 호출 후 Langflow Envelope를 파싱해야 한다.

## 2. HTTP 요청

```http
POST /api/v1/run/0cbe3a7e-2d2c-498f-bc6d-95703ce59380 HTTP/1.1
Host: 192.168.45.149:3001
Content-Type: application/json
x-api-key: <발급받은 개발자 키>
```

```ts
const snapshot = {
  scenario: { id: 'initial_0900', clock: '09:00' },
  nurses: [/* F2ShiftInput의 간호사 목록 */],
};

const response = await fetch(
  'http://192.168.45.149:3001/api/v1/run/0cbe3a7e-2d2c-498f-bc6d-95703ce59380',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey, // 개발자가 실행 중 직접 입력한 값
    },
    body: JSON.stringify({
      input_type: 'chat',
      output_type: 'chat',
      input_value: JSON.stringify(snapshot),
    }),
  },
);
if (!response.ok) throw new Error(`F2 API HTTP ${response.status}`);
const envelope: unknown = await response.json();
// 첫 실제 HTTP 응답의 구조를 확인한 뒤 결과 JSON 텍스트 추출 어댑터 구현
```

`input_value`는 JSON 객체 자체가 아니라 **JSON 문자열**이다. `JSON.stringify`가 요청 Body와 `input_value`에서 각각 사용되는 이유를 혼동하지 않는다.

공식 Langflow 설명에 따르면 `session_id`는 필수값이 아니다. 이 계산 Flow는 요청별 상태를 보존하지 않으므로 첫 테스트에는 생략한다.

## 3. 입력 데이터 계약

### 최상위 구조

```ts
type F2OrderStatus = 'pending' | 'in_progress' | 'scheduled' | 'completed';

type F2OrderInput = {
  id: string;
  name: string;
  status: F2OrderStatus;
  estimated_minutes: number; // 0 이상의 정수
};

type F2PatientInput = {
  id: string;
  ktas: 1 | 2 | 3 | 4 | 5;
  news: number; // 0 이상의 정수
  vital_interval_minutes: number; // 양의 정수, 30 / 60 / 240 등
  acute_deterioration: boolean;
  orders: F2OrderInput[];
};

type F2NurseInput = {
  id: string;
  name: string;
  patients: F2PatientInput[];
};

type F2ShiftInput = {
  scenario: { id: string; clock: string }; // HH:MM
  nurses: F2NurseInput[]; // 최소 1명
};
```

참고: `scenario.clock`은 현재 시연 시각을 전달 및 반환하기 위한 메타데이터다. **Flow 내부에서 시간 진행이나 예정 처방 활성화를 자동 처리하지 않는다.**

예정 처방이 수행 대기 처방으로 전환되는 로직은 기존 React 시뮬레이션에서 수행한다. `scheduled`는 F2 업무량 계산에서 제외하고, `pending`과 `in_progress`는 예상 소요시간 전체를 반영한다. `completed`는 제외한다.

**이번 F2에는 처방의 발생 시각, 경과시간, 최종 수행 기한, 지원 요청 상태를 전달할 필요가 없다.** 이 데이터는 React 및 향후 F3/F4의 책임이다.

## 4. 출력 데이터 계약 (Custom Component가 만드는 내부 JSON)

```ts
type F2PatientBreakdown = {
  patient_id: string;
  observation_minutes: number;
  vital_minutes: number;
  pending_order_minutes: number;
  unfinished_order_count: number;
};

type F2NurseOutput = {
  nurse_id: string;
  nurse_name: string;
  patient_count: number;
  observation_minutes: number;
  vital_minutes: number;
  pending_order_minutes: number;
  total_minutes: number;
  workload_level: '여유' | '보통' | '높음';
  has_acute_deterioration: boolean;
  patient_reference_minutes: number;
  exceeds_patient_reference: boolean;
  unfinished_order_count: number;
  patient_breakdown: F2PatientBreakdown[];
};

type F2ShiftSummary = {
  nurse_count: number;
  patient_count: number;
  observation_minutes: number;
  vital_minutes: number;
  pending_order_minutes: number;
  total_minutes: number;
  unfinished_order_count: number;
  patient_reference_minutes: number;
  exceeds_patient_reference: boolean;
};

type F2Result = {
  scenario: { id: string; clock: string };
  nurses: F2NurseOutput[];
  shift_summary: F2ShiftSummary;
  calculation_version: string; // html_demo_f2_v3_batch
};
```

**두 겹의 응답 처리 필수:** 실제 Langflow `/run` API는 위 `F2Result`를 최상위로 바로 반환한다고 가정하면 안 된다. 실행 메타데이터와 Chat Output Message 텍스트를 포함하는 Envelope을 먼저 반환할 수 있다. `Message.text`에 들어 있는 JSON 문자열을 안전하게 추출하고 다시 `JSON.parse`하여 `F2Result`로 검증한다. 다만 **정확한 경로는 실제 성공 응답을 확인해 결정한다**.

또한 F2 Custom Component는 입력 오류를 `Message(text='{"error":"..."}')` 형태로 반환한다. HTTP 200이어도 JSON의 최상위 `error`가 있으면 오류 상태로 표시한다.

## 5. 현재 v3 계산식: 시연용 임시 기준

- 환자별 관찰: KTAS 1=25, 2=15, 3=8, 4=4, 5=2분.
- 환자별 NEWS 가산: 7 이상 +12, 5 이상 +7, 3 이상 +3, 나머지 +0분.
- 환자 상태 급증(`acute_deterioration=true`): 관찰 +20분, 담당 간호사 단계 즉시 높음.
- 활력: 환자별 `round_half_up(60 / vital_interval_minutes × 3분)`.
- 대기 처방: `pending` 또는 `in_progress` 상태의 `estimated_minutes` 합산.
- 업무량: 관찰 + 활력 + 대기 처방.
- 단계: 30분 미만 여유, 30~50분 보통, 50분 초과 높음. 급증이면 즉시 높음.
- 환자 수 기준 비교값: `담당 환자 수 × 50분`. 단계 기준과 별개이며, **이 값만으로 임상적 인력 적정성을 확정하지 않는다.**

이 기준은 기존 HTML의 시연 규칙을 재현한 것이며 간호부가 검증한 운영 기준이 아니다. UI 내부에 별도 하드코딩하여 중복 구현하지 말 것.

## 6. 책임 경계

| React에서 유지 | Agent Builder F2에서 계산 |
| --- | --- |
| 환자 배정 및 변경 | 담당 환자별 관찰 예상시간 |
| 시연 시각 및 이벤트 처리 | 담당 환자별 활력 예상시간 |
| 예정 처방 발생, 수행 완료 및 지원 상태 | 미완료 처방 업무량 |
| 처방 대기 경과시간과 수행 기준 초과 | 간호사별 현재 업무량과 단계 |
| 지원 판단, 지원 배정, 수락 및 거절, 이력 | 근무조 현재 업무량 합계 |
| 1시간 뒤 시연용 표시값 | 환자 수 기반 비교값 |

기존 React의 Mock F2 로직은 **검증 및 장애 시연용**으로 반드시 남긴다. 모드 전환 전까지 화면은 기존 방식대로 정상 작동해야 한다.

## 7. API Key / 로컬 환경

첫 검증은 React의 개발자 전용 입력 UI에서 API Key를 받아 **메모리에만 보관**하고, `x-api-key` 헤더에 주입한다. 값을 복사해 코드, Git, 캡처, 문서에 기록하지 않는다. 브라우저에서 직접 요청하면 Network 탭에서는 키가 보일 수 있으므로 **개발자 단독 내부 테스트 용도**로 제한한다.

Vite의 `VITE_` 환경 변수에 API Key를 넣으면 클라이언트 번들에 노출된다. 공유 배포 단계에서 비밀 키가 필요하다면 병원 내부의 인증 프록시 또는 서버 계층이 필요하다. URL과 Flow ID는 공개 설정값으로 분리 가능하다.

네트워크 문제: React 개발 PC가 `192.168.45.149:3001`에 접근 가능한지, 브라우저 CORS 허용 여부, `localhost:5173` ↔ IP 주소의 Origin 차이, HTTP/HTTPS 혼합 콘텐츠를 구분해서 확인한다. `no-cors` 모드는 사용하지 않는다.

## 8. 추가 참고

- Langflow 1.10 API: https://docs.langflow.org/1.10.0/api-reference-api-examples
- Langflow Chat Input/Output: https://docs.langflow.org/chat-input-and-output
- Vite 환경변수 보안: https://vite.dev/guide/env-and-mode.html
