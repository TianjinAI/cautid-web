<script setup>
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const tabs = [
  { path: '/', name: '规划', iconActive: 'home-active.png', icon: 'home.png' },
  { path: '/execute', name: '执行', iconActive: 'execute-active.png', icon: 'execute.png' },
  { path: '/profile', name: '我的', iconActive: 'profile-active.png', icon: 'profile.png' }
]

const isActive = (path) => route.path === path
</script>

<template>
  <div class="app">
    <router-view />

    <!-- Tab Bar - only show on main tabs -->
    <nav v-if="['/', '/execute', '/profile'].includes(route.path)" class="tab-bar">
      <a
        v-for="tab in tabs"
        :key="tab.path"
        :href="tab.path"
        class="tab-item"
        :class="{ active: isActive(tab.path) }"
      >
        <span class="tab-item-icon">{{ tab.name[0] }}</span>
        <span class="tab-item-label">{{ tab.name }}</span>
      </a>
    </nav>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  background-color: var(--background-color);
}

.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: var(--card-background);
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: space-around;
  align-items: center;
  z-index: 1000;
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  color: var(--text-secondary);
  font-size: 11px;
  transition: color 0.2s;
}

.tab-item.active {
  color: var(--primary-color);
}

.tab-item-icon {
  width: 24px;
  height: 24px;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.tab-item-label {
  font-size: 11px;
}
</style>
