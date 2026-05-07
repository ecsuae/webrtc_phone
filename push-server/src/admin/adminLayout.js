'use strict';

function h(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function adminBaseCss() {
  return `
  .admin-shell{--bg:#0b1220;--panel:#0f172a;--card:#111c31;--muted:#64748b;--text:#e5e7eb;--border:rgba(148,163,184,.18);--accent:#38bdf8;--accent2:#60a5fa;--ok:#14532d;--warn:#713f12;--danger:#7c2d12;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;color:var(--text);background:linear-gradient(180deg,#070c14, var(--bg) 35%, #070c14);min-height:100vh;}
  .admin-shell *{box-sizing:border-box;}
  .admin-shell a{color:inherit;text-decoration:none;}
  .admin-shell code,.admin-shell pre,.admin-shell .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,\"Liberation Mono\",\"Courier New\",monospace;}

  .admin-shell .layout{display:grid;grid-template-columns:260px 1fr;min-height:100vh;}
  @media (max-width: 980px){.admin-shell .layout{grid-template-columns:1fr;}}

  .admin-shell .sidebar{background:rgba(15,23,42,.92);border-right:1px solid var(--border);padding:18px 14px;position:sticky;top:0;height:100vh;}
  @media (max-width: 980px){.admin-shell .sidebar{position:relative;height:auto;border-right:none;border-bottom:1px solid var(--border);}}

  .admin-shell .brand{display:flex;align-items:center;gap:10px;padding:10px 10px 16px 10px;}
  .admin-shell .brandMark{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg, rgba(56,189,248,.25), rgba(96,165,250,.08));border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--accent);font-weight:800;}
  .admin-shell .brandTitle{font-weight:800;letter-spacing:.2px;}
  .admin-shell .brandSub{font-size:.78rem;color:var(--muted);margin-top:2px;}

  .admin-shell .nav{display:flex;flex-direction:column;gap:4px;padding:0 6px;}
  .admin-shell .nav a{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 10px;border-radius:10px;color:rgba(226,232,240,.9);}
  .admin-shell .nav a:hover{background:rgba(148,163,184,.08);}
  .admin-shell .nav a.active{background:rgba(56,189,248,.12);border:1px solid rgba(56,189,248,.22);color:#e0f2fe;}
  .admin-shell .nav .hint{font-size:.72rem;color:var(--muted);}

  .admin-shell .main{padding:22px 22px 60px 22px;}
  @media (max-width: 980px){.admin-shell .main{padding:18px 14px 40px 14px;}}

  .admin-shell .topbar{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:16px;}
  .admin-shell .pageTitle{font-size:1.25rem;font-weight:800;line-height:1.2;margin:0;}
  .admin-shell .pageSubtitle{margin-top:6px;color:var(--muted);font-size:.9rem;}
  .admin-shell .pill{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--border);background:rgba(17,24,39,.25);padding:6px 10px;border-radius:999px;font-size:.78rem;color:rgba(226,232,240,.9);}

  .admin-shell .content{max-width:1180px;}

  .admin-shell .card{background:rgba(17,28,49,.9);border:1px solid var(--border);border-radius:14px;padding:16px;box-shadow:0 10px 30px rgba(0,0,0,.25);}
  .admin-shell .card h2{font-size:1rem;font-weight:700;margin:0 0 10px 0;color:rgba(226,232,240,.92);}

  .admin-shell .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
  @media (max-width: 980px){.admin-shell .grid2{grid-template-columns:1fr;}}

  .admin-shell .ro-grid{display:grid;grid-template-columns:max-content 1fr;gap:4px 16px;font-size:.88rem;}
  .admin-shell .ro-grid .lbl{color:var(--muted);}
  .admin-shell .ro-grid .val{color:rgba(226,232,240,.95);}

  .admin-shell table{width:100%;border-collapse:collapse;font-size:.88rem;}
  .admin-shell th{text-align:left;color:var(--muted);font-weight:700;padding:8px 10px;border-bottom:1px solid var(--border);}
  .admin-shell td{padding:8px 10px;border-bottom:1px solid rgba(148,163,184,.12);vertical-align:top;}

  .admin-shell .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:.75rem;line-height:1.5;border:1px solid rgba(148,163,184,.20);background:rgba(148,163,184,.08);color:rgba(226,232,240,.92);}
  .admin-shell .badge.warn{background:rgba(113,63,18,.35);border-color:rgba(251,191,36,.25);color:#fde68a;}
  `;
}

function renderAdminNav({ active } = {}) {
  const items = [
    { key: 'dashboard', label: 'Dashboard', href: '/dashboard', hint: 'system' },
    { key: 'provisioning', label: 'Provisioning', href: '/admin/provisioning', hint: 'accounts' },
    { key: 'routing', label: 'Routing', href: '/admin/routing', hint: 'config' },
    { key: 'registrations', label: 'Registrations', href: '/admin/registrations', hint: 'live' },
    { key: 'calllogs', label: 'Call Logs', href: '/admin/calllogs', hint: 'media' },
    { key: 'diagnostics', label: 'Diagnostics', href: '/diagnostics/errors', hint: 'errors' },
  ];

  return `
    <div class="brand">
      <div class="brandMark">A</div>
      <div>
        <div class="brandTitle">Admin Portal</div>
        <div class="brandSub">WireGuard-only</div>
      </div>
    </div>
    <nav class="nav">
      ${items
        .map((it) => {
          const isActive = String(active || '') === it.key;
          return `<a href="${h(it.href)}" class="${isActive ? 'active' : ''}">
            <span>${h(it.label)}</span>
            <span class="hint">${h(it.hint)}</span>
          </a>`;
        })
        .join('')}
    </nav>
  `;
}

function renderAdminLayout({
  active,
  title,
  subtitle,
  content,
  headExtra,
  scripts,
} = {}) {
  const t = String(title || 'Admin');
  const sub = subtitle ? String(subtitle) : '';
  const head = headExtra ? String(headExtra) : '';
  const body = content ? String(content) : '';
  const js = scripts ? String(scripts) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${h(t)} — Admin</title>
<style>${adminBaseCss()}</style>
${head}
</head>
<body class="admin-shell">
  <div class="layout">
    <aside class="sidebar">
      ${renderAdminNav({ active })}
    </aside>
    <main class="main">
      <div class="content">
        <div class="topbar">
          <div>
            <h1 class="pageTitle">${h(t)}</h1>
            ${sub ? `<div class="pageSubtitle">${h(sub)}</div>` : ''}
          </div>
          <div class="pill">WireGuard admin</div>
        </div>
        ${body}
      </div>
    </main>
  </div>
${js}
</body>
</html>`;
}

module.exports = {
  renderAdminLayout,
};
