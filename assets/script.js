/* ======================================================
   Trump-Beijing Tracker — Frontend Logic
   ====================================================== */

const PAGE_SIZE = 30;
let allArticles   = [];
let filteredArticles = [];
let shownCount    = PAGE_SIZE;
let activeSource  = 'all';
let newsData      = null;
let stocksData    = null;

const CATEGORY_LABEL = {
  international:    '国际',
  business:         '财经',
  asia:             '亚洲',
  chinese:          '中文媒体',
  chinese_official: '官方媒体',
};

// ── Utils ─────────────────────────────────────────────

function timeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return '刚刚';
  if (m < 60)  return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h} 小时前`;
  const d = Math.floor(h / 24);
  return `${d} 天前`;
}

function fmtTime(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit',  minute: '2-digit',
    timeZone: 'Asia/Shanghai',
  }) + ' CST';
}

function fmtPrice(price, currency) {
  if (price == null) return '--';
  if (currency === 'CNY' || ['000001.SS', '000300.SS'].includes(currency))
    return price.toLocaleString('zh-CN', { minimumFractionDigits: 2 });
  return price.toLocaleString('en-US', { minimumFractionDigits: 2 });
}

function changeClass(chg) {
  if (chg > 0) return 'up';
  if (chg < 0) return 'down';
  return 'flat';
}

function changeStr(chg, pct) {
  if (chg == null) return '--';
  const sign = chg >= 0 ? '+' : '';
  return `${sign}${chg.toFixed(2)} (${sign}${pct.toFixed(2)}%)`;
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;');
}

// ── Countdown to next fetch ───────────────────────────

function startCountdown(lastUpdated) {
  const el = document.getElementById('next-update');
  const INTERVAL_MS = 4 * 60 * 60 * 1000;

  function tick() {
    const next = new Date(lastUpdated).getTime() + INTERVAL_MS;
    const rem  = next - Date.now();
    if (rem <= 0) { el.textContent = '正在更新…'; return; }
    const h = Math.floor(rem / 3600000);
    const m = Math.floor((rem % 3600000) / 60000);
    const s = Math.floor((rem % 60000) / 1000);
    el.textContent = `下次更新: ${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
  }
  tick();
  setInterval(tick, 1000);
}

// ── Build Source Filter Buttons ───────────────────────

function buildFilters(articles) {
  const sources = [...new Set(articles.map(a => a.source))].sort();
  const bar = document.getElementById('filter-bar');
  bar.innerHTML = `<span class="filter-label">来源筛选:</span>
    <button class="filter-btn active" data-source="all">全部 (${articles.length})</button>`;

  sources.forEach(src => {
    const count = articles.filter(a => a.source === src).length;
    const color = articles.find(a => a.source === src)?.source_color || '#666';
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.source = src;
    btn.style.setProperty('--src-color', color);
    btn.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${escHtml(color)};margin-right:5px;"></span>${escHtml(src)} (${count})`;
    bar.appendChild(btn);
  });

  bar.addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeSource = btn.dataset.source;
    shownCount = PAGE_SIZE;
    renderNews();
  });
}

// ── Render News Cards ─────────────────────────────────

function newsCardHtml(art) {
  const cat = CATEGORY_LABEL[art.source_category] || art.source_category;
  // Show Chinese translation as main title when available; original EN as subtitle
  const mainTitle  = art.title_zh || art.title;
  const subTitle   = art.title_zh ? art.title : '';
  return `
  <article class="news-card" style="border-left-color:${escHtml(art.source_color)}">
    <div class="card-meta">
      <span class="source-badge" style="background:${escHtml(art.source_color)}">${escHtml(art.source)}</span>
      <span class="card-time" title="${escHtml(fmtTime(art.published))}">${timeAgo(art.published)}</span>
      <span class="card-category">${escHtml(cat)}</span>
      ${art.title_zh ? '<span class="translated-badge">中译</span>' : ''}
    </div>
    <div class="card-title">
      <a href="${escHtml(art.link)}" target="_blank" rel="noopener">${escHtml(mainTitle)}</a>
    </div>
    ${subTitle ? `<div class="card-original-title">${escHtml(subTitle)}</div>` : ''}
    ${art.summary ? `<p class="card-summary">${escHtml(art.summary)}</p>` : ''}
  </article>`;
}

function renderNews() {
  filteredArticles = activeSource === 'all'
    ? allArticles
    : allArticles.filter(a => a.source === activeSource);

  const slice = filteredArticles.slice(0, shownCount);
  const list  = document.getElementById('news-list');

  if (filteredArticles.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="icon">📭</div>
      <p>暂无相关新闻，请等待下次自动更新</p>
    </div>`;
    return;
  }

  list.innerHTML = slice.map(newsCardHtml).join('');

  const existing = document.getElementById('load-more');
  if (existing) existing.remove();

  if (shownCount < filteredArticles.length) {
    const btn = document.createElement('button');
    btn.id = 'load-more';
    btn.className = 'load-more-btn';
    btn.textContent = `加载更多 (剩余 ${filteredArticles.length - shownCount} 条)`;
    btn.onclick = () => { shownCount += PAGE_SIZE; renderNews(); };
    list.after(btn);
  }
}

// ── Render Media Grid ─────────────────────────────────

function renderMedia(articles) {
  const bySource = {};
  articles.forEach(a => {
    if (!bySource[a.source]) bySource[a.source] = { color: a.source_color, items: [] };
    bySource[a.source].items.push(a);
  });

  const grid = document.getElementById('media-grid');

  if (Object.keys(bySource).length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="icon">📰</div><p>暂无数据</p></div>`;
    return;
  }

  grid.innerHTML = Object.entries(bySource).map(([name, data]) => {
    const items = data.items.slice(0, 5);
    return `
    <div class="media-block">
      <div class="media-block-header">
        <span class="media-dot" style="background:${escHtml(data.color)}"></span>
        <span class="media-name">${escHtml(name)}</span>
        <span class="media-count">${data.items.length} 篇</span>
      </div>
      ${items.map(a => `
        <div class="media-article">
          <div class="media-article-title">
            <a href="${escHtml(a.link)}" target="_blank" rel="noopener">${escHtml(a.title)}</a>
          </div>
          <div class="media-article-time">${timeAgo(a.published)}</div>
        </div>`).join('')}
    </div>`;
  }).join('');
}

// ── Render Market Data ────────────────────────────────

function renderStocks(stocks, indices) {
  const sg = document.getElementById('stocks-grid');
  const ig = document.getElementById('indices-grid');

  if (!stocks || stocks.length === 0) {
    sg.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><p>股价数据加载中…</p></div>`;
  } else {
    sg.innerHTML = stocks.map(s => {
      const cls = changeClass(s.change);
      const sym = s.currency === 'CNY' ? '¥' : '$';
      return `
      <div class="stock-card">
        <div class="stock-symbol">${escHtml(s.symbol)}</div>
        <div class="stock-name">${escHtml(s.name)}</div>
        ${s.person ? `<div class="stock-person">${escHtml(s.person)}${s.role ? ' · ' + escHtml(s.role) : ''}</div>` : ''}
        <div class="stock-price">${sym}${fmtPrice(s.price, s.currency)}</div>
        <div class="stock-change ${cls}">${changeStr(s.change, s.change_pct)}</div>
        <div class="stock-state">${s.market_state || ''}</div>
      </div>`;
    }).join('');
  }

  if (!indices || indices.length === 0) {
    ig.innerHTML = '';
  } else {
    ig.innerHTML = indices.map(idx => {
      const cls = changeClass(idx.change);
      return `
      <div class="index-card">
        <div class="index-name">${escHtml(idx.name)}</div>
        <div class="index-region">${escHtml(idx.region)}</div>
        <div class="index-price">${fmtPrice(idx.price, idx.currency)}</div>
        <div class="index-change ${cls}">${changeStr(idx.change, idx.change_pct)}</div>
      </div>`;
    }).join('');
  }
}

// ── Skeleton Loaders ──────────────────────────────────

function showSkeletons(n = 6) {
  const list = document.getElementById('news-list');
  list.innerHTML = Array.from({length: n}, () => `
    <div class="skeleton-card">
      <div class="skeleton skel-line" style="width:20%;height:10px;margin-bottom:10px"></div>
      <div class="skeleton skel-line" style="width:80%;height:14px;margin-bottom:8px"></div>
      <div class="skeleton skel-line" style="width:95%;height:11px;margin-bottom:5px"></div>
      <div class="skeleton skel-line" style="width:70%;height:11px"></div>
    </div>`).join('');
}

// ── Fetch Data from JSON ──────────────────────────────

async function loadNews() {
  showSkeletons();
  try {
    const r = await fetch(`data/news.json?t=${Date.now()}`);
    if (!r.ok) throw new Error(r.status);
    newsData = await r.json();
    allArticles = newsData.articles || [];

    document.getElementById('last-updated').innerHTML =
      `上次更新: <span>${timeAgo(newsData.last_updated)}</span> &nbsp;|&nbsp; 共 <span>${newsData.total || allArticles.length}</span> 条`;

    startCountdown(newsData.last_updated);
    buildFilters(allArticles);
    renderNews();
    renderMedia(allArticles);
  } catch (e) {
    console.error('News load error:', e);
    document.getElementById('news-list').innerHTML = `
      <div class="empty-state">
        <div class="icon">⚠️</div>
        <p>暂无新闻数据。请先运行 GitHub Actions 或本地执行 <code>python scripts/fetch_data.py</code></p>
      </div>`;
  }
}

async function loadStocks() {
  try {
    const r = await fetch(`data/stocks.json?t=${Date.now()}`);
    if (!r.ok) throw new Error(r.status);
    stocksData = await r.json();
    renderStocks(stocksData.stocks, stocksData.indices);
  } catch (e) {
    console.error('Stocks load error:', e);
  }
}

// ── Tab Navigation ────────────────────────────────────

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });
}

// ── Init ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadNews();
  loadStocks();

  // Reload data every 10 minutes to pick up fresh commits
  setInterval(() => { loadNews(); loadStocks(); }, 10 * 60 * 1000);
});
