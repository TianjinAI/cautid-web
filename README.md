# cautid-web

`cautid-web` is a Vue 3 deposit planning and execution portal for managing demand cash plus fixed deposits under a debt-first, cashflow-first rule set.

The app helps a user:
- keep enough `活期存款` for `应急金 + 本季度支出`
- allocate excess cash into fixed deposits by term
- import an existing deposit portfolio from CSV
- track execution as deposits mature over time
- manually adjust `活期` when real life diverges from the ideal plan

## Core Product Rule

`先保证应急金和支出覆盖，再考虑定期收益。`

Operationally:
- obligations first, yield second
- `活期目标 = 应急金 + 本季度支出`
- existing fixed deposits remain real holdings until they mature
- execution uses the user's confirmed current `活期` balance as the live truth

## Main Pages

- `Index.vue`: planning page
- `Execute.vue`: execution tracker
- `Detail.vue`: plan details
- `Profile.vue`: saved plans
- `src/utils/format.js`: financial calculation engine

## Run

Install dependencies:

```powershell
npm install
```

Start the dev server:

```powershell
npm.cmd run dev
```

Build for production:

```powershell
npm.cmd run build
```

## Documentation

Start here:

- [docs/DOCS_INDEX.md](D:/Projects/微信小程序/cautid-web/docs/DOCS_INDEX.md)
- [docs/USER_MANUAL.md](D:/Projects/微信小程序/cautid-web/docs/USER_MANUAL.md)
- [docs/DEVELOPER_NOTES.md](D:/Projects/微信小程序/cautid-web/docs/DEVELOPER_NOTES.md)
- [docs/PROJECT_STATE.md](D:/Projects/微信小程序/cautid-web/docs/PROJECT_STATE.md)

## Repository Notes

- The runnable app is the repository root.
- The nested `cautid-web/` folder appears to be a stale duplicate tree.
- Legacy handoff files have been moved into `archive/2026-05-01-recovery/`.

## Current Status

The portal is working, with major recovery fixes already implemented for:
- planning-to-execution payload consistency
- CSV import for the real fixed-deposit file format
- current-holdings tracking and rollback
- quarter-reserve execution flow with confirmed `活期`
- execution-side liquidity warning

Known remaining work is documented in [docs/PROJECT_STATE.md](D:/Projects/微信小程序/cautid-web/docs/PROJECT_STATE.md).
