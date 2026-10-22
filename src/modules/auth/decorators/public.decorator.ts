import { SetMetadata } from '@nestjs/common';

/** 路由公开标记的 metadata 键；全局 AuthGuard 读取后跳过鉴权（白名单制） */
export const IS_PUBLIC_KEY = 'isPublic';

/** 标记路由为公开访问（无需 Bearer 令牌），如登录、注册、健康检查 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
