import { test, expect } from '@playwright/test'

test.describe('Authentication Page', () => {
  test('should load the login page', async ({ page }) => {
    await page.goto('/auth/login')

    // Check for common login elements
    // Note: Adjust selectors based on actual implementation
    await expect(page.locator('form')).toBeVisible()
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
  })

  test('should show error on invalid login', async ({ page }) => {
    await page.goto('/auth/login')

    await page.fill('input[name="email"]', 'invalid@example.com')
    await page.fill('input[name="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // Wait for error message - adjust selector as needed
    // await expect(page.locator('.error-message')).toBeVisible()
  })
})
