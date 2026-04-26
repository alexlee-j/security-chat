import Redis from 'ioredis';
import { Socket } from 'socket.io';
import { ConversationService } from '../../src/modules/conversation/conversation.service';
import { MessageGateway } from '../../src/modules/message/gateways/message.gateway';
import { WsAuthService } from '../../src/modules/auth/ws-auth.service';

describe('MessageGateway legacy send path', () => {
  it('rejects legacy websocket message.send and returns deprecation error', async () => {
    const conversationService = {} as ConversationService;
    const redis = {} as Redis;
    const wsAuthService = {} as WsAuthService;

    const gateway = new MessageGateway(
      conversationService,
      wsAuthService,
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
