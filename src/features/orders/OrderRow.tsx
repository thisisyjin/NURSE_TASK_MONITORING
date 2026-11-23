import type { ArtifactNurse, ArtifactOrder } from '../../domain/artifact/types'
import { dueOf } from '../../domain/artifact/rules'

interface OrderRowProps {
  nurse: ArtifactNurse
  patientId: string
  order: ArtifactOrder
  nowMin: number
  showOwnerButton: boolean
  helpers: Array<{ from: string; name: string; show: boolean }>
  onPerform: (ownerId: string, patientId: string, orderId: number, performerId: string) => void
}

export function OrderRow({ nurse, patientId, order, nowMin, showOwnerButton, helpers, onPerform }: OrderRowProps) {
  const wait = Math.max(0, nowMin - order.at)
  const due = dueOf(nurse, order)
  const late = wait >= due
  return (
    <div className={late ? 'ord late' : 'ord'}>
      <span>
        {order.name}{' '}
        <span className="w">
          {order.min}분, 대기 {wait}/기준 {due}분
        </span>
      </span>
      <span className="acts">
        {showOwnerButton ? (
          <button type="button" className="sm" onClick={() => onPerform(nurse.id, patientId, order.id, nurse.id)}>
            수행
          </button>
        ) : null}
        {helpers
          .filter((helper) => helper.show)
          .map((helper) => (
            <button key={helper.from} type="button" className="sm" onClick={() => onPerform(nurse.id, patientId, order.id, helper.from)}>
              {helper.name} 수행
            </button>
          ))}
      </span>
    </div>
  )
}
