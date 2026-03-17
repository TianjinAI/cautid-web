// 财梯核心计算逻辑
// 对应原 utils/format.js

// 全局常量
const QUARTER_DAYS = 91;  // 一季度天数
const MIN_DEPOSIT_DAYS = 91;  // 最短存款期限
const MAX_DEPOSIT_DAYS = 365;  // 最长存款期限
const EARLY_WITHDRAW_PENALTY_RATE = 0.7;  // 提前支取罚息比例

/**
 * 计算单笔存款到期本息
 * @param {number} principal - 本金
 * @param {number} rate - 年利率
 * @param {number} days - 存期天数
 * @returns {number} 到期本息
 */
export function calculateMaturityAmount(principal, rate, days) {
  return principal * (1 + rate * days / 365);
}

/**
 * 计算实际收益率
 * @param {number} principal - 本金
 * @param {number} maturityAmount - 到期本息
 * @param {number} days - 存期天数
 * @returns {number} 实际年化收益率
 */
export function calculateActualYield(principal, maturityAmount, days) {
  return ((maturityAmount / principal - 1) * 365 / days) * 100;
}

/**
 * 模拟季度自动转存
 * @param {Object} deposit - 存款对象
 * @param {number} currentDay - 当前天数
 * @param {Array} quarters - 存款计划季度数组
 * @returns {Object} 包含操作记录的对象
 */
export function simulateQuarterlyRenewal(deposit, currentDay, quarters) {
  const operations = [];
  const maturityDay = deposit.startDay + deposit.days;

  // 如果已到期且在当前季度内
  if (maturityDay <= currentDay) {
    operations.push({
      day: maturityDay,
      type: 'mature',
      principal: deposit.principal,
      maturityAmount: calculateMaturityAmount(deposit.principal, deposit.rate, deposit.days),
      note: `${deposit.name || '存款'}到期`
    });

    // 查找该存款属于哪个季度
    const quarterIndex = quarters.findIndex(q =>
      deposit.startDay >= q.startDay && deposit.startDay < q.endDay
    );

    if (quarterIndex !== -1) {
      // 在同一季度内自动续存
      const renewalDeposit = {
        ...deposit,
        startDay: maturityDay,
        principal: calculateMaturityAmount(deposit.principal, deposit.rate, deposit.days)
      };

      operations.push({
        day: maturityDay,
        type: 'renew',
        principal: renewalDeposit.principal,
        note: `${deposit.name || '存款'}自动续存`
      });

      return { operations, renewedDeposit: renewalDeposit };
    }
  }

  return { operations, renewedDeposit: deposit };
}

/**
 * 检查是否存在缺口
 * @param {Array} deposits - 存款数组
 * @param {number} targetAmount - 目标金额
 * @param {number} checkDay - 检查日期
 * @returns {Object} 缺口信息
 */
export function checkDeficit(deposits, targetAmount, checkDay) {
  let availableAmount = 0;

  deposits.forEach(deposit => {
    const maturityDay = deposit.startDay + deposit.days;
    if (maturityDay <= checkDay) {
      availableAmount += calculateMaturityAmount(deposit.principal, deposit.rate, deposit.days);
    } else {
      // 提前支取计算
      const earlyWithdrawAmount = deposit.principal * (1 + deposit.rate * checkDay / 365 * EARLY_WITHDRAW_PENALTY_RATE);
      availableAmount += earlyWithdrawAmount;
    }
  });

  const deficit = targetAmount - availableAmount;

  return {
    hasDeficit: deficit > 0,
    deficit: deficit > 0 ? deficit : 0,
    available: availableAmount
  };
}

/**
 * 生成存款计划
 * @param {number} totalAmount - 总资金
 * @param {number} targetAmount - 目标金额
 * @param {number} quarterlyInput - 每季度追加投入
 * @param {number} rate - 年利率
 * @param {number} planDuration - 计划总时长（天）
 * @returns {Object} 包含存款计划和执行跟踪的完整计划
 */
export function generatePlan(totalAmount, targetAmount, quarterlyInput, rate, planDuration) {
  // 分割资金：一部分立即存入长期，一部分作为季度补充
  const initialDeposit = totalAmount * 0.8;  // 80%立即存入长期
  const reserveFund = totalAmount * 0.2;     // 20%作为储备金

  // 计算季度数
  const quarterCount = Math.ceil(planDuration / QUARTER_DAYS);

  // 生成季度计划
  const quarters = [];
  for (let i = 0; i < quarterCount; i++) {
    const startDay = i * QUARTER_DAYS;
    const endDay = Math.min((i + 1) * QUARTER_DAYS, planDuration);

    quarters.push({
      index: i,
      startDay,
      endDay,
      plannedInput: i === 0 ? reserveFund : quarterlyInput,
      deposits: [],
      maturityEvents: []
    });
  }

  // 生成初始存款
  const initialDeposits = [];
  const longTermDeposit = {
    id: 'init_' + Date.now(),
    name: '初始长期存款',
    principal: initialDeposit,
    rate: rate,
    days: planDuration,
    startDay: 0,
    type: 'long_term'
  };
  initialDeposits.push(longTermDeposit);

  // 计划执行跟踪
  const executionPlan = {
    totalAmount,
    targetAmount,
    quarterlyInput,
    rate,
    planDuration,
    initialDeposit,
    reserveFund,
    quarters,
    deposits: [...initialDeposits],
    events: []
  };

  // 模拟每个季度的执行情况
  for (let quarter of executionPlan.quarters) {
    // 季度开始时新增存款
    if (quarter.plannedInput > 0) {
      const newDeposit = {
        id: `q${quarter.index}_${Date.now()}`,
        name: `Q${quarter.index + 1}追加`,
        principal: quarter.plannedInput,
        rate: rate,
        days: planDuration - quarter.startDay,
        startDay: quarter.startDay,
        type: 'quarterly_addition'
      };
      executionPlan.deposits.push(newDeposit);
      quarter.deposits.push(newDeposit);
    }

    // 检查到期事件
    for (let deposit of executionPlan.deposits) {
      if (deposit.startDay + deposit.days <= quarter.endDay &&
          deposit.startDay + deposit.days > quarter.startDay) {

        const maturityAmount = calculateMaturityAmount(
          deposit.principal,
          deposit.rate,
          deposit.days
        );

        quarter.maturityEvents.push({
          depositId: deposit.id,
          depositName: deposit.name,
          maturityDay: deposit.startDay + deposit.days,
          principal: deposit.principal,
          maturityAmount: maturityAmount,
          yield: calculateActualYield(deposit.principal, maturityAmount, deposit.days)
        });
      }
    }

    // 检查此季度末的资金缺口
    const quarterEndDeficit = checkDeficit(
      executionPlan.deposits,
      executionPlan.targetAmount,
      quarter.endDay
    );

    executionPlan.events.push({
      day: quarter.endDay,
      eventType: 'quarter_end',
      quarterIndex: quarter.index,
      totalAssets: quarterEndDeficit.available,
      deficit: quarterEndDeficit.deficit,
      hasDeficit: quarterEndDeficit.hasDeficit
    });
  }

  return executionPlan;
}

/**
 * 格式化数字显示
 * @param {number} num - 数字
 * @param {number} decimals - 小数位数
 * @returns {string} 格式化后的字符串
 */
export function formatNumber(num, decimals = 2) {
  return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * 格式化日期显示
 * @param {number} days - 天数
 * @returns {string} 格式化的日期描述
 */
export function formatDate(days) {
  const weeks = Math.floor(days / 7);
  const remainingDays = days % 7;
  return `${weeks}周${remainingDays}天`;
}

/**
 * 保存计划到本地存储
 * @param {string} key - 存储键名
 * @param {any} data - 存储的数据
 */
export function savePlan(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('保存计划失败:', e);
  }
}

/**
 * 从本地存储获取计划
 * @param {string} key - 存储键名
 * @returns {any} 获取的数据
 */
export function getPlan(key) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('获取计划失败:', e);
    return null;
  }
}

/**
 * 删除指定计划
 * @param {string} key - 存储键名
 */
export function removePlan(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error('删除计划失败:', e);
  }
}

/**
 * 获取所有计划列表
 * @returns {Array} 计划列表
 */
export function getAllPlans() {
  const plans = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('plan_')) {
      const plan = getPlan(key);
      if (plan) {
        plans.push({ key, plan });
      }
    }
  }
  return plans;
}