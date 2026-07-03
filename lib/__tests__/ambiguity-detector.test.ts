import { describe, it, expect } from 'vitest';
import { AmbiguityDetector } from '../ambiguity-detector';
import { TaskIntent } from '../types';

function makeIntent(overrides: Partial<TaskIntent>): TaskIntent {
  return {
    operation: 'sort',
    target: '',
    targetColumns: [],
    resolvedColumns: undefined,
    scope: 'all',
    groupBy: undefined,
    filters: undefined,
    aggregation: null,
    params: {},
    targetFiles: [],
    rawPrompt: '',
    confidence: 0,
    ...overrides,
  };
}

// 测试用的简单 SchemaCandidate
function c(key: string, title: string, confidence: number) {
  return { key, title, confidence, matchMethod: 'semantic' as const, reason: '' };
}

describe('AmbiguityDetector.detect — schema 候选版', () => {
  // ============ multi_candidate ============

  it('多候选且分数接近时触发 multi_candidate', () => {
    const intent = makeIntent({ rawPrompt: '将金额排序', target: '金额' });
    const result = AmbiguityDetector.detect(intent, [
      c('orderAmount', '订单金额', 0.85),
      c('actualAmount', '实付金额', 0.65),
    ]);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('multi_candidate');
    expect(result!.columnCandidates.length).toBe(2);
    expect(result!.columnCandidates[0].selected).toBe(true);
  });

  it('top-2 差距大时不触发 multi_candidate', () => {
    const intent = makeIntent({ rawPrompt: '将金额排序', target: '金额' });
    const result = AmbiguityDetector.detect(intent, [
      c('orderAmount', '订单金额', 0.95),
      c('actualAmount', '实付金额', 0.50),
    ]);
    expect(result).toBeNull();
  });

  // ============ no_match ============

  it('无候选时触发 no_match', () => {
    const intent = makeIntent({ rawPrompt: '按手机号排序', target: '手机号' });
    const result = AmbiguityDetector.detect(intent, []);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('no_match');
  });

  // ============ low_confidence ============

  it('最佳候选置信度不足时触发 low_confidence', () => {
    const intent = makeIntent({ rawPrompt: '按手机号排序', target: '手机号' });
    const result = AmbiguityDetector.detect(intent, [c('name', '姓名', 0.45)]);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('low_confidence');
  });

  it('唯一高置信度候选不触发歧义', () => {
    const intent = makeIntent({ rawPrompt: '将基本工资排序', target: '基本工资' });
    const result = AmbiguityDetector.detect(intent, [c('basePay', '基本工资', 0.95)]);
    expect(result).toBeNull();
  });

  // ============ 优先级 ============

  it('multi_candidate 优先级高于 low_confidence', () => {
    const intent = makeIntent({ rawPrompt: '将金额排序', target: '金额' });
    // 同时满足 multi 和 low
    const result = AmbiguityDetector.detect(intent, [
      c('orderAmount', '订单金额', 0.55),
      c('actualAmount', '实付金额', 0.50),
    ]);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('multi_candidate');
  });
});

describe('AmbiguityDetector.buildPreviewPlan', () => {
  it('排序操作返回正确标签', () => {
    const intent = makeIntent({
      operation: 'sort', target: '基本工资',
      resolvedColumns: [{ key: 'basePay', title: '基本工资', confidence: 1.0, matchMethod: 'exact' }],
    });
    const preview = AmbiguityDetector.buildPreviewPlan(intent, 15, 0);
    expect(preview.operationLabel).toBe('数据排序');
    expect(preview.target).toBe('基本工资');
    expect(preview.primaryColumn?.title).toBe('基本工资');
  });

  it('无操作时返回默认标签', () => {
    const intent = makeIntent({ operation: null, target: '' });
    const preview = AmbiguityDetector.buildPreviewPlan(intent, 0, 0);
    expect(preview.operationLabel).toBe('数据处理');
  });
});
