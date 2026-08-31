export interface SchwabAccountDetails {
  accountNumber: string;
  positions: SchwabAccountPosition[];
  liquidationValue: number;
  availableFunds: number;
  marginBalance: number;
  buyingPower: number;
  cashBalance: number;
}

export interface SchwabAccountPosition {
  symbol: string;
  name: string;
  amount: number;
  averageTradePriceUsd: string;
  // market value (mark price * amount)
  value: number;
  // mark price
  mark: string;
  changePercent24Hr: string;
  id: string;
  type: "stock" | "option";
}

// Raw API types
export interface SchwabCurrentBalances {
  availableFunds: number;
  availableFundsNonMarginableTrade: number;
  buyingPower: number;
  buyingPowerNonMarginableTrade: number;
  dayTradingBuyingPower: number;
  dayTradingBuyingPowerCall: number;
  equity: number;
  equityPercentage: number;
  longMarginValue: number;
  maintenanceCall: number;
  maintenanceRequirement: number;
  marginBalance: number;
  regTCall: number;
  shortBalance: number;
  shortMarginValue: number;
  sma: number;
  isInCall: number;
  stockBuyingPower: number;
  optionBuyingPower: number;
  cashBalance: number;
  liquidationValue: number;
}

export interface SchwabAccount {
  hashValue?: string;
  securitiesAccount: {
    accountNumber: string;
    hashValue?: string;
    positions: SchwabPosition[];
    currentBalances: SchwabCurrentBalances;
  };
}

export interface SchwabPosition {
  shortQuantity: number;
  longQuantity: number;
  averagePrice: number;
  currentDayProfitLoss: number;
  currentDayProfitLossPercentage: number;
  settledLongQuantity: number;
  settledShortQuantity: number;
  agedQuantity: number;
  maintenanceRequirement: number;
  averageLongPrice: number;
  averageShortPrice: number;
  taxLotAverageLongPrice: number;
  taxLotAverageShortPrice: number;
  longOpenProfitLoss: number;
  shortOpenProfitLoss: number;
  previousSessionLongQuantity: number;
  previousSessionShortQuantity: number;
  currentDayCost: number;
  instrument: {
    assetType: string;
    cusip: string;
    symbol: string;
    underlyingSymbol?: string;
    description: string;
    instrumentId: number;
    netChange?: number;
    type: string;
  };
  marketValue: number;
}

export interface SchwabInstrument {
  symbol?: string;
  description?: string;
  assetType?: string;
  type?: string;
}

export interface SchwabTransferItem {
  instrument?: SchwabInstrument;
  amount?: number;
  cost?: number;
  fee?: number;
  feeType?: string;
  price?: number;
  quantity?: number;
  transferItemType?: string;
  positionEffect?: string;
  transactionId?: number;
}

export interface SchwabTransaction {
  activityId: number;
  time: string;
  accountNumber: string;
  type: string;
  status: string;
  subAccount: string;
  tradeDate: string;
  positionId: number;
  orderId: number;
  netAmount: number;
  description?: string;
  transferItems?: SchwabTransferItem[];
}

export interface SchwabAccountTransactionHistory {
  accountNumber: string;
  transactions: SchwabTransaction[];
}

// User Preference types
export interface SchwabUserPreferenceAccount {
  accountNumber: string;
  primaryAccount: boolean;
  type: string;
  nickName: string;
  accountColor: string;
  displayAcctId: string;
  autoPositionEffect: boolean;
}

export interface SchwabStreamerInfo {
  streamerSocketUrl: string;
  schwabClientCustomerId: string;
  schwabClientCorrelId: string;
  schwabClientChannel: string;
  schwabClientFunctionId: string;
}

export interface SchwabOffer {
  level2Permissions: boolean;
  mktDataPermission: string;
}

export interface SchwabUserPreference {
  accounts: SchwabUserPreferenceAccount[];
  streamerInfo: SchwabStreamerInfo;
  offers: SchwabOffer[];
}

// Exact option contract evidence types (huskly/schwab-client#67).
//
// These interfaces carry raw Schwab option-chain evidence for one exact
// contract. Every optional field is `null` when the broker did not supply it;
// no value is inferred. `settlementType` is a broker classification string and
// does not by itself state physical-versus-cash deliverability.
export interface SchwabOptionDeliverableEvidence {
  symbol: string;
  assetType: string;
  deliverableUnits: string | number;
  currencyType: string | null;
}

// Account settlement evidence (huskly/strategy-terminal#1026).
//
// One observation of a single Schwab account's raw balance evidence. Every
// field the broker may omit is `null` when it was absent, non-finite, or of
// the wrong type; no value is inferred or defaulted. Schwab sends no currency
// and no observation time on this payload, so `currency` is `null` unless the
// broker itself supplies it, and `observedAtEpochMillis` is minted by the
// client clock. `presentBalanceFieldNames` lists the key NAMES present on the
// raw `currentBalances` object, never their values, so an operator can confirm
// the live schema without exposing amounts.
export interface SchwabAccountSettlementEvidence {
  accountNumber: string;
  accountType: string | null;
  cashBalance: number;
  unsettledCash: number | null;
  cashAvailableForTrading: number | null;
  cashAvailableForWithdrawal: number | null;
  availableFunds: number;
  optionBuyingPower: number;
  marginBalance: number;
  longMarginValue: number;
  currency: string | null;
  observedAtEpochMillis: number;
  presentBalanceFieldNames: string[];
}

export interface SchwabOptionContractEvidence {
  chainSymbol: string;
  underlyingSymbol: string | null;
  underlyingIsIndex: boolean | null;
  optionSymbol: string;
  optionRoot: string | null;
  putCall: "PUT" | "CALL";
  strikePrice: number;
  expirationDate: string;
  isIndexOption: boolean | null;
  isNonStandard: boolean | null;
  isMini: boolean | null;
  optionDeliverablesList: SchwabOptionDeliverableEvidence[] | null;
  multiplier: number | null;
  settlementType: string | null;
  expirationType: string | null;
  deliverableNote: string | null;
  quoteTimeInLong: number | null;
  tradeTimeInLong: number | null;
  isDelayed: boolean | null;
}
