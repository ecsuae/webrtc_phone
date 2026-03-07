export const MAX_LOGS_PER_BATCH = 100;
export const SEND_INTERVAL = 60000; // Send every 60 seconds
export const METADATA_SEND_INTERVAL = 300000; // Send metadata every 5 minutes

export const state = {
  logBuffer: [],
  sendTimer: null,
  metadataTimer: null,
  debugMode: false,
  currentUsername: null,
  deviceId: null,
  browserId: null,
  lifecycleEventsBound: false,
};
