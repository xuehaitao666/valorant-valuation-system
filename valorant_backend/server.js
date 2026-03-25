const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');      // 新增：密码加密库
const jwt = require('jsonwebtoken');     // 新增：JWT 签发库
const { createClient } = require('redis'); // 新增：Redis 缓存
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const port = 3000;
const httpServer = http.createServer(app);

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
// 模块 2-1：Socket.IO 实时通信
// ==========================================
const io = new Server(httpServer, {
  cors: {
    origin: '*', // 开发环境允许跨域；生产环境建议限制来源
    methods: ['GET', 'POST'],
  },
});

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

// ==========================================
// 模块 3：好友功能表（自动建表）
// ==========================================
const ensureFriendTables = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS friend_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      from_user_id INT NOT NULL,
      to_user_id INT NOT NULL,
      status ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_request_pair (from_user_id, to_user_id),
      KEY idx_to_user_id (to_user_id),
      KEY idx_from_user_id (from_user_id)
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS friends (
      user_id INT NOT NULL,
      friend_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, friend_id),
      KEY idx_friend_id (friend_id)
    )
  `);
};

const ensureChatTables = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      room_id VARCHAR(64) NOT NULL,
      sender_id INT NOT NULL,
      receiver_id INT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_room_id_created_at (room_id, created_at)
    )
  `);
};

const getRoomId = (userA, userB) => {
  const a = Number(userA);
  const b = Number(userB);
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  return `room:${min}_${max}`;
};

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
// Socket.IO 鉴权：复用 JWT（auth.token）
// ==========================================
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Unauthorized'));
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (error) {
    next(new Error('Unauthorized'));
  }
});

// ==========================================
// Socket.IO：私聊（按好友关系）
// ==========================================
io.on('connection', (socket) => {
  const userId = socket.userId;

  socket.on('chat:join', async ({ toUserId }) => {
    try {
      const friendId = Number(toUserId);
      if (!friendId || friendId === userId) {
        socket.emit('chat:error', { error: 'toUserId 不合法' });
        return;
      }

      const [friendRows] = await pool.execute(
        'SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ? LIMIT 1',
        [userId, friendId]
      );
      if (friendRows.length === 0) {
        socket.emit('chat:error', { error: '对方不是你的好友' });
        return;
      }

      const roomId = getRoomId(userId, friendId);
      socket.join(roomId);
      socket.emit('chat:joined', { roomId });
    } catch (err) {
      console.warn('socket chat:join failed:', err?.message || err);
      socket.emit('chat:error', { error: '加入房间失败' });
    }
  });

  socket.on('chat:history', async ({ toUserId, limit }) => {
    try {
      const friendId = Number(toUserId);
      const lim = Math.min(Math.max(Number(limit || 50), 1), 100);
      const roomId = getRoomId(userId, friendId);

      const [friendRows] = await pool.execute(
        'SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ? LIMIT 1',
        [userId, friendId]
      );
      if (friendRows.length === 0) {
        socket.emit('chat:error', { error: '对方不是你的好友' });
        return;
      }

      // NOTE: 有些 MySQL 驱动/版本在 `LIMIT ?` 预编译绑定上会抛
      // "Incorrect arguments to mysqld_stmt_execute"，这里直接拼接整数更稳。
      const limInt = Number.isFinite(lim) ? Math.trunc(lim) : 50;
      const [rows] = await pool.execute(
        `SELECT id, room_id, sender_id, receiver_id, content, created_at
         FROM chat_messages
         WHERE room_id = ?
         ORDER BY created_at DESC
         LIMIT ${limInt}`,
        [roomId]
      );

      rows.reverse(); // 按时间升序返回
      socket.emit('chat:history', { roomId, messages: rows });
    } catch (err) {
      console.warn('socket chat:history failed:', err?.message || err);
      socket.emit('chat:error', { error: '拉取历史失败' });
    }
  });

  socket.on('chat:send', async ({ toUserId, content }) => {
    try {
      const friendId = Number(toUserId);
      const text = String(content || '').trim();
      if (!friendId || !text) {
        socket.emit('chat:error', { error: '发送参数不合法' });
        return;
      }
      if (text.length > 2000) {
        socket.emit('chat:error', { error: '消息过长（上限 2000）' });
        return;
      }

      const [friendRows] = await pool.execute(
        'SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ? LIMIT 1',
        [userId, friendId]
      );
      if (friendRows.length === 0) {
        socket.emit('chat:error', { error: '对方不是你的好友' });
        return;
      }

      const roomId = getRoomId(userId, friendId);
      const [insertResult] = await pool.execute(
        'INSERT INTO chat_messages (room_id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?)',
        [roomId, userId, friendId, text]
      );

      const [msgRows] = await pool.execute(
        'SELECT id, room_id, sender_id, receiver_id, content, created_at FROM chat_messages WHERE id = ?',
        [insertResult.insertId]
      );

      const message = msgRows[0];
      io.to(roomId).emit('chat:message', message);
    } catch (err) {
      console.warn('socket chat:send failed:', err?.message || err);
      socket.emit('chat:error', { error: '发送失败' });
    }
  });
});

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

// ==========================================
// 模块 4：好友功能（MVP）
// ==========================================
// 发起好友请求（按用户名）
app.post('/api/friends/request', verifyToken, async (req, res) => {
  const { targetUsername } = req.body;
  if (!targetUsername) return res.status(400).json({ error: '请输入要添加的用户名' });

  const fromUserId = req.userId;
  const target = String(targetUsername).trim();
  if (!target) return res.status(400).json({ error: '用户名不能为空' });

  try {
    const [targetRows] = await pool.execute('SELECT id FROM users WHERE username = ?', [target]);
    if (targetRows.length === 0) return res.status(400).json({ error: '用户不存在' });

    const toUserId = targetRows[0].id;
    if (toUserId === fromUserId) return res.status(400).json({ error: '不能添加自己' });

    // 1) 是否已是好友
    const [alreadyFriend] = await pool.execute(
      'SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?',
      [fromUserId, toUserId]
    );
    if (alreadyFriend.length > 0) return res.status(400).json({ error: '你们已经是好友' });

    // 2) 对方是否已经向你发起了待处理请求
    const [incomingPending] = await pool.execute(
      'SELECT id FROM friend_requests WHERE from_user_id = ? AND to_user_id = ? AND status = ?',
      [toUserId, fromUserId, 'pending']
    );
    if (incomingPending.length > 0) {
      return res.status(400).json({ error: '对方已向你发送过请求，请先在页面里同意' });
    }

    // 3) 你是否已经对该用户发过请求（pending/rejected/accepted）
    const [existing] = await pool.execute(
      'SELECT id, status FROM friend_requests WHERE from_user_id = ? AND to_user_id = ? LIMIT 1',
      [fromUserId, toUserId]
    );

    if (existing.length > 0) {
      const row = existing[0];
      if (row.status === 'pending') return res.status(400).json({ error: '请求已发送，请等待对方处理' });
      if (row.status === 'rejected') {
        await pool.execute(
          'UPDATE friend_requests SET status = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['pending', row.id]
        );
        return res.json({ code: 200, message: '已重新发送好友请求' });
      }
      // accepted 理论上应当已存在 friends，这里兜底返回
      return res.status(400).json({ error: '你们已经是好友' });
    }

    await pool.execute(
      'INSERT INTO friend_requests (from_user_id, to_user_id, status) VALUES (?, ?, ?)',
      [fromUserId, toUserId, 'pending']
    );

    res.json({ code: 200, message: '好友请求已发送' });
  } catch (err) {
    console.warn('friends/request failed:', err?.message || err);
    res.status(500).json({ error: '发送失败' });
  }
});

// 获取等待我同意的请求
app.get('/api/friends/requests/incoming', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const [rows] = await pool.execute(`
      SELECT
        fr.id,
        u.username AS from_username,
        fr.created_at
      FROM friend_requests fr
      JOIN users u ON fr.from_user_id = u.id
      WHERE fr.to_user_id = ? AND fr.status = 'pending'
      ORDER BY fr.created_at DESC
    `, [userId]);

    res.json({ code: 200, data: rows });
  } catch (err) {
    console.warn('friends/incoming failed:', err?.message || err);
    res.status(500).json({ error: '查询失败' });
  }
});

// 同意好友请求
app.post('/api/friends/requests/:id/accept', verifyToken, async (req, res) => {
  const requestId = Number(req.params.id);
  if (!requestId) return res.status(400).json({ error: '请求ID不合法' });

  try {
    const userId = req.userId;
    const [rows] = await pool.execute(`
      SELECT id, from_user_id
      FROM friend_requests
      WHERE id = ? AND to_user_id = ? AND status = 'pending'
      LIMIT 1
    `, [requestId, userId]);

    if (rows.length === 0) return res.status(404).json({ error: '请求不存在或已处理' });
    const fromUserId = rows[0].from_user_id;

    // 建立双向好友关系
    await pool.execute(
      'INSERT IGNORE INTO friends (user_id, friend_id) VALUES (?, ?), (?, ?)',
      [userId, fromUserId, fromUserId, userId]
    );

    await pool.execute('UPDATE friend_requests SET status = ? WHERE id = ?', ['accepted', requestId]);

    res.json({ code: 200, message: '已接受好友请求' });
  } catch (err) {
    console.warn('friends/accept failed:', err?.message || err);
    res.status(500).json({ error: '接受失败' });
  }
});

// 拒绝好友请求
app.post('/api/friends/requests/:id/reject', verifyToken, async (req, res) => {
  const requestId = Number(req.params.id);
  if (!requestId) return res.status(400).json({ error: '请求ID不合法' });

  try {
    const userId = req.userId;
    const [rows] = await pool.execute(`
      SELECT id
      FROM friend_requests
      WHERE id = ? AND to_user_id = ? AND status = 'pending'
      LIMIT 1
    `, [requestId, userId]);

    if (rows.length === 0) return res.status(404).json({ error: '请求不存在或已处理' });

    await pool.execute('UPDATE friend_requests SET status = ? WHERE id = ?', ['rejected', requestId]);
    res.json({ code: 200, message: '已拒绝好友请求' });
  } catch (err) {
    console.warn('friends/reject failed:', err?.message || err);
    res.status(500).json({ error: '拒绝失败' });
  }
});

// 获取我的好友列表
app.get('/api/friends/list', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const [rows] = await pool.execute(`
      SELECT
        u.id,
        u.username,
        f.created_at
      FROM friends f
      JOIN users u ON f.friend_id = u.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `, [userId]);

    res.json({ code: 200, data: rows });
  } catch (err) {
    console.warn('friends/list failed:', err?.message || err);
    res.status(500).json({ error: '查询失败' });
  }
});

// 启动服务前确保好友表存在（避免竞态条件）
(async () => {
  try {
    await ensureFriendTables();
    await ensureChatTables();
  } catch (err) {
    console.warn('DB tables init failed:', err?.message || err);
  }
  httpServer.listen(port, () => {
    console.log(`🚀 带有 JWT 鉴权的后端服务已启动（HTTP + Socket.IO）！运行在 http://localhost:${port}`);
  });
})();