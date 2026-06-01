const analyzeBtn = document.getElementById("analyzeBtn");
const coverLetterBtn = document.getElementById("coverLetterBtn");
const closeBtn = document.getElementById("closeBtn");
const infoNode = document.getElementById("info");
const statusNode = document.getElementById("status");
const warningsNode = document.getElementById("warnings");
const resultNode = document.getElementById("result");
const debugFactsNode = document.getElementById("debugFacts");
const coverLetterResultNode = document.getElementById("coverLetterResult");
const analysisSummaryNode = document.getElementById("analysisSummary");
const coverLetterSummaryNode = document.getElementById("coverLetterSummary");
const openAnalysisReportBtn = document.getElementById("openAnalysisReportBtn");
const openCoverLetterReportBtn = document.getElementById("openCoverLetterReportBtn");
const reportModalNode = document.getElementById("reportModal");
const reportModalTitleNode = document.getElementById("reportModalTitle");
const reportModalBodyNode = document.getElementById("reportModalBody");
const closeModalBtn = document.getElementById("closeModalBtn");
const modelInput = document.getElementById("modelInput");
const profileSelect = document.getElementById("profileSelect");
const resumeSelect = document.getElementById("resumeSelect");

analyzeBtn.addEventListener("click", analyzeVacancy);
coverLetterBtn.addEventListener("click", generateCoverLetter);
closeBtn.addEventListener("click", closePanel);
openAnalysisReportBtn.addEventListener("click", () => openReportModal("Analysis Report", lastAnalysisReportHtml));
openCoverLetterReportBtn.addEventListener("click", () => openReportModal("Cover Letter", lastCoverLetterReportHtml));
closeModalBtn.addEventListener("click", closeReportModal);
reportModalNode.addEventListener("click", (event) => {
  if (event.target === reportModalNode) {
    closeReportModal();
  }
});

let lastJobFacts = null;
let lastVacancyText = "";
let lastResumeMarkdown = "";
let lastProfilePath = "data/profile.json";
let lastResetRequestAt = 0;
let lastAnalysisReportHtml = "";
let lastCoverLetterReportHtml = "";

const DEFAULT_PROFILE_PATH = "data/profile.json";
const AI_AUTOMATION_PROFILE_PATH = "data/profile_ai_automation.json";
const DEFAULT_RESUME_FILE = "business_analyst.md";
const DATA_ANALYST_RESUME_FILE = "data_analyst.md";
const BI_ANALYST_RESUME_FILE = "bi_analyst.md";
const AI_AUTOMATION_RESUME_FILE = "ai_automation_software.md";

const AI_AUTOMATION_TRIGGER_KEYWORDS = [
  "ai tools",
  "automation",
  "software development",
  "internal tools",
  "agents",
  "llm",
  "copilot",
  "ollama",
  "python automation",
  "workflow systems",
  "technical business analysis",
  "agentic",
  "ai implementation",
  "prompt engineering",
  "rag",
  "technical business analyst"
];

const BI_RESUME_TRIGGER_KEYWORDS = [
  "power bi",
  "dashboard",
  "reporting",
  "kpi",
  "business intelligence",
  "data governance"
];

const DATA_RESUME_TRIGGER_KEYWORDS = [
  "data analyst",
  "analytics",
  "sql",
  "python",
  "data model",
  "data quality",
  "data pipeline"
];

const FACT_EXTRACTION_SYSTEM_PROMPT = `You are a job vacancy parser.

Your only job is to extract facts from a vacancy.

Rules:
1. Only use information explicitly present in the vacancy.
2. Never infer.
3. Never guess.
4. Never use previous vacancies.
5. Never use prior conversation context.
6. If information is not present, use null.
7. Output JSON only.
8. No explanations.
9. No markdown.
10. No comments.`;

const EVALUATION_SYSTEM_PROMPT = `You are a job evaluator.

Your job is to evaluate a vacancy against a candidate profile.

Rules:
1. Use only the candidate profile, selected resume, extracted facts, and vacancy text.
2. Never invent requirements.
3. Never invent relocation issues.
4. Never invent language requirements.
5. Every red flag must be supported by evidence.
6. If evidence does not exist, do not mention it.
7. Be critical.
8. Prefer accuracy over optimism.
9. Judge fit, not possibility.
10. Do not recommend a job simply because the candidate could learn it.
11. Never refer to previous vacancies.
12. Never mention companies not present in the vacancy.
13. Never generate a cover letter unless explicitly requested.
14. Do not confuse practical AI automation experience with academic machine learning expertise. The candidate is strongest in applied AI workflows, agent-assisted development, automation, and business systems, not PhD-level ML research.`;

async function analyzeVacancy() {
  statusNode.textContent = "Reading vacancy text...";
  infoNode.textContent = "";
  warningsNode.textContent = "";
  resultNode.textContent = "";
  resultNode.classList.add("jb-hidden");
  coverLetterResultNode.textContent = "";
  coverLetterResultNode.classList.add("jb-hidden");
  analysisSummaryNode.innerHTML = "";
  analysisSummaryNode.classList.add("jb-hidden");
  coverLetterSummaryNode.innerHTML = "";
  coverLetterSummaryNode.classList.add("jb-hidden");
  openAnalysisReportBtn.disabled = true;
  openCoverLetterReportBtn.disabled = true;
  lastAnalysisReportHtml = "";
  lastCoverLetterReportHtml = "";

  try {
    const vacancyText = await requestVacancyText();
    lastVacancyText = vacancyText;

    if (!vacancyText || vacancyText.length < 100) {
      statusNode.textContent = "Select the full vacancy text first.";
      return;
    }

    statusNode.textContent = "Loading profile and resume...";

    const profileSelection = resolveProfileSelection(vacancyText, profileSelect?.value || "auto");
    lastProfilePath = profileSelection.path;
    const profile = await loadTextFile(profileSelection.path);
    const resumeSelection = resolveResumeSelection(
      vacancyText,
      resumeSelect?.value || "auto",
      profileSelection.path
    );
    const resume = await loadTextFile(`data/resumes/${resumeSelection.file}`);
    lastResumeMarkdown = resume;

    statusNode.textContent = "Extracting vacancy facts...";
    const extractedFacts = await extractJobFacts(vacancyText, modelInput.value.trim());
    const validation = validateJobFacts(extractedFacts, vacancyText);

    if (!validation.ok) {
      throw new Error(`Fact extraction failed: ${validation.errors.join(" ")}`.trim());
    }

    const gatedFacts = applyEvidenceGate(validation.jobFacts);
    lastJobFacts = gatedFacts;
    debugFactsNode.textContent = JSON.stringify(gatedFacts, null, 2);

    infoNode.textContent = [profileSelection.notice, resumeSelection.notice].join("\n");
    const warnings = [...validation.warnings];

    statusNode.textContent = "Evaluating vacancy...";
    const evaluationText = await evaluateJob(profile, resume, vacancyText, gatedFacts, modelInput.value.trim());
    warnings.push(...sanityCheckResult(evaluationText, gatedFacts));

    const parsedAnalysis = parseAnalysisResult(evaluationText);
    renderAnalysisSummary(parsedAnalysis, gatedFacts);
    lastAnalysisReportHtml = buildAnalysisReportHtml(parsedAnalysis, gatedFacts, evaluationText);
    openAnalysisReportBtn.disabled = false;

    warningsNode.textContent = warnings.length ? warnings.join("\n") : "";
    resultNode.textContent = formatResponse(evaluationText);
    resultNode.classList.add("jb-hidden");
    statusNode.textContent = "Done.";
  } catch (error) {
    if (handleContextInvalidation(error)) {
      return;
    }
    statusNode.textContent = "Error calling Ollama.";
    resultNode.textContent = error.message;
  }
}

async function generateCoverLetter() {
  warningsNode.textContent = "";
  coverLetterResultNode.textContent = "";
  coverLetterSummaryNode.innerHTML = "";
  coverLetterSummaryNode.classList.add("jb-hidden");
  openCoverLetterReportBtn.disabled = true;

  try {
    if (!lastVacancyText || !lastResumeMarkdown || !lastJobFacts) {
      throw new Error("Run Analyze first so JobBlade can extract facts.");
    }

    const company = (lastJobFacts.company || "").trim();
    const jobTitle = (lastJobFacts.job_title || "").trim();

    if (!company || !jobTitle) {
      throw new Error("Cannot generate cover letter: extracted company and job title are required.");
    }

    statusNode.textContent = "Generating cover letter...";
    const responseText = await sendOllamaPrompt({
      model: modelInput.value.trim(),
      systemPrompt: "You are a professional cover letter writer. Use only the provided vacancy and resume. Do not invent company names or role titles.",
      userPrompt: buildCoverLetterPrompt(company, jobTitle, lastVacancyText, lastResumeMarkdown),
      temperature: 0.2
    });

    const cleanCoverLetter = formatResponse(responseText);
    coverLetterResultNode.textContent = cleanCoverLetter;
    coverLetterResultNode.classList.add("jb-hidden");
    renderCoverLetterSummary(cleanCoverLetter, company, jobTitle);
    lastCoverLetterReportHtml = buildCoverLetterReportHtml(cleanCoverLetter, company, jobTitle);
    openCoverLetterReportBtn.disabled = false;
    statusNode.textContent = "Cover letter generated.";
  } catch (error) {
    if (handleContextInvalidation(error)) {
      return;
    }
    statusNode.textContent = "Cover letter failed.";
    coverLetterResultNode.textContent = error.message;
  }
}

async function extractJobFacts(vacancyText, model) {
  const userPrompt = `Extract the following information from this vacancy.

Required JSON schema:

{
  "job_title": "",
  "company": "",
  "country": "",
  "city": "",
  "remote": null,
  "hybrid": null,
  "onsite": null,
  "salary_present": null,
  "salary_text": null,

  "requires_danish": false,
  "requires_existing_residency": false,
  "requires_work_permit": false,
  "no_relocation_support": false,

  "years_experience_required": null,

  "keywords": [],

  "requires_sql": false,
  "requires_powerbi": false,
  "requires_python": false,
  "requires_cloud_engineering": false,
  "requires_data_engineering": false,
  "requires_marketing_analytics": false,
  "requires_quantitative_research": false,
  "requires_project_management": false,
  "requires_business_analysis": false,
  "requires_stakeholder_management": false,

  "evidence": {
    "requires_danish": "",
    "requires_existing_residency": "",
    "requires_work_permit": "",
    "no_relocation_support": ""
  }
}

VACANCY:

${vacancyText}`;

  const responseText = await sendOllamaPrompt({
    model,
    systemPrompt: FACT_EXTRACTION_SYSTEM_PROMPT,
    userPrompt,
    temperature: 0
  });

  return parseJsonStrict(responseText);
}

function validateJobFacts(jobFacts, vacancyText) {
  const errors = [];
  const warnings = [];

  if (!jobFacts || typeof jobFacts !== "object" || Array.isArray(jobFacts)) {
    return { ok: false, errors: ["Extracted facts are not a JSON object."], warnings: [], jobFacts: null };
  }

  const normalizedFacts = normalizeJobFacts(jobFacts, warnings);

  const requiredBooleanFields = [
    "requires_danish",
    "requires_existing_residency",
    "requires_work_permit",
    "no_relocation_support",
    "requires_sql",
    "requires_powerbi",
    "requires_python",
    "requires_cloud_engineering",
    "requires_data_engineering",
    "requires_marketing_analytics",
    "requires_quantitative_research",
    "requires_project_management",
    "requires_business_analysis",
    "requires_stakeholder_management"
  ];

  const nullableBooleanFields = ["remote", "hybrid", "onsite", "salary_present"];

  for (const field of requiredBooleanFields) {
    if (typeof normalizedFacts[field] !== "boolean") {
      errors.push(`${field} must be a boolean.`);
    }
  }

  for (const field of nullableBooleanFields) {
    if (normalizedFacts[field] !== null && typeof normalizedFacts[field] !== "boolean") {
      errors.push(`${field} must be boolean or null.`);
    }
  }

  if (!normalizedFacts.evidence || typeof normalizedFacts.evidence !== "object" || Array.isArray(normalizedFacts.evidence)) {
    errors.push("evidence must be an object.");
  } else {
    for (const key of ["requires_danish", "requires_existing_residency", "requires_work_permit", "no_relocation_support"]) {
      if (typeof normalizedFacts.evidence[key] !== "string") {
        errors.push(`evidence.${key} must be a string.`);
      }
    }
  }

  if (typeof normalizedFacts.job_title !== "string") {
    errors.push("job_title must be a string.");
  } else if (!normalizedFacts.job_title.trim()) {
    warnings.push("Warning: Extracted job title is empty.");
  }

  if (typeof normalizedFacts.company !== "string") {
    errors.push("company must be a string.");
  } else if (!normalizedFacts.company.trim()) {
    warnings.push("Warning: Extracted company is empty.");
  }

  const country = typeof normalizedFacts.country === "string" ? normalizedFacts.country.trim() : "";
  if (!country && /\b(Panama|Denmark|United States|USA|Germany|Sweden|Norway)\b/i.test(vacancyText)) {
    warnings.push("Warning: Country is missing even though the vacancy appears to mention a country.");
  }

  if (!Array.isArray(normalizedFacts.keywords)) {
    errors.push("keywords must be an array.");
  }

  return { ok: errors.length === 0, errors, warnings, jobFacts: normalizedFacts };
}

function normalizeJobFacts(inputFacts, warnings) {
  const normalized = {
    job_title: "",
    company: "",
    country: "",
    city: "",
    remote: null,
    hybrid: null,
    onsite: null,
    salary_present: null,
    salary_text: null,
    requires_danish: false,
    requires_existing_residency: false,
    requires_work_permit: false,
    no_relocation_support: false,
    years_experience_required: null,
    keywords: [],
    requires_sql: false,
    requires_powerbi: false,
    requires_python: false,
    requires_cloud_engineering: false,
    requires_data_engineering: false,
    requires_marketing_analytics: false,
    requires_quantitative_research: false,
    requires_project_management: false,
    requires_business_analysis: false,
    requires_stakeholder_management: false,
    evidence: {
      requires_danish: "",
      requires_existing_residency: "",
      requires_work_permit: "",
      no_relocation_support: ""
    }
  };

  const source = inputFacts && typeof inputFacts === "object" ? inputFacts : {};

  for (const key of ["job_title", "company", "country", "city"]) {
    if (typeof source[key] === "string") {
      normalized[key] = source[key];
    }
  }

  if (typeof source.salary_text === "string" || source.salary_text === null) {
    normalized.salary_text = source.salary_text;
  }

  if (typeof source.years_experience_required === "number" || source.years_experience_required === null) {
    normalized.years_experience_required = source.years_experience_required;
  }

  if (Array.isArray(source.keywords)) {
    normalized.keywords = source.keywords.filter((item) => typeof item === "string");
  }

  for (const field of ["remote", "hybrid", "onsite", "salary_present"]) {
    normalized[field] = coerceNullableBoolean(source[field], field, warnings);
  }

  const hardRejectionBooleanFields = [
    "requires_danish",
    "requires_existing_residency",
    "requires_work_permit",
    "no_relocation_support"
  ];

  const skillBooleanFields = [
    "requires_sql",
    "requires_powerbi",
    "requires_python",
    "requires_cloud_engineering",
    "requires_data_engineering",
    "requires_marketing_analytics",
    "requires_quantitative_research",
    "requires_project_management",
    "requires_business_analysis",
    "requires_stakeholder_management"
  ];

  for (const field of hardRejectionBooleanFields) {
    normalized[field] = coerceBoolean(source[field], field, warnings, true);
  }

  for (const field of skillBooleanFields) {
    normalized[field] = coerceBoolean(source[field], field, warnings, false);
  }

  if (source.evidence && typeof source.evidence === "object" && !Array.isArray(source.evidence)) {
    for (const key of ["requires_danish", "requires_existing_residency", "requires_work_permit", "no_relocation_support"]) {
      if (typeof source.evidence[key] === "string") {
        normalized.evidence[key] = source.evidence[key];
      }
    }
  }

  return normalized;
}

function coerceBoolean(value, fieldName, warnings, emitWarnings) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      if (emitWarnings) {
        warnings.push(`Warning: Normalized ${fieldName} from string to boolean true.`);
      }
      return true;
    }

    if (normalized === "false") {
      if (emitWarnings) {
        warnings.push(`Warning: Normalized ${fieldName} from string to boolean false.`);
      }
      return false;
    }

    if (normalized === "null" || normalized === "") {
      return false;
    }
  }

  if (emitWarnings) {
    warnings.push(`Warning: ${fieldName} had invalid type and was set to false.`);
  }

  return false;
}

function coerceNullableBoolean(value, fieldName, warnings) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      warnings.push(`Warning: Normalized ${fieldName} from string to boolean true.`);
      return true;
    }

    if (normalized === "false") {
      warnings.push(`Warning: Normalized ${fieldName} from string to boolean false.`);
      return false;
    }

    if (normalized === "null") {
      warnings.push(`Warning: Normalized ${fieldName} from string to null.`);
      return null;
    }
  }

  warnings.push(`Warning: ${fieldName} had invalid type and was set to null.`);
  return null;
}

function applyEvidenceGate(jobFacts) {
  if (jobFacts.requires_danish === true && !jobFacts.evidence.requires_danish) {
    jobFacts.requires_danish = false;
  }

  if (jobFacts.requires_existing_residency === true && !jobFacts.evidence.requires_existing_residency) {
    jobFacts.requires_existing_residency = false;
  }

  if (jobFacts.requires_work_permit === true && !jobFacts.evidence.requires_work_permit) {
    jobFacts.requires_work_permit = false;
  }

  if (jobFacts.no_relocation_support === true && !jobFacts.evidence.no_relocation_support) {
    jobFacts.no_relocation_support = false;
  }

  return jobFacts;
}

async function evaluateJob(profileJson, resumeMarkdown, vacancyText, jobFacts, model) {
  const userPrompt = `CANDIDATE PROFILE:
${profileJson}

SELECTED RESUME:
${resumeMarkdown}

EXTRACTED JOB FACTS:
${JSON.stringify(jobFacts, null, 2)}

VACANCY TEXT:
${vacancyText}

CANDIDATE STRENGTHS:
- Business Analysis
- SQL
- Power BI
- Reporting
- Dashboards
- KPI Definition
- Data Governance
- CRM
- Stakeholder Management
- Process Improvement
- Information Management

SECONDARY STRENGTHS:
- Project Coordination
- Agile Environments
- User Stories
- Requirements Gathering
- Technical Documentation
- Workshops

AVOID ROLES:
- Cloud Engineer
- FinOps
- DevOps
- SRE
- Data Architect
- Quantitative Research
- Marketing Attribution
- Pure Product Management

HARD REJECTION RULES:
Only apply these if explicit evidence exists in EXTRACTED JOB FACTS:
- Danish required
- Existing Danish residency required
- Existing work permit required
- Explicit no-relocation statement for Denmark jobs

SCORING:
Score using these weights:

30 points: Business Analysis fit
20 points: Stakeholder Management fit
20 points: Analytics / BI fit
10 points: Technical Skills fit
10 points: Seniority fit
10 points: Location / Relocation fit

Total = 100.
Convert to 10-point score.

Before writing Red Flags:
Verify that evidence exists in either EXTRACTED JOB FACTS or VACANCY TEXT.
If evidence does not exist, do not mention it.

IMPORTANT WARNING:
Do not confuse practical AI automation experience with academic machine learning expertise.
The candidate is strongest in applied AI workflows, agent-assisted development, automation, and business systems, not PhD-level ML research.

Return exactly this format:

# Verdict

GREEN / YELLOW / ORANGE / RED

# Score

X.X / 10

# Strong Matches

- item
- item

# Red Flags

For every red flag provide:
Red Flag:
Evidence:
Impact:

# Salary Estimate

USD yearly:
USD monthly:
EUR yearly:
DKK monthly:

If estimate impossible, write "Estimate only".

# Interview Probability

XX%

# Offer Probability

XX%

# Final Recommendation

APPLY or PASS

# Reasoning

Maximum 150 words.`;

  return await sendOllamaPrompt({
    model,
    systemPrompt: EVALUATION_SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.1
  });
}

function sanityCheckResult(resultText, jobFacts) {
  const warnings = [];
  const normalizedResult = (resultText || "").toLowerCase();

  if (normalizedResult.includes("danish") && jobFacts.requires_danish !== true) {
    warnings.push("Warning: Result mentions Danish, but extracted facts do not show Danish requirement.");
  }

  if (normalizedResult.includes("copenhagen") && (jobFacts.city || "").toLowerCase() !== "copenhagen") {
    warnings.push("Warning: Result mentions Copenhagen, but extracted city is different.");
  }

  return warnings;
}

function parseAnalysisResult(resultText) {
  const raw = formatResponse(resultText);
  const sections = splitSections(raw);
  const verdict = pickFirstNonEmptyLine(sections["Verdict"] || "");
  const score = pickFirstNonEmptyLine(sections["Score"] || "");
  const strongMatches = toBulletList(sections["Strong Matches"] || "");
  const redFlags = parseRedFlags(sections["Red Flags"] || "");

  return {
    verdict: verdict || "N/A",
    score: score || "N/A",
    strongMatches,
    redFlags,
    salaryEstimate: sections["Salary Estimate"] || "",
    interviewProbability: pickFirstNonEmptyLine(sections["Interview Probability"] || ""),
    offerProbability: pickFirstNonEmptyLine(sections["Offer Probability"] || ""),
    finalRecommendation: pickFirstNonEmptyLine(sections["Final Recommendation"] || ""),
    reasoning: sections["Reasoning"] || "",
    raw
  };
}

function splitSections(text) {
  const sections = {};
  const lines = (text || "").split(/\r?\n/);
  let currentKey = "_preamble";
  let buffer = [];

  const flush = () => {
    sections[currentKey] = buffer.join("\n").trim();
  };

  for (const line of lines) {
    const heading = line.match(/^\s*#\s+(.+)\s*$/);
    if (heading) {
      flush();
      currentKey = heading[1].trim();
      buffer = [];
      continue;
    }

    buffer.push(line);
  }

  flush();
  return sections;
}

function pickFirstNonEmptyLine(text) {
  const line = (text || "")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.length > 0);
  return line || "";
}

function toBulletList(text) {
  const bullets = (text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*]\s*/, "").trim())
    .filter((line) => line.length > 0);
  return bullets;
}

function parseRedFlags(text) {
  const content = (text || "").trim();
  if (!content) {
    return [];
  }

  const parts = content
    .split(/\n\s*Red Flag:\s*/i)
    .map((chunk, index) => (index === 0 ? chunk.replace(/^\s*Red Flag:\s*/i, "") : chunk).trim())
    .filter(Boolean);

  return parts.map((chunk) => {
    const evidenceMatch = chunk.match(/\n\s*Evidence:\s*([\s\S]*?)(?=\n\s*Impact:|$)/i);
    const impactMatch = chunk.match(/\n\s*Impact:\s*([\s\S]*?)$/i);
    const title = chunk.split(/\n\s*Evidence:|\n\s*Impact:/i)[0].trim();
    return {
      redFlag: title || "",
      evidence: evidenceMatch ? evidenceMatch[1].trim() : "",
      impact: impactMatch ? impactMatch[1].trim() : ""
    };
  });
}

function renderAnalysisSummary(parsed, jobFacts) {
  const strongMatchesList = parsed.strongMatches.length
    ? `<ul class="jb-list">${parsed.strongMatches.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "<p>No strong matches reported.</p>";

  const redFlagsList = parsed.redFlags.length
    ? parsed.redFlags
      .map((flag) => `
        <div class="jb-red-flag">
          <p><strong>Red Flag:</strong> ${escapeHtml(flag.redFlag || "N/A")}</p>
          <p><strong>Evidence:</strong> ${escapeHtml(flag.evidence || "N/A")}</p>
          <p><strong>Impact:</strong> ${escapeHtml(flag.impact || "N/A")}</p>
        </div>
      `)
      .join("")
    : "<p>No red flags reported.</p>";

  analysisSummaryNode.innerHTML = `
    <div class="jb-summary-head">
      <div class="jb-kpi">
        <div class="jb-kpi-label">Verdict</div>
        <div class="jb-kpi-value">${escapeHtml(parsed.verdict)}</div>
      </div>
      <div class="jb-kpi">
        <div class="jb-kpi-label">Score</div>
        <div class="jb-kpi-value">${escapeHtml(parsed.score)}</div>
      </div>
    </div>
    <div>
      <div class="jb-section-title">Recommendation</div>
      <p>${escapeHtml(parsed.finalRecommendation || "N/A")}</p>
    </div>
    <div>
      <div class="jb-section-title">Strong Matches</div>
      ${strongMatchesList}
    </div>
    <div>
      <div class="jb-section-title">Red Flags</div>
      ${redFlagsList}
    </div>
    <div>
      <div class="jb-section-title">Probabilities</div>
      <p>Interview: ${escapeHtml(parsed.interviewProbability || "N/A")}</p>
      <p>Offer: ${escapeHtml(parsed.offerProbability || "N/A")}</p>
    </div>
    <div>
      <div class="jb-section-title">Vacancy Context</div>
      <p>Company: ${escapeHtml(jobFacts.company || "N/A")}</p>
      <p>Role: ${escapeHtml(jobFacts.job_title || "N/A")}</p>
      <p>Location: ${escapeHtml([jobFacts.city, jobFacts.country].filter(Boolean).join(", ") || "N/A")}</p>
    </div>
  `;

  analysisSummaryNode.classList.remove("jb-hidden");
}

function renderCoverLetterSummary(coverLetterText, company, jobTitle) {
  coverLetterSummaryNode.innerHTML = `
    <div class="jb-section-title">Cover Letter Preview</div>
    <p>Company: ${escapeHtml(company)}</p>
    <p>Role: ${escapeHtml(jobTitle)}</p>
    <div class="jb-cover-letter">${escapeHtml(coverLetterText)}</div>
  `;
  coverLetterSummaryNode.classList.remove("jb-hidden");
}

function buildAnalysisReportHtml(parsed, jobFacts, rawText) {
  const strongMatchesItems = parsed.strongMatches.length
    ? parsed.strongMatches.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : "<li>None listed.</li>";

  const redFlagBlocks = parsed.redFlags.length
    ? parsed.redFlags.map((flag) => `
      <div class="jb-red-flag">
        <p><strong>Red Flag:</strong> ${escapeHtml(flag.redFlag || "N/A")}</p>
        <p><strong>Evidence:</strong> ${escapeHtml(flag.evidence || "N/A")}</p>
        <p><strong>Impact:</strong> ${escapeHtml(flag.impact || "N/A")}</p>
      </div>
    `).join("")
    : "<p>No red flags listed.</p>";

  return `
    <div class="jb-summary-head">
      <div class="jb-kpi">
        <div class="jb-kpi-label">Verdict</div>
        <div class="jb-kpi-value">${escapeHtml(parsed.verdict)}</div>
      </div>
      <div class="jb-kpi">
        <div class="jb-kpi-label">Score</div>
        <div class="jb-kpi-value">${escapeHtml(parsed.score)}</div>
      </div>
    </div>
    <h3>Job Snapshot</h3>
    <ul>
      <li>Company: ${escapeHtml(jobFacts.company || "N/A")}</li>
      <li>Role: ${escapeHtml(jobFacts.job_title || "N/A")}</li>
      <li>City/Country: ${escapeHtml([jobFacts.city, jobFacts.country].filter(Boolean).join(", ") || "N/A")}</li>
    </ul>
    <h3>Strong Matches</h3>
    <ul>${strongMatchesItems}</ul>
    <h3>Red Flags</h3>
    ${redFlagBlocks}
    <h3>Salary Estimate</h3>
    <div class="jb-cover-letter">${escapeHtml(parsed.salaryEstimate || "Estimate only")}</div>
    <h3>Probabilities</h3>
    <ul>
      <li>Interview: ${escapeHtml(parsed.interviewProbability || "N/A")}</li>
      <li>Offer: ${escapeHtml(parsed.offerProbability || "N/A")}</li>
    </ul>
    <h3>Final Recommendation</h3>
    <p>${escapeHtml(parsed.finalRecommendation || "N/A")}</p>
    <h3>Reasoning</h3>
    <p>${escapeHtml((parsed.reasoning || "").trim() || "N/A")}</p>
    <h3>Raw Model Output</h3>
    <div class="jb-cover-letter">${escapeHtml(rawText || parsed.raw || "")}</div>
  `;
}

function buildCoverLetterReportHtml(coverLetterText, company, jobTitle) {
  return `
    <h3>Target</h3>
    <ul>
      <li>Company: ${escapeHtml(company || "N/A")}</li>
      <li>Role: ${escapeHtml(jobTitle || "N/A")}</li>
    </ul>
    <h3>Cover Letter</h3>
    <div class="jb-cover-letter">${escapeHtml(coverLetterText || "")}</div>
  `;
}

function openReportModal(title, html) {
  if (!html) {
    return;
  }

  reportModalTitleNode.textContent = title;
  reportModalBodyNode.innerHTML = html;
  reportModalNode.classList.remove("jb-hidden");
}

function closeReportModal() {
  reportModalNode.classList.add("jb-hidden");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendOllamaPrompt({ model, systemPrompt, userPrompt, temperature }) {
  let response;

  try {
    response = await chrome.runtime.sendMessage({
      type: "JOBBLADE_OLLAMA_CALL",
      model,
      systemPrompt,
      userPrompt,
      temperature,
      stream: false
    });
  } catch (error) {
    throw decorateRuntimeError(error);
  }

  if (!response?.ok) {
    throw decorateRuntimeError(response?.error || "JobBlade could not reach Ollama.");
  }

  return response.payload?.response || "";
}

function decorateRuntimeError(inputError) {
  const message = (inputError && inputError.message ? inputError.message : String(inputError || "Unknown error")).trim();

  if (isContextInvalidationErrorMessage(message)) {
    return new Error("Extension context invalidated. JobBlade is rebuilding the panel. Click Analyze again.");
  }

  return new Error(message);
}

function handleContextInvalidation(error) {
  const message = (error && error.message ? error.message : String(error || "")).toLowerCase();

  if (!isContextInvalidationErrorMessage(message)) {
    return false;
  }

  statusNode.textContent = "Extension context was invalidated. Rebuilding panel...";
  warningsNode.textContent = "Panel reset requested. Retry Analyze once the panel reloads.";
  resultNode.textContent = "";
  requestPanelReset();
  return true;
}

function isContextInvalidationErrorMessage(message) {
  const normalized = (message || "").toLowerCase();
  return normalized.includes("extension context invalidated")
    || normalized.includes("context invalidated")
    || normalized.includes("receiving end does not exist")
    || normalized.includes("could not establish connection");
}

function requestPanelReset() {
  const now = Date.now();
  if (now - lastResetRequestAt < 1500) {
    return;
  }

  lastResetRequestAt = now;
  window.parent.postMessage({ type: "JOBBLADE_RESET_PANEL" }, "*");
}

function parseJsonStrict(rawText) {
  const trimmed = (rawText || "").trim();

  if (!trimmed) {
    throw new Error("Fact extraction returned empty output.");
  }

  try {
    return JSON.parse(trimmed);
  } catch (_initialError) {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");

    if (start >= 0 && end > start) {
      const candidate = trimmed.slice(start, end + 1);
      try {
        return JSON.parse(candidate);
      } catch (_candidateError) {
        throw new Error("Fact extraction did not return valid JSON.");
      }
    }

    throw new Error("Fact extraction did not return valid JSON.");
  }
}

function buildCoverLetterPrompt(company, jobTitle, vacancyText, resumeMarkdown) {
  return `Write a concise cover letter for the candidate.

Use only this data:
Company: ${company}
Job Title: ${jobTitle}

VACANCY TEXT:
${vacancyText}

SELECTED RESUME:
${resumeMarkdown}

Constraints:
- Mention only the provided company and job title.
- Keep it under 250 words.
- Professional tone.
- No fabricated details.`;
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
  let response;

  try {
    response = await fetch(chrome.runtime.getURL(path));
  } catch (error) {
    throw decorateRuntimeError(error);
  }

  if (!response.ok) {
    throw new Error(`Could not load ${path}`);
  }

  return await response.text();
}

function formatResponse(responseText) {
  const trimmed = (responseText || "").trim();
  return trimmed || "No response from Ollama.";
}

function pickProfilePathForVacancy(vacancyText) {
  const normalizedVacancy = (vacancyText || "").toLowerCase();
  const shouldUseAiAutomationProfile = AI_AUTOMATION_TRIGGER_KEYWORDS.some((keyword) => normalizedVacancy.includes(keyword));

  return shouldUseAiAutomationProfile ? AI_AUTOMATION_PROFILE_PATH : DEFAULT_PROFILE_PATH;
}

function resolveProfileSelection(vacancyText, mode) {
  if (mode === "default") {
    return {
      path: DEFAULT_PROFILE_PATH,
      notice: "Profile: Manual -> BI/Business Analysis"
    };
  }

  if (mode === "ai_automation") {
    return {
      path: AI_AUTOMATION_PROFILE_PATH,
      notice: "Profile: Manual -> AI Automation/Software"
    };
  }

  const autoPath = pickProfilePathForVacancy(vacancyText);
  return {
    path: autoPath,
    notice: autoPath === AI_AUTOMATION_PROFILE_PATH
      ? "Profile: Auto -> AI Automation/Software"
      : "Profile: Auto -> BI/Business Analysis"
  };
}

function resolveResumeSelection(vacancyText, mode, activeProfilePath) {
  if (mode && mode !== "auto") {
    return {
      file: mode,
      notice: `Resume: Manual -> ${humanizeResumeName(mode)}`
    };
  }

  if (activeProfilePath === AI_AUTOMATION_PROFILE_PATH) {
    return {
      file: AI_AUTOMATION_RESUME_FILE,
      notice: "Resume: Auto -> AI Automation & Software Systems"
    };
  }

  const normalizedVacancy = (vacancyText || "").toLowerCase();
  if (containsAnyKeyword(normalizedVacancy, BI_RESUME_TRIGGER_KEYWORDS)) {
    return {
      file: BI_ANALYST_RESUME_FILE,
      notice: "Resume: Auto -> BI Analyst"
    };
  }

  if (containsAnyKeyword(normalizedVacancy, DATA_RESUME_TRIGGER_KEYWORDS)) {
    return {
      file: DATA_ANALYST_RESUME_FILE,
      notice: "Resume: Auto -> Data Analyst"
    };
  }

  return {
    file: DEFAULT_RESUME_FILE,
    notice: "Resume: Auto -> Business Analyst"
  };
}

function containsAnyKeyword(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function humanizeResumeName(fileName) {
  if (fileName === DEFAULT_RESUME_FILE) {
    return "Business Analyst";
  }

  if (fileName === DATA_ANALYST_RESUME_FILE) {
    return "Data Analyst";
  }

  if (fileName === BI_ANALYST_RESUME_FILE) {
    return "BI Analyst";
  }

  if (fileName === AI_AUTOMATION_RESUME_FILE) {
    return "AI Automation & Software Systems";
  }

  return fileName;
}
