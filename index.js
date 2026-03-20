// 模拟前端传给后端的长文本
const inventoryText = "库存价值：14850；【刀皮】：近战武器-2024全球冠军赛战刀；【枪皮】：幻象-2024全球冠军赛，暴徒-黑波，捍卫者-光炫声谱，暴徒-掠夺印象，制式手枪-偶像星夢，神射-復古奇機，鬼魅-位元轉移，神射-奈米微晶，鬼魅-星月耀年";

// 核心解析函数
function parseInventory(text) {
  const parsedSkins = [];
  
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

// 执行并打印结果
const mySkins = parseInventory(inventoryText);
console.log("解析成功！共提取出", mySkins.length, "个皮肤：");
console.log(mySkins);