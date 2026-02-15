# Registration Troubleshooting - "Unregistered" Response

## What's Happening

1. ✅ WebSocket connects successfully (wss://phone.srve.cc/ws)
2. ✅ REGISTER message sent to Kamailio
3. ✅ Kamailio forwards REGISTER to FusionPBX (testfusn.srve.cc:5060)
4. ❌ FusionPBX rejects the registration
5. ❌ Client receives "Unregistered" response

---

## Most Likely Causes

### 1. Extension 900900 Doesn't Exist ⚠️

**Check in FusionPBX:**
- Log into FusionPBX admin panel
- Navigate to: Account → Extensions
- Search for extension **900900**
- If it doesn't exist, **create it first**

**If it doesn't exist:**
1. Create extension 900900
2. Set a password
3. Make sure it's assigned to domain **testfusn.srve.cc**
4. Try registration again

### 2. Password Mismatch ⚠️

**The password you're using (as****4) might not match FusionPBX.**

**Check in FusionPBX:**
1. Go to extension 900900 settings
2. Find the SIP password/secret
3. Use that exact password in the Web UI

**Or reset the password:**
1. Edit extension 900900 in FusionPBX
2. Set a new password
3. Use that password in Web UI

### 3. Domain Configuration ⚠️

**testfusn.srve.cc might not be configured as a SIP domain in FusionPBX.**

**Check in FusionPBX:**
1. Log into FusionPBX
2. Navigate to: Advanced → SIP Profiles or Domains
3. Make sure **testfusn.srve.cc** is listed as a valid SIP domain
4. If not, add it

**Or use phone.srve.cc instead:**
- Change the domain in Web UI from testfusn.srve.cc to phone.srve.cc
- Try registration again

---

## How to Debug Further

### Option 1: Check Kamailio Logs for REGISTER Details

```bash
# Follow Kamailio logs during registration
docker logs kamailio -f

# Try registration, then look for:
# - "RELAY_TO_PBX via udp to testfusn.srve.cc:5060"
# - Any error messages
# - Response codes (401, 403, etc.)
```

### Option 2: Check What FusionPBX Received

In FusionPBX:
1. Go to **Advanced → SIP Debugging**
2. Enable SIP logging
3. Try registration from Web UI
4. Check SIP debug log to see what was received and why it was rejected

### Option 3: Try Different Extension

1. Pick a different extension (e.g., 100, 101, 102)
2. Note its password in FusionPBX
3. Try registering with that extension in Web UI
4. If it works, extension 900900 is the issue

---

## Verification Checklist

Before trying registration, verify:

- [ ] Extension exists in FusionPBX
- [ ] Extension is active/enabled
- [ ] Extension has a password set
- [ ] Password is correct
- [ ] Domain testfusn.srve.cc is configured in FusionPBX
- [ ] Kamailio can reach testfusn.srve.cc (network connectivity)
- [ ] FusionPBX SIP service is running on port 5060

---

## Quick Fix Steps

1. **SSH into FusionPBX**
2. **Create or verify extension 900900**
   ```bash
   # Check if extension exists
   # In FusionPBX, create extension 900900 with password "test1234"
   ```
3. **Edit Web UI and use that password**
   - Domain: testfusn.srve.cc
   - Extension: 900900  
   - Password: test1234 (or whatever you set)
4. **Try registration again**

---

## What the Error Means

**"Unregistered"** means FusionPBX sent back a **401 Unauthorized** or **403 Forbidden** response.

This typically means:
- ❌ Extension not found
- ❌ Wrong password  
- ❌ Domain not recognized
- ❌ Extension disabled

---

## Next Steps

1. **Log into FusionPBX**
2. **Check/Create extension 900900**
3. **Verify domain testfusn.srve.cc is configured**
4. **Note the correct password**
5. **Use that password in Web UI**
6. **Try registration again**

If still failing:
- Enable SIP debugging in FusionPBX
- Check what error FusionPBX is returning
- Adjust extension settings accordingly

---

**Status:** Registration infrastructure is working (WebSocket ✓, Kamailio forwarding ✓)  
**Issue:** FusionPBX rejecting credentials (likely extension/password/domain mismatch)  
**Solution:** Verify/create extension and use correct credentials

