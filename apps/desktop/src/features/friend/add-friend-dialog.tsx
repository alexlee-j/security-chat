import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { FriendSearchItem } from '../../core/types';
import { searchUsers } from '../../core/api';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestFriend: (targetUserId: string) => Promise<void>;
};

function relationLabel(relation: FriendSearchItem['relation']): string {
  switch (relation) {
    case 'friends':
      return '已是好友';
    case 'pending_outgoing':
      return '已申请';
    case 'pending_incoming':
      return '待处理';
    case 'blocked':
      return '已拉黑';
    default:
      return '可添加';
  }
}

function isRequestable(relation: FriendSearchItem['relation']): boolean {
  return relation === 'none';
}

function getInitials(value: string): string {
  return value.trim().slice(0, 2).toUpperCase();
}

export function AddFriendDialog({ open, onOpenChange, onRequestFriend }: Props): JSX.Element {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<FriendSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [pendingTargetId, setPendingTargetId] = useState('');
  const [hint, setHint] = useState('');

  useEffect(() => {
    if (open) {
      return;
    }
    setKeyword('');
    setResults([]);
    setSearching(false);
    setPendingTargetId('');
    setHint('');
  }, [open]);

  async function handleSearch(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmed = keyword.trim();
    if (!trimmed) {
      setResults([]);
      setHint('请输入用户名、邮箱、手机号或用户 ID。');
      return;
    }
    setSearching(true);
    setHint('');
    try {
      const rows = await searchUsers(trimmed, 20);
      setResults(rows);
      if (rows.length === 0) {
        setHint('未找到匹配用户。');
      }
    } catch {
      setHint('搜索好友失败，请稍后重试。');
    } finally {
      setSearching(false);
    }
  }

  async function handleRequest(user: FriendSearchItem): Promise<void> {
    if (!isRequestable(user.relation) || pendingTargetId) {
      return;
    }
    setPendingTargetId(user.userId);
    try {
      await onRequestFriend(user.userId);
      setKeyword('');
      setResults([]);
      setHint('好友申请已发送。');
      onOpenChange(false);
    } finally {
      setPendingTargetId('');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>添加好友</DialogTitle>
          <DialogDescription>
            在当前页面搜索用户并发送好友申请，不需要切换到好友中心。
          </DialogDescription>
        </DialogHeader>

        <form className="flex gap-2" onSubmit={handleSearch}>
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="输入用户名、邮箱、手机号或用户 ID"
          />
          <Button type="submit" variant="secondary" disabled={searching}>
            {searching ? '搜索中...' : '搜索'}
          </Button>
        </form>

        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}

        <ScrollArea className="max-h-[360px] pr-1">
          <div className="space-y-2">
            {results.map((user) => (
              <div
                key={user.userId}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3"
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="text-sm font-semibold">
                    {getInitials(user.username)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{user.username}</span>
                    <Badge variant={isRequestable(user.relation) ? 'outline' : 'secondary'}>
                      {relationLabel(user.relation)}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground font-mono">{user.userId}</p>
                </div>
          <Button
            size="sm"
            disabled={!isRequestable(user.relation) || pendingTargetId === user.userId}
            onClick={() => void handleRequest(user)}
          >
                  {pendingTargetId === user.userId
                    ? '发送中...'
                    : isRequestable(user.relation)
                      ? '加好友'
                      : relationLabel(user.relation)}
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
