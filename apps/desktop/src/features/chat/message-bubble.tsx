type MessageBubbleProps = {
  type: 'in' | 'out';
  messageType: 1 | 2 | 3 | 4;  // 1文本 2图片 3语音 4文件
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
  const renderStatus = () => {
    if (props.type === 'in') return null;
    const statusMap = {
      sending: '⏳',
      sent: '✓',
      delivered: '✓✓',
      read: '✓✓',
      failed: '❌',
    };
    const className = props.status === 'read' ? 'status-read' : '';
    return <span className={className}>{statusMap[props.status || 'sent']}</span>;
  };

  const renderContent = () => {
    if (props.messageType === 2) {
      return <img src={props.content} alt="图片" className="message-image" />;
    }
    if (props.messageType === 3) {
      return (
        <div className="voice-bubble">
          <span className="play-btn">▶</span>
          <span className="duration">{props.voiceDuration}</span>
        </div>
      );
    }
    if (props.messageType === 4) {
      return (
        <div className="file-bubble">
          <span className="file-icon">📄</span>
          <div>
            <div className="file-name">{props.fileName}</div>
            <div className="file-size">{props.fileSize}</div>
          </div>
        </div>
      );
    }
    return props.content;
  };

  return (
    <div className={`message-bubble ${props.type}`}>
      {props.replyTo && (
        <div className="reply-preview">
          <span className="reply-sender">{props.replyTo.sender}</span>
          <span className="reply-text">{props.replyTo.text}</span>
        </div>
      )}
      <div className="bubble-content">
        {renderContent()}
        {props.isBurn && <span className="burn-indicator">🔥{props.burnSeconds}s</span>}
      </div>
      <div className="bubble-meta">
        {renderStatus()}
        <span className="time">{props.time}</span>
        {props.status === 'failed' && (
          <button className="retry-btn" onClick={props.onRetry}>重试</button>
        )}
      </div>
    </div>
  );
}
