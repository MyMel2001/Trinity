
Agentic Sidebar v3
- Full browser actions handled in-page (click, type, fill, navigate, scroll, openTab, closeTab, extractText, highlight, evaluate_js)
- Endpoint auto-correction: it will append /chat/completions if your endpoint looks like a base
- Temperature default 0.63
Installation:
1. chrome://extensions -> Developer mode -> Load unpacked -> select this folder
2. Open options or the sidebar (icon -> Focus Sidebar). In Settings tab, save endpoint, model, and key.
3. Use Chat tab to ask agent. Parsed actions show under 'Parsed actions' and allow preview/run.
Security:
- Per-action confirmation required for running actions
- Allowed actions whitelist to reduce risk
