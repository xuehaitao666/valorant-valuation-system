<template>
  <div class="dashboard-section">
    <div class="welcome-box">
      <h2>请选择你需要使用的功能</h2>
      <p class="subtitle">欢迎进入应用中心，在这里探索所有的功能模块。</p>
    </div>
    
    <div class="module-grid">
      <div class="module-card brand-red" @click="$router.push('/evaluate')">
        <div class="module-icon">💎</div>
        <h3 class="module-title">账号估价台</h3>
        <p class="module-desc">粘贴你的游戏库存文本，一键智能分析所有皮肤资产，并生成直观的图表报告。</p>
        <div class="module-arrow">前往使用 ➔</div>
      </div>
      
      <div class="module-card brand-blue" @click="$router.push('/config')">
        <div class="module-icon">🛠️</div>
        <h3 class="module-title">皮肤价格配置</h3>
        <p class="module-desc">定制你专属的武器和皮肤价值模型，每个人都可以拥有独立、个性化的定价体系。</p>
        <div class="module-arrow">前往使用 ➔</div>
      </div>
      
      <div class="module-card brand-green" @click="$router.push('/friends')">
        <div class="module-icon">💬</div>
        <h3 class="module-title">好友系统</h3>
        <p class="module-desc">添加好友，并在实时聊天室中进行沟通交流，自由讨论估价经验与交易信息。</p>
        <div class="module-arrow">前往使用 ➔</div>
      </div>
    </div>
  </div>
</template>

<script setup>
// Dashboard is pure UI, route methods are handled inline.
</script>

<style scoped>
.dashboard-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
}

.welcome-box {
  text-align: center;
  margin-bottom: 40px;
}
.welcome-box h2 {
  font-size: 28px;
  color: #333;
  margin-bottom: 10px;
}
.subtitle {
  color: #777;
  font-size: 16px;
}

.module-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 25px;
  width: 100%;
  max-width: 900px;
}

.module-card {
  background: white;
  border-radius: 16px;
  padding: 30px 25px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  position: relative;
  overflow: hidden;
  border: 2px solid transparent;
}
.module-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.1);
}

.module-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 6px;
  background: #eee;
  transition: background 0.3s ease;
}

.module-card.brand-red:hover { border-color: rgba(255, 70, 85, 0.3); }
.module-card.brand-red:hover::before { background: #ff4655; }
.module-card.brand-blue:hover { border-color: rgba(59, 130, 246, 0.3); }
.module-card.brand-blue:hover::before { background: #3b82f6; }
.module-card.brand-green:hover { border-color: rgba(16, 185, 129, 0.3); }
.module-card.brand-green:hover::before { background: #10b981; }

.module-icon {
  font-size: 42px;
  margin-bottom: 20px;
  line-height: 1;
}

.module-title {
  font-size: 20px;
  color: #222;
  margin: 0 0 15px 0;
  font-weight: 800;
}

.module-desc {
  color: #666;
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 25px;
  flex-grow: 1;
}

.module-arrow {
  font-size: 14px;
  font-weight: bold;
  color: #ff4655;
  margin-top: auto;
  opacity: 0.8;
  transition: all 0.2s ease;
}
.module-card.brand-blue .module-arrow { color: #3b82f6; }
.module-card.brand-green .module-arrow { color: #10b981; }

.module-card:hover .module-arrow {
  opacity: 1;
  transform: translateX(4px);
}
</style>
