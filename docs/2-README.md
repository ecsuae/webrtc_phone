# WebRTC SBC Outgoing Call Fix - Quick Reference

**Last Updated:** 2026-02-28  
**Problem:** Duplicate incoming calls + Remote hangup not working  
**Status:** ✅ Fixed

---

## 🚨 QUICK TEST: Are Calls Working Properly?

```bash
# Test while making an outbound call
docker logs kamailio -f --tail 0 2>&1 | grep --line-buffered -E "WS SIP INVITE|RELAY_TO_PBX.*INVITE|BYE" | head -10
```

- **See one INVITE (not two)?** ✅ Duplicate call guard working
- **See BYE when remote hangs up?** ✅ Hangup routing working
- **Issues?** ❌ Read full guide: [2-OUTGOING_FIX.md](2-OUTGOING_FIX.md)

---

## 📖 Full Documentation

**All fixes, configs, and troubleshooting:** [2-OUTGOING_FIX.md](2-OUTGOING_FIX.md)

This file contains:
- ⚡ Instant recovery commands (copy-paste restore)
- 🔧 Complete working call routing configuration
- 🐛 Troubleshooting guide for call issues
- ✅ Verification checklist
- 📊 Log analysis examples

---

## 🎯 Common Problems → Solutions

| Problem | Quick Fix |
|---------|-----------|
| Duplicate incoming calls | Check transaction guard at line 199-204 in kamailio.cfg |
| Remote hangup doesn't end call | Check WITHIN_DIALOG fallback at line 273-303 in kamailio.cfg |
| Call setup but no audio | Check RTPengine routing |
| Everything broken | Run instant recovery from [2-OUTGOING_FIX.md](2-OUTGOING_FIX.md) |

**For detailed diagnosis and fixes, always refer to:** [2-OUTGOING_FIX.md](2-OUTGOING_FIX.md)

---

## 🏗️ Call Flow Architecture

```
Browser (INVITE/WSS) → Nginx → Kamailio → PBX (INVITE/UDP)
                                  ↓
                        t_check_trans() guard
                        (prevents duplicates)
                                  ↓
                        Route normalization
                        (Via: WSS→UDP)
                                  ↓
Browser (BYE received) ← Kamailio ← PBX (BYE/UDP)
         ↓                  ↓
   loose_route()      fallback relay
   OR alias-based     (when Route missing)
```

**Key Points:**
- Transaction guard prevents duplicate INVITE forwarding over WS/TCP retransmissions
- In-dialog requests (BYE/ACK) use `loose_route()` or fallback alias-based routing
- Via normalization for all WS-originated requests keeps PBX compatibility

---

## ⚡ Emergency 5-Minute Recovery

If calls are duplicating or remote hangup broken:

```bash
cd /opt/webrtc-sbc

# 1. Verify transaction guard exists in kamailio.cfg (around line 199)
grep -A 3 "transaction / retransmission guard" kamailio/kamailio.cfg

# Expected output:
# # --- transaction / retransmission guard ---
# # Prevent duplicate forwarding (e.g., repeated INVITE over WS/TCP)
# if (!is_method("ACK") && t_check_trans()) {
#     exit;
# }

# 2. Verify WITHIN_DIALOG fallback exists (around line 273-303)
grep -A 8 "WITHIN_DIALOG fallback relay" kamailio/kamailio.cfg

# Expected output showing fallback when loose_route fails

# 3. If missing, restore from 2-OUTGOING_FIX.md

# 4. Restart Kamailio
docker restart kamailio

# 5. Test (make one call and hang up from remote side)
docker logs kamailio -f --tail 0 2>&1 | grep --line-buffered -E "INVITE|BYE|404 Not Here"
```

**For complete recovery with explanations:** [2-OUTGOING_FIX.md](2-OUTGOING_FIX.md)

---

## 📋 What Was Fixed (Fix Batch 2)

| Component | Issue | Fix |
|-----------|-------|-----|
| **Kamailio** | Duplicate incoming calls (TCP/WS retransmissions) | Added `t_check_trans()` guard at line 199-204 |
| **Kamailio** | Remote hangup BYE gets "404 Not Here" | Added WITHIN_DIALOG fallback relay at line 273-303 |
| **Kamailio** | Contact header stripping broke in-dialog routing | Reverted to REGISTER-only cleanup at line 341-346 |

**Complete details:** [2-OUTGOING_FIX.md](2-OUTGOING_FIX.md)

---

## 📁 Documentation Files

- **[2-README.md](2-README.md)** ← You are here (quick reference)
- **[2-OUTGOING_FIX.md](2-OUTGOING_FIX.md)** ← Full guide (read this for any call issue)

**Total:** 2 files for Batch 2 (outgoing call fixes)

---

## ✅ Success Check

When working correctly, you'll see:

```bash
# 1. Single INVITE forwarded (not duplicated)
docker logs kamailio --tail 100 | grep -c "WS SIP INVITE"
# → Should match number of actual call attempts (1 per call)

# 2. BYE properly routed
docker logs kamailio --tail 100 | grep -E "BYE.*WITHIN_DIALOG|loose_route"
# → Should see routing logs for BYE requests

# 3. No "404 Not Here" for valid in-dialog requests
docker logs kamailio --tail 100 | grep "404 Not Here"
# → Should be empty or only for actual invalid requests

# 4. Browser call ends when remote hangs up
# → Call status changes to "Terminated" immediately in browser
```

---

## 🔗 Related Documentation

- **[1-README.md](1-README.md)** - Registration fixes (Batch 1)
- **[1-REGISTRATION_FIX.md](1-REGISTRATION_FIX.md)** - Registration recovery guide

---

**Created:** 2026-02-28  
**Maintained By:** System documentation (Fix Batch 2)  
**Keep Updated:** When call routing changes
