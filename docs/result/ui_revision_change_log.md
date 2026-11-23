# UI 2차 개편 변경 기록

## 요구 0~8 반영

요구사항 문서의 앞부분 번호에 맞춰 적었다. 0은 자료 우선순위와 수정 금지, 1~8은 화면과 기능 변경이다.

| 항목 | 반영 | 구현 위치 |
|---|---|---|
| 0. 이번 요구사항 우선, 원본 명세와 참고 HTML 수정 금지 | 반영 | 기능 명세서와 `nursing_artifact_reference/`는 그대로 둠 |
| 1. 사용자 전환 강조, 시연 제어 정리 | 반영 | `DemoToolbar.tsx`. 우측 `현재 화면`, 시계 유지, `+15분`은 항상 표시. 자동 진행, 처방 발생, 급증, CPCR, 초기화는 `시연 제어` |
| 2. 간호사 카드 간소화 | 반영 | `NurseCard.tsx`. `담당 업무량`, 단계, KTAS 1/2, 수행 대기, 최장 대기. 관찰/활력 분해와 1시간 뒤 예측 제거 |
| 3. 환자 상세와 처방 행 | 반영 | 환자 행은 이름, KTAS, NEWS, 활력 주기, 대기 건수. 처방은 이름, 대기 분 또는 확인중, 수행, 확인중 |
| 4. `확인중` 실제 상태 | 반영 | `types.ts`, `actions.ts`, `rules.ts`, `OrderRow.tsx`, `demoStore.ts`, 테스트 |
| 5. 미확정 목표시간과 기준 초과 제거, 알림 재검토 | 반영 | `dueOf` 계산은 코드에 남김. 카드, 구역 표, 알림 단계에서 기준 초과를 쓰지 않음. 예측 알림 제거 |
| 6. 지원 추천을 핵심 영역으로 | 반영 | `SupportPanels.tsx` 추천 카드, 근거 3줄, 다른 지원자 지정, 배정 요청, 응답 대기, 수락/거절 |
| 7. 배정부터 기록까지 실제 동작 | 반영 | 응답 대기 중 감산 없음. 수락 시 양쪽 표시와 기존 0.4 감산. 거절 시 해당 대상에서 후보 제외 후 재추천. 종료 후 기록 유지 |
| 8. 기록, 보조 패널, 푸터 모달, 인공지능 표현 금지 | 반영 | 최근 5건과 전체 기록 모달. 인력 적정성, 구역별 처방 대기 현황. 푸터 링크 2개. 추천 제목은 `지원 간호사 추천` |

## 화면별 변경

| 위치 | 이전 | 이후 |
|---|---|---|
| 상단 | 역할과 시간 진행 버튼이 한 줄에 섞임 | `현재 화면` 선택과 시계, `+15분`. 나머지 시연 버튼은 접힘 |
| 카드 | 관찰, 활력, 예측 막대, 기준 초과 칩 | 담당 업무량과 대기 현황. 예측 숫자 없음 |
| 환자 | 정보가 한 줄에 길게 붙음 | 이름과 KTAS, 그 아래 NEWS와 활력 주기, 대기 건수. 활성 처방이 있으면 펼침 |
| 처방 | 표준 소요, 목표, 초과 문구 | `대기 N분` 또는 `확인중 HH:MM`, `수행`, `확인중` 또는 `대기로 복귀` |
| 오른쪽 | 작은 알림 문장과 배정 버튼 | 지원 필요 간호사별 추천 카드. 인력, CPCR 알림은 추천 아래 별도 상자 |
| 하단 | 처방 기준표와 긴 안내 | `시연 기준 안내`, `처방 분류 기준` 링크와 모달 |
| 보조 | 적시성 표의 기준 초과 열 | 구역, 대기 건수, 최장 대기, 확인중 건수 |

## 변경 파일과 함수

| 파일 | 내용 |
|---|---|
| `src/domain/artifact/types.ts` | `OrderWorkStatus`, 처방 `status`와 `acknowledgedAt`, `ActivityEntry`, 구역 `acknowledgedCount` |
| `src/domain/artifact/initialState.ts` | 초기 처방 `pending`, 활동 기록 빈 배열 |
| `src/domain/artifact/rules.ts` | `orderStatus`, `countsTowardWorkload`, `isActivePending`, `nurseQueue`, `eligibleHelpers`, `assignmentBlockReason`, `buildAlerts`, `zoneTimeliness` |
| `src/domain/artifact/actions.ts` | `acknowledgeOrder`, `returnOrderToPending`, `completeOrder`의 상태 변경, `assignSupport` 차단, `pushActivity`, `topicName` |
| `src/domain/artifact/artifact.test.ts` | 초기 알림 기대값 변경, 확인중, 배정 차단 테스트 추가 |
| `src/store/demoStore.ts` | `acknowledgeOrder`, `returnOrder` |
| `src/features/orders/OrderRow.tsx` | 확인중, 복귀, 수행 |
| `src/features/dashboard/NurseCard.tsx` | 카드 요약, 환자 펼침, 동료 상세 제한 |
| `src/features/simulation/DemoToolbar.tsx` | 현재 화면, 시연 제어 |
| `src/features/support/SupportPanels.tsx` | 추천, 응답, 기록, 인력, 구역, 모달 |
| `src/app/App.tsx` | 카드와 추천 2열, 푸터 모달 |
| `src/styles/global.css` | 2열 카드, 추천 카드, 모달, 1100px 이하에서 추천을 위로 |

F2 연동 코드와 테스트는 삭제하지 않았다. F2 디버그 패널은 화면에 올리지 않았다.

## 제거와 보류

| 구분 | 항목 |
|---|---|
| 화면에서 제거 | 1시간 뒤 숫자와 막대, 예측 알림, 처방 행의 목표시간, 기준 초과 열과 칩, 본문의 긴 안내와 기준표 |
| 코드에 유지 | `loadOf`의 예측값, `dueOf`, 처방 분류 데이터, F2 서비스 |
| 이번 브라우저에서 다시 누르지 않음 | 간호요구 급증, CPCR, A-plus. 버튼은 시연 제어와 알림에 남아 있고 기존 단위 테스트는 급증과 CPCR을 검사함 |
| 보류 | 환자 1명당 50분 인력 기준, 확인중을 업무량에서 뺄지, 지원 감산 비율의 임상 확정 |
