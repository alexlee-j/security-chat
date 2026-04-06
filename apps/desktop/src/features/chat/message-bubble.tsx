import { useState } from 'react';

enum MessageType {
  Text = 1,
  Image = 2,
  Voice = 3,
  File = 4,
}

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
  voiceDuration?: string;
  onRetry?: () => void;
};

export function MessageBubble(props: MessageBubbleProps): JSX.Element {
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
    voiceDuration,
    onRetry,
  } = props;

  const [imageError, setImageError] = useState(false);

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

  const renderContent = () => {
    if (messageType === MessageType.Image) {
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
    <div className={`message-bubble ${type}`}>
      {replyTo && (
        <div className="reply-preview">
          <span className="reply-sender">{replyTo.sender}</span>
          <span className="reply-text">{replyTo.text}</span>
        </div>
      )}
      <div className="bubble-content">
        {renderContent()}
        {isBurn && <span className="burn-indicator">🔥{burnSeconds}s</span>}
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
}
