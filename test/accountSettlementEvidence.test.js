import assert from "node:assert/strict";
import test from "node:test";

import { SchwabClient } from "../dist/index.js";

// The real Schwab `initialBalances` block: the START-OF-DAY snapshot, and the
// only block that carries cash evidence.
function initialBalancesBlock() {
  return {
    accruedInterest: 0,
    availableFundsNonMarginableTrade: 0,
    bondValue: 0,
    buyingPower: 0,
    cashBalance: 1500.25,
    cashAvailableForTrading: 1200.5,
    cashReceipts: 0,
    dayTradingBuyingPower: 0,
    dayTradingBuyingPowerCall: 0,
    dayTradingEquityCall: 0,
    equity: 0,
    equityPercentage: 0,
    liquidationValue: 0,
    longMarginValue: 8000,
    longOptionMarketValue: 0,
    longStockValue: 0,
    maintenanceCall: 0,
    maintenanceRequirement: 0,
    margin: 0,
    marginEquity: 0,
    moneyMarketFund: 42.75,
    mutualFundValue: 0,
    regTCall: 0,
    shortMarginValue: 0,
    shortOptionMarketValue: 0,
    shortStockValue: 0,
    totalCash: 1543,
    isInCall: false,
    unsettledCash: 250.1,
    pendingDeposits: 0,
    marginBalance: 3750,
    shortBalance: 0,
    accountValue: 10000,
  };
}

// The real Schwab `currentBalances` block: live, and - as a read-only probe of
// a real MARGIN account proved - carrying live cash as well as margin figures.
// `projectedBalances` has the same shape.
function currentBalancesBlock() {
  return {
    accruedInterest: 0,
    cashBalance: 1610.4,
    cashReceipts: 0,
    intradayBuyingPowerAmount: 0,
    liquidationValue: 9600,
    longMarketValue: 8000,
    moneyMarketFund: 42.75,
    pendingDeposits: 0,
    savings: 0,
    shortMarketValue: 0,
    totalCash: 1653.15,
    availableFunds: 2500,
    availableFundsNonMarginableTrade: 2400,
    buyingPower: 5000,
    buyingPowerNonMarginableTrade: 4800,
    dayTradingBuyingPower: 10000,
    dayTradingBuyingPowerCall: 0,
    equity: 9000,
    equityPercentage: 90,
    longMarginValue: 8000,
    maintenanceCall: 0,
    maintenanceRequirement: 1200,
    marginBalance: 3750,
    regTCall: 0,
    shortBalance: 0,
    shortMarginValue: 0,
    sma: 3000,
    isInCall: false,
    stockBuyingPower: 5000,
    optionBuyingPower: 4500,
  };
}

// One whole account as Schwab sends it.
function vendorAccount(overrides = {}) {
  return {
    securitiesAccount: {
      accountNumber: "123456789",
      positions: [],
      initialBalances: initialBalancesBlock(),
      currentBalances: currentBalancesBlock(),
      projectedBalances: currentBalancesBlock(),
      ...overrides,
    },
  };
}

// Run one stubbed request and capture the requested URL.
async function withStub(body, fn) {
  const originalFetch = globalThis.fetch;
  let requestedUrl = null;
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const result = await fn();
    return { result, requestedUrl };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// A client whose observation clock is frozen, so the timestamp is assertable.
function clientAt(epochMillis) {
  const client = new SchwabClient("token");
  client.today = () => new Date(epochMillis);
  return client;
}

test("a real vendor payload is reported field for field under its source block", async () => {
  const { result, requestedUrl } = await withStub([vendorAccount()], () =>
    clientAt(1787000000000).getAccountSettlementEvidence(),
  );

  assert.deepEqual(result, {
    accountNumber: "123456789",
    accountType: null,
    currency: null,
    observedAtEpochMillis: 1787000000000,
    initial: {
      cashBalance: 1500.25,
      cashAvailableForTrading: 1200.5,
      unsettledCash: 250.1,
      totalCash: 1543,
      moneyMarketFund: 42.75,
      pendingDeposits: 0,
      marginBalance: 3750,
      longMarginValue: 8000,
      isInCall: false,
      maintenanceCall: 0,
      accountValue: 10000,
    },
    current: {
      cashBalance: 1610.4,
      moneyMarketFund: 42.75,
      pendingDeposits: 0,
      totalCash: 1653.15,
      availableFunds: 2500,
      optionBuyingPower: 4500,
      marginBalance: 3750,
      longMarginValue: 8000,
      maintenanceCall: 0,
      isInCall: false,
      equity: 9000,
      liquidationValue: 9600,
    },
    presentInitialBalanceFieldNames: Object.keys(initialBalancesBlock()).sort(),
    presentCurrentBalanceFieldNames: Object.keys(currentBalancesBlock()).sort(),
    presentProjectedBalanceFieldNames: Object.keys(
      currentBalancesBlock(),
    ).sort(),
  });
  assert.equal(
    requestedUrl,
    "https://api.schwabapi.com/trader/v1/accounts?fields=positions",
  );
});

test("start of day cash and live cash are kept apart block by block", async () => {
  // Both blocks carry same-named figures; neither may leak into the other.
  const account = vendorAccount({
    initialBalances: {
      ...initialBalancesBlock(),
      marginBalance: 1,
      cashBalance: 10,
      totalCash: 30,
    },
    currentBalances: {
      ...currentBalancesBlock(),
      marginBalance: 2,
      cashBalance: 20,
      totalCash: 40,
    },
  });

  const { result } = await withStub([account], () =>
    clientAt(1787000000000).getAccountSettlementEvidence(),
  );

  assert.equal(result.initial.marginBalance, 1);
  assert.equal(result.current.marginBalance, 2);
  assert.equal(result.initial.cashBalance, 10);
  assert.equal(result.current.cashBalance, 20);
  assert.equal(result.initial.totalCash, 30);
  assert.equal(result.current.totalCash, 40);
  // `unsettledCash` is start-of-day evidence only; the live block has none.
  assert.equal("unsettledCash" in result.current, false);
});

test("a partial payload with no initial balances block reports null and does not throw", async () => {
  const legacy = {
    securitiesAccount: {
      accountNumber: "123456789",
      positions: [],
      currentBalances: currentBalancesBlock(),
    },
  };

  const { result } = await withStub([legacy], () =>
    clientAt(1787000000000).getAccountSettlementEvidence(),
  );

  assert.deepEqual(result.initial, {
    cashBalance: null,
    cashAvailableForTrading: null,
    unsettledCash: null,
    totalCash: null,
    moneyMarketFund: null,
    pendingDeposits: null,
    marginBalance: null,
    longMarginValue: null,
    isInCall: null,
    maintenanceCall: null,
    accountValue: null,
  });
  assert.deepEqual(result.presentInitialBalanceFieldNames, []);
  assert.deepEqual(result.presentProjectedBalanceFieldNames, []);
  assert.equal(result.current.availableFunds, 2500);
  assert.equal(result.accountType, null);
});

test("non-finite or wrongly typed values become null instead of a number", async () => {
  const account = vendorAccount({
    type: 7,
    currency: 840,
    initialBalances: {
      ...initialBalancesBlock(),
      cashBalance: null,
      cashAvailableForTrading: "1200.00",
      unsettledCash: Number.NaN,
      totalCash: Number.POSITIVE_INFINITY,
      moneyMarketFund: true,
      accountValue: { amount: 10000 },
    },
    currentBalances: {
      ...currentBalancesBlock(),
      availableFunds: "2500",
      equity: Number.NaN,
      optionBuyingPower: null,
    },
  });

  const { result } = await withStub([account], () =>
    clientAt(1787000000000).getAccountSettlementEvidence(),
  );

  assert.equal(result.initial.cashBalance, null);
  assert.equal(result.initial.cashAvailableForTrading, null);
  assert.equal(result.initial.unsettledCash, null);
  assert.equal(result.initial.totalCash, null);
  assert.equal(result.initial.moneyMarketFund, null);
  assert.equal(result.initial.accountValue, null);
  assert.equal(result.current.availableFunds, null);
  assert.equal(result.current.equity, null);
  assert.equal(result.current.optionBuyingPower, null);
  assert.equal(result.accountType, null);
  assert.equal(result.currency, null);
});

test("a balance block sent as a non object is treated as absent", async () => {
  const account = vendorAccount({
    initialBalances: null,
    projectedBalances: "unavailable",
  });

  const { result } = await withStub([account], () =>
    clientAt(1787000000000).getAccountSettlementEvidence(),
  );

  assert.equal(result.initial.cashBalance, null);
  assert.deepEqual(result.presentInitialBalanceFieldNames, []);
  assert.deepEqual(result.presentProjectedBalanceFieldNames, []);
});

test("present balance field names list key names only and stay sorted per block", async () => {
  const account = vendorAccount({
    initialBalances: { unsettledCash: 250, cashBalance: 1500, totalCash: 1750 },
    currentBalances: { optionBuyingPower: 4500, availableFunds: 2500 },
    projectedBalances: { marginBalance: 3750, availableFunds: 2400 },
  });

  const { result } = await withStub([account], () =>
    clientAt(1787000000000).getAccountSettlementEvidence(),
  );

  assert.deepEqual(result.presentInitialBalanceFieldNames, [
    "cashBalance",
    "totalCash",
    "unsettledCash",
  ]);
  assert.deepEqual(result.presentCurrentBalanceFieldNames, [
    "availableFunds",
    "optionBuyingPower",
  ]);
  assert.deepEqual(result.presentProjectedBalanceFieldNames, [
    "availableFunds",
    "marginBalance",
  ]);
});

test("the observation timestamp comes from the injected client clock", async () => {
  const { result } = await withStub([vendorAccount()], () =>
    clientAt(1234567890123).getAccountSettlementEvidence(),
  );

  assert.equal(result.observedAtEpochMillis, 1234567890123);
});

test("the account number comes from the envelope the balance blocks do not carry", async () => {
  const { result } = await withStub(
    [vendorAccount({ accountNumber: "987654321" })],
    () => clientAt(1787000000000).getAccountSettlementEvidence(),
  );

  assert.equal(result.accountNumber, "987654321");
  assert.equal("accountNumber" in initialBalancesBlock(), false);
  assert.equal("accountNumber" in currentBalancesBlock(), false);
});

test("a multi-account response selects the same account as getAccountBalances", async () => {
  const body = [
    vendorAccount({
      accountNumber: "111111111",
      currentBalances: { ...currentBalancesBlock(), availableFunds: 11 },
    }),
    vendorAccount({
      accountNumber: "222222222",
      currentBalances: { ...currentBalancesBlock(), availableFunds: 22 },
    }),
  ];

  const { result: evidence } = await withStub(body, () =>
    clientAt(1787000000000).getAccountSettlementEvidence(),
  );
  const { result: balances } = await withStub(body, () =>
    new SchwabClient("token").getAccountBalances(),
  );

  assert.equal(evidence.accountNumber, "111111111");
  assert.equal(evidence.current.availableFunds, balances.availableFunds);
});

test("a currency the broker never sends stays null and is never assumed to be USD", async () => {
  const { result } = await withStub([vendorAccount()], () =>
    clientAt(1787000000000).getAccountSettlementEvidence(),
  );

  assert.equal(result.currency, null);
  assert.equal(
    result.presentCurrentBalanceFieldNames.includes("currency"),
    false,
  );
  assert.equal(
    result.presentInitialBalanceFieldNames.includes("currency"),
    false,
  );
});

test("an empty account list is refused the same way as the balances read", async () => {
  await withStub([], async () => {
    await assert.rejects(
      clientAt(1787000000000).getAccountSettlementEvidence(),
      /No Schwab account found/,
    );
  });
});

test("a boolean isInCall is kept as the boolean the live payload sent", async () => {
  const account = vendorAccount({
    initialBalances: { ...initialBalancesBlock(), isInCall: true },
    currentBalances: { ...currentBalancesBlock(), isInCall: true },
  });

  const { result } = await withStub([account], () =>
    clientAt(1787000000000).getAccountSettlementEvidence(),
  );

  assert.equal(result.initial.isInCall, true);
  assert.equal(result.current.isInCall, true);
});

test("a false isInCall stays false and never collapses to null", async () => {
  const { result } = await withStub([vendorAccount()], () =>
    clientAt(1787000000000).getAccountSettlementEvidence(),
  );

  assert.equal(result.initial.isInCall, false);
  assert.equal(result.current.isInCall, false);
});

test("a numeric isInCall of zero is normalized to false", async () => {
  const account = vendorAccount({
    initialBalances: { ...initialBalancesBlock(), isInCall: 0 },
    currentBalances: { ...currentBalancesBlock(), isInCall: 0 },
  });

  const { result } = await withStub([account], () =>
    clientAt(1787000000000).getAccountSettlementEvidence(),
  );

  assert.equal(result.initial.isInCall, false);
  assert.equal(result.current.isInCall, false);
});

test("a numeric isInCall of one is normalized to true", async () => {
  const account = vendorAccount({
    initialBalances: { ...initialBalancesBlock(), isInCall: 1 },
    currentBalances: { ...currentBalancesBlock(), isInCall: 2 },
  });

  const { result } = await withStub([account], () =>
    clientAt(1787000000000).getAccountSettlementEvidence(),
  );

  assert.equal(result.initial.isInCall, true);
  assert.equal(result.current.isInCall, true);
});

test("an absent or wrongly typed isInCall is reported as null", async () => {
  const initial = { ...initialBalancesBlock() };
  delete initial.isInCall;
  const account = vendorAccount({
    initialBalances: initial,
    currentBalances: { ...currentBalancesBlock(), isInCall: "false" },
  });

  const { result } = await withStub([account], () =>
    clientAt(1787000000000).getAccountSettlementEvidence(),
  );

  assert.equal(result.initial.isInCall, null);
  assert.equal(result.current.isInCall, null);
  assert.equal(
    result.presentInitialBalanceFieldNames.includes("isInCall"),
    false,
  );
});

test("an absent unsettledCash is null and never required of a margin account", async () => {
  // A real Schwab MARGIN account sent no `unsettledCash` at all.
  const initial = { ...initialBalancesBlock() };
  delete initial.unsettledCash;

  const { result } = await withStub(
    [vendorAccount({ initialBalances: initial })],
    () => clientAt(1787000000000).getAccountSettlementEvidence(),
  );

  assert.equal(result.initial.unsettledCash, null);
  assert.equal(result.initial.cashBalance, 1500.25);
  assert.equal(
    result.presentInitialBalanceFieldNames.includes("unsettledCash"),
    false,
  );
});

test("live cash is read from the current block when the broker sends it", async () => {
  const { result } = await withStub([vendorAccount()], () =>
    clientAt(1787000000000).getAccountSettlementEvidence(),
  );

  assert.equal(result.current.cashBalance, 1610.4);
  assert.equal(result.current.moneyMarketFund, 42.75);
  assert.equal(result.current.pendingDeposits, 0);
  assert.equal(result.current.totalCash, 1653.15);
});

test("an absent live cash field is null and is not taken from the start of day block", async () => {
  const current = { ...currentBalancesBlock() };
  delete current.cashBalance;
  delete current.totalCash;
  delete current.optionBuyingPower;

  const { result } = await withStub(
    [vendorAccount({ currentBalances: current })],
    () => clientAt(1787000000000).getAccountSettlementEvidence(),
  );

  assert.equal(result.current.cashBalance, null);
  assert.equal(result.current.totalCash, null);
  // `optionBuyingPower` was absent on the probed account too.
  assert.equal(result.current.optionBuyingPower, null);
  // The start-of-day figures are still there and were not substituted.
  assert.equal(result.initial.cashBalance, 1500.25);
  assert.equal(result.initial.totalCash, 1543);
});

test("the live block field names list the cash keys the real account sent", async () => {
  const { result } = await withStub([vendorAccount()], () =>
    clientAt(1787000000000).getAccountSettlementEvidence(),
  );

  for (const name of [
    "accruedInterest",
    "cashBalance",
    "cashReceipts",
    "intradayBuyingPowerAmount",
    "liquidationValue",
    "longMarketValue",
    "moneyMarketFund",
    "pendingDeposits",
    "savings",
    "shortMarketValue",
    "totalCash",
  ]) {
    assert.equal(
      result.presentCurrentBalanceFieldNames.includes(name),
      true,
      `expected the live block to report ${name}`,
    );
  }
});

test("an account type the broker states is reported as sent", async () => {
  const { result } = await withStub([vendorAccount({ type: "MARGIN" })], () =>
    clientAt(1787000000000).getAccountSettlementEvidence(),
  );

  assert.equal(result.accountType, "MARGIN");
});
