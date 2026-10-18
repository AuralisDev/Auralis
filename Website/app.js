(() => {
  const cfg = window.AURALIS_CONFIG || { apiBase: '', clientId: '' };
  const apiBase = String(cfg.apiBase || '').trim().replace(/\/$/, '');
  const isGitHubPages = /(^|\.)github\.io$/i.test(location.hostname);
  const numberFormat = new Intl.NumberFormat(cfg.numberLocale || undefined, { maximumFractionDigits: 0 });
  const animationFrames = new WeakMap();
  let serverStore = [];
  let publicServerDataFromApi = false;
  const PROFILE_STORAGE_KEY = 'auralis.profile.v1';
  let accountProfile = null;

  function apiRoot() {
    if (apiBase) return apiBase;
    // The static site must not accidentally request /api from the github.io domain.
    // A dashboard served directly by the backend can use same-origin requests.
    if (isGitHubPages) throw new Error('Auralis is temporarily unavailable. Please try again soon.');
    return '';
  }
  async function api(path, options = {}) {
    const root = apiRoot();
    const response = await fetch(`${root}${path}`, {
      credentials: 'include',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) throw new Error(data?.error || data || `Request failed (${response.status})`);
    return data;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  }
  function safeExternalUrl(value) {
    try {
      const url = new URL(String(value || ''), location.href);
      if (url.protocol !== 'https:') return '';
      if (!['discord.gg', 'discord.com', 'www.discord.com'].includes(url.hostname)) return '';
      return url.href;
    } catch { return ''; }
  }
  function staticSiteUrl(path) {
    const relative = String(path || '').replace(/^\/+/, '');
    if (isGitHubPages && cfg.siteUrl) {
      try {
        const configured = String(cfg.siteUrl).endsWith('/') ? String(cfg.siteUrl) : `${cfg.siteUrl}/`;
        return new URL(relative, configured).href;
      } catch {}
    }
    const pathName = String(location.pathname || '/');
    const rootPath = pathName.replace(/\/(?:servers|docs)(?:\/index\.html)?\/?$/i, '/');
    const directory = rootPath.endsWith('/') ? rootPath : rootPath.slice(0, rootPath.lastIndexOf('/') + 1);
    return new URL(relative, `${location.origin}${directory || '/'}`).href;
  }
  function addInvite(guildId = '') {
    let href = cfg.discordInvite || '';
    if (!href) {
      if (!cfg.clientId) return '#';
      const install = cfg.discordInstall || {};
      const params = new URLSearchParams({
        client_id: cfg.clientId,
        permissions: String(install.permissions || '1495484460247'),
        integration_type: String(install.integrationType ?? 0),
        scope: (Array.isArray(install.scopes) && install.scopes.length ? install.scopes : ['bot', 'applications.commands']).join(' ')
      });
      href = `https://discord.com/oauth2/authorize?${params.toString()}`;
    }
    if (guildId) {
      try {
        const url = new URL(href);
        url.searchParams.set('guild_id', String(guildId));
        url.searchParams.set('disable_guild_select', 'true');
        return url.href;
      } catch {}
    }
    return href;
  }
  function publicHomeUrl() {
    const base = String(cfg.siteUrl || 'https://auralisdev.github.io/Auralis/').replace(/\/$/, '');
    return `${base}/`;
  }
  function manageServersUrl() { return `${publicHomeUrl()}#manage-servers`; }
  function loginUrl() {
    if (apiBase) return `${apiBase}/auth/discord?return_to=${encodeURIComponent(manageServersUrl())}`;
    if (isGitHubPages) return `${publicHomeUrl()}setup.html`;
    return '/auth/discord';
  }
  function readAccountCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || 'null');
      return parsed?.user?.id ? parsed : null;
    } catch { return null; }
  }
  function writeAccountCache(value) {
    accountProfile = value;
    try { localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(value)); } catch {}
    renderAccountControl();
    renderManageableServers();
  }
  function discordAvatar(user, size = 64) {
    if (user?.id && user?.avatar) {
      const ext = String(user.avatar).startsWith('a_') ? 'gif' : 'png';
      return `https://cdn.discordapp.com/avatars/${encodeURIComponent(user.id)}/${encodeURIComponent(user.avatar)}.${ext}?size=${size}`;
    }
    let fallback = 0;
    try { fallback = Number(BigInt(user?.id || '0') % 6n); } catch {}
    return `https://cdn.discordapp.com/embed/avatars/${fallback}.png`;
  }
  function guildIcon(guild, size = 96) {
    if (!guild?.icon) return '';
    const ext = String(guild.icon).startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/icons/${encodeURIComponent(guild.id)}/${encodeURIComponent(guild.icon)}.${ext}?size=${size}`;
  }
  function ensureAccountControls() {
    document.querySelectorAll('.nav-actions').forEach(actions => {
      // The account control replaces the old standalone Login with Discord link in the header.
      actions.querySelectorAll('[data-login]').forEach(link => { if (link.closest('.nav-actions')) link.remove(); });
      if (actions.querySelector('[data-account-control]')) return;
      const control = document.createElement('div');
      control.className = 'account-control';
      control.dataset.accountControl = '';
      const invite = actions.querySelector('[data-invite]');
      actions.insertBefore(control, invite || actions.firstChild);
    });
  }
  function renderAccountControl() {
    const user = accountProfile?.user;
    document.querySelectorAll('a[data-login]').forEach(link => {
      link.href = user?.id ? manageServersUrl() : loginUrl();
      link.textContent = user?.id ? 'Dashboard' : 'Dashboard login';
    });
    document.querySelectorAll('[data-account-control]').forEach(control => {
      if (!user?.id) {
        control.innerHTML = `<a class="btn btn-ghost account-login" data-account-login href="${escapeHtml(loginUrl())}">Login with Discord</a>`;
        return;
      }
      const name = user.global_name || user.username || 'Discord user';
      const avatar = discordAvatar(user, 64);
      control.innerHTML = `<a class="btn btn-ghost account-dashboard-shortcut" href="${escapeHtml(manageServersUrl())}">Dashboard</a><div class="account-dropdown"><button class="account-trigger" type="button" data-account-toggle aria-expanded="false" aria-label="Open account menu"><img class="account-avatar-image" src="${escapeHtml(avatar)}" alt="" referrerpolicy="no-referrer"><span class="account-trigger-name">${escapeHtml(name)}</span><span class="account-chevron" aria-hidden="true">⌄</span></button><div class="account-menu" data-account-menu hidden><div class="account-menu-profile"><img src="${escapeHtml(avatar)}" alt="" referrerpolicy="no-referrer"><div><strong>${escapeHtml(name)}</strong><small>@${escapeHtml(user.username || 'discord-user')}</small></div></div><a href="${escapeHtml(manageServersUrl())}" data-account-dashboard>Dashboard overview <span>→</span></a><a href="${escapeHtml(manageServersUrl())}">My servers <span>→</span></a><button type="button" data-account-logout>Log out <span>↗</span></button></div></div>`;
      const trigger = control.querySelector('[data-account-toggle]');
      const menu = control.querySelector('[data-account-menu]');
      trigger?.addEventListener('click', () => {
        const open = menu.hidden;
        menu.hidden = !open;
        trigger.setAttribute('aria-expanded', String(open));
      });
      control.querySelector('[data-account-logout]')?.addEventListener('click', () => {
        try { localStorage.removeItem(PROFILE_STORAGE_KEY); } catch {}
        accountProfile = null;
        window.location.href = apiBase ? `${apiBase}/auth/logout?return_to=${encodeURIComponent(publicHomeUrl())}` : publicHomeUrl();
      });
    });
  }
  function renderManageableServers() {
    const section = document.querySelector('[data-managed-servers-section]');
    const root = document.querySelector('[data-managed-server-grid]');
    if (!section || !root) return;
    const profile = accountProfile;
    const user = profile?.user;
    if (!user?.id) {
      section.classList.add('hidden');
      root.innerHTML = '';
      return;
    }
    const guilds = Array.isArray(user.guilds) ? user.guilds : [];
    section.classList.remove('hidden');
    const count = document.querySelector('[data-managed-server-count]');
    if (count) count.textContent = `${guilds.length} ${guilds.length === 1 ? 'server' : 'servers'} available`;
    if (!guilds.length) {
      root.innerHTML = `<div class="managed-server-empty"><div class="managed-empty-icon">◎</div><h3>No manageable servers found</h3><p>You are signed in, but Discord did not return any servers where you are the owner, an administrator or have Manage Server permission. Check your Discord permissions and sign in again.</p><a class="btn btn-ghost" href="${escapeHtml(apiBase ? `${apiBase}/auth/discord?return_to=${encodeURIComponent(manageServersUrl())}` : loginUrl())}">Refresh Discord login</a></div>`;
      return;
    }
    root.innerHTML = guilds.map(guild => {
      const icon = guildIcon(guild);
      const authority = guild.owner ? 'Server owner' : guild.administrator ? 'Administrator' : 'Manage Server';
      const initial = String(guild.name || 'S').trim().slice(0, 1).toUpperCase() || 'S';
      const badge = guild.botInstalled ? '<span class="server-status-tag is-installed"><i></i> Auralis added</span>' : '<span class="server-status-tag">Bot not added</span>';
      const action = guild.botInstalled
        ? `<a class="btn btn-primary managed-configure" href="${escapeHtml(`${apiBase}/dashboard/?guild=${encodeURIComponent(guild.id)}&landing=1`)}">Configure server <span>→</span></a>`
        : `<a class="btn btn-primary managed-configure" href="${escapeHtml(addInvite(guild.id))}" target="_blank" rel="noreferrer">Add Auralis <span>↗</span></a>`;
      return `<article class="managed-server-card"><div class="managed-server-head">${icon ? `<img class="managed-server-icon" src="${escapeHtml(icon)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<div class="managed-server-icon managed-server-initial">${escapeHtml(initial)}</div>`}<div class="managed-server-title"><h3>${escapeHtml(guild.name || 'Discord server')}</h3><p>${Number(guild.approximate_member_count || 0) ? `${Number(guild.approximate_member_count).toLocaleString()} members · ` : ''}${escapeHtml(authority)}</p></div><span class="managed-server-check" aria-label="You can manage this server">✓</span></div><div class="managed-server-meta">${badge}<span class="managed-server-id">ID ${escapeHtml(guild.id)}</span></div><div class="managed-server-actions">${action}</div></article>`;
    }).join('');
    root.querySelectorAll('img.managed-server-icon').forEach(image => {
      image.addEventListener('error', () => {
        const card = image.closest('.managed-server-card');
        const name = card?.querySelector('.managed-server-title h3')?.textContent || 'Server';
        const fallback = document.createElement('div');
        fallback.className = 'managed-server-icon managed-server-initial';
        fallback.setAttribute('aria-hidden', 'true');
        fallback.textContent = String(name).trim().slice(0, 1).toUpperCase() || 'S';
        image.replaceWith(fallback);
      }, { once: true });
    });
  }
  async function initializeAccount() {
    const currentUrl = new URL(location.href);
    if (currentUrl.searchParams.has('logged_out')) {
      try { localStorage.removeItem(PROFILE_STORAGE_KEY); } catch {}
      currentUrl.searchParams.delete('logged_out');
      history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
    }
    accountProfile = readAccountCache();
    renderAccountControl();
    renderManageableServers();
    const ticket = currentUrl.searchParams.get('auth_ticket');
    if (ticket && apiBase) {
      currentUrl.searchParams.delete('auth_ticket');
      history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
      try {
        const data = await api('/auth/exchange-ticket', { method: 'POST', credentials: 'omit', body: JSON.stringify({ ticket }) });
        if (!data?.user?.id) throw new Error('Discord returned no user profile.');
        writeAccountCache({ user: data.user, dashboardAccess: data.dashboardAccess || { level: 'none', permissions: [] }, brand: data.brand || {}, cachedAt: Date.now() });
        const section = document.querySelector('[data-managed-servers-section]');
        if (section) {
          section.classList.remove('hidden');
          location.hash = 'manage-servers';
          setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
        }
      } catch (error) {
        try { localStorage.removeItem(PROFILE_STORAGE_KEY); } catch {}
        accountProfile = null;
        renderAccountControl();
        renderManageableServers();
        const note = document.querySelector('[data-account-note]');
        if (note) { note.textContent = `Discord login could not be confirmed: ${error.message}`; note.hidden = false; }
      }
    } else if (location.hash === '#manage-servers' && accountProfile) {
      const section = document.querySelector('[data-managed-servers-section]');
      if (section) { section.classList.remove('hidden'); setTimeout(() => section.scrollIntoView({ block: 'start' }), 80); }
    }
    document.addEventListener('click', event => {
      if (event.target.closest('[data-account-control]')) return;
      document.querySelectorAll('[data-account-menu]').forEach(menu => { menu.hidden = true; menu.closest('.account-dropdown')?.querySelector('[data-account-toggle]')?.setAttribute('aria-expanded', 'false'); });
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') document.querySelectorAll('[data-account-menu]').forEach(menu => { menu.hidden = true; menu.closest('.account-dropdown')?.querySelector('[data-account-toggle]')?.setAttribute('aria-expanded', 'false'); });
    });
  }
  function animateCount(element, value) {
    const target = Number(value);
    if (!element || !Number.isFinite(target) || target < 0) return;
    const previousFrame = animationFrames.get(element);
    if (previousFrame) cancelAnimationFrame(previousFrame);
    const animation = cfg.statisticsAnimation || {};
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const baseDuration = Math.max(0, Number(animation.baseDurationMs ?? 1200));
    const perMagnitude = Math.max(0, Number(animation.perMagnitudeMs ?? 620));
    const maxDuration = Math.max(0, Number(animation.maxDurationMs ?? 3200));
    const easePower = Math.max(1, Number(animation.easePower ?? 4.4));
    const enabled = animation.enabled !== false;
    const previousTarget = Number(element.dataset.countTarget);
    const from = Number.isFinite(previousTarget) ? previousTarget : 0;
    const distance = Math.abs(target - from);
    const duration = (!enabled || reduceMotion || distance === 0) ? 0 : Math.min(maxDuration, baseDuration + Math.log10(distance + 1) * perMagnitude);
    const start = performance.now();
    const formatter = numberFormat;
    element.dataset.countTarget = String(Math.round(target));
    element.classList.add('count-up-active');
    if (!duration) {
      element.textContent = formatter.format(Math.round(target));
      element.classList.remove('count-up-active');
      return;
    }
    const frame = now => {
      const progress = Math.min(1, (now - start) / duration);
      // Ease-out: moves quickly at first and gently settles near the target.
      const eased = 1 - Math.pow(1 - progress, easePower);
      const current = from + (target - from) * eased;
      element.textContent = formatter.format(Math.round(current));
      if (progress < 1) animationFrames.set(element, requestAnimationFrame(frame));
      else {
        element.textContent = formatter.format(Math.round(target));
        element.classList.remove('count-up-active');
        animationFrames.delete(element);
      }
    };
    animationFrames.set(element, requestAnimationFrame(frame));
  }
  function setStat(name, value) {
    document.querySelectorAll(`[data-stat="${name}"]`).forEach(element => animateCount(element, value));
  }
  function setStatsNote(message, state = 'info') {
    const note = document.querySelector('[data-stats-note]');
    if (!note) return;
    note.dataset.state = state;
    note.innerHTML = `<span class="live-dot"></span> ${escapeHtml(message)}`;
  }
  function setBackendStatUnavailable() {
    document.querySelectorAll('[data-stat="servers"]').forEach(el => { el.textContent = '—'; el.removeAttribute('title'); });
    document.querySelectorAll('[data-public-status]').forEach(el => { el.textContent = 'Ready for your community'; el.classList.remove('offline'); });
    setStatsNote('Statistics are temporarily unavailable. Please check back soon.', 'info');
  }

  async function loadOverview() {
    const stats = document.querySelectorAll('[data-stat]');
    if (!stats.length) return;
    try {
      const data = await api('/public/api/overview');
      const liveStats = data.stats || {};
      ['servers', 'publicServers', 'members', 'commands'].forEach(name => {
        if (Number.isFinite(Number(liveStats[name]))) setStat(name, Number(liveStats[name]));
      });
      document.querySelectorAll('[data-bot-name]').forEach(el => { el.textContent = data.brand?.name || 'Auralis'; });
      document.querySelectorAll('[data-invite]').forEach(el => { el.href = data.invite || addInvite(); });
      document.querySelectorAll('[data-discord]').forEach(el => { el.href = safeExternalUrl(data.links?.discord) || cfg.supportInvite || '#'; });
      const status = document.querySelector('[data-public-status]');
      if (status) {
        status.textContent = data.bot?.online ? 'Online' : 'Bot offline';
        status.classList.toggle('offline', !data.bot?.online);
      }
      setStatsNote(`Live statistics updated${data.generatedAt ? ` · ${new Date(data.generatedAt).toLocaleTimeString()}` : ''}.`, 'success');
    } catch (error) {
      if (!apiBase && isGitHubPages) setBackendStatUnavailable();
      else {
        document.querySelectorAll('[data-public-status]').forEach(el => { el.textContent = 'Unavailable'; el.classList.add('offline'); });
        document.querySelectorAll('[data-stat="servers"]').forEach(el => { el.textContent = '—'; });
        setStatsNote('Live statistics are temporarily unavailable. Showing any available static website data.', 'warning');
      }
    }
  }

  function renderServerSkeletons(grid, count = 6) {
    grid.innerHTML = Array.from({ length: count }, () => `<article class="server-card skeleton-card"><div class="server-body"><div class="server-top"><span class="skeleton avatar"></span><div style="flex:1"><span class="skeleton line wide"></span><span class="skeleton line short"></span></div></div><span class="skeleton block"></span><span class="skeleton block small"></span></div></article>`).join('');
  }
  function updateServerCountLabel(visible, total) {
    const label = document.querySelector('[data-server-result-count]');
    if (label) label.textContent = `${visible} of ${total} ${total === 1 ? 'server' : 'servers'}`;
  }
  function renderServers() {
    const grid = document.querySelector('[data-server-grid]');
    if (!grid) return;
    const search = String(document.querySelector('[data-server-search]')?.value || '').trim().toLowerCase();
    const sort = document.querySelector('[data-server-sort]')?.value || cfg.defaultSort || 'largest';
    const filtered = serverStore.filter(server => `${server.name || ''} ${server.description || ''}`.toLowerCase().includes(search));
    filtered.sort((a, b) => {
      if (sort === 'name') return String(a.name || '').localeCompare(String(b.name || ''));
      if (sort === 'smallest') return Number(a.members || 0) - Number(b.members || 0);
      return Number(b.members || 0) - Number(a.members || 0);
    });
    updateServerCountLabel(filtered.length, serverStore.length);
    if (!filtered.length) {
      const emptyCopy = serverStore.length
        ? 'No servers match your search. Try another name or description.'
        : (apiBase ? 'No public servers have been listed yet. A server owner can enable public listing in the Auralis dashboard.' : 'No public communities are listed yet. Server owners can choose to share their community in Auralis.');
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1">${escapeHtml(emptyCopy)}</div>`;
      return;
    }
    const limit = Number(cfg.publicServerLimit || 48);
    const fallback = cfg.publicServerDescriptionFallback || 'No public description provided.';
    grid.innerHTML = filtered.slice(0, limit).map(server => {
      const invite = safeExternalUrl(server.invite);
      const join = invite ? `<a class="btn btn-primary btn-small" href="${escapeHtml(invite)}" target="_blank" rel="noopener noreferrer">Join ↗</a>` : `<span class="pill muted-pill">Invite unavailable</span>`;
      const icon = /^https:\/\//i.test(String(server.icon || '')) ? server.icon : staticSiteUrl('assets/auralis-logo.png');
      const badge = server.verified ? 'Verified' : (server.partnered ? 'Partnered' : 'Public');
      return `<article class="server-card fade-in"><div class="server-body"><div class="server-top"><img class="server-icon" data-server-icon src="${escapeHtml(icon)}" alt="${escapeHtml(server.name || 'Server')} icon" loading="lazy"><div class="server-head-copy"><div class="server-name" title="${escapeHtml(server.name || 'Unnamed server')}">${escapeHtml(server.name || 'Unnamed server')}</div><div class="server-members">${Number(server.members || 0).toLocaleString()} members</div></div></div><div class="server-desc-wrap"><p class="server-desc">${escapeHtml(server.description || fallback)}</p></div><div class="server-actions"><span class="pill">${escapeHtml(badge)}</span>${join}</div></div></article>`;
    }).join('');
    grid.querySelectorAll('[data-server-icon]').forEach(image => {
      image.addEventListener('error', () => {
        if (image.dataset.fallbackApplied === 'true') return;
        image.dataset.fallbackApplied = 'true';
        image.src = staticSiteUrl('assets/auralis-logo.png');
        image.classList.add('server-icon-fallback');
      }, { once: true });
    });
  }
  async function loadServers() {
    const grid = document.querySelector('[data-server-grid]');
    if (!grid) return;
    renderServerSkeletons(grid);
    let servers = [];
    try {
      if (apiBase || !isGitHubPages) {
        const response = await api('/public/api/servers');
        servers = Array.isArray(response.servers) ? response.servers : [];
        publicServerDataFromApi = true;
      }
    } catch {}
    if (!servers.length) {
      try {
        const response = await fetch(staticSiteUrl('data/servers.json'), { cache: 'no-store' });
        if (response.ok) servers = (await response.json()).servers || [];
      } catch {}
    }
    serverStore = Array.isArray(servers) ? servers : [];
    renderServers();
    // Static server listings can supply public metrics, but never the total installed-server count.
    if (!publicServerDataFromApi && serverStore.length) {
      setStat('publicServers', serverStore.length);
      setStat('members', serverStore.reduce((sum, server) => sum + Math.max(0, Number(server.members || 0)), 0));
    }
  }

  async function loadCommands() {
    const root = document.querySelector('[data-command-list]');
    if (!root) return;
    let catalog = [];
    try {
      if (apiBase || !isGitHubPages) {
        const data = await api('/public/api/commands');
        catalog = Array.isArray(data.catalog) ? data.catalog : Object.entries(data.groups || {}).flatMap(([group, names]) => names.map(item => typeof item === 'string' ? ({ name: item, group, usage: (group === 'prefix' ? '.' : '/') + item, description: `Use ${(group === 'prefix' ? '.' : '/') + item} to ${item.replace(/[-_]/g, ' ')}.` }) : ({ ...item, group })));
      }
    } catch {}
    if (!catalog.length) {
      try {
        const response = await fetch(staticSiteUrl('data/commands.json'), { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          catalog = Object.entries(data.groups || {}).flatMap(([group, list]) => list.map(item => ({ ...item, group })));
        }
      } catch {}
    }
    if (!catalog.length) {
      root.innerHTML = '<div class="empty">The command catalogue could not be loaded. Please refresh the page or check the website deployment.</div>';
      const total = document.querySelector('[data-command-total]');
      if (total) total.textContent = 'Catalogue unavailable';
      return;
    }

    const staticUsageDescriptions = {
      '/tickets list': 'List open support tickets for the selected server, including each ticket channel, owner and type.',
      '/tickets panel [panel]': 'Send a saved ticket panel to the current channel. Provide a panel name or ID, or leave it blank to use the default panel.',
      '/tickets stats': 'Show how many tickets have been tracked and how many are currently open.',
      '/tickets leaderboard': 'Show staff members ranked by the number of tickets they have closed.',
      '/applications panel [panel]': 'Post an application panel so members can open one of the configured forms. Optionally select a saved panel name or ID.',
      '/applications list [status]': 'List application submissions. Optionally filter by their current review status.',
      '/applications review <id> <action> [reason]': 'Review a submission by its ID, choose the decision/action shown by Discord, and optionally explain the decision.',
      '/staffactivity panel [channel]': 'Send the staff activity check panel in the selected channel, or use the configured default channel.',
      '/staffactivity check [user]': 'Show the activity summary for a staff member. Leave the user blank to inspect your own activity.',
      '/staffactivity leaderboard [page]': 'Show staff activity rankings. Choose a page number to browse more entries.',
      '/autorole add <role>': 'Add a role that Auralis gives to new members when they join the server.',
      '/autorole remove <role>': 'Remove a role from the automatic-role list without deleting the Discord role itself.',
      '/autorole list': 'List every role currently configured as an automatic role.',
      '/autorole reset': 'Clear the automatic-role configuration for this server.',
      '/reactionrole add <msg> <emoji> <role>': 'Link a reaction on a bot message to a server role. Provide the message ID, emoji and role.',
      '/reactionrole remove <msg> <emoji>': 'Remove one reaction-to-role mapping for the specified message and emoji.',
      '/reactionrole removeall <msg>': 'Remove every reaction-role mapping attached to the specified message.',
      '/reactionrole list': 'List the reaction-role mappings configured for this server.',
      '/buttonrole add <msg> <role> [style] [emoji] [label]': 'Add a role button to a bot message. Choose the message ID and role; style, emoji and label are optional.',
      '/buttonrole remove <msg> <index>': 'Remove one role button by its position on the specified message.',
      '/buttonrole removeall <msg>': 'Remove all saved role buttons for the specified message.',
      '/buttonrole list': 'List the configured role buttons.',
      '/tag get <name>': 'Display the saved text for a tag name.', '/tag add <name> <content>': 'Create or replace a reusable named text tag.',
      '/tag edit <name> <content>': 'Change the text stored in an existing tag.', '/tag remove <name>': 'Delete a saved tag.', '/tag list': 'List saved tag names for this server.',
      '/customcmd add <name> <reply>': 'Create a custom prefix command that replies with the text you provide.', '/customcmd remove <name>': 'Delete a custom prefix command.', '/customcmd list': 'List custom prefix commands available in this server.',
      '/sticky set <text>': 'Set the sticky message for the current channel.', '/sticky remove': 'Remove the sticky message from the current channel.', '/sticky list': 'List channels that currently have sticky messages.',
      '/counter add <channel> <metric>': 'Create a live counter in the selected channel for a supported server metric.', '/counter remove <channel>': 'Remove the configured counter for the selected channel.', '/counter list': 'List the live counter channels configured for this server.',
      '/webhook create <name>': 'Create a webhook in the current channel with the supplied name.', '/webhook list': 'List webhook entries that Auralis can manage in this server.', '/webhook delete <id>': 'Delete the selected webhook by ID after confirmation.', '/webhook send <id> <message>': 'Send a message through a configured webhook.',
      '/template view': 'Show the current moderation and event response templates.', '/template set <event> <message>': 'Set the message template for the selected event. Placeholders are replaced when the event occurs.', '/template reset <event>': 'Restore the default message template for the selected event.',
      '/giveaways start': 'Start a giveaway using its configured prize, duration and winner settings.', '/giveaways end': 'End an active giveaway and select winners immediately.', '/giveaways reroll': 'Choose a replacement winner for a completed giveaway.', '/giveaways cancel': 'Cancel an active giveaway without drawing a winner.', '/giveaways list': 'List active and recent giveaways.', '/giveaways edit': 'Edit supported settings of an existing giveaway.',
      '/warn <user> <reason>': 'Choose the member to warn and enter a clear reason. Auralis records a warning case and reports whether the member could be sent a DM.',
      '/ban <user> [reason]': 'Choose the member to ban. The reason is optional but is recommended because it appears in the moderation history.',
      '/unban <user_id>': 'Enter the banned user’s numeric Discord ID to remove their active server ban.',
      '/tempban <user> <duration> <reason>': 'Choose the member, enter a duration such as 2h or 7d, and include the reason. Auralis schedules the ban to expire.',
      '/kick <user> [reason]': 'Choose the server member to remove. You may include a reason for the moderation log.',
      '/mute <user> <duration> [reason]': 'Choose a member and a timeout duration; add a reason to keep the action clear in the case history.',
      '/tempmute <user> <duration> [reason]': 'Apply a temporary Discord timeout for the selected member and duration. Discord limits timeouts to 28 days.',
      '/unmute <user>': 'Choose the member whose active Discord timeout should be removed.',
      '/unwarn <warning_id> [reason]': 'Enter the ID of one active warning to remove. The audit history is preserved; a reason can be added.',
      '/purge <amount>': 'Enter how many recent messages Auralis should remove from the current channel. Discord limits bulk deletion of older messages.',
      '/panel send <type> [channel] [panel]': 'Choose the type of panel to send. Channel and saved panel name are optional; without them Auralis uses the current channel and default panel.',
      '/help [category] [page]': 'Choose a category and page if needed. Required values use <angle brackets>; optional values use [square brackets].',
      '.lyrics <song>': 'Enter a song title and optionally the artist to search for lyrics.', '.math <expression>': 'Enter an arithmetic expression, for example (12 + 8) / 2. Only numeric arithmetic and parentheses are accepted.', '.qr <text-or-url>': 'Enter text or a URL to generate a QR code.', '.say <message>': 'Enter the exact text Auralis should post. This is restricted to staff with the required permissions.', '.reverse <text>': 'Enter text and Auralis will send it in reverse order.', '.mock <text>': 'Enter text and Auralis will alternate letter casing.', '.choose <option 1> | <option 2> [...]': 'List two or more choices separated by vertical bars; Auralis randomly picks one.', '.8ball <question>': 'Ask a question and Auralis returns a playful eight-ball response.'
    };
    const toUsages = value => String(value || '').split(/\s+(?:·|—|–)\s+/).map(part => part.trim()).filter(Boolean);
    catalog = catalog.flatMap(item => {
      const usages = toUsages(item.usage || `/${item.name || 'command'}`);
      return usages.map(usage => ({
        ...item,
        group: usage.startsWith('.') ? 'prefix' : (item.group || 'utility'),
        kind: usage.startsWith('.') ? 'prefix' : (item.kind || 'slash'),
        name: String(usage).replace(/^[/.]/, ''),
        usage,
        description: staticUsageDescriptions[usage] || item.description || 'Command details are not available yet.'
      }));
    });
    const labels = { support: 'Support', moderation: 'Moderation', security: 'Security', community: 'Community', utility: 'Utility', prefix: 'Prefix commands' };
    const categories = [...new Set(catalog.map(item => item.group || 'utility'))];
    const categorySelect = document.querySelector('[data-command-category]');
    const pageSizeSelect = document.querySelector('[data-command-page-size]');
    const search = document.querySelector('[data-command-search-input]');
    const totalLabel = document.querySelector('[data-command-total]');
    const pager = document.querySelector('[data-command-pagination]');
    let page = 1;
    if (categorySelect && categorySelect.options.length <= 1) {
      categorySelect.innerHTML = '<option value="all">All categories</option>' + categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(labels[category] || category)}</option>`).join('');
    }
    const render = () => {
      const query = String(search?.value || '').toLocaleLowerCase().trim();
      const category = String(categorySelect?.value || 'all');
      const pageSize = Math.min(50, Math.max(15, Number(pageSizeSelect?.value || 20)));
      const filtered = catalog.filter(item => {
        const group = item.group || 'utility';
        if (category !== 'all' && group !== category) return false;
        const haystack = `${item.name || ''} ${item.usage || ''} ${item.description || ''} ${group}`.toLocaleLowerCase();
        return !query || haystack.includes(query);
      });
      const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
      page = Math.min(Math.max(1, page), pages);
      const startIndex = (page - 1) * pageSize;
      const visible = filtered.slice(startIndex, startIndex + pageSize);
      root.innerHTML = visible.length ? `<div class="command-list">${visible.map(item => {
        const group = item.group || 'utility';
        return `<article class="command-row fade-in"><div class="command-main"><div class="command-usages"><code class="command-chip">${escapeHtml(item.usage || `/${item.name || 'command'}`)}</code></div><span class="command-category-chip">${escapeHtml(labels[group] || group)}</span></div><div class="command-description">${escapeHtml(item.description || 'Command details are not available yet.')}</div></article>`;
      }).join('')}</div>` : '<div class="empty">No commands match your search. Try a different keyword or category.</div>';
      if (totalLabel) totalLabel.textContent = filtered.length ? `${startIndex + 1}–${Math.min(startIndex + pageSize, filtered.length)} of ${filtered.length} commands` : '0 commands found';
      if (pager) {
        pager.innerHTML = filtered.length > pageSize ? `<span class="command-page-summary">Page ${page} of ${pages}</span><div class="command-page-actions"><button class="btn btn-ghost" data-page-step="-1" ${page <= 1 ? 'disabled' : ''}>← Previous</button><button class="btn btn-ghost" data-page-step="1" ${page >= pages ? 'disabled' : ''}>Next →</button></div>` : `<span class="command-page-summary">${filtered.length ? `Showing all ${filtered.length} matching commands` : 'Adjust the filters to see commands'}</span>`;
        pager.querySelectorAll('[data-page-step]').forEach(button => button.addEventListener('click', () => {
          page += Number(button.dataset.pageStep || 0);
          render();
          document.querySelector('.command-tools-rich')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }));
      }
    };
    if (totalLabel) totalLabel.textContent = `${catalog.length} commands`;
    setStat('commands', catalog.length);
    search?.addEventListener('input', () => { page = 1; render(); });
    categorySelect?.addEventListener('change', () => { page = 1; render(); });
    pageSizeSelect?.addEventListener('change', () => { page = 1; render(); });
    render();
  }

  async function loadStatus() {
    const panels = document.querySelectorAll('[data-status-panel]');
    const anyStatus = panels.length || document.querySelectorAll('[data-status-label],[data-service-status]').length;
    if (!anyStatus) return;
    if (!apiBase && isGitHubPages) {
      document.querySelectorAll('[data-status-label]').forEach(el => el.textContent = 'Not configured');
      document.querySelectorAll('[data-status-sub]').forEach(el => el.textContent = 'Temporarily unavailable');
      document.querySelectorAll('[data-service-status]').forEach(el => el.textContent = 'Unavailable');
      document.querySelectorAll('[data-status-checked]').forEach(el => el.textContent = '—');
      panels.forEach(panel => panel.classList.add('is-unconfigured'));
      return;
    }
    try {
      const data = await api('/public/api/status');
      const online = data.status === 'Online';
      document.querySelectorAll('[data-status-label]').forEach(el => el.textContent = data.status);
      document.querySelectorAll('[data-status-sub]').forEach(el => el.textContent = online ? 'Service operating normally' : 'Bot is not responding');
      document.querySelectorAll('[data-status-checked]').forEach(el => el.textContent = data.checkedAt ? new Date(data.checkedAt).toLocaleTimeString() : new Date().toLocaleTimeString());
      panels.forEach(panel => { panel.classList.toggle('is-offline', !online); panel.classList.remove('is-unconfigured'); });
      document.querySelectorAll('[data-service-status]').forEach(el => el.textContent = 'Operational API');
    } catch {
      panels.forEach(panel => panel.classList.add('is-offline'));
      document.querySelectorAll('[data-status-label]').forEach(el => el.textContent = 'Unavailable');
      document.querySelectorAll('[data-status-sub]').forEach(el => el.textContent = 'Could not reach the Auralis API');
      document.querySelectorAll('[data-service-status]').forEach(el => el.textContent = 'Unavailable');
    }
  }
  function wireCommon() {
    ensureAccountControls();
    if (cfg.showLiveStatus === false) {
      document.querySelectorAll('[data-public-status]').forEach(el => {
        const wrapper = el.closest('.status-copy');
        if (wrapper) wrapper.hidden = true; else el.hidden = true;
      });
    }
    document.querySelectorAll('[data-invite]').forEach(el => { el.href = addInvite(); if (el.href === '#') el.setAttribute('aria-disabled', 'true'); });
    document.querySelectorAll('[data-login]').forEach(el => { el.href = loginUrl(); });
    document.querySelectorAll('[data-dashboard-link]').forEach(el => {
      el.href = accountProfile?.user?.id ? manageServersUrl() : loginUrl();
    });
    document.querySelectorAll('[data-discord]').forEach(el => { if (!el.href || el.getAttribute('href') === '#') el.href = cfg.supportInvite || '#'; });
    document.querySelectorAll('[data-menu-toggle]').forEach(button => {
      button.addEventListener('click', () => {
        const nav = button.closest('.nav')?.querySelector('[data-nav-links]');
        if (!nav) return;
        const open = nav.classList.toggle('is-open');
        button.setAttribute('aria-expanded', String(open));
        button.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      });
    });
  }
  async function bootPublic() {
    wireCommon();
    document.documentElement.classList.add('site-loading');
    requestAnimationFrame(() => setTimeout(() => document.documentElement.classList.remove('site-loading'), 320));
    await initializeAccount();
    document.querySelectorAll('[data-dashboard-link]').forEach(el => { el.href = accountProfile?.user?.id ? manageServersUrl() : loginUrl(); });
    await Promise.all([loadOverview(), loadServers(), loadCommands(), loadStatus()]);
    if (cfg.showLiveStatus && document.querySelector('[data-status-panel]')) setInterval(loadStatus, Math.max(15000, Number(cfg.statusRefreshMs || 30000)));
    if (apiBase && Number(cfg.statsRefreshMs) > 0 && document.querySelector('[data-stat]')) {
      setInterval(() => { if (!document.hidden) loadOverview(); }, Math.max(15000, Number(cfg.statsRefreshMs)));
    }
    const search = document.querySelector('[data-server-search]');
    const sort = document.querySelector('[data-server-sort]');
    const grid = document.querySelector('[data-server-grid]');
    if (sort && cfg.defaultSort) sort.value = cfg.defaultSort;
    search?.addEventListener('input', renderServers);
    sort?.addEventListener('change', renderServers);
    // Re-render when a browser restores the page from its back-forward cache.
    window.addEventListener('pageshow', () => { if (grid && serverStore.length) renderServers(); });
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
