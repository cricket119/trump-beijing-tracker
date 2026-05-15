#!/usr/bin/env python3
"""
Fetch news and stock data for Trump Beijing visit tracker.
Runs every 4 hours via GitHub Actions.
"""

import feedparser
import json
import os
import hashlib
import time
import re
from datetime import datetime, timezone
import requests

# ==================== CONFIGURATION ====================

TRUMP_KW = ['trump', '特朗普', 'donald trump']
CHINA_KW  = ['china', 'chinese', 'beijing', 'xi jinping', 'xi',
              '中国', '北京', '习近平', '中美', '访华']

RSS_SOURCES = [
    {'name': 'Reuters',        'url': 'https://feeds.reuters.com/reuters/worldNews',              'lang': 'en', 'color': '#FF8C00', 'category': 'international'},
    {'name': 'Reuters Business','url': 'https://feeds.reuters.com/reuters/businessNews',           'lang': 'en', 'color': '#FF8C00', 'category': 'business'},
    {'name': 'BBC',            'url': 'https://feeds.bbci.co.uk/news/world/rss.xml',              'lang': 'en', 'color': '#BB1919', 'category': 'international'},
    {'name': 'Al Jazeera',     'url': 'https://www.aljazeera.com/xml/rss/all.xml',                'lang': 'en', 'color': '#009B77', 'category': 'international'},
    {'name': '联合早报',        'url': 'https://www.zaobao.com.sg/rss/realtime/china',             'lang': 'zh', 'color': '#C41E3A', 'category': 'chinese'},
    {'name': '联合早报综合',    'url': 'https://www.zaobao.com.sg/rss/china',                      'lang': 'zh', 'color': '#C41E3A', 'category': 'chinese'},
    {'name': 'SCMP',           'url': 'https://www.scmp.com/rss/2/feed',                          'lang': 'en', 'color': '#003580', 'category': 'asia'},
    {'name': 'NYT',            'url': 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',   'lang': 'en', 'color': '#444444', 'category': 'international'},
    {'name': 'Financial Times','url': 'https://www.ft.com/world?format=rss',                      'lang': 'en', 'color': '#C7A000', 'category': 'business'},
    {'name': 'Bloomberg',      'url': 'https://feeds.bloomberg.com/markets/news.rss',             'lang': 'en', 'color': '#1976D2', 'category': 'business'},
    {'name': 'Global Times',   'url': 'https://www.globaltimes.cn/rss/outbrain.xml',              'lang': 'en', 'color': '#CC0000', 'category': 'chinese_official'},
    {'name': 'Xinhua',         'url': 'http://www.xinhuanet.com/english/rss/worldrss.xml',        'lang': 'en', 'color': '#CC0000', 'category': 'chinese_official'},
    {'name': 'CNBC',           'url': 'https://www.cnbc.com/id/100727362/device/rss/rss.html',    'lang': 'en', 'color': '#005594', 'category': 'business'},
    {'name': 'WSJ',            'url': 'https://feeds.a.dj.com/rss/RSSWorldNews.xml',              'lang': 'en', 'color': '#333333', 'category': 'business'},
    {'name': 'Nikkei Asia',    'url': 'https://asia.nikkei.com/rss/feed/nar',                     'lang': 'en', 'color': '#E60012', 'category': 'asia'},
]

# Companies in Trump's delegation – adjust as confirmed reports emerge
DELEGATION_STOCKS = [
    {'symbol': 'TSLA', 'name': 'Tesla',          'person': 'Elon Musk',        'role': 'CEO & Special Adviser'},
    {'symbol': 'AAPL', 'name': 'Apple',          'person': 'Tim Cook',         'role': 'CEO'},
    {'symbol': 'JPM',  'name': 'JPMorgan Chase', 'person': 'Jamie Dimon',      'role': 'CEO'},
    {'symbol': 'BLK',  'name': 'BlackRock',      'person': 'Larry Fink',       'role': 'CEO'},
    {'symbol': 'GS',   'name': 'Goldman Sachs',  'person': 'David Solomon',    'role': 'CEO'},
    {'symbol': 'NVDA', 'name': 'Nvidia',         'person': 'Jensen Huang',     'role': 'CEO'},
    {'symbol': 'META', 'name': 'Meta',           'person': 'Mark Zuckerberg',  'role': 'CEO'},
    {'symbol': 'QCOM', 'name': 'Qualcomm',       'person': 'Cristiano Amon',   'role': 'CEO'},
    {'symbol': 'BA',   'name': 'Boeing',         'person': 'Kelly Ortberg',    'role': 'CEO'},
    {'symbol': 'XOM',  'name': 'ExxonMobil',     'person': 'Darren Woods',     'role': 'CEO'},
    {'symbol': 'AMZN', 'name': 'Amazon',         'person': 'Andy Jassy',       'role': 'CEO'},
    {'symbol': 'MSFT', 'name': 'Microsoft',      'person': 'Satya Nadella',    'role': 'CEO'},
]

MARKET_INDICES = [
    {'symbol': '^GSPC',    'name': 'S&P 500',  'region': 'US'},
    {'symbol': '^DJI',     'name': 'Dow Jones', 'region': 'US'},
    {'symbol': '^IXIC',    'name': 'Nasdaq',    'region': 'US'},
    {'symbol': '000001.SS','name': '上证综指',  'region': 'CN'},
    {'symbol': '000300.SS','name': '沪深300',   'region': 'CN'},
    {'symbol': '^HSI',     'name': '恒生指数',  'region': 'HK'},
    {'symbol': 'CNY=X',    'name': 'USD/CNY',   'region': 'FX'},
]

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; TrumpChinaTracker/1.0; +https://github.com)'}

# ==================== NEWS FETCHING ====================

def is_relevant(title: str, summary: str = '') -> bool:
    text = (title + ' ' + summary).lower()
    has_trump = any(kw in text for kw in TRUMP_KW)
    has_china = any(kw in text for kw in CHINA_KW)
    return has_trump and has_china

def clean_html(text: str) -> str:
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&lt;', '<', text)
    text = re.sub(r'&gt;', '>', text)
    text = re.sub(r'&quot;', '"', text)
    text = re.sub(r'&#\d+;', '', text)
    return text.strip()

def parse_date(entry) -> str:
    for field in ('published_parsed', 'updated_parsed', 'created_parsed'):
        t = getattr(entry, field, None)
        if t:
            try:
                return datetime(*t[:6], tzinfo=timezone.utc).isoformat()
            except Exception:
                pass
    return datetime.now(timezone.utc).isoformat()

def article_id(link: str, title: str) -> str:
    return hashlib.md5((link + title).encode()).hexdigest()[:12]

def fetch_feed(source: dict) -> list:
    articles = []
    try:
        feed = feedparser.parse(source['url'], request_headers=HEADERS)
        for entry in feed.entries[:40]:
            title   = clean_html(getattr(entry, 'title', ''))
            summary = clean_html(getattr(entry, 'summary', '') or getattr(entry, 'description', ''))[:600]
            link    = getattr(entry, 'link', '')
            if not is_relevant(title, summary):
                continue
            articles.append({
                'id':              article_id(link, title),
                'title':           title,
                'summary':         summary,
                'link':            link,
                'published':       parse_date(entry),
                'source':          source['name'],
                'source_color':    source['color'],
                'source_lang':     source['lang'],
                'source_category': source.get('category', 'international'),
            })
    except Exception as e:
        print(f"  [WARN] {source['name']}: {e}")
    return articles

def fetch_all_news() -> list:
    all_articles, seen = [], set()
    for source in RSS_SOURCES:
        print(f"  Fetching {source['name']} ...")
        for art in fetch_feed(source):
            if art['id'] not in seen:
                seen.add(art['id'])
                all_articles.append(art)
        time.sleep(0.6)
    all_articles.sort(key=lambda x: x['published'], reverse=True)
    return all_articles[:300]

# ==================== STOCK FETCHING ====================

def fetch_quote(symbol: str) -> dict | None:
    try:
        url = f'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}'
        r = requests.get(url, params={'interval': '1d', 'range': '5d'},
                         headers=HEADERS, timeout=12)
        data = r.json()
        meta = data['chart']['result'][0]['meta']
        price      = meta.get('regularMarketPrice') or meta.get('previousClose')
        prev_close = meta.get('chartPreviousClose') or meta.get('previousClose')
        change     = round(price - prev_close, 4) if price and prev_close else 0
        change_pct = round(change / prev_close * 100, 2) if prev_close else 0
        return {
            'price':        round(price, 4) if price else None,
            'prev_close':   round(prev_close, 4) if prev_close else None,
            'change':       change,
            'change_pct':   change_pct,
            'currency':     meta.get('currency', 'USD'),
            'market_state': meta.get('marketState', 'UNKNOWN'),
        }
    except Exception as e:
        print(f"  [WARN] Stock {symbol}: {e}")
        return None

def fetch_all_stocks():
    stocks, indices = [], []
    for s in DELEGATION_STOCKS:
        print(f"  Stock {s['symbol']} ...")
        q = fetch_quote(s['symbol'])
        if q:
            stocks.append({**s, **q})
        time.sleep(0.3)
    for idx in MARKET_INDICES:
        print(f"  Index {idx['symbol']} ...")
        q = fetch_quote(idx['symbol'])
        if q:
            indices.append({**idx, **q})
        time.sleep(0.3)
    return stocks, indices

# ==================== MAIN ====================

def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat()

    print('=== Fetching News ===')
    articles = fetch_all_news()
    with open(os.path.join(DATA_DIR, 'news.json'), 'w', encoding='utf-8') as f:
        json.dump({'last_updated': now, 'total': len(articles), 'articles': articles},
                  f, ensure_ascii=False, indent=2)
    print(f'  Saved {len(articles)} articles')

    print('=== Fetching Stocks ===')
    stocks, indices = fetch_all_stocks()
    with open(os.path.join(DATA_DIR, 'stocks.json'), 'w', encoding='utf-8') as f:
        json.dump({'last_updated': now, 'stocks': stocks, 'indices': indices},
                  f, ensure_ascii=False, indent=2)
    print(f'  Saved {len(stocks)} stocks, {len(indices)} indices')
    print('Done.')

if __name__ == '__main__':
    main()
