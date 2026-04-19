import { useState, useEffect } from 'react';
import { getNotificationSettings, updateNotificationSettings } from '@/core/api';
import { NotificationSettings } from '@/core/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface NotificationSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationSettingsSheet({ open, onOpenChange }: NotificationSettingsSheetProps): JSX.Element {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      void loadSettings();
    }
  }, [open]);

  async function loadSettings(): Promise<void> {
    setLoading(true);
    try {
      const data = await getNotificationSettings();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(key: keyof NotificationSettings, value: boolean): Promise<void> {
    if (!settings) return;

    setSaving(true);
    try {
      const updated = await updateNotificationSettings({ [key]: value });
      setSettings(updated);
    } catch (error) {
      console.error('Failed to update notification settings:', error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[360px] sm:w-[420px] p-0">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-border px-6 py-5 text-left">
            <SheetTitle>设置</SheetTitle>
            <p className="text-sm text-muted-foreground">
              通知设置与未来设置结构
            </p>
          </SheetHeader>

          <div className="flex-1 space-y-6 overflow-y-auto p-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">通知设置</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  这里展示后端已支持的通知分类，并保持当前有效值与保存后状态一致。
                </p>
              </CardContent>
            </Card>

          {loading ? (
            <div className="text-center text-muted-foreground py-8">加载中...</div>
          ) : settings ? (
            <>
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">消息通知</h3>
                <div className="flex items-center justify-between">
                  <Label htmlFor="messageEnabled" className="flex flex-col gap-1">
                    <span>新消息通知</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      接收来自聊天消息的通知
                    </span>
                  </Label>
                  <Switch
                    id="messageEnabled"
                    checked={settings.messageEnabled}
                    onCheckedChange={(checked) => void handleToggle('messageEnabled', checked)}
                    disabled={saving}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">好友请求</h3>
                <div className="flex items-center justify-between">
                  <Label htmlFor="friendRequestEnabled" className="flex flex-col gap-1">
                    <span>好友请求通知</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      接收好友请求相关通知
                    </span>
                  </Label>
                  <Switch
                    id="friendRequestEnabled"
                    checked={settings.friendRequestEnabled}
                    onCheckedChange={(checked) => void handleToggle('friendRequestEnabled', checked)}
                    disabled={saving}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">阅后即焚</h3>
                <div className="flex items-center justify-between">
                  <Label htmlFor="burnEnabled" className="flex flex-col gap-1">
                    <span>阅后即焚通知</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      接收消息被焚毁的通知
                    </span>
                  </Label>
                  <Switch
                    id="burnEnabled"
                    checked={settings.burnEnabled}
                    onCheckedChange={(checked) => void handleToggle('burnEnabled', checked)}
                    disabled={saving}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">群聊</h3>
                <div className="flex items-center justify-between">
                  <Label htmlFor="groupEnabled" className="flex flex-col gap-1">
                    <span>群聊通知</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      接收群组消息通知
                    </span>
                  </Label>
                  <Switch
                    id="groupEnabled"
                    checked={settings.groupEnabled}
                    onCheckedChange={(checked) => void handleToggle('groupEnabled', checked)}
                    disabled={saving}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">账号安全</h3>
                <div className="flex items-center justify-between">
                  <Label htmlFor="accountRecoveryEnabled" className="flex flex-col gap-1">
                    <span>密码恢复通知</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      接收找回密码和重置密码相关通知
                    </span>
                  </Label>
                  <Switch
                    id="accountRecoveryEnabled"
                    checked={settings.accountRecoveryEnabled}
                    onCheckedChange={(checked) => void handleToggle('accountRecoveryEnabled', checked)}
                    disabled={saving}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">安全事件</h3>
                <div className="flex items-center justify-between">
                  <Label htmlFor="securityEventEnabled" className="flex flex-col gap-1">
                    <span>安全事件通知</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      接收异常登录与风险行为等安全告警
                    </span>
                  </Label>
                  <Switch
                    id="securityEventEnabled"
                    checked={settings.securityEventEnabled}
                    onCheckedChange={(checked) => void handleToggle('securityEventEnabled', checked)}
                    disabled={saving}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">群治理事件</h3>
                <div className="flex items-center justify-between">
                  <Label htmlFor="groupLifecycleEnabled" className="flex flex-col gap-1">
                    <span>群成员变更通知</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      接收加人、移人、退群等治理事件通知
                    </span>
                  </Label>
                  <Switch
                    id="groupLifecycleEnabled"
                    checked={settings.groupLifecycleEnabled}
                    onCheckedChange={(checked) => void handleToggle('groupLifecycleEnabled', checked)}
                    disabled={saving}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              加载失败，请重试
            </div>
          )}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">未来设置</CardTitle>
                  <Badge variant="secondary">预留</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">隐私设置</p>
                    <p className="text-xs text-muted-foreground">后续阶段再接入可见性和安全偏好。</p>
                  </div>
                  <Button variant="outline" size="sm" disabled>
                    待开放
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">聊天设置</p>
                    <p className="text-xs text-muted-foreground">对话显示、输入行为和会话偏好预留位。</p>
                  </div>
                  <Button variant="outline" size="sm" disabled>
                    待开放
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">安全设置</p>
                    <p className="text-xs text-muted-foreground">用于后续身份验证和设备管理入口。</p>
                  </div>
                  <Button variant="outline" size="sm" disabled>
                    待开放
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
