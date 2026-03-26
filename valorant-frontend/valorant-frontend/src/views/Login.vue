<template>
  <div class="auth-section">
    <div class="auth-layout">
      <div class="auth-hero" aria-hidden="true">
        <div class="little-person" :class="personStateClass">
          <div class="person-head">
            <div class="person-eye eye-left"></div>
            <div class="person-eye eye-right"></div>
            <div class="person-blush blush-left"></div>
            <div class="person-blush blush-right"></div>
            <div class="person-cover" aria-hidden="true"></div>
          </div>
          <div class="person-body"></div>
        </div>
        <div class="hero-text">
          <div class="hero-title">无畏契约估价中心</div>
          <div class="hero-subtitle">登录后即可配置皮肤价值，并实时与好友私聊</div>
        </div>
      </div>

      <div class="auth-box">
        <h2>{{ isLoginMode ? '欢迎登录' : '注册新账号' }}</h2>
        <input
          v-model="authForm.username"
          type="text"
          placeholder="请输入用户名"
          @focus="authFocus = 'username'"
          @blur="authFocus = null"
        />
        <input
          v-model="authForm.password"
          type="password"
          placeholder="请输入密码"
          @focus="authFocus = 'password'"
          @blur="authFocus = null"
          @keyup.enter="handleAuth"
        />
        <input
          v-if="!isLoginMode"
          v-model="authForm.confirmPassword"
          type="password"
          placeholder="请确认密码"
          @keyup.enter="handleAuth"
        />
        <button class="primary-btn" @click="handleAuth">{{ isLoginMode ? '登 录' : '注 册' }}</button>
        <p class="switch-mode">
          {{ isLoginMode ? '还没有账号？' : '已有账号？' }}
          <span @click="isLoginMode = !isLoginMode">{{ isLoginMode ? '立即注册' : '返回登录' }}</span>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToastStore } from '@/stores/toast'
import { useAuthStore } from '@/stores/auth'
import request from '@/utils/request'

const router = useRouter()
const toastStore = useToastStore()
const authStore = useAuthStore()

const authFocus = ref(null) // 'username' | 'password' | null
const isLoginMode = ref(true)
const authForm = ref({ username: '', password: '', confirmPassword: '' })

const personStateClass = computed(() => {
  if (authFocus.value === 'username') return 'look'
  if (authFocus.value === 'password') return 'shy'
  return 'idle'
})

const handleAuth = async () => {
  if (!authForm.value.username || !authForm.value.password) {
    return toastStore.showToast('⚠️ 用户名和密码不能为空', 'error')
  }
  if (!isLoginMode.value && authForm.value.password !== authForm.value.confirmPassword) {
    return toastStore.showToast('⚠️ 两次输入的密码不一致', 'error')
  }
  
  const endpoint = isLoginMode.value ? '/login' : '/register'
  try {
    const res = await request.post(endpoint, authForm.value)
    
    if (res.code === 200) {
      toastStore.showToast(`✅ ${res.message}`, 'success')
      if (isLoginMode.value) {
        authStore.setAuth(res.token, res.username)
        authForm.value = { username: '', password: '', confirmPassword: '' }
        router.push('/')
      } else {
        isLoginMode.value = true
        authForm.value = { username: '', password: '', confirmPassword: '' }
      }
    } else {
      toastStore.showToast(`❌ ${res.error}`, 'error')
    }
  } catch (error) { 
    toastStore.showToast('❌ 请求服务器失败', 'error') 
  }
}
</script>

<style scoped>
.auth-section { display: flex; align-items: center; justify-content: center; min-height: 70vh; }
.auth-layout { width: 100%; max-width: 980px; display: grid; grid-template-columns: 1fr 420px; gap: 28px; align-items: center; }
.auth-hero { display: flex; align-items: center; gap: 22px; padding: 20px; }
.hero-text { display: flex; flex-direction: column; gap: 10px; }
.hero-title { color: #ff4655; font-size: 40px; font-weight: 900; letter-spacing: 2px; line-height: 1.1; }
.hero-subtitle { color: #333; font-size: 14px; opacity: 0.75; }
.auth-box { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); width: 100%; max-width: 400px; text-align: center; }
.auth-box h2 { margin-bottom: 25px; color: #333; }
.auth-box input { width: 100%; padding: 14px; margin-bottom: 15px; border: 2px solid #eee; border-radius: 8px; font-size: 16px; outline: none; transition: 0.2s; box-sizing: border-box; }
.auth-box input:focus { border-color: #ff4655; }
.switch-mode { margin-top: 20px; color: #666; font-size: 14px; }
.switch-mode span { color: #ff4655; cursor: pointer; font-weight: bold; }
.switch-mode span:hover { text-decoration: underline; }

.primary-btn { width: 100%; padding: 15px; font-size: 18px; background-color: #ff4655; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; }
.primary-btn:hover { background-color: #e03e4d; }

/* ===== 登录页左侧小人形象（纯 CSS）===== */
.little-person {
  position: relative;
  width: 160px;
  height: 180px;
  flex: 0 0 auto;
  transform-origin: center;
  transition: transform 280ms cubic-bezier(0.2, 0.9, 0.2, 1);
}

.person-head {
  position: absolute;
  top: 0;
  left: 50%;
  width: 120px;
  height: 120px;
  transform: translateX(-50%);
  background: #fff;
  border: 3px solid rgba(255, 70, 85, 0.25);
  border-radius: 42px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.08);
  transition:
    transform 300ms cubic-bezier(0.2, 0.9, 0.2, 1),
    border-color 300ms ease;
}

.person-body {
  position: absolute;
  top: 105px;
  left: 50%;
  width: 95px;
  height: 70px;
  transform: translateX(-50%);
  background: linear-gradient(180deg, rgba(255,70,85,0.85), rgba(255,70,85,0.65));
  border-radius: 18px;
  box-shadow: 0 10px 25px rgba(255,70,85,0.15);
}

.person-eye {
  position: absolute;
  top: 46px;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: #111;
  transition: transform 220ms ease;
}
.eye-left { left: 34px; }
.eye-right { right: 34px; }

.person-blush {
  position: absolute;
  top: 74px;
  width: 18px;
  height: 10px;
  border-radius: 999px;
  background: rgba(255, 70, 85, 0.25);
  transition: opacity 220ms ease;
  opacity: 0.25;
}
.blush-left { left: 22px; }
.blush-right { right: 22px; }

.person-cover {
  position: absolute;
  top: 42px;
  left: 50%;
  width: 92px;
  height: 58px;
  transform: translateX(-50%) translateY(6px);
  background: rgba(60, 60, 60, 0.22);
  border: 2px solid rgba(60, 60, 60, 0.14);
  border-radius: 28px;
  opacity: 0;
  transition:
    opacity 220ms ease,
    transform 280ms cubic-bezier(0.2, 0.9, 0.2, 1);
  pointer-events: none;
  z-index: 2;
}

@keyframes eyeBlink {
  0% { transform: scaleY(1); }
  48% { transform: scaleY(1); }
  52% { transform: scaleY(0.15); }
  56% { transform: scaleY(1); }
  100% { transform: scaleY(1); }
}

/* 默认：站好 */
.little-person.idle .person-head {
  transform: translateX(-50%) translateY(0);
}

/* 输入用户名：探头看（朝右靠近表单） */
.little-person.look .person-head {
  transform: translateX(-50%) translateX(22px) translateY(8px) rotateZ(-4deg);
  border-color: rgba(16, 185, 129, 0.35);
}
.little-person.look .person-eye {
  transform: translateX(4px);
  animation: eyeBlink 2.6s ease-in-out infinite;
}
.little-person.look .person-blush {
  opacity: 0.4;
}
.little-person.look .person-cover {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}

/* 输入密码：害羞背对（头转开） */
.little-person.shy .person-head {
  transform: translateX(-50%) rotateY(180deg) translateY(2px) rotateZ(3deg);
  border-color: rgba(60, 60, 60, 0.2);
}
.little-person.shy .person-eye {
  transform: scaleX(0.2);
  opacity: 0.15;
}
.little-person.shy .person-blush {
  opacity: 0.12;
}
.little-person.shy .person-cover {
  opacity: 1;
  transform: translateX(-50%) translateY(2px);
}

@media (max-width: 900px) {
  .auth-layout { grid-template-columns: 1fr; }
  .auth-hero { justify-content: center; }
  .auth-box { max-width: 460px; margin: 0 auto; }
}
</style>
