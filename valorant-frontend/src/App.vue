<template>
  <div class="container">
    <transition name="toast">
      <div v-if="toastStore.toast.show" class="custom-toast" :class="toastStore.toast.type">{{ toastStore.toast.message }}</div>
    </transition>

    <router-view v-slot="{ Component }">
      <transition name="page-fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </div>
</template>

<script setup>
import { useToastStore } from '@/stores/toast'

const toastStore = useToastStore()
</script>

<style scoped>
.container { max-width: 900px; margin: 40px auto; padding: 20px; font-family: sans-serif; }

.custom-toast { 
  position: fixed; 
  top: 30px; 
  left: 50%; 
  transform: translateX(-50%); 
  padding: 12px 24px; 
  border-radius: 8px; 
  color: white; 
  font-size: 16px; 
  font-weight: bold; 
  box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
  z-index: 9999; 
}
.custom-toast.success { background-color: #10b981; }
.custom-toast.error { background-color: #ff4655; }

.toast-enter-active, .toast-leave-active { transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, -20px); }

.page-fade-enter-active, .page-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.page-fade-enter-from, .page-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
