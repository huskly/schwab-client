export interface SchwabAccountDetails {
  accountNumber: string;
  positions: SchwabAccountPosition[];
  liquidationValue: number;
  availableFunds: number;
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
export interface SchwabAccount {
  hashValue?: string;
  securitiesAccount: {
    accountNumber: string;
    hashValue?: string;
    positions: SchwabPosition[];
    currentBalances: {
      equity: number;
      availableFunds: number;
      buyingPower: number;
      cashBalance: number;
      liquidationValue: number;
    };
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
