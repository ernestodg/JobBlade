document.getElementById("analyzeBtn").addEventListener("click", analyzeVacancy);

async function analyzeVacancy() {
  const status = document.getElementById("status");
  const result = document.getElementById("result");
  const model = document.getElementById("modelInput").value.trim();
  const resumeFile = document.getElementById("resumeSelect").value;

  status.textContent = "Getting selected text...";
  result.textContent = "";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      throw new Error("Could not find the active tab.");
    }

    const vacancyText = await getVacancyText(tab.id);

    if (!vacancyText || vacancyText.length < 100) {
      status.textContent = "Select the full vacancy text first.";
      return;
    }

    status.textContent = "Loading profile and resume...";

    const profile = await loadTextFile("data/profile.json");
    const resume = await loadTextFile(`data/resumes/${resumeFile}`);
    const prompt = buildPrompt(profile, resume, vacancyText);

    status.textContent = "Asking Ollama...";

    const ollamaResponse = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0.2
        }
      })
    });

    if (!ollamaResponse.ok) {
      const errorBody = await ollamaResponse.text();
      if (ollamaResponse.status === 403) {
        throw new Error(
          `Ollama rejected the browser request with 403. This usually means Ollama is blocking the extension origin. Restart Ollama with an allowed origin for your extension, or temporarily allow all origins. ${errorBody ? `Details: ${errorBody}` : ""}`.trim()
        );
      }

      throw new Error(
        `Ollama error: ${ollamaResponse.status}${errorBody ? ` - ${errorBody}` : ""}`
      );
    }

    const data = await ollamaResponse.json();
    result.textContent = formatResponse(data.response);
    status.textContent = "Done.";
  } catch (error) {
    status.textContent = "Error calling Ollama.";
    result.textContent = error.message;
  }
}

async function loadTextFile(path) {
  const url = chrome.runtime.getURL(path);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Could not load ${path}`);
  }

  return await response.text();
}

async function getSelectedText(tabId) {
  const selectedText = await readSelectionFromPage(tabId);

  if (selectedText.length >= 100) {
    return selectedText;
  }

  return selectedText;
}

async function getVacancyText(tabId) {
  const selectedText = await getSelectedText(tabId);

  if (selectedText.length >= 100) {
    return selectedText;
  }

  return await readVacancyTextFromPage(tabId);
}

async function readSelectionFromPage(tabId) {
  const injected = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.getSelection().toString().trim()
  });

  return pickBestSelection(injected);
}

async function readVacancyTextFromPage(tabId) {
  const injected = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const normalizeText = (text) => text.replace(/\s+/g, " ").trim();
      const selectedText = window.getSelection().toString().trim();

      if (selectedText.length >= 100) {
        return selectedText;
      }

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

      const candidates = selectors
        .map((selector) => document.querySelector(selector))
        .filter(Boolean)
        .map((element) => normalizeText(element.innerText || element.textContent || ""))
        .filter((text) => text.length >= 100);

      if (candidates.length) {
        return candidates.sort((left, right) => right.length - left.length)[0];
      }

      return normalizeText(document.body?.innerText || document.body?.textContent || "");
    }
  });

  return pickBestSelection(injected);
}

function pickBestSelection(results) {
  if (!Array.isArray(results) || !results.length) {
    return "";
  }

  return results
    .map((entry) => entry?.result?.trim() || "")
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0] || "";
}

function buildPrompt(profileJson, resumeMarkdown, vacancyText) {
  return `
You are JobBlade, a brutally practical job vacancy evaluator.

You evaluate job vacancies for this candidate using the profile, resume, and decision rules below.

You must be direct, critical, and realistic. Do not encourage applying unless the probability and strategic fit justify it.

Return plain text with these exact sections:

# Verdict: GREEN / YELLOW / ORANGE / RED

## Overall Score: X/10

## Summary
One short paragraph.

## Fit Analysis
- Skills Match:
- Domain Match:
- Seniority Match:
- Location / Remote / Relocation:
- Salary Potential:

## Strong Matches
- Bullet points.

## Red Flags
- Bullet points.

## Salary Estimate
Give realistic estimates in:
- USD yearly
- USD monthly
- EUR yearly
- DKK monthly

If salary cannot be estimated, say "Estimate only".

## Interview Probability
Give percentage estimate.

## Offer Probability
Give percentage estimate.

## Final Recommendation
Say APPLY or PASS clearly.

## Optional Cover Letter Draft
Only include if the role is a strong fit.

DECISION RULES:
- GREEN means apply immediately.
- YELLOW means apply if quick or if pipeline needs more options.
- ORANGE means low probability or weak strategic fit.
- RED means pass.
- If Danish fluency is required and candidate does not speak Danish, verdict must be RED.
- If Denmark job requires existing Danish residency/work permit, verdict must be RED.
- If Denmark job explicitly says no relocation support, verdict should usually be RED.
- If role is mainly cloud engineering, FinOps, DevOps, SRE, quant research, marketing attribution, or pure product management, downgrade heavily.
- Favor roles involving SQL, Power BI, dashboards, reporting, KPIs, stakeholder management, business analysis, CRM, data governance, and operational analytics.

CANDIDATE PROFILE JSON:
${profileJson}

SELECTED RESUME VERSION:
${resumeMarkdown}

VACANCY TEXT:
${vacancyText}
`;
}

function formatResponse(responseText) {
  const trimmed = (responseText || "").trim();

  if (!trimmed) {
    return "No response from Ollama.";
  }

  return trimmed;
}
