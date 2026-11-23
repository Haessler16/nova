import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module';
import { SecurityEventsModule } from '../security-events/security-events.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';
import { AuthenticationGuard } from './authentication.guard';
import { CsrfGuard } from './csrf.guard';
import { CsrfService } from './csrf.service';
import { LoginRateLimiter } from './login-rate-limiter.service';
import { MfaEnrollmentService } from './mfa-enrollment.service';
import { MfaService } from './mfa.service';
import { PasswordChangeService } from './password-change.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { TotpService } from './totp.service';

@Module({
  imports: [ObservabilityModule, SecurityEventsModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthTokenService,
    AuthenticationGuard,
    CsrfGuard,
    CsrfService,
    LoginRateLimiter,
    MfaEnrollmentService,
    MfaService,
    PasswordChangeService,
    PasswordService,
    SessionService,
    TotpService,
  ],
  exports: [
    AuthService,
    AuthTokenService,
    AuthenticationGuard,
    CsrfGuard,
    CsrfService,
    MfaService,
    PasswordService,
    SessionService,
    TotpService,
  ],
})
export class AuthModule {}
