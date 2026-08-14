// ============================================================
// json-file.js ─ 以同目錄暫存檔 + rename 原子寫入 JSON
// ============================================================
// 避免 GitHub Actions / Node 程序在寫檔途中被中斷時，留下半截 JSON。

const fs = require('fs');

function writeJsonAtomic(filePath, value, options = {}) {
  const pretty = options.pretty !== false;
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const json = pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
  try {
    fs.writeFileSync(tmpPath, json + '\n');
    fs.renameSync(tmpPath, filePath);
  } finally {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch (_) {}
  }
}

module.exports = { writeJsonAtomic };
