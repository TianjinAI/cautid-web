<script setup>
import { ref, computed, onMounted } from 'vue'
import { formatAmount, formatDate, processEarlyWithdrawal, storage } from '../utils/format'
import { storage as localStorage } from '../utils/storage'
import { showToast, showModal } from '../utils/toast'
import { useRouter } from 'vue-router'

const router = useRouter()

// State
const groupedExecutionList = ref([])
const currentDeposits = ref([])
const totalDepositAmount = ref('0')
const planningHorizon = ref(1)
const totalActualInterest = ref(0)
const totalActualInterestFormatted = ref('0')
const completedCount = ref(0)
const totalCount = ref(0)
const hasPlan = ref(false)
const demandDepositBalance = ref('0')

// Withdrawal modal state
const showWithdrawalModal = ref(false)
const withdrawalAmount = ref('')
const selectedDepositIndex = ref(-1)
const withdrawableDeposits = ref([])
const withdrawalDestination = ref('活期存款')
const withdrawalDestinations = ['活期存款', '3 个月定期', '6 个月定期', '1 年定期']
const destinationIndex = ref(0)
const withdrawalResult = ref(null)

// Computed
const progressPercent = computed(() => {
  if (totalCount.value === 0) return 0
  return Math.round((completedCount.value / totalCount.value) * 100)
})

// Load execution plan
const loadExecutionPlan = () => {
  const planData = localStorage.getSync('executionPlan')

  if (!planData || !planData.executionList || planData.executionList.length === 0) {
    hasPlan.value = false
    currentDeposits.value = []
    groupedExecutionList.value = []
    totalDepositAmount.value = '0'
    planningHorizon.value = 1
    return
  }

  planningHorizon.value = planData.planningHorizon || 1
  const annualExpense = planData.annualExpense || 0

  // Process execution list
  const executionList = planData.executionList || []

  // Group by year
  const grouped = {}
  executionList.forEach((item, index) => {
    const year = item.year || 0
    if (!grouped[year]) {
      grouped[year] = {
        year,
        displayLabel: year === 0 ? '初始' : `第${year}年`,
        items: [],
        expanded: year === 0, // Expand year 0 by default
        completedCount: 0,
        totalCount: 0
      }
    }

    const quarter = item.quarter || 0
    let quarterGroup = grouped[year].items.find(q => q.quarter === quarter)

    if (!quarterGroup) {
      quarterGroup = {
        id: `${year}-${quarter}`,
        year,
        quarter,
        quarterDisplay: quarter > 0 ? `Q${quarter}` : '初始',
        dateDisplay: item.dateDisplay,
        title: item.title,
        description: item.description,
        depositType: item.depositType,
        amount: item.amount,
        amountFormatted: formatAmount(item.amount),
        projectedInterest: item.projectedInterest,
        projectedInterestFormatted: item.projectedInterest ? formatAmount(item.projectedInterest) : '',
        actionDetails: item.actionDetails,
        isCompleted: item.isCompleted || false,
        actualInterest: item.actualInterest,
        expanded: false,
        hasDeficit: false
      }
      grouped[year].items.push(quarterGroup)
      grouped[year].totalCount++
      if (item.isCompleted) {
        grouped[year].completedCount++
      }
    }
  })

  groupedExecutionList.value = Object.values(grouped)

  // Process current deposits
  const allocation = planData.allocation || []
  currentDeposits.value = allocation.map(dep => ({
    ...dep,
    amountFormatted: formatAmount(dep.amount),
    remainingBalanceFormatted: formatAmount(dep.remainingBalance || dep.amount),
    status: dep.status || 'active',
    typeClass: getTypeClass(dep.type)
  }))

  // Calculate total deposit amount
  const total = currentDeposits.value.reduce((sum, dep) => sum + (dep.remainingBalance || dep.amount), 0)
  totalDepositAmount.value = formatAmount(total)

  // Calculate completed count and total interest
  let totalInterest = 0
  let completed = 0
  executionList.forEach(item => {
    if (item.isCompleted) {
      completed++
      if (item.actualInterest) {
        totalInterest += parseFloat(item.actualInterest)
      }
    }
  })

  completedCount.value = completed
  totalCount.value = executionList.filter(item => item.year > 0 && item.depositType !== '活期' && item.depositType !== '初始').length
  totalActualInterest.value = totalInterest
  totalActualInterestFormatted.value = formatAmount(totalInterest)

  // Load demand deposit balance
  demandDepositBalance.value = localStorage.getSync('demandDepositBalance') || formatAmount(allocation.find(d => d.type === '活期存款')?.amount || 0)

  hasPlan.value = true
}

// Get type class
const getTypeClass = (type) => {
  if (type === '活期存款') return 'type-current'
  if (type === '3 年定期' || type === '5 年定期') return 'type-long'
  return 'type-short'
}

// Toggle year expand
const toggleYearExpand = (year) => {
  const yearGroup = groupedExecutionList.value.find(g => g.year === year)
  if (yearGroup) {
    yearGroup.expanded = !yearGroup.expanded
  }
}

// Toggle item expand
const toggleExpand = (year, index) => {
  const yearGroup = groupedExecutionList.value.find(g => g.year === year)
  if (yearGroup && yearGroup.items[index]) {
    yearGroup.items[index].expanded = !yearGroup.items[index].expanded
  }
}

// Toggle complete
const toggleComplete = (year, index) => {
  const yearGroup = groupedExecutionList.value.find(g => g.year === year)
  if (yearGroup && yearGroup.items[index]) {
    const item = yearGroup.items[index]
    item.isCompleted = !item.isCompleted

    // Update the original execution list
    const planData = localStorage.getSync('executionPlan')
    if (planData) {
      const execItem = planData.executionList.find(e =>
        e.year === year && e.title === item.title
      )
      if (execItem) {
        execItem.isCompleted = item.isCompleted
        if (item.actualInterest) {
          execItem.actualInterest = item.actualInterest
        }
      }
      localStorage.setSync('executionPlan', planData)
    }

    // Recalculate counts
    loadExecutionPlan()
  }
}

// Input handlers
const onDemandDepositBalanceInput = (e) => {
  demandDepositBalance.value = e.target.value
}

const updateDemandDepositBalance = () => {
  localStorage.setSync('demandDepositBalance', demandDepositBalance.value)
  showToast({ title: '已更新余额', icon: 'success' })
}

const onActualInterestInput = (e, year, index) => {
  const yearGroup = groupedExecutionList.value.find(g => g.year === year)
  if (yearGroup && yearGroup.items[index]) {
    yearGroup.items[index].actualInterest = e.target.value
  }
}

// Go to generate
const goToGenerate = () => {
  router.push('/')
}

// Save to my execute
const saveToMyExecute = () => {
  const planData = localStorage.getSync('executionPlan')
  if (!planData) {
    showToast({ title: '没有可保存的计划', icon: 'none' })
    return
  }

  const savedExecutes = localStorage.getSync('savedExecutes') || []

  const newExecute = {
    ...planData,
    createTime: new Date().toISOString(),
    createTimeFormatted: formatDate(new Date(), 'YYYY 年 MM 月 DD 日 HH:mm')
  }

  savedExecutes.unshift(newExecute)
  localStorage.setSync('savedExecutes', savedExecutes)

  showToast({ title: '已保存到执行', icon: 'success' })
}

// Clear plan
const clearPlan = () => {
  showModal({
    title: '确认清除',
    content: '确定要清除当前执行计划吗？此操作不可恢复。',
    confirmText: '清除',
    confirmColor: '#FF4D4F',
    success: (res) => {
      if (res.confirm) {
        localStorage.removeSync('executionPlan')
        hasPlan.value = false
        groupedExecutionList.value = []
        currentDeposits.value = []
        showToast({ title: '已清除', icon: 'success' })
      }
    }
  })
}

// Withdrawal modal handlers
const openWithdrawalModal = () => {
  const planData = localStorage.getSync('executionPlan')
  if (!planData || !planData.allocation) {
    showToast({ title: '没有可支取的存款', icon: 'none' })
    return
  }

  // Get withdrawable deposits (long-term only)
  const longTermTypes = ['1 年定期', '3 年定期', '5 年定期']
  withdrawableDeposits.value = planData.allocation
    .filter(d => longTermTypes.includes(d.type) && (d.remainingBalance || d.amount) > 0)
    .map(d => ({
      ...d,
      type: d.type,
      remainingBalance: d.remainingBalance || d.amount,
      remainingBalanceFormatted: formatAmount(d.remainingBalance || d.amount),
      rate: d.rate
    }))

  if (withdrawableDeposits.value.length === 0) {
    showToast({ title: '没有可提前支取的存款', icon: 'none' })
    return
  }

  selectedDepositIndex.value = 0
  withdrawalAmount.value = ''
  withdrawalResult.value = null
  showWithdrawalModal.value = true
}

const closeWithdrawalModal = () => {
  showWithdrawalModal.value = false
}

const onWithdrawalAmountInput = (e) => {
  withdrawalAmount.value = e.target.value
}

const onDepositSelect = (index) => {
  selectedDepositIndex.value = parseInt(index)
}

const onWithdrawalDestinationChange = (e) => {
  destinationIndex.value = parseInt(e.target.value)
  withdrawalDestination.value = withdrawalDestinations[destinationIndex.value]
}

const confirmWithdrawal = () => {
  const amount = parseFloat(withdrawalAmount.value)
  if (!amount || amount <= 0) {
    showToast({ title: '请输入有效的支取金额', icon: 'none' })
    return
  }

  const deposit = withdrawableDeposits.value[selectedDepositIndex.value]
  if (!deposit) {
    showToast({ title: '请选择存款', icon: 'none' })
    return
  }

  const maxWithdrawal = deposit.remainingBalance || deposit.amount
  if (amount > maxWithdrawal) {
    showToast({ title: '支取金额不能超过余额', icon: 'none' })
    return
  }

  // Process withdrawal
  const planData = localStorage.getSync('executionPlan')
  if (!planData) return

  // Find and update the deposit
  const depositIndex = planData.allocation.findIndex(d => d.type === deposit.type)
  if (depositIndex === -1) return

  const d = planData.allocation[depositIndex]
  const originalAmount = d.remainingBalance || d.amount
  const newBalance = originalAmount - amount

  // Calculate lost interest (simplified)
  const rate = d.rate || 0
  const lostInterest = amount * (rate / 100) * 0.5 // Simplified calculation

  // Update deposit
  d.remainingBalance = newBalance
  d.withdrawnAmount = (d.withdrawnAmount || 0) + amount
  d.withdrawalHistory = d.withdrawalHistory || []
  d.withdrawalHistory.push({
    date: new Date().toISOString(),
    amount: amount,
    destinationType: withdrawalDestination.value
  })

  // Add to destination deposit or create new
  if (withdrawalDestination.value !== '活期存款') {
    // Find or create destination deposit
    const destIndex = planData.allocation.findIndex(d => d.type === withdrawalDestination.value)
    if (destIndex !== -1) {
      planData.allocation[destIndex].amount += amount
      planData.allocation[destIndex].remainingBalance = (planData.allocation[destIndex].remainingBalance || 0) + amount
    }
  } else {
    // Add to demand deposit
    const demandIndex = planData.allocation.findIndex(d => d.type === '活期存款')
    if (demandIndex !== -1) {
      planData.allocation[demandIndex].amount += amount
      planData.allocation[demandIndex].remainingBalance = (planData.allocation[demandIndex].remainingBalance || 0) + amount
    }
  }

  // Update demand deposit balance in localStorage
  if (withdrawalDestination.value === '活期存款') {
    const currentBalance = parseFloat(localStorage.getSync('demandDepositBalance') || '0')
    localStorage.setSync('demandDepositBalance', formatAmount(currentBalance + amount))
  }

  localStorage.setSync('executionPlan', planData)

  // Set result
  withdrawalResult.value = {
    withdrawalAmount: formatAmount(amount),
    originalAmount: formatAmount(originalAmount),
    newBalance: formatAmount(newBalance),
    lostInterest: formatAmount(lostInterest),
    destinationType: withdrawalDestination.value
  }

  showToast({ title: '支取成功', icon: 'success' })

  // Reload data
  loadExecutionPlan()
}

// Lifecycle
onMounted(() => {
  loadExecutionPlan()
})
</script>

<template>
  <div class="page-container">
    <div class="container">
      <!-- Header -->
      <div class="header-section">
        <h1 class="page-title">执行计划</h1>
        <p class="page-subtitle">记录每笔存款到期时的实际收益</p>
      </div>

      <!-- No Plan State -->
      <div v-if="!hasPlan" class="no-plan">
        <div class="no-plan-icon">📋</div>
        <div class="no-plan-text">暂无执行计划</div>
        <div class="no-plan-desc">请先在首页生成存款规划</div>
        <button class="btn-primary" @click="goToGenerate">去生成计划</button>
      </div>

      <!-- Plan Content -->
      <div v-if="hasPlan">
        <!-- Summary Card -->
        <div class="card summary-card">
          <div class="summary-header">
            <div class="summary-title">累计实际收益</div>
            <div class="summary-progress">{{ completedCount }}/{{ totalCount }} 已完成</div>
          </div>
          <div class="summary-amount">
            <span class="amount-label">累计利息</span>
            <span class="amount-value">¥{{ totalActualInterestFormatted }}</span>
          </div>
          <div class="summary-progress-bar">
            <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
          </div>
        </div>

        <!-- Current Deposits Table -->
        <div v-if="currentDeposits.length > 0" class="card deposit-table-card">
          <div class="section-title">当前存款明细</div>
          <div class="deposit-table">
            <div class="table-header">
              <div class="table-col col-type">存款类型</div>
              <div class="table-col col-period">期限</div>
              <div class="table-col col-amount">金额</div>
            </div>
            <div v-for="(item, index) in currentDeposits" :key="index" class="table-row">
              <div class="table-col col-type">
                <span :class="['type-badge', item.typeClass]">{{ item.type }}</span>
              </div>
              <div class="table-col col-period">{{ item.years }}年</div>
              <div class="table-col col-amount">¥{{ item.amountFormatted }}</div>
            </div>
            <!-- Total Row -->
            <div class="table-row table-row-total">
              <div class="table-col col-type">合计</div>
              <div class="table-col col-period"></div>
              <div class="table-col col-amount">¥{{ totalDepositAmount }}</div>
            </div>
          </div>
        </div>

        <!-- Demand Deposit Balance -->
        <div class="card demand-deposit-card">
          <div class="section-title">活期存款余额</div>
          <div class="demand-deposit-desc">用于日常开支的灵活账户</div>
          <div class="demand-deposit-balance">
            <div class="balance-label">当前余额</div>
            <div class="balance-input-wrapper">
              <span class="currency-symbol">¥</span>
              <input
                type="text"
                inputmode="numeric"
                class="balance-input"
                :value="demandDepositBalance"
                placeholder="0"
                @input="onDemandDepositBalanceInput"
              />
            </div>
          </div>
          <div class="demand-deposit-actions">
            <button class="btn-update-balance" @click="updateDemandDepositBalance">更新余额</button>
          </div>
        </div>

        <!-- Execution List by Year -->
        <div class="card execution-section">
          <div class="section-title">执行操作</div>

          <div v-for="yearGroup in groupedExecutionList" :key="yearGroup.year">
            <!-- Year Header -->
            <div
              class="year-group-header"
              :class="{ 'has-progress': yearGroup.completedCount > 0, 'all-completed': yearGroup.completedCount === yearGroup.totalCount && yearGroup.totalCount > 0 }"
              @click="toggleYearExpand(yearGroup.year)"
            >
              <div class="year-group-main">
                <span class="year-group-icon" :class="{ rotated: yearGroup.expanded }">▶</span>
                <div class="year-group-info">
                  <div class="year-group-label" :class="{ 'label-active': yearGroup.completedCount > 0 }">
                    {{ yearGroup.displayLabel }}
                  </div>
                  <div class="year-group-progress">{{ yearGroup.completedCount }}/{{ yearGroup.totalCount }} 已完成</div>
                </div>
              </div>
              <div
                v-if="yearGroup.completedCount > 0"
                class="year-group-badge"
                :class="{ 'badge-completed': yearGroup.completedCount === yearGroup.totalCount && yearGroup.totalCount > 0 }"
              >
                {{ yearGroup.completedCount === yearGroup.totalCount && yearGroup.totalCount > 0 ? '已完成' : '进行中' }}
              </div>
            </div>

            <!-- Quarter Items -->
            <div v-if="yearGroup.expanded" class="year-group-items">
              <div
                v-for="(quarterItem, qIndex) in yearGroup.items"
                :key="quarterItem.id"
                class="execution-item"
                :class="{ completed: quarterItem.isCompleted, expanded: quarterItem.expanded }"
              >
                <!-- Header Row -->
                <div class="execution-header-row" @click="toggleExpand(yearGroup.year, qIndex)">
                  <div class="execution-index">
                    <span v-if="quarterItem.quarter > 0">Q{{ quarterItem.quarter }}</span>
                    <span v-else>Init</span>
                  </div>
                  <div class="execution-main">
                    <div class="execution-date">{{ quarterItem.dateDisplay }}</div>
                    <div class="execution-title">{{ quarterItem.title }}</div>
                  </div>
                  <span class="execution-expand-icon" :class="{ rotated: quarterItem.expanded }">▼</span>
                </div>

                <!-- Brief (collapsed) -->
                <div v-if="!quarterItem.expanded" class="execution-brief">
                  <span class="brief-text" :class="{ 'deficit-text': quarterItem.hasDeficit }">{{ quarterItem.description }}</span>
                </div>

                <!-- Details (expanded) -->
                <div v-else class="execution-details">
                  <div class="detail-section">
                    <div class="detail-title">操作说明</div>
                    <div class="execution-desc" :class="{ 'deficit-text': quarterItem.hasDeficit }">{{ quarterItem.description }}</div>
                  </div>

                  <div class="detail-section">
                    <div class="detail-title">详细信息</div>
                    <div class="detail-row">
                      <span class="detail-label">存款类型：</span>
                      <span class="detail-value">{{ quarterItem.depositType }}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">金额：</span>
                      <span class="detail-value" :class="{ 'deficit-amount': quarterItem.hasDeficit }">¥{{ quarterItem.amountFormatted }}</span>
                    </div>
                    <div v-if="quarterItem.projectedInterest" class="detail-row">
                      <span class="detail-label">预期利息：</span>
                      <span class="detail-value projected">¥{{ quarterItem.projectedInterestFormatted }}</span>
                    </div>
                    <div class="detail-row disclaimer-row">
                      <span class="disclaimer-text">* 预期利息仅供参考，实际利率以银行柜台为准</span>
                    </div>

                    <!-- Actual Interest Input -->
                    <div v-if="yearGroup.year > 0 && quarterItem.depositType !== '活期' && quarterItem.depositType !== '初始'" class="detail-row actual-row">
                      <span class="detail-label">实际利息：</span>
                      <div class="actual-input">
                        <span class="currency">¥</span>
                        <input
                          type="text"
                          inputmode="numeric"
                          class="interest-input"
                          placeholder="输入实际收益"
                          :value="quarterItem.actualInterest"
                          @input="(e) => onActualInterestInput(e, yearGroup.year, qIndex)"
                          :disabled="quarterItem.isCompleted"
                        />
                      </div>
                    </div>
                  </div>

                  <!-- Action Details -->
                  <div v-if="quarterItem.actionDetails" class="detail-section">
                    <div class="detail-title">资金分配</div>
                    <div class="action-details" :class="{ 'deficit-warning': quarterItem.hasDeficit }">
                      <span class="action-details-text">{{ quarterItem.actionDetails }}</span>
                    </div>
                  </div>

                  <!-- Completion Toggle -->
                  <div v-if="yearGroup.year > 0 && quarterItem.depositType !== '活期' && quarterItem.depositType !== '初始'" class="completion-section">
                    <span class="completion-label">标记完成</span>
                    <label class="switch">
                      <input
                        type="checkbox"
                        :checked="quarterItem.isCompleted"
                        @change="toggleComplete(yearGroup.year, qIndex)"
                      />
                      <span class="slider"></span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Withdrawal Button -->
        <div class="withdrawal-btn-section">
          <button class="btn-withdrawal" @click="openWithdrawalModal">提前支取</button>
        </div>

        <!-- Save Button -->
        <div class="save-section">
          <button class="btn-save" @click="saveToMyExecute">保存到我的执行</button>
        </div>

        <!-- Clear Button -->
        <div class="clear-section">
          <button class="btn-clear" @click="clearPlan">清除计划</button>
        </div>
      </div>

      <!-- Tips -->
      <div v-if="hasPlan" class="tips-section">
        <div class="tip-item">
          <span class="tip-icon">💡</span>
          <span class="tip-text">每笔存款到期后，输入实际获得的利息，系统将累计计算总收益</span>
        </div>
        <div class="tip-item">
          <span class="tip-icon">📊</span>
          <span class="tip-text">通过对比预期利息和实际利息，评估存款收益情况</span>
        </div>
        <div class="tip-item">
          <span class="tip-icon">⚠️</span>
          <span class="tip-text">提前支取将损失利息，请谨慎操作</span>
        </div>
      </div>

      <!-- Withdrawal Modal -->
      <div v-if="showWithdrawalModal" class="modal-overlay" @click="closeWithdrawalModal">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <div class="modal-title">提前支取</div>
            <button class="modal-close" @click="closeWithdrawalModal">×</button>
          </div>

          <div class="modal-body">
            <!-- Withdrawal Amount -->
            <div class="input-section">
              <label class="input-label">支取金额</label>
              <div class="amount-input-wrap">
                <span class="currency-symbol">¥</span>
                <input
                  type="text"
                  inputmode="numeric"
                  class="amount-input"
                  placeholder="请输入支取金额"
                  :value="withdrawalAmount"
                  @input="onWithdrawalAmountInput"
                />
              </div>
            </div>

            <!-- Deposit Selection -->
            <div class="deposit-selection">
              <label class="input-label">选择存款</label>
              <div class="deposit-options">
                <div
                  v-for="(deposit, index) in withdrawableDeposits"
                  :key="index"
                  class="deposit-option"
                  :class="{ selected: selectedDepositIndex === index }"
                  @click="onDepositSelect(index)"
                >
                  <div class="deposit-radio">
                    <input type="radio" :checked="selectedDepositIndex === index" />
                  </div>
                  <div class="deposit-info">
                    <div class="deposit-type">{{ deposit.type }}</div>
                    <div class="deposit-balance">可用余额：¥{{ deposit.remainingBalanceFormatted }}</div>
                    <div class="deposit-rate">利率：{{ deposit.rate }}%</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Destination Selection -->
            <div class="destination-selection">
              <label class="input-label">资金存入</label>
              <div class="destination-desc">提前支取的资金将存入以下账户</div>
              <select class="destination-picker" :value="destinationIndex" @change="onWithdrawalDestinationChange">
                <option v-for="(dest, index) in withdrawalDestinations" :key="dest" :value="index">
                  {{ dest }}
                </option>
              </select>
            </div>

            <!-- Warning -->
            <div class="warning-section">
              <span class="warning-icon">⚠️</span>
              <span class="warning-text">
                提前支取将导致该部分金额不计利息（按活期 0.05% 计），剩余金额将继续按原利率计息。
              </span>
            </div>

            <!-- Result -->
            <div v-if="withdrawalResult" class="result-section">
              <div class="result-title">支取结果</div>
              <div class="result-row">
                <span class="result-label">支取金额:</span>
                <span class="result-value">¥{{ withdrawalResult.withdrawalAmount }}</span>
              </div>
              <div class="result-row">
                <span class="result-label">原始金额:</span>
                <span class="result-value">¥{{ withdrawalResult.originalAmount }}</span>
              </div>
              <div class="result-row">
                <span class="result-label">剩余余额:</span>
                <span class="result-value highlight">¥{{ withdrawalResult.newBalance }}</span>
              </div>
              <div class="result-row">
                <span class="result-label">损失利息:</span>
                <span class="result-value warning">¥{{ withdrawalResult.lostInterest }}</span>
              </div>
              <div v-if="withdrawalResult.destinationType" class="result-row">
                <span class="result-label">资金存入:</span>
                <span class="result-value success">{{ withdrawalResult.destinationType }}</span>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-cancel" @click="closeWithdrawalModal">取消</button>
            <button class="btn-confirm" @click="confirmWithdrawal">确认支取</button>
          </div>
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

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--primary-color);
  margin-bottom: 8px;
}

.page-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
}

/* No Plan State */
.no-plan {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 32px;
}

.no-plan-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.no-plan-text {
  font-size: 18px;
  font-weight: 600;
  color: var(--secondary-color);
  margin-bottom: 8px;
}

.no-plan-desc {
  font-size: 14px;
  color: var(--text-tertiary);
  margin-bottom: 24px;
}

/* Summary Card */
.summary-card {
  background: linear-gradient(135deg, #07C160 0%, #06AD56 100%);
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.summary-title {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
}

.summary-progress {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

.summary-amount {
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
  color: #FFD700;
  font-family: 'DIN Alternate', 'Roboto Mono', monospace;
}

.summary-progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #FFD700;
  transition: width 0.3s ease;
}

/* Deposit Table */
.deposit-table {
  display: flex;
  flex-direction: column;
}

.table-header {
  display: flex;
  padding: 12px;
  background: var(--background-color);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.table-row {
  display: flex;
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
  font-size: 13px;
}

.table-row:last-child {
  border-bottom: none;
}

.table-row-total {
  background: var(--background-color);
  border-radius: 6px;
  font-weight: 600;
}

.table-col {
  flex: 1;
}

.col-type { flex: 2; }
.col-period { flex: 1; }
.col-amount { flex: 1; text-align: right; }

.type-badge {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
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

/* Demand Deposit */
.demand-deposit-balance {
  margin: 16px 0;
}

.balance-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.balance-input-wrapper {
  position: relative;
}

.currency-symbol {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  color: var(--text-secondary);
}

.balance-input {
  width: 100%;
  height: 44px;
  padding: 0 12px 0 32px;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  font-size: 16px;
  outline: none;
  transition: border-color 0.2s;
}

.balance-input:focus {
  border-color: var(--primary-color);
}

.demand-deposit-actions {
  display: flex;
  gap: 12px;
}

.btn-update-balance {
  padding: 10px 24px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-update-balance:hover {
  opacity: 0.9;
}

/* Year Group Header */
.year-group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: var(--background-color);
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 12px;
  transition: background 0.2s;
}

.year-group-header:hover {
  background: rgba(12, 193, 96, 0.05);
}

.year-group-header.has-progress {
  border-left: 3px solid var(--primary-color);
}

.year-group-header.all-completed {
  background: rgba(12, 193, 96, 0.1);
}

.year-group-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.year-group-icon {
  font-size: 12px;
  color: var(--text-secondary);
  transition: transform 0.2s;
}

.year-group-icon.rotated {
  transform: rotate(90deg);
}

.year-group-info {
  display: flex;
  flex-direction: column;
}

.year-group-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  transition: color 0.2s;
}

.year-group-label.label-active {
  color: var(--primary-color);
}

.year-group-progress {
  font-size: 12px;
  color: var(--text-tertiary);
}

.year-group-badge {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 12px;
  background: rgba(255, 159, 67, 0.1);
  color: #FF9F43;
}

.year-group-badge.badge-completed {
  background: rgba(12, 193, 96, 0.1);
  color: var(--primary-color);
}

/* Execution Item */
.execution-item {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 12px;
  overflow: hidden;
  transition: all 0.2s;
}

.execution-item.completed {
  border-color: var(--primary-color);
  background: rgba(12, 193, 96, 0.02);
}

.execution-header-row {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.execution-header-row:hover {
  background: var(--background-color);
}

.execution-index {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--background-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-right: 12px;
}

.execution-item.completed .execution-index {
  background: var(--primary-color);
  color: white;
}

.execution-main {
  flex: 1;
}

.execution-date {
  font-size: 12px;
  color: var(--text-tertiary);
}

.execution-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.execution-expand-icon {
  font-size: 12px;
  color: var(--text-tertiary);
  transition: transform 0.2s;
}

.execution-expand-icon.rotated {
  transform: rotate(180deg);
}

.execution-brief {
  padding: 0 16px 14px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.execution-details {
  padding: 16px;
  background: var(--background-color);
  border-top: 1px solid var(--border-color);
}

.detail-section {
  margin-bottom: 16px;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-title {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.execution-desc {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.5;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 13px;
  border-bottom: 1px dashed var(--border-color);
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  color: var(--text-secondary);
}

.detail-value {
  color: var(--text-primary);
  font-weight: 500;
}

.detail-value.projected {
  color: var(--primary-color);
}

.disclaimer-row {
  padding-top: 8px;
}

.disclaimer-text {
  font-size: 11px;
  color: #999;
  font-style: italic;
  text-align: right;
  width: 100%;
}

.actual-row {
  align-items: center;
}

.actual-input {
  position: relative;
  display: flex;
  align-items: center;
}

.currency {
  font-size: 13px;
  color: var(--text-secondary);
  margin-right: 4px;
}

.interest-input {
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 13px;
  outline: none;
}

.interest-input:focus {
  border-color: var(--primary-color);
}

.interest-input:disabled {
  background: var(--background-color);
  cursor: not-allowed;
}

.action-details {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
  white-space: pre-line;
}

.completion-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  margin-top: 12px;
  border-top: 1px solid var(--border-color);
}

.completion-label {
  font-size: 13px;
  color: var(--text-primary);
}

/* Toggle Switch */
.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.3s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--primary-color);
}

input:checked + .slider:before {
  transform: translateX(20px);
}

/* Buttons */
.withdrawal-btn-section,
.save-section,
.clear-section {
  padding: 16px 0;
}

.btn-withdrawal,
.btn-save,
.btn-clear {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-withdrawal {
  background: #FF9F43;
  color: white;
}

.btn-save {
  background: var(--primary-color);
  color: white;
}

.btn-clear {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.btn-withdrawal:hover,
.btn-save:hover {
  opacity: 0.9;
}

.btn-clear:hover {
  background: var(--background-color);
}

/* Modal */
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
  z-index: 9999;
  padding: 24px;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 400px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--secondary-color);
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-body {
  padding: 20px;
}

.input-section {
  margin-bottom: 20px;
}

.input-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.amount-input-wrap {
  position: relative;
}

.amount-input-wrap .currency-symbol {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  color: var(--text-secondary);
}

.amount-input {
  width: 100%;
  height: 48px;
  padding: 0 16px 0 40px;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  font-size: 16px;
  outline: none;
  transition: border-color 0.2s;
}

.amount-input:focus {
  border-color: var(--primary-color);
}

.deposit-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.deposit-option {
  display: flex;
  align-items: center;
  padding: 14px;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.deposit-option:hover {
  border-color: var(--primary-color);
}

.deposit-option.selected {
  border-color: var(--primary-color);
  background: rgba(12, 193, 96, 0.05);
}

.deposit-radio {
  margin-right: 12px;
}

.deposit-radio input[type="radio"] {
  width: 18px;
  height: 18px;
  accent-color: var(--primary-color);
}

.deposit-info {
  flex: 1;
}

.deposit-type {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.deposit-balance {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 2px;
}

.deposit-rate {
  font-size: 11px;
  color: var(--text-tertiary);
}

.destination-picker {
  width: 100%;
  height: 44px;
  padding: 0 16px;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  background: white;
  cursor: pointer;
}

.destination-picker:focus {
  border-color: var(--primary-color);
}

.warning-section {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 159, 67, 0.05);
  border-radius: 8px;
  margin: 20px 0;
}

.warning-icon {
  font-size: 20px;
}

.warning-text {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.result-section {
  padding: 16px;
  background: rgba(12, 193, 96, 0.05);
  border-radius: 8px;
}

.result-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--secondary-color);
  margin-bottom: 12px;
}

.result-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 13px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.result-row:last-child {
  border-bottom: none;
}

.result-label {
  color: var(--text-secondary);
}

.result-value {
  font-weight: 500;
  color: var(--text-primary);
}

.result-value.highlight {
  color: var(--primary-color);
}

.result-value.warning {
  color: #FF4D4F;
}

.result-value.success {
  color: var(--primary-color);
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
}

.btn-cancel,
.btn-confirm {
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-cancel {
  background: var(--background-color);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-confirm {
  background: var(--primary-color);
  color: white;
  border: none;
}

.btn-cancel:hover,
.btn-confirm:hover {
  opacity: 0.9;
}
</style>
