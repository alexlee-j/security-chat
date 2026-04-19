import { useEffect, useState } from 'react';
import { getUserProfile } from '@/core/api';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

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
