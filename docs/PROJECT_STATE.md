# Project State

Last reviewed: 2026-05-01

## Runnable App

The active app is the repository root.

Primary runtime files:
- `package.json`
- `vite.config.js`
- `src/pages/Index.vue`
- `src/pages/Execute.vue`
- `src/utils/format.js`

Commands:

```powershell
npm.cmd run dev
npm.cmd run build
```

## Current Documentation Baseline

Current primary docs:
- `README.md`
- `docs/DOCS_INDEX.md`
- `docs/USER_MANUAL.md`
- `docs/DEVELOPER_NOTES.md`
- `docs/PROJECT_STATE.md`

Legacy but still useful notes:
- `archive/2026-05-01-recovery/BRIEF.md`
- `archive/2026-05-01-recovery/PLAN.md`
- `archive/2026-05-01-recovery/REVIEW.md`
- `archive/2026-05-01-recovery/CODEx_HANDOFF*.md`

## Current Working Tree

Main source files actively changed in the current recovery effort:
- `src/pages/Index.vue`
- `src/pages/Execute.vue`
- `src/utils/format.js`
- `src/styles/global.css`

Known scratch or generated items still present:
- `git_add_output.txt`
- `git_commit_output.txt`
- `git_diff_output.txt`
- `git_log_output.txt`
- `git_remote_output.txt`
- `git_status_output.txt`
- `src/utils/test_write.txt`
- `dev-server.log`
- `dev-server.err.log`

## Confirmed Working Features

- planning page expense aggregation
- CSV import for the current real deposit file format
- planning-to-execution payload consistency
- execution current-holdings tracking
- initial rebalance completion and rollback
- maturity completion and rollback
- quarter-reserve completion modal with confirmed `活期`
- execution-side liquidity warning
- manual `活期` adjustment on execution page

## Known Remaining Risks / Open Work

These are the most likely remaining nontrivial areas:

1. Archived recovery material can be pruned later if none of it is still needed.
2. The execution page can still use a final visual polish pass after behavior work is complete.

## Verification Rule

A change should not be considered done until:

1. `npm.cmd run build` passes
2. the app is run from the repository root
3. the real browser flow matches the intended behavior
