/**
 * WebSocket 并发基准测试
 * 测量 WebSocket 服务器在高并发场景下的性能
 */

interface ConcurrencyResult {
  totalClients: number;
  messagesPerClient: number;
  totalMessages: number;
  successCount: number;
  failedCount: number;
  totalTime: number;
  messagesPerSecond: number;
  successRate: number;
}

/**
 * 测量 WebSocket 并发性能
 */
async function measureWebSocketConcurrency(
  concurrentClients: number = 100,
  messagesPerClient: number = 10,
  serverUrl: string = 'http://localhost:3000',
): Promise<ConcurrencyResult> {
  const { io } = await import('socket.io-client');

  const clients: Array<{ socket: ReturnType<typeof io>; userId: string }> = [];
  let successCount = 0;
  let failedCount = 0;

  // 创建客户端并连接
  console.log(`Connecting ${concurrentClients} clients...`);
  const connectPromises = [];

  for (let i = 0; i < concurrentClients; i++) {
    const userId = `bench_user_${i}`;
    const socket = io(`${serverUrl}/ws`, {
      auth: { token: process.env.BENCH_TOKEN || 'mock_token' },
      transports: ['websocket'],
    });

    clients.push({ socket, userId });

    const connectPromise = new Promise<void>((resolve) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', () => resolve()); // 继续测试即使认证失败
    });

    connectPromises.push(connectPromise);
  }

  await Promise.all(connectPromises);
  console.log('All clients connected.\n');

  const startTime = Date.now();

  // 并发发送消息
  console.log(`Sending ${concurrentClients * messagesPerClient} messages...`);
  const sendPromises = clients.map(async ({ socket, userId }, index) => {
    for (let j = 0; j < messagesPerClient; j++) {
      try {
        const targetIndex = (index + 1) % concurrentClients;
        socket.emit('message.send', {
          recipientId: `bench_user_${targetIndex}`,
          encryptedMessage: {
            messageType: 2,
            body: Buffer.from(`Concurrent message ${index}-${j}`).toString('base64'),
          },
        });
        successCount++;
      } catch (error) {
        failedCount++;
      }

      // 小延迟避免过载
      if (j % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }
  });

  await Promise.all(sendPromises);

  const totalTime = Date.now() - startTime;

  // 断开连接
  clients.forEach(({ socket }) => socket.disconnect());

  const totalMessages = concurrentClients * messagesPerClient;
  const messagesPerSecond = successCount / (totalTime / 1000);
  const successRate = (successCount / totalMessages) * 100;

  return {
    totalClients: concurrentClients,
    messagesPerClient,
    totalMessages,
    successCount,
    failedCount,
    totalTime,
    messagesPerSecond,
    successRate,
  };
}

// 运行基准测试
async function runBenchmark(): Promise<void> {
  console.log('🚀 WebSocket Concurrency Benchmark');
  console.log('==================================\n');

  const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
  const concurrentClients = parseInt(process.env.BENCH_CLIENTS || '100', 10);
  const messagesPerClient = parseInt(process.env.BENCH_MESSAGES || '10', 10);

  console.log(`Server: ${serverUrl}`);
  console.log(`Concurrent Clients: ${concurrentClients}`);
  console.log(`Messages per Client: ${messagesPerClient}\n`);

  try {
    const result = await measureWebSocketConcurrency(concurrentClients, messagesPerClient, serverUrl);

    console.log('\n📊 Results:');
    console.log(`  Total Clients:      ${result.totalClients}`);
    console.log(`  Messages/Client:    ${result.messagesPerClient}`);
    console.log(`  Total Messages:     ${result.totalMessages}`);
    console.log(`  Success:            ${result.successCount}`);
    console.log(`  Failed:             ${result.failedCount}`);
    console.log(`  Total Time:         ${result.totalTime}ms`);
    console.log(`  Messages/Second:    ${result.messagesPerSecond.toFixed(2)}`);
    console.log(`  Success Rate:       ${result.successRate.toFixed(2)}%`);

    // 性能目标检查
    console.log('\n🎯 Performance Targets:');
    const successRateTarget = 99;
    const mpsTarget = 1000;

    console.log(`  Success Rate > ${successRateTarget}%:  ${result.successRate > successRateTarget ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Msg/Sec > ${mpsTarget}:               ${result.messagesPerSecond > mpsTarget ? '✅ PASS' : '❌ FAIL'}`);
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

runBenchmark();
