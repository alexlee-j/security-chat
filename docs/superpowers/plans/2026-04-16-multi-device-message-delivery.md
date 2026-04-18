# Multi-Device Message Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make direct-message delivery truly correct for multi-device users by issuing device-bound auth, storing one encrypted envelope per target device, and letting each desktop device fetch only the ciphertext intended for itself.

**Architecture:** Keep `messages` as the logical message record (`conversationId`, `senderId`, `messageIndex`, burn/revoke/ack metadata), and add a new per-device envelope table for ciphertext fan-out. Bind REST and WebSocket auth to a concrete `deviceId` in JWT so the backend can derive the current device from authentication context instead of trusting request bodies. Desktop send/decrypt logic should then fan out encryption across recipient devices and consume only the current device’s envelope.

**Tech Stack:** NestJS 11, TypeORM, PostgreSQL, Redis, Socket.IO, React 18, TypeScript, Tauri desktop, local Signal key/session store.

---

## Scope Check

This plan intentionally covers **direct-message multi-device correctness only**. Group messaging should be split into a separate plan because it needs Sender Keys / per-member fan-out decisions that are independent from the direct-message fixes below.

## File Structure

### Backend files to create

- `apps/backend/src/migrations/<timestamp>-AddMessageDeviceEnvelopes.ts`
  Adds the new per-device ciphertext table and indexes.
- `apps/backend/src/modules/message/entities/message-device-envelope.entity.ts`
  TypeORM entity for per-device encrypted copies.
- `apps/backend/src/modules/message/dto/send-message-envelope.dto.ts`
  DTO for one encrypted copy addressed to one target device.
- `apps/backend/src/modules/message/dto/send-message-v2.dto.ts`
  DTO for logical message metadata plus device envelopes.
- `apps/backend/test/message/message.multi-device.spec.ts`
  Integration-style tests for device fan-out and query filtering.

### Backend files to modify

- `apps/backend/src/modules/auth/interfaces/jwt-payload.interface.ts`
  Add `deviceId` to JWT payload.
- `apps/backend/src/common/decorators/current-user.decorator.ts`
  Surface `deviceId` on `RequestUser`.
- `apps/backend/src/modules/auth/strategies/jwt.strategy.ts`
  Validate and expose `deviceId`.
- `apps/backend/src/modules/auth/auth.service.ts`
  Require/validate device-aware login and preserve `deviceId` during refresh.
- `apps/backend/src/modules/auth/dto/login-with-code.dto.ts`
  Add optional `deviceId` to code-login DTO.
- `apps/backend/src/modules/message/entities/message.entity.ts`
  Make `encryptedPayload` nullable for backward compatibility while new envelopes become source of truth.
- `apps/backend/src/modules/message/message.module.ts`
  Register the new entity.
- `apps/backend/src/modules/message/message.service.ts`
  Persist logical message + device envelopes transactionally, query envelopes for current device, and keep ack/revoke on logical message rows.
- `apps/backend/src/modules/message/message.controller.ts`
  Add/route the v2 send API.
- `apps/backend/src/modules/message/gateways/message.gateway.ts`
  Bind socket sessions to device-bound tokens and stop pretending a single ciphertext fits all recipient devices.
- `apps/backend/src/modules/conversation/conversation.service.ts`
  Make “last message preview” query independent from `messages.encrypted_payload`.

### Desktop files to modify

- `apps/desktop/src/core/api.ts`
  Add v2 send/list types and stop sending trusted `sourceDeviceId` in body when auth already carries device context.
- `apps/desktop/src/core/types.ts`
  Expand message item types for envelope-aware responses.
- `apps/desktop/src/core/use-chat-client.ts`
  Encrypt once per target device, call new send API, and decrypt only the current device envelope.
- `apps/desktop/src/core/use-signal.ts`
  Expose current device identity consistently to app code.
- `apps/desktop/src/core/signal/key-management.ts`
  Remove legacy `'1'` assumptions after migration and keep only bounded compatibility fallback.
- `apps/desktop/tests/e2e-multiaccount-messaging.spec.ts`
  Extend to real multi-device direct-message coverage.

---

## Contract Decisions

1. `deviceId` is part of access and refresh JWT payloads. The backend derives current device from auth, not from request JSON.
2. One logical direct message maps to **N** stored ciphertext envelopes, where **N = recipient device count**. Sender-local plaintext cache remains desktop-only and is not a backend storage concern.
3. `GET /message/list` returns the same logical message fields as today, but the `encryptedPayload` field must be the envelope addressed to the current authenticated device.
4. `message.sent` / `conversation.updated` events stay logical-message based; clients refresh/fetch device-specific payload through authenticated APIs.
5. Legacy rows without envelope records stay readable through fallback to `messages.encrypted_payload` until migration cleanup is complete.

---

## Task 1: Device-Bound Auth Context

**Files:**
- Modify: `apps/backend/src/modules/auth/interfaces/jwt-payload.interface.ts`
- Modify: `apps/backend/src/common/decorators/current-user.decorator.ts`
- Modify: `apps/backend/src/modules/auth/strategies/jwt.strategy.ts`
- Modify: `apps/backend/src/modules/auth/auth.service.ts`
- Modify: `apps/backend/src/modules/auth/dto/login-with-code.dto.ts`
- Test: `apps/backend/test/auth/auth.device-login.spec.ts`

- [ ] **Step 1: Add `deviceId` to JWT payload and request user types**

```ts
export interface JwtPayload {
  sub: string;
  jti: string;
  type: 'access' | 'refresh';
  deviceId: string;
  iat: number;
  exp: number;
}

export interface RequestUser {
  userId: string;
  jti: string;
  tokenType: 'access' | 'refresh';
  deviceId: string;
  iat: number;
  exp: number;
}
```

- [ ] **Step 2: Make JWT strategy expose `deviceId`**

```ts
return {
  userId: payload.sub,
  jti: payload.jti,
  tokenType: payload.type,
  deviceId: payload.deviceId,
  iat: payload.iat,
  exp: payload.exp,
};
```

- [ ] **Step 3: Require device-aware login issuance in auth service**

```ts
if (!dto.deviceId) {
  throw new BadRequestException('deviceId is required');
}

await this.userService.assertOwnDevice(user.id, dto.deviceId);
await this.userService.touchDeviceActivity(user.id, dto.deviceId);

return this.issueTokenPair(user.id, dto.deviceId);
```

- [ ] **Step 4: Preserve `deviceId` on refresh and code-login**

```ts
async loginWithCode(dto: LoginWithCodeDto, clientIp = 'unknown'): Promise<AuthTokens> {
  if (!dto.deviceId) {
    throw new BadRequestException('deviceId is required');
  }
  await this.userService.assertOwnDevice(user.id, dto.deviceId);
  return this.issueTokenPair(user.id, dto.deviceId);
}

private async issueTokenPair(userId: string, deviceId: string): Promise<AuthTokens> {
  const accessPayload = { sub: userId, jti: accessJti, type: 'access', deviceId };
  const refreshPayload = { sub: userId, jti: refreshJti, type: 'refresh', deviceId };
  // signAsync(...)
}
```

- [ ] **Step 5: Write the auth regression test**

```ts
it('issues access and refresh tokens bound to the requested device', async () => {
  const result = await authService.login({
    account: 'alice',
    password: 'Password123',
    deviceId: aliceDevice.id,
  });

  const access = await jwtService.verifyAsync<JwtPayload>(result.accessToken);
  const refresh = await jwtService.verifyAsync<JwtPayload>(result.refreshToken);

  expect(access.deviceId).toBe(aliceDevice.id);
  expect(refresh.deviceId).toBe(aliceDevice.id);
});
```

- [ ] **Step 6: Run the focused auth test**

Run: `pnpm -C apps/backend test -- auth.device-login.spec.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/auth/interfaces/jwt-payload.interface.ts apps/backend/src/common/decorators/current-user.decorator.ts apps/backend/src/modules/auth/strategies/jwt.strategy.ts apps/backend/src/modules/auth/auth.service.ts apps/backend/src/modules/auth/dto/login-with-code.dto.ts apps/backend/test/auth/auth.device-login.spec.ts
git commit -m "feat(auth): bind jwt sessions to device ids"
```

---

## Task 2: Add Per-Device Envelope Storage

**Files:**
- Create: `apps/backend/src/migrations/<timestamp>-AddMessageDeviceEnvelopes.ts`
- Create: `apps/backend/src/modules/message/entities/message-device-envelope.entity.ts`
- Modify: `apps/backend/src/modules/message/entities/message.entity.ts`
- Modify: `apps/backend/src/modules/message/message.module.ts`
- Test: `apps/backend/test/message/message.multi-device.spec.ts`

- [ ] **Step 1: Create the new entity**

```ts
@Entity({ name: 'message_device_envelopes' })
@Index(['messageId', 'targetDeviceId'], { unique: true })
@Index(['targetDeviceId', 'messageId'])
export class MessageDeviceEnvelope {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'message_id', type: 'uuid' })
  messageId!: string;

  @Column({ name: 'target_user_id', type: 'uuid' })
  targetUserId!: string;

  @Column({ name: 'target_device_id', type: 'uuid' })
  targetDeviceId!: string;

  @Column({ name: 'source_device_id', type: 'uuid' })
  sourceDeviceId!: string;

  @Column({ name: 'encrypted_payload', type: 'text' })
  encryptedPayload!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
```

- [ ] **Step 2: Add the migration**

```ts
await queryRunner.query(`
  CREATE TABLE "message_device_envelopes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "message_id" uuid NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
    "target_user_id" uuid NOT NULL,
    "target_device_id" uuid NOT NULL REFERENCES "devices"("id") ON DELETE CASCADE,
    "source_device_id" uuid NOT NULL REFERENCES "devices"("id") ON DELETE RESTRICT,
    "encrypted_payload" text NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now()
  );
`);
await queryRunner.query(`CREATE UNIQUE INDEX "IDX_msg_env_message_target_device" ON "message_device_envelopes" ("message_id", "target_device_id")`);
await queryRunner.query(`CREATE INDEX "IDX_msg_env_target_device_message" ON "message_device_envelopes" ("target_device_id", "message_id")`);
await queryRunner.query(`ALTER TABLE "messages" ALTER COLUMN "encrypted_payload" DROP NOT NULL`);
```

- [ ] **Step 3: Register the entity in the message module**

```ts
TypeOrmModule.forFeature([
  Message,
  MessageDeviceEnvelope,
  DraftMessage,
  RevokeEvent,
  MediaAsset,
])
```

- [ ] **Step 4: Add migration smoke test expectations**

```ts
it('persists a device envelope row per target device', async () => {
  const envelopes = await envelopeRepository.find({ where: { messageId } });
  expect(envelopes).toHaveLength(2);
  expect(envelopes.map((row) => row.targetDeviceId).sort()).toEqual([bobMac.id, bobWin.id].sort());
});
```

- [ ] **Step 5: Run backend typecheck and migration test**

Run: `pnpm -C apps/backend exec tsc --noEmit`
Expected: PASS

Run: `pnpm -C apps/backend test -- message.multi-device.spec.ts`
Expected: FAIL until Task 3 is complete

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/migrations apps/backend/src/modules/message/entities/message-device-envelope.entity.ts apps/backend/src/modules/message/entities/message.entity.ts apps/backend/src/modules/message/message.module.ts apps/backend/test/message/message.multi-device.spec.ts
git commit -m "feat(message): add per-device envelope storage"
```

---

## Task 3: Implement Device-Fan-Out Message Send API

**Files:**
- Create: `apps/backend/src/modules/message/dto/send-message-envelope.dto.ts`
- Create: `apps/backend/src/modules/message/dto/send-message-v2.dto.ts`
- Modify: `apps/backend/src/modules/message/message.controller.ts`
- Modify: `apps/backend/src/modules/message/message.service.ts`
- Test: `apps/backend/test/message/message.multi-device.spec.ts`

- [ ] **Step 1: Define the v2 send DTOs**

```ts
export class SendMessageEnvelopeDto {
  @IsUUID()
  targetUserId!: string;

  @IsUUID()
  targetDeviceId!: string;

  @IsString()
  encryptedPayload!: string;
}

export class SendMessageV2Dto {
  @IsUUID()
  conversationId!: string;

  @IsIn([1, 2, 3, 4])
  messageType!: number;

  @IsString()
  nonce!: string;

  @ValidateNested({ each: true })
  @Type(() => SendMessageEnvelopeDto)
  envelopes!: SendMessageEnvelopeDto[];

  @IsOptional()
  @IsUUID()
  mediaAssetId?: string;

  @IsOptional()
  @IsBoolean()
  isBurn?: boolean;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(300)
  burnDuration?: number;
}
```

- [ ] **Step 2: Add a v2 send route**

```ts
@Post('send-v2')
sendV2(
  @CurrentUser() user: RequestUser,
  @Body() dto: SendMessageV2Dto,
): Promise<{ messageId: string; messageIndex: string }> {
  return this.messageService.sendMessageV2(user, dto);
}
```

- [ ] **Step 3: Persist logical message plus all target envelopes in one transaction**

```ts
async sendMessageV2(
  user: RequestUser,
  dto: SendMessageV2Dto,
): Promise<{ messageId: string; messageIndex: string }> {
  await this.conversationService.assertMember(dto.conversationId, user.userId);
  await this.assertEnvelopeTargetsBelongToConversation(dto.conversationId, dto.envelopes);

  return this.dataSource.transaction(async (manager) => {
    const message = await this.createLogicalMessage(manager, user, dto);
    const rows = dto.envelopes.map((envelope) =>
      manager.create(MessageDeviceEnvelope, {
        messageId: message.id,
        targetUserId: envelope.targetUserId,
        targetDeviceId: envelope.targetDeviceId,
        sourceDeviceId: user.deviceId,
        encryptedPayload: envelope.encryptedPayload,
      }),
    );
    await manager.save(MessageDeviceEnvelope, rows);
    return { messageId: message.id, messageIndex: String(message.messageIndex) };
  });
}
```

- [ ] **Step 4: Reject malformed envelope sets**

```ts
if (dto.envelopes.length === 0) {
  throw new BadRequestException('envelopes must not be empty');
}

const seen = new Set<string>();
for (const envelope of dto.envelopes) {
  const key = `${envelope.targetUserId}:${envelope.targetDeviceId}`;
  if (seen.has(key)) {
    throw new BadRequestException('duplicate target device envelope');
  }
  seen.add(key);
}
```

- [ ] **Step 5: Update the integration test to prove two recipient devices get two ciphertext rows**

```ts
expect(result.messageIndex).toBe('1');

const logical = await messageRepository.findOneByOrFail({ id: result.messageId });
expect(logical.sourceDeviceId).toBe(aliceMac.id);

const envelopes = await envelopeRepository.find({
  where: { messageId: result.messageId },
  order: { targetDeviceId: 'ASC' },
});

expect(envelopes).toHaveLength(2);
expect(envelopes.every((row) => row.sourceDeviceId === aliceMac.id)).toBe(true);
```

- [ ] **Step 6: Run the focused message test**

Run: `pnpm -C apps/backend test -- message.multi-device.spec.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/message/dto/send-message-envelope.dto.ts apps/backend/src/modules/message/dto/send-message-v2.dto.ts apps/backend/src/modules/message/message.controller.ts apps/backend/src/modules/message/message.service.ts apps/backend/test/message/message.multi-device.spec.ts
git commit -m "feat(message): fan out direct messages to target devices"
```

---

## Task 4: Make Query APIs Device-Aware

**Files:**
- Modify: `apps/backend/src/modules/message/message.service.ts`
- Modify: `apps/backend/src/modules/conversation/conversation.service.ts`
- Test: `apps/backend/test/message/message.multi-device.spec.ts`

- [ ] **Step 1: Join the current device envelope in `queryMessages`**

```ts
const rows = await this.messageRepository
  .createQueryBuilder('m')
  .leftJoin(
    MessageDeviceEnvelope,
    'env',
    'env.message_id = m.id AND env.target_device_id = :deviceId',
    { deviceId: user.deviceId },
  )
  .addSelect('COALESCE(env.encrypted_payload, m.encrypted_payload)', 'resolved_encrypted_payload')
  .where('m.conversationId = :conversationId', { conversationId: query.conversationId })
  .andWhere('m.messageIndex > :afterIndex', { afterIndex: String(afterIndex) })
  .orderBy('m.messageIndex', 'ASC')
  .limit(limit)
  .getRawMany();
```

- [ ] **Step 2: Map `resolved_encrypted_payload` back into API rows**

```ts
return rows.map((row) => ({
  ...row.message,
  encryptedPayload: row.resolved_encrypted_payload,
}));
```

- [ ] **Step 3: Stop sidebar preview queries from depending on `messages.encrypted_payload`**

```ts
// conversation.service.ts
lastMessage: {
  messageId: row.last_message_id,
  messageIndex: row.last_message_index ?? '0',
  senderId: row.last_message_sender_id,
  messageType: row.last_message_type,
  encryptedPayload: row.last_message_encrypted_payload ?? '',
  // preview payload may be empty for new v2 rows; desktop must tolerate that
}
```

Also add a deliberate code comment:

```ts
// For device-fan-out rows, list preview is metadata-only and should not assume
// the current query has access to a universal ciphertext.
```

- [ ] **Step 4: Add a test proving different devices see different ciphertext for the same message**

```ts
it('returns only the envelope addressed to the authenticated device', async () => {
  const macRows = await messageService.queryMessages({ ...aliceCtx, deviceId: bobMac.id }, query);
  const winRows = await messageService.queryMessages({ ...aliceCtx, deviceId: bobWin.id }, query);

  expect(macRows[0].encryptedPayload).toBe('cipher-for-mac');
  expect(winRows[0].encryptedPayload).toBe('cipher-for-win');
});
```

- [ ] **Step 5: Run message tests**

Run: `pnpm -C apps/backend test -- message.multi-device.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/message/message.service.ts apps/backend/src/modules/conversation/conversation.service.ts apps/backend/test/message/message.multi-device.spec.ts
git commit -m "feat(message): filter queried ciphertext by authenticated device"
```

---

## Task 5: Update Desktop API Types and Send Flow

**Files:**
- Modify: `apps/desktop/src/core/api.ts`
- Modify: `apps/desktop/src/core/types.ts`
- Modify: `apps/desktop/src/core/use-chat-client.ts`
- Test: `apps/desktop/tests/e2e-multiaccount-messaging.spec.ts`

- [ ] **Step 1: Add v2 request types**

```ts
type SendMessageEnvelopeInput = {
  targetUserId: string;
  targetDeviceId: string;
  encryptedPayload: string;
};

type SendMessageV2Input = {
  conversationId: string;
  messageType: 1 | 2 | 3 | 4;
  mediaAssetId?: string;
  isBurn: boolean;
  burnDuration?: number;
  envelopes: SendMessageEnvelopeInput[];
};
```

- [ ] **Step 2: Add the v2 API function**

```ts
export async function sendMessageV2(input: SendMessageV2Input): Promise<{ messageId: string; messageIndex: string }> {
  const nonce = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  const res = await http.post<ApiEnvelope<{ messageId: string; messageIndex: string }>>('/message/send-v2', {
    conversationId: input.conversationId,
    messageType: input.messageType,
    nonce,
    mediaAssetId: input.mediaAssetId,
    isBurn: input.isBurn,
    burnDuration: input.isBurn ? input.burnDuration : undefined,
    envelopes: input.envelopes,
  });
  return res.data.data;
}
```

- [ ] **Step 3: Fan out encryption across all recipient devices**

```ts
const deviceGroups = await getDevicesByUserIds([recipientUserId]);
const targetDevices = deviceGroups[0]?.devices ?? [];
if (targetDevices.length === 0) {
  throw new Error('No recipient devices available');
}

const envelopes = await Promise.all(
  targetDevices.map(async (device) => ({
    targetUserId: recipientUserId,
    targetDeviceId: device.deviceId,
    encryptedPayload: await signalActions.encryptMessage(recipientUserId, device.deviceId, messageText),
  })),
);

await sendMessageV2({
  conversationId: activeConversationIdRef.current,
  messageType,
  mediaAssetId: messageType === 1 ? undefined : pendingMediaAssetIdRef.current ?? undefined,
  isBurn: isBurnForThisMessage,
  burnDuration: isBurnForThisMessage ? burnDuration : undefined,
  envelopes,
});
```

- [ ] **Step 4: Remove body-level trust in `sourceDeviceId` from desktop send path**

```ts
// no sourceDeviceId field in sendMessageV2 input
// current device identity is already carried by JWT
```

- [ ] **Step 5: Update message item types to accept device-resolved ciphertext**

```ts
export type MessageItem = {
  id: string;
  conversationId: string;
  senderId: string;
  sourceDeviceId?: string;
  messageType: number;
  encryptedPayload: string;
  // ...
};
```

- [ ] **Step 6: Add desktop E2E for one sender and one recipient with two devices**

```ts
test('recipient devices receive independently decryptable copies', async () => {
  // alice-mac sends once
  // bob-mac and bob-win login with different device ids
  // both list the same logical message id
  // both decrypt visible content to "hello multi-device"
});
```

- [ ] **Step 7: Run desktop typecheck**

Run: `pnpm -C apps/desktop exec tsc --noEmit`
Expected: existing unrelated Signal migration / wasm errors may remain; this task must not add new errors in edited files

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/core/api.ts apps/desktop/src/core/types.ts apps/desktop/src/core/use-chat-client.ts apps/desktop/tests/e2e-multiaccount-messaging.spec.ts
git commit -m "feat(desktop): send direct messages to all recipient devices"
```

---

## Task 6: Tighten Desktop Decrypt and Session Lookup

**Files:**
- Modify: `apps/desktop/src/core/use-chat-client.ts`
- Modify: `apps/desktop/src/core/signal/key-management.ts`
- Modify: `apps/desktop/src/core/use-signal.ts`
- Test: `apps/desktop/tests/e2e-multiaccount-messaging.spec.ts`

- [ ] **Step 1: Keep legacy fallback narrow and explicit**

```ts
const senderDeviceId = sourceDeviceId ?? '1'; // legacy rows only
decrypted = await signalActions.decryptMessage(senderId, senderDeviceId, payload);
```

Add the comment:

```ts
// Only old rows created before message_device_envelopes existed should hit this fallback.
```

- [ ] **Step 2: Remove outdated session-key comments that claim the database cannot store source device ids**

```ts
/**
 * Generate session key using real remote device identity.
 * Legacy fallback to deviceId='1' exists only for pre-migration rows.
 */
```

- [ ] **Step 3: Expose current device id through one stable access path**

```ts
const currentDeviceId = KeyManager.getInstance().getDeviceId();
if (!currentDeviceId) {
  throw new Error('Current device ID is unavailable');
}
```

- [ ] **Step 4: Extend E2E to prove no cross-device session reuse occurs after account switch**

```ts
test('account switch resets signal runtime before decrypting another user session', async () => {
  // login as alice, logout, login as bob on same desktop process
  // ensure bob can still decrypt his own incoming message
  // ensure no stale alice session keys are used
});
```

- [ ] **Step 5: Run the focused desktop E2E**

Run: `pnpm -C apps/desktop test -- e2e-multiaccount-messaging.spec.ts`
Expected: PASS when local backend + desktop harness are running

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/core/use-chat-client.ts apps/desktop/src/core/signal/key-management.ts apps/desktop/src/core/use-signal.ts apps/desktop/tests/e2e-multiaccount-messaging.spec.ts
git commit -m "fix(signal): complete multi-device decrypt and session isolation"
```

---

## Task 7: WebSocket and Compatibility Cleanup

**Files:**
- Modify: `apps/backend/src/modules/message/gateways/message.gateway.ts`
- Modify: `apps/backend/src/modules/message/message.service.ts`
- Modify: `apps/desktop/src/core/use-chat-client.ts`
- Test: `apps/backend/scripts/v1-ws-e2e.mjs`

- [ ] **Step 1: Stop WebSocket `message.send` from pretending to deliver one ciphertext to all devices**

```ts
client.emit('message.error', {
  code: 'UNSUPPORTED_DIRECT_SEND',
  message: 'Use REST send-v2 for device-aware encrypted direct messages',
});
```

or, if product requires WS send, make it call the same `sendMessageV2` service contract with explicit envelopes.

- [ ] **Step 2: Keep `message.sent` and `conversation.updated` logical**

```ts
this.server.to(room).emit('message.sent', {
  conversationId,
  messageId: payload.messageId,
  messageIndex: payload.messageIndex,
  senderId: payload.senderId,
  createdAt: payload.createdAt,
});
```

- [ ] **Step 3: Add compatibility fallback path for old rows**

```ts
const resolvedPayload = row.env_encrypted_payload ?? row.message_encrypted_payload ?? '';
```

- [ ] **Step 4: Extend WS E2E to assert logical events still fire after v2 send**

```js
const update = await waitForSocketEvent(bobSocket, 'conversation.updated', (event) => event.reason === 'message.sent');
expect(update.conversationId).toBe(conversationId);
```

- [ ] **Step 5: Run backend WS regression**

Run: `pnpm verify:backend:v1`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/message/gateways/message.gateway.ts apps/backend/src/modules/message/message.service.ts apps/desktop/src/core/use-chat-client.ts apps/backend/scripts/v1-ws-e2e.mjs
git commit -m "fix(ws): align realtime events with device-aware message delivery"
```

---

## Validation Matrix

- [ ] `pnpm -C apps/backend exec tsc --noEmit`
- [ ] `pnpm -C apps/backend test -- auth.device-login.spec.ts`
- [ ] `pnpm -C apps/backend test -- message.multi-device.spec.ts`
- [ ] `pnpm verify:backend:v1`
- [ ] `pnpm -C apps/desktop exec tsc --noEmit`
- [ ] `pnpm -C apps/desktop test -- e2e-multiaccount-messaging.spec.ts`

## Rollout Notes

- Keep `messages.encrypted_payload` nullable and readable for old rows during the migration window.
- Remove the legacy `'1'` decrypt fallback only after all active desktop builds have upgraded and no pre-envelope rows remain in message history.
- Do not implement group fan-out in this plan; create a separate plan once direct-message device correctness is merged.

## Self-Review

### Spec coverage

- Device-bound login/auth: covered in Task 1.
- Multi-device ciphertext fan-out: covered in Tasks 2 and 3.
- Device-aware history query/decrypt: covered in Tasks 4 and 6.
- WebSocket compatibility: covered in Task 7.
- Validation and rollout safety: covered in Validation Matrix and Rollout Notes.

### Placeholder scan

- No `TODO` / `TBD` placeholders remain.
- Every code-changing task includes exact files, example code, commands, and expected results.

### Type consistency

- `deviceId` is consistently added to `JwtPayload`, `RequestUser`, and auth issuance.
- `SendMessageV2Dto` consistently uses `envelopes`.
- Backend logical message rows keep `sourceDeviceId`; per-device rows use `targetDeviceId`.

Plan complete and saved to `docs/superpowers/plans/2026-04-16-multi-device-message-delivery.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
