# Enhanced Impersonation Plugin for Payload CMS

A comprehensive impersonation plugin for Payload CMS with multi-language support, audit logging, and enhanced UI components.

## 🚀 Features

- ✅ **Multi-language Support** - Hebrew and English with RTL support
- ✅ **Centralized Labels** - All labels managed within the plugin
- ✅ **Icon-based UI** - User selector icon near logout button
- ✅ **Audit Logging** - Complete tracking with IP and user agent
- ✅ **Admin Notifications** - Extensible callback system
- ✅ **Frontend Integration** - React components for user app
- ✅ **Security Focused** - Proper session management and logging
- ✅ **Type Safe** - Full TypeScript support

## 📦 Installation

The plugin is already integrated into your Payload configuration. Dependencies:

```bash
pnpm add uuid @types/uuid
```

## 🔧 Configuration

The plugin is configured in your `src/payload.config.ts`:

```typescript
import { impersonatePlugin } from './plugins/impersonate'

export default buildConfig({
  plugins: [
    impersonatePlugin({
      enabled: true,
      authCollection: 'users',
      enableBlockForm: true,
      // Labels are centralized in the plugin
      onimpersonate: async ({ req, impersonateUserId }) => {
        // Custom logic when impersonation starts
      },
      onUnImpersonate: async ({ req, originalUserId }) => {
        // Custom logic when impersonation ends
      }
    })
  ]
})
```

## 🎨 Admin UI Features

### Icon-based User Selector
- Located near the logout area in admin panel
- Dropdown list of users to impersonate
- Localized labels: "Select User to Impersonate" / "בחר משתמש להתחזות"

### Impersonation Indicators
- Header bar showing current impersonation status
- Clear "Switch back" / "חזרה למשתמש המקורי" functionality
- Localized text in Hebrew/English

### Audit Collection
- New collection: `impersonation-audit`
- Tracks all impersonation actions
- Grouped under "Security" / "אבטחה"

## 🌐 Centralized Labels System

All labels are managed in `src/plugins/impersonate/labels.ts`:

```typescript
import { getLabels, getLabel } from './plugins/impersonate/labels'

// Get all labels for a locale
const labels = getLabels('he') // or 'en'

// Get a specific label
const impersonateLabel = getLabel('impersonate', 'he')
```

### Available Labels

| Key | English | Hebrew |
|-----|---------|--------|
| `impersonate` | Impersonate | התחזות |
| `stopImpersonating` | Stop Impersonating | הפסקת התחזות |
| `switchBack` | Switch back | חזרה למשתמש המקורי |
| `selectUser` | Select a user to impersonate | בחר משתמש להתחזות |
| `impersonating` | Impersonating | מתחזה |
| `youAreImpersonating` | You are impersonating | אתה מתחזה ל |
| `exitImpersonation` | Exit Impersonation | יציאה מהתחזות |

## 🔗 API Endpoints

The plugin adds these endpoints to your users collection:

- `GET /api/users/:id/impersonate` - Start impersonating
- `GET /api/users/unImpersonate/:id` - Stop impersonating  
- `GET /api/impersonate/status` - Get impersonation status (for frontend)

## 🖥️ Frontend Integration

### 1. Add Provider to Layout

```typescript
// app/layout.tsx
import { ImpersonationProvider } from './src/plugins/impersonate/components'

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <ImpersonationProvider checkInterval={30000}>
          {children}
        </ImpersonationProvider>
      </body>
    </html>
  )
}
```

### 2. Add Impersonation Banner

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

### 3. Use Impersonation Hook

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

## 🔒 Security Features

### Audit Trail
Every impersonation action is logged with:
- Original user ID and target user ID
- IP address and user agent
- Timestamp and action type (start/end)
- Localized action descriptions

### Admin Notifications
- Console logging of all impersonation events
- Extensible notification system (Slack, email, etc.)
- IP and user agent tracking for security

### Access Control
- Only authenticated admin users can impersonate
- Respects existing auth collection token expiration
- Proper session management with cleanup

## 📁 File Structure

```
src/plugins/impersonate/
├── index.ts                           # Main plugin configuration
├── labels.ts                          # Centralized labels system
├── package.json                       # Plugin package info
├── README.md                         # This documentation
├── INTEGRATION_GUIDE.md              # Integration guide
├── example-usage.ts                  # Usage examples
├── frontend-integration-example.tsx  # Frontend examples
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
    ├── UserSelector.tsx              # Icon-based user selector
    ├── unImpersonate.tsx              # Admin unImpersonate component
    ├── ImpersonationBar.tsx          # Admin impersonation bar
    ├── ImpersonateForm.tsx            # Block form component
    ├── ImpersonateIcon.tsx            # Icon component
    ├── ImpersonateCell.tsx                # Cell component
    ├── SelectUser.tsx                # User selection component
    ├── ClientImpersonationBar.tsx    # Client-side banner
    └── NullField.tsx                 # Null field component
```

## ⚙️ Plugin Options

```typescript
interface PluginTypes {
  authCollection?: string              // Default: 'users'
  enableBlockForm?: boolean           // Default: true
  enabled?: boolean                   // Default: false
  onimpersonate?: (params) => void    // Callback on start
  onUnImpersonate?: (params) => void  // Callback on end
}
```

## 🎯 Usage Instructions

### For Administrators

1. **Start Impersonation:**
   - Click the user icon near logout in admin panel
   - Select user from dropdown
   - Automatically redirected to admin as that user

2. **While Impersonating:**
   - Orange header bar shows impersonation status
   - "Switch back" link to return to original user
   - All actions logged in audit trail

3. **View Audit Logs:**
   - Navigate to "Impersonation Audits" / "ביקורות התחזות" collection
   - View complete history of impersonation actions
   - Filter by user, date, action type

## 🔧 Customization

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
}
```

### Custom Labels
```typescript
impersonatePlugin({
  labels: {
    en: {
      impersonate: 'Switch User',
      // Override any label
    },
    he: {
      impersonate: 'החלפת משתמש',
      // Override any label
    }
  }
})
```

## 🐛 Troubleshooting

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

## 📝 Recent Updates

### ✅ Version 2.0 Features

1. **Centralized Labels System** - All labels managed in one place
2. **TypeScript Improvements** - Better type safety and IntelliSense
3. **Empty File Resolution** - All TypeScript files properly implemented
4. **Enhanced Documentation** - Comprehensive guides and examples
5. **Improved Integration** - Seamless Payload CMS integration

## 🚀 Next Steps

1. **Test the Integration:**
   - Create test users in admin
   - Try impersonating different users
   - Verify audit logs are created
   - Test frontend banner functionality

2. **Customize for Your Needs:**
   - Set up notification webhooks
   - Add custom business logic
   - Enhance frontend styling

3. **Monitor and Maintain:**
   - Review audit logs regularly
   - Monitor impersonation patterns
   - Update labels as needed

The plugin is now fully integrated and production-ready! 🎉

## 📄 License

MIT License - feel free to modify and use in your projects.

## 🤝 Contributing

Contributions welcome! Please ensure all labels use the centralized system and maintain TypeScript compatibility.