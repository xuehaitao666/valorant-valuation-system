<template>
  <div class="main-system">
    <div class="header">
      <div class="header-left">
        <button v-if="!isHomeRoute" class="back-btn" @click="$router.push('/')" title="返回主列表">
          <span class="icon">➔</span> 返回主页
        </button>
        <h1>无畏契约账号价值系统</h1>
      </div>
      <div class="user-info">
        <span>欢迎你，<strong>{{ authStore.currentUser }}</strong></span>
        <button class="logout-btn" @click="handleLogout">退出登录</button>
      </div>
    </div>

    <!-- The current matched page component will be injected here, taking up its own space -->
    <router-view class="page-content" v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const toastStore = useToastStore()

// If the route is exactly the root '/', we are on the Dashboard homepage.
const isHomeRoute = computed(() => route.path === '/')

const handleLogout = () => {
  authStore.logout()
  toastStore.showToast('👋 已退出登录', 'success')
  router.push('/login')
}
</script>

<style scoped>
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #eee; }
.header-left { display: flex; align-items: center; gap: 15px; }

.back-btn { background: white; border: 2px solid #eee; padding: 6px 14px; border-radius: 8px; cursor: pointer; color: #666; font-weight: bold; transition: all 0.2s ease; display: flex; align-items: center; gap: 6px; }
.back-btn:hover { background: #fffcfc; border-color: #ff4655; color: #ff4655; transform: translateY(-1px); box-shadow: 0 4px 10px rgba(255, 70, 85, 0.1); }
.back-btn .icon { transform: scaleX(-1); display: inline-block; font-size: 14px; }

.header h1 { margin: 0; font-size: 28px; color: #333; }
.user-info { display: flex; align-items: center; gap: 20px; color: #666; }
.user-info strong { color: #ff4655; font-size: 18px; }
.logout-btn { background: none; border: 1px solid #ccc; padding: 6px 12px; border-radius: 6px; cursor: pointer; color: #666; transition: 0.2s; }
.logout-btn:hover { background: #f4f4f4; color: #ff4655; border-color: #ff4655; }

.page-content { animation: fadeIn 0.3s ease-in-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
