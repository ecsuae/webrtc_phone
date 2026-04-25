'use strict';

function attachAdminProvisioningCreateAccountRoute(
  router,
  {
    requireWireGuardAccess,
    hashPin,
    findProvisioningAccountById,
    upsertProvisioningAccount,
    sanitizeProvisioningAccountForAdmin,
  }
) {
  router.post('/provisioning/account/create', requireWireGuardAccess, (req, res) => {
    const errors = [];
    const provisioningId = typeof req.body?.provisioning_id === 'string' ? req.body.provisioning_id.trim() : '';
    const pin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
    const label = typeof req.body?.label === 'string' ? req.body.label.trim() : '';
    const internalLabel = typeof req.body?.internal_label === 'string' ? req.body.internal_label.trim() : '';
    const sipUsername = typeof req.body?.sip_username === 'string' ? req.body.sip_username.trim() : '';
    const sipPass = typeof req.body?.sip_password === 'string' ? req.body.sip_password : '';
    const sipDomain = typeof req.body?.sip_domain === 'string' ? req.body.sip_domain.trim() : '';
    const websocketUrl = typeof req.body?.websocket_url === 'string' ? req.body.websocket_url.trim() : '';
    const maxDevices = Number(req.body?.max_devices);
    const enabled = req.body?.enabled;
    const autoProvisionEnabled = req.body?.auto_provision_enabled;

    if (!provisioningId) errors.push('provisioning_id is required');
    if (provisioningId && !/^[0-9]+$/.test(provisioningId)) errors.push('provisioning_id must be numeric');
    if (provisioningId && provisioningId.length !== 8) errors.push('provisioning_id must be exactly 8 digits');

    if (!pin) errors.push('pin is required');
    if (pin && !/^[0-9]+$/.test(pin)) errors.push('pin must be numeric');
    if (pin && pin.length !== 4) errors.push('pin must be exactly 4 digits');

    if (!sipUsername) errors.push('sip_username is required');
    if (!sipPass) errors.push('sip_password is required');
    if (sipPass && sipPass.length < 6) errors.push('sip_password must be at least 6 characters');
    if (!sipDomain) errors.push('sip_domain is required');
    if (!websocketUrl) errors.push('websocket_url is required');

    if (!Number.isInteger(maxDevices) || maxDevices < 1) errors.push('max_devices must be an integer >= 1');
    if (enabled !== undefined && typeof enabled !== 'boolean') errors.push('enabled must be boolean');
    if (autoProvisionEnabled !== undefined && typeof autoProvisionEnabled !== 'boolean')
      errors.push('auto_provision_enabled must be boolean');

    if (errors.length > 0) return res.status(400).json({ ok: false, errors });

    const existing = findProvisioningAccountById(provisioningId);
    if (existing) {
      return res.status(409).json({ ok: false, errors: ['provisioning_id already exists'] });
    }

    const pepper = String(process.env.PROVISIONING_PIN_PEPPER || '').trim();
    if (!pepper) {
      return res
        .status(500)
        .json({ ok: false, error_code: 'SERVER_MISCONFIGURED', errors: ['PROVISIONING_PIN_PEPPER is not set'] });
    }

    const pin_hash = hashPin(pin, pepper);
    const account = {
      provisioning_id: provisioningId,
      provisioning_pin: pin,
      pin_hash,
      label,
      internal_label: internalLabel,
      enabled: enabled !== false,
      auto_provision_enabled: autoProvisionEnabled !== false,
      max_devices: maxDevices,
      sip_username: sipUsername,
      sip_password: sipPass,
      sip_domain: sipDomain,
      websocket_url: websocketUrl,
      transport: 'wss',
    };

    const r = upsertProvisioningAccount(account);
    if (!r?.ok) return res.status(500).json({ ok: false, errors: [r?.error || 'create-failed'] });

    const created = findProvisioningAccountById(provisioningId);
    return res.status(201).json({ ok: true, account: sanitizeProvisioningAccountForAdmin(created) });
  });
}

module.exports = { attachAdminProvisioningCreateAccountRoute };
