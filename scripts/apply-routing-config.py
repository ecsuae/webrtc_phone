#!/usr/bin/env python3
"""
apply-routing-config.py
Reads routing-config.json and updates PBX_MAP_* and TRUSTED_SIP_* entries in .env.
Called by `make routing-apply`. Writes back to .env in-place; all other entries preserved.

Usage: python3 scripts/apply-routing-config.py
"""

import json
import os
import sys
import re
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(ROOT, 'routing-config.json')
ENV_PATH = os.path.join(ROOT, '.env')

# Keys managed by routing-config (N = 1..8)
MANAGED_KEYS = set()
for n in range(1, 9):
    MANAGED_KEYS.add(f'PBX_MAP_{n}_DOMAIN')
    MANAGED_KEYS.add(f'PBX_MAP_{n}_HOST')
    MANAGED_KEYS.add(f'TRUSTED_SIP_IP_{n}')
    MANAGED_KEYS.add(f'TRUSTED_SIP_DOMAIN_{n}')


def load_routing_config():
    if not os.path.exists(CONFIG_PATH):
        print(f'ERROR: {CONFIG_PATH} not found. Save a config from the admin UI first.')
        sys.exit(1)
    with open(CONFIG_PATH) as f:
        cfg = json.load(f)
    pbx = cfg.get('pbxMappings', [])
    ips = cfg.get('trustedIps', [])
    doms = cfg.get('trustedDomains', [])
    if len(pbx) > 8 or len(ips) > 8 or len(doms) > 8:
        print('ERROR: routing-config.json exceeds 8-slot limit — truncating to 8 entries each.')
        pbx, ips, doms = pbx[:8], ips[:8], doms[:8]
    return pbx, ips, doms


def build_new_values(pbx, ips, doms):
    """Build dict of all managed keys with their new values."""
    vals = {}
    for n in range(1, 9):
        idx = n - 1
        vals[f'PBX_MAP_{n}_DOMAIN'] = pbx[idx]['domain'] if idx < len(pbx) else ''
        vals[f'PBX_MAP_{n}_HOST']   = pbx[idx]['host']   if idx < len(pbx) else ''
        vals[f'TRUSTED_SIP_IP_{n}'] = ips[idx]['ip']     if idx < len(ips) else ''
        vals[f'TRUSTED_SIP_DOMAIN_{n}'] = doms[idx]['domain'] if idx < len(doms) else ''
    return vals


def rewrite_env(new_values):
    """Rewrite .env, replacing managed key lines with new values."""
    if not os.path.exists(ENV_PATH):
        print(f'ERROR: {ENV_PATH} not found.')
        sys.exit(1)

    with open(ENV_PATH) as f:
        lines = f.readlines()

    updated = set()
    out_lines = []
    for line in lines:
        m = re.match(r'^([A-Z_0-9]+)\s*=', line)
        if m:
            key = m.group(1)
            if key in new_values:
                out_lines.append(f'{key}={new_values[key]}\n')
                updated.add(key)
                continue
        out_lines.append(line)

    # Append any managed keys that weren't already in .env
    for key, val in new_values.items():
        if key not in updated:
            out_lines.append(f'{key}={val}\n')

    with open(ENV_PATH, 'w') as f:
        f.writelines(out_lines)

    return updated


def main():
    print(f'[routing-apply] Reading {CONFIG_PATH}')
    pbx, ips, doms = load_routing_config()

    print(f'  PBX mappings:    {len(pbx)}')
    for m in pbx:
        print(f'    {m["domain"]} → {m["host"]}')
    print(f'  Trusted IPs:     {len(ips)}')
    for t in ips:
        print(f'    {t["ip"]}  {t.get("label","")}')
    print(f'  Trusted domains: {len(doms)}')
    for t in doms:
        print(f'    {t["domain"]}  {t.get("label","")}')

    new_values = build_new_values(pbx, ips, doms)
    rewrite_env(new_values)
    print(f'\n[routing-apply] .env updated ({ENV_PATH})')
    print('[routing-apply] Now run:')
    print('  make render')
    print('  docker compose restart kamailio')
    print()


if __name__ == '__main__':
    main()
