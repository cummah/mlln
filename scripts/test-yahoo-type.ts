import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

async function testYahoo() {
  try {
    const quote = await yahooFinance.quote('SPY');
    console.log('SPY quoteType:', quote.quoteType);
    
    const quote2 = await yahooFinance.quote('AAPL');
    console.log('AAPL quoteType:', quote2.quoteType);

    const quote3 = await yahooFinance.quote('^VIX');
    console.log('^VIX quoteType:', quote3.quoteType);
  } catch (e) {
    console.error(e);
  }
}

testYahoo();
