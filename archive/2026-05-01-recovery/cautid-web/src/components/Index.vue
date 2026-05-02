<template>
  <div class="index-page">
    <h1>财梯 - 存款规划助手</h1>

    <div class="form-container">
      <div class="form-group">
        <label>总资金:</label>
        <input
          type="number"
          v-model="formData.totalAmount"
          placeholder="输入可用资金"
          class="input-field"
        />
      </div>

      <div class="form-group">
        <label>目标金额:</label>
        <input
          type="number"
          v-model="formData.targetAmount"
          placeholder="输入期望达到的目标"
          class="input-field"
        />
      </div>

      <div class="form-group">
        <label>每季度追加:</label>
        <input
          type="number"
          v-model="formData.quarterlyInput"
          placeholder="每季度可追加的金额"
          class="input-field"
        />
      </div>

      <div class="form-group">
        <label>年利率 (%):</label>
        <input
          type="number"
          v-model="formData.rate"
          step="0.01"
          placeholder="如 2.5"
          class="input-field"
        />
      </div>

      <div class="form-group">
        <label>计划期限 (天):</label>
        <input
          type="number"
          v-model="formData.planDuration"
          placeholder="如 365"
          class="input-field"
        />
      </div>

      <button @click="generatePlan" class="btn-primary">生成计划</button>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { generatePlan } from '../utils/format';

export default {
  name: 'Index',
  setup() {
    const router = useRouter();

    const formData = ref({
      totalAmount: 100000,
      targetAmount: 120000,
      quarterlyInput: 5000,
      rate: 2.5,
      planDuration: 365
    });

    const generatePlanHandler = () => {
      // Normalize rate from percentage to decimal
      const planData = generatePlan(
        parseFloat(formData.value.totalAmount) || 0,
        parseFloat(formData.value.targetAmount) || 0,
        parseFloat(formData.value.quarterlyInput) || 0,
        (parseFloat(formData.value.rate) || 0) / 100,
        parseInt(formData.value.planDuration) || 365
      );

      // Store plan in localStorage
      const planId = `plan_${Date.now()}`;
      localStorage.setItem(planId, JSON.stringify(planData));

      // Navigate to detail page
      router.push({ path: '/detail', query: { planId } });
    };

    return {
      formData,
      generatePlan: generatePlanHandler
    };
  }
};
</script>

<style scoped>
.index-page {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}

.form-container {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: #333;
}

.input-field {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
  box-sizing: border-box;
}

.btn-primary {
  width: 100%;
  padding: 12px;
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