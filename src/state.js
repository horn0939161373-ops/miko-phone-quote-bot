// ============================================================
// state.js ─ 每位訂閱者「上次推播過的報價」讀寫，存成 repo 裡的 JSON 檔
// ============================================================
//
// 結構是兩層：lineTargetId → { 手機標題: 上次推播價格 }。分開存是因為
// 不同人可能在不同時間點加入關注清單，同一支手機對 A 來說可能是「第一次
// 推播」、對已經追蹤很久的 B 來說可能是「價格沒變不用推播」，兩人的
// 判斷基準要各自獨立。

const fs = require('fs');

function loadStateBySubscriber(path) {
  try {
    const raw = fs.readFileSync(path, 'utf8');
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch (e) {
    return {};
  }
}

function saveStateBySubscriber(path, stateBySubscriber) {
  fs.writeFileSync(path, JSON.stringify(stateBySubscriber, null, 2) + '\n');
}

module.exports = { loadStateBySubscriber, saveStateBySubscriber };
