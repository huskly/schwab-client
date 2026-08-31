import assert from "node:assert/strict";
import test from "node:test";

import { SchwabClient } from "../dist/index.js";

// Ordinary Schwab balance fields so a fixture resembles the vendor response.
// Settlement-evidence assertions do not depend on these values.
function marginBalanceFields() {
  return {
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
    isInCall: 0,
    stockBuyingPower: 5000,
    optionBuyingPower: 4500,
    liquidationValue: 10000,
    cashBalance: 1500,
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

test("a modern payload carrying every settlement field is reported field for field", async () => {
  const body = [
    {
      securitiesAccount: {
        accountNumber: "123456789",
        type: "CASH",
        positions: [],
        currentBalances: {
          ...marginBalanceFields(),
          unsettledCash: 250,
          cashAvailableForTrading: 1200,
          cashAvailableForWithdrawal: 1100,
        },
      },
    },
  ];

  const { result, requestedUrl } = await withStub(body, () =>
    clientAt(1787000000000).getAccountSettlementEvidence(),
  );

  assert.deepEqual(result, {
    accountNumber: "123456789",
    accountType: "CASH",
    cashBalance: 1500,
    unsettledCash: 250,
    cashAvailableForTrading: 1200,
    cashAvailableForWithdrawal: 1100,
    availableFunds: 2500,
    optionBuyingPower: 4500,
    marginBalance: 3750,
    longMarginValue: 8000,
    currency: null,
    observedAtEpochMillis: 1787000000000,
    presentBalanceFieldNames: Object.keys({
      ...marginBalanceFields(),
      unsettledCash: 250,
      cashAvailableForTrading: 1200,
      cashAvailableForWithdrawal: 1100,
    }).sort(),
  });
  assert.equal(
    requestedUrl,
    "https://api.schwabapi.com/trader/v1/accounts?fields=positions",
  );
});

test("a legacy payload without the settlement fields reports null and does not throw", async () => {
  const body = [
    {
      securitiesAccount: {
        accountNumber: "123456789",
        positions: [],
        currentBalances: marginBalanceFields(),
      },
    },
  ];

  const { result } = await withStub(body, () =>
    clientAt(1787000000000).getAccountSettlementEvidence(),
  );

  assert.equal(result.unsettledCash, null);
  assert.equal(result.cashAvailableForTrading, null);
  assert.equal(result.cashAvailableForWithdrawal, null);
  assert.equal(result.accountType, null);
  assert.equal(result.cashBalance, 1500);
  assert.equal(result.availableFunds, 2500);
});

test("non-finite or wrongly typed settlement values become null instead of a number", async () => {
  const body = [
    {
      securitiesAccount: {
        accountNumber: "123456789",
        type: 7,
        positions: [],
        currentBalances: {
          ...marginBalanceFields(),
          unsettledCash: null,
          cashAvailableForTrading: "1200.00",
          cashAvailableForWithdrawal: Number.NaN,
          currency: 840,
        },
      },
    },
  ];

  const { result } = await withStub(body, () =>
    clientAt(1787000000000).getAccountSettlementEvidence(),
  );

  assert.equal(result.unsettledCash, null);
  assert.equal(result.cashAvailableForTrading, null);
  assert.equal(result.cashAvailableForWithdrawal, null);
  assert.equal(result.accountType, null);
  assert.equal(result.currency, null);
});

test("present balance field names list key names only and stay sorted", async () => {
  const body = [
    {
      securitiesAccount: {
        accountNumber: "123456789",
        positions: [],
        currentBalances: {
          optionBuyingPower: 4500,
          cashBalance: 1500,
          availableFunds: 2500,
          marginBalance: 3750,
          longMarginValue: 8000,
          unsettledCash: 250,
        },
      },
    },
  ];

  const { result } = await withStub(body, () =>
    clientAt(1787000000000).getAccountSettlementEvidence(),
  );

  assert.deepEqual(result.presentBalanceFieldNames, [
    "availableFunds",
    "cashBalance",
    "longMarginValue",
    "marginBalance",
    "optionBuyingPower",
    "unsettledCash",
  ]);
});

test("the observation timestamp comes from the injected client clock", async () => {
  const body = [
    {
      securitiesAccount: {
        accountNumber: "123456789",
        positions: [],
        currentBalances: marginBalanceFields(),
      },
    },
  ];

  const { result } = await withStub(body, () =>
    clientAt(1234567890123).getAccountSettlementEvidence(),
  );

  assert.equal(result.observedAtEpochMillis, 1234567890123);
});

test("the account number comes from the envelope the balances object does not carry", async () => {
  const body = [
    {
      securitiesAccount: {
        accountNumber: "987654321",
        positions: [],
        currentBalances: marginBalanceFields(),
      },
    },
  ];

  const { result } = await withStub(body, () =>
    clientAt(1787000000000).getAccountSettlementEvidence(),
  );

  assert.equal(result.accountNumber, "987654321");
  assert.equal("accountNumber" in marginBalanceFields(), false);
});

test("a multi-account response selects the same account as getAccountBalances", async () => {
  const body = [
    {
      securitiesAccount: {
        accountNumber: "111111111",
        positions: [],
        currentBalances: { ...marginBalanceFields(), cashBalance: 11 },
      },
    },
    {
      securitiesAccount: {
        accountNumber: "222222222",
        positions: [],
        currentBalances: { ...marginBalanceFields(), cashBalance: 22 },
      },
    },
  ];

  const { result: evidence } = await withStub(body, () =>
    clientAt(1787000000000).getAccountSettlementEvidence(),
  );
  const { result: balances } = await withStub(body, () =>
    new SchwabClient("token").getAccountBalances(),
  );

  assert.equal(evidence.accountNumber, "111111111");
  assert.equal(evidence.cashBalance, balances.cashBalance);
});

test("a currency the broker never sends stays null and is never assumed to be USD", async () => {
  const body = [
    {
      securitiesAccount: {
        accountNumber: "123456789",
        positions: [],
        currentBalances: marginBalanceFields(),
      },
    },
  ];

  const { result } = await withStub(body, () =>
    clientAt(1787000000000).getAccountSettlementEvidence(),
  );

  assert.equal(result.currency, null);
  assert.equal(result.presentBalanceFieldNames.includes("currency"), false);
});

test("an empty account list is refused the same way as the balances read", async () => {
  await withStub([], async () => {
    await assert.rejects(
      clientAt(1787000000000).getAccountSettlementEvidence(),
      /No Schwab account found/,
    );
  });
});
