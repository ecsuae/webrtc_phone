/* app.js
 * WebPhone (SIP.js 0.21.x)
 * - Register via WSS (Kamailio) -> FusionPBX
 * - Outbound calling (Inviter)
 * - Logs transport + registerer + ICE candidates + selected pair
 *
 * NOTE ABOUT YOUR ONE-SIDED-AUDIO:
 * - Use FORCE_RELAY = true for one test call.
 *   If 2-way audio works with FORCE_RELAY, then it’s ICE/NAT selection.
 *
 * Expected HTML IDs:
 *  #ext       (input)
 *  #domain    (input)
 *  #pass      (input)
 *  #wsshost   (input) optional, defaults from data-wss-host or window.location
 *  #dial      (input) destination
 *  #btnStart  (button)
 *  #btnStop   (button) optional
 *  #btnCall   (button)
 *  #btnHangup (button)
 *  #status    (span/div)
 *  #tstatus   (span/div)
 *  #remoteAudio (audio element)
 *  #log       (pre/div) optional
 */

<script type="module" src="/app/main.js"></script>