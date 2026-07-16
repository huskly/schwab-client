import type { SchwabTransaction } from "./schwabApiTypes.js";
import type {
  SchwabExecutionLeg,
  SchwabOrder,
  SchwabOrderLeg,
} from "./types.js";

export interface SchwabRealizedFill {
  legId?: number;
  instrumentId?: number;
  symbol?: string;
  filledQuantity: number;
  averageFillPrice: number;
}

export interface SchwabOrderFeeItem {
  activityId: number;
  transactionId?: number;
  transferItemType?: string;
  symbol?: string;
  fee: number;
}

export interface SchwabOrderFees {
  orderId: number;
  totalFees: number;
  items: SchwabOrderFeeItem[];
  transactions: SchwabTransaction[];
}

interface FillAccumulator {
  legId?: number;
  instrumentId?: number;
  symbol?: string;
  filledQuantity: number;
  weightedPrice: number;
}

interface MatchingOrderLeg {
  leg: SchwabOrderLeg;
  index: number;
}

function matchingOrderLeg(
  executionLeg: SchwabExecutionLeg,
  orderLegs: SchwabOrderLeg[],
): MatchingOrderLeg | undefined {
  if (executionLeg.legId !== undefined) {
    const index = orderLegs.findIndex(
      (leg) => leg.legId === executionLeg.legId,
    );
    if (index !== -1) return { leg: orderLegs[index], index };
  }

  if (executionLeg.instrumentId !== undefined) {
    const index = orderLegs.findIndex(
      (leg) => leg.instrument?.instrumentId === executionLeg.instrumentId,
    );
    if (index !== -1) return { leg: orderLegs[index], index };
  }

  return orderLegs.length === 1 ? { leg: orderLegs[0], index: 0 } : undefined;
}

/**
 * Aggregate an order's EXECUTION activities into one realized fill per order
 * leg. Only execution legs with finite, positive quantities and finite prices
 * are included.
 *
 * Only `executionType: "FILL"` activities count as real fills. A canceled order also gets an
 * activityType: "EXECUTION" record (executionType: "CANCELED") whose executionLegs report the
 * canceled quantity at price 0 - allowlisting FILL (rather than blocking CANCELED) keeps this
 * correct against any other non-fill executionType Schwab emits but doesn't document.
 */
export function getRealizedFills(order: SchwabOrder): SchwabRealizedFill[] {
  const orderLegs = order.orderLegCollection ?? [];
  const fills = new Map<string, FillAccumulator>();

  for (const activity of order.orderActivityCollection ?? []) {
    if (activity.activityType !== "EXECUTION") continue;
    if (
      activity.executionType !== undefined &&
      activity.executionType !== "FILL"
    )
      continue;

    for (const executionLeg of activity.executionLegs ?? []) {
      const { price, quantity } = executionLeg;
      if (
        price === undefined ||
        quantity === undefined ||
        !Number.isFinite(price) ||
        !Number.isFinite(quantity) ||
        quantity <= 0
      ) {
        continue;
      }

      const match = matchingOrderLeg(executionLeg, orderLegs);
      const orderLeg = match?.leg;
      const legId = executionLeg.legId ?? orderLeg?.legId;
      const instrumentId =
        executionLeg.instrumentId ?? orderLeg?.instrument?.instrumentId;
      const key =
        match !== undefined
          ? `order-leg:${String(match.index)}`
          : legId !== undefined
            ? `leg:${String(legId)}`
            : instrumentId !== undefined
              ? `instrument:${String(instrumentId)}`
              : undefined;

      // An execution leg without any usable correlation identifier cannot be
      // safely attributed in a multi-leg order.
      if (!key) continue;

      const existing = fills.get(key) ?? {
        legId,
        instrumentId,
        symbol: orderLeg?.instrument?.symbol,
        filledQuantity: 0,
        weightedPrice: 0,
      };
      existing.filledQuantity += quantity;
      existing.weightedPrice += price * quantity;
      fills.set(key, existing);
    }
  }

  return [...fills.values()].map(
    ({ weightedPrice, ...fill }): SchwabRealizedFill => ({
      ...fill,
      averageFillPrice: weightedPrice / fill.filledQuantity,
    }),
  );
}

/**
 * Correlate TRADE transactions and their fee-bearing transfer items to an
 * order. Fee categories are preserved exactly as Schwab returns them; the API
 * does not expose a reliable normalized commission/regulatory-fee breakdown.
 */
export function getOrderFees(
  order: SchwabOrder | number,
  transactions: readonly SchwabTransaction[],
): SchwabOrderFees {
  const orderId = typeof order === "number" ? order : order.orderId;
  if (orderId === undefined || !Number.isFinite(orderId)) {
    throw new Error("A valid order id is required to correlate order fees");
  }

  const matchingTransactions = transactions.filter(
    (transaction) =>
      transaction.orderId === orderId && transaction.type === "TRADE",
  );
  const items = matchingTransactions.flatMap((transaction) =>
    (transaction.transferItems ?? []).flatMap((item): SchwabOrderFeeItem[] =>
      item.fee === undefined || !Number.isFinite(item.fee)
        ? []
        : [
            {
              activityId: transaction.activityId,
              transactionId: item.transactionId,
              transferItemType: item.transferItemType,
              symbol: item.instrument?.symbol,
              fee: item.fee,
            },
          ],
    ),
  );

  return {
    orderId,
    totalFees: items.reduce((total, item) => total + item.fee, 0),
    items,
    transactions: matchingTransactions,
  };
}
