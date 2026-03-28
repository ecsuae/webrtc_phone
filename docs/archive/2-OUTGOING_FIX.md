# WebRTC SBC - OUTGOING CALL FIX GUIDE

**Last Updated:** 2026-02-28  
**Purpose:** Fix duplicate incoming calls + remote hangup issues in under 5 minutes

---

## 🚨 INSTANT RECOVERY (Copy-Paste These Commands)

If you're experiencing duplicate calls or remote hangup not working, run these to restore:

```bash
cd /opt/webrtc-sbc

# 1. Backup current config
cp kamailio/kamailio.cfg kamailio/kamailio.cfg.backup.$(date +%Y%m%d_%H%M%S)

# 2. Verify critical routing sections exist
echo "=== Checking transaction guard ==="
grep -A 3 "transaction / retransmission guard" kamailio/kamailio.cfg

echo ""
echo "=== Checking WITHIN_DIALOG fallback ==="
grep -A 8 "WITHIN_DIALOG fallback relay" kamailio/kamailio.cfg

# 3. If either is missing, see section below for full config restoration

# 4. Restart Kamailio
docker restart kamailio

# 5. Wait and test
sleep 3
echo "=== Testing - Make a call now and monitor logs ==="
docker logs kamailio -f --tail 0 2>&1 | grep --line-buffered -E "WS SIP INVITE|RELAY_TO_PBX.*INVITE|BYE|404 Not Here"
```

---

## 🔧 CRITICAL CONFIGURATION SECTIONS

### 1. Transaction / Retransmission Guard (Lines 199-204)

**Problem:** WebSocket/TCP can retransmit SIP messages, causing duplicate INVITEs to be forwarded to PBX, resulting in two simultaneous incoming calls.

**Solution:** Add transaction guard before processing requests

**Location:** `kamailio/kamailio.cfg` - Insert after `sanity_check()`, before `set_contact_alias()`

```kamailio
    # --- drop invalid ---
    if (!sanity_check("1511", "7")) {
        sl_send_reply("400", "Bad Request");
        exit;
    }

    # --- transaction / retransmission guard ---
    # Prevent duplicate forwarding (e.g., repeated INVITE over WS/TCP)
    if (!is_method("ACK") && t_check_trans()) {
        exit;
    }

    # --- NAT / WS helpers ---
    # For WS clients, SIP.js needs contact alias so responses can find the same WS connection.
    if ($proto =~ "ws") {
        set_contact_alias();
    }
```

**What this does:**
- Checks if the request is already being handled by an existing transaction
- If found, exits immediately without forwarding again
- Exempts ACK (which is transaction-less by design)
- Prevents duplicate calls from WS retransmissions over unreliable transport

**Why critical:**
- Without this: Single call attempt → 2-3 INVITEs forwarded → Multiple calls ring simultaneously
- With this: Single call attempt → 1 INVITE forwarded → Single call rings

---

### 2. WITHIN_DIALOG Fallback Relay (Lines 273-303)

**Problem:** When remote side (PBX or far-end UA) sends BYE, it may arrive without proper Route headers. Kamailio's `loose_route()` fails, and BYE gets rejected with "404 Not Here". Browser call stays active forever.

**Solution:** Add fallback routing for in-dialog requests when alias is already resolved

**Location:** `kamailio/kamailio.cfg` - In `route[WITHIN_DIALOG]` block

```kamailio
route[WITHIN_DIALOG] {

    if (loose_route()) {

        # If ACK includes SDP, finalize media answer
        if (is_method("ACK") && has_body("application/sdp")) {
            route(MEDIA_ANSWER);
        }

        # BYE: delete rtpengine session
        if (is_method("BYE")) {
            route(MEDIA_DELETE);
        }

        # Keep WS alias
        if ($proto =~ "ws") {
            set_contact_alias();
        }

        route(RELAY);
        exit;
    }

    # Fallback: some PBX sequential requests may arrive without Route set,
    # but handle_ruri_alias() already resolved a WS destination into $du.
    if ($du != $null && $du != "" && is_method("BYE|ACK|INFO|UPDATE|NOTIFY|PRACK|MESSAGE|REFER")) {
        xlog("L_INFO", "WITHIN_DIALOG fallback relay for $rm with resolved dsturi $du\n");
        route(RELAY);
        exit;
    }

    # No loose_route => not for us
    sl_send_reply("404", "Not Here");
    exit;
}
```

**What this does:**
1. Primary path: `loose_route()` finds Route headers and processes normally
2. Fallback path: If Route missing but `handle_ruri_alias()` already resolved destination (`$du` is set), relay anyway
3. Covers BYE, ACK, and other in-dialog methods
4. Only rejects (404) if truly not destined for this proxy

**Why critical:**
- Without fallback: PBX BYE arrives → no Route header → `loose_route()` fails → 404 response → remote thinks call ended, browser still active
- With fallback: PBX BYE arrives → alias resolved → fallback relay → BYE reaches browser → call ends properly

---

### 3. Contact Header Cleanup (REGISTER-Only) (Lines 341-346)

**Problem:** Initial fix stripped WebSocket transport params from all requests, breaking in-dialog routing (BYE/re-INVITE need Contact to preserve WS alias).

**Solution:** Only strip WS params for REGISTER (PBX contact list), preserve for calls

**Location:** `kamailio/kamailio.cfg` - In `route[RELAY_TO_PBX]` block

```kamailio
route[RELAY_TO_PBX] {
    # ... (PBX address setup code) ...

    xlog("L_INFO", "RELAY_TO_PBX via $var(pbx_transport) to $var(pbx_host):$var(pbx_port) from $si:$sp | Method: $rm, Request-URI: $ru, From: $fu, To: $tu\n");

    # PBX only understands standard UDP SIP transport
    # Normalize Via transport token WS/WSS -> UDP
    if ($proto == "ws" || $proto == "wss") {
        subst_hf("Via", "/SIP\/2.0\/(WSS|WS)/SIP\/2.0\/UDP/ig", "a");

        # UDP-only PBX compatibility for WebRTC REGISTER
        # Keep call-dialog headers untouched so BYE/re-INVITE routing remains stable.
        if (is_method("REGISTER")) {
            subst_hf("Contact", "/;transport=(wss|ws)//ig", "a");
            subst_hf("Contact", "/;alias=[^;>]*//ig", "a");
        }

        msg_apply_changes();
    }

    # Send everything to FusionPBX (registrations and calls)
    $du = "sip:" + $var(pbx_host) + ":" + $var(pbx_port) + ";transport=" + $var(pbx_transport);

    # Let us touch replies (useful for SDP answer)
    t_on_reply("MANAGE_REPLY");

    route(RELAY);
    exit;
}
```

**What this does:**
- Via normalization: Always converts WSS→UDP (all requests toward PBX)
- Contact cleanup: **Only for REGISTER** (PBX doesn't need WS params in contact list)
- Call dialogs (INVITE/BYE/re-INVITE): Contact headers preserved with WS alias intact

**Why critical:**
- REGISTER: PBX stores clean Contact (no WS params) ✓
- INVITE: Contact has alias, PBX can route replies back through proxy ✓
- BYE: Contact/alias preserved, routing works bidirectionally ✓

---

## 📋 COMPLETE WORKING CONFIGURATION

### Full `kamailio.cfg` Critical Sections

**Section 1: Main Request Route (with transaction guard)**

```kamailio
request_route {
    # If PBX sends a request to a Contact with ;alias=... (WS flow token),
    # this restores the correct destination (the active WS connection).
    handle_ruri_alias();

    # --- WebSocket SIP ---
    if ($proto == "ws" || $proto == "wss") {
        if (!has_totag()) {
            xlog("L_INFO", "WS SIP $rm from $si:$sp\n");
        }
        force_rport();
    }

    # --- sanity ---
    if (!mf_process_maxfwd_header("10")) {
        sl_send_reply("483", "Too Many Hops");
        exit;
    }

    if ($rm == "OPTIONS" && $ru == "sip:ping@kamailio") {
        sl_send_reply("200", "OK");
        exit;
    }

    # --- drop invalid ---
    if (!sanity_check("1511", "7")) {
        sl_send_reply("400", "Bad Request");
        exit;
    }

    # --- transaction / retransmission guard ---
    # Prevent duplicate forwarding (e.g., repeated INVITE over WS/TCP)
    if (!is_method("ACK") && t_check_trans()) {
        exit;
    }

    # --- NAT / WS helpers ---
    # For WS clients, SIP.js needs contact alias so responses can find the same WS connection.
    if ($proto =~ "ws") {
        set_contact_alias();
    }

    # REGISTER
    if (is_method("REGISTER")) {
        route(FIX_NAT_REGISTER);
        add_path_received();
        route(RELAY_TO_PBX);
        exit;
    }

    # In-dialog requests (ACK/BYE/re-INVITE)
    if (has_totag()) {
        route(WITHIN_DIALOG);
        exit;
    }

    # Handle CANCEL quickly
    if (is_method("CANCEL")) {
        if (t_check_trans()) {
            t_relay();
        }
        exit;
    }

    # New INVITE: record-route + media offer
    if (is_method("INVITE")) {
        record_route();

        # If INVITE has SDP, anchor/bridge media via rtpengine
        if (has_body("application/sdp")) {
            route(MEDIA_OFFER);
        }
    }

    # Subscribe/Refer: still record-route for dialog correctness
    if (is_method("SUBSCRIBE|REFER")) {
        record_route();
    }

    # Relay anything else to PBX
    route(RELAY_TO_PBX);
}
```

**Section 2: WITHIN_DIALOG Route (with fallback)**

```kamailio
route[WITHIN_DIALOG] {

    if (loose_route()) {

        # If ACK includes SDP, finalize media answer
        if (is_method("ACK") && has_body("application/sdp")) {
            route(MEDIA_ANSWER);
        }

        # BYE: delete rtpengine session
        if (is_method("BYE")) {
            route(MEDIA_DELETE);
        }

        # Keep WS alias
        if ($proto =~ "ws") {
            set_contact_alias();
        }

        route(RELAY);
        exit;
    }

    # Fallback: some PBX sequential requests may arrive without Route set,
    # but handle_ruri_alias() already resolved a WS destination into $du.
    if ($du != $null && $du != "" && is_method("BYE|ACK|INFO|UPDATE|NOTIFY|PRACK|MESSAGE|REFER")) {
        xlog("L_INFO", "WITHIN_DIALOG fallback relay for $rm with resolved dsturi $du\n");
        route(RELAY);
        exit;
    }

    # No loose_route => not for us
    sl_send_reply("404", "Not Here");
    exit;
}
```

**Section 3: RELAY_TO_PBX Route (REGISTER-only cleanup)**

```kamailio
route[RELAY_TO_PBX] {
    # PBX host must come from env PBX_IP (or fail loudly)
    $var(pbx_host) = $env(PBX_IP);
    if ($var(pbx_host) == $null || $var(pbx_host) == "") {
        xlog("L_ERR", "RELAY_TO_PBX: PBX_IP not set in environment; cannot relay\n");
        sl_send_reply("503", "Server Error");
        exit;
    }

    # PBX port: default 5060 when not provided
    $var(pbx_port) = $env(PBX_PORT);
    if ($var(pbx_port) == $null || $var(pbx_port) == "") {
        $var(pbx_port) = "5060";
    }

    # Transport: default udp
    $var(pbx_transport) = $env(PBX_TRANSPORT);
    if ($var(pbx_transport) == $null || $var(pbx_transport) == "") {
        $var(pbx_transport) = "udp";
    }

    xlog("L_INFO", "RELAY_TO_PBX via $var(pbx_transport) to $var(pbx_host):$var(pbx_port) from $si:$sp | Method: $rm, Request-URI: $ru, From: $fu, To: $tu\n");

    # PBX only understands standard UDP SIP transport
    # Normalize Via transport token WS/WSS -> UDP
    if ($proto == "ws" || $proto == "wss") {
        subst_hf("Via", "/SIP\/2.0\/(WSS|WS)/SIP\/2.0\/UDP/ig", "a");

        # UDP-only PBX compatibility for WebRTC REGISTER
        # Keep call-dialog headers untouched so BYE/re-INVITE routing remains stable.
        if (is_method("REGISTER")) {
            subst_hf("Contact", "/;transport=(wss|ws)//ig", "a");
            subst_hf("Contact", "/;alias=[^;>]*//ig", "a");
        }

        msg_apply_changes();
    }

    # Send everything to FusionPBX (registrations and calls)
    $du = "sip:" + $var(pbx_host) + ":" + $var(pbx_port) + ";transport=" + $var(pbx_transport);

    # Let us touch replies (useful for SDP answer)
    t_on_reply("MANAGE_REPLY");

    route(RELAY);
    exit;
}
```

---

## 🔍 VERIFICATION CHECKLIST

### 1. Test Duplicate Call Prevention

```bash
# Start monitoring
docker logs kamailio -f --tail 0 2>&1 | grep --line-buffered "WS SIP INVITE" &

# Make ONE call from browser to extension (e.g., 900900)

# Check log count
sleep 5
killall docker 2>/dev/null
docker logs kamailio --since 30s | grep -c "WS SIP INVITE"
```

**Expected:** Count = 1 (one INVITE received from WebSocket)  
**Broken:** Count > 1 (duplicates received and forwarded)

---

### 2. Test Remote Hangup

```bash
# Start monitoring
docker logs kamailio -f --tail 0 2>&1 | grep --line-buffered -E "BYE|404 Not Here" &

# Make a call from browser
# Answer on remote side
# HANG UP FROM REMOTE SIDE (PBX or far-end phone)

# Check logs
```

**Expected:**
```
INFO: WITHIN_DIALOG fallback relay for BYE with resolved dsturi sip:...
(or)
INFO: loose_route() successful for BYE
```

**Broken:**
```
404 Not Here (sent to BYE request)
```

---

### 3. Test Call Flow End-to-End

```bash
# Full flow monitoring
docker logs kamailio -f --tail 0 2>&1 | grep --line-buffered -E "WS SIP|RELAY_TO_PBX|WITHIN_DIALOG|MEDIA" &

# Steps:
# 1. Browser makes call (INVITE)
# 2. Remote answers (200 OK)
# 3. Media flows (check RTPengine)
# 4. Remote hangs up (BYE)
# 5. Browser call ends
```

**Expected log sequence:**
```
INFO: WS SIP INVITE from 172.18.0.2:XXXXX
INFO: MEDIA_OFFER rtpengine_offer()
INFO: RELAY_TO_PBX via udp to testfusn.srve.cc:5060 | Method: INVITE
INFO: MEDIA_ANSWER rtpengine_answer()
... (call active) ...
INFO: WITHIN_DIALOG fallback relay for BYE
INFO: MEDIA_DELETE rtpengine_delete()
```

---

## 🐛 COMMON ISSUES & INSTANT FIXES

### Issue 1: Still Getting Duplicate Calls

**Symptom:**
```bash
docker logs kamailio --since 1m | grep "WS SIP INVITE"
# Shows 2-3 INVITEs for a single call attempt
```

**Diagnosis:**
```bash
# Check if transaction guard exists
grep -n "t_check_trans" kamailio/kamailio.cfg

# Should show line ~201: if (!is_method("ACK") && t_check_trans()) {
```

**Fix:**
```bash
# If missing, add the transaction guard section from above
# Then restart
docker restart kamailio
```

---

### Issue 2: Remote Hangup Still Not Working

**Symptom:** Browser call stays active even after remote hangs up

**Diagnosis:**
```bash
# Monitor for 404 responses to BYE
docker logs kamailio -f --tail 0 2>&1 | grep --line-buffered "404 Not Here" &

# Make a call, answer, hang up from remote side
# If you see "404 Not Here" → fallback is missing or not working
```

**Debug Steps:**
```bash
# 1. Check if fallback exists
grep -A 5 "WITHIN_DIALOG fallback relay" kamailio/kamailio.cfg

# 2. Check if handle_ruri_alias is called early in request_route
grep -n "handle_ruri_alias" kamailio/kamailio.cfg
# Should be at the very start of request_route (before line 180)

# 3. Check $du variable logging
docker logs kamailio --since 1m | grep "WITHIN_DIALOG fallback"
# Should show "resolved dsturi sip:..." if working
```

**Fix:**
```bash
# Ensure handle_ruri_alias() is at top of request_route
# Ensure WITHIN_DIALOG fallback exists (see config above)
# Restart
docker restart kamailio
```

---

### Issue 3: Call Connects But Immediately Drops

**Symptom:** Call rings, answers, then immediately disconnects

**Diagnosis:**
```bash
# Check for premature BYE or transaction errors
docker logs kamailio --since 1m | grep -E "BYE|487|408|transaction"
```

**Possible Causes:**
1. RTPengine not responding → check `docker logs rtpengine`
2. Contact header corruption → check Via/Contact normalization
3. Transaction timeout → check `fr_inv_timer` setting

**Fix:**
```bash
# Verify RTPengine is running
docker ps | grep rtpengine

# Check RTPengine connectivity
docker exec kamailio nc -v -z 127.0.0.1 2223

# Restart if needed
docker restart rtpengine kamailio
```

---

## 📊 LOG ANALYSIS EXAMPLES

### Healthy Call Flow

```
# Outbound call from browser to external number 045945060

1. WebSocket INVITE arrives:
INFO: WS SIP INVITE from 172.18.0.2:49648

2. Transaction guard allows first INVITE:
(no duplicate log entries - guard silently drops retransmissions)

3. Media anchoring:
INFO: MEDIA_OFFER rtpengine_offer() from 172.18.0.2:49648 proto=ws

4. Forward to PBX:
INFO: RELAY_TO_PBX via udp to testfusn.srve.cc:5060 from 172.18.0.2:49648 | Method: INVITE, Request-URI: sip:045945060@testfusn.srve.cc

5. PBX replies 200 OK with SDP:
INFO: MEDIA_ANSWER rtpengine_answer() from testfusn.srve.cc:5060 proto=udp

6. Call active (RTP flows via rtpengine)

7. Remote hangs up (BYE from PBX):
INFO: WITHIN_DIALOG fallback relay for BYE with resolved dsturi sip:172.18.0.2:49648

8. Media cleanup:
INFO: MEDIA_DELETE rtpengine_delete()
```

---

### Broken: Duplicate Calls

```
# WITHOUT transaction guard:

INFO: WS SIP INVITE from 172.18.0.2:49648
INFO: RELAY_TO_PBX via udp to testfusn.srve.cc:5060 | Method: INVITE
INFO: WS SIP INVITE from 172.18.0.2:49648  ← DUPLICATE (TCP retransmit)
INFO: RELAY_TO_PBX via udp to testfusn.srve.cc:5060 | Method: INVITE  ← DUPLICATE FORWARDED
INFO: WS SIP INVITE from 172.18.0.2:49648  ← DUPLICATE
INFO: RELAY_TO_PBX via udp to testfusn.srve.cc:5060 | Method: INVITE  ← DUPLICATE FORWARDED

Result: 3 calls ring simultaneously at remote end
```

---

### Broken: Hangup Rejected

```
# WITHOUT fallback relay:

(Call established normally...)

# Remote hangs up, BYE arrives from PBX:
INFO: BYE from testfusn.srve.cc:5060 to 172.18.0.2:49648
ERROR: loose_route() failed, no Route headers found
404 Not Here (response sent to PBX)

Result: PBX thinks call ended, browser call stays active forever
```

---

## ✅ SUCCESS INDICATORS

When everything is working:

```bash
# 1. Single INVITE per call attempt
docker logs kamailio --since 5m | grep -c "WS SIP INVITE"
# → Should equal the number of call attempts you made

# 2. No duplicate RELAY_TO_PBX for same transaction
docker logs kamailio --since 5m | grep "RELAY_TO_PBX.*INVITE" | awk '{print $NF}' | sort | uniq -d
# → Should be empty (no duplicate Call-IDs)

# 3. BYE properly routed
docker logs kamailio --since 5m | grep "BYE" | grep -E "loose_route|fallback relay"
# → Should show routing logs (not 404)

# 4. No spurious 404 for in-dialog requests
docker logs kamailio --since 5m | grep "404 Not Here"
# → Should be empty or only for genuinely invalid requests

# 5. Browser UI behavior
# → Single call rings (not multiple)
# → Call ends immediately when remote hangs up
# → Call status shows "Terminated" after BYE
```

---

## 🔗 RELATED ISSUES & FIXES

### If Calls Work But Registration Broken

See **[1-REGISTRATION_FIX.md](1-REGISTRATION_FIX.md)** for:
- WebSocket proxy configuration
- Via header normalization for REGISTER
- Contact cleanup for registration

### If Both Registration and Calls Broken

1. Start with **[1-REGISTRATION_FIX.md](1-REGISTRATION_FIX.md)** (registration must work first)
2. Then apply **[2-OUTGOING_FIX.md](2-OUTGOING_FIX.md)** (this document)

### If Audio Issues (One-Way or No Audio)

- Check RTPengine: `docker logs rtpengine --tail 50`
- Verify RTPengine connectivity: `docker exec kamailio nc -v -z 127.0.0.1 2223`
- Check NAT/firewall for RTP ports (UDP 10000-20000 range)
- Verify public IP in `.env`: `PUBLIC_IP=38.242.157.239`

---

## 📝 CONFIGURATION FILE LOCATIONS

| File | Purpose | Critical Lines |
|------|---------|----------------|
| `kamailio/kamailio.cfg` | SIP routing logic | 199-204 (guard), 273-303 (fallback), 313-348 (relay) |
| `.env` | Environment variables | `PBX_IP`, `PBX_PORT`, `PUBLIC_IP` |
| `docker-compose.yml` | Container orchestration | Network modes, port mappings |

---

## 🎯 QUICK COMMAND REFERENCE

```bash
# Monitor call flow in real-time
docker logs kamailio -f --tail 0 2>&1 | grep --line-buffered -E "INVITE|BYE|RELAY_TO_PBX|WITHIN_DIALOG"

# Count duplicate INVITEs
docker logs kamailio --since 1m | grep "WS SIP INVITE" | wc -l

# Check for 404 errors on BYE
docker logs kamailio --since 5m | grep "404 Not Here"

# Verify transaction guard exists
grep -n "t_check_trans" kamailio/kamailio.cfg

# Verify fallback exists
grep -n "WITHIN_DIALOG fallback" kamailio/kamailio.cfg

# Restart Kamailio cleanly
docker restart kamailio && sleep 3 && docker logs kamailio --tail 20

# Full system health check
docker ps --format "table {{.Names}}\t{{.Status}}" && \
docker logs kamailio --tail 5 && \
docker logs rtpengine --tail 5
```

---

**Created:** 2026-02-28  
**Fix Batch:** 2 (Outgoing Call Issues)  
**Prerequisite:** Registration must work (see Batch 1 docs)  
**Keep Updated:** When call routing logic changes
