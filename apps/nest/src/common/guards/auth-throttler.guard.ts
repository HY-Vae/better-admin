import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler';

/** auth 接口限流开关（缺省 true）。e2e 测试装配默认关闭，避免登录类用例被自身限流打断 */
export function isThrottleEnabled(): boolean {
  return (process.env.THROTTLE_ENABLED ?? 'true') === 'true';
}

/**
 * auth 接口限流守卫（挂 AuthController 类级，契约 v1.14.1）。
 *
 * 背景：/api/auth/login、/api/auth/demo-login、/api/auth/refresh 是无鉴权公开口，
 * 应用层此前无限流；六端共用同一个 Supabase 库，接口被刷会先拖垮 6543 pooler。
 * Nest 部署于 Render 免费 Web Service（单实例常驻进程，UptimeRobot 保活），
 * 进程内计数即全局计数，无需 Redis；将来横向扩多实例时再换 ThrottlerModule 的
 * storage 实现（@nestjs/throttler 预留接口）。
 *
 * 计数 key 用 req.ip——⚠️ main.ts 必须先 app.set('trust proxy', 1)：
 * Render 反代后面若不配置，所有请求的 req.ip 都是代理 IP，全体用户会共享
 * 同一个计数桶、被一并限流。
 *
 * 超限统一抛 429 { code: 'TOO_MANY_REQUESTS' }（对齐全局错误信封）；
 * 429 不落 logs（http-exception.filter / logging.interceptor 均已排除）——
 * 与 DEMO_READONLY 同理：拒绝属预期交互，逐条记录会为刷量流量开放新的刷库通道。
 */
@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!isThrottleEnabled()) {
      return true;
    }
    try {
      return await super.canActivate(context);
    } catch (error) {
      if (error instanceof ThrottlerException) {
        throw new HttpException(
          { code: 'TOO_MANY_REQUESTS', message: '请求过于频繁，请稍后再试' },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw error;
    }
  }
}
