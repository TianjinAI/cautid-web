# Finance Portal — Recovery & Enhancement Plan
**Date:** 2026-04-29
**Author:** Hermes (claude-opus-4-7)

## Current State (After Revert)
All files reverted to clean backup `cautid-backup-20260428_014041`.
- Execute.vue: 61,973 bytes (original)
- Index.vue: 55,260 bytes (original)
- format.js: 71,248 bytes (original)

## Root Causes of Bugs (from session debugging)

### B1. Type string inconsistency
`DEPOSIT_TYPES` constants use spaces ('3 个月定期') but plan generator checks without spaces ('3个月定期'). Plan silently fails to allocate.

### B2. Missing 2-year rate
`getRateForType()` switch missing `case '2年定期'` — returns 0 for all 2-year deposits.

### B3. Interest projection wrong (NEW)
Existing deposits should earn FULL-TERM interest at maturity (what bank pays), not partial-period accrual. User explicitly stated.

### B4. No thousand-rounding on transitions
`createNewDeposit()` rounds, but transition rollovers and existing deposits don't.

### B5. Total in 执行 wrong
Multiple bugs:
- `planData.totalCash` not always passed
- Merge logic in Execute.vue rebuilds inconsistently
- Initial allocation event mixes existing + new amounts

### B6. UI confusion
- 过渡计划 originally a list, needed table format
- Per-maturity allocation block was correct, I removed it incorrectly
- "初始分配" event I added confuses by mixing demand with existing

## Design Principles (from user feedback)

1. **Mom-friendly** — User hands app to elderly mother who has no computer skills. UI must be clear, no jargon.
2. **Current state, not target state** — Summary table shows what user HAS NOW, not what plan wants.
3. **Bank reality** — Use real banking conventions:
   - Fixed deposits in whole thousands
   - Full-term interest at maturity (not accrual)
4. **Transition is everything** — Existing deposits gradually mature → roll into optimized plan. App's job is to tell user what to do at each maturity.
5. **No double counting** — Each deposit appears exactly once in the summary.

## Scope of This Plan

### IN SCOPE
1. Fix type string consistency (B1)
2. Add 2-year rate case (B2)
3. Fix interest calculation: full-term, not partial (B3)
4. Round all deposit amounts to whole thousands consistently (B4)
5. Make 执行 资金分配 show CURRENT STATE accurately (B5)
6. Make 过渡计划 a clean table (UI)
7. Preserve per-maturity allocation block (it was right)
8. Clear/refresh buttons (already added, keep them)

### OUT OF SCOPE (do NOT add)
- "初始分配" event in timeline (was confusing, conceptually unclear)
- Auto-clearing localStorage on load
- Watch on route changes
- Any new clever logic — keep things simple

## Implementation Steps (in order)

### Phase 1: format.js fixes (calculation engine)
1. Normalize all DEPOSIT_TYPES to no-space format
2. Add `case '2年定期'` to getRateForType
3. Change interest calc in transition plan: use FULL TERM interest
4. Apply thousand-rounding inside `createNewDeposit()` only
5. Build & test on VPS

### Phase 2: Index.vue (planning side)
1. Pass totalCash, existingTotal, netNewCash to planData
2. Add CSV import (already done in original — verify)
3. Add "清空" button for existing portfolio
4. Build & test on VPS

### Phase 3: Execute.vue (execution side)
1. 资金分配 = current state computed from:
   - planData.totalCash (the actual user input)
   - existingPortfolio merged into allocation buckets
   - Apply completed events: subtract from source, add to targets
2. 过渡计划 = clean 5-column table view
3. Keep per-maturity allocation block (don't remove again)
4. Build & test on VPS

### Phase 4: End-to-end test
1. Restart dev server
2. Clear localStorage
3. Import CSV → generate plan → send to execute
4. Verify totals match
5. Click 完成 on a maturity → verify summary updates

## QC Checkpoints

Before EACH phase:
- VPS build passes
- Manual file verification (no duplicate code)

Before user testing:
- Run subagent code review on the plan
- Verify all 6 bugs addressed
- Document any remaining edge cases

## File State Tracking

| File | Original | After Phase 1 | After Phase 2 | After Phase 3 |
|------|----------|---------------|---------------|---------------|
| format.js | 71248 B | TBD | - | - |
| Index.vue | 55260 B | - | TBD | - |
| Execute.vue | 61973 B | - | - | TBD |

## Rollback Strategy
If any phase fails, revert from `~/.hermes/cautid-backup-20260428_014041`.
