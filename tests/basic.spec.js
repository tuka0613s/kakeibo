const { test, expect } = require('@playwright/test');

test.describe('Basic Sanity Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to start fresh
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('should register a transaction correctly', async ({ page }) => {
    // Navigate to the app (baseURL is http://localhost:8080)
    await page.goto('/');

    // Verify title
    await expect(page).toHaveTitle(/爆速家計簿/);

    // Enter amount: 1200
    // The buttons have classes like nk-1, nk-2, etc.
    // Based on index.html: <button class="nk d nk-1" onclick="nk('1')">1</button>
    await page.click('.nk-1');
    await page.click('.nk-2');
    await page.click('.btn-0-phone'); 
    await page.click('.btn-0-phone'); 
    
    // Verify amount display
    const amtDisp = page.locator('#amt-disp');
    await expect(amtDisp).toHaveText('1,200');

    // Select category: 食費 (Food)
    // <div class="cat-item" onclick="register('食費','🍜')">
    await page.click('text=食費');

    // Verify transaction appears in history
    const histList = page.locator('#hist-list');
    await expect(histList).toContainText('食費');
    await expect(histList).toContainText('¥1,200');
    
    // Check if toast appeared (optional)
    const toast = page.locator('#toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('食費 ¥1,200 を登録しました');
  });
});
