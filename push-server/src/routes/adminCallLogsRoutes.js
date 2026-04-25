'use strict';

const { queryEvents, getStats } = require('../services/callLogStore');
const { renderCallLogPage } = require('../admin/callLogPage');
const {
  attachLatestCallerExportRoutes,
  attachLatestCallerReceiverExportRoutes,
} = require('./adminCallLogExportRoutes');
const { attachAdminCallLogsExportRoutes } = require('./adminCallLogsExportRoutes');

function attachAdminCallLogsRoutes(router, { requireWireGuardAccess }) {
  // ---------------------------------------------------------------------------
  // Call media log filter page
  // ---------------------------------------------------------------------------
  router.get('/calllogs', requireWireGuardAccess, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const filter = {
      view: req.query.view || '',
      includeSession: req.query.includeSession === '1',
      exportCaller: req.query.exportCaller || '',
      exportReceiver: req.query.exportReceiver || '',
      caller: req.query.caller || '',
      receiver: req.query.receiver || '',
      username: req.query.username || '',
      domain: req.query.domain || '',
      aor: req.query.aor || '',
      dir: req.query.dir || '',
      mode: req.query.mode || '',
      profile: req.query.profile || req.query.mode || '',
      callId: req.query.callId || '',
      corrId: req.query.corrId || '',
      type: req.query.type || '',
      lteOnly: req.query.lteOnly === '1',
      errorsOnly: req.query.errorsOnly === '1',
    };
    const events = queryEvents({
      aor: filter.aor || undefined,
      username: filter.username || undefined,
      domain: filter.domain || undefined,
      caller: filter.caller || undefined,
      receiver: filter.receiver || undefined,
      callId: filter.callId || undefined,
      corrId: filter.corrId || undefined,
      type: filter.type || undefined,
      dir: filter.dir || undefined,
      mode: filter.mode || undefined,
      profile: filter.profile || undefined,
      lteOnly: filter.lteOnly || undefined,
      errorsOnly: filter.errorsOnly || undefined,
      limit: 200,
    });
    const stats = getStats();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderCallLogPage(events, stats, filter));
  });

  attachLatestCallerExportRoutes(router, { queryEvents, requireWireGuardAccess });
  attachLatestCallerReceiverExportRoutes(router, { queryEvents, requireWireGuardAccess });

  attachAdminCallLogsExportRoutes(router, { queryEvents, requireWireGuardAccess });

  // JSON API for call log events (for scripted access)
  router.get('/calllogs/json', requireWireGuardAccess, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const filter = {
      view: req.query.view || undefined,
      includeSession: req.query.includeSession === '1' || undefined,
      aor: req.query.aor || undefined,
      username: req.query.username || undefined,
      domain: req.query.domain || undefined,
      callId: req.query.callId || undefined,
      corrId: req.query.corrId || undefined,
      type: req.query.type || undefined,
      dir: req.query.dir || undefined,
      mode: req.query.mode || undefined,
      profile: req.query.profile || req.query.mode || undefined,
      lteOnly: req.query.lteOnly === '1' || undefined,
      errorsOnly: req.query.errorsOnly === '1' || undefined,
      limit: Math.min(Number(req.query.limit) || 200, 500),
    };
    res.json({ stats: getStats(), events: queryEvents(filter) });
  });
}

module.exports = { attachAdminCallLogsRoutes };
