// ---- Quote types (from Schwab Market Data API) ----

export type SchwabQuoteAssetMainType =
  | "EQUITY"
  | "OPTION"
  | "INDEX"
  | "MUTUAL_FUND"
  | "FUTURE"
  | "FOREX";

export interface SchwabQuoteReference {
  cusip?: string;
  description: string;
  exchange: string;
  exchangeName: string;
  otcMarketTier?: string;
  // Option-specific fields
  contractType?: "C" | "P";
  daysToExpiration?: number;
  expirationDay?: number;
  expirationMonth?: number;
  expirationYear?: number;
  strikePrice?: number;
  underlying?: string;
  multiplier?: number;
}

export interface SchwabQuoteData {
  "52WeekHigh"?: number;
  "52WeekLow"?: number;
  askPrice?: number;
  askSize?: number;
  bidPrice?: number;
  bidSize?: number;
  closePrice?: number;
  highPrice?: number;
  lowPrice?: number;
  lastPrice?: number;
  lastSize?: number;
  mark?: number;
  markChange?: number;
  markPercentChange?: number;
  netChange?: number;
  netPercentChange?: number;
  openPrice?: number;
  totalVolume?: number;
  tradeTime?: number;
  quoteTime?: number;
  securityStatus?: string;
  volatility?: number;
  // Option Greeks
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  rho?: number;
  openInterest?: number;
  underlyingPrice?: number;
}

export interface SchwabQuoteRegular {
  regularMarketLastPrice?: number;
  regularMarketLastSize?: number;
  regularMarketNetChange?: number;
  regularMarketPercentChange?: number;
  regularMarketTradeTime?: number;
}

export interface SchwabQuoteFundamental {
  avg10DaysVolume?: number;
  avg1YearVolume?: number;
  divAmount?: number;
  divFreq?: number;
  divPayAmount?: number;
  divYield?: number;
  eps?: number;
  peRatio?: number;
  declarationDate?: string;
  divExDate?: string;
  divPayDate?: string;
}

export interface SchwabQuoteResponse {
  assetMainType: SchwabQuoteAssetMainType;
  assetSubType?: string;
  symbol: string;
  quoteType?: string;
  realtime: boolean;
  ssid: number;
  reference: SchwabQuoteReference;
  quote: SchwabQuoteData;
  regular?: SchwabQuoteRegular;
  fundamental?: SchwabQuoteFundamental;
}

export interface OptionQuote {
  symbol: string;
  expiry: Date;
  strike: number;
  isCall: boolean;
  bid: number | null;
  ask: number | null;
  mid: number; // (bid + ask) / 2, or whatever you define
  delta: number; // negative for puts
}

export interface ExistingSpread {
  underlying: string;
  expiry: Date;
  shortStrike: number;
  longStrike: number;
  credit: number; // entry credit, points
  quantity: number; // positive = short spread
  theoreticalMaxLossPts: number; // per spread
  plannedLossPts: number; // at stop (2x credit), per spread
}

export type ISODateTime = string;

// ---- Order-level enums ----

export type SchwabSession = "NORMAL" | "AM" | "PM" | "SEAMLESS";

export type SchwabDuration =
  | "DAY"
  | "GOOD_TILL_CANCEL"
  | "FILL_OR_KILL"
  | "IMMEDIATE_OR_CANCEL"
  | "END_OF_WEEK"
  | "END_OF_MONTH"
  | "NEXT_END_OF_MONTH"
  | "UNKNOWN";

export const ALL_SCHWAB_ORDER_TYPES = [
  "MARKET",
  "LIMIT",
  "STOP",
  "STOP_LIMIT",
  "TRAILING_STOP",
  "CABINET",
  "NON_MARKETABLE",
  "MARKET_ON_CLOSE",
  "EXERCISE",
  "TRAILING_STOP_LIMIT",
  "NET_DEBIT",
  "NET_CREDIT",
  "NET_ZERO",
  "LIMIT_ON_CLOSE",
  "UNKNOWN",
] as const;

export type SchwabOrderType = (typeof ALL_SCHWAB_ORDER_TYPES)[number];

export type SchwabComplexOrderStrategyType =
  | "NONE"
  | "COVERED"
  | "VERTICAL"
  | "BACK_RATIO"
  | "CALENDAR"
  | "DIAGONAL"
  | "STRADDLE"
  | "STRANGLE"
  | "COLLAR_SYNTHETIC"
  | "BUTTERFLY"
  | "CONDOR"
  | "IRON_CONDOR"
  | "VERTICAL_ROLL"
  | "COLLAR_WITH_STOCK"
  | "DOUBLE_DIAGONAL"
  | "UNBALANCED_BUTTERFLY"
  | "UNBALANCED_CONDOR"
  | "UNBALANCED_IRON_CONDOR"
  | "UNBALANCED_VERTICAL_ROLL"
  | "MUTUAL_FUND_SWAP"
  | "CUSTOM";

export type SchwabRequestedDestination =
  | "INET"
  | "ECN_ARCA"
  | "CBOE"
  | "AMEX"
  | "PHLX"
  | "ISE"
  | "BOX"
  | "NYSE"
  | "NASDAQ"
  | "BATS"
  | "C2"
  | "AUTO";

export type SchwabLinkBasis =
  | "MANUAL"
  | "BASE"
  | "TRIGGER"
  | "LAST"
  | "BID"
  | "ASK"
  | "ASK_BID"
  | "MARK"
  | "AVERAGE";

export type SchwabLinkType = "VALUE" | "PERCENT" | "TICK";

export type SchwabStopType = "STANDARD" | "BID" | "ASK" | "LAST" | "MARK";

export type SchwabPriceLinkBasis = "STANDARD" | "BID" | "ASK" | "LAST" | "MARK";

export type SchwabTaxLotMethod =
  | "FIFO"
  | "LIFO"
  | "HIGH_COST"
  | "LOW_COST"
  | "AVERAGE_COST"
  | "SPECIFIC_LOT"
  | "UNKNOWN"
  | (string & {});

// ---- Legs / instructions ----

export type SchwabOrderLegType =
  | "EQUITY"
  | "OPTION"
  | "INDEX"
  | "MUTUAL_FUND"
  | "CASH_EQUIVALENT"
  | "FIXED_INCOME"
  | "CURRENCY"
  | "COLLECTIVE_INVESTMENT";

export const ALL_SCHWAB_INSTRUCTIONS = [
  "BUY",
  "SELL",
  "BUY_TO_COVER",
  "SELL_SHORT",
  "BUY_TO_OPEN",
  "BUY_TO_CLOSE",
  "SELL_TO_OPEN",
  "SELL_TO_CLOSE",
  "EXCHANGE",
  "SELL_SHORT_EXEMPT",
] as const;

export type SchwabInstruction = (typeof ALL_SCHWAB_INSTRUCTIONS)[number];

export type SchwabPositionEffect = "OPENING" | "CLOSING" | "AUTOMATIC";

export type SchwabQuantityType = "ALL_SHARES" | "DOLLARS" | "SHARES";

export type SchwabDivCapGains = "REINVEST" | "PAYOUT";

// ---- Special instructions / strategy / status ----

export type SchwabSpecialInstruction =
  | "ALL_OR_NONE"
  | "DO_NOT_REDUCE"
  | "ALL_OR_NONE_DO_NOT_REDUCE";

export type SchwabOrderStrategyType =
  | "SINGLE"
  | "CANCEL"
  | "RECALL"
  | "PAIR"
  | "FLATTEN"
  | "TWO_DAY_SWAP"
  | "BLAST_ALL"
  | "OCO"
  | "TRIGGER";

export type SchwabOrderStatus =
  | "AWAITING_PARENT_ORDER"
  | "AWAITING_CONDITION"
  | "AWAITING_STOP_CONDITION"
  | "AWAITING_MANUAL_REVIEW"
  | "ACCEPTED"
  | "AWAITING_UR_OUT"
  | "PENDING_ACTIVATION"
  | "QUEUED"
  | "WORKING"
  | "REJECTED"
  | "PENDING_CANCEL"
  | "CANCELED"
  | "PENDING_REPLACE"
  | "REPLACED"
  | "FILLED"
  | "EXPIRED"
  | "NEW"
  | "AWAITING_RELEASE_TIME"
  | "PENDING_ACKNOWLEDGEMENT"
  | "PENDING_RECALL"
  | "UNKNOWN";

// ---- Instrument model (AccountsInstrument oneOf ...) ----

export type SchwabAssetType =
  | "EQUITY"
  | "OPTION"
  | "INDEX"
  | "MUTUAL_FUND"
  | "CASH_EQUIVALENT"
  | "FIXED_INCOME"
  | "CURRENCY"
  | "COLLECTIVE_INVESTMENT";

export interface SchwabAccountBaseInstrument {
  assetType: SchwabAssetType;
  cusip?: string;
  symbol?: string;
  description?: string;
  instrumentId?: number;
  netChange?: number;
}

export type SchwabCashEquivalentType =
  | "SWEEP_VEHICLE"
  | "SAVINGS"
  | "MONEY_MARKET_FUND"
  | "UNKNOWN";

export interface SchwabAccountCashEquivalent extends SchwabAccountBaseInstrument {
  assetType: SchwabAssetType;
  type?: SchwabCashEquivalentType;
}

export interface SchwabAccountEquity extends SchwabAccountBaseInstrument {
  assetType: SchwabAssetType;
}

export interface SchwabAccountFixedIncome extends SchwabAccountBaseInstrument {
  assetType: SchwabAssetType;
  maturityDate?: ISODateTime;
  factor?: number;
  variableRate?: number;
}

export interface SchwabAccountMutualFund extends SchwabAccountBaseInstrument {
  assetType: SchwabAssetType;
}

export type SchwabApiCurrencyType = "USD" | "CAD" | "EUR" | "JPY";

export type SchwabDeliverableAssetType =
  | "EQUITY"
  | "MUTUAL_FUND"
  | "OPTION"
  | "FUTURE"
  | "FOREX"
  | "INDEX"
  | "CASH_EQUIVALENT"
  | "FIXED_INCOME"
  | "PRODUCT"
  | "CURRENCY"
  | "COLLECTIVE_INVESTMENT";

export type SchwabPutCall = "PUT" | "CALL" | "UNKNOWN";

export type SchwabOptionType = "VANILLA" | "BINARY" | "BARRIER" | "UNKNOWN";

export interface SchwabAccountApiOptionDeliverable {
  symbol?: string;
  deliverableUnits?: number;
  apiCurrencyType?: SchwabApiCurrencyType;
  assetType?: SchwabDeliverableAssetType;
  putCall?: SchwabPutCall;
  optionMultiplier?: number;
  type?: SchwabOptionType;
  underlyingSymbol?: string;
}

export interface SchwabAccountOption extends SchwabAccountBaseInstrument {
  assetType: SchwabAssetType;
  optionDeliverables?: SchwabAccountApiOptionDeliverable[];
}

export type SchwabAccountsInstrument =
  | SchwabAccountCashEquivalent
  | SchwabAccountEquity
  | SchwabAccountFixedIncome
  | SchwabAccountMutualFund
  | SchwabAccountOption;

// ---- Order sub-objects ----

export interface SchwabOrderLeg {
  orderLegType?: SchwabOrderLegType;
  legId?: number;
  instrument?: SchwabAccountsInstrument;
  instruction?: SchwabInstruction;
  positionEffect?: SchwabPositionEffect;
  quantity?: number;
  quantityType?: SchwabQuantityType;
  divCapGains?: SchwabDivCapGains;
  toSymbol?: string;
}

export type SchwabOrderActivityType = "EXECUTION" | "ORDER_ACTION";
export type SchwabExecutionType = "FILL";

export interface SchwabExecutionLeg {
  legId?: number;
  price?: number;
  quantity?: number;
  mismarkedQuantity?: number;
  instrumentId?: number;
  time?: ISODateTime;
}

export interface SchwabOrderActivity {
  activityType?: SchwabOrderActivityType;
  executionType?: SchwabExecutionType;
  quantity?: number;
  orderRemainingQuantity?: number;
  executionLegs?: SchwabExecutionLeg[];
}

// ---- Main Order ----

export interface SchwabOrder {
  session?: SchwabSession;
  duration?: SchwabDuration;
  orderType?: SchwabOrderType;
  cancelTime?: ISODateTime;
  complexOrderStrategyType?: SchwabComplexOrderStrategyType;
  quantity?: number;
  filledQuantity?: number;
  remainingQuantity?: number;
  requestedDestination?: SchwabRequestedDestination;
  destinationLinkName?: string;
  releaseTime?: ISODateTime;
  stopPrice?: number;
  stopPriceLinkBasis?: SchwabLinkBasis;
  stopPriceLinkType?: SchwabLinkType;
  stopPriceOffset?: number;
  stopType?: SchwabStopType;
  priceLinkBasis?: SchwabPriceLinkBasis;
  priceLinkType?: SchwabLinkType;
  price?: number;
  taxLotMethod?: SchwabTaxLotMethod;
  orderLegCollection?: SchwabOrderLeg[];
  activationPrice?: number;
  specialInstruction?: SchwabSpecialInstruction;
  orderStrategyType?: SchwabOrderStrategyType;
  orderId?: number;
  cancelable?: boolean;
  editable?: boolean;
  status?: SchwabOrderStatus;
  enteredTime?: ISODateTime;
  closeTime?: ISODateTime;
  tag?: string;
  accountNumber?: number;
  orderActivityCollection?: SchwabOrderActivity[];
  replacingOrderCollection?: (SchwabOrder | string)[];
  childOrderStrategies?: (SchwabOrder | string)[];
  statusDescription?: string;
}

export type SchwabOrdersResponse = SchwabOrder[];

// ---- Instrument Search types ----

export type SchwabInstrumentSearchProjection =
  | "symbol-search"
  | "symbol-regex"
  | "desc-search"
  | "desc-regex"
  | "search"
  | "fundamental";

export type SchwabInstrumentAssetType =
  | "BOND"
  | "EQUITY"
  | "ETF"
  | "EXTENDED"
  | "FOREX"
  | "FUTURE"
  | "FUTURE_OPTION"
  | "FUNDAMENTAL"
  | "INDEX"
  | "INDICATOR"
  | "MUTUAL_FUND"
  | "OPTION"
  | "UNKNOWN";

export interface SchwabFundamentalInstrument {
  symbol?: string;
  high52?: number;
  low52?: number;
  dividendAmount?: number;
  dividendYield?: number;
  dividendDate?: string;
  peRatio?: number;
  pegRatio?: number;
  pbRatio?: number;
  prRatio?: number;
  pcfRatio?: number;
  grossMarginTTM?: number;
  grossMarginMRQ?: number;
  netProfitMarginTTM?: number;
  netProfitMarginMRQ?: number;
  operatingMarginTTM?: number;
  operatingMarginMRQ?: number;
  returnOnEquity?: number;
  returnOnAssets?: number;
  returnOnInvestment?: number;
  quickRatio?: number;
  currentRatio?: number;
  interestCoverage?: number;
  totalDebtToCapital?: number;
  ltDebtToEquity?: number;
  totalDebtToEquity?: number;
  epsTTM?: number;
  epsChangePercentTTM?: number;
  epsChangeYear?: number;
  epsChange?: number;
  revChangeYear?: number;
  revChangeTTM?: number;
  revChangeIn?: number;
  sharesOutstanding?: number;
  marketCapFloat?: number;
  marketCap?: number;
  bookValuePerShare?: number;
  shortIntToFloat?: number;
  shortIntDayToCover?: number;
  divGrowthRate3Year?: number;
  dividendPayAmount?: number;
  dividendPayDate?: string;
  beta?: number;
  vol1DayAvg?: number;
  vol10DayAvg?: number;
  vol3MonthAvg?: number;
  avg10DaysVolume?: number;
  avg1DayVolume?: number;
  avg3MonthVolume?: number;
  declarationDate?: string;
  dividendFreq?: number;
  eps?: number;
  dtnVolume?: number;
  nextDividendPayDate?: string;
  nextDividendDate?: string;
  fundLeverageFactor?: number;
  fundStrategy?: string;
}

export interface SchwabBasicInstrument {
  cusip?: string;
  symbol?: string;
  description?: string;
  exchange?: string;
  assetType?: SchwabInstrumentAssetType;
}

export interface SchwabBondInstrument {
  cusip?: string;
  symbol?: string;
  description?: string;
  exchange?: string;
  assetType?: SchwabInstrumentAssetType;
  bondFactor?: number;
  bondMultiplier?: number;
  bondPrice?: number;
}

export interface SchwabInstrumentResponse {
  cusip?: string;
  symbol?: string;
  description?: string;
  exchange?: string;
  assetType?: SchwabInstrumentAssetType;
  bondFactor?: string;
  bondMultiplier?: string;
  bondPrice?: string;
  fundamental?: SchwabFundamentalInstrument;
  instrumentInfo?: SchwabBasicInstrument;
  bondInstrumentInfo?: SchwabBondInstrument;
}

export interface SchwabInstrumentSearchResponse {
  instruments?: SchwabInstrumentResponse[];
}

// ---- Movers API types ----

export type SchwabMoversIndexSymbol =
  | "$DJI"
  | "$COMPX"
  | "$SPX"
  | "NYSE"
  | "NASDAQ"
  | "OTCBB"
  | "INDEX_ALL"
  | "EQUITY_ALL"
  | "OPTION_ALL"
  | "OPTION_PUT"
  | "OPTION_CALL";

export type SchwabMoversSort = "VOLUME" | "TRADES" | "PERCENT_CHANGE_UP" | "PERCENT_CHANGE_DOWN";

export type SchwabMoversFrequency = 0 | 1 | 5 | 10 | 30 | 60;

export type SchwabMoversDirection = "up" | "down";

export interface SchwabMover {
  change?: number;
  description?: string;
  direction?: SchwabMoversDirection;
  lastPrice?: number;
  netChange?: number;
  netPercentChange?: number;
  symbol?: string;
  totalVolume?: number;
  volume?: number;
}

export interface SchwabMoversResponse {
  screeners?: SchwabMover[];
}

// ---- Order Request (for placing orders) ----

export interface SchwabOrderRequestInstrument {
  assetType: SchwabAssetType;
  symbol: string;
}

export interface SchwabOrderRequestLeg {
  instruction: SchwabInstruction;
  quantity: number;
  instrument: SchwabOrderRequestInstrument;
}

export interface SchwabOrderRequest {
  session: SchwabSession;
  duration: SchwabDuration;
  orderType: SchwabOrderType;
  orderStrategyType: SchwabOrderStrategyType;
  price?: number;
  stopPrice?: number;
  stopPriceLinkBasis?: SchwabLinkBasis;
  stopPriceLinkType?: SchwabLinkType;
  stopPriceOffset?: number;
  stopType?: SchwabStopType;
  orderLegCollection: SchwabOrderRequestLeg[];
}

// ---- Price History types ----

export interface PriceHistoryCandle {
  datetime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PriceHistoryResponse {
  candles: PriceHistoryCandle[];
  empty: boolean;
}
