import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthenticationGuard } from './authentication.guard';
import { CsrfGuard } from './csrf.guard';
import { CsrfService } from './csrf.service';
import { LoginRateLimiter } from './login-rate-limiter.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

@Module({
  controllers: [AuthController],
  providers: [
    AuthenticationGuard,
    CsrfGuard,
    CsrfService,
    LoginRateLimiter,
    PasswordService,
    SessionService,
  ],
  exports: [AuthenticationGuard, CsrfGuard, CsrfService, PasswordService, SessionService],
})
export class AuthModule {}
