# 간호업무량 실시간 간호지원체계: Claude Artifact 추출본

원본: 사용자 제공 `demo.html`.

## 파일
- `index.html`: 시연 화면의 정적 HTML, app.css/app.js 참조
- `app.css`: 시연 화면 스타일 (원본 그대로 추출)
- `app.js`: 업무량 계산, 간호사/환자 가상 데이터, 알림, 지원 기록, 시연 인터랙션 (원본 그대로 추출)

Claude 자체 실행 프레임 관련 코드는 제외하고 실제 앱의 body, style, 마지막 script를 분리했습니다.
JavaScript는 React가 아닌 브라우저 DOM 기반이며, 백엔드 API나 DB 연동은 없습니다.

## 로컬 확인
`index.html`을 브라우저에서 열면 됩니다. 필요 시 정적 서버를 이용하세요.
외부 Google Fonts는 선택사항이며 인터넷이 안 되면 로컬 폴백 폰트가 사용됩니다.

## Cursor 작업 가이드
1. 기존 React 프로젝트는 유지하고 새 브랜치에서 작업합니다.
2. `app.js`의 `init`, `loadOf`, `level`, `recommend`, `alerts`, `render`, `step`, `startSupport`, `triggerCPCR`을 분석합니다.
3. 화면은 Dashboard/ControlBar/NurseCard/PatientList/AlertPanel/SupportLog/StaffingCapacity/OrderTimeliness 등으로 분리합니다.
4. 초기 단계에서 기존 동작과 가상 데이터를 최대한 동일하게 구현합니다.
5. 동작 검증 이후 라이트 모드 및 UI 간소화, 마지막에 Agent Builder API 연동을 진행합니다.

주의:
- 처방 수행 기준 초과는 `S.t - order.at >= dueOf(n,order)`로 세며, 간호사 업무량은 별도 방식으로 계산합니다.
- 업무량은 KTAS/NEWS 상태 부하 + 활력징후 측정 시간 + 대기 처방 표준 소요시간의 합입니다.
- 업무 단계의 현행 코드에서는 `> 50`이면 높음, `>= 30`이면 보통입니다. 별도 발표 자료의 `50분 이상 높음`과 경계가 다릅니다.
- 임상적 판단 기준은 가상 시연용으로, 실제 운영의 검증된 기준이 아닙니다.
