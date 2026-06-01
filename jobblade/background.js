chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) {
    return;
  }

  try {
    const assetVersion = "2026-06-01-12";
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: injectOrToggleJobBladePanel,
      args: [chrome.runtime.getURL(`panel.html?v=${assetVersion}`), assetVersion]
    });
  } catch (injectionError) {
    console.error("JobBlade could not open on this page.", injectionError);
  }
});

function injectOrToggleJobBladePanel(panelUrl, version) {
  const existing = window.__jobbladePageBridge;

  if (existing && existing.version === version) {
    const host = existing.host;
    host.style.display = host.style.display === "none" ? "block" : "none";
    return;
  }

  if (existing && typeof existing.cleanup === "function") {
    existing.cleanup();
  }

  const host = document.createElement("div");
  host.id = "jobblade-panel-host";
  host.style.position = "fixed";
  host.style.top = "18px";
  host.style.right = "18px";
  host.style.width = "min(460px, calc(100vw - 36px))";
  host.style.height = "calc(100vh - 36px)";
  host.style.zIndex = "2147483647";
  host.style.border = "0";
  host.style.background = "transparent";

  const iframe = document.createElement("iframe");
  iframe.src = panelUrl;
  iframe.title = "JobBlade";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "0";
  iframe.style.background = "transparent";
  iframe.style.borderRadius = "20px";
  host.appendChild(iframe);
  document.documentElement.appendChild(host);

  const selectors = [
    "article",
    "main",
    "[role='main']",
    ".jobs-search__job-details--container",
    ".jobs-description__content",
    ".jobs-box__html-content",
    ".jobs-description-content",
    ".jobs-description-content__text",
    ".job-details-jobs-unified-top-card__content",
    ".job-details-jobs-unified-top-card__primary-description"
  ];

  const normalizeText = (text) => text.replace(/\s+/g, " ").trim();

  const getVacancyText = () => {
    const selectedText = normalizeText(window.getSelection()?.toString() || "");

    if (selectedText.length >= 100) {
      return selectedText;
    }

    const candidates = selectors
      .map((selector) => document.querySelector(selector))
      .filter(Boolean)
      .map((element) => normalizeText(element.innerText || element.textContent || ""))
      .filter((text) => text.length >= 100);

    if (candidates.length) {
      return candidates.sort((left, right) => right.length - left.length)[0];
    }

    return normalizeText(document.body?.innerText || document.body?.textContent || "");
  };

  const handleMessage = (event) => {
    if (event.source !== iframe.contentWindow || !event.data) {
      return;
    }

    if (event.data.type === "JOBBLADE_REQUEST_VACANCY_TEXT") {
      iframe.contentWindow.postMessage(
        {
          type: "JOBBLADE_VACANCY_TEXT",
          requestId: event.data.requestId,
          vacancyText: getVacancyText()
        },
        "*"
      );
    }

    if (event.data.type === "JOBBLADE_CLOSE_PANEL") {
      host.style.display = "none";
    }

    if (event.data.type === "JOBBLADE_RESET_PANEL") {
      const bridge = window.__jobbladePageBridge;
      if (bridge && typeof bridge.cleanup === "function") {
        bridge.cleanup();
      }
      injectOrToggleJobBladePanel(panelUrl, version);
    }
  };

  window.addEventListener("message", handleMessage);

  window.__jobbladePageBridge = {
    version,
    host,
    iframe,
    cleanup() {
      window.removeEventListener("message", handleMessage);
      host.remove();
      delete window.__jobbladePageBridge;
    }
  };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.type !== "JOBBLADE_OLLAMA_CALL" && request?.type !== "JOBBLADE_ANALYZE") {
    return;
  }

  callOllama(request)
    .then((payload) => sendResponse({ ok: true, payload }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});

async function callOllama(request) {
  let ollamaResponse;
  let lastFetchError = null;

  const requestBody = {
    model: request.model,
    stream: request.stream === true,
    options: {
      temperature: typeof request.temperature === "number" ? request.temperature : 0.1
    }
  };

  if (typeof request.systemPrompt === "string" && request.systemPrompt.trim()) {
    requestBody.system = request.systemPrompt;
  }

  if (typeof request.userPrompt === "string" && request.userPrompt.trim()) {
    requestBody.prompt = request.userPrompt;
  } else if (typeof request.prompt === "string" && request.prompt.trim()) {
    requestBody.prompt = request.prompt;
  }

  if (!requestBody.prompt) {
    throw new Error("Missing prompt for Ollama request.");
  }

  for (const baseUrl of ["http://127.0.0.1:11434", "http://localhost:11434"]) {
    try {
      ollamaResponse = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });
      break;
    } catch (error) {
      lastFetchError = error;
    }
  }

  if (!ollamaResponse) {
    throw new Error(
      `Failed to reach Ollama on 127.0.0.1 or localhost. ${lastFetchError?.message || "Reload the extension and refresh the job page."}`.trim()
    );
  }

  if (!ollamaResponse.ok) {
    const errorBody = await ollamaResponse.text();

    if (ollamaResponse.status === 403) {
      throw new Error(
        `Ollama rejected the browser request with 403. This usually means Ollama is blocking the extension origin. Restart Ollama with an allowed origin for your extension, or temporarily allow all origins. ${errorBody ? `Details: ${errorBody}` : ""}`.trim()
      );
    }

    if (errorBody && /requires more system memory/i.test(errorBody)) {
      throw new Error(
        `The selected model is too large for available memory. Switch the Ollama model to qwen2.5:7b or llama3:latest. Details: ${errorBody}`
      );
    }

    throw new Error(
      `Ollama error: ${ollamaResponse.status}${errorBody ? ` - ${errorBody}` : ""}`
    );
  }

  const data = await ollamaResponse.json();
  return { response: data.response || "No response from Ollama." };
}
