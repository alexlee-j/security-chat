import { ApiClient } from './utils/api-client';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * 媒体模块 E2E 测试 (Tester B)
 * 测试图片上传、文件上传、图片预览、下载等功能
 */

// 每次测试使用唯一的基础名
const getTestBase = () => `testmedia_${Date.now()}_${Math.random().toString(36).substring(7)}`;

describe('Media Module E2E (Tester B)', () => {
  let clientM1: ApiClient;
  let clientM2: ApiClient;
  let testImagePath: string;
  let testFilePath: string;
  let base: string;

  beforeEach(() => {
    clientM1 = new ApiClient();
    clientM2 = new ApiClient();
    base = getTestBase();

    // 创建测试图片文件 (1x1 PNG)
    testImagePath = path.join(os.tmpdir(), `test_image_${Date.now()}.png`);
    const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 144, 119, 83, 222, 0, 0, 0, 12, 73, 68, 65, 84, 8, 215, 99, 248, 255, 255, 63, 0, 5, 254, 2, 254, 161, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
    fs.writeFileSync(testImagePath, pngHeader);

    // 创建测试文本文件
    testFilePath = path.join(os.tmpdir(), `test_file_${Date.now()}.txt`);
    fs.writeFileSync(testFilePath, 'This is a test file content for media upload testing.');
  });

  afterEach(async () => {
    // 清理测试文件
    try {
      if (fs.existsSync(testImagePath)) fs.unlinkSync(testImagePath);
      if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
    } catch {}

    try {
      await clientM1.logout();
    } catch {}
    try {
      await clientM2.logout();
    } catch {}
  });

  // 辅助函数：注册并登录
  async function registerAndLogin(client: ApiClient, username: string, email: string, password: string): Promise<string> {
    try {
      await client.register(username, email, password);
    } catch (error: any) {
      // 如果注册失败（用户已存在），直接登录
      if (error.response?.data?.error?.message !== 'User already exists with same email/phone/username') {
        throw error;
      }
    }
    await client.login(username, password);
    return client.getUserId();
  }

  describe('MEDIA-01: 上传图片', () => {
    it('应该能够上传图片', async () => {
      const testM1 = { username: `${base}_m1`, email: `${base}_m1@test.com`, password: 'Test123456' };

      await registerAndLogin(clientM1, testM1.username, testM1.email, testM1.password);

      // 读取测试图片
      const imageBuffer = fs.readFileSync(testImagePath);

      // 上传图片
      const formData = new FormData();
      const blob = new Blob([imageBuffer], { type: 'image/png' });
      formData.append('file', blob, 'test.png');
      formData.append('mediaKind', '2'); // 2 = image

      const response = await clientM1.client.post('/media/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      expect(response.status).toBe(201);
      const result = response.data.data || response.data;
      expect(result.mediaAssetId).toBeDefined();
      console.log(`✅ MEDIA-01: 图片上传成功 - mediaAssetId: ${result.mediaAssetId}`);
    });
  });

  describe('MEDIA-02: 上传文件', () => {
    it('应该能够上传普通文件', async () => {
      const testM1 = { username: `${base}_m1`, email: `${base}_m1@test.com`, password: 'Test123456' };

      await registerAndLogin(clientM1, testM1.username, testM1.email, testM1.password);

      // 读取测试文件
      const fileBuffer = fs.readFileSync(testFilePath);

      // 上传文件
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: 'text/plain' });
      formData.append('file', blob, 'test.txt');
      formData.append('mediaKind', '4'); // 4 = file

      const response = await clientM1.client.post('/media/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      expect(response.status).toBe(201);
      const result = response.data.data || response.data;
      expect(result.mediaAssetId).toBeDefined();
      console.log(`✅ MEDIA-02: 文件上传成功 - mediaAssetId: ${result.mediaAssetId}`);
    });
  });

  describe('MEDIA-03 & MEDIA-04: 下载图片/文件', () => {
    it('应该能够下载已上传的媒体文件', async () => {
      const testM1 = { username: `${base}_m1`, email: `${base}_m1@test.com`, password: 'Test123456' };

      await registerAndLogin(clientM1, testM1.username, testM1.email, testM1.password);

      // 上传图片
      const imageBuffer = fs.readFileSync(testImagePath);
      const formData = new FormData();
      const blob = new Blob([imageBuffer], { type: 'image/png' });
      formData.append('file', blob, 'test.png');
      formData.append('mediaKind', '2');

      const uploadResponse = await clientM1.client.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const result = uploadResponse.data.data || uploadResponse.data;
      const mediaAssetId = result.mediaAssetId;

      // 获取媒体元数据
      const metaResponse = await clientM1.client.get(`/media/${mediaAssetId}/meta`);
      expect(metaResponse.status).toBe(200);
      console.log(`✅ MEDIA-03: 获取图片元数据成功`);

      // 下载媒体文件
      const downloadResponse = await clientM1.client.get(`/media/${mediaAssetId}/download`, {
        responseType: 'arraybuffer',
      });
      expect(downloadResponse.status).toBe(200);
      console.log(`✅ MEDIA-04: 文件下载成功`);
    });
  });

  describe('MEDIA-05: 图片预览', () => {
    it('应该能够获取图片元数据用于预览', async () => {
      const testM1 = { username: `${base}_m1`, email: `${base}_m1@test.com`, password: 'Test123456' };

      await registerAndLogin(clientM1, testM1.username, testM1.email, testM1.password);

      // 上传图片
      const imageBuffer = fs.readFileSync(testImagePath);
      const formData = new FormData();
      const blob = new Blob([imageBuffer], { type: 'image/png' });
      formData.append('file', blob, 'test.png');
      formData.append('mediaKind', '2');

      const uploadResponse = await clientM1.client.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const result = uploadResponse.data.data || uploadResponse.data;
      const mediaAssetId = result.mediaAssetId;

      // 获取元数据用于预览
      const metaResponse = await clientM1.client.get(`/media/${mediaAssetId}/meta`);
      const meta = metaResponse.data.data || metaResponse.data;

      expect(meta.mediaAssetId).toBeDefined();
      expect(meta.mimeType).toBe('image/png');
      expect(meta.mediaKind).toBe(2);
      console.log(`✅ MEDIA-05: 图片预览元数据获取成功 - mimeType: ${meta.mimeType}`);
    });
  });
});
