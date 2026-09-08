import assert from "node:assert/strict";
import test from "node:test";
import { SchwabClient } from "../dist/index.js";

const NOW = new Date("2026-09-08T20:00:00.000Z");
function input(overrides = {}) {
  return {
    accountHash: "synthetic-hash",
    startDate: new Date("2026-09-01T00:00:00.000Z"),
    endDate: new Date("2026-09-02T00:00:00.000Z"),
    ...overrides,
  };
}
function client(t, body) {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push({ url: new URL(url), options });
    return new Response(JSON.stringify(body), { status: 200 });
  });
  const value = new SchwabClient("synthetic-token");
  t.mock.method(value, "today", () => NOW);
  return { value, requests };
}

test("the evidence read requests every category for exactly one account and interval", async (t) => {
  const raw = [
    {
      activityId: "synthetic-event",
      netAmount: 0,
      type: "ACH_RECEIPT",
      unknownCorrectionField: "previous-event",
      transferItems: [{ instrument: { symbol: "USD", assetType: "CURRENCY" } }],
    },
  ];
  const { value, requests } = client(t, raw);
  const result = await value.getAccountTransactionEvidence(input());
  assert.equal(requests.length, 1);
  const { url, options } = requests[0];
  assert.equal(url.pathname, "/trader/v1/accounts/synthetic-hash/transactions");
  assert.equal(
    url.searchParams.get("startDate"),
    input().startDate.toISOString(),
  );
  assert.equal(url.searchParams.get("endDate"), input().endDate.toISOString());
  assert.equal(url.searchParams.has("symbol"), false);
  assert.deepEqual(url.searchParams.get("types").split(","), [
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
  assert.equal(options.redirect, "error");
  assert.ok(options.signal instanceof AbortSignal);
  assert.deepEqual(
    result.rows.map((row) => row.fields),
    raw,
  );
  assert.equal(result.rows[0].fields.netAmount, 0);
  assert.equal(result.rows[0].fields.currency, undefined);
  assert.equal(result.observedAtEpochMillis, NOW.getTime());
  assert.equal(result.requestedAccountHash, "synthetic-hash");
  assert.equal(result.requestedStart, input().startDate.toISOString());
  assert.equal(result.requestedEnd, input().endDate.toISOString());
  assert.equal("complete" in result, false);
  assert.deepEqual(
    result.requestedTypes,
    url.searchParams.get("types").split(","),
  );
});

test("an explicit empty array is preserved without certifying coverage", async (t) => {
  const { value } = client(t, []);
  const result = await value.getAccountTransactionEvidence(input());
  assert.deepEqual(result.rows, []);
  assert.equal("complete" in result, false);
});

for (const [name, body] of [
  ["error object", { error: "secret-account-value" }],
  ["null", null],
  ["wrapper", { transactions: [] }],
  ["primitive row", [1]],
  ["null row", [null]],
  ["array row", [[]]],
]) {
  test(`refuses ${name} instead of dropping evidence`, async (t) => {
    const { value } = client(t, body);
    await assert.rejects(
      value.getAccountTransactionEvidence(input()),
      (error) => {
        assert.match(error.message, /evidence/);
        assert.doesNotMatch(error.message, /secret-account-value/);
        return true;
      },
    );
  });
}

for (const overrides of [
  { accountHash: "" },
  { accountHash: "  " },
  { accountHash: "../other" },
  { startDate: new Date("invalid") },
  { endDate: new Date("invalid") },
  { startDate: new Date("2026-09-02T00:00:00Z") },
  { startDate: new Date("2026-09-03T00:00:00Z") },
  { endDate: new Date("2026-09-09T00:00:00Z") },
  { startDate: new Date(NOW.getTime() - 60 * 86400000 - 1) },
]) {
  test("an invalid request fails before broker access", async (t) => {
    const { value, requests } = client(t, []);
    await assert.rejects(value.getAccountTransactionEvidence(input(overrides)));
    assert.equal(requests.length, 0);
  });
}

test("the exact 60-day boundary is accepted", async (t) => {
  const { value, requests } = client(t, []);
  await value.getAccountTransactionEvidence(
    input({
      startDate: new Date(NOW.getTime() - 60 * 86400000),
      endDate: NOW,
    }),
  );
  assert.equal(requests.length, 1);
});

test("transport failure is single-attempt and contains no private URL", async (t) => {
  const { value } = client(t, []);
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    throw new Error("https://private-url/synthetic-hash?token=synthetic-token");
  });
  await assert.rejects(
    value.getAccountTransactionEvidence(input()),
    (error) => {
      assert.equal(error.message, "Schwab transaction evidence request failed");
      assert.equal(error.cause, undefined);
      return true;
    },
  );
  assert.equal(calls, 1);
});

test("HTTP refusal is redacted and authentication remains recognizable", async (t) => {
  const { value } = client(t, []);
  for (const status of [401, 403, 500]) {
    t.mock.method(
      globalThis,
      "fetch",
      async () => new Response("private-body", { status }),
    );
    await assert.rejects(value.getAccountTransactionEvidence(input()), {
      message:
        status === 401
          ? "Unauthorized - access token may be expired or invalid"
          : "Schwab transaction evidence request failed",
    });
  }
});

test("pre-aborted requests make no request and redact their reason", async (t) => {
  const { value, requests } = client(t, []);
  await assert.rejects(
    value.getAccountTransactionEvidence(
      input({
        signal: AbortSignal.abort("private-reason"),
      }),
    ),
    { name: "AbortError", message: "Transaction evidence read aborted" },
  );
  assert.equal(requests.length, 0);
});

test("the hard deadline aborts the in-flight request", async (t) => {
  const { value } = client(t, []);
  const deadline = new AbortController();
  t.mock.method(AbortSignal, "timeout", (ms) => {
    assert.equal(ms, 30000);
    return deadline.signal;
  });
  let started;
  const barrier = new Promise((resolve) => {
    started = resolve;
  });
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    started();
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener(
        "abort",
        () => reject(options.signal.reason),
        { once: true },
      );
    });
  });
  const pending = value.getAccountTransactionEvidence(input());
  await barrier;
  deadline.abort("private-reason");
  await assert.rejects(pending, {
    name: "AbortError",
    message: "Transaction evidence read aborted",
  });
});

test("caller mutation while awaiting cannot rewrite the request envelope", async (t) => {
  const { value } = client(t, []);
  const request = input();
  const pending = value.getAccountTransactionEvidence(request);
  request.accountHash = "other";
  request.startDate.setUTCFullYear(2000);
  const result = await pending;
  assert.equal(result.requestedAccountHash, "synthetic-hash");
  assert.equal(result.requestedStart, "2026-09-01T00:00:00.000Z");
});
