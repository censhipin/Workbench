import { describe, it, expect } from 'vitest';
import { RuleBasedSemanticParser } from '@/lib/nlu/semantic-parser';

const cols = [
  { key: 'name', title: '姓名', type: 'text' },
  { key: 'dept', title: '部门', type: 'text' },
  { key: 'basePay', title: '基本工资', type: 'number' },
  { key: 'bonus', title: '绩效奖金', type: 'number' },
];

const parser = new RuleBasedSemanticParser();

describe('aggregate fixes', () => {
  it('按部门计算平均工资 → sum+AVG+按部门分组', () => {
    const r = parser.parse('按部门计算平均工资', cols, ['工资表.xlsx']);
    expect(r.operation).toBe('sum');
    expect(r.groupBy).toEqual(['部门']);
    expect(r.aggregation).toBe('AVG');
  });

  it('按部门计算部门人数 → sum+COUNT+按部门分组', () => {
    const r = parser.parse('按部门计算部门人数', cols, ['工资表.xlsx']);
    expect(r.operation).toBe('sum');
    expect(r.groupBy).toEqual(['部门']);
    expect(r.aggregation).toBe('COUNT');
  });

  it('统计各部门工资总和 → sum+SUM+按部门分组', () => {
    const r = parser.parse('统计各部门工资总和', cols, ['工资表.xlsx']);
    expect(r.operation).toBe('sum');
    expect(r.groupBy).toEqual(['部门']);
    expect(r.target).toBe('工资');
    expect(r.aggregation).toBe('SUM');
  });

  it('按部门统计工资 → sum+SUM+按部门分组', () => {
    const r = parser.parse('按部门统计工资', cols, ['工资表.xlsx']);
    expect(r.operation).toBe('sum');
    expect(r.groupBy).toEqual(['部门']);
    expect(r.target).toBe('工资');
    expect(r.aggregation).toBe('SUM');
  });

  it('只看姓名和部门 → select', () => {
    const r = parser.parse('只看姓名和部门', cols, ['工资表.xlsx']);
    expect(r.operation).toBe('select');
  });

});
