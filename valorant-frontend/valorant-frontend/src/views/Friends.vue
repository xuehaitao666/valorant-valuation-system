<template>
  <div class="friends-section">
    <div class="section-title">好友功能</div>

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
      <!-- Friend List -->
      <div class="friends-block overflow-block">
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
          <span v-if="unreadCounts[f.id]" class="unread-badge">{{ unreadCounts[f.id] > 99 ? '99+' : unreadCounts[f.id] }}</span>
        </div>
      </div>

      <!-- Realtime Chat -->
      <div class="friends-block chat-block">
        <h2>实时聊天</h2>

        <div v-if="!selectedFriendId" class="empty-state centered-empty">请选择一个好友开始聊天</div>
        <div v-else class="chat-wrapper">
          <div class="chat-header">
            <span>与</span>
            <strong>{{ selectedFriend ? selectedFriend.username : '' }}</strong>
            <span class="chat-tip">（实时）</span>
          </div>

          <div class="chat-messages" ref="messagesContainer">
            <div v-if="chatMessages.length === 0" class="empty-state">暂无消息</div>
            <div
              v-else
              v-for="m in chatMessages"
              :key="m.id"
              :class="['chat-bubble', m.sender_id === authStore.myUserId ? 'mine' : 'theirs']"
            >
              <div class="chat-content">
                <img v-if="m.content.startsWith('[IMG]')" :src="m.content.replace('[IMG]', '')" class="chat-image" @click="previewImage(m.content)" />
                <span v-else>{{ m.content }}</span>
              </div>
              <div class="chat-time">{{ formatTime(m.created_at) }}</div>
            </div>
          </div>

          <!-- Extra Tools (Emoji & Images) -->
          <div class="chat-tools">
            <button class="tool-btn" @click.stop="showEmojiPicker = !showEmojiPicker" title="发送表情">😀</button>
            <button class="tool-btn" @click="$refs.imageInput.click()" title="发送图片">📷</button>
            <input type="file" ref="imageInput" accept="image/*" style="display:none" @change="handleImageUpload" />
            
            <div v-if="showEmojiPicker" class="emoji-picker popover">
              <span v-for="emoji in emojis" :key="emoji" @click="addEmoji(emoji)" class="emoji-item">{{ emoji }}</span>
            </div>
          </div>

          <!-- Input Row -->
          <div class="chat-input-row">
            <input
              v-model="chatInput"
              class="chat-input"
              placeholder="大吉大利，今晚吃鸡..."
              @keyup.enter="sendChatMessage"
            />
            <button class="send-btn" @click="sendChatMessage" :disabled="!isChatConnected || (!chatInput.trim() && !isUploading)">
              发送
            </button>
          </div>
        </div>
      </div>

      <!-- Pending Requests -->
      <div class="friends-block overflow-block">
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
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { io } from 'socket.io-client'
import { useToastStore } from '@/stores/toast'
import { useAuthStore } from '@/stores/auth'
import request from '@/utils/request'

const toastStore = useToastStore()
const authStore = useAuthStore()

const friendTargetUsername = ref('')
const friendList = ref([])
const incomingRequests = ref([])
const isFriendsLoading = ref(false)

// Chat systems
let chatSocket = null
const isChatConnected = ref(false)
const selectedFriendId = ref(null)
const selectedFriend = computed(() => friendList.value.find(f => f.id === selectedFriendId.value) || null)
const chatMessages = ref([])
const chatInput = ref('')
const unreadCounts = ref({}) // Dictionary tracking unread notifications { id: limit }
const messagesContainer = ref(null)

// Extra Tools
const imageInput = ref(null)
const isUploading = ref(false)
const showEmojiPicker = ref(false)
const emojis = ['😃','😂','🥰','😍','😎','😭','😡','😈','👍','👎','❤️','🔥','🎉','✨','🔫']

const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// Global click to close emoji picker
const closeEmojiPopover = () => { showEmojiPicker.value = false }

const getRoomId = (userA, userB) => {
  const a = Number(userA)
  const b = Number(userB)
  return `room:${Math.min(a, b)}_${Math.max(a, b)}`
}

const currentRoomId = computed(() => {
  if (!authStore.myUserId || !selectedFriendId.value) return null
  return getRoomId(authStore.myUserId, selectedFriendId.value)
})

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
    toastStore.showToast('❌ 获取好友信息失败', 'error')
  } finally {
    isFriendsLoading.value = false
  }
}

const sendFriendRequest = async () => { /* ...existing... */
  const target = friendTargetUsername.value?.trim()
  if (!target) return toastStore.showToast('⚠️ 请输入用户名', 'error')
  isFriendsLoading.value = true
  try {
    const res = await request.post('/friends/request', { targetUsername: target })
    if (res?.code === 200) { toastStore.showToast(`✅ ${res.message}`, 'success'); friendTargetUsername.value = ''; await loadFriends() }
    else toastStore.showToast('❌ ' + (res?.error || '发送失败'), 'error')
  } catch (err) { toastStore.showToast('❌ 发送失败', 'error') }
  finally { isFriendsLoading.value = false }
}

const acceptFriendRequest = async (id) => {
  isFriendsLoading.value = true
  try {
    const res = await request.post(`/friends/requests/${id}/accept`)
    if (res?.code === 200) { toastStore.showToast(`✅ 已添加好友`, 'success'); await loadFriends() }
  } catch (err) { toastStore.showToast('❌ 操作失败', 'error') }
  finally { isFriendsLoading.value = false }
}

const rejectFriendRequest = async (id) => {
  isFriendsLoading.value = true
  try {
    const res = await request.post(`/friends/requests/${id}/reject`)
    if (res?.code === 200) { toastStore.showToast(`✅ 已拒绝请求`, 'success'); await loadFriends() }
  } catch (err) { toastStore.showToast('❌ 操作失败', 'error') }
  finally { isFriendsLoading.value = false }
}

const formatTime = (createdAt) => {
  try {
    const d = new Date(createdAt)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

const initChatSocket = () => {
  if (chatSocket) return
  if (!authStore.token) return

  chatSocket = io('http://localhost:3000', {
    auth: { token: authStore.token },
    transports: ['websocket'],
  })

  chatSocket.on('connect', () => { isChatConnected.value = true })
  chatSocket.on('disconnect', () => { isChatConnected.value = false })
  chatSocket.on('chat:error', ({ error }) => { toastStore.showToast('❌ ' + (error || '聊天错误'), 'error') })

  chatSocket.on('chat:history', ({ roomId, messages }) => {
    if (currentRoomId.value && roomId !== currentRoomId.value) return
    chatMessages.value = messages || []
    scrollToBottom()
  })

  // Detect incoming message
  chatSocket.on('chat:message', (message) => {
    const sender = Number(message.sender_id)
    const active = Number(selectedFriendId.value)
    const me = Number(authStore.myUserId)

    // Append logic
    if (sender === active || sender === me) {
      chatMessages.value.push(message)
      scrollToBottom()
    } else {
      // Unread Tracking Layer 
      // User is talking entirely to someone else, but got a message from `sender`
      unreadCounts.value[sender] = (unreadCounts.value[sender] || 0) + 1
    }
  })
}

const selectFriend = (friendId) => {
  selectedFriendId.value = friendId
  unreadCounts.value[friendId] = 0 // Wipe unread dot
  chatMessages.value = []
  showEmojiPicker.value = false
  if (!chatSocket) initChatSocket()
  if (!chatSocket) return
  chatSocket.emit('chat:join', { toUserId: friendId })
  chatSocket.emit('chat:history', { toUserId: friendId, limit: 50 })
}

const sendChatMessage = () => {
  if (!selectedFriendId.value) return
  const text = chatInput.value.trim()
  if (!text) return
  if (!chatSocket) return toastStore.showToast('❌ 聊天未连接', 'error')
  
  chatSocket.emit('chat:send', { toUserId: selectedFriendId.value, content: text })
  chatInput.value = ''
  showEmojiPicker.value = false
  scrollToBottom()
}

// Media Logic 📸 ============================
const addEmoji = (emoji) => {
  chatInput.value += emoji
}

const handleImageUpload = (e) => {
  const file = e.target.files[0]
  if (!file) return
  
  isUploading.value = true
  const reader = new FileReader()
  reader.onload = (event) => {
    const img = new Image()
    img.src = event.target.result
    img.onload = () => {
      // Compress to 800px max
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const MAX = 600
      let w = img.width
      let h = img.height

      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round((h * MAX) / w); w = MAX } 
        else { w = Math.round((w * MAX) / h); h = MAX }
      }
      canvas.width = w; canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h)
      
      const compressedData = canvas.toDataURL('image/jpeg', 0.8)
      if (chatSocket) {
        chatSocket.emit('chat:send', { toUserId: selectedFriendId.value, content: `[IMG]${compressedData}` })
        scrollToBottom()
      }
      isUploading.value = false
    }
  }
  reader.readAsDataURL(file)
  e.target.value = '' // reset input
}

const previewImage = (imgContent) => {
  // basic open-in-new tab logic could go here or full-screen overlay popup
  const base64 = imgContent.replace('[IMG]', '')
  const win = window.open()
  win.document.write(`<iframe src="${base64}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`)
}

onMounted(() => {
  loadFriends()
  initChatSocket()
  window.addEventListener('click', closeEmojiPopover)
})

onBeforeUnmount(() => {
  if (chatSocket) chatSocket.disconnect()
  chatSocket = null
  window.removeEventListener('click', closeEmojiPopover)
})
</script>

<style scoped>
.section-title { font-size: 20px; font-weight: bold; margin-bottom: 16px; color: #333; text-align: center; }
.friends-section { background-color: #f9f9f9; padding: 20px; border-radius: 12px; height: calc(100vh - 120px); display: flex; flex-direction: column; }

.friend-input-section { display: grid; grid-template-columns: 1fr 220px; gap: 12px; margin-bottom: 18px; flex-shrink: 0; }
.friend-input { width: 100%; padding: 12px 16px; border: 2px solid #ddd; border-radius: 8px; font-size: 16px; outline: none; box-sizing: border-box; transition: 0.2s; }
.friend-input:focus { border-color: #ff4655; }
.primary-btn { padding: 12px 16px; font-size: 16px; background-color: #ff4655; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; height: 100%; }
.primary-btn:hover { background-color: #e03e4d; }

.friends-grid { display: grid; grid-template-columns: 240px 1fr 280px; gap: 20px; height: 100%; min-height: 0; }
@media (max-width: 900px) { .friends-grid { grid-template-columns: 1fr; } }

.friends-block { background: white; border-radius: 8px; padding: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.03); display: flex; flex-direction: column; min-height: 0; }
.overflow-block { overflow-y: auto; }

.friends-block h2 { font-size: 16px; margin-top: 0; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #eee; color: #333; flex-shrink: 0; }
.empty-state { text-align: center; color: #999; padding: 20px 0; font-size: 14px; }
.centered-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: #aaa; font-size: 16px; }

/* Friend List Row Support Unread Badge */
.friend-row { display: flex; align-items: center; justify-content: space-between; padding: 12px; border-radius: 6px; cursor: pointer; transition: background 0.2s; margin-bottom: 8px; border: 1px solid transparent; }
.friend-row:hover { background: #fdfdfd; border-color: #eee; }
.friend-row.active { background: #ff4655; color: white; border-color: #ff4655; }
.friend-name { font-weight: bold; font-size: 14px; }

.unread-badge { background: #ff0000; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; box-shadow: 0 2px 4px rgba(255,0,0,0.3); }
.friend-row.active .unread-badge { background: white; color: #ff4655; }

/* Fixed scrollable Chat Flexbox */
.chat-wrapper { display: flex; flex-direction: column; flex: 1; min-height: 0; position: relative; }
.chat-header { margin-bottom: 12px; font-size: 15px; border-bottom: 1px dashed #eee; padding-bottom: 10px; flex-shrink: 0; }
.chat-tip { color: #10b981; font-size: 12px; margin-left: 6px; }

.chat-messages { flex: 1; background: #fafafa; border-radius: 8px; padding: 15px; overflow-y: auto; margin-bottom: 15px; display: flex; flex-direction: column; gap: 12px; }
.chat-messages::-webkit-scrollbar { width: 6px; }
.chat-messages::-webkit-scrollbar-thumb { background-color: #ccc; border-radius: 10px; }

.chat-bubble { max-width: 75%; display: flex; flex-direction: column; gap: 4px; }
.chat-bubble.mine { align-self: flex-end; align-items: flex-end; }
.chat-bubble.mine .chat-content { background: #ff4655; color: white; border-bottom-right-radius: 2px; }
.chat-bubble.theirs { align-self: flex-start; align-items: flex-start; }
.chat-bubble.theirs .chat-content { background: #e5e7eb; color: #333; border-bottom-left-radius: 2px; }

.chat-content { padding: 8px 12px; border-radius: 12px; font-size: 14px; word-break: break-all; line-height: 1.4; display: flex; flex-direction: column;}
.chat-time { font-size: 11px; color: #aaa; margin: 0 4px; }

.chat-image { max-width: 100%; border-radius: 6px; cursor: pointer; object-fit: contain; max-height: 180px; }

/* Emoji and Input Logic */
.chat-tools { display: flex; gap: 8px; margin-bottom: 8px; position: relative; flex-shrink: 0;}
.tool-btn { background: none; border: 1px solid #eee; font-size: 18px; padding: 4px 8px; border-radius: 6px; cursor: pointer; color: #666; transition: 0.2s; }
.tool-btn:hover { background: #f3f4f6; border-color: #ddd; }

.emoji-picker { position: absolute; bottom: 40px; left: 0; background: white; border: 1px solid #eee; border-radius: 8px; padding: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; z-index: 100;}
.emoji-item { cursor: pointer; font-size: 20px; text-align: center; transition: transform 0.2s; }
.emoji-item:hover { transform: scale(1.2); }

.chat-input-row { display: flex; gap: 8px; flex-shrink: 0;}
.chat-input { flex: 1; padding: 12px 14px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; outline: none; }
.chat-input:focus { border-color: #ff4655; }
.send-btn { padding: 0 24px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
.send-btn:hover:not(:disabled) { background: #059669; }
.send-btn:disabled { opacity: 0.5; background: #ccc; cursor: not-allowed; }

/* Pending Requests List */
.request-row { display: flex; flex-direction: column; gap: 10px; padding: 12px; background: #fafafa; border-radius: 8px; margin-bottom: 12px; border: 1px solid #eee; }
.request-info { font-size: 14px; }
.request-info strong { color: #ff4655; margin-left: 5px; }
.request-actions { display: flex; gap: 8px; }
.accept-btn, .reject-btn { flex: 1; padding: 8px 0; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; color: white; font-weight: bold; }
.accept-btn { background: #10b981; }
.accept-btn:hover { background: #059669; }
.reject-btn { background: #aaa; }
.reject-btn:hover { background: #888; }
</style>
