<script setup>
import { useRouter, useRoute } from 'vue-router'
import Icon from './components/Icon.vue'

const router = useRouter()
const route = useRoute()

const navItems = [
  { path: '/', name: '规划', icon: 'planning' },
  { path: '/execute', name: '执行', icon: 'execute' },
  { path: '/profile', name: '我的', icon: 'profile' }
]

const isActive = (path) => route.path === path

const getPageTitle = () => {
  const item = navItems.find(item => item.path === route.path)
  return item ? item.name : '财梯'
}
</script>

<template>
  <div class="app-layout">
    <!-- Sidebar Navigation -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <div class="sidebar-logo-icon">财</div>
          <span>财梯</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="sidebar-item"
          :class="{ active: isActive(item.path) }"
        >
          <Icon :name="item.icon" :size="20" class="sidebar-item-icon" />
          <span>{{ item.name }}</span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        存款规划助手 v1.0
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="main-content">
      <!-- Top Header -->
      <header class="top-header">
        <div class="header-left">
          <nav class="breadcrumb">
            <span class="breadcrumb-item">财梯</span>
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-item active">{{ getPageTitle() }}</span>
          </nav>
        </div>
        <div class="header-actions">
          <!-- Optional: Add user menu or other actions here -->
        </div>
      </header>

      <!-- Page Content -->
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: var(--sidebar-width);
  background: var(--card-background);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 1000;
}

.sidebar-header {
  padding: 24px;
  border-bottom: 1px solid var(--border-color);
}

.sidebar-logo {
  font-size: 24px;
  font-weight: 700;
  color: var(--primary-color);
  display: flex;
  align-items: center;
  gap: 12px;
}

.sidebar-logo-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, var(--primary-color), #06AD56);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
}

.sidebar-nav {
  flex: 1;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 8px;
  text-decoration: none;
  color: var(--text-secondary);
  font-size: 15px;
  font-weight: 500;
  transition: all 0.2s;
}

.sidebar-item:hover {
  background: rgba(12, 193, 96, 0.05);
  color: var(--text-primary);
}

.sidebar-item.active {
  background: rgba(12, 193, 96, 0.1);
  color: var(--primary-color);
}

.sidebar-item-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.8;
}

.sidebar-item.active .sidebar-item-icon {
  opacity: 1;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: center;
}

.main-content {
  flex: 1;
  margin-left: var(--sidebar-width);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.top-header {
  height: var(--header-height);
  background: var(--card-background);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--secondary-color);
}

.header-left {
  display: flex;
  align-items: center;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
}

.breadcrumb-item {
  color: var(--text-secondary);
  font-weight: 500;
}

.breadcrumb-item.active {
  color: var(--secondary-color);
  font-weight: 600;
}

.breadcrumb-separator {
  color: var(--text-tertiary);
}

.header-actions {
  display: flex;
  gap: 12px;
}

/* Mobile responsive - hide sidebar, show bottom nav */
@media (max-width: 768px) {
  .sidebar {
    display: none;
  }

  .main-content {
    margin-left: 0;
  }

  .top-header {
    padding: 0 16px;
  }
}
</style>
