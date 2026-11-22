# Phase 12: Mobile & Real-time Notifications

## Overview

Make the payroll system mobile-responsive and add real-time notifications for critical events.

## Features

### 12.1 - Mobile Responsive Design

**Goal**: Make all pages mobile-friendly with responsive layouts.

#### Breakpoints

```typescript
// src/theme.ts
const breakpoints = {
  xs: '0px',      // Mobile phones
  sm: '480px',    // Small phones
  md: '768px',    // Tablets
  lg: '1024px',   // Desktop
  xl: '1280px',   // Wide desktop
  '2xl': '1536px' // Ultra-wide
};
```

#### Mobile Optimizations

1. **Navigation**
   - Bottom tab bar for mobile (Dashboard, Payroll, Attendance, Menu)
   - Hamburger menu for desktop
   - Swipe navigation between tabs

2. **Dashboard**
   - Stack stat cards vertically on mobile
   - Single column layout for tables
   - Horizontal scroll for wide tables
   - Larger touch targets (48px minimum)

3. **Forms**
   - Full-width inputs on mobile
   - Large submit buttons (48px height)
   - Mobile keyboard handling
   - Sticky headers on scrollable lists

4. **Data Tables**
   - Collapse rows on mobile to show summary
   - Swipeable left/right for actions
   - Expandable row detail view

#### Responsive Layout Examples

```typescript
// src/pages/PayRuns.tsx
<Box
  display={{ base: 'none', md: 'block' }}  // Hide on mobile
>
  <Table>...</Table>
</Box>

<Stack
  display={{ base: 'block', md: 'none' }}  // Show on mobile only
  spacing={4}
>
  {/* Mobile card view */}
</Stack>

// Responsive grid
<Grid
  templateColumns={{ base: '1fr', md: '2fr 1fr' }}
  gap={4}
>
  <Box>{/* Main content */}</Box>
  <Box>{/* Sidebar */}</Box>
</Grid>
```

#### Testing on Mobile

- Use Chrome DevTools device emulation
- Test on actual devices (iPhone, Android)
- Test touch interactions
- Test network slowness

### 12.2 - Mobile App

**Goal**: Create a native-like mobile experience.

#### Options

1. **React Native** - Code sharing between web and native
2. **Expo** - Simplified React Native development
3. **Progressive Web App (PWA)** - Web app installable on mobile
4. **Mobile Browser** - Optimize existing web for mobile (11.1)

#### PWA Implementation (Recommended)

```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa';

export default {
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Payroll System',
        short_name: 'Payroll',
        description: 'Multi-tenant payroll management',
        theme_color: '#00D9FF',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/peaotjteojnkrzkmtote\.supabase\.co/,
            handler: 'NetworkFirst'
          }
        ]
      }
    })
  ]
};

// public/manifest.json
{
  "name": "Payroll System",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "icons": [...]
}
```

#### Mobile Features

1. **Offline Support**
   - Cache critical data (payroll, employees)
   - Queue actions when offline (clock in, approve)
   - Sync when reconnected

2. **Push Notifications**
   - Notify on payroll approval
   - Notify on leave request submitted
   - Notify on attendance anomalies

3. **Biometric Auth** (Optional)
   - Fingerprint/face recognition
   - Requires native mobile app

### 12.3 - Real-time Notifications

**Goal**: Notify users of important payroll events in real-time.

#### Events to Notify

1. **Payroll Events**
   - Payroll generated
   - Payroll submitted for approval
   - Payroll approved
   - Payroll rejected
   - Payslip ready to download

2. **Attendance Events**
   - Attendance discrepancy detected
   - Late arrival warning
   - Clock out reminder

3. **Admin Events**
   - New leave request pending approval
   - Pending payroll awaiting approval
   - Budget exceeded alert

#### Implementation Options

1. **Supabase Realtime** (Recommended for PostgreSQL)
```typescript
// src/hooks/useRealtimeNotifications.ts
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useRealtimeNotifications() {
  useEffect(() => {
    const subscription = supabase
      .from('payroll_records')
      .on('*', (payload) => {
        if (payload.eventType === 'UPDATE') {
          const newStatus = payload.new.status;
          if (newStatus === 'approved') {
            notifyUser('Payroll approved!', { type: 'success' });
          }
        }
      })
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);
}
```

2. **Socket.io** (For more complex real-time needs)
```typescript
// server.js
import io from 'socket.io';

const socket = io(app, {
  cors: { origin: 'http://localhost:5173' }
});

socket.on('payroll:submit', (data) => {
  // Notify approvers
  io.to(`company_${data.company_id}_admins`).emit('notification', {
    type: 'payroll.pending_approval',
    message: `New payroll submitted for ${data.month}/${data.year}`,
    data
  });
});

// Frontend
const socket = io('http://localhost:3000');
socket.on('notification', (data) => {
  showNotification(data.message);
});
```

#### Notification UI

```typescript
// src/components/NotificationCenter.tsx
<Box>
  <IconButton icon={<Bell />} position="relative">
    <Badge colorScheme="red" position="absolute" top={0} right={0}>
      {unreadCount}
    </Badge>
  </IconButton>
  
  <Menu>
    <MenuList maxW="400px">
      {notifications.map(notif => (
        <MenuItem key={notif.id}>
          <Box>
            <Text fontWeight="bold">{notif.title}</Text>
            <Text fontSize="sm" color="gray.600">{notif.message}</Text>
            <Text fontSize="xs" color="gray.400">
              {formatDistanceToNow(notif.createdAt)}
            </Text>
          </Box>
        </MenuItem>
      ))}
    </MenuList>
  </Menu>
</Box>
```

#### Browser Notifications (Push)

```typescript
// Request permission
async function requestNotificationPermission() {
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      return true;
    }
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
  }
  return false;
}

// Send notification
function sendNotification(title: string, options?: NotificationOptions) {
  if (Notification.permission === 'granted') {
    new Notification(title, options);
  }
}

// Usage
sendNotification('Payroll Approved', {
  body: 'Your payroll for May 2026 has been approved.',
  icon: '/logo.png',
  tag: 'payroll-approval',
  requireInteraction: true
});
```

### 12.4 - In-App Notifications

**Goal**: Show non-intrusive notifications for actions.

#### Using React Hot Toast

```typescript
// Already integrated in the project

import toast from 'react-hot-toast';

toast.success('Payroll approved!');
toast.error('Failed to generate payroll');
toast.loading('Generating payroll...');

// Custom
toast((t) => (
  <Box>
    <Heading size="sm">Payroll Ready</Heading>
    <Button size="sm" onClick={() => toast.dismiss(t.id)}>
      Download PDF
    </Button>
  </Box>
));
```

## Database Changes

```sql
-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id),
  user_id UUID REFERENCES auth.users(id),
  type VARCHAR(50),  -- payroll.approved, leave.pending, etc.
  title VARCHAR(255),
  message TEXT,
  data JSONB,  -- Additional context
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_see_own_notifications"
ON notifications FOR SELECT
USING (user_id = auth.uid());

-- User notification preferences
CREATE TABLE notification_preferences (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  payroll_notifications BOOLEAN DEFAULT true,
  leave_notifications BOOLEAN DEFAULT true,
  attendance_notifications BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true
);
```

## Implementation Priority

1. **Phase 12.1 - Mobile Responsive** (HIGH) - Current framework ready
2. **Phase 12.3 - In-App Notifications** (HIGH) - Already have toast
3. **Phase 12.3 - Real-time Notifications** (MEDIUM) - Add Socket.io or Supabase Realtime
4. **Phase 12.4 - Push Notifications** (MEDIUM) - Browser push
5. **Phase 12.2 - PWA/Mobile App** (LOW) - Future enhancement

## Testing Checklist

- [ ] All pages responsive on mobile (480px, 768px, 1024px)
- [ ] Touch targets are at least 48px
- [ ] Forms work on mobile keyboards
- [ ] Images scale correctly
- [ ] Horizontal scroll not needed for content
- [ ] Notifications display correctly
- [ ] Real-time updates appear
- [ ] Push notifications sent and received
- [ ] Offline caching works
- [ ] App installable on mobile

## Mobile Design Resources

- Material Design Guidelines: https://material.io/
- iOS Human Interface Guidelines: https://developer.apple.com/design/
- Chakra UI Responsive: https://chakra-ui.com/docs/styled-system/responsive-styles

## Time Estimate

- Phase 12.1: 4-6 hours (responsive redesign)
- Phase 12.3 In-App: 1 hour (toast notifications)
- Phase 12.3 Real-time: 3 hours (Socket.io/Realtime)
- Phase 12.4 Push: 2 hours (browser push)
- Phase 12.2 PWA: 2-3 hours (PWA manifest, offline)
- Phase 12.2 Native Mobile: 20+ hours (React Native/Expo)

**Total: 12-20 hours** (excluding native mobile)

## Conclusion

After Phase 12, the payroll system will be:
- ✅ Fully functional for desktop users
- ✅ Mobile-responsive and PWA-installable
- ✅ Real-time notifications for critical events
- ✅ Complete audit trails and compliance reporting
- ✅ Advanced features (approvals, batching, exports)

Ready for production deployment!
