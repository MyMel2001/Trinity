(function(){
  if (window.__agentic_v3_installed) return;
  window.__agentic_v3_installed = true;

  // --- Global State & Utilities Initialization ---
  let AI_CONFIG = {
    model: 'gpt-4o-mini',
    maxTokens: 250000,
    temperature: 0.63,
    contextAware: true
  };
  let apiUrl = '';
  let apiKey = '';
  let chatHistory = [];

  // --- Shadow DOM Helper ---
  const $ = (id) => shadow.getElementById(id);

  // --- Local Command Handlers ---
  function handleLocalCommands(message) {
    const lower = message.toLowerCase().trim();
    if (lower === 'settings') { $('tab-settings').click(); return true; }
    if (lower === 'clear chat') { $('chat-log').innerHTML = ''; chatHistory = []; return true; }
    if (lower.startsWith('set api key')) { apiKey = message.substring(11).trim(); addMessage('assistant', 'API key updated (session only).'); return true; }
    if (lower.startsWith('set api url')) { apiUrl = message.substring(11).trim(); addMessage('assistant', 'API URL updated (session only).'); return true; }
    if (lower === 'help') { showHelp(); return true; }
    return false;
  }

  // --- UI: Shadow DOM ---
  const container = document.createElement('div');
  container.id = '__agentic_v3_container';
  container.style = 'position:fixed;right:0;top:0;height:100vh;width:380px;z-index:2147483647;font-family:monospace;pointer-events: none;';
  const shadow = container.attachShadow({mode:'open'});
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      #min-toggle { 
        position: fixed; top: 0; right: 380px; z-index: 2147483647; 
        background:#000; color:#0f0; border:1px solid #073; padding:5px; cursor:pointer;
      }
      .mymel2001-ai-panel { display:flex; flex-direction:column; height:100vh; width:380px; background:#000; color:#0f0; border-left:2px solid #073; overflow:auto; pointer-events: auto;}
      .tabs { display:flex; gap:4px; padding:8px; border-bottom:1px solid #073; }
      .tab { flex:1; padding:8px; background:transparent; color:#0f0; border:none; cursor:pointer; font-weight:700; }
      .tab.active { background:linear-gradient(90deg,#001100,#032); box-shadow:inset 0 -2px 0 #0f6; }
      .content { padding:10px; display:flex; flex-direction:column; flex:1; }
      .chat-log { flex:1; overflow:auto; padding:8px; border:1px solid #062; border-radius:6px; background:#001100; margin-bottom:8px; }
      .entry { margin-bottom:8px; }
      .entry .who { color:#7fff7f; font-weight:700; }
      textarea { width:100%; height:90px; background:#000; color:#0f0; border:1px solid #073; padding:8px; border-radius:6px; font-family:monospace; }
      input { width:100%; background:#000; color:#0f0; border:1px solid #073; padding:6px; border-radius:6px; }
      .row { display:flex; gap:6px; align-items:center; }
      .btn { background:transparent; color:#0f0; border:1px solid #073; padding:8px 10px; border-radius:6px; cursor:pointer; }
      .btn.primary { background:linear-gradient(90deg,#064,#0b6); color:#000; border:none; font-weight:800; }
      .small { font-size:12px; color:#7f9; }
      .hidden { display:none !important; pointer-events: none; }
      button { pointer-events: auto; }
    </style>
    <button id="min-toggle">+/-</button>
    <div id="mymel2001-ai-panel" class="mymel2001-ai-panel hidden">
      <div class="tabs">
        <button id="tab-chat" class="tab active">CHAT</button>
        <button id="tab-settings" class="tab">SETTINGS</button>
      </div>
      <div class="content">
        <div id="chat-view">
          <div id="chat-log" class="chat-log"></div>
          <textarea id="chat-input" placeholder="Ask the agent..."></textarea>
          <div class="row">
            <button id="btn-ask" class="btn primary">Ask Agent</button>
            <button id="btn-clear" class="btn">Clear</button>
          </div>
          <div id="chat-status" class="small"></div>
        </div>
        <div id="settings-view" style="display:none;">
          <div class="small">Endpoint</div>
          <input id="setting-endpoint" placeholder="https://api.openai.com/v1">
          <div class="small">API Key</div>
          <input id="setting-apikey" type="password">
          <div class="small">Model</div>
          <input id="setting-model" placeholder="gpt-4o-mini">
          <div class="small">Temperature</div>
          <input id="setting-temp" type="number" step="0.01" min="0" max="2" value="0.63">
          <div class="row" style="margin-top:8px;">
            <button id="btn-save-settings" class="btn primary">Save</button>
            <button id="btn-ollama" class="btn">Ollama Preset</button>
            <button id="btn-test-endpoint" class="btn">Test</button>
          </div>
          <div id="settings-status" class="small"></div>
        </div>
      </div>
    </div>
  `;

  document.documentElement.appendChild(container);
  const panelWrapper = $('mymel2001-ai-panel');
  const minMax = $('min-toggle');

  // --- Tab Switching ---
  $('tab-chat').onclick = () => { switchTab('chat'); };
  $('tab-settings').onclick = () => { switchTab('settings'); };
  function switchTab(tab) {
    $('tab-chat').classList.toggle('active', tab === 'chat');
    $('tab-settings').classList.toggle('active', tab === 'settings');
    $('chat-view').style.display = tab === 'chat' ? 'flex' : 'none';
    $('settings-view').style.display = tab === 'settings' ? 'block' : 'none';
  }

  // --- Minimize Toggle ---
  minMax.onclick = () => {
    const hidden = panelWrapper.classList.toggle('hidden');
    minMax.style.right = hidden ? '0' : '380px';
  };

  // --- Safe Chrome Storage Access ---
  const storage = chrome.storage.sync;
  const session = chrome.storage.session || chrome.storage.local;

  // --- Load Settings ---
  storage.get(['endpoint_url','api_key','default_model','temperature','context_aware'], cfg => {
    if (cfg.endpoint_url) $('setting-endpoint').value = cfg.endpoint_url;
    if (cfg.api_key) $('setting-apikey').value = cfg.api_key;
    if (cfg.default_model) $('setting-model').value = cfg.default_model;
    $('setting-temp').value = cfg.temperature ?? 0.63;

    apiUrl = cfg.endpoint_url || apiUrl;
    apiKey = cfg.api_key || apiKey;
    AI_CONFIG.model = cfg.default_model || AI_CONFIG.model;
    AI_CONFIG.temperature = cfg.temperature ?? AI_CONFIG.temperature;
    AI_CONFIG.contextAware = cfg.context_aware ?? AI_CONFIG.contextAware;
  });

  // --- Save Settings ---
  $('btn-save-settings').onclick = async () => {
    const endpoint = $('setting-endpoint').value.trim();
    const key = $('setting-apikey').value.trim();
    const model = $('setting-model').value.trim();
    const temp = parseFloat($('setting-temp').value) || 0.63;

    const { normalized } = await new Promise(r => chrome.runtime.sendMessage({type:'normalize_endpoint',url:endpoint}, r));
    const save = { endpoint_url: normalized || endpoint, api_key: key, default_model: model, temperature: temp };
    storage.set(save, () => {
      apiUrl = save.endpoint_url; apiKey = save.api_key;
      AI_CONFIG.model = model; AI_CONFIG.temperature = temp;
      $('settings-status').textContent = 'Saved';
      setTimeout(() => $('settings-status').textContent = '', 3000);
    });
  };

  // --- Presets & Test ---
  $('btn-ollama').onclick = () => {
    $('setting-endpoint').value = 'http://localhost:11434/v1';
    $('setting-apikey').value = '';
    $('setting-model').value = 'llama3.2';
    $('setting-temp').value = '0.63';
  };
  $('btn-test-endpoint').onclick = async () => {
    const url = getChatCompletionsUrl($('setting-endpoint').value.trim());
    const key = $('setting-apikey').value.trim();
    const model = $('setting-model').value.trim() || undefined;
    $('settings-status').textContent = 'Testing...';
    const res = await new Promise(r => chrome.runtime.sendMessage({type:'test_endpoint',url,apiKey:key,model}, r));
    $('settings-status').textContent = res?.ok ? 'OK' : 'Failed';
    setTimeout(() => $('settings-status').textContent = '', 5000);
  };

  // --- Chat Helpers ---
  function addMessage(role, text) {
    const div = document.createElement('div'); div.className = 'entry';
    div.innerHTML = `<div class="who">${role}:</div><div class="what">${text.replace(/\n/g,'<br>')}</div>`;
    $('chat-log').appendChild(div);
    $('chat-log').scrollTop = $('chat-log').scrollHeight;
    if (role === 'user' || role === 'assistant') {
      const clean = text.replace(/ACTION:\s*.+/gi, '').trim();
      if (clean) chatHistory.push({role, content: clean});
    }
  }
  let typingEl = null;
  function showTyping() {
    typingEl = document.createElement('div'); typingEl.className = 'entry';
    typingEl.innerHTML = `<div class="who">assistant:</div><div class="what"><i>typing...</i></div>`;
    $('chat-log').appendChild(typingEl);
  }
  function hideTyping() { if (typingEl) typingEl.remove(); typingEl = null; }

  $('btn-clear').onclick = () => { $('chat-log').innerHTML = ''; chatHistory = []; };

  // --- API URL Normalizer ---
  function getChatCompletionsUrl(base) {
    let u = base.trim().replace(/\/+$/, '');
    if (u.includes('/chat/completions')) return u;
    return u.endsWith('/v1') ? u + '/chat/completions' : u + '/v1/chat/completions';
  }

  // --- Browser Context ---
  function getBrowserContext() {
    return {url: location.href, title: document.title};
  }

  // --- System Prompt ---
  function createSystemPrompt(ctx) {
    return `You are an AI browser agent. Current page: ${ctx.title} (${ctx.url})\n\nRespond conversationally, then add ACTION: lines for browser actions.\nAvailable: NAVIGATE:, SEARCH:, BACK, FORWARD, REFRESH, SCROLL:, FIND:, CLICK:, TYPE:, SELECT_OPTION:, CHECKBOX:, GET_ELEMENT_INFO:, WAIT_FOR_ELEMENT:`;
  }

  // --- Send Chat ---
  async function sendChatMessage() {
    const msg = $('chat-input').value.trim();
    if (!msg) return;
    $('chat-input').value = '';
    addMessage('user', msg);
    if (handleLocalCommands(msg)) return;
    if (!apiKey) { addMessage('assistant', 'Set API key in Settings first.'); return; }

    showTyping();
    try {
      const ctx = getBrowserContext();
      const messages = [{role:'system', content:createSystemPrompt(ctx)}];
      if (AI_CONFIG.contextAware) messages.push(...chatHistory.slice(-20));
      messages.push({role:'user', content:msg});

      const resp = await fetch(getChatCompletionsUrl(apiUrl), {
        method: 'POST',
        headers: {'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
        body: JSON.stringify({model:AI_CONFIG.model, messages, max_tokens:AI_CONFIG.maxTokens, temperature:AI_CONFIG.temperature})
      });
      if (!resp.ok) throw new Error(`API ${resp.status}`);
      const data = await resp.json();
      const answer = data.choices[0].message.content.trim();

      hideTyping();
      const actions = [...answer.matchAll(/ACTION:\s*(.+)/gi)].map(m=>m[1].trim());
      const text = answer.replace(/ACTION:\s*.+/gi,'').trim();
      if (text) addMessage('assistant', text);
      if (actions.length) await executeActionsSequentially(actions);
    } catch (e) {
      hideTyping();
      addMessage('assistant', `Error: ${e.message}`);
    }
  }
  $('btn-ask').onclick = sendChatMessage;
  $('chat-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } });

  // --- Action Execution ---
  async function executeActionsSequentially(actions) {
    for (let i = 0; i < actions.length; i++) {
      try {
        await executeBrowserActionAsync(actions[i]);
        if (i < actions.length - 1) await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        addMessage('assistant', `Action failed: ${err.message}`);
        addMessage('assistant', 'Stopped further actions.');
        break;
      }
    }
  }

  function executeBrowserActionAsync(raw) {
    return new Promise((resolve, reject) => {
      const cmd = raw.toUpperCase().trim();
      let executed = false;

      // --- Direct DOM Access (Chrome Extension) ---
      const runInPageContext = (script) => {
        const s = document.createElement('script');
        s.textContent = `try { (${script})() } catch(e) { console.error(e) }`;
        document.documentElement.appendChild(s);
        s.remove();
      };

      // --- NAVIGATE ---
      if (cmd.startsWith('NAVIGATE:')) {
        const url = raw.substring(9).trim();
        location.href = url;
        resolve('Navigating...');
        executed = true;
      }
      // --- SEARCH ---
      else if (cmd.startsWith('SEARCH:')) {
        const query = raw.substring(7).trim();
        location.href = `https://search.sparksammy.com/search.php?q=${encodeURIComponent(query)}`;
        resolve('Searching...');
        executed = true;
      }
      // --- BACK / FORWARD / REFRESH ---
      else if (cmd === 'BACK') { history.back(); resolve(); executed = true; }
      else if (cmd === 'FORWARD') { history.forward(); resolve(); executed = true; }
      else if (cmd === 'REFRESH') { location.reload(); resolve(); executed = true; }
      // --- SCROLL ---
      else if (cmd.startsWith('SCROLL:')) {
        const dir = raw.substring(7).trim().toLowerCase();
        const map = { up: -500, down: 500, top: 0, bottom: 'document.body.scrollHeight' };
        if (map[dir] !== undefined) {
          const y = map[dir] === 0 ? 0 : (map[dir] === 'document.body.scrollHeight' ? map[dir] : `window.scrollY + ${map[dir]}`);
          runInPageContext(`window.scrollTo(0, ${y});`);
          resolve();
        } else {
          reject(new Error(`Invalid SCROLL direction: ${dir}`));
        }
        executed = true;
      }
      // --- FIND ---
      else if (cmd.startsWith('FIND:')) {
        const text = raw.substring(5).trim();
        runInPageContext(`window.find("${text.replace(/"/g,'\\"')}");`);
        resolve();
        executed = true;
      }
      // --- CLICK ---
      else if (cmd.startsWith('CLICK:')) {
        const desc = raw.substring(6).trim();
        const script = createBrowserActionScript('click', desc);
        runInPageContext(script);
        resolve();
        executed = true;
      }
      // --- TYPE ---
      else if (cmd.startsWith('TYPE:')) {
        const parts = raw.substring(5).trim().split('|');
        if (parts.length < 2) return reject(new Error('TYPE needs |text'));
        const desc = parts[0].trim(), text = parts[1].trim();
        const script = createBrowserActionScript('type', desc, text);
        runInPageContext(script);
        resolve();
        executed = true;
      }
      // --- SELECT_OPTION ---
      else if (cmd.startsWith('SELECT_OPTION:')) {
        const parts = raw.substring(14).trim().split('|');
        if (parts.length < 2) return reject(new Error('SELECT_OPTION needs |option'));
        const desc = parts[0].trim(), opt = parts[1].trim();
        const script = createBrowserActionScript('select', desc, opt);
        runInPageContext(script);
        resolve();
        executed = true;
      }
      // --- CHECKBOX ---
      else if (cmd.startsWith('CHECKBOX:')) {
        const parts = raw.substring(9).trim().split('|');
        const desc = parts[0].trim(), action = (parts[1] || 'toggle').trim().toLowerCase();
        const script = createBrowserActionScript('checkbox', desc, action);
        runInPageContext(script);
        resolve();
        executed = true;
      }
      // --- GET_ELEMENT_INFO ---
      else if (cmd.startsWith('GET_ELEMENT_INFO:')) {
        const desc = raw.substring(17).trim();
        const script = createBrowserActionScript('info', desc);
        runInPageContext(script);
        resolve();
        executed = true;
      }
      // --- WAIT_FOR_ELEMENT ---
      else if (cmd.startsWith('WAIT_FOR_ELEMENT:')) {
        const desc = raw.substring(17).trim();
        const script = createBrowserActionScript('wait', desc);
        runInPageContext(script);
        resolve();
        executed = true;
      }

      if (!executed) reject(new Error(`Unknown action: ${raw}`));
    });
  }

  // --- Heuristic Script Generator (All Actions) ---
  function createBrowserActionScript(type, desc, value = '') {
    const esc = s => s.replace(/"/g, '\\"').replace(/`/g, '\\`');
    const d = esc(desc), v = esc(value);

    if (type === 'click') {
      return `(function(){
        const txt = "${d}".toLowerCase();
        const els = [...document.querySelectorAll('*')].filter(e => e.offsetParent !== null);
        const el = els.find(e => 
          (e.textContent||'').toLowerCase().includes(txt) || 
          (e.id||'') === txt || 
          (e.getAttribute('aria-label')||'').toLowerCase().includes(txt) ||
          (e.getAttribute('name')||'').toLowerCase().includes(txt)
        );
        if (el) { el.click(); return 'Clicked'; }
        return 'Not found';
      })`;
    }
    if (type === 'type') {
      return `(function(){
        const txt = "${d}".toLowerCase();
        const el = [...document.querySelectorAll('input,textarea')].find(e => 
          (e.placeholder||'').toLowerCase().includes(txt) || 
          (e.id||'') === txt || 
          (e.name||'').toLowerCase().includes(txt)
        );
        if (el) {
          el.focus(); el.value = "${v}"; 
          el.dispatchEvent(new Event('input', {bubbles:true})); 
          el.dispatchEvent(new Event('change', {bubbles:true}));
          return 'Typed';
        }
        return 'Not found';
      })`;
    }
    if (type === 'select') {
      return `(function(){
        const txt = "${d}".toLowerCase();
        const sel = [...document.querySelectorAll('select')].find(e => 
          (e.labels?.[0]?.textContent||'').toLowerCase().includes(txt) || 
          (e.id||'') === txt || 
          (e.name||'').toLowerCase().includes(txt)
        );
        if (sel) {
          const opt = [...sel.options].find(o => 
            o.text.toLowerCase().includes("${v}".toLowerCase()) || 
            o.value.toLowerCase().includes("${v}".toLowerCase())
          );
          if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change',{bubbles:true})); return 'Selected'; }
        }
        return 'Not found';
      })`;
    }
    if (type === 'checkbox') {
      return `(function(){
        const txt = "${d}".toLowerCase();
        const cb = [...document.querySelectorAll('input[type="checkbox"]')].find(e => 
          (e.labels?.[0]?.textContent||'').toLowerCase().includes(txt) || 
          (e.id||'') === txt || 
          (e.name||'').toLowerCase().includes(txt)
        );
        if (cb) {
          const act = "${v}";
          if (act === 'check') cb.checked = true;
          else if (act === 'uncheck') cb.checked = false;
          else cb.checked = !cb.checked;
          cb.dispatchEvent(new Event('change',{bubbles:true}));
          return 'Checkbox updated';
        }
        return 'Not found';
      })`;
    }
    if (type === 'info') {
      return `(function(){
        const txt = "${d}".toLowerCase();
        const els = [...document.querySelectorAll('*')].filter(e => 
          (e.textContent||'').toLowerCase().includes(txt) || 
          (e.id||'') === txt
        );
        if (els.length) return JSON.stringify(els.slice(0,3).map(e=>({tag:e.tagName,id:e.id,class:e.className,text:e.textContent.slice(0,50)})));
        return 'No elements';
      })`;
    }
    if (type === 'wait') {
      return `(function(){
        const txt = "${d}".toLowerCase();
        const max = 10000, step = 500;
        return new Promise((res, rej) => {
          const start = Date.now();
          const check = () => {
            const found = [...document.querySelectorAll('*')].some(e => 
              e.offsetParent !== null && 
              ((e.textContent||'').toLowerCase().includes(txt) || (e.id||'') === txt)
            );
            if (found) return res('Found');
            if (Date.now() - start > max) return rej('Timeout');
            setTimeout(check, step);
          };
          check();
        }).catch(() => 'Wait failed');
      })`;
    }
    return `() => 'Unsupported'`;
  }

  // --- Help ---
  function showHelp() {
    const help = `AI Agent Help (Chrome Extension)

Commands: settings, clear chat, set api key X, set api url Y, help

Examples:
- "go to google.com"
- "search for cats"
- "click login"
- "type hello in search box"
- "select USA in country"
- "check remember me"
- "wait for submit"
- "get info for profile"`;
    addMessage('assistant', help);
  }

  // --- External Messages ---
  chrome.runtime.onMessage.addListener((m, _, send) => {
    if (m.type === 'focusSidebar') { container.scrollIntoView(); send({ok:true}); }
    else if (m.type === 'run_actions') {
      executeActionsSequentially(m.actions || []).then(() => send({ok:true}));
      return true;
    }
  });

  // --- Quick Prompt (Fixed Storage Access) ---
  (async () => {
    try {
      const res = await new Promise((resolve, reject) => {
        session.get(['agentic_quick_prompt'], resolve);
      });
      if (res?.agentic_quick_prompt?.prompt) {
        $('chat-input').value = res.agentic_quick_prompt.prompt;
        await new Promise(r => session.remove('agentic_quick_prompt', r));
      }
    } catch (e) {
      console.warn('Quick prompt failed:', e);
    }
  })();
})();
