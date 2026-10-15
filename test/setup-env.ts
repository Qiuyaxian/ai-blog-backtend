// E2E 统一环境：在任何模块 import 前设定，使 ConfigModule 加载 .env.local（Redis 无默认地址，缺省即 fail-fast）
process.env.NODE_ENV = 'local';
