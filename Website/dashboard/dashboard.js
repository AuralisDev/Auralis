(() => {
  'use strict';

  const siteConfig = window.AURALIS_CONFIG || {};
  const apiBase = String(siteConfig.apiBase || '').replace(/\/$/, '');
  const page = document.body.dataset.page || 'overview';
  const params = new URLSearchParams(window.location.search);

  let selectedGuild = params.get('guild') || localStorage.getItem('auralis:selected-guild') || '';
  let guildData = null;
  let resources = { channels: [], roles: [] };
  let access = { level: 'none', permissions: [] };
  let currentUser = null;
  Object.defineProperty(window, 'AuralisDashboardContext', {
    configurable: true,
    get: () => ({ guildId: selectedGuild, resources, config: guildData?.config || null })
  });
  let liveRefreshTimer = null;
  let liveRefreshInFlight = false;
  let currentStaffRange = '7d';

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));

  async function api(path, options = {}) {
    const response = await fetch(`${apiBase}${path}`, {
      credentials: 'include',
      ...options,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    const contentType = response.headers.get('content-type') || '';
    const raw = await response.text();
    let data = raw;
    if (raw && (contentType.includes('json') || /^[\s]*[\[{]/.test(raw))) {
      try { data = JSON.parse(raw); }
      catch {
        if (/^\s*<!doctype html|^\s*<html[\s>]/i.test(raw)) throw new Error('The dashboard API returned an HTML page instead of JSON. Check the API URL and make sure the Auralis dashboard backend is running.');
        throw new Error('The dashboard API returned malformed JSON. Check the backend logs and try again.');
      }
    }
    if (/^\s*<!doctype html|^\s*<html[\s>]/i.test(String(data ?? ''))) throw new Error('The dashboard API returned a website page instead of API data. Configure the dashboard API URL and restart the backend.');
    if (!response.ok) throw new Error(data?.error || data?.message || data || `Request failed (${response.status})`);
    return data;
  }

  function formatDateTime(value, dateOnly = false) {
    const date = value instanceof Date ? value : new Date(Number.isFinite(Number(value)) ? Number(value) : value);
    if (Number.isNaN(date.getTime())) return '—';
    const prefs = guildData?.config?.dashboardPreferences || {};
    const options = dateOnly ? { dateStyle: 'medium', timeZone: prefs.timeZone || 'Europe/Berlin' } : { dateStyle: 'medium', timeStyle: 'short', timeZone: prefs.timeZone || 'Europe/Berlin' };
    try { return date.toLocaleString(prefs.locale || 'en-GB', options); }
    catch { return date.toLocaleString('en-GB', options); }
  }

  function getPath(object, path) {
    return String(path).split('.').reduce((value, key) => value?.[key], object);
  }

  function setPath(object, path, value) {
    const keys = String(path).split('.');
    let cursor = object;
    keys.forEach((key, index) => {
      if (index === keys.length - 1) {
        cursor[key] = value;
        return;
      }
      const nextKey = keys[index + 1];
      const needsArray = /^\d+$/.test(nextKey);
      if (!cursor[key] || typeof cursor[key] !== 'object' || (needsArray && !Array.isArray(cursor[key])) || (!needsArray && Array.isArray(cursor[key]))) cursor[key] = needsArray ? [] : {};
      cursor = cursor[key];
    });
    return object;
  }

  function homepageUrl() {
    return `${String(siteConfig.siteUrl || 'https://auralisdev.github.io/Auralis/').replace(/\/$/, '')}/`;
  }

  function loginUrl() {
    if (apiBase) return `${apiBase}/auth/discord?return_to=${encodeURIComponent(`${homepageUrl()}#manage-servers`)}`;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return '/auth/discord';
    return `${homepageUrl()}setup.html`;
  }

  function toast(message) {
    let stack = document.querySelector('[data-toast-stack]');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      stack.dataset.toastStack = '';
      stack.setAttribute('aria-live', 'polite');
      stack.setAttribute('aria-relevant', 'additions text');
      document.body.appendChild(stack);
    }
    const node = document.createElement('div');
    node.className = 'toast';
    node.setAttribute('role', 'status');
    node.textContent = message;
    stack.appendChild(node);
    setTimeout(() => { node.remove(); if (!stack.childElementCount) stack.remove(); }, 3200);
  }

  window.AuralisConfirmDestructive = (message, options = {}) => new Promise(resolve => {
    if (!options.force && guildData?.config?.dashboardPreferences?.confirmDestructiveActions === false) return resolve(true);
    const prior = document.querySelector('[data-confirm-backdrop]');
    prior?.remove();
    const backdrop = document.createElement('div');
    backdrop.className = 'confirm-backdrop';
    backdrop.dataset.confirmBackdrop = '';
    const dialog = document.createElement('section');
    dialog.className = 'confirm-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    const title = document.createElement('h2');
    title.textContent = options.title || 'Are you sure?';
    const copy = document.createElement('p');
    copy.textContent = message || 'This action cannot be undone. Continue?';
    dialog.append(title, copy);
    let typed = null;
    if (options.requireText) {
      const field = document.createElement('div');
      field.className = 'field';
      const label = document.createElement('label');
      label.textContent = options.requireTextLabel || `Type ${options.requireText} to confirm`;
      label.htmlFor = 'auralis-confirm-input';
      typed = document.createElement('input');
      typed.id = 'auralis-confirm-input';
      typed.autocomplete = 'off';
      typed.spellcheck = false;
      typed.placeholder = String(options.requireText);
      typed.addEventListener('input', updateConfirm);
      field.append(label, typed);
      dialog.appendChild(field);
    }
    const actions = document.createElement('div');
    actions.className = 'confirm-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.className = 'button'; cancel.textContent = options.cancelLabel || 'Cancel';
    const confirm = document.createElement('button');
    confirm.type = 'button'; confirm.className = `button ${options.danger === false ? 'primary' : 'danger'}`;
    confirm.textContent = options.confirmLabel || 'Confirm';
    actions.append(cancel, confirm); dialog.appendChild(actions); backdrop.appendChild(dialog); document.body.appendChild(backdrop);
    let settled = false;
    function finish(value) { if (settled) return; settled = true; document.removeEventListener('keydown', onKey); backdrop.remove(); resolve(value); }
    function updateConfirm() { confirm.disabled = Boolean(options.requireText) && typed?.value !== String(options.requireText); }
    function onKey(event) { if (event.key === 'Escape') finish(false); if (event.key === 'Enter' && !confirm.disabled && document.activeElement !== cancel) finish(true); }
    cancel.addEventListener('click', () => finish(false));
    confirm.addEventListener('click', () => finish(true));
    backdrop.addEventListener('click', event => { if (event.target === backdrop) finish(false); });
    document.addEventListener('keydown', onKey);
    updateConfirm();
    (typed || cancel).focus();
  });

  function can(permission) {
    return access.level === 'owner' || access.permissions?.includes('*') || access.permissions?.includes(permission);
  }

  function pageUrl(file) {
    return `${file}?guild=${encodeURIComponent(selectedGuild)}`;
  }

  const modulePages = new Set(['automod', 'security', 'ticket-panels', 'reactions', 'levels', 'economy', 'giveaways', 'extras', 'misc']);

  const navGroups = [
    ['SERVER', [
      ['index.html', 'overview', 'Overview', '◉'],
      ['settings.html', 'settings', 'Server Settings', '⚙'],
      ['preferences.html', 'preferences', 'Preferences', '☷'],
      ['privacy.html', 'privacy', 'Privacy', '◈'],
      ['modules.html', 'modules', 'Modules', '▦']
    ]],
    ['MODERATION & SAFETY', [
      ['moderation.html', 'moderation', 'Moderation', '⚑'],
      ['logs.html', 'logs', 'Logs & Audit', '≡'],
      ['commands.html', 'commands', 'Commands', '⌘']
    ]],
    ['COMMUNITY & SUPPORT', [
      ['welcome.html', 'welcome', 'Welcome Designer', '✦'],
      ['tickets.html', 'tickets', 'Tickets & Support', '▢'],
      ['applications.html', 'applications', 'Applications', '▧'],
      ['staff-activity.html', 'staffactivity', 'Staff Activity', '◷'],
      ['community.html', 'community', 'Community Tools', '✣'],
      ['announcements.html', 'announcements', 'Announcements', '✉']
    ]],
    ['AUTOMATION & CUSTOMIZE', [
      ['automations.html', 'automations', 'Automations', '⟳'],
      ['custom-commands.html', 'custom-commands', 'Custom Commands', '⌘'],
      ['embeds.html', 'embeds', 'Embed Builder', '▣'],
      ['webhooks.html', 'webhooks', 'Webhooks', '↗'],
      ['responses.html', 'responses', 'Responses', '✎'],
      ['messages.html', 'messages', 'Messages & Embeds', '✉'],
      ['brand.html', 'brand', 'Branding', '✦'],
      ['panels.html', 'panels', 'Panels', '➤'],
      ['placeholders.html', 'placeholders', 'Placeholders', '{ }']
    ]]
  ];

  function renderNavigation() {
    const root = document.querySelector('[data-sidebar-nav]');
    if (!root) return;
    const groupsHtml = navGroups.map(([group, items]) => `<div class="nav-label">${esc(group)}</div><nav class="nav">${items.map(([file, key, label, icon]) => `
      <a class="${page === key || (key === 'modules' && modulePages.has(page)) ? 'active' : ''}" href="${pageUrl(file)}" data-nav-label="${esc(label.toLowerCase())}"><span class="icon" aria-hidden="true">${icon}</span><span>${esc(label)}</span></a>
    `).join('')}</nav>`).join('');
    root.innerHTML = `<label class="nav-search"><span aria-hidden="true">⌕</span><input type="search" data-nav-search placeholder="Search settings…" aria-label="Search dashboard settings"><kbd>/</kbd></label>${groupsHtml}${can('view_all_guilds') ? '<div class="nav-label">AURALIS GLOBAL</div><nav class="nav"><a class="' + (page === 'admin' ? 'active' : '') + '" href="admin.html"><span class="icon">◆</span><span>Owner Admin Panel</span></a></nav>' : ''}`;
    const search = root.querySelector('[data-nav-search]');
    search?.addEventListener('input', () => {
      const term = search.value.trim().toLowerCase();
      root.querySelectorAll('.nav a').forEach(link => { link.classList.toggle('hidden', Boolean(term) && !link.dataset.navLabel.includes(term)); });
      root.querySelectorAll('.nav-label').forEach(label => {
        const nav = label.nextElementSibling;
        if (nav?.classList.contains('nav')) label.classList.toggle('hidden', term.length > 0 && ![...nav.querySelectorAll('a')].some(a => !a.classList.contains('hidden')));
      });
    });
    search?.addEventListener('keydown', event => {
      if (event.key === 'Escape') { search.value = ''; search.dispatchEvent(new Event('input')); search.blur(); }
      if (event.key === 'Enter') root.querySelector('.nav a:not(.hidden)')?.click();
    });
    document.addEventListener('keydown', event => {
      if (event.key === '/' && !['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) { event.preventDefault(); search?.focus(); }
    }, { once: true });

    const displayName = currentUser?.global_name || currentUser?.username || 'Discord user';
    const avatarHash = String(currentUser?.avatar || '');
    const avatarExt = avatarHash.startsWith('a_') ? 'gif' : 'png';
    const avatarUrl = avatarHash && currentUser?.id ? `https://cdn.discordapp.com/avatars/${encodeURIComponent(currentUser.id)}/${encodeURIComponent(avatarHash)}.${avatarExt}?size=64` : '';
    const initials = displayName.split(/[ _.-]/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || 'A';
    document.querySelectorAll('[data-sidebar-account]').forEach(node => {
      node.innerHTML = `${avatarUrl ? `<img class="account-avatar" src="${esc(avatarUrl)}" alt="" loading="lazy">` : `<div class="account-avatar">${esc(initials)}</div>`}<div class="account-meta"><strong>${esc(displayName)}</strong><small>${access.level === 'owner' ? 'Auralis Owner' : access.level === 'staff' ? 'Global Staff' : 'Discord session'}</small></div>`;
    });
    document.querySelectorAll('[data-topbar-user]').forEach(node => { node.textContent = displayName; });
    document.querySelectorAll('[data-login]').forEach(element => { element.href = loginUrl(); });
    document.querySelectorAll('[data-logout]').forEach(element => {
      element.onclick = async (event) => {
        event.preventDefault();
        element.disabled = true;
        try { await api('/auth/logout', { method: 'POST' }); } catch {}
        localStorage.removeItem('auralis:selected-guild');
        const signedOutUrl = new URL(homepageUrl());
        signedOutUrl.searchParams.set('logged_out', '1');
        window.location.href = signedOutUrl.href;
      };
    });
  }

  async function loadGuilds() {
    const payload = await api('/api/guilds');
    const guilds = Array.isArray(payload.guilds) ? payload.guilds : [];
    const select = document.querySelector('[data-guild-select]');
    if (!select) return;

    select.innerHTML = guilds.length
      ? guilds.map((guild) => `<option value="${guild.id}">${esc(guild.name)}${guild.botInstalled ? '' : ' · Install Auralis'}</option>`).join('')
      : '<option value="">No manageable server</option>';

    if (!guilds.some((guild) => guild.id === selectedGuild)) selectedGuild = guilds[0]?.id || '';
    if (selectedGuild) {
      select.value = selectedGuild;
      localStorage.setItem('auralis:selected-guild', selectedGuild);
    }

    select.onchange = () => {
      selectedGuild = select.value;
      localStorage.setItem('auralis:selected-guild', selectedGuild);
      const currentFile = window.location.pathname.split('/').pop() || 'index.html';
      window.location.href = pageUrl(currentFile);
    };
  }

  async function loadGuild() {
    if (!selectedGuild) return false;
    const [data, sourceResources] = await Promise.all([
      api(`/api/guilds/${selectedGuild}`),
      api(`/api/guilds/${selectedGuild}/resources`).catch(() => ({ channels: [], roles: [] }))
    ]);
    guildData = data;
    resources = sourceResources || resources;
    const preferences = guildData.config?.dashboardPreferences || {};
    document.body.classList.toggle('compact-tables', Boolean(preferences.compactTables) || preferences.contentDensity === 'compact');
    document.body.classList.toggle('density-spacious', preferences.contentDensity === 'spacious');
    document.querySelectorAll('[data-guild-name]').forEach((element) => {
      element.textContent = guildData.guild?.name || 'Server';
      const topTitle = element.closest('.top-title');
      if (topTitle) {
        let icon = topTitle.querySelector('[data-current-guild-icon]');
        if (!icon) { icon = document.createElement('img'); icon.dataset.currentGuildIcon = ''; icon.className = 'current-guild-icon'; icon.alt = ''; icon.loading = 'lazy'; topTitle.prepend(icon); }
        let initial = topTitle.querySelector('[data-current-guild-initial]');
        if (!initial) { initial = document.createElement('span'); initial.dataset.currentGuildInitial = ''; initial.className = 'current-guild-initial'; initial.setAttribute('aria-hidden', 'true'); icon.after(initial); }
        const iconUrl = guildData.guild?.icon || '';
        initial.textContent = String(guildData.guild?.name || 'S').slice(0, 1).toUpperCase();
        initial.hidden = Boolean(iconUrl);
        icon.hidden = !iconUrl;
        icon.onerror = () => { icon.hidden = true; initial.hidden = false; };
        if (iconUrl && icon.src !== iconUrl) icon.src = iconUrl;
      }
    });
    document.querySelectorAll('[data-guild-members]').forEach((element) => { animateMetric(element, Number(guildData.guild?.approximateMemberCount || 0)); });
    const roleMetric = document.querySelector('[data-guild-roles]');
    const textMetric = document.querySelector('[data-guild-text-channels]');
    const voiceMetric = document.querySelector('[data-guild-voice-channels]');
    if (roleMetric) roleMetric.textContent = Number((resources.roles || []).length).toLocaleString(preferences.locale || 'en-GB');
    if (textMetric) textMetric.textContent = Number((resources.channels || []).filter(channel => [0,5,15,16].includes(Number(channel.type))).length).toLocaleString(preferences.locale || 'en-GB');
    if (voiceMetric) voiceMetric.textContent = Number((resources.channels || []).filter(channel => [2,13].includes(Number(channel.type))).length).toLocaleString(preferences.locale || 'en-GB');
    // Honour the selected landing page only when entering from the public server picker.
    if (page === 'overview' && params.get('landing') === '1') {
      const targets = { overview:'index.html', moderation:'moderation.html', tickets:'tickets.html', applications:'applications.html', logs:'logs.html', 'custom-commands':'custom-commands.html' };
      const target = targets[String(preferences.defaultDashboardPage || 'overview')];
      if (target && target !== 'index.html') { window.location.replace(pageUrl(target)); return true; }
      params.delete('landing');
      const clean = new URL(window.location.href); clean.searchParams.delete('landing'); history.replaceState({}, '', clean.href);
    }
    applyBindings();
    wireTemplatePreviews();
    const advancedConfigEditor = document.querySelector('[data-config-json]');
    if (advancedConfigEditor) { advancedConfigEditor.value = JSON.stringify(((value) => { delete value.dashboardAccess; delete value.dashboardSecurity; return value; })(structuredClone(guildData.config)), null, 2); advancedConfigEditor.dataset.loaded = 'true'; }
    bindModuleSwitches();
    wireSaveButtons();
    await renderPageSpecific();
    window.dispatchEvent(new CustomEvent('auralis:config-loaded', { detail: { guildId: selectedGuild, page } }));
    return true;
  }

  function isTextChannel(channel) {
    return [0, 5, 15, 16].includes(Number(channel?.type));
  }

  function applyBindings() {
    document.querySelectorAll('[data-bind]').forEach((element) => {
      const value = getPath(guildData.config, element.dataset.bind);
      if (element.dataset.format === 'json') {
        element.value = JSON.stringify(value ?? [], null, 2);
      } else if (element.type === 'checkbox') {
        element.checked = Boolean(value);
      } else if (element.dataset.format === 'hexcolor' && value !== undefined && value !== null) {
        const numeric = Number(value);
        element.value = `#${(Number.isFinite(numeric) ? numeric : 0x7c6cf5).toString(16).replace(/^-/, '').padStart(6, '0').slice(-6)}`;
      } else if (element instanceof HTMLSelectElement && element.multiple && Array.isArray(value)) {
        [...element.options].forEach(option => { option.selected = value.map(String).includes(option.value); });
      } else if (Array.isArray(value)) {
        element.value = value.join(', ');
      } else if (value !== undefined && value !== null) {
        element.value = String(value);
      }
    });

    document.querySelectorAll('[data-resource]').forEach((element) => {
      const resourceType = element.dataset.resource;
      const current = getPath(guildData.config, element.dataset.bind) || '';
      const list = resourceType === 'role'
        ? resources.roles
        : resources.channels.filter(isTextChannel);
      const first = resourceType === 'role' ? 'Select a role' : 'Select a channel';
      element.innerHTML = `<option value="">${first}</option>${list.map((item) => {
        const label = resourceType === 'role' ? `@ ${item.name}` : `#${item.name}`;
        return `<option value="${item.id}">${esc(label)}</option>`;
      }).join('')}`;
      if (element.multiple && Array.isArray(current)) {
        const selected = new Set(current.map(String));
        [...element.options].forEach(option => { option.selected = selected.has(option.value); });
      } else if (current && !Array.isArray(current)) element.value = String(current);
    });
  }

  function collectBindings() {
    const patch = {};
    document.querySelectorAll('[data-bind]').forEach((element) => {
      let value;
      if (element.dataset.format === 'json') {
        try { value = JSON.parse(element.value || '[]'); }
        catch { throw new Error(`The JSON in ${element.getAttribute('aria-label') || element.closest('.field')?.querySelector('label')?.textContent || 'this field'} is invalid. Fix it before saving.`); }
      } else if (element.type === 'checkbox') value = element.checked;
      else if (element instanceof HTMLSelectElement && element.multiple) value = [...element.selectedOptions].map(option => option.value).filter(Boolean);
      else if (element.dataset.format === 'hexcolor') value = Number.parseInt(String(element.value || '#7c6cf5').replace('#', ''), 16) || 0x7c6cf5;
      else if (element.type === 'number') value = Number(element.value || 0);
      else if (element.dataset.array === 'true') value = element.value.split(',').map((item) => item.trim()).filter(Boolean);
      else value = element.value;
      setPath(patch, element.dataset.bind, value);
    });
    return patch;
  }

  function wireSaveButtons() {
    document.querySelectorAll('[data-save]').forEach((button) => {
      button.onclick = async () => {
        try {
          await api(`/api/guilds/${selectedGuild}/config`, { method: 'PATCH', body: JSON.stringify(collectBindings()) });
          toast('Saved');
          await loadGuild();
        } catch (error) {
          toast(error.message);
        }
      };
    });
  }

  function wireTemplatePreviews() {
    const samples = {
      server: 'Auralis Community', user: '@ExampleMember', username: 'ExampleMember', userId: '123456789012345678',
      moderator: 'Moderator', reason: 'Example moderation reason', caseId: '1042', warningId: '56',
      warningCount: '2', activeWarnings: '2', totalWarnings: '4', warningCount: '2', duration: '7 days',
      expiresAt: '18 Oct 2026, 14:30', expiresRelative: 'in 7 days', dmStatus: 'Delivered',
      automaticAction: 'No automatic action triggered', warningCount: '2', type: 'Staff Application',
      applicationId: '18', automaticAction: 'No escalation triggered',
      channel: '#support', ticketId: '21', ticket: '#21', prize: 'Nitro', winners: '@Winner', level: '5'
    };
    document.querySelectorAll('textarea[data-bind]').forEach(textarea => {
      const path = textarea.dataset.bind || '';
      if (!/Template|Message|Description/i.test(path)) return;
      if (textarea.dataset.previewAttached === 'true') return;
      if (textarea.closest('[data-config-json]')) return;
      textarea.dataset.previewAttached = 'true';
      const preview = document.createElement('div');
      preview.className = 'template-preview';
      preview.innerHTML = '<div class="template-preview-head"><span>Live preview</span><span>Sample data · not sent</span></div><div class="template-preview-body"></div>';
      textarea.insertAdjacentElement('afterend', preview);
      const body = preview.querySelector('.template-preview-body');
      const update = () => {
        const raw = textarea.value || '';
        body.textContent = raw.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (all, key) => Object.prototype.hasOwnProperty.call(samples, key) ? samples[key] : all);
        body.classList.toggle('empty', !raw.trim());
        if (!raw.trim()) body.textContent = 'Enter a response above to preview how placeholders will look.';
      };
      textarea.addEventListener('input', update);
      update();
    });
  }

  async function renderWebhookManager() {
    if (page !== 'webhooks' || !selectedGuild) return;
    const channelSelect = document.querySelector('[data-webhook-channel]');
    const nameInput = document.querySelector('[data-webhook-name]');
    const createButton = document.querySelector('[data-webhook-create]');
    const refreshButton = document.querySelector('[data-webhook-refresh]');
    const list = document.querySelector('[data-webhook-list]');
    const count = document.querySelector('[data-webhook-count]');
    const result = document.querySelector('[data-webhook-result]');
    if (!channelSelect || !createButton || !list) return;
    const textChannels = (resources.channels || []).filter(channel => [0, 5].includes(Number(channel.type)));
    const selectedBefore = channelSelect.value;
    channelSelect.innerHTML = '<option value="">Choose a channel…</option>' + textChannels.map(channel => `<option value="${esc(channel.id)}">#${esc(channel.name)}</option>`).join('');
    if (textChannels.some(channel => channel.id === selectedBefore)) channelSelect.value = selectedBefore;
    const channelById = new Map(textChannels.map(channel => [String(channel.id), channel]));
    let loading = false;
    const load = async () => {
      if (loading) return;
      loading = true;
      if (refreshButton) refreshButton.disabled = true;
      try {
        const payload = await api(`/api/guilds/${selectedGuild}/webhooks`);
        const hooks = Array.isArray(payload.webhooks) ? payload.webhooks : [];
        if (count) count.textContent = `${hooks.length} webhook${hooks.length === 1 ? '' : 's'}`;
        list.innerHTML = hooks.map(hook => {
          const channel = channelById.get(String(hook.channelId));
          return `<article class="webhook-item"><div class="webhook-icon" aria-hidden="true">🪝</div><div class="webhook-meta"><strong>${esc(hook.name || 'Unnamed webhook')}</strong><small>Hook ID · ${esc(hook.id)}</small><small>Channel · ${channel ? `#${esc(channel.name)}` : `ID ${esc(hook.channelId || 'unknown')}`}</small>${hook.user?.username ? `<small>Created by · ${esc(hook.user.username)}</small>` : ''}</div><button type="button" class="button danger small" data-webhook-delete="${esc(hook.id)}">Delete</button></article>`;
        }).join('') || '<div class="empty-state">No webhooks found for this server. Create one on the left to get started.</div>';
        list.querySelectorAll('[data-webhook-delete]').forEach(button => {
          button.onclick = async () => {
            const webhookId = button.dataset.webhookDelete;
            if (!(await window.AuralisConfirmDestructive(`Delete webhook ${webhookId}? Messages sent through it may be affected by your own external integrations.`, { title: 'Delete webhook?', confirmLabel: 'Delete webhook' }))) return;
            button.disabled = true;
            try {
              await api(`/api/guilds/${selectedGuild}/webhooks/${encodeURIComponent(webhookId)}`, { method: 'DELETE' });
              if (result) result.textContent = 'Webhook deleted.';
              toast('Webhook deleted');
              await load();
            } catch (error) { if (result) result.textContent = error.message; toast(error.message); button.disabled = false; }
          };
        });
      } catch (error) {
        list.innerHTML = `<div class="empty-state error-card">${esc(error.message)}<br><small>Auralis needs Manage Webhooks permission in Discord to list or edit webhooks.</small></div>`;
        if (count) count.textContent = 'Unavailable';
      } finally { loading = false; if (refreshButton) refreshButton.disabled = false; }
    };
    createButton.onclick = async () => {
      const channelId = channelSelect.value;
      const name = String(nameInput?.value || '').trim();
      if (!channelId) return toast('Choose a text channel first.');
      if (name.length < 2) return toast('Enter a webhook name with at least two characters.');
      createButton.disabled = true;
      if (result) result.textContent = 'Creating webhook…';
      try {
        const payload = await api(`/api/guilds/${selectedGuild}/webhooks`, { method: 'POST', body: JSON.stringify({ channelId, name }) });
        if (result) result.textContent = `Created “${payload.webhook?.name || name}” in #${channelById.get(channelId)?.name || 'selected channel'}.`;
        toast('Webhook created');
        await load();
      } catch (error) { if (result) result.textContent = error.message; toast(error.message); }
      finally { createButton.disabled = false; }
    };
    if (refreshButton) refreshButton.onclick = () => void load();
    await load();
  }

  async function renderBotProfileSettings() {
    if (page !== 'settings' || !selectedGuild) return;
    const input = document.querySelector('[data-bot-nickname]');
    const result = document.querySelector('[data-bot-nickname-result]');
    const save = document.querySelector('[data-bot-nickname-save]');
    const reset = document.querySelector('[data-bot-nickname-reset]');
    if (!input || !save) return;
    try {
      const payload = await api(`/api/guilds/${selectedGuild}/bot-profile`);
      input.value = payload.nickname || '';
      const username = document.querySelector('[data-bot-username]');
      if (username) username.textContent = payload.username || 'Auralis';
      if (result) result.textContent = 'Current server nickname loaded from Discord.';
    } catch (error) { if (result) result.textContent = `Nickname could not be loaded: ${error.message}`; }
    const doSave = async nickname => {
      save.disabled = true; if (reset) reset.disabled = true;
      try {
        const out = await api(`/api/guilds/${selectedGuild}/bot-profile`, { method: 'PATCH', body: JSON.stringify({ nickname }) });
        input.value = out.nickname || '';
        if (result) result.textContent = out.message || 'Nickname updated in Discord.';
        toast(out.message || 'Bot nickname updated');
      } catch (error) { if (result) result.textContent = error.message; toast(error.message); }
      finally { save.disabled = false; if (reset) reset.disabled = false; }
    };
    save.onclick = () => doSave(input.value.trim());
    if (reset) reset.onclick = () => { input.value = ''; void doSave(''); };
  }

  function bindModuleSwitches() {
    const modules = guildData?.config?.modules || {};
    document.querySelectorAll('[data-module-toggle]').forEach((button) => {
      const enabled = modules[button.dataset.moduleToggle] !== false;
      button.classList.toggle('on', enabled);
      button.setAttribute('aria-pressed', String(enabled));
      if (!button.querySelector('i')) button.innerHTML = '<i></i>';
      button.onclick = async () => {
        const next = !button.classList.contains('on');
        button.disabled = true;
        try {
          await api(`/api/guilds/${selectedGuild}/config`, {
            method: 'PATCH',
            body: JSON.stringify({ modules: { [button.dataset.moduleToggle]: next } })
          });
          button.classList.toggle('on', next);
          button.setAttribute('aria-pressed', String(next));
          toast(next ? 'Module enabled for this server' : 'Module disabled for this server');
        } catch (error) {
          toast(error.message);
        } finally { button.disabled = false; }
      };
    });
    document.querySelectorAll('[data-module-config]').forEach(anchor => {
      const file = anchor.getAttribute('href')?.split('?')[0] || 'index.html';
      anchor.href = pageUrl(file);
    });
    const search = document.querySelector('[data-module-search]');
    const category = document.querySelector('[data-module-category-filter]');
    const count = document.querySelector('[data-module-count]');
    const filterCards = () => {
      const term = String(search?.value || '').trim().toLowerCase();
      const cat = String(category?.value || 'all');
      let visible = 0;
      document.querySelectorAll('[data-module-card]').forEach(card => {
        const show = (!term || String(card.dataset.moduleName || '').includes(term) || String(card.textContent || '').toLowerCase().includes(term)) && (cat === 'all' || card.dataset.moduleCategory === cat);
        card.classList.toggle('hidden', !show);
        if (show) visible++;
      });
      if (count) count.textContent = `${visible} module${visible === 1 ? '' : 's'}`;
    };
    if (search && !search.dataset.wired) { search.dataset.wired = 'true'; search.addEventListener('input', filterCards); }
    if (category && !category.dataset.wired) { category.dataset.wired = 'true'; category.addEventListener('change', filterCards); }
    filterCards();
  }

  const logChannelDefinitions = [
    ['moderation', 'Moderation actions', 'Warnings, bans, kicks and timeouts'],
    ['audit', 'Security & audit', 'General audit fallback for uncategorized events'],
    ['antinuke', 'Anti-Nuke protection', 'Role/channel destruction and dangerous-action alerts'],
    ['antiraid', 'Anti-Raid alerts', 'Join-spike detection and raid response'],
    ['threads', 'Threads', 'Thread creation, updates and deletions'],
    ['messages', 'Message changes', 'Deleted, edited and bulk-deleted messages'],
    ['members', 'Member activity', 'Joins, leaves, nicknames and role changes'],
    ['tickets', 'Ticket activity', 'Ticket open, claim, close and transcripts'],
    ['applications', 'Applications', 'Submissions, reviews and decisions'],
    ['automod', 'Auto Moderation', 'Filtered content and automated actions'],
    ['giveaways', 'Giveaways', 'Creation, end and winner events'],
    ['reactions', 'Reaction roles', 'Role button and reaction changes'],
    ['voice', 'Voice activity', 'Join, leave, move and mute changes'],
    ['server', 'General server log', 'Fallback for categories without a channel'],
    ['roles', 'Role changes', 'Roles created, changed or deleted'],
    ['channels', 'Channel changes', 'Channels created, changed or deleted'],
    ['webhooks', 'Webhook changes', 'Webhook updates and audit details'],
    ['invites', 'Invite changes', 'Invite creation and deletion'],
    ['boosts', 'Server boosts', 'Boosts started and ended'],
    ['emojis', 'Custom emojis', 'Emoji creation, changes and deletion'],
    ['stickers', 'Stickers', 'Sticker creation, changes and deletion'],
    ['scheduledEvents', 'Scheduled events', 'Discord event creation, updates and deletion'],
    ['guildUpdates', 'Server profile', 'Name, icon, banner, description and verification changes']
  ];
  const logEventDefinitions = [
    ['joins', 'Members join', 'New member joined the server'],
    ['leaves', 'Members leave', 'Member left or was removed'],
    ['bans', 'Bans and unbans', 'Member ban added or removed'],
    ['kicks', 'Kicks', 'Member kicked by a moderator'],
    ['timeouts', 'Timeouts', 'Timeout added, changed or removed'],
    ['deletedMessages', 'Message deleted', 'Message deletion with optional content preview'],
    ['editedMessages', 'Message edited', 'Before/after preview when enabled'],
    ['purges', 'Bulk message deletion', 'Multiple messages deleted at once'],
    ['roles', 'Role changes', 'Role created, updated or deleted'],
    ['channels', 'Channel changes', 'Channel created, updated or deleted'],
    ['webhooks', 'Webhook changes', 'Webhook change events'],
    ['antinuke', 'Anti-Nuke alerts', 'Mass-destruction protection alerts'],
    ['nicknames', 'Nickname changes', 'Member nickname changed'],
    ['memberRoles', 'Member role changes', 'Roles added to or removed from members'],
    ['voice', 'Voice state changes', 'Voice join, leave, move or mute'],
    ['reactionRoles', 'Reaction-role events', 'Reaction role added or removed'],
    ['applications', 'Application events', 'Submitted, accepted or rejected'],
    ['tickets', 'Ticket events', 'Opened, claimed, closed or reopened'],
    ['giveaways', 'Giveaway events', 'Created, ended and winner picked'],
    ['threads', 'Thread changes', 'Thread created, updated or deleted'],
    ['invites', 'Invite changes', 'Invite created or deleted'],
    ['automod', 'AutoMod actions', 'Filtered content and rate limits'],
    ['antiraid', 'Anti-Raid alerts', 'Join spike and lockdown detections'],
    ['boosts', 'Boosts', 'Boost started or ended'],
    ['emojis', 'Emoji changes', 'Emoji created, updated or removed'],
    ['stickers', 'Sticker changes', 'Sticker created, updated or removed'],
    ['scheduledEvents', 'Scheduled events', 'Scheduled event created, changed or removed'],
    ['guildUpdates', 'Server profile', 'Server name, icon, banner or settings changed']
  ];

  function renderLogChannels() {
    const root = document.querySelector('[data-log-list]');
    const eventRoot = document.querySelector('[data-log-events]');
    if (!root || !guildData?.config?.loggingDefaults) return;
    const channels = guildData.config.loggingDefaults.channels || {};
    const options = (resources.channels || []).filter(isTextChannel).map(channel => `<option value="${esc(channel.id)}">#${esc(channel.name)}</option>`).join('');
    root.innerHTML = logChannelDefinitions.map(([key, label, desc]) => `
      <article class="card third log-channel-card"><div class="card-head"><div><h3>${esc(label)}</h3><p>${esc(desc)}</p></div></div><div class="field"><label>Destination channel</label><select data-log-channel="${esc(key)}"><option value="">Use fallback / disabled</option>${options}</select></div>
      <small class="helper-text">${channels[key] ? 'A specific destination is set.' : 'No specific destination configured.'}</small></article>
    `).join('');
    root.querySelectorAll('[data-log-channel]').forEach(select => { select.value = channels[select.dataset.logChannel] || ''; });

    const events = guildData.config.loggingDefaults.events || {};
    if (eventRoot) {
      eventRoot.innerHTML = logEventDefinitions.map(([key, label, desc]) => `
        <label class="event-option"><span><strong>${esc(label)}</strong><small>${esc(desc)}</small></span><input type="checkbox" data-log-event="${esc(key)}" ${events[key] !== false ? 'checked' : ''} aria-label="Enable ${esc(label)}"></label>
      `).join('');
    }
    const settings = guildData.config.loggingDefaults;
    const master = document.querySelector('[data-log-global]'); if (master) master.checked = settings.enabled !== false;
    document.querySelectorAll('[data-log-setting]').forEach(input => { input.checked = settings[input.dataset.logSetting] !== false; });
    const stateChip = document.querySelector('[data-log-global-state]');
    if (stateChip) { stateChip.textContent = settings.enabled === false ? 'Logging disabled' : 'Logging enabled'; stateChip.classList.toggle('warning', settings.enabled === false); stateChip.classList.toggle('success', settings.enabled !== false); }

    const save = async () => {
      const nextChannels = {};
      root.querySelectorAll('[data-log-channel]').forEach(select => { nextChannels[select.dataset.logChannel] = select.value || null; });
      const nextEvents = {};
      eventRoot?.querySelectorAll('[data-log-event]').forEach(input => { nextEvents[input.dataset.logEvent] = input.checked; });
      const patch = { loggingDefaults: { enabled: Boolean(master?.checked), channels: nextChannels, events: nextEvents } };
      document.querySelectorAll('[data-log-setting]').forEach(input => { patch.loggingDefaults[input.dataset.logSetting] = input.checked; });
      const result = document.querySelector('[data-log-result]');
      document.querySelectorAll('[data-log-save]').forEach(button => button.disabled = true);
      try {
        await api(`/api/guilds/${selectedGuild}/config`, { method: 'PATCH', body: JSON.stringify(patch) });
        if (result) result.textContent = 'Logging configuration saved for this server.';
        toast('Logging settings saved');
        await loadGuild();
      } catch (error) { if (result) result.textContent = `Could not save logging settings: ${error.message}`; toast(error.message); }
      finally { document.querySelectorAll('[data-log-save]').forEach(button => button.disabled = false); }
    };
    document.querySelectorAll('[data-log-save]').forEach(button => button.onclick = save);
    const enableAll = document.querySelector('[data-log-enable-all]'); if (enableAll) enableAll.onclick = () => { eventRoot?.querySelectorAll('[data-log-event]').forEach(input => input.checked = true); };
    const disableAll = document.querySelector('[data-log-disable-all]'); if (disableAll) disableAll.onclick = () => { eventRoot?.querySelectorAll('[data-log-event]').forEach(input => input.checked = false); };
  }

  function animateMetric(element, target) {
    if (!element) return;
    const safeTarget = Number.isFinite(Number(target)) ? Math.max(0, Number(target)) : 0;
    const start = Number(element.dataset.metricValue || 0);
    element.dataset.metricValue = String(safeTarget);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { element.textContent = safeTarget.toLocaleString(guildData?.config?.dashboardPreferences?.locale || 'en-GB'); return; }
    const duration = 850;
    const begun = performance.now();
    const tick = now => {
      const progress = Math.min(1, (now - begun) / duration);
      const eased = 1 - Math.pow(1 - progress, 4.2);
      element.textContent = Math.round(start + (safeTarget - start) * eased).toLocaleString(guildData?.config?.dashboardPreferences?.locale || 'en-GB');
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  async function renderOverviewExtras() {
    if (page !== 'overview' || !guildData || !selectedGuild) return;
    const stats = guildData.stats || {};
    const values = {
      '[data-open-tickets]': stats.openTickets ?? 0,
      '[data-total-tickets]': stats.totalTickets ?? 0,
      '[data-closed-tickets]': stats.closedTickets ?? 0,
      '[data-pending-applications]': stats.pendingApplications ?? 0,
      '[data-reviewing-applications]': stats.reviewingApplications ?? 0,
      '[data-total-applications]': stats.totalApplications ?? 0,
      '[data-active-app-drafts]': stats.activeApplicationDrafts ?? 0,
      '[data-case-count]': stats.caseCount ?? 0,
      '[data-active-cases]': stats.activeCases ?? 0,
      '[data-warning-count]': stats.activeWarnings ?? 0,
      '[data-enabled-modules]': Object.values(guildData.config.modules || {}).filter(value => value !== false).length,
      '[data-guild-roles]': (resources.roles || []).length,
      '[data-guild-text-channels]': (resources.channels || []).filter(channel => [0,5,15,16].includes(Number(channel.type))).length,
      '[data-guild-voice-channels]': (resources.channels || []).filter(channel => [2,13].includes(Number(channel.type))).length
    };
    Object.entries(values).forEach(([selector, value]) => {
      const node = document.querySelector(selector);
      if (node && node.matches('b')) animateMetric(node, value);
      else if (node) node.textContent = Number(value).toLocaleString(guildData?.config?.dashboardPreferences?.locale || 'en-GB');
    });
    const activityRoot = document.querySelector('[data-recent-activity]');
    if (!activityRoot) return;
    activityRoot.innerHTML = '<div class="loading">Loading recent activity…</div>';
    try {
      const [casesPayload, ticketsPayload, appsPayload] = await Promise.all([
        api(`/api/guilds/${selectedGuild}/cases`).catch(() => ({ cases: [] })),
        api(`/api/guilds/${selectedGuild}/tickets`).catch(() => ({ tickets: [] })),
        api(`/api/guilds/${selectedGuild}/applications?limit=20`).catch(() => ({ applications: [] }))
      ]);
      const items = [];
      (casesPayload.cases || []).slice(0, 8).forEach(item => items.push({ time: Number(item.created_at || 0), icon: 'M', title: `${String(item.type || 'Moderation').replace(/_/g, ' ')} case #${item.id}`, detail: `User ${item.user_id} · ${item.reason || 'No reason provided'}`, status: item.active ? 'Active' : 'Closed' }));
      (ticketsPayload.tickets || []).slice(0, 8).forEach(item => items.push({ time: Number(item.created_at || 0), icon: 'T', title: `Ticket #${item.id} · ${item.type || 'Support'}`, detail: `Opened by ${item.opener_id}`, status: item.status || 'unknown' }));
      (appsPayload.applications || []).slice(0, 8).forEach(item => items.push({ time: Number(item.created_at || 0), icon: 'A', title: `Application #${item.id} · ${item.type}`, detail: `Applicant ${item.user_id}`, status: item.status || 'pending' }));
      items.sort((a,b) => b.time - a.time);
      if (!items.length) { activityRoot.innerHTML = '<div class="empty-state">No activity has been recorded yet. Moderation cases, tickets and applications will appear here.</div>'; return; }
      activityRoot.innerHTML = items.slice(0, 8).map(item => `<div class="recent-row"><div class="recent-icon">${esc(item.icon)}</div><div><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p></div><time title="${esc(formatDateTime(item.time))}">${item.time ? esc(formatDateTime(item.time, true)) : '—'} · ${esc(item.status)}</time></div>`).join('');
    } catch (error) { activityRoot.innerHTML = `<div class="empty-state">Activity could not be loaded: ${esc(error.message)}</div>`; }
  }

  async function renderTicketTable() {
    if (page !== 'tickets' || !selectedGuild) return;
    const body = document.querySelector('[data-ticket-table]'); if (!body) return;
    const result = document.querySelector('[data-ticket-result]');
    body.innerHTML = '<tr><td colspan="6">Loading ticket records…</td></tr>';
    try {
      const payload = await api(`/api/guilds/${selectedGuild}/tickets`);
      const tickets = payload.tickets || [];
      const open = tickets.filter(t => t.status === 'open').length;
      document.querySelector('[data-ticket-open-count]')?.replaceChildren(document.createTextNode(open.toLocaleString()));
      document.querySelector('[data-ticket-closed-count]')?.replaceChildren(document.createTextNode(tickets.filter(t => t.status !== 'open').length.toLocaleString()));
      document.querySelector('[data-ticket-total-count]')?.replaceChildren(document.createTextNode(tickets.length.toLocaleString()));
      body.innerHTML = tickets.length ? tickets.map(t => `<tr><td><strong>#${esc(t.id)}</strong><div class="helper-text">${esc(t.channel_id || 'No channel ID')}</div></td><td>${esc(t.opener_id)}</td><td>${esc(t.type)}</td><td>${t.created_at ? esc(formatDateTime(Number(t.created_at))) : '—'}</td><td><span class="status-chip ${t.status === 'open' ? 'success' : ''}">${esc(t.status)}</span></td><td>${t.closed_at ? esc(formatDateTime(Number(t.closed_at))) : '—'}</td></tr>`).join('') : '<tr><td colspan="6">No tickets have been recorded yet.</td></tr>';
      if (result) result.textContent = `${tickets.length} recent ticket records loaded. Ticket creation/closing uses Discord runtime events and the shared database.`;
    } catch (error) { body.innerHTML = `<tr><td colspan="6">${esc(error.message)}</td></tr>`; if (result) result.textContent = error.message; }
  }

  function renderApplicationFormBuilder() {
    if (page !== 'applications' || !guildData) return;
    const root = document.querySelector('[data-application-forms]');
    const addButtons = document.querySelectorAll('[data-application-form-add]');
    if (!root) return;
    const existing = guildData.config.applicationDefaults?.forms || {};
    const draft = Object.entries(existing).map(([id, value]) => ({ id, title: String(value?.title || id), description: String(value?.description || ''), questions: Array.isArray(value?.questions) ? value.questions.slice(0,5) : [], buttonLabel: String(value?.buttonLabel || value?.title || id), buttonStyle: String(value?.buttonStyle || (id === 'partner' ? 'SECONDARY' : id === 'creator' ? 'SUCCESS' : 'PRIMARY')).toUpperCase(), buttonEmoji: String(value?.buttonEmoji || '') }));
    const render = () => {
      const cards = [...root.querySelectorAll('[data-app-form-card]')];
      document.querySelectorAll('[data-application-form-count]').forEach(node => node.textContent = `${cards.length} form${cards.length === 1 ? '' : 's'} configured`);
      addButtons.forEach(btn => { btn.disabled = cards.length >= 500; btn.title = cards.length >= 500 ? 'The Auralis form library limit is 500 forms.' : 'Add a reusable form to the library'; });
    };
    const draw = (forms) => {
      root.innerHTML = forms.map((form, index) => `
        <section class="app-form-card" data-app-form-card data-form-id="${esc(form.id)}">
          <div class="app-form-head"><div class="app-form-title"><span class="app-form-index">${String(index+1).padStart(2,'0')}</span><div><strong>${esc(form.title || form.id)}</strong><small>Button ID: ${esc(form.id)}</small></div></div><button class="button danger small" data-form-remove="${esc(form.id)}" type="button">Remove form</button></div>
          <div class="app-form-grid"><div class="field"><label>Internal form ID</label><input data-form-key value="${esc(form.id)}" maxlength="40" pattern="[a-zA-Z0-9_-]+" placeholder="staff-application"><small>Letters, numbers, underscores and hyphens only.</small></div><div class="field"><label>Button / modal title</label><input data-form-title value="${esc(form.title)}" maxlength="80" placeholder="Staff Application"></div><div class="field"><label>Button label (shown in Discord)</label><input data-form-button-label value="${esc(form.buttonLabel || form.title || form.id)}" maxlength=80 placeholder="Open application"></div><div class="field"><label>Button style</label><select data-form-button-style><option value="PRIMARY" ${form.buttonStyle==='PRIMARY'?'selected':''}>Primary · Blurple</option><option value="SECONDARY" ${form.buttonStyle==='SECONDARY'?'selected':''}>Secondary · Grey</option><option value="SUCCESS" ${form.buttonStyle==='SUCCESS'?'selected':''}>Success · Green</option><option value="DANGER" ${form.buttonStyle==='DANGER'?'selected':''}>Danger · Red</option></select></div><div class="field"><label>Button emoji (optional)</label><input data-form-button-emoji value="${esc(form.buttonEmoji || '')}" maxlength="16" placeholder="📝"><small>Unicode emoji. Custom server emoji IDs are not supported here.</small></div><div class="field wide-field"><label>Form description</label><textarea data-form-description maxlength="3000" placeholder="Tell us what this application is for.">${esc(form.description)}</textarea></div><div class="field wide-field"><label>Questions (one per line, maximum five)</label><textarea data-form-questions maxlength="1000" placeholder="Age\nTimezone\nWhy should we choose you?">${esc((form.questions || []).join('\n'))}</textarea><small class="question-tip">Discord application modals support five text inputs maximum. Each question label is limited to 45 characters; answers are collected in a modal.</small></div></div>
        </section>`).join('') || '<div class="empty-state">No forms configured yet. Add your first application form to enable the application panel.</div>';
      root.querySelectorAll('[data-form-remove]').forEach(button => button.onclick = () => { button.closest('[data-app-form-card]')?.remove(); render(); });
      render();
    };
    draw(draft);
    addButtons.forEach(button => button.onclick = () => {
      const cards = [...root.querySelectorAll('[data-app-form-card]')];
      if (cards.length >= 500) return toast('The form library supports up to 500 forms. Create a separate form panel if you need more.');
      let id = `application-${cards.length + 1}`; let index = 1;
      while (cards.some(card => card.dataset.formId === id)) { index += 1; id = `application-${cards.length + index}`; }
      const current = cards.map(card => ({ id: card.dataset.formId, title: card.querySelector('[data-form-title]')?.value || '', description: card.querySelector('[data-form-description]')?.value || '', questions: card.querySelector('[data-form-questions]')?.value.split(/\r?\n/).map(q=>q.trim()).filter(Boolean) || [], buttonLabel: card.querySelector('[data-form-button-label]')?.value.trim() || card.querySelector('[data-form-title]')?.value || id, buttonStyle: card.querySelector('[data-form-button-style]')?.value || 'PRIMARY', buttonEmoji: card.querySelector('[data-form-button-emoji]')?.value.trim() || '' }));
      current.push({ id, title: 'New Application', description: 'Tell us a little about yourself.', questions: ['Your name', 'Why are you applying?'], buttonLabel: 'Open application', buttonStyle: 'PRIMARY', buttonEmoji: '' });
      draw(current);
      root.querySelector(`[data-form-id="${CSS.escape(id)}"] [data-form-title]`)?.focus();
    });
    const formSaveButton = document.querySelector('[data-application-form-save]');
    if (formSaveButton) formSaveButton.onclick = async event => {
      const button = event.currentTarget;
      const result = document.querySelector('[data-application-form-result]');
      const forms = {};
      const cards = [...root.querySelectorAll('[data-app-form-card]')];
      if (!cards.length) { if (result) result.textContent = 'Keep at least one form configured before saving.'; return toast('Add at least one application form.'); }
      if (cards.length > 500) return toast('The form library supports up to 500 forms.');
      for (const card of cards) {
        const id = card.querySelector('[data-form-key]').value.trim().toLowerCase();
        const title = card.querySelector('[data-form-title]').value.trim();
        const description = card.querySelector('[data-form-description]').value.trim();
        const questions = card.querySelector('[data-form-questions]').value.split(/\r?\n/).map(q => q.trim()).filter(Boolean);
        if (!/^[a-z0-9_-]{1,40}$/.test(id)) { if (result) result.textContent = `Form ID “${id}” is invalid. Use a-z, 0-9, _ or - (max 40 characters).`; return toast('Invalid form ID.'); }
        if (Object.prototype.hasOwnProperty.call(forms, id)) { if (result) result.textContent = `Form ID “${id}” is duplicated.`; return toast('Form IDs must be unique.'); }
        if (!title || title.length > 80) return toast(`Give ${id} a title under 80 characters.`);
        if (!questions.length || questions.length > 5) return toast(`${title}: use between one and five questions.`);
        if (questions.some(q => q.length > 45)) return toast(`${title}: each Discord modal question label must be 45 characters or less.`);
        forms[id] = { title, description, questions, buttonLabel: (card.querySelector('[data-form-button-label]')?.value || title).trim().slice(0,80) || title, buttonStyle: card.querySelector('[data-form-button-style]')?.value || 'PRIMARY', buttonEmoji: (card.querySelector('[data-form-button-emoji]')?.value || '').trim().slice(0, 16) };
      }
      button.disabled = true; if (result) result.textContent = 'Saving application forms…';
      try {
        await api(`/api/guilds/${selectedGuild}/applications/forms`, { method: 'PUT', body: JSON.stringify({ forms }) });
        toast('Application forms saved'); if (result) result.textContent = 'All application forms saved. Send or update the application panel in Discord to show the current forms.';
        await loadGuild();
      } catch (error) { if (result) result.textContent = `Could not save forms: ${error.message}`; toast(error.message); }
      finally { button.disabled = false; }
    };
  }


  async function renderApplicationPanelSets() {
    if (page !== 'applications' || !selectedGuild) return;
    const root = document.querySelector('[data-app-panel-sets]');
    if (!root) return;
    const result = document.querySelector('[data-app-panel-result]');
    const channelOptions = (resources.channels || []).filter(isTextChannel)
      .map(channel => `<option value="${esc(channel.id)}">#${esc(channel.name)}</option>`).join('');
    let payload;
    try { payload = await api(`/api/guilds/${selectedGuild}/application-panels`); }
    catch (error) { root.innerHTML = `<div class="empty-state">Application panels could not be loaded: ${esc(error.message)}</div>`; return; }
    const panels = Array.isArray(payload.panels) ? payload.panels : [];
    const forms = Array.isArray(payload.forms) ? payload.forms : [];
    const render = () => {
      const selectedPanels = panels.map(panel => {
        const chosen = Array.isArray(panel.formIds) && panel.formIds.length ? panel.formIds : forms.slice(0,25).map(form => form.id);
        const formChoices = forms.map(form => `<label class="check"><input type="checkbox" data-panel-form="${esc(form.id)}" ${chosen.includes(form.id) ? 'checked' : ''}><span>${esc(form.title)}<small class="muted">${esc(form.id)}</small></span></label>`).join('');
        return `<section class="app-form-card" data-app-panel-card data-panel-id="${esc(panel.id)}">
          <div class="app-form-head"><div class="app-form-title"><span class="app-form-index">▤</span><div><strong>${esc(panel.name || panel.id)}</strong><small>Panel ID: ${esc(panel.id)}</small></div></div><span class="status-chip">${chosen.length} selected</span></div>
          <div class="app-form-grid">
            <div class="field"><label>Panel ID</label><input data-panel-field="id" value="${esc(panel.id)}" readonly></div>
            <div class="field"><label>Internal name</label><input data-panel-field="name" value="${esc(panel.name || panel.id)}" maxlength="80"></div>
            <div class="field"><label>Embed title</label><input data-panel-field="title" value="${esc(panel.title || 'Applications')}" maxlength="256"></div>
            <div class="field"><label>Send destination</label><select data-panel-channel data-current="${esc(panel.channelId || '')}"><option value="">Choose channel…</option>${channelOptions}</select></div>
            <div class="field wide-field"><label>Embed description</label><textarea data-panel-field="description" maxlength="4096">${esc(panel.description || '')}</textarea></div>
            <div class="field wide-field"><label>Forms shown in this panel (maximum 25)</label><div class="checkbox-grid app-panel-form-options" data-app-panel-form-options>${formChoices || '<span class="helper-text">Create and save forms above first.</span>'}</div><small class="question-tip">Select which application buttons appear on this message. You can publish multiple different panel sets to different channels.</small></div>
          </div>
          <div class="savebar"><span class="helper-text" style="margin-right:auto">${panel.id === 'default' ? 'Default panel' : 'Custom panel set'}</span><button class="button primary" data-app-panel-save="${esc(panel.id)}">Save panel</button><button class="button" data-app-panel-send="${esc(panel.id)}">Send to Discord</button>${panel.id === 'default' ? '' : `<button class="button danger" data-app-panel-delete="${esc(panel.id)}">Delete</button>`}</div>
        </section>`;
      }).join('');
      root.innerHTML = selectedPanels || '<div class="empty-state">No application panel sets yet. Create one to publish a form panel.</div>';
      root.querySelectorAll('[data-app-panel-save]').forEach(button => button.onclick = async () => {
        const card = button.closest('[data-app-panel-card]');
        const id = button.dataset.appPanelSave;
        const formIds = [...card.querySelectorAll('[data-panel-form]:checked')].map(input => input.dataset.panelForm);
        if (!formIds.length) return toast('Choose at least one form for this panel.');
        if (formIds.length > 25) return toast('One Discord panel can show at most 25 form buttons.');
        const body = { id, name: card.querySelector('[data-panel-field="name"]').value.trim(), title: card.querySelector('[data-panel-field="title"]').value.trim(), description: card.querySelector('[data-panel-field="description"]').value, formIds, channelId: card.querySelector('[data-panel-channel]')?.value || null };
        button.disabled = true;
        try {
          const out = await api(`/api/guilds/${selectedGuild}/application-panels/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) });
          const index = panels.findIndex(panel => panel.id === id);
          if (index >= 0) panels[index] = out.panel;
          if (result) result.textContent = `Panel “${body.name}” saved. It now shows ${formIds.length} application form(s).`;
          toast(`Application panel “${body.name}” saved.`);
          render();
        } catch (error) { toast(error.message); if (result) result.textContent = error.message; }
        finally { button.disabled = false; }
      });
      root.querySelectorAll('[data-app-panel-send]').forEach(button => button.onclick = async () => {
        const card = button.closest('[data-app-panel-card]');
        const id = button.dataset.appPanelSend;
        const channelId = card.querySelector('[data-panel-channel]')?.value;
        if (!channelId) return toast('Choose the Discord channel where this panel should be sent.');
        button.disabled = true;
        try {
          // Save currently edited content first so the posted message matches the form.
          const formIds = [...card.querySelectorAll('[data-panel-form]:checked')].map(input => input.dataset.panelForm);
          if (!formIds.length || formIds.length > 25) return toast('Select between 1 and 25 forms for this panel.');
          const body = { id, name: card.querySelector('[data-panel-field="name"]').value.trim(), title: card.querySelector('[data-panel-field="title"]').value.trim(), description: card.querySelector('[data-panel-field="description"]').value, formIds, channelId: card.querySelector('[data-panel-channel]')?.value || null };
          const saved = await api(`/api/guilds/${selectedGuild}/application-panels/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) });
          const index = panels.findIndex(panel => panel.id === id); if (index >= 0) panels[index] = saved.panel;
          const out = await api(`/api/guilds/${selectedGuild}/application-panels/${encodeURIComponent(id)}/send`, { method: 'POST', body: JSON.stringify({ channelId }) });
          if (result) result.innerHTML = `Panel sent successfully: <a href="${esc(out.url)}" target="_blank" rel="noopener noreferrer">Open Discord message ↗</a>`;
          toast(`Application panel “${body.name}” sent.`);
        } catch (error) { toast(error.message); if (result) result.textContent = error.message; }
        finally { button.disabled = false; }
      });
      root.querySelectorAll('[data-app-panel-delete]').forEach(button => button.onclick = async () => {
        const id = button.dataset.appPanelDelete;
        if (window.AuralisConfirmDestructive ? !(await window.AuralisConfirmDestructive(`Delete application panel set “${id}”? Previously sent Discord messages will remain, but the saved definition will be removed.`, { title: 'Delete application panel?', confirmLabel: 'Delete panel' })) : !confirm(`Delete application panel set “${id}”?`)) return;
        try { const out = await api(`/api/guilds/${selectedGuild}/application-panels/${encodeURIComponent(id)}`, { method: 'DELETE' }); panels.splice(0, panels.length, ...(out.panels || [])); toast('Application panel set deleted.'); render(); }
        catch (error) { toast(error.message); }
      });
      root.querySelectorAll('[data-panel-channel]').forEach(select => { const current = select.dataset.current || ''; select.innerHTML = `<option value="">Choose channel…</option>${channelOptions}`; select.value = current; });
    };
    render();
    const add = document.querySelector('[data-app-panel-add]');
    if (add) add.onclick = async () => {
      if (panels.length >= Number(payload.limits?.maxPanels || 100)) return toast(`Panel set limit reached (${payload.limits?.maxPanels || 100}).`);
      const n = Date.now().toString(36);
      const id = `apps-${n}`;
      try {
        const out = await api(`/api/guilds/${selectedGuild}/application-panels`, { method: 'POST', body: JSON.stringify({ id, name: 'New application panel', title: 'Applications', description: 'Choose the application type below to open the form.', formIds: forms.slice(0, Math.min(5, forms.length)).map(form => form.id) }) });
        panels.push(out.panel); toast('Application panel set created.'); render();
      } catch (error) { toast(error.message); if (result) result.textContent = error.message; }
    };
  }

  async function renderApplicationsTable() {
    if (page !== 'applications' || !selectedGuild) return;
    const body = document.querySelector('[data-application-table]'); if (!body) return;
    const status = document.querySelector('[data-application-status-filter]')?.value || 'all';
    const result = document.querySelector('[data-application-table-result]');
    body.innerHTML = '<tr><td colspan="6">Loading submissions…</td></tr>';
    try {
      const payload = await api(`/api/guilds/${selectedGuild}/applications?status=${encodeURIComponent(status)}&limit=100`);
      const rows = payload.applications || []; const stats = payload.stats || {};
      for (const [attr, value] of [['total',stats.total],['pending',stats.pending],['accepted',stats.accepted],['rejected',stats.rejected],['drafts',stats.activeDrafts]]) document.querySelector(`[data-app-${attr}]`)?.replaceChildren(document.createTextNode(Number(value||0).toLocaleString()));
      body.innerHTML = rows.length ? rows.map(app => {
        const when = Number(app.created_at || 0);
        const answers = Array.isArray(app.answers) ? app.answers : [];
        const answerBlock = answers.length ? `<details class="answer-details"><summary>View ${answers.length} answer${answers.length===1?'':'s'}</summary><div class="answer-list">${answers.map((answer,index)=>`<div><strong>${index+1}. ${esc(answer.question || `Question ${index+1}`)}</strong><p>${esc(answer.answer || '—')}</p></div>`).join('')}</div>${app.reviewReason ? `<p class="helper-text">Review note: ${esc(app.reviewReason)}</p>` : ''}${app.reviewer_id ? `<p class="helper-text">Reviewed by: ${esc(app.reviewer_id)}</p>` : ''}</details>` : '<span class="helper-text">No answers available</span>';
        return `<tr><td><strong>#${esc(app.id)}</strong><div class="helper-text">${esc(app.type)}</div></td><td>${esc(app.user_id)}</td><td><strong>${esc(app.title || app.type)}</strong>${answerBlock}</td><td>${when ? esc(formatDateTime(when)) : '—'}</td><td><span class="status-chip ${app.status==='accepted'?'success':app.status==='rejected'?'danger':app.status==='pending'?'warning':''}">${esc(app.status)}</span></td><td>${app.status==='pending'||app.status==='reviewing'?`<div class="row">${app.status==='pending'?`<button class="button small" data-app-review="reviewing" data-app-id="${esc(app.id)}">Mark reviewing</button>`:''}<button class="button primary small" data-app-review="accepted" data-app-id="${esc(app.id)}">Accept</button><button class="button danger small" data-app-review="rejected" data-app-id="${esc(app.id)}">Reject</button></div>`:'<span class="helper-text">Reviewed</span>'}</td></tr>`;
      }).join('') : '<tr><td colspan="6">No submissions for this filter.</td></tr>';
      body.querySelectorAll('[data-app-review]').forEach(button => button.onclick = async () => {
        const id = button.dataset.appId; const next = button.dataset.appReview;
        const reason = next === 'rejected' ? (window.prompt('Optional rejection reason (shown in the DM):', '') ?? null) : next === 'reviewing' ? (window.prompt('Optional internal review note:', '') ?? '') : ''; 
        if (reason === null) return;
        button.disabled = true;
        try { await api(`/api/guilds/${selectedGuild}/applications/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status: next, reason }) }); toast(`Application #${id} ${next === 'reviewing' ? 'marked as reviewing' : next}`); await renderApplicationsTable(); }
        catch (error) { toast(error.message); button.disabled = false; }
      });
      if (result) result.textContent = `${rows.length} submissions returned. DM delivery depends on the applicant's Discord privacy settings.`;
    } catch (error) { body.innerHTML = `<tr><td colspan="6">${esc(error.message)}</td></tr>`; if (result) result.textContent = error.message; }
  }

  async function renderPrefixCommands() {
    const root = document.querySelector('[data-prefix-list]');
    if (!root) return;
    try {
      const payload = await api(`/api/guilds/${selectedGuild}/prefix-commands`);
      const enabled = new Map((payload.commands || []).map((entry) => [entry.command_name, Boolean(entry.enabled)]));
      root.innerHTML = (payload.catalog || []).map((name) => `<div class="toggle-line"><div><strong>.${esc(name)}</strong><div class="muted">Prefix command</div></div><button class="switch ${enabled.get(name) !== false ? 'on' : ''}" data-prefix="${esc(name)}"><i></i></button></div>`).join('');
      root.querySelectorAll('[data-prefix]').forEach((button) => {
        button.onclick = async () => {
          const value = !button.classList.contains('on');
          try {
            await api(`/api/guilds/${selectedGuild}/prefix-commands`, { method: 'PATCH', body: JSON.stringify({ [button.dataset.prefix]: value }) });
            button.classList.toggle('on', value);
          } catch (error) { toast(error.message); }
        };
      });
    } catch (error) { root.innerHTML = `<div class="loading">${esc(error.message)}</div>`; }
  }

  async function renderAdmin() {
    if (!can('view_all_guilds')) return;
    const permissionRoot = document.querySelector('[data-admin-permission-list]');
    if (permissionRoot && !permissionRoot.childElementCount) {
      const permissions = ['view_all_guilds', 'manage_guilds', 'leave_guilds', 'blacklist_guilds', 'manage_bot_status', 'manage_staff', 'view_analytics', 'send_announcements'];
      permissionRoot.innerHTML = permissions.map((permission) => `<label class="check"><input type="checkbox" value="${permission}">${permission}</label>`).join('');
    }

    try {
      const isOwner = access.level === 'owner';
      const [staff, blacklist, guildData] = await Promise.all([can('manage_staff') ? api('/api/admin/staff') : Promise.resolve({ staff: [] }), can('blacklist_guilds') ? api('/api/admin/blacklist') : Promise.resolve({ entries: [] }), api('/api/guilds')]);
      const addStaffCard = document.querySelector('[data-admin-add]')?.closest('article.card');
      if (addStaffCard) addStaffCard.hidden = !isOwner;
      const staffTitle = document.querySelector('[data-admin-staff]')?.closest('article.card')?.querySelector('h3');
      if (staffTitle && !isOwner) staffTitle.textContent = 'Global staff (view only)';
      document.querySelector('[data-admin-staff-count]')?.replaceChildren(document.createTextNode(String((staff.staff || []).length)));
      document.querySelector('[data-admin-blacklist-count]')?.replaceChildren(document.createTextNode(String((blacklist.entries || []).length)));
      document.querySelector('[data-admin-guild-count]')?.replaceChildren(document.createTextNode(String((guildData.guilds || []).length)));
      const staffRoot = document.querySelector('[data-admin-staff]');
      const blacklistRoot = document.querySelector('[data-admin-blacklist]');
      const blacklistCard = blacklistRoot?.closest('article.card');
      if (blacklistCard) blacklistCard.hidden = !can('blacklist_guilds');
      const staffCard = staffRoot?.closest('article.card');
      if (staffCard && !isOwner && !can('manage_staff')) staffCard.hidden = true;
      if (staffRoot && !staffCard?.hidden) {
        staffRoot.innerHTML = (staff.staff || []).map((entry) => `<div class="list-item"><div><strong>${esc(entry.userId)}</strong><span>${esc(entry.label || 'Auralis Staff')}</span><small>${esc((entry.permissions || []).join(', ') || 'No global permissions')}</small></div>${isOwner ? `<button class="button danger" data-remove-staff="${entry.userId}">Remove</button>` : '<span class="status-chip">Owner managed</span>'}</div>`).join('') || '<div class="loading">No staff configured.</div>';
        staffRoot.querySelectorAll('[data-remove-staff]').forEach((button) => button.onclick = async () => { await api(`/api/admin/staff/${button.dataset.removeStaff}`, { method: 'DELETE' }); toast('Removed'); renderAdmin(); });
      }
      if (blacklistRoot) {
        blacklistRoot.innerHTML = (blacklist.entries || []).map((entry) => `<div class="list-item"><div><strong>${esc(entry.guild_id)}</strong><span>${esc(entry.reason || 'Blacklisted')}</span></div><button class="button" data-unblack="${entry.guild_id}">Remove</button></div>`).join('') || '<div class="loading">No blacklisted servers.</div>';
        blacklistRoot.querySelectorAll('[data-unblack]').forEach((button) => button.onclick = async () => { await api(`/api/admin/guilds/${button.dataset.unblack}/blacklist`, { method: 'DELETE' }); toast('Blacklist removed'); renderAdmin(); });
      }

      const presence = await api('/api/admin/runtime');
      const state = presence.presence || {};
      const status = document.querySelector('[data-admin-presence-status]');
      const type = document.querySelector('[data-admin-presence-type]');
      const text = document.querySelector('[data-admin-presence-text]');
      if (status) status.value = state.status || 'online';
      if (type) type.value = state.type || 'WATCHING';
      if (text) text.value = state.text || '';
    } catch (error) { toast(error.message); }

    const adminAddButton = document.querySelector('[data-admin-add]');
    if (adminAddButton && access.level === 'owner') adminAddButton.onclick = async () => {
      const id = document.querySelector('[data-admin-user-id]')?.value.trim();
      const label = document.querySelector('[data-admin-label]')?.value.trim();
      const permissions = [...document.querySelectorAll('[data-admin-permission-list] input:checked')].map((input) => input.value);
      if (!/^\d{16,22}$/.test(id || '')) return toast('Enter a valid Discord user ID.');
      try { await api('/api/admin/staff', { method: 'POST', body: JSON.stringify({ userId: id, label, permissions }) }); toast('Staff saved'); renderAdmin(); } catch (error) { toast(error.message); }
    };

    document.querySelector('[data-admin-presence-save]')?.removeAttribute('onclick'); document.querySelector('[data-admin-presence-save]').onclick = async () => {
      try {
        await api('/api/admin/runtime', {
          method: 'PATCH',
          body: JSON.stringify({
            status: document.querySelector('[data-admin-presence-status]').value,
            type: document.querySelector('[data-admin-presence-type]').value,
            text: document.querySelector('[data-admin-presence-text]').value
          })
        });
        toast('Presence saved');
      } catch (error) { toast(error.message); }
    };

    const siteSettingsCard = document.querySelector('[data-admin-site-settings]');
    const siteSettingsInput = document.querySelector('[data-admin-support-invite]');
    const siteSettingsSave = document.querySelector('[data-admin-site-settings-save]');
    if (siteSettingsCard) siteSettingsCard.hidden = !can('manage_site_settings');
    if (can('manage_site_settings') && siteSettingsInput && siteSettingsSave) {
      try { const result = await api('/api/admin/site-settings'); siteSettingsInput.value = result.settings?.supportInvite || ''; }
      catch (error) { toast(error.message); }
      siteSettingsSave.onclick = async () => {
        siteSettingsSave.disabled = true;
        try {
          const result = await api('/api/admin/site-settings', { method: 'PATCH', body: JSON.stringify({ supportInvite: siteSettingsInput.value.trim() }) });
          siteSettingsInput.value = result.settings.supportInvite;
          toast('Public Discord link saved');
        } catch (error) { toast(error.message); }
        finally { siteSettingsSave.disabled = false; }
      };
    }
  }

  function wireAdminBroadcast(guilds) {
    const target = document.querySelector('[data-admin-announcement-target]');
    const send = document.querySelector('[data-admin-broadcast]');
    const resultRoot = document.querySelector('[data-admin-broadcast-result]');
    const useServerDefaults = document.querySelector('[data-admin-announcement-use-server-defaults]');
    const broadcastCard = send?.closest('.admin-announcement-card');
    if (broadcastCard) broadcastCard.hidden = !can('send_announcements');
    const styleInputs = ['[data-admin-announcement-title]','[data-admin-announcement-color]','[data-admin-announcement-footer]','[data-admin-announcement-timestamp]'].map(selector => document.querySelector(selector)).filter(Boolean);
    const syncStyleInputs = () => styleInputs.forEach(input => { input.disabled = Boolean(useServerDefaults?.checked); });
    if (useServerDefaults && useServerDefaults.dataset.wired !== 'true') { useServerDefaults.dataset.wired = 'true'; useServerDefaults.addEventListener('change', syncStyleInputs); }
    syncStyleInputs();
    if (!target || !send) return;
    const previous = target.value || 'all';
    target.innerHTML = '<option value="all">All connected servers (configured channels only)</option>' + guilds.map(guild => `<option value="${esc(guild.id)}">${esc(guild.name)}${guild.blacklisted ? ' · Blacklisted' : ''}</option>`).join('');
    if ([...target.options].some(option => option.value === previous)) target.value = previous;
    send.onclick = async () => {
      const message = document.querySelector('[data-admin-announcement-message]')?.value.trim() || '';
      if (!message) return toast('Write an announcement message first.');
      if (target.value === 'all') {
        let confirmed = false;
        if (window.AuralisConfirmDestructive) confirmed = await window.AuralisConfirmDestructive('This announcement will be attempted on every connected, non-blacklisted server that has enabled announcements and configured a destination channel. Servers without a configured channel will be skipped.', { title: 'Broadcast to all configured servers?', confirmLabel: 'Broadcast announcement', danger: false, requireText: 'SEND', requireTextLabel: 'Type SEND to confirm this global broadcast', force: true });
        else confirmed = window.confirm('Send this announcement to all connected servers with a configured announcement channel?');
        if (!confirmed) return;
      } else {
        const serverName = guilds.find(guild => String(guild.id) === target.value)?.name || target.value;
        if (!window.confirm(`Send this announcement to ${serverName}? It will only be sent to that server’s configured announcement channel.`)) return;
      }
      send.disabled = true;
      if (resultRoot) { resultRoot.hidden = false; resultRoot.textContent = 'Sending announcement…'; }
      try {
        const payload = await api('/api/admin/announcements', { method: 'POST', body: JSON.stringify({
          targetGuildId: target.value,
          title: document.querySelector('[data-admin-announcement-title]')?.value.trim() || 'Auralis Announcement',
          message,
          url: document.querySelector('[data-admin-announcement-url]')?.value.trim() || '',
          color: document.querySelector('[data-admin-announcement-color]')?.value || '#EF355D',
          footerText: document.querySelector('[data-admin-announcement-footer]')?.value.trim() || '',
          includeTimestamp: Boolean(document.querySelector('[data-admin-announcement-timestamp]')?.checked),
          useServerDefaults: Boolean(useServerDefaults?.checked)
        }) });
        const summary = `${Number(payload.sent || 0)} sent · ${Number(payload.skipped || 0)} skipped · ${Number(payload.failed || 0)} failed`;
        if (resultRoot) {
          const lines = (payload.results || []).filter(item => item.status !== 'sent').slice(0, 12).map(item => `${item.guildName || item.guildId}: ${item.reason || item.status}`);
          resultRoot.innerHTML = `<strong>${esc(summary)}</strong>${lines.length ? `<div class="announcement-result-details">${lines.map(line => `<div>${esc(line)}</div>`).join('')}</div>` : '<p>Every targeted server accepted the announcement.</p>'}`;
        }
        toast(`Announcement finished — ${summary}`);
      } catch (error) {
        if (resultRoot) { resultRoot.hidden = false; resultRoot.textContent = error.message; }
        toast(error.message);
      } finally { send.disabled = false; }
    };
  }

  async function renderAdminOverview() {
    if (page !== 'admin' || !can('view_all_guilds')) return;
    const auditRoot = document.querySelector('[data-admin-audit]');
    const serverRoot = document.querySelector('[data-admin-guild-overview]');
    const statsRoot = document.querySelector('[data-admin-overview-stats]');
    const tasks = [];
    tasks.push(api('/api/admin/overview').then(payload => {
      const values = {
        '[data-global-guilds]': payload.guilds,
        '[data-global-members]': payload.memberCount,
        '[data-global-open-tickets]': payload.openTickets,
        '[data-global-closed-tickets]': payload.closedTickets,
        '[data-global-pending-apps]': payload.pendingApplications,
        '[data-global-reviewing-apps]': payload.reviewingApplications,
        '[data-global-accepted-apps]': payload.acceptedApplications,
        '[data-global-rejected-apps]': payload.rejectedApplications,
        '[data-global-total-apps]': payload.totalApplications,
        '[data-global-app-drafts]': payload.activeApplicationDrafts,
        '[data-global-cases]': payload.cases,
        '[data-global-active-warnings]': payload.activeWarnings,
        '[data-global-uptime]': payload.uptimeLabel
      };
      Object.entries(values).forEach(([selector,value]) => { const el = statsRoot?.querySelector(selector); if (el) el.textContent = value == null ? '—' : typeof value === 'number' ? Number(value).toLocaleString(guildData?.config?.dashboardPreferences?.locale || 'en-GB') : String(value); });
    }).catch(error => { if (statsRoot) statsRoot.innerHTML = `<div class="empty-state">Global metrics unavailable: ${esc(error.message)}</div>`; }));
    if (serverRoot) tasks.push(api('/api/admin/guilds').then(payload => {
      const guilds = payload.guilds || [];
      wireAdminBroadcast(guilds);
      serverRoot.innerHTML = guilds.length ? guilds.slice(0,500).map(guild => `<div class="list-item global-server-row"><div class="global-server-identity">${guild.icon ? `<img class="global-server-icon" src="${esc(guild.icon)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="global-server-icon global-server-initial">${esc(String(guild.name||'S').slice(0,1).toUpperCase())}</span>`}<div><strong>${esc(guild.name)}</strong><span>${Number(guild.members||0).toLocaleString()} members · ${esc(guild.id)}${guild.blacklisted ? ' · Blacklisted' : ''}</span></div></div><div class="row global-server-actions"><a class="button small" href="index.html?guild=${encodeURIComponent(guild.id)}">Open</a><button class="button small" data-admin-invite="${esc(guild.id)}">Create invite</button>${guild.blacklisted ? `<button class="button small" data-admin-unblacklist="${esc(guild.id)}">Unblacklist</button>` : can('blacklist_guilds') ? `<button class="button danger small" data-admin-blacklist="${esc(guild.id)}">Blacklist</button>` : ''}${can('leave_guilds') ? `<button class="button danger small" data-admin-leave="${esc(guild.id)}">Leave</button>` : ''}</div></div>`).join('') : '<div class="empty-state">No connected servers.</div>';
      serverRoot.querySelectorAll('img.global-server-icon').forEach(image => {
        image.addEventListener('error', () => {
          const row = image.closest('.global-server-row');
          const name = row?.querySelector('.global-server-identity strong')?.textContent || 'Server';
          const fallback = document.createElement('span');
          fallback.className = 'global-server-icon global-server-initial';
          fallback.setAttribute('aria-hidden', 'true');
          fallback.textContent = String(name).trim().slice(0, 1).toUpperCase() || 'S';
          image.replaceWith(fallback);
        }, { once: true });
      });
      serverRoot.querySelectorAll('[data-admin-blacklist]').forEach(button => button.onclick = async () => {
        const guildId = button.dataset.adminBlacklist;
        const serverName = button.closest('.global-server-row')?.querySelector('strong')?.textContent || guildId;
        if (!window.AuralisConfirmDestructive || !(await window.AuralisConfirmDestructive(`Blacklist ${serverName} (${guildId})? Auralis will reject the server and leave it if connected. This does not delete server data.`, { title: 'Blacklist server', confirmLabel: 'Blacklist server', force: true }))) return;
        const reason = window.prompt('Add an optional reason for the audit record:', ''); if (reason === null) return;
        try { await api(`/api/admin/guilds/${guildId}/blacklist`,{method:'POST',body:JSON.stringify({reason})}); toast('Server blacklisted'); await renderAdminOverview(); } catch(error){toast(error.message);}
      });
      serverRoot.querySelectorAll('[data-admin-invite]').forEach(button => button.onclick = async () => {
        const guildId = button.dataset.adminInvite;
        const serverName = button.closest('.global-server-row')?.querySelector('strong')?.textContent || guildId;
        if (!window.AuralisConfirmDestructive || !(await window.AuralisConfirmDestructive(`Create a fresh temporary invite for ${serverName}? Auralis will replace only the previous invite it created and stored itself; other server invites are not changed. The new invite expires after 24 hours or one use.`, { title: 'Create managed invite', confirmLabel: 'Create invite', danger: false, force: true }))) return;
        button.disabled = true;
        try { const result = await api(`/api/admin/guilds/${guildId}/invite`, { method: 'POST' });
          const dialog = document.createElement('section'); dialog.className = 'confirm-dialog';
          const title = document.createElement('h2'); title.textContent = 'Temporary invite created';
          const copy = document.createElement('p'); copy.textContent = `This invite is valid for up to 24 hours and one use. It replaces only Auralis’s previous managed invite.`;
          const link = document.createElement('input'); link.value = result.url; link.readOnly = true; link.setAttribute('aria-label','Temporary invite link');
          const actions = document.createElement('div'); actions.className = 'confirm-actions';
          const copyButton = document.createElement('button'); copyButton.className = 'button primary'; copyButton.textContent = 'Copy link'; copyButton.onclick = async () => { try { await navigator.clipboard.writeText(result.url); toast('Invite copied'); } catch { link.select(); document.execCommand('copy'); toast('Invite selected/copied'); } };
          const closeButton = document.createElement('button'); closeButton.className = 'button'; closeButton.textContent = 'Done'; closeButton.onclick = () => backdrop.remove();
          actions.append(copyButton,closeButton); dialog.append(title,copy,link,actions);
          const backdrop = document.createElement('div'); backdrop.className='confirm-backdrop'; backdrop.append(dialog); document.body.append(backdrop); link.focus(); link.select();
        }
        catch (error) { toast(error.message); }
        finally { button.disabled = false; }
      });
      serverRoot.querySelectorAll('[data-admin-leave]').forEach(button => button.onclick = async () => {
        const id = button.dataset.adminLeave;
        if (!window.AuralisConfirmDestructive || !(await window.AuralisConfirmDestructive(`Auralis will leave server ${id}. All bot features, logs and scheduled work stop for this server until it is invited again.`, { title: 'Make Auralis leave this server?', confirmLabel: 'Leave server', requireText: 'LEAVE', requireTextLabel: 'Type LEAVE to confirm this action', force: true }))) return;
        button.disabled = true;
        try { await api(`/api/admin/guilds/${id}/leave`, { method: 'POST' }); toast('Auralis left the server.'); await renderAdminOverview(); }
        catch (error) { toast(error.message); }
        finally { button.disabled = false; }
      });
      serverRoot.querySelectorAll('[data-admin-unblacklist]').forEach(button => button.onclick = async () => { try { await api(`/api/admin/guilds/${button.dataset.adminUnblacklist}/blacklist`,{method:'DELETE'}); toast('Server removed from blacklist'); await renderAdminOverview(); } catch(error){toast(error.message);} });
    }).catch(error => { serverRoot.innerHTML = `<div class="empty-state">Server list unavailable: ${esc(error.message)}</div>`; }));
    if (auditRoot) tasks.push(api('/api/admin/audit?limit=30').then(payload => {
      const entries = payload.entries || [];
      auditRoot.innerHTML = entries.length ? entries.map(entry => `<div class="recent-row"><div class="recent-icon">A</div><div><strong>${esc(entry.action)}</strong><p>Actor ${esc(entry.actor_id || 'system')}${entry.target_id ? ` · Target ${esc(entry.target_id)}` : ''}</p><p>${esc(entry.metadata || '')}</p></div><time>${entry.created_at ? esc(formatDateTime(Number(entry.created_at))) : '—'}</time></div>`).join('') : '<div class="empty-state">No global audit entries yet.</div>';
    }).catch(error => { auditRoot.innerHTML = `<div class="empty-state">Audit log unavailable: ${esc(error.message)}</div>`; }));
    await Promise.all(tasks);
  }

  async function renderWelcomeDesigner() {
    if (page !== 'welcome' || !selectedGuild || !guildData) return;
    const canvas = document.querySelector('[data-welcome-canvas]');
    const elementsRoot = document.querySelector('[data-welcome-elements]');
    const inspector = document.querySelector('[data-welcome-inspector]');
    if (!canvas || !elementsRoot || !inspector) return;

    const cfg = guildData.config.welcomeDefaults || {};
    const designer = cfg.designer || {};
    designer.canvas ||= { width: 1024, height: 341 };
    designer.background ||= { color: '#09090D', assetId: null, fit: 'cover', opacity: 1 };
    designer.border ||= { width: 4, color: '#7C6CF5', radius: 0 };
    designer.overlay ||= { enabled: false, color: '#000000', opacity: 0.15 };
    designer.elements ||= [];
    designer.maxElements ||= 40;
    let selectedIndex = 0;
    let assets = [];

    try { assets = (await api(`/api/guilds/${selectedGuild}/welcome-assets`)).assets || []; }
    catch (error) { toast(error.message); }

    const field = (selector) => document.querySelector(selector);
    const getAssetUrl = (id) => {
      const asset = assets.find(item => String(item.id) === String(id));
      return asset ? `${apiBase}${asset.url}` : '';
    };
    const assetsRoot=document.querySelector('[data-welcome-assets]');
    const sampleValues = { user: '@ObsidianDev', user_mention: '@ObsidianDev', username: 'ObsidianDev', user_name: 'ObsidianDev', member_number: '615', member_count: '615', server: 'Auralis Community', user_id: '123456789012345678' };
    const sample = (text) => String(text ?? '').replace(/\{([\w.-]+)\}/g, (_, key) => sampleValues[key] ?? `{${key}}`);
    const syncBaseControls = () => {
      field('[data-welcome-enabled]').checked = cfg.welcomeEnabled !== false;
      field('[data-welcome-mode]').value = cfg.mode || 'image';
      field('[data-welcome-message]').value = cfg.welcomeMessage || '';
      field('[data-welcome-title]').value = cfg.welcomeTitle || '';
      field('[data-welcome-embed]').checked = Boolean(cfg.messageUseEmbed);
      field('[data-welcome-width]').value = designer.canvas.width;
      field('[data-welcome-height]').value = designer.canvas.height;
      field('[data-welcome-bg-color]').value = designer.background.color || '#09090D';
      field('[data-welcome-bg-opacity]').value = designer.background.opacity ?? 1;
      field('[data-welcome-border-color]').value = designer.border.color || '#7C6CF5';
      field('[data-welcome-border-width]').value = designer.border.width ?? 4;
      field('[data-welcome-overlay]').checked = Boolean(designer.overlay.enabled);
      field('[data-welcome-overlay-color]').value = designer.overlay.color || '#000000';
      field('[data-welcome-overlay-opacity]').value = designer.overlay.opacity ?? .15;
      const bgSelect=field('[data-welcome-bg-asset]');
      bgSelect.innerHTML='<option value="">No image background</option>'+assets.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('');
      bgSelect.value=designer.background.assetId || '';
      field('[data-welcome-bg-fit]').value=designer.background.fit||'cover';
    };
    function defaultElement(type='text') {
      const idx=(designer.elements.length||0)+1;
      if(type==='image') return {id:`image-${idx}`,type:'image',assetId:assets[0]?.id||null,x:680,y:30,width:280,height:160,shape:'rounded',radius:20,opacity:1,rotation:0,visible:true,zIndex:20};
      if(type==='avatar') return {id:`avatar-${idx}`,type:'avatar',x:68,y:66,width:190,height:190,shape:'circle',opacity:1,rotation:0,visible:true,zIndex:15};
      if(type==='shape') return {id:`shape-${idx}`,type:'shape',shape:'rect',fill:'#120F16',stroke:'#7C6CF5',strokeWidth:2,x:20,y:20,width:260,height:50,radius:12,opacity:1,rotation:0,visible:true,zIndex:5};
      return {id:`text-${idx}`,type:'text',content:'WELCOME {username}',x:300,y:76,width:650,height:80,fontSize:48,fontFamily:'Impact',fontWeight:800,color:'#FFFFFF',align:'left',opacity:1,rotation:0,shadow:true,visible:true,zIndex:30};
    }
    function renderAssetLibrary(){
      if(!assetsRoot)return;
      assetsRoot.innerHTML=assets.map(asset=>`<article class="welcome-asset-card"><img class="welcome-asset-thumb" src="${esc(apiBase+asset.url)}" crossorigin="use-credentials" alt="${esc(asset.name)}"><div class="welcome-asset-meta"><span class="welcome-asset-name">${esc(asset.name)}</span><span class="welcome-asset-size">${Math.max(1,Math.round(Number(asset.size)/1024))} KB</span></div><div class="welcome-asset-actions"><button type="button" class="button" data-asset-background="${esc(asset.id)}">Background</button><button type="button" class="button danger" data-asset-delete="${esc(asset.id)}">Delete</button></div></article>`).join('') || '<div class="loading">No uploaded assets yet.</div>';
      assetsRoot.querySelectorAll('[data-asset-background]').forEach(b=>b.onclick=()=>{designer.background.assetId=b.dataset.assetBackground;syncBaseControls();renderCanvas();});
      assetsRoot.querySelectorAll('[data-asset-delete]').forEach(b=>b.onclick=async()=>{try{await api(`/api/guilds/${selectedGuild}/welcome-assets/${encodeURIComponent(b.dataset.assetDelete)}`,{method:'DELETE'});assets=assets.filter(a=>a.id!==b.dataset.assetDelete);if(designer.background.assetId===b.dataset.assetDelete)designer.background.assetId=null;for(const el of designer.elements)if(el.assetId===b.dataset.assetDelete)el.assetId=null;renderAll();renderAssetLibrary();toast('Asset deleted.');}catch(error){toast(error.message);}});
    }

    function renderElements(){
      elementsRoot.innerHTML=(designer.elements||[]).map((el,index)=>`<div class="welcome-element-row ${selectedIndex===index?'selected':''}" data-element-index="${index}"><div class="element-row-main"><span class="drag-handle">⋮⋮</span><div><strong>${esc(el.id)}</strong><span>${esc(el.type)}</span></div></div><div class="element-row-actions"><button type="button" class="button" data-element-up="${index}">↑</button><button type="button" class="button" data-element-down="${index}">↓</button><button type="button" class="button danger" data-element-remove="${index}">Delete</button></div></div>`).join('') || '<div class="loading">No elements yet.</div>';
      elementsRoot.querySelectorAll('[data-element-index]').forEach(row=>row.onclick=event=>{ if(event.target.closest('button'))return; selectedIndex=Number(row.dataset.elementIndex); renderAll(); });
      elementsRoot.querySelectorAll('[data-element-up]').forEach(b=>b.onclick=event=>{event.stopPropagation();const i=Number(b.dataset.elementUp);if(i>0){[designer.elements[i-1],designer.elements[i]]=[designer.elements[i],designer.elements[i-1]];selectedIndex=i-1;renderAll();}});
      elementsRoot.querySelectorAll('[data-element-down]').forEach(b=>b.onclick=event=>{event.stopPropagation();const i=Number(b.dataset.elementDown);if(i<designer.elements.length-1){[designer.elements[i+1],designer.elements[i]]=[designer.elements[i],designer.elements[i+1]];selectedIndex=i+1;renderAll();}});
      elementsRoot.querySelectorAll('[data-element-remove]').forEach(b=>b.onclick=event=>{event.stopPropagation();designer.elements.splice(Number(b.dataset.elementRemove),1);selectedIndex=Math.max(0,Math.min(selectedIndex,designer.elements.length-1));renderAll();});
    }
    function renderInspector(){
      const el=designer.elements[selectedIndex];
      if(!el){inspector.innerHTML='<h3>Element inspector</h3><p>Select an element to edit it.</p>';return;}
      const text=el.type==='text', image=['image','avatar'].includes(el.type), shape=el.type==='shape';
      const assetsHtml=assets.map(a=>`<option value="${esc(a.id)}" ${String(el.assetId||'')===String(a.id)?'selected':''}>${esc(a.name)}</option>`).join('');
      inspector.innerHTML=`<div class="row component-head"><div><h3>Element inspector</h3><span class="muted">${esc(el.id)} · ${esc(el.type)}</span></div><div class="row"><button type="button" class="button" data-inspector-duplicate>Duplicate</button><button type="button" class="button danger" data-inspector-remove>Delete</button></div></div>
      <div class="component-grid"><div class="field"><label>ID</label><input data-inspector="id" value="${esc(el.id||'element')}"></div><div class="field"><label>Layer / Z-index</label><input type="number" data-inspector="zIndex" value="${Number(el.zIndex)||0}"></div><div class="field"><label>X</label><input type="number" data-inspector="x" value="${Number(el.x)||0}"></div><div class="field"><label>Y</label><input type="number" data-inspector="y" value="${Number(el.y)||0}"></div><div class="field"><label>Width</label><input type="number" min="1" data-inspector="width" value="${Number(el.width)||100}"></div><div class="field"><label>Height</label><input type="number" min="1" data-inspector="height" value="${Number(el.height)||60}"></div><div class="field"><label>Opacity</label><input type="number" min="0" max="1" step="0.05" data-inspector="opacity" value="${el.opacity??1}"></div><div class="field"><label>Rotation</label><input type="number" min="-180" max="180" data-inspector="rotation" value="${Number(el.rotation)||0}"></div><div class="field"><label>Visible</label><input type="checkbox" data-inspector-check="visible" ${el.visible!==false?'checked':''}></div>
      ${text?`<div class="field wide-field"><label>Text + placeholders</label><textarea data-inspector="content">${esc(el.content||'')}</textarea><span class="muted">{user} {username} {user_name} {member_number} {member_count} {member_ordinal} {server} {user_id}</span></div><div class="field"><label>Font</label><select data-inspector="fontFamily">${['Arial','Arial Black','Impact','Georgia','Trebuchet MS','Verdana','Courier New'].map(font=>`<option value="${font}" ${String(el.fontFamily||'Arial')===font?'selected':''}>${font}</option>`).join('')}</select></div><div class="field"><label>Font size</label><input type="number" min="8" max="180" data-inspector="fontSize" value="${Number(el.fontSize)||32}"></div><div class="field"><label>Weight</label><select data-inspector="fontWeight"><option value="400">400</option><option value="600">600</option><option value="700">700</option><option value="800">800</option></select></div><div class="field"><label>Align</label><select data-inspector="align"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></div><div class="field"><label>Text color</label><input data-inspector="color" value="${esc(el.color||'#FFFFFF')}"></div><div class="field"><label>Shadow</label><input type="checkbox" data-inspector-check="shadow" ${el.shadow!==false?'checked':''}></div>`:''}
      ${image?`<div class="field wide-field"><label>Uploaded image</label><select data-inspector="assetId"><option value="">Select an uploaded image</option>${assetsHtml}</select></div><div class="field"><label>Shape</label><select data-inspector="shape"><option value="rounded" ${el.shape==='rounded'||!el.shape?'selected':''}>Rounded</option><option value="circle" ${el.shape==='circle'?'selected':''}>Circle</option><option value="square" ${el.shape==='square'?'selected':''}>Square</option></select></div><div class="field"><label>Radius</label><input type="number" min="0" max="100" data-inspector="radius" value="${Number(el.radius)||0}"></div>`:''}
      ${shape?`<div class="field"><label>Shape</label><select data-inspector="shape"><option value="rect" ${el.shape==='rect'||!el.shape?'selected':''}>Rectangle</option><option value="circle" ${el.shape==='circle'?'selected':''}>Circle</option></select></div><div class="field"><label>Fill</label><input data-inspector="fill" value="${esc(el.fill||'#111111')}"></div><div class="field"><label>Stroke</label><input data-inspector="stroke" value="${esc(el.stroke||'#FFFFFF')}"></div><div class="field"><label>Stroke width</label><input type="number" min="0" max="30" data-inspector="strokeWidth" value="${Number(el.strokeWidth)||0}"></div><div class="field"><label>Radius</label><input type="number" min="0" max="100" data-inspector="radius" value="${Number(el.radius)||0}"></div>`:''}</div>`;
      inspector.querySelectorAll('[data-inspector]').forEach(input=>input.oninput=()=>{let value=input.value;if(['x','y','width','height','zIndex','opacity','rotation','fontSize','fontWeight','radius','strokeWidth'].includes(input.dataset.inspector))value=Number(value);el[input.dataset.inspector]=value;renderCanvas();});
      if(text){ const fam=inspector.querySelector('[data-inspector="fontFamily"]');if(fam)fam.value=el.fontFamily||'Arial';const wt=inspector.querySelector('[data-inspector="fontWeight"]');if(wt)wt.value=String(el.fontWeight||600);const al=inspector.querySelector('[data-inspector="align"]');if(al)al.value=el.align||'left'; }
      inspector.querySelectorAll('[data-inspector-check]').forEach(input=>input.onchange=()=>{el[input.dataset.inspectorCheck]=input.checked;renderCanvas();});
      inspector.querySelector('[data-inspector-duplicate]')?.addEventListener('click',()=>{const clone=structuredClone(el);clone.id=`${el.id}-copy`;clone.x=(Number(clone.x)||0)+24;clone.y=(Number(clone.y)||0)+24;designer.elements.splice(selectedIndex+1,0,clone);selectedIndex++;renderAll();});
      inspector.querySelector('[data-inspector-remove]')?.addEventListener('click',()=>{designer.elements.splice(selectedIndex,1);selectedIndex=Math.max(0,selectedIndex-1);renderAll();});
    }
    function renderCanvas(){
      const width=Math.max(320,Number(designer.canvas.width)||1024),height=Math.max(180,Number(designer.canvas.height)||341);designer.canvas.width=width;designer.canvas.height=height;canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;const bgAssetUrl=getAssetUrl(designer.background.assetId);const bgGradient=designer.background.gradient?.enabled?`linear-gradient(135deg, ${designer.background.gradient.from||'#09090D'}, ${designer.background.gradient.to||'#17152D'})`:'none';canvas.style.backgroundColor=designer.background.color||'#09090D';canvas.style.backgroundImage=bgAssetUrl?`${designer.background.opacity<1?`linear-gradient(rgba(0,0,0,${1-(designer.background.opacity??1)}),rgba(0,0,0,${1-(designer.background.opacity??1)})),`:''}url("${bgAssetUrl}")`:bgGradient;canvas.style.backgroundSize=bgAssetUrl?(designer.background.fit==='contain'?'contain':'cover'):'100% 100%';canvas.style.backgroundRepeat='no-repeat';canvas.style.border=`${Number(designer.border.width)||0}px solid ${designer.border.color||'#7C6CF5'}`;canvas.style.borderRadius=`${Number(designer.border.radius)||0}px`;canvas.innerHTML='';const scale=canvas.clientWidth/width||1;for(const el of [...designer.elements].sort((a,b)=>(Number(a.zIndex)||0)-(Number(b.zIndex)||0))){if(el.visible===false)continue;const node=document.createElement(el.type==='image'||el.type==='avatar'?'img':'div');node.className=`welcome-preview-element welcome-${el.type}`;node.dataset.id=el.id;node.style.left=`${Number(el.x)||0}px`;node.style.top=`${Number(el.y)||0}px`;node.style.width=`${Number(el.width)||100}px`;node.style.height=`${Number(el.height)||60}px`;node.style.zIndex=Number(el.zIndex)||1;node.style.opacity=el.opacity??1;node.style.transform=`rotate(${Number(el.rotation)||0}deg)`;if(el.type==='text'){node.textContent=sample(el.content||'');node.style.fontSize=`${Number(el.fontSize)||32}px`;node.style.fontFamily=el.fontFamily||'Arial';node.style.fontWeight=el.fontWeight||600;node.style.color=el.color||'#fff';node.style.textAlign=el.align||'left';node.style.textShadow=el.shadow===false?'none':'0 3px 10px rgba(0,0,0,.9)';node.style.whiteSpace='pre-wrap';node.style.overflow='hidden';}if(el.type==='image'){const url=getAssetUrl(el.assetId);if(url){node.crossOrigin='use-credentials';node.src=url;}node.style.objectFit='cover';node.style.borderRadius=el.shape==='circle'?'50%':`${Number(el.radius)||18}px`;}if(el.type==='avatar'){node.src='../assets/auralis-logo.png';node.style.objectFit='cover';node.style.borderRadius='50%';}if(el.type==='shape'){node.style.background=el.fill||'#111';node.style.border=`${Number(el.strokeWidth)||0}px solid ${el.stroke||'transparent'}`;node.style.borderRadius=el.shape==='circle'?'50%':`${Number(el.radius)||0}px`;}
        node.onpointerdown=event=>{if(event.target.classList.contains('welcome-resize-handle'))return;event.preventDefault();selectedIndex=designer.elements.findIndex(item=>item.id===el.id);renderInspector();renderElements();const startX=event.clientX,startY=event.clientY,ox=Number(el.x)||0,oy=Number(el.y)||0;node.setPointerCapture?.(event.pointerId);const move=e=>{el.x=Math.round(ox+(e.clientX-startX)/scale);el.y=Math.round(oy+(e.clientY-startY)/scale);node.style.left=`${el.x}px`;node.style.top=`${el.y}px`;};const up=()=>{node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',up);};node.addEventListener('pointermove',move);node.addEventListener('pointerup',up,{once:true});};canvas.appendChild(node);const handle=document.createElement('span');handle.className='welcome-resize-handle';handle.onpointerdown=event=>{event.stopPropagation();event.preventDefault();const startX=event.clientX,startY=event.clientY,ow=Number(el.width)||100,oh=Number(el.height)||60;handle.setPointerCapture?.(event.pointerId);const move=e=>{el.width=Math.max(20,Math.round(ow+(e.clientX-startX)/scale));el.height=Math.max(20,Math.round(oh+(e.clientY-startY)/scale));node.style.width=`${el.width}px`;node.style.height=`${el.height}px`;};const up=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);};handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up,{once:true});};node.appendChild(handle);}
      field('[data-welcome-size-label]').textContent=`${width} × ${height}`;
    }
    async function uploadImage(file){if(!file)return;if(file.size>Number(designer.upload?.maxBytes||6291456))return toast('Image is too large.');const reader=new FileReader();reader.onload=async()=>{try{await api(`/api/guilds/${selectedGuild}/welcome-assets`,{method:'POST',body:JSON.stringify({name:file.name,data:reader.result})});toast('Image uploaded.');await renderWelcomeDesigner();}catch(error){toast(error.message);}};reader.readAsDataURL(file);}
    function renderAll(){renderElements();renderInspector();renderAssetLibrary();renderCanvas();}
    syncBaseControls();
    field('[data-welcome-upload]').onchange=e=>uploadImage(e.target.files?.[0]);
    field('[data-welcome-add]').onclick=()=>{if(designer.elements.length>=designer.maxElements)return toast(`Maximum ${designer.maxElements} elements.`);designer.elements.push(defaultElement(field('[data-welcome-add-type]').value));selectedIndex=designer.elements.length-1;renderAll();};
    field('[data-welcome-save]').onclick=async()=>{try{designer.canvas.width=Number(field('[data-welcome-width]').value||1024);designer.canvas.height=Number(field('[data-welcome-height]').value||341);designer.background.color=field('[data-welcome-bg-color]').value;designer.background.assetId=field('[data-welcome-bg-asset]').value||null;designer.background.opacity=Number(field('[data-welcome-bg-opacity]').value||1);designer.background.fit=field('[data-welcome-bg-fit]').value||'cover';designer.border.color=field('[data-welcome-border-color]').value;designer.border.width=Number(field('[data-welcome-border-width]').value||0);designer.overlay.enabled=field('[data-welcome-overlay]').checked;designer.overlay.color=field('[data-welcome-overlay-color]').value;designer.overlay.opacity=Number(field('[data-welcome-overlay-opacity]').value||.15);cfg.welcomeEnabled=field('[data-welcome-enabled]').checked;cfg.mode=field('[data-welcome-mode]').value;cfg.welcomeMessage=field('[data-welcome-message]').value;cfg.welcomeTitle=field('[data-welcome-title]').value;cfg.messageUseEmbed=field('[data-welcome-embed]').checked;cfg.welcomeChannelId=field('[data-welcome-channel]').value||null;cfg.designer=designer;await api(`/api/guilds/${selectedGuild}/config`,{method:'PATCH',body:JSON.stringify({welcomeDefaults:cfg})});toast('Welcome design saved.');}catch(error){toast(error.message);}};
    field('[data-welcome-classic]').onclick=()=>{designer.elements=[defaultElement('text'),defaultElement('text'),defaultElement('avatar'),defaultElement('shape')];designer.elements[0].id='welcome-title';designer.elements[0].content='WELCOME {username}';designer.elements[0].x=300;designer.elements[0].y=76;designer.elements[0].width=650;designer.elements[0].height=76;designer.elements[0].fontSize=50;designer.elements[0].zIndex=20;designer.elements[1].id='welcome-subtitle';designer.elements[1].content='YOU ARE THE {member_number}TH MEMBER!';designer.elements[1].x=300;designer.elements[1].y=156;designer.elements[1].width=650;designer.elements[1].height=88;designer.elements[1].fontSize=42;designer.elements[1].zIndex=21;designer.elements[2].id='member-avatar';designer.elements[2].x=68;designer.elements[2].y=66;designer.elements[2].width=190;designer.elements[2].height=190;designer.elements[2].zIndex=15;designer.elements[3].id='avatar-ring';designer.elements[3].shape='circle';designer.elements[3].fill='#FFFFFF';designer.elements[3].stroke='#7C6CF5';designer.elements[3].strokeWidth=5;designer.elements[3].x=62;designer.elements[3].y=60;designer.elements[3].width=202;designer.elements[3].height=202;designer.elements[3].zIndex=10;selectedIndex=0;renderAll();};
    renderAll();
  }

  async function renderImageOnlyChannels() {
    const selector = document.querySelector('[data-imageonly-channel-select]');
    const list = document.querySelector('[data-imageonly-list]');
    if (!selector || !list || !selectedGuild) return;
    const fillSelect = () => {
      const textChannels = (resources.channels || []).filter(isTextChannel);
      selector.innerHTML = '<option value="">Select a channel…</option>' + textChannels.map(channel => `<option value="${esc(channel.id)}">#${esc(channel.name)}</option>`).join('');
    };
    const render = async () => {
      const payload = await api(`/api/guilds/${selectedGuild}/image-only-channels`);
      const byId = new Map((resources.channels || []).map(channel => [channel.id, channel]));
      list.innerHTML = (payload.channels || []).map(item => {
        const channel = byId.get(item.channelId);
        return `<div class="list-item"><div><strong>#${esc(channel?.name || 'Unknown channel')}</strong><span>${esc(item.channelId)}</span></div><button class="button danger" data-imageonly-remove="${esc(item.channelId)}">Remove</button></div>`;
      }).join('') || '<p class="muted">No image-only channels configured.</p>';
      list.querySelectorAll('[data-imageonly-remove]').forEach(button => button.onclick = async () => {
        try {
          await api(`/api/guilds/${selectedGuild}/image-only-channels/${encodeURIComponent(button.dataset.imageonlyRemove)}`, { method: 'DELETE' });
          toast('Image-only channel removed');
          await render();
        } catch (error) { toast(error.message); }
      });
    };
    try {
      fillSelect();
      await render();
      const add = document.querySelector('[data-imageonly-add]');
      if (add) add.onclick = async () => {
        if (!selector.value) return toast('Choose a text channel first.');
        try {
          await api(`/api/guilds/${selectedGuild}/image-only-channels`, { method: 'POST', body: JSON.stringify({ channelId: selector.value }) });
          toast('Image-only channel added');
          await render();
        } catch (error) { toast(error.message); }
      };
      const refresh = document.querySelector('[data-imageonly-refresh]');
      if (refresh) refresh.onclick = async () => {
        try {
          const next = await api(`/api/guilds/${selectedGuild}/resources`);
          resources = next || resources;
          fillSelect();
          await render();
        } catch (error) { toast(error.message); }
      };
    } catch (error) { toast(`Image-only settings: ${error.message}`); }
  }

  async function renderHoneypotChannels() {
    const selector = document.querySelector('[data-honeypot-channel-select]');
    const list = document.querySelector('[data-honeypot-list]');
    if (!selector || !list || !selectedGuild) return;
    const fillSelect = () => {
      selector.innerHTML = '<option value="">Select a channel…</option>' + (resources.channels || []).filter(isTextChannel).map(channel => `<option value="${esc(channel.id)}">#${esc(channel.name)}</option>`).join('');
    };
    const render = () => {
      const ids = guildData?.config?.honeypotDefaults?.channelIds || [];
      const byId = new Map((resources.channels || []).map(channel => [channel.id, channel]));
      list.innerHTML = ids.map(id => {
        const channel = byId.get(id);
        return `<div class="list-item"><div><strong>#${esc(channel?.name || 'Unknown channel')}</strong><span>${esc(id)}</span></div><button class="button danger" data-honeypot-remove="${esc(id)}">Remove</button></div>`;
      }).join('') || '<p class="muted">No honeypot channels configured.</p>';
      list.querySelectorAll('[data-honeypot-remove]').forEach(button => button.onclick = async () => {
        const next = (guildData?.config?.honeypotDefaults?.channelIds || []).filter(id => id !== button.dataset.honeypotRemove);
        try {
          const out = await api(`/api/guilds/${selectedGuild}/config`, { method: 'PATCH', body: JSON.stringify({ honeypotDefaults: { channelIds: next } }) });
          guildData.config = out.config;
          toast('Honeypot channel removed');
          render();
        } catch (error) { toast(error.message); }
      });
    };
    try {
      fillSelect();
      render();
      const add = document.querySelector('[data-honeypot-add]');
      if (add) add.onclick = async () => {
        const channelId = selector.value;
        if (!channelId) return toast('Choose a text channel first.');
        const current = guildData?.config?.honeypotDefaults?.channelIds || [];
        if (current.includes(channelId)) return toast('That channel is already configured.');
        try {
          const out = await api(`/api/guilds/${selectedGuild}/config`, { method: 'PATCH', body: JSON.stringify({ honeypotDefaults: { channelIds: [...current, channelId] } }) });
          guildData.config = out.config;
          toast('Honeypot channel added');
          render();
        } catch (error) { toast(error.message); }
      };
      const refresh = document.querySelector('[data-honeypot-refresh]');
      if (refresh) refresh.onclick = async () => {
        try {
          const next = await api(`/api/guilds/${selectedGuild}/resources`);
          resources = next || resources;
          fillSelect();
          render();
        } catch (error) { toast(error.message); }
      };
      const postWarning = document.querySelector('[data-honeypot-warning]');
      if (postWarning) postWarning.onclick = async () => {
        const channelId = selector.value;
        if (!channelId) return toast('Choose the target honeypot channel first.');
        postWarning.disabled = true;
        try {
          const out = await api(`/api/guilds/${selectedGuild}/honeypot-warning`, { method: 'POST', body: JSON.stringify({ channelId }) });
          toast('Honeypot warning panel sent');
          if (out.url) window.open(out.url, '_blank', 'noopener,noreferrer');
        } catch (error) { toast(error.message); }
        finally { postWarning.disabled = false; }
      };
    } catch (error) { toast(`Honeypot settings: ${error.message}`); }
  }

  async function renderHoneypotThresholdEditor() {
    const root = document.querySelector('[data-honeypot-thresholds]');
    const add = document.querySelector('[data-honeypot-add-threshold]');
    const save = document.querySelector('[data-honeypot-save]');
    if (!root || !selectedGuild || !guildData) return;
    const saved = guildData.config?.honeypotDefaults || {};
    let tiers = Array.isArray(saved.thresholds) && saved.thresholds.length
      ? structuredClone(saved.thresholds)
      : [{ hits: Number(saved.threshold) || 1, action: String(saved.action || 'log'), timeoutSeconds: Number(saved.timeoutSeconds) || 3600 }];
    const actionOptions = [['log','Log only'],['warn','Create warning case'],['timeout','Timeout'],['kick','Kick'],['ban','Ban']];
    const makeRow = tier => `<div class="honeypot-threshold-row" data-threshold-row><div class="field"><label>Messages / hits</label><input type="number" min="1" max="100000" data-threshold-hits value="${esc(Math.max(1, Number(tier.hits) || 1))}"></div><div class="field"><label>Action when reached</label><select data-threshold-action>${actionOptions.map(([value,label]) => `<option value="${value}" ${String(tier.action || 'log') === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div><div class="field threshold-timeout-field"><label>Timeout (seconds)</label><input type="number" min="1" max="2419200" data-threshold-timeout value="${esc(Math.max(1, Math.min(2419200, Number(tier.timeoutSeconds || saved.timeoutSeconds) || 3600)))}"></div><button class="button danger small" type="button" data-threshold-remove aria-label="Remove threshold">Remove</button></div>`;
    const render = () => {
      root.innerHTML = tiers.map(makeRow).join('');
      root.querySelectorAll('[data-threshold-action]').forEach(select => {
        const row = select.closest('[data-threshold-row]');
        const timeout = row?.querySelector('[data-threshold-timeout]')?.closest('.threshold-timeout-field');
        if (timeout) timeout.hidden = select.value !== 'timeout';
        select.onchange = () => { if (timeout) timeout.hidden = select.value !== 'timeout'; };
      });
      root.querySelectorAll('[data-threshold-remove]').forEach(button => button.onclick = () => {
        if (tiers.length <= 1) return toast('Keep at least one threshold rule.');
        const current = readRows(); if (!current) return;
        current.splice(Number(button.closest('[data-threshold-row]')?.dataset.index || 0), 1);
        tiers = current;
        render();
      });
      root.querySelectorAll('[data-threshold-row]').forEach((row,index) => { row.dataset.index = String(index); });
    };
    const readRows = (showErrors = true) => {
      const rows = [...root.querySelectorAll('[data-threshold-row]')];
      const parsed = rows.map(row => ({
        hits: Number(row.querySelector('[data-threshold-hits]')?.value),
        action: String(row.querySelector('[data-threshold-action]')?.value || 'log'),
        timeoutSeconds: Math.max(1, Math.min(2419200, Number(row.querySelector('[data-threshold-timeout]')?.value) || Number(saved.timeoutSeconds) || 3600))
      }));
      if (parsed.some(item => !Number.isInteger(item.hits) || item.hits < 1 || item.hits > 100000)) { if (showErrors) toast('Every threshold must be a whole number between 1 and 100000.'); return null; }
      parsed.sort((a,b) => a.hits - b.hits);
      if (new Set(parsed.map(item => item.hits)).size !== parsed.length) { if (showErrors) toast('Each threshold must use a different hit count.'); return null; }
      return parsed;
    };
    render();
    if (add) add.onclick = () => {
      const current = readRows(); if (!current) return;
      const nextHits = Math.max(1, ...current.map(item => item.hits)) + 1;
      tiers = [...current, { hits: nextHits, action: 'warn', timeoutSeconds: Number(saved.timeoutSeconds) || 3600 }];
      render();
      root.querySelector('[data-threshold-row]:last-child [data-threshold-hits]')?.focus();
    };
    if (save) save.onclick = async () => {
      const thresholds = readRows(); if (!thresholds) return;
      save.disabled = true;
      try {
        const patch = collectBindings();
        patch.honeypotDefaults ||= {};
        patch.honeypotDefaults.thresholds = thresholds;
        patch.honeypotDefaults.threshold = thresholds[0]?.hits || 1;
        patch.honeypotDefaults.action = thresholds[0]?.action || 'log';
        const out = await api(`/api/guilds/${selectedGuild}/config`, { method: 'PATCH', body: JSON.stringify(patch) });
        guildData.config = out.config || { ...guildData.config, ...patch };
        tiers = thresholds;
        toast('Honeypot thresholds saved');
        render();
      } catch (error) { toast(error.message); }
      finally { save.disabled = false; }
    };
  }

  function fillChannelSelect(select, placeholder = 'Choose a text channel') {
    if (!select) return;
    const previous = select.value;
    const channels = (resources.channels || []).filter(isTextChannel);
    select.innerHTML = `<option value="">${esc(placeholder)}</option>${channels.map(channel => `<option value="${esc(channel.id)}">#${esc(channel.name)}</option>`).join('')}`;
    if (channels.some(channel => channel.id === previous)) select.value = previous;
  }

  async function renderAutoroles() {
    const selector = document.querySelector('[data-autorole-role]');
    const list = document.querySelector('[data-autorole-list]');
    if (!selector || !list || !selectedGuild) return;
    const fill = () => {
      const previous = selector.value;
      selector.innerHTML = '<option value="">Select a role</option>' + (resources.roles || []).filter(role => role.id !== selectedGuild).map(role => `<option value="${esc(role.id)}">${esc(role.name)}</option>`).join('');
      if ([...selector.options].some(option => option.value === previous)) selector.value = previous;
    };
    const render = roleIds => {
      const roles = new Map((resources.roles || []).map(role => [String(role.id), role]));
      list.innerHTML = (roleIds || []).map(roleId => {
        const role = roles.get(String(roleId));
        return `<div class="list-item"><div><strong>${esc(role?.name || 'Unknown role')}</strong><span>${esc(roleId)}</span></div><button class="button danger" type="button" data-autorole-remove="${esc(roleId)}">Remove</button></div>`;
      }).join('') || '<p class="muted">No automatic roles configured.</p>';
      list.querySelectorAll('[data-autorole-remove]').forEach(button => button.onclick = async () => {
        button.disabled = true;
        try {
          const out = await api(`/api/guilds/${selectedGuild}/autoroles/${encodeURIComponent(button.dataset.autoroleRemove)}`, { method: 'DELETE' });
          render(out.roleIds || []);
          toast('Automatic role removed');
        } catch (error) { toast(error.message); }
        finally { button.disabled = false; }
      });
    };
    const refresh = async () => {
      fill();
      const result = await api(`/api/guilds/${selectedGuild}/autoroles`);
      render(result.roleIds || []);
    };
    const add = document.querySelector('[data-autorole-add]');
    if (add) add.onclick = async () => {
      if (!selector.value) return toast('Select a role first.');
      add.disabled = true;
      try {
        const out = await api(`/api/guilds/${selectedGuild}/autoroles`, { method: 'POST', body: JSON.stringify({ roleId: selector.value }) });
        render(out.roleIds || []);
        toast('Automatic role added');
      } catch (error) { toast(error.message); }
      finally { add.disabled = false; }
    };
    const refreshButton = document.querySelector('[data-autorole-refresh]');
    if (refreshButton) refreshButton.onclick = async () => {
      refreshButton.disabled = true;
      try {
        resources = await api(`/api/guilds/${selectedGuild}/resources`);
        await refresh();
      } catch (error) { toast(error.message); }
      finally { refreshButton.disabled = false; }
    };
    try { await refresh(); } catch (error) { list.textContent = `Could not load automatic roles: ${error.message}`; }
  }

  function renderPollComposer() {
    const channel = document.querySelector('[data-poll-channel]');
    if (!channel) return;
    fillChannelSelect(channel, 'Choose where to send the poll');
    const button = document.querySelector('[data-poll-send]');
    if (!button) return;
    button.onclick = async () => {
      const channelId = channel.value;
      const question = document.querySelector('[data-poll-question]')?.value.trim() || '';
      const options = (document.querySelector('[data-poll-options]')?.value || '').split(/\r?\n/).map(value => value.trim()).filter(Boolean);
      const duration = document.querySelector('[data-poll-duration]')?.value.trim() || '';
      const title = document.querySelector('[data-poll-title]')?.value.trim() || '';
      const description = document.querySelector('[data-poll-description]')?.value.trim() || '';
      const result = document.querySelector('[data-poll-result]');
      if (!channelId) return toast('Choose a text channel.');
      if (!question) return toast('Enter a poll question.');
      if (options.length < 2 || options.length > 5) return toast('Enter between two and five options, one per line.');
      button.disabled = true;
      if (result) result.textContent = 'Sending poll...';
      try {
        const out = await api(`/api/guilds/${selectedGuild}/polls`, { method: 'POST', body: JSON.stringify({ channelId, question, options, duration, title, description }) });
        if (result) result.innerHTML = `Poll sent successfully: <a href="${esc(out.url)}" target="_blank" rel="noreferrer">Open poll in Discord</a>`;
        document.querySelector('[data-poll-question]').value = '';
        document.querySelector('[data-poll-options]').value = '';
        toast('Poll sent');
      } catch (error) {
        if (result) result.textContent = error.message;
        toast(error.message);
      } finally { button.disabled = false; }
    };
  }

  function renderMessageComposer() {
    const channel = document.querySelector('[data-message-channel]');
    if (channel) fillChannelSelect(channel, 'Choose where to send the message');
    const send = document.querySelector('[data-message-send]');
    if (send) send.onclick = async () => {
      const channelId = channel?.value || '';
      const input = selector => document.querySelector(selector)?.value.trim() || '';
      const payload = {
        channelId,
        content: input('[data-message-content]'),
        title: input('[data-message-title]'),
        description: input('[data-message-description]'),
        color: input('[data-message-color]'),
        footer: input('[data-message-footer]'),
        url: input('[data-message-url]'),
        image: input('[data-message-image]')
      };
      const result = document.querySelector('[data-message-result]');
      if (!channelId) return toast('Choose a text channel.');
      if (!payload.content && !payload.title && !payload.description) return toast('Enter message content or an embed title/description.');
      send.disabled = true;
      if (result) result.textContent = 'Sending message...';
      try {
        const out = await api(`/api/guilds/${selectedGuild}/messages/send`, { method: 'POST', body: JSON.stringify(payload) });
        if (result) result.innerHTML = `Message sent successfully: <a href="${esc(out.url)}" target="_blank" rel="noreferrer">Open message in Discord</a>`;
        document.querySelector('[data-message-content]').value = '';
        toast('Message sent');
      } catch (error) {
        if (result) result.textContent = error.message;
        toast(error.message);
      } finally { send.disabled = false; }
    };

    const jsonEditor = document.querySelector('[data-config-json]');
    const result = document.querySelector('[data-config-result]');
    const safeConfig = () => {
      const value = structuredClone(guildData?.config || {});
      delete value.dashboardAccess;
      delete value.dashboardSecurity;
      return value;
    };
    if (jsonEditor && !jsonEditor.dataset.loaded) {
      jsonEditor.value = JSON.stringify(safeConfig(), null, 2);
      jsonEditor.dataset.loaded = 'true';
    }
    document.querySelector('[data-config-format]')?.addEventListener('click', () => {
      try {
        jsonEditor.value = JSON.stringify(JSON.parse(jsonEditor.value), null, 2);
        if (result) result.textContent = 'JSON syntax is valid. Changes are not saved yet.';
      } catch (error) {
        if (result) result.textContent = `Invalid JSON: ${error.message}`;
        toast('The configuration is not valid JSON.');
      }
    });
    const saveConfig = document.querySelector('[data-config-save]');
    if (saveConfig) saveConfig.onclick = async () => {
      try {
        const parsed = JSON.parse(jsonEditor.value);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('The configuration root must be a JSON object.');
        if ('dashboardAccess' in parsed || 'dashboardSecurity' in parsed) throw new Error('Dashboard security settings cannot be changed from per-server configuration.');
        saveConfig.disabled = true;
        await api(`/api/guilds/${selectedGuild}/config/raw`, { method: 'PUT', body: JSON.stringify(parsed) });
        if (result) result.textContent = 'Configuration saved. Reloading the current server settings...';
        toast('Configuration saved');
        await loadGuild();
      } catch (error) {
        if (result) result.textContent = `Configuration was not saved: ${error.message}`;
        toast(error.message);
      } finally { saveConfig.disabled = false; }
    };
  }


  async function renderSendPanels() {
    const channel = document.querySelector('[data-panel-channel]');
    const type = document.querySelector('[data-panel-type]');
    const panelId = document.querySelector('[data-panel-id]');
    const send = document.querySelector('[data-panel-send]');
    const result = document.querySelector('[data-panel-result]');
    if (!channel || !type || !send || !selectedGuild) return;
    fillChannelSelect(channel, 'Choose target text channel');
    const updatePanelId = () => {
      const ticket = type.value === 'ticket';
      panelId?.closest('.field')?.classList.toggle('hidden', !ticket);
      if (!ticket && panelId) panelId.value = '';
      if (panelId) panelId.placeholder = 'default or panel ID';
    };
    type.onchange = updatePanelId;
    updatePanelId();
    send.onclick = async () => {
      const channelId = channel.value;
      if (!channelId) return toast('Choose a target channel.');
      send.disabled = true;
      if (result) result.textContent = 'Sending panel to Discord…';
      try {
        const out = await api(`/api/guilds/${selectedGuild}/panels/send`, {
          method: 'POST',
          body: JSON.stringify({ type: type.value, channelId, panelId: panelId?.value.trim() || 'default' })
        });
        if (result) result.innerHTML = `${esc(out.type)} panel sent successfully: <a href="${esc(out.url)}" target="_blank" rel="noreferrer">Open message in Discord</a>`;
        toast('Panel sent');
      } catch (error) {
        if (result) result.textContent = error.message;
        toast(error.message);
      } finally { send.disabled = false; }
    };
  }

  async function renderSlashCommandPermissions() {
    const root = document.querySelector('[data-slash-command-list]');
    if (!root) return;
    try {
      const response = await api(`/api/guilds/${selectedGuild}/command-permissions`);
      const roleOptions = (resources.roles || []).map(role => `<option value="${esc(role.id)}">${esc(role.name)}</option>`).join('');
      const permissions = ['None','Administrator','ManageGuild','ManageMessages','ManageChannels','ManageRoles','ModerateMembers','KickMembers','BanMembers','ViewAuditLog','ManageThreads','EmbedLinks'];
      root.innerHTML = (response.commands || []).map(command => {
        const required = command.permission !== 'None' ? `[${command.permission.toUpperCase()}]` : command.roleId ? '[STAFF ROLE]' : command.defaultMemberPermissions ? '[DISCORD LOCK]' : '[PUBLIC]';
        return `<div class="command-rule" data-command-row="${esc(command.name)}"><div class="command-rule-heading"><div><strong>/${esc(command.name)}</strong> <span class="command-tag">${esc(required)}</span><p>${esc(command.description)}</p></div><span class="muted">${command.enabled ? 'Enabled' : 'Disabled'}</span></div><div class="command-rule-controls"><label>Required role<select data-command-role><option value="">No extra role</option>${roleOptions}</select></label><label>Required permission<select data-command-permission>${permissions.map(permission => `<option value="${esc(permission)}">${esc(permission === 'None' ? 'No extra permission' : permission)}</option>`).join('')}</select></label><label>Command state<select data-command-enabled><option value="true">Enabled</option><option value="false">Disabled</option></select></label><button class="button primary" type="button" data-command-save>Save rule</button></div></div>`;
      }).join('') || '<div class="loading">No slash commands are registered.</div>';
      root.querySelectorAll('[data-command-row]').forEach(row => {
        const command = (response.commands || []).find(item => item.name === row.dataset.commandRow);
        row.querySelector('[data-command-role]').value = command?.roleId || '';
        row.querySelector('[data-command-permission]').value = command?.permission || 'None';
        row.querySelector('[data-command-enabled]').value = String(command?.enabled !== false);
        row.querySelector('[data-command-save]').onclick = async event => {
          const button = event.currentTarget;
          button.disabled = true;
          try {
            await api(`/api/guilds/${selectedGuild}/command-permissions/${encodeURIComponent(row.dataset.commandRow)}`, {
              method: 'PATCH', body: JSON.stringify({
                roleId: row.querySelector('[data-command-role]').value,
                permission: row.querySelector('[data-command-permission]').value,
                enabled: row.querySelector('[data-command-enabled]').value === 'true'
              })
            });
            toast(`/${row.dataset.commandRow} access updated`);
            await renderSlashCommandPermissions();
          } catch (error) { toast(error.message); }
          finally { button.disabled = false; }
        };
      });
    } catch (error) { root.innerHTML = `<div class="loading">${esc(error.message)}</div>`; }
  }

  async function renderStaffOverview(range = currentStaffRange) {
    if (page !== 'staffactivity' || !selectedGuild) return;
    currentStaffRange = ['today','7d','14d','all'].includes(range) ? range : '7d';
    document.querySelectorAll('[data-staff-range]').forEach(button => button.classList.toggle('active', button.dataset.staffRange === currentStaffRange));
    const body = document.querySelector('[data-staff-overview-table]');
    if (!body) return;
    body.innerHTML = '<tr><td colspan="7">Loading staff activity…</td></tr>';
    try {
      const payload = await api(`/api/guilds/${selectedGuild}/staff-overview?range=${encodeURIComponent(currentStaffRange)}`);
      const totals = payload.totals || {};
      const number = value => Number(value || 0).toLocaleString(guildData?.config?.dashboardPreferences?.locale || 'en-GB');
      for (const [selector, value] of [['[data-staff-total-actions]', totals.actions], ['[data-staff-total-messages]', totals.messages], ['[data-staff-total-commands]', totals.commands], ['[data-staff-total-ticket-closes]', totals.ticketCloses], ['[data-staff-total-cases]', totals.moderationCases]]) {
        const node = document.querySelector(selector); if (node) animateMetric(node, Number(value || 0));
      }
      const refreshed = document.querySelector('[data-staff-refreshed]');
      if (refreshed) refreshed.textContent = `Updated ${new Date(payload.refreshedAt || Date.now()).toLocaleTimeString(guildData?.config?.dashboardPreferences?.locale || 'en-GB', {hour:'2-digit',minute:'2-digit'})}`;
      const rows = payload.staff || [];
      body.innerHTML = rows.length ? rows.map(item => `<tr><td><strong>${esc(item.userId)}</strong></td><td>${number(item.actions)}</td><td>${number(item.messages)}</td><td>${number(item.commands)}</td><td>${number(item.ticketCloses)}</td><td>${number(item.moderationCases)}</td><td>${item.lastActiveAt ? esc(formatDateTime(Number(item.lastActiveAt))) : '—'}</td></tr>`).join('') : '<tr><td colspan="7">No activity recorded for this time range yet.</td></tr>';
      const note = document.querySelector('[data-staff-overview-note]'); if (note) note.textContent = payload.note || '';
    } catch (error) {
      body.innerHTML = `<tr><td colspan="7">${esc(error.message)}</td></tr>`;
    }
  }

  async function refreshLiveSummary() {
    if (!selectedGuild || liveRefreshInFlight || document.visibilityState !== 'visible') return;
    liveRefreshInFlight = true;
    try {
      const payload = await api(`/api/guilds/${selectedGuild}/summary`);
      const number = value => Number(value || 0).toLocaleString(guildData?.config?.dashboardPreferences?.locale || 'en-GB');
      if (payload.guild?.name) document.querySelectorAll('[data-guild-name]').forEach(node => { node.textContent = payload.guild.name; });
      const stats = payload.stats || {};
      const values = {
        '[data-guild-members]': payload.guild?.approximateMemberCount,
        '[data-open-tickets]': stats.openTickets,
        '[data-total-tickets]': stats.totalTickets,
        '[data-closed-tickets]': stats.closedTickets,
        '[data-pending-applications]': stats.pendingApplications,
        '[data-reviewing-applications]': stats.reviewingApplications,
        '[data-total-applications]': stats.totalApplications,
        '[data-active-app-drafts]': stats.activeApplicationDrafts,
        '[data-case-count]': stats.caseCount,
        '[data-active-cases]': stats.activeCases,
        '[data-warning-count]': stats.activeWarnings,
        '[data-enabled-modules]': stats.enabledModules,
        '[data-guild-roles]': stats.roles,
        '[data-guild-text-channels]': stats.textChannels,
        '[data-guild-voice-channels]': stats.voiceChannels,
        '[data-ticket-open-count]': stats.openTickets,
        '[data-ticket-closed-count]': stats.closedTickets,
        '[data-ticket-total-count]': stats.totalTickets
      };
      Object.entries(values).forEach(([selector, value]) => {
        const node = document.querySelector(selector);
        if (node && value !== null && value !== undefined) {
          if (node.matches('b')) animateMetric(node, Number(value));
          else node.textContent = number(value);
        }
      });
      document.querySelectorAll('[data-dashboard-last-updated]').forEach(node => node.textContent = `Updated ${new Date(payload.refreshedAt || Date.now()).toLocaleTimeString(guildData?.config?.dashboardPreferences?.locale || 'en-GB', {hour:'2-digit',minute:'2-digit',second:'2-digit'})}`);
      if (page === 'staffactivity') await renderStaffOverview(currentStaffRange);
    } catch (error) {
      // Quietly keep the last successful values; the next poll can recover from temporary API/hosting hiccups.
      console.debug('[Auralis] live summary refresh skipped:', error.message);
    } finally { liveRefreshInFlight = false; }
  }

  function startLiveRefresh() {
    if (liveRefreshTimer) clearInterval(liveRefreshTimer);
    const configured = Number(guildData?.config?.dashboardPreferences?.refreshIntervalSeconds || 15);
    const seconds = Math.max(5, Math.min(120, Number.isFinite(configured) ? configured : 15));
    liveRefreshTimer = setInterval(() => { void refreshLiveSummary(); }, seconds * 1000);
  }

  function renderPlaceholders() {
    if (page !== 'placeholders') return;
    const root = document.querySelector('[data-placeholder-root]');
    const search = document.querySelector('[data-placeholder-search]');
    if (!root) return;
    const entries = [
      ['Members & server', [['{user}','User mention'],['{username}','Username'],['{userId}','Discord user ID'],['{server}','Server name'],['{guildId}','Discord server ID'],['{channel}','Channel mention'],['{channelId}','Discord channel ID'],['{memberCount}','Current member count'],['{member_number}','Member number'],['{prefix}','Configured command prefix']]],
      ['Moderation', [['{reason}','Moderation reason'],['{moderator}','Moderator mention/name'],['{moderatorId}','Moderator ID'],['{caseId}','Case number'],['{warningCount}','Warning count'],['{activeWarnings}','Active warnings'],['{totalWarnings}','All recorded warnings'],['{duration}','Action duration'],['{expiresAt}','Expiration date and time'],['{expiresRelative}','Relative expiration time'],['{dmStatus}','Member DM result']]],
      ['Tickets & applications', [['{ticketId}','Ticket number'],['{ticket}','Ticket channel/number'],['{ticketType}','Ticket type'],['{closedBy}','Member who closed a ticket'],['{closeReason}','Ticket close reason'],['{applicationId}','Application number'],['{applicationType}','Application type'],['{applicant}','Applicant mention/name']]],
      ['Giveaways & community', [['{prize}','Giveaway prize'],['{winners}','Winner mentions'],['{host}','Giveaway host'],['{entries}','Number of entries'],['{level}','Member level'],['{amount}','Economy amount'],['{currency}','Configured currency name'],['{count}','Relevant count'],['{streak}','Daily reward streak'],['{wallet}','Wallet balance'],['{bank}','Bank balance'],['{bankCap}','Bank capacity']]]
    ];
    const draw = () => {
      const term = String(search?.value || '').trim().toLowerCase();
      const groups = entries.map(([title,items]) => [title,items.filter(([token,label]) => `${token} ${label}`.toLowerCase().includes(term))]).filter(([,items]) => items.length);
      root.innerHTML = groups.length ? groups.map(([title,items]) => `<article class="card wide placeholder-group"><div class="card-head"><h3>${esc(title)}</h3><span class="status-chip">${items.length} placeholders</span></div><div class="placeholder-list">${items.map(([token,label]) => `<button class="placeholder-item" type="button" data-copy-placeholder="${esc(token)}"><code>${esc(token)}</code><span>${esc(label)}</span><span class="placeholder-copy">Copy</span></button>`).join('')}</div></article>`).join('') : '<div class="empty-state">No placeholders match this search.</div>';
      root.querySelectorAll('[data-copy-placeholder]').forEach(button => button.onclick = async () => {
        const token = button.dataset.copyPlaceholder;
        try { await navigator.clipboard.writeText(token); toast(`Copied ${token}`); }
        catch { const input = document.createElement('textarea'); input.value = token; document.body.append(input); input.select(); const ok = document.execCommand('copy'); input.remove(); toast(ok ? `Copied ${token}` : token); }
      });
    };
    if (search && search.dataset.wired !== 'true') { search.dataset.wired = 'true'; search.addEventListener('input', draw); }
    draw();
  }

  async function renderPageSpecific() {
    if (page === 'settings') await renderBotProfileSettings();
    if (page === 'placeholders') renderPlaceholders();
    if (page === 'webhooks') await renderWebhookManager();
    if (page === 'logs') renderLogChannels();
    if (page === 'commands') { renderPrefixCommands(); renderSlashCommandPermissions(); }
    if (page === 'welcome') renderWelcomeDesigner();
    if (page === 'admin') renderAdmin();
    if (page === 'automod') renderImageOnlyChannels();
    if (page === 'security') { await Promise.all([renderHoneypotChannels(), renderHoneypotThresholdEditor()]); }
    if (page === 'community') { renderAutoroles(); renderPollComposer(); }
    if (page === 'messages') renderMessageComposer();
    if (page === 'staffactivity') await renderStaffOverview('7d');
    if (page === 'panels') renderSendPanels();
    if (page === 'overview') await renderOverviewExtras();
    if (page === 'tickets') await renderTicketTable();
    if (page === 'applications') { renderApplicationFormBuilder(); await renderApplicationPanelSets(); await renderApplicationsTable(); }
    if (page === 'admin') await renderAdminOverview();
  }

  async function boot() {
    document.querySelector('[data-login]')?.setAttribute('href', loginUrl());
    try {
      const me = await api('/api/me');
      currentUser = me.user || null;
      access = me.dashboardAccess || access;
    } catch {
      document.querySelector('[data-login-screen]')?.classList.remove('hidden');
      document.querySelector('[data-login]')?.setAttribute('href', loginUrl());
      return;
    }

    document.querySelector('[data-login-screen]')?.classList.add('hidden');
    document.querySelector('[data-app]')?.classList.remove('hidden');
    renderNavigation();

    if (page === 'admin') {
      if (access.level === 'none') {
        const root = document.querySelector('[data-page-root]');
        if (root) root.innerHTML = '<div class="card"><h3>Access denied</h3><p>This page is only available to Auralis global staff.</p></div>';
        return;
      }
      await renderPageSpecific();
      return;
    }

    await loadGuilds();
    if (!selectedGuild) {
      const root = document.querySelector('[data-page-root]');
      if (root) root.innerHTML = '<div class="card"><h3>No manageable server</h3><p>Your Discord account needs Administrator or Manage Server permission for a server you want to configure. Invite Auralis to the server to enable live features.</p></div>';
      return;
    }
    try {
      await loadGuild();
      window.dispatchEvent(new CustomEvent('auralis:guild-ready', { detail: { guildId: selectedGuild } }));
      startLiveRefresh();
    } catch (error) {
      toast(error.message);
    }
  }


  document.addEventListener('change', event => {
    if (event.target.matches('[data-application-status-filter]')) void renderApplicationsTable();
  });
  document.addEventListener('click', event => {
    const staffRange = event.target.closest('[data-staff-range]');
    if (staffRange) void renderStaffOverview(staffRange.dataset.staffRange);
    if (event.target.closest('[data-application-refresh]')) void renderApplicationsTable();
    if (event.target.closest('[data-ticket-refresh]')) void renderTicketTable();
  });

  document.addEventListener('DOMContentLoaded', boot);
})();
