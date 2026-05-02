# Codex Handoff Bundle — cautid-web

Project
- 财梯 / cautid-web
- Windows source path: D:\Projects\微信小程序\cautid-web

Purpose
- Give local Codex one clean entry point so it can continue the debugging work with minimal back-and-forth.

Current status
- Debug status lines are already in the current working copy for:
  - src\pages\Index.vue
  - src\pages\Execute.vue
- Review documents are present on Windows:
  - REVIEW.md
  - PLAN.md
  - BRIEF.md
- Handoff docs are present on Windows:
  - CODEx_HANDOFF.md
  - CODEx_HANDOFF_QUICK.md

What the debug line shows
- executionPlan
- currentHoldings
- transitionPlan
- Compact shape labels: none / array(n) / obj(n)

What local Codex should do first
1. Open REVIEW.md first.
2. Confirm the latest source in Index.vue and Execute.vue matches the review copy.
3. Run a production build.
4. Restart the app/dev server.
5. Confirm the debug line appears on both pages.
6. Only then continue with the actual finance-portal bug fixing.

Rules / guardrails
- Keep changes minimal.
- Do not remove the debug line until the flow is stable.
- Do not touch unrelated logic unless the loaded state is clearly wrong.
- Use the review doc as the source of truth for the current debugging direction.

Suggested first debugging question
- Does the app load executionPlan, currentHoldings, and transitionPlan consistently after a restart and rebuild?
