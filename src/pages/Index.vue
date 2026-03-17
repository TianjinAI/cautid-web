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

// Generate plan
const generatePlanHandler = () => {
  const totalCashValue = parseFloat(totalCash.value)
  let monthlyExpenseValue = parseFloat(monthlyExpense.value)

  if (!totalCashValue || totalCashValue <= 0) {
    showToast({ title: '请输入有效存款金额', icon: 'none' })
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
    planningHorizon: parseInt(planningHorizon.value)
  }

  const plan = generatePlan(inputData)

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

  // Scroll to results
  setTimeout(() => {
    window.scrollTo({ top: 400, behavior: 'smooth' })
  }, 500)
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
    totalCash: parseFloat(totalCash.value),
    totalCashFormatted: formatAmount(parseFloat(totalCash.value)),
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
    totalCash.value = lastInput.totalCash || ''
    housingExpense.value = lastInput.housingExpense || ''
    foodExpense.value = lastInput.foodExpense || ''
    otherExpense.value = lastInput.otherExpense || ''
    emergencyFund.value = lastInput.emergencyFund || ''
    planningHorizon.value = lastInput.planningHorizon || '1'
    calculateExpenses()
  }
})
</script>

<template>
  <div class="page-container">
    <div class="container">
      <!-- Header -->
      <div class="header-section">
        <h1 class="app-title">财梯</h1>
        <p class="app-subtitle">季度滚动阶梯式存款规划</p>
        <p class="app-desc">智能分配存款，确保每个季度初资金准时到位</p>
      </div>

      <!-- Input Form Card -->
      <div class="card input-card">
        <div class="section-title">基础数据</div>

        <!-- Total Cash -->
        <div class="input-group">
          <label class="input-label">总存款金额（元）</label>
          <div class="amount-input-wrap">
            <span class="currency">¥</span>
            <input
              type="text"
              inputmode="numeric"
              class="input-field"
              placeholder="请输入总存款金额"
              :value="totalCash"
              @input="onTotalCashInput"
              @blur="(e) => { totalCash = e.target.value }"
            />
          </div>
        </div>

        <!-- Monthly Expenses -->
        <div class="expense-section">
          <div class="input-label">月度支出明细</div>
          <div class="expense-items">
            <div class="expense-item">
              <span class="expense-label">房屋支出</span>
              <div class="amount-input-wrap expense-input">
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
            <div class="expense-item">
              <span class="expense-label">餐饮支出</span>
              <div class="amount-input-wrap expense-input">
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
            <div class="expense-item">
              <span class="expense-label">其他支出</span>
              <div class="amount-input-wrap expense-input">
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
          </div>
        </div>

        <!-- Emergency Fund -->
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
          <div class="input-hint">应急金将永久保留在活期，不参与滚动</div>
        </div>

        <!-- Planning Horizon -->
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
          <div class="input-hint">选择滚动周期长度，到期自动续存</div>
        </div>

        <!-- Expense Summary -->
        <div v-if="monthlyExpense > 0" class="expense-summary">
          <div class="summary-item">
            <div class="summary-label">月度支出</div>
            <div class="summary-value">¥{{ monthlyExpenseFormatted }}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">季度支出</div>
            <div class="summary-value">¥{{ quarterlyExpenseFormatted }}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">年度支出</div>
            <div class="summary-value">¥{{ annualExpenseFormatted }}</div>
          </div>
        </div>
      </div>

      <!-- Generate Button -->
      <div class="action-section">
        <button class="btn-primary" @click="generatePlanHandler">
          生成存款计划
        </button>
      </div>

      <!-- Save and Execute Buttons -->
      <div v-if="showResult" class="action-section action-section-secondary">
        <button class="btn-secondary" @click="savePlan">
          保存
        </button>
        <button class="btn-primary" @click="sendToExecute">
          送去执行
        </button>
      </div>

      <!-- Results -->
      <div v-if="showResult">
        <!-- Asset Overview -->
        <div class="card asset-overview">
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

        <!-- Allocation List -->
        <div class="card allocation-section">
          <div class="section-title">存款分配方案</div>
          <div class="allocation-list">
            <div v-for="item in allocation" :key="item.type" class="allocation-item">
              <div class="allocation-header">
                <span :class="['allocation-type', item.type === '活期存款' ? 'type-current' : item.type === '3 年定期' ? 'type-long' : 'type-short']">
                  {{ item.type }}
                </span>
                <span class="allocation-amount">¥{{ item.amountFormatted }}</span>
              </div>
              <div class="allocation-details">
                <div class="detail-row">
                  <span class="detail-label">占比：</span>
                  <span class="detail-value">{{ item.percentage }}%</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">利率：</span>
                  <span class="detail-value">{{ item.rate }}%</span>
                </div>
                <div v-if="item.maturityDateStr && item.maturityDateStr !== '随时可用'" class="detail-row">
                  <span class="detail-label">到期日：</span>
                  <span class="detail-value">{{ item.maturityDateStr }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">用途：</span>
                  <span class="detail-value">{{ item.purpose }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">操作：</span>
                  <span class="detail-value">{{ item.action }}</span>
                </div>
                <div v-if="item.projectedInterest && item.projectedInterest > 0" class="detail-row interest-row">
                  <span class="detail-label">预期利息：</span>
                  <span class="detail-value interest-value">¥{{ item.interestFormatted }}</span>
                </div>
                <div class="detail-row disclaimer-row">
                  <span class="disclaimer-text">* 预期利息仅供参考，实际利率以银行柜台为准</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Timeline -->
        <div class="card timeline-section">
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
        <div class="card advantage-section">
          <div class="section-title">方案优势</div>
          <div class="advantage-list">
            <div class="advantage-item">
              <span class="advantage-icon">✓</span>
              <span class="advantage-text">零时间缺口：每个季度首日资金 100% 到位</span>
            </div>
            <div class="advantage-item">
              <span class="advantage-icon">✓</span>
              <span class="advantage-text">利息最大化：短期资金用定期，长期资金存 3 年</span>
            </div>
            <div class="advantage-item">
              <span class="advantage-icon">✓</span>
              <span class="advantage-text">操作极简：每季度仅需 1 次操作</span>
            </div>
            <div class="advantage-item">
              <span class="advantage-icon">✓</span>
              <span class="advantage-text">安全冗余：应急金独立保留</span>
            </div>
            <div class="advantage-item">
              <span class="advantage-icon">✓</span>
              <span class="advantage-text">可持续循环：自动覆盖未来所有年度</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Tips -->
      <div v-if="!showResult && totalCash" class="tips-section">
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
</template>

<style scoped>
.header-section {
  text-align: center;
  padding: 32px 0 24px;
}

.app-title {
  font-size: 36px;
  font-weight: 700;
  color: var(--primary-color);
  margin-bottom: 8px;
}

.app-subtitle {
  font-size: 18px;
  font-weight: 500;
  color: var(--secondary-color);
  margin-bottom: 8px;
}

.app-desc {
  font-size: 14px;
  color: var(--text-secondary);
}

.input-card {
  padding: 28px 24px;
}

.expense-section {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color);
}

.expense-items {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.expense-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.expense-label {
  font-size: 14px;
  color: var(--text-primary);
}

.expense-input {
  width: 140px;
}

.expense-input .input-field {
  text-align: right;
  padding-right: 32px;
}

.input-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 6px;
}

.horizon-selector {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.horizon-option {
  flex: 1;
  padding: 12px 0;
  text-align: center;
  background: var(--background-color);
  border: 2px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
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

.expense-summary {
  display: flex;
  justify-content: space-between;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color);
  background: var(--background-color);
  border-radius: 8px;
  padding: 20px;
}

.summary-item {
  text-align: center;
  flex: 1;
}

.summary-item:not(:last-child) {
  border-right: 1px solid var(--border-color);
}

.summary-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.summary-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--primary-color);
  font-family: 'DIN Alternate', 'Roboto Mono', monospace;
}

.action-section {
  padding: 16px 0;
}

.action-section-secondary {
  display: flex;
  gap: 16px;
}

.action-section-secondary .btn-secondary,
.action-section-secondary .btn-primary {
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

.amount-label {
  display: block;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 6px;
}

.amount-value {
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
  color: #ff4d4f;
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

/* Allocation */
.allocation-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.allocation-item {
  background: var(--background-color);
  border-radius: 8px;
  padding: 20px;
}

.allocation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.allocation-type {
  font-size: 14px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 4px;
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

.allocation-amount {
  font-size: 16px;
  font-weight: 600;
  color: var(--secondary-color);
  font-family: 'DIN Alternate', 'Roboto Mono', monospace;
}

.allocation-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-row {
  display: flex;
  font-size: 12px;
  line-height: 1.6;
}

.detail-label {
  color: var(--text-secondary);
  flex-shrink: 0;
  width: 70px;
}

.detail-value {
  color: var(--text-primary);
}

.interest-row {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed var(--border-color);
}

.interest-value {
  color: #ff4d4f;
  font-weight: 600;
}

.disclaimer-row {
  margin-top: 6px;
}

.disclaimer-text {
  font-size: 11px;
  color: #999;
  font-style: italic;
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
  font-size: 11px;
  color: var(--text-tertiary);
}

.timeline-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--secondary-color);
}

.timeline-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.timeline-action {
  font-size: 12px;
  color: var(--primary-color);
}

/* Advantages */
.advantage-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.advantage-item {
  display: flex;
  align-items: flex-start;
}

.advantage-icon {
  color: var(--primary-color);
  font-weight: 600;
  margin-right: 10px;
  flex-shrink: 0;
}

.advantage-text {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* Tips */
.tips-section {
  padding: 16px 0;
}

.tip-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 12px;
  padding: 12px 16px;
  background: rgba(12, 193, 96, 0.05);
  border-radius: 6px;
}

.tip-icon {
  font-size: 16px;
  margin-right: 10px;
  flex-shrink: 0;
}

.tip-text {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
}
</style>
