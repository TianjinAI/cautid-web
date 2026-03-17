<script setup>
import { ref, onMounted } from 'vue'
import { formatAmount, formatDate } from '../utils/format'
import { storage } from '../utils/storage'
import { showToast } from '../utils/toast'
import { useRouter } from 'vue-router'

const router = useRouter()

// State
const createDate = ref('')
const totalCashFormatted = ref('0')
const liquidityFundFormatted = ref('0')
const shortTermFundFormatted = ref('0')
const longTermFundFormatted = ref('0')
const allocation = ref([])
const cashFlowTimeline = ref([])

// Load plan data
const loadPlanData = () => {
  let plan = storage.getSync('currentPlan')

  if (!plan) {
    showToast({ title: '请先生成计划', icon: 'none' })
    setTimeout(() => {
      router.push('/')
    }, 1500)
    return
  }

  // Format allocation data
  const formattedAllocation = plan.allocation.map(item => ({
    ...item,
    amountFormatted: formatAmount(item.amount)
  }))

  // Handle both old and new data formats
  const totalCash = plan.totalCash || (plan.input && plan.input.totalCash) || 0
  const liquidityFund = plan.liquidityFund || (plan.summary && plan.summary.liquidityFund) || 0
  const shortTermFund = plan.shortTermFund || (plan.summary && plan.summary.shortTermFund) || 0
  const longTermFund = plan.longTermFund || (plan.summary && plan.summary.longTermFund) || 0
  const createTimeFormatted = plan.createTimeFormatted || formatDate(new Date(plan.createTime), 'YYYY 年 MM 月 DD 日')

  createDate.value = createTimeFormatted
  totalCashFormatted.value = formatAmount(totalCash)
  liquidityFundFormatted.value = formatAmount(liquidityFund)
  shortTermFundFormatted.value = formatAmount(shortTermFund)
  longTermFundFormatted.value = formatAmount(longTermFund)
  allocation.value = formattedAllocation
  cashFlowTimeline.value = plan.cashFlowTimeline || []
}

// Save plan
const savePlan = () => {
  const plan = storage.getSync('currentPlan')

  if (!plan) {
    showToast({ title: '没有可保存的计划', icon: 'none' })
    return
  }

  // Add to saved plans
  const savedPlans = storage.getSync('savedPlans') || []

  const newPlan = {
    ...plan,
    createTime: new Date().toISOString(),
    createTimeFormatted: formatDate(new Date(), 'YYYY 年 MM 月 DD 日 HH:mm')
  }

  savedPlans.unshift(newPlan)
  storage.setSync('savedPlans', savedPlans)

  showToast({ title: '保存成功', icon: 'success' })
}

// Regenerate plan
const regeneratePlan = () => {
  router.push('/')
}

// Lifecycle
onMounted(() => {
  loadPlanData()
})
</script>

<template>
  <div class="page-container">
    <div class="container">
      <!-- Header -->
      <div class="header-section">
        <h1 class="page-title">存款规划详情</h1>
        <p class="page-subtitle">生成日期：{{ createDate }}</p>
      </div>

      <!-- Asset Overview -->
      <div class="card asset-overview">
        <div class="overview-header">
          <div class="overview-title">资产总览</div>
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

      <!-- Action Buttons -->
      <div class="action-section">
        <button class="btn-secondary" @click="regeneratePlan">
          重新规划
        </button>
        <button class="btn-primary" @click="savePlan">
          保存到我的规划
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.header-section {
  margin-bottom: 24px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--secondary-color);
  margin-bottom: 8px;
}

.page-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
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

/* Action Section */
.action-section {
  display: flex;
  gap: 16px;
  padding: 24px 0;
}

.action-section .btn-secondary,
.action-section .btn-primary {
  flex: 1;
}
</style>
