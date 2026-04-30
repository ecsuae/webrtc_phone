# FusionPBX Configuration for Incoming Calls via Kamailio

## Problem Summary

Your PBX is not routing incoming calls through Kamailio back to WebSocket clients. When an incoming call arrives for extension 100357, the PBX needs to route it through Kamailio (Path header), but it's not doing so.

---

## Solution: Configure FusionPBX to Route WebRTC Extensions via Kamillio

### Option 1: Use Gateway/Outbound Proxy (Recommended - Easiest)

This makes FusionPBX always route WebRTC extensions through Kamailio:

1. **SSH to your PBX server** (fusn04)

2. **Edit the internal SIP profile**:
```bash
nano /etc/freeswitch/sip_profiles/internal.xml
```

3. **Add this parameter** (in the `<settings>` section):
```xml
<param name="outbound-proxy" value="38.242.157.239:5060"/>
```

OR for WebRTC extensions only, add this to each WebRTC extension:

4. **Edit extension** via FusionPBX web interface:
   - Go to **Accounts → Extensions**
   - Edit extension 100357 (and any other WebRTC extensions)
   - In **Advanced** section, add:
     - **Outbound Proxy**: `38.242.157.239:5060`
   - Save

5. **Restart FreeSWITCH**:
```bash
systemctl restart freeswitch
```

---

### Option 2: Enable Path Support (More Complex)

FusionPBX/FreeSWITCH can be configured to honor Path headers:

1. **Edit internal SIP profile**:
```bash
nano /etc/freeswitch/sip_profiles/internal.xml
```

2. **Add/modify these parameters**:
```xml
<!-- Enable path support (RFC 3327) -->
<param name="enable-rfc-5626" value="true"/>
<param name="manage-presence" value="true"/>

<!-- Force registration domain -->
<param name="force-register-domain" value="fusn04.srve.cc"/>
<param name="force-register-db-domain" value="fusn04.srve.cc"/>
```

3. **Restart FreeSWITCH**:
```bash
fs_cli -x "reload mod_sofia"
# OR
systemctl restart freeswitch
```

---

### Option 3: Use Kamailio as Primary Registrar (Most Robust)

Instead of having clients register to PBX, have them register to Kamailio, and Kamailio handles all call routing:

1. **Requires significant configuration changes** - Not recommended for quick fix

---

## Testing After Configuration

### Test 1: Verify Extension Registration

On PBX server:
```bash
fs_cli -x "sofia status profile internal reg"
```

Look for extension 100357. You should see its Contact address pointing through Kamailio path or routed appropriately.

### Test 2: Make Test Incoming Call

1. **Start monitoring on BOTH servers**:

**On Kamailio server (Fusn06)**:
```bash
docker logs kamailio -f --tail 0 2>&1 | grep -i "INCOMING.*100357\|INVITE.*100357"
```

**On PBX server (Fusn04)**:
```bash
tcpdump -ni any host 38.242.157.239 and udp port 5060 -A | grep -B5 -A20 "INVITE.*100357"
```

2. **Make a call TO extension 100357** (call its DID or call it from another extension)

3. **Expected logs**:

**Kamailio should show**:
```
[INCOMING] ========== CASE: INCOMING FROM PBX ==========
[INCOMING] PBX call via udp: FROM=CALLER TO=100357
[INCOMING] ✅ FOUND via Method 1
[INCOMING] ✅ Successfully relayed to WebSocket client
```

**PBX tcpdump should show**: INVITE going FROM PBX (85.235.64.159) TO Kamailio (38.242.157.239) with To: header containing 100357.

---

## Quick Diagnostic Commands

### On PBX (Fusn04):

```bash
# Check if Path support is enabled
fs_cli -x "sofia status profile internal" | grep -i "path\|rfc-5626"

# Check specific extension registration
fs_cli -x "sofia status profile internal reg" | grep -A10 "100357"

# Monitor incoming call routing
fs_cli -x "console loglevel debug"
fs_cli  # then watch logs when call comes in
```

### On Kamailio (Fusn06):

```bash
# Check if extension is in location table
docker exec kamailio kamctl ul show | grep 100357

# Monitor for any traffic from PBX
docker logs kamailio -f | grep "185.187.169.29"
```

---

## Why This Is Needed

When extension 100357 registers via WebSocket through Kamailio:
1. Kamailio adds `Path: <sip:38.242.157.239:5060;lr>` header
2. This tells PBX: "To reach this extension, route through 38.242.157.239"
3. **BUT** FreeSWITCH doesn't honor Path by default
4. So PBX tries to reach WebSocket directly (fails silently)

**Solution**: Configure PBX to route through Kamailio (outbound-proxy or enable RFC 5626).

---

## Alternative: Dual Registration (Not Recommended)

Have extensions register TWICE:
- Once to PBX (for outgoing calls)
- Once to Kamailio (for incoming calls)

This is complex and creates other issues. Not recommended.

---

## Next Steps

1. Try Option 1 first (outbound-proxy) - easiest
2. Test incoming calls
3. If not working, check PBX logs for routing decisions
4. May need to look at FusionPBX dialplan to see how it routes calls to extensions
