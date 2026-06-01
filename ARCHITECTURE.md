# ARCHITECTURE

- The MVP is a plain Chrome/Brave extension built with Manifest V3 and no framework.
- The toolbar click injects a lightweight page bridge plus an extension iframe panel for persistent on-page UI.
- Vacancy text is captured from the page bridge using selection-first extraction with LinkedIn-aware fallbacks.
- The panel loads local extension assets for candidate profile and one selected resume variant.
- Ollama calls run through the background service worker over `http://127.0.0.1:11434/api/generate` with localhost fallback.
- Job evaluation is strictly two-step:
	1. Fact extraction (JSON-only parser prompt, temperature 0).
	2. Evaluation (evidence-constrained scoring prompt, temperature 0.1).
- Local JS validation guards extraction output and blocks evaluation on schema/parse failure.
- A local evidence gate clears unsupported hard-rejection flags when evidence strings are absent.
- Result sanity checks warn on likely contamination (for example Danish/Copenhagen/company mismatch).
- Cover letter generation is an explicit separate action and is never part of standard evaluation output.
- The extension stays local-only: no cloud services, no login, no database, no React.
