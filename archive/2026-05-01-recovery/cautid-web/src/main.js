import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'

// Import components
import Index from './components/Index.vue'
import Detail from './components/Detail.vue'
import Execute from './components/Execute.vue'
import Profile from './components/Profile.vue'

const routes = [
  { path: '/', component: Index },
  { path: '/detail', component: Detail },
  { path: '/execute', component: Execute },
  { path: '/profile', component: Profile }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const app = createApp(App)
app.use(router)
app.mount('#app')