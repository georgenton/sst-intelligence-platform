import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { CookieOptions } from 'express';
import { AccessTokenGuard } from './access-token.guard';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto, RegisterDto } from './dto';
import type { ApiRequest, AuthenticatedUser } from '../common/request-context';
import { requestMetadata } from '../common/request-context';

function positiveIntegerEnvironmentValue(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

const authAttemptThrottleLimit = positiveIntegerEnvironmentValue('AUTH_ATTEMPT_THROTTLE_LIMIT', 5);
const authRefreshThrottleLimit = positiveIntegerEnvironmentValue('AUTH_REFRESH_THROTTLE_LIMIT', 30);

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
      path: '/api/v1/auth',
    };
  }

  private cookie(response: Response, token: string) {
    response.cookie('sst_refresh', token, {
      ...this.cookieOptions(),
      maxAge: Number(process.env.REFRESH_TOKEN_DAYS ?? 30) * 86_400_000,
    });
  }

  @Post('register')
  @Throttle({ default: { limit: authAttemptThrottleLimit, ttl: 60_000 } })
  async register(
    @Body() body: RegisterDto,
    @Req() request: ApiRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.register(body, requestMetadata(request));
    this.cookie(response, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Post('login')
  @Throttle({ default: { limit: authAttemptThrottleLimit, ttl: 60_000 } })
  async login(
    @Body() body: LoginDto,
    @Req() request: ApiRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(body, requestMetadata(request));
    this.cookie(response, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Post('refresh')
  @Throttle({ default: { limit: authRefreshThrottleLimit, ttl: 60_000 } })
  async refresh(@Req() request: ApiRequest, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.refresh(
      request.cookies?.sst_refresh as string | undefined,
      requestMetadata(request),
    );
    this.cookie(response, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Post('logout')
  async logout(@Req() request: ApiRequest, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(request.cookies?.sst_refresh as string | undefined);
    response.clearCookie('sst_refresh', this.cookieOptions());
    return { success: true };
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }
}
