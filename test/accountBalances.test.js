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
          liquidationValue: 10000,
          cashBalance: 1500,
          availableFunds: 2500,
          marginBalance: 3750,
          buyingPower: 5000,
          equity: 9000,
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

    assert.deepEqual(balances, {
      liquidationValue: 10000,
      cashBalance: 1500,
      availableFunds: 2500,
      marginBalance: 3750,
      buyingPower: 5000,
      equity: 9000,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
