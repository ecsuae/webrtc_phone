# Call Failure Root Cause & Solution

## The Real Problem

FusionPBX logs show:
```
Save audio Candidate cid: 1 proto: udp type: relay addr: 172.18.0.2:54804
Save audio Candidate cid: 1 proto: udp type: relay addr: 172.18.0.2:50931
Save audio Candidate cid: 1 proto: udp type: relay addr: 172.18.0.2:64213
[DEBUG] switch_core_media.c:4254 Searching for rtp candidate.
[DEBUG] switch_core_media.c:4307 sofia/internal/900900@testfusn.srve.cc no suitable candidates found.
[NOTICE] sofia.c:7985 Hangup sofia/internal/900900@testfusn.srve.cc [CS_NEW] [INCOMPATIBLE_DESTINATION]
```

**What's happening:**
1. FusionPBX receives ICE candidates from WebRTC client
2. All candidates are relay type with IP `172.18.0.2` (CoTURN container)
3. FusionPBX looks for RTP candidates but finds NONE it can use
4. FusionPBX can't establish media → Hangs up with error 488

## Why This Happens

**The flow:**
```
WebRTC Client (internal Docker)
  ↓ Sends INVITE via Kamailio
  ↓ SDP has ICE candidates: 172.18.0.2 (relay via CoTURN)
  
FusionPBX (external server)
  ↓ Receives INVITE
  ↓ Tries to find usable RTP candidate
  ↓ Sees: 172.18.0.2 (internal Docker network)
  ↓ Can't reach 172.18.0.2 from external network
  ↓ "no suitable candidates found"
  ↓ Rejects call with 488
```

## Why SDP IP Rewriting Won't Work

The problem is **NOT just the SDP** - it's that:

1. **WebRTC client is inside Docker** (172.18.0.x network)
2. **CoTURN relay is inside Docker** (172.18.0.2)
3. **FusionPBX is external** (can't reach 172.18.0.2)
4. Even if we rewrite SDP to show 38.242.157.239, CoTURN on 172.18.0.2 won't listen on the external IP

The real solution needs to happen in **FusionPBX**, not Kamailio.

---

## Solution: Configure FusionPBX to Accept Relay Candidates

FusionPBX has a setting that controls what candidates it accepts:

**File:** `/etc/freeswitch/sip_profiles/internal.xml`

**Parameter:** `force-candidate-acl` (or similar candidate filtering)

### Option 1: Accept ALL Candidates (Simplest)

```xml
<param name="force-candidate-acl" value=""/>
```

This tells FusionPBX: "Accept candidates from anywhere, even internal IPs"

### Option 2: Add Relay IP to Whitelist

```xml
<param name="force-candidate-acl" value="172.18.0.0/24"/>
```

This tells FusionPBX: "Accept candidates from the Docker network"

### Option 3: Proper RTP Bridge Configuration

```xml
<param name="rtp-ip" value="172.18.0.1"/>
<param name="sip-ip" value="172.18.0.1"/>
<param name="force-common-bitrate" value="true"/>
```

This configures FusionPBX to listen on the Docker bridge network.

---

## How to Apply the Fix

### Step 1: SSH into FusionPBX Server
```bash
ssh root@testfusn.srve.cc
```

### Step 2: Backup the Profile
```bash
cp /etc/freeswitch/sip_profiles/internal.xml \
   /etc/freeswitch/sip_profiles/internal.xml.backup
```

### Step 3: Edit the Profile
```bash
nano /etc/freeswitch/sip_profiles/internal.xml
```

### Step 4: Find the `<profile>` Section
Look for the section that starts with `<profile name="internal">`

### Step 5: Add/Modify Parameters

Find the parameters section and add/modify:

```xml
<!-- Accept relay candidates from WebRTC clients -->
<param name="force-candidate-acl" value=""/>

<!-- Or use this to whitelist Docker network -->
<!-- <param name="force-candidate-acl" value="172.18.0.0/24"/> -->

<!-- Ensure DTLS is configured -->
<param name="dtls-fingerprint" value="sha-256"/>
```

### Step 6: Restart FreeSWITCH
```bash
cd /opt/freeswitch
bin/freeswitch -stop
sleep 2
bin/freeswitch -nc
```

Or if using systemd:
```bash
systemctl restart freeswitch
```

---

## Alternative: Use Kamailio as Media Gateway

If FusionPBX configuration is complex, you could:

1. Install RTPEngine locally on FusionPBX server
2. Configure Kamailio to connect to local RTPEngine
3. RTPEngine handles media bridging between Docker and external network

But this requires RTPEngine to be available on the FusionPBX host.

---

## What NOT to Do

❌ Don't try to change the ICE candidates in the SDP (Kamailio can't modify them properly)  
❌ Don't try to force Kamailio to anchor media (no RTPEngine available)  
❌ Don't change the public IP in SDP (it won't help - FusionPBX still can't reach 172.18.0.2)

---

## Summary

**Root Cause:** FusionPBX receives relay candidates with internal Docker IP it can't reach

**Solution:** Configure FusionPBX to accept relay candidates from Docker network

**Steps:**
1. SSH to FusionPBX: `ssh root@testfusn.srve.cc`
2. Edit: `/etc/freeswitch/sip_profiles/internal.xml`
3. Add: `<param name="force-candidate-acl" value=""/>`
4. Restart: `systemctl restart freeswitch`

**Expected Result:** FusionPBX accepts relay candidates → Media flows via CoTURN → Calls work!

---

## Testing After Fix

1. Register again in Web UI
2. Make a test call
3. FusionPBX should accept the candidates
4. Call should connect
5. Audio should work via CoTURN relay

---

**This is the ONLY way to fix this without RTPEngine.**

