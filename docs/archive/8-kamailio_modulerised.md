# 8. Kamailio Configuration Modularization

**Date:** March 5, 2026  
**Status:** IMPLEMENTED & TESTED  
**Impact:** Configuration maintainability, feature isolation, regression prevention

## Problem Statement

The monolithic `kamailio.cfg` (684 lines) contained all routing logic in a single file. When fixing one feature (e.g., registration), unrelated code changes would inadvertently break working features (e.g., calls or media). This made debugging and feature development risky and inefficient.

**Root Cause:** Cross-feature dependencies mixed at the script level; no logical separation of concerns.

## Solution: Modular Route Architecture

Split Kamailio configuration into feature-specific route files, each isolated in its own file, included into the main config via `#!include_file` directives.

### Directory Structure

```
kamailio/
├── kamailio.cfg                    # Main config (modules, params, includes)
├── local.cfg                       # Environment-specific settings
├── tls.cfg                         # TLS configuration
└── routes/                         # Feature-specific routing logic
    ├── 20-registration.cfg         # WebRTC→PBX registration relay
    ├── 30-dialog-relay.cfg         # In-dialog SIP (BYE, ACK, INFO)
    ├── 40-replies.cfg              # Response handlers (200 OK, 401, media SDP)
    ├── 50-domain-map.cfg           # Multi-tenant domain→PBX routing
    └── 60-media.cfg                # RTPEngine media offer/answer/delete
```

### File Ownership & Scope

#### [kamailio/kamailio.cfg](../kamailio/kamailio.cfg)
- **Lines:** ~315 (vs 684 pre-modularization)
- **Scope:** Global parameters, module loads, main request route, WebSocket handler
- **Included files:** 5 feature routes
- **Rule:** Do NOT add route logic here; use feature includes

#### [kamailio/routes/20-registration.cfg](../kamailio/routes/20-registration.cfg)
- **Routes:** `FIX_NAT_REGISTER`, `HANDLE_REGISTER`, `RELAY_REGISTER_TO_PBX`
- **Purpose:** WebRTC client registration via WSS → PBX authentication
- **Behavior:** 
  - NAT fix for WebSocket clients
  - Path header for RFC 3327 compliance  
  - Relay REGISTER to backend PBX
  - Never modifies INVITE/call routing
- **When to edit:** Registration auth flow, PBX contact handling, REGISTER timeouts

#### [kamailio/routes/30-dialog-relay.cfg](../kamailio/routes/30-dialog-relay.cfg)
- **Routes:** `WITHIN_DIALOG`, `RELAY_TO_PBX`, `RELAY`
- **Purpose:** In-dialog requests (ACK/BYE/re-INVITE) and generic call relay
- **Behavior:**
  - `loose_route()` for dialog continuity
  - RTPEngine media cleanup on BYE
  - Domain→PBX mapping via `GET_PBX_FOR_DOMAIN`
  - WebSocket alias preservation
- **When to edit:** Call routing, dialog handling, PBX failover

#### [kamailio/routes/40-replies.cfg](../kamailio/routes/40-replies.cfg)
- **Routes:** `onreply_route[MANAGE_REPLY]`, `onreply_route[LOCAL_CALL_REPLY]`
- **Purpose:** Process SIP responses (200 OK, 401 auth, 183 early media)
- **Behavior:**
  - Save REGISTER to location table on 200 OK
  - Bridge SDP with RTPEngine for media answers
  - Restore WebSocket aliasing in responses
- **When to edit:** Registration completion, SDP handling, early media

#### [kamailio/routes/50-domain-map.cfg](../kamailio/routes/50-domain-map.cfg)
- **Routes:** `GET_PBX_FOR_DOMAIN`
- **Purpose:** Multi-tenant support: map request domain to backend PBX host
- **Behavior:**
  - Extract domain from Request-URI
  - Match against hardcoded domain-to-host table (fusn01–fusn08.srve.cc)
  - Fallback to env var `PBX_IP` or default `testfusn.srve.cc`
- **When to edit:** Add/remove PBX servers, change domain routing logic

#### [kamailio/routes/60-media.cfg](../kamailio/routes/60-media.cfg)
- **Routes:** `MEDIA_OFFER`, `MEDIA_ANSWER`, `MEDIA_DELETE`
- **Purpose:** SDP processing via RTPEngine for WebRTC↔PBX media bridging
- **Behavior:**
  - OFFER: Convert WebRTC SRTP/DTLS to PBX RTP
  - ANSWER: Convert PBX RTP back to WebRTC SRTP/DTLS
  - DELETE: Clean up RTPEngine session on call end
  - Separate handling for ext-to-ext (both WebRTC) vs call-to-PBX
- **When to edit:** Media codec issues, ICE/DTLS parameters, RTPEngine tuning

## Key Changes Made

### 1. Config Splitting (Lines: 684 → 315 main + 5 feature files)
- **Removed** inline route definitions from main `kamailio.cfg`
- **Created** `kamailio/routes/` directory with numbered feature files
- **Added** `#!include_file` directives in main config at load time

### 2. Docker Volume Mount
- **Updated** `docker-compose.yml` to mount `./kamailio/routes` as read-only volume
- **Path:** `/etc/kamailio/routes` inside container
- **Effect:** Route files accessible at runtime without rebuild

### 3. Validation Guardrail
- **Added** `make kam-check` target in [Makefile](../Makefile#L125-L128)
- **Runs:** `docker exec kamailio kamailio -c -f /etc/kamailio/kamailio.cfg`
- **Verifies:** Syntax before every restart, prevents file-level regressions

### 4. Isolation Enforcement
- **Registration** (20-registration.cfg) is completely separate from:
  - Call routing (30-dialog-relay.cfg)
  - Media handling (60-media.cfg)
  - Reply processing (40-replies.cfg)
- **No cross-feature dependencies** within route files (all inter-route calls are explicit)

## Workflow: Adding a New Feature

**Goal:** Add support for OPTION pings without breaking existing code.

### Step 1: Create Feature File
```bash
touch kamailio/routes/70-options.cfg
```

### Step 2: Write Route Logic (Isolated)
```properties
# OPTIONS handler - does NOT call registration or media routes
route[HANDLE_OPTIONS] {
    if (is_method("OPTIONS")) {
        add_hf("Accept: application/sdp\r\n");
        sl_send_reply("200", "OK");
        exit;
    }
}
```

### Step 3: Add Include to Main Config
```properties
#!include_file "routes/70-options.cfg"
```

### Step 4: Hook in request_route (ONLY)
```properties
if (is_method("OPTIONS")) {
    route(HANDLE_OPTIONS);
    exit;
}
```

### Step 5: Validate & Test
```bash
make kam-check              # Syntax validation
docker-compose restart kamailio
curl sip:127.0.0.1:5060 -X OPTIONS -v  # Test
```

### Why This Works
- OPTIONS logic lives in one file; doesn't interfere with registration, calls, or media
- Other features can continue unchanged
- Regression risk is **localized to one file**

## Regression Prevention Rules

1. **One Feature = One File**: Do not add request_route conditions to multiple files
2. **Validate Before Restart**: Always run `make kam-check` after edits
3. **No Cross-Feature Edits**: Fix registration in 20-registration.cfg, not 30-dialog-relay.cfg
4. **Naming Convention**: 
   - Files prefixed with 10s digit for load order (20, 30, 40, etc.)
   - Route names indicate feature: `REGISTER_*`, `WITHIN_DIALOG_*`, `MEDIA_*`
5. **Git Discipline**: Commit feature changes with precise messages:
   ```bash
   git add kamailio/routes/20-registration.cfg
   git commit -m "registration: add support for Path-style routing"
   ```

## Performance Impact

- **Load Time:** Negligible (includes resolved at Kamailio startup, not runtime)
- **Memory:** Same (Kamailio loads full config into memory, file split is compile-time only)
- **Throughput:** No change (routing logic identical)

## Testing Checklist

After modifying a route file:
- [ ] Run `make kam-check` (validates syntax)
- [ ] Restart Kamailio: `docker-compose restart kamailio`
- [ ] Verify status: `docker-compose ps kamailio`
- [ ] Check logs: `docker-compose logs kamailio --since 30s | grep -i error|critical`
- [ ] Test affected feature (e.g., register, call, BYE)
- [ ] **Crucially:** Test unrelated features (e.g., if editing registration, still test outgoing calls)

## Future Enhancements

- [ ] Add authentication routes (10-auth.cfg) for digest/digest-akm
- [ ] Add rate-limiting/ACL routes (15-acl.cfg)
- [ ] Add logging/debugging routes (05-logging.cfg)
- [ ] Migrate domain mapping to database (50-domain-map.cfg → usrloc)

## References

- Kamailio Docs: [Routing Logic](https://kamailio.org/wiki/cookbooks/5.8.x/start)
- Previous PRs: See docs/7-MULTIPLE_DOMAINS.md for multi-tenant context
- RFC 3327: Path Header Field

---

**Commit:** kamailio refactored  
**Files Changed:** 14 moved, 1 new, 2 modified (kamailio.cfg, docker-compose.yml)
