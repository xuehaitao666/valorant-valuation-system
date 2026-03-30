<template>
  <div class="evaluate-container">
    <div class="left-panel">
      <!-- Valuation Input Section -->
      <div class="input-section">
        <input 
          v-model="evaluationLabel" 
          placeholder="给这次估价打个标签 (例如: 主账号, 小号1)" 
          class="label-input"
        />
        <textarea v-model="inputText" placeholder="请在此处粘贴你的游戏库存文本..." rows="6"></textarea>
        <button class="primary-btn" @click="evaluateAccount" :disabled="isLoading">
          {{ isLoading ? '评估中...' : '一键评估价值' }}
        </button>
      </div>

      <!-- Result Section -->
      <div v-if="resultData" class="result-section">
        <h2>评估结果 <span v-if="evaluationLabel" class="result-label">({{ evaluationLabel }})</span></h2>
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

    <!-- History Panel -->
    <div class="history-panel">
      <h3>历史记录</h3>
      <input v-model="searchQuery" placeholder="搜索已保存的标签..." class="search-input" />
      
      <div class="history-list">
        <div v-if="filteredHistory.length === 0" class="no-history">暂无匹配的历史记录</div>
        <div 
          v-else
          v-for="record in filteredHistory" 
          :key="record.label" 
          class="history-card"
          @click="loadHistoryRecord(record)"
        >
          <div class="history-card-header">
            <span class="history-label">{{ record.label }}</span>
            <button class="delete-btn" @click.stop="deleteHistoryRecord(record.label)">删除</button>
          </div>
          <div class="history-card-body">
            <div>总价值: <strong class="history-price">{{ record.result.totalValue }}</strong> 元</div>
            <div class="history-time">{{ new Date(record.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short'}) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import * as echarts from 'echarts'
import { useToastStore } from '@/stores/toast'
import { useHistoryStore } from '@/stores/history'
import request from '@/utils/request'

const toastStore = useToastStore()
const historyStore = useHistoryStore()

const evaluationLabel = ref('')
const inputText = ref('')
const resultData = ref(null)
const isLoading = ref(false)
const chartRef = ref(null)
let myChart = null

const searchQuery = ref('')
const filteredHistory = computed(() => {
  if (!searchQuery.value.trim()) return historyStore.historyList
  return historyStore.historyList.filter(item => 
    item.label.toLowerCase().includes(searchQuery.value.trim().toLowerCase())
  )
})

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

const evaluateAccount = async () => {
  if (!inputText.value.trim()) return toastStore.showToast('⚠️ 请输入库存文本！', 'error')
  isLoading.value = true
  
  try {
    const res = await request.post('/evaluate', { text: inputText.value })
    if (res.code === 200) {
      resultData.value = res.data
      
      // Save logic: Requires a label to save
      if (evaluationLabel.value.trim()) {
        historyStore.saveEvaluation(evaluationLabel.value.trim(), inputText.value, res.data)
        toastStore.showToast(`✅ 已自动保存为 [${evaluationLabel.value}] 记录`, 'success')
      }

      nextTick(() => { if (resultData.value.totalValue > 0) renderChart() })
    } else {
      toastStore.showToast('❌ 评估失败: ' + res.error, 'error')
    }
  } catch (error) {
    if(error.response?.status !== 401) toastStore.showToast('❌ 请求失败！', 'error')
  } finally { 
    isLoading.value = false 
  }
}

const loadHistoryRecord = (record) => {
  evaluationLabel.value = record.label
  inputText.value = record.text
  resultData.value = record.result
  nextTick(() => { if (resultData.value.totalValue > 0) renderChart() })
  toastStore.showToast(`✅ 已加载历史记录 [${record.label}]`, 'success')
}

const deleteHistoryRecord = (label) => {
  historyStore.removeEvaluation(label)
  toastStore.showToast(`🗑️ 已删除记录 [${label}]`, 'success')
  if (evaluationLabel.value === label) {
    evaluationLabel.value = ''
    inputText.value = ''
    resultData.value = null
  }
}
</script>

<style scoped>
.evaluate-container {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 25px;
  align-items: start;
}
@media (max-width: 900px) {
  .evaluate-container { grid-template-columns: 1fr; }
}

.left-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.label-input {
  width: 100%;
  padding: 12px 15px;
  font-size: 15px;
  border: 2px solid #ddd;
  border-radius: 8px;
  margin-bottom: 12px;
  box-sizing: border-box;
  outline: none;
  transition: 0.2s;
  font-weight: bold;
  color: #333;
}
.label-input:focus { border-color: #ff4655; }

.primary-btn { width: 100%; padding: 15px; font-size: 18px; background-color: #ff4655; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; }
.primary-btn:hover { background-color: #e03e4d; }
.primary-btn:disabled { opacity: 0.7; cursor: not-allowed; }

textarea { width: 100%; padding: 15px; font-size: 14px; border: 2px solid #ddd; border-radius: 8px; resize: vertical; margin-bottom: 15px; box-sizing: border-box; }

.result-section { background-color: #f9f9f9; padding: 20px; border-radius: 12px; }
.result-label { color: #ff4655; font-size: 16px; font-weight: normal; margin-left: 8px; }
.total-value { font-size: 20px; font-weight: bold; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px dashed #ddd; text-align: center; }
.total-value span { color: #ff4655; font-size: 42px; margin: 0 10px; }

table { width: 100%; border-collapse: collapse; background-color: white; margin-top: 15px; }
th, td { border: 1px solid #eee; padding: 12px; text-align: left; }
th { background-color: #f4f4f4; }
.has-price { color: #10b981; font-weight: bold; }
.no-data { color: #888; text-align: center; margin-top: 20px; }

.chart-container {
  width: 100%;
  height: 300px;
  margin: 20px 0;
  background: white;
  border-radius: 8px;
  padding: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

/* History Panel Styles */
.history-panel {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
}
.history-panel h3 { margin-top: 0; margin-bottom: 15px; color: #333; }

.search-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  margin-bottom: 15px;
  box-sizing: border-box;
  outline: none;
  font-size: 14px;
}
.search-input:focus { border-color: #ff4655; }

.history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 600px;
  overflow-y: auto;
  padding-right: 5px;
}

.no-history { color: #999; font-size: 14px; text-align: center; padding: 20px 0; }

.history-card {
  padding: 12px;
  border: 1px solid #eee;
  border-radius: 8px;
  cursor: pointer;
  background: #fdfdfd;
  transition: all 0.2s ease;
}
.history-card:hover {
  border-color: #ff4655;
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(255, 70, 85, 0.1);
}

.history-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.history-label { font-weight: bold; color: #333; font-size: 15px; }
.delete-btn { background: #ffeeee; color: #ff4655; border: none; border-radius: 4px; padding: 4px 8px; font-size: 12px; cursor: pointer; }
.delete-btn:hover { background: #ff4655; color: white; }

.history-card-body { font-size: 13px; color: #666; display: flex; justify-content: space-between; align-items: flex-end; }
.history-price { color: #10b981; font-size: 14px; }
.history-time { font-size: 11px; color: #999; }
</style>
