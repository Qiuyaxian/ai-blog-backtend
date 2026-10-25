import {
  isEnvelopeExcludedPath,
  SUCCESS_CODE,
  SUCCESS_MESSAGE,
} from './response.constants';

describe('isEnvelopeExcludedPath', () => {
  it('豁免根路径', () => {
    expect(isEnvelopeExcludedPath('/')).toBe(true);
  });

  it('豁免 /health 前缀及其子路径', () => {
    expect(isEnvelopeExcludedPath('/health')).toBe(true);
    expect(isEnvelopeExcludedPath('/health/live')).toBe(true);
    expect(isEnvelopeExcludedPath('/health/ready')).toBe(true);
  });

  it('业务路径不豁免', () => {
    expect(isEnvelopeExcludedPath('/users')).toBe(false);
    expect(isEnvelopeExcludedPath('/auth/login')).toBe(false);
    expect(isEnvelopeExcludedPath('/users/me')).toBe(false);
  });

  it('形似但非 /health 前缀的路径不豁免（边界防误判）', () => {
    expect(isEnvelopeExcludedPath('/healthx')).toBe(false);
    expect(isEnvelopeExcludedPath('/health-2')).toBe(false);
    expect(isEnvelopeExcludedPath('')).toBe(false);
  });

  it('导出统一成功码与成功消息常量', () => {
    expect(SUCCESS_CODE).toBe('SUCCESS');
    expect(SUCCESS_MESSAGE).toBe('ok');
  });
});
