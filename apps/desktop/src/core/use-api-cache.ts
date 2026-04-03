/**
 * 文件名：use-api-cache.ts
 * 所属模块：桌面端-缓存优化
 * 核心作用：提供简单的 API 缓存机制，减少重复请求
 * 核心依赖：React hooks
 * 创建时间：2026-04-04 (Week 14)
 */

import { useCallback, useRef } from 'react';

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

type CacheOptions = {
  /** 缓存有效期（毫秒），默认 30 秒 */
  ttl?: number;
};

/**
 * API 缓存 Hook
 * @param options.cacheKey 缓存的键
 * @param options.ttl 缓存有效期，默认 30000ms (30秒)
 */
export function useApiCache() {
  const cacheRef = useRef<Map<string, CacheEntry<unknown>>>(new Map());

  /**
   * 获取缓存数据
   */
  function getCache<T>(key: string, ttl = 30000): T | null {
    const entry = cacheRef.current.get(key);
    if (!entry) {
      return null;
    }
    const age = Date.now() - entry.timestamp;
    if (age > ttl) {
      cacheRef.current.delete(key);
      return null;
    }
    return entry.data as T;
  }

  /**
   * 设置缓存数据
   */
  function setCache<T>(key: string, data: T): void {
    cacheRef.current.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * 使缓存失效
   */
  function invalidateCache(key?: string): void {
    if (key) {
      cacheRef.current.delete(key);
    } else {
      cacheRef.current.clear();
    }
  }

  /**
   * 创建带缓存的请求函数
   */
  function withCache<T, Args extends unknown[]>(
    fetcher: (...args: Args) => Promise<T>,
    cacheKey: string | ((...args: Args) => string),
    options: CacheOptions = {}
  ): (...args: Args) => Promise<T> {
    const { ttl = 30000 } = options;

    return async (...args: Args): Promise<T> => {
      const key = typeof cacheKey === 'function' ? cacheKey(...args) : cacheKey;
      const cached = getCache<T>(key, ttl);
      if (cached !== null) {
        return cached;
      }
      const data = await fetcher(...args);
      setCache(key, data);
      return data;
    };
  }

  /**
   * 批量使缓存失效（支持模式匹配）
   */
  function invalidateByPattern(pattern: RegExp): void {
    for (const key of cacheRef.current.keys()) {
      if (pattern.test(key)) {
        cacheRef.current.delete(key);
      }
    }
  }

  return {
    cacheRef,
    getCache,
    setCache,
    invalidateCache,
    invalidateByPattern,
    withCache,
  };
}

/**
 * 缓存键生成工具
 */
export function createCacheKey(prefix: string, ...parts: (string | number)[]): string {
  return `${prefix}:${parts.join(':')}`;
}
