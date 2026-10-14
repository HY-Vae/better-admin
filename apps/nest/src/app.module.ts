import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { AccountModule } from './account/account.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { MenusModule } from './modules/menus/menus.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { DictModule } from './modules/dict/dict.module';
import { LogsModule } from './modules/logs/logs.module';
import { OrgModule } from './modules/org/org.module';
import { NoticeModule } from './modules/notice/notice.module';
import { StatsModule } from './modules/stats/stats.module';
import { HealthController } from './modules/health/health.controller';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { DemoReadonlyGuard } from './auth/guards/demo-readonly.guard';

/**
 * 根模块（Phase 2 基础设施阶段）。
 * 已接入：全局异常过滤器、全局响应拦截器、API 日志拦截器、演示只读守卫（DEMO_MODE）、
 * ValidationPipe、Auth / Users / Roles / Menus / Permissions / Dict / Logs 模块。
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // 定时任务基础设施（消费者：日志清理 LogCleanupService、refresh_tokens 清理 RefreshTokenCleanupService）
    ScheduleModule.forRoot(),
    // 限流基础设施（契约 v1.14.1）：为 AuthThrottlerGuard 提供 storage 与默认 options；
    // 此处默认值仅兜底，auth 三口的实际阈值由 auth.controller.ts 的 @Throttle 声明
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
    AuthModule,
    AccountModule,
    UsersModule,
    RolesModule,
    MenusModule,
    PermissionsModule,
    DictModule,
    LogsModule,
    OrgModule,
    NoticeModule,
    StatsModule,
  ],
  controllers: [HealthController],
  providers: [
    // 演示只读守卫（契约 v1.10.0）：全局注册，DEMO_MODE=true 时拦所有非白名单非 GET
    { provide: APP_GUARD, useClass: DemoReadonlyGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
