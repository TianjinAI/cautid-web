# Live Portal Check

Checked: 2026-05-01

## Purpose

This file records the current live-validation baseline rather than the original broken-state investigation.

## Verified Runtime Notes

- The app should be run from the repository root.
- Recent local dev checks used `127.0.0.1` Vite servers from the root project.
- When `5174` is occupied, Vite may move to the next available port automatically.

## Flows Verified During Recovery

- planning page generates allocations from expense inputs
- CSV import works with the current real fixed-deposit file format
- execution receives current holdings instead of only optimized target holdings
- initial rebalance can be completed and rolled back
- maturity completion now asks for:
  - actual interest
  - current actual `活期` balance
- rollback restores the saved pre-completion snapshot
- execution page shows a live liquidity warning after manual `活期` adjustment

## Current Verification Standard

For a live bug to count as fixed:

1. `npm.cmd run build` passes
2. the app is launched from the repository root
3. the visible screen behavior matches the intended workflow

## Notes

- There are still debug/status traces in the app that were useful during recovery.
- The nested duplicate tree should remain untouched until a separate cleanup decision is made.
