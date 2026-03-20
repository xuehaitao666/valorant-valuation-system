<template>
  <div class="container">
    <transition name="toast">
      <div v-if="toast.show" class="custom-toast" :class="toast.type">
        {{ toast.message }}
      </div>
    </transition>

    <h1>无畏契约账号价值系统</h1>

    <div class="nav-tabs">
      <button :class="{ active: currentTab === 'evaluate' }" @click="currentTab = 'evaluate'">账号估价台</button>
      <button :class="{ active: currentTab === 'config' }" @click="switchToConfig">皮肤价格配置</button>
    </div>

    <div v-if="currentTab === 'evaluate'" class="tab-content">
      <div class="input-section">
        <textarea
          v-model="inputText"
          placeholder="请在此处粘贴你的游戏库存文本..."
          rows="6"
        ></textarea>
        <button class="primary-btn" @click="evaluateAccount" :disabled="isLoading">
          {{ isLoading ? '评估中...' : '一键评估价值' }}
        </button>
      </div>

      <div v-if="resultData" class="result-section">
        <h2>评估结果</h2>
        <div class="total-value">总价值: <span>{{ resultData.totalValue }}</span> 元</div>
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
      <p class="tips">在这里设置你心目中每个皮肤的价值，设置后会自动保存并在估价时生效。</p>
      <table>
        <thead>
          <tr>
            <th>分类</th>
            <th>武器</th>
            <th>皮肤名称</th>
            <th>自定义价值 (元)</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="skin in skinList" :key="skin.id">
            <td>{{ skin.category }}</td>
            <td>{{ skin.weapon_type }}</td>
            <td>{{ skin.skin_name }}</td>
            <td>
              <input type="number" v-model="skin.price" class="price-input" min="0">
            </td>
            <td>
              <button class="save-btn" @click="saveSkinPrice(skin)">保存</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
<script setup>
import { ref } from 'vue'

// ===== 新增：轻提示控制状态与函数 =====
const toast = ref({ show: false, message: '', type: 'success' })

const showToast = (message, type = 'success') => {
  toast.value = { show: true, message, type }
  // 3秒后自动消失
  setTimeout(() => {
    toast.value.show = false
  }, 3000)
}

// 全局状态控制
const currentTab = ref('evaluate') // 当前所在标签页

// --- 估价台相关的状态和逻辑 ---
const inputText = ref('')
const resultData = ref(null)
const isLoading = ref(false)

const evaluateAccount = async () => {
  if (!inputText.value.trim()) return showToast('⚠️ 请输入库存文本！', 'error')
  
  isLoading.value = true
  resultData.value = null
  
  try {
    const response = await fetch('http://localhost:3000/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: inputText.value, userId: 1 })
    })
    const res = await response.json()
    
    if (res.code === 200) {
      resultData.value = res.data
    } else {
      showToast('❌ 评估失败: ' + res.error, 'error')
    }
  } catch (error) {
    showToast('❌ 请求失败，请检查后端是否运行！', 'error')
  } finally {
    isLoading.value = false
  }
}

// --- 配置台相关的状态和逻辑 ---
const skinList = ref([])

// 切换到配置台时，向后端请求最新的皮肤列表
const switchToConfig = async () => {
  currentTab.value = 'config'
  try {
    const response = await fetch('http://localhost:3000/api/skins?userId=1')
    const res = await response.json()
    if (res.code === 200) skinList.value = res.data
  } catch (error) {
    console.error('获取皮肤列表失败:', error)
  }
}

// 保存单个皮肤的价格
const saveSkinPrice = async (skin) => {
  try {
    const response = await fetch('http://localhost:3000/api/skins/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 1,
        skinId: skin.id,
        price: Number(skin.price) // 确保传给后端的是数字
      })
    })
    const res = await response.json()
    
    if (res.code === 200) {
      showToast(`✅ [${skin.skin_name}] 价格已更新为 ${skin.price} 元！`, 'success')
    } else {
      showToast('❌ 保存失败: ' + res.error, 'error')
    }
  } catch (error) {
    showToast('❌ 保存请求失败', 'error')
  }
}
</script>
<style scoped>
/* 样式部分 */
.container { max-width: 900px; margin: 40px auto; padding: 20px; font-family: sans-serif; }
h1 { text-align: center; color: #333; margin-bottom: 20px; }

/* 导航标签样式 */
.nav-tabs { display: flex; justify-content: center; gap: 20px; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 10px; }
.nav-tabs button { padding: 10px 20px; font-size: 16px; border: none; background: none; cursor: pointer; color: #666; font-weight: bold; }
.nav-tabs button.active { color: #ff4655; border-bottom: 3px solid #ff4655; }
.nav-tabs button:hover { color: #ff4655; }

.tab-content { animation: fadeIn 0.3s ease-in-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

/* 通用样式 */
.primary-btn { width: 100%; padding: 15px; font-size: 18px; background-color: #ff4655; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; }
.primary-btn:hover { background-color: #e03e4d; }
textarea { width: 100%; padding: 15px; font-size: 14px; border: 2px solid #ddd; border-radius: 8px; resize: vertical; margin-bottom: 15px; }
.result-section, .config-section { background-color: #f9f9f9; padding: 20px; border-radius: 12px; }
.total-value { font-size: 20px; font-weight: bold; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px dashed #ddd; }
.total-value span { color: #ff4655; font-size: 36px; margin: 0 10px; }

/* 表格样式 */
table { width: 100%; border-collapse: collapse; background-color: white; margin-top: 15px; }
th, td { border: 1px solid #eee; padding: 12px; text-align: left; }
th { background-color: #f4f4f4; }
.has-price { color: #10b981; font-weight: bold; }

/* 配置台专属样式 */
.tips { color: #666; font-size: 14px; margin-bottom: 15px; }
.price-input { padding: 8px; border: 1px solid #ccc; border-radius: 4px; width: 100px; font-size: 16px; }
.save-btn { padding: 8px 15px; background-color: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; }
.save-btn:hover { background-color: #059669; }


/* ===== 新增：轻提示专属样式 ===== */
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
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  display: flex;
  align-items: center;
}

/* 成功状态为绿色，错误状态为无畏契约红 */
.custom-toast.success { background-color: #10b981; }
.custom-toast.error { background-color: #ff4655; }

/* 丝滑的出现/消失动画 */
.toast-enter-active, .toast-leave-active {
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.toast-enter-from, .toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -20px);
}
</style>