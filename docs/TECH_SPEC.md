# React 화면 개발 및 Agent Builder 연동 기술 명세

이 문서의 목적은 **시연용 프론트엔드와 향후 Flow 구현 경계를 구체적으로 정의**하는 것이다. 아래 TypeScript는 개발 설계 예시이며, 간호부가 확정한 데이터 사전이나 실제 Agent Builder API 스키마를 의미하지 않는다. 최종 필드는 기존 HTML과 엑셀의 실제 항목을 확인하여 맞춘다.

## 1. 전체 설계

```text
[시연 버튼 / 화면 이벤트]
          |
          v
     Zustand 상태
     - 가상 간호사 / 담당 구역
     - 환자와 처방 / 시연 현재시각
     - 지원 요청 / 배정 / 기록
          |
          v
  EvaluationService 인터페이스
          |
  +-------+------------------------+
  |                                |
  v                                v
MockEvaluationService     LangflowEvaluationService
(지금 구현할 로컬 계산)      (Flow 개발 후 연결)
  |                                |
  +---------------+----------------+
                  |
                  v
            계산 결과 state
                  |
                  v
        NurseCard / AlertPanel
        SupportPanel / OrderSummary
```

**중요:** 새로고침이나 Flow API 호출이 발생하더라도 컴포넌트가 직접 환자 및 처방 데이터를 변경해서는 안 된다. 사용자 동작에 따른 상태 변경은 React가 담당하고, 계산 결과만 평가 서비스로부터 받는다.

## 2. 화면에서 확인된 가상 데이터

### 2.1. 간호사와 환자

- 환자 담당 간호사: 김서연(1구역), 박도윤(2구역), 이하은(3구역), 최민준(4구역)
- 별도 역할: 정유나(Pre-T), 한지호(물품관리)
- 담당 환자: 김서연 A-01~A-03, 박도윤 B-01~B-02, 이하은 C-01~C-02, 최민준 D-01~D-02
- 표시할 환자 속성: 코드, KTAS, NEWS, 활력 측정 주기, 처방 목록
- 실제 환자명, 등록번호, 주민번호 등 개인식별 항목을 샘플에 추가하지 않는다.

### 2.2. 최초 시연 화면의 산출값 예시

`간호업무량_시연화면기준_가상데이터_입력표(1).xlsx`의 시연 예시 열 기준:

| 간호사 | 관찰(분) | 활력(분) | 대기 처방(분) | 합계(분) |
| --- | ---: | ---: | ---: | ---: |
| 김서연 | 40 | 12 | 83 | 135 |
| 박도윤 | 15 | 4 | 15 | 34 |
| 이하은 | 25 | 9 | 25 | 59 |
| 최민준 | 8 | 2 | 3 | 13 |
| **합계** | 88 | 27 | 126 | **241** |

이 표는 **기존 자료의 하나의 시연 시점**을 설명하는 예시다. 최근 별도 스크린샷에서는 김서연 `45 + 15 + 83 = 143분`이 보인다. 서로 다른 출처의 수치를 섞지 말고, Cursor에서 실제 HTML의 시연 상태를 분석한 뒤 하나의 fixture로 통일한다.

기존 시연의 인력 기준 `4명 × 50분 = 200분`은 **최신 간호부 답변으로 변경된 구 기준**이므로 재사용 금지. 위 9명의 담당 환자를 기준으로 계산하면 비교용 인력 기준이 `9 × 50분`이 된다는 점은 테스트에서 확인할 수 있으나, 실제 화면과 시나리오의 환자 수가 변할 수 있으므로 **항상 현재 담당 환자 데이터에서 동적으로 산출**한다.

### 2.3. 용어와 단위

| 필드 | 뜻 | 화면의 예 |
| --- | --- | --- |
| `estimatedDurationMin` | 특정 처방을 수행하는 데 드는 예상 소요시간 | 수혈 25분 |
| `waitingElapsedMin` | 처방 발생 또는 예정시각 이후 아직 완료되지 않은 경과시간 | 대기 40분 |
| `targetCompletionMin` | 처방 수행에 허용된 목표시간 | 기준 30분 |
| `observationMin` | 관찰에 필요한 예상시간 | 관찰 40분 |
| `vitalSignsMin` | 활력징후 측정 예상시간 | 활력 12분 |
| `pendingOrdersMin` | 미완료 처방들의 `estimatedDurationMin` 합계 | 대기 처방 83분 |
| `totalWorkloadMin` | 위 세 구성요소 합계 | 현재 업무량 135분 |
| `capacityReferenceMin` | 환자당 50분을 곱한 비교 기준 | 담당 환자 수 × 50분 |

처방별 `estimatedDurationMin`과 `waitingElapsedMin`을 같은 필드에 저장하지 않는다.

## 3. 도메인 타입 설계 예시

실제 파일은 `src/domain/types.ts` 등으로 구현한다. 아래는 구조 가이드이며 실제 HTML의 식별자 및 UI 필드에 맞게 조정한다.

```ts
type NurseId = string;
type PatientId = string;
type OrderId = string;

type WorkloadLevel = 'low' | 'normal' | 'high';
type NurseRole = 'assigned' | 'preT' | 'supplies';
type ViewerRole = 'chargeNurse' | 'staffNurse';

type OrderStatus = 'pending' | 'completed';
type SupportStatus = 'requested' | 'assigned' | 'accepted' | 'rejected' | 'inProgress' | 'completed';

type UnavailableReason = 'break' | 'criticalPatient' | 'otherTask';

interface Nurse {
  id: NurseId;
  displayName: string; // 가상 이름
  zone?: string;
  role: NurseRole;
  availableForSupport: boolean;
  unavailableReason?: UnavailableReason;
  isPriorityTarget?: boolean; // 책임간호사에게만 표시
}

interface Patient {
  id: PatientId; // A-01 등 가상 코드
  assignedNurseId: NurseId;
  zone: string;
  ktas: number;
  news: number;
  previousNewsRiskLevel?: 'good' | 'caution' | 'risk' | 'highRisk';
  vitalIntervalMin?: number;
  hasDeteriorationEvent?: boolean; // 시연 이벤트 상태
}

interface Order {
  id: OrderId;
  patientId: PatientId;
  name: string;
  category?: string;
  urgency?: 'stat' | 'routine' | 'scheduled';
  issuedAtMin: number;       // 09:00부터의 상대 분, 필요 시 음수 가능
  scheduledAtMin?: number;  // 예정 처방일 때만
  estimatedDurationMin: number;
  targetCompletionMin: number;
  status: OrderStatus;
  completedAtMin?: number;
  performerNurseId?: NurseId;
}

interface SupportAssignment {
  id: string;
  targetNurseId: NurseId;
  helperNurseId?: NurseId;
  status: SupportStatus;
  requestedAtMin: number;
  startedAtMin?: number;
  endedAtMin?: number;
  rejectedReason?: string;
  performedOrderIds: OrderId[];
}

interface NurseWorkloadResult {
  nurseId: NurseId;
  observationMin: number;
  vitalSignsMin: number;
  pendingOrdersMin: number;
  totalWorkloadMin: number;
  level: WorkloadLevel;
  capacityReferenceMin: number;
  exceedsCapacityReference: boolean;
  forceHighReason?: 'patientDeterioration';
}

interface OrderDelayResult {
  orderId: OrderId;
  elapsedMin: number;
  targetCompletionMin: number;
  isOverdue: boolean;
}

interface SupportEvaluationResult {
  targetNurseId: NurseId;
  alertStage: 1 | 2 | 3 | null;
  reasons: string[];
  recommendedHelperIds: NurseId[];
}

interface DemoState {
  currentMinute: number; // 09:00 = 0, 09:15 = 15, 09:45 = 45
  nurses: Nurse[];
  patients: Patient[];
  orders: Order[];
  supportAssignments: SupportAssignment[];
  appliedEventIds: string[];
  viewerRole: ViewerRole;
  viewerNurseId?: NurseId;
}
```

**타입 보충:** 위 `previousNewsRiskLevel`은 이전 원시 NEWS 점수를 필수로 수집하라는 의미가 아니다. 시연 중 실제 위험 단계가 상승했는지를 표현하기 위한 최소한의 UI 상태다. 시연 데이터에 과거 점수가 없다면 화살표를 임의 생성하지 않는다.

## 4. 프론트엔드에서 처리하는 동작

### 4.1. 시간 진행

- 실제 시계와 분리된 가상 시각을 사용한다.
- 09:00을 기준 `currentMinute = 0`, 09:15를 `15`, 09:45를 `45`처럼 표현한다.
- 시간 진행 시 아직 수행하지 않은 처방만 경과시간 재계산.
- 예정 처방의 기준 시작 시점은 `scheduledAtMin`. 예정 전에는 해당 처방을 아직 대기 경과 대상으로 집계하지 않는다.
- 새 처방 추가, NEWS 변화, 환자 상태 악화 등은 **시나리오 이벤트**로 명시한다.
- 이벤트를 같은 시점에 두 번 적용하지 않는다. 이벤트 ID를 저장한다.
- 자동 진행은 시작/정지가 가능해야 하며, 컴포넌트 언마운트 시 interval 정리.

### 4.2. 수행 버튼

1. 아직 완료되지 않은 처방인지 확인
2. 현재 담당 간호사 또는 수락한 지원 간호사 중 수행자 확인
3. `status = completed`, `completedAtMin`, `performerNurseId` 기록
4. 대상 환자 담당 간호사의 **남은 대기 처방 목록 및 합계 감소**
5. 지원 간호사가 수행했으면 지원 기록의 수행 건수 및 해당 수행자 실적 표시 갱신
6. F2 및 F3 모의 평가 결과 갱신, 필요 시 F4 재평가

수행한 예상시간을 **지원 간호사의 남은 업무량에 그대로 더해서는 안 된다.** 이미 완료된 업무시간과 남은 업무시간은 별개다. 수행 귀속과 지원 기록의 의미가 구 화면에서 불명확하면 HTML을 확인하고 적절히 문서화한다.

### 4.3. 지원 절차

- `지원 필요`: 담당 간호사 본인 또는 근무 책임간호사, 전문간호사가 설정 가능이라는 최신 답변을 반영. 시제품에는 권한별 버튼 분기로 시연.
- `지원 우선 대상`: 책임간호사만 지정 및 확인 가능. 환자 처방 목표시간 자체를 변경하지 않음.
- `지원자 추천`: 지원 불가 상태의 간호사는 제외하고 현재 시연 업무량이 상대적으로 적은 후보를 먼저 제시. 구체적 정렬 우선순위가 확정되지 않았으면 데모용 단순 규칙으로 둔다.
- `지원 배정`: 책임간호사가 추천 결과를 보거나 다른 지원 간호사를 선택해 배정.
- `수락/거절`: 지원 간호사가 확인. 거절에는 사유 선택 포함.
- `지원 시작`: 수락 후 진행 시작. 구 시연 HTML이 배정과 시작을 동시에 취급한다면 **변경된 절차를 기록**하고, 시연 플로우가 불필요하게 길어지지 않게 설계.
- `수행`: 수락한 지원 간호사가 대상 간호사 담당 처방을 수행.
- `지원 종료`: 시작, 종료, 지원 경과시간, 수행 건수 기록.
- 최소한의 지원 이력은 Zustand에 저장하고 선택적으로 localStorage에 보관.

## 5. 4개 Flow의 권장 API 경계

**각 Flow는 Langflow 내부에서 Custom Component 및 필요한 노드를 연결해 구성할 계획이다.** 아래 프론트엔드 계약은 실제 Flow API 요청 바디가 아니라 **앱 내부에서 사용하는 안정적인 데이터 계약**이다.

```ts
interface EvaluationService {
  classifyOrders(input: {
    orders: Order[];
    catalog: Array<{
      name: string;
      category: string;
      estimatedDurationMin: number;
    }>;
  }): Promise<Array<{
    orderId: OrderId;
    category: string;
    estimatedDurationMin: number;
    matched: boolean;
  }>>;

  calculateWorkloads(input: {
    nurses: Nurse[];
    patients: Patient[];
    orders: Order[];
    observationMinutesByNurse: Record<NurseId, number>;
    vitalMinutesByNurse: Record<NurseId, number>;
    workloadThresholds: { normalFromMin: number; highFromMin: number };
    patientCapacityMinutes: number;
  }): Promise<NurseWorkloadResult[]>;

  evaluateOrderDelays(input: {
    orders: Order[];
    patients: Patient[];
    currentMinute: number;
  }): Promise<{
    orders: OrderDelayResult[];
    zones: Array<{
      zone: string;
      pendingCount: number;
      overdueCount: number;
      maxWaitingMin: number;
    }>;
  }>;

  evaluateSupport(input: {
    nurses: Nurse[];
    workloads: NurseWorkloadResult[];
    delays: OrderDelayResult[];
    patients: Patient[];
    manualSupportRequests: NurseId[];
    existingAssignments: SupportAssignment[];
    currentMinute: number;
  }): Promise<SupportEvaluationResult[]>;
}
```

### F1: 처방 분류

- **화면에 필요한 결과:** 처방 분류(높음, 중간, 낮음 등 기존 기준표) 및 예상 수행시간.
- **데모 우선:** 기존 시연 화면에 있는 처방과 기준표의 매핑. 분류 결과는 명확하게 재현 가능해야 한다.
- 입력 처방명과 규칙표가 매칭되지 않으면 임의의 임상 등급을 정하지 않는다. `matched: false`로 반환하고 시연용 기본값이 있다면 별도 표시.
- 추후 실제 Agent Builder에서는 LLM 또는 규칙 컴포넌트를 이용할 수 있지만, 프로토타입에서 LLM을 쓰고 있다고 주장할 필요는 없다.

### F2: 업무량 산정

```text
관찰 예상시간 (현재는 가상 데이터)
+ 활력 측정 예상시간 (현재는 가상 데이터)
+ 미완료이며 현재 대기 상태인 처방의 예상 수행시간 합계
= 현재 예상 업무량
```

- 환자 상태에 따라 관찰시간을 새로 추정하는 공식은 아직 확정된 것으로 취급하지 않는다.
- 30분, 50분 단계 구간은 데모용 `workloadThresholds`에서 관리.
- 환자 악화 이벤트가 있다면 해당 간호사의 단계는 즉시 `high`로 표시하고 사유 제공.
- 비교용 적정 인력 기준은 `담당 환자 수 × patientCapacityMinutes(기본 50)`.
- 환자당 50분을 현재 업무량에 가산하지 않는다.

### F3: 처방 지연 판단

```ts
const waitStart =
  order.urgency === 'scheduled' && order.scheduledAtMin !== undefined
    ? order.scheduledAtMin
    : order.issuedAtMin;

const isAwaiting = order.status === 'pending' && currentMinute >= waitStart;
const elapsedMin = isAwaiting ? Math.max(0, currentMinute - waitStart) : 0;
const isOverdue = isAwaiting && elapsedMin > order.targetCompletionMin;
```

- 위는 **시연용 구현 예시**다. `>`와 `>=` 경계는 시연 기준에 맞게 config로 검증한다.
- `수행 기준 초과` 건수를 환자별, 간호사별, 구역별로 동일한 결과에서 파생한다.
- `지원 우선 대상`의 10분 조기 알림은 **처방 수행 기준 초과 판정**과 별도로 처리한다.

### F4: 지원 판단 및 추천

- 입력: 현재 업무량 단계, 지속시간을 알 수 있는 시연 상태, 지연 처방, 악화 이벤트, 직접 지원 요청, 인력 적정성, 지원 가능 여부.
- 단계 1: 높음 진입 또는 직접 요청을 근무 책임간호사에게 알림.
- 단계 2: 높음 지속, 초과 처방, 환자 상태 악화를 근무 책임간호사와 응급전문간호사에게 알림.
- 단계 3: 근무조 과부하를 간호관리자 알림으로 표시. 실제 관리자 시스템으로 전송하지 않음.
- 4단계는 2차 또는 확장으로 유보.
- NEWS 위험 5점 이상과 고위험 7점 이상의 의미를 최신 간호부 답변에 따라 구분. 화면에 이벤트가 없다면 이전 상태를 추측하지 않는다.
- 추천 대상 제외: 휴식, 중증 환자 전담, 다른 업무 등의 지원 불가 상태, 자기 자신, 이미 충돌하는 지원 배정 상태.
- 단순 데모 추천은 지원 가능 후보의 낮은 업무량을 우선 활용하되, 최종 배정은 항상 책임간호사가 한다.

## 6. 실제 Langflow 연동의 최소 구조

### 6.1. 모드 선택

```ts
type EvaluationMode = 'mock' | 'langflow';

function createEvaluationService(mode: EvaluationMode): EvaluationService {
  return mode === 'langflow'
    ? new LangflowEvaluationService()
    : new MockEvaluationService();
}
```

- 실제 설정은 환경 및 UI 시연 모드에 따라 명시적으로 선택.
- 모드가 `mock`일 때 외부 네트워크 요청을 보내지 않는다.
- API가 실패하면 사용자에게 오류를 보여주고, **실제 Flow 결과인 것처럼 Mock 값으로 몰래 대체하지 않는다.** 데모용 fallback을 사용하는 경우 UI에 `Mock 모드`임을 표시한다.

### 6.2. API 연결 시 확인 목록

연구실 Agent Builder의 실제 배포 버전에서 `Share / API Access` 또는 동등 기능을 확인한다.

- Flow별 정확한 ID
- 기본 URL, 예: 내부 서버 주소
- 실제 실행 엔드포인트(일반 Langflow 계열은 `/api/v1/run/{flow_id}` 패턴)
- 입력 컴포넌트 유형 및 `input_value`, `input_type` 등 실제 요청 형식
- API 인증 방식 및 접근 권한
- API 응답에서 Custom Component 결과 JSON을 추출하는 실제 경로
- 타임아웃, 네트워크 장애, 오류 코드, 재시도 정책
- CORS 허용 오리진
- 외부 전송이 없는지와 가상 데이터만 사용하는지

**주의:** Langflow의 응답은 Flow 구성, 입출력 노드, 커스텀 포크에 따라 중첩 구조가 달라질 수 있으므로, 백엔드가 항상 `{ result: ... }`와 같은 형태로 반환한다고 가정하지 않는다. 실제 API 응답 샘플을 확보한 뒤 중앙 어댑터에서 파싱한다.

**정적 페이지 인증:** 빌드된 브라우저 코드는 누구나 볼 수 있으므로 `VITE_API_KEY` 같은 형태로 영구 키를 배포하지 않는다. 데모 환경에서 인증 문제를 해결하더라도 보안 정책을 생략하는 것과는 구분한다.

## 7. 화면 컴포넌트 추천

```text
DashboardPage
├─ DemoToolbar
│  ├─ ShiftBadge
│  ├─ SimulationClock
│  ├─ ViewerSwitcher
│  └─ ScenarioControls
├─ NurseGrid
│  └─ NurseCard
│     ├─ NurseSummary
│     ├─ WorkloadBreakdown
│     ├─ WorkloadProgressBar
│     ├─ PatientSection
│     │  └─ PatientOrderRow
│     └─ NurseSupportActions
└─ Sidebar
   ├─ SupportAlertPanel
   ├─ StaffingAdequacyPanel
   ├─ ZoneOrderTimelinessPanel
   ├─ ActiveSupportPanel
   ├─ SupportHistoryPanel
   └─ OrderCatalogPanel

Modal / Dialog
├─ AssignSupportDialog
├─ SupportRequestDialog
├─ SupportAcceptRejectDialog
└─ ScenarioConfirmDialog (필요 시)
```

원래 HTML에 없는 별도 페이지나 복잡한 라우팅을 만들기보다는, 한 화면의 역할 전환과 필요한 모달만 우선 구현한다.

## 8. Zustand 스토어 권장 분리

```text
rawState
  nurses / patients / orders / supportAssignments / scenarioClock

actions
  advanceTime / applyScenarioEvent / completeOrder
  requestSupport / setPriorityTarget / assignSupport
  acceptSupport / rejectSupport / endSupport
  changeViewer / resetDemo

computed results
  workloads / orderDelays / supportRecommendations / alerts / zoneSummary
```

- 가능한 합계는 selector 또는 단일 계산 서비스 결과에서 가져온다.
- Flow 재평가 트리거는 처방 추가 및 수행, 환자 상태 변경, 시연 시간 진행, 지원 가능 상태 변경 등 의미 있는 이벤트로 제한.
- 중복 API 요청으로 오래된 응답이 최신 상태를 덮지 않게 요청 ID 또는 상태 버전 검사.
- Mock은 결정적(deterministic)이어야 한다. 매 실행마다 임의의 간호사를 추천하지 않는다.

## 9. 영속성 및 시연 리셋

- 기본은 메모리 상태만으로 충분.
- 필요하면 Zustand persist와 localStorage를 사용하되, **초기화가 반드시 가능**해야 한다.
- 스키마 버전을 저장하고 버전이 다르면 샘플을 새로 로딩.
- 브라우저의 서로 다른 탭은 실시간 동기화되지 않는다는 사실을 명시.
- 시연 로그는 실제 원내 운영 기록 또는 의료기록이 아니다.

## 10. 프로토타입에서 하지 말 것

- 실제 AMIS 또는 EMR 호출
- 신규 가상 환자 임상기록 창작 및 실제 개인정보 사용
- 예측 AI 모델, 의료 위험 판단용 모델, 처방 지시 자동화
- 구현 근거 없이 NEWS나 KTAS마다 임의의 업무시간 가중치 부여
- 모든 보조 업무를 처방으로 취급
- 간호사 개인별 성과 순위 생성
- 처방 수행 기준을 우선 대상이라는 이유로 10분 줄이기
- 초기값과 다른 시점의 숫자를 섞어 일관성이 없는 카드 표시
- 실제 API가 아직 없는데 API가 동작한다고 표시
