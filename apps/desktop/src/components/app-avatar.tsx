import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { resolveAvatarSrc } from '@/core/avatar';
import { cn } from '@/lib/utils';
import type { CSSProperties } from 'react';

type AppAvatarProps = {
  avatarUrl?: string | null;
  name: string;
  className?: string;
  fallbackClassName?: string;
  fallbackStyle?: CSSProperties;
  imageClassName?: string;
  showOnline?: boolean;
  onlineClassName?: string;
};

export function getAvatarInitials(value: string): string {
  const trimmed = value.trim();
  return (trimmed || '用户').slice(0, 2).toUpperCase();
}

export function getAvatarColorIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 5;
}

export function AppAvatar({
  avatarUrl,
  name,
  className,
  fallbackClassName,
  fallbackStyle,
  imageClassName,
  showOnline,
  onlineClassName,
}: AppAvatarProps): JSX.Element {
  return (
    <span className="relative inline-flex shrink-0">
      <Avatar className={className}>
        <AvatarImage src={resolveAvatarSrc(avatarUrl)} alt={`${name || '用户'}头像`} className={imageClassName} />
        <AvatarFallback className={cn('text-sm font-semibold', fallbackClassName)} style={fallbackStyle}>
          {getAvatarInitials(name)}
        </AvatarFallback>
      </Avatar>
      {showOnline ? (
        <span
          className={cn(
            'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-success',
            onlineClassName,
          )}
        />
      ) : null}
    </span>
  );
}
