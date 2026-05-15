# 特朗普访华动态追踪

实时追踪特朗普访问北京会谈的新闻、媒体分析与资本市场影响。

## 功能

- **新闻时间线** — 每4小时自动抓取路透社、BBC、半岛电视台、联合早报、SCMP、NYT、FT、彭博、环球时报等媒体的 RSS，按时间排序，标注来源
- **媒体视角** — 按媒体分组，横向比较各方报道角度
- **市场影响** — 追踪代表团企业（Tesla、Apple、JPMorgan 等）股价及 S&P 500、上证、恒生等主要指数

## 部署到 GitHub Pages

### 1. 在 GitHub 创建仓库

```bash
cd trump-beijing-tracker
git init
git add .
git commit -m "init: 特朗普访华追踪器"
git remote add origin https://github.com/YOUR_USERNAME/trump-beijing-tracker.git
git push -u origin main
```

### 2. 开启 GitHub Pages

进入仓库 **Settings → Pages → Source** 选择 `main` 分支 `/` (root)，保存后几分钟即可访问：
`https://YOUR_USERNAME.github.io/trump-beijing-tracker/`

### 3. 开启 Actions 写入权限

进入 **Settings → Actions → General → Workflow permissions**，选择 **Read and write permissions**，保存。

### 4. 手动触发第一次数据抓取

进入 **Actions → 更新新闻与市场数据 → Run workflow**，等待完成后刷新页面即可看到数据。

之后每4小时（UTC 0/4/8/12/16/20点）自动运行。

## 本地预览

```bash
pip install -r requirements.txt
python scripts/fetch_data.py   # 抓取数据到 data/
python -m http.server 8080     # 本地服务器
# 浏览器打开 http://localhost:8080
```

## 数据来源

| 媒体 | 语言 | 类型 |
|------|------|------|
| Reuters | EN | 国际 |
| BBC | EN | 国际 |
| Al Jazeera | EN | 国际 |
| NYT | EN | 国际 |
| Financial Times | EN | 财经 |
| Bloomberg | EN | 财经 |
| CNBC | EN | 财经 |
| WSJ | EN | 财经 |
| SCMP | EN | 亚洲 |
| Nikkei Asia | EN | 亚洲 |
| 联合早报 | ZH | 中文 |
| Global Times | EN | 官方 |
| Xinhua | EN | 官方 |

股价数据来自 Yahoo Finance（非实时，每4小时更新）。

## 注意事项

- **社交媒体**（X/微博）：官方 API 需付费授权，本版本暂不支持；如需接入，可自行在 `fetch_data.py` 中添加 Twitter API v2 或微博开放平台 token。
- 数据仅供参考，不构成投资建议。
