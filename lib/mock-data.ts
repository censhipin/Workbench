import { WorkbenchFile, QuickAction, HistoryItem, PlanStep, StepSubItem, TaskAnalysis } from './types';
export const mockFiles: WorkbenchFile[] = [
  { id:'file-1',name:'销售数据.xlsx',isMock:true,icon:'📊',rowCount:25,colCount:6,sheets:[
    { name:'Sheet1',columns:[{key:'date',title:'日期',type:'date'},{key:'salesperson',title:'销售人员',type:'text'},{key:'product',title:'产品',type:'text'},{key:'quantity',title:'数量',type:'number'},{key:'unitPrice',title:'单价',type:'number'},{key:'amount',title:'金额',type:'number'}],
      rows:[{date:'2024-01-05',salesperson:'张三',product:'产品A',quantity:12,unitPrice:150,amount:1800},{date:'2024-01-08',salesperson:'李四',product:'产品B',quantity:8,unitPrice:200,amount:1600},{date:'2024-01-12',salesperson:'王五',product:'产品A',quantity:15,unitPrice:150,amount:2250},{date:'2024-01-15',salesperson:'张三',product:'产品C',quantity:6,unitPrice:350,amount:2100},{date:'2024-01-18',salesperson:'赵六',product:'产品B',quantity:10,unitPrice:200,amount:2000},{date:'2024-01-20',salesperson:'李四',product:'产品A',quantity:20,unitPrice:150,amount:3000},{date:'2024-01-22',salesperson:'王五',product:'产品C',quantity:4,unitPrice:350,amount:1400},{date:'2024-01-25',salesperson:'张三',product:'产品B',quantity:9,unitPrice:200,amount:1800},{date:'2024-01-28',salesperson:'赵六',product:'产品A',quantity:14,unitPrice:150,amount:2100},{date:'2024-02-02',salesperson:'李四',product:'产品C',quantity:7,unitPrice:350,amount:2450},{date:'2024-02-05',salesperson:'王五',product:'产品B',quantity:11,unitPrice:200,amount:2200},{date:'2024-02-08',salesperson:'张三',product:'产品A',quantity:18,unitPrice:150,amount:2700},{date:'2024-02-10',salesperson:'赵六',product:'产品C',quantity:5,unitPrice:350,amount:1750},{date:'2024-02-12',salesperson:'李四',product:'产品A',quantity:13,unitPrice:150,amount:1950},{date:'2024-02-15',salesperson:'王五',product:'产品B',quantity:8,unitPrice:200,amount:1600},{date:'2024-02-18',salesperson:'张三',product:'产品C',quantity:3,unitPrice:350,amount:1050},{date:'2024-02-20',salesperson:'赵六',product:'产品A',quantity:16,unitPrice:150,amount:2400},{date:'2024-02-22',salesperson:'李四',product:'产品B',quantity:7,unitPrice:200,amount:1400},{date:'2024-03-01',salesperson:'王五',product:'产品C',quantity:9,unitPrice:350,amount:3150},{date:'2024-03-05',salesperson:'张三',product:'产品A',quantity:22,unitPrice:150,amount:3300},{date:'2024-03-08',salesperson:'赵六',product:'产品B',quantity:6,unitPrice:200,amount:1200},{date:'2024-03-10',salesperson:'李四',product:'产品C',quantity:8,unitPrice:350,amount:2800},{date:'2024-03-12',salesperson:'王五',product:'产品A',quantity:19,unitPrice:150,amount:2850},{date:'2024-03-15',salesperson:'张三',product:'产品B',quantity:10,unitPrice:200,amount:2000},{date:'2024-03-18',salesperson:'赵六',product:'产品A',quantity:17,unitPrice:150,amount:2550}]},
    { name:'Sheet2',columns:[{key:'phone',title:'手机号',type:'text'},{key:'salesperson',title:'销售人员',type:'text'},{key:'region',title:'区域',type:'text'}],rows:[{phone:'13800001001',salesperson:'张三',region:'华东'},{phone:'13800001002',salesperson:'李四',region:'华南'},{phone:'13800001003',salesperson:'王五',region:'华北'},{phone:'13800001001',salesperson:'张三',region:'华东'},{phone:'13800001004',salesperson:'赵六',region:'西南'},{phone:'13800001005',salesperson:'钱七',region:'华东'},{phone:'13800001002',salesperson:'李四',region:'华南'},{phone:'13800001006',salesperson:'孙八',region:'华北'}]}]},
  { id:'file-2',name:'员工信息.xlsx',isMock:true,icon:'👤',rowCount:15,colCount:4,sheets:[{ name:'员工表',columns:[{key:'name',title:'姓名',type:'text'},{key:'department',title:'部门',type:'text'},{key:'position',title:'岗位',type:'text'},{key:'hireDate',title:'入职日期',type:'date'}],
      rows:[{name:'陈建国',department:'技术部',position:'前端工程师',hireDate:'2021-03-15'},{name:'林小红',department:'市场部',position:'市场经理',hireDate:'2020-07-01'},{name:'张伟',department:'销售部',position:'销售主管',hireDate:'2019-01-10'},{name:'王芳',department:'人事部',position:'HR经理',hireDate:'2022-05-20'},{name:'李强',department:'技术部',position:'后端工程师',hireDate:'2021-08-12'},{name:'赵丽',department:'财务部',position:'会计',hireDate:'2020-11-03'},{name:'孙明',department:'销售部',position:'销售代表',hireDate:'2023-02-14'},{name:'周杰',department:'技术部',position:'架构师',hireDate:'2018-06-01'},{name:'吴婷',department:'市场部',position:'运营专员',hireDate:'2022-09-10'},{name:'郑浩',department:'销售部',position:'销售代表',hireDate:'2023-06-01'},{name:'刘洋',department:'技术部',position:'测试工程师',hireDate:'2021-12-20'},{name:'黄敏',department:'人事部',position:'招聘专员',hireDate:'2023-01-05'},{name:'许亮',department:'财务部',position:'出纳',hireDate:'2022-03-18'},{name:'何欢',department:'市场部',position:'品牌经理',hireDate:'2021-07-22'},{name:'马超',department:'技术部',position:'全栈工程师',hireDate:'2020-04-15'}]}]},
  { id:'file-3',name:'联系方式.xlsx',isMock:true,icon:'📞',rowCount:15,colCount:4,sheets:[{ name:'通讯录',columns:[{key:'name',title:'姓名',type:'text'},{key:'phone',title:'手机号',type:'text'},{key:'idCard',title:'身份证号',type:'text'},{key:'email',title:'邮箱',type:'text'}],
      rows:[{name:'陈建国',phone:'13800010001',idCard:'310101199001011234',email:'chenjg@example.com'},{name:'林小红',phone:'13800010002',idCard:'310101199205052345',email:'linxh@example.com'},{name:'张伟',phone:'13800010003',idCard:'310101198812123456',email:'zhangw@example.com'},{name:'王芳',phone:'13800010004',idCard:'310101199308084567',email:'wangf@example.com'},{name:'李强',phone:'13800010005',idCard:'310101199106065678',email:'liq@example.com'},{name:'赵丽',phone:'13800010006',idCard:'310101199409097890',email:'zhaol@example.com'},{name:'孙明',phone:'13800010007',idCard:'310101199712128901',email:'sunm@example.com'},{name:'周杰',phone:'13800010008',idCard:'310101198506060123',email:'zhouj@example.com'},{name:'吴婷',phone:'13800010009',idCard:'310101199609090234',email:'wut@example.com'},{name:'郑浩',phone:'13800010010',idCard:'310101199807070345',email:'zhengh@example.com'},{name:'冯思远',phone:'13800010011',idCard:'310101199503030456',email:'fengsy@example.com'},{name:'蒋文博',phone:'13800010012',idCard:'310101199111110567',email:'jiangwb@example.com'},{name:'韩雪',phone:'13800010013',idCard:'310101199707070678',email:'hanx@example.com'},{name:'刘洋',phone:'13800010014',idCard:'310101199804040789',email:'liuy@example.com'},{name:'黄敏',phone:'13800010015',idCard:'310101199610100890',email:'huangm@example.com'}]}]},
  { id:'file-4',name:'工资表.xlsx',isMock:true,icon:'💰',rowCount:15,colCount:5,
    sheets:[{ name:'2024年1月',columns:[{key:'name',title:'姓名',type:'text'},{key:'basePay',title:'基本工资',type:'number'},{key:'bonus',title:'绩效奖金',type:'number'},{key:'overtime',title:'加班补贴',type:'number'},{key:'deduction',title:'扣除项',type:'number'}],
      rows:[{name:'陈建国',basePay:15000,bonus:3000,overtime:500,deduction:800},{name:'林小红',basePay:18000,bonus:4500,overtime:0,deduction:1200},{name:'张伟',basePay:20000,bonus:8000,overtime:300,deduction:1500},{name:'王芳',basePay:16000,bonus:3500,overtime:0,deduction:900},{name:'李强',basePay:17000,bonus:5000,overtime:800,deduction:1000},{name:'赵丽',basePay:14000,bonus:2500,overtime:200,deduction:700},{name:'孙明',basePay:12000,bonus:6000,overtime:1000,deduction:600},{name:'周杰',basePay:25000,bonus:10000,overtime:0,deduction:2000},{name:'吴婷',basePay:13000,bonus:3000,overtime:600,deduction:500},{name:'郑浩',basePay:11000,bonus:5500,overtime:1200,deduction:400},{name:'刘洋',basePay:16000,bonus:4000,overtime:400,deduction:800},{name:'黄敏',basePay:13500,bonus:2800,overtime:0,deduction:650},{name:'许亮',basePay:12000,bonus:2200,overtime:300,deduction:550},{name:'何欢',basePay:15500,bonus:3800,overtime:0,deduction:850},{name:'马超',basePay:19000,bonus:6500,overtime:500,deduction:1100}]},
      { name:'2024年2月',columns:[{key:'name',title:'姓名',type:'text'},{key:'basePay',title:'基本工资',type:'number'},{key:'bonus',title:'绩效奖金',type:'number'},{key:'overtime',title:'加班补贴',type:'number'},{key:'deduction',title:'扣除项',type:'number'}],
      rows:[{name:'陈建国',basePay:15000,bonus:3200,overtime:200,deduction:800},{name:'林小红',basePay:18000,bonus:5000,overtime:300,deduction:1200},{name:'张伟',basePay:20000,bonus:7500,overtime:0,deduction:1500},{name:'王芳',basePay:16000,bonus:4000,overtime:500,deduction:900},{name:'李强',basePay:17000,bonus:4800,overtime:600,deduction:1000},{name:'赵丽',basePay:14000,bonus:3000,overtime:0,deduction:700},{name:'孙明',basePay:12000,bonus:7000,overtime:800,deduction:600},{name:'周杰',basePay:25000,bonus:9000,overtime:200,deduction:2000},{name:'吴婷',basePay:13000,bonus:2800,overtime:400,deduction:500},{name:'郑浩',basePay:11000,bonus:6000,overtime:900,deduction:400},{name:'刘洋',basePay:16000,bonus:4200,overtime:0,deduction:800},{name:'黄敏',basePay:13500,bonus:3000,overtime:200,deduction:650},{name:'许亮',basePay:12000,bonus:2500,overtime:0,deduction:550},{name:'何欢',basePay:15500,bonus:4000,overtime:100,deduction:850},{name:'马超',basePay:19000,bonus:7000,overtime:0,deduction:1100}]}]}
];
export function getSheets(fileId:string){const f=mockFiles.find((x)=>x.id===fileId);return f?.sheets??[];}
export const quickActions:QuickAction[]=[
  {id:'sum',label:'求和',icon:'Σ',prompt:'统计销售总额'},{id:'sort',label:'排序',icon:'↕',prompt:'按销售额从高到低排序'},
  {id:'filter',label:'筛选',icon:'⊞',prompt:'筛选2024年1月份数据'},{id:'dedup',label:'去重',icon:'⊟',prompt:'删除重复手机号'},
  {id:'match',label:'匹配合并',icon:'⇌',prompt:'按姓名匹配员工信息表和联系方式表'},{id:'clean',label:'数据清洗',icon:'✦',prompt:'清除空白行和异常数据'},
  {id:'pivot',label:'透视表',icon:'⊞',prompt:'按业务员统计各状态金额'}
];
export const promptExamples=['统计2024年销售总额','删除重复手机号','按姓名匹配员工信息表和联系方式表','合并所有月份销售数据','筛选2024年1月份数据'];
export const mockHistory: HistoryItem[] = [
  {
    id: 'h-1', action: '删除重复手机号', timestamp: '2024-03-15 14:30', targetFiles: ['销售数据.xlsx'],
    resultData: {
      columns: [{ key: 'phone', title: '手机号', type: 'text' }, { key: 'salesperson', title: '销售人员', type: 'text' }, { key: 'region', title: '区域', type: 'text' }],
      rows: [
        { phone: '13800001001', salesperson: '张三', region: '华东' },
        { phone: '13800001002', salesperson: '李四', region: '华南' },
        { phone: '13800001003', salesperson: '王五', region: '华北' },
        { phone: '13800001004', salesperson: '赵六', region: '西南' },
        { phone: '13800001005', salesperson: '钱七', region: '华东' },
        { phone: '13800001006', salesperson: '孙八', region: '华北' },
      ],
    },
    resultSummary: { totalRecords: 6, beforeCount: 8, afterCount: 6, deletedCount: 2 },
  },
  {
    id: 'h-2', action: '按姓名匹配员工信息表和联系方式表', timestamp: '2024-03-14 10:15', targetFiles: ['员工信息.xlsx', '联系方式.xlsx'],
    resultData: {
      columns: [
        { key: 'name', title: '姓名', type: 'text' },
        { key: 'department', title: '部门', type: 'text' },
        { key: 'position', title: '岗位', type: 'text' },
        { key: 'phone', title: '手机号', type: 'text' },
        { key: 'email', title: '邮箱', type: 'text' },
      ],
      rows: [
        { name: '陈建国', department: '技术部', position: '前端工程师', phone: '13800010001', email: 'chenjg@example.com' },
        { name: '林小红', department: '市场部', position: '市场经理', phone: '13800010002', email: 'linxh@example.com' },
        { name: '张伟', department: '销售部', position: '销售主管', phone: '13800010003', email: 'zhangw@example.com' },
        { name: '王芳', department: '人事部', position: 'HR经理', phone: '13800010004', email: 'wangf@example.com' },
        { name: '李强', department: '技术部', position: '后端工程师', phone: '13800010005', email: 'liq@example.com' },
        { name: '赵丽', department: '财务部', position: '会计', phone: '13800010006', email: 'zhaol@example.com' },
        { name: '孙明', department: '销售部', position: '销售代表', phone: '13800010007', email: 'sunm@example.com' },
        { name: '周杰', department: '技术部', position: '架构师', phone: '13800010008', email: 'zhouj@example.com' },
        { name: '吴婷', department: '市场部', position: '运营专员', phone: '13800010009', email: 'wut@example.com' },
        { name: '郑浩', department: '销售部', position: '销售代表', phone: '13800010010', email: 'zhengh@example.com' },
      ],
    },
    resultSummary: { totalRecords: 10, matchedCount: 10, unmatchedCount: 5 },
  },
];
export function getMockPlan(
  prompt: string,
  taskFileNames: string[],
  sheetDetails?: { name: string; sheetName: string; rows: number; columns: number }[]
): PlanStep[] {
  const fileList = taskFileNames.length > 0 ? taskFileNames.join('、') : '当前文件';
  const isMatch = prompt.includes('匹配');
  const isMerge = prompt.includes('合并');
  const isDedup = prompt.includes('删除重复') || prompt.includes('去重');
  const isSort = prompt.includes('排序');
  const isFilter = prompt.includes('筛选');
  const isSum = prompt.includes('求和') || prompt.includes('统计');
  const isClean = prompt.includes('清洗') || prompt.includes('空白') || prompt.includes('非法');
  const isDangerous = isDedup;
  const step1SubItems: StepSubItem[] = [{ label: '读取文件', value: fileList }];
  if (sheetDetails && sheetDetails.length > 0) {
    for (const sh of sheetDetails) {
      step1SubItems.push({ label: '  ' + sh.sheetName + '（' + sh.rows + '行 × ' + sh.columns + '列）', value: '' });
    }
  }
  let taskTypeChinese = '数据处理';
  if (isMatch) taskTypeChinese = '多表匹配';
  else if (isMerge) taskTypeChinese = '多表合并';
  else if (isDedup) taskTypeChinese = '数据去重';
  else if (isSort) taskTypeChinese = '数据排序';
  else if (isFilter) taskTypeChinese = '数据筛选';
  else if (isSum) taskTypeChinese = '数据求和';
  else if (isClean) taskTypeChinese = '数据清洗';
  const step2SubItems: StepSubItem[] = [
    { label: '任务类型', value: taskTypeChinese },
    { label: '用户指令', value: prompt },
  ];
  const step3SubItems: StepSubItem[] = [];
  if (isMatch && taskFileNames.length >= 2) {
    step3SubItems.push({ label: '匹配方式', value: '按公共字段自动匹配' });
    step3SubItems.push({ label: '主表', value: taskFileNames[0] });
    step3SubItems.push({ label: '副表', value: taskFileNames.slice(1).join('、') });
    step3SubItems.push({ label: '预计匹配字段', value: '姓名' });
  } else if (isMerge) {
    step3SubItems.push({ label: '合并方式', value: '纵向拼接' });
    step3SubItems.push({ label: '参与表数', value: taskFileNames.length });
  } else if (isDedup) {
    step3SubItems.push({ label: '去重依据', value: '文本列自动检测' });
    step3SubItems.push({ label: '处理范围', value: fileList });
  } else if (isSort) {
    step3SubItems.push({ label: '排序方式', value: '数值降序' });
    step3SubItems.push({ label: '处理范围', value: fileList });
  } else if (isFilter) {
    step3SubItems.push({ label: '筛选条件', value: prompt.includes('2024年1月') ? '2024年1月' : '关键词筛选' });
    step3SubItems.push({ label: '处理范围', value: fileList });
  } else if (isSum) {
    step3SubItems.push({ label: '统计方式', value: '求和' });
    step3SubItems.push({ label: '处理范围', value: fileList });
  } else if (isClean) {
    step3SubItems.push({ label: '清洗规则', value: '移除空白行 + 修复非法数据' });
    step3SubItems.push({ label: '处理范围', value: fileList });
  } else {
    step3SubItems.push({ label: '处理范围', value: fileList });
  }
  const resultName = isMatch ? '匹配结果.xlsx' : isMerge ? '合并结果.xlsx' : isDedup ? '去重结果.xlsx' : isSort ? '排序结果.xlsx' : isFilter ? '筛选结果.xlsx' : isSum ? '统计结果.xlsx' : isClean ? '清洗结果.xlsx' : '处理结果.xlsx';
  const step4SubItems: StepSubItem[] = [
    { label: '输出文件', value: resultName },
    { label: '输出格式', value: 'Excel (.xlsx)' },
  ];

  return [
    { id: 'step-1', order: 1, status: 'waiting', isDangerous: false, description: '读取数据文件', details: '本次任务使用: ' + fileList, subItems: step1SubItems },
    { id: 'step-2', order: 2, status: 'waiting', isDangerous: false, description: '分析用户指令', details: prompt, subItems: step2SubItems },
    { id: 'step-3', order: 3, status: 'waiting', isDangerous, description: '执行数据处理', subItems: step3SubItems },
    { id: 'step-4', order: 4, status: 'waiting', isDangerous: false, description: '生成结果文件', subItems: step4SubItems },
  ];
}
export function getTaskAnalysis(
  prompt: string,
  taskFileNames: string[],
  _sheetDetails?: { name: string; sheetName: string; rows: number }[]
): TaskAnalysis {
  const isMatch = prompt.includes('匹配');
  const isMerge = prompt.includes('合并');
  const analysis: TaskAnalysis = { taskType: isMatch ? '多表匹配' : isMerge ? '多表合并' : '数据处理' };
  if (isMatch) {
    analysis.matchField = '姓名';
    analysis.mainTable = taskFileNames[0] ?? '主表';
    analysis.lookupTables = taskFileNames.slice(1);
    // 从实际表数据行数计算
    if (_sheetDetails && _sheetDetails.length > 0) {
      analysis.totalRecords = _sheetDetails.reduce(function (s, sh) { return s + sh.rows; }, 0);
      analysis.estimatedResult = Math.round(analysis.totalRecords * 0.7);
    } else {
      analysis.totalRecords = 2000;
      analysis.estimatedResult = 1000;
    }
  } else if (isMerge) {
    analysis.totalRecords = (taskFileNames.length || 1) * 25;
    analysis.estimatedResult = analysis.totalRecords;
  }
  return analysis;
}
