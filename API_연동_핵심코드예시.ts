/**
 * F2 연동 시 참고하는 호출 예시.
 * 기존 React 앱에 이 파일을 그대로 import하기보다 프로젝트 구조에 맞게 분리할 것.
 * 응답 envelope 추출 부분은 실제 API 성공 응답을 확인한 뒤 구현해야 함.
 */

const F2_RUN_URL =
  'http://192.168.45.149:3001/api/v1/run/0cbe3a7e-2d2c-498f-bc6d-95703ce59380';

export type F2ShiftInput = {
  scenario: { id: string; clock: string };
  nurses: Array<{
    id: string;
    name: string;
    patients: Array<{
      id: string;
      ktas: 1 | 2 | 3 | 4 | 5;
      news: number;
      vital_interval_minutes: number;
      acute_deterioration: boolean;
      orders: Array<{
        id: string;
        name: string;
        status: 'pending' | 'in_progress' | 'scheduled' | 'completed';
        estimated_minutes: number;
      }>;
    }>;
  }>;
};

export async function callF2Api(
  input: F2ShiftInput,
  apiKey: string,
  options?: { signal?: AbortSignal },
): Promise<unknown> {
  if (!apiKey.trim()) throw new Error('API Key가 입력되지 않았습니다.');
  const response = await fetch(F2_RUN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      input_type: 'chat',
      output_type: 'chat',
      input_value: JSON.stringify(input),
    }),
    signal: options?.signal,
  });
  if (!response.ok) throw new Error(`F2 API HTTP ${response.status}`);
  return response.json();
}

// 주의: 반환값은 F2Result가 아닌 Langflow API 실행 응답(Envelope)이다.
// Cursor는 개발자 테스트 패널의 최초 응답 구조를 확인한 뒤
// parseLangflowEnvelope(envelope): F2Result를 별도로 작성할 것.
