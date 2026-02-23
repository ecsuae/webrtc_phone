// www/app/sdp.js
import { G711_CODECS, G711_ONLY } from "./config.js";

function filterSdpToG711(sdp) {
  if (!sdp || typeof sdp !== "string") return sdp;
  const lines = sdp.split(/\r\n/);
  const mIdx = [];
  for (let i = 0; i < lines.length; i++) if (lines[i].startsWith("m=")) mIdx.push(i);

  const audioIndex = mIdx.find((i) => lines[i].startsWith("m=audio "));
  if (audioIndex === undefined) return sdp;

  const audioEnd = mIdx.find((i) => i > audioIndex) ?? lines.length;
  const audioLines = lines.slice(audioIndex, audioEnd);

  const allowed = new Set();
  for (const line of audioLines) {
    if (!line.startsWith("a=rtpmap:")) continue;
    const [pt, rest] = line.slice(9).split(" ");
    const codec = (rest || "").split("/")[0].toLowerCase();
    if (G711_CODECS.has(codec)) allowed.add(pt);
  }
  if (!allowed.size) return sdp;

  const mParts = audioLines[0].split(" ");
  const prefix = mParts.slice(0, 3);
  const newPts = mParts.slice(3).filter((pt) => allowed.has(pt));
  if (!newPts.length) return sdp;

  const outAudio = [[...prefix, ...newPts].join(" ")];
  for (let i = 1; i < audioLines.length; i++) {
    const line = audioLines[i];
    if (line.startsWith("a=rtpmap:")) {
      const pt = line.slice(9).split(" ")[0];
      if (allowed.has(pt)) outAudio.push(line);
      continue;
    }
    if (line.startsWith("a=fmtp:") || line.startsWith("a=rtcp-fb:")) {
      const pt = line.split(":")[1]?.split(" ")[0];
      if (pt && allowed.has(pt)) outAudio.push(line);
      continue;
    }
    outAudio.push(line);
  }

  return [...lines.slice(0, audioIndex), ...outAudio, ...lines.slice(audioEnd)].join("\r\n");
}

export function g711OnlyModifier(sessionDescription) {
  if (!G711_ONLY || !sessionDescription?.sdp) return sessionDescription;
  return Promise.resolve({
    type: sessionDescription.type,
    sdp: filterSdpToG711(sessionDescription.sdp),
  });
}