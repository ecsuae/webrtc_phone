# FusionPBX SIP Profile Fix - Step by Step

## Problem
FusionPBX rejects calls with "no suitable candidates found" because WebRTC relay candidates use internal Docker IP (172.18.0.2) that FusionPBX can't reach.

## Solution
Modify FusionPBX internal SIP profile to accept relay candidates from Docker network.

---

## Step 1: SSH to FusionPBX Server

```bash
ssh root@testfusn.srve.cc
# Enter password when prompted
```

---

## Step 2: Locate the Internal SIP Profile

The file should be at:
```bash
/etc/freeswitch/sip_profiles/internal.xml
```

Verify it exists:
```bash
ls -la /etc/freeswitch/sip_profiles/internal.xml
```

If not found, search for it:
```bash
find / -name "internal.xml" -type f 2>/dev/null
```

---

## Step 3: Backup the Original File

```bash
cp /etc/freeswitch/sip_profiles/internal.xml \
   /etc/freeswitch/sip_profiles/internal.xml.backup
```

Verify backup:
```bash
ls -la /etc/freeswitch/sip_profiles/internal.xml.backup
```

---

## Step 4: Edit the File

Open with nano:
```bash
nano /etc/freeswitch/sip_profiles/internal.xml
```

Or use vi:
```bash
vi /etc/freeswitch/sip_profiles/internal.xml
```

---

## Step 5: Find the Profile Section

Look for a section like:
```xml
<profile name="internal">
  <domains>
    <!-- ... domains ... -->
  </domains>
  <settings>
    <!-- ... parameters ... -->
  </settings>
</profile>
```

The parameters section looks like:
```xml
<settings>
  <param name="..."/>
  <param name="..."/>
</settings>
```

---

## Step 6: Add the Fix

Inside the `<settings>` section, ADD this line:

```xml
<param name="force-candidate-acl" value=""/>
```

**Complete example:**
```xml
<profile name="internal">
  <domains>
    <domain name="all" alias="true" parse="true"/>
  </domains>
  <settings>
    <!-- ... existing params ... -->
    
    <!-- FIX: Accept relay candidates from WebRTC/Docker -->
    <param name="force-candidate-acl" value=""/>
    
    <!-- ... more params ... -->
  </settings>
</profile>
```

---

## Step 7: Save the File

If using nano:
- Press: `Ctrl+O` (save)
- Press: `Enter` (confirm)
- Press: `Ctrl+X` (exit)

If using vi:
- Press: `Esc`
- Type: `:wq` (save and quit)
- Press: `Enter`

---

## Step 8: Verify the Change

```bash
grep "force-candidate-acl" /etc/freeswitch/sip_profiles/internal.xml
```

Should show:
```
<param name="force-candidate-acl" value=""/>
```

---

## Step 9: Restart FreeSWITCH

### Option A: Using FreeSwitch Commands
```bash
cd /opt/freeswitch
bin/freeswitch -stop
sleep 2
bin/freeswitch -nc &
```

### Option B: Using Systemd (if installed)
```bash
systemctl restart freeswitch
```

### Option C: Kill and Restart
```bash
pkill -f freeswitch
sleep 2
/opt/freeswitch/bin/freeswitch -nc &
```

---

## Step 10: Verify FreeSWITCH is Running

```bash
ps aux | grep freeswitch | grep -v grep
```

Should show freeswitch process running.

Or check:
```bash
netstat -tln | grep 5060
```

Should show port 5060 listening.

---

## Step 11: Test Registration Again

1. Go to: https://phone.srve.cc/
2. Register with:
   - Extension: 900900
   - Domain: testfusn.srve.cc
   - Password: (your password)
3. Should show "Registered" ✅

---

## Step 12: Test a Call

1. Stay registered
2. Dial any number (e.g., 096045945060)
3. **Call should now connect** ✅
4. Audio should work via CoTURN relay ✅

---

## Troubleshooting

### If registration fails after restart

Check FreeSwitch logs:
```bash
tail -f /var/log/freeswitch/freeswitch.log
```

Look for errors related to the SIP profile.

### If call still fails

Check FreeSwitch console:
```bash
fs_cli
> fsctl loglevel debug
```

Make a test call and check the logs.

### If you need to rollback

```bash
cp /etc/freeswitch/sip_profiles/internal.xml.backup \
   /etc/freeswitch/sip_profiles/internal.xml
systemctl restart freeswitch
```

---

## What This Parameter Does

`<param name="force-candidate-acl" value=""/>`

- Empty value (`""`) = Accept candidates from ANY source
- This allows WebRTC relay candidates (172.18.0.x) to be used
- Without this, FusionPBX filters candidates and rejects relay-only candidates

---

## Expected Result

After this fix:
- ✅ WebRTC client sends relay candidates
- ✅ FusionPBX accepts them
- ✅ Media flows via CoTURN
- ✅ Calls connect and work
- ✅ Audio quality depends on network latency

---

**DO THIS NOW on FusionPBX server to fix the call issue!**

