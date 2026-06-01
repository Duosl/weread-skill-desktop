# Session Handoff

## Current Objective

- Goal: Optimize the first-stage AI conversation, LLM settings, note-reading confirmation, and custom template experience.
- Current status: `feat-014 / REQ-014` is in progress; first-stage copy polish, second-stage structure, and the first third-stage report action enhancement are complete.
- Branch / commit: current working tree, not committed by agent.

## Completed This Session

- Used `frontend-design` to rework `landing/index.html` from a static documentation-like page into a stronger editorial product landing page.
- New visual direction: dark reading archive hero, oversized serif brand typography, layered product workbench mockup, floating export/report/share sheets, ticker strip, and proof sections.
- Added motion:
  - first-screen title lift and product stage entrance
  - floating paper sheets
  - ticker movement
  - scroll reveal via `IntersectionObserver`
  - hover feedback on cards and workflow steps
  - pointer-based light tilt on the product stage
  - `prefers-reduced-motion` fallback
- Fixed mobile hero title wrapping after screenshot QA.
- Marked `feat-023` done and moved `REQ-023` to archive.

## In Progress

- `feat-014 / REQ-014 智能体模板原文权限说明优化`
- Scope for this pass: `src/pages/ChatPage.tsx`, `src/pages/SettingsPage.tsx`, `src-tauri/src/llm_chat.rs`, `src-tauri/src/agent_gateway.rs`, `src-tauri/src/types.rs`, `src-tauri/src/state.rs`, `src-tauri/src/custom_templates.rs`, `src-tauri/src/advanced_report.rs`, `src/components/report/CustomTemplateDialog.tsx`, `src/components/report/GenerationSettings.tsx`.

## Completed In Current Pass

- Optimized Chat empty state and subtitle to say AI uses the user's own AI service.
- Updated note-reading confirmation copy to "确认读取笔记内容" with once/conversation/open-session/deny options and non-alarming privacy language.
- Clarified that chat history is saved locally.
- Updated LLM settings privacy copy: Shuji has no built-in model and sends related content only after user authorization to the configured AI service.
- Softened `suggest_report` prompt/tool language so reports are suggested only when user asks or a complete analysis topic is worth saving.
- Reframed custom templates around user-readable report goals, examples, presentation preferences and note-reading expectations.
- Added structured `DataAccessRecord` and `ConsentRequest` types.
- `agent_gateway.rs` now attaches a data access record and structured consent request to tool results.
- `llm_chat.rs` aggregates per-run data access records and emits a `data_access_summary` event before run completion.
- `ChatPage.tsx` renders a low-key per-turn reading summary and uses backend-generated consent copy when available.
- Consent memory now uses a structured key derived from API + data category + raw-text flag, while keeping old API-name compatibility.
- Custom templates now persist a structured `intent` alongside prompt/style fields.
- Advanced report generation settings now show a backend-produced data access preview, and jobs write `input/data-access-plan.json`.
- Chat report cards now include a folder action to open the report location.

## Completed After REQ-023

- Restored and regenerated `landing/index.html` as a directly browsable single-file landing page for the current project.
- New page sections: hero, capability proof cards, workflow, privacy boundaries, and download/documentation CTA.
- Mobile title wrapping and small-screen hero density were checked with Chrome headless screenshots.
- Added `docs/ai-chat-skill-agent-plan.md`.
- The new plan defines AI Chat as an embedded Skill-aware Agent:
  - keep LLM settings and Chat UI prototype where useful;
  - replace the handwritten `llm_chat.rs` tool loop;
  - package built-in skills as Tauri resources;
  - route AI access to app services through Rust `invoke_data_gateway` with whitelist, schema validation and privacy gates;
  - keep recommendations, similar books and public reviews as AI-only capabilities, not baseline browsing pages.
- Marked `feat-025` done and moved `REQ-025` to archive.

## Verification Evidence

| Check | Command | Result | Notes |
| --- | --- | --- | --- |
| Landing structure | `node -e ...` | Passed | Doctype present, icon exists, no duplicate IDs, `aria-labelledby` targets exist, reveal script present |
| Whitespace | `git diff --check` | Passed | 2026-05-28 |
| Desktop screenshot | Chrome headless 1440x1100 | Passed | `/private/tmp/shuji-landing-desktop.png` |
| Mobile screenshot | Chrome headless 390x900 | Passed | `/private/tmp/shuji-landing-mobile.png` |
| Unified gate | `./init.sh` | Passed | 2026-05-28 |
| REQ-024 structure | `node -e ...` | Passed | Doctype present, icon exists, no duplicate IDs, hash targets exist, reveal and tilt scripts present |
| REQ-024 desktop screenshot | Chrome headless 1440x1100 | Passed | `/private/tmp/shuji-landing-feat024-desktop.png` |
| REQ-024 mobile screenshot | Chrome headless 390x900 | Passed | `/private/tmp/shuji-landing-feat024-mobile.png` |
| REQ-024 unified gate | `./init.sh` | Passed | 2026-05-28 |
| REQ-025 whitespace | `git diff --check` | Passed | 2026-05-29 |
| REQ-014 first-stage typecheck | `npm run frontend:typecheck` | Passed | 2026-06-01 |
| REQ-014 first-stage Rust check | `cargo check` | Passed | 2026-06-01 |
| REQ-014 first-stage unified gate | `./init.sh` | Passed | 2026-06-01; Vite large chunk warning only |
| REQ-014 data access summary typecheck | `npm run frontend:typecheck` | Passed | 2026-06-01 |
| REQ-014 data access summary Rust check | `cargo check` | Passed | 2026-06-01 |
| REQ-014 data access summary unified gate | `./init.sh` | Passed | 2026-06-01; Vite large chunk warning only |
| REQ-014 second/third-stage unified gate | `./init.sh` | Passed | 2026-06-01; Vite large chunk warning only |
| System prompt externalization unified gate | `./init.sh` | Passed | 2026-06-01; Vite large chunk warning only |
| System prompt path relocated unified gate | `./init.sh` | Passed | 2026-06-01; Vite large chunk warning only |
| Rename gateway tool to `invoke_data_gateway` | `./init.sh` | Passed | 2026-06-01 |
| Gateway wording alignment | `./init.sh` | Passed | 2026-06-01 |
| Gateway failure request logging | `./init.sh` | Passed | 2026-06-01 |
| Progressive skill loader | `./init.sh` | Passed | 2026-06-01 |
| Skill activation + weread hard rule | `./init.sh` | Passed | 2026-06-01 |
- 已在 `invoke_data_gateway` 网关层新增失败请求入参日志，写入 `~/.weread-desktop/logs/gateway-failures.ndjson`，便于定位参数格式错误。
- 已统一 `invoke_data_gateway` 相关口径：收敛 Skill 声明、系统提示词边界、网关 schema 说明、扩展能力摘要和实施方案描述。

## Files Changed

- `landing/index.html`
- `feature_list.json`
- `docs/requirements-pool.md`
- `docs/archive/completed-requirements.md`
- `docs/current-context.md`
- `progress.md`
- `session-handoff.md`
- `landing/index.html`
- `docs/ai-chat-skill-agent-plan.md`
- `src/pages/ChatPage.tsx`
- `src/pages/SettingsPage.tsx`
- `src-tauri/src/llm_chat.rs`
- `src-tauri/src/agent_gateway.rs`
- `src-tauri/src/types.rs`
- `src-tauri/src/state.rs`
- `src-tauri/src/custom_templates.rs`
- `src-tauri/src/advanced_report.rs`
- `src-tauri/src/commands.rs`
- `src-tauri/src/lib.rs`
- `src/types/index.ts`
- `src/types/advancedReport.ts`
- `src/lib/tauriCommands.ts`
- `src/components/report/CustomTemplateDialog.tsx`
- `src/components/report/GenerationSettings.tsx`
- `src-tauri/resources/prompts/system.md`
- `src-tauri/src/system_prompt.rs`

Existing uncommitted files from the previous documentation rewrite remain in the working tree. Do not revert them.

## Blockers / Risks

- No current blockers.

## Recommended Next Step

Start `feat-014 / REQ-014 智能体模板原文权限说明优化`.
