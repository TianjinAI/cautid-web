/**
 * 财务规划工具函数库
 */

// 2026年银行存款利率（参考值）
const INTEREST_RATES = {
  demand: 0.05,      // 活期
  threeMonths: 0.70,  // 3个月定期（中小银行平均值）
  sixMonths: 0.95,   // 6个月定期
  oneYear: 1.15,     // 1年定期
  twoYears: 1.20,    // 2年定期
  threeYears: 1.30,   // 3年定期
  fiveYears: 1.50     // 5年定期（添加 5 年利率）
};

// 存款类型定义（包含期限，单位：月）
const DEPOSIT_TYPES = [
  { type: '活期存款', duration: 0, rateKey: 'demand' },
  { type: '3个月定期', duration: 3, rateKey: 'threeMonths' },
  { type: '6个月定期', duration: 6, rateKey: 'sixMonths' },
  { type: '1年定期', duration: 12, rateKey: 'oneYear' },
  { type: '2年定期', duration: 24, rateKey: 'twoYears' },
  { type: '3年定期', duration: 36, rateKey: 'threeYears' },
  { type: '5年定期', duration: 60, rateKey: 'fiveYears' }
];

function normalizeDepositType(type) {
  if (type === null || type === undefined) return '';
  return String(type).replace(/\s+/g, '');
}

function roundToNearestThousand(amount) {
  if (amount === null || amount === undefined) return amount;
  if (amount < 1000) return 0;
  return Math.floor(amount / 1000) * 1000;
}

/**
 * 根据规划期限获取可用的存款类型
 * 核心约束：存款期限不能超过剩余可投资时间
 * @param {number} planningHorizon - 规划期限（年）
 * @returns {Array} 可用的存款类型列表
 */
function getAvailableDepositTypes(planningHorizon) {
  const maxMonths = planningHorizon * 12;
  return DEPOSIT_TYPES.filter(d => d.duration <= maxMonths);
}

/**
 * 获取适合剩余时间的最佳存款类型
 * @param {number} remainingMonths - 剩余月份
 * @param {Array} availableTypes - 可用存款类型
 * @returns {Object} 最佳存款类型
 */
function getBestDepositType(remainingMonths, availableTypes) {
  // 过滤出期限 <= 剩余月份的存款类型
  const validTypes = availableTypes.filter(d => d.duration > 0 && d.duration <= remainingMonths);

  if (validTypes.length === 0) {
    return null; // 没有合适的存款类型
  }

  // 选择期限最长的（利率最高的）
  return validTypes.sort((a, b) => b.duration - a.duration)[0];
}

// 格式化金额为千分位显示，保留两位小数
function formatAmount(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '0.00';
  }
  // 保留两位小数
  const fixed = parseFloat(amount).toFixed(2);
  return fixed.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// 格式化日期
function formatDate(date, format = 'YYYY年MM月DD日') {
  if (!date) return '';

  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day);
}

// 获取指定天数后的日期
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// 获取指定月数后的日期
function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

// 获取指定年数后的日期
function addYears(date, years) {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

// 计算季度起始日（1月1日、4月1日、7月1日、10月1日）
function getQuarterStartDate(year, quarter) {
  const monthMap = { 1: 0, 2: 3, 3: 6, 4: 9 };
  return new Date(year, monthMap[quarter], 1);
}

// 获取当前季度（1-4）
function getCurrentQuarter() {
  const month = new Date().getMonth();
  return Math.floor(month / 3) + 1;
}

// 计算利息：本金 * 年利率 * 期限（年）
function calculateInterest(principal, rate, years) {
  return principal * (rate / 100) * years;
}

// 获取存款类型的利率
function getRateForType(type) {
  switch (normalizeDepositType(type)) {
    case '活期存款':
      // 活期存款不计利息
      return 0;
    case '3个月定期':
      return INTEREST_RATES.threeMonths;
    case '6个月定期':
      return INTEREST_RATES.sixMonths;
    case '1年定期':
      return INTEREST_RATES.oneYear;
    case '3年定期':
      return INTEREST_RATES.threeYears;
    case '5年定期':
      return INTEREST_RATES.fiveYears;
    default:
      return 0;
  }
}

// 获取存款期限（年）
function getYearsForType(type) {
  switch (normalizeDepositType(type)) {
    case '活期存款':
      return 0;
    case '3个月定期':
      return 0.25;
    case '6个月定期':
      return 0.5;
    case '1年定期':
      return 1;
    case '2年定期':
      return 2;
    case '3年定期':
      return 3;
    case '5年定期':
      return 5;
    default:
      return 0;
  }
}

// 获取存款期限（月）
function getMonthsForType(type) {
  switch (normalizeDepositType(type)) {
    case '活期存款':
      return 0;
    case '3个月定期':
      return 3;
    case '6个月定期':
      return 6;
    case '1年定期':
      return 12;
    case '2年定期':
      return 24;
    case '3年定期':
      return 36;
    case '5年定期':
      return 60;
    default:
      return 0;
  }
}

// 验证输入数据是否有效
function validateInput(data) {
  const errors = [];

  if (!data.totalCash || data.totalCash <= 0) {
    errors.push('请输入有效的总存款金额');
  }

  if (!data.monthlyExpense || data.monthlyExpense <= 0) {
    errors.push('请输入有效的月度支出金额');
  }

  if (data.emergencyFund < 0) {
    errors.push('应急金不能为负数');
  }

  // 检查是否有足够的资金进行规划
  const quarterlyExpense = data.monthlyExpense * 3;
  if (data.totalCash < data.emergencyFund + quarterlyExpense) {
    errors.push('总存款不足以覆盖应急金和季度支出');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * 计算现有存款从存入日期到今天的已获利息
 * @param {Object} deposit - 存款对象
 * @returns {number} 已获利息金额
 */
function calculateEarnedInterestToDate(deposit) {
  if (!deposit.depositDate) return 0;

  const startDate = new Date(deposit.depositDate);
  const today = new Date();
  const days = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
  const normalizedType = normalizeDepositType(deposit.type);

  if (days <= 0) return 0;

  const rate = (deposit.interestRate || getRateForType(normalizedType)) / 100;
  // 简单利息计算
  return deposit.amount * rate * (days / 365);
}

/**
 * 核心算法：生成季度滚动阶梯式存款计划（带期限约束）
 * 核心约束：存款期限不能超过剩余可投资时间
 * @param {Object} inputData - 输入数据
 * @returns {Object} 存款计划
 */
function generatePlan(inputData) {
  const { totalCash, monthlyExpense, emergencyFund, planningHorizon = 1, existingPortfolio = [] } = inputData;
  const quarterlyExpense = monthlyExpense * 3;
  const annualExpense = monthlyExpense * 12;
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const normalizedExistingPortfolio = (existingPortfolio || []).map(d => ({ ...d, type: normalizeDepositType(d.type) }));

  // === 新增：处理现有存款 ===
  // 计算现有存款总额
  const existingTotal = existingPortfolio.reduce((sum, d) => sum + (d.amount || 0), 0);

  // 计算可用于新建计划的资金
  const netNewCash = Math.max(0, totalCash - existingTotal);

  console.log('=== EXISTING PORTFOLIO DEBUG ===');
  console.log('totalCash:', totalCash);
  console.log('existingTotal:', existingTotal);
  console.log('netNewCash:', netNewCash);
  console.log('existingPortfolio:', existingPortfolio);

  // 检查流动性：活期存款是否足够覆盖季度支出
  const existingDemand = normalizedExistingPortfolio.find(d => normalizeDepositType(d.type) === '活期存款');
  const availableDemand = existingDemand ? existingDemand.amount - emergencyFund : 0;
  const liquidityShortfall = Math.max(0, quarterlyExpense - availableDemand);

  if (liquidityShortfall > 0 && !existingDemand) {
    console.log('WARNING: No demand deposit in existing portfolio, need to allocate from netNewCash');
  }

  // 规则化处理：活期作为总流动资金池，先满足规则目标，再按顺序分配剩余资金
  const availableCash = Math.max(0, netNewCash);

  // 获取基于规划期限的可用存款类型
  const availableTypes = getAvailableDepositTypes(planningHorizon);
  const has2Year = availableTypes.some(t => t.type === '2年定期');
  const has3Year = availableTypes.some(t => t.type === '3年定期');
  const has5Year = availableTypes.some(t => t.type === '5年定期');
  const has1Year = availableTypes.some(t => t.type === '1年定期');

  // 构建可用类型映射
  const typeMap = {};
  availableTypes.forEach(t => {
    typeMap[t.type] = t;
  });

  // === 新增：分析现有存款覆盖情况 ===
  // 按类型汇总现有存款
  const existingByType = {};
  normalizedExistingPortfolio.forEach(d => {
    if (!existingByType[d.type]) existingByType[d.type] = { total: 0, deposits: [] };
    existingByType[d.type].total += d.amount;
    existingByType[d.type].deposits.push(d);
  });

  // 计算现有存款已覆盖的季度支出
  const existingDemandAmount = existingByType['活期存款']?.total || 0;
  const existing3MonthAmount = existingByType['3个月定期']?.total || 0;
  const existing6MonthAmount = existingByType['6个月定期']?.total || 0;
  const existing1YearAmount = existingByType['1年定期']?.total || 0;
  const existing2YearAmount = existingByType['2年定期']?.total || 0;
  const existing3YearAmount = existingByType['3年定期']?.total || 0;
  const existing5YearAmount = existingByType['5年定期']?.total || 0;

  // 第一步：确定活期资金（应急金 + 第一季度支出）
  // 新增活期只来自当前可调配活期池，避免“双重预留应急金”
  const requiredDemand = emergencyFund + quarterlyExpense;
  let remainingCash = availableCash;
  const newDemandAmount = Math.min(
    remainingCash,
    Math.max(0, requiredDemand - existingDemandAmount)
  );
  remainingCash -= newDemandAmount;

  const currentDeposit = newDemandAmount > 0 ? {
    type: '活期存款',
    amount: newDemandAmount,
    maturityDate: null,
    maturityDateStr: '随时可用',
    depositDate: new Date().toISOString(),
    description: `应急金：${formatAmount(emergencyFund)}元（永久保留）+ ${currentYear}年第一季度（1-3月）开销`,
    purpose: '即时可用',
    action: '随时可用',
    isNew: true
  } : null;

  // 第二步：计算第二季度（4-6月）的资金来源（3个月定期）
  // 如果现有3个月定期已足够，则不需要额外分配
  const new3MonthAmount = Math.min(
    remainingCash,
    Math.max(0, quarterlyExpense - existing3MonthAmount)
  );
  remainingCash -= new3MonthAmount;
  const threeMonthDeposit = (typeMap['3个月定期'] && new3MonthAmount > 0) ? {
    type: '3个月定期',
    amount: new3MonthAmount,
    maturityDate: addMonths(currentDate, 3),
    maturityDateStr: formatDate(addMonths(currentDate, 3), 'YYYY年MM月DD日'),
    depositDate: new Date().toISOString(),
    description: `${formatDate(addMonths(currentDate, 3), 'YYYY年MM月DD日')}到期当日将本息优先用于支付第二季度（4-6月）开销`,
    purpose: '第二季度开销',
    action: '到期提取用于支付Q2开销',
    isNew: true
  } : null;

  // 第三步：计算第三季度（7-9月）的资金来源（6个月定期）
  // 6个月定期 = Q3支出（1个季度）+ 转存Q4部分（1个季度）
  const required6Month = quarterlyExpense * 2;
  const new6MonthAmount = Math.min(
    remainingCash,
    Math.max(0, required6Month - existing6MonthAmount)
  );
  remainingCash -= new6MonthAmount;
  const q3CoverageAmount = Math.min(new6MonthAmount, quarterlyExpense);
  const q4RolloverAmount = Math.max(0, new6MonthAmount - q3CoverageAmount);
  const sixMonthDeposit = (typeMap['6个月定期'] && new6MonthAmount > 0) ? {
    type: '6个月定期',
    amount: new6MonthAmount,
    maturityDate: addMonths(currentDate, 6),
    maturityDateStr: formatDate(addMonths(currentDate, 6), 'YYYY年MM月DD日'),
    depositDate: new Date().toISOString(),
    description: `${formatDate(addMonths(currentDate, 6), 'YYYY年MM月DD日')}到期当日：优先支付第三季度（7-9月）开销${formatAmount(q3CoverageAmount)}元${q4RolloverAmount > 0 ? `，剩余${formatAmount(q4RolloverAmount)}元立即转存为3个月定期` : ''}`,
    purpose: '第三季度开销 + 转存',
    action: '到期拆分：部分支付Q3，部分转存Q4',
    isNew: true
  } : null;

  // 第四步：计算剩余资金
  const allocatedSoFar = availableCash - remainingCash;

  console.log('DEBUG allocation:', {
    totalCash,
    availableCash,
    emergencyFund,
    quarterlyExpense,
    currentDeposit: currentDeposit ? currentDeposit.amount : 0,
    threeMonthDeposit: threeMonthDeposit ? threeMonthDeposit.amount : 0,
    sixMonthDeposit: sixMonthDeposit ? sixMonthDeposit.amount : 0,
    allocatedSoFar,
    remainingCash,
    planningHorizon,
    has1Year,
    has3Year,
    has5Year
  });

  // 第五步：将剩余资金分配到长期存款（根据规划期限约束）
  // 约束：存款期限 <= 规划期限
  let oneYearDeposit = null;
  let threeYearDeposit = null;
  let twoYearDeposit = null;
  let fiveYearDeposit = null;

  // 计算1年定期应存金额：
  // - 1年规划：所有剩余资金都放入1年定期（因为没有更长期限可选）
  // - 多年规划：年度支出 × 规划年限，确保每年都有足够的滚动资金
  let oneYearAmount;
  if (planningHorizon === 1) {
    // 1年规划：把所有剩余资金都放入1年定期
    oneYearAmount = remainingCash;
  } else {
    // 多年规划：每年一个年度储备
    oneYearAmount = annualExpense * planningHorizon;
  }

  if (has1Year && remainingCash > 0) {
    // 1年定期：根据规划类型决定分配金额
    const actualOneYearAmount = Math.min(oneYearAmount, remainingCash);
    const roundedOneYearAmount = roundToNearestThousand(actualOneYearAmount);
    remainingCash += (actualOneYearAmount - roundedOneYearAmount);
    oneYearDeposit = {
      type: '1年定期',
      amount: roundedOneYearAmount,
      maturityDate: addYears(currentDate, 1),
      maturityDateStr: formatDate(addYears(currentDate, 1), 'YYYY年MM月DD日'),
      depositDate: new Date().toISOString(),
      description: `${currentYear + 1}年1月1日到期当日分配：${formatAmount(actualOneYearAmount)}元按本表规则拆解为${currentYear + 1}全年开销资金，${formatAmount(actualOneYearAmount)}元转存为新1年定期`,
      purpose: '全年开销储备 + 循环资金',
      action: '到期拆分：部分用于当年开销，部分转存下一年'
    };
    remainingCash -= actualOneYearAmount;
  }

  // 如果有剩余资金且没有3年/5年定期选项，尝试加到6个月定期
  // 注意：只有1年规划且1年定期已满（或无需更多）时才执行
  if (remainingCash > 0 && !has3Year && !has5Year && sixMonthDeposit) {
    sixMonthDeposit.amount += remainingCash;
    sixMonthDeposit.description = `${formatDate(addMonths(currentDate, 6), 'YYYY年MM月DD日')}到期当日：支付第三季度（7-9月）开销${formatAmount(quarterlyExpense)}元，剩余${formatAmount(quarterlyExpense + remainingCash)}元立即转存为3个月定期`;
    remainingCash = 0;
  }

  // 2年定期：只有规划期限 >= 2 年时才有
  if (has2Year && remainingCash > 0) {
    const roundedTwoYearAmount = roundToNearestThousand(remainingCash);
    remainingCash -= roundedTwoYearAmount;
    twoYearDeposit = {
      type: '2年定期',
      amount: roundedTwoYearAmount,
      maturityDate: addYears(currentDate, 2),
      maturityDateStr: formatDate(addYears(currentDate, 2), 'YYYY 年 MM 月 DD 日'),
      depositDate: new Date().toISOString(),
      description: `${currentYear + 2}年 1 月 1 日到期，中期增值资金，到期后补充后续年度资金池`,
      purpose: '中期增值',
      action: '到期后加入年度资金池'
    };
    remainingCash = 0;
  }

  // 5年定期优先：只有规划期限 >= 5年时才有（最高利率，优先分配）
  if (has5Year && remainingCash > 0) {
    const roundedFiveYearAmount = roundToNearestThousand(remainingCash);
    remainingCash -= roundedFiveYearAmount;
    fiveYearDeposit = {
      type: '5年定期',
      amount: roundedFiveYearAmount,
      maturityDate: addYears(currentDate, 5),
      maturityDateStr: formatDate(addYears(currentDate, 5), 'YYYY年MM月DD日'),
      depositDate: new Date().toISOString(),
      description: `${currentYear + 5}年1月1日到期，超长期增值资金，享受最高利率，到期后补充后续年度资金池`,
      purpose: '超长期增值',
      action: '到期后加入年度资金池'
    };
    remainingCash = 0;
  }

  // 3年定期：只有规划期限 >= 3年时才有（仅当没有5年定期或5年后还有剩余）
  if (has3Year && remainingCash > 0) {
    const roundedThreeYearAmount = roundToNearestThousand(remainingCash);
    remainingCash -= roundedThreeYearAmount;
    threeYearDeposit = {
      type: '3年定期',
      amount: roundedThreeYearAmount,
      maturityDate: addYears(currentDate, 3),
      maturityDateStr: formatDate(addYears(currentDate, 3), 'YYYY年MM月DD日'),
      depositDate: new Date().toISOString(),
      description: `${currentYear + 3}年1月1日到期，核心增值资金，享受最高利率，到期后补充后续年度资金池`,
      purpose: '长期增值',
      action: '到期后加入年度资金池'
    };
    remainingCash = 0;
  }

  // 为每个存款添加追踪字段（用于提前支取功能）
  const addWithdrawalTracking = (deposit) => {
    if (!deposit) return deposit;
    return {
      ...deposit,
      originalAmount: deposit.amount,  // 原始存款金额
      withdrawnAmount: 0,              // 已提前支取金额
      remainingBalance: deposit.amount, // 剩余余额
      withdrawalHistory: [],           // 提前支取记录
      depositDate: deposit.depositDate || new Date().toISOString(),  // 存入日期
      status: 'active'                // 初始状态为active
    };
  };

  // 构建新存款数组
  const newDeposits = [];
  if (currentDeposit) newDeposits.push(addWithdrawalTracking(currentDeposit));
  if (threeMonthDeposit) newDeposits.push(addWithdrawalTracking(threeMonthDeposit));
  if (sixMonthDeposit) newDeposits.push(addWithdrawalTracking(sixMonthDeposit));
  if (oneYearDeposit) newDeposits.push(addWithdrawalTracking(oneYearDeposit));
  if (threeYearDeposit) newDeposits.push(addWithdrawalTracking(threeYearDeposit));
  if (fiveYearDeposit) newDeposits.push(addWithdrawalTracking(fiveYearDeposit));

  // === 新增：添加现有存款到数组 ===
  const existingDepositsWithTracking = existingPortfolio.map(d => ({
    ...d,
    originalAmount: d.amount,
    withdrawnAmount: 0,
    remainingBalance: d.amount,
    withdrawalHistory: [],
    status: 'active',
    isExisting: true,
    // 计算已获得利息
    earnedInterest: calculateEarnedInterestToDate(d)
  }));

  // 合并新存款和现有存款
  const deposits = [...newDeposits, ...existingDepositsWithTracking];

  const totalAllocated = deposits.reduce((sum, d) => sum + d.amount, 0);

  console.log('DEBUG final allocation:', {
    newDeposits: newDeposits.map(d => ({ type: d.type, amount: d.amount })),
    existingDeposits: existingDepositsWithTracking.map(d => ({ type: d.type, amount: d.amount })),
    totalAllocated,
    totalCash,
    netNewCash,
    existingTotal
  });

  // 计算区间内的总预期利息 - 完整的滚动阶梯计算（带期限约束）
  let totalProjectedInterest = 0;

  // 初始存款金额（新存款 + 现有存款）
  const initial3Month = (threeMonthDeposit ? threeMonthDeposit.amount : 0) + existing3MonthAmount;
  const initial6Month = (sixMonthDeposit ? sixMonthDeposit.amount : 0) + existing6MonthAmount;
  const initial1Year = (oneYearDeposit ? oneYearDeposit.amount : 0) + existing1YearAmount;
  const initial2Year = (twoYearDeposit ? twoYearDeposit.amount : 0) + existing2YearAmount;
  const initial3Year = (threeYearDeposit ? threeYearDeposit.amount : 0) + existing3YearAmount;
  const initial5Year = (fiveYearDeposit ? fiveYearDeposit.amount : 0) + existing5YearAmount;

  // 现有存款的已获利息单独跟踪，不再叠加到规划期总预期利息中，避免重复计算
  const existingEarnedInterest = existingDepositsWithTracking.reduce((sum, d) => sum + (d.earnedInterest || 0), 0);

  // === 5年定期利息计算（按比例） ===
  // 5年定期按规划期持有年限按比例计算利息
  if (initial5Year > 0) {
    let balance5Year = initial5Year;
    let yearsCovered = 0;

    while (yearsCovered < planningHorizon && balance5Year > 0) {
      // 计算本次持有年限（不超过5年，也不得超过剩余规划期）
      const yearsToHold = Math.min(5, planningHorizon - yearsCovered);

      if (yearsToHold <= 0) break;

      const interest = calculateInterest(balance5Year, INTEREST_RATES.fiveYears, yearsToHold);
      totalProjectedInterest += interest;

      // 更新已持有年份
      yearsCovered += yearsToHold;

      // 到期后的处理
      const totalWithInterest = balance5Year + interest;
      const expenseForPeriod = annualExpense * yearsToHold;
      const rollover = totalWithInterest - expenseForPeriod;

      if (rollover <= 0) {
        balance5Year = 0;
      } else {
        // 续存时，需要根据剩余时间选择合适的存款类型
        const remainingMonths = (planningHorizon - yearsCovered) * 12;
        const bestType = getBestDepositType(remainingMonths, availableTypes);

        if (bestType && remainingMonths >= 12) {
          // 剩余时间足够，继续存1年或更短
          balance5Year = rollover;
        } else if (bestType && remainingMonths >= 6) {
          // 剩余6-12个月，存6个月
          balance5Year = rollover;
        } else if (bestType && remainingMonths >= 3) {
          // 剩余3-6个月，存3个月
          balance5Year = rollover;
        } else {
          // 剩余不足3个月，不再续存
          balance5Year = 0;
        }
      }
    }
  }

  // === 3年定期利息计算（按比例） ===
  // 3年定期按规划期持有年限按比例计算利息
  if (initial3Year > 0) {
    let balance3Year = initial3Year;
    let yearsCovered = 0;

    while (yearsCovered < planningHorizon && balance3Year > 0) {
      // 计算本次持有年限（不超过3年，也不得超过剩余规划期）
      const yearsToHold = Math.min(3, planningHorizon - yearsCovered);

      if (yearsToHold <= 0) break;

      const interest = calculateInterest(balance3Year, INTEREST_RATES.threeYears, yearsToHold);
      totalProjectedInterest += interest;

      // 更新已持有年份
      yearsCovered += yearsToHold;

      // 到期后的处理
      const totalWithInterest = balance3Year + interest;
      const expenseForPeriod = annualExpense * yearsToHold;
      const rollover = totalWithInterest - expenseForPeriod;

      if (rollover <= 0) {
        balance3Year = 0;
      } else {
        // 续存时，需要根据剩余时间选择合适的存款类型
        const remainingMonths = (planningHorizon - yearsCovered) * 12;
        const bestType = getBestDepositType(remainingMonths, availableTypes);

        if (bestType && remainingMonths >= 12) {
          // 剩余时间足够，继续存1年
          balance3Year = rollover;
        } else if (bestType && remainingMonths >= 6) {
          // 剩余6-12个月，存6个月
          balance3Year = rollover;
        } else if (bestType && remainingMonths >= 3) {
          // 剩余3-6个月，存3个月
          balance3Year = rollover;
        } else {
          // 剩余不足3个月，不再续存
          balance3Year = 0;
        }
      }
    }
  }

  // === 1年定期利息计算（按比例） ===
  // 如果选择1年规划，1年定期只计算1年利息
  // 如果选择3年或更长，1年定期到期后续存
  if (initial1Year > 0) {
    let balance1Year = initial1Year;
    let yearsHeld = 0;

    while (yearsHeld < planningHorizon && balance1Year > 0) {
      // 计算本次持有年限（不超过1年，也不得超过剩余规划期）
      const yearsToHold = Math.min(1, planningHorizon - yearsHeld);

      if (yearsToHold > 0) {
        const interest = calculateInterest(balance1Year, INTEREST_RATES.oneYear, yearsToHold);
        totalProjectedInterest += interest;

        // 更新已持有年份
        yearsHeld += yearsToHold;

        // 到期后的处理：取出年度支出，剩余续存
        const expenseForYear = annualExpense * yearsToHold;
        const rollover = balance1Year - expenseForYear;

        if (rollover <= 0) {
          balance1Year = 0;
        } else {
          balance1Year = rollover;
        }
      } else {
        break;
      }
    }
  }

  // === 季度滚动利息计算（3个月→6个月→3个月循环） ===
  // 这些存款在每年Q1开始滚动
  // 需要按比例计算跨规划期边界的利息

  // 第1年：初始3个月和6个月存款的利息
  if (initial3Month > 0) {
    // 3个月存款：只存3个月，用于下季度支出
    const interest = calculateInterest(initial3Month, INTEREST_RATES.threeMonths, 0.25);
    totalProjectedInterest += interest;
  }

  if (initial6Month > 0) {
    // 6个月存款：分为两部分
    // - 第一部分(6万)：存6个月，用于Q3支出
    // - 第二部分(6万)：存3个月(Q4)，用于下一年Q1支出（跨规划期边界）

    const forQ3 = quarterlyExpense;
    const forQ4 = initial6Month - forQ3;

    // Q3部分：6个月利息（全额在规划期内）
    if (forQ3 > 0) {
      const interest1 = calculateInterest(forQ3, INTEREST_RATES.sixMonths, 0.5);
      totalProjectedInterest += interest1;
    }

    // Q4部分：3个月利息（可能跨规划期边界，需要按比例）
    if (forQ4 > 0) {
      // 实际持有3个月，但需要按比例
      const prorataMonths = Math.min(3, planningHorizon * 12 - 9);
      const prorataYears = prorataMonths / 12;

      if (prorataYears > 0) {
        const interest2 = calculateInterest(forQ4, INTEREST_RATES.threeMonths, prorataYears);
        totalProjectedInterest += interest2;
      }
    }
  }

  // === 后续年份的季度滚动利息 ===
  // 从第2年开始，季度滚动的资金来自1年定期到期后的续存部分
  for (let year = 2; year <= planningHorizon; year++) {
    // 计算本年可用的滚动资金
    let yearlyRollingBase = initial1Year - annualExpense * (year - 1);
    if (yearlyRollingBase <= 0) break;

    // 取一个季度的金额用于滚动
    yearlyRollingBase = Math.min(yearlyRollingBase, quarterlyExpense);

    if (yearlyRollingBase > 0) {
      // 计算剩余规划期
      const remainingYears = planningHorizon - year + 1;

      // 6个月存款利息（按比例）
      const prorata6Months = Math.min(0.5, remainingYears);
      if (prorata6Months > 0) {
        const interest = calculateInterest(yearlyRollingBase, INTEREST_RATES.sixMonths, prorata6Months);
        totalProjectedInterest += interest;
      }

      // 3个月存款利息（按比例）
      const remainingAfter6Month = yearlyRollingBase - quarterlyExpense;
      if (remainingAfter6Month > 0) {
        const prorata3Months = Math.min(0.25, remainingYears - 0.5);
        if (prorata3Months > 0) {
          const interest = calculateInterest(remainingAfter6Month, INTEREST_RATES.threeMonths, prorata3Months);
          totalProjectedInterest += interest;
        }
      }
    }
  }

  // 计算每笔存款的利息（仅显示第1年）
  const allocation = deposits.map(d => {
    const rate = getRateForType(d.type);
    const years = getYearsForType(d.type);
    const interest = calculateInterest(d.amount, rate, years);

    return {
      ...d,
      rate: rate,
      years: years,
      projectedInterest: interest,
      percentage: ((d.amount / totalAllocated) * 100).toFixed(1),
      maturityDateStr: d.maturityDate ? formatDate(d.maturityDate, 'YYYY年MM月DD日') : '随时可用'
    };
  });

  // 生成季度资金流时间线
  const cashFlowTimeline = generateCashFlowTimeline(inputData, allocation);

  // 生成执行操作列表
  const executionList = generateExecutionList(inputData, allocation, existingPortfolio);

  // === 新增：生成过渡计划 ===
  const transitionPlan = generateTransitionPlan(existingPortfolio, {
    ...inputData,
    targetDemandBalance: existingDemandAmount + (currentDeposit ? currentDeposit.amount : 0)
  });

  return {
    input: {
      totalCash,
      monthlyExpense,
      quarterlyExpense,
      annualExpense: monthlyExpense * 12,
      emergencyFund,
      availableCash,
      planningHorizon,
      existingTotal,
      netNewCash
    },
    allocation,
    recommendedAllocation: allocation.filter(item => item.isNew),
    existingAllocation: allocation.filter(item => item.isExisting),
    cashFlowTimeline,
    executionList,
    transitionPlan,
    summary: {
      totalAllocated,
      emergencyFund,
      liquidityFund: (currentDeposit ? currentDeposit.amount : 0) + existingDemandAmount,
      shortTermFund: (threeMonthDeposit ? threeMonthDeposit.amount : 0) + (sixMonthDeposit ? sixMonthDeposit.amount : 0) + existing3MonthAmount + existing6MonthAmount,
      longTermFund: (oneYearDeposit ? oneYearDeposit.amount : 0) + (twoYearDeposit ? twoYearDeposit.amount : 0) + (threeYearDeposit ? threeYearDeposit.amount : 0) + (fiveYearDeposit ? fiveYearDeposit.amount : 0) + existing1YearAmount + existing2YearAmount + existing3YearAmount + existing5YearAmount,
      totalProjectedInterest,
      interestRates: INTEREST_RATES,
      existingEarnedInterest
    }
  };
}

/**
 * 生成现有存款的过渡计划（B2策略：按目标调度对齐）
 * @param {Array} existingPortfolio - 现有存款数组
 * @param {Object} inputData - 输入数据
 * @returns {Array} 过渡计划
 */
function generateTransitionPlan(existingPortfolio, inputData) {
  if (!existingPortfolio || existingPortfolio.length === 0) return [];

  const { monthlyExpense, planningHorizon } = inputData;
  const quarterlyExpense = monthlyExpense * 3;
  const currentDate = new Date();

  const transitionPlan = [];

  existingPortfolio.forEach(deposit => {
    const normalizedType = normalizeDepositType(deposit.type);
    // 活期存款不需要过渡计划
    if (normalizedType === '活期存款') return;

    // 计算到期日期
    const maturityDate = deposit.maturityDate ? new Date(deposit.maturityDate) : null;
    if (!maturityDate) return;

    // 计算利息
    const daysUntilMaturity = Math.ceil((maturityDate - currentDate) / (1000 * 60 * 60 * 24));
    const rate = (deposit.interestRate || getRateForType(normalizedType)) / 100;
    const termYears = getYearsForType(normalizedType) || 0;
    const projectedInterest = deposit.amount * rate * termYears;

    // 确定到期后分配策略（B2策略：按目标调度对齐）
    const allocation = determineTransitionAllocation(deposit, inputData, projectedInterest);

    transitionPlan.push({
      id: deposit.id,
      type: normalizedType,
      amount: deposit.amount,
      maturityDate: deposit.maturityDate,
      maturityDateStr: formatDate(maturityDate, 'YYYY年MM月DD日'),
      daysUntilMaturity,
      projectedInterest,
      totalWithInterest: deposit.amount + projectedInterest,
      allocation,
      actionDetails: generateTransitionActionDetails(deposit, quarterlyExpense, deposit.amount + projectedInterest, allocation),
      status: daysUntilMaturity <= 0 ? 'matured' : 'pending'
    });
  });

  // 按到期日期排序
  transitionPlan.sort((a, b) => new Date(a.maturityDate) - new Date(b.maturityDate));

  return transitionPlan;
}

/**
 * 确定存款到期后的分配策略（B2策略）
 * @param {Object} deposit - 存款对象
 * @param {Object} inputData - 输入数据
 * @param {number} interest - 预期利息
 * @returns {Object} 分配计划
 */
function determineTransitionAllocation(deposit, inputData, interest) {
  const { monthlyExpense, planningHorizon, targetDemandBalance = 0 } = inputData;
  const quarterlyExpense = monthlyExpense * 3;
  const requiredDemand = quarterlyExpense + (inputData.emergencyFund || 0);

  const totalWithInterest = deposit.amount + interest;
  let remaining = deposit.amount;

  // 策略：优先补足规则要求的活期目标，再把其余本金转去匹配期限。
  // 如果初始调仓后活期已达标，就不再机械地重复塞入一个季度支出。
  const demandShortfall = Math.max(0, requiredDemand - targetDemandBalance);
  const allocation = {
    toDemand: interest,
    to3Month: 0,
    to6Month: 0,
    to1Year: 0,
    toLongTerm: 0,
    description: ''
  };

  if (demandShortfall > 0) {
    const topUp = Math.min(remaining, demandShortfall);
    allocation.toDemand += topUp;
    remaining -= topUp;
  }

  // 剩余部分存入最长可用期限（最大化利息）
  if (remaining > 0) {
    const maxTerm = getLongestAllowedTerm(planningHorizon);
    if (maxTerm === '5年定期' && remaining > 0) {
      allocation.toLongTerm = remaining;
      allocation.longTermType = '5年定期';
    } else if (maxTerm === '3年定期' && remaining > 0) {
      allocation.toLongTerm = remaining;
      allocation.longTermType = '3年定期';
    } else if (maxTerm === '2年定期' && remaining > 0) {
      allocation.toLongTerm = remaining;
      allocation.longTermType = '2年定期';
    } else if (remaining >= quarterlyExpense) {
      allocation.to1Year = remaining;
    } else if (remaining >= quarterlyExpense / 2) {
      allocation.to6Month = remaining;
    } else {
      allocation.to3Month = remaining;
    }
  }

  // 生成描述
  const parts = [];
  if (allocation.toDemand > 0) parts.push(`活期存款: ¥${formatAmount(allocation.toDemand)}`);
  if (allocation.to3Month > 0) parts.push(`3个月定期: ¥${formatAmount(allocation.to3Month)}`);
  if (allocation.to6Month > 0) parts.push(`6个月定期: ¥${formatAmount(allocation.to6Month)}`);
  if (allocation.to1Year > 0) parts.push(`1年定期: ¥${formatAmount(allocation.to1Year)}`);
  if (allocation.toLongTerm > 0) parts.push(`${allocation.longTermType}: ¥${formatAmount(allocation.toLongTerm)}`);
  allocation.description = parts.join('\n');

  return allocation;
}

/**
 * 获取规划期限允许的最长存款期限
 * @param {number} planningHorizon - 规划期限（年）
 * @returns {string} 最长存款期限类型
 */
function getLongestAllowedTerm(planningHorizon) {
  if (planningHorizon >= 5) return '5年定期';
  if (planningHorizon >= 3) return '3年定期';
  if (planningHorizon >= 2) return '2年定期';
  return '1年定期';
}

/**
 * 生成现有存款到期后的操作详情
 * @param {Object} deposit - 存款对象
 * @param {number} quarterlyExpense - 季度支出
 * @param {number} totalWithInterest - 本息合计
 * @returns {string} 操作详情文本
 */
function generateTransitionActionDetails(deposit, quarterlyExpense, totalWithInterest, allocationPlan = null) {
  const projectedInterest = totalWithInterest - deposit.amount;
  const allocation = allocationPlan || {
    toDemand: projectedInterest,
    to3Month: 0,
    to6Month: 0,
    to1Year: 0,
    toLongTerm: 0,
    longTermType: ''
  };

  let details = `【到期处理】\n`;
  details += `• 本金: ¥${formatAmount(deposit.amount)}\n`;
  details += `• 利息: ¥${formatAmount(projectedInterest)}\n`;
  details += `• 本息合计: ¥${formatAmount(totalWithInterest)}\n\n`;

  // Execution view should read like a practical instruction sheet.
  // Merge quarter spending into the demand deposit line and name any rollover term explicitly.
  details += `【资金分配】\n`;

  if (allocation.toDemand > 0) {
    const demandLabel = allocation.toDemand > projectedInterest
      ? '活期存款(补足本季度储备)'
      : '活期存款';
    details += `• ${demandLabel}: ¥${formatAmount(allocation.toDemand)}\n`;
  }

  if (allocation.to3Month > 0) {
    details += `• 3个月定期: ¥${formatAmount(allocation.to3Month)}\n`;
  }

  if (allocation.to6Month > 0) {
    details += `• 6个月定期: ¥${formatAmount(allocation.to6Month)}\n`;
  }

  if (allocation.to1Year > 0) {
    details += `• 1年定期: ¥${formatAmount(allocation.to1Year)}\n`;
  }

  if (allocation.toLongTerm > 0) {
    details += `• ${allocation.longTermType || '长期定期'}: ¥${formatAmount(allocation.toLongTerm)}\n`;
  }

  return details;
}

/**
 * 生成执行操作列表 - 支持多年度滚动规划（带期限约束版）
 */
function generateExecutionList(inputData, allocation, existingPortfolio = []) {
  const { totalCash, monthlyExpense, emergencyFund, planningHorizon = 1 } = inputData;
  const quarterlyExpense = monthlyExpense * 3;
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();

  const executionList = [];
  let idCounter = 1;

  const currentDeposit = allocation.find(a => a.type === '活期存款');
  const threeMonthDeposit = allocation.find(a => a.type === '3个月定期');
  const sixMonthDeposit = allocation.find(a => a.type === '6个月定期');
  const oneYearDeposit = allocation.find(a => a.type === '1年定期');
  const threeYearDeposit = allocation.find(a => a.type === '3年定期');
  const fiveYearDeposit = allocation.find(a => a.type === '5年定期');

  let initDesc = '按计划分配资金：\n';
  if (currentDeposit) initDesc += `• 活期存款: ¥${formatAmount(currentDeposit.amount)}\n`;
  if (threeMonthDeposit) initDesc += `• 3个月定期: ¥${formatAmount(threeMonthDeposit.amount)}\n`;
  if (sixMonthDeposit) initDesc += `• 6个月定期: ¥${formatAmount(sixMonthDeposit.amount)}\n`;
  if (oneYearDeposit) initDesc += `• 1年定期: ¥${formatAmount(oneYearDeposit.amount)}\n`;
  if (threeYearDeposit) initDesc += `• 3年定期: ¥${formatAmount(threeYearDeposit.amount)}\n`;
  if (fiveYearDeposit) initDesc += `• 5年定期: ¥${formatAmount(fiveYearDeposit.amount)}`;

  executionList.push({
    id: idCounter++,
    date: formatDate(currentDate, 'YYYY-MM-DD'),
    dateDisplay: formatDate(currentDate, 'YYYY年MM月DD日'),
    title: '初始存入',
    year: 0,
    quarter: 0,
    description: initDesc,
    depositType: '初始',
    amount: totalCash,
    action: '完成存款',
    isCompleted: false,
    actualInterest: null
  });

  executionList.push({
    id: idCounter++,
    date: formatDate(addMonths(currentDate, 1), 'YYYY-MM-DD'),
    dateDisplay: `${currentYear}年每月`,
    year: 1,
    quarter: 0,
    title: '日常支出',
    description: `从活期账户支取月度支出: ¥${formatAmount(monthlyExpense)}`,
    depositType: '活期',
    amount: monthlyExpense,
    action: '支取支出',
    isCompleted: false,
    actualInterest: null
  });

  let oneYearBalance = oneYearDeposit ? oneYearDeposit.amount : 0;
  let threeYearBalance = threeYearDeposit ? threeYearDeposit.amount : 0;
  let fiveYearBalance = fiveYearDeposit ? fiveYearDeposit.amount : 0;
  let simulatedDemandBalance = currentDeposit ? currentDeposit.amount : 0;
  const startMonth = currentDate.getMonth() + 1;
  const requiredDemand = emergencyFund + quarterlyExpense;
  const quarterSchedules = new Map();

  quarterSchedules.set(1, {
    q2: threeMonthDeposit ? threeMonthDeposit.amount : 0,
    q3: sixMonthDeposit ? sixMonthDeposit.amount : 0,
    q4: sixMonthDeposit ? Math.max(0, sixMonthDeposit.amount - quarterlyExpense) : 0
  });

  const getQuarterSchedule = (year) => {
    if (!quarterSchedules.has(year)) {
      quarterSchedules.set(year, { q2: 0, q3: 0, q4: 0 });
    }
    return quarterSchedules.get(year);
  };

  const addQuarterSchedule = (year, key, amount) => {
    if (year > planningHorizon || amount <= 0) return;
    const schedule = getQuarterSchedule(year);
    schedule[key] = (schedule[key] || 0) + amount;
  };

  const buildRolloverPlan = (principal, interest) => {
    const demandGap = Math.max(0, requiredDemand - (simulatedDemandBalance + interest));
    const principalToDemand = Math.min(principal, demandGap);
    let remainingPrincipal = Math.max(0, principal - principalToDemand);

    const rollTo3Month = Math.min(remainingPrincipal, quarterlyExpense);
    remainingPrincipal -= rollTo3Month;

    const rollTo6Month = Math.min(remainingPrincipal, quarterlyExpense * 2);
    remainingPrincipal -= rollTo6Month;

    return {
      rollToCurrent: interest + principalToDemand,
      principalToDemand,
      rollTo3Month,
      rollTo6Month,
      rollToQ4: Math.max(0, rollTo6Month - quarterlyExpense),
      rollTo1Year: remainingPrincipal
    };
  };

  const buildAnnualActionDetails = (principal, interest, totalWithInterest, year, plan) => {
    const lines = [
      '【到期处理】',
      `• 本金: ¥${formatAmount(principal)}`,
      `• 利息: ¥${formatAmount(interest)}`,
      `• 本息合计: ¥${formatAmount(totalWithInterest)}`,
      '',
      '【资金分配】'
    ];

    if (plan.rollToCurrent > 0) {
      const currentParts = [];
      if (interest > 0) currentParts.push(`利息¥${formatAmount(interest)}`);
      if (plan.principalToDemand > 0) currentParts.push(`补足活期目标¥${formatAmount(plan.principalToDemand)}`);
      lines.push(`• 活期存款: ¥${formatAmount(plan.rollToCurrent)}${currentParts.length ? ` (${currentParts.join(' + ')})` : ''}`);
    }
    if (plan.rollTo3Month > 0) {
      lines.push(`• 3个月定期: ¥${formatAmount(plan.rollTo3Month)} (${year + 1}年Q2支出)`);
    }
    if (plan.rollTo6Month > 0) {
      lines.push(`• 6个月定期: ¥${formatAmount(plan.rollTo6Month)} (${year + 1}年Q3/Q4支出)`);
    }
    if (plan.rollTo1Year > 0) {
      lines.push(`• 1年定期: ¥${formatAmount(plan.rollTo1Year)} (${year + 2}年循环储备)`);
    }

    return lines.join('\n');
  };

  const pushQuarterEvent = ({ maturityDate, dateDisplay, year, quarter, title, description, depositType, amount, rate, projectedInterest, action, allocationLines }) => {
    executionList.push({
      id: idCounter++,
      date: formatDate(maturityDate, 'YYYY-MM-DD'),
      dateDisplay,
      year,
      quarter,
      title,
      description,
      depositType,
      amount,
      rate,
      projectedInterest,
      action,
      actionDetails: allocationLines.join('\n'),
      isCompleted: false,
      actualInterest: null
    });
  };

  for (let year = 1; year <= planningHorizon; year++) {
    const yearStartDate = addMonths(currentDate, (year - 1) * 12);
    const yearLabel = currentYear + year - 1;
    const maturityMonth = startMonth;
    const maturityYear = yearLabel + 1;
    const currentSchedule = getQuarterSchedule(year);

    simulatedDemandBalance = Math.max(0, simulatedDemandBalance - quarterlyExpense);

    const q2BaseAmount = currentSchedule.q2 || 0;
    if (q2BaseAmount > 0) {
      const q2Interest = calculateInterest(q2BaseAmount, INTEREST_RATES.threeMonths, 0.25);
      const q2Maturity = addMonths(yearStartDate, 3);
      const q2Expense = Math.min(q2BaseAmount, quarterlyExpense);
      const q2SurplusToCurrent = Math.max(0, q2BaseAmount - q2Expense);
      const q2ToCurrent = q2Interest + q2SurplusToCurrent;
      const q2Month = startMonth + 3;
      const q2Year = q2Month > 12 ? yearLabel + 1 : yearLabel;
      const q2DisplayMonth = q2Month > 12 ? q2Month - 12 : q2Month;

      simulatedDemandBalance += q2ToCurrent;

      const q2Lines = [
        '【到期处理】',
        `• 本金: ¥${formatAmount(q2BaseAmount)}`,
        `• 利息: ¥${formatAmount(q2Interest)}`,
        `• 本息合计: ¥${formatAmount(q2BaseAmount + q2Interest)}`,
        '',
        '【资金分配】'
      ];
      if (q2ToCurrent > 0) {
        const q2Note = q2Expense > 0 ? '补足本季度储备' : (q2SurplusToCurrent > 0 ? '利息 + 剩余本金' : '利息');
        q2Lines.push(`• 活期存款: ¥${formatAmount(q2ToCurrent)} (${q2Note})`);
      }

      pushQuarterEvent({
        maturityDate: q2Maturity,
        dateDisplay: `${q2Year}年${q2DisplayMonth}月`,
        year,
        quarter: 2,
        title: `第${year}年 - Q2季度到期`,
        description: '优先覆盖Q2支出，剩余资金回到活期',
        depositType: '3个月定期',
        amount: q2BaseAmount,
        rate: INTEREST_RATES.threeMonths,
        projectedInterest: q2Interest,
        action: '到期兑付',
        allocationLines: q2Lines
      });
    }

    const q3BaseAmount = currentSchedule.q3 || 0;
    if (q3BaseAmount > 0) {
      const q3Interest = calculateInterest(q3BaseAmount, INTEREST_RATES.sixMonths, 0.5);
      const q3Maturity = addMonths(yearStartDate, 6);
      const q3Expense = Math.min(q3BaseAmount, quarterlyExpense);
      const q3RemainingPrincipal = Math.max(0, q3BaseAmount - q3Expense);
      const q3PlannedQ4 = Math.min(q3RemainingPrincipal, currentSchedule.q4 || 0);
      const q3SurplusToCurrent = Math.max(0, q3RemainingPrincipal - q3PlannedQ4);
      const q3ToCurrent = q3Interest + q3SurplusToCurrent;
      const q3Month = startMonth + 6;
      const q3Year = q3Month > 12 ? yearLabel + 1 : yearLabel;
      const q3DisplayMonth = q3Month > 12 ? q3Month - 12 : q3Month;

      simulatedDemandBalance += q3ToCurrent;

      const q3Lines = [
        '【到期处理】',
        `• 本金: ¥${formatAmount(q3BaseAmount)}`,
        `• 利息: ¥${formatAmount(q3Interest)}`,
        `• 本息合计: ¥${formatAmount(q3BaseAmount + q3Interest)}`,
        '',
        '【资金分配】'
      ];
      if (q3ToCurrent > 0) {
        const q3Note = q3Expense > 0 ? '补足本季度储备' : (q3SurplusToCurrent > 0 ? '利息 + 剩余本金' : '利息');
        q3Lines.push(`• 活期存款: ¥${formatAmount(q3ToCurrent)} (${q3Note})`);
      }
      if (q3PlannedQ4 > 0) {
        q3Lines.push(`• 3个月定期: ¥${formatAmount(q3PlannedQ4)} (${year}年Q4支出)`);
      }

      pushQuarterEvent({
        maturityDate: q3Maturity,
        dateDisplay: `${q3Year}年${q3DisplayMonth}月`,
        year,
        quarter: 3,
        title: `第${year}年 - Q3季度到期`,
        description: '先覆盖Q3支出，再为Q4预留或回补活期',
        depositType: '6个月定期',
        amount: q3BaseAmount,
        rate: INTEREST_RATES.sixMonths,
        projectedInterest: q3Interest,
        action: '到期兑付+转存',
        allocationLines: q3Lines
      });
    }

    const q4BaseAmount = currentSchedule.q4 || 0;
    if (q4BaseAmount > 0) {
      const q4Interest = calculateInterest(q4BaseAmount, INTEREST_RATES.threeMonths, 0.25);
      const q4Maturity = addMonths(yearStartDate, 9);
      const q4Expense = Math.min(q4BaseAmount, quarterlyExpense);
      const q4ToCurrent = q4Interest + Math.max(0, q4BaseAmount - q4Expense);
      const q4Month = startMonth + 9;
      const q4Year = q4Month > 12 ? yearLabel + 1 : yearLabel;
      const q4DisplayMonth = q4Month > 12 ? q4Month - 12 : q4Month;

      simulatedDemandBalance += q4ToCurrent;

      const q4Lines = [
        '【到期处理】',
        `• 本金: ¥${formatAmount(q4BaseAmount)}`,
        `• 利息: ¥${formatAmount(q4Interest)}`,
        `• 本息合计: ¥${formatAmount(q4BaseAmount + q4Interest)}`,
        '',
        '【资金分配】'
      ];
      if (q4ToCurrent > 0) {
        const q4Note = q4Expense > 0 ? '补足本季度储备' : (q4Interest > 0 ? '利息' : '剩余本金');
        q4Lines.push(`• 活期存款: ¥${formatAmount(q4ToCurrent)} (${q4Note})`);
      }

      pushQuarterEvent({
        maturityDate: q4Maturity,
        dateDisplay: `${q4Year}年${q4DisplayMonth}月`,
        year,
        quarter: 4,
        title: `第${year}年 - Q4季度到期`,
        description: '优先覆盖Q4支出，利息留在活期',
        depositType: '3个月定期',
        amount: q4BaseAmount,
        rate: INTEREST_RATES.threeMonths,
        projectedInterest: q4Interest,
        action: '到期兑付',
        allocationLines: q4Lines
      });
    }

    const maturityDate = addMonths(yearStartDate, 12);
    let nextOneYearBalance = 0;

    if (oneYearBalance > 0) {
      const yearAmount = oneYearBalance;
      const yearInterest = calculateInterest(yearAmount, INTEREST_RATES.oneYear, 1);
      const totalWithInterest = yearAmount + yearInterest;

      if (year === planningHorizon) {
        executionList.push({
          id: idCounter++,
          date: formatDate(maturityDate, 'YYYY-MM-DD'),
          dateDisplay: `${maturityYear}年${maturityMonth}月`,
          year,
          quarter: 1,
          title: `第${year}年 - 1年定期到期`,
          description: `到期本息¥${formatAmount(totalWithInterest)}，全部转入活期`,
          depositType: '1年定期',
          amount: yearAmount,
          rate: INTEREST_RATES.oneYear,
          projectedInterest: yearInterest,
          action: '到期兑付',
          actionDetails: `【到期兑付】\n• 本金: ¥${formatAmount(yearAmount)}\n• 利息: ¥${formatAmount(yearInterest)}\n• 本息合计: ¥${formatAmount(totalWithInterest)}\n• 用途: 全部转入活期账户`,
          isCompleted: false,
          actualInterest: null
        });
        simulatedDemandBalance += totalWithInterest;
      } else {
        const rolloverPlan = buildRolloverPlan(yearAmount, yearInterest);
        simulatedDemandBalance += rolloverPlan.rollToCurrent;
        addQuarterSchedule(year + 1, 'q2', rolloverPlan.rollTo3Month);
        addQuarterSchedule(year + 1, 'q3', rolloverPlan.rollTo6Month);
        addQuarterSchedule(year + 1, 'q4', rolloverPlan.rollToQ4);
        nextOneYearBalance += rolloverPlan.rollTo1Year;

        executionList.push({
          id: idCounter++,
          date: formatDate(maturityDate, 'YYYY-MM-DD'),
          dateDisplay: `${maturityYear}年${maturityMonth}月`,
          year,
          quarter: 1,
          title: `第${year}年 - 1年定期到期`,
          description: '先补足活期目标，再滚动下一轮季度支出',
          depositType: '1年定期',
          amount: yearAmount,
          rate: INTEREST_RATES.oneYear,
          projectedInterest: yearInterest,
          action: '到期兑付+续存',
          actionDetails: buildAnnualActionDetails(yearAmount, yearInterest, totalWithInterest, year, rolloverPlan),
          isCompleted: false,
          actualInterest: null
        });
      }
    }

    if (threeYearBalance > 0 && (year === planningHorizon || (year > 1 && (year - 1) % 3 === 0))) {
      const year3Amount = threeYearBalance;
      const year3Interest = calculateInterest(year3Amount, INTEREST_RATES.threeYears, 3);
      const totalWithInterest = year3Amount + year3Interest;

      if (year === planningHorizon) {
        executionList.push({
          id: idCounter++,
          date: formatDate(maturityDate, 'YYYY-MM-DD'),
          dateDisplay: `${maturityYear}年${maturityMonth}月`,
          year,
          quarter: 1,
          title: `第${year}年 - 3年定期到期（终结）`,
          description: `到期本息¥${formatAmount(totalWithInterest)}，全部转入活期`,
          depositType: '3年定期',
          amount: year3Amount,
          rate: INTEREST_RATES.threeYears,
          projectedInterest: year3Interest,
          action: '到期兑付',
          actionDetails: `【到期兑付】\n• 本金: ¥${formatAmount(year3Amount)}\n• 利息: ¥${formatAmount(year3Interest)}\n• 本息合计: ¥${formatAmount(totalWithInterest)}\n\n【资金用途】\n• 全部转入活期账户`,
          isCompleted: false,
          actualInterest: null
        });
        simulatedDemandBalance += totalWithInterest;
      } else {
        const rolloverPlan = buildRolloverPlan(year3Amount, year3Interest);
        simulatedDemandBalance += rolloverPlan.rollToCurrent;
        addQuarterSchedule(year + 1, 'q2', rolloverPlan.rollTo3Month);
        addQuarterSchedule(year + 1, 'q3', rolloverPlan.rollTo6Month);
        addQuarterSchedule(year + 1, 'q4', rolloverPlan.rollToQ4);
        nextOneYearBalance += rolloverPlan.rollTo1Year;

        executionList.push({
          id: idCounter++,
          date: formatDate(maturityDate, 'YYYY-MM-DD'),
          dateDisplay: `${maturityYear}年${maturityMonth}月`,
          year,
          quarter: 1,
          title: `第${year}年 - 3年定期到期`,
          description: '到期后改按季度循环，不再把本金静态留在长期',
          depositType: '3年定期',
          amount: year3Amount,
          rate: INTEREST_RATES.threeYears,
          projectedInterest: year3Interest,
          action: '到期兑付+续存',
          actionDetails: buildAnnualActionDetails(year3Amount, year3Interest, totalWithInterest, year, rolloverPlan),
          isCompleted: false,
          actualInterest: null
        });
      }
      threeYearBalance = 0;
    }

    if (fiveYearBalance > 0 && (year === planningHorizon || (year > 1 && (year - 1) % 5 === 0))) {
      const year5Amount = fiveYearBalance;
      const year5Interest = calculateInterest(year5Amount, INTEREST_RATES.fiveYears, 5);
      const totalWithInterest = year5Amount + year5Interest;

      if (year === planningHorizon) {
        executionList.push({
          id: idCounter++,
          date: formatDate(maturityDate, 'YYYY-MM-DD'),
          dateDisplay: `${maturityYear}年${maturityMonth}月`,
          year,
          quarter: 1,
          title: `第${year}年 - 5年定期到期（终结）`,
          description: `到期本息¥${formatAmount(totalWithInterest)}，全部转入活期`,
          depositType: '5年定期',
          amount: year5Amount,
          rate: INTEREST_RATES.fiveYears,
          projectedInterest: year5Interest,
          action: '到期兑付',
          actionDetails: `【到期兑付】\n• 本金: ¥${formatAmount(year5Amount)}\n• 利息: ¥${formatAmount(year5Interest)}\n• 本息合计: ¥${formatAmount(totalWithInterest)}\n\n【资金用途】\n• 全部转入活期账户`,
          isCompleted: false,
          actualInterest: null
        });
        simulatedDemandBalance += totalWithInterest;
      } else {
        const rolloverPlan = buildRolloverPlan(year5Amount, year5Interest);
        simulatedDemandBalance += rolloverPlan.rollToCurrent;
        addQuarterSchedule(year + 1, 'q2', rolloverPlan.rollTo3Month);
        addQuarterSchedule(year + 1, 'q3', rolloverPlan.rollTo6Month);
        addQuarterSchedule(year + 1, 'q4', rolloverPlan.rollToQ4);
        nextOneYearBalance += rolloverPlan.rollTo1Year;

        executionList.push({
          id: idCounter++,
          date: formatDate(maturityDate, 'YYYY-MM-DD'),
          dateDisplay: `${maturityYear}年${maturityMonth}月`,
          year,
          quarter: 1,
          title: `第${year}年 - 5年定期到期`,
          description: '到期后改按季度循环，不再默认长期沉淀',
          depositType: '5年定期',
          amount: year5Amount,
          rate: INTEREST_RATES.fiveYears,
          projectedInterest: year5Interest,
          action: '到期兑付+续存',
          actionDetails: buildAnnualActionDetails(year5Amount, year5Interest, totalWithInterest, year, rolloverPlan),
          isCompleted: false,
          actualInterest: null
        });
      }
      fiveYearBalance = 0;
    }

    oneYearBalance = nextOneYearBalance;
  }

  existingPortfolio.forEach(deposit => {
    const normalizedType = normalizeDepositType(deposit.type);
    if (normalizedType === '活期存款') return;

    const maturityDate = deposit.maturityDate ? new Date(deposit.maturityDate) : null;
    if (!maturityDate) return;

    const rate = (deposit.interestRate || getRateForType(normalizedType)) / 100;
    const projectedInterest = deposit.amount * rate * (getYearsForType(normalizedType) || 0);
    const totalWithInterest = deposit.amount + projectedInterest;
    const maturityYear = maturityDate.getFullYear();
    const maturityMonth = maturityDate.getMonth() + 1;
    const maturityQuarter = Math.ceil(maturityMonth / 3);

    executionList.push({
      id: idCounter++,
      date: formatDate(maturityDate, 'YYYY-MM-DD'),
      dateDisplay: formatDate(maturityDate, 'YYYY年MM月DD日'),
      title: `${deposit.type}到期`,
      year: maturityYear - currentYear + 1,
      quarter: maturityQuarter,
      description: '现有存款到期',
      depositType: deposit.type,
      amount: deposit.amount,
      projectedInterest,
      action: '到期重新分配',
      actionDetails: generateTransitionActionDetails(deposit, quarterlyExpense, totalWithInterest),
      isCompleted: false,
      actualInterest: null,
      isExisting: true
    });
  });

  executionList.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateA - dateB;
  });

  executionList.forEach((item, index) => {
    item.id = index + 1;
  });

  return executionList;
}

/**
 * 生成季度资金流时间线
 */
function generateCashFlowTimeline(inputData, allocation) {
  const { totalCash, monthlyExpense, emergencyFund } = inputData;
  const quarterlyExpense = monthlyExpense * 3;
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();

  const timeline = [
    {
      date: formatDate(currentDate, 'YYYY年MM月DD日'),
      title: '初始存入',
      description: '按计划分配资金到各存款类型',
      balance: formatAmount(totalCash),
      action: '初始存入上表资金'
    },
    {
      date: `${currentDate.getMonth() + 1}-${currentYear} 每月`,
      title: '日常支出',
      description: `每月从活期支取${formatAmount(monthlyExpense)}元`,
      balance: formatAmount(emergencyFund),
      action: '活期余额始终≥应急金'
    },
    {
      date: formatDate(addMonths(currentDate, 3), 'YYYY年MM月DD日'),
      title: 'Q2季度支出',
      description: '3个月定期到期，支付第二季度开销',
      balance: formatAmount(emergencyFund),
      action: '3个月定期→全额支付Q2'
    },
    {
      date: formatDate(addMonths(currentDate, 6), 'YYYY年MM月DD日'),
      title: 'Q3季度支出',
      description: '6个月定期到期，支付第三季度并转存',
      balance: formatAmount(emergencyFund),
      action: '6个月定期→支付Q3+转存Q4'
    },
    {
      date: formatDate(addMonths(currentDate, 9), 'YYYY年MM月DD日'),
      title: 'Q4季度支出',
      description: '新存3个月定期到期，支付第四季度开销',
      balance: formatAmount(emergencyFund),
      action: '3个月定期→支付Q4'
    },
    {
      date: formatDate(addYears(currentDate, 1), 'YYYY年MM月DD日'),
      title: '年度循环',
      description: '1年定期到期，开启新一轮年度规划',
      balance: formatAmount(emergencyFund + quarterlyExpense),
      action: '1年定期→拆分用于当年+转存下年'
    }
  ];

  return timeline;
}

/**
 * 处理提前支取
 * @param {Object} deposit - 存款对象
 * @param {number} withdrawalAmount - 支取金额
 * @param {string} withdrawalDate - 支取日期（ISO格式）
 * @returns {Object} 更新后的存款对象
 */
function processEarlyWithdrawal(deposit, withdrawalAmount, withdrawalDate) {
  if (!deposit || withdrawalAmount <= 0) {
    return deposit;
  }

  // 检查是否可以从该存款类型支取（仅允许从长期存款支取）
  const longTermTypes = ['1年定期', '3年定期', '5年定期'];
  if (!longTermTypes.includes(normalizeDepositType(deposit.type))) {
    console.warn('仅允许从长期存款（1年/3年/5年）提前支取');
    return deposit;
  }

  // 计算可支取的最大金额
  const maxWithdrawal = deposit.remainingBalance || deposit.amount;
  const actualWithdrawal = Math.min(withdrawalAmount, maxWithdrawal);

  // 创建支取记录
  const withdrawalRecord = {
    date: withdrawalDate || new Date().toISOString(),
    amount: actualWithdrawal,
    interestPenalty: 0, // 提前支取不计利息
    note: '提前支取，利息为0'
  };

  // 更新存款对象
  const newWithdrawnAmount = (deposit.withdrawnAmount || 0) + actualWithdrawal;
  const newRemainingBalance = (deposit.remainingBalance || deposit.amount) - actualWithdrawal;

  return {
    ...deposit,
    withdrawnAmount: newWithdrawnAmount,
    remainingBalance: newRemainingBalance,
    withdrawalHistory: [...(deposit.withdrawalHistory || []), withdrawalRecord],
    // 如果完全提取，标记状态
    status: newRemainingBalance <= 0 ? 'fully_withdrawn' : 'partial_withdrawn'
  };
}

/**
 * 计算提前支取后的利息
 * 规则：提前支取的金额不计利息，剩余金额继续计息
 * @param {Object} deposit - 存款对象
 * @param {number} yearsHeld - 已持有年限
 * @returns {Object} { fullInterest, partialInterest, remainingInterest }
 */
function calculateWithdrawalInterest(deposit, yearsHeld) {
  if (!deposit || yearsHeld <= 0) {
    return { fullInterest: 0, withdrawnInterest: 0, remainingInterest: 0 };
  }

  const rate = getRateForType(deposit.type);
  const originalAmount = deposit.originalAmount || deposit.amount;
  const withdrawnAmount = deposit.withdrawnAmount || 0;
  const remainingBalance = deposit.remainingBalance || originalAmount - withdrawnAmount;

  // 原始金额的利息
  const fullInterest = calculateInterest(originalAmount, rate, yearsHeld);

  // 提前支取部分的利息（为0）
  const withdrawnInterest = 0;

  // 剩余金额的利息
  const remainingInterest = calculateInterest(remainingBalance, rate, yearsHeld);

  return {
    fullInterest,
    withdrawnInterest,
    remainingInterest
  };
}

/**
 * 获取可用于提前支取的长期存款列表
 * @param {Array} deposits - 存款数组
 * @returns {Array} 可支取的长期存款列表
 */
function getWithdrawableDeposits(deposits) {
  if (!deposits || !Array.isArray(deposits)) {
    return [];
  }

  const longTermTypes = ['1年定期', '3年定期', '5年定期'];

  // 过滤长期存款，只返回active或partial_withdrawn状态且有余额的存款
  // 注意：如果status未定义，默认当作active处理
  const filteredDeposits = deposits
    .filter(d => longTermTypes.includes(normalizeDepositType(d.type)))
    .filter(d => {
      // 如果status未定义，默认当作active
      const status = d.status || 'active';
      return status === 'active' || status === 'partial_withdrawn';
    })
    .filter(d => {
      // 排除已滚存的存款
      const isRolled = d.rolled === true || d.status === 'rolled';
      return !isRolled;
    })
    .filter(d => (d.remainingBalance || d.amount) > 0);

  // 按类型合并存款（同类型的金额相加）
  const mergedByType = {};
  filteredDeposits.forEach(d => {
    const balance = d.remainingBalance !== undefined ? d.remainingBalance : (d.amount || 0);
    const type = normalizeDepositType(d.type);
    if (mergedByType[type]) {
      // 累加金额
      mergedByType[type].remainingBalance += balance;
      mergedByType[type].originalAmount += (d.originalAmount || d.amount || 0);
      // 更新到期日为最近的
      if (d.maturityDateStr && d.maturityDateStr !== '随时可用') {
        mergedByType[type].maturityDateStr = d.maturityDateStr;
        mergedByType[type].maturityDate = d.maturityDate;
      }
    } else {
      mergedByType[type] = {
        type: type,
        originalAmount: d.originalAmount || d.amount || 0,
        remainingBalance: balance,
        rate: getRateForType(type),
        maturityDate: d.maturityDate,
        maturityDateStr: d.maturityDateStr,
        depositDate: d.depositDate
      };
    }
  });

  // 转换为数组，按期限排序
  const termOrder = { '1年定期': 1, '3年定期': 2, '5年定期': 3 };
  return Object.values(mergedByType)
    .sort((a, b) => (termOrder[a.type] || 99) - (termOrder[b.type] || 99))
    .map(d => ({
      ...d,
      uniqueKey: d.type,  // 使用类型作为唯一键（因为已合并）
      remainingBalanceFormatted: formatAmount(d.remainingBalance)  // 添加格式化后的余额
    }));
}

/**
 * 向指定存款类型添加资金（用于提前支取后的资金重新存入）
 * @param {Array} allocation - 存款分配数组
 * @param {string} destinationType - 目标存款类型
 * @param {number} amount - 存入金额
 * @returns {Array} 更新后的存款分配数组
 */
function addToDestinationDeposit(allocation, destinationType, amount) {
  if (!allocation || !Array.isArray(allocation) || amount <= 0 || !destinationType) {
    return allocation;
  }

  // 查找目标存款类型
  const targetIndex = allocation.findIndex(d => d.type === destinationType);

  if (targetIndex >= 0) {
    // 更新现有存款
    const targetDeposit = allocation[targetIndex];
    const currentAmount = targetDeposit.amount || 0;
    const currentRemaining = targetDeposit.remainingBalance || currentAmount;

    return allocation.map((d, index) => {
      if (index === targetIndex) {
        return {
          ...d,
          amount: currentAmount + amount,
          remainingBalance: currentRemaining + amount,
          // 更新原始金额（如果是新存入）
          originalAmount: (d.originalAmount || currentAmount) + amount,
          // 清除之前的状态
          status: 'active',
          // 记录资金来源
          lastTopUp: new Date().toISOString(),
          topUpAmount: (d.topUpAmount || 0) + amount
        };
      }
      return d;
    });
  } else {
    // 新建存款类型
    const newDeposit = createNewDeposit(destinationType, amount);
    return [...allocation, newDeposit];
  }
}

/**
 * 创建新的存款对象
 * @param {string} type - 存款类型
 * @param {number} amount - 存款金额
 * @returns {Object} 新的存款对象
 */
function createNewDeposit(type, amount) {
  const roundedAmount = roundToNearestThousand(amount);
  const normalizedType = normalizeDepositType(type);
  const rate = getRateForType(normalizedType);
  // 计算存款期限（月）
  let months = 0;
  if (normalizedType === '3个月定期') months = 3;
  else if (normalizedType === '6个月定期') months = 6;
  else if (normalizedType === '1年定期') months = 12;
  else if (normalizedType === '2年定期') months = 24;
  else if (normalizedType === '3年定期') months = 36;
  else if (normalizedType === '5年定期') months = 60;

  const maturityDate = new Date();
  maturityDate.setMonth(maturityDate.getMonth() + months);

  return {
    type: normalizedType,
    amount: roundedAmount,
    originalAmount: roundedAmount,
    remainingBalance: roundedAmount,
    rate: rate,
    maturityDate: formatDate(maturityDate, 'YYYY-MM-DD'),
    maturityDateStr: formatDate(maturityDate, 'YYYY年MM月DD日'),
    depositDate: new Date().toISOString(),
    status: 'active',
    withdrawnAmount: 0,
    withdrawalHistory: [],
    topUpAmount: roundedAmount
  };
}

export {
  formatAmount,
  formatDate,
  addToDestinationDeposit,
  createNewDeposit,
  addDays,
  addMonths,
  addYears,
  getQuarterStartDate,
  getCurrentQuarter,
  validateInput,
  generatePlan,
  processEarlyWithdrawal,
  calculateWithdrawalInterest,
  getWithdrawableDeposits,
  INTEREST_RATES,
  getAvailableDepositTypes,
  getBestDepositType,
  calculateInterest,
  getRateForType,
  getYearsForType,
  getMonthsForType,
  normalizeDepositType,
  roundToNearestThousand,
  generateExecutionList,
  generateCashFlowTimeline,
  DEPOSIT_TYPES
};

