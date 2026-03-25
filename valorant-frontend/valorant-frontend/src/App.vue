<template>
  <div class="container">
    <transition name="toast">
      <div v-if="toast.show" class="custom-toast" :class="toast.type">{{ toast.message }}</div>
    </transition>

    <div v-if="!token" class="auth-section">
      <h1 class="logo-title">无畏契约估价中心</h1>
      <div class="auth-box">
        <h2>{{ isLoginMode ? '欢迎登录' : '注册新账号' }}</h2>
        <input v-model="authForm.username" type="text" placeholder="请输入用户名" />
        <input v-model="authForm.password" type="password" placeholder="请输入密码" @keyup.enter="handleAuth" />
        <button class="primary-btn" @click="handleAuth">{{ isLoginMode ? '登 录' : '注 册' }}</button>
        <p class="switch-mode">
          {{ isLoginMode ? '还没有账号？' : '已有账号？' }}
          <span @click="isLoginMode = !isLoginMode">{{ isLoginMode ? '立即注册' : '返回登录' }}</span>
        </p>
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
        <table>
          <thead>
            <tr><th>分类</th><th>武器</th><th>皮肤名称</th><th>自定义价值 (元)</th><th>操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="skin in skinList" :key="skin.id">
              <td>{{ skin.category }}</td>
              <td>{{ skin.weapon_type }}</td>
              <td>{{ skin.skin_name }}</td>
              <td><input type="number" v-model="skin.price" class="price-input" min="0"></td>
              <td><button class="save-btn" @click="saveSkinPrice(skin)">保存</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import * as echarts from 'echarts'
// ===== 核心改动 1：引入我们刚刚封装好的 Axios 请求工具 =====
import request from './utils/request'

const toast = ref({ show: false, message: '', type: 'success' })
const showToast = (message, type = 'success') => {
  toast.value = { show: true, message, type }
  setTimeout(() => { toast.value.show = false }, 3000)
}

const token = ref(localStorage.getItem('valorant_token') || '')
const currentUser = ref(localStorage.getItem('valorant_username') || '')
const isLoginMode = ref(true)
const authForm = ref({ username: '', password: '' })

// ===== 核心改动 2：登录/注册接口改用 Axios =====
const handleAuth = async () => {
  if (!authForm.value.username || !authForm.value.password) return showToast('⚠️ 用户名和密码不能为空', 'error')
  const endpoint = isLoginMode.value ? '/login' : '/register' // 因为 baseURL 配置了，直接写短路径
  try {
    const res = await request.post(endpoint, authForm.value)
    
    if (res.code === 200) {
      showToast(`✅ ${res.message}`, 'success')
      if (isLoginMode.value) {
        token.value = res.token
        currentUser.value = res.username
        localStorage.setItem('valorant_token', res.token)
        localStorage.setItem('valorant_username', res.username)
        authForm.value = { username: '', password: '' }
      } else {
        isLoginMode.value = true
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
  showToast('👋 已退出登录', 'success')
}

const currentTab = ref('evaluate')
const inputText = ref('')
const resultData = ref(null)
const isLoading = ref(false)
const skinList = ref([])

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
</script>

<style scoped>
/* 原有样式保留 */
.container { max-width: 900px; margin: 40px auto; padding: 20px; font-family: sans-serif; }
.custom-toast { position: fixed; top: 30px; left: 50%; transform: translateX(-50%); padding: 12px 24px; border-radius: 8px; color: white; font-size: 16px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999; }
.custom-toast.success { background-color: #10b981; }
.custom-toast.error { background-color: #ff4655; }
.toast-enter-active, .toast-leave-active { transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, -20px); }
.auth-section { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; }
.logo-title { color: #ff4655; font-size: 36px; margin-bottom: 30px; letter-spacing: 2px; }
.auth-box { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); width: 100%; max-width: 400px; text-align: center; }
.auth-box h2 { margin-bottom: 25px; color: #333; }
.auth-box input { width: 100%; padding: 14px; margin-bottom: 15px; border: 2px solid #eee; border-radius: 8px; font-size: 16px; outline: none; transition: 0.2s; box-sizing: border-box; }
.auth-box input:focus { border-color: #ff4655; }
.switch-mode { margin-top: 20px; color: #666; font-size: 14px; }
.switch-mode span { color: #ff4655; cursor: pointer; font-weight: bold; }
.switch-mode span:hover { text-decoration: underline; }
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
</style>