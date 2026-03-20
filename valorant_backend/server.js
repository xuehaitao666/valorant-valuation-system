const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise'); // 引入支持 Promise 的 MySQL 库

const app = express();
const port = 3000;

// 1. 创建数据库连接池 (Connection Pool)
// 相比单次连接，连接池性能更好，是企业级开发的标准做法
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
app.use(express.json()); // 允许解析前端传来的 JSON 格式请求体

// 2. 之前写好的：文本解析函数
function parseInventory(text) {
  const parsedSkins = [];
  const categories = text.split('；');
  categories.forEach(categoryStr => {
    if (!categoryStr.includes('【')) return;
    const [labelPart, itemsPart] = categoryStr.split('】：');
    if (itemsPart) {
      const items = itemsPart.split('，');
      items.forEach(item => {
        const [weaponType, skinName] = item.split('-');
        if (weaponType && skinName) {
          parsedSkins.push({ weapon: weaponType, skin: skinName });
        }
      });
    }
  });
  return parsedSkins;
}

// 3. 核心 API 接口：接收文本 -> 解析 -> 查库 -> 返回总价
// 3. 核心 API 接口：接收文本 -> 解析 -> 动态录入新皮肤 -> 查价 -> 返回结果
app.post('/api/evaluate', async (req, res) => {
  try {
    const { text, userId } = req.body; 
    if (!text) return res.status(400).json({ error: '请提供库存文本' });

    const parsedItems = parseInventory(text);
    let totalValue = 0;
    const resultDetails = [];

    // 第二步：遍历每个解析出来的皮肤
    for (const item of parsedItems) {
      // 【新增逻辑 1】：先去基础皮肤表里查，有没有这个皮肤？
      const [skinRows] = await pool.execute(
        `SELECT id FROM skins WHERE weapon_type = ? AND skin_name = ?`, 
        [item.weapon, item.skin]
      );

      let currentSkinId;

      if (skinRows.length === 0) {
        // 【新增逻辑 2】：如果没有，说明发现了新皮肤！自动把它录入字典表
        // 简单推断一下：如果是“近战武器”就归类为“刀皮”，否则归类为“枪皮”
        const autoCategory = item.weapon === '近战武器' ? '刀皮' : '枪皮';
        
        const [insertResult] = await pool.execute(
          `INSERT INTO skins (category, weapon_type, skin_name) VALUES (?, ?, ?)`,
          [autoCategory, item.weapon, item.skin]
        );
        currentSkinId = insertResult.insertId; // 获取刚插入的新皮肤 ID
        console.log(`✨ 触发动态录入：自动将 [${item.weapon}-${item.skin}] 收录至数据库！`);
      } else {
        // 如果数据库里有，直接拿它的 ID
        currentSkinId = skinRows[0].id;
      }

      // 【后续逻辑】：拿到了皮肤 ID，再去查当前用户有没有给它定过价
      const [priceRows] = await pool.execute(
        `SELECT custom_price FROM user_skin_values WHERE user_id = ? AND skin_id = ?`, 
        [userId || 1, currentSkinId]
      );

      let price = 0;
      if (priceRows.length > 0) {
        price = parseFloat(priceRows[0].custom_price);
        totalValue += price;
      }

      resultDetails.push({
        weapon: item.weapon,
        skin: item.skin,
        price: price
      });
    }

    res.json({
      code: 200,
      message: '评估成功',
      data: { totalValue, details: resultDetails }
    });

  } catch (error) {
    console.error('服务器运行错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});


// --- 新增：获取所有皮肤及当前用户的定价 ---
app.get('/api/skins', async (req, res) => {
  const userId = req.query.userId || 1; // 默认使用你的账号 id = 1
  try {
    // 这里用了一个非常经典的 LEFT JOIN (左连接)
    // 确保即使你还没有给某个皮肤定价，它也能显示在列表里，价格默认为 0
    const [rows] = await pool.execute(`
      SELECT s.id, s.category, s.weapon_type, s.skin_name, IFNULL(v.custom_price, 0) as price
      FROM skins s
      LEFT JOIN user_skin_values v ON s.id = v.skin_id AND v.user_id = ?
      ORDER BY s.weapon_type, s.id
    `, [userId]);
    
    res.json({ code: 200, data: rows });
  } catch (error) {
    console.error('获取皮肤列表失败:', error);
    res.status(500).json({ error: '数据库查询失败' });
  }
});

// --- 新增：更新或插入自定义价格 ---
app.post('/api/skins/price', async (req, res) => {
  const { userId, skinId, price } = req.body;
  const uid = userId || 1;

  if (!skinId || price === undefined) {
    return res.status(400).json({ error: '参数缺失' });
  }

  try {
    // 这是一个非常高级且实用的 MySQL 语法：UPSERT (更新或插入)
    // 因为我们建表时加了唯一索引，如果记录不存在就插入，如果存在就更新它的价格
    await pool.execute(`
      INSERT INTO user_skin_values (user_id, skin_id, custom_price)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE custom_price = ?
    `, [uid, skinId, price, price]);
    
    res.json({ code: 200, message: '价格保存成功' });
  } catch (error) {
    console.error('保存价格失败:', error);
    res.status(500).json({ error: '价格保存失败' });
  }
});

app.listen(port, () => {
  console.log(`🚀 后端服务已启动！运行在 http://localhost:${port}`);
});