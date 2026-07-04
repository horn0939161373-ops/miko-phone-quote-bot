// ============================================================
// LIFF 訂閱後端 ─ 在 Cloudflare Workers 上跑的小型 API
// ============================================================
//
// 職責：LIFF 頁面（docs/liff.html）送出「這個人選了哪些手機」時，
// 這支 worker 負責：
//   1. 拿使用者送來的 LINE idToken 去跟 LINE 官方驗證，換回真正的
//      LINE User ID（絕對不能相信前端自己回報的 userId，那樣任何人
//      都能冒充別人寫入關注清單）
//   2. 用 GitHub API 讀取、更新 watchlist.json（新增或覆蓋這個人的
//      關注清單），用 GitHub 提供的 GITHUB_TOKEN（在這裡是存在
//      Worker 的 Secret，不是 repo 裡的 GitHub Actions secret）
//
// 需要的環境變數 / Secrets（用 wrangler secret put 設定，不要寫在
// 程式碼或 wrangler.toml 裡）：
//   GITHUB_TOKEN     - 只需要這個 repo 的 Contents: Read and write 權限
//                      的 fine-grained personal access token
//   LIFF_CHANNEL_ID  - LINE Developers Console 裡這個 channel 的 ID
//                      （驗證 idToken 的 audience 用）

const OWNER = 'horn0939161373-ops';
const REPO = 'miko-phone-quote-bot';
const WATCHLIST_PATH = 'watchlist.json';
const ALLOWED_ORIGIN = 'https://horn0939161373-ops.github.io';
const MAX_PHONES = 30;
const MAX_PHONE_LEN = 120;
const MAX_RETRY = 3;

function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function base64ToUtf8(b64) {
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ''))));
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}

/**
 * 跟 LINE 官方驗證 idToken，換回可信任的 sub（LINE User ID）跟 name。
 * 用官方的 /oauth2/v2.1/verify 端點，不用自己驗 JWT 簽章。
 */
async function verifyLineIdToken(idToken, channelId) {
  const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LINE idToken 驗證失敗（${res.status}）：${text.slice(0, 200)}`);
  }
  return res.json(); // { sub, name, picture, aud, exp, ... }
}

function sanitizePhones(phones) {
  if (!Array.isArray(phones)) return [];
  return phones
    .filter(p => typeof p === 'string')
    .map(p => p.trim())
    .filter(Boolean)
    .slice(0, MAX_PHONES)
    .map(p => p.slice(0, MAX_PHONE_LEN));
}

async function githubRequest(env, path, options = {}) {
  return fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'miko-phone-quote-bot-liff-worker',
      ...(options.headers || {})
    }
  });
}

/** 新增這個訂閱者，或覆蓋他原本的關注清單（用 lineTargetId 判斷是不是同一人）。 */
async function upsertSubscriber(env, { name, lineTargetId, phones }) {
  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    const getRes = await githubRequest(env, `/contents/${WATCHLIST_PATH}?ref=main`);
    if (!getRes.ok) throw new Error(`讀取 watchlist.json 失敗（${getRes.status}）`);
    const file = await getRes.json();

    let list;
    try {
      list = JSON.parse(base64ToUtf8(file.content));
      if (!Array.isArray(list)) list = [];
    } catch (e) {
      list = [];
    }

    const idx = list.findIndex(s => s && s.lineTargetId === lineTargetId);
    const entry = { name, lineTargetId, phones };
    if (idx >= 0) list[idx] = entry;
    else list.push(entry);

    const newContent = JSON.stringify(list, null, 2) + '\n';
    const putRes = await githubRequest(env, `/contents/${WATCHLIST_PATH}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `LIFF 訂閱更新：${name}`,
        content: utf8ToBase64(newContent),
        sha: file.sha,
        branch: 'main'
      })
    });

    if (putRes.ok) return;
    // 409/422 通常是 sha 跟遠端不一致（剛好有別人同時送出），重新讀取後再試一次
    if (putRes.status === 409 || putRes.status === 422) continue;
    const text = await putRes.text();
    throw new Error(`寫入 watchlist.json 失敗（${putRes.status}）：${text.slice(0, 200)}`);
  }
  throw new Error('同時有太多人送出，重試多次後仍衝突，麻煩稍後再試一次');
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }
    if (request.method !== 'POST') {
      return jsonResponse({ ok: false, error: 'Method Not Allowed' }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResponse({ ok: false, error: '請求格式錯誤（不是合法的 JSON）' }, 400);
    }

    const { idToken, phones: rawPhones } = body || {};
    if (!idToken || typeof idToken !== 'string') {
      return jsonResponse({ ok: false, error: '缺少 idToken' }, 400);
    }

    const phones = sanitizePhones(rawPhones);
    if (!phones.length) {
      return jsonResponse({ ok: false, error: '至少要選一支手機' }, 400);
    }

    try {
      const claims = await verifyLineIdToken(idToken, env.LIFF_CHANNEL_ID);
      const lineTargetId = claims.sub;
      if (!lineTargetId) throw new Error('驗證結果裡沒有 LINE User ID');
      const name = (claims.name || 'LINE 使用者').slice(0, 40);

      await upsertSubscriber(env, { name, lineTargetId, phones });

      return jsonResponse({ ok: true, name, phoneCount: phones.length });
    } catch (err) {
      return jsonResponse({ ok: false, error: String((err && err.message) || err) }, 500);
    }
  }
};
