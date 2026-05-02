# QC Review Task

You are reviewing a recovery plan for a Vue 3 finance portal app.

## Files in this directory
- `PLAN.md` — the recovery plan to review
- `Execute.vue` — original execution page (clean baseline)
- `Index.vue` — original planning page (clean baseline)
- `format.js` — original calculation engine (clean baseline)

## Background
- App: 财梯 (CaiTi) — Fixed deposit ladder optimizer
- User: building this for his elderly mother to use
- User stated rules:
  1. Plan first, code later
  2. Document mistakes
  3. Use a second agent to QC

## User-Reported Bugs (the plan addresses these)
1. **Type string mismatch** — DEPOSIT_TYPES uses spaces ('3 个月定期'), allocation logic checks without spaces ('3个月定期'). Plans fail silently.
2. **2-year rate missing** — getRateForType() doesn't have case '2年定期', returns 0.
3. **Interest is partial-period accrual** — User: "Bank pays full-term interest at maturity, not partial. We need full term."
4. **No thousand rounding** — Plans show ¥36,515.62 etc. Real banking is whole thousands.
5. **总资产 wrong in 执行** — Shows wrong total, doesn't match what user loaded in 规划.
6. **过渡计划 was a list, should be table** (UI fix)

## Your Task

Review `PLAN.md` and answer:

1. Does it correctly address all 6 bugs?
2. Is the "full-term interest" approach correct? Find the relevant code in format.js (function `generateTransitionPlan`). Currently it uses: `projectedInterest = deposit.amount * rate * yearsToMaturity` where yearsToMaturity = daysUntilMaturity/365. Is this partial accrual or full term? What should it be?
3. Where exactly does rounding need to happen? Look at format.js — find ALL places where deposit amounts are created or modified.
4. For the 总资产 in Execute.vue: what's the correct calculation?
   - User has 活期 (demand): X
   - User has existing fixed deposits totaling: Y
   - Plan generates new allocation
   - What should 总资产 show? Just X+Y? Or include projected interest? Or after-allocation values?
5. Are there bugs the plan MISSES?
6. Is the implementation order correct?
7. Any risky steps that could break the app again?

Write your review to `REVIEW.md` in this directory.
Be SPECIFIC. Quote line numbers. Recommend exact changes.
