/**
 * 消息路由延迟基准测试
 * 测量 WebSocket 消息从发送到接收的端到端延迟
 */

interface LatencyResult {
  min: number;
  max: number;
  avg: number;
  p95: number;
  p99: number;
}

/**
 * 计算延迟统计
 */
function calculateStats(latencies: number[]): LatencyResult {
  latencies.sort((a, b) => a - b);
  const min = latencies[0];
  const max = latencies[latencies.length - 1];
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];

  return { min, max, avg, p95, p99 };
}

/**
 * 测量消息延迟
 * @param iterations 测试迭代次数
 * @param serverUrl 服务器地址
 */
async function measureMessageLatency(
  iterations: number = 100,
  serverUrl: string = 'http://localhost:3000',
): Promise<LatencyResult> {
  const { io } = await import('socket.io-client');

  const senderToken = process.env.SENDER_TOKEN || 'mock_token';
  const receiverToken = process.env.RECEIVER_TOKEN || 'mock_token';

  const sender = io(`${serverUrl}/ws`, {
    auth: { token: senderToken },
    transports: ['websocket'],
  });

  const receiver = io(`${serverUrl}/ws`, {
    auth: { token: receiverToken },
    transports: ['websocket'],
  });

  await new Promise<void>((resolve) => {
    let connected = 0;
    sender.on('connect', () => { connected++; if (connected === 2) resolve(); });
    receiver.on('connect', () => { connected++; if (connected === 2) resolve(); });
  });

  const latencies: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const startTime = Date.now();

    await new Promise<void>((resolve) => {
      receiver.once('message.received', () => {
        const latency = Date.now() - startTime;
        latencies.push(latency);
        resolve();
      });

      sender.emit('message.send', {
        recipientId: 'receiver_bench',
        encryptedMessage: {
          messageType: 2,
          body: Buffer.from(`Benchmark message ${i}`).toString('base64'),
        },
      });
    });
  }

  sender.disconnect();
  receiver.disconnect();

  return calculateStats(latencies);
}

// 运行基准测试
async function runBenchmark(): Promise<void> {
  console.log('🚀 Message Latency Benchmark');
  console.log('===========================\n');

  const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
  const iterations = parseInt(process.env.BENCH_ITERATIONS || '100', 10);

  console.log(`Server: ${serverUrl}`);
  console.log(`Iterations: ${iterations}\n`);

  try {
    const result = await measureMessageLatency(iterations, serverUrl);

    console.log('📊 Results:');
    console.log(`  Min:     ${result.min}ms`);
    console.log(`  Max:     ${result.max}ms`);
    console.log(`  Avg:     ${result.avg.toFixed(2)}ms`);
    console.log(`  P95:     ${result.p95}ms`);
    console.log(`  P99:     ${result.p99}ms`);

    // 性能目标检查
    console.log('\n🎯 Performance Targets:');
    const p95Target = 100;
    console.log(`  P95 < ${p95Target}ms: ${result.p95 < p95Target ? '✅ PASS' : '❌ FAIL'}`);
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

runBenchmark();
