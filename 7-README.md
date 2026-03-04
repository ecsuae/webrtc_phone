# Multiple Domains Support - Quick Reference

**Status:** ✅ Implemented & Tested  
**Last Updated:** 2026-03-04

## What's New

Support for **8 different FusionPBX backend domains** from a single WebRTC SBC:

```
fusn01.srve.cc → fusn01 PBX
fusn02.srve.cc → fusn02 PBX
fusn03.srve.cc → fusn03 PBX
fusn04.srve.cc → fusn04 PBX  (tested ✅)
fusn05.srve.cc → fusn05 PBX
fusn06.srve.cc → fusn06 PBX
fusn07.srve.cc → fusn07 PBX
fusn08.srve.cc → fusn08 PBX
testfusn.srve.cc → default fallback
```

## How to Use

### Registration to Specific Domain

**Format:** `username@domain`

**Example:** Register `100357@fusn04.srve.cc`

1. Open WebRTC phone in browser
2. Enter Extension: `100357@fusn04.srve.cc`
3. Leave Domain field blank (or use default)
4. Click **Register**
5. Status updates to show `100357@fusn04.srve.cc` ✅

### Making Calls

Once registered to a domain:
- All outgoing calls automatically route through that domain's PBX
- Example: Registered to `fusn04.srve.cc`, dialing `045945060` routes to fusn04

### Remote Hangup

✅ When the remote party hangs up, your WebRTC call disconnects automatically

## Key Features

### ✅ Account Parsing
- Extracts domain from `user@domain` format
- Falls back to explicit domain field
- Final fallback to environment default (testfusn.srve.cc)

### ✅ Registration Support
- REGISTER sent to correct domain
- Authentication uses extension only (not full address)
- Status displays resolved account

### ✅ Call Routing
- Outgoing calls use registered domain
- Request-URI correctly set to `user@domain`
- Kamailio routes based on domain extraction

### ✅ PBX Routing
- GET_PBX_FOR_DOMAIN route maps domains to PBX servers
- Uses $avp() variables for transaction persistence
- Direct routing for unmapped domains

### ✅ BYE Handling
- Security filter updated to allow in-dialog requests
- PBX can properly terminate calls
- WebRTC client receives BYE and disconnects

## Architecture Flow

```
WebRTC Browser
    ↓
    [Parse: 100357@fusn04.srve.cc]
    ↓
Kamailio SBC
    ↓
    [Extract domain: fusn04.srve.cc]
    ↓
    [GET_PBX_FOR_DOMAIN Route]
    ↓
    [Map: fusn04.srve.cc → fusn04 PBX]
    ↓
FusionPBX (fusn04.srve.cc)
```

## Files Changed

| File | Change |
|------|--------|
| `www/app/dom.js` | Added `parseSipAccount()` |
| `www/app/main.js` | Added `ui.account()` and domain fallback |
| `www/app/sipRegister.js` | Multi-domain registration |
| `www/app/sipCall.js` | Domain-aware call routing |
| `kamailio/kamailio.cfg` | GET_PBX_FOR_DOMAIN route + security fix |

## Testing Results

### ✅ Test 1: Registration to fusn04
- **Status:** PASS
- **Result:** Successfully registered `100357@fusn04.srve.cc`
- **Evidence:** Status display shows domain correctly

### ✅ Test 2: Outgoing Call
- **Status:** PASS
- **Result:** Call to `045945060@fusn04` connects successfully
- **Evidence:** Audio works, call state shows Established

### ✅ Test 3: Remote Hangup
- **Status:** PASS (after security fix)
- **Result:** Call disconnects when remote party hangs up
- **Evidence:** BYE message properly routed to browser, call ends

### ✅ Test 4: SDP Compatibility
- **Status:** PASS
- **Result:** FreeSWITCH accepts WebRTC SDP with proper RTPEngine conversion
- **Evidence:** No 480 errors after fixing domain routing

## Troubleshooting

### "480 Temporarily Unavailable"
- Verify extension exists on target PBX
- Test with standard SIP client first
- Check domain routing logs in Kamailio

### "Call doesn't disconnect on remote hangup"
- Verify Kamailio security filter allows in-dialog requests
- Check logs for BYE blocking messages
- Current code: Line ~180 in kamailio.cfg should have `!has_totag()` check

### "Wrong domain in status"
- Check browser console for `[parseSipAccount] raw=...` debug logs
- Verify username field contains `user@domain` format
- Inspect parsed domain in logs

## Configuration Details

### Add New Domain

To support a 9th domain, edit `kamailio/kamailio.cfg` route `[GET_PBX_FOR_DOMAIN]`:

```kamailio
else if ($avp(req_domain) == "fusn09.srve.cc") {
    $avp(pbx_host) = "fusn09.srve.cc";
    xlog("L_INFO", "GET_PBX_FOR_DOMAIN: Matched fusn09.srve.cc\n");
}
```

Then restart Kamailio:
```bash
cd /opt/webrtc-sbc
docker-compose restart kamailio
```

### Debug Routing

Watch domain routing in real-time:

```bash
# On SBC server:
docker-compose logs -f kamailio 2>&1 | grep GET_PBX_FOR_DOMAIN

# On PBX server (where calls arrive):
tcpdump -ni any host 38.242.157.239 and udp port 5060 -A
```

## Performance Notes

- Domain mapping uses `$avp()` variables (persist across routes)
- Lookup is O(n) with if/else chain (8 domains)
- For >20 domains, consider database lookup instead
- No noticeable latency for typical call volumes

## Compliance

- ✅ RFC 3261 compliant (standard SIP routing)
- ✅ RFC 3327 Path header support for WebSocket
- ✅ Proper Record-Route for dialog tracking
- ✅ Transaction-safe variable handling

## See Also

- [7-MULTIPLE_DOMAINS.md](7-MULTIPLE_DOMAINS.md) - Detailed technical documentation
- [5-RBT_SPECIAL_CHARACTERS_FIX.md](5-RBT_SPECIAL_CHARACTERS_FIX.md) - SDP/RTPEngine tuning
- [2-OUTGOING_FIX.md](2-OUTGOING_FIX.md) - In-dialog routing details
