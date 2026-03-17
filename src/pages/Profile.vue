<script setup>
import { ref, computed, onMounted } from 'vue'
import { formatAmount, formatDate } from '../utils/format'
import { storage } from '../utils/storage'
import { showModal, showToast } from '../utils/toast'
import { useRouter } from 'vue-router'

const router = useRouter()

// State
const savedPlans = ref([])
const savedPlansCount = ref(0)
const savedExecutes = ref([])
const savedExecutesCount = ref(0)
const totalPlansCount = ref(0)

// Computed
const hasPlans = computed(() => savedPlans.value.length > 0)
const hasExecutes = computed(() => savedExecutes.value.length > 0)

// Load saved plans
const loadSavedPlans = () => {
  const plans = storage.getSync('savedPlans') || []

  const formattedPlans = plans.map(plan => ({
    ...plan,
    createTimeFormatted: formatDate(new Date(plan.createTime), 'YYYY 年 MM 月 DD 日 HH:mm'),
    totalCashFormatted: plan.totalCashFormatted || formatAmount(plan.totalCash)
  }))

  savedPlans.value = formattedPlans
  savedPlansCount.value = plans.length
  totalPlansCount.value = plans.length
}

// Load saved executes
const loadSavedExecutes = () => {
  const executes = storage.getSync('savedExecutes') || []

  const formattedExecutes = executes.map(exec => ({
    ...exec,
    createTimeFormatted: formatDate(new Date(exec.createTime), 'YYYY 年 MM 月 DD 日 HH:mm'),
    totalAllocatedFormatted: formatAmount(exec.totalAllocated)
  }))

  savedExecutes.value = formattedExecutes
  savedExecutesCount.value = executes.length
}

// View plan
const viewPlan = (index) => {
  storage.setSync('currentPlan', savedPlans.value[index])
  router.push('/detail')
}

// View execute
const viewExecute = (index) => {
  storage.setSync('executionPlan', savedExecutes.value[index])
  router.push('/execute')
}

// Go to index
const goToIndex = () => {
  router.push('/')
}

// Clear all data
const clearAllData = () => {
  showModal({
    title: '确认清除',
    content: '确定要清除所有保存的计划数据吗？此操作不可恢复。',
    confirmText: '清除',
    confirmColor: '#FF4D4F',
    success: (res) => {
      if (res.confirm) {
        try {
          storage.removeSync('savedPlans')
          storage.removeSync('lastInput')
          savedPlans.value = []
          savedPlansCount.value = 0
          totalPlansCount.value = 0
          showToast({ title: '已清除', icon: 'success' })
        } catch (e) {
          showToast({ title: '清除失败', icon: 'none' })
        }
      }
    }
  })
}

// Show about
const showAbout = () => {
  showModal({
    title: '关于财梯',
    content: '财梯 v1.0.0\n\n一款智能存款规划工具，帮助您实现季度滚动阶梯式资金安排，确保每个季度初资金准时到位，同时最大化利息收入。\n\n使用过程中遇到问题，请联系开发者。',
    showCancel: false,
    confirmText: '我知道了'
  })
}

// Lifecycle
onMounted(() => {
  loadSavedPlans()
  loadSavedExecutes()
})
</script>

<template>
  <div class="page-container">
    <div class="container">
      <!-- Profile Header -->
      <div class="profile-header">
        <div class="avatar-section">
          <div class="avatar">
            <span class="avatar-text">财</span>
          </div>
          <div class="user-info">
            <div class="username">财梯用户</div>
            <div class="user-desc">智能存款规划助手</div>
          </div>
        </div>
      </div>

      <!-- Stats Section -->
      <div class="stats-section">
        <div class="stat-card">
          <div class="stat-value">{{ savedPlansCount }}</div>
          <div class="stat-label">已保存计划</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ totalPlansCount }}</div>
          <div class="stat-label">历史规划次数</div>
        </div>
      </div>

      <!-- My Plans Section -->
      <div class="section">
        <div class="section-header">
          <div class="section-title">我的规划</div>
          <div v-if="hasPlans" class="section-count">{{ savedPlans.length }}个</div>
        </div>

        <!-- Plan List -->
        <div v-if="hasPlans" class="plan-list">
          <div
            v-for="(plan, index) in savedPlans"
            :key="plan.createTime"
            class="plan-card"
            @click="viewPlan(index)"
          >
            <div class="plan-info">
              <div class="plan-date">{{ plan.createTimeFormatted }}</div>
              <div class="plan-amount">总资产 ¥{{ plan.totalCashFormatted }}</div>
            </div>
            <div class="plan-arrow">
              <span class="arrow-icon">›</span>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="empty-state">
          <div class="empty-icon">📊</div>
          <div class="empty-text">暂无保存的计划</div>
          <div class="empty-desc">点击下方按钮开始您的存款规划</div>
          <button class="btn-primary empty-btn" @click="goToIndex">开始规划</button>
        </div>
      </div>

      <!-- My Executes Section -->
      <div class="section">
        <div class="section-header">
          <div class="section-title">我的执行</div>
          <div v-if="hasExecutes" class="section-count">{{ savedExecutes.length }}个</div>
        </div>

        <!-- Execute List -->
        <div v-if="hasExecutes" class="plan-list">
          <div
            v-for="(exec, index) in savedExecutes"
            :key="exec.createTime"
            class="plan-card"
            @click="viewExecute(index)"
          >
            <div class="plan-info">
              <div class="plan-date">{{ exec.createTimeFormatted }}</div>
              <div class="plan-amount">总资产 ¥{{ exec.totalAllocatedFormatted }}</div>
            </div>
            <div class="plan-arrow">
              <span class="arrow-icon">›</span>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="empty-state">
          <div class="empty-icon">📋</div>
          <div class="empty-text">暂无保存的执行</div>
          <div class="empty-desc">在执行页面保存您的执行计划</div>
        </div>
      </div>

      <!-- Function Section -->
      <div class="section function-section">
        <div class="section-title">其他功能</div>
        <div class="function-list">
          <div class="function-item" @click="clearAllData">
            <span class="function-icon">🗑️</span>
            <span class="function-text">清除所有数据</span>
            <span class="function-arrow">›</span>
          </div>
          <div class="function-item" @click="showAbout">
            <span class="function-icon">ℹ️</span>
            <span class="function-text">关于财梯</span>
            <span class="function-arrow">›</span>
          </div>
        </div>
      </div>

      <!-- Version Info -->
      <div class="version-info">
        <span>财梯 v1.0.0</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-header {
  padding: 32px 24px;
  background: linear-gradient(135deg, #07C160 0%, #06AD56 100%);
  margin: -24px -24px 24px -24px;
}

.avatar-section {
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-text {
  font-size: 28px;
  font-weight: 700;
  color: #ffffff;
}

.user-info {
  color: #ffffff;
}

.username {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 4px;
}

.user-desc {
  font-size: 14px;
  opacity: 0.8;
}

.stats-section {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  flex: 1;
  background: var(--card-background);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  box-shadow: var(--shadow);
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--primary-color);
  font-family: 'DIN Alternate', 'Roboto Mono', monospace;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.section {
  background: var(--card-background);
  border-radius: 12px;
  padding: 20px 24px;
  margin-bottom: 16px;
  box-shadow: var(--shadow);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--secondary-color);
}

.section-count {
  font-size: 13px;
  color: var(--text-secondary);
}

.plan-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.plan-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background 0.2s;
}

.plan-card:last-child {
  border-bottom: none;
}

.plan-card:hover {
  background: var(--background-color);
}

.plan-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.plan-date {
  font-size: 14px;
  color: var(--text-primary);
}

.plan-amount {
  font-size: 13px;
  color: var(--text-secondary);
}

.plan-arrow {
  display: flex;
  align-items: center;
}

.arrow-icon {
  font-size: 20px;
  color: var(--text-tertiary);
}

.empty-state {
  padding: 48px 24px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 16px;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.empty-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 20px;
}

.empty-btn {
  width: auto;
  display: inline-block;
  padding: 12px 32px;
}

.function-section {
  padding: 0;
}

.function-section .section-title {
  padding: 16px 24px 8px;
  display: block;
}

.function-list {
  display: flex;
  flex-direction: column;
}

.function-item {
  display: flex;
  align-items: center;
  padding: 14px 24px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background 0.2s;
}

.function-item:last-child {
  border-bottom: none;
}

.function-item:hover {
  background: var(--background-color);
}

.function-icon {
  font-size: 20px;
  margin-right: 12px;
}

.function-text {
  flex: 1;
  font-size: 14px;
  color: var(--text-primary);
}

.function-arrow {
  font-size: 20px;
  color: var(--text-tertiary);
}

.version-info {
  text-align: center;
  padding: 24px;
  font-size: 13px;
  color: var(--text-tertiary);
}
</style>
