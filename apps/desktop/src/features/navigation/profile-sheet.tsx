import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { getUserProfile, updateUserAvatar } from '@/core/api';
import { compressAvatarImage } from '@/core/avatar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AppAvatar } from '@/components/app-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

type ProfileSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
};

type UserProfile = {
  id: string;
  username: string;
  avatarUrl: string | null;
};

export function ProfileSheet({ open, onOpenChange, userId }: ProfileSheetProps): JSX.Element {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) {
      return;
    }
    let active = true;
    setLoading(true);
    void getUserProfile(userId)
      .then((data) => {
        if (active) {
          setProfile(data);
        }
      })
      .catch((error) => {
        console.error('[ProfileSheet] Failed to load profile:', error);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [open, userId]);

  async function copyUserId(): Promise<void> {
    if (!profile) {
      return;
    }
    try {
      await navigator.clipboard.writeText(profile.id);
    } catch (error) {
      console.error('[ProfileSheet] Failed to copy user id:', error);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] sm:w-[420px] p-0">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-border px-6 py-5 text-left">
            <SheetTitle>个人中心</SheetTitle>
            <p className="text-sm text-muted-foreground">
              账户身份与当前可用资料字段
            </p>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">账号身份</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <p className="text-sm text-muted-foreground">加载个人资料中...</p>
                ) : (
                  <>
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={profile?.avatarUrl ?? undefined} alt={profile?.username ?? '用户头像'} />
                        <AvatarFallback className="text-lg font-semibold">
                          {(profile?.username ?? userId).slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-lg font-semibold">
                            {profile?.username ?? '未命名用户'}
                          </h3>
                          <Badge variant="secondary">已登录</Badge>
                        </div>
                        <p className="truncate text-sm text-muted-foreground">
                          {profile?.id ?? userId}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">用户 ID</span>
                        <span className="truncate font-mono">{profile?.id ?? userId}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">用户名</span>
                        <span className="truncate font-medium">{profile?.username ?? '加载后显示'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">头像</span>
                        <span>{profile?.avatarUrl ? '已配置' : '未配置'}</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">支持的资料字段</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>当前阶段仅展示后端已提供的基础身份信息。</p>
                <ul className="space-y-1 pl-4">
                  <li>• 用户 ID</li>
                  <li>• 用户名</li>
                  <li>• 头像地址</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="border-t border-border p-4">
            <Button className="w-full" variant="outline" onClick={copyUserId} disabled={!profile}>
              复制用户 ID
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

type ProfilePanelProps = {
  userId: string;
  onLogout: () => void;
  onProfileUpdated?: (profile: { username: string; avatarUrl: string | null }) => void;
};

export function ProfilePanel({ userId, onLogout, onProfileUpdated }: ProfilePanelProps): JSX.Element {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!userId) {
      return;
    }
    let active = true;
    setLoading(true);
    void getUserProfile(userId)
      .then((data) => {
        if (active) {
          setProfile(data);
        }
      })
      .catch((error) => {
        console.error('[ProfilePanel] Failed to load profile:', error);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [userId]);

  async function copyUserId(): Promise<void> {
    if (!profile) {
      return;
    }
    try {
      await navigator.clipboard.writeText(profile.id);
    } catch (error) {
      console.error('[ProfilePanel] Failed to copy user id:', error);
    }
  }

  function handleAvatarClick(): void {
    if (avatarUploading) {
      return;
    }
    fileInputRef.current?.click();
  }

  async function handleAvatarFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || avatarUploading) {
      return;
    }

    setAvatarUploading(true);
    setAvatarMessage('正在压缩头像...');
    try {
      const compressed = await compressAvatarImage(file);
      setAvatarMessage('正在上传头像...');
      const updated = await updateUserAvatar(compressed);
      setProfile(updated);
      onProfileUpdated?.({ username: updated.username, avatarUrl: updated.avatarUrl });
      setAvatarMessage('头像已更新');
    } catch (error) {
      console.error('[ProfilePanel] Avatar update failed:', error);
      setAvatarMessage(error instanceof Error ? error.message : '头像更新失败，请重试');
    } finally {
      setAvatarUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="profile-panel profile-panel-loading">
        <div className="profile-panel-skeleton" />
      </div>
    );
  }

  return (
    <div className="profile-panel">
      {/* 头部区域 */}
      <div className="profile-panel-hero">
        <div className="profile-panel-avatar-wrapper">
          <AppAvatar
            avatarUrl={profile?.avatarUrl}
            name={profile?.username ?? userId}
            className="profile-panel-avatar"
            fallbackClassName="profile-panel-avatar-fallback"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => void handleAvatarFileChange(event)}
          />
          <button
            type="button"
            className="profile-panel-avatar-upload-btn"
            onClick={handleAvatarClick}
            disabled={avatarUploading}
            aria-label="上传头像"
          >
            <span className="material-symbols-rounded">photo_camera</span>
          </button>
        </div>
        <h1 className="profile-panel-username">
          {profile?.username ?? '未命名用户'}
        </h1>
        <div className="profile-panel-status">
          <span className="profile-panel-status-dot" />
          <span>在线</span>
        </div>
        {avatarMessage ? <p className="profile-panel-avatar-message">{avatarMessage}</p> : null}
      </div>

      {/* 账户信息卡片 */}
      <Card className="profile-panel-card">
        <CardHeader>
          <CardTitle>账户信息</CardTitle>
        </CardHeader>
        <CardContent className="profile-panel-card-content">
          <div className="profile-panel-info-row">
            <span className="profile-panel-info-label">用户 ID</span>
            <div className="profile-panel-info-value-wrapper">
              <span className="profile-panel-info-value font-mono">{profile?.id ?? userId}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="profile-panel-copy-btn"
                onClick={copyUserId}
                aria-label="复制用户 ID"
              >
                <span className="material-symbols-rounded">content_copy</span>
              </Button>
            </div>
          </div>
          <div className="profile-panel-info-row">
            <span className="profile-panel-info-label">用户名</span>
            <span className="profile-panel-info-value">{profile?.username ?? '加载后显示'}</span>
          </div>
          <div className="profile-panel-info-row">
            <span className="profile-panel-info-label">头像状态</span>
            <span className="profile-panel-info-value">{profile?.avatarUrl ? '已配置' : '未配置'}</span>
          </div>
        </CardContent>
      </Card>

      {/* 安全状态卡片 */}
      <Card className="profile-panel-card">
        <CardHeader>
          <CardTitle>安全状态</CardTitle>
        </CardHeader>
        <CardContent className="profile-panel-card-content">
          <div className="profile-panel-security-grid">
            <div className="profile-panel-security-item">
              <div className="profile-panel-security-icon">
                <span className="material-symbols-rounded">device_hub</span>
              </div>
              <div className="profile-panel-security-info">
                <span className="profile-panel-security-label">当前设备</span>
                <span className="profile-panel-security-value">桌面端</span>
              </div>
            </div>
            <div className="profile-panel-security-item">
              <div className="profile-panel-security-icon success">
                <span className="material-symbols-rounded">lock</span>
              </div>
              <div className="profile-panel-security-info">
                <span className="profile-panel-security-label">消息加密</span>
                <span className="profile-panel-security-value">Signal 端到端</span>
              </div>
            </div>
            <div className="profile-panel-security-item">
              <div className="profile-panel-security-icon success">
                <span className="material-symbols-rounded">photo_library</span>
              </div>
              <div className="profile-panel-security-info">
                <span className="profile-panel-security-label">媒体加密</span>
                <span className="profile-panel-security-value">端到端加密</span>
              </div>
            </div>
            <div className="profile-panel-security-item">
              <div className="profile-panel-security-icon success">
                <span className="material-symbols-rounded"> vpn_key</span>
              </div>
              <div className="profile-panel-security-info">
                <span className="profile-panel-security-label">密钥交换</span>
                <span className="profile-panel-security-value">X3DH 协议</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
