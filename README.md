# 米可手機報價通知 Bot（GitHub Actions 版）

定時用 Playwright 開真實瀏覽器抓[米可手機館](https://www.miko3c.com/price/phone/)的空機報價，跟每個人各自的關注清單比對，有新上架或降價就用 LINE 推播給那個人。支援**多人訂閱**——每個朋友都可以用同一個 GitHub Pages 小網頁勾選自己想追蹤的機型，推播到各自的 LINE，互不干擾。還有一個**報價儀表板**，可以看每支手機的價格走勢圖跟排程的執行紀錄。全部跑在 GitHub Actions 上，**不需要 GCP、不需要 Docker、不需要任何雲端主控台**。

## 架構

```
GitHub Actions（排程，預設每小時一次）
  → 開 headless Chromium 抓米可手機館的報價頁
  → 把完整報價清單寫進 docs/phones.json（給選手機網頁、儀表板用）
  → 更新 docs/history.json（每支手機每天一筆的價格快照，給儀表板畫走勢圖）
  → 記一筆這次執行結果進 docs/status.json（給儀表板看抓取紀錄）
  → 依序處理 watchlist.json 裡的每位訂閱者：
      跟這個人的關注清單比對 → 跟這個人上次收到的報價比對，
      找出「新上榜」或「價格有變動」的機型 → 推播到這個人的 LINE
  → 把每位訂閱者最新收到的報價寫回 state/last-prices.json 並 commit

GitHub Pages（docs/ 資料夾）
  → docs/index.html：搜尋、勾選手機的小網頁（填自己的名字 + LINE User ID）
  → docs/dashboard.html：報價儀表板（價格走勢圖 + 抓取執行紀錄）
  → docs/phones.json / history.json / status.json：上面排程產生的資料，網頁直接讀取
```

沒有資料庫、沒有伺服器——報價資料、關注清單、推播紀錄都直接存成 repo 裡的 JSON 檔。

## 你需要做的事（僅這兩步，跟身份綁定、無法代勞）

### 1. 建立 LINE Messaging API channel、取得 Token 與推播對象 ID

1. 到 [LINE Developers Console](https://developers.line.biz/console/) 建立一個 Provider，再建立一個 **Messaging API channel**
2. 在該 channel 的「Messaging API」頁籤，簽發一組 **Channel access token（long-lived）**
3. 取得推播對象的 ID：
   - **推給自己**：在該 channel 的「Basic settings」頁籤能看到你自己的 **User ID**（`U` 開頭）
   - **推到群組**：把這個官方帳號加進 LINE 群組，開啟 webhook 後傳一則訊息，從 webhook log 裡的 `source.groupId` 取得（`C` 開頭）——這步如果不需要群組通知可以跳過，直接用個人 User ID 即可

### 2. 把 Channel access token 設定成這個 repo 的 GitHub Secret

到 repo 的 **Settings → Secrets and variables → Actions → New repository secret**，新增：

| Secret 名稱 | 值 |
|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | 上一步簽發的 Channel access token |

⚠️ 這裡**不需要**（也沒有）`LINE_TARGET_ID` 這個 Secret 了：每位訂閱者的推播對象 ID 是各自填在 `watchlist.json` 裡的 `lineTargetId` 欄位，不是全域共用同一個。這代表 `watchlist.json` 裡會存到每個訂閱者的 LINE User ID——不算特別敏感的資訊（沒有這串 ID + 你的 channel token 兩者同時外流也做不了什麼），但這也是為什麼這個 repo 建議設成 **Private**。

### 3. 開啟 GitHub Pages（讓選手機的小網頁、儀表板能被打開）

1. 到 repo 的 **Settings → Pages**
2. **Source** 選 **Deploy from a branch**
3. **Branch** 選 `main`，資料夾選 `/docs`，按 **Save**
4. 幾分鐘後，網頁網址會顯示在同一頁（通常長得像 `https://<你的帳號>.github.io/miko-phone-quote-bot/`）

⚠️ GitHub Pages 只會 build **預設分支**（`main`）上的內容，這個功能合併到 `main` 之前網頁不會生效。

## 怎麼選要追蹤的手機（每個人都可以自己來一次）

有兩種方式，效果一樣，選一種就好：

- **方式 A：在 LINE 裡面點幾下就完成**（推薦，但需要多做一次性設定）——見下面「[LIFF 訂閱：在 LINE 裡面點幾下就完成](#liff-訂閱在-line-裡面點幾下就完成)」
- **方式 B：網頁勾選 → 手動貼進 GitHub**（不需要額外設定，但每次新增/修改訂閱都要手動編輯檔案）——照下面步驟

### 方式 B 步驟

1. 打開上面設定好的 GitHub Pages 網頁（`docs/index.html`）
2. **先把這個 LINE Bot 加為好友**——LINE 平台規定，Bot 沒辦法推播訊息給還沒加好友的人，這步驟每個訂閱者都要自己做，沒辦法用程式代勞
3. 填自己的名字、自己的 LINE User ID（在 LINE Developers Console 的 channel「Basic settings」頁籤可以找到，`U` 開頭）
4. 搜尋、勾選想追蹤報價的機型（可複選）
5. 按「複製設定內容」，會產生一個 JSON 物件（不是陣列）
6. 按「在 GitHub 上開啟 watchlist.json」：
   - **如果你是第一個設定的人**：把整個檔案內容全選刪除，貼上「`[` + 剛複製的內容 + `]`」（外層記得補中括號，變成一個只有一個元素的陣列）
   - **如果檔案裡已經有其他人了**：在最後一個訂閱者物件的 `}` 後面加一個逗號 `,`，把剛複製的內容貼在後面、最外層的 `]` 之前
7. 在 GitHub 網頁上按綠色的 **Commit changes**
8. 等下一次排程執行（或到 Actions 頁籤手動 `Run workflow`），有新報價或降價就會推播到你的 LINE

網頁第一次打開時 `docs/phones.json` 會是空的（`[]`），要等排程第一次成功執行完才會有資料。

## LIFF 訂閱：在 LINE 裡面點幾下就完成

`docs/liff.html` 是一個 **LIFF（LINE Front-end Framework）** 頁面——從 LINE 裡面打開，會自動知道是「誰」在用（不用自己複製貼上 LINE User ID），勾選手機、按送出，就直接完成訂閱，不用碰 GitHub 網頁。

這個體驗需要多一塊「即時接收請求」的小後端（GitHub Actions 只能排程或手動觸發，沒辦法即時回應），架在免費的 **Cloudflare Workers** 上。完整設定步驟（申請 Cloudflare 帳號、部署 worker、在 LINE Developers Console 建立 LIFF app）在 [`worker/README.md`](./worker/README.md)，這些都是一次性設定，設定好之後你自己跟朋友都只要「打開連結 → 勾選 → 送出」三個動作。

設定好之後，把 `https://liff.line.me/<你的 LIFF ID>` 這個連結分享給想訂閱的人（貼在 LINE 對話裡就是一個可以點的連結），點開來就是選手機的頁面。

## `watchlist.json` 格式

一個「訂閱者陣列」，每個人是一個物件，各自有自己的名字、LINE 推播對象、關注清單：

```json
[
  {
    "name": "我自己",
    "lineTargetId": "U1234567890abcdef1234567890abcdef",
    "phones": ["iPhone 17 Pro (256GB)", "Galaxy S26 Ultra (256GB)"]
  },
  {
    "name": "小明",
    "lineTargetId": "Uabcdef1234567890abcdef1234567890",
    "phones": ["Redmi 紅米 15C (8GB+256GB)"]
  }
]
```

| 欄位 | 說明 |
|---|---|
| `name` | 隨便取，只是方便你自己認得是誰，不影響推播 |
| `lineTargetId` | 這個人的 LINE User ID（或群組 ID），推播就是送到這裡 |
| `phones` | 關注清單，字串只要跟抓到的手機標題「部分相符」（不分大小寫）就算命中——用選手機網頁產生的內容會是完整標題，保證命中；也可以自己手動填短一點的關鍵字（例如只填 `"iPhone 17 Pro"` 不含容量），會命中所有符合的容量版本 |

沒填 `lineTargetId` 或 `phones` 是空陣列的訂閱者會被忽略（不會推播、也不會噴錯）。整個檔案是空陣列 `[]` 代表目前沒有任何訂閱者，排程只會更新報價資料，不會推播給任何人。

## 什麼時候會推播？

每位訂閱者是**各自獨立判斷**的（同一支手機，A 可能是第一次收到通知，B 可能已經追蹤很久、報價沒變不會再收到）。同一支手機用完整標題判斷是否同一支（容量、顏色不同視為不同機型）：

- **第一次**在某人的關注清單裡被抓到報價 → 推播給這個人（標示「目前報價」）
- 之後**報價有變動**（不管漲價或降價）→ 推播給有追蹤這支手機的每個人，並顯示前次報價與漲跌方向
- 報價沒變 → 不會重複推播，避免洗版
- 某個人推播失敗（例如還沒加 Bot 好友）不會擋到其他訂閱者，下次排程會對這個人重試

## 報價儀表板

`docs/dashboard.html`（跟選手機網頁在同一個 GitHub Pages 網站下）可以看：

- **KPI 總覽**：目前追蹤幾支手機、較前次記錄降價/漲價幾支、最後成功更新是多久前
- **每支手機的價格卡片**：目前報價、較前次記錄的漲跌、近期走勢小圖，點下去可以展開完整的價格走勢圖（含米可報價 vs 原廠建議售價的對照、滑鼠移上去看每一天的確切數字）
- **抓取執行紀錄**：最近幾次排程執行的時間、成功/失敗、抓到幾支手機、推播了幾個人，失敗時會顯示錯誤訊息

價格走勢資料存在 `docs/history.json`，**每支手機每天只保留一筆快照**（同一天內排程跑好幾次只會覆蓋當天那筆，不會讓檔案一直長大），保留最近 90 天，超過自動剪掉。執行紀錄存在 `docs/status.json`，保留最近 50 次。

## 執行排程

`.github/workflows/phone-quote.yml` 預設每小時跑一次（`cron: '0 * * * *'`）。也可以在 GitHub 網頁的 Actions 頁籤手動點 "Run workflow"（`workflow_dispatch`）立即觸發一次。

⚠️ **GitHub 的排程觸發只會在預設分支（`main`）上生效**，這個 workflow 合併到 `main` 之前不會自動排程執行。

⚠️ **已知問題：這個帳號的 `schedule` 自動排程目前完全不會被觸發。** 實測過連續 4 小時、`cron` 設成每 5 分鐘一次，`workflow_dispatch`（手動觸發）每次都準確成功，但 `schedule` 事件一次都沒有被 GitHub 排進去執行——用 GitHub API 查詢這個 workflow 的狀態也顯示 `state: active`（沒有被停用），YAML 語法也沒問題（同一個 `on:` 區塊裡 `workflow_dispatch` 能正常動作，代表整份檔案能被正確解析）。目前判斷是這個 GitHub 帳號在排程系統裡的問題，不是這份 workflow 寫錯。在這個問題解決之前，**排程不會自動更新報價、也不會自動推播**，只能用手動 `workflow_dispatch` 觸發（網頁上點 "Run workflow"，或請人用 API 觸發）。如果你之後發現排程開始正常運作了，這段警告就可以刪掉。

## 除錯

`https://www.miko3c.com/price/phone/` 實際上是一個「價格總覽」表格（型號｜原廠建議售價｜米可破盤價｜優惠活動），每一列**沒有連到商品詳情頁的連結**。`src/scrape.js` 的 `parsePhonesFromText()` 是直接解析渲染完成頁面的 `innerText`，找「標題行 → 原價數字 → 米可破盤價數字」這個固定樣式，不依賴任何 CSS class（已用 Actions log 的實際輸出核對過解析邏輯，170 支手機全部正確抓到）。

如果米可改版導致 log 顯示「抓到 0 支手機」：

1. 到 Actions 的執行紀錄裡看 log 印出的除錯資訊（頁面標題、`<a>` 標籤總數、頁面文字前 2000 字），通常可以直接看出格式哪裡變了
2. 或本機安裝 Playwright 後直接跑 `node -e "require('./src/scrape').scrapePhones().then(r=>console.log(JSON.stringify(r.slice(0,5),null,2)))"`，打開瀏覽器開發者工具核對 `https://www.miko3c.com/price/phone/` 目前的文字排列方式，調整 `parsePhonesFromText()` 裡的規則

`parsePhonesFromText()` 本身也可以直接單元測試，不需要真的連網：`require('./src/scrape').parsePhonesFromText(某段文字)`。

## 費用 / Actions 分鐘數注意事項

- Private repo 的 GitHub Actions 有每月分鐘數額度（Free 方案約 2000 分鐘/月）。每小時跑一次、每次約 1-2 分鐘（含安裝 Chromium），一個月約用掉 700-1500 分鐘。如果額度吃緊，把 cron 間隔拉長（例如改成每 2 小時 `0 */2 * * *`）即可降低用量。
