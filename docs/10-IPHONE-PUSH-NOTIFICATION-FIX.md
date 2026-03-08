# iPhone Push Notification & Incoming Call Troubleshooting Guide

**Date:** March 8, 2026  
**Status:** ✅ FIXED

---

## Problems Identified

### 1. **No Popup for Notification Permission** ❌
When logging in on iPhone, there was no visible prompt to enable notifications because:
- Permission requests were wrapped in `.catch(() => {})` which silently suppressed errors
- iOS-specific checks returned "denied" without showing any user feedback
- No visual banners or alerts to guide users

### 2. **Push Notifications Don't Work When Screen Locked** ❌  
iPhone push notifications and incoming calls failed with locked screen because:
- **iOS requires PWA installation**: Push notifications only work when app is installed to Home Screen
- App must be opened in "standalone mode" (from home screen icon, not Safari)
- No UI guidance was provided to users about this requirement

### 3. **Silent Failures** ❌
When requirements weren't met:
- No error messages shown to user
- No installation prompts
- No feedback about what was wrong or how to fix it

---

## Solutions Implemented

### ✅ 1. iOS Installation Banner (NEW)
**File:** `www/app/ui/iosInstallPrompt.js`

- **Auto-detects iOS Safari users**
- **Shows prominent banner** at top of screen with instructions:
  - Visual Share icon guide
  - Step-by-step instructions
  - "Add to Home Screen" prompt
- **Dismissible** with session memory (doesn't re-appear immediately)
- **Auto-hides** when app is opened from home screen

### ✅ 2. Notification Permission Banner (NEW)
**File:** `www/app/ui/iosInstallPrompt.js`

- **Shows after PWA installation** if notifications not granted
- **Interactive "Enable" button** that triggers permission request
- **Clear feedback** on success or failure
- **Guidance for denied permissions** with Settings instructions

### ✅ 3. Improved Permission Request Flow (UPDATED)
**Files:** `www/app/main.js`, `www/app/push/support.js`

- **No more silent failures** - all errors logged and shown to user
- **User-friendly alerts** with step-by-step instructions
- **Confirmation dialogs** with detailed guidance
- **Settings navigation help** when permissions are denied

### ✅ 4. Enhanced Logging (UPDATED)
**Files:** `www/app/main.js`, `www/app/push/support.js`

- Clear success/failure messages
- Emoji indicators for quick visual scanning
- Detailed iOS-specific guidance in logs

---

## How It Works Now

### For iOS Safari Users (Not Installed):

1. **User visits site** → Auto-detects iOS
2. **Banner appears:** "📱 Install App for Incoming Calls"
3. **Instructions shown:** Share button → Add to Home Screen
4. **User dismisses** or installs PWA

### After PWA Installation:

1. **User opens from home screen** → Banner auto-hides
2. **New banner appears:** "🔔 Enable Notifications"  
3. **User clicks "Enable"** → Native iOS permission prompt
4. **Feedback shown:** Success ✅ or failure with fix instructions

### When User Clicks "Start" Button:

1. **Permission check** runs immediately
2. **If not granted:**
   - iOS Standalone: Shows instructions with confirm dialog
   - iOS Safari: Shows "Add to Home Screen" instructions
   - Chrome iOS: Redirects to Safari instructions
   - Other browsers: Shows browser-specific instructions
3. **If denied previously:** Shows Settings navigation instructions

---

## Testing Instructions

### Test on iPhone (Safari):

1. **Clear site data:**
   ```
   Safari Settings → Privacy → Manage Website Data → phone.srve.cc → Remove
   ```

2. **Open site in Safari:**
   - Should see purple banner: "Install App for Incoming Calls"
   - Banner shows Share icon and instructions
   - Can dismiss with "Got it" button

3. **Follow instructions to install PWA:**
   - Tap Share → Add to Home Screen → Add
   - Close Safari

4. **Open from home screen icon:**
   - Banner should auto-hide
   - New pink banner appears: "Enable Notifications"
   - Click "Enable" button
   - **iOS permission prompt should appear** ✅

5. **Click "Start" to register:**
   - Should see log: "Notification permission granted" ✅
   - Wake lock acquired
   - Registered successfully

6. **Lock screen and test incoming call:**
   - Make test call to extension
   - Notification should appear on lock screen ✅
   - Can answer or reject from notification

### Test on Desktop (Chrome/Firefox/Edge):

1. **Open site** → No iOS banners (correct)
2. **Click "Start"** → Browser permission prompt appears immediately
3. **Grant permission** → Registration completes
4. **Test notifications** working without PWA requirement

---

## Files Changed

### New Files:
- ✅ `www/app/ui/iosInstallPrompt.js` - iOS installation & notification banners

### Modified Files:
- ✅ `www/app/main.js` - Import iOS prompt, improve permission handling
- ✅ `www/app/push/support.js` - Add user feedback, detailed instructions

---

## Technical Details

### iOS Push Notification Requirements:

1. **PWA Installation** (Required)
   - App must be added to Home Screen
   - Must use `<link rel="manifest" href="/manifest.json">` ✅  
   - Manifest must have `display: "standalone"` ✅

2. **Standalone Mode** (Required)
   - App opened from home screen icon, not Safari
   - Detected via: `window.matchMedia("(display-mode: standalone)")`

3. **Notification Permission** (Required)
   - Must be explicitly granted by user
   - Prompt only works in standalone mode on iOS
   - Must be triggered by user gesture (button click)

4. **Service Worker** (Required)
   - Already implemented ✅
   - Handles push events and shows notifications
   - Wakes app when notification tapped

### Detection Logic:

```javascript
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isStandalone = window.matchMedia("(display-mode: standalone)")?.matches;
const isChromeIOS = /CriOS/i.test(navigator.userAgent);

// Chrome on iOS doesn't support Web Push
if (isChromeIOS) → Show "use Safari" message

// Safari but not installed
if (isIOS && !isStandalone) → Show "install PWA" banner

// Installed but no permission
if (isStandalone && Notification.permission === "default") → Show "enable notifications" banner

// All good
if (isStandalone && Notification.permission === "granted") → Subscribe to push ✅
```

---

## Validation Checklist

- ✅ iOS Safari users see installation banner
- ✅ After installation, notification permission banner appears  
- ✅ Permission request shows native iOS prompt (not silent)
- ✅ Success/failure feedback visible to user
- ✅ Settings instructions provided when denied
- ✅ Desktop users see browser permission prompt
- ✅ No silent failures - all errors logged and shown
- ✅ Banners dismissible and don't re-appear immediately
- ✅ Auto-detect when PWA installed and hide install banner

---

## User Instructions

### For iPhone Users:

**To Enable Incoming Calls with Locked Screen:**

1. Open phone.srve.cc in **Safari** (not Chrome)
2. Follow the banner instructions:
   - Tap the **Share** button (box with arrow) at bottom
   - Scroll down and tap **"Add to Home Screen"**
   - Tap **"Add"**
3. Close Safari and open the app from your **Home Screen icon**
4. Tap **"Enable"** when the notification banner appears
5. Tap **"Allow"** on the iOS permission prompt
6. Click **"Start"** to register your extension

**You're done!** You'll now receive incoming calls even when your screen is locked. 🎉

### For Desktop Users:

1. Open phone.srve.cc in Chrome/Firefox/Edge
2. Click **"Start"** to register
3. Click **"Allow"** when browser asks for notification permission
4. Done! ✅

---

## Future Improvements

- [ ] Add visual notification status indicator in UI (shows if notifications enabled)
- [ ] Periodic notification permission check reminder
- [ ] Test notification button in settings panel
- [ ] Analytics to track iOS installation completion rate
- [ ] Video tutorial for iOS installation process  
- [ ] Localization for non-English users

---

## References

- [iOS Web Push Guide](https://developer.apple.com/documentation/usernotifications/sending_web_push_notifications_in_web_apps_and_browsers)
- [Web App Manifest Documentation](https://web.dev/add-manifest/)
- [Push API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [iOS 16.4 Web Push Release Notes](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/)

---

## Support

If users continue to have issues:

1. **Check iOS version:** Must be iOS 16.4+ for Web Push support
2. **Verify manifest.json:** Must be accessible at `/manifest.json`
3. **Check Service Worker:** Must be registered successfully
4. **Browser Console:** Check for any JavaScript errors
5. **Push Server:** Ensure push server is running and accessible

For technical support, check browser console logs with `[Push]` prefix.
