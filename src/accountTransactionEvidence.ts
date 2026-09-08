/** The categories explicitly requested by the account-wide evidence read. */
export const SCHWAB_TRANSACTION_EVIDENCE_TYPES: readonly string[] =
  Object.freeze([
    "TRADE",
    "RECEIVE_AND_DELIVER",
    "DIVIDEND_OR_INTEREST",
    "ACH_RECEIPT",
    "ACH_DISBURSEMENT",
    "CASH_RECEIPT",
    "CASH_DISBURSEMENT",
    "ELECTRONIC_FUND",
    "WIRE_OUT",
    "WIRE_IN",
    "JOURNAL",
    "MEMORANDUM",
    "MARGIN_CALL",
    "MONEY_MARKET",
    "SMA_ADJUSTMENT",
  ]);

export interface SchwabTransactionEvidenceRequest {
  readonly accountHash: string;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly signal?: AbortSignal;
}

/** Unclassified source fields. Missing fields are not fabricated. */
export interface SchwabTransactionEvidenceRow {
  readonly fields: Readonly<Record<string, unknown>>;
}

/** A successful read is not a certificate of accounting completeness. */
export interface SchwabAccountTransactionEvidence {
  readonly requestedAccountHash: string;
  readonly requestedStart: string;
  readonly requestedEnd: string;
  readonly requestedTypes: readonly string[];
  readonly observedAtEpochMillis: number;
  readonly rows: readonly SchwabTransactionEvidenceRow[];
}

const HISTORY_MS = 60 * 24 * 60 * 60 * 1_000;

/** Build one exact account request. Never discover or select an account. */
export function transactionEvidencePath(
  input: SchwabTransactionEvidenceRequest,
  now: Date,
): string {
  if (!/^[A-Za-z0-9_-]+$/.test(input.accountHash)) {
    throw new Error(
      "A valid account hash is required for transaction evidence",
    );
  }
  const start = input.startDate.getTime();
  const end = input.endDate.getTime();
  const observed = now.getTime();
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    !Number.isFinite(observed) ||
    start >= end ||
    end > observed ||
    start < observed - HISTORY_MS
  ) {
    throw new Error(
      "Transaction evidence requires an ordered range within the past 60 days",
    );
  }
  const params = new URLSearchParams({
    startDate: input.startDate.toISOString(),
    endDate: input.endDate.toISOString(),
    types: SCHWAB_TRANSACTION_EVIDENCE_TYPES.join(","),
  });
  return `/trader/v1/accounts/${encodeURIComponent(input.accountHash)}/transactions?${params.toString()}`;
}

/** Reject a malformed row rather than silently discard a possible cash movement. */
export function transactionEvidenceRows(
  raw: unknown,
): SchwabTransactionEvidenceRow[] {
  if (!Array.isArray(raw))
    throw new Error("Schwab transaction evidence is not an array");
  return raw.map((row: unknown) => {
    if (row === null || typeof row !== "object" || Array.isArray(row)) {
      throw new Error("Schwab transaction evidence contains a malformed row");
    }
    return { fields: row as Record<string, unknown> };
  });
}
