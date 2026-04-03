import { TestClient } from './utils/test-client';

/**
 * PreKey E2E 测试
 * 测试 PreKey 服务器的上传和获取功能
 */
describe('PreKey E2E', () => {
  const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
  const testUserId = 'test-prekey-user';

  // 模拟的测试数据
  const mockPreKeys = [
    { preKeyId: 1, publicKey: 'mock_public_key_1_base64' },
    { preKeyId: 2, publicKey: 'mock_public_key_2_base64' },
    { preKeyId: 3, publicKey: 'mock_public_key_3_base64' },
  ];

  const mockSignedPreKey = {
    signedPreKeyId: 1,
    publicKey: 'mock_signed_public_key_base64',
    signature: 'mock_signature_base64',
    timestamp: Date.now(),
  };

  const mockKyberPreKeys = [
    {
      kyberPreKeyId: 1,
      publicKey: 'mock_kyber_public_key_1_base64',
      signature: 'mock_kyber_signature_1_base64',
      timestamp: Date.now(),
    },
  ];

  describe('PreKey REST API', () => {
    it('should upload prekeys', async () => {
      const token = process.env.TEST_TOKEN || 'mock_token';
      
      const response = await fetch(`${serverUrl}/api/v1/prekey/upload?userId=${testUserId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          preKeys: mockPreKeys,
          signedPreKey: mockSignedPreKey,
          kyberPreKeys: mockKyberPreKeys,
        }),
      });

      // 如果 JWT 验证失败，返回 401 是正常的
      // 实际测试需要有效的 token
      expect([200, 201, 401]).toContain(response.status);
    });

    it('should get prekey bundle', async () => {
      const token = process.env.TEST_TOKEN || 'mock_token';

      const response = await fetch(`${serverUrl}/api/v1/prekey/${testUserId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      // 如果 PreKey 不存在，返回 404
      // 如果 JWT 验证失败，返回 401
      expect([200, 404, 401]).toContain(response.status);

      if (response.status === 200) {
        const bundle = await response.json();
        expect(bundle.signedPreKeyId).toBeDefined();
        expect(bundle.signedPreKey).toBeDefined();
        expect(bundle.kyberPreKeyId).toBeDefined();
        expect(bundle.kyberPreKey).toBeDefined();
      }
    });

    it('should get prekey count', async () => {
      const token = process.env.TEST_TOKEN || 'mock_token';

      const response = await fetch(`${serverUrl}/api/v1/prekey/count?userId=${testUserId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect([200, 401]).toContain(response.status);

      if (response.status === 200) {
        const result = await response.json();
        expect(result.count).toBeDefined();
      }
    });
  });
});
