// www/app/sipCallIncoming.js
// Thin compatibility layer to keep imports stable while incoming logic is split
// into small feature modules under ./incoming/.

export {
  handleIncomingCallIsolated,
  answerIncomingCallIsolated,
  rejectIncomingCallIsolated,
  setRegistrationComplete,
} from "./incoming/handlers.js";
