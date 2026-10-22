import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { CacheService } from '../../common/cache/cache.service';
import { UserResponseDto } from '../user/dto/user-response.dto';
import { UserService } from '../user/user.service';
import { getAuthTokenTtlSeconds } from './auth.config';
import { AUTH_FAIL_PREFIX, AUTH_SESSION_PREFIX } from './auth.constants';
import { LoginDto } from './dto/login.dto';
import { SessionPayload } from './session.interface';

/** 登录成功响应；user 为 001 脱敏视图，绝不携带 password */
export interface LoginResult {
  token: string;
  expiresAt: string;
  user: UserResponseDto;
}

/** 预生成的 bcrypt 哈希（cost 10），仅用于账号不存在时均化时序，不对应任何真实密码 */
const DUMMY_BCRYPT_HASH =
  '$2b$10$KyR7Sa7Iuu8EJWTU1hMRU.77ucqtjCIY0IAyGLQknD05mdoDreL/q';

/**
 * 不透明令牌鉴权服务：登录校验、会话签发/解析/吊销。
 * 用户数据只经 UserService 只读方法，Redis 只经 CacheService。
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly cache: CacheService,
    private readonly userService: UserService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResult> {
    // 用户名/邮箱统一 trim+lowercase 归一（research R3）
    const key = dto.identifier.trim().toLowerCase();
    const credential = await this.userService.findLoginCredential(key);

    // 账号不存在/软删：仍执行一次 bcrypt 比对均化响应时序，防止账号枚举（research R5）
    const passwordHash = credential?.passwordHash ?? DUMMY_BCRYPT_HASH;
    const matched = await bcrypt.compare(dto.password, passwordHash);
    if (!credential || !matched) {
      // TODO(US4/T032): 失败计数 incrWithTtl + lock 键判定
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    // 成功：清零失败计数（键不存在时 del 幂等）
    await this.cache.del(AUTH_FAIL_PREFIX + credential.id);

    // 不透明令牌：256bit 随机数，Redis 只存其 sha256 摘要（data-model §2.2）
    const token = randomBytes(32).toString('hex');
    const sessionKey =
      AUTH_SESSION_PREFIX + createHash('sha256').update(token).digest('hex');
    const ttlSeconds = getAuthTokenTtlSeconds(this.config);
    const payload: SessionPayload = { sub: credential.id };
    // set 失败自然上抛（500），不返回令牌（FR-015 签发侧 fail-closed）
    await this.cache.set(sessionKey, payload, ttlSeconds);

    return {
      token,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      user: credential.user,
    };
  }
}
