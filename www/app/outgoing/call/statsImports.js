import { getRuntimeCb } from "./runtimeCb.js";

let _pcStats = null;
let _pcStatsImport = null;
let _stats = null;
let _statsImport = null;

export function loadPcStats() {
  if (_stats) return Promise.resolve(_stats);
  if (_statsImport) return _statsImport;

  const cb = getRuntimeCb();
  const url = cb ? `../../pc/stats.js?cb=${encodeURIComponent(cb)}` : "../../pc/stats.js";
  _statsImport = import(url)
    .then((m) => {
      _stats = m;
      return m;
    })
    .catch((err) => {
      _statsImport = null;
      throw err;
    });

  return _statsImport;
}

export function loadPcStatsForDiag() {
  if (_pcStats) return Promise.resolve(_pcStats);
  if (_pcStatsImport) return _pcStatsImport;

  const cb = getRuntimeCb();
  const url = cb ? `../../pc/stats.js?cb=${encodeURIComponent(cb)}` : "../../pc/stats.js";
  _pcStatsImport = import(url)
    .then((m) => {
      _pcStats = m;
      return m;
    })
    .catch(() => null);

  return _pcStatsImport;
}
