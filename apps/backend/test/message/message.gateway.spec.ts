import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { ConversationService } from '../../src/modules/conversation/conversation.service';
import { MessageGateway } from '../../src/modules/message/gateways/message.gateway';

describe('MessageGateway legacy send path', () => {
  it('rejects legacy websocket message.send and returns deprecation error', async () => {
    const jwtService = {} as JwtService;
    const configService = {} as ConfigService;
    const conversationService = {} as ConversationService;
    const redis = {} as Redis;

    const gateway = new MessageGateway(
      jwtService,
      configService,
      conversationService,
      redis,
    );

    const emit = jest.fn();
    const client = {
      emit,
      data: {
        userId: 'user-1',
      },
    } as unknown as Socket;

    await gateway.handleSendMessage(client, {
      recipientId: 'user-2',
      encryptedMessage: {
        messageType: 1,
        body: 'cipher',
      },
    });

    expect(emit).toHaveBeenCalledWith('message.error', {
      code: 'LEGACY_TRANSPORT_DEPRECATED',
      message: 'WebSocket message.send is deprecated. Use REST /api/v1/message/send-v2.',
    });
  });
});
