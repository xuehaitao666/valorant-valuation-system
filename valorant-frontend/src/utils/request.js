import axios from 'axios'

// 1. 创建一个 axios 实例，配置基础路径
const request = axios.create({
  baseURL: 'http://localhost:3000/api', // 这样以后写接口就不用写前面那一长串了
  timeout: 5000 // 请求超时时间设为 5 秒
})

// 2. 请求拦截器 (Request Interceptor)
// 作用：每次发请求前，自动去兜里（localStorage）掏出钥匙（Token）挂在请求头里
request.interceptors.request.use(
  config => {
    const token = localStorage.getItem('valorant_token')
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// 3. 响应拦截器 (Response Interceptor)
// 作用：每次后端返回数据，先过这一关。如果是 401，直接踢下线。
request.interceptors.response.use(
  response => {
    // Axios 默认会把后端的数据包在一层 data 里，我们直接剥离出来返回，让业务代码更干净
    return response.data
  },
  error => {
    if (error.response && error.response.status === 401) {
      // 捕获到 401 报错：说明 Token 过期或造假
      localStorage.removeItem('valorant_token')
      localStorage.removeItem('valorant_username')
      alert('⚠️ 登录已过期，请重新登录')
      window.location.reload() // 强制刷新页面，回到未登录状态
    }
    return Promise.reject(error)
  }
)

export default request