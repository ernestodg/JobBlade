# JobBlade

JobBlade is a local-first, privacy-focused, AI-assisted job evaluation system for professionals who want better application decisions, not more applications.

It helps answer one practical question:

Should I apply to this vacancy?

Instead of maximizing application volume, JobBlade prioritizes interview probability, offer probability, and long-term career ROI.

## Why JobBlade Exists

Most job tools optimize for speed and volume:

- more applications
- more alerts
- more keyword matching

That approach creates noise:

- low-fit applications
- recruiter mismatch
- wasted time
- poor compensation outcomes

JobBlade was built to reduce that noise.

It evaluates each vacancy against a real candidate context:

- profile track
- resume variant
- skills and experience
- market and relocation constraints
- salary expectations
- evidence from the vacancy text

## Core Philosophy

Most tools ask:

Can I apply?

JobBlade asks:

Should I apply?

The objective is to maximize:

- interview probability
- offer probability
- career ROI

while minimizing:

- wasted applications
- low-probability opportunities
- resume spam

## Key Principles

### Privacy First

JobBlade runs locally whenever possible:

- local browser extension
- local profile and resume files
- local Ollama inference
- no required external AI provider

### Evidence-Based Decisions

Recommendations should be supported by explicit vacancy evidence.

Good evidence:

- vacancy explicitly requires Danish
- vacancy explicitly says relocation is not supported

Bad assumptions:

- inferring language requirements from company country
- inferring relocation policy from unrelated jobs

### Human in the Loop

JobBlade is not an auto-apply bot.

The system provides:

- structured analysis
- warnings
- scoring
- recommendation

The user keeps final judgment.

### Candidate-Centric Evaluation

Vacancies are evaluated against candidate reality, not generic keyword overlap:

- skills
- experience
- role fit
- market fit
- salary fit
- relocation constraints

## How It Works

Current runtime flow:

1. Extension captures vacancy text from the active page.
2. Step 1 fact extraction parses the vacancy into structured JSON.
3. Local validation checks schema and applies evidence gating.
4. Step 2 evaluation combines:
   - candidate profile
   - selected resume variant
   - extracted vacancy facts
   - vacancy text
5. Ollama returns a structured recommendation.
6. Panel renders a professional summary and modal report views.

Architecture model:

```text
Job Vacancy
       ↓
Browser Extension
       ↓
Fact Extraction
       ↓
Structured Vacancy JSON
       ↓
Candidate Profile
       +
Resume Variant
       +
Decision Rules
       ↓
Ollama Evaluation
       ↓
Recommendation
       ↓
Apply / Pass Decision
```

## What Makes JobBlade Different

JobBlade is not a generic AI matching widget.

It is built around decision quality:

- strict two-step extraction and evaluation
- evidence-gated hard rejection rules
- profile-aware and resume-aware analysis
- explainable structured outputs
- local-first execution and privacy control

The LLM is used as an evaluator, not a decision-maker.

## Main Components

### JobBlade Extension

Responsibilities:

- capture vacancy text
- select profile and resume mode
- call local evaluation pipeline
- display structured reports

Design goal:

thin interface, deterministic behavior, local execution.

### JobFlow Backend (Planned Integration)

Responsibilities:

- profile and resume management
- decision rule management
- evaluation history
- cover letter and resume tailoring workflows
- application tracking

JobFlow is planned as the orchestration layer beyond extension-only MVP usage.

### Ollama Integration

Responsibilities:

- vacancy fact extraction
- vacancy evaluation
- cover letter generation
- future resume tailoring support

## Candidate Profiles

JobBlade supports multiple profile tracks.

### BI / Business Analysis Track

Focus:

- business analysis
- SQL
- Power BI
- dashboards
- KPI and reporting workflows

### AI Automation / Software Track

Focus:

- GitHub Copilot
- Ollama and local LLM workflows
- agent-assisted development
- Python and FastAPI automation
- internal tools and systems workflows

## Vacancy Evaluation Model

Evaluation dimensions include:

- skills match
- domain match
- seniority match
- salary potential
- relocation and legal constraints
- career alignment

Verdict scale:

- GREEN: apply immediately
- YELLOW: apply if convenient
- ORANGE: low probability
- RED: pass

## Roadmap

### MVP

- vacancy capture
- profile and resume selection
- Ollama integration
- apply or pass recommendations

### Phase 2

- stronger cover letter workflow
- resume tailoring
- saved evaluations
- improved history handling

### Phase 3

- JobFlow integration
- analytics and pipeline views
- multi-profile comparative evaluation

### Future

- multi-user support
- team workflows
- company intelligence modules
- interview preparation support
- skill-gap guidance

## Target Audience

JobBlade is for professionals who:

- receive many opportunities
- need stronger filtering discipline
- want explainable local AI assistance
- value privacy and control

Typical fit:

- business analysts
- data analysts
- BI professionals
- consultants
- technical product specialists
- AI automation builders

## Project Tone

JobBlade is intentionally practical.

No hype, no magic claims, no auto-apply fantasy.

It is a decision-support system built for real job-search constraints and real career trade-offs.
