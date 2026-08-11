import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AccessTokenGuard } from './access-token.guard';
import { AuthService } from './auth.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const developmentSecret = 'development-only-change-with-at-least-32-characters';
        const secret = config.get<string>('JWT_ACCESS_SECRET') ?? developmentSecret;
        if (config.get<string>('NODE_ENV') === 'production' && secret === developmentSecret) {
          throw new Error('JWT_ACCESS_SECRET must be configured securely in production');
        }
        return {
          secret,
          signOptions: { expiresIn: (config.get<string>('ACCESS_TOKEN_TTL') ?? '15m') as '15m' },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AccessTokenGuard],
  exports: [AuthService, AccessTokenGuard],
})
export class AuthModule {}
