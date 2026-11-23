"""F2 다중 간호사 업무량 산정 (Langflow 1.10 기반 Agent Builder).

Chat Input -> 이 Custom Component -> Chat Output
입력: {"scenario": {"id": "initial_0900", "clock": "09:00"}, "nurses": [{...}, ...]}
출력: {"scenario": ..., "nurses": [...], "shift_summary": ..., "calculation_version": ...}

주의: 기존 HTML의 '시연용' 관찰, 활력, 처방 계산만 복제합니다.
환자 수 기준(환자당 50분)은 비교값일 뿐 인력 적정성 판정이 아닙니다.
시뮬레이션 시간 변경에 따른 환자 상태 및 처방 상태 갱신은 React가 담당합니다.
"""
import json
import math
import re

KTAS_OBSERVATION_MINUTES = {1: 25, 2: 15, 3: 8, 4: 4, 5: 2}
VITAL_MINUTES_PER_CHECK = 3
DETERIORATION_EXTRA_MINUTES = 20
NORMAL_FROM_MINUTES = 30
HIGH_ABOVE_MINUTES = 50  # 50분 정확히는 보통
REFERENCE_MINUTES_PER_PATIENT = 50
UNFINISHED_STATUSES = {"pending", "in_progress"}
VALID_STATUSES = {"pending", "in_progress", "scheduled", "completed"}
VERSION = "html_demo_f2_v3_batch"


def _non_negative_int(value, field):
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError(f"{field}: 0 이상의 정수가 필요합니다.")
    return value


def _required_text(value, field):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field}: 비어 있지 않은 문자열이 필요합니다.")
    return value.strip()


def _news_extra_minutes(news):
    if news >= 7:
        return 12
    if news >= 5:
        return 7
    if news >= 3:
        return 3
    return 0


def calculate_nurse(nurse):
    if not isinstance(nurse, dict):
        raise ValueError("nurses 배열의 각 요소는 객체여야 합니다.")
    nurse_id = _required_text(nurse.get("id"), "nurse.id")
    nurse_name = _required_text(nurse.get("name"), "nurse.name")
    patients = nurse.get("patients")
    if not isinstance(patients, list):
        raise ValueError(f"{nurse_id}.patients는 배열이어야 합니다.")

    observation_total = 0
    vital_total = 0
    pending_total = 0
    unfinished_count = 0
    has_deterioration = False
    breakdown = []
    patient_ids = set()
    for i, patient in enumerate(patients):
        path = f"{nurse_id}.patients[{i}]"
        if not isinstance(patient, dict):
            raise ValueError(f"{path}: 객체여야 합니다.")
        patient_id = _required_text(patient.get("id"), f"{path}.id")
        if patient_id in patient_ids:
            raise ValueError(f"{path}: 환자 ID가 중복됩니다 ({patient_id}).")
        patient_ids.add(patient_id)
        ktas = _non_negative_int(patient.get("ktas"), f"{path}.ktas")
        if ktas not in KTAS_OBSERVATION_MINUTES:
            raise ValueError(f"{path}.ktas: 1~5 중 하나여야 합니다.")
        news = _non_negative_int(patient.get("news"), f"{path}.news")
        interval = _non_negative_int(patient.get("vital_interval_minutes"), f"{path}.vital_interval_minutes")
        if interval == 0:
            raise ValueError(f"{path}.vital_interval_minutes: 0보다 커야 합니다.")
        deteriorated = patient.get("acute_deterioration", False)
        if not isinstance(deteriorated, bool):
            raise ValueError(f"{path}.acute_deterioration: true/false가 필요합니다.")
        has_deterioration = has_deterioration or deteriorated

        observation = (
            KTAS_OBSERVATION_MINUTES[ktas] + _news_extra_minutes(news)
            + (DETERIORATION_EXTRA_MINUTES if deteriorated else 0)
        )
        vital = math.floor((60 / interval * VITAL_MINUTES_PER_CHECK) + 0.5)

        orders = patient.get("orders")
        if not isinstance(orders, list):
            raise ValueError(f"{path}.orders: 배열이어야 합니다.")
        patient_pending = 0
        patient_unfinished = 0
        for j, order in enumerate(orders):
            order_path = f"{path}.orders[{j}]"
            if not isinstance(order, dict):
                raise ValueError(f"{order_path}: 객체여야 합니다.")
            _required_text(order.get("id"), f"{order_path}.id")
            status = order.get("status")
            if status not in VALID_STATUSES:
                raise ValueError(f"{order_path}.status: 허용된 상태가 아닙니다 ({status}).")
            duration = _non_negative_int(order.get("estimated_minutes"), f"{order_path}.estimated_minutes")
            if status in UNFINISHED_STATUSES:
                patient_pending += duration
                patient_unfinished += 1

        observation_total += observation
        vital_total += vital
        pending_total += patient_pending
        unfinished_count += patient_unfinished
        breakdown.append({
            "patient_id": patient_id,
            "observation_minutes": observation,
            "vital_minutes": vital,
            "pending_order_minutes": patient_pending,
            "unfinished_order_count": patient_unfinished,
        })

    total = observation_total + vital_total + pending_total
    level = (
        "높음" if (has_deterioration or total > HIGH_ABOVE_MINUTES)
        else ("보통" if total >= NORMAL_FROM_MINUTES else "여유")
    )
    reference = len(patients) * REFERENCE_MINUTES_PER_PATIENT
    return {
        "nurse_id": nurse_id,
        "nurse_name": nurse_name,
        "patient_count": len(patients),
        "observation_minutes": observation_total,
        "vital_minutes": vital_total,
        "pending_order_minutes": pending_total,
        "total_minutes": total,
        "workload_level": level,
        "has_acute_deterioration": has_deterioration,
        "patient_reference_minutes": reference,
        "exceeds_patient_reference": total > reference,
        "unfinished_order_count": unfinished_count,
        "patient_breakdown": breakdown,
    }


def calculate_shift(payload):
    if not isinstance(payload, dict):
        raise ValueError("최상위 입력은 JSON 객체여야 합니다.")
    scenario = payload.get("scenario", {})
    if not isinstance(scenario, dict):
        raise ValueError("scenario는 객체여야 합니다.")
    scenario_id = scenario.get("id", "manual")
    clock = scenario.get("clock", "09:00")
    scenario_id = _required_text(scenario_id, "scenario.id")
    if not isinstance(clock, str) or not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", clock):
        raise ValueError("scenario.clock: HH:MM 형식의 시각이 필요합니다.")
    nurses = payload.get("nurses")
    if not isinstance(nurses, list) or not nurses:
        raise ValueError("nurses는 1명 이상의 간호사 객체 배열이어야 합니다.")
    nurse_results = [calculate_nurse(nurse) for nurse in nurses]
    nurse_ids = [n["nurse_id"] for n in nurse_results]
    if len(nurse_ids) != len(set(nurse_ids)):
        raise ValueError("nurses 배열에 중복된 간호사 ID가 있습니다.")

    summary = {
        "nurse_count": len(nurse_results),
        "patient_count": sum(r["patient_count"] for r in nurse_results),
        "observation_minutes": sum(r["observation_minutes"] for r in nurse_results),
        "vital_minutes": sum(r["vital_minutes"] for r in nurse_results),
        "pending_order_minutes": sum(r["pending_order_minutes"] for r in nurse_results),
        "total_minutes": sum(r["total_minutes"] for r in nurse_results),
        "unfinished_order_count": sum(r["unfinished_order_count"] for r in nurse_results),
        "patient_reference_minutes": sum(r["patient_reference_minutes"] for r in nurse_results),
    }
    summary["exceeds_patient_reference"] = summary["total_minutes"] > summary["patient_reference_minutes"]
    return {
        "scenario": {"id": scenario_id, "clock": clock},
        "nurses": nurse_results,
        "shift_summary": summary,
        "calculation_version": VERSION,
    }


# --- Langflow 컴포넌트 연결부 ---
from lfx.custom import Component
from lfx.io import MessageTextInput, Output
from lfx.schema.message import Message


class NurseWorkloadCalculatorV3(Component):
    display_name = "F2 근무조 업무량 산정 (배열)"
    description = "여러 간호사와 담당 환자의 업무량을 한 번에 계산합니다. 시연용 기준입니다."
    icon = "calculator"
    name = "NurseWorkloadCalculatorV3"

    inputs = [
        MessageTextInput(
            name="input_json",
            display_name="근무조 및 환자 JSON",
            info="scenario + nurses[] JSON 문자열",
            required=True,
        ),
    ]
    outputs = [
        Output(
            name="calculated_workload",
            display_name="근무조 업무량 결과",
            method="build_result",
        ),
    ]

    def build_result(self) -> Message:
        try:
            raw = self.input_json
            if hasattr(raw, "text"):
                raw = raw.text
            payload = json.loads(raw)
            result = calculate_shift(payload)
            self.status = f"{len(result['nurses'])}명 / {result['shift_summary']['total_minutes']}분"
            return Message(text=json.dumps(result, ensure_ascii=False))
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            self.status = f"F2 입력 오류: {exc}"
            return Message(text=json.dumps({"error": str(exc)}, ensure_ascii=False))
