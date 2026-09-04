import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AccessTokenGuard } from './access-token.guard';
import { refreshCookieOptions, resolveRefreshCookieName } from './auth-cookie';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto, RegisterDto } from './dto';
import type { ApiRequest, AuthenticatedUser } from '../common/request-context';
import { requestMetadata } from '../common/request-context';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private cookie(response: Response, token: string) {
    response.cookie(resolveRefreshCookieName(), token, {
      ...refreshCookieOptions(),
      maxAge: Number(process.env.REFRESH_TOKEN_DAYS ?? 30) * 86_400_000,
    });
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
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
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
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
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(@Req() request: ApiRequest, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.refresh(
      request.cookies?.[resolveRefreshCookieName()] as string | undefined,
      requestMetadata(request),
    );
    this.cookie(response, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Post('logout')
  async logout(@Req() request: ApiRequest, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(request.cookies?.[resolveRefreshCookieName()] as string | undefined);
    response.clearCookie(resolveRefreshCookieName(), refreshCookieOptions());
    return { success: true };
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }
}
