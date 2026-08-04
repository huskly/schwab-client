import assert from "node:assert/strict";
import test from "node:test";

import { SchwabClient } from "../dist/index.js";

test("getAccountBalances returns distinct available funds and margin balance", async () => {
  const originalFetch = globalThis.fetch;
  const responseBody = [
    {
      securitiesAccount: {
        accountNumber: "123456789",
        positions: [],
        currentBalances: {
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
        },
      },
    },
  ];

  globalThis.fetch = async () =>
    new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  try {
    const balances = await new SchwabClient("token").getAccountBalances();

    assert.deepEqual(balances, responseBody[0].securitiesAccount.currentBalances);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
