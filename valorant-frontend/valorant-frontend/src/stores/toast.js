import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useToastStore = defineStore('toast', () => {
  const toast = ref({ show: false, message: '', type: 'success' })
  let timer = null

  const showToast = (message, type = 'success') => {
    toast.value = { show: true, message, type }
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      toast.value.show = false
    }, 3000)
  }

  return { toast, showToast }
})
