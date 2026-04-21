import { forwardRef, useEffect, useState } from 'react';
import type { HTMLAttributes } from 'react';

enum MessageType {
  Text = 1,
  Image = 2,
  Voice = 3,
  File = 4,
}

/**
 * 媒体错误类型
 */
export type MediaErrorType = 'decrypt_failed' | 'metadata_missing' | 'legacy_unavailable' | 'download_failed';

type MessageBubbleProps = {
  type: 'in' | 'out';
  messageType: MessageType;
  content: string;
  time: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  isBurn?: boolean;
  burnSeconds?: number;
  replyTo?: { sender: string; text: string };
  fileName?: string;
  fileSize?: string;
  mediaVariant?: 'file' | 'video';
  voiceDuration?: string;
  onRetry?: () => void;
  /** 媒体错误状态 */
  mediaError?: MediaErrorType;
} & HTMLAttributes<HTMLDivElement>;

export const MessageBubble = forwardRef<HTMLDivElement, MessageBubbleProps>(function MessageBubble(props, ref): JSX.Element {
  const {
    type,
    messageType,
    content,
    time,
    status,
    isBurn,
    burnSeconds,
    replyTo,
    fileName,
    fileSize,
    mediaVariant = 'file',
    voiceDuration,
    onRetry,
    mediaError,
    className,
    ...rest
  } = props;

  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [content, messageType]);

  const renderStatus = () => {
    if (type === 'in') return null;
    const statusMap = {
      sending: '⏳',
      sent: '✓',
      delivered: '✓✓',
      read: '✓✓',
      failed: '❌',
    };
    const className = status === 'read' ? 'status-read' : '';
    return <span className={className}>{statusMap[status || 'sent']}</span>;
  };

  /**
   * 获取媒体错误的用户友好提示
   */
  const getMediaErrorMessage = (error?: MediaErrorType): string => {
    switch (error) {
      case 'decrypt_failed':
        return '解密失败，请检查密钥';
      case 'metadata_missing':
        return '媒体元数据缺失';
      case 'legacy_unavailable':
        return '旧版媒体不可用';
      case 'download_failed':
        return '下载失败';
      default:
        return '加载失败';
    }
  };

  const renderContent = () => {
    // 媒体错误状态优先显示
    if (mediaError && messageType !== MessageType.Text) {
      if (messageType === MessageType.Image) {
        return <div className="message-media-error"><span className="error-icon">🔒</span><span>{getMediaErrorMessage(mediaError)}</span></div>;
      }
      if (messageType === MessageType.Voice) {
        return <div className="message-media-error voice-error"><span className="error-icon">🔒</span><span>{getMediaErrorMessage(mediaError)}</span></div>;
      }
      if (messageType === MessageType.File) {
        if (mediaVariant === 'video') {
          return (
            <div className="video-bubble video-error">
              <span className="material-symbols-rounded video-play-icon">lock</span>
              <span className="video-error-text">{getMediaErrorMessage(mediaError)}</span>
            </div>
          );
        }
        return (
          <div className="file-bubble file-error">
            <span className="file-icon">📄</span>
            <div>
              <div className="file-name">{fileName}</div>
              <div className="file-size file-error-text">{getMediaErrorMessage(mediaError)}</div>
            </div>
          </div>
        );
      }
    }
    if (messageType === MessageType.Image) {
      if (!content) {
        return <div className="message-image-placeholder">图片加载中...</div>;
      }
      if (imageError) {
        return <div className="message-image-error">图片加载失败</div>;
      }
      return (
        <img
          src={content}
          alt="图片"
          className="message-image"
          onError={() => setImageError(true)}
        />
      );
    }
    if (messageType === MessageType.Voice) {
      return (
        <div className="voice-bubble">
          <span className="play-btn">▶</span>
          <span className="duration">{voiceDuration}</span>
        </div>
      );
    }
    if (messageType === MessageType.File) {
      if (mediaVariant === 'video') {
        return (
          <div className="video-bubble">
            <span className="material-symbols-rounded video-play-icon">play_arrow</span>
            <span className="video-duration">{fileSize ?? '视频'}</span>
          </div>
        );
      }
      return (
        <div className="file-bubble">
          <span className="file-icon">📄</span>
          <div>
            <div className="file-name">{fileName}</div>
            <div className="file-size">{fileSize}</div>
          </div>
        </div>
      );
    }
    return content;
  };

  return (
    <div
      ref={ref}
      className={`message-bubble ${type}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {replyTo && (
        <div className="reply-preview">
          <span className="reply-sender">{replyTo.sender}</span>
          <span className="reply-text">{replyTo.text}</span>
        </div>
      )}
      <div className="bubble-content">
        {renderContent()}
        {isBurn && burnSeconds != null && <span className="burn-indicator">🔥{burnSeconds}s</span>}
      </div>
      <div className="bubble-meta">
        {renderStatus()}
        <span className="time">{time}</span>
        {status === 'failed' && (
          <button className="retry-btn" onClick={onRetry}>重试</button>
        )}
      </div>
    </div>
  );
});
