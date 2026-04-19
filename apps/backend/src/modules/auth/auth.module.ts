import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SecurityModule } from '../security/security.module';
import { UserModule } from '../user/user.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MailModule } from '../mail/mail.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    UserModule,
    SecurityModule,
    MailModule,
    NotificationModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.get<string>('NODE_ENV') === 'production';
        const secret = configService.get<string>('JWT_SECRET');

        // 生产环境必须配置 JWT_SECRET，不提供默认值
        if (isProduction && !secret) {
          throw new Error('JWT_SECRET environment variable is required in production. Please set a secure secret key.');
        }

        // 开发环境使用默认值但发出警告
        if (!secret) {
          console.warn('WARNING: Using default JWT_SECRET in non-production environment. This is insecure and must be changed before deployment.');
          return {
            secret: 'dev_secret_change_me',
            signOptions: {
              expiresIn: configService.get<string>('JWT_EXPIRES_IN', '15m') as never,
            },
          };
        }

        return {
          secret,
          signOptions: {
            expiresIn: configService.get<string>('JWT_EXPIRES_IN', '15m') as never,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, PassportModule, JwtModule, JwtStrategy],
})
export class AuthModule {}
