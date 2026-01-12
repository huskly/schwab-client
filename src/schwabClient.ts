import type {
  OptionQuote,
  PriceHistoryResponse,
  SchwabOrder,
  SchwabOrderRequest,
  SchwabOrderStatus,
  SchwabQuoteResponse,
  SchwabInstrumentSearchProjection,
  SchwabInstrumentResponse,
  SchwabMoversIndexSymbol,
  SchwabMoversSort,
  SchwabMoversFrequency,
  SchwabMoversResponse,
  PutCreditSpread,
} from "./types.js";
import type {
  SchwabAccount,
  SchwabAccountTransactionHistory,
  SchwabPosition,
  SchwabTransaction,
  SchwabUserPreference,
} from "./schwabApiTypes.js";
import { differenceInDays, format, parse, startOfYear } from "date-fns";

const SCHWAB_API_BASE_URL = "https://api.schwabapi.com";

interface SchwabOptionChainResponse {
  symbol: string;
  status: string;
  underlying?: { symbol: string; last: number };
  putExpDateMap?: Record<string, Record<string, SchwabOptionContract[]>>;
  callExpDateMap?: Record<string, Record<string, SchwabOptionContract[]>>;
}

interface SchwabOptionContract {
  putCall: "PUT" | "CALL";
  symbol: string;
  description: string;
  exchangeName: string;
  bid: number;
  ask: number;
  last: number;
  mark: number;
  bidSize: number;
  askSize: number;
  lastSize: number;
  highPrice: number;
  lowPrice: number;
  openPrice: number;
  closePrice: number;
  totalVolume: number;
  tradeDate: number | null;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  openInterest: number;
  strikePrice: number;
  expirationDate: string;
  daysToExpiration: number;
  expirationType: string;
  multiplier: number;
  settlementType: string;
  inTheMoney: boolean;
}

/**
 * Schwab Market Data and Trading API client.
 *
 * @example
 * ```typescript
 * import { SchwabClient } from '@huskly/schwab-client';
 *
 * const client = new SchwabClient('your-access-token');
 * const quotes = await client.getQuotes(['AAPL', 'GOOGL']);
 * ```
 */
export class SchwabClient {
  /**
   * Creates a new SchwabClient instance.
   * @param accessToken - A valid Schwab API access token
   */
  constructor(private readonly accessToken: string) {
    if (!accessToken) {
      throw new Error("Access token is required");
    }
  }

  today(): Date {
    return new Date();
  }

  async getRiskFreeRate(_date: Date): Promise<number> {
    // Use the CBOE 13-week Treasury Bill yield ($IRX) as the risk-free proxy.
    const quotes = await this.getQuotes(["$IRX"]);
    const irxQuote =
      quotes["$IRX"] ??
      quotes["IRX"] ??
      quotes["$IRX.X"] ??
      (Object.keys(quotes).length === 1 ? Object.values(quotes)[0] : undefined);
    const ratePercent = irxQuote?.quote.mark ?? irxQuote?.quote.lastPrice;

    if (ratePercent === undefined || Number.isNaN(ratePercent)) {
      throw new Error("Unable to fetch risk-free rate from $IRX quote data");
    }

    return ratePercent / 100;
  }

  async getQuotes(
    symbols: string[],
  ): Promise<Record<string, SchwabQuoteResponse>> {
    const symbolsStr = symbols.map(encodeURIComponent).join(",");
    return await this.makeApiRequest<Record<string, SchwabQuoteResponse>>(
      `/marketdata/v1/quotes?symbols=${symbolsStr}`,
    );
  }

  async getPriceHistory({
    symbol,
    days,
    startDate,
    endDate = Date.now(),
  }: {
    symbol: string;
    days?: number;
    startDate?: number;
    endDate?: number;
  }): Promise<PriceHistoryResponse["candles"]> {
    // If days is not provided but startDate and endDate are, calculate days from the date range
    const effectiveDays =
      days ?? (startDate ? differenceInDays(endDate, startDate) : 30);
    // For requests > 132 trading days (~6 months), use periodType "year"
    // Otherwise use periodType "month" with appropriate period
    const useYear = effectiveDays > 132;
    const periodType = useYear ? "year" : "month";
    const period = useYear
      ? 1
      : effectiveDays <= 22
        ? 1
        : effectiveDays <= 44
          ? 2
          : effectiveDays <= 66
            ? 3
            : 6;
    const params = new URLSearchParams({
      symbol,
      periodType,
      period: String(period),
      frequencyType: "daily",
      frequency: "1",
      endDate: String(endDate),
    });
    if (startDate) {
      params.append("startDate", String(startDate));
    }
    const data = await this.makeApiRequest<PriceHistoryResponse>(
      `/marketdata/v1/pricehistory?${params.toString()}`,
    );

    if (data.empty) {
      return [];
    }

    return data.candles.sort((a, b) => a.datetime - b.datetime);
  }

  async getVixLevel(): Promise<number | undefined> {
    const quotes = await this.getQuotes(["$VIX"]);
    const vixQuote = quotes["$VIX"];
    return vixQuote?.quote.mark ?? vixQuote?.quote.lastPrice;
  }

  // fromDate and toDate are in "YYYY-MM-DD" format
  async getAvailableExpiries(
    symbol: string,
    contractType: "PUT" | "CALL",
    fromDate: string,
    toDate: string,
  ): Promise<Date[]> {
    const data = await this.makeApiRequest<SchwabOptionChainResponse>(
      `/marketdata/v1/chains?symbol=${encodeURIComponent(
        symbol,
      )}&contractType=${contractType}&fromDate=${fromDate}&toDate=${toDate}`,
    );

    if (!data.putExpDateMap) {
      return [];
    }

    const expiries = Object.keys(data.putExpDateMap).map((key) => {
      // Key format is "2024-01-19:30" (date:DTE)
      const dateStr = key.split(":")[0] ?? key;
      return parse(dateStr, "yyyy-MM-dd", new Date());
    });

    return expiries.sort((a, b) => a.getTime() - b.getTime());
  }

  async getOptionChain(symbol: string, expiry: Date): Promise<OptionQuote[]> {
    const expiryStr = format(expiry, "yyyy-MM-dd");
    const data = await this.makeApiRequest<SchwabOptionChainResponse>(
      `/marketdata/v1/chains?symbol=${encodeURIComponent(
        symbol,
      )}&fromDate=${expiryStr}&toDate=${expiryStr}`,
    );

    const options: OptionQuote[] = [];

    const processExpDateMap = (
      expDateMap:
        | Record<string, Record<string, SchwabOptionContract[]>>
        | undefined,
      isCall: boolean,
    ) => {
      if (!expDateMap) return;

      for (const dateKey of Object.keys(expDateMap)) {
        const strikeMap = expDateMap[dateKey];
        if (!strikeMap) continue;
        for (const strikeKey of Object.keys(strikeMap)) {
          const contracts = strikeMap[strikeKey];
          if (!contracts) continue;
          for (const contract of contracts) {
            const expirationDate = new Date(contract.expirationDate);
            options.push({
              symbol: contract.symbol,
              expiry: expirationDate,
              strike: contract.strikePrice,
              isCall,
              bid: contract.bid > 0 ? contract.bid : null,
              ask: contract.ask > 0 ? contract.ask : null,
              mid: contract.mark,
              delta: contract.delta,
            });
          }
        }
      }
    };

    processExpDateMap(data.callExpDateMap, true);
    processExpDateMap(data.putExpDateMap, false);

    return options;
  }

  async getOptionQuote(args: {
    symbol: string;
    expiry: Date;
    strike: number;
    type: "call" | "put";
  }): Promise<OptionQuote | null> {
    const { symbol, expiry, strike, type } = args;
    const isCall = type === "call";
    const chain = await this.getOptionChain(symbol, expiry);
    const match = chain.find((o) => o.strike === strike && o.isCall === isCall);
    return match ?? null;
  }

  async getAccountEquity(): Promise<number> {
    // This assumes there is exactly one account connected, which is the one we want.
    const [account] = await this.makeApiRequest<SchwabAccount[]>(
      "/trader/v1/accounts?fields=positions",
    );
    if (!account) {
      throw new Error("No Schwab account found");
    }
    return account.securitiesAccount.currentBalances.liquidationValue;
  }

  async getAccountBalances(): Promise<{
    liquidationValue: number;
    cashBalance: number;
    availableFunds: number;
    buyingPower: number;
    equity: number;
  }> {
    const [account] = await this.makeApiRequest<SchwabAccount[]>(
      "/trader/v1/accounts?fields=positions",
    );
    if (!account) {
      throw new Error("No Schwab account found");
    }
    const balances = account.securitiesAccount.currentBalances;
    return {
      liquidationValue: balances.liquidationValue,
      cashBalance: balances.cashBalance,
      availableFunds: balances.availableFunds,
      buyingPower: balances.buyingPower,
      equity: balances.equity,
    };
  }

  async getPositions(symbol?: string): Promise<SchwabPosition[]> {
    const accounts = await this.makeApiRequest<SchwabAccount[]>(
      "/trader/v1/accounts?fields=positions",
    );

    const allPositions: SchwabPosition[] = [];
    for (const account of accounts) {
      allPositions.push(...account.securitiesAccount.positions);
    }

    if (symbol) {
      const upperSymbol = symbol.toUpperCase();
      return allPositions.filter((pos) => {
        const posSymbol = pos.instrument.symbol.toUpperCase();
        const underlying = pos.instrument.underlyingSymbol?.toUpperCase();
        return posSymbol.startsWith(upperSymbol) || underlying === upperSymbol;
      });
    }

    return allPositions;
  }

  async getPutCreditSpreads(symbol: string): Promise<PutCreditSpread[]> {
    const accounts = await this.makeApiRequest<SchwabAccount[]>(
      "/trader/v1/accounts?fields=positions",
    );

    const spreads: PutCreditSpread[] = [];

    for (const account of accounts) {
      const positions = account.securitiesAccount.positions;
      const optionPositions = positions.filter(
        (pos) =>
          pos.instrument.assetType === "OPTION" &&
          pos.instrument.underlyingSymbol === symbol,
      );

      // Group by expiry to find spreads
      const byExpiry = new Map<string, SchwabPosition[]>();
      for (const pos of optionPositions) {
        const optionSymbol = pos.instrument.symbol;
        // Parse option symbol format: SPX   241220P05900000
        // Symbol structure: underlying + expiry (YYMMDD) + P/C + strike
        const match = /^(\w+)\s*(\d{6})([PC])(\d+)$/.exec(optionSymbol);
        if (!match) continue;

        const expiryKey = match[2];
        if (!expiryKey) continue;
        const existing = byExpiry.get(expiryKey) ?? [];
        existing.push(pos);
        byExpiry.set(expiryKey, existing);
      }

      // Find put spreads (short put + long put at lower strike)
      for (const [expiryKey, expiryPositions] of byExpiry) {
        const puts = expiryPositions.filter((p) =>
          p.instrument.symbol.includes("P"),
        );

        const shortPuts = puts.filter((p) => p.shortQuantity > 0);
        const longPuts = puts.filter((p) => p.longQuantity > 0);

        for (const shortPut of shortPuts) {
          const shortMatch = /(\d{6})P(\d+)$/.exec(shortPut.instrument.symbol);
          if (!shortMatch?.[2]) continue;
          const shortStrike = parseInt(shortMatch[2]) / 1000;

          // Find corresponding long put at lower strike
          for (const longPut of longPuts) {
            const longMatch = /(\d{6})P(\d+)$/.exec(longPut.instrument.symbol);
            if (!longMatch?.[2]) continue;
            const longStrike = parseInt(longMatch[2]) / 1000;

            if (longStrike < shortStrike) {
              const quantity = Math.min(
                shortPut.shortQuantity,
                longPut.longQuantity,
              );
              const width = shortStrike - longStrike;
              const credit = shortPut.averagePrice - longPut.averagePrice;

              // Parse expiry date from YYMMDD format
              const year = 2000 + parseInt(expiryKey.slice(0, 2));
              const month = parseInt(expiryKey.slice(2, 4)) - 1;
              const day = parseInt(expiryKey.slice(4, 6));
              const expiry = new Date(year, month, day);

              spreads.push({
                underlying: symbol,
                expiry,
                shortStrike,
                longStrike,
                credit,
                quantity,
                theoreticalMaxLossPts: width - credit,
              });
            }
          }
        }
      }
    }

    return spreads;
  }

  async fetchAccountNumbers(): Promise<
    { accountNumber: string; hashValue: string }[]
  > {
    const accountNumbers = await this.makeApiRequest<
      { accountNumber: string; hashValue: string }[]
    >("/trader/v1/accounts/accountNumbers");
    return accountNumbers;
  }

  async fetchTransactionHistory(
    startDate: Date = startOfYear(this.today()),
    endDate: Date = this.today(),
  ): Promise<SchwabAccountTransactionHistory[]> {
    const accountHashes = await this.fetchAccountNumbers();
    const histories = await Promise.all(
      accountHashes.map(({ hashValue }) =>
        this.fetchAccountTransactionHistory(hashValue, startDate, endDate),
      ),
    );
    return accountHashes.map((account, index) => ({
      accountNumber: account.accountNumber,
      transactions: histories[index] ?? [],
    }));
  }

  async fetchAccountTransactionHistory(
    accountHash: string,
    startDate: Date = startOfYear(this.today()),
    endDate: Date = this.today(),
  ): Promise<SchwabTransaction[]> {
    if (!accountHash) {
      throw new Error("Account hash is required to fetch transaction history");
    }
    // Use toISOString() to properly convert local time to UTC with Z suffix
    const formattedStartDate = startDate.toISOString();
    const formattedEndDate = endDate.toISOString();
    return await this.makeApiRequest<SchwabTransaction[]>(
      `/trader/v1/accounts/${accountHash}/transactions?startDate=${formattedStartDate}&endDate=${formattedEndDate}`,
    );
  }

  async fetchOrders(options: {
    fromEnteredTime: Date;
    toEnteredTime: Date;
    maxResults?: number;
    status?: SchwabOrderStatus;
  }): Promise<{ accountNumber: string; orders: SchwabOrder[] }[]> {
    const accountHashes = await this.fetchAccountNumbers();
    const ordersPerAccount = await Promise.all(
      accountHashes.map(({ hashValue }) =>
        this.fetchAccountOrders(hashValue, options),
      ),
    );
    return accountHashes.map((account, index) => ({
      accountNumber: account.accountNumber,
      orders: ordersPerAccount[index] ?? [],
    }));
  }

  async fetchAccountOrders(
    accountHash: string,
    options: {
      fromEnteredTime: Date;
      toEnteredTime: Date;
      maxResults?: number;
      status?: SchwabOrderStatus;
    },
  ): Promise<SchwabOrder[]> {
    if (!accountHash) {
      throw new Error("Account hash is required to fetch orders");
    }
    // Use toISOString() to properly convert local time to UTC with Z suffix
    const formattedFromTime = options.fromEnteredTime.toISOString();
    const formattedToTime = options.toEnteredTime.toISOString();
    const params = new URLSearchParams({
      fromEnteredTime: formattedFromTime,
      toEnteredTime: formattedToTime,
    });
    if (options.maxResults) {
      params.append("maxResults", String(options.maxResults));
    }
    if (options.status) {
      params.append("status", options.status);
    }
    return await this.makeApiRequest<SchwabOrder[]>(
      `/trader/v1/accounts/${accountHash}/orders?${params.toString()}`,
    );
  }

  /**
   * Place an order for a specific account.
   * Returns the order ID from the Location header on success.
   */
  async placeOrder(
    accountHash: string,
    order: SchwabOrderRequest,
  ): Promise<{ orderId: string }> {
    if (!accountHash) {
      throw new Error("Account hash is required to place an order");
    }
    const url = `${SCHWAB_API_BASE_URL}/trader/v1/accounts/${accountHash}/orders`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(order),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Failed to place order: ${String(response.status)} ${
          response.statusText
        } - ${errorBody}`,
      );
    }

    // Schwab returns 201 Created with Location header containing the order URL
    const locationHeader = response.headers.get("Location");
    const orderId = locationHeader?.split("/").pop() ?? "unknown";

    return { orderId };
  }

  async getUserPreference(): Promise<SchwabUserPreference> {
    return await this.makeApiRequest<SchwabUserPreference>(
      "/trader/v1/userPreference",
    );
  }

  /**
   * Search for instruments by symbol or description.
   * @param symbol - The search term (symbol or description fragment)
   * @param projection - The type of search to perform
   * @returns Array of matching instruments
   */
  async searchInstruments(
    symbol: string,
    projection: SchwabInstrumentSearchProjection,
  ): Promise<SchwabInstrumentResponse[]> {
    const params = new URLSearchParams({
      symbol: symbol,
      projection: projection,
    });
    const response = await this.makeApiRequest<{
      instruments?: Record<string, SchwabInstrumentResponse>;
    }>(`/marketdata/v1/instruments?${params.toString()}`);
    // The API returns instruments as an object keyed by symbol, convert to array
    return Object.values(response.instruments ?? {});
  }

  /**
   * Get top 10 movers for a specific index.
   * @param symbolId - Index symbol ($DJI, $COMPX, $SPX, NYSE, NASDAQ, etc.)
   * @param sort - Sort by VOLUME, TRADES, PERCENT_CHANGE_UP, or PERCENT_CHANGE_DOWN
   * @param frequency - Frequency in minutes (0, 1, 5, 10, 30, 60). Default is 0.
   * @returns List of top movers
   */
  async getMovers(
    symbolId: SchwabMoversIndexSymbol,
    sort?: SchwabMoversSort,
    frequency?: SchwabMoversFrequency,
  ): Promise<SchwabMoversResponse> {
    const params = new URLSearchParams();
    if (sort) {
      params.append("sort", sort);
    }
    if (frequency !== undefined) {
      params.append("frequency", String(frequency));
    }
    const queryString = params.toString();
    const url = `/marketdata/v1/movers/${encodeURIComponent(symbolId)}${
      queryString ? `?${queryString}` : ""
    }`;
    return await this.makeApiRequest<SchwabMoversResponse>(url);
  }

  private headersToRecord(
    headers: RequestInit["headers"],
  ): Record<string, string> {
    const result: Record<string, string> = {};
    if (!headers) return result;

    if (headers instanceof Headers) {
      headers.forEach((value, key) => {
        result[key] = value;
      });
    } else if (Array.isArray(headers)) {
      for (const [k, v] of headers) {
        if (k && v) {
          result[k] = v;
        }
      }
    } else {
      Object.assign(result, headers);
    }
    return result;
  }

  private async makeApiRequest<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const existingHeaders = this.headersToRecord(options.headers);
    const normalizedEndpoint = endpoint.startsWith("/")
      ? endpoint.slice(1)
      : endpoint;
    const url = `${SCHWAB_API_BASE_URL}/${normalizedEndpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...existingHeaders,
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error(
          "Unauthorized - access token may be expired or invalid",
        );
      }
      throw new Error(`Failed to fetch ${endpoint}: ${response.statusText}`);
    }
    const responseBody = await response.json();
    return responseBody as T;
  }
}
