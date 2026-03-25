const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');      // 新增：密码加密库
const jwt = require('jsonwebtoken');     // 新增：JWT 签发库
const { createClient } = require('redis'); // 新增：Redis 缓存

const app = express();
const port = 3000;

// 我们的专属“防伪防篡改”密钥（生产环境中绝对不能泄露）
const JWT_SECRET = 'Valorant_Super_Secret_Key_2026';

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root', 
  password: '123456', // <--- 请务必修改这里！
  database: 'valorant_store',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.use(cors());
app.use(express.json());

// ==========================================
// Redis 缓存（失败时降级：不影响原接口）
// ==========================================
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined; // 开发环境可留空
const REDIS_DB = process.env.REDIS_DB ? Number(process.env.REDIS_DB) : 0;

const redisClient = createClient({
  socket: {
    host: REDIS_HOST,
    port: REDIS_PORT,
  },
  password: REDIS_PASSWORD,
  database: REDIS_DB,
});

let redisReady = false;
redisClient.on('error', (err) => {
  // 这里不要抛出异常，避免影响 Express 主线程
  console.warn('Redis client error:', err?.message || err);
});

(async () => {
  try {
    await redisClient.connect();
    redisReady = true;
    console.log(`Redis connected: ${REDIS_HOST}:${REDIS_PORT}`);
  } catch (err) {
    console.warn('Redis connect failed, continue without cache:', err?.message || err);
  }
})();

const sha256 = (input) => crypto.createHash('sha256').update(String(input)).digest('hex');

const getPriceVersion = async (userId) => {
  if (!redisReady) return 0;
  const key = `user:${userId}:priceVersion`;
  const v = await redisClient.get(key);
  return v ? parseInt(v, 10) : 0;
};

const getCacheJson = async (key) => {
  if (!redisReady) return null;
  const str = await redisClient.get(key);
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
};

const setCacheJson = async (key, value, ttlSeconds) => {
  if (!redisReady) return;
  try {
    await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (err) {
    // 缓存失败不影响主流程
    console.warn('Redis set failed:', err?.message || err);
  }
};

// ==========================================
// 核心中间件：JWT 守门员
// ==========================================
const verifyToken = (req, res, next) => {
  // 检查请求头里有没有带通行证 (Token)
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ code: 401, error: '未登录，拒绝访问' });

  const token = authHeader.split(' ')[1]; // 提取 Bearer 后面的部分
  try {
    // 验证 Token 是否合法且未过期
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId; // 解析成功，把真实用户 ID 挂载到请求上
    next(); // 放行，允许进入后面的接口！
  } catch (error) {
    res.status(401).json({ code: 401, error: '登录已过期或无效，请重新登录' });
  }
};

// ==========================================
// 模块 1：公开接口 (无需 Token 即可访问)
// ==========================================

// 注册接口
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });

  try {
    const [existing] = await pool.execute('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) return res.status(400).json({ error: '用户名已被注册' });

    // 密码加盐并 Hash 化（即便数据库被黑客脱库，也看不到明文密码）
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    await pool.execute('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
    res.json({ code: 200, message: '注册成功，请登录！' });
  } catch (error) {
    res.status(500).json({ error: '注册失败' });
  }
});

// 登录接口
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [users] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) return res.status(400).json({ error: '用户不存在' });

    const user = users[0];
    // 校验前端传来的明文密码和数据库里的密文是否匹配
    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) return res.status(400).json({ error: '密码错误' });

    // 签发 JWT Token（有效期 24 小时）
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({ code: 200, message: '登录成功', token: token, username: user.username });
  } catch (error) {
    res.status(500).json({ error: '登录失败' });
  }
});

// ==========================================
// 模块 2：私密接口 (必须带 Token，且只操作当前用户的数据)
// ⚠️ 注意接口路径后面的 verifyToken 拦截器
// ==========================================

function parseInventory(text) {
  const parsedSkins = [];
  const categories = text.split('；');
  categories.forEach(categoryStr => {
    if (!categoryStr.includes('【')) return;
    const [labelPart, itemsPart] = categoryStr.split('】：');
    if (itemsPart) {
      itemsPart.split('，').forEach(item => {
        const [weaponType, skinName] = item.split('-');
        if (weaponType && skinName) parsedSkins.push({ weapon: weaponType, skin: skinName });
      });
    }
  });
  return parsedSkins;
}

// 估价接口 (已上锁)
app.post('/api/evaluate', verifyToken, async (req, res) => {
  try {
    const { text } = req.body; 
    if (!text) return res.status(400).json({ error: '请提供库存文本' });

    const userId = req.userId;
    const priceVersion = await getPriceVersion(userId);
    const cacheKey = `eval:${userId}:v${priceVersion}:${sha256(text)}`;
    const cached = await getCacheJson(cacheKey);
    if (cached) return res.json({ code: 200, data: cached });

    const parsedItems = parseInventory(text);
    let totalValue = 0;
    const resultDetails = [];

    for (const item of parsedItems) {
      const [skinRows] = await pool.execute(`SELECT id FROM skins WHERE weapon_type = ? AND skin_name = ?`, [item.weapon, item.skin]);
      let currentSkinId;

      if (skinRows.length === 0) {
        const autoCategory = item.weapon.includes('近战') || item.weapon.includes('刀') ? '刀皮' : '枪皮';
        const [insertResult] = await pool.execute(`INSERT INTO skins (category, weapon_type, skin_name) VALUES (?, ?, ?)`, [autoCategory, item.weapon, item.skin]);
        currentSkinId = insertResult.insertId;
      } else {
        currentSkinId = skinRows[0].id;
      }

      // 💥 重点：现在只查 req.userId (当前登录用户) 的定价！不再写死 1 了！
      const [priceRows] = await pool.execute(
        `SELECT custom_price FROM user_skin_values WHERE user_id = ? AND skin_id = ?`, 
        [req.userId, currentSkinId]
      );

      let price = 0;
      if (priceRows.length > 0) {
        price = parseFloat(priceRows[0].custom_price);
        totalValue += price;
      }

      resultDetails.push({ weapon: item.weapon, skin: item.skin, price: price });
    }

    const data = { totalValue, details: resultDetails };
    await setCacheJson(cacheKey, data, 120);
    res.json({ code: 200, data });
  } catch (error) {
    res.status(500).json({ error: '评估失败' });
  }
});

// 获取皮肤列表 (已上锁)
app.get('/api/skins', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const priceVersion = await getPriceVersion(userId);
    const cacheKey = `skins:${userId}:v${priceVersion}`;
    const cachedRows = await getCacheJson(cacheKey);
    if (cachedRows) return res.json({ code: 200, data: cachedRows });

    const [rows] = await pool.execute(`
      SELECT s.id, s.category, s.weapon_type, s.skin_name, IFNULL(v.custom_price, 0) as price
      FROM skins s
      LEFT JOIN user_skin_values v ON s.id = v.skin_id AND v.user_id = ?
      ORDER BY s.weapon_type, s.id
    `, [userId]); // 💥 重点：使用 req.userId

    await setCacheJson(cacheKey, rows, 300);
    res.json({ code: 200, data: rows });
  } catch (error) {
    res.status(500).json({ error: '查询失败' });
  }
});

// 保存自定义价格 (已上锁)
app.post('/api/skins/price', verifyToken, async (req, res) => {
  const { skinId, price } = req.body;
  try {
    await pool.execute(`
      INSERT INTO user_skin_values (user_id, skin_id, custom_price)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE custom_price = ?
    `, [req.userId, skinId, price, price]); // 💥 重点：使用 req.userId

    // 更新用户价格版本号，触发 evaluate/skins 缓存自动失效
    if (redisReady) {
      try {
        await redisClient.incr(`user:${req.userId}:priceVersion`);
      } catch (err) {
        console.warn('Redis incr failed:', err?.message || err);
      }
    }

    res.json({ code: 200, message: '保存成功' });
  } catch (error) {
    res.status(500).json({ error: '保存失败' });
  }
});

app.listen(port, () => {
  console.log(`🚀 带有 JWT 鉴权的后端服务已启动！运行在 http://localhost:${port}`);
});