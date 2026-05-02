# User Manual

## What This App Does

This app helps manage:
- `活期存款`
- existing fixed deposits
- future fixed-deposit planning
- execution as deposits mature over time

Its main rule is:

`先保证应急金和季度支出，再考虑定期收益。`

## Planning Page

The planning page asks for:
- current `活期存款`
- `应急金`
- `房屋支出`
- `餐饮支出`
- `其他支出`
- planning horizon

The three expense inputs are combined into:
- monthly expense
- quarterly expense
- annual expense

### Existing Fixed Deposits

Under `定期存款`, you can:
- add deposits manually
- import deposits from CSV
- clear the current portfolio

### CSV Import

The importer supports the current real file format used in this project:

`期限, 金额, 存入日, 利率`

Example row:

`两年,50000,2024/05/06,1.90`

The app treats the date column as the deposit start date and infers maturity from the term.

## Generate Plan

Click `生成存款计划` to create:
- recommended allocation
- cashflow timeline
- execution plan

The planning logic keeps enough `活期` for:

`应急金 + 本季度支出`

and allocates the rest into fixed deposits.

If liquidity is too low, the page shows a warning.

## Send to Execution

Click `送去执行` to open the execution page.

The execution page receives:
- current holdings
- target allocation
- execution tasks
- transition plan for existing deposits
- expense inputs and emergency fund

## Execution Page

The execution page has three main ideas:

1. `初始调仓建议`
2. upcoming maturities
3. current tracked balances

### Initial Rebalance

This is a one-time setup step.

It shows how current holdings should be moved to match the plan before the rolling maturity workflow starts.

After you click `完成初始调仓`, the card becomes a completed setup record. You can still `折返` it if needed.

### Completing a Maturity

Before clicking `确认完成`, you confirm:
- actual interest received
- current real `活期` balance

The app then:
- uses your confirmed `活期` balance as the truth
- applies the maturity allocation
- updates tracked balances
- stores a rollback snapshot

### Rollback

If you completed the wrong task:
- go to `历史记录`
- click `折返`

This restores the pre-completion snapshot.

### Manual Demand-Balance Adjustment

The `活期存款` card supports `手动调整`.

Use it when real life changes the balance before the next maturity, for example:
- unexpected overspending
- extra cash inflow
- off-app banking activity

### Liquidity Warning

The execution page shows `流动性预警` when:

`活期余额 - 应急金 < 本季度支出`

This helps surface interim shortfalls before the next maturity happens.

## Recommended Workflow

1. Enter current demand balance and expenses.
2. Import or enter existing fixed deposits.
3. Generate the plan.
4. Send it to execution.
5. Complete the initial rebalance once.
6. As each maturity happens:
   - confirm real `活期`
   - confirm actual interest
   - complete the task
7. Use `手动调整` if spending changes the real balance.
8. Watch the liquidity warning between maturities.

## Important Limits

- The app does not observe real bank transactions automatically.
- It does not track every real expense event.
- Execution accuracy depends on:
  - confirming the real `活期` balance
  - using manual adjustment when needed

That is intentional. The app is a practical planning and tracking tool, not a bank integration.
