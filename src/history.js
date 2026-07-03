// ============================================================
// history.js ─ 每支手機的每日報價快照，給後台儀表板畫價格走勢圖用
// ============================================================
//
// 排程一小時跑一次，但歷史記錄只留「每天一筆」（同一天內重複執行只覆蓋
// 當天那筆，用最新抓到的價格），避免檔案隨執行次數無限長大。保留最近
// MAX_DAYS 天，超過的自動剪掉。

const fs = require('fs');

const MAX_DAYS = 90;

function loadHistory(path) {
  try {
    const raw = fs.readFileSync(path, 'utf8');
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch (e) {
    return {};
  }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD（UTC，跟 GitHub Actions runner 時區一致）
}

/** 直接修改並回傳傳入的 history 物件（key 是手機標題）。 */
function updateHistory(history, phones) {
  const today = todayStr();
  const cutoff = new Date(Date.now() - MAX_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  for (const p of phones) {
    if (!p.title || !p.price) continue;
    const series = history[p.title] || [];
    const todayIdx = series.findIndex(pt => pt.date === today);
    const point = { date: today, price: p.price, msrp: p.msrp };
    if (todayIdx >= 0) series[todayIdx] = point;
    else series.push(point);

    history[p.title] = series
      .filter(pt => pt.date >= cutoff)
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  // 這次沒抓到的手機（下架、改名）歷史記錄原樣保留，只是不會再新增新的一天

  return history;
}

function saveHistory(path, history) {
  // 資料量隨天數 × 手機數成長，不用 pretty-print 縮排省空間
  fs.writeFileSync(path, JSON.stringify(history) + '\n');
}

module.exports = { loadHistory, updateHistory, saveHistory, todayStr };
