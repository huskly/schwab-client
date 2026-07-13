import assert from "node:assert/strict";
import test from "node:test";

import {
  getOrderFees,
  getRealizedFills,
  SchwabClient,
} from "../dist/index.js";

test("getRealizedFills calculates quantity-weighted prices by order leg", () => {
  const fills = getRealizedFills({
    orderLegCollection: [
      {
        legId: 1,
        instrument: {
          assetType: "OPTION",
          instrumentId: 101,
          symbol: "SPY   260717C00600000",
        },
      },
      {
        legId: 2,
        instrument: {
          assetType: "OPTION",
          instrumentId: 202,
          symbol: "SPY   260717C00605000",
        },
      },
    ],
    orderActivityCollection: [
      {
        activityType: "EXECUTION",
        executionLegs: [
          { legId: 1, instrumentId: 101, price: 1.2, quantity: 1 },
          { legId: 2, instrumentId: 202, price: 0.4, quantity: 2 },
        ],
      },
      {
        activityType: "EXECUTION",
        executionLegs: [
          { legId: 1, instrumentId: 101, price: 1.5, quantity: 2 },
          { legId: 2, instrumentId: 202, price: 0.7, quantity: 1 },
        ],
      },
      {
        activityType: "ORDER_ACTION",
        executionLegs: [{ legId: 1, price: 99, quantity: 99 }],
      },
    ],
  });

  assert.deepEqual(fills, [
    {
      legId: 1,
      instrumentId: 101,
      symbol: "SPY   260717C00600000",
      filledQuantity: 3,
      averageFillPrice: 1.4000000000000001,
    },
    {
      legId: 2,
      instrumentId: 202,
      symbol: "SPY   260717C00605000",
      filledQuantity: 3,
      averageFillPrice: 0.5,
    },
  ]);
});

test("getRealizedFills correlates by instrument id and skips incomplete fills", () => {
  const fills = getRealizedFills({
    orderLegCollection: [
      {
        instrument: {
          assetType: "EQUITY",
          instrumentId: 303,
          symbol: "AAPL",
        },
      },
    ],
    orderActivityCollection: [
      {
        activityType: "EXECUTION",
        executionLegs: [
          { instrumentId: 303, price: 210, quantity: 5 },
          { instrumentId: 303, quantity: 2 },
        ],
      },
    ],
  });

  assert.deepEqual(fills, [
    {
      legId: undefined,
      instrumentId: 303,
      symbol: "AAPL",
      filledQuantity: 5,
      averageFillPrice: 210,
    },
  ]);
});

test("getRealizedFills uses one bucket when execution identifiers vary", () => {
  const fills = getRealizedFills({
    orderLegCollection: [
      {
        instrument: {
          assetType: "OPTION",
          instrumentId: 404,
          symbol: "SPY   260717P00550000",
        },
      },
    ],
    orderActivityCollection: [
      {
        activityType: "EXECUTION",
        executionLegs: [
          { legId: 7, instrumentId: 404, price: 1.2, quantity: 1 },
        ],
      },
      {
        activityType: "EXECUTION",
        executionLegs: [{ instrumentId: 404, price: 1.5, quantity: 2 }],
      },
    ],
  });

  assert.deepEqual(fills, [
    {
      legId: 7,
      instrumentId: 404,
      symbol: "SPY   260717P00550000",
      filledQuantity: 3,
      averageFillPrice: 1.4000000000000001,
    },
  ]);
});

test("fetchAccountOrders preserves terminal order execution activities", async () => {
  const originalFetch = globalThis.fetch;
  const responseBody = [
    {
      orderId: 52,
      status: "FILLED",
      orderActivityCollection: [
        {
          activityType: "EXECUTION",
          executionType: "FILL",
          executionLegs: [{ legId: 1, price: 1.25, quantity: 2 }],
        },
      ],
    },
  ];
  globalThis.fetch = async () =>
    new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  try {
    const client = new SchwabClient("token");
    const orders = await client.fetchAccountOrders("account-hash", {
      fromEnteredTime: new Date("2026-07-01T00:00:00Z"),
      toEnteredTime: new Date("2026-07-13T00:00:00Z"),
      status: "FILLED",
    });

    assert.deepEqual(orders, responseBody);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getOrderFees correlates TRADE transactions by order id", () => {
  const transactions = [
    {
      activityId: 10,
      time: "2026-07-13T10:00:00Z",
      accountNumber: "123",
      type: "TRADE",
      status: "VALID",
      subAccount: "CASH",
      tradeDate: "2026-07-13",
      positionId: 1,
      orderId: 52,
      netAmount: 119.25,
      transferItems: [
        {
          transactionId: 1001,
          transferItemType: "OPTION",
          instrument: { symbol: "SPY   260717C00600000" },
          fee: 0.65,
        },
        {
          transactionId: 1002,
          transferItemType: "FEE",
          fee: 0.1,
        },
      ],
    },
    {
      activityId: 11,
      time: "2026-07-13T10:00:00Z",
      accountNumber: "123",
      type: "DIVIDEND_OR_INTEREST",
      status: "VALID",
      subAccount: "CASH",
      tradeDate: "2026-07-13",
      positionId: 1,
      orderId: 52,
      netAmount: 1,
      transferItems: [{ fee: 50 }],
    },
    {
      activityId: 12,
      time: "2026-07-13T10:00:00Z",
      accountNumber: "123",
      type: "TRADE",
      status: "VALID",
      subAccount: "CASH",
      tradeDate: "2026-07-13",
      positionId: 1,
      orderId: 99,
      netAmount: 1,
      transferItems: [{ fee: 75 }],
    },
  ];

  const result = getOrderFees({ orderId: 52 }, transactions);

  assert.equal(result.totalFees, 0.75);
  assert.equal(result.transactions.length, 1);
  assert.deepEqual(result.items, [
    {
      activityId: 10,
      transactionId: 1001,
      transferItemType: "OPTION",
      symbol: "SPY   260717C00600000",
      fee: 0.65,
    },
    {
      activityId: 10,
      transactionId: 1002,
      transferItemType: "FEE",
      symbol: undefined,
      fee: 0.1,
    },
  ]);
});

test("getOrderFees rejects an order without an id", () => {
  assert.throws(
    () => getOrderFees({}, []),
    /A valid order id is required to correlate order fees/,
  );
});
