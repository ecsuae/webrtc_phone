import { createDesktopHistoryActivityStore } from "./ext/desktopHistoryActivityStore.js";
import { bindAndRenderDesktopHistoryActivity } from "./ext/desktopHistoryActivityRender.js";

export function createDesktopHistoryActivity(options = {}) {
  const storageKey = "callHistoryV2";
  const historyDays = Number(options.historyDays || 10);
  const onDial = typeof options.onDial === "function" ? options.onDial : () => {};

  const store = createDesktopHistoryActivityStore({ storageKey, historyDays });
  const calls = store.calls;

  function render() {
    bindAndRenderDesktopHistoryActivity({ calls, onDial });
  }

  function addCall(number, type = "outgoing", duration = 0, meta = {}) {
    store.addCall(number, type, duration, meta);
    render();
  }

  function load() {
    store.load();
  }

  function save() {
    store.save();
  }

  load();
  setTimeout(() => {
    render();
  }, 0);

  return { calls, addCall, render, load, save, historyDays };
}
