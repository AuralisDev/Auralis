(() => {
  const cfg = window.AURALIS_CONFIG || { apiBase: '', clientId: '' };
  const apiBase = String(cfg.apiBase || '').replace(/\/$/, '');

  async function api(path, options = {}) {
    const response = await fetch(`${apiBase}${path}`, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) throw new Error(data?.error || data || `Request failed (${response.status})`);
    return data;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  }
  function addInvite() {
    if (cfg.discordInvite) return cfg.discordInvite;
    if (!cfg.clientId) return '#';
    const install = cfg.discordInstall || {};
    const params = new URLSearchParams({
      client_id: cfg.clientId,
      permissions: String(install.permissions || '1495484460247'),
      integration_type: String(install.integrationType ?? 0),
      scope: (Array.isArray(install.scopes) && install.scopes.length ? install.scopes : ['bot', 'applications.commands']).join(' ')
    });
    return `https://discord.com/oauth2/authorize?${params.toString()}`;
  }
  function loginUrl() { if (apiBase) return `${apiBase}/auth/discord`; if (['localhost','127.0.0.1'].includes(location.hostname)) return '/auth/discord'; return `${String(cfg.siteUrl || './').replace(/\/$/, '')}/setup.html`; }

  async function loadOverview() {
    const stats = document.querySelectorAll('[data-stat]');
    if (!stats.length) return;
    try {
      const data = await api('/public/api/overview');
      stats.forEach(el => { el.textContent = data.stats?.[el.dataset.stat] ?? '—'; });
      document.querySelectorAll('[data-bot-name]').forEach(el => el.textContent = data.brand?.name || 'Auralis');
      document.querySelectorAll('[data-invite]').forEach(el => el.href = data.invite || addInvite());
      document.querySelectorAll('[data-discord]').forEach(el => el.href = data.links?.discord || '#');
      const status = document.querySelector('[data-public-status]');
      if (status) { status.textContent = data.bot?.online ? 'Online' : 'Offline'; status.classList.toggle('offline', !data.bot?.online); }
    } catch {}
  }

  function renderServerSkeletons(grid, count = 6) {
    grid.innerHTML = Array.from({ length: count }, () => `<article class="server-card skeleton-card"><div class="server-body"><div class="server-top"><span class="skeleton avatar"></span><div style="flex:1"><span class="skeleton line wide"></span><span class="skeleton line short"></span></div></div><span class="skeleton block"></span><span class="skeleton block small"></span></div></article>`).join('');
  }

  async function loadServers() {
    const grid = document.querySelector('[data-server-grid]');
    if (!grid) return;
    renderServerSkeletons(grid);
    let servers = [];
    try { servers = (await api('/public/api/servers')).servers || []; } catch {}
    if (!servers.length) {
      try { servers = (await fetch('data/servers.json', { cache: 'no-store' }).then(r => r.json())).servers || []; } catch {}
    }
    if (!servers.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1">No public servers are available right now.</div>`;
      return;
    }
    const limit = Number(cfg.publicServerLimit || 48);
    const fallback = cfg.publicServerDescriptionFallback || 'No public description provided.';
    grid.innerHTML = servers.slice(0, limit).map(server => {
      const join = server.invite ? `<a class="btn btn-primary btn-small" href="${escapeHtml(server.invite)}" target="_blank" rel="noopener noreferrer">Join</a>` : `<span class="pill muted-pill">Invite unavailable</span>`;
      const icon = server.icon || 'assets/auralis-logo.png';
      const badge = server.verified ? 'Verified' : (server.partnered ? 'Partnered' : 'Public');
      return `<article class="server-card fade-in"><div class="server-body"><div class="server-top"><img class="server-icon" src="${escapeHtml(icon)}" alt="${escapeHtml(server.name)} icon"><div class="server-head-copy"><div class="server-name" title="${escapeHtml(server.name)}">${escapeHtml(server.name)}</div><div class="server-members">${Number(server.members || 0).toLocaleString()} members</div></div></div><div class="server-desc-wrap"><p class="server-desc">${escapeHtml(server.description || fallback)}</p></div><div class="server-actions"><span class="pill">${escapeHtml(badge)}</span>${join}</div></div></article>`;
    }).join('');
  }

  async function loadCommands() {
    const root = document.querySelector('[data-command-list]');
    if (!root) return;
    let catalog = [];
    try {
      const data = await api('/public/api/commands');
      catalog = Array.isArray(data.catalog) ? data.catalog : Object.entries(data.groups || {}).flatMap(([group, names]) => names.map(name => ({ name, group, usage: (group === 'prefix' ? '.' : '/') + name, description: `Use ${(group === 'prefix' ? '.' : '/') + name} to ${name.replace(/[-_]/g, ' ')}.` })));
    } catch {
      try {
        const data = await fetch('data/commands.json', { cache: 'no-store' }).then(r => r.json());
        catalog = Object.entries(data.groups || {}).flatMap(([group, list]) => list.map(item => ({ ...item, group })));
      } catch {}
    }
    if (!catalog.length) {
      root.innerHTML = `<div class="empty">No commands are available right now.</div>`;
      return;
    }
    const labels = { support:'Support', moderation:'Moderation', security:'Security', community:'Community', utility:'Utility', prefix:'Prefix Commands' };
    const groups = Object.entries(catalog.reduce((map, item) => { (map[item.group] ||= []).push(item); return map; }, {}));
    root.innerHTML = groups.map(([group, commands]) => `<section class="command-section" data-command-group="${escapeHtml(group)}"><div class="command-section-head"><div><div class="eyebrow">${escapeHtml(labels[group] || group)}</div><h2>${escapeHtml(labels[group] || group)}</h2></div><span class="command-count">${commands.length} commands</span></div><div class="command-list">${commands.map(cmd => `<article class="command-row fade-in" data-command-search="${escapeHtml(`${cmd.name} ${cmd.usage} ${cmd.description}`.toLowerCase())}"><div class="command-main"><code>${escapeHtml(cmd.usage)}</code></div><div class="command-description">${escapeHtml(cmd.description)}</div></article>`).join('')}</div></section>`).join('');
    const search = document.querySelector('[data-command-search-input]');
    const filter = () => {
      const q = String(search?.value || '').toLowerCase().trim();
      document.querySelectorAll('.command-row').forEach(row => row.classList.toggle('hidden', q && !row.dataset.commandSearch.includes(q)));
      document.querySelectorAll('[data-command-group]').forEach(section => {
        const visible = section.querySelectorAll('.command-row:not(.hidden)').length;
        section.classList.toggle('hidden', visible === 0);
      });
    };
    if (search) search.addEventListener('input', filter);
  }

  async function loadStatus() {
    const panels = document.querySelectorAll('[data-status-panel]');
    const anyStatus = panels.length || document.querySelectorAll('[data-status-label],[data-service-status]').length;
    if (!anyStatus) return;
    try {
      const data = await api('/public/api/status');
      const online = data.status === 'Online';
      document.querySelectorAll('[data-status-label]').forEach(el => el.textContent = data.status);
      document.querySelectorAll('[data-status-sub]').forEach(el => el.textContent = online ? 'Service operating normally' : 'Service currently unavailable');
      document.querySelectorAll('[data-status-checked]').forEach(el => el.textContent = new Date(data.checkedAt).toLocaleTimeString());
      panels.forEach(panel => panel.classList.toggle('is-offline', !online));
      document.querySelectorAll('[data-service-status]').forEach(el => el.textContent = online ? 'Operational' : 'Unavailable');
    } catch {
      panels.forEach(panel => panel.classList.add('is-offline'));
      document.querySelectorAll('[data-status-label]').forEach(el => el.textContent = 'Offline');
      document.querySelectorAll('[data-status-sub]').forEach(el => el.textContent = 'Service currently unavailable');
      document.querySelectorAll('[data-service-status]').forEach(el => el.textContent = 'Unavailable');
    }
  }

  function wireCommon() {
    document.querySelectorAll('[data-invite]').forEach(el => el.href = addInvite());
    document.querySelectorAll('[data-login]').forEach(el => el.href = loginUrl());
    // Keep the public site on GitHub Pages, but open the protected dashboard on
    // the backend's own origin so its HttpOnly session cookie is first-party.
    document.querySelectorAll('[data-dashboard-link]').forEach(el => {
      el.href = apiBase ? `${apiBase}/dashboard/` : `${String(cfg.siteUrl || './').replace(/\/$/, '')}/setup.html`;
    });
    document.querySelectorAll('[data-discord]').forEach(el => { if (!el.href || el.getAttribute('href') === '#') el.href = cfg.supportInvite || '#'; });
  }

  async function bootPublic() {
    wireCommon();
    document.documentElement.classList.add('site-loading');
    setTimeout(() => document.documentElement.classList.remove('site-loading'), 450);
    await Promise.all([loadOverview(), loadServers(), loadCommands(), loadStatus()]);
    if (document.querySelector('[data-status-panel]')) setInterval(loadStatus, 30000);

    const search = document.querySelector('[data-server-search]');
    const grid = document.querySelector('[data-server-grid]');
    if (search && grid) search.addEventListener('input', () => { const value = search.value.toLowerCase(); grid.querySelectorAll('.server-card').forEach(card => card.classList.toggle('hidden', !card.textContent.toLowerCase().includes(value))); });
  }

  async function loadAdminPanel(access) {
    const identity = document.querySelector('[data-admin-identity]');
    if (identity) identity.textContent = access.level === 'owner' ? 'Owner · Full access' : `Staff · ${(access.permissions || []).join(' · ')}`;
    const can = permission => access.level === 'owner' || (access.permissions || []).includes('*') || (access.permissions || []).includes(permission);
    const statusCard = document.querySelector('[data-admin-status]')?.closest('.dash-card');
    const staffCard = document.querySelector('[data-staff-save]')?.closest('.dash-card');
    if (statusCard && !can('manage_bot_status')) statusCard.classList.add('hidden');
    if (staffCard && !can('manage_staff')) staffCard.classList.add('hidden');

    if (can('manage_bot_status')) {
      try {
        const runtime = await api('/api/admin/runtime');
        const presence = runtime.presence || {};
        document.querySelector('[data-admin-status]').value = presence.status || 'online';
        document.querySelector('[data-admin-activity]').value = presence.type || 'WATCHING';
        document.querySelector('[data-admin-status-text]').value = presence.text || '';
      } catch {}
      document.querySelector('[data-admin-save-status]').onclick = async () => {
        try {
          await api('/api/admin/runtime', { method: 'PATCH', body: JSON.stringify({
            status: document.querySelector('[data-admin-status]').value,
            type: document.querySelector('[data-admin-activity]').value,
            text: document.querySelector('[data-admin-status-text]').value
          })});
          toastAdmin('Bot status saved');
        } catch (e) { toastAdmin(e.message); }
      };
    }

    async function loadStaff() {
      const root = document.querySelector('[data-admin-staff-list]');
      const permsRoot = document.querySelector('[data-staff-permissions]');
      if (!can('manage_staff')) return;
      try {
        const data = await api('/api/admin/staff');
        permsRoot.innerHTML = (data.permissions || []).map(p => `<label class="permission-chip"><input type="checkbox" value="${escapeHtml(p)}"> ${escapeHtml(p)}</label>`).join('');
        const owners = (data.owners || []).map(x => `<div class="admin-row"><div><strong>${escapeHtml(x.label || 'Owner')}</strong><span class="muted">${escapeHtml(x.userId)}${x.username ? ` · ${escapeHtml(x.username)}` : ''}</span></div><span class="pill">Owner · Full access</span></div>`).join('');
        const staff = (data.staff || []).map(x => `<div class="admin-row"><div><strong>${escapeHtml(x.label || 'Auralis Staff')}</strong><span class="muted">${escapeHtml(x.userId)} · ${(x.permissions || []).map(escapeHtml).join(' · ') || 'No permissions'}</span></div><button class="btn btn-danger" data-remove-staff="${escapeHtml(x.userId)}">Remove</button></div>`).join('');
        root.innerHTML = owners + staff || '<div class="empty">No staff members configured.</div>';
        root.querySelectorAll('[data-remove-staff]').forEach(btn => btn.onclick = async () => {
          if (!confirm(`Remove ${btn.dataset.removeStaff} from Auralis staff?`)) return;
          try { await api(`/api/admin/staff/${btn.dataset.removeStaff}`, { method: 'DELETE' }); await loadStaff(); toastAdmin('Staff member removed'); } catch (e) { toastAdmin(e.message); }
        });
      } catch (e) { root.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`; }
    }

    if (can('manage_staff')) {
      document.querySelector('[data-staff-save]').onclick = async () => {
        const selected = [...document.querySelectorAll('[data-staff-permissions] input:checked')].map(x => x.value);
        try {
          await api('/api/admin/staff', { method: 'POST', body: JSON.stringify({ userId: document.querySelector('[data-staff-user-id]').value, label: document.querySelector('[data-staff-label]').value, permissions: selected }) });
          document.querySelector('[data-staff-user-id]').value = '';
          document.querySelector('[data-staff-label]').value = '';
          document.querySelectorAll('[data-staff-permissions] input').forEach(x => x.checked = false);
          await loadStaff();
          toastAdmin('Staff saved');
        } catch (e) { toastAdmin(e.message); }
      };
      await loadStaff();
    }

    async function loadAdminGuilds() {
      const root = document.querySelector('[data-admin-server-grid]');
      if (!root || !can('view_all_guilds')) return;
      try {
        const data = await api('/api/admin/guilds');
        const blacklistRoot = document.querySelector('[data-admin-blacklist-list]');
        if (blacklistRoot) blacklistRoot.innerHTML = (data.blacklisted || []).map(b => `<div class="admin-row"><div><strong>${escapeHtml(b.guild_id)}</strong><span class="muted">${escapeHtml(b.reason || 'No reason')}</span></div><button class="btn" data-admin-unblacklist-list="${escapeHtml(b.guild_id)}">Unblacklist</button></div>`).join('') || '<div class="empty">No blacklisted servers.</div>';
        root.innerHTML = (data.guilds || []).map(g => `<article class="admin-server-card"><div class="admin-server-head">${g.icon ? `<img src="${escapeHtml(g.icon)}" alt="">` : `<div class="admin-server-placeholder">A</div>`}<div><strong>${escapeHtml(g.name)}</strong><span>${Number(g.members || 0).toLocaleString()} members</span></div></div><p>${escapeHtml(g.description || 'No server description.')}</p><div class="admin-server-meta"><span class="pill ${g.blacklisted ? 'danger' : ''}">${g.blacklisted ? 'Blacklisted' : 'Active'}</span><span class="muted">${escapeHtml(g.id)}</span></div><div class="admin-actions">${can('leave_guilds') && !g.blacklisted ? `<button class="btn btn-danger" data-admin-leave="${escapeHtml(g.id)}">Leave</button>` : ''}${can('blacklist_guilds') ? (g.blacklisted ? `<button class="btn" data-admin-unblacklist="${escapeHtml(g.id)}">Unblacklist</button>` : `<button class="btn btn-danger" data-admin-blacklist="${escapeHtml(g.id)}">Blacklist</button>`) : ''}${g.invite ? `<a class="btn" href="${escapeHtml(g.invite)}" target="_blank" rel="noreferrer">Join</a>` : ''}<a class="btn" href="#" data-admin-manage-guild="${escapeHtml(g.id)}">Configure</a></div></article>`).join('') || '<div class="empty">Auralis is not in any servers.</div>';
        root.querySelectorAll('[data-admin-leave]').forEach(btn => btn.onclick = async () => { if (!confirm('Make Auralis leave this server?')) return; try { await api(`/api/admin/guilds/${btn.dataset.adminLeave}/leave`, { method: 'POST' }); await loadAdminGuilds(); toastAdmin('Auralis left the server'); } catch (e) { toastAdmin(e.message); } });
        root.querySelectorAll('[data-admin-blacklist]').forEach(btn => btn.onclick = async () => { const reason = prompt('Blacklist reason:', 'Blacklisted by Auralis staff.'); if (reason === null) return; try { await api(`/api/admin/guilds/${btn.dataset.adminBlacklist}/blacklist`, { method: 'POST', body: JSON.stringify({ reason }) }); await loadAdminGuilds(); toastAdmin('Server blacklisted and Auralis left'); } catch (e) { toastAdmin(e.message); } });
        root.querySelectorAll('[data-admin-unblacklist]').forEach(btn => btn.onclick = async () => { try { await api(`/api/admin/guilds/${btn.dataset.adminUnblacklist}/blacklist`, { method: 'DELETE' }); await loadAdminGuilds(); toastAdmin('Blacklist removed'); } catch (e) { toastAdmin(e.message); } });
        document.querySelectorAll('[data-admin-unblacklist-list]').forEach(btn => btn.onclick = async () => { try { await api(`/api/admin/guilds/${btn.dataset.adminUnblacklistList}/blacklist`, { method: 'DELETE' }); await loadAdminGuilds(); toastAdmin('Blacklist removed'); } catch (e) { toastAdmin(e.message); } });
        root.querySelectorAll('[data-admin-manage-guild]').forEach(btn => btn.onclick = async e => { e.preventDefault(); selectedId = btn.dataset.adminManageGuild; document.querySelector('[data-guild-select]').value = selectedId; await loadGuild(); document.querySelector('[data-dashboard-nav="overview"]').click(); });
      } catch (e) { root.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`; }
    }
    const refresh = document.querySelector('[data-admin-refresh-guilds]');
    if (refresh && can('view_all_guilds')) refresh.onclick = loadAdminGuilds;
    if (can('view_all_guilds')) await loadAdminGuilds();

    if (can('view_analytics')) {
      try {
        const data = await api('/api/admin/audit?limit=100');
        const root = document.querySelector('[data-admin-audit-list]');
        root.innerHTML = (data.entries || []).map(e => `<div class="admin-row"><div><strong>${escapeHtml(e.action)}</strong><span class="muted">${escapeHtml(e.actor_id)}${e.target_id ? ` · ${escapeHtml(e.target_id)}` : ''}</span></div><span class="muted">${new Date(Number(e.created_at)).toLocaleString()}</span></div>`).join('') || '<div class="empty">No audit events yet.</div>';
      } catch {}
    }
  }

  function toastAdmin(message) {
    let el=document.querySelector('[data-admin-toast]');
    if (!el) { el=document.createElement('div'); el.className='toast'; el.dataset.adminToast=''; document.body.appendChild(el); }
    el.textContent=message; el.style.display='block'; clearTimeout(window.__auralisToast); window.__auralisToast=setTimeout(()=>el.remove(),2200);
  }

  async function bootDashboard() {
    const gate = document.querySelector('[data-dashboard-gate]');
    if (!gate) return;
    const app = document.querySelector('[data-dashboard-app]');
    let me;
    try { me = await api('/api/me'); } catch { gate.classList.remove('hidden'); return; }
    gate.classList.add('hidden'); app.classList.remove('hidden');
    const access = me.dashboardAccess || { level: 'none', permissions: [] };
    if (access.level !== 'none') document.querySelector('[data-admin-nav]')?.classList.remove('hidden');
    const guildResponse = await api('/api/guilds');
    const guilds = guildResponse.guilds || [];
    const select = document.querySelector('[data-guild-select]');
    select.innerHTML = guilds.map(g => `<option value="${g.id}">${escapeHtml(g.name)}${g.botInstalled ? '' : ' · Install Auralis'}</option>`).join('') || '<option value="">No managed server</option>';
    let selectedId = guilds[0]?.id ?? null;
    if (!guilds.length) {
      document.querySelector('[data-guild-name]').textContent = 'No managed server';
      document.querySelector('[data-guild-members]').textContent = '—';
      document.querySelector('[data-open-tickets]').textContent = '—';
      document.querySelector('[data-case-count]').textContent = '—';
      document.querySelector('[data-module-grid]').innerHTML = '<div class="empty">No Discord Administrator server is available. Global Auralis staff can still use the Admin Panel.</div>';
    }
    const toast = message => { const el=document.createElement('div'); el.className='toast'; el.textContent=message; document.body.appendChild(el); setTimeout(()=>el.remove(),2200); };
    let data = null;

    async function loadGuild() {
      if (!selectedId) return;
      data = await api(`/api/guilds/${selectedId}`);
      const res = await api(`/api/guilds/${selectedId}/resources`).catch(()=>({channels:[],roles:[]}));
      renderOverview(data, res);
    }
    function moduleList(cfg) {
      const names = { tickets:'Tickets', applications:'Applications', moderation:'Moderation', automod:'Auto Mod', antiraid:'Anti Raid', antinuke:'Anti Nuke', verify:'Verify', jail:'Jail', welcome:'Welcome', levels:'Levels', giveaways:'Giveaways', polls:'Polls', reactionroles:'Reaction Roles', buttonroles:'Button Roles', boosterroles:'Booster Roles', voicemaster:'Voice Master', suggestions:'Suggestions', birthdays:'Birthdays', timezones:'Timezones', counters:'Counters', imageonly:'Image Only', sticky:'Sticky Messages', tags:'Tags', customcmd:'Custom Commands', prefix:'Prefix Commands', embeds:'Embeds', webhooks:'Webhooks', snipe:'Snipe', economy:'Economy', fun:'Fun Commands', utility:'Utility', autoroles:'Auto Roles' };
      return Object.entries(names).map(([key,label]) => `<div class="toggle"><span>${label}</span><button class="switch ${cfg.modules?.[key] !== false ? 'on' : ''}" data-module="${key}"><i></i></button></div>`).join('');
    }
    function renderOverview(d, resources) {
      document.querySelector('[data-guild-name]').textContent = d.guild?.name || 'Server';
      document.querySelector('[data-guild-members]').textContent = Number(d.guild?.approximateMemberCount || 0).toLocaleString();
      document.querySelector('[data-open-tickets]').textContent = Number(d.stats?.openTickets || 0).toLocaleString();
      document.querySelector('[data-case-count]').textContent = Number((d.stats?.cases || []).reduce((a,x)=>a+Number(x.count||0),0)).toLocaleString();
      document.querySelector('[data-module-grid]').innerHTML = moduleList(d.config);
      document.querySelector('[data-public-toggle]').checked = d.config.publicDirectory?.enabled !== false;
      document.querySelector('[data-public-require-description]').checked = d.config.publicDirectory?.requireDescription === true;
      document.querySelector('[data-public-description-mode]').value = d.config.publicDirectory?.descriptionMode || 'placeholder';
      document.querySelector('[data-public-description-fallback]').value = d.config.publicDirectory?.descriptionFallback || '';
      document.querySelector('[data-public-invite-channel]').value = d.config.publicDirectory?.inviteChannelId || '';
      document.querySelector('[data-public-auto-invite]').checked = d.config.publicDirectory?.autoInvite !== false;
      document.querySelector('[data-prefix-input]').value = d.config.discord?.defaultPrefix || '.';
      document.querySelector('[data-welcome-message]').value = d.config.welcomeDefaults?.welcomeMessage || '';
      document.querySelector('[data-automod-enabled]').checked = d.config.automodDefaults?.enabled !== false;
      document.querySelector('[data-raw-json]').value = JSON.stringify(d.config, null, 2);
      document.querySelectorAll('[data-module]').forEach(button => button.onclick = async () => { const enabled = button.classList.toggle('on'); button.querySelector('i').style.left = enabled ? '20px' : '2px'; await save({ modules: { [button.dataset.module]: enabled } }); });
      document.querySelector('[data-public-toggle]').onchange = e => save({ publicDirectory: { enabled: e.target.checked } });
      document.querySelector('[data-public-require-description]').onchange = e => save({ publicDirectory: { requireDescription: e.target.checked } });
      document.querySelector('[data-public-description-mode]').onchange = e => save({ publicDirectory: { descriptionMode: e.target.value } });
      document.querySelector('[data-public-description-fallback]').onchange = e => save({ publicDirectory: { descriptionFallback: e.target.value } });
      document.querySelector('[data-public-invite-channel]').onchange = e => save({ publicDirectory: { inviteChannelId: e.target.value } });
      document.querySelector('[data-public-auto-invite]').onchange = e => save({ publicDirectory: { autoInvite: e.target.checked } });
      document.querySelector('[data-save-basic]').onclick = () => save({ discord: { defaultPrefix: document.querySelector('[data-prefix-input]').value }, welcomeDefaults: { welcomeMessage: document.querySelector('[data-welcome-message]').value }, automodDefaults: { enabled: document.querySelector('[data-automod-enabled]').checked } });
      document.querySelector('[data-save-raw]').onclick = async () => { try { const next=JSON.parse(document.querySelector('[data-raw-json]').value); const res=await api(`/api/guilds/${selectedId}/config/raw`,{method:'PUT',body:JSON.stringify(next)}); data.config=res.config; toast('Configuration saved'); } catch(e) { toast(e.message); } };
    }
    async function save(changes) { try { await api(`/api/guilds/${selectedId}/config`,{method:'PATCH',body:JSON.stringify(changes)}); toast('Saved'); await loadGuild(); } catch(e) { toast(e.message); } }
    select.onchange = async e => { selectedId=e.target.value || null; await loadGuild(); };
    document.querySelectorAll('[data-dashboard-nav]').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('[data-dash-section]').forEach(x=>x.classList.add('hidden'));document.querySelector(`[data-dash-section="${btn.dataset.dashboardNav}"]`).classList.remove('hidden');document.querySelectorAll('[data-dashboard-nav]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');});
    if (selectedId) await loadGuild();
    const adminButton = document.querySelector('[data-admin-nav]');
    if (adminButton && access.level !== 'none') adminButton.addEventListener('click', () => loadAdminPanel(access));
  }

  window.AuralisSite = { api, addInvite, loginUrl, loadOverview, loadServers };
  document.addEventListener('DOMContentLoaded', () => { bootPublic().catch(()=>{}); bootDashboard().catch(()=>{}); });
})();
