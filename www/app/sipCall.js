// www/app/sipCall.js
// Compatibility facade for call modules split into small feature files.

export { startCall, hangupCall } from "./outgoing/call.js";

// Deprecated incoming exports kept for compatibility with older imports.
export {
  handleIncomingCallIsolated as handleIncomingCall,
  answerIncomingCallIsolated as answerIncomingCall,
  rejectIncomingCallIsolated as rejectIncomingCall,
} from "./sipCallIncoming.js";
