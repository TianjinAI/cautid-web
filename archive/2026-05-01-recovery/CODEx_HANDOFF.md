Codex handoff for cautid-web

Context
- Project: 财梯 / cautid-web
- Windows source path: D:\Projects\微信小程序\cautid-web
- Purpose: finish debugging the Index/Execute flow without more back-and-forth in chat

Current state
- Debug status lines were added in the local QC copy for both pages:
  - Index.vue
  - Execute.vue
- The debug line shows:
  - executionPlan
  - currentHoldings
  - transitionPlan
- Shape format is compact: none / array(n) / obj(n)

Important caveat
- I have NOT verified that the latest edits were pushed back into the Windows repo yet.
- Treat the Windows copy as potentially stale until you sync and rebuild.

Recommended next steps
1. Sync the latest Index.vue and Execute.vue back into:
   D:\Projects\微信小程序\cautid-web\src\pages\Index.vue
   D:\Projects\微信小程序\cautid-web\src\pages\Execute.vue
2. Run a production build on Windows.
3. Restart the dev server / app.
4. Confirm the new debug lines are visible on both tabs.
5. If the flow is correct, remove the debug lines afterward.

Debug goal
- Use the visible status line to quickly confirm whether the app loaded:
  - executionPlan from localStorage
  - currentHoldings/current deposits
  - transitionPlan

Notes
- Keep changes minimal.
- Don’t touch unrelated logic unless the debug output reveals a specific state-loading bug.
