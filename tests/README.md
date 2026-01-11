# EMDA Testing Guide

Welcome to the EMDA testing infrastructure. This guide will help you understand how we test our application and how you can contribute.

## 🚀 Quick Start

### Running Tests

```bash
# Run all unit and component tests
pnpm test

# Run tests in watch mode (best for development)
pnpm test

# Open Vitest UI (interactive dashboard)
pnpm test:ui

# Run E2E tests (Playwright)
pnpm test:e2e

# Open Playwright UI
pnpm test:e2e:ui
```

## 📂 Project Structure

- `src/**/*.test.ts(x)`: Unit and Component tests co-located with source code.
- `tests/integration/`: Integration tests that may require a database.
- `tests/e2e/`: End-to-End tests using Playwright.
- `tests/factories/`: Helpers to create mock data for tests.

## 🧪 Writing Tests

### 1. Unit Tests (Business Logic)
Create a `.test.ts` file next to your implementation.

```typescript
import { describe, it, expect } from 'vitest'
import { myUtility } from './myUtility'

describe('myUtility', () => {
  it('should work correctly', () => {
    expect(myUtility(true)).toBe('Success')
  })
})
```

### 2. Component Tests (React)
Use React Testing Library to test how components behave.

```typescript
import { render, screen } from '@testing-library/react'
import { MyButton } from './MyButton'

it('renders with correct label', () => {
  render(<MyButton label="Click Me" />)
  expect(screen.getByText('Click Me')).toBeInTheDocument()
})
```

### 3. E2E Tests (User Flows)
Test the entire application flow from the user's perspective.

```typescript
import { test, expect } from '@playwright/test'

test('can login', async ({ page }) => {
  await page.goto('/auth/login')
  await page.fill('[name="email"]', 'user@example.com')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/dashboard')
})
```

## 💡 Best Practices

1. **Test User Behavior**: Instead of testing implementation details, test what the user sees and does.
2. **Co-location**: Keep unit tests near the code they test.
3. **Mocking**: Use the provided factories in `tests/factories/` to mock Payload or database objects.
4. **Clean State**: Each test should be independent.

## 🛠 Troubleshooting

- If `jsdom` errors occur, ensure you have `import '@testing-library/jest-dom'` in your test or setup file.
- For E2E tests, make sure the dev server is running or the `webServer` config in `playwright.config.ts` is correct.
