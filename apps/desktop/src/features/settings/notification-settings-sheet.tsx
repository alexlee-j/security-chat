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
      <SheetContent side="right" className="w-[320px] sm:w-[360px]">
        <SheetHeader>
          <SheetTitle>通知设置</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
