import { defineStore } from 'pinia'
import { ref, watch, computed } from 'vue'
import { useAuthStore } from './auth'

export const useHistoryStore = defineStore('history', () => {
  const authStore = useAuthStore()
  
  // Create an isolated storage key bound to the user so histories don't mix between accounts
  const storageKey = computed(() => `val_history_${authStore.currentUser || 'guest'}`)
  
  const historyList = ref([])

  // Initialize history from localStorage
  const loadHistory = () => {
    try {
      const data = localStorage.getItem(storageKey.value)
      if (data) {
        historyList.value = JSON.parse(data)
      } else {
        historyList.value = []
      }
    } catch (e) {
      historyList.value = []
    }
  }

  // Load history whenever the current user changes (e.g., login/logout)
  watch(() => authStore.currentUser, () => {
    loadHistory()
  }, { immediate: true })

  // Save specific evaluation to history
  const saveEvaluation = (label, originalText, resultData) => {
    if (!label) return
    
    const existingIndex = historyList.value.findIndex(item => item.label === label)
    
    const newRecord = {
      label,
      text: originalText,
      result: resultData,
      timestamp: new Date().toISOString()
    }
    
    if (existingIndex > -1) {
      // Overwrite existing record with the same label
      historyList.value.splice(existingIndex, 1, newRecord)
    } else {
      // Unshift to the beginning of the list (newest first)
      historyList.value.unshift(newRecord)
    }
    
    // Persist to local storage
    localStorage.setItem(storageKey.value, JSON.stringify(historyList.value))
  }

  // Optional: remove an evaluation if needed
  const removeEvaluation = (label) => {
    historyList.value = historyList.value.filter(item => item.label !== label)
    localStorage.setItem(storageKey.value, JSON.stringify(historyList.value))
  }

  return { 
    historyList, 
    loadHistory, 
    saveEvaluation, 
    removeEvaluation 
  }
})
