// ============================================================
// status.js ─ 每次排程執行的結果記錄，給後台儀表板看「抓取資訊」用
// ============================================================

const fs = require('fs');
const { writeJsonAtomic } = require('./json-file');

const MAX_RUNS = 50;

function loadStatusLog(path) {
  try {
    const raw = fs.readFileSync(path, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

/** entry: { at, ok, error, phoneCount, pushCount } */
function appendStatus(path, entry) {
  const log = loadStatusLog(path);
  log.push(entry);
  const trimmed = log.slice(-MAX_RUNS);
  writeJsonAtomic(path, trimmed);
  return trimmed;
}

module.exports = { loadStatusLog, appendStatus };
