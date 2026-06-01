# DEVLOG

## 2026-06-01
- Created the JobBlade MVP scaffold under `jobblade/`.
- Added the candidate profile JSON and three resume variants.
- Added popup, content script, manifest, and styling for the local Ollama vacancy analysis flow.
- Switched the popup's default Ollama model to `llama3.1:latest` for a better general-purpose evaluation baseline.
- Fixed the popup selection fallback to stay compatible with `chrome.scripting.executeScript` in Chrome/Brave.
- Added a LinkedIn-aware vacancy-text extractor that falls back from selection capture to page text.
- Improved the Ollama error path to explain 403 origin rejections from the browser.
- Removed `chrome.storage.session` writes from the content script to avoid extension-context invalidation on LinkedIn.
- Wrapped LinkedIn DOM reads in defensive try/catch blocks so content script failures no longer bubble as uncaught errors.
- Removed the persistent content script and switched JobBlade to one-shot page injection from the popup only.
- Reworked JobBlade into a persistent in-page panel opened from the toolbar button so results stay visible on the page.
- Removed runtime messaging and manifest auto-injection so the panel opens only through one-shot script execution from the toolbar click.
- Moved Ollama requests into the background service worker to avoid page-context fetch failures and refreshed the panel typography/select styling.
- Switched the Ollama background request to `127.0.0.1` and strengthened the panel color overrides for the title and resume select.
- Switched the default model to `qwen2.5:7b` after verifying it runs locally, and moved the panel into a Shadow DOM so page CSS no longer overrides it.
- Added versioned cleanup so a new injected JobBlade panel replaces stale in-page copies instead of reusing outdated scripts and styles.
- Replaced the injected extension-context panel with a page bridge + extension iframe panel (`panel.html`/`panel.js`) to eliminate extension-context invalidation from in-page runtime logic.
- Updated the JobBlade panel to a light theme while preserving blue accent styling.
- Added explicit cache-busting version parameters for `panel.html`, `panel.css`, and `panel.js` to force fresh theme assets.
