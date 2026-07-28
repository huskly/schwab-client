import assert from "node:assert/strict";
import test from "node:test";

import { SchwabClient } from "../dist/index.js";

test("getOptionChain preserves populated, missing, and zero activity values", async () => {
  const originalFetch = globalThis.fetch;
  const contract = {
    putCall: "CALL",
    description: "SPY option",
    exchangeName: "OPR",
    bid: 1,
    ask: 1.2,
    last: 1.1,
    mark: 1.1,
    bidSize: 10,
    askSize: 12,
    lastSize: 1,
    highPrice: 1.3,
    lowPrice: 0.9,
    openPrice: 1,
    tradeDate: null,
    delta: 0.5,
    gamma: 0.02,
    theta: -0.01,
    vega: 0.1,
    rho: 0.01,
    expirationDate: "2026-08-21T20:00:00.000+00:00",
    daysToExpiration: 24,
    expirationType: "S",
    multiplier: 100,
    settlementType: "P",
    inTheMoney: false,
  };
  const responseBody = {
    symbol: "SPY",
    status: "SUCCESS",
    callExpDateMap: {
      "2026-08-21:24": {
        "600.0": [
          {
            ...contract,
            symbol: "SPY   260821C00600000",
            strikePrice: 600,
            totalVolume: 123,
            openInterest: 456,
          },
        ],
        "601.0": [
          {
            ...contract,
            symbol: "SPY   260821C00601000",
            strikePrice: 601,
            totalVolume: null,
          },
        ],
        "602.0": [
          {
            ...contract,
            symbol: "SPY   260821C00602000",
            strikePrice: 602,
            totalVolume: 0,
            openInterest: 0,
          },
        ],
      },
    },
  };

  globalThis.fetch = async () =>
    new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  try {
    const options = await new SchwabClient("token").getOptionChain(
      "SPY",
      new Date("2026-08-21T00:00:00Z"),
    );

    assert.deepEqual(
      options.map(({ strike, volume, openInterest }) => ({
        strike,
        volume,
        openInterest,
      })),
      [
        { strike: 600, volume: 123, openInterest: 456 },
        { strike: 601, volume: null, openInterest: null },
        { strike: 602, volume: 0, openInterest: 0 },
      ],
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
