# 발표용 UI 2차 개편 결과

간호업무량 기반 실시간 간호지원체계 React 프로토타입을 간호부 발표용으로 다시 배치한 결과다. 기존 1차 재구현의 가상 데이터, 업무량 계산, Zustand 상태를 유지하고, 화면의 정보 위계와 지원 배정 흐름을 바꿨다.

기준 문서는 `docs/nursing_demo_ui_v2_requirements.md`다. 이 문서가 이전 원본 재현 지시와 다르면 이번 요구사항을 따랐다. `docs/nursing_artifact_function_spec.md`와 `nursing_artifact_reference/`는 수정하지 않았다.

## 최종 결과

- 09:00 초기 업무량은 그대로다. 김서연 127, 박도윤 31, 이하은 53, 최민준 11, 정유나 34, 근무조 256/250 초과.
- 카드는 담당 업무량, 업무 단계, KTAS 1/2, 수행 대기 건수, 가장 오래 대기한 시간을 보여 준다. 1시간 뒤 예측과 기준 초과 수치는 화면에서 빠졌다.
- 처방은 `확인중` 상태를 가진다. 활성 대기 집계에서는 빠지고, 수행 전에는 담당 업무량에 남는다.
- 리더가 추천 1순위 또는 다른 후보에게 배정하면 응답 대기가 되고, 해당 간호사 화면에서 수락하거나 거절한다. 수락 후에만 업무량 감산이 적용된다.
- 추천 문구는 `지원 간호사 추천`, `업무량 기반 추천`이다. Agent Builder나 인공지능이 연결된 것처럼 보이지 않는다.

## 문서

| 문서 | 내용 |
|---|---|
| `ui_revision_change_log.md` | 요구 0~8 반영, 변경 파일, 제거 및 보류 |
| `ui_revision_logic_decisions.md` | 확인중, 추천, 알림, 미확정 기준 |
| `ui_revision_test_report.md` | T01~T17, `npm test`, `npm run build` |
| `demo_walkthrough.md` | 1~2분 발표 동선 |
| `screenshots/` | 1366, 1440, 1920 캡처 |

## 다음 검토

1. 이 폴더의 테스트 보고서에서 T01~T17 근거를 확인한다.
2. `demo_walkthrough.md` 순서대로 한 번 시연한다.
3. `ui_revision_logic_decisions.md`의 간호부 확인 항목을 미팅 전에 결정한다.
