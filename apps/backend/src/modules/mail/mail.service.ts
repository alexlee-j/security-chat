import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService implements OnModuleInit {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = this.configService.get<string>('SMTP_PORT') || '587';
    const smtpUser = this.configService.get<string>('SMTP_USER') || process.env.SMTP_USER;
    const smtpPass = this.configService.get<string>('SMTP_PASS') || process.env.SMTP_PASS;

    const smtpConfig = {
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: false, // 使用587端口时，需要设置为false
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    };

    this.logger.log('SMTP Configuration:', {
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      user: smtpConfig.auth.user,
      pass: '***', // 隐藏密码
    });

    this.transporter = nodemailer.createTransport(smtpConfig);
  }

  async onModuleInit(): Promise<void> {
    // 在模块初始化时验证 SMTP 连接
    const skipVerify = this.configService.get<string>('SKIP_SMTP_VERIFY') === 'true';
    if (skipVerify) {
      this.logger.warn('SMTP connection verification skipped (SKIP_SMTP_VERIFY=true)');
      return;
    }
    await this.verifyConnection();
  }

  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified successfully');
    } catch (error) {
      this.logger.error('SMTP connection verification failed:', error);
    }
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    this.logger.log(`Attempting to send email to ${to}`);
    const mailOptions = {
      from: this.configService.get<string>('SMTP_FROM'),
      to,
      subject,
      html,
    };
    this.logger.log('Email options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      html: mailOptions.html.substring(0, 100) + '...', // 只记录前100个字符
    });

    const info = await this.transporter.sendMail(mailOptions);
    this.logger.log(`Email sent successfully to ${to}`, {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      pending: info.pending,
    });
  }

  async sendLoginCode(email: string, code: string): Promise<void> {
    const subject = 'Security Chat 登录验证码';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f5f5f5; padding: 20px;">
          <h2 style="color: #333;">Security Chat 登录验证码</h2>
          <p style="font-size: 16px; line-height: 1.5;">您的登录验证码是：</p>
          <div style="background-color: #fff; border: 1px solid #ddd; padding: 20px; margin: 20px 0; text-align: center;">
            <span style="font-size: 32px; font-weight: bold; color: #3390ec;">${code}</span>
          </div>
          <p style="font-size: 14px; color: #666;">此验证码将在 5 分钟后过期，请及时使用。</p>
          <p style="font-size: 14px; color: #666;">如果您没有请求此验证码，请忽略此邮件。</p>
        </div>
      </div>
    `;

    await this.sendEmail(email, subject, html);
  }

  async sendPasswordResetCode(email: string, code: string, username: string): Promise<void> {
    const subject = 'Security Chat 密码重置验证码';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f5f5f5; padding: 20px;">
          <h2 style="color: #333;">Security Chat 密码重置</h2>
          <p style="font-size: 16px; line-height: 1.5;">您好，${username}！</p>
          <p style="font-size: 16px; line-height: 1.5;">您请求重置密码，您的验证码是：</p>
          <div style="background-color: #fff; border: 1px solid #ddd; padding: 20px; margin: 20px 0; text-align: center;">
            <span style="font-size: 32px; font-weight: bold; color: #3390ec;">${code}</span>
          </div>
          <p style="font-size: 14px; color: #666;">此验证码将在 15 分钟后过期，请及时使用。</p>
          <p style="font-size: 14px; color: #666;">如果您没有请求此验证码，请忽略此邮件，您的账号安全不会受到影响。</p>
        </div>
      </div>
    `;

    await this.sendEmail(email, subject, html);
  }
}
