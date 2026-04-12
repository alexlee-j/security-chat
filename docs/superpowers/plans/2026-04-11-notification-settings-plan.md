# Notification Settings 实现计划

> **创建时间**: 2026-04-11
> **功能**: 用户级别通知偏好设置（免打扰 + 通知类型开关）
> **状态**: 待实现

---

## 背景

根据后端代码 review 报告，notification 模块缺少免打扰 (Do Not Disturb) 功能。当前系统只能对单个会话静音，缺少用户级别的通知偏好设置。

**相关问题**: `docs/superpowers/plans/2026-04-11-backend-review-report.md` - P0 #4

---

## 功能设计

### 1. NotificationSettings 实体

```typescript
// apps/backend/src/modules/notification/entities/notification-settings.entity.ts

@Entity({ name: 'notification_settings' })
export class NotificationSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  userId!: string;

  // 免打扰开关
  @Column({ name: 'dnd_enabled', type: 'boolean', default: false })
  dndEnabled!: boolean;

  // 免打扰时间范围（24小时制，格式 "HH:mm"）
  @Column({ name: 'dnd_start_time', type: 'varchar', length: 5, nullable: true })
  dndStartTime!: string | null;  // "22:00"

  @Column({ name: 'dnd_end_time', type: 'varchar', length: 5, nullable: true })
  dndEndTime!: string | null;    // "08:00"

  // 按通知类型的开关
  @Column({ name: 'allow_message', type: 'boolean', default: true })
  allowMessage!: boolean;

  @Column({ name: 'allow_friend_request', type: 'boolean', default: true })
  allowFriendRequest!: boolean;

  @Column({ name: 'allow_group', type: 'boolean', default: true })
  allowGroup!: boolean;

  @Column({ name: 'allow_system', type: 'boolean', default: true })
  allowSystem!: boolean;

  @Column({ name: 'allow_burn', type: 'boolean', default: true })
  allowBurn!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
```

### 2. DTO 定义

```typescript
// apps/backend/src/modules/notification/dto/update-notification-settings.dto.ts

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  dndEnabled?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'dndStartTime must be in HH:mm format' })
  dndStartTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'dndEndTime must be in HH:mm format' })
  dndEndTime?: string;

  @IsOptional()
  @IsBoolean()
  allowMessage?: boolean;

  @IsOptional()
  @IsBoolean()
  allowFriendRequest?: boolean;

  @IsOptional()
  @IsBoolean()
  allowGroup?: boolean;

  @IsOptional()
  @IsBoolean()
  allowSystem?: boolean;

  @IsOptional()
  @IsBoolean()
  allowBurn?: boolean;
}
```

### 3. 通知检查逻辑

在 `NotificationService.createBatchNotifications()` 中添加检查：

```typescript
async createBatchNotifications(dtos: CreateNotificationDto[]): Promise<{ createdCount: number }> {
  // 获取用户的通知设置
  const settings = await this.getNotificationSettings(userId);

  // 过滤掉不应该发送的通知
  const allowedNotifications = dtos.filter(dto => {
    // 检查免打扰时间
    if (this.isInDndPeriod(settings)) {
      return false;
    }

    // 检查通知类型是否被允许
    return this.isNotificationTypeAllowed(dto.type, settings);
  });

  // ...
}
```

### 4. API 端点

```
GET    /api/v1/notification/settings      # 获取通知设置
PATCH  /api/v1/notification/settings      # 更新通知设置
```

---

## 实现步骤

### Step 1: 创建 NotificationSettings 实体
- [ ] 创建 `notification-settings.entity.ts`
- [ ] 添加数据库迁移

### Step 2: 添加 DTO
- [ ] 创建 `update-notification-settings.dto.ts`
- [ ] 添加验证装饰器

### Step 3: 更新 NotificationService
- [ ] 添加 `getNotificationSettings()` 方法
- [ ] 添加 `isInDndPeriod()` 方法
- [ ] 添加 `isNotificationTypeAllowed()` 方法
- [ ] 更新 `createBatchNotifications()` 集成检查逻辑

### Step 4: 添加 API 端点
- [ ] 添加 `GET /notification/settings` 端点
- [ ] 添加 `PATCH /notification/settings` 端点

### Step 5: 更新 NotificationModule
- [ ] 导入 TypeORM feature
- [ ] 导出 NotificationService

---

## 注意事项

1. **时区处理**: DND 时间使用服务器时区，可能需要考虑用户时区
2. **默认值**: 新用户应该有合理的默认设置（所有通知允许）
3. **会话静音**: 会话级别的静音 (`conversation_members.is_muted`) 应该仍然生效，与通知设置独立

---

## 影响分析

- `NotificationService.createBatchNotifications()` - 需要添加检查逻辑
- `NotificationSettings` - 新实体
- 前端可能需要添加设置页面（可选）
