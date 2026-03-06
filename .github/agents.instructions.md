---
applyTo: '**'
---

# MALLOULIAUTO Agent Instructions

> **Purpose**: This document defines the prompt frameworks, workflows, and implementation rules that AI agents must follow when working on MALLOULIAUTO projects.

---

## 1. AGENT WORKFLOW

Before executing any task, agents MUST follow this workflow:

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENT WORKFLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. CLASSIFY TASK                                               │
│     └─► Analysis | Design | Implementation                       │
│                                                                  │
│  2. SELECT FRAMEWORK                                            │
│     └─► CRISPE (Analysis) | ToT (Design) | RACE (Implementation)│
│                                                                  │
│  3. FORMULATE PROMPT                                            │
│     └─► Fill all framework components with user                  │
│                                                                  │
│  4. VALIDATE SCOPE                                              │
│     └─► Iterate until all aspects are collected                  │
│                                                                  │
│  5. EXECUTE                                                     │
│     └─► Only proceed when prompt is complete                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.1 Task Classification

| Task Type | Description | Framework |
|-----------|-------------|-----------|
| **Analysis** | Research, investigation, understanding requirements, audits | CRISPE |
| **Design** | Architecture, UI/UX, system design, problem-solving | ToT |
| **Implementation** | Coding, building, deploying, fixing | RACE |

---

## 2. PROMPT FRAMEWORKS

### 2.1 CRISPE Framework (Analysis Tasks)

Use for: Requirements gathering, audits, research, understanding business logic.

| Component | Description | Questions to Ask |
|-----------|-------------|------------------|
| **C**apacity | What role/expertise is needed? | "What domain expertise is required?" |
| **R**ole | Define the agent's persona | "As what type of expert should I approach this?" |
| **I**nsight | Background context needed | "What existing knowledge/documents are relevant?" |
| **S**tatement | The specific task/question | "What exactly needs to be analyzed?" |
| **P**ersonality | Tone and communication style | "How should findings be presented?" |
| **E**xperiment | Expected output format | "What deliverable is expected?" |

**Example CRISPE Prompt:**
```
[C] Expert in automotive SaaS business models and Tunisian market
[R] Business Analyst for MALLOULIAUTO
[I] Business plan shows 90% B2B revenue (40% Insurance, 30% Garage, 20% Fleet)
[S] Analyze the revenue model sustainability and identify risks
[P] Professional, data-driven, actionable recommendations
[E] Risk matrix with mitigation strategies in table format
```

### 2.2 ToT Framework - Tree of Thoughts (Design Tasks)

Use for: Architecture decisions, UI/UX design, system design, complex problem-solving.

| Component | Description | Questions to Ask |
|-----------|-------------|------------------|
| **Problem** | Clear problem statement | "What problem are we solving?" |
| **Branches** | Multiple solution approaches | "What are 3+ different approaches?" |
| **Evaluation** | Criteria for each branch | "What are pros/cons of each approach?" |
| **Selection** | Choose best path with reasoning | "Which approach best fits constraints?" |
| **Refinement** | Iterate on chosen solution | "How can we improve the selected approach?" |

**Example ToT Process:**
```
PROBLEM: Design authentication flow for technician app

BRANCH 1: Email/Password + OTP
  ├─ Pros: Simple, familiar, low cost
  └─ Cons: Friction, password management

BRANCH 2: Phone Number + SMS OTP
  ├─ Pros: Tunisia-friendly, no password
  └─ Cons: SMS costs, number changes

BRANCH 3: Social Login (Google/Facebook)
  ├─ Pros: One-click, trusted
  └─ Cons: Privacy concerns, dependency

EVALUATION: Tunisia context → Phone is universal, SMS is expected
SELECTION: Branch 2 with fallback to Branch 1
REFINEMENT: Add biometric for returning users
```

### 2.3 RACE Framework (Implementation Tasks)

Use for: Coding, building features, deployments, bug fixes.

| Component | Description | Questions to Ask |
|-----------|-------------|------------------|
| **R**ole | Technical expertise required | "What technical skills are needed?" |
| **A**ction | Specific task to perform | "What exactly needs to be built/fixed?" |
| **C**ontext | Technical constraints and codebase | "What are the technical constraints?" |
| **E**xpectation | Success criteria and deliverables | "What does 'done' look like?" |

**Example RACE Prompt:**
```
[R] Senior React Native + Expo developer with NativeWind expertise
[A] Implement garage booking flow with 5-step wizard
[C] Expo Router, Zustand store, existing UI components in packages/ui
[E] Working booking flow: Vehicle → Problem → Garage → Schedule → Confirm
```

---

## 3. ITERATION PROTOCOL

Agents MUST iterate with the user until ALL framework components are filled:

```
┌─────────────────────────────────────────────────────────────────┐
│                  ITERATION CHECKLIST                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  □ Task type identified (Analysis/Design/Implementation)         │
│  □ Framework selected (CRISPE/ToT/RACE)                         │
│  □ All framework components filled                               │
│  □ Scope boundaries defined                                      │
│  □ Success criteria agreed                                       │
│  □ Constraints documented                                        │
│  □ User confirmed ready to proceed                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Iteration Questions:**
- "Before I proceed, let me confirm the scope..."
- "I need clarification on [component]..."
- "What are the constraints for [aspect]?"
- "How should I handle [edge case]?"
- "Is this understanding correct: [summary]?"

---

## 4. IMPLEMENTATION RULES

### 4.1 Visual & UI Rules

| Rule | DO | DON'T |
|------|-----|-------|
| **Icons** | Use Lucide icons (`lucide-react`, `lucide-react-native`) | ❌ No emojis in code or UI |
| **Colors** | Use brand palette variables | ❌ No hardcoded hex values |
| **Typography** | System fonts, defined scales | ❌ No custom fonts without approval |
| **Spacing** | Tailwind/NativeWind spacing scale | ❌ No arbitrary pixel values |

### 4.2 Brand Colors (Mandatory)

```javascript
// STRICT COLOR PALETTE - Use these exact values
colors: {
  'brand-blue': '#447D9B',    // Primary - trust, technology
  'brand-orange': '#FE7743',  // Secondary - CTAs, accents
  'brand-navy': '#273F4F',    // Text, professional elements
  'brand-gray': '#D7D7D7',    // Backgrounds, borders
  'emerald': '#10B981',       // Success states
}
```

### 4.3 Icon Usage

```tsx
// ✅ CORRECT - Use Lucide icons
import { Shield, Truck, Car, Wrench, Brain, Eye } from 'lucide-react';
<Shield className="w-6 h-6 text-brand-blue" />

// ❌ WRONG - Never use emojis
<span>🚗</span>  // FORBIDDEN
<span>✅</span>  // FORBIDDEN
```

### 4.4 Code Standards

| Aspect | Standard |
|--------|----------|
| **Language** | TypeScript (strict mode) |
| **Styling** | NativeWind (mobile), Tailwind CSS (web) |
| **State** | Zustand with persistence |
| **Navigation** | Expo Router (file-based) |
| **Components** | Functional with hooks |
| **Naming** | PascalCase (components), camelCase (functions/variables) |

### 4.5 File Organization

```
// Component file structure
ComponentName/
├── index.tsx          # Main component
├── ComponentName.tsx  # (Alternative: single file)
├── types.ts           # TypeScript interfaces
└── utils.ts           # Helper functions
```

### 4.6 Commit Messages

```
feat: Add garage booking flow
fix: Correct navigation on mobile
docs: Update README with API docs
style: Format with prettier
refactor: Simplify store logic
test: Add unit tests for diagnosis
```

---

## 5. DOMAIN CONTEXT

- Requirements are documented in [Proposition_PFE.md](Proposition_PFE.md).
- Architecture doc placeholder exists at [design_auto_diagnostic_platform.md](design_auto_diagnostic_platform.md) (currently empty).

## Product scope (from proposal)
- IoT fleet platform ingesting OBD dongle data: DTCs, GPS, and vehicle telemetry.
- Platform scope: cloud backend, APIs, analytics, web dashboard, and mobile app.

## Target architecture (per proposal)
- Microservices design for scalability and resilience.
- Data ingress via MQTT/HTTP; real‑time updates via WebSocket.
- Hybrid storage: relational (PostgreSQL), document (MongoDB), time‑series (InfluxDB/TimescaleDB).

## Key data flow to keep consistent
1. OBD dongle sends telemetry/DTC/GPS → MQTT/HTTP.
2. Ingestion validates and routes to storage.
3. Analytics generates alerts, maintenance recommendations, and predictions.
4. REST API serves web/mobile clients; WebSocket pushes live updates.

## Technology preferences (proposal‑level)
- Backend: Python (FastAPI/Django) or Node.js (Express).
- Frontend: React/Vue (web), React Native/Flutter (mobile).
- Mapping: Leaflet or Google Maps; charts: Chart.js.
- Auth: JWT; monitoring: Prometheus + Grafana.

## Documentation expectations
- Provide OpenAPI/Swagger definitions for REST endpoints.
- Include UML/system diagrams and deployment guide as project evolves.
