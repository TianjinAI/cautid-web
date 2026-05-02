<template>
  <div class="detail-page">
    <h1>计划详情</h1>

    <div v-if="planData" class="plan-summary">
      <div class="summary-item">
        <h3>计划概览</h3>
        <p>总资金: {{ formatNumber(planData.totalAmount) }}元</p>
        <p>目标金额: {{ formatNumber(planData.targetAmount) }}元</p>
        <p>每季度追加: {{ formatNumber(planData.quarterlyInput) }}元</p>
        <p>年利率: {{ (planData.rate * 100).toFixed(2) }}%</p>
        <p>计划期限: {{ planData.planDuration }}天</p>
      </div>

      <div class="summary-item">
        <h3>资金分配</h3>
        <p>初始存款: {{ formatNumber(planData.initialDeposit) }}元</p>
        <p>储备资金: {{ formatNumber(planData.reserveFund) }}元</p>
      </div>
    </div>

    <div v-if="planData" class="quarters-section">
      <h2>各季度计划</h2>
      <div v-for="quarter in planData.quarters" :key="quarter.index" class="quarter-card">
        <h3>第{{ quarter.index + 1 }}季度 (第{{ quarter.startDay }}天 - 第{{ quarter.endDay }}天)</h3>

        <div v-if="quarter.deposits.length > 0">
          <h4>本季度存款</h4>
          <ul>
            <li v-for="deposit in quarter.deposits" :key="deposit.id">
              <strong>{{ deposit.name }}:</strong>
              {{ formatNumber(deposit.principal) }}元,
              {{ (deposit.rate * 100).toFixed(2) }}%,
              {{ deposit.days }}天
            </li>
          </ul>
        </div>

        <div v-if="quarter.maturityEvents.length > 0">
          <h4>到期事件</h4>
          <ul>
            <li v-for="event in quarter.maturityEvents" :key="event.depositId">
              <strong>{{ event.depositName }}:</strong>
              到期日{{ event.maturityDay }}天,
              本息{{ formatNumber(event.maturityAmount) }}元,
              实际收益率{{ event.yield.toFixed(2) }}%
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div v-if="planData" class="events-section">
      <h2>关键事件</h2>
      <div v-for="event in planData.events" :key="event.day" class="event-item">
        <p><strong>第{{ event.day }}天:</strong> 季度结束</p>
        <p>总资产: {{ formatNumber(event.totalAssets) }}元</p>
        <p :class="{ 'deficit': event.hasDeficit }">
          资金缺口: {{ event.deficit > 0 ? formatNumber(event.deficit) : '无' }}元
        </p>
      </div>
    </div>

    <div class="actions">
      <button @click="goBack" class="btn-secondary">返回</button>
      <button @click="goToExecute" class="btn-primary">执行计划</button>
    </div>
  </div>

  <div v-else class="error">
    <p>未找到计划数据</p>
    <button @click="goBack" class="btn-secondary">返回首页</button>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { formatNumber, getPlan } from '../utils/format';

export default {
  name: 'Detail',
  setup() {
    const route = useRoute();
    const router = useRouter();

    const planData = ref(null);

    onMounted(() => {
      const planId = route.query.planId;
      if (planId) {
        const storedPlan = getPlan(planId);
        if (storedPlan) {
          planData.value = storedPlan;
        }
      }
    });

    const goBack = () => {
      router.go(-1);
    };

    const goToExecute = () => {
      router.push({ path: '/execute', query: { planId: route.query.planId } });
    };

    return {
      planData,
      formatNumber,
      goBack,
      goToExecute
    };
  }
};
</script>

<style scoped>
.detail-page {
  padding: 20px;
}

.plan-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 30px;
}

.summary-item {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
}

.summary-item h3 {
  margin-top: 0;
  color: #007aff;
}

.quarter-card {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 15px;
}

.quarter-card h3 {
  margin-top: 0;
  color: #333;
}

.event-item {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 10px;
}

.deficit {
  color: #ff3b30;
  font-weight: bold;
}

.actions {
  margin-top: 30px;
  display: flex;
  gap: 10px;
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