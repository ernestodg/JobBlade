# ARCHITECTURE

- The MVP is a plain Chrome/Brave extension built with Manifest V3 and no framework.
- Vacancy text is captured from the active tab via a content script and `window.getSelection()`.
- The popup loads local extension assets for candidate profile and resume variants.
- Ollama is called directly over `http://localhost:11434/api/generate`.
- The extension stays local-only: no cloud services, no login, no database, no React.
