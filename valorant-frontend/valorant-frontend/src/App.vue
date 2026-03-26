<template>
  <div class="container">
    <transition name="toast">
      <div v-if="toast.show" class="custom-toast" :class="toast.type">{{ toast.message }}</div>
    </transition>

    <div v-if="!token" class="auth-section">
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

    <div v-else class="main-system">
      <div class="header">
        <h1>无畏契约账号价值系统</h1>
        <div class="user-info">
          <span>欢迎你，<strong>{{ currentUser }}</strong></span>
          <button class="logout-btn" @click="logout">退出登录</button>
        </div>
      </div>

      <div class="nav-tabs">
        <button :class="{ active: currentTab === 'evaluate' }" @click="currentTab = 'evaluate'">账号估价台</button>
        <button :class="{ active: currentTab === 'config' }" @click="switchToConfig">皮肤价格配置</button>
        <button :class="{ active: currentTab === 'friends' }" @click="switchToFriends">好友</button>
      </div>

      <div v-if="currentTab === 'evaluate'" class="tab-content">
        <div class="input-section">
          <textarea v-model="inputText" placeholder="请在此处粘贴你的游戏库存文本..." rows="6"></textarea>
          <button class="primary-btn" @click="evaluateAccount" :disabled="isLoading">
            {{ isLoading ? '评估中...' : '一键评估价值' }}
          </button>
        </div>

        <div v-if="resultData" class="result-section">
          <h2>评估结果</h2>
          <div class="total-value">总价值: <span>{{ resultData.totalValue }}</span> 元</div>
          
          <div v-show="resultData.totalValue > 0" ref="chartRef" class="chart-container"></div>

          <table v-if="resultData.details && resultData.details.length > 0">
            <thead>
              <tr><th>武器</th><th>皮肤名称</th><th>你的估值 (元)</th></tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in resultData.details" :key="index">
                <td>{{ item.weapon }}</td>
                <td>{{ item.skin }}</td>
                <td :class="{ 'has-price': item.price > 0 }">{{ item.price > 0 ? item.price : '未定价' }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="no-data">未匹配到任何已定价的皮肤。</p>
        </div>
      </div>

      <div v-if="currentTab === 'config'" class="tab-content config-section">
        <p class="tips">在这里设置你专属的皮肤价值，每个人的定价都是独立的哦！</p>
        
        <!-- 添加筛选栏 -->
        <div class="filter-section">
          <select v-model="categoryFilter" class="filter-select">
            <option value="">全部分类</option>
            <option value="刀皮">刀皮</option>
            <option value="枪皮">枪皮</option>
          </select>
          <select v-model="weaponTypeFilter" class="filter-select">
            <option value="">全部武器类型</option>
            <option v-for="type in weaponTypes" :key="type" :value="type">{{ type }}</option>
          </select>
        </div>
        
        <table>
          <thead>
            <tr><th>分类</th><th>武器</th><th>皮肤名称</th><th>自定义价值 (元)</th><th>操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="skin in filteredSkinList" :key="skin.id">
              <td>{{ skin.category }}</td>
              <td>{{ skin.weapon_type }}</td>
              <td>{{ skin.skin_name }}</td>
              <td><input type="number" v-model="skin.price" class="price-input" min="0"></td>
              <td><button class="save-btn" @click="saveSkinPrice(skin)">保存</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="currentTab === 'friends'" class="tab-content friends-section">
        <div class="section-title">好友功能（MVP）</div>

        <div class="input-section friend-input-section">
          <input
            v-model="friendTargetUsername"
            type="text"
            placeholder="请输入要添加的用户名"
            class="friend-input"
            @keyup.enter="sendFriendRequest"
          />
          <button class="primary-btn" @click="sendFriendRequest" :disabled="isFriendsLoading">
            {{ isFriendsLoading ? '处理中...' : '发送好友请求' }}
          </button>
        </div>

        <div class="friends-grid">
          <div class="friends-block">
            <h2>我的好友</h2>
            <div v-if="friendList.length === 0" class="empty-state">暂无好友</div>
            <div
              v-else
              class="friend-row"
              v-for="f in friendList"
              :key="f.id"
              :class="{ active: selectedFriendId === f.id }"
              @click="selectFriend(f.id)"
            >
              <span class="friend-name">{{ f.username }}</span>
            </div>
          </div>

          <div class="friends-block chat-block">
            <h2>实时聊天</h2>

            <div v-if="!selectedFriendId" class="empty-state">请选择一个好友开始聊天</div>
            <div v-else>
              <div class="chat-header">
                <span>与</span>
                <strong>{{ selectedFriend ? selectedFriend.username : '' }}</strong>
                <span class="chat-tip">（实时）</span>
              </div>

              <div class="chat-messages">
                <div v-if="chatMessages.length === 0" class="empty-state">暂无消息</div>
                <div
                  v-else
                  v-for="m in chatMessages"
                  :key="m.id"
                  :class="['chat-bubble', m.sender_id === myUserId ? 'mine' : 'theirs']"
                >
                  <div class="chat-content">{{ m.content }}</div>
                  <div class="chat-time">{{ formatTime(m.created_at) }}</div>
                </div>
              </div>

              <div class="chat-input-row">
                <input
                  v-model="chatInput"
                  class="chat-input"
                  placeholder="输入消息..."
                  @keyup.enter="sendChatMessage"
                />
                <button class="send-btn" @click="sendChatMessage" :disabled="!isChatConnected || !chatInput.trim()">
                  发送
                </button>
              </div>
            </div>
          </div>

          <div class="friends-block">
            <h2>等待你同意</h2>
            <div v-if="incomingRequests.length === 0" class="empty-state">暂无待处理请求</div>
            <div v-else class="request-row" v-for="r in incomingRequests" :key="r.id">
              <div class="request-info">
                <span>来自</span>
                <strong>{{ r.from_username }}</strong>
              </div>
              <div class="request-actions">
                <button class="accept-btn" @click="acceptFriendRequest(r.id)" :disabled="isFriendsLoading">同意</button>
                <button class="reject-btn" @click="rejectFriendRequest(r.id)" :disabled="isFriendsLoading">拒绝</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import * as echarts from 'echarts'
import { io } from 'socket.io-client'
// ===== 核心改动 1：引入我们刚刚封装好的 Axios 请求工具 =====
import request from './utils/request'

const toast = ref({ show: false, message: '', type: 'success' })
const showToast = (message, type = 'success') => {
  toast.value = { show: true, message, type }
  setTimeout(() => { toast.value.show = false }, 3000)
}

const token = ref(localStorage.getItem('valorant_token') || '')
const currentUser = ref(localStorage.getItem('valorant_username') || '')
const authFocus = ref(null) // 'username' | 'password' | null
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
const isLoginMode = ref(true)
const authForm = ref({ username: '', password: '', confirmPassword: '' })

const personStateClass = computed(() => {
  if (authFocus.value === 'username') return 'look'
  if (authFocus.value === 'password') return 'shy'
  return 'idle'
})

// ===== 核心改动 2：登录/注册接口改用 Axios =====
const handleAuth = async () => {
  if (!authForm.value.username || !authForm.value.password) return showToast('⚠️ 用户名和密码不能为空', 'error')
  if (!isLoginMode.value && authForm.value.password !== authForm.value.confirmPassword) return showToast('⚠️ 两次输入的密码不一致', 'error')
  const endpoint = isLoginMode.value ? '/login' : '/register' // 因为 baseURL 配置了，直接写短路径
  try {
    const res = await request.post(endpoint, authForm.value)
    
    if (res.code === 200) {
      showToast(`✅ ${res.message}`, 'success')
      if (isLoginMode.value) {
        token.value = res.token
        currentUser.value = res.username
        myUserId.value = decodeJwtUserId(res.token)
        localStorage.setItem('valorant_token', res.token)
        localStorage.setItem('valorant_username', res.username)
        authForm.value = { username: '', password: '', confirmPassword: '' }
      } else {
        isLoginMode.value = true
        authForm.value = { username: '', password: '', confirmPassword: '' }
      }
    } else showToast(`❌ ${res.error}`, 'error')
  } catch (error) { 
    showToast('❌ 请求服务器失败', 'error') 
  }
}

const logout = () => {
  token.value = ''; currentUser.value = '';
  localStorage.removeItem('valorant_token'); localStorage.removeItem('valorant_username');
  currentTab.value = 'evaluate'; resultData.value = null;
  friendTargetUsername.value = ''
  friendList.value = []
  incomingRequests.value = []
  selectedFriendId.value = null
  chatMessages.value = []
  chatInput.value = ''
  myUserId.value = null
  if (chatSocket) {
    chatSocket.disconnect()
    chatSocket = null
  }
  showToast('👋 已退出登录', 'success')
}

const currentTab = ref('evaluate')
const inputText = ref('')
const resultData = ref(null)
const isLoading = ref(false)
const skinList = ref([])

// 皮肤筛选相关
const categoryFilter = ref('')
const weaponTypeFilter = ref('')

// 武器类型列表（从皮肤数据中提取）
const weaponTypes = computed(() => {
  const types = new Set()
  skinList.value.forEach(skin => {
    if (skin.weapon_type) types.add(skin.weapon_type)
  })
  return Array.from(types).sort()
})

// 筛选后的皮肤列表
const filteredSkinList = computed(() => {
  return skinList.value.filter(skin => {
    const categoryMatch = !categoryFilter.value || skin.category === categoryFilter.value
    const weaponMatch = !weaponTypeFilter.value || skin.weapon_type === weaponTypeFilter.value
    return categoryMatch && weaponMatch
  })
})

const friendTargetUsername = ref('')
const friendList = ref([])
const incomingRequests = ref([])
const isFriendsLoading = ref(false)

// ===== 实时聊天（Socket.IO）=====
let chatSocket = null
const isChatConnected = ref(false)
const selectedFriendId = ref(null)
const selectedFriend = computed(() => friendList.value.find(f => f.id === selectedFriendId.value) || null)
const chatMessages = ref([])
const chatInput = ref('')

const getRoomId = (userA, userB) => {
  const a = Number(userA)
  const b = Number(userB)
  const min = Math.min(a, b)
  const max = Math.max(a, b)
  return `room:${min}_${max}`
}

const currentRoomId = computed(() => {
  if (!myUserId.value || !selectedFriendId.value) return null
  return getRoomId(myUserId.value, selectedFriendId.value)
})

const chartRef = ref(null)
let myChart = null

const renderChart = () => {
  if (!chartRef.value || !resultData.value) return
  const categoryMap = { '刀皮': 0, '枪皮': 0 }
  resultData.value.details.forEach(item => {
    if (item.price > 0) {
      const isMelee = item.weapon.includes('近战') || item.weapon.includes('刀')
      categoryMap[isMelee ? '刀皮' : '枪皮'] += item.price
    }
  })
  const chartData = [
    { name: '刀皮资产', value: categoryMap['刀皮'] },
    { name: '枪皮资产', value: categoryMap['枪皮'] }
  ].filter(item => item.value > 0)

  if (chartData.length === 0) return
  if (myChart) myChart.dispose()
  myChart = echarts.init(chartRef.value)

  myChart.setOption({
    tooltip: { trigger: 'item', formatter: '{a} <br/>{b} : {c}元 ({d}%)' },
    legend: { bottom: '0', left: 'center' },
    color: ['#ff4655', '#10b981'],
    series: [
      {
        name: '资产占比', type: 'pie', radius: ['40%', '70%'], avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
        label: { show: false, position: 'center' },
        emphasis: { label: { show: true, fontSize: 20, fontWeight: 'bold' } },
        labelLine: { show: false }, data: chartData
      }
    ]
  })
}

// ===== 核心改动 3：彻底干掉了原生 fetch，代码大幅度精简！ =====
const evaluateAccount = async () => {
  if (!inputText.value.trim()) return showToast('⚠️ 请输入库存文本！', 'error')
  isLoading.value = true; resultData.value = null;
  try {
    // 你看！不用写 headers，不用查 401，就剩这么一句清爽的代码！
    const res = await request.post('/evaluate', { text: inputText.value })
    if (res.code === 200) {
      resultData.value = res.data
      nextTick(() => { if (resultData.value.totalValue > 0) renderChart() })
    } else showToast('❌ 评估失败: ' + res.error, 'error')
  } catch (error) {
    if(error.response?.status !== 401) showToast('❌ 请求失败！', 'error')
  } finally { isLoading.value = false }
}

const switchToConfig = async () => {
  currentTab.value = 'config'
  try {
    const res = await request.get('/skins') // 极其优雅的 GET 请求
    if (res.code === 200) skinList.value = res.data
  } catch (error) { console.error('获取列表失败', error) }
}

const saveSkinPrice = async (skin) => {
  try {
    const res = await request.post('/skins/price', { skinId: skin.id, price: Number(skin.price) })
    if (res.code === 200) showToast(`✅ [${skin.skin_name}] 更新为 ${skin.price} 元！`, 'success')
    else showToast('❌ 保存失败: ' + res.error, 'error')
  } catch (error) {
    if(error.response?.status !== 401) showToast('❌ 保存请求失败', 'error')
  }
}

const loadFriends = async () => {
  isFriendsLoading.value = true
  try {
    const [friendsRes, incomingRes] = await Promise.all([
      request.get('/friends/list'),
      request.get('/friends/requests/incoming')
    ])
    friendList.value = friendsRes?.code === 200 ? (friendsRes.data || []) : []
    incomingRequests.value = incomingRes?.code === 200 ? (incomingRes.data || []) : []
  } catch (error) {
    showToast('❌ 获取好友信息失败', 'error')
  } finally {
    isFriendsLoading.value = false
  }
}

const switchToFriends = async () => {
  currentTab.value = 'friends'
  await loadFriends()
  initChatSocket()
}

const sendFriendRequest = async () => {
  const target = friendTargetUsername.value?.trim()
  if (!target) return showToast('⚠️ 请输入要添加的用户名', 'error')

  isFriendsLoading.value = true
  try {
    const res = await request.post('/friends/request', { targetUsername: target })
    if (res?.code === 200) {
      showToast(`✅ ${res.message}`, 'success')
      friendTargetUsername.value = ''
      await loadFriends()
    } else {
      showToast('❌ ' + (res?.error || '发送失败'), 'error')
    }
  } catch (error) {
    const msg = error?.response?.data?.error || '发送失败'
    showToast('❌ ' + msg, 'error')
  } finally {
    isFriendsLoading.value = false
  }
}

const acceptFriendRequest = async (requestId) => {
  isFriendsLoading.value = true
  try {
    const res = await request.post(`/friends/requests/${requestId}/accept`)
    if (res?.code === 200) {
      showToast(`✅ ${res.message}`, 'success')
      await loadFriends()
    } else {
      showToast('❌ ' + (res?.error || '操作失败'), 'error')
    }
  } catch (error) {
    const msg = error?.response?.data?.error || '操作失败'
    showToast('❌ ' + msg, 'error')
  } finally {
    isFriendsLoading.value = false
  }
}

const rejectFriendRequest = async (requestId) => {
  isFriendsLoading.value = true
  try {
    const res = await request.post(`/friends/requests/${requestId}/reject`)
    if (res?.code === 200) {
      showToast(`✅ ${res.message}`, 'success')
      await loadFriends()
    } else {
      showToast('❌ ' + (res?.error || '操作失败'), 'error')
    }
  } catch (error) {
    const msg = error?.response?.data?.error || '操作失败'
    showToast('❌ ' + msg, 'error')
  } finally {
    isFriendsLoading.value = false
  }
}

const formatTime = (createdAt) => {
  try {
    const d = new Date(createdAt)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

const initChatSocket = () => {
  if (chatSocket) return

  const tokenStr = token.value || localStorage.getItem('valorant_token')
  if (!tokenStr) return

  chatSocket = io('http://localhost:3000', {
    auth: { token: tokenStr },
    transports: ['websocket'],
  })

  chatSocket.on('connect', () => {
    isChatConnected.value = true
  })

  chatSocket.on('disconnect', () => {
    isChatConnected.value = false
  })

  chatSocket.on('chat:error', ({ error }) => {
    showToast('❌ ' + (error || '聊天错误'), 'error')
  })

  chatSocket.on('chat:history', ({ roomId, messages }) => {
    if (currentRoomId.value && roomId !== currentRoomId.value) return
    chatMessages.value = messages || []
  })

  chatSocket.on('chat:message', (message) => {
    if (!selectedFriendId.value) return
    if (currentRoomId.value && message.room_id !== currentRoomId.value) return
    chatMessages.value.push(message)
  })
}

const selectFriend = (friendId) => {
  selectedFriendId.value = friendId
  chatMessages.value = []
  if (!chatSocket) initChatSocket()
  if (!chatSocket) return
  chatSocket.emit('chat:join', { toUserId: friendId })
  chatSocket.emit('chat:history', { toUserId: friendId, limit: 50 })
}

const sendChatMessage = () => {
  if (!selectedFriendId.value) return
  const text = chatInput.value.trim()
  if (!text) return
  if (!chatSocket) return showToast('❌ 聊天未连接', 'error')
  chatSocket.emit('chat:send', { toUserId: selectedFriendId.value, content: text })
  chatInput.value = ''
}

onBeforeUnmount(() => {
  if (chatSocket) chatSocket.disconnect()
  chatSocket = null
})
</script>
<style scoped>
/* 原有样式保留 */
.container { max-width: 900px; margin: 40px auto; padding: 20px; font-family: sans-serif; }
.custom-toast { position: fixed; top: 30px; left: 50%; transform: translateX(-50%); padding: 12px 24px; border-radius: 8px; color: white; font-size: 16px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999; }
.custom-toast.success { background-color: #10b981; }
.custom-toast.error { background-color: #ff4655; }
.toast-enter-active, .toast-leave-active { transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, -20px); }
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
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #eee; }
.header h1 { margin: 0; font-size: 28px; color: #333; }
.user-info { display: flex; align-items: center; gap: 20px; color: #666; }
.user-info strong { color: #ff4655; font-size: 18px; }
.logout-btn { background: none; border: 1px solid #ccc; padding: 6px 12px; border-radius: 6px; cursor: pointer; color: #666; transition: 0.2s; }
.logout-btn:hover { background: #f4f4f4; color: #ff4655; border-color: #ff4655; }
.nav-tabs { display: flex; justify-content: center; gap: 20px; margin-bottom: 30px; }
.nav-tabs button { padding: 10px 20px; font-size: 16px; border: none; background: none; cursor: pointer; color: #666; font-weight: bold; }
.nav-tabs button.active { color: #ff4655; border-bottom: 3px solid #ff4655; }
.nav-tabs button:hover { color: #ff4655; }
.tab-content { animation: fadeIn 0.3s ease-in-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.primary-btn { width: 100%; padding: 15px; font-size: 18px; background-color: #ff4655; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; }
.primary-btn:hover { background-color: #e03e4d; }
textarea { width: 100%; padding: 15px; font-size: 14px; border: 2px solid #ddd; border-radius: 8px; resize: vertical; margin-bottom: 15px; box-sizing: border-box; }
.result-section, .config-section { background-color: #f9f9f9; padding: 20px; border-radius: 12px; }
.total-value { font-size: 20px; font-weight: bold; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px dashed #ddd; text-align: center; }
.total-value span { color: #ff4655; font-size: 42px; margin: 0 10px; }
table { width: 100%; border-collapse: collapse; background-color: white; margin-top: 15px; }
th, td { border: 1px solid #eee; padding: 12px; text-align: left; }
th { background-color: #f4f4f4; }
.has-price { color: #10b981; font-weight: bold; }
.tips { color: #666; font-size: 14px; margin-bottom: 15px; }
.price-input { padding: 8px; border: 1px solid #ccc; border-radius: 4px; width: 100px; font-size: 16px; }
.save-btn { padding: 8px 15px; background-color: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; }
.save-btn:hover { background-color: #059669; }

/* ===== 新增：图表容器样式 ===== */
.chart-container {
  width: 100%;
  height: 300px;
  margin: 20px 0;
  background: white;
  border-radius: 8px;
  padding: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

/* ===== 好友功能样式 ===== */
.section-title {
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 16px;
  color: #333;
  text-align: center;
}

.friends-section {
  background-color: #f9f9f9;
  padding: 20px;
  border-radius: 12px;
}

.friend-input-section {
  display: grid;
  grid-template-columns: 1fr 220px;
  gap: 12px;
  align-items: center;
  margin-bottom: 18px;
}

.friend-input {
  width: 100%;
  padding: 14px;
  font-size: 14px;
  border: 2px solid #ddd;
  border-radius: 8px;
  outline: none;
  box-sizing: border-box;
}

.friends-grid {
  display: grid;
  grid-template-columns: 1fr 1.4fr 1fr;
  gap: 18px;
}

.friends-block {
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.friends-block h2 {
  margin: 0 0 12px 0;
  font-size: 18px;
  color: #333;
}

.empty-state {
  color: #888;
  font-size: 14px;
  padding: 10px 0;
}

.friend-row {
  padding: 10px 0;
  border-bottom: 1px solid #f1f1f1;
  cursor: pointer;
}

.friend-row.active {
  background: rgba(255, 70, 85, 0.06);
  border-bottom-color: rgba(255, 70, 85, 0.35);
}

.friend-name {
  color: #ff4655;
  font-weight: bold;
}

/* ===== 实时聊天样式 ===== */
.chat-block {
  display: flex;
  flex-direction: column;
  min-height: 420px;
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  color: #333;
}

.chat-tip {
  color: #10b981;
  font-size: 12px;
  font-weight: bold;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  background-color: #fff;
  border: 1px solid #f1f1f1;
  border-radius: 10px;
  padding: 12px;
  height: 290px;
}

.chat-bubble {
  max-width: 80%;
  padding: 10px 12px;
  border-radius: 12px;
  margin: 8px 0;
}

.chat-bubble.mine {
  margin-left: auto;
  background-color: #10b981;
  color: #fff;
}

.chat-bubble.theirs {
  margin-right: auto;
  background-color: #f4f4f4;
  color: #333;
}

.chat-content {
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-time {
  font-size: 12px;
  opacity: 0.75;
  margin-top: 6px;
  text-align: right;
}

.chat-input-row {
  display: grid;
  grid-template-columns: 1fr 100px;
  gap: 10px;
  margin-top: 12px;
}

.chat-input {
  width: 100%;
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 8px;
  outline: none;
  font-size: 14px;
}

.send-btn {
  padding: 12px 10px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  background-color: #ff4655;
  color: #fff;
  font-weight: bold;
  transition: 0.2s;
}

.send-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.send-btn:hover:not(:disabled) {
  background-color: #e03e4d;
}

.request-row {
  padding: 10px 0;
  border-bottom: 1px solid #f1f1f1;
}

.request-info {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
  color: #333;
}

.request-actions {
  display: flex;
  gap: 10px;
}

.accept-btn, .reject-btn {
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  border: none;
  font-weight: bold;
  color: white;
}

.accept-btn {
  background-color: #10b981;
}

.accept-btn:hover {
  background-color: #059669;
}

.reject-btn {
  background-color: #ff4655;
}

.reject-btn:hover {
  background-color: #e03e4d;
}
.config-section .filter-section {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.config-section .filter-select {
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: white;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s;
}

.config-section .filter-select:hover {
  border-color: #d1d5db;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

.config-section .filter-select:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}
</style>





