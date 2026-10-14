import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, closeTestApp, createTestApp, type ApiResult, type TestApp } from './setup/test-app';

// 本文件专测限流自身：在装配前显式开启（test-app.ts 对 e2e 默认关闭）。
// guard 的开关在每请求读取 env，因此设置时机只需早于首次请求。
process.env.THROTTLE_ENABLED = 'true';

/** auth 类级阈值（与 auth.controller.ts 保持同步） */
const AUTH_LIMIT = 20;
/** refresh 方法级放宽阈值（与 auth.controller.ts 保持同步） */
const REFRESH_LIMIT = 60;

interface Envelope {
  code?: string;
  message?: string;
}

describe('auth 接口限流（AuthThrottlerGuard，契约 v1.14.1）', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('阈值内的失败登录照常透出业务 401（不被限流干扰）', async () => {
    const res = await api(app, 'POST', '/auth/login', {
      body: { username: '__throttle_probe__', password: 'wrong-password' },
    });
    expect(res.status).toBe(401);
    expect((res.body as Envelope).code).toBe('INVALID_CREDENTIALS');
  });

  it(`同 IP 连发超过 ${AUTH_LIMIT} 次后返回 429 且信封 code 为 TOO_MANY_REQUESTS`, async () => {
    let last: ApiResult | null = null;
    for (let i = 0; i < AUTH_LIMIT + 5; i++) {
      last = await api(app, 'POST', '/auth/login', {
        body: { username: '__throttle_probe__', password: 'wrong-password' },
      });
    }
    expect(last).not.toBeNull();
    expect(last!.status).toBe(429);
    const body = last!.body as Envelope;
    expect(body.code).toBe('TOO_MANY_REQUESTS');
    expect(body.message).toBe('请求过于频繁，请稍后再试');
  });

  it(`refresh 阈值放宽至 ${REFRESH_LIMIT}：连发 ${AUTH_LIMIT + 5} 次不触发 429（全部业务 401）`, async () => {
    for (let i = 0; i < AUTH_LIMIT + 5; i++) {
      const res = await api(app, 'POST', '/auth/refresh', {
        body: { refreshToken: 'invalid-refresh-token-probe' },
      });
      expect(res.status).toBe(401);
    }
  });
});
