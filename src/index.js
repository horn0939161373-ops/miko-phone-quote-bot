// ============================================================
// index.js ─ 入口：抓米可手機館報價、更新網頁用的資料/歷史/執行紀錄、
//            比對每位訂閱者的關注清單、各自推播 LINE
// ============================================================

const fs = require('fs');
const path = require('path');
const { scrapePhones } = require('./scrape');
const { pushPriceUpdates } = require('./line');
const { loadStateBySubscriber, saveStateBySubscriber } = require('./state');
const { loadSubscribers, matchWatchlist } = require('./watchlist');
const { loadHistory, updateHistory, saveHistory } = require('./history');
const { appendStatus } = require('./status');

const WATCHLIST_PATH = path.join(__dirname, '..', 'watchlist.json');
const STATE_PATH = path.join(__dirname, '..', 'state', 'last-prices.json');
// docs/ 底下的檔案是給 GitHub Pages 的選手機網頁、後台儀表板直接讀取用的。
const DATA_PATH = path.join(__dirname, '..', 'docs', 'phones.json');
const HISTORY_PATH = path.join(__dirname, '..', 'docs', 'history.json');
const STATUS_PATH = path.join(__dirname, '..', 'docs', 'status.json');

async function main() {
  console.log('=== 米可手機館報價 Bot ===');
  const startedAt = new Date().toISOString();

  let phones;
  try {
    phones = await scrapePhones();
  } catch (err) {
    // 抓取失敗也要留紀錄，後台儀表板的「抓取資訊」才看得出哪次失敗、為什麼
    appendStatus(STATUS_PATH, { at: startedAt, ok: false, error: String((err && err.message) || err), phoneCount: 0, pushCount: 0 });
    throw err;
  }

  console.log(`抓到 ${phones.length} 支手機報價`);
  fs.writeFileSync(DATA_PATH, JSON.stringify(phones, null, 2) + '\n');
  console.log(`已更新選手機網頁用的資料：${DATA_PATH}`);

  const history = loadHistory(HISTORY_PATH);
  updateHistory(history, phones);
  saveHistory(HISTORY_PATH, history);
  console.log(`已更新價格歷史記錄：${HISTORY_PATH}`);

  const subscribers = loadSubscribers(WATCHLIST_PATH);
  console.log(`關注清單 (watchlist.json)：${subscribers.length} 位訂閱者`);

  const stateBySubscriber = loadStateBySubscriber(STATE_PATH);
  let pushCount = 0;

  if (!subscribers.length) {
    console.log('目前沒有任何訂閱者，只更新報價資料，不推播。到選手機網頁勾選想關注的機型，並把產生的內容貼進 watchlist.json。');
  }

  for (const sub of subscribers) {
    const matched = matchWatchlist(phones, sub.phones);
    const priceMap = stateBySubscriber[sub.lineTargetId] || {};
    const changes = [];
    for (const p of matched) {
      const prev = priceMap[p.id];
      if (prev === undefined) changes.push({ ...p, isNew: true });
      else if (prev !== p.price) changes.push({ ...p, isNew: false, previousPrice: prev });
    }

    console.log(`[${sub.name}] 關注 ${sub.phones.length} 支，命中 ${matched.length} 支，異動 ${changes.length} 支`);
    if (!changes.length) continue;

    try {
      await pushPriceUpdates(changes, sub.lineTargetId);
      console.log(`[${sub.name}] ✅ 推播完成`);
      pushCount++;
    } catch (err) {
      // 某個人推播失敗（例如還沒加 Bot 好友）不該擋到其他訂閱者
      console.error(`[${sub.name}] ❌ 推播失敗:`, (err && err.message) || err);
      continue;
    }

    for (const c of changes) priceMap[c.id] = c.price;
    stateBySubscriber[sub.lineTargetId] = priceMap;
  }

  saveStateBySubscriber(STATE_PATH, stateBySubscriber);
  appendStatus(STATUS_PATH, { at: startedAt, ok: true, error: null, phoneCount: phones.length, pushCount });
}

main().catch(err => {
  console.error('❌ 執行失敗:', err);
  process.exit(1);
});
