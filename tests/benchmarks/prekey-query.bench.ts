/**
 * PreKey 查询性能基准测试
 * 测量 PreKey REST API 的查询性能
 */

interface QueryResult {
  queriesPerSecond: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p95Latency: number;
  successCount: number;
  failCount: number;
}

/**
 * 测量 PreKey 查询性能
 * @param iterations 测试迭代次数
 * @param serverUrl 服务器地址
 * @param authToken JWT Token
 */
async function measurePreKeyQueryPerformance(
  iterations: number = 1000,
  serverUrl: string = 'http://localhost:3000',
  authToken: string = 'mock_token',
): Promise<QueryResult> {
  const latencies: number[] = [];
  let successCount = 0;
  let failCount = 0;

  const startTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    const queryStart = Date.now();

    try {
      const response = await fetch(`${serverUrl}/api/v1/prekey/test_user_${i % 10}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      await response.json();

      if (response.ok || response.status === 404) {
        // 404 也是有效响应（PreKey 不存在）
        successCount++;
        latencies.push(Date.now() - queryStart);
      } else {
        failCount++;
      }
    } catch (error) {
      failCount++;
    }
  }

  const totalTime = Date.now() - startTime;
  const qps = iterations / (totalTime / 1000);

  // 计算延迟统计
  latencies.sort((a, b) => a - b);
  const avgLatency = latencies.length > 0
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length
    : 0;
  const minLatency = latencies[0] || 0;
  const maxLatency = latencies[latencies.length - 1] || 0;
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)] || 0;

  return {
    queriesPerSecond: qps,
    avgLatency,
    minLatency,
    maxLatency,
    p95Latency,
    successCount,
    failCount,
  };
}

// 运行基准测试
async function runBenchmark(): Promise<void> {
  console.log('🚀 PreKey Query Performance Benchmark');
  console.log('=====================================\n');

  const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
  const iterations = parseInt(process.env.BENCH_ITERATIONS || '1000', 10);
  const authToken = process.env.AUTH_TOKEN || 'mock_token';

  console.log(`Server: ${serverUrl}`);
  console.log(`Iterations: ${iterations}`);
  console.log(`Auth Token: ${authToken ? '***' + authToken.slice(-4) : 'none'}\n`);

  try {
    const result = await measurePreKeyQueryPerformance(iterations, serverUrl, authToken);

    console.log('📊 Results:');
    console.log(`  QPS:           ${result.queriesPerSecond.toFixed(2)} queries/sec`);
    console.log(`  Avg Latency:   ${result.avgLatency.toFixed(2)}ms`);
    console.log(`  Min Latency:   ${result.minLatency}ms`);
    console.log(`  Max Latency:   ${result.maxLatency}ms`);
    console.log(`  P95 Latency:   ${result.p95Latency}ms`);
    console.log(`  Success:       ${result.successCount}`);
    console.log(`  Failed:        ${result.failCount}`);
    console.log(`  Success Rate:  ${((result.successCount / iterations) * 100).toFixed(2)}%`);

    // 性能目标检查
    console.log('\n🎯 Performance Targets:');
    const qpsTarget = 1000;
    const p95Target = 100;
    const successRateTarget = 99;
    const successRate = (result.successCount / iterations) * 100;

    console.log(`  QPS > ${qpsTarget}:      ${result.queriesPerSecond > qpsTarget ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  P95 < ${p95Target}ms:    ${result.p95Latency < p95Target ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Success > ${successRateTarget}%: ${successRate > successRateTarget ? '✅ PASS' : '❌ FAIL'}`);
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

runBenchmark();
