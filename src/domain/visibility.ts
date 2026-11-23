/** 현황판의 데모 화면 분기다. 실제 인증이 아니다. */
export function showsFullAssignment(viewerNurseId: string | null, nurseId: string): boolean {
  return viewerNurseId == null || viewerNurseId === nurseId
}

export function showsPriorityFlag(viewerNurseId: string | null): boolean {
  return viewerNurseId == null
}

export function showsManagerAlerts(viewerNurseId: string | null): boolean {
  return viewerNurseId == null
}
