<script setup>
import { ref, computed, onMounted } from 'vue'
import { formatAmount, formatDate } from '../utils/format'
import { storage as localStorage } from '../utils/storage'
import { showToast } from '../utils/toast'
import { useRouter } from 'vue-router'

const router = useRouter()

// State
const groupedMaturities = ref([])
const maturityHistory = ref([])
const currentDeposits = ref([])
const totalDepositAmount = ref('0')
const totalProjectedInterest = ref(0)
const planningHorizon = ref(1)
const totalActualInterest = ref(0)
const completedCount = ref(0)
const totalCount = ref(0)
const hasPlan = ref(false)
const demandDepositBalance = ref('0')
const activeTab = ref('upcoming') // 'upcoming' | 'history' | 'allocation'
const expandedGroups = ref(new Set())

// Withdrawal modal state
const showWithdrawalModal = ref(false)
const withdrawalAmount = ref('')
const selectedDepositIndex = ref(-1)
const withdrawableDeposits = ref([])

// Completion modal
const showCompletionModal = ref(false)
const selectedMaturity = ref(null)
const actualInterestInput = ref('')

// Computed
const progressPercent = computed(() => {
  if (totalCount.value === 0) return 0
  return Math.round((completedCount.value / totalCount.value) * 100)
})

const nextMaturity = computed(() => {
  for (const group of groupedMaturities.value) {
    const upcoming = group.items.find(m => !m.isCompleted)
    if (upcoming) return upcoming
  }
  return null
})

const daysUntilNext = computed(() => {
  if (!nextMaturity.value) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maturityDate = parseDate(nextMaturity.value.date)
  const diffTime = maturityDate - today
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
})

// Parse date safely
const parseDate = (dateStr) => {
  if (!dateStr) return new Date(0)
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
  }
  return new Date(dateStr)
}

// Toggle group expansion
const toggleGroup = (groupKey) => {
  if (expandedGroups.value.has(groupKey)) {
    expandedGroups.value.delete(groupKey)
  } else {
    expandedGroups.value.add(groupKey)
  }
}

// Check if group is expanded
const isExpanded = (groupKey) => expandedGroups.value.has(groupKey)

// Load execution plan
const loadExecutionPlan = () => {
  const planData = localStorage.getSync('executionPlan')

  if (!planData || !planData.executionList || planData.executionList.length === 0) {
    hasPlan.value = false
    currentDeposits.value = []
    groupedMaturities.value = []
    maturityHistory.value = []
    totalDepositAmount.value = '0'
    return
  }

  planningHorizon.value = planData.planningHorizon || 1
  const executionList = planData.executionList || []

  // Group maturities by year+quarter
  const groups = new Map()
  const history = []
  let totalInterest = 0
  let completed = 0
  let totalProjected = 0

  executionList.forEach((item) => {
    if (item.year === 0 && !item.maturityDate) return

    const maturity = {
      id: `${item.year}-${item.quarter || 0}-${item.depositType || 'unknown'}-${Math.random().toString(36).substr(2, 9)}`,
      year: item.year,
      quarter: item.quarter || 0,
      date: item.maturityDate || item.date,
      dateDisplay: item.dateDisplay,
      depositType: item.depositType || '定期存款',
      amount: item.amount || 0,
      amountFormatted: formatAmount(item.amount || 0),
      projectedInterest: item.projectedInterest || 0,
      projectedInterestFormatted: formatAmount(item.projectedInterest || 0),
      actionDetails: item.actionDetails || '取出本息，按需分配',
      isCompleted: item.isCompleted || false,
      actualInterest: item.actualInterest || '',
      actualInterestFormatted: item.actualInterest ? formatAmount(item.actualInterest) : ''
    }

    if (maturity.isCompleted) {
      history.push(maturity)
      completed++
      if (item.actualInterest) totalInterest += parseFloat(item.actualInterest)
    } else {
      const groupKey = `Year ${maturity.year} - Q${maturity.quarter}`
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          key: groupKey,
          year: maturity.year,
          quarter: maturity.quarter,
          date: maturity.date,
          items: [],
          totalPrincipal: 0,
          totalInterest: 0
        })
      }
      const group = groups.get(groupKey)
      group.items.push(maturity)
      group.totalPrincipal += maturity.amount
      group.totalInterest += (maturity.projectedInterest || 0)
      totalProjected += (maturity.projectedInterest || 0)
    }
  })

  // Convert groups to array and sort by date
  const groupsArray = Array.from(groups.values())
  groupsArray.sort((a, b) => {
    const dateA = parseDate(a.date)
    const dateB = parseDate(b.date)
    return dateA - dateB
  })

  // Sort items within each group
  groupsArray.forEach(group => {
    group.items.sort((a, b) => parseDate(a.date) - parseDate(b.date))
    group.totalPrincipalFormatted = formatAmount(group.totalPrincipal)
    group.totalInterestFormatted = formatAmount(group.totalInterest)
  })

  groupedMaturities.value = groupsArray
  totalProjectedInterest.value = totalProjected

  history.sort((a, b) => parseDate(b.date) - parseDate(a.date))
  maturityHistory.value = history

  // Process current deposits - use remainingBalance if available
  let allocation = planData.allocation || []
  console.log('=== LOAD EXECUTION PLAN ===')
  console.log('Raw allocation from storage:', allocation.map(d => ({ type: d.type, amount: d.amount, remainingBalance: d.remainingBalance })))

  // Deduplicate: merge deposits with same type
  // Use the first occurrence's values, sum amounts for duplicates
  const typeMap = new Map()
  allocation.forEach(dep => {
    if (typeMap.has(dep.type)) {
      // Merge with existing - but DON'T use Math.max for remainingBalance
      // remainingBalance should reflect the actual current state
      const existing = typeMap.get(dep.type)
      // Sum the amounts for display purposes
      existing.amount = (existing.amount || 0) + (dep.amount || 0)
      // Use the actual remainingBalance from saved data (not max)
      if (dep.remainingBalance !== undefined) {
        existing.remainingBalance = (existing.remainingBalance || 0) + dep.remainingBalance
      }
    } else {
      // Add new - use remainingBalance if available, otherwise amount
      typeMap.set(dep.type, {
        ...dep,
        remainingBalance: dep.remainingBalance !== undefined ? dep.remainingBalance : dep.amount
      })
    }
  })

  // Convert back to array in standard order
  const standardTypes = ['活期存款', '3个月定期', '6个月定期', '1年定期', '3年定期', '5年定期']
  allocation = standardTypes
    .map(type => typeMap.get(type))
    .filter(Boolean)

  currentDeposits.value = allocation.map(dep => ({
    ...dep,
    amountFormatted: formatAmount(dep.amount),
    remainingBalanceFormatted: formatAmount(dep.remainingBalance !== undefined ? dep.remainingBalance : dep.amount),
    typeClass: getTypeClass(dep.type)
  }))

  // Calculate total from remaining balances
  const total = currentDeposits.value.reduce((sum, dep) => sum + (dep.remainingBalance !== undefined ? dep.remainingBalance : dep.amount), 0)
  totalDepositAmount.value = formatAmount(total)

  completedCount.value = completed
  totalCount.value = completed + groupsArray.reduce((sum, g) => sum + g.items.length, 0)
  totalActualInterest.value = totalInterest

  // Load demand deposit balance from current deposits
  const currentDeposit = currentDeposits.value.find(d => d.type === '活期存款')
  demandDepositBalance.value = currentDeposit ? currentDeposit.remainingBalanceFormatted : '0'

  hasPlan.value = true

  // Auto-expand first group
  if (groupsArray.length > 0) {
    expandedGroups.value.add(groupsArray[0].key)
  }
}

// Map action description to actual deposit type
const mapAllocationType = (typeDesc) => {
  const mappings = {
    '活期存款': '活期存款',
    '转存3个月': '3个月定期',
    '转存6个月': '6个月定期',
    '转存1年': '1年定期',
    '转存3年': '3年定期',
    '转存5年': '5年定期',
    '3个月定期': '3个月定期',
    '6个月定期': '6个月定期',
    '1年定期': '1年定期',
    '3年定期': '3年定期',
    '5年定期': '5年定期'
  }
  // Check for direct match first
  if (mappings[typeDesc]) return mappings[typeDesc]
  // Check if contains keywords
  if (typeDesc.includes('活期')) return '活期存款'
  if (typeDesc.includes('3个月') || typeDesc.includes('3 个月')) return '3个月定期'
  if (typeDesc.includes('6个月') || typeDesc.includes('6 个月')) return '6个月定期'
  if (typeDesc.includes('1年') || typeDesc.includes('1 年')) return '1年定期'
  if (typeDesc.includes('3年') || typeDesc.includes('3 年')) return '3年定期'
  if (typeDesc.includes('5年') || typeDesc.includes('5 年')) return '5年定期'
  // Expenses (支出) should be skipped - they don't go into deposits
  if (typeDesc.includes('支出')) return null
  return typeDesc // Return as-is if no mapping found
}

// Parse allocation from actionDetails
const parseAllocation = (actionDetails) => {
  if (!actionDetails) return []

  console.log('=== PARSING ALLOCATION ===')
  console.log('actionDetails:', actionDetails)

  const allocations = []
  const lines = actionDetails.split('\n')
  let inAllocationSection = false

  for (const line of lines) {
    // Check if we're entering the allocation section
    if (line.includes('【资金分配】') || line.includes('【资金用途】')) {
      inAllocationSection = true
      console.log('Found allocation section start:', line)
      continue
    }

    // Skip if not in allocation section
    if (!inAllocationSection) continue

    // Parse allocation lines like: • 活期存款: ¥XX,XXX or • 活期存款(说明): ¥XX,XXX
    const match = line.match(/•\s*([^:]+?):\s*¥([\d,]+(?:\.\d{2})?)/)
    if (match) {
      const fullType = match[1].trim()
      // Extract just the deposit type (before any parentheses)
      const typeRaw = fullType.split('(')[0].trim()
      // Check if this is an expense - treat as 活期存款
      const isExpense = typeRaw.includes('支出') || typeRaw === '支出'
      // Map to actual deposit type (expenses go to 活期存款)
      const mappedType = isExpense ? '活期存款' : mapAllocationType(typeRaw)

      const parsed = {
        type: mappedType,
        displayType: fullType, // Keep original for display
        amount: match[2].trim(),
        note: fullType.includes('(') ? fullType.match(/\(([^)]+)\)/)?.[1] || '' : '',
        icon: getAllocationIcon(mappedType),
        isExpense: false // No longer treating as expense - goes to 活期存款
      }
      allocations.push(parsed)
      console.log('Parsed line:', line, '->', parsed)
    }
  }

  // Merge items with same type (e.g., multiple 活期存款 entries)
  const mergedAllocations = []
  const typeMap = new Map()

  for (const alloc of allocations) {
    if (typeMap.has(alloc.type)) {
      // Merge amounts
      const existing = typeMap.get(alloc.type)
      const existingAmount = parseFloat(existing.amount.replace(/,/g, ''))
      const newAmount = parseFloat(alloc.amount.replace(/,/g, ''))
      const totalAmount = existingAmount + newAmount

      existing.amount = totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      // Merge notes
      if (alloc.note && !existing.note.includes(alloc.note)) {
        existing.note = existing.note ? `${existing.note} + ${alloc.note}` : alloc.note
      }
      existing.displayType = `${alloc.type}(${existing.note || '合并'})`
    } else {
      typeMap.set(alloc.type, { ...alloc })
      mergedAllocations.push(typeMap.get(alloc.type))
    }
  }

  console.log('Final allocations (merged):', mergedAllocations)
  return mergedAllocations
}

// Get icon for allocation type
const getAllocationIcon = (type) => {
  if (type.includes('活期')) return '💵'
  if (type.includes('3个月') || type.includes('3 个月')) return '📅'
  if (type.includes('6个月') || type.includes('6 个月')) return '📆'
  if (type.includes('1年') || type.includes('1 年')) return '💎'
  if (type.includes('3年') || type.includes('3 年')) return '🏦'
  if (type.includes('5年') || type.includes('5 年')) return '🔒'
  return '💰'
}
const getTypeClass = (type) => {
  if (type === '活期存款') return 'type-current'
  if (type?.includes('1年') || type?.includes('3年') || type?.includes('5年')) return 'type-long'
  return 'type-short'
}

// Check if date is in this quarter
const isThisQuarter = (dateStr) => {
  const date = parseDate(dateStr)
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const currentQuarter = Math.floor(currentMonth / 3)

  const dateYear = date.getFullYear()
  const dateMonth = date.getMonth()
  const dateQuarter = Math.floor(dateMonth / 3)

  return dateYear === currentYear && dateQuarter === currentQuarter
}

// Check if date is overdue
const isOverdue = (dateStr) => {
  const date = parseDate(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)
  return date < today
}

// Get urgency level for group
const getGroupUrgency = (group) => {
  if (group.items.some(item => isOverdue(item.date))) return 'overdue'
  if (group.items.some(item => isThisQuarter(item.date))) return 'urgent'
  return 'normal'
}

// Save actual interest
const saveActualInterest = (maturity) => {
  const planData = localStorage.getSync('executionPlan')
  if (!planData) return

  const execItem = planData.executionList.find(e =>
    e.year === maturity.year && e.quarter === maturity.quarter && e.depositType === maturity.depositType
  )

  if (execItem) {
    execItem.actualInterest = maturity.actualInterest
    localStorage.setSync('executionPlan', planData)
  }
}

// Mark complete and update allocation
const markComplete = (maturity) => {
  selectedMaturity.value = maturity
  actualInterestInput.value = maturity.actualInterest || ''
  showCompletionModal.value = true
}

// Apply allocation updates to current deposits
const applyAllocationUpdate = (maturity, actualInterest) => {
  console.log('=== ALLOCATION UPDATE ===')
  console.log('Maturity:', maturity.depositType, 'Amount:', maturity.amount)
  console.log('actionDetails:', maturity.actionDetails)

  const planData = localStorage.getSync('executionPlan')
  if (!planData || !planData.allocation) {
    console.log('No plan data found')
    return
  }

  const allocation = planData.allocation
  const allocations = parseAllocation(maturity.actionDetails)
  console.log('Parsed allocations:', allocations)
  console.log('Current allocation BEFORE update:', JSON.stringify(allocation.map(d => ({ type: d.type, amount: d.amount, remainingBalance: d.remainingBalance }))))

  // 1. Subtract matured amount from source deposit
  console.log('Looking for source deposit with type:', maturity.depositType)
  console.log('Available deposit types:', allocation.map(d => d.type))
  const sourceDeposit = allocation.find(d => d.type === maturity.depositType)
  if (sourceDeposit) {
    const maturedAmount = parseFloat(maturity.amount)
    const oldBalance = sourceDeposit.remainingBalance !== undefined ? sourceDeposit.remainingBalance : sourceDeposit.amount
    console.log(`Found source: ${maturity.depositType}, oldBalance: ${oldBalance}, maturedAmount: ${maturedAmount}`)
    sourceDeposit.remainingBalance = oldBalance - maturedAmount
    if (sourceDeposit.remainingBalance < 0) sourceDeposit.remainingBalance = 0
    console.log(`Source ${maturity.depositType} UPDATED: remainingBalance now = ${sourceDeposit.remainingBalance}`)
  } else {
    console.log('WARNING: Source deposit not found:', maturity.depositType)
    console.log('Trying to find partial match...')
    // Try to find by partial match
    const partialMatch = allocation.find(d => d.type.includes('3个月') && maturity.depositType.includes('3个月'))
    if (partialMatch) {
      console.log('Found partial match:', partialMatch.type)
    }
  }

  // 2. Add allocated amounts to target deposits
  // If no allocations parsed (e.g., "全部转入活期账户"), default to adding to 活期存款
  if (allocations.length === 0) {
    console.log('No allocations parsed - defaulting to 活期存款')
    const totalAmount = parseFloat(maturity.amount) + parseFloat(actualInterest || 0)
    const currentDeposit = allocation.find(d => d.type === '活期存款')
    if (currentDeposit) {
      const oldBalance = currentDeposit.remainingBalance !== undefined ? currentDeposit.remainingBalance : currentDeposit.amount
      currentDeposit.remainingBalance = oldBalance + totalAmount
      console.log(`Default to 活期存款: ${oldBalance} -> ${currentDeposit.remainingBalance} (added ${totalAmount})`)
    }
  } else {
    // Process parsed allocations (expenses are now merged into 活期存款)
    allocations.forEach(alloc => {
      const amount = parseFloat(alloc.amount.replace(/,/g, ''))
      // Skip if type is null
      if (!alloc.type) {
        console.log('Skipping allocation with no type:', alloc.displayType || 'unknown')
        return
      }
      const targetDeposit = allocation.find(d => d.type === alloc.type)
      if (targetDeposit) {
        // CRITICAL FIX: Use !== undefined check, not || operator (0 is falsy!)
        const oldBalance = targetDeposit.remainingBalance !== undefined ? targetDeposit.remainingBalance : targetDeposit.amount
        targetDeposit.remainingBalance = oldBalance + amount
        console.log(`Target ${alloc.type}: ${oldBalance} -> ${targetDeposit.remainingBalance} (added ${amount})`)
      } else {
        console.log('WARNING: Target deposit not found for mapped type:', alloc.type, '(original:', alloc.displayType + ')')
      }
    })
  }

  // 3. Add actual interest to 活期存款 (in addition to any interest already included)
  if (actualInterest && !allocations.some(a => a.type === '活期存款' && a.note?.includes('利息'))) {
    const interestAmount = parseFloat(actualInterest)
    const currentDeposit = allocation.find(d => d.type === '活期存款')
    if (currentDeposit) {
      const oldBalance = currentDeposit.remainingBalance !== undefined ? currentDeposit.remainingBalance : currentDeposit.amount
      currentDeposit.remainingBalance = oldBalance + interestAmount
      console.log(`Interest to 活期: ${oldBalance} -> ${currentDeposit.remainingBalance} (added ${interestAmount})`)
    }
  }

  console.log('Allocation AFTER all updates:', JSON.stringify(allocation.map(d => ({ type: d.type, amount: d.amount, remainingBalance: d.remainingBalance }))))

  // 4. Save and refresh
  localStorage.setSync('executionPlan', planData)
  console.log('=== SAVED TO LOCALSTORAGE ===')
  const verifyData = localStorage.getSync('executionPlan')
  console.log('Verification - allocation after save:', verifyData.allocation.map(d => ({ type: d.type, remainingBalance: d.remainingBalance || d.amount })))
  showToast({ title: '资金分配已更新', icon: 'success' })
}

// Confirm completion with allocation update
const confirmCompletion = () => {
  if (!selectedMaturity.value) return

  const planData = localStorage.getSync('executionPlan')
  if (!planData) return

  // Find and update the execution item
  const execItem = planData.executionList.find(e =>
    e.year === selectedMaturity.value.year &&
    e.quarter === selectedMaturity.value.quarter &&
    e.depositType === selectedMaturity.value.depositType
  )

  if (execItem) {
    execItem.isCompleted = true
    execItem.actualInterest = actualInterestInput.value
    localStorage.setSync('executionPlan', planData)

    // Apply allocation update to left panel
    applyAllocationUpdate(selectedMaturity.value, actualInterestInput.value)

    // Reload to refresh the display
    loadExecutionPlan()
    showToast({ title: '已标记完成，资金分配已更新', icon: 'success' })
  }

  showCompletionModal.value = false
}

// Go to generate
const goToGenerate = () => {
  router.push('/')
}

// Withdrawal modal
const openWithdrawalModal = () => {
  const planData = localStorage.getSync('executionPlan')
  if (!planData || !planData.allocation) {
    showToast({ title: '没有可支取的存款', icon: 'none' })
    return
  }

  const longTermTypes = ['1 年定期', '3 年定期', '5 年定期']
  withdrawableDeposits.value = planData.allocation
    .filter(d => longTermTypes.includes(d.type) && (d.remainingBalance || d.amount) > 0)
    .map(d => ({
      ...d,
      remainingBalanceFormatted: formatAmount(d.remainingBalance || d.amount)
    }))

  if (withdrawableDeposits.value.length === 0) {
    showToast({ title: '没有可提前支取的存款', icon: 'none' })
    return
  }

  selectedDepositIndex.value = 0
  withdrawalAmount.value = ''
  showWithdrawalModal.value = true
}

const closeWithdrawalModal = () => {
  showWithdrawalModal.value = false
}

const confirmWithdrawal = () => {
  const amount = parseFloat(withdrawalAmount.value)
  if (!amount || amount <= 0) {
    showToast({ title: '请输入有效的支取金额', icon: 'none' })
    return
  }

  const deposit = withdrawableDeposits.value[selectedDepositIndex.value]
  if (!deposit) return

  const maxWithdrawal = deposit.remainingBalance || deposit.amount
  if (amount > maxWithdrawal) {
    showToast({ title: '支取金额不能超过余额', icon: 'none' })
    return
  }

  const planData = localStorage.getSync('executionPlan')
  if (!planData) return

  const depositIndex = planData.allocation.findIndex(d => d.type === deposit.type)
  if (depositIndex === -1) return

  const d = planData.allocation[depositIndex]
  d.remainingBalance = (d.remainingBalance || d.amount) - amount
  d.withdrawnAmount = (d.withdrawnAmount || 0) + amount
  d.withdrawalHistory = d.withdrawalHistory || []
  d.withdrawalHistory.push({
    date: new Date().toISOString().split('T')[0],
    amount: amount,
    timestamp: Date.now()
  })

  localStorage.setSync('executionPlan', planData)
  showToast({ title: '支取成功', icon: 'success' })
  loadExecutionPlan()
  closeWithdrawalModal()
}

// Input handlers
const onDemandDepositBalanceInput = (e) => {
  demandDepositBalance.value = e.target.value
}

const updateDemandDepositBalance = () => {
  const planData = localStorage.getSync('executionPlan')
  if (!planData || !planData.allocation) return

  const currentDeposit = planData.allocation.find(d => d.type === '活期存款')
  if (currentDeposit) {
    const newBalance = parseFloat(demandDepositBalance.value.replace(/,/g, '')) || 0
    currentDeposit.remainingBalance = newBalance
    localStorage.setSync('executionPlan', planData)
    loadExecutionPlan()
    showToast({ title: '已更新活期余额', icon: 'success' })
  }
}

// Get deposit icon
const getDepositIcon = (type) => {
  if (type === '活期存款') return '💵'
  if (type?.includes('3个月') || type?.includes('3 个月')) return '📅'
  if (type?.includes('6个月') || type?.includes('6 个月')) return '📆'
  if (type?.includes('1年') || type?.includes('1 年')) return '💎'
  if (type?.includes('3年') || type?.includes('3 年')) return '🏦'
  if (type?.includes('5年') || type?.includes('5 年')) return '🔒'
  return '💰'
}

// Lifecycle
onMounted(() => {
  loadExecutionPlan()
})
</script>

<template>
  <div class="page-container">
    <!-- No Plan State -->
    <div v-if="!hasPlan" class="no-plan-container">
      <div class="no-plan-card">
        <div class="no-plan-icon">📋</div>
        <div class="no-plan-text">暂无执行计划</div>
        <div class="no-plan-desc">请先在首页生成存款规划，然后将计划发送到执行</div>
        <button class="btn-primary btn-large" @click="goToGenerate">去生成计划</button>
      </div>
    </div>

    <!-- Plan Content -->
    <div v-if="hasPlan" class="execute-layout">
      <!-- Left: Fund Allocation (Centerpiece) -->
      <div class="allocation-panel">
        <div class="panel-header">
          <h2 class="panel-title">💰 资金分配</h2>
          <span class="panel-subtitle">总资产 ¥{{ totalDepositAmount }}</span>
        </div>

        <!-- Allocation List - Line by Line -->
        <div class="allocation-list">
          <div
            v-for="deposit in currentDeposits"
            :key="deposit.type"
            class="allocation-item"
            :class="[deposit.typeClass]"
          >
            <div class="allocation-main">
              <div class="allocation-icon">{{ getDepositIcon(deposit.type) }}</div>
              <div class="allocation-info">
                <div class="allocation-name">{{ deposit.type }}</div>
                <div class="allocation-rate">年利率 {{ deposit.rate }}%</div>
              </div>
              <div class="allocation-amount">
                <div class="current-balance">¥{{ deposit.remainingBalanceFormatted }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Demand Deposit Card -->
        <div class="demand-card-large">
          <div class="demand-header-large">
            <span class="demand-icon-large">💵</span>
            <span class="demand-title">活期存款</span>
            <span class="demand-rate">0.10%</span>
          </div>
          <div class="demand-balance-row">
            <span class="demand-label">当前余额</span>
            <div class="demand-input-group">
              <span class="currency">¥</span>
              <input
                type="text"
                v-model="demandDepositBalance"
                @blur="updateDemandDepositBalance"
                class="demand-input"
              />
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="quick-actions">
          <button class="action-btn withdraw" @click="openWithdrawalModal">
            <span>⬇️</span> 提前支取
          </button>
        </div>
      </div>

      <!-- Right: Main Content -->
      <div class="main-content">
        <!-- Progress Header -->
        <div class="progress-header">
          <div class="progress-stats">
            <div class="progress-item">
              <span class="progress-value">{{ progressPercent }}%</span>
              <span class="progress-label">完成度</span>
            </div>
            <div class="progress-item">
              <span class="progress-value">{{ completedCount }}/{{ totalCount }}</span>
              <span class="progress-label">已完成</span>
            </div>
            <div class="progress-item">
              <span class="progress-value">¥{{ formatAmount(totalActualInterest) }}</span>
              <span class="progress-label">实际利息</span>
            </div>
            <div class="progress-item highlight">
              <span class="progress-value">¥{{ formatAmount(totalProjectedInterest) }}</span>
              <span class="progress-label">预期总利息</span>
            </div>
          </div>

          <!-- Next Maturity Alert -->
          <div v-if="nextMaturity" class="next-alert" :class="{ urgent: daysUntilNext <= 7 }">
            <div class="next-alert-icon">🔔</div>
            <div class="next-alert-content">
              <div class="next-alert-title">
                下一笔到期: {{ nextMaturity.dateDisplay }}
                <span v-if="daysUntilNext <= 0" class="days-tag today">今天</span>
                <span v-else-if="daysUntilNext <= 7" class="days-tag urgent">{{ daysUntilNext }}天后</span>
              </div>
              <div class="next-alert-detail">
                {{ nextMaturity.depositType }} · ¥{{ nextMaturity.amountFormatted }}
              </div>
            </div>
            <button class="btn-complete-mini" @click="markComplete(nextMaturity)">
              完成
            </button>
          </div>
        </div>

        <!-- Tab Navigation -->
        <div class="tab-nav">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'upcoming' }"
            @click="activeTab = 'upcoming'"
          >
            待处理到期
            <span class="tab-badge">{{ groupedMaturities.reduce((sum, g) => sum + g.items.length, 0) }}</span>
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'history' }"
            @click="activeTab = 'history'"
          >
            历史记录
            <span class="tab-badge">{{ maturityHistory.length }}</span>
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'allocation' }"
            @click="activeTab = 'allocation'"
          >
            资金明细
          </button>
        </div>

        <!-- Upcoming Maturities - Grouped with Expand/Collapse -->
        <div v-if="activeTab === 'upcoming'" class="maturity-content">
          <div v-if="groupedMaturities.length === 0" class="empty-state">
            <div class="empty-icon">🎉</div>
            <div class="empty-text">暂无待处理到期</div>
            <div class="empty-desc">所有存款已处理完毕</div>
          </div>

          <div v-else class="maturity-groups">
            <div
              v-for="group in groupedMaturities"
              :key="group.key"
              class="maturity-group"
              :class="[getGroupUrgency(group)]"
            >
              <!-- Group Header (Always Visible) -->
              <div class="group-header" @click="toggleGroup(group.key)">
                <div class="group-left">
                  <div class="group-icon">
                    {{ isExpanded(group.key) ? '▼' : '▶' }}
                  </div>
                  <div class="group-title">
                    <span class="group-name">{{ group.key }}</span>
                    <span v-if="getGroupUrgency(group) === 'overdue'" class="group-tag overdue">已逾期</span>
                    <span v-else-if="getGroupUrgency(group) === 'urgent'" class="group-tag urgent">本季度</span>
                  </div>
                </div>
                <div class="group-summary">
                  <div class="group-count">{{ group.items.length }}笔</div>
                  <div class="group-amount">¥{{ group.totalPrincipalFormatted }}</div>
                </div>
              </div>

              <!-- Group Content (Expandable) -->
              <div v-show="isExpanded(group.key)" class="group-content">
                <div
                  v-for="(maturity, idx) in group.items"
                  :key="maturity.id"
                  class="maturity-item"
                  :class="{ overdue: isOverdue(maturity.date), urgent: isThisQuarter(maturity.date) && !isOverdue(maturity.date) }"
                >
                  <!-- Main Row -->
                  <div class="maturity-main-row">
                    <div class="line-number">{{ idx + 1 }}</div>
                    <div class="line-date">{{ maturity.dateDisplay }}</div>
                    <div class="line-type" :class="getTypeClass(maturity.depositType)">
                      {{ maturity.depositType }}
                    </div>
                    <div class="line-principal">¥{{ maturity.amountFormatted }}</div>
                    <div class="line-interest">
                      <span class="projected">预期 ¥{{ maturity.projectedInterestFormatted }}</span>
                    </div>
                    <div class="line-actual">
                      <div class="actual-input-wrap">
                        <span class="prefix">¥</span>
                        <input
                          type="text"
                          v-model="maturity.actualInterest"
                          placeholder="实际利息"
                          @blur="saveActualInterest(maturity)"
                        />
                      </div>
                    </div>
                    <button class="btn-complete-line" @click="markComplete(maturity)">
                      完成
                    </button>
                  </div>

                  <!-- Allocation Section - New Fund Allocation -->
                  <div class="maturity-allocation">
                    <div class="allocation-header">
                      <span class="allocation-title">📋 到期资金分配</span>
                      <span class="allocation-total">合计: ¥{{ formatAmount(parseFloat(maturity.amount) + parseFloat(maturity.projectedInterest)) }}</span>
                    </div>
                    <div class="allocation-list">
                      <div
                        v-for="(alloc, allocIdx) in parseAllocation(maturity.actionDetails)"
                        :key="allocIdx"
                        class="allocation-line"
                      >
                        <span class="alloc-icon">{{ alloc.icon }}</span>
                        <span class="alloc-type">{{ alloc.type }}</span>
                        <span class="alloc-amount">¥{{ alloc.amount }}</span>
                        <span v-if="alloc.note" class="alloc-note">({{ alloc.note }})</span>
                      </div>
                      <div v-if="parseAllocation(maturity.actionDetails).length === 0" class="allocation-empty">
                        <span>💡 全部转入活期账户</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Group Footer -->
                <div class="group-footer">
                  <span class="group-total-label">本组合计:</span>
                  <span class="group-total-principal">本金 ¥{{ group.totalPrincipalFormatted }}</span>
                  <span class="group-total-interest">预期利息 ¥{{ group.totalInterestFormatted }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- History -->
        <div v-if="activeTab === 'history'" class="maturity-content">
          <div v-if="maturityHistory.length === 0" class="empty-state">
            <div class="empty-icon">📋</div>
            <div class="empty-text">暂无历史记录</div>
          </div>

          <div v-else class="history-list">
            <div
              v-for="(item, index) in maturityHistory"
              :key="item.id"
              class="history-line"
            >
              <div class="line-number completed">{{ index + 1 }}</div>
              <div class="line-date">{{ item.dateDisplay }}</div>
              <div class="line-type" :class="getTypeClass(item.depositType)">
                {{ item.depositType }}
              </div>
              <div class="line-principal">¥{{ item.amountFormatted }}</div>
              <div v-if="item.actualInterestFormatted" class="line-actual-completed">
                实际利息 ¥{{ item.actualInterestFormatted }}
              </div>
              <div class="completed-badge">✓ 已完成</div>
            </div>
          </div>
        </div>

        <!-- Allocation Detail -->
        <div v-if="activeTab === 'allocation'" class="allocation-detail">
          <div class="detail-grid">
            <div
              v-for="deposit in currentDeposits"
              :key="deposit.type"
              class="detail-card"
              :class="[deposit.typeClass]"
            >
              <div class="detail-header">
                <span class="detail-icon">{{ getDepositIcon(deposit.type) }}</span>
                <span class="detail-type">{{ deposit.type }}</span>
              </div>
              <div class="detail-body">
                <div class="detail-amount">¥{{ deposit.remainingBalanceFormatted }}</div>
                <div class="detail-rate">年利率 {{ deposit.rate }}%</div>
                <div class="detail-original">原始本金: ¥{{ deposit.amountFormatted }}</div>
                <div v-if="deposit.withdrawnAmount" class="detail-withdrawn">
                  已提取: ¥{{ formatAmount(deposit.withdrawnAmount) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Completion Modal -->
    <div v-if="showCompletionModal" class="modal-overlay" @click="showCompletionModal = false">
      <div class="modal-content completion-modal" @click.stop>
        <div class="modal-header">
          <h3>处理到期存款</h3>
          <button class="close-btn" @click="showCompletionModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="completion-summary" v-if="selectedMaturity">
            <div class="summary-row">
              <span>存款类型</span>
              <span class="value">{{ selectedMaturity.depositType }}</span>
            </div>
            <div class="summary-row">
              <span>本金</span>
              <span class="value">¥{{ selectedMaturity.amountFormatted }}</span>
            </div>
            <div class="summary-row">
              <span>到期日期</span>
              <span class="value">{{ selectedMaturity.dateDisplay }}</span>
            </div>
            <div class="summary-row expected">
              <span>预期利息</span>
              <span class="value">¥{{ selectedMaturity.projectedInterestFormatted || '-' }}</span>
            </div>
          </div>

          <div class="interest-input-section">
            <label>实际获得利息</label>
            <div class="input-with-prefix">
              <span class="prefix">¥</span>
              <input
                type="text"
                v-model="actualInterestInput"
                placeholder="输入实际金额"
              />
            </div>
            <p class="input-hint">输入银行实际支付的利息金额（将转入活期存款）</p>
          </div>

          <!-- Allocation Preview -->
          <div class="allocation-preview" v-if="selectedMaturity">
            <div class="preview-header">
              <label>资金分配预览</label>
              <span class="preview-total">合计: ¥{{ formatAmount(parseFloat(selectedMaturity.amount) + parseFloat(actualInterestInput || 0)) }}</span>
            </div>
            <div class="preview-list">
              <div class="preview-item source">
                <span class="preview-icon">➖</span>
                <span class="preview-type">{{ selectedMaturity.depositType }}（到期支出）</span>
                <span class="preview-amount negative">-¥{{ selectedMaturity.amountFormatted }}</span>
              </div>
              <div
                v-for="(alloc, idx) in parseAllocation(selectedMaturity.actionDetails)"
                :key="idx"
                class="preview-item"
              >
                <span class="preview-icon">{{ alloc.icon }}</span>
                <span class="preview-type">{{ alloc.type }}</span>
                <span class="preview-amount positive">+¥{{ alloc.amount }}</span>
              </div>
              <div v-if="actualInterestInput" class="preview-item interest">
                <span class="preview-icon">💵</span>
                <span class="preview-type">活期存款（利息）</span>
                <span class="preview-amount positive">+¥{{ formatAmount(parseFloat(actualInterestInput)) }}</span>
              </div>
            </div>
            <p class="preview-note">点击"确认完成"后将按上述分配更新资金面板</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="showCompletionModal = false">取消</button>
          <button class="btn-primary" @click="confirmCompletion">确认完成</button>
        </div>
      </div>
    </div>

    <!-- Withdrawal Modal -->
    <div v-if="showWithdrawalModal" class="modal-overlay" @click="closeWithdrawalModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>提前支取</h3>
          <button class="close-btn" @click="closeWithdrawalModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>选择存款</label>
            <div class="deposit-options">
              <div
                v-for="(deposit, index) in withdrawableDeposits"
                :key="index"
                class="deposit-option"
                :class="{ selected: selectedDepositIndex === index }"
                @click="selectedDepositIndex = index"
              >
                <div class="option-radio">
                  <input type="radio" :checked="selectedDepositIndex === index" />
                </div>
                <div class="option-info">
                  <div class="option-type">{{ deposit.type }}</div>
                  <div class="option-balance">余额: ¥{{ deposit.remainingBalanceFormatted }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label>支取金额</label>
            <div class="input-with-prefix">
              <span class="prefix">¥</span>
              <input type="text" v-model="withdrawalAmount" placeholder="输入金额" />
            </div>
          </div>

          <div class="warning-box">
            <span>⚠️</span>
            <p>提前支取将按活期利率计息，可能损失部分利息</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeWithdrawalModal">取消</button>
          <button class="btn-primary" @click="confirmWithdrawal">确认支取</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Layout */
.execute-layout {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 24px;
}

/* Allocation Panel (Left) - Sticky */
.allocation-panel {
  background: var(--card-background);
  border-radius: 16px;
  box-shadow: var(--shadow);
  overflow: hidden;
  position: sticky;
  top: 20px;
  height: fit-content;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
}

.panel-header {
  background: linear-gradient(135deg, var(--primary-color), #06ad56);
  color: white;
  padding: 20px;
}

.panel-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.panel-subtitle {
  font-size: 24px;
  font-weight: 700;
  font-family: 'DIN Alternate', monospace;
  opacity: 0.95;
}

/* Allocation List - Line by Line */
.allocation-list {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.allocation-item {
  background: var(--background-color);
  border-radius: 12px;
  padding: 16px;
  border-left: 4px solid var(--border-color);
  transition: all 0.2s;
}

.allocation-item:hover {
  transform: translateX(4px);
}

.allocation-item.type-current { border-left-color: var(--primary-color); }
.allocation-item.type-short { border-left-color: #FF9F43; }
.allocation-item.type-long { border-left-color: #5F27CD; }

.allocation-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.allocation-icon {
  font-size: 28px;
  width: 40px;
  text-align: center;
}

.allocation-info {
  flex: 1;
}

.allocation-name {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 4px;
}

.allocation-rate {
  font-size: 12px;
  color: var(--text-secondary);
}

.allocation-amount {
  text-align: right;
}

.current-balance {
  font-size: 18px;
  font-weight: 700;
  font-family: 'DIN Alternate', monospace;
  color: var(--text-primary);
}

.original-amount {
  font-size: 11px;
  color: var(--text-secondary);
}

.allocation-withdrawal {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--border-color);
  font-size: 12px;
  color: #ff4d4f;
}

/* Demand Card Large */
.demand-card-large {
  margin: 0 16px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 20px;
  color: white;
}

.demand-header-large {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.demand-icon-large {
  font-size: 24px;
}

.demand-title {
  font-size: 16px;
  font-weight: 600;
  flex: 1;
}

.demand-rate {
  font-size: 13px;
  padding: 4px 10px;
  background: rgba(255,255,255,0.2);
  border-radius: 12px;
}

.demand-balance-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.demand-label {
  font-size: 13px;
  opacity: 0.9;
}

.demand-input-group {
  display: flex;
  align-items: center;
  background: rgba(255,255,255,0.2);
  border-radius: 8px;
  padding: 8px 12px;
}

.currency {
  font-size: 16px;
  margin-right: 4px;
}

.demand-input {
  background: transparent;
  border: none;
  color: white;
  font-size: 18px;
  font-weight: 600;
  width: 120px;
  text-align: right;
  outline: none;
  font-family: 'DIN Alternate', monospace;
}

.demand-input::placeholder {
  color: rgba(255,255,255,0.6);
}

/* Quick Actions */
.quick-actions {
  padding: 0 16px 16px;
}

.action-btn.withdraw {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  background: #FF9F43;
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
}

/* Main Content (Right) */
.main-content {
  min-height: 0;
}

/* Progress Header */
.progress-header {
  background: var(--card-background);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: var(--shadow);
}

.progress-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.progress-item {
  text-align: center;
  padding: 12px;
  background: var(--background-color);
  border-radius: 10px;
}

.progress-item.highlight {
  background: #e6f7ed;
}

.progress-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--primary-color);
  font-family: 'DIN Alternate', monospace;
}

.progress-item.highlight .progress-value {
  color: var(--primary-color);
}

.progress-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

/* Next Alert */
.next-alert {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--background-color);
  border-radius: 10px;
  border-left: 4px solid var(--primary-color);
}

.next-alert.urgent {
  border-left-color: #ff4d4f;
  background: #fff5f5;
}

.next-alert-icon {
  font-size: 28px;
}

.next-alert-content {
  flex: 1;
}

.next-alert-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 4px;
}

.days-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  margin-left: 8px;
}

.days-tag.today {
  background: #ff4d4f;
  color: white;
}

.days-tag.urgent {
  background: #ff4d4f;
  color: white;
}

.next-alert-detail {
  font-size: 13px;
  color: var(--text-secondary);
}

.btn-complete-mini {
  padding: 8px 16px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

/* Tab Navigation */
.tab-nav {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.tab-btn {
  padding: 12px 20px;
  background: var(--card-background);
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: var(--shadow);
}

.tab-btn:hover {
  color: var(--text-primary);
}

.tab-btn.active {
  background: var(--primary-color);
  color: white;
}

.tab-badge {
  font-size: 11px;
  padding: 2px 8px;
  background: rgba(0,0,0,0.1);
  border-radius: 10px;
}

.tab-btn.active .tab-badge {
  background: rgba(255,255,255,0.3);
}

/* Maturity Content */
.maturity-content {
  background: var(--card-background);
  border-radius: 12px;
  box-shadow: var(--shadow);
  overflow: hidden;
}

.empty-state {
  text-align: center;
  padding: 60px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

.empty-desc {
  font-size: 14px;
  color: var(--text-secondary);
}

/* Maturity Groups */
.maturity-groups {
  display: flex;
  flex-direction: column;
}

.maturity-group {
  border-bottom: 1px solid var(--border-color);
}

.maturity-group:last-child {
  border-bottom: none;
}

.maturity-group.urgent {
  border-left: 4px solid #ff9f43;
}

.maturity-group.overdue {
  border-left: 4px solid #ff4d4f;
}

/* Group Header */
.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  cursor: pointer;
  transition: background 0.2s;
}

.group-header:hover {
  background: var(--background-color);
}

.group-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.group-icon {
  font-size: 12px;
  color: var(--text-secondary);
  width: 20px;
}

.group-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.group-name {
  font-size: 15px;
  font-weight: 600;
}

.group-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.group-tag.urgent {
  background: #ff9f43;
  color: white;
}

.group-tag.overdue {
  background: #ff4d4f;
  color: white;
}

.group-summary {
  display: flex;
  align-items: center;
  gap: 16px;
}

.group-count {
  font-size: 13px;
  color: var(--text-secondary);
  padding: 4px 10px;
  background: var(--background-color);
  border-radius: 12px;
}

.group-amount {
  font-size: 16px;
  font-weight: 600;
  font-family: 'DIN Alternate', monospace;
  color: var(--primary-color);
}

/* Group Content */
.group-content {
  background: var(--background-color);
  padding: 0 20px 16px;
}

/* Maturity Item */
.maturity-item {
  background: white;
  border-radius: 10px;
  margin-bottom: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  overflow: hidden;
}

.maturity-item.urgent {
  border-left: 3px solid #ff9f43;
}

.maturity-item.overdue {
  border-left: 3px solid #ff4d4f;
  background: #fff5f5;
}

/* Maturity Main Row */
.maturity-main-row {
  display: grid;
  grid-template-columns: 30px 100px 100px 100px 100px 120px 70px;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
}

/* Maturity Allocation Section */
.maturity-allocation {
  background: #fafafa;
  border-top: 1px dashed var(--border-color);
  padding: 16px;
}

.allocation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.allocation-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.allocation-total {
  font-size: 14px;
  font-weight: 600;
  color: var(--primary-color);
  font-family: 'DIN Alternate', monospace;
}

.allocation-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.allocation-line {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: white;
  border-radius: 8px;
  font-size: 13px;
}

.allocation-line:nth-child(odd) {
  background: #f5f5f5;
}

.expense-line {
  background: #fff5f5 !important;
  border-left: 3px solid #ff6b6b;
}

.expense-line .alloc-type {
  color: #d63031;
}

.expense-line .alloc-amount {
  color: #e17055;
}

.expense-tag {
  background: #ffebee;
  color: #c62828;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 4px;
}

.alloc-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
}

.alloc-type {
  flex: 1;
  font-weight: 500;
  color: var(--text-primary);
}

.alloc-amount {
  font-weight: 600;
  font-family: 'DIN Alternate', monospace;
  color: var(--primary-color);
}

.alloc-note {
  font-size: 12px;
  color: var(--text-secondary);
  font-style: italic;
}

.allocation-empty {
  padding: 16px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}

.line-number {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
}

.line-date {
  font-size: 13px;
  font-weight: 500;
}

.line-type {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 6px;
  text-align: center;
  font-weight: 500;
}

.line-type.type-current {
  background: #e6f7ed;
  color: var(--primary-color);
}

.line-type.type-short {
  background: #fff3e6;
  color: #ff9500;
}

.line-type.type-long {
  background: #f0e6ff;
  color: #5F27CD;
}

.line-principal {
  font-size: 14px;
  font-weight: 600;
  font-family: 'DIN Alternate', monospace;
}

.line-interest {
  font-size: 12px;
  color: var(--text-secondary);
}

.line-interest .projected {
  color: #999;
}

.line-actual {
  display: flex;
  align-items: center;
}

.actual-input-wrap {
  display: flex;
  align-items: center;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
}

.actual-input-wrap .prefix {
  padding: 4px 8px;
  background: var(--background-color);
  font-size: 11px;
  color: var(--text-secondary);
}

.actual-input-wrap input {
  width: 70px;
  padding: 4px 8px;
  border: none;
  font-size: 13px;
  text-align: right;
  outline: none;
  font-family: 'DIN Alternate', monospace;
}

.btn-complete-line {
  padding: 6px 12px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.btn-complete-line:hover {
  background: #06ad56;
}

/* Group Footer */
.group-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  padding: 12px 16px;
  margin-top: 8px;
  background: white;
  border-radius: 8px;
  font-size: 13px;
}

.group-total-label {
  color: var(--text-secondary);
}

.group-total-principal {
  font-weight: 500;
}

.group-total-interest {
  color: var(--primary-color);
  font-weight: 500;
}

/* History List */
.history-list {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-line {
  display: grid;
  grid-template-columns: 30px 100px 100px 100px 140px 90px;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--background-color);
  border-radius: 8px;
  opacity: 0.8;
}

.line-number.completed {
  background: var(--primary-color);
  color: white;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
}

.line-actual-completed {
  font-size: 12px;
  color: var(--primary-color);
  font-weight: 500;
}

.completed-badge {
  font-size: 11px;
  padding: 4px 10px;
  background: var(--primary-color);
  color: white;
  border-radius: 12px;
  text-align: center;
}

/* Allocation Detail */
.allocation-detail {
  padding: 20px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.detail-card {
  background: var(--background-color);
  border-radius: 12px;
  padding: 20px;
  border-top: 4px solid var(--border-color);
}

.detail-card.type-current { border-top-color: var(--primary-color); }
.detail-card.type-short { border-top-color: #FF9F43; }
.detail-card.type-long { border-top-color: #5F27CD; }

.detail-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.detail-icon {
  font-size: 24px;
}

.detail-type {
  font-size: 16px;
  font-weight: 600;
  flex: 1;
}

.detail-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-amount {
  font-size: 24px;
  font-weight: 700;
  font-family: 'DIN Alternate', monospace;
}

.detail-rate {
  font-size: 13px;
  color: var(--text-secondary);
}

.detail-original {
  font-size: 12px;
  color: var(--text-secondary);
}

.detail-withdrawn {
  font-size: 12px;
  color: #ff4d4f;
}

/* No Plan */
.no-plan-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 500px;
}

.no-plan-card {
  text-align: center;
  padding: 60px 48px;
  background: var(--card-background);
  border-radius: 16px;
  box-shadow: var(--shadow);
}

.no-plan-icon {
  font-size: 72px;
  margin-bottom: 20px;
}

.no-plan-text {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 8px;
}

.no-plan-desc {
  font-size: 15px;
  color: var(--text-secondary);
  margin-bottom: 32px;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 480px;
  max-height: 90vh;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: var(--background-color);
  border-radius: 50%;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-body {
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
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

/* Completion Summary */
.completion-summary {
  background: var(--background-color);
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 20px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color);
}

.summary-row:last-child {
  border-bottom: none;
}

.summary-row .value {
  font-weight: 600;
}

.summary-row.expected .value {
  color: var(--primary-color);
}

/* Interest Input Section */
.interest-input-section {
  margin-top: 20px;
}

.interest-input-section label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
}

.input-with-prefix {
  display: flex;
  align-items: center;
  border: 2px solid var(--border-color);
  border-radius: 10px;
  overflow: hidden;
}

.input-with-prefix .prefix {
  padding: 12px 16px;
  background: var(--background-color);
  color: var(--text-secondary);
  font-weight: 500;
}

.input-with-prefix input {
  flex: 1;
  padding: 12px;
  border: none;
  font-size: 16px;
  outline: none;
}

.input-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 8px;
}

/* Allocation Preview */
.allocation-preview {
  margin-top: 24px;
  background: var(--background-color);
  border-radius: 10px;
  padding: 16px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.preview-header label {
  font-size: 14px;
  font-weight: 500;
}

.preview-total {
  font-size: 14px;
  font-weight: 600;
  color: var(--primary-color);
  font-family: 'DIN Alternate', monospace;
}

.preview-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: white;
  border-radius: 8px;
  font-size: 13px;
}

.preview-item.source {
  background: #fff5f5;
  border-left: 3px solid #ff4d4f;
}

.preview-item.interest {
  background: #e6f7ed;
  border-left: 3px solid var(--primary-color);
}

.preview-icon {
  font-size: 16px;
  width: 24px;
  text-align: center;
}

.preview-type {
  flex: 1;
  font-weight: 500;
}

.preview-amount {
  font-weight: 600;
  font-family: 'DIN Alternate', monospace;
}

.preview-amount.positive {
  color: var(--primary-color);
}

.preview-amount.negative {
  color: #ff4d4f;
}

.preview-note {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 12px;
  text-align: center;
  font-style: italic;
}

/* Deposit Options */
.deposit-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.deposit-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 2px solid var(--border-color);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.deposit-option:hover {
  border-color: var(--primary-color);
}

.deposit-option.selected {
  border-color: var(--primary-color);
  background: #e6f7ed;
}

.option-info {
  flex: 1;
}

.option-type {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.option-balance {
  font-size: 13px;
  color: var(--text-secondary);
}

/* Warning Box */
.warning-box {
  display: flex;
  gap: 12px;
  padding: 14px;
  background: #fff5e6;
  border-radius: 10px;
  margin-top: 20px;
}

.warning-box span {
  font-size: 20px;
}

.warning-box p {
  font-size: 13px;
  color: #666;
  line-height: 1.5;
}

/* Buttons */
.btn-primary {
  padding: 14px 24px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: #06ad56;
}

.btn-secondary {
  padding: 14px 24px;
  background: var(--background-color);
  color: var(--text-primary);
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.btn-large {
  padding: 16px 40px;
  font-size: 16px;
}

/* Form Group */
.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 10px;
}

/* Responsive */
@media (max-width: 1200px) {
  .execute-layout {
    grid-template-columns: 1fr;
  }

  .allocation-panel {
    order: 2;
  }

  .main-content {
    order: 1;
  }

  .maturity-main-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .maturity-allocation {
    padding: 12px;
  }

  .allocation-line {
    flex-wrap: wrap;
  }

  .history-line {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .progress-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
