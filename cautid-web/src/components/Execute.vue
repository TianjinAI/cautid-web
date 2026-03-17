<template>
  <div class="execute-page">
    <h1>计划执行</h1>

    <div v-if="planData" class="execution-controls">
      <div class="current-day">
        <h3>当前进度: 第{{ currentDay }}天</h3>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: (currentDay / planData.planDuration * 100) + '%' }"
          ></div>
        </div>
        <p>{{ Math.round(currentDay / planData.planDuration * 100) }}%</p>
      </div>

      <div class="controls">
        <button @click="prevDay" class="btn-secondary">前一天</button>
        <button @click="nextDay" class="btn-primary">后一天</button>
        <button @click="resetProgress" class="btn-secondary">重置</button>
      </div>
    </div>

    <div v-if="planData" class="execution-details">
      <div class="deposits-section">
        <h2>当前存款列表</h2>
        <div
          v-for="deposit in activeDeposits"
          :key="deposit.id"
          class="deposit-card"
          :class="{ matured: isMatured(deposit) }"
        >
          <h3>{{ deposit.name }}</h3>
          <p><strong>本金:</strong> {{ formatNumber(deposit.principal) }}元</p>
          <p><strong>利率:</strong> {{ (deposit.rate * 100).toFixed(2) }}%</p>
          <p><strong>存期:</strong> {{ deposit.days }}天</p>
          <p><strong>起始日:</strong> 第{{ deposit.startDay }}天</p>
          <p><strong>到期日:</strong> 第{{ deposit.startDay + deposit.days }}天</p>

          <div v-if="isMatured(deposit)" class="maturity-info">
            <p><strong>已到期</strong></p>
            <p>本息: {{ formatNumber(calculateMaturityAmount(deposit)) }}元</p>
          </div>

          <div v-else class="status">
            <p>状态: 进行中</p>
          </div>
        </div>
      </div>

      <div class="events-section">
        <h2>今日事件</h2>
        <div v-if="todaysEvents.length > 0">
          <div v-for="(event, index) in todaysEvents" :key="index" class="event-item">
            <p><strong>{{ event.type }}:</strong> {{ event.note }}</p>
            <p>本金: {{ formatNumber(event.principal) }}元</p>
            <p v-if="event.maturityAmount">本息: {{ formatNumber(event.maturityAmount) }}元</p>
          </div>
        </div>
        <div v-else>
          <p>今天没有特殊事件</p>
        </div>
      </div>

      <div class="summary-section">
        <h2>资产概览</h2>
        <p><strong>可用资金:</strong> {{ formatNumber(availableFunds) }}元</p>
        <p><strong>目标金额:</strong> {{ formatNumber(planData.targetAmount) }}元</p>
        <p :class="{ 'deficit': hasDeficit }">
          <strong>资金缺口:</strong> {{ deficit > 0 ? formatNumber(deficit) : '无' }}元
        </p>
      </div>
    </div>

    <div v-else class="error">
      <p>未找到计划数据</p>
      <button @click="goBack" class="btn-secondary">返回</button>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getPlan, calculateMaturityAmount, formatNumber, checkDeficit } from '../utils/format';

export default {
  name: 'Execute',
  setup() {
    const route = useRoute();
    const router = useRouter();

    const planData = ref(null);
    const currentDay = ref(0);

    onMounted(() => {
      const planId = route.query.planId;
      if (planId) {
        const storedPlan = getPlan(planId);
        if (storedPlan) {
          planData.value = storedPlan;
          // Restore progress if saved
          const savedProgress = localStorage.getItem(`progress_${planId}`);
          if (savedProgress) {
            currentDay.value = parseInt(savedProgress);
          }
        }
      }
    });

    // Computed properties
    const activeDeposits = computed(() => {
      if (!planData.value) return [];

      // At the start, only show initial deposits
      if (currentDay.value === 0) {
        return planData.value.deposits.filter(deposit => deposit.startDay <= 0);
      }

      // As time progresses, show all deposits that have started
      return planData.value.deposits.filter(deposit => deposit.startDay <= currentDay.value);
    });

    const todaysEvents = computed(() => {
      if (!planData.value) return [];

      const events = [];

      // Check for maturity events today
      activeDeposits.value.forEach(deposit => {
        const maturityDay = deposit.startDay + deposit.days;
        if (maturityDay === currentDay.value) {
          events.push({
            type: 'maturity',
            note: `${deposit.name} 到期`,
            principal: deposit.principal,
            maturityAmount: calculateMaturityAmount(deposit.principal, deposit.rate, deposit.days)
          });
        }
      });

      // Check for quarterly additions
      planData.value.quarters.forEach(quarter => {
        if (quarter.startDay === currentDay.value && quarter.plannedInput > 0) {
          events.push({
            type: 'addition',
            note: `第${quarter.index + 1}季度追加投入`,
            principal: quarter.plannedInput
          });
        }
      });

      return events;
    });

    const availableFunds = computed(() => {
      if (!planData.value) return 0;

      let funds = 0;

      activeDeposits.value.forEach(deposit => {
        const maturityDay = deposit.startDay + deposit.days;

        if (maturityDay <= currentDay.value) {
          // Already matured
          funds += calculateMaturityAmount(deposit.principal, deposit.rate, deposit.days);
        } else {
          // Not yet matured, could be withdrawn early with penalty
          const daysElapsed = currentDay.value - deposit.startDay;
          if (daysElapsed > 0) {
            // Simplified early withdrawal calculation
            funds += deposit.principal * (1 + deposit.rate * daysElapsed / 365 * 0.7);
          }
        }
      });

      return funds;
    });

    const deficitInfo = computed(() => {
      if (!planData.value) return { hasDeficit: false, deficit: 0 };

      return checkDeficit(activeDeposits.value, planData.value.targetAmount, currentDay.value);
    });

    const hasDeficit = computed(() => deficitInfo.value.hasDeficit);
    const deficit = computed(() => deficitInfo.value.deficit);

    // Methods
    const isMatured = (deposit) => {
      return deposit.startDay + deposit.days <= currentDay.value;
    };

    const calculateMaturityAmount = (principal, rate, days) => {
      return principal * (1 + rate * days / 365);
    };

    const nextDay = () => {
      if (planData.value && currentDay.value < planData.value.planDuration) {
        currentDay.value++;
        saveProgress();
      }
    };

    const prevDay = () => {
      if (currentDay.value > 0) {
        currentDay.value--;
        saveProgress();
      }
    };

    const resetProgress = () => {
      currentDay.value = 0;
      const planId = route.query.planId;
      if (planId) {
        localStorage.removeItem(`progress_${planId}`);
      }
    };

    const saveProgress = () => {
      const planId = route.query.planId;
      if (planId) {
        localStorage.setItem(`progress_${planId}`, currentDay.value.toString());
      }
    };

    const goBack = () => {
      router.go(-1);
    };

    return {
      planData,
      currentDay,
      activeDeposits,
      todaysEvents,
      availableFunds,
      hasDeficit,
      deficit,
      formatNumber,
      isMatured,
      calculateMaturityAmount,
      nextDay,
      prevDay,
      resetProgress,
      goBack
    };
  }
};
</script>

<style scoped>
.execute-page {
  padding: 20px;
}

.execution-controls {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.current-day h3 {
  margin-top: 0;
}

.progress-bar {
  width: 100%;
  height: 20px;
  background-color: #e0e0e0;
  border-radius: 10px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: #007aff;
  transition: width 0.3s ease;
}

.controls {
  margin-top: 15px;
  display: flex;
  gap: 10px;
  justify-content: center;
}

.deposit-card {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 15px;
}

.deposit-card.matured {
  border-left: 4px solid #34c759;
}

.maturity-info {
  margin-top: 10px;
  padding: 10px;
  background-color: #f0f9ff;
  border-radius: 4px;
}

.status {
  margin-top: 10px;
  padding: 10px;
  background-color: #fff9f0;
  border-radius: 4px;
}

.event-item {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 10px;
}

.summary-section {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  margin-top: 20px;
}

.deficit {
  color: #ff3b30;
  font-weight: bold;
}

.btn-primary, .btn-secondary {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.btn-primary {
  background-color: #007aff;
  color: white;
}

.btn-primary:hover {
  background-color: #0062cc;
}

.btn-secondary {
  background-color: #8e8e93;
  color: white;
}

.btn-secondary:hover {
  background-color: #6e6e73;
}

.error {
  text-align: center;
  padding: 40px;
}

.error p {
  font-size: 18px;
  color: #ff3b30;
}
</style>