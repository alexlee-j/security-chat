import { useState } from 'react';
import { AppAvatar } from '@/components/app-avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetUsername: string;
  targetAvatarUrl?: string | null;
  onConfirm: (targetUserId: string) => Promise<void>;
};

export function RemoveFriendDialog({
  open,
  onOpenChange,
  targetUserId,
  targetUsername,
  targetAvatarUrl,
  onConfirm,
}: Props): JSX.Element {
  const [removing, setRemoving] = useState(false);

  async function handleConfirm(): Promise<void> {
    if (!targetUserId || removing) {
      return;
    }
    setRemoving(true);
    try {
      await onConfirm(targetUserId);
      onOpenChange(false);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>解除好友关系</DialogTitle>
          <DialogDescription>
            解除后你们将不再是好友，但聊天记录会保留。
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3">
          <AppAvatar avatarUrl={targetAvatarUrl} name={targetUsername || '用户'} className="h-10 w-10" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{targetUsername || '未命名用户'}</p>
            <p className="truncate text-xs font-mono text-muted-foreground">{targetUserId}</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="destructive" disabled={removing} onClick={() => void handleConfirm()}>
            {removing ? '解除中...' : '解除关系'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
