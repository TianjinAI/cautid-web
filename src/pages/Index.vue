<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  formatAmount,
  formatDate,
  generatePlan,
  validateInput
} from '../utils/format'
import { storage } from '../utils/storage'
import { showToast } from '../utils/toast'
import { useRouter } from 'vue-router'

const router = useRouter()

// Form data
const totalCash = ref('')
const demandDeposit = ref('')  // 活期存款 - cash on hand
const housingExpense = ref('')
const foodExpense = ref('')
const otherExpense = ref('')
const emergencyFund = ref('')
const planningHorizon = ref('1')

// Horizon options
const horizonOptions = [
  { value: '1', label: '1 年' },
  { value: '3', label: '3 年' },
  { value: '5', label: '5 年' },
  { value: '10', label: '10 年' }
]

// Calculated results
const monthlyExpense = ref(0)
const quarterlyExpense = ref(0)
const annualExpense = ref(0)

// Result data
const showResult = ref(false)
const createDate = ref('')
const totalCashFormatted = ref('0')
const liquidityFundFormatted = ref('0')
const shortTermFundFormatted = ref('0')
const longTermFundFormatted = ref('0')
const totalProjectedInterest = ref('0')
const allocation = ref([])
const cashFlowTimeline = ref([])
const executionList = ref([])
const showProrata = ref(false)

// Existing portfolio
const showExistingPortfolio = ref(false)
const existingPortfolio = ref([])
const showAddDepositModal = ref(false)
const editingDepositIndex = ref(-1)

// New deposit form
const newDeposit = ref({
  type: '3个月定期',
  amount: '',
  interestRate: '',
  depositDate: '',
  maturityDate: ''
})

// Deposit type options for existing portfolio (excluding 活期存款 - handled separately)
const depositTypeOptions = [
  { value: '3个月定期', label: '3个月定期', defaultRate: 0.70 },
  { value: '6个月定期', label: '6个月定期', defaultRate: 0.95 },
  { value: '1年定期', label: '1年定期', defaultRate: 1.15 },
  { value: '2 年定期', label: '2 年定期', defaultRate: 1.20 },
  { value: '3年定期', label: '3年定期', defaultRate: 1.30 },
  { value: '5年定期', label: '5年定期', defaultRate: 1.50 }
]

// Computed for existing portfolio
const existingPortfolioTotal = computed(() => {
  // Sum of all time deposits (excluding 活期存款 as it's separate)
  return existingPortfolio.value
    .filter(d => d.type !== '活期存款')
    .reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)
})

const totalCashComputed = computed(() => {
  // 资金总额 = 活期存款 + 定期存款合计
  return (parseFloat(demandDeposit.value) || 0) + existingPortfolioTotal.value
})

const netNewCash = computed(() => {
  // 可用于新建计划 = 活期存款 - 应急金 (what's available for immediate allocation)
  const demand = parseFloat(demandDeposit.value) || 0
  const emergency = parseFloat(emergencyFund.value) || 5000
  return Math.max(0, demand - emergency)
})

const existingDemandDeposit = computed(() => {
  // Return the manual demand deposit input as an object
  const amount = parseFloat(demandDeposit.value) || 0
  if (amount <= 0) return null
  return {
    type: '活期存款',
    amount: amount,
    interestRate: 0.10,
    isManual: true
  }
})

const liquidityWarning = computed(() => {
  const demand = parseFloat(demandDeposit.value) || 0
  const emergency = parseFloat(emergencyFund.value) || 5000
  const availableForExpenses = demand - emergency

  if (availableForExpenses < quarterlyExpense.value) {
    const shortfall = quarterlyExpense.value - availableForExpenses
    return {
      type: 'warning',
      message: `流动性预警：活期存款(¥${formatAmount(demand)}) - 应急金(¥${formatAmount(emergency)}) = ¥${formatAmount(availableForExpenses)}，不足以覆盖季度支出(¥${formatAmount(quarterlyExpense.value)})，缺口 ¥${formatAmount(shortfall)}`
    }
  }
  return null
})

// Computed
const monthlyExpenseFormatted = computed(() => formatAmount(monthlyExpense.value))
const quarterlyExpenseFormatted = computed(() => formatAmount(quarterlyExpense.value))
const annualExpenseFormatted = computed(() => formatAmount(annualExpense.value))

// Calculate expenses
const calculateExpenses = () => {
  const housing = parseFloat(housingExpense.value) || 0
  const food = parseFloat(foodExpense.value) || 0
  const other = parseFloat(otherExpense.value) || 0

  const expense = housing + food + other
  monthlyExpense.value = expense
  quarterlyExpense.value = expense * 3
  annualExpense.value = expense * 12
}

// Input handlers
const onTotalCashInput = () => {
  calculateExpenses()
}

const onHousingExpenseInput = () => {
  calculateExpenses()
}

const onFoodExpenseInput = () => {
  calculateExpenses()
}

const onOtherExpenseInput = () => {
  calculateExpenses()
}

const onEmergencyFundInput = () => {
  // No-op, value is read directly
}

const onHorizonSelect = (value) => {
  planningHorizon.value = value
}

// Existing portfolio handlers
const toggleExistingPortfolio = () => {
  showExistingPortfolio.value = !showExistingPortfolio.value
}

const openAddDepositModal = (index = -1) => {
  editingDepositIndex.value = index
  if (index >= 0 && existingPortfolio.value[index]) {
    // Edit mode - populate form
    const deposit = existingPortfolio.value[index]
    newDeposit.value = {
      type: deposit.type,
      amount: deposit.amount.toString(),
      interestRate: deposit.interestRate.toString(),
      depositDate: deposit.depositDate ? deposit.depositDate.split('T')[0] : '',
      maturityDate: deposit.maturityDate ? deposit.maturityDate.split('T')[0] : ''
    }
  } else {
    // Add mode - reset form
    newDeposit.value = {
      type: '3个月定期',
      amount: '',
      interestRate: '0.70',
      depositDate: '',
      maturityDate: ''
    }
  }
  showAddDepositModal.value = true
}

const onDepositTypeChange = () => {
  // Update default rate when type changes
  const option = depositTypeOptions.find(o => o.value === newDeposit.value.type)
  if (option) {
    newDeposit.value.interestRate = option.defaultRate.toString()
  }
  // Clear maturity date for demand deposit
  if (newDeposit.value.type === '活期存款') {
    newDeposit.value.maturityDate = ''
  }
}

const saveDeposit = () => {
  // Validate
  if (!newDeposit.value.amount || parseFloat(newDeposit.value.amount) <= 0) {
    showToast({ title: '请输入有效金额', icon: 'none' })
    return
  }

  if (newDeposit.value.type !== '活期存款' && !newDeposit.value.maturityDate) {
    showToast({ title: '请输入到期日期', icon: 'none' })
    return
  }

  const deposit = {
    id: editingDepositIndex.value >= 0 ? existingPortfolio.value[editingDepositIndex.value].id : Date.now().toString(),
    type: newDeposit.value.type,
    amount: parseFloat(newDeposit.value.amount),
    interestRate: parseFloat(newDeposit.value.interestRate) || 0,
    depositDate: newDeposit.value.depositDate ? new Date(newDeposit.value.depositDate).toISOString() : new Date().toISOString(),
    maturityDate: newDeposit.value.type === '活期存款' ? null : new Date(newDeposit.value.maturityDate).toISOString(),
    status: 'active',
    isExisting: true
  }

  if (editingDepositIndex.value >= 0) {
    // Update existing
    existingPortfolio.value[editingDepositIndex.value] = deposit
  } else {
    // Add new
    existingPortfolio.value.push(deposit)
  }

  // Save to localStorage
  saveExistingPortfolio()

  showAddDepositModal.value = false
  editingDepositIndex.value = -1
  showToast({ title: editingDepositIndex.value >= 0 ? '已更新' : '已添加', icon: 'success', duration: 1500 })
}

const deleteDeposit = (index) => {
  existingPortfolio.value.splice(index, 1)
  // Save to localStorage
  saveExistingPortfolio()
  showToast({ title: '已删除', icon: 'success', duration: 1500 })
}

// Helper to find index by deposit ID
const getDepositIndexById = (id) => {
  return existingPortfolio.value.findIndex(d => d.id === id)
}

// Edit deposit by ID (for filtered list)
const openAddDepositModalById = (id) => {
  const index = getDepositIndexById(id)
  if (index >= 0) {
    openAddDepositModal(index)
  }
}

// Delete deposit by ID (for filtered list)
const deleteDepositById = (id) => {
  const index = getDepositIndexById(id)
  if (index >= 0) {
    existingPortfolio.value.splice(index, 1)
    saveExistingPortfolio()
    showToast({ title: '已删除', icon: 'success', duration: 1500 })
  }
}

const closeDepositModal = () => {
  showAddDepositModal.value = false
  editingDepositIndex.value = -1
}

// Helper to calculate days until maturity
const getDaysUntilMaturity = (maturityDate) => {
  if (!maturityDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maturity = new Date(maturityDate)
  const diff = Math.ceil((maturity - today) / (1000 * 60 * 60 * 24))
  return diff
}

// Calculate interest earned so far for existing deposit
const calculateEarnedInterest = (deposit) => {
  if (!deposit.depositDate) return 0
  const startDate = new Date(deposit.depositDate)
  const today = new Date()
  const days = Math.floor((today - startDate) / (1000 * 60 * 60 * 24))
  const rate = deposit.interestRate / 100
  // Simple interest calculation
  return deposit.amount * rate * (days / 365)
}

// Generate plan
const generatePlanHandler = () => {
  try {
    const totalCashValue = totalCashComputed.value
    let monthlyExpenseValue = parseFloat(monthlyExpense.value)

    if (totalCashValue <= 0) {
      showToast({ title: '请输入活期存款金额或添加定期存款', icon: 'none' })
      return
    }

    if (!monthlyExpenseValue || monthlyExpenseValue <= 0) {
      showToast({ title: '请输入月支出金额（房租 + 伙食 + 其他）', icon: 'none' })
      return
    }

    let emergencyFundValue = parseFloat(emergencyFund.value) || 5000

    const inputData = {
      totalCash: totalCashValue,
      monthlyExpense: monthlyExpenseValue,
      emergencyFund: emergencyFundValue,
      planningHorizon: parseInt(planningHorizon.value),
      existingPortfolio: existingPortfolio.value // Add existing portfolio
    }

    console.log('=== Generating plan with inputData ===', inputData)
    const plan = generatePlan(inputData)
    console.log('=== Plan generated ===', plan)

  // Format allocation data
  const formattedAllocation = plan.allocation.map(item => ({
    ...item,
    amountFormatted: formatAmount(item.amount),
    interestFormatted: formatAmount(item.projectedInterest)
  }))

  // Check if prorata display is needed
  const planningHorizonValue = parseInt(planningHorizon.value)
  const maxDepositTerm = Math.max(...formattedAllocation.map(item => item.years || 0))
  const shouldShowProrata = planningHorizonValue < maxDepositTerm

  // Update state
  showResult.value = true
  createDate.value = formatDate(new Date(), 'YYYY 年 MM 月 DD 日')
  totalCashFormatted.value = formatAmount(plan.input.totalCash)
  liquidityFundFormatted.value = formatAmount(plan.summary.liquidityFund)
  shortTermFundFormatted.value = formatAmount(plan.summary.shortTermFund)
  longTermFundFormatted.value = formatAmount(plan.summary.longTermFund)
  totalProjectedInterest.value = formatAmount(plan.summary.totalProjectedInterest)
  allocation.value = formattedAllocation
  cashFlowTimeline.value = plan.cashFlowTimeline
  executionList.value = plan.executionList
  showProrata.value = shouldShowProrata

  showToast({ title: '已生成计划', icon: 'success', duration: 1500 })
  } catch (error) {
    console.error('Failed to generate plan:', error)
    showToast({ title: '生成计划失败：' + error.message, icon: 'none', duration: 5000 })
  }

  // Save form inputs for next time
  storage.setSync('lastInput', {
    demandDeposit: demandDeposit.value,
    housingExpense: housingExpense.value,
    foodExpense: foodExpense.value,
    otherExpense: otherExpense.value,
    emergencyFund: emergencyFund.value,
    planningHorizon: planningHorizon.value
  })
}

// Save plan
const savePlan = () => {
  if (!showResult.value || !executionList.value.length) {
    showToast({ title: '请先生成计划', icon: 'none' })
    return
  }

  const savedPlans = storage.getSync('savedPlans') || []

  const newPlan = {
    createTime: new Date().toISOString(),
    createTimeFormatted: formatDate(new Date(), 'YYYY 年 MM 月 DD 日 HH:mm'),
    totalCash: totalCashComputed.value,
    totalCashFormatted: formatAmount(totalCashComputed.value),
    monthlyExpense: monthlyExpense.value,
    planningHorizon: parseInt(planningHorizon.value),
    executionList: executionList.value.map(item => ({
      ...item,
      amountFormatted: formatAmount(item.amount),
      projectedInterestFormatted: item.projectedInterest ? formatAmount(item.projectedInterest) : ''
    })),
    allocation: allocation.value.map(item => ({
      ...item,
      amountFormatted: formatAmount(item.amount),
      projectedInterestFormatted: item.projectedInterest ? formatAmount(item.projectedInterest) : ''
    })),
    totalAllocated: allocation.value.reduce((sum, item) => sum + item.amount, 0),
    annualExpense: annualExpense.value
  }

  savedPlans.unshift(newPlan)
  storage.setSync('savedPlans', savedPlans)

  showToast({ title: '已保存到我的规划', icon: 'success' })
}

// Send to execute
const sendToExecute = () => {
  if (!showResult.value || !executionList.value.length) {
    showToast({ title: '请先生成计划', icon: 'none' })
    return
  }

  // Add initial flag to allocation items
  const allocationWithFlags = allocation.value.map(item => ({
    ...item,
    isInitial: true,
    remainingBalance: item.amount,
    status: 'active'
  }))

  const planData = {
    executionList: executionList.value.map(item => ({
      ...item,
      amountFormatted: formatAmount(item.amount),
      projectedInterestFormatted: item.projectedInterest ? formatAmount(item.projectedInterest) : ''
    })),
    allocation: allocationWithFlags,
    totalAllocated: allocation.value.reduce((sum, item) => sum + item.amount, 0),
    planningHorizon: parseInt(planningHorizon.value),
    monthlyExpense: monthlyExpense.value,
    annualExpense: annualExpense.value,
    planStartYear: new Date().getFullYear(),
    saveDate: new Date().toISOString()
  }

  storage.setSync('executionPlan', planData)

  showToast({ title: '已送去执行', icon: 'success' })

  setTimeout(() => {
    router.push('/execute')
  }, 1500)
}

// Load saved data on mount
onMounted(() => {
  const lastInput = storage.getSync('lastInput')
  if (lastInput) {
    demandDeposit.value = lastInput.demandDeposit || ''
    housingExpense.value = lastInput.housingExpense || ''
    foodExpense.value = lastInput.foodExpense || ''
    otherExpense.value = lastInput.otherExpense || ''
    emergencyFund.value = lastInput.emergencyFund || ''
    planningHorizon.value = lastInput.planningHorizon || '1'
    calculateExpenses()
  }

  // Load existing portfolio from localStorage
  const savedPortfolio = storage.getSync('existingPortfolio')
  if (savedPortfolio && Array.isArray(savedPortfolio)) {
    existingPortfolio.value = savedPortfolio
    showToast({ title: `已加载 ${savedPortfolio.length} 笔现有存款`, icon: 'success', duration: 2000 })
  }
})

// Save existing portfolio to localStorage
const saveExistingPortfolio = () => {
  storage.setSync('existingPortfolio', existingPortfolio.value)
}
</script>

<template>
  <div class="page-container">
    <!-- Page Header -->
    <div class="page-header">
      <h1 class="page-title">存款规划</h1>
      <p class="page-subtitle">智能分配存款，确保每个季度初资金准时到位</p>
    </div>

    <!-- Stats Cards -->
    <div v-if="monthlyExpense > 0" class="stat-cards">
      <div class="stat-card">
        <div class="stat-card-label">月度支出</div>
        <div class="stat-card-value">¥{{ monthlyExpenseFormatted }}</div>
        <div class="stat-card-subtitle">每月固定开支</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">季度支出</div>
        <div class="stat-card-value">¥{{ quarterlyExpenseFormatted }}</div>
        <div class="stat-card-subtitle">每季度需准备</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">年度支出</div>
        <div class="stat-card-value">¥{{ annualExpenseFormatted }}</div>
        <div class="stat-card-subtitle">全年支出预估</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">规划年限</div>
        <div class="stat-card-value">{{ planningHorizon }}年</div>
        <div class="stat-card-subtitle">存款滚动周期</div>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="content-grid">
      <!-- Left Column: Input Form -->
      <div class="form-column">
        <div class="card form-card">
          <div class="section-title">基本信息</div>

          <div class="form-grid">
            <!-- 活期存款 Input -->
            <div class="input-group">
              <label class="input-label">活期存款（元）</label>
              <div class="amount-input-wrap">
                <span class="currency">¥</span>
                <input
                  type="text"
                  inputmode="numeric"
                  class="input-field"
                  placeholder="当前现金/活期账户余额"
                  :value="demandDeposit"
                  @input="(e) => { demandDeposit = e.target.value }"
                  @blur="(e) => { demandDeposit = e.target.value }"
                />
              </div>
              <div class="input-hint">可随时支取的现金/活期存款</div>
            </div>

            <!-- 应急金 Input -->
            <div class="input-group">
              <label class="input-label">应急金（元）</label>
              <div class="amount-input-wrap">
                <span class="currency">¥</span>
                <input
                  type="text"
                  inputmode="numeric"
                  class="input-field"
                  placeholder="建议：5000"
                  :value="emergencyFund"
                  @input="onEmergencyFundInput"
                  @blur="(e) => { emergencyFund = e.target.value }"
                />
              </div>
              <div class="input-hint">从活期存款中预留，不参与滚动</div>
            </div>
          </div>

          <!-- Capital Summary Cards -->
          <div class="capital-summary">
            <div class="capital-card">
              <div class="capital-card-label">💵 活期存款</div>
              <div class="capital-card-value">¥{{ formatAmount(parseFloat(demandDeposit) || 0) }}</div>
              <div class="capital-card-hint">可随时支取</div>
            </div>
            <div class="capital-card">
              <div class="capital-card-label">📋 定期存款</div>
              <div class="capital-card-value">¥{{ formatAmount(existingPortfolioTotal) }}</div>
              <div class="capital-card-hint">{{ existingPortfolio.filter(d => d.type !== '活期存款').length }}笔待到期</div>
            </div>
            <div class="capital-card total">
              <div class="capital-card-label">💰 资金总额</div>
              <div class="capital-card-value highlight">¥{{ formatAmount(totalCashComputed) }}</div>
              <div class="capital-card-hint">活期+定期</div>
            </div>
          </div>

          <div class="section-title" style="margin-top: 24px;">月度支出明细</div>
          <div class="form-grid">
            <div class="input-group">
              <label class="input-label">房屋支出</label>
              <div class="amount-input-wrap">
                <span class="currency">¥</span>
                <input
                  type="text"
                  inputmode="numeric"
                  class="input-field"
                  placeholder="1500"
                  :value="housingExpense"
                  @input="onHousingExpenseInput"
                  @blur="(e) => { housingExpense = e.target.value }"
                />
              </div>
            </div>

            <div class="input-group">
              <label class="input-label">餐饮支出</label>
              <div class="amount-input-wrap">
                <span class="currency">¥</span>
                <input
                  type="text"
                  inputmode="numeric"
                  class="input-field"
                  placeholder="2000"
                  :value="foodExpense"
                  @input="onFoodExpenseInput"
                  @blur="(e) => { foodExpense = e.target.value }"
                />
              </div>
            </div>

            <div class="input-group">
              <label class="input-label">其他支出</label>
              <div class="amount-input-wrap">
                <span class="currency">¥</span>
                <input
                  type="text"
                  inputmode="numeric"
                  class="input-field"
                  placeholder="1000"
                  :value="otherExpense"
                  @input="onOtherExpenseInput"
                  @blur="(e) => { otherExpense = e.target.value }"
                />
              </div>
            </div>

            <div class="input-group">
              <label class="input-label">规划区间</label>
              <div class="horizon-selector">
                <div
                  v-for="option in horizonOptions"
                  :key="option.value"
                  class="horizon-option"
                  :class="{ active: planningHorizon === option.value }"
                  @click="onHorizonSelect(option.value)"
                >
                  {{ option.label }}
                </div>
              </div>
            </div>
          </div>

          <!-- Existing Portfolio Section -->
          <div class="section-title" style="margin-top: 24px;">
            <span>📋 现有定期存款</span>
            <div class="section-actions">
              <span v-if="!showExistingPortfolio && existingPortfolio.filter(d => d.type !== '活期存款').length > 0" class="section-summary">
                {{ existingPortfolio.filter(d => d.type !== '活期存款').length }}笔, ¥{{ formatAmount(existingPortfolioTotal) }}
              </span>
              <button class="btn-toggle" @click="toggleExistingPortfolio">
                {{ showExistingPortfolio ? '收起' : '展开' }}
              </button>
            </div>
          </div>

          <div v-if="showExistingPortfolio" class="existing-portfolio-section">
            <!-- Maturity Timeline Preview -->
            <div v-if="existingPortfolio.filter(d => d.type !== '活期存款').length > 0" class="maturity-timeline-preview">
              <div class="timeline-header">
                <span class="timeline-title">⏰ 到期时间线</span>
              </div>
              <div class="timeline-list">
                <div
                  v-for="deposit in existingPortfolio.filter(d => d.type !== '活期存款').sort((a, b) => new Date(a.maturityDate) - new Date(b.maturityDate))"
                  :key="deposit.id"
                  :class="['timeline-item-compact', getDaysUntilMaturity(deposit.maturityDate) <= 90 ? 'near' : '']"
                >
                  <span class="timeline-dot-small"></span>
                  <span class="timeline-type">{{ deposit.type }}</span>
                  <span class="timeline-amount">¥{{ formatAmount(deposit.amount) }}</span>
                  <span class="timeline-date">{{ formatDate(deposit.maturityDate, 'MM月DD日') }}</span>
                  <span class="timeline-days">({{ getDaysUntilMaturity(deposit.maturityDate) }}天后)</span>
                </div>
              </div>
            </div>

            <!-- Portfolio Summary -->
            <div v-if="existingPortfolio.filter(d => d.type !== '活期存款').length > 0" class="portfolio-summary">
              <div class="summary-row">
                <span class="summary-label">定期存款合计</span>
                <span class="summary-value">¥{{ formatAmount(existingPortfolioTotal) }}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">即将到期(&lt;90天)</span>
                <span :class="['summary-value', existingPortfolio.filter(d => d.type !== '活期存款' && getDaysUntilMaturity(d.maturityDate) <= 90).length > 0 ? 'warning' : '']">
                  {{ existingPortfolio.filter(d => d.type !== '活期存款' && getDaysUntilMaturity(d.maturityDate) <= 90).length }}笔
                </span>
              </div>
            </div>

            <!-- Deposit List -->
            <div v-if="existingPortfolio.filter(d => d.type !== '活期存款').length > 0" class="deposit-list">
              <div v-for="deposit in existingPortfolio.filter(d => d.type !== '活期存款')" :key="deposit.id" class="deposit-item">
                <div class="deposit-header">
                  <span :class="['deposit-type', getDaysUntilMaturity(deposit.maturityDate) <= 90 ? 'near' : '']">{{ deposit.type }}</span>
                  <span class="deposit-amount">¥{{ formatAmount(deposit.amount) }}</span>
                  <div class="deposit-actions">
                    <button class="btn-icon" @click="openAddDepositModalById(deposit.id)">编辑</button>
                    <button class="btn-icon danger" @click="deleteDepositById(deposit.id)">删除</button>
                  </div>
                </div>
                <div class="deposit-details">
                  <span v-if="deposit.type !== '活期存款'" class="detail-item">
                    到期: {{ formatDate(deposit.maturityDate, 'YYYY年MM月DD日') }}
                    <span :class="['maturity-badge', getDaysUntilMaturity(deposit.maturityDate) <= 90 ? 'near' : '']">
                      {{ getDaysUntilMaturity(deposit.maturityDate) }}天后
                    </span>
                  </span>
                  <span class="detail-item">利率: {{ deposit.interestRate }}%</span>
                  <span class="detail-item interest-earned">
                    已获利息: ¥{{ formatAmount(calculateEarnedInterest(deposit)) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Add Deposit Button -->
            <button class="btn-add-deposit" @click="openAddDepositModal(-1)">
              <span class="plus-icon">+</span>
              添加现有存款
            </button>

            <!-- Liquidity Warning -->
            <div v-if="liquidityWarning" :class="['liquidity-warning', liquidityWarning.type]">
              <span class="warning-icon">{{ liquidityWarning.type === 'error' ? '⚠️' : '⚡' }}</span>
              {{ liquidityWarning.message }}
            </div>
          </div>

          <!-- Add/Edit Deposit Modal -->
          <div v-if="showAddDepositModal" class="modal-overlay" @click.self="closeDepositModal">
            <div class="modal-content">
              <div class="modal-header">
                <h3>{{ editingDepositIndex >= 0 ? '编辑存款' : '添加现有存款' }}</h3>
                <button class="modal-close" @click="closeDepositModal">×</button>
              </div>
              <div class="modal-body">
                <div class="form-group">
                  <label>存款类型</label>
                  <select v-model="newDeposit.type" @change="onDepositTypeChange" class="form-select">
                    <option v-for="opt in depositTypeOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>
                </div>
                <div class="form-group">
                  <label>金额（元）</label>
                  <input type="number" v-model="newDeposit.amount" placeholder="请输入金额" class="form-input" />
                </div>
                <div class="form-group">
                  <label>年利率（%）</label>
                  <input type="number" v-model="newDeposit.interestRate" step="0.01" placeholder="年利率" class="form-input" />
                </div>
                <div class="form-group">
                  <label>存入日期</label>
                  <input type="date" v-model="newDeposit.depositDate" class="form-input" />
                </div>
                <div v-if="newDeposit.type !== '活期存款'" class="form-group">
                  <label>到期日期</label>
                  <input type="date" v-model="newDeposit.maturityDate" class="form-input" />
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn-secondary" @click="closeDepositModal">取消</button>
                <button class="btn-primary" @click="saveDeposit">保存</button>
              </div>
            </div>
          </div>

          <div class="action-section" style="margin-top: 32px;">
            <button class="btn-primary btn-large" @click="generatePlanHandler">
              生成存款计划
            </button>
          </div>
        </div>

        <!-- Tips -->
        <div v-if="!showResult && totalCashComputed > 0" class="card tips-card">
          <div class="section-title">温馨提示</div>
          <div class="tip-list">
            <div class="tip-item">
              <span class="tip-icon">💡</span>
              <span class="tip-text">每个季度首日（1 月 1 日、4 月 1 日、7 月 1 日、10 月 1 日）资金 100% 到位</span>
            </div>
            <div class="tip-item">
              <span class="tip-icon">💰</span>
              <span class="tip-text">短期资金使用定期存款，利率高于活期</span>
            </div>
            <div class="tip-item">
              <span class="tip-icon">🔒</span>
              <span class="tip-text">长期资金存入 3 年定期，享受最高利率</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Results -->
      <div class="results-column">
        <!-- Asset Overview -->
        <div v-if="showResult" class="card asset-overview">
          <div class="overview-header">
            <div class="overview-title">资产总览</div>
            <div class="overview-date">生成日期：{{ createDate }}</div>
          </div>
          <div class="overview-amount">
            <span class="amount-label">总资产</span>
            <span class="amount-value">¥{{ totalCashFormatted }}</span>
          </div>
          <div class="overview-breakdown">
            <div class="breakdown-item">
              <span class="breakdown-dot" style="background: #07C160;"></span>
              <span class="breakdown-label">可用资金</span>
              <span class="breakdown-value">¥{{ liquidityFundFormatted }}</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-dot" style="background: #FF9F43;"></span>
              <span class="breakdown-label">短期资金</span>
              <span class="breakdown-value">¥{{ shortTermFundFormatted }}</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-dot" style="background: #5F27CD;"></span>
              <span class="breakdown-label">长期资金</span>
              <span class="breakdown-value">¥{{ longTermFundFormatted }}</span>
            </div>
          </div>
          <div class="overview-interest">
            <span class="interest-label">预期总利息</span>
            <span class="interest-value">¥{{ totalProjectedInterest }}</span>
          </div>
          <div v-if="showProrata" class="interest-footnote">
            <span class="footnote-text">* 利息按实际持有期限比例计算，跨规划期边界的存款按比例调整</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div v-if="showResult" class="action-buttons">
          <button class="btn-secondary" @click="savePlan">保存到规划</button>
          <button class="btn-secondary" @click="generatePlanHandler">🔄 重新生成</button>
          <button class="btn-primary" @click="sendToExecute">送去执行</button>
        </div>

        <!-- Allocation Grid -->
        <div v-if="showResult" class="card">
          <div class="section-title">存款分配方案</div>
          <div class="allocation-grid">
            <div v-for="item in allocation" :key="item.type" class="allocation-card">
              <div class="allocation-card-header">
                <span :class="['allocation-type-badge', item.type === '活期存款' ? 'type-current' : item.type === '3 年定期' ? 'type-long' : 'type-short']">
                  {{ item.type }}
                </span>
                <span class="allocation-card-amount">¥{{ item.amountFormatted }}</span>
              </div>
              <div class="allocation-card-body">
                <div class="allocation-card-row">
                  <span>占比</span>
                  <span class="allocation-card-value">{{ item.percentage }}%</span>
                </div>
                <div class="allocation-card-row">
                  <span>利率</span>
                  <span class="allocation-card-value">{{ item.rate }}%</span>
                </div>
                <div v-if="item.maturityDateStr && item.maturityDateStr !== '随时可用'" class="allocation-card-row">
                  <span>到期</span>
                  <span class="allocation-card-value">{{ item.maturityDateStr }}</span>
                </div>
                <div class="allocation-card-row">
                  <span>用途</span>
                  <span class="allocation-card-desc">{{ item.purpose }}</span>
                </div>
                <div v-if="item.projectedInterest && item.projectedInterest > 0" class="allocation-card-interest">
                  预期利息 ¥{{ item.interestFormatted }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Timeline -->
        <div v-if="showResult" class="card">
          <div class="section-title">季度资金流</div>
          <div class="timeline">
            <div v-for="(item, index) in cashFlowTimeline" :key="item.date" class="timeline-item">
              <div class="timeline-dot"></div>
              <div v-if="index < cashFlowTimeline.length - 1" class="timeline-line"></div>
              <div class="timeline-content">
                <div class="timeline-date">{{ item.date }}</div>
                <div class="timeline-title">{{ item.title }}</div>
                <div class="timeline-desc">{{ item.description }}</div>
                <div class="timeline-action">{{ item.action }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Advantages -->
        <div v-if="showResult" class="card">
          <div class="section-title">方案优势</div>
          <div class="advantage-grid">
            <div class="advantage-card">
              <span class="advantage-card-icon">✓</span>
              <span class="advantage-card-text">零时间缺口：每个季度首日资金 100% 到位</span>
            </div>
            <div class="advantage-card">
              <span class="advantage-card-icon">✓</span>
              <span class="advantage-card-text">利息最大化：短期资金用定期，长期资金存 3 年</span>
            </div>
            <div class="advantage-card">
              <span class="advantage-card-icon">✓</span>
              <span class="advantage-card-text">操作极简：每季度仅需 1 次操作</span>
            </div>
            <div class="advantage-card">
              <span class="advantage-card-icon">✓</span>
              <span class="advantage-card-text">安全冗余：应急金独立保留</span>
            </div>
            <div class="advantage-card">
              <span class="advantage-card-icon">✓</span>
              <span class="advantage-card-text">可持续循环：自动覆盖未来所有年度</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Content Grid Layout */
.content-grid {
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: 32px;
  align-items: start;
}

.form-column {
  position: sticky;
  top: 100px;
}

.results-column {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Form Grid */
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px 16px;
}

/* Input Hint */
.input-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 6px;
}

/* Horizon Selector */
.horizon-selector {
  display: flex;
  gap: 8px;
}

.horizon-option {
  flex: 1;
  padding: 10px 0;
  text-align: center;
  background: var(--background-color);
  border: 2px solid var(--border-color);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  transition: all 0.2s ease;
  cursor: pointer;
}

.horizon-option.active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: #fff;
  font-weight: 600;
}

/* Action Section */
.action-section {
  padding-top: 8px;
}

.action-buttons {
  display: flex;
  gap: 16px;
  margin-top: -16px;
}

.action-buttons button {
  flex: 1;
}

/* Asset Overview */
.asset-overview {
  background: linear-gradient(135deg, #07C160 0%, #06AD56 100%);
}

.overview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.overview-title {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
}

.overview-date {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

.overview-amount {
  text-align: center;
  padding: 24px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  margin-bottom: 16px;
}

.overview-amount .amount-label {
  display: block;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 6px;
}

.overview-amount .amount-value {
  font-size: 36px;
  font-weight: 700;
  color: #ffffff;
  font-family: 'DIN Alternate', 'Roboto Mono', monospace;
}

.overview-breakdown {
  display: flex;
  justify-content: space-between;
}

.breakdown-item {
  flex: 1;
  text-align: center;
}

.breakdown-item:not(:last-child) {
  border-right: 1px solid rgba(255, 255, 255, 0.2);
}

.breakdown-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.breakdown-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 4px;
}

.breakdown-value {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  font-family: 'DIN Alternate', 'Roboto Mono', monospace;
}

.overview-interest {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.interest-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  margin-right: 12px;
}

.interest-value {
  font-size: 20px;
  font-weight: 700;
  color: #FFD700;
  font-family: 'DIN Alternate', 'Roboto Mono', monospace;
}

.interest-footnote {
  margin-top: 10px;
  padding: 0 16px;
}

.footnote-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.4;
}

/* Allocation Grid */
.allocation-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.allocation-card {
  background: var(--background-color);
  border-radius: 10px;
  padding: 20px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.allocation-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-hover);
}

.allocation-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.allocation-type-badge {
  font-size: 13px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 6px;
}

.allocation-card-amount {
  font-size: 18px;
  font-weight: 700;
  color: var(--secondary-color);
  font-family: 'DIN Alternate', 'Roboto Mono', monospace;
}

.allocation-card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.allocation-card-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-secondary);
}

.allocation-card-value {
  font-weight: 500;
  color: var(--text-primary);
}

.allocation-card-desc {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: right;
  max-width: 120px;
}

.allocation-card-interest {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--border-color);
  font-size: 13px;
  font-weight: 600;
  color: #ff4d4f;
  text-align: center;
}

.type-current {
  background: rgba(12, 193, 96, 0.1);
  color: var(--primary-color);
}

.type-short {
  background: rgba(255, 159, 67, 0.1);
  color: #FF9F43;
}

.type-long {
  background: rgba(95, 39, 205, 0.1);
  color: #5F27CD;
}

/* Timeline */
.timeline {
  position: relative;
  padding-left: 32px;
}

.timeline-item {
  position: relative;
  padding-bottom: 24px;
}

.timeline-item:last-child {
  padding-bottom: 0;
}

.timeline-dot {
  position: absolute;
  left: -32px;
  top: 0;
  width: 12px;
  height: 12px;
  background: var(--primary-color);
  border-radius: 50%;
  border: 3px solid var(--background-color);
}

.timeline-line {
  position: absolute;
  left: -27px;
  top: 12px;
  width: 2px;
  height: calc(100% + 12px);
  background: var(--primary-color);
  opacity: 0.3;
}

.timeline-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.timeline-date {
  font-size: 12px;
  color: var(--text-tertiary);
}

.timeline-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--secondary-color);
}

.timeline-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.timeline-action {
  font-size: 13px;
  color: var(--primary-color);
  font-weight: 500;
}

/* Advantage Grid */
.advantage-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.advantage-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 16px;
  background: var(--background-color);
  border-radius: 8px;
}

.advantage-card-icon {
  color: var(--primary-color);
  font-weight: 600;
  flex-shrink: 0;
  font-size: 16px;
}

.advantage-card-text {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* Tips Card */
.tips-card {
  margin-top: 24px;
}

.tip-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tip-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  background: rgba(12, 193, 96, 0.05);
  border-radius: 8px;
}

.tip-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.tip-text {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

/* Responsive */
@media (max-width: 1200px) {
  .content-grid {
    grid-template-columns: 1fr;
  }

  .form-column {
    position: static;
  }

  .allocation-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .allocation-grid,
  .advantage-grid {
    grid-template-columns: 1fr;
  }

  .overview-breakdown {
    flex-direction: column;
    gap: 12px;
  }

  .breakdown-item:not(:last-child) {
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    padding-bottom: 12px;
  }
}

/* Existing Portfolio Styles */

/* Capital Summary Cards */
.capital-summary {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  padding: 16px;
  background: linear-gradient(135deg, #f8fffe 0%, #f0fdf7 100%);
  border-radius: 12px;
  border: 1px solid rgba(7, 193, 96, 0.15);
}

.capital-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 8px;
  background: white;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  transition: all 0.2s;
}

.capital-card:hover {
  border-color: var(--primary-color);
  box-shadow: 0 2px 8px rgba(7, 193, 96, 0.1);
}

.capital-card.total {
  background: linear-gradient(135deg, #07C160 0%, #06ad56 100%);
  border-color: #07C160;
  color: white;
}

.capital-card-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.capital-card.total .capital-card-label {
  color: rgba(255, 255, 255, 0.9);
}

.capital-card-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  font-family: 'DIN Alternate', 'Roboto Mono', monospace;
  margin-bottom: 4px;
}

.capital-card-value.highlight {
  color: white;
}

.capital-card-hint {
  font-size: 11px;
  color: var(--text-tertiary);
}

.capital-card.total .capital-card-hint {
  color: rgba(255, 255, 255, 0.7);
}

/* Maturity Timeline Preview */
.maturity-timeline-preview {
  background: white;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  margin-bottom: 16px;
  overflow: hidden;
}

.timeline-header {
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid var(--border-color);
}

.timeline-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.timeline-list {
  padding: 8px 0;
}

.timeline-item-compact {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  font-size: 13px;
  transition: background 0.2s;
}

.timeline-item-compact:hover {
  background: #f8f9fa;
}

.timeline-item-compact.near {
  background: rgba(255, 159, 67, 0.08);
}

.timeline-dot-small {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--primary-color);
  flex-shrink: 0;
}

.timeline-item-compact.near .timeline-dot-small {
  background: #FF9F43;
  animation: pulse-dot 2s infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.2); }
}

.timeline-type {
  width: 70px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.timeline-amount {
  flex: 1;
  font-weight: 500;
  color: var(--text-primary);
  font-family: 'DIN Alternate', monospace;
}

.timeline-date {
  color: var(--text-tertiary);
  font-size: 12px;
}

.timeline-days {
  color: var(--text-tertiary);
  font-size: 12px;
  width: 60px;
  text-align: right;
}

.timeline-item-compact.near .timeline-days {
  color: #FF9F43;
  font-weight: 500;
}

/* Deposit type near maturity */
.deposit-type.near {
  color: #FF9F43;
  font-weight: 500;
}

/* Summary value warning */
.summary-value.warning {
  color: #FF9F43;
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-toggle {
  font-size: 12px;
  padding: 4px 12px;
  background: var(--background-color);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-toggle:hover {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.section-summary {
  font-size: 13px;
  color: var(--text-secondary);
  background: rgba(12, 193, 96, 0.1);
  padding: 4px 10px;
  border-radius: 4px;
  font-family: 'DIN Alternate', 'Roboto Mono', monospace;
}

.existing-portfolio-section {
  margin-top: 16px;
  padding: 16px;
  background: var(--background-color);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.portfolio-summary {
  display: flex;
  gap: 24px;
  padding: 12px 16px;
  background: rgba(12, 193, 96, 0.05);
  border-radius: 6px;
  margin-bottom: 16px;
}

.summary-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-label {
  font-size: 12px;
  color: var(--text-tertiary);
}

.summary-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: 'DIN Alternate', 'Roboto Mono', monospace;
}

.summary-value.highlight {
  color: var(--primary-color);
}

.summary-value.info {
  color: var(--info-color);
}

.summary-row.total-row {
  padding-top: 8px;
  border-top: 1px dashed var(--border-color);
  margin-top: 4px;
}

.summary-row.total-row .summary-value {
  font-size: 20px;
  font-weight: 700;
}

.deposit-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.deposit-item {
  padding: 12px 16px;
  background: white;
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.deposit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.deposit-type {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.deposit-amount {
  font-size: 16px;
  font-weight: 700;
  color: var(--primary-color);
  font-family: 'DIN Alternate', 'Roboto Mono', monospace;
}

.deposit-actions {
  display: flex;
  gap: 8px;
}

.btn-icon {
  font-size: 12px;
  padding: 4px 8px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.btn-icon.danger {
  color: #ff4d4f;
  border-color: #ff4d4f;
}

.btn-icon.danger:hover {
  background: #ff4d4f;
  color: white;
}

.deposit-details {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.detail-item {
  font-size: 12px;
  color: var(--text-tertiary);
}

.maturity-badge {
  display: inline-block;
  padding: 2px 6px;
  background: rgba(12, 193, 96, 0.1);
  color: var(--primary-color);
  border-radius: 4px;
  font-size: 11px;
  margin-left: 4px;
}

.maturity-badge.near {
  background: rgba(255, 159, 67, 0.1);
  color: #FF9F43;
}

.interest-earned {
  color: #ff4d4f;
  font-weight: 500;
}

.btn-add-deposit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px;
  background: transparent;
  border: 2px dashed var(--border-color);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add-deposit:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
  background: rgba(12, 193, 96, 0.05);
}

.plus-icon {
  font-size: 18px;
  font-weight: 600;
}

.liquidity-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 13px;
}

.liquidity-warning.warning {
  background: rgba(255, 159, 67, 0.1);
  color: #FF9F43;
  border: 1px solid rgba(255, 159, 67, 0.3);
}

.liquidity-warning.error {
  background: rgba(255, 77, 79, 0.1);
  color: #ff4d4f;
  border: 1px solid rgba(255, 77, 79, 0.3);
}

.warning-icon {
  font-size: 16px;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.modal-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  font-size: 24px;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s;
}

.modal-close:hover {
  background: var(--background-color);
  color: var(--text-primary);
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.form-input,
.form-select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  color: var(--text-primary);
  background: white;
  transition: all 0.2s;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(12, 193, 96, 0.1);
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
}

.modal-footer button {
  flex: 1;
}
</style>
