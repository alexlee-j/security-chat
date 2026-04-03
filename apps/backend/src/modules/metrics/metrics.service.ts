import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleDestroy {
  private readonly registry: client.Registry;

  // 消息指标
  private readonly messageCounter: client.Counter;
  private readonly messageLatency: client.Histogram;

  // WebSocket 指标
  private readonly websocketConnections: client.Gauge;

  // PreKey 指标
  private readonly prekeyQueryCounter: client.Counter;
  private readonly prekeyQueryLatency: client.Histogram;

  // HTTP 指标
  private readonly httpRequests: client.Counter;
  private readonly httpRequestDuration: client.Histogram;

  // 业务指标
  private readonly activeUsers: client.Gauge;
  private readonly conversationsTotal: client.Gauge;
  private readonly onlineUsers: client.Gauge;
  private readonly encryptedMessagesRatio: client.Gauge;

  constructor() {
    this.registry = new client.Registry();

    // 添加默认指标（Node.js 运行时）
    this.registry.setDefaultLabels({ app: 'security-chat-backend' });
    client.collectDefaultMetrics({ register: this.registry });

    // 消息指标
    this.messageCounter = new client.Counter({
      name: 'messages_total',
      help: 'Total number of messages sent',
      labelNames: ['type', 'status'],
      registers: [this.registry],
    });

    this.messageLatency = new client.Histogram({
      name: 'message_latency_seconds',
      help: 'Message routing latency in seconds',
      labelNames: ['type'],
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
      registers: [this.registry],
    });

    // WebSocket 指标
    this.websocketConnections = new client.Gauge({
      name: 'websocket_connections_active',
      help: 'Number of active WebSocket connections',
      registers: [this.registry],
    });

    // PreKey 指标
    this.prekeyQueryCounter = new client.Counter({
      name: 'prekey_queries_total',
      help: 'Total number of PreKey queries',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.prekeyQueryLatency = new client.Histogram({
      name: 'prekey_query_latency_seconds',
      help: 'PreKey query latency in seconds',
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
      registers: [this.registry],
    });

    // HTTP 指标
    this.httpRequests = new client.Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'path', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path'],
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    // 业务指标
    this.activeUsers = new client.Gauge({
      name: 'active_users_total',
      help: 'Total number of active users',
      registers: [this.registry],
    });

    this.conversationsTotal = new client.Gauge({
      name: 'conversations_total',
      help: 'Total number of conversations',
      registers: [this.registry],
    });

    this.onlineUsers = new client.Gauge({
      name: 'online_users_current',
      help: 'Current number of online users',
      registers: [this.registry],
    });

    this.encryptedMessagesRatio = new client.Gauge({
      name: 'encrypted_messages_ratio',
      help: 'Ratio of encrypted messages to total messages',
      registers: [this.registry],
    });
  }

  onModuleDestroy() {
    this.registry.clear();
  }

  getRegistry(): client.Registry {
    return this.registry;
  }

  // 消息指标方法
  incrementMessageCounter(type: string, status: string): void {
    this.messageCounter.inc({ type, status });
  }

  observeMessageLatency(type: string, duration: number): void {
    this.messageLatency.observe({ type }, duration);
  }

  // WebSocket 指标方法
  setWebSocketConnections(count: number): void {
    this.websocketConnections.set(count);
  }

  incrementWebSocketConnections(): void {
    this.websocketConnections.inc();
  }

  decrementWebSocketConnections(): void {
    this.websocketConnections.dec();
  }

  // PreKey 指标方法
  incrementPrekeyQueryCounter(status: string): void {
    this.prekeyQueryCounter.inc({ status });
  }

  observePrekeyQueryLatency(duration: number): void {
    this.prekeyQueryLatency.observe(duration);
  }

  // HTTP 指标方法
  incrementHttpRequests(method: string, path: string, status: number): void {
    this.httpRequests.inc({ method, path, status: String(status) });
  }

  observeHttpRequestDuration(method: string, path: string, duration: number): void {
    this.httpRequestDuration.observe({ method, path }, duration);
  }

  // 业务指标方法
  setActiveUsers(count: number): void {
    this.activeUsers.set(count);
  }

  setConversationsTotal(count: number): void {
    this.conversationsTotal.set(count);
  }

  setOnlineUsers(count: number): void {
    this.onlineUsers.set(count);
  }

  setEncryptedMessagesRatio(ratio: number): void {
    this.encryptedMessagesRatio.set(ratio);
  }
}
