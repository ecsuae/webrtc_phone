/**
 * Registration Error Code Admin Page — diagPage.js
 *
 * Generates the HTML for /diagnostics/errors.
 * WireGuard / localhost access only.
 */

const { renderAdminLayout } = require('../admin/adminLayout');

const { ERROR_CATALOG } = require('../diagCatalog');

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _renderCard(entry) {
  const causes = entry.commonCauses
    .map((c) => `<li>${_esc(c)}</li>`)
    .join('\n');
  const checks = entry.recommendedChecks
    .map((c) => `<li>${_esc(c)}</li>`)
    .join('\n');

  return `
    <div class="card" id="${_esc(entry.code)}">
      <div class="card-header">
        <span class="code-badge">${_esc(entry.code)}</span>
        <span class="short-label">${_esc(entry.shortLabel)}</span>
        <span class="layer-badge">${_esc(entry.likelyLayer)}</span>
      </div>
      <p class="description">${_esc(entry.longDescription)}</p>
      <div class="two-col">
        <div>
          <h4>Common causes</h4>
          <ul>${causes}</ul>
        </div>
        <div>
          <h4>Recommended checks</h4>
          <ul>${checks}</ul>
        </div>
      </div>
    </div>
  `;
}

function renderDiagPage() {
  const cards = ERROR_CATALOG.map(_renderCard).join('\n');
  const now = new Date().toISOString();

  const headExtra = `<style>
    .admin-shell .diag-page *, .admin-shell .diag-page *::before, .admin-shell .diag-page *::after { box-sizing: border-box; margin: 0; padding: 0; }

    .admin-shell .diag-page {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #e2e8f0;
    }

    .admin-shell .diag-page header {
      max-width: 960px;
      margin: 0 auto 28px;
    }

    .admin-shell .diag-page header h1 {
      font-size: 22px;
      font-weight: 700;
      color: #f1f5f9;
      margin-bottom: 4px;
    }

    .admin-shell .diag-page header .meta {
      font-size: 12px;
      color: #64748b;
    }

    .admin-shell .diag-page header .meta a {
      color: #60a5fa;
      text-decoration: none;
    }

    .admin-shell .diag-page header .meta a:hover { text-decoration: underline; }

    .admin-shell .diag-page .toc {
      max-width: 960px;
      margin: 0 auto 28px;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 10px;
      padding: 16px 20px;
    }

    .admin-shell .diag-page .toc h2 {
      font-size: 13px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 10px;
    }

    .admin-shell .diag-page .toc-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .admin-shell .diag-page .toc-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 6px;
      font-size: 12px;
      text-decoration: none;
      color: #cbd5e1;
      transition: border-color 0.15s, color 0.15s;
    }

    .admin-shell .diag-page .toc-item:hover {
      border-color: #60a5fa;
      color: #60a5fa;
    }

    .admin-shell .diag-page .toc-item .toc-code {
      font-family: 'Courier New', monospace;
      font-weight: 700;
      color: #f472b6;
    }

    .admin-shell .diag-page .cards {
      max-width: 960px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .admin-shell .diag-page .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 20px 24px;
      scroll-margin-top: 20px;
    }

    .admin-shell .diag-page .card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }

    .admin-shell .diag-page .code-badge {
      font-family: 'Courier New', monospace;
      font-size: 14px;
      font-weight: 700;
      color: #f472b6;
      background: rgba(244, 114, 182, 0.12);
      border: 1px solid rgba(244, 114, 182, 0.3);
      padding: 3px 10px;
      border-radius: 6px;
    }

    .admin-shell .diag-page .short-label {
      font-size: 16px;
      font-weight: 600;
      color: #f1f5f9;
    }

    .admin-shell .diag-page .layer-badge {
      margin-left: auto;
      font-size: 11px;
      font-weight: 500;
      color: #94a3b8;
      background: #0f172a;
      border: 1px solid #334155;
      padding: 2px 8px;
      border-radius: 20px;
    }

    .admin-shell .diag-page .description {
      color: #94a3b8;
      margin-bottom: 16px;
      border-left: 3px solid #334155;
      padding-left: 12px;
    }

    .admin-shell .diag-page .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    @media (max-width: 640px) {
      .admin-shell .diag-page .two-col { grid-template-columns: 1fr; }
      .admin-shell .diag-page .layer-badge { margin-left: 0; }
    }

    .admin-shell .diag-page h4 {
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }

    .admin-shell .diag-page ul {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .admin-shell .diag-page ul li {
      color: #cbd5e1;
      padding-left: 14px;
      position: relative;
    }

    .admin-shell .diag-page ul li::before {
      content: '›';
      position: absolute;
      left: 0;
      color: #475569;
    }

    .admin-shell .diag-page .two-col > div:last-child ul li::before {
      content: '✓';
      color: #22c55e;
      font-size: 11px;
    }

    .admin-shell .diag-page footer {
      max-width: 960px;
      margin: 32px auto 0;
      font-size: 11px;
      color: #475569;
      text-align: center;
    }
  </style>`;

  const content = `<div class="diag-page">

<header>
  <h1>Registration Error Code Reference</h1>
  <p class="meta">
    Admin view — WireGuard access only &nbsp;|&nbsp;
    Generated: ${_esc(now)} &nbsp;|&nbsp;
    <a href="/dashboard">← Dashboard</a>
  </p>
</header>

<div class="toc">
  <h2>Quick navigation</h2>
  <div class="toc-grid">
    ${ERROR_CATALOG.map((e) => `
      <a class="toc-item" href="#${_esc(e.code)}">
        <span class="toc-code">${_esc(e.code)}</span>
        <span>${_esc(e.shortLabel)}</span>
      </a>
    `).join('')}
  </div>
</div>

<div class="cards">
  ${cards}
</div>

<footer>
  Frontend catalog: www/app/registration/regDiagCatalog.js &nbsp;|&nbsp;
  Backend catalog: push-server/src/diagCatalog.js &nbsp;|&nbsp;
  Doc: docs/10-registration-diagnostics-and-error-codes.md
</footer>

</div>`;

  return renderAdminLayout({
    active: 'diagnostics',
    title: 'Diagnostics',
    subtitle: 'Registration error codes reference.',
    content,
    headExtra,
  });
}

module.exports = { renderDiagPage };
