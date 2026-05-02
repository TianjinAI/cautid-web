<script setup>
import { ref, computed, onMounted } from 'vue'
import { formatAmount, formatDate, normalizeDepositType } from '../utils/format'
import { storage as localStorage } from '../utils/storage'
import { showToast } from '../utils/toast'
import { useRouter } from 'vue-router'

const router = useRouter()

const loadedExecutionPlan = ref(null)

// State
const groupedMaturities = ref([])
const maturityHistory = ref([])
const currentDeposits = ref([])
const targetDeposits = ref([])
const totalDepositAmount = ref('0')
const totalProjectedInterest = ref(0)
const planningHorizon = ref(1)
const totalActualInterest = ref(0)
const completedCount = ref(0)
const totalCount = ref(0)
const hasPlan = ref(false)
const demandDepositBalance = ref('0')
const editingDemandBalance = ref(false)
const demandDepositDraft = ref('')
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
const currentDemandBalanceInput = ref('')
const completionError = ref('')

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

const debugShape = (value) => {
  if (value === null || value === undefined) return 'none'
  if (Array.isArray(value)) return `array(${value.length})`
  if (typeof value === 'object') return `obj(${Object.keys(value).length})`
  return typeof value
}

const debugStatusLine = computed(() => {
  return `executionPlan:${debugShape(loadedExecutionPlan.value)} currentHoldings:${debugShape(currentDeposits.value)} transitionPlan:${debugShape(loadedExecutionPlan.value?.transitionPlan)}`
})

const standardDepositTypes = ['活期存款', '3个月定期', '6个月定期', '1年定期', '2年定期', '3年定期', '5年定期']

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

const isOperationalEntry = (item) => {
  return item.depositType === '初始' || item.action === '支取支出'
}

const isMaturityEntry = (item) => {
  return !isOperationalEntry(item) && String(item.action || '').includes('到期')
}

const buildTransitionActionDetails = (item) => {
  if (item.actionDetails) return item.actionDetails

  const allocation = item.allocation || {}
  const lines = [
    '【到期处理】',
    `• 本金: ¥${formatAmount(item.amount || 0)}`,
    `• 利息: ¥${formatAmount(item.projectedInterest || 0)}`,
    `• 本息合计: ¥${formatAmount(item.totalWithInterest || ((item.amount || 0) + (item.projectedInterest || 0)))}`,
    '',
    '【资金分配】'
  ]

  if (allocation.toDemand > 0) lines.push(`• 活期存款: ¥${formatAmount(allocation.toDemand)}`)
  if (allocation.to3Month > 0) lines.push(`• 3个月定期: ¥${formatAmount(allocation.to3Month)}`)
  if (allocation.to6Month > 0) lines.push(`• 6个月定期: ¥${formatAmount(allocation.to6Month)}`)
  if (allocation.to1Year > 0) lines.push(`• 1年定期: ¥${formatAmount(allocation.to1Year)}`)
  if (allocation.toLongTerm > 0) lines.push(`• ${allocation.longTermType || '长期定期'}: ¥${formatAmount(allocation.toLongTerm)}`)

  return lines.join('\n')
}

const initialRebalanceRows = computed(() => {
  if (initialRebalanceDone.value) return []
  if (!targetDeposits.value.length || !currentDeposits.value.length) return []

  const currentMap = new Map(currentDeposits.value.map(dep => [normalizeDepositType(dep.type), dep]))
  const targetMap = new Map(targetDeposits.value.map(dep => [normalizeDepositType(dep.type), dep]))
  const allTypes = Array.from(new Set([...currentMap.keys(), ...targetMap.keys()]))

  return allTypes
    .map(type => {
      const current = currentMap.get(type)
      const target = targetMap.get(type)
      const currentAmount = current ? Number(current.remainingBalance ?? current.amount ?? 0) : 0
      const targetAmount = target ? Number(target.remainingBalance ?? target.amount ?? 0) : 0
      const delta = targetAmount - currentAmount

      return {
        type,
        currentAmount,
        targetAmount,
        delta,
        currentFormatted: formatAmount(currentAmount),
        targetFormatted: formatAmount(targetAmount),
        deltaFormatted: formatAmount(Math.abs(delta)),
        direction: delta > 0 ? 'increase' : delta < 0 ? 'decrease' : 'same'
      }
    })
    .filter(row => Math.abs(row.delta) > 0.009)
    .sort((a, b) => {
      if (a.type === '活期存款') return -1
      if (b.type === '活期存款') return 1
      return standardDepositTypes.indexOf(a.type) - standardDepositTypes.indexOf(b.type)
    })
})

const initialRebalanceCompleted = computed(() => {
  return initialRebalanceRows.value.length === 0
})

const initialRebalanceDone = computed(() => Boolean(loadedExecutionPlan.value?.initialRebalanceCompletedAt))

const executionExpenseBreakdown = computed(() => {
  const plan = loadedExecutionPlan.value || {}
  const housing = parseFloat(plan.housingExpense) || 0
  const food = parseFloat(plan.foodExpense) || 0
  const other = parseFloat(plan.otherExpense) || 0
  const monthly = parseFloat(plan.monthlyExpense) || (housing + food + other)
  const emergency = parseFloat(plan.emergencyFund) || 0
  const quarterTotal = monthly * 3
  return {
    housing,
    food,
    other,
    monthly,
    emergency,
    quarterTotal,
    reserveTarget: emergency + quarterTotal
  }
})

const executionLiquidityWarning = computed(() => {
  const currentDemand = currentDeposits.value.find(d => d.type === '活期存款')
  const demandBalance = currentDemand ? Number(currentDemand.remainingBalance ?? currentDemand.amount ?? 0) : 0
  const emergency = executionExpenseBreakdown.value.emergency
  const quarterTotal = executionExpenseBreakdown.value.quarterTotal
  const reserveTarget = executionExpenseBreakdown.value.reserveTarget
  const availableForQuarter = demandBalance - emergency

  if (availableForQuarter < quarterTotal) {
    return {
      shortfall: quarterTotal - availableForQuarter,
      demandBalance,
      emergency,
      quarterTotal,
      reserveTarget
    }
  }

  return null
})

const normalizeAllocationList = (rawAllocation = []) => {
  const typeMap = new Map()

  rawAllocation.forEach(dep => {
    const normalizedType = normalizeDepositType(dep.type)
    if (typeMap.has(normalizedType)) {
      const existing = typeMap.get(normalizedType)
      existing.amount = (existing.amount || 0) + (dep.amount || 0)
      if (dep.remainingBalance !== undefined) {
        existing.remainingBalance = (existing.remainingBalance || 0) + dep.remainingBalance
      }
    } else {
      typeMap.set(normalizedType, {
        ...dep,
        type: normalizedType,
        remainingBalance: dep.remainingBalance !== undefined ? dep.remainingBalance : dep.amount
      })
    }
  })

  return standardDepositTypes
    .map(type => typeMap.get(type))
    .filter(Boolean)
}

// Load execution plan
const loadExecutionPlan = () => {
  const planData = localStorage.getSync('executionPlan')

  if (!planData || !planData.executionList || planData.executionList.length === 0) {
    hasPlan.value = false
    loadedExecutionPlan.value = null
    currentDeposits.value = []
    targetDeposits.value = []

    maturityHistory.value = []
    totalDepositAmount.value = '0'
    return
  }

  loadedExecutionPlan.value = planData
  planningHorizon.value = planData.planningHorizon || 1
  const executionList = (planData.executionList || []).filter(item => !item.isExisting)
  const transitionPlan = planData.transitionPlan || []

  // Group maturities by year+quarter
  const groups = new Map()
  const history = []
  let totalInterest = 0
  let completed = 0
  let totalProjected = 0

  const pushMaturity = (maturity, source) => {
    maturity.source = source
    maturity.sourceLabel = source === 'existing' ? '现有定期到期' : '新计划滚动'

    if (maturity.isCompleted) {
      history.push(maturity)
      completed++
      if (maturity.actualInterest) totalInterest += parseFloat(maturity.actualInterest)
      return
    }

    const dateLabel = maturity.dateDisplay || `Year ${maturity.year} - Q${maturity.quarter}`
    const groupKey = `${source}:${dateLabel}`
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key: groupKey,
        dateLabel,
        source,
        sourceLabel: maturity.sourceLabel,
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

  executionList.forEach((item) => {
    if (item.year === 0 && !item.maturityDate) return
    if (isOperationalEntry(item)) return

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
      action: item.action || '',
      title: item.title || '',
      description: item.description || '',
      isCompleted: item.isCompleted || false,
      actualInterest: item.actualInterest || '',
      actualInterestFormatted: item.actualInterest ? formatAmount(item.actualInterest) : ''
    }

    pushMaturity(maturity, 'planned')
  })

  transitionPlan.forEach((item, index) => {
    const maturity = {
      id: item.id || `transition-${index}`,
      year: parseDate(item.maturityDate).getFullYear(),
      quarter: Math.ceil((parseDate(item.maturityDate).getMonth() + 1) / 3),
      date: item.maturityDate,
      dateDisplay: item.maturityDateStr,
      depositType: item.type || '定期存款',
      amount: item.amount || 0,
      amountFormatted: formatAmount(item.amount || 0),
      projectedInterest: item.projectedInterest || 0,
      projectedInterestFormatted: formatAmount(item.projectedInterest || 0),
      actionDetails: buildTransitionActionDetails(item),
      action: '到期重新分配',
      title: `${item.type}到期`,
      description: '现有存款到期',
      isCompleted: item.status === 'completed',
      actualInterest: item.actualInterest || '',
      actualInterestFormatted: item.actualInterest ? formatAmount(item.actualInterest) : ''
    }

    pushMaturity(maturity, 'existing')
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
  let allocation = normalizeAllocationList(planData.allocation || planData.currentStateAllocation || [])
  console.log('=== LOAD EXECUTION PLAN ===')
  console.log('Raw allocation from storage:', allocation.map(d => ({ type: d.type, amount: d.amount, remainingBalance: d.remainingBalance })))

  // Deduplicate: merge deposits with same type
  // Use the first occurrence's values, sum amounts for duplicates
  const typeMap = new Map()
  allocation.forEach(dep => {
    const normalizedType = normalizeDepositType(dep.type)
    if (typeMap.has(normalizedType)) {
      // Merge with existing - but DON'T use Math.max for remainingBalance
      // remainingBalance should reflect the actual current state
      const existing = typeMap.get(normalizedType)
      // Sum the amounts for display purposes
      existing.amount = (existing.amount || 0) + (dep.amount || 0)
      // Use the actual remainingBalance from saved data (not max)
      if (dep.remainingBalance !== undefined) {
        existing.remainingBalance = (existing.remainingBalance || 0) + dep.remainingBalance
      }
    } else {
      // Add new - use remainingBalance if available, otherwise amount
      typeMap.set(normalizedType, {
        ...dep,
        type: normalizedType,
        remainingBalance: dep.remainingBalance !== undefined ? dep.remainingBalance : dep.amount
      })
    }
  })

  // Convert back to array in standard order
  const standardTypes = ['活期存款', '3个月定期', '6个月定期', '1年定期', '3年定期', '5年定期']
  allocation = standardDepositTypes
    .map(type => typeMap.get(type))
    .filter(Boolean)

  currentDeposits.value = allocation.map(dep => ({
    ...dep,
    amountFormatted: formatAmount(dep.amount),
    remainingBalanceFormatted: formatAmount(dep.remainingBalance !== undefined ? dep.remainingBalance : dep.amount),
    typeClass: getTypeClass(dep.type)
  }))

  targetDeposits.value = normalizeAllocationList(planData.targetAllocation || []).map(dep => ({
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
  if (!editingDemandBalance.value) {
    demandDepositDraft.value = currentDeposit ? String(currentDeposit.remainingBalance ?? currentDeposit.amount ?? 0) : '0'
  }

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

const mapDisplayAllocationType = (typeDesc) => {
  const normalized = normalizeDepositType(typeDesc)
  if (!normalized) return null
  if (normalized.includes('支出')) return null
  if (normalized.includes('活期')) return '活期存款'
  if (normalized.includes('3个月')) return '3个月定期'
  if (normalized.includes('6个月')) return '6个月定期'
  if (normalized.includes('1年')) return '1年定期'
  if (normalized.includes('2年')) return '2年定期'
  if (normalized.includes('3年')) return '3年定期'
  if (normalized.includes('5年')) return '5年定期'
  return typeDesc
}

const parseActionAllocations = (actionDetails) => {
  if (!actionDetails) return []

  const allocations = []
  const lines = actionDetails.split('\n')
  let inAllocationSection = false

  for (const line of lines) {
    if (line.includes('【资金分配】') || line.includes('【资金用途】')) {
      inAllocationSection = true
      continue
    }

    if (!inAllocationSection) continue

    const match = line.match(/[•-]\s*([^:：]+)[:：]\s*[¥￥]?([\d,]+(?:\.\d{2})?)/)
    if (!match) continue

    const fullType = match[1].trim()
    const typeRaw = fullType.split('(')[0].trim()
    const noteMatch = fullType.match(/\(([^)]+)\)/)
    const mappedType = mapDisplayAllocationType(typeRaw)

    allocations.push({
      type: mappedType || '支出',
      displayType: fullType,
      amount: match[2].trim(),
      note: noteMatch ? noteMatch[1] : '',
      icon: getAllocationIcon(mappedType || '支出'),
      isExpense: !mappedType
    })
  }

  const mergedAllocations = []
  const typeMap = new Map()
  for (const alloc of allocations) {
    const key = alloc.type || alloc.displayType
    if (typeMap.has(key)) {
      const existing = typeMap.get(key)
      const totalAmount = parseFloat(existing.amount.replace(/,/g, '')) + parseFloat(alloc.amount.replace(/,/g, ''))
      existing.amount = totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      if (alloc.note && !existing.note.includes(alloc.note)) {
        existing.note = existing.note ? `${existing.note} + ${alloc.note}` : alloc.note
      }
    } else {
      typeMap.set(key, { ...alloc })
      mergedAllocations.push(typeMap.get(key))
    }
  }

  return mergedAllocations
}

const shouldShowAllocationBreakdown = (maturity) => isMaturityEntry(maturity) && parseActionAllocations(maturity.actionDetails).length > 0

const parseMoney = (value) => {
  if (value === null || value === undefined || value === '') return 0
  return parseFloat(String(value).replace(/,/g, '')) || 0
}

const cloneAllocationState = (allocation = []) => JSON.parse(JSON.stringify(allocation))

const getDemandDeposit = (allocation = []) => allocation.find(d => d.type === '活期存款')

const getCompletionAllocationPreview = (maturity = selectedMaturity.value, actualInterestValue = actualInterestInput.value, currentDemandValue = currentDemandBalanceInput.value) => {
  if (!maturity) return { allocations: [], totalAvailable: 0, reserveGapBefore: 0, reserveTarget: executionExpenseBreakdown.value.reserveTarget }

  const totalAvailable = parseMoney(maturity.amount) + parseMoney(actualInterestValue)
  const confirmedDemandBefore = parseMoney(currentDemandValue)
  const reserveTarget = executionExpenseBreakdown.value.reserveTarget
  const reserveGapBefore = Math.max(0, reserveTarget - confirmedDemandBefore)
  const plannedAllocations = parseActionAllocations(maturity.actionDetails)
  const nonDemandAllocations = plannedAllocations
    .filter(alloc => alloc.type && alloc.type !== '活期存款' && !alloc.isExpense)
    .map(alloc => ({
      ...alloc,
      parsedAmount: parseMoney(alloc.amount)
    }))

  let remaining = totalAvailable
  const allocations = []

  const toDemand = Math.min(remaining, reserveGapBefore)
  if (toDemand > 0) {
    allocations.push({
      type: '活期存款',
      displayType: '活期存款',
      amount: toDemand,
      amountFormatted: formatAmount(toDemand),
      note: '补足本季度储备',
      icon: getAllocationIcon('活期存款')
    })
    remaining -= toDemand
  }

  nonDemandAllocations.forEach((alloc, index) => {
    if (remaining <= 0) return
    const isLast = index === nonDemandAllocations.length - 1
    const amount = isLast ? remaining : Math.min(remaining, alloc.parsedAmount)
    if (amount <= 0) return
    allocations.push({
      type: alloc.type,
      displayType: alloc.displayType,
      amount,
      amountFormatted: formatAmount(amount),
      note: alloc.note || '',
      icon: alloc.icon
    })
    remaining -= amount
  })

  if (remaining > 0) {
    const currentAlloc = allocations.find(alloc => alloc.type === '活期存款')
    if (currentAlloc) {
      currentAlloc.amount += remaining
      currentAlloc.amountFormatted = formatAmount(currentAlloc.amount)
      currentAlloc.note = currentAlloc.note ? `${currentAlloc.note} + 剩余资金` : '剩余资金'
    } else {
      allocations.push({
        type: '活期存款',
        displayType: '活期存款',
        amount: remaining,
        amountFormatted: formatAmount(remaining),
        note: '剩余资金',
        icon: getAllocationIcon('活期存款')
      })
    }
    remaining = 0
  }

  return {
    allocations,
    totalAvailable,
    confirmedDemandBefore,
    reserveTarget,
    reserveGapBefore,
    reserveSatisfiedBefore: reserveGapBefore <= 0
  }
}

const completionPreview = computed(() => getCompletionAllocationPreview())

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
  if (type?.includes('1年') || type?.includes('2年') || type?.includes('3年') || type?.includes('5年')) return 'type-long'
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
  const currentDemand = currentDeposits.value.find(d => d.type === '活期存款')
  currentDemandBalanceInput.value = currentDemand ? String(currentDemand.remainingBalance ?? currentDemand.amount ?? '') : ''
  completionError.value = ''
  showCompletionModal.value = true
}

const closeCompletionModal = () => {
  showCompletionModal.value = false
  completionError.value = ''
}

const ensureDepositBucket = (allocation, type) => {
  let deposit = allocation.find(d => d.type === type)
  if (!deposit) {
    deposit = {
      type,
      amount: 0,
      originalAmount: 0,
      remainingBalance: 0,
      status: 'active'
    }
    allocation.push(deposit)
  }
  if (deposit.remainingBalance === undefined) {
    deposit.remainingBalance = deposit.amount || 0
  }
  return deposit
}

const applyCompletionAllocation = (planData, maturity, preview) => {
  if (!planData || !planData.allocation) return null

  const snapshotBefore = cloneAllocationState(planData.allocation)
  const allocation = planData.allocation
  const demandDeposit = ensureDepositBucket(allocation, '活期存款')
  demandDeposit.remainingBalance = preview.confirmedDemandBefore

  const sourceDeposit = allocation.find(d => d.type === maturity.depositType)
  if (sourceDeposit) {
    const oldBalance = sourceDeposit.remainingBalance !== undefined ? sourceDeposit.remainingBalance : sourceDeposit.amount
    sourceDeposit.remainingBalance = Math.max(0, oldBalance - parseMoney(maturity.amount))
  }

  preview.allocations.forEach(alloc => {
    if (!alloc.type) return
    const targetDeposit = ensureDepositBucket(allocation, alloc.type)
    const oldBalance = targetDeposit.remainingBalance !== undefined ? targetDeposit.remainingBalance : targetDeposit.amount
    targetDeposit.remainingBalance = oldBalance + alloc.amount
  })

  const snapshotAfter = cloneAllocationState(allocation)
  return {
    confirmedDemandBalanceBefore: preview.confirmedDemandBefore,
    allocationApplied: preview.allocations.map(alloc => ({
      type: alloc.type,
      displayType: alloc.displayType,
      amount: alloc.amount,
      note: alloc.note || ''
    })),
    snapshotBefore,
    snapshotAfter
  }
}

const completeInitialRebalance = () => {
  const planData = localStorage.getSync('executionPlan')
  if (!planData || !planData.targetAllocation) {
    showToast({ title: '没有可执行的初始调仓', icon: 'none' })
    return
  }

  planData.allocation = planData.targetAllocation.map(item => ({
    ...item,
    amount: item.amount,
    originalAmount: item.originalAmount ?? item.amount,
    remainingBalance: item.remainingBalance !== undefined ? item.remainingBalance : item.amount,
    status: 'active'
  }))
  planData.initialRebalanceCompletedAt = new Date().toISOString()
  localStorage.setSync('executionPlan', planData)
  loadExecutionPlan()
  showToast({ title: '初始调仓已完成', icon: 'success' })
}

const rollbackInitialRebalance = () => {
  const planData = localStorage.getSync('executionPlan')
  if (!planData || !planData.currentStateAllocation) {
    showToast({ title: '没有可折返的初始调仓', icon: 'none' })
    return
  }

  planData.allocation = planData.currentStateAllocation.map(item => ({
    ...item,
    amount: item.amount,
    originalAmount: item.originalAmount ?? item.amount,
    remainingBalance: item.remainingBalance !== undefined ? item.remainingBalance : item.amount,
    status: 'active'
  }))
  delete planData.initialRebalanceCompletedAt
  localStorage.setSync('executionPlan', planData)
  loadExecutionPlan()
  showToast({ title: '初始调仓已折返', icon: 'success' })
}

const rollbackCompletion = (maturity) => {
  const planData = localStorage.getSync('executionPlan')
  if (!planData || !planData.allocation) return

  let updated = false

  if (maturity.source === 'existing') {
    const transitionItem = (planData.transitionPlan || []).find(item =>
      String(item.id) === String(maturity.id) ||
      (item.type === maturity.depositType && item.maturityDate === maturity.date)
    )

    if (transitionItem) {
      if (transitionItem.snapshotBefore) {
        planData.allocation = cloneAllocationState(transitionItem.snapshotBefore)
      }
      transitionItem.status = 'pending'
      delete transitionItem.actualInterest
      delete transitionItem.confirmedDemandBalanceBefore
      delete transitionItem.allocationApplied
      delete transitionItem.snapshotBefore
      delete transitionItem.snapshotAfter
      updated = true
    }
  } else {
    const execItem = planData.executionList.find(e =>
      e.year === maturity.year &&
      e.quarter === maturity.quarter &&
      e.depositType === maturity.depositType
    )

    if (execItem) {
      if (execItem.snapshotBefore) {
        planData.allocation = cloneAllocationState(execItem.snapshotBefore)
      }
      execItem.isCompleted = false
      execItem.actualInterest = ''
      delete execItem.confirmedDemandBalanceBefore
      delete execItem.allocationApplied
      delete execItem.snapshotBefore
      delete execItem.snapshotAfter
      updated = true
    }
  }

  if (!updated) {
    showToast({ title: '未找到可折返的记录', icon: 'none' })
    return
  }

  localStorage.setSync('executionPlan', planData)
  loadExecutionPlan()
  showToast({ title: '已折返，资金状态已回退', icon: 'success' })
}

// Confirm completion with allocation update
const confirmCompletion = () => {
  if (!selectedMaturity.value) return

  const planData = localStorage.getSync('executionPlan')
  if (!planData) return

  const confirmedDemandBefore = parseMoney(currentDemandBalanceInput.value)
  if (currentDemandBalanceInput.value === '' || confirmedDemandBefore < 0) {
    completionError.value = '请输入当前活期余额'
    return
  }

  const preview = getCompletionAllocationPreview(selectedMaturity.value, actualInterestInput.value, currentDemandBalanceInput.value)
  const completionMetadata = applyCompletionAllocation(planData, selectedMaturity.value, preview)
  if (!completionMetadata) {
    completionError.value = '资金状态更新失败'
    return
  }

  let updated = false

  if (selectedMaturity.value.source === 'existing') {
    const transitionItem = (planData.transitionPlan || []).find(item =>
      String(item.id) === String(selectedMaturity.value.id) ||
      (item.type === selectedMaturity.value.depositType && item.maturityDate === selectedMaturity.value.date)
    )

    if (transitionItem) {
      transitionItem.status = 'completed'
      transitionItem.actualInterest = actualInterestInput.value
      transitionItem.confirmedDemandBalanceBefore = completionMetadata.confirmedDemandBalanceBefore
      transitionItem.allocationApplied = completionMetadata.allocationApplied
      transitionItem.snapshotBefore = completionMetadata.snapshotBefore
      transitionItem.snapshotAfter = completionMetadata.snapshotAfter
      updated = true
    }
  } else {
    const execItem = planData.executionList.find(e =>
      e.year === selectedMaturity.value.year &&
      e.quarter === selectedMaturity.value.quarter &&
      e.depositType === selectedMaturity.value.depositType
    )

    if (execItem) {
      execItem.isCompleted = true
      execItem.actualInterest = actualInterestInput.value
      execItem.confirmedDemandBalanceBefore = completionMetadata.confirmedDemandBalanceBefore
      execItem.allocationApplied = completionMetadata.allocationApplied
      execItem.snapshotBefore = completionMetadata.snapshotBefore
      execItem.snapshotAfter = completionMetadata.snapshotAfter
      updated = true
    }
  }

  if (updated) {
    localStorage.setSync('executionPlan', planData)
    loadExecutionPlan()
    showToast({ title: '已标记完成，资金分配已更新', icon: 'success' })
  } else {
    showToast({ title: '未找到对应任务记录', icon: 'none' })
  }

  completionError.value = ''
  closeCompletionModal()
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

  const longTermTypes = ['1年定期', '2年定期', '3年定期', '5年定期']
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
  demandDepositDraft.value = e.target.value
}

const startEditingDemandDepositBalance = () => {
  const currentDeposit = currentDeposits.value.find(d => d.type === '活期存款')
  demandDepositDraft.value = currentDeposit ? String(currentDeposit.remainingBalance ?? currentDeposit.amount ?? 0) : '0'
  editingDemandBalance.value = true
}

const cancelDemandDepositBalanceEdit = () => {
  editingDemandBalance.value = false
  demandDepositDraft.value = demandDepositBalance.value.replace(/,/g, '')
}

const updateDemandDepositBalance = () => {
  const planData = localStorage.getSync('executionPlan')
  if (!planData || !planData.allocation) return

  const currentDeposit = planData.allocation.find(d => d.type === '活期存款')
  if (currentDeposit) {
    const newBalance = parseFloat(demandDepositDraft.value.replace(/,/g, '')) || 0
    currentDeposit.remainingBalance = newBalance
    localStorage.setSync('executionPlan', planData)
    editingDemandBalance.value = false
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
  if (type?.includes('2年') || type?.includes('2 年')) return '🏛️'
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
    <div style="margin-bottom: 12px; font-size: 12px; line-height: 1.4; color: #7a7a7a; word-break: break-all;">
      调试：{{ debugStatusLine }}
    </div>
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
            <div v-if="!editingDemandBalance" class="demand-display-group">
              <span class="currency">¥</span>
              <span class="demand-balance-value">{{ demandDepositBalance }}</span>
            </div>
            <div v-else class="demand-input-group">
              <span class="currency">¥</span>
              <input
                type="text"
                v-model="demandDepositDraft"
                class="demand-input"
              />
            </div>
          </div>
          <div class="demand-card-actions">
            <button v-if="!editingDemandBalance" class="demand-action-btn" @click="startEditingDemandDepositBalance">
              手动调整
            </button>
            <template v-else>
              <button class="demand-action-btn ghost" @click="cancelDemandDepositBalanceEdit">
                取消
              </button>
              <button class="demand-action-btn" @click="updateDemandDepositBalance">
                保存
              </button>
            </template>
          </div>
          <div v-if="executionLiquidityWarning" class="demand-warning-inline">
            <div class="demand-warning-title">流动性预警</div>
            <div class="demand-warning-text">
              活期 ¥{{ formatAmount(executionLiquidityWarning.demandBalance) }} - 应急金 ¥{{ formatAmount(executionLiquidityWarning.emergency) }}
              = ¥{{ formatAmount(executionLiquidityWarning.demandBalance - executionLiquidityWarning.emergency) }}，
              低于本季度支出 ¥{{ formatAmount(executionLiquidityWarning.quarterTotal) }}，
              缺口 ¥{{ formatAmount(executionLiquidityWarning.shortfall) }}
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

        <div v-if="initialRebalanceRows.length > 0 || initialRebalanceDone" class="rebalance-card">
          <div class="rebalance-title">初始调仓建议</div>
          <div class="rebalance-subtitle">
            {{ initialRebalanceDone ? '初始调仓已完成。这里保留的是初始设置步骤的记录，可按需折返。' : '按规则保留活期 = 应急金 + 近期支出，其余资金转入对应定期。' }}
          </div>
          <div v-if="initialRebalanceRows.length > 0" class="rebalance-list">
            <div v-for="row in initialRebalanceRows" :key="row.type" class="rebalance-row">
              <div class="rebalance-type">{{ row.type }}</div>
              <div class="rebalance-values">
                <span class="rebalance-current">当前 ¥{{ row.currentFormatted }}</span>
                <span class="rebalance-arrow">→</span>
                <span class="rebalance-target">目标 ¥{{ row.targetFormatted }}</span>
              </div>
              <div class="rebalance-delta" :class="row.direction">
                <span v-if="row.direction === 'decrease'">转出 ¥{{ row.deltaFormatted }}</span>
                <span v-else-if="row.direction === 'increase'">转入 ¥{{ row.deltaFormatted }}</span>
              </div>
            </div>
          </div>
          <div v-else-if="initialRebalanceDone" class="rebalance-complete-state">
            初始调仓已完成，后续余额变化以执行记录和手动更新的活期余额为准。
          </div>
          <div class="rebalance-actions">
            <button v-if="!initialRebalanceDone" class="btn-primary" @click="completeInitialRebalance">完成初始调仓</button>
            <button v-if="initialRebalanceDone" class="btn-secondary" @click="rollbackInitialRebalance">折返初始调仓</button>
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
                    <span class="group-name">{{ group.dateLabel }}</span>
                    <span class="group-source">{{ group.sourceLabel }}</span>
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
                  <div v-if="isMaturityEntry(maturity)" class="maturity-allocation">
                    <div class="allocation-header">
                      <span class="allocation-title">📋 到期资金分配</span>
                      <span class="allocation-total">合计: ¥{{ formatAmount(parseFloat(maturity.amount) + parseFloat(maturity.projectedInterest)) }}</span>
                    </div>
                    <div class="allocation-list">
                      <div
                        v-for="(alloc, allocIdx) in parseActionAllocations(maturity.actionDetails)"
                        :key="allocIdx"
                        class="allocation-line"
                      >
                        <span class="alloc-icon">{{ alloc.icon }}</span>
                        <span class="alloc-type">{{ alloc.displayType }}</span>
                        <span class="alloc-amount">¥{{ alloc.amount }}</span>
                        <span v-if="alloc.note" class="alloc-note">({{ alloc.note }})</span>
                      </div>
                      <div v-if="parseActionAllocations(maturity.actionDetails).length === 0" class="allocation-empty">
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
              <button class="btn-rollback-line" @click="rollbackCompletion(item)">折返</button>
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
    <div v-if="showCompletionModal" class="modal-overlay" @click="closeCompletionModal">
      <div class="modal-content completion-modal" @click.stop>
        <div class="modal-header">
          <h3>处理到期存款</h3>
          <button class="close-btn" @click="closeCompletionModal">×</button>
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

          <div class="interest-input-section">
            <label>当前活期余额</label>
            <div class="input-with-prefix">
              <span class="prefix">¥</span>
              <input
                type="text"
                v-model="currentDemandBalanceInput"
                placeholder="确认当前实际活期余额"
              />
            </div>
            <p class="input-hint">每次完成前，先确认真实活期余额。系统会按这个金额作为本次执行起点。</p>
          </div>

          <div class="reserve-breakdown">
            <div class="reserve-header">
              <label>本季度储备目标</label>
              <span class="reserve-target">¥{{ formatAmount(executionExpenseBreakdown.reserveTarget) }}</span>
            </div>
            <div class="reserve-grid">
              <div class="reserve-item">
                <span>房屋支出</span>
                <strong>¥{{ formatAmount(executionExpenseBreakdown.housing * 3) }}</strong>
              </div>
              <div class="reserve-item">
                <span>餐饮支出</span>
                <strong>¥{{ formatAmount(executionExpenseBreakdown.food * 3) }}</strong>
              </div>
              <div class="reserve-item">
                <span>其他支出</span>
                <strong>¥{{ formatAmount(executionExpenseBreakdown.other * 3) }}</strong>
              </div>
              <div class="reserve-item">
                <span>应急金</span>
                <strong>¥{{ formatAmount(executionExpenseBreakdown.emergency) }}</strong>
              </div>
            </div>
            <div class="reserve-status">
              <span>确认前活期</span>
              <strong>¥{{ formatAmount(completionPreview.confirmedDemandBefore || 0) }}</strong>
            </div>
            <div class="reserve-status">
              <span>本次还需补足</span>
              <strong :class="{ positive: completionPreview.reserveGapBefore > 0 }">¥{{ formatAmount(completionPreview.reserveGapBefore || 0) }}</strong>
            </div>
            <div class="reserve-status">
              <span>储备状态</span>
              <strong :class="completionPreview.reserveSatisfiedBefore ? 'status-met' : 'status-unmet'">
                {{ completionPreview.reserveSatisfiedBefore ? '已达标' : '未达标' }}
              </strong>
            </div>
          </div>

          <!-- Allocation Preview -->
          <div class="allocation-preview" v-if="selectedMaturity">
            <div class="preview-header">
              <label>资金分配预览</label>
              <span class="preview-total">合计: ¥{{ formatAmount(completionPreview.totalAvailable || 0) }}</span>
            </div>
            <div class="preview-list">
              <div class="preview-item source">
                <span class="preview-icon">➖</span>
                <span class="preview-type">{{ selectedMaturity.depositType }}（到期支出）</span>
                <span class="preview-amount negative">-¥{{ selectedMaturity.amountFormatted }}</span>
              </div>
              <div
                v-for="(alloc, idx) in completionPreview.allocations"
                :key="idx"
                class="preview-item"
              >
                <span class="preview-icon">{{ alloc.icon }}</span>
                <span class="preview-type">{{ alloc.displayType }}</span>
                <span class="preview-amount positive">+¥{{ alloc.amountFormatted }}</span>
              </div>
            </div>
            <p class="preview-note">点击"确认完成"后将按上述分配更新资金面板</p>
          </div>
          <div v-if="completionError" class="form-error">{{ completionError }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeCompletionModal">取消</button>
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
  grid-template-columns: 320px 1fr;
  gap: 12px;
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

.demand-display-group,
.demand-input-group {
  display: flex;
  align-items: center;
  background: rgba(255,255,255,0.2);
  border-radius: 8px;
  padding: 8px 12px;
}

.demand-display-group {
  min-width: 168px;
  justify-content: flex-end;
}

.currency {
  font-size: 16px;
  margin-right: 4px;
}

.demand-balance-value {
  color: white;
  font-size: 18px;
  font-weight: 600;
  min-width: 120px;
  text-align: right;
  font-family: 'DIN Alternate', monospace;
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

.demand-card-actions {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.demand-warning-inline {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 10px;
  background: #7f1d1d;
  border: 1px solid #f87171;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}

.demand-warning-title {
  font-size: 13px;
  font-weight: 700;
  color: #ffffff;
}

.demand-warning-text {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: #fee2e2;
}

.demand-action-btn {
  border: none;
  border-radius: 999px;
  background: rgba(255,255,255,0.22);
  color: white;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
}

.demand-action-btn.ghost {
  background: rgba(255,255,255,0.12);
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

.rebalance-card {
  margin-bottom: 20px;
  padding: 18px 20px;
  border-radius: 14px;
  background: #f8fbff;
  border: 1px solid #d7e8ff;
}

.rebalance-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.rebalance-subtitle {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.rebalance-list {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rebalance-complete-state {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 10px;
  background: #fff;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.rebalance-actions {
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
}

.rebalance-row {
  display: grid;
  grid-template-columns: 120px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 10px;
  background: #fff;
}

.rebalance-type {
  font-size: 14px;
  font-weight: 600;
}

.rebalance-values {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--text-secondary);
}

.rebalance-arrow {
  color: var(--text-tertiary);
}

.rebalance-target {
  color: var(--text-primary);
  font-weight: 600;
}

.rebalance-delta {
  font-size: 13px;
  font-weight: 600;
}

.rebalance-delta.increase {
  color: #1677ff;
}

.rebalance-delta.decrease {
  color: #d46b08;
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

.group-source {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
  background: rgba(52, 152, 219, 0.12);
  color: #2f6db3;
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

.btn-rollback-line {
  padding: 6px 12px;
  background: #fff7e6;
  color: #d46b08;
  border: 1px solid #ffd591;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.btn-rollback-line:hover {
  background: #ffe7ba;
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

.reserve-breakdown {
  margin-top: 20px;
  padding: 16px;
  background: var(--background-color);
  border-radius: 10px;
}

.reserve-header,
.reserve-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.reserve-header label,
.reserve-status span {
  font-size: 14px;
  color: var(--text-secondary);
}

.reserve-target,
.reserve-status strong {
  font-weight: 600;
  font-family: 'DIN Alternate', monospace;
  color: var(--text-primary);
}

.reserve-status .status-met {
  color: #16a34a;
}

.reserve-status .status-unmet {
  color: #dc2626;
}

.reserve-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 14px 0;
}

.reserve-item {
  background: white;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}

.reserve-item span {
  color: var(--text-secondary);
}

.reserve-item strong {
  font-weight: 600;
  font-family: 'DIN Alternate', monospace;
}

.reserve-status + .reserve-status {
  margin-top: 10px;
}

.form-error {
  margin-top: 12px;
  color: #ff4d4f;
  font-size: 13px;
  font-weight: 500;
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


