import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

import Login from '@/views/Login.vue'
import Layout from '@/views/Layout.vue'
import Dashboard from '@/views/Dashboard.vue'
import Evaluate from '@/views/Evaluate.vue'
import Config from '@/views/Config.vue'
import Friends from '@/views/Friends.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: Login,
    },
    {
      path: '/',
      name: 'layout',
      component: Layout,
      children: [
        {
          path: '', // Default to Dashboard when hitting root
          name: 'dashboard',
          component: Dashboard,
        },
        {
          path: 'evaluate',
          name: 'evaluate',
          component: Evaluate,
        },
        {
          path: 'config',
          name: 'config',
          component: Config,
        },
        {
          path: 'friends',
          name: 'friends',
          component: Friends,
        }
      ]
    }
  ],
})

// Navigation Guard
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  const isAuthenticated = !!authStore.token

  if (to.name !== 'login' && !isAuthenticated) {
    next({ name: 'login' })
  } else if (to.name === 'login' && isAuthenticated) {
    next({ name: 'dashboard' })
  } else {
    next()
  }
})

export default router
