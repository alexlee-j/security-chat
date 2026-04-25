import { test, expect } from '@playwright/test';

/**
 * Image Viewer tests
 */
test.describe('Image Viewer', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a conversation with multiple images
    // This assumes the app is running and user is logged in
    await page.goto('/');
  });

  test('opens on image message click', async ({ page }) => {
    // Click on an image message bubble
    const imageBubble = page.locator('[data-msg-type="2"]').first();
    await imageBubble.click();

    // Image viewer overlay should be visible
    const viewer = page.locator('.image-viewer-overlay');
    await expect(viewer).toBeVisible();
  });

  test('close button dismisses viewer', async ({ page }) => {
    const imageBubble = page.locator('[data-msg-type="2"]').first();
    await imageBubble.click();

    const viewer = page.locator('.image-viewer-overlay');
    await expect(viewer).toBeVisible();

    await page.locator('.image-viewer-close').click();
    await expect(viewer).not.toBeVisible();
  });

  test('Escape key closes viewer', async ({ page }) => {
    const imageBubble = page.locator('[data-msg-type="2"]').first();
    await imageBubble.click();

    const viewer = page.locator('.image-viewer-overlay');
    await expect(viewer).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(viewer).not.toBeVisible();
  });

  test('navigation buttons navigate between images', async ({ page }) => {
    const imageBubbles = page.locator('[data-msg-type="2"]');
    const count = await imageBubbles.count();
    if (count < 2) {
      test.skip();
    }

    await imageBubbles.first().click();
    const viewer = page.locator('.image-viewer-overlay');
    await expect(viewer).toBeVisible();

    // Counter should show 1/n
    const counter = page.locator('.image-viewer-counter');
    if (count > 1) {
      await expect(counter).toBeVisible();
      await expect(counter).toContainText(`1 / ${count}`);
    }

    // Click next
    const nextBtn = page.locator('.image-viewer-nav.next');
    if (count > 1) {
      await nextBtn.click();
      await expect(counter).toContainText(`2 / ${count}`);
    }

    // Click prev
    const prevBtn = page.locator('.image-viewer-nav.prev');
    if (count > 1) {
      await prevBtn.click();
      await expect(counter).toContainText(`1 / ${count}`);
    }
  });

  test('keyboard navigation with arrow keys', async ({ page }) => {
    const imageBubbles = page.locator('[data-msg-type="2"]');
    const count = await imageBubbles.count();
    if (count < 2) {
      test.skip();
    }

    await imageBubbles.first().click();
    const viewer = page.locator('.image-viewer-overlay');
    await expect(viewer).toBeVisible();

    const counter = page.locator('.image-viewer-counter');
    if (count > 1) {
      await page.keyboard.press('ArrowRight');
      await expect(counter).toContainText(`2 / ${count}`);

      await page.keyboard.press('ArrowLeft');
      await expect(counter).toContainText(`1 / ${count}`);
    }
  });

  test('zoom controls work', async ({ page }) => {
    await page.locator('[data-msg-type="2"]').first().click();
    const viewer = page.locator('.image-viewer-overlay');
    await expect(viewer).toBeVisible();

    const zoomLabel = page.locator('.image-viewer-zoom-label');
    await expect(zoomLabel).toContainText('100%');

    // Zoom in
    await page.locator('.image-viewer-controls button[aria-label="放大"]').click();
    await expect(zoomLabel).toContainText('150%');

    // Zoom out
    await page.locator('.image-viewer-controls button[aria-label="缩小"]').click();
    await expect(zoomLabel).toContainText('100%');

    // Reset
    await page.locator('.image-viewer-controls button[aria-label="重置缩放"]').click();
    await expect(zoomLabel).toContainText('100%');
  });

  test('keyboard zoom shortcuts work', async ({ page }) => {
    await page.locator('[data-msg-type="2"]').first().click();
    const viewer = page.locator('.image-viewer-overlay');
    await expect(viewer).toBeVisible();

    const zoomLabel = page.locator('.image-viewer-zoom-label');

    await page.keyboard.press('+');
    await expect(zoomLabel).toContainText('150%');

    await page.keyboard.press('-');
    await expect(zoomLabel).toContainText('100%');

    await page.keyboard.press('0');
    await expect(zoomLabel).toContainText('100%');
  });

  test('double-click zooms image', async ({ page }) => {
    await page.locator('[data-msg-type="2"]').first().click();
    const viewer = page.locator('.image-viewer-overlay');
    await expect(viewer).toBeVisible();

    const zoomLabel = page.locator('.image-viewer-zoom-label');
    await expect(zoomLabel).toContainText('100%');

    // Double-click the image
    await page.locator('.image-viewer-image').dblclick();
    await expect(zoomLabel).toContainText('150%');
  });
});

/**
 * Video Viewer tests
 */
test.describe('Video Viewer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('opens on video message click', async ({ page }) => {
    // Click on a video message bubble
    const videoBubble = page.locator('[data-msg-type="4"] .video-bubble').first();
    await videoBubble.click();

    const viewer = page.locator('.video-viewer-overlay');
    await expect(viewer).toBeVisible();
  });

  test('close button dismisses viewer', async ({ page }) => {
    const videoBubble = page.locator('[data-msg-type="4"] .video-bubble').first();
    await videoBubble.click();

    const viewer = page.locator('.video-viewer-overlay');
    await expect(viewer).toBeVisible();

    await page.locator('.video-viewer-close').click();
    await expect(viewer).not.toBeVisible();
  });

  test('Escape key closes viewer', async ({ page }) => {
    const videoBubble = page.locator('[data-msg-type="4"] .video-bubble').first();
    await videoBubble.click();

    const viewer = page.locator('.video-viewer-overlay');
    await expect(viewer).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(viewer).not.toBeVisible();
  });

  test('video player has native controls', async ({ page }) => {
    const videoBubble = page.locator('[data-msg-type="4"] .video-bubble').first();
    await videoBubble.click();

    const viewer = page.locator('.video-viewer-overlay');
    await expect(viewer).toBeVisible();

    const video = page.locator('.video-viewer-player');
    await expect(video).toBeVisible();
    // Native controls attribute should be present (browser adds controls="")
    await expect(video).toHaveAttribute('controls');
  });

  test('playback error closes viewer and shows failure feedback', async ({ page }) => {
    const videoBubble = page.locator('[data-msg-type="4"] .video-bubble').first();
    await videoBubble.click();

    const viewer = page.locator('.video-viewer-overlay');
    await expect(viewer).toBeVisible();

    await page.locator('.video-viewer-player').evaluate((node) => {
      node.dispatchEvent(new Event('error', { bubbles: true }));
    });

    await expect(viewer).not.toBeVisible();
    await expect(page.getByText('视频播放失败')).toBeVisible();
  });
});

/**
 * Voice Seek tests
 */
test.describe('Voice Seek', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('voice waveform is pointer accessible', async ({ page }) => {
    const voiceBubble = page.locator('[data-msg-type="3"]').first();
    await expect(voiceBubble).toBeVisible();

    const waveform = voiceBubble.locator('.voice-waveform-container');
    await expect(waveform).toBeVisible();
    // Should have slider role for accessibility
    await expect(waveform).toHaveAttribute('role', 'slider');
    await expect(waveform).toHaveAttribute('aria-label', '语音播放进度');
  });

  test('clicking waveform updates pending seek feedback', async ({ page }) => {
    const voiceBubble = page.locator('[data-msg-type="3"]').first();
    const waveform = voiceBubble.locator('.voice-waveform-container');

    // Get waveform bounding box
    const box = await waveform.boundingBox();
    if (!box) {
      test.skip();
    }

    // Click in the middle of the waveform
    await waveform.click({ position: { x: box.width / 2, y: box.height / 2 } });

    await expect(waveform).toHaveAttribute('aria-valuenow', /^(4[5-9]|5[0-5])$/);
  });

  test('keyboard seek updates paused/pending position', async ({ page }) => {
    const voiceBubble = page.locator('[data-msg-type="3"]').first();
    const waveform = voiceBubble.locator('.voice-waveform-container');

    await waveform.focus();
    await page.keyboard.press('End');

    await expect(waveform).toHaveAttribute('aria-valuenow', '100');
  });

  test('waveform accessibility attributes are set', async ({ page }) => {
    const voiceBubble = page.locator('[data-msg-type="3"]').first();
    const waveform = voiceBubble.locator('.voice-waveform-container');
    await expect(waveform).toHaveAttribute('aria-valuemin', '0');
    await expect(waveform).toHaveAttribute('aria-valuemax', '100');
    // Value should be a number between 0 and 100
    const value = await waveform.getAttribute('aria-valuenow');
    expect(Number(value)).toBeGreaterThanOrEqual(0);
    expect(Number(value)).toBeLessThanOrEqual(100);
  });
});
