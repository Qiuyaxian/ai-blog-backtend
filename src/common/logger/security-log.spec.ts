import { Logger } from '@nestjs/common';
import { logLoginLockHit } from './security-log';

describe('logLoginLockHit', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('warns with the internal ACCOUNT_LOCKED code and the userId under the security context', () => {
    logLoginLockHit('user-123');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = String(warnSpy.mock.calls[0][0]);
    expect(message).toContain('ACCOUNT_LOCKED');
    expect(message).toContain('userId=user-123');
    // context 由 Logger 实例携带（输出 [security] 前缀），不作为重复第二参
    expect(warnSpy.mock.calls[0][1]).toBeUndefined();
  });

  it('never serializes a password or token into the log line', () => {
    logLoginLockHit('user-123');
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('secret-pass');
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('Bearer');
  });
});
