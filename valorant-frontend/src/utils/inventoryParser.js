/**
 * 核心解析函数：将库存文本解析为结构化数据
 * @param {string} text - 输入的库存长文本
 * @returns {Array} - 解析后的皮肤对象数组
 */
export function parseInventory(text) {
  const parsedSkins = [];
  
  if (!text) return parsedSkins;

  // 1. 按全角分号拆分大类
  const categories = text.split('；');

  categories.forEach(categoryStr => {
    // 过滤掉没有【】标签的无关信息，比如“库存价值：14850”
    if (!categoryStr.includes('【')) return;

    // 2. 按全角冒号拆分标签和具体皮肤列表
    // 切割后：labelPart = "【枪皮" ， itemsPart = "幻象-2024全球冠军赛，暴徒-黑波..."
    const [labelPart, itemsPart] = categoryStr.split('】：');
    const categoryName = labelPart.replace('【', ''); // 提取出纯净的 "刀皮" 或 "枪皮"

    if (itemsPart) {
      // 3. 按全角逗号拆分具体的皮肤单品
      const items = itemsPart.split('，');
      
      items.forEach(item => {
        // 4. 按连字符拆分武器类型和皮肤名称
        const [weaponType, skinName] = item.split('-');
        
        if (weaponType && skinName) {
          // 将结构化的数据推入数组
          parsedSkins.push({
            category: categoryName,   // 例如：枪皮
            weapon: weaponType,       // 例如：暴徒
            skin: skinName            // 例如：黑波
          });
        }
      });
    }
  });

  return parsedSkins;
}
