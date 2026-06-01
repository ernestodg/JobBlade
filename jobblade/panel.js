const analyzeBtn = document.getElementById("analyzeBtn");
const closeBtn = document.getElementById("closeBtn");
const statusNode = document.getElementById("status");
const resultNode = document.getElementById("result");
const modelInput = document.getElementById("modelInput");
const resumeSelect = document.getElementById("resumeSelect");

analyzeBtn.addEventListener("click", analyzeVacancy);
closeBtn.addEventListener("click", closePanel);

async function analyzeVacancy() {
  statusNode.textContent = "Reading vacancy text...";
  resultNode.textContent = "";

  try {
    const vacancyText = await requestVacancyText();

    if (!vacancyText || vacancyText.length < 100) {
      statusNode.textContent = "Select the full vacancy text first.";
      return;
    }

    statusNode.textContent = "Loading profile and resume...";

    const profile = await loadTextFile("data/profile.json");
    const resume = await loadTextFile(`data/resumes/${resumeSelect.value}`);
    const prompt = buildPrompt(profile, resume, vacancyText);

    statusNode.textContent = "Asking Ollama...";

    const analysis = await chrome.runtime.sendMessage({
      type: "JOBBLADE_ANALYZE",
      model: modelInput.value.trim(),
      prompt
    });

    if (!analysis?.ok) {
      throw new Error(analysis?.error || "JobBlade could not reach Ollama.");
    }

    resultNode.textContent = formatResponse(analysis.payload?.response);
    statusNode.textContent = "Done.";
  } catch (error) {
    statusNode.textContent = "Error calling Ollama.";
    resultNode.textContent = error.message;
  }
}

function closePanel() {
  window.parent.postMessage({ type: "JOBBLADE_CLOSE_PANEL" }, "*");
}

async function requestVacancyText() {
  const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("Timed out while reading the vacancy text from the page."));
    }, 5000);

    const onMessage = (event) => {
      if (event.source !== window.parent || !event.data) {
        return;
      }

      if (event.data.type === "JOBBLADE_VACANCY_TEXT" && event.data.requestId === requestId) {
        clearTimeout(timeout);
        window.removeEventListener("message", onMessage);
        resolve((event.data.vacancyText || "").trim());
      }
    };

    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "JOBBLADE_REQUEST_VACANCY_TEXT", requestId }, "*");
  });
}

async function loadTextFile(path) {
  const response = await fetch(chrome.runtime.getURL(path));

  if (!response.ok) {
    throw new Error(`Could not load ${path}`);
  }

  return await response.text();
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
  return trimmed || "No response from Ollama.";
}
