import assert from "node:assert/strict";
import test from "node:test";

import { SchwabClient } from "../dist/index.js";

// Ordinary Schwab chain quote fields so a fixture row resembles the vendor
// response. Contract-evidence assertions do not depend on these values.
function quoteFields() {
  return {
    description: "option",
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
    closePrice: 1,
    tradeDate: null,
    delta: -0.5,
    gamma: 0.02,
    theta: -0.01,
    vega: 0.1,
    rho: 0.01,
    daysToExpiration: 24,
    inTheMoney: false,
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

const EXPIRY = new Date(2026, 7, 21); // local Aug 21 2026 -> "2026-08-21"

test("standard equity put returns one complete result and a narrow request", async () => {
  const body = {
    symbol: "AAPL",
    status: "SUCCESS",
    isDelayed: false,
    isIndex: false,
    underlying: { symbol: "AAPL", last: 200 },
    putExpDateMap: {
      "2026-08-21:24": {
        "195.0": [
          {
            ...quoteFields(),
            putCall: "PUT",
            symbol: "AAPL  260821P00195000",
            optionRoot: "AAPL",
            strikePrice: 195,
            expirationDate: "2026-08-21T20:00:00.000+00:00",
            expirationType: "S",
            multiplier: 100,
            settlementType: "P",
            isIndexOption: false,
            isNonStandard: false,
            isMini: false,
            quoteTimeInLong: 1787000000000,
            tradeTimeInLong: 1786999999000,
            optionDeliverablesList: [
              {
                symbol: "AAPL",
                assetType: "EQUITY",
                deliverableUnits: 100,
                currencyType: null,
              },
            ],
          },
        ],
      },
    },
  };

  const { result, requestedUrl } = await withStub(body, () =>
    new SchwabClient("token").getOptionContractEvidence({
      symbol: "AAPL",
      expiry: EXPIRY,
      strike: 195,
      type: "put",
      optionSymbol: "AAPL  260821P00195000",
    }),
  );

  const params = new URL(requestedUrl).searchParams;
  assert.equal(params.get("symbol"), "AAPL");
  assert.equal(params.get("contractType"), "PUT");
  assert.equal(params.get("strike"), "195");
  assert.equal(params.get("fromDate"), "2026-08-21");
  assert.equal(params.get("toDate"), "2026-08-21");
  assert.equal(params.get("strategy"), "SINGLE");
  assert.equal(params.get("includeUnderlyingQuote"), "true");

  assert.equal(result.chainSymbol, "AAPL");
  assert.equal(result.underlyingSymbol, "AAPL");
  assert.equal(result.optionSymbol, "AAPL  260821P00195000");
  assert.equal(result.putCall, "PUT");
  assert.equal(result.strikePrice, 195);
});

test("standard ETF put preserves chain, flags, deliverable, classifications, timestamps", async () => {
  const body = {
    symbol: "IWM",
    status: "SUCCESS",
    isDelayed: false,
    isIndex: false,
    underlying: { symbol: "IWM", last: 210 },
    putExpDateMap: {
      "2026-08-21:24": {
        "205.0": [
          {
            ...quoteFields(),
            putCall: "PUT",
            symbol: "IWM   260821P00205000",
            optionRoot: "IWM",
            strikePrice: 205,
            expirationDate: "2026-08-21T20:00:00.000+00:00",
            expirationType: "S",
            multiplier: 100,
            settlementType: "P",
            isIndexOption: false,
            isNonStandard: false,
            isMini: false,
            deliverableNote: "",
            quoteTimeInLong: 1787000000000,
            tradeTimeInLong: 1786999999000,
            optionDeliverablesList: [
              {
                symbol: "IWM",
                assetType: "EQUITY",
                deliverableUnits: 100,
                currencyType: null,
              },
            ],
          },
        ],
      },
    },
  };

  const { result } = await withStub(body, () =>
    new SchwabClient("token").getOptionContractEvidence({
      symbol: "IWM",
      expiry: EXPIRY,
      strike: 205,
      type: "put",
      optionSymbol: "IWM   260821P00205000",
    }),
  );

  assert.equal(result.chainSymbol, "IWM");
  assert.equal(result.underlyingSymbol, "IWM");
  assert.equal(result.underlyingIsIndex, false);
  assert.equal(result.isIndexOption, false);
  assert.equal(result.isNonStandard, false);
  assert.equal(result.isMini, false);
  assert.equal(result.multiplier, 100);
  assert.equal(result.settlementType, "P");
  assert.equal(result.expirationType, "S");
  assert.equal(result.expirationDate, "2026-08-21T20:00:00.000+00:00");
  assert.equal(result.quoteTimeInLong, 1787000000000);
  assert.equal(result.tradeTimeInLong, 1786999999000);
  assert.equal(result.isDelayed, false);
  assert.deepEqual(result.optionDeliverablesList, [
    {
      symbol: "IWM",
      assetType: "EQUITY",
      deliverableUnits: 100,
      currencyType: null,
    },
  ]);
});

test("index row preserves explicit index flags and null deliverables; no settlement-to-delivery inference", async () => {
  const body = {
    symbol: "SPX",
    status: "SUCCESS",
    isDelayed: false,
    isIndex: true,
    underlying: { symbol: "SPX", last: 5000 },
    putExpDateMap: {
      "2026-08-21:24": {
        "4900.0": [
          {
            ...quoteFields(),
            putCall: "PUT",
            symbol: "SPXW  260821P04900000",
            optionRoot: "SPXW",
            strikePrice: 4900,
            expirationDate: "2026-08-21T20:00:00.000+00:00",
            expirationType: "S",
            multiplier: 100,
            settlementType: "C",
            isIndexOption: true,
            isNonStandard: false,
            isMini: false,
          },
        ],
      },
    },
  };

  const { result } = await withStub(body, () =>
    new SchwabClient("token").getOptionContractEvidence({
      symbol: "SPX",
      expiry: EXPIRY,
      strike: 4900,
      type: "put",
      optionSymbol: "SPXW  260821P04900000",
    }),
  );

  assert.equal(result.underlyingIsIndex, true);
  assert.equal(result.isIndexOption, true);
  assert.equal(result.settlementType, "C");
  assert.equal(result.optionDeliverablesList, null);
});

test("nonstandard adjusted row preserves note, mini, alt root, and multi-asset deliverables", async () => {
  const body = {
    symbol: "XYZ",
    status: "SUCCESS",
    isDelayed: false,
    isIndex: false,
    underlying: { symbol: "XYZ", last: 50 },
    putExpDateMap: {
      "2026-08-21:24": {
        "40.0": [
          {
            ...quoteFields(),
            putCall: "PUT",
            symbol: "XYZ1  260821P00040000",
            optionRoot: "XYZ1",
            strikePrice: 40,
            expirationDate: "2026-08-21T20:00:00.000+00:00",
            expirationType: "S",
            multiplier: 100,
            settlementType: "P",
            isIndexOption: false,
            isNonStandard: true,
            isMini: true,
            deliverableNote: "75 XYZ + $11.50",
            optionDeliverablesList: [
              {
                symbol: "XYZ",
                assetType: "EQUITY",
                deliverableUnits: "75",
              },
              {
                symbol: "USD",
                assetType: "CURRENCY",
                deliverableUnits: 11.5,
                currencyType: "USD",
              },
            ],
          },
        ],
      },
    },
  };

  const { result } = await withStub(body, () =>
    new SchwabClient("token").getOptionContractEvidence({
      symbol: "XYZ",
      expiry: EXPIRY,
      strike: 40,
      type: "put",
      optionSymbol: "XYZ1  260821P00040000",
    }),
  );

  assert.equal(result.isNonStandard, true);
  assert.equal(result.isMini, true);
  assert.equal(result.optionRoot, "XYZ1");
  assert.equal(result.deliverableNote, "75 XYZ + $11.50");
  assert.deepEqual(result.optionDeliverablesList, [
    {
      symbol: "XYZ",
      assetType: "EQUITY",
      deliverableUnits: "75",
      currencyType: null,
    },
    {
      symbol: "USD",
      assetType: "CURRENCY",
      deliverableUnits: 11.5,
      currencyType: "USD",
    },
  ]);
});

test("alternate-root exact option symbol is selected over another same-identity row", async () => {
  const body = {
    symbol: "SPX",
    status: "SUCCESS",
    isDelayed: false,
    isIndex: true,
    underlying: { symbol: "SPX", last: 5000 },
    putExpDateMap: {
      "2026-08-21:24": {
        "4900.0": [
          {
            ...quoteFields(),
            putCall: "PUT",
            symbol: "SPX   260821P04900000",
            optionRoot: "SPX",
            strikePrice: 4900,
            expirationDate: "2026-08-21T20:00:00.000+00:00",
          },
          {
            ...quoteFields(),
            putCall: "PUT",
            symbol: "SPXW  260821P04900000",
            optionRoot: "SPXW",
            strikePrice: 4900,
            expirationDate: "2026-08-21T20:00:00.000+00:00",
          },
        ],
      },
    },
  };

  const { result } = await withStub(body, () =>
    new SchwabClient("token").getOptionContractEvidence({
      symbol: "SPX",
      expiry: EXPIRY,
      strike: 4900,
      type: "put",
      optionSymbol: "SPXW  260821P04900000",
    }),
  );

  assert.equal(result.optionSymbol, "SPXW  260821P04900000");
  assert.equal(result.optionRoot, "SPXW");
});

test("exact option symbol with wrong putCall is not accepted", async () => {
  const body = {
    symbol: "AAPL",
    status: "SUCCESS",
    underlying: { symbol: "AAPL", last: 200 },
    putExpDateMap: {
      "2026-08-21:24": {
        "195.0": [
          {
            ...quoteFields(),
            putCall: "CALL",
            symbol: "AAPL  260821P00195000",
            optionRoot: "AAPL",
            strikePrice: 195,
            expirationDate: "2026-08-21T20:00:00.000+00:00",
          },
        ],
      },
    },
  };

  await withStub(body, async () => {
    await assert.rejects(
      () =>
        new SchwabClient("token").getOptionContractEvidence({
          symbol: "AAPL",
          expiry: EXPIRY,
          strike: 195,
          type: "put",
          optionSymbol: "AAPL  260821P00195000",
        }),
      /No exact Schwab option contract matched/,
    );
  });
});

test("exact symbol with wrong strike or expiration is not accepted", async () => {
  const wrongStrike = {
    symbol: "AAPL",
    status: "SUCCESS",
    underlying: { symbol: "AAPL", last: 200 },
    putExpDateMap: {
      "2026-08-21:24": {
        "196.0": [
          {
            ...quoteFields(),
            putCall: "PUT",
            symbol: "AAPL  260821P00195000",
            optionRoot: "AAPL",
            strikePrice: 196,
            expirationDate: "2026-08-21T20:00:00.000+00:00",
          },
        ],
      },
    },
  };
  await withStub(wrongStrike, async () => {
    await assert.rejects(
      () =>
        new SchwabClient("token").getOptionContractEvidence({
          symbol: "AAPL",
          expiry: EXPIRY,
          strike: 195,
          type: "put",
          optionSymbol: "AAPL  260821P00195000",
        }),
      /No exact Schwab option contract matched/,
    );
  });

  const wrongExpiration = {
    symbol: "AAPL",
    status: "SUCCESS",
    underlying: { symbol: "AAPL", last: 200 },
    putExpDateMap: {
      "2026-08-22:25": {
        "195.0": [
          {
            ...quoteFields(),
            putCall: "PUT",
            symbol: "AAPL  260821P00195000",
            optionRoot: "AAPL",
            strikePrice: 195,
            expirationDate: "2026-08-22T20:00:00.000+00:00",
          },
        ],
      },
    },
  };
  await withStub(wrongExpiration, async () => {
    await assert.rejects(
      () =>
        new SchwabClient("token").getOptionContractEvidence({
          symbol: "AAPL",
          expiry: EXPIRY,
          strike: 195,
          type: "put",
          optionSymbol: "AAPL  260821P00195000",
        }),
      /No exact Schwab option contract matched/,
    );
  });
});

test("missing broker fields become null while an explicit empty deliverables list stays []", async () => {
  const body = {
    symbol: "AAPL",
    status: "SUCCESS",
    underlying: { symbol: "AAPL", last: 200 },
    putExpDateMap: {
      "2026-08-21:24": {
        "195.0": [
          {
            ...quoteFields(),
            putCall: "PUT",
            symbol: "AAPL  260821P00195000",
            strikePrice: 195,
            expirationDate: "2026-08-21T20:00:00.000+00:00",
            optionDeliverablesList: [],
          },
        ],
      },
    },
  };

  const { result } = await withStub(body, () =>
    new SchwabClient("token").getOptionContractEvidence({
      symbol: "AAPL",
      expiry: EXPIRY,
      strike: 195,
      type: "put",
      optionSymbol: "AAPL  260821P00195000",
    }),
  );

  assert.equal(result.optionRoot, null);
  assert.equal(result.isIndexOption, null);
  assert.equal(result.isNonStandard, null);
  assert.equal(result.isMini, null);
  assert.equal(result.multiplier, null);
  assert.equal(result.settlementType, null);
  assert.equal(result.expirationType, null);
  assert.equal(result.deliverableNote, null);
  assert.equal(result.quoteTimeInLong, null);
  assert.equal(result.tradeTimeInLong, null);
  assert.equal(result.underlyingIsIndex, null);
  assert.equal(result.isDelayed, null);
  assert.deepEqual(result.optionDeliverablesList, []);
});

test("explicit zero evidence timestamps are preserved as 0, not null", async () => {
  const body = {
    symbol: "AAPL",
    status: "SUCCESS",
    underlying: { symbol: "AAPL", last: 200 },
    putExpDateMap: {
      "2026-08-21:24": {
        "195.0": [
          {
            ...quoteFields(),
            putCall: "PUT",
            symbol: "AAPL  260821P00195000",
            strikePrice: 195,
            expirationDate: "2026-08-21T20:00:00.000+00:00",
            quoteTimeInLong: 0,
            tradeTimeInLong: 0,
          },
        ],
      },
    },
  };

  const { result } = await withStub(body, () =>
    new SchwabClient("token").getOptionContractEvidence({
      symbol: "AAPL",
      expiry: EXPIRY,
      strike: 195,
      type: "put",
      optionSymbol: "AAPL  260821P00195000",
    }),
  );

  assert.equal(result.quoteTimeInLong, 0);
  assert.equal(result.tradeTimeInLong, 0);
});

test("no exact match rejects with a missing-match error", async () => {
  const body = {
    symbol: "AAPL",
    status: "SUCCESS",
    underlying: { symbol: "AAPL", last: 200 },
    putExpDateMap: {
      "2026-08-21:24": {
        "195.0": [
          {
            ...quoteFields(),
            putCall: "PUT",
            symbol: "AAPL  260821P00190000",
            strikePrice: 190,
            expirationDate: "2026-08-21T20:00:00.000+00:00",
          },
        ],
      },
    },
  };
  await withStub(body, async () => {
    await assert.rejects(
      () =>
        new SchwabClient("token").getOptionContractEvidence({
          symbol: "AAPL",
          expiry: EXPIRY,
          strike: 195,
          type: "put",
          optionSymbol: "AAPL  260821P00195000",
        }),
      /No exact Schwab option contract matched/,
    );
  });
});

test("two fully matching rows reject as ambiguous rather than selecting one", async () => {
  const row = {
    ...quoteFields(),
    putCall: "PUT",
    symbol: "AAPL  260821P00195000",
    optionRoot: "AAPL",
    strikePrice: 195,
    expirationDate: "2026-08-21T20:00:00.000+00:00",
  };
  const body = {
    symbol: "AAPL",
    status: "SUCCESS",
    underlying: { symbol: "AAPL", last: 200 },
    putExpDateMap: {
      "2026-08-21:24": {
        "195.0": [{ ...row }, { ...row }],
      },
    },
  };
  await withStub(body, async () => {
    await assert.rejects(
      () =>
        new SchwabClient("token").getOptionContractEvidence({
          symbol: "AAPL",
          expiry: EXPIRY,
          strike: 195,
          type: "put",
          optionSymbol: "AAPL  260821P00195000",
        }),
      /Ambiguous Schwab option contract identity/,
    );
  });
});

test("missing or mismatched chain symbol rejects as missing chain identity", async () => {
  const missing = {
    status: "SUCCESS",
    putExpDateMap: {
      "2026-08-21:24": {
        "195.0": [
          {
            ...quoteFields(),
            putCall: "PUT",
            symbol: "AAPL  260821P00195000",
            strikePrice: 195,
            expirationDate: "2026-08-21T20:00:00.000+00:00",
          },
        ],
      },
    },
  };
  await withStub(missing, async () => {
    await assert.rejects(
      () =>
        new SchwabClient("token").getOptionContractEvidence({
          symbol: "AAPL",
          expiry: EXPIRY,
          strike: 195,
          type: "put",
          optionSymbol: "AAPL  260821P00195000",
        }),
      /Missing or mismatched Schwab option chain identity/,
    );
  });

  const mismatched = { ...missing, symbol: "MSFT" };
  await withStub(mismatched, async () => {
    await assert.rejects(
      () =>
        new SchwabClient("token").getOptionContractEvidence({
          symbol: "AAPL",
          expiry: EXPIRY,
          strike: 195,
          type: "put",
          optionSymbol: "AAPL  260821P00195000",
        }),
      /Missing or mismatched Schwab option chain identity/,
    );
  });
});
