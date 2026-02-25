import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConsumePrekeyDto } from './dto/consume-prekey.dto';
import { UploadPrekeysDto } from './dto/upload-prekeys.dto';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  async profile(@Param('id', new ParseUUIDPipe()) id: string): Promise<{
    id: string;
    username: string;
    email: string;
    phone: string;
  }> {
    const user = await this.userService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('keys/upload')
  uploadPrekeys(
    @CurrentUser() user: RequestUser,
    @Body() dto: UploadPrekeysDto,
  ): Promise<{ inserted: number; deviceId: string }> {
    return this.userService.uploadOneTimePrekeys(user.userId, dto.deviceId, dto.prekeys);
  }

  @UseGuards(JwtAuthGuard)
  @Get('keys/device/:deviceId/next')
  nextPrekey(
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
  ): Promise<{ preKeyId: string; deviceId: string; publicKey: string } | null> {
    return this.userService.getNextAvailablePrekey(deviceId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('keys/device/:deviceId/next-consume')
  nextConsumePrekey(
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
  ): Promise<{ preKeyId: string; deviceId: string; publicKey: string } | null> {
    return this.userService.getAndConsumeNextPrekey(deviceId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('keys/consume')
  consumePrekey(@Body() dto: ConsumePrekeyDto): Promise<{
    consumed: boolean;
    alreadyUsed: boolean;
    preKeyId: string;
  }> {
    return this.userService.consumePrekey(dto.preKeyId);
  }
}
