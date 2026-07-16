# 🤖 AGENT.md: Repository Instruction & Bootstrap Guide

Welcome, Agent. This file serves as your master onboarding instruction, system context, and structural guideline when operating in this repository. 

**Echo-Menu 3.0** is an award-winning accessibility (barrier-free) web platform that uses HTML5 Web Audio API 3D spatial sound to help blind users navigate touch-screen kiosks, and gamifies non-disabled contribution using Chrome Dino evolution tiers.

Read this document fully before suggesting modifications, writing code, or invoking commands.

---

## 📂 1. Collaborative Document Hierarchy (`docs/` Structure)

This repository maintains a strict documentation hierarchy split by functional domain and architectural layer. **Do not create files outside of this structure.**

```text
/Users/seungrokyoon/Documents/00_Dev_Master/2026-google-studyjam-hakerthon/
├── docs/                             # All documentation files
│   ├── assistance/                   # Domain A: Blind User Ordering & Steering
│   │   ├── prd.md                    # Core requirements (onboarding, 4-gesture engine, audio math)
│   │   └── history/                  # Decision history (archived agreements)
│   │       └── history.md
│   │
│   ├── contribution/                 # Domain B: Contributor & Gamification
│   │   ├── prd.md                    # Core requirements (Google OAuth, Dino levels, BigQuery)
│   │   └── history/                  # Decision history (Dino concept, Imagen 3 choice)
│   │       └── history.md
│   │
│   ├── architecture/                 # Technical Specifications
│   │   ├── fe.md                     # Web Audio panning flow, Canvas frame processing
│   │   ├── be.md                     # REST API routes, Gemini Vision integration, Rate Limiting
│   │   └── infra.md                  # GCP Serverless topologies (Cloud Run, Armor, Firestore)
│   │
│   └── project-intro.md              # Master pitch, background, and AI harness stack
│
├── AGENT.md                          # This instruction file (Bootstrap for AI Agents)
├── server.js                         # Node.js + Express backend
├── public/                           # Frontend static assets
│   ├── index.html                    # Main responsive web layout
│   ├── app.ts                        # Main TS source (compiled to dist/assets/main-*.js)
│   └── preset_kiosk_data.json        # Predefined fallback coordinate maps
└── package.json                      # pnpm dependency descriptors
```

---

## 🛠️ 2. Core Technical Constraints (Rule-level locks)

As an AI Agent, you **MUST** adhere to the following technological boundaries. Any code violating these will be rejected:

1. **Package Manager (pnpm Only):**
   * Do **NOT** use `npm` or `yarn` commands directly. 
   * Always use `pnpm install`, `pnpm run build`, or `pnpm dev`.
   * Ensure `pnpm-lock.yaml` remains the single source of truth.

2. **Web Audio Coordinate Panning Math:**
   * In [public/app.ts](file:///Users/seungrokyoon/Documents/00_Dev_Master/2026-google-studyjam-hakerthon/public/app.ts), the coordinates translation maps a 2D screen coordinate directly to stereo panning (`-1.0` to `1.0`) and oscillator frequency pitch (`250Hz` to `800Hz`).
   * Do **NOT** modify or disrupt this sound formula unless specifically instructed, as it has been ergonomically optimized for blind navigation.

3. **Zero-UI 4-Tier Touch Gesture Engine:**
   * The touch touchpad parses finger count (`touches.length`) to divide states:
     - **1-finger:** Audio steering aim-assist and item selection.
     - **2-finger:** Audio sweep menu items read-aloud (Explore TTS).
     - **3-finger:** Back navigation rollback (previous screen).
     - **5-finger or Fist:** Guide freeze/mute (Privacy/Pause mode).
   * Do **NOT** break this listener matrix when refactoring the UI.

4. **Zero-Latency Live-Demo Safety Stubs:**
   * While `server.js` supports real-time Gemini OCR frame scanning, live demos on high-latency venue Wi-Fi must fall back on **`preset_kiosk_data.json`** coordinates seamlessly to avoid breaking the audio response cycle.
   * Maintain the local file in-memory DB (`db_cache.json`) for seamless offline-first execution.

---

## 🤖 3. Google Gemini Multi-Model Allocation

Always respect and design within our allocated AI Model Matrix:
* **Gemini 2.5/2.0 Flash (nickname: Bannano):** Used for real-time video OCR frames processing and natural language fuzzy venue match. Prioritize for low latency and high cost-efficiency (TTFT < 0.5s).
* **Imagen 3 Pro & Gemini 1.5 Pro:** Used for offline batch creation of high-contrast symmetrical 8-bit retro Chrome Dino evolution assets (1 to 100 levels) and complex hierarchical kiosk tree parsing.
* **Gemini Nano:** Target for local on-device smart preprocessing (detecting screen bounds or shake locally before initiating backend socket streaming).

---

## 🚦 4. Agentic Workflow Expectations

If you are running a task in this repo:
* **Respect Planning Mode:** Create/update `implementation_plan.md` first, flag `RequestFeedback: true`, wait for explicit approval, and track milestones sequentially in `task.md`.
* **Clean Code & Comments:** Retain all non-disruptive Korean accessibility voice instructions and multiligual resource dictionaries. Keep code heavily commented.
* **Verify Builds:** Run `pnpm run build` to confirm TypeScript type-safety before considering your task complete.

Go forth and build accessible, premium technology, Agent!
