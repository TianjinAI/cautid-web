<template>
  <div class="profile-page">
    <h1>我的方案</h1>

    <div v-if="plans.length > 0" class="plans-list">
      <div v-for="planItem in plans" :key="planItem.key" class="plan-card">
        <h3>{{ getPlanTitle(planItem.plan) }}</h3>
        <p>目标金额: {{ formatNumber(planItem.plan.targetAmount) }}元</p>
        <p>年利率: {{ (planItem.plan.rate * 100).toFixed(2) }}%</p>
        <p>期限: {{ planItem.plan.planDuration }}天</p>

        <div class="plan-actions">
          <button @click="viewPlan(planItem.key)" class="btn-view">查看</button>
          <button @click="deletePlan(planItem.key)" class="btn-delete">删除</button>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <p>暂无保存的方案</p>
      <button @click="goToIndex" class="btn-primary">去创建方案</button>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getAllPlans, getPlan, removePlan, formatNumber } from '../utils/format';

export default {
  name: 'Profile',
  setup() {
    const router = useRouter();

    const plans = ref([]);

    onMounted(() => {
      refreshPlansList();
    });

    const refreshPlansList = () => {
      plans.value = getAllPlans();
    };

    const getPlanTitle = (plan) => {
      if (plan.initialDeposit) {
        return `方案 - ${formatNumber(plan.initialDeposit)}元起`;
      }
      return '存款方案';
    };

    const viewPlan = (planId) => {
      router.push({ path: '/detail', query: { planId } });
    };

    const deletePlan = (planId) => {
      if (confirm('确定要删除这个方案吗？')) {
        removePlan(planId);
        // Remove from progress tracking as well
        localStorage.removeItem(`progress_${planId}`);
        refreshPlansList();
      }
    };

    const goToIndex = () => {
      router.push('/');
    };

    return {
      plans,
      formatNumber,
      getPlanTitle,
      viewPlan,
      deletePlan,
      goToIndex
    };
  }
};
</script>

<style scoped>
.profile-page {
  padding: 20px;
}

.plans-list {
  display: grid;
  gap: 20px;
}

.plan-card {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
}

.plan-card h3 {
  margin-top: 0;
  color: #333;
}

.plan-actions {
  margin-top: 15px;
  display: flex;
  gap: 10px;
}

.btn-view, .btn-delete {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-view {
  background-color: #007aff;
  color: white;
}

.btn-view:hover {
  background-color: #0062cc;
}

.btn-delete {
  background-color: #ff3b30;
  color: white;
}

.btn-delete:hover {
  background-color: #e31b0c;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.empty-state p {
  font-size: 18px;
  color: #666;
  margin-bottom: 20px;
}

.btn-primary {
  padding: 12px 24px;
  background-color: #007aff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
}

.btn-primary:hover {
  background-color: #0062cc;
}
</style>