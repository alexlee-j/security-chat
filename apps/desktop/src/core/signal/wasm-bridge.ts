/**
 * WASM Signal 实现
 * 包装 wasm-bindgen 生成的 JS 胶水代码
 */

let initialized = false;
let signalProtocol: any = null;

/**
 * 初始化 WASM Signal Protocol 模块
 * 注意：这个模块依赖于 wasm-pack 编译输出的胶水代码
 */
export async function initWasmSignal(): Promise<void> {
  if (initialized) return;

  try {
    console.log('[WASM] Initializing Signal Protocol WASM module...');

    // 动态导入 WASM 胶水代码
    // 这个路径是 wasm-pack --target web --out-dir 输出的位置
    const wasmModulePath = './wasm/signal_protocol';
    const wasm = await import(/* @vite-ignore */ wasmModulePath);
    await wasm.default(); // 初始化 WASM

    // @ts-ignore - WASM 模块动态加载
    signalProtocol = wasm.SignalProtocol;
    initialized = true;
    console.log('[WASM] Signal Protocol WASM module initialized');
  } catch (e) {
    console.error('[WASM] Failed to initialize WASM module:', e);
    throw e;
  }
}

/**
 * 获取 WASM Signal 实例
 */
export function getWasmSignal(): any {
  if (!signalProtocol) {
    throw new Error('WASM Signal not initialized. Call initWasmSignal() first.');
  }
  return signalProtocol;
}

/**
 * 检查 WASM 是否已初始化
 */
export function isWasmInitialized(): boolean {
  return initialized;
}
