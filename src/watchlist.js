// ============================================================
// watchlist.js ─ 讀取關注清單（多人訂閱）、用關鍵字比對出使用者想追蹤的手機
// ============================================================
//
// watchlist.json 格式是「訂閱者陣列」，每個人一個 LINE 推播對象 + 自己的
// 關注清單，讓不同朋友可以各自追蹤不同手機、推播到各自的 LINE：
// [
//   { "name": "我自己", "lineTargetId": "U....", "phones": ["iPhone 17 Pro (256GB)"] },
//   { "name": "小明",   "lineTargetId": "U....", "phones": ["Galaxy S26 Ultra (256GB)"] }
// ]

const fs = require('fs');

function loadSubscribers(path) {
  try {
    const raw = fs.readFileSync(path, 'utf8');
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map(s => ({
        name: String((s && s.name) || '').trim() || '未命名',
        lineTargetId: String((s && s.lineTargetId) || '').trim(),
        phones: Array.isArray(s && s.phones) ? s.phones.map(p => String(p).trim()).filter(Boolean) : []
      }))
      // 沒填推播對象或沒選任何手機的訂閱者略過，不然會噴 LINE API 400
      .filter(s => s.lineTargetId && s.phones.length);
  } catch (e) {
    return [];
  }
}

// 關注清單裡的字串，只要是掃到的手機標題的子字串（不分大小寫）就算命中。
// 選取網頁（docs/index.html）產生的內容就是直接複製掃到的完整標題，
// 所以正常情況下一定會精準命中；使用者手動編輯只填部分關鍵字（例如
// 「iPhone 17 Pro」不含容量）也可以，會命中所有符合的容量版本。
function matchWatchlist(phones, keywords) {
  if (!keywords.length) return [];
  const lowerKeywords = keywords.map(k => k.toLowerCase());
  return phones.filter(p => {
    const title = p.title.toLowerCase();
    return lowerKeywords.some(k => title.includes(k));
  });
}

module.exports = { loadSubscribers, matchWatchlist };
