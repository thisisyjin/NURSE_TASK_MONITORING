# F2 React 연동 패키지: 시작 안내

이번 작업의 목표는 **현재 React 현황판의 디자인과 시연 기능을 유지한 채**, 연구실 Agent Builder에서 이미 검증된 **F2 근무조 업무량 산정 Flow(v3)** 를 React에서 호출해 결과를 반영하는 것이다.

현재까지 확인한 사실:
- React UI와 HTML 기반 Mock 계산은 Cursor에서 구현했다.
- F2 v3는 Agent Builder Playground에서 간호사 4명, 환자 9명을 한 번에 계산한다.
- 09:00 반환값은 김서연 136, 박도윤 34, 이하은 60, 최민준 11분, 전체 241분이다.
- **React에서 HTTP API를 실제 호출한 것은 아직 검증하지 않았다.**
- Cursor에 F2 분리나 API 연동 코드를 별도로 지시한 적이 없다는 전제에서 시작한다.

## 파일 사용 순서

1. `CURSOR_START_PROMPT.md`의 내용을 Cursor Agent 대화창에 붙여넣는다.
2. Cursor 프로젝트의 `docs/` 또는 `references/`에 `F2_API_CONTRACT.md`, `F2_TEST_PLAN.md`, `samples/`를 함께 추가한다.
3. 원본 `references/HTML_ANALYSIS.md`는 기존 Cursor 문서가 있다면 중복 덮어쓰기 전에 비교한다.
4. 발급한 API Key는 Cursor 대화창이나 Git에 전달하지 않는다. 개발자 전용 테스트 입력으로 실행 중 메모리에만 보관하는 것을 우선한다.
5. 실제 API 호출 성공 후 API 응답 원본 구조를 확인하고 파서를 확정한다.

## 현재 Flow API

```text
POST http://192.168.45.149:3001/api/v1/run/0cbe3a7e-2d2c-498f-bc6d-95703ce59380
x-api-key: <사용자가 발급한 값>
Content-Type: application/json
```

**주의:** 위 Flow ID가 실제로 지금 성공한 v3를 가리키는지 API로 09:00 테스트를 해서 확인한다. Playground 성공과 외부 API 성공은 별개다.

## 이번에 하지 않을 것

- HTML 또는 React UI 전면 재작성
- F1 처방 분류, F3 처방 지연 판단, F4 지원 추천의 API 연동
- Langflow 블록 재구성 및 프롬프트 추가
- 실환자 데이터, 병원 운영계 DB, 실제 AMIS 연동
- Langflow 내 상태 저장, 1시간 뒤 AI 예측 모델
- 복잡한 운영 보안 체계 구축 (단, 개발용 키 노출 위험은 반드시 고지)

## 성공 판정

09:00에서 `Mock 241분 = API 241분` 확인 → API 모드에서 카드가 갱신됨 → 처방 수행과 NEWS 변경 시 API 결과가 변경됨 → 시간 진행과 권한별 화면은 기존처럼 동작함 → 빌드와 테스트 통과.
