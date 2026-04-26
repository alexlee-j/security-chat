/**
 * WebSocket 并发握手基准测试
 * 测量高并发下的连接成功率与握手耗时分布
 */

interface ConcurrencyResult {
  totalClients: number;
  connectedCount: number;
  failedCount: number;
  successRate: number;
  connectMinMs: number;
  connectAvgMs: number;
  connectP50Ms: number;
  connectP90Ms: number;
  connectP99Ms: number;
  connectMaxMs: number;
  totalDurationMs: number;
}

function percentile(sorted: number[], ratio: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * ratio));
  return sorted[index];
}

function getAuthTokens(): string[] {
  const multi = process.env.BENCH_TOKENS
    ?.split(',')
    .map((token) => token.trim())
    .filter(Boolean);
  if (multi && multi.length > 0) {
    return multi;
  }
  const single = process.env.BENCH_TOKEN?.trim();
  if (single) {
    return [single];
  }
  throw new Error('Missing BENCH_TOKEN or BENCH_TOKENS for authenticated /ws benchmark');
}

async function measureWebSocketConcurrency(
  concurrentClients = 1000,
  serverUrl = 'http://localhost:3000',
): Promise<ConcurrencyResult> {
  const { io } = await import('socket.io-client');
  const authTokens = getAuthTokens();
  const connectTimeoutMs = Number(process.env.BENCH_CONNECT_TIMEOUT_MS ?? '15000');
  const connectLatencies: number[] = [];

  let connectedCount = 0;
  let failedCount = 0;

  const clients: Array<ReturnType<typeof io>> = [];
  const startAt = Date.now();
  const connectPromises: Promise<void>[] = [];

  for (let i = 0; i < concurrentClients; i++) {
    const token = authTokens[i % authTokens.length];
    const begin = Date.now();
    const socket = io(`${serverUrl}/ws`, {
      transports: ['websocket'],
      auth: { token },
      reconnection: false,
      timeout: connectTimeoutMs,
    });
    clients.push(socket);

    connectPromises.push(
      new Promise<void>((resolve) => {
        let settled = false;
        let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

        const done = () => {
          if (settled) {
            return;
          }
          settled = true;
          if (fallbackTimer) {
            clearTimeout(fallbackTimer);
          }
          resolve();
        };

        fallbackTimer = setTimeout(() => {
          if (!settled) {
            failedCount++;
            done();
          }
        }, connectTimeoutMs + 200);

        socket.on('connect', () => {
          connectedCount++;
          connectLatencies.push(Date.now() - begin);
          done();
        });

        socket.on('connect_error', () => {
          failedCount++;
          done();
        });
      }),
    );
  }

  await Promise.all(connectPromises);
  const totalDurationMs = Date.now() - startAt;
  clients.forEach((socket) => socket.disconnect());

  connectLatencies.sort((a, b) => a - b);
  const connectMinMs = connectLatencies[0] ?? 0;
  const connectMaxMs = connectLatencies[connectLatencies.length - 1] ?? 0;
  const connectAvgMs =
    connectLatencies.length > 0
      ? connectLatencies.reduce((sum, current) => sum + current, 0) / connectLatencies.length
      : 0;

  return {
    totalClients: concurrentClients,
    connectedCount,
    failedCount,
    successRate: concurrentClients > 0 ? (connectedCount / concurrentClients) * 100 : 0,
    connectMinMs,
    connectAvgMs,
    connectP50Ms: percentile(connectLatencies, 0.5),
    connectP90Ms: percentile(connectLatencies, 0.9),
    connectP99Ms: percentile(connectLatencies, 0.99),
    connectMaxMs,
    totalDurationMs,
  };
}

async function runBenchmark(): Promise<void> {
  console.log('WebSocket Concurrency Handshake Benchmark');
  console.log('========================================\n');

  const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
  const concurrentClients = parseInt(process.env.BENCH_CLIENTS || '1000', 10);

  console.log(`Server: ${serverUrl}`);
  console.log(`Concurrent Clients: ${concurrentClients}`);
  console.log(`Transport: websocket-only`);
  console.log(`Auth: BENCH_TOKEN/BENCH_TOKENS`);
  console.log('');

  const result = await measureWebSocketConcurrency(concurrentClients, serverUrl);

  console.log('Results:');
  console.log(`  Total clients:      ${result.totalClients}`);
  console.log(`  Connected:          ${result.connectedCount}`);
  console.log(`  Failed:             ${result.failedCount}`);
  console.log(`  Success rate:       ${result.successRate.toFixed(2)}%`);
  console.log(`  Total duration:     ${result.totalDurationMs}ms`);
  console.log('');
  console.log('Connect latency:');
  console.log(`  Min:                ${result.connectMinMs}ms`);
  console.log(`  Avg:                ${result.connectAvgMs.toFixed(2)}ms`);
  console.log(`  P50:                ${result.connectP50Ms}ms`);
  console.log(`  P90:                ${result.connectP90Ms}ms`);
  console.log(`  P99:                ${result.connectP99Ms}ms`);
  console.log(`  Max:                ${result.connectMaxMs}ms`);
}

void runBenchmark().catch((error) => {
  console.error('Benchmark failed:', error);
  process.exit(1);
});
