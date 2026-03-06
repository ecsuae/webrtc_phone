export function candType(candidate) {
  const m = candidate?.match(/\btyp\s(\w+)/);
  return m ? m[1] : "unknown";
}

export function short(candidate) {
  return candidate && candidate.length > 140 ? `${candidate.slice(0, 140)}...` : (candidate || "");
}
