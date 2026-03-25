import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Index',
    component: () => import('./pages/Index.vue')
  },
  {
    path: '/detail',
    name: 'Detail',
    component: () => import('./pages/Detail.vue')
  },
  {
    path: '/execute',
    name: 'Execute',
    component: () => import('./pages/Execute.vue')
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('./pages/Profile.vue')
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
