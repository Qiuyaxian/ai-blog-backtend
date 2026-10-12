import { ConfigService } from '@nestjs/config';
import { MongooseModuleOptions } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

/**
 * Mongoose 连接选项，设计 §3.3/§3.6。
 * 抽成纯函数便于复用与单测：连接池、超时、写关注、生产 autoIndex 策略集中在此。
 */
export function buildMongooseOptions(
  config: ConfigService,
): MongooseModuleOptions {
  return {
    uri: config.get<string>('MONGODB_URI'),
    // env 值均为字符串，连接池大小需显式转数字
    maxPoolSize: Number(config.get('MONGODB_MAX_POOL_SIZE', 50)),
    minPoolSize: Number(config.get('MONGODB_MIN_POOL_SIZE', 5)),
    maxIdleTimeMS: 60000,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 30000,
    retryWrites: true,
    w: 'majority',
    // 生产关闭自动建索引，由迁移/mongosh 统一管理（设计 §2.4）
    autoIndex: process.env.NODE_ENV !== 'production',
    // 运行期连接错误上屏：Nest 的启动重试日志只打 "Retrying"，吞掉真实原因（ECONNREFUSED/认证失败等）
    connectionFactory: (connection: Connection): Connection => {
      connection.on('error', (err: Error) => {
        console.error(
          `[mongoose] connection error: ${err.name}: ${
            err.message.split('\n')[0]
          }`,
        );
      });
      return connection;
    },
  };
}
