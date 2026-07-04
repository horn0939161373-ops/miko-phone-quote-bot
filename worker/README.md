# LIFF 訂閱後端（Cloudflare Workers）

讓朋友可以直接在 LINE 裡面點幾下、勾選手機、送出，就完成訂閱——不用再去 GitHub 網頁貼 JSON。這個資料夾是接住 `docs/liff.html` 送出的請求、幫忙寫回 `watchlist.json` 的小型後端。

## 為什麼需要這個（不能只靠 GitHub Pages 嗎？）

`docs/liff.html` 是靜態網頁，沒辦法安全地直接寫入 GitHub（要嘛把有寫入權限的 token 藏在網頁原始碼裡讓任何人都能看到、盜用，要嘛完全不能寫入）。所以需要一個「你自己控制、把 token 存在安全地方」的小後端來代為寫入。Cloudflare Workers 的免費額度（每天 10 萬次請求）對這個用途來說綽綽有餘，不需要付費。

## 你需要做的事

### 1. 申請 Cloudflare 帳號、安裝 wrangler

1. 到 https://dash.cloudflare.com/sign-up 申請一個免費帳號（不需要綁定網域，也不需要信用卡）
2. 本機（或任何有 Node.js 的環境）安裝 wrangler：`npm install -g wrangler`
3. 登入：`wrangler login`（會跳出瀏覽器要你授權）

### 2. 建立 GitHub Fine-grained Personal Access Token

這組 token 只需要**這一個 repo**、**只需要 Contents 讀寫權限**，不要給比這更多的權限：

1. 到 https://github.com/settings/personal-access-tokens/new
2. **Repository access** 選 **Only select repositories**，選 `miko-phone-quote-bot`
3. **Permissions → Repository permissions → Contents** 選 **Read and write**，其他都留 No access
4. 產生後複製這組 token（只會顯示一次）

### 3. 部署 worker

在 `worker/` 這個資料夾底下：

```bash
cd worker
wrangler deploy
```

部署成功後，終端機會印出這個 worker 的網址，長得像：
`https://miko-liff-subscribe.<你的-cloudflare-帳號>.workers.dev`

### 4. 設定 Secrets（GITHUB_TOKEN、LIFF_CHANNEL_ID）

```bash
wrangler secret put GITHUB_TOKEN
# 貼上第 2 步產生的 token，按 Enter

wrangler secret put LIFF_CHANNEL_ID
# 貼上下面「設定 LIFF」步驟裡拿到的 Channel ID，按 Enter
```

### 5. 設定 LIFF（在 LINE Developers Console）

1. 到 [LINE Developers Console](https://developers.line.biz/console/)，打開你原本幫這個 bot 建立的 **Messaging API channel**
2. 切到 **LIFF** 頁籤 → **Add**
3. 填寫：
   - **LIFF app name**：隨便取，例如「米可報價訂閱」
   - **Size**：Tall 或 Full 都可以
   - **Endpoint URL**：`https://horn0939161373-ops.github.io/miko-phone-quote-bot/liff.html`
   - **Scope**：勾選 `profile` 跟 `openid`
   - **Bot link feature**：On（可選，會自動顯示這是哪個 bot）
4. 建立後會拿到一組 **LIFF ID**（長得像 `1234567890-AbCdEfGh`）
5. 同一個頁籤最上面可以看到這個 channel 的 **Channel ID**——就是上一步 `LIFF_CHANNEL_ID` 要填的值

### 6. 把 LIFF ID 跟 Worker 網址填進 `docs/liff.html`

打開 `docs/liff.html`，找到最上面這兩行，換成你自己的值：

```js
const LIFF_ID = 'REPLACE_WITH_YOUR_LIFF_ID';
const WORKER_URL = 'https://REPLACE_WITH_YOUR_WORKER_SUBDOMAIN.workers.dev/subscribe';
```

commit、push 到 `main`，等 GitHub Pages 重新部署（1-2 分鐘）。

### 7. 測試

把 `https://liff.line.me/<你的 LIFF ID>` 這個網址貼到你跟自己的 LINE 對話裡，點一下——應該會在 LINE 裡面直接打開選手機的頁面。勾選、送出，確認 `watchlist.json` 有更新、GitHub Actions 排程跑起來後有推播。

## 這支 worker 做了什麼／沒做什麼

- ✅ 驗證前端送來的 LINE idToken（跟 LINE 官方的 `/oauth2/v2.1/verify` 對答案），確保寫入的 LINE User ID 是真的、不是前端隨便捏造的
- ✅ 用 GitHub Contents API 讀取現有 `watchlist.json`、依 `lineTargetId` 判斷是新訂閱者還是更新既有訂閱者，寫回時帶 `sha` 避免跟同時間的其他寫入互相覆蓋（衝突時會自動重試）
- ✅ CORS 只允許 `https://horn0939161373-ops.github.io` 這個來源呼叫
- ⚠️ 沒有做額外的流量限制（rate limit）——對這種小型個人專案應該用不到，但如果要公開分享給很多人用，可以自己在 Cloudflare 加 Rate Limiting 規則

## 除錯

- 送出後如果顯示「送出失敗」，先看 Cloudflare Dashboard → Workers → 這支 worker →「Logs」，即時的錯誤訊息都在那裡
- 常見錯誤：
  - `LINE idToken 驗證失敗` → 通常是 `LIFF_CHANNEL_ID` 設定的值不是這個 LIFF app 所屬的 channel ID
  - `讀取/寫入 watchlist.json 失敗（401 或 403）` → `GITHUB_TOKEN` 沒設定、過期，或權限不夠（要確認有 Contents: Read and write）
