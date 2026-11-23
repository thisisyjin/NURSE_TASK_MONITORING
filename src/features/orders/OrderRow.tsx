import { formatClock, orderStatus } from '../../domain/artifact/rules'
import type { ArtifactOrder } from '../../domain/artifact/types'
import { useDemoStore } from '../../store/demoStore'

interface OrderRowProps {
  ownerId: string
  patientId: string
  order: ArtifactOrder
  nowMin: number
  showOwnerButton: boolean
  helpers: Array<{ from: string; name: string; show: boolean }>
}

export function OrderRow({ ownerId, patientId, order, nowMin, showOwnerButton, helpers }: OrderRowProps) {
  const performOrder = useDemoStore((state) => state.performOrder)
  const acknowledgeOrder = useDemoStore((state) => state.acknowledgeOrder)
  const returnOrder = useDemoStore((state) => state.returnOrder)
  const status = orderStatus(order)
  if (status === 'completed') return null
  const wait = Math.max(0, nowMin - order.at)
  const visibleHelpers = helpers.filter((helper) => helper.show)
  return (
    <div className="ord">
      <span>
        {order.name}
        {status === 'acknowledged' ? (
          <span className="w"> 확인중{order.acknowledgedAt != null ? ` ${formatClock(order.acknowledgedAt)}` : ''}</span>
        ) : (
          <span className="w"> 대기 {wait}분</span>
        )}
      </span>
      <span className="acts">
        {showOwnerButton ? (
          <button type="button" className="sm" onClick={() => performOrder(ownerId, patientId, order.id, ownerId)}>
            수행
          </button>
        ) : null}
        {visibleHelpers.map((helper) => (
          <button key={helper.from} type="button" className="sm" onClick={() => performOrder(ownerId, patientId, order.id, helper.from)}>
            {helper.name} 수행
          </button>
        ))}
        {status === 'pending' && showOwnerButton ? (
          <button type="button" className="sm" onClick={() => acknowledgeOrder(ownerId, patientId, order.id)}>
            확인중
          </button>
        ) : null}
        {status === 'acknowledged' && showOwnerButton ? (
          <button type="button" className="sm" onClick={() => returnOrder(ownerId, patientId, order.id)}>
            대기로 복귀
          </button>
        ) : null}
      </span>
    </div>
  )
}
