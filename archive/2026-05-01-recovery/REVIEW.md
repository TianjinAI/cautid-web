# REVIEW

## Verdict

`PLAN.md` is directionally right, but it does **not** fully cover the real code paths in `format.js`, `Index.vue`, and `Execute.vue`.

It correctly identifies the broad categories of bugs, but the proposed fixes are too narrow in three critical places:

1. type normalization is larger than `DEPOSIT_TYPES` and `getRateForType()`;
2. thousand-rounding cannot be limited to `createNewDeposit()`;
3. `Execute.vue` is currently fed the wrong data shape, so the “总资产 / 当前状态” bug will survive unless `Index.vue` changes what it stores.

## 1. Does the plan correctly address all 6 bugs?

**No, not completely.**

### B1. Type string mismatch

`PLAN.md` lines 67-68 are too narrow.

The mismatch is real, but it is not confined to `DEPOSIT_TYPES` and `getRateForType()`.

Relevant code:

- `format.js:17-25` defines spaced names like `'3 个月定期'`, `'1 年定期'`, `'2 年定期'`, `'3 年定期'`, `'5 年定期'`.
- `format.js:125-137`, `143-160`, `165-182` mostly compare against unspaced names, except 2-year still uses `'2 年定期'`.
- `format.js:276-303`, `325`, `440`, `463`, `478`, `493`, `907-915`, `946-950` mix spaced and unspaced values.
- `Index.vue:67-72` uses `'2 年定期'`, while other terms are unspaced.
- `Index.vue:847` checks `'3 年定期'`, so the style branch is already wrong for current unspaced `'3年定期'`.
- `Execute.vue:199-202`, `233-257`, `537-543` are also inconsistent and incomplete.

**Recommended change**

- Add a canonical helper such as `normalizeDepositType(type)` in `format.js`.
- Convert all internal comparisons to canonical unspaced forms:
  - `活期存款`
  - `3个月定期`
  - `6个月定期`
  - `1年定期`
  - `2年定期`
  - `3年定期`
  - `5年定期`
- Normalize at all input boundaries:
  - `Index.vue:218-227` when saving `existingPortfolio`
  - `generatePlan()` before grouping/comparing
  - `Execute.vue:232-257` when parsing allocation text

### B2. Missing 2-year rate

`PLAN.md` line 68 is correct but incomplete.

`format.js:131-132` currently handles `'2 年定期'`, not `'2年定期'`, so a no-space 2-year type returns `0`.

But fixing only `getRateForType()` is not enough. The 2-year path is still broken elsewhere:

- `format.js:153-154` and `175-176` use `'2 年定期'` in `getYearsForType()` and `getMonthsForType()`.
- `format.js:1724-1728` in `createNewDeposit()` has no 24-month branch at all.
- `Execute.vue:199-202` drops 2-year deposits from the displayed order entirely.
- `Execute.vue:233-257` has no 2-year mapping in `mapAllocationType()`.
- `Execute.vue:617-624` and `344-347` do not classify or iconize 2-year deposits.
- `Execute.vue:537-543` uses spaced long-term names and will not find unspaced 2-year items either.

**Recommended change**

- Fix `getRateForType()`, `getYearsForType()`, `getMonthsForType()`, and `createNewDeposit()` together.
- Add 2-year support to `Execute.vue` ordering, mapping, icon, class, and withdrawal filters.

### B3. Interest should be full-term at maturity

`PLAN.md` line 69 is correct for `generateTransitionPlan()`.

Current code in `format.js:846-849`:

```js
const daysUntilMaturity = Math.ceil((maturityDate - currentDate) / (1000 * 60 * 60 * 24));
const rate = (deposit.interestRate || getRateForType(deposit.type)) / 100;
const yearsToMaturity = daysUntilMaturity / 365;
const projectedInterest = deposit.amount * rate * yearsToMaturity;
```

That is **remaining-term accrual**, not full-term bank payout. It is the bug the user described.

**What it should be**

- For standard term products, use the contract term:
  - `3个月定期 -> 0.25`
  - `6个月定期 -> 0.5`
  - `1年定期 -> 1`
  - `2年定期 -> 2`
  - `3年定期 -> 3`
  - `5年定期 -> 5`
- Example fix in `generateTransitionPlan()`:

```js
const years = getYearsForType(normalizeDepositType(deposit.type));
const projectedInterest = deposit.amount * rate * years;
```

### B4. Thousand-rounding

`PLAN.md` line 70 is **wrong**.

The plan says to round only inside `createNewDeposit()`. That is insufficient because many deposit amounts are created or mutated long before `createNewDeposit()` runs.

All current amount creation/mutation sites in `format.js`:

- New-plan deposits are created at:
  - `310-320` (`currentDeposit`)
  - `325-335` (`threeMonthDeposit`)
  - `341-351` (`sixMonthDeposit`)
  - `439-449` (`oneYearDeposit`)
  - `462-472` (`twoYearDeposit`)
  - `477-487` (`fiveYearDeposit`)
  - `492-502` (`threeYearDeposit`)
- Existing amounts are mutated at:
  - `382-390` (`sixMonthDeposit.amount -= reduction`)
  - `395-400` (`threeMonthDeposit.amount -= reduction`)
  - `455-457` (`sixMonthDeposit.amount += remainingCash`)
- Transition reallocation amounts are created at:
  - `899-923` in `determineTransitionAllocation()`
- Early-withdrawal destination balances are mutated at:
  - `1692-1697` in `addToDestinationDeposit()`
- New destination deposit objects are created at:
  - `1720-1746` in `createNewDeposit()`

There is also a second-order problem: the execution actions later persist whatever numbers are emitted into `actionDetails`, so if those values are not rounded at generation time, `Execute.vue` will carry forward non-thousand fixed deposits.

**Recommended change**

- Add one helper, for example:

```js
function roundFixedDepositAmount(type, amount) {
  if (normalizeDepositType(type) === '活期存款') return amount;
  return Math.floor(amount / 1000) * 1000;
}
```

- Apply it at every fixed-deposit creation/mutation site above.
- Do **not** round interest that lands in demand deposits.
- If rounding a fixed deposit leaves a remainder, move the remainder into `活期存款` explicitly instead of losing it silently.

### B5. 总资产 wrong in Execute

`PLAN.md` lines 80-83 are partially right, but the real problem is deeper.

The left panel in `Execute.vue` currently computes total from `planData.allocation`:

- `Execute.vue:170-213`

That total is only correct if `planData.allocation` represents the **current actual holdings**. Right now it does not.

`Index.vue:416-437` stores this payload:

- `allocation: allocationWithFlags`

But `allocation.value` comes from `plan.allocation` (`Index.vue:351`), and `plan.allocation` is the optimizer’s **target bucket allocation**, not the user’s current state.

So the executor is starting from the wrong baseline.

**Correct calculation**

- At initial load, 总资产 should be **principal only**:
  - `X + Y`
  - where `X = 活期`
  - and `Y = sum(existing fixed deposits)`
- It should **not** include projected interest before maturity.
- After the user marks maturities complete or edits demand balance, 总资产 should be:
  - `sum(deposit.remainingBalance ?? deposit.amount)` across the current execution-state deposits.

**Recommended change**

- In `Index.vue:424-437`, store both:
  - the optimized target plan
  - and a separate `currentStateAllocation` built from the user’s current holdings only
- That `currentStateAllocation` should be grouped from:
  - manual demand input
  - `existingPortfolio`
- `Execute.vue:171-213` should read the current-state structure, not the target plan allocation.
- Also pass through missing bookkeeping fields from `plan.input`:
  - `totalCash`
  - `existingTotal`
  - `netNewCash`
  - `existingPortfolio`
  - `transitionPlan`

### B6. 过渡计划 should be a table

`PLAN.md` lines 84-85 are incomplete because the data is not currently available in `Execute.vue`.

`generatePlan()` already produces `transitionPlan`:

- `format.js:790-808`

But `Index.vue:424-437` does **not** save it into `executionPlan`, and `Execute.vue:82-229` never loads it.

So a Phase 3 UI change alone cannot work.

**Recommended change**

- First add `transitionPlan` to the `executionPlan` payload in `Index.vue`.
- Then render that array in `Execute.vue` as the table.
- If the table should replace or complement the grouped maturity cards, the plan should say that explicitly.

## 2. Is the “full-term interest” approach correct?

**Yes.** For the user’s stated banking rule, the correct model is full-term interest paid at maturity, not accrual from “today until maturity”.

Current code in `generateTransitionPlan()` (`format.js:846-849`) is partial accrual of the **remaining** time. That is incorrect for this product behavior.

Use full term instead.

One additional issue the plan misses:

- `format.js:566-568` adds `existingEarnedInterest` into `totalProjectedInterest`
- but the existing deposits are also included again in the later projected-interest loops (`559-564`, `572-615`, `619-662`, `667-695`, `702-733`)

That double-counts interest and violates the plan’s own “No double counting” principle (`PLAN.md:44`).

**Recommended change**

- Remove `existingEarnedInterest` from `summary.totalProjectedInterest`, or keep it only as a separate informational metric.

## 3. Where exactly does rounding need to happen?

In `format.js`, rounding needs to happen anywhere a **new fixed deposit amount is created or an existing fixed deposit amount is changed**.

Exact sites:

1. `310-320` when creating `currentDeposit`
   - no fixed rounding needed if this remains demand only
2. `325-335` when creating `threeMonthDeposit`
3. `341-351` when creating `sixMonthDeposit`
4. `382-390` when reducing `sixMonthDeposit.amount`
5. `395-400` when reducing `threeMonthDeposit.amount`
6. `439-449` when creating `oneYearDeposit`
7. `455-457` when adding remainder back into `sixMonthDeposit`
8. `462-472` when creating `twoYearDeposit`
9. `477-487` when creating `fiveYearDeposit`
10. `492-502` when creating `threeYearDeposit`
11. `899-923` when deciding transition reallocation targets
12. `1692-1697` when topping up an existing destination deposit
13. `1720-1746` when creating a new destination deposit via `createNewDeposit()`

I would also treat the rollover splits in `generateExecutionList()` as rounding-sensitive because those values become persisted execution balances later:

- `1079-1097`
- `1181-1195`
- `1256-1270`
- `1348-1352`
- `1395-1396`

## 4. What should 总资产 show in Execute.vue?

**It should show current principal actually held, not future interest.**

At the moment the user sends the plan to execution:

- 总资产 = `活期 X + existing fixed deposits Y`
- do **not** include projected interest
- do **not** replace current holdings with the optimizer’s target buckets

After operations are completed:

- 总资产 = sum of current execution balances
- in code terms: `sum(dep.remainingBalance ?? dep.amount)`

So the correct rule is:

- initial state: `X + Y`
- later state: current balances after completed events / withdrawals / manual edits
- never add projected interest before it is realized

## 5. Bugs the plan misses

### Missing bug A: 2-year deposits still disappear in Execute

- `Execute.vue:199-202` standard order excludes 2-year.
- Result: even after fixing `format.js`, 2-year holdings may not display.

### Missing bug B: 2-year allocation text cannot be parsed or displayed

- `Execute.vue:233-257` has no 2-year mapping.
- `Execute.vue:617-624` has no 2-year icon.
- `Execute.vue:344-347` has no 2-year class logic.

### Missing bug C: withdrawal modal cannot find long-term deposits

- `Execute.vue:537-543` uses spaced names:
  - `'1 年定期'`
  - `'2 年定期'`
  - `'3 年定期'`
  - `'5 年定期'`
- Current data elsewhere is mostly unspaced.

### Missing bug D: `createNewDeposit()` has no 2-year maturity handling

- `format.js:1724-1728` never sets `months = 24`.

### Missing bug E: projected interest double-counting

- `format.js:566-568` plus later interest loops.

### Missing bug F: current-state and target-state are conflated

- `Index.vue:416-437` sends target allocation as executor state.
- This is the core reason Execute totals are conceptually wrong even before any merge logic runs.

## 6. Is the implementation order correct?

**No.** The current order increases rework risk.

Better order:

1. Canonicalize deposit type names across all three files.
2. Finish 2-year support everywhere (`rate`, `years`, `months`, ordering, parsing, icon/class, withdrawal filter).
3. Fix the `executionPlan` payload shape in `Index.vue` so Execute receives real current-state data plus `transitionPlan`.
4. Fix Execute total calculation against that current-state payload.
5. Fix full-term interest and remove projected-interest double counting.
6. Apply thousand-rounding consistently to every fixed-deposit creation/mutation site.
7. Render the 过渡计划 table.

Reason:

- Steps 1-3 are structural dependencies.
- If Phase 1 only edits `format.js`, Phase 3 will still break on mismatched strings and missing payload fields.
- If the executor keeps consuming target allocation instead of current-state allocation, UI fixes alone will still show the wrong totals.

## 7. Risky steps in the plan

### Risk 1: “Normalize all DEPOSIT_TYPES” without a canonical helper

If this is done by ad hoc string replacement, it is easy to fix one path and break another. Use a normalization helper and apply it consistently.

### Risk 2: Rounding only in `createNewDeposit()`

That will leave non-thousand values in:

- initial target allocation
- transition reallocations
- rollover edits
- top-ups after withdrawal

### Risk 3: Building Execute totals from `planData.totalCash`

That would freeze the total at the original input and drift after completed maturities or withdrawals. Totals should come from current balances, not a static seed value.

### Risk 4: Adding a table in Execute before passing `transitionPlan`

That will produce empty UI or force duplicate logic in the view layer.

## Recommended plan edits

Revise `PLAN.md` as follows:

1. Replace line 67 with “Normalize deposit type strings across `format.js`, `Index.vue`, and `Execute.vue` using a shared canonical helper.”
2. Replace line 68 with “Add full 2-year support: rate, years, months, creation, parsing, ordering, display, and withdrawal eligibility.”
3. Replace line 70 with “Apply thousand-rounding at every fixed-deposit creation/mutation site, not only `createNewDeposit()`.”
4. Add under Phase 2: “Store separate `currentStateAllocation` and `transitionPlan` in `executionPlan`; do not send target allocation as current state.”
5. Replace Phase 3 step 1 with “Compute 总资产 from current balances (`remainingBalance ?? amount`), seeded initially from current holdings (`X + Y`) without projected interest.”
6. Add a QC checkpoint for projected-interest double counting on existing deposits.
