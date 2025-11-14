
// background.js - service worker
const DEFAULT_HEADERS = { "Content-Type": "application/json" };

async function getSettings() {
  return new Promise((res) => {
    chrome.storage.sync.get({
      endpoint_url: "",
      api_key: "",
      default_model: "",
      temperature: 0.63,
      allowed_actions: ["click","type","fill","navigate","scroll","openTab","closeTab","extractText","highlight","evaluate_js"],
      allow_auto_execute: false
    }, (items) => res(items));
  });
}

// Normalize endpoint: if user provided base like https://api.openai.com/v1, append /chat/completions
function normalizeEndpoint(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    // common target path
    if (!u.pathname.endsWith("/chat/completions")) {
      // if it seems like a base (endswith /v1 or /v1/), append chat/completions
      if (u.pathname === "/" || u.pathname.endsWith("/v1") || u.pathname.endsWith("/v1/")) {
        u.pathname = (u.pathname.replace(/\/$/, "") + "/chat/completions");
      } else if (!u.pathname.includes("chat") && !u.pathname.includes("completions")) {
        // if truly bare, append chat/completions
        u.pathname = u.pathname.replace(/\/$/, "") + "/chat/completions";
      } else {
        // leave as-is if it already references completions in another shape
      }
    }
    return u.toString();
  } catch (e) {
    // not a valid absolute URL; try to heuristically append
    if (url.endsWith("/chat/completions")) return url;
    if (url.endswith) return url + "/chat/completions";
    return url + "/chat/completions";
  }
}

// Test endpoint: send small request and return status + text
async function testEndpointRaw(endpoint, apiKey, model) {
  const body = {
    model: model || "gpt-4o-mini",
    messages: [{ role: "system", content: "Reply with a short single token 'pong'." }, { role: "user", content: "ping" }],
    temperature: 0
  };
  const headers = { ...DEFAULT_HEADERS };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  const resp = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
  const txt = await resp.text().catch(()=>"[no body]");
  return { ok: resp.ok, status: resp.status, text: txt };
}

async function callRemoteAgent(endpoint, apiKey, body) {
  const headers = { ...DEFAULT_HEADERS };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  const resp = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await resp.text().catch(()=>"");
  let json;
  try { json = JSON.parse(text); } catch(e){ json = null; }
  return { ok: resp.ok, status: resp.status, text, json };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === "normalize_endpoint") {
        const out = normalizeEndpoint(message.url || "");
        sendResponse({ ok: true, normalized: out });
      } else if (message.type === "test_endpoint") {
        const { url, apiKey, model } = message;
        const normalized = normalizeEndpoint(url || "");
        const res = await testEndpointRaw(normalized, apiKey, model);
        sendResponse({ ok: true, normalized, result: res });
      } else if (message.type === "call_agent") {
        const settings = await getSettings();
        const endpoint = normalizeEndpoint(message.endpoint || settings.endpoint_url || "");
        const apiKey = message.api_key || settings.api_key || "";
        const model = message.model || settings.default_model || "gpt-4o-mini";
        const payload = {
          model,
          messages: [
            { role: "system", content: "You are a browser assistant that MUST output valid JSON: an array of action objects. Allowed actions: click, type, fill, navigate, scroll, openTab, closeTab, extractText, highlight, evaluate_js, and say. Respond only with JSON. You are allowed to use the say action to say something." },
            { role: "user", content: message.prompt }
          ],
          temperature: message.temperature ?? settings.temperature ?? 0.63,
          max_tokens: message.max_tokens ?? 800
        };
        const resp = await callRemoteAgent(endpoint, apiKey, payload);
        sendResponse({ ok: true, endpoint, status: resp.status, raw_text: resp.text, json: resp.json });
      } else {
        sendResponse({ ok: false, error: "unknown message type" });
      }
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
  })();
  return true;
});
