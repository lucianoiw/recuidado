import { Global, type MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { PlanGate } from '@recuidado/core';
import { AuthController } from './auth.controller.js';
import { AuthMiddleware } from './auth.middleware.js';
import { AuthService } from './auth.service.js';

@Global()
@Module({
  controllers: [AuthController],
  // PlanGate is here so every module can ask whether a family gets calls (the paid part).
  providers: [AuthService, AuthMiddleware, PlanGate],
  exports: [AuthService, PlanGate],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes({ path: '{*splat}', method: RequestMethod.ALL });
  }
}
