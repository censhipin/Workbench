// ============================================================
// 测试数据生成脚本 — 库存表 / 订单表 / 订单明细表 / 回款表
// 200条测试用例
// ============================================================

const XLSX = require('xlsx');
const path = require('path');

const DIR = 'E:/测试表格数据';

// ===============================
// 1. 读取已有表格获取 ID 范围
// ===============================
function readIds(file, col) {
  const wb = XLSX.readFile(path.join(DIR, file));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(ws, { defval: null });
  const ids = json.map(r => String(r[col])).filter(Boolean);
  console.log(`  ${file}: ${ids.length} 个 ${col}`);
  return ids;
}

console.log('读取已有数据...');
const productIds = readIds('产品表.xlsx', '产品ID');
const customerIds = readIds('客户信息表.xlsx', '客户ID');
const supplierIds = readIds('供应商表.xlsx', '供应商ID');

// 从产品表读取售价/成本价信息
const wbP = XLSX.readFile(path.join(DIR, '产品表.xlsx'));
const wsP = wbP.Sheets[wbP.SheetNames[0]];
const productData = XLSX.utils.sheet_to_json(wsP, { defval: null });
const productMap = {};
productData.forEach(p => { productMap[p['产品ID']] = p; });

// 从客户表读取客户信息
const wbC = XLSX.readFile(path.join(DIR, '客户信息表.xlsx'));
const wsC = wbC.Sheets[wbC.SheetNames[0]];
const customerData = XLSX.utils.sheet_to_json(wsC, { defval: null });
const customerMap = {};
customerData.forEach(c => { customerMap[c['客户ID']] = c; });

// ===============================
// 2. 辅助函数
// ===============================
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max, dec = 2) { return parseFloat((Math.random() * (max - min) + min).toFixed(dec)); }
function pick(arr) { return arr[rand(0, arr.length - 1)]; }
function pad(n, len) { return String(n).padStart(len, '0'); }
function randDate(start, end) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const d = new Date(s + Math.random() * (e - s));
  return d.toISOString().slice(0, 10);
}

const cities = ['北京','上海','广州','深圳','杭州','成都','武汉','南京','西安','重庆','天津','苏州','长沙','郑州','东莞','青岛','沈阳','宁波','昆明','大连'];
const salesmen = ['张三','李四','王五','赵六','陈七','周八','吴九','郑十','刘一','孙二'];

// ===============================
// 3. 生成库存表 (inventory.xlsx) — 5000行
// ===============================
console.log('\n生成库存表...');
const inventory = [];
for (let i = 1; i <= 5000; i++) {
  const pid = pick(productIds);
  const qty = rand(0, 10000);
  const safeStock = rand(10, 500);
  inventory.push({
    库存ID: `INV${pad(i, 5)}`,
    产品ID: pid,
    仓库城市: pick(cities),
    库存数量: qty,
    安全库存: safeStock,
    更新时间: randDate('2025-01-01', '2025-06-30'),
  });
}
// 注入脏数据：负数库存
inventory[42].库存数量 = -50;
inventory[137].库存数量 = -200;
// 注入脏数据：空值
inventory[201].仓库城市 = null;
inventory[502].安全库存 = null;

const wsInv = XLSX.utils.json_to_sheet(inventory);
const wbInv = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbInv, wsInv, '库存');
XLSX.writeFile(wbInv, path.join(DIR, '库存表.xlsx'));
console.log('  库存表: 5000 行 ✓');

// ===============================
// 4. 生成订单表 (orders.xlsx) — 12000行
// ===============================
console.log('生成订单表...');
const orderStatuses = ['完成','退款','进行中'];
const refundRate = 0.05; // 5%退款
const channels = ['线上','线下'];
const orders = [];
const generatedOrderIds = [];

for (let i = 1; i <= 12000; i++) {
  const oid = `ORD${pad(i, 6)}`;
  generatedOrderIds.push(oid);
  const cid = pick(customerIds);
  const isRefund = Math.random() < refundRate;
  // 日期分布：大部分在2019-2025，确保近30天和近7天有数据
  let date;
  if (i <= 50) date = randDate('2025-06-15', '2025-06-30');  // 最近15天
  else if (i <= 300) date = randDate('2025-06-01', '2025-06-14'); // 最近30天
  else date = randDate('2015-01-01', '2025-05-31');

  const amount = randFloat(50, 50000);
  const status = isRefund ? '退款' : (Math.random() < 0.85 ? '完成' : '进行中');
  const channel = pick(channels);

  orders.push({
    订单ID: oid,
    客户ID: cid,
    订单日期: date,
    订单金额: amount,
    状态: status,
    渠道: channel,
    销售员: pick(salesmen),
  });
}

// 注入脏数据：重复订单
orders.push({ ...orders[0], 订单ID: 'ORDDUP0001' });
orders.push({ ...orders[1], 订单ID: 'ORDDUP0002' });
// 注入脏数据：空值
orders[55].状态 = null;
orders[189].订单金额 = null;

const wsOrd = XLSX.utils.json_to_sheet(orders);
const wbOrd = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbOrd, wsOrd, '订单');
XLSX.writeFile(wbOrd, path.join(DIR, '订单表.xlsx'));
console.log('  订单表: ' + orders.length + ' 行 ✓');

// ===============================
// 5. 生成订单明细表 (order_items.xlsx) — 30000行
// ===============================
console.log('生成订单明细表...');
const items = [];
let detailId = 1;
// 确保每个订单至少有1条明细，热门订单多条
for (const oid of generatedOrderIds) {
  const itemCount = rand(1, 5);
  for (let j = 0; j < itemCount; j++) {
    const pid = pick(productIds);
    const qty = rand(1, 100);
    const prod = productMap[pid];
    const price = prod ? prod['售价'] : randFloat(10, 5000);
    const cost = prod ? prod['成本价'] : randFloat(5, 3000);
    const subtotal = parseFloat((qty * price).toFixed(2));
    const totalCost = parseFloat((qty * cost).toFixed(2));
    const profit = parseFloat((subtotal - totalCost).toFixed(2));

    items.push({
      明细ID: `DET${pad(detailId, 6)}`,
      订单ID: oid,
      产品ID: pid,
      数量: qty,
      单价: price,
      小计: subtotal,
      成本: totalCost,
      利润: profit,
    });
    detailId++;
    if (detailId > 30000) break;
  }
  if (detailId > 30000) break;
}

// 注入脏数据：异常值
items[7].数量 = -5;
items[88].利润 = null;

const wsItems = XLSX.utils.json_to_sheet(items.slice(0, 30000));
const wbItems = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbItems, wsItems, '明细');
XLSX.writeFile(wbItems, path.join(DIR, '订单明细表.xlsx'));
console.log('  订单明细表: 30000 行 ✓');

// ===============================
// 6. 生成回款表 (payment.xlsx) — 8000行
// ===============================
console.log('生成回款表...');
const payments = [];
const paymentStatuses = ['成功', '失败', '部分'];
for (let i = 1; i <= 8000; i++) {
  const oid = pick(generatedOrderIds);
  const date = randDate('2015-01-01', '2025-06-30');
  const baseAmount = randFloat(100, 50000);
  const status = pick(paymentStatuses);
  // 失败和部分通常金额会小一些
  const amount = status === '成功' ? baseAmount : randFloat(50, baseAmount);

  payments.push({
    回款ID: `PAY${pad(i, 5)}`,
    订单ID: oid,
    回款日期: date,
    回款金额: amount,
    回款状态: status,
  });
}

// 注入脏数据
payments[15].回款金额 = -1000;
payments[303].回款状态 = null;

const wsPay = XLSX.utils.json_to_sheet(payments);
const wbPay = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbPay, wsPay, '回款');
XLSX.writeFile(wbPay, path.join(DIR, '回款表.xlsx'));
console.log('  回款表: 8000 行 ✓');

console.log('\n所有表格生成完成！');
