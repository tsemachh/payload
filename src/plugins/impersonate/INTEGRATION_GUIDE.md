# Enhanced Impersonation Plugin - Integration Guide

## Overview

The enhanced impersonation plugin has been successfully integrated into your Payload CMS configuration with full support for:

- ✅ **Multi-language support** (English & Hebrew) following Payload's i18n standards
- ✅ **Enhanced UI components** with icon-based user selector
- ✅ **Frontend integration** for user app impersonation indicators
- ✅ **RTL support** for Hebrew interface
- ✅ **Complete label localization** using "Impersonate" terminology

## Current Integration Status

### 1. Plugin Configuration ✅

The plugin is now integrated in your `src/payload.config.ts` with:

```typescript
impersonatePlugin({
  enabled: true,
  authCollection: 'users',
  onimpersonate: async ({ req, impersonateUserId }) => {
    // Custom logging and notifications
  },
  onUnImpersonate: async ({ req, originalUserId }) => {
    // Custom logging and notifications
    // Cleanup logic
  }
})
```

### 2. Admin UI Features ✅

#### Impersonation Indicators
- Header bar showing current impersonation status
- Clear "Switch back" / "חזרה למשתמש המקורי" functionality
- Localized text in Hebrew/English

### 3. Frontend Integration Components ✅

#### ImpersonationProvider
```typescript
<ImpersonationProvider checkInterval={30000}>
  {children}
</ImpersonationProvider>
```

#### ImpersonationBanner
```typescript
<ImpersonationBanner 
  position="top" 
  locale="he" // or "en"
  style={{ backgroundColor: '#ff6b35' }}
/>
```

#### useImpersonation Hook
```typescript
const { isImpersonating, currentUser, originalUser, exitImpersonation } = useImpersonation()
```

## API Endpoints

The plugin adds these endpoints to your users collection:

- `GET /api/users/:id/impersonate` - Start impersonating
- `GET /api/users/unImpersonate/:id` - Stop impersonating  
- `GET /api/impersonate/status` - Get impersonation status (for frontend)

## Security Features

### Access Control
- Only authenticated admin users can impersonate
- Respects existing auth collection token expiration
- Proper session management with cleanup

## Usage Instructions

### For Administrators

1. **Start Impersonation:**
   - In the users collection list view click on Impersonate Button
   - Automatically redirected to admin as that user

2. **While Impersonating:**
   - Orange header bar shows: "🎭 Impersonating user@example.com"
   - "Switch back" link to return to original user

### For Frontend Development

1. **Add Provider to Layout:**
```typescript
// app/layout.tsx
import { ImpersonationProvider } from './src/plugins/impersonate/components'

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <ImpersonationProvider>
          {children}
        </ImpersonationProvider>
      </body>
    </html>
  )
}
```

2. **Add Impersonation Banner:**
```typescript
// components/Header.tsx
import { ImpersonationBanner } from './src/plugins/impersonate/components'

export const Header = () => (
  <>
    <ImpersonationBanner position="top" locale="he" />
    <header style={{ marginTop: '60px' }}>
      {/* Your header content */}
    </header>
  </>
)
```

3. **Use Impersonation Hook:**
```typescript
// pages/profile.tsx
import { useImpersonation } from './src/plugins/impersonate/components'

export const ProfilePage = () => {
  const { isImpersonating, currentUser, exitImpersonation } = useImpersonation()
  
  return (
    <div>
      {isImpersonating && (
        <div className="alert">
          <p>אתה צופה בפרופיל זה בתור {currentUser?.email}</p>
          <button onClick={exitImpersonation}>יציאה מהתחזות</button>
        </div>
      )}
      {/* Rest of profile */}
    </div>
  )
}
```

## File Structure

```
src/plugins/impersonate/
├── index.ts                           # Main plugin configuration
├── package.json                       # Plugin package info
├── README.md                         # Plugin documentation
├── INTEGRATION_GUIDE.md              # This integration guide
├── components/
│   ├── index.ts                      # Component exports
│   ├── ImpersonationProvider.tsx     # React context provider
│   └── ImpersonationBanner.tsx       # Frontend banner component
├── endpoints/
│   ├── impersonateEndpoint.ts         # Start impersonation endpoint
│   ├── unImpersonateEndpoint.ts       # Stop impersonation endpoint
│   └── statusEndpoint.ts             # Status check endpoint
├── hooks/
│   └── useLocale.ts                  # Locale detection hook
└── ui/
    ├── index.ts                      # UI component exports
    ├── ImpersonateCell.tsx                # Cell component
    ├── ClientImpersonationBar.tsx    # Client-side banner
    └── NullField.tsx                 # Null field component
```

## Customization Options

### Custom Notification System
```typescript
onimpersonate: async ({ req, impersonateUserId }) => {
  // Send to Slack
  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify({
      text: `🚨 ${req.user?.email} started impersonating user ${impersonateUserId}`
    })
  })
  
  // Send email notification
  await sendEmail({
    to: 'admin@yoursite.com',
    subject: 'Impersonation Alert',
    body: `User impersonation started by ${req.user?.email}`
  })
}
```

### Custom Styling
```css
/* Custom impersonation banner styles */
.impersonation-banner {
  background: linear-gradient(45deg, #ff6b35, #f7931e);
  box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
}

/* RTL support */
[dir="rtl"] .impersonation-banner {
  text-align: right;
}
```

## Troubleshooting

### Plugin Not Showing
- Verify `enabled: true` in plugin config
- Check user has admin permissions
- Ensure auth collection slug matches configuration

### Audit Logs Not Created
- Check database permissions
- Verify audit collection is created
- Check console for error messages

### Frontend Banner Not Appearing
- Ensure ImpersonationProvider wraps your app
- Check `/api/impersonate/status` endpoint response
- Verify cookies are set correctly

### Labels Not Localized
- Check Payload's i18n configuration
- Verify supported languages include 'en' and 'he'
- Check browser language settings


