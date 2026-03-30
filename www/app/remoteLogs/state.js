export const MAX_LOGS_PER_BATCH = 5000;
export const SEND_INTERVAL = 45000; // Send every 45 seconds
export const METADATA_SEND_INTERVAL = 60000; // Send metadata every 60 seconds

export const state = {
  logBuffer: [],
  sendTimer: null,
  metadataTimer: null,
  debugMode: false,
  batchId: null,
  currentUsername: null,
  deviceId: null,
  browserId: null,
  lifecycleEventsBound: false,
  _probe: {
    lastBufferProbeTs: 0,
    lastTimerProbeTs: 0,
    lastSendProbeTs: 0,
  },
};
