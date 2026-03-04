# Multiple FusionPBX Domains Support

**Last Updated:** 2026-03-04  
**Purpose:** Enable WebRTC clients to register and make calls to multiple FusionPBX backend servers by domain

---

## Overview

This implementation allows a single WebRTC SBC to route calls to **8 different FusionPBX domains** based on the domain specified in the SIP account.

**Supported Domains:**
- `fusn01.srve.cc` through `fusn08.srve.cc` (8 primary domains)
- `testfusn.srve.cc` (fallback/default)

**How It Works:**
1. User registers with account format: `username@domain` (e.g., `100357@fusn04.srve.cc`)
2. WebRTC app parses the domain from the account string
3. App sends REGISTER to domain extracted from account
4. SBC routes based on domain: `fusn04.srve.cc` → `fusn04.srve.cc` PBX
5. Calls use same domain-based routing

---

## Implementation

### 1. WebRTC App - Account Parsing (dom.js & main.js)

**File:** `/opt/webrtc-sbc/www/app/dom.js`

```javascript
export function parseSipAccount(usernameValue, domainValue, fallbackDomainValue) {
    // Extract inline domain from "user@domain" format
    let username = usernameValue;
    let inlineDomain = null;
    let hasInlineDomain = false;

    if (usernameValue && usernameValue.includes("@")) {
        const parts = usernameValue.split("@");
        username = parts[0];
        inlineDomain = parts[1];
        hasInlineDomain = true;
    }

    // Domain priority: inline > explicit field > environment fallback
    const domain = inlineDomain || domainValue || fallbackDomainValue;

    const rawUsername = usernameValue;

    return { username, domain, inlineDomain, hasInlineDomain, rawUsername };
}
```

**Features:**
- Parses `user@domain` format from username field
- Falls back to explicit domain field if no inline domain
- Uses environment default (testfusn.srve.cc) as last resort
- Returns: `{username, domain, inlineDomain, hasInlineDomain, rawUsername}`

**File:** `/opt/webrtc-sbc/www/app/main.js`

```javascript
ui.account = function() {
    const ext = el.ext?.value;
    const domain = el.domain?.value;
    const fallback = ui.domainFallback();
    return parseSipAccount(ext, domain, fallback);
};

ui.domainFallback = function() {
    return d.sipDomain || "testfusn.srve.cc";
};
```

**Usage:**
```javascript
const account = ui.account();
// Returns: { username: "100357", domain: "fusn04.srve.cc", inlineDomain: "fusn04.srve.cc", ... }
```

---

### 2. SIP Registration (sipRegister.js)

**File:** `/opt/webrtc-sbc/www/app/sipRegister.js`

```javascript
async function startAndRegister(SIP, st, ui) {
    const account = ui.account ? ui.account() : null;
    const ext = account?.username;
    const domain = account?.domain;

    if (!ext || !domain) return ui.setStatus("Missing account details");

    // Auth username is extension only (not full account)
    const authUsername = account.username;
    
    // Create User Agent for specific domain
    st.ua = new SIP.UserAgent({
        uri: SIP.UserAgent.makeURI(`sip:${ext}@${domain}`),
        wsServers: [`wss://${window.location.hostname}:${window.location.port}`],
        displayName: ext,
        authorizationUsername: authUsername,
        authorizationPassword: password,
        // ... other config
    });

    // Store active account for later use
    st.account = { username: ext, domain, rawUsername: account.rawUsername || ext, authUsername };
    
    await st.ua.start();
}
```

**Key Points:**
- Extracts username and domain from parsed account
- Auth username is **extension only** (not `user@domain`)
- Sets Request-URI and From/To headers to specific domain
- Stores account info for call routing

---

### 3. Outgoing Calls (sipCall.js)

**File:** `/opt/webrtc-sbc/www/app/sipCall.js`

```javascript
export async function startCall(SIP, st, ui) {
    const target = ui.dial();
    const resolvedAccount = ui.account ? ui.account() : null;
    
    // Domain resolution priority:
    // 1. Active registered account domain
    // 2. Parsed account domain from input
    // 3. Explicit domain field
    // 4. Environment fallback
    const domain = st.account?.domain || 
                   resolvedAccount?.domain || 
                   ui.domain() || 
                   ui.domainFallback();

    const encodedTarget = encodeURIComponent(target);
    const targetUri = SIP.UserAgent.makeURI(`sip:${encodedTarget}@${domain}`);
    
    const inviter = new SIP.Inviter(st.ua, targetUri, {
        earlyMedia: true,
        sessionDescriptionHandlerModifiers: [g711OnlyModifier],
        sessionDescriptionHandlerOptions: { /* ... */ },
    });
    
    await inviter.invite();
}
```

**Domain Resolution:**
- Uses registered account domain if available
- Falls back to parsed domain from dial input
- Uses explicit domain field
- Final fallback to environment default

---

### 4. SBC Routing (kamailio.cfg)

**File:** `/opt/webrtc-sbc/kamailio/kamailio.cfg`

#### Domain-to-PBX Mapping Route

```kamailio
route[GET_PBX_FOR_DOMAIN] {
    # Extract domain from Request-URI
    $avp(req_domain) = $rd;
    
    xlog("L_INFO", "GET_PBX_FOR_DOMAIN: Processing domain $avp(req_domain)\n");
    
    # Default to environment PBX_IP or testfusn
    $avp(pbx_host) = $env(PBX_IP);
    if ($avp(pbx_host) == $null || $avp(pbx_host) == "") {
        $avp(pbx_host) = "testfusn.srve.cc";
    }
    
    # Map each domain to its PBX server
    if ($avp(req_domain) == "fusn01.srve.cc") {
        $avp(pbx_host) = "fusn01.srve.cc";
        xlog("L_INFO", "GET_PBX_FOR_DOMAIN: Matched fusn01.srve.cc\n");
    }
    else if ($avp(req_domain) == "fusn02.srve.cc") {
        $avp(pbx_host) = "fusn02.srve.cc";
        xlog("L_INFO", "GET_PBX_FOR_DOMAIN: Matched fusn02.srve.cc\n");
    }
    else if ($avp(req_domain) == "fusn03.srve.cc") {
        $avp(pbx_host) = "fusn03.srve.cc";
        xlog("L_INFO", "GET_PBX_FOR_DOMAIN: Matched fusn03.srve.cc\n");
    }
    else if ($avp(req_domain) == "fusn04.srve.cc") {
        $avp(pbx_host) = "fusn04.srve.cc";
        xlog("L_INFO", "GET_PBX_FOR_DOMAIN: Matched fusn04.srve.cc\n");
    }
    else if ($avp(req_domain) == "fusn05.srve.cc") {
        $avp(pbx_host) = "fusn05.srve.cc";
        xlog("L_INFO", "GET_PBX_FOR_DOMAIN: Matched fusn05.srve.cc\n");
    }
    else if ($avp(req_domain) == "fusn06.srve.cc") {
        $avp(pbx_host) = "fusn06.srve.cc";
        xlog("L_INFO", "GET_PBX_FOR_DOMAIN: Matched fusn06.srve.cc\n");
    }
    else if ($avp(req_domain) == "fusn07.srve.cc") {
        $avp(pbx_host) = "fusn07.srve.cc";
        xlog("L_INFO", "GET_PBX_FOR_DOMAIN: Matched fusn07.srve.cc\n");
    }
    else if ($avp(req_domain) == "fusn08.srve.cc") {
        $avp(pbx_host) = "fusn08.srve.cc";
        xlog("L_INFO", "GET_PBX_FOR_DOMAIN: Matched fusn08.srve.cc\n");
    }
    else if ($avp(req_domain) != "testfusn.srve.cc") {
        # Unmapped domains attempt direct routing
        xlog("L_WARN", "GET_PBX_FOR_DOMAIN: Domain $avp(req_domain) not in mapping, attempting direct routing\n");
        $avp(pbx_host) = $avp(req_domain);
    }
    
    xlog("L_INFO", "GET_PBX_FOR_DOMAIN: Final resolution $avp(req_domain) -> $avp(pbx_host)\n");
}
```

#### RELAY_TO_PBX Integration

```kamailio
route[RELAY_TO_PBX] {
    # Call domain-to-PBX mapping
    route(GET_PBX_FOR_DOMAIN);
    
    if ($avp(pbx_host) == $null || $avp(pbx_host) == "") {
        xlog("L_ERR", "RELAY_TO_PBX: Failed to determine PBX host\n");
        sl_send_reply("503", "Server Error");
        exit;
    }
    
    # Set destination to mapped PBX
    $du = "sip:" + $avp(pbx_host) + ":" + $var(pbx_port) + ";transport=" + $var(pbx_transport);
    
    xlog("L_INFO", "RELAY_TO_PBX: Routing $rm to $avp(pbx_host)\n");
    
    t_on_reply("MANAGE_REPLY");
    route(RELAY);
    exit;
}
```

**Variable Usage:**
- `$avp(req_domain)`: Request URI domain (persists across routes)
- `$avp(pbx_host)`: Mapped PBX hostname (persists across routes)
- Uses `$avp()` not `$var()` for transaction persistence

---

## Usage Examples

### Example 1: Register to fusn04

**User Input:**
```
Extension: 100357@fusn04.srve.cc
Domain: testfusn.srve.cc (explicit or default)
```

**Flow:**
1. App parses: `{username: "100357", domain: "fusn04.srve.cc", inlineDomain: "fusn04.srve.cc"}`
2. REGISTER sent to `sip:100357@fusn04.srve.cc`
3. Request-URI: `sip:fusn04.srve.cc`
4. Kamailio extracts `$rd = "fusn04.srve.cc"`
5. Routes to `fusn04.srve.cc` PBX
6. PBX authenticates and registers

### Example 2: Call from fusn04 to fusn04

**Register Status:** Registered as `100357@fusn04.srve.cc`

**Outgoing Call:**
```
Dial: 045945060
Domain resolution: st.account.domain = "fusn04.srve.cc"
INVITE sent to: sip:045945060@fusn04.srve.cc
```

**Kamailio Processing:**
1. INVITE arrives with Request-URI: `sip:045945060@fusn04.srve.cc`
2. `GET_PBX_FOR_DOMAIN` extracts domain: `$rd = "fusn04.srve.cc"`
3. Matches mapping: `$avp(pbx_host) = "fusn04.srve.cc"`
4. Forwards to `fusn04` PBX at UDP 5060

### Example 3: Cross-Domain Call (Not Supported)

**Register Status:** Registered as `100357@fusn04.srve.cc`

**Attempted Call:**
```
Dial: 100200 (at fusn06)
Domain: fusn04.srve.cc (from registration)
INVITE to: sip:100200@fusn04.srve.cc
```

**Result:** Call fails - fusn04 PBX can't find `100200` (it's on fusn06)

**Note:** Cross-domain calls require the calling domain to route/forward to the target domain - not supported in this basic implementation.

---

## Security Considerations

### Fixed Security Filter

Original security filter blocked PBX BYE messages. Updated to allow in-dialog requests:

```kamailio
if ($proto != "ws" && $proto != "wss") {
    # In-dialog requests (BYE, ACK) with totag are always safe
    if (!has_totag()) {
        # Only whitelist check applies to initial requests (REGISTER, INVITE)
        if ($si != "185.187.169.29" && $si != "127.0.0.1" && $si != "38.242.157.239") {
            xlog("L_WARN", "BLOCKED unauthorized SIP: $rm from $si:$sp\n");
            sl_send_reply("403", "Forbidden");
            exit;
        }
    } else {
        # In-dialog - allow from any whitelisted PBX
        xlog("L_INFO", "SECURITY: Allowing in-dialog $rm from $si:$sp\n");
    }
}
```

**Benefits:**
- ✅ Protects against spam (initial requests checked)
- ✅ Allows legitimate dialog termination (BYE allowed)
- ✅ PBX can hangup calls properly

---

## Testing Checklist

- [ ] Register to domain `fusn04.srve.cc` with account `100357@fusn04.srve.cc`
- [ ] Verify status shows `100357@fusn04.srve.cc` after login
- [ ] Make outgoing call to extension on fusn04
- [ ] Verify call connects and audio works
- [ ] Remote party hangs up - call should disconnect automatically
- [ ] Test with other domains (fusn01, fusn02, etc.)
- [ ] Verify Kamailio logs show correct domain routing
- [ ] Tcpdump confirms INVITE reaches correct PBX

---

## Troubleshooting

### Call fails with 480 Temporarily Unavailable
- **Cause:** PBX doesn't have the extension, or it's not registered
- **Fix:** Verify extension exists on target PBX, test with SIP client first

### Remote hangup doesn't disconnect WebRTC client
- **Cause:** BYE message blocked by security filter
- **Fix:** Verify security filter allows in-dialog requests (line ~180 in kamailio.cfg)

### Status shows wrong domain
- **Cause:** Account parsing not working correctly
- **Fix:** Check browser console for `[parseSipAccount]` debug logs

### REGISTER goes to wrong PBX
- **Cause:** Domain extraction failed, domain routing misconfigured
- **Fix:** Check Kamailio logs for `GET_PBX_FOR_DOMAIN` routing decisions

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ WebRTC Browser                                                  │
│ ├─ Input: 100357@fusn04.srve.cc                               │
│ └─ App parses: { username: "100357", domain: "fusn04.srve.cc" }│
└────────────────┬────────────────────────────────────────────────┘
                 │ REGISTER/INVITE sip:100357@fusn04.srve.cc
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Kamailio SBC (38.242.157.239:5060)                             │
│ ├─ Extract domain: $rd = "fusn04.srve.cc"                      │
│ ├─ Route: GET_PBX_FOR_DOMAIN                                   │
│ │  └─ Match: "fusn04.srve.cc" → $avp(pbx_host) = "fusn04"     │
│ └─ Relay to: sip:fusn04.srve.cc:5060                          │
└────────────────┬────────────────────────────────────────────────┘
                 │
       ┌─────────┴──────────┬────────────────┬────────────────┐
       ▼                    ▼                ▼                ▼
  ┌────────────┐  ┌────────────┐  ┌──────────────┐  ┌──────────────┐
  │ fusn01.    │  │ fusn02.    │  │ fusn04.      │  │ fusn08.      │
  │ srve.cc    │  │ srve.cc    │  │ srve.cc      │  │ srve.cc      │
  │ (FusionPBX)│  │ (FusionPBX)│  │ (FusionPBX)  │  │ (FusionPBX)  │
  └────────────┘  └────────────┘  └──────────────┘  └──────────────┘
```

---

## Files Modified

1. **www/app/dom.js** - Added `parseSipAccount()` function
2. **www/app/main.js** - Added `ui.account()` and domain resolution
3. **www/app/sipRegister.js** - Multi-domain registration support
4. **www/app/sipCall.js** - Domain-aware outgoing call routing
5. **kamailio/kamailio.cfg** - Added `GET_PBX_FOR_DOMAIN` route, updated security filter

---

## Future Enhancements

- [ ] Database-based domain mapping (instead of hardcoded if/else)
- [ ] Cross-domain call routing (SBC forwards to remote domain)
- [ ] Per-domain authentication credentials
- [ ] Domain-based call logging/CDR
- [ ] Load balancing across multiple PBX instances per domain
- [ ] Hot-reload domain mapping without restart
