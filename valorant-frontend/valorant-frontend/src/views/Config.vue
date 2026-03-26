<template>
  <div class="config-section">
    <p class="tips">在这里设置你专属的皮肤价值，每个人的定价都是独立的哦！</p>
    
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
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useToastStore } from '@/stores/toast'
import request from '@/utils/request'

const toastStore = useToastStore()

const skinList = ref([])
const categoryFilter = ref('')
const weaponTypeFilter = ref('')

const weaponTypes = computed(() => {
  const types = new Set()
  skinList.value.forEach(skin => {
    if (skin.weapon_type) types.add(skin.weapon_type)
  })
  return Array.from(types).sort()
})

const filteredSkinList = computed(() => {
  return skinList.value.filter(skin => {
    const categoryMatch = !categoryFilter.value || skin.category === categoryFilter.value
    const weaponMatch = !weaponTypeFilter.value || skin.weapon_type === weaponTypeFilter.value
    return categoryMatch && weaponMatch
  })
})

const loadSkins = async () => {
  try {
    const res = await request.get('/skins')
    if (res.code === 200) skinList.value = res.data
  } catch (error) { 
    console.error('获取列表失败', error) 
  }
}

const saveSkinPrice = async (skin) => {
  try {
    const res = await request.post('/skins/price', { skinId: skin.id, price: Number(skin.price) })
    if (res.code === 200) {
      toastStore.showToast(`✅ [${skin.skin_name}] 更新为 ${skin.price} 元！`, 'success')
    } else {
      toastStore.showToast('❌ 保存失败: ' + res.error, 'error')
    }
  } catch (error) {
    if(error.response?.status !== 401) toastStore.showToast('❌ 保存请求失败', 'error')
  }
}

onMounted(() => {
  loadSkins()
})
</script>

<style scoped>
.config-section { background-color: #f9f9f9; padding: 20px; border-radius: 12px; }
.tips { color: #666; font-size: 14px; margin-bottom: 15px; }

.filter-section {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
}
.filter-select {
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
  background-color: white;
  min-width: 150px;
  font-size: 14px;
}

table { width: 100%; border-collapse: collapse; background-color: white; margin-top: 15px; }
th, td { border: 1px solid #eee; padding: 12px; text-align: left; }
th { background-color: #f4f4f4; }
.price-input { padding: 8px; border: 1px solid #ccc; border-radius: 4px; width: 100px; font-size: 16px; }
.save-btn { padding: 8px 15px; background-color: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; }
.save-btn:hover { background-color: #059669; }
</style>
