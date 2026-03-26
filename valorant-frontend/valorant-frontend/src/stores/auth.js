import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('valorant_token') || '')
  const currentUser = ref(localStorage.getItem('valorant_username') || '')

  const decodeJwtUserId = (jwtStr) => {
    try {
      if (!jwtStr) return null
      const payload = jwtStr.split('.')[1]
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
      const decoded = JSON.parse(atob(padded))
      const userId = decoded?.userId
      return userId ? Number(userId) : null
    } catch {
      return null
    }
  }

  const myUserId = ref(decodeJwtUserId(token.value))

  const setAuth = (newToken, newUsername) => {
    token.value = newToken
    currentUser.value = newUsername
    myUserId.value = decodeJwtUserId(newToken)
    localStorage.setItem('valorant_token', newToken)
    localStorage.setItem('valorant_username', newUsername)
  }

  const logout = () => {
    token.value = ''
    currentUser.value = ''
    myUserId.value = null
    localStorage.removeItem('valorant_token')
    localStorage.removeItem('valorant_username')
  }

  return { token, currentUser, myUserId, setAuth, logout }
})
