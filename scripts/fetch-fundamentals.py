#!/usr/bin/env python3
"""
fetch-fundamentals.py

Fetches financial fundamentals for a ticker using yfinance
Returns JSON to stdout

Usage: python fetch-fundamentals.py TICKER
"""

import sys
import json
import yfinance as yf

def fetch_fundamentals(ticker: str) -> dict:
    try:
        stock = yf.Ticker(ticker)
        info = stock.info

        return {
            'ticker': ticker,
            'industry': info.get('industry'),
            'longBusinessSummary': info.get('longBusinessSummary'),
            'marketCap': info.get('marketCap'),
            'beta': info.get('beta'),
            'trailingPE': info.get('trailingPE'),
            'profitMargins': info.get('profitMargins'),
            'enterpriseValue': info.get('enterpriseValue'),
            'enterpriseToEbitda': info.get('enterpriseToEbitda'),
            'enterpriseToRevenue': info.get('enterpriseToRevenue'),
            'returnOnAssets': info.get('returnOnAssets'),
            'grossProfits': info.get('grossProfits'),
            'operatingCashflow': info.get('operatingCashflow'),
        }
    except Exception as e:
        return {
            'ticker': ticker,
            'error': str(e)
        }

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: python fetch-fundamentals.py TICKER'}))
        sys.exit(1)

    ticker = sys.argv[1]
    result = fetch_fundamentals(ticker)
    print(json.dumps(result))
