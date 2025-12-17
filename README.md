# @huskly/schwab-client

A TypeScript client library for the Schwab Market Data and Trading API.

## Installation

```bash
npm install @huskly/schwab-client
```

## Requirements

- Node.js >= 20.0.0
- A valid Schwab API access token

## Usage

```typescript
import { SchwabClient } from '@huskly/schwab-client';

const client = new SchwabClient('your-access-token');
```

### Market Data

#### Get Quotes

```typescript
const quotes = await client.getQuotes(['AAPL', 'GOOGL', 'MSFT']);
console.log(quotes['AAPL'].quote.lastPrice);
```

#### Get Price History

```typescript
// Last 30 days
const history = await client.getPriceHistory({ symbol: 'AAPL', days: 30 });

// Custom date range
const history = await client.getPriceHistory({
  symbol: 'AAPL',
  startDate: Date.parse('2024-01-01'),
  endDate: Date.now(),
});
```

#### Get VIX Level

```typescript
const vix = await client.getVixLevel();
console.log(`VIX: ${vix}`);
```

#### Search Instruments

```typescript
const results = await client.searchInstruments('AAPL', 'symbol-search');
```

#### Get Market Movers

```typescript
const movers = await client.getMovers('$SPX', 'PERCENT_CHANGE_UP');
console.log(movers.screeners);
```

### Options

#### Get Available Expiries

```typescript
const expiries = await client.getAvailableExpiries(
  'SPY',
  'CALL',
  '2025-01-01',
  '2025-06-30'
);
```

#### Get Option Chain

```typescript
const chain = await client.getOptionChain('SPY', new Date('2025-01-17'));
for (const option of chain) {
  console.log(`${option.symbol}: ${option.strike} ${option.isCall ? 'C' : 'P'} @ ${option.mid}`);
}
```

#### Get Single Option Quote

```typescript
const option = await client.getOptionQuote({
  symbol: 'SPY',
  expiry: new Date('2025-01-17'),
  strike: 600,
  type: 'call',
});
```

### Account

#### Get Account Balances

```typescript
const balances = await client.getAccountBalances();
console.log(`Equity: $${balances.equity}`);
console.log(`Buying Power: $${balances.buyingPower}`);
console.log(`Cash: $${balances.cashBalance}`);
```

#### Get Positions

```typescript
// All positions
const positions = await client.getPositions();

// Filter by symbol
const applePositions = await client.getPositions('AAPL');
```

#### Get Account Numbers

```typescript
const accounts = await client.fetchAccountNumbers();
for (const account of accounts) {
  console.log(`Account: ${account.accountNumber}, Hash: ${account.hashValue}`);
}
```

#### Get Transaction History

```typescript
const history = await client.fetchTransactionHistory(
  new Date('2024-01-01'),
  new Date()
);
```

#### Get User Preferences

```typescript
const prefs = await client.getUserPreference();
console.log(prefs.streamerInfo.streamerSocketUrl);
```

### Orders

#### Fetch Orders

```typescript
const orders = await client.fetchOrders({
  fromEnteredTime: new Date('2024-01-01'),
  toEnteredTime: new Date(),
  status: 'FILLED', // Optional filter
  maxResults: 100,  // Optional limit
});
```

#### Place an Order

```typescript
import type { SchwabOrderRequest } from '@huskly/schwab-client';

const order: SchwabOrderRequest = {
  session: 'NORMAL',
  duration: 'DAY',
  orderType: 'LIMIT',
  orderStrategyType: 'SINGLE',
  price: 150.00,
  orderLegCollection: [
    {
      instruction: 'BUY',
      quantity: 10,
      instrument: {
        assetType: 'EQUITY',
        symbol: 'AAPL',
      },
    },
  ],
};

const accounts = await client.fetchAccountNumbers();
const { orderId } = await client.placeOrder(accounts[0].hashValue, order);
console.log(`Order placed: ${orderId}`);
```

### Utilities

#### Get Risk-Free Rate

```typescript
const rate = await client.getRiskFreeRate(new Date());
// Returns 0.02 (2%)
```

#### Get Current Date

```typescript
const today = client.today();
```

## API Reference

### Market Data Methods

| Method | Description |
|--------|-------------|
| `getQuotes(symbols)` | Get real-time quotes for multiple symbols |
| `getPriceHistory(args)` | Get historical price data |
| `getVixLevel()` | Get current VIX index level |
| `getAvailableExpiries(symbol, contractType, fromDate, toDate)` | Get available option expiration dates |
| `getOptionChain(symbol, expiry)` | Get full options chain for a symbol and expiry |
| `getOptionQuote(args)` | Get quote for a specific option contract |
| `searchInstruments(symbol, projection)` | Search for instruments |
| `getMovers(symbolId, sort?, frequency?)` | Get top market movers |

### Account Methods

| Method | Description |
|--------|-------------|
| `getAccountEquity()` | Get total account equity |
| `getAccountBalances()` | Get detailed account balances |
| `getPositions(symbol?)` | Get account positions |
| `getExistingSpreads(symbol)` | Get existing option spreads |
| `fetchAccountNumbers()` | Get all linked account numbers |
| `fetchTransactionHistory(startDate?, endDate?)` | Get transaction history |
| `getUserPreference()` | Get user preferences and streaming info |

### Order Methods

| Method | Description |
|--------|-------------|
| `fetchOrders(options)` | Get orders across all accounts |
| `fetchAccountOrders(accountHash, options)` | Get orders for specific account |
| `placeOrder(accountHash, order)` | Place a new order |

## Types

All types are exported from the package:

```typescript
import type {
  SchwabQuoteResponse,
  SchwabOrder,
  SchwabOrderRequest,
  SchwabPosition,
  OptionQuote,
  PriceHistoryCandle,
  // ... and many more
} from '@huskly/schwab-client';
```

## Error Handling

The client throws errors for failed API requests:

```typescript
try {
  const quotes = await client.getQuotes(['INVALID']);
} catch (error) {
  if (error.message.includes('Unauthorized')) {
    // Token expired or invalid
  }
}
```

## License

MIT
