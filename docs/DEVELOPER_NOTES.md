# Developer Notes

## Product Logic

The governing business rule is:

`Debt obligations and cash availability come first; interest optimization comes second.`

Operationally:
- `活期` is the liquidity buffer
- `应急金` is untouchable reserve
- quarterly expenses determine short-term cash needs
- fixed deposits should only use cash above the reserve target

Reserve target:

`应急金 + 本季度支出`

## Execution Philosophy

Execution is not fully automatic because the app cannot observe real spending.

So the current model is:
- planning is rules-based
- execution is user-confirmed
- `活期` balance at completion time is the live source of truth
- rollback is snapshot-based

## Core Files

- [src/pages/Index.vue](D:/Projects/微信小程序/cautid-web/src/pages/Index.vue)
  - planning form
  - CSV import
  - generate plan
  - send plan to execution

- [src/pages/Execute.vue](D:/Projects/微信小程序/cautid-web/src/pages/Execute.vue)
  - execution dashboard
  - initial rebalance workflow
  - maturity completion modal
  - rollback logic
  - liquidity warning
  - manual demand-balance adjustment

- [src/utils/format.js](D:/Projects/微信小程序/cautid-web/src/utils/format.js)
  - financial calculations
  - target allocation generation
  - transition plan generation
  - execution-list generation

## Important Current Behaviors

### CSV Import

The importer supports the user's real headerless file format.

It assumes:
- column 1: term
- column 2: amount
- column 3: deposit start date
- column 4: interest rate

### Existing Deposit Maturities

Existing deposits do not disappear into the optimizer.

They remain visible as real holdings and generate transition actions when they mature.

### Completion Snapshots

When a maturity is completed, execution stores:
- `confirmedDemandBalanceBefore`
- `allocationApplied`
- `snapshotBefore`
- `snapshotAfter`

Rollback restores `snapshotBefore` directly.

### Initial Rebalance

This is treated as a one-time setup step, not an always-live recommendation panel.

## Housekeeping Guidance

The repo root still contains legacy working files:
- `BRIEF.md`
- `PLAN.md`
- `REVIEW.md`
- `CODEx_HANDOFF*.md`
- `git_*_output.txt`

Treat them as historical notes unless a specific investigation needs them.

The likely stale duplicate tree is:
- `cautid-web/`

Do not edit it unless you deliberately decide to archive or remove it.

## Recommended Verification Routine

For any meaningful fix:

1. `npm.cmd run build`
2. run a local dev server from repo root
3. test the real browser flow
4. confirm both planning and execution views

## Good Next Candidates

- thousand-rounding policy audit
- `2年定期` full-path audit
- saved-plan documentation polish
- archive or remove stale duplicate tree after confirmation
