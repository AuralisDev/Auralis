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
      if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
      cursor = cursor[key];
    });
    return object;
  }

  function loginUrl() {
    if (apiBase) return `${apiBase}/auth/discord`;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return '/auth/discord';
    return `${String(siteConfig.siteUrl || '../').replace(/\/$/, '')}/setup.html`;
  }

  function toast(message) {
    const node = document.createElement('div');
    node.className = 'toast';
    node.textContent = message;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 2300);
  }

  function can(permission) {
    return access.level === 'owner' || access.permissions?.includes('*') || access.permissions?.includes(permission);
  }

  function pageUrl(file) {
    return `${file}?guild=${encodeURIComponent(selectedGuild)}`;
  }

  const navItems = [
    ['index.html', 'overview', 'Overview', '◌'],
    ['modules.html', 'modules', 'Modules', '◈'],
    ['tickets.html', 'tickets', 'Tickets', '▢'],
    ['staff-activity.html', 'staffactivity', 'Staff Activity', 'A'],
    ['ticket-panels.html', 'ticket-panels', 'Ticket Panels', '▤'],
    ['panels.html', 'panels', 'Send Panels', '➤'],
    ['applications.html', 'applications', 'Applications', '◍'],
    ['moderation.html', 'moderation', 'Moderation', '!'],
    ['automod.html', 'automod', 'Auto Mod', '⌁'],
    ['security.html', 'security', 'Security', '◇'],
    ['community.html', 'community', 'Community', '✦'],
    ['welcome.html', 'welcome', 'Welcome Designer', '✧'],
    ['levels.html', 'levels', 'Levels', '↗'],
    ['giveaways.html', 'giveaways', 'Giveaways', '★'],
    ['reactions.html', 'reactions', 'Roles', '☷'],
    ['messages.html', 'messages', 'Messages & Embeds', '✎'],
    ['logs.html', 'logs', 'Logs', '≡'],
    ['commands.html', 'commands', 'Commands', '⌘']
  ];

  function renderNavigation() {
    const root = document.querySelector('[data-sidebar-nav]');
    if (!root) return;
    root.innerHTML = `<div class="nav-label">Server</div><nav class="nav">${navItems.map(([file, key, label, icon]) => `
      <a class="${page === key ? 'active' : ''}" href="${pageUrl(file)}"><span class="icon">${icon}</span>${label}</a>
    `).join('')}${can('view_all_guilds') ? '<div class="nav-label">Global</div><a class="' + (page === 'admin' ? 'active' : '') + '" href="admin.html"><span class="icon">◆</span>Admin Panel</a>' : ''}</nav>`;

    document.querySelectorAll('[data-login]').forEach((element) => { element.href = loginUrl(); });
    document.querySelectorAll('[data-logout]').forEach((element) => {
      element.onclick = async (event) => {
        event.preventDefault();
        await api('/auth/logout', { method: 'POST' }).catch(() => {});
        window.location.reload();
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
    document.querySelectorAll('[data-guild-name]').forEach((element) => { element.textContent = guildData.guild?.name || 'Server'; });
    document.querySelectorAll('[data-guild-members]').forEach((element) => { element.textContent = Number(guildData.guild?.approximateMemberCount || 0).toLocaleString(); });
    applyBindings();
    const advancedConfigEditor = document.querySelector('[data-config-json]');
    if (advancedConfigEditor) { advancedConfigEditor.value = JSON.stringify(((value) => { delete value.dashboardAccess; delete value.dashboardSecurity; return value; })(structuredClone(guildData.config)), null, 2); advancedConfigEditor.dataset.loaded = 'true'; }
    bindModuleSwitches();
    wireSaveButtons();
    renderPageSpecific();
    return true;
  }

  function isTextChannel(channel) {
    return [0, 5, 15, 16].includes(Number(channel?.type));
  }

  function applyBindings() {
    document.querySelectorAll('[data-bind]').forEach((element) => {
      const value = getPath(guildData.config, element.dataset.bind);
      if (element.type === 'checkbox') {
        element.checked = Boolean(value);
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
      if (current && !Array.isArray(current)) element.value = String(current);
    });
  }

  function collectBindings() {
    const patch = {};
    document.querySelectorAll('[data-bind]').forEach((element) => {
      let value;
      if (element.type === 'checkbox') value = element.checked;
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

  function bindModuleSwitches() {
    const modules = guildData?.config?.modules || {};
    document.querySelectorAll('[data-module-toggle]').forEach((button) => {
      const enabled = modules[button.dataset.moduleToggle] !== false;
      button.classList.toggle('on', enabled);
      button.innerHTML = '<i></i>';
      button.onclick = async () => {
        const next = !button.classList.contains('on');
        try {
          await api(`/api/guilds/${selectedGuild}/config`, {
            method: 'PATCH',
            body: JSON.stringify({ modules: { [button.dataset.moduleToggle]: next } })
          });
          button.classList.toggle('on', next);
          toast(next ? 'Enabled' : 'Disabled');
        } catch (error) {
          toast(error.message);
        }
      };
    });
  }

  function renderLogChannels() {
    const root = document.querySelector('[data-log-list]');
    if (!root) return;
    const channels = guildData?.config?.loggingDefaults?.channels || {};
    const keys = ['server', 'moderation', 'tickets', 'applications', 'automod', 'antinuke', 'audit', 'messageDelete', 'messageEdit', 'joins', 'leaves', 'purges'];
    const options = resources.channels.filter(isTextChannel).map((channel) => `<option value="${channel.id}">#${esc(channel.name)}</option>`).join('');
    root.innerHTML = keys.map((key) => `<div class="list-item"><div><strong>${esc(key)}</strong><span>${channels[key] ? `#${esc(channels[key])}` : 'Not configured'}</span></div><select class="inline-select" data-log-key="${esc(key)}"><option value="">Not configured</option>${options}</select></div>`).join('');
    root.querySelectorAll('[data-log-key]').forEach((select) => {
      select.value = channels[select.dataset.logKey] || '';
      select.onchange = async () => {
        try {
          await api(`/api/guilds/${selectedGuild}/config`, { method: 'PATCH', body: JSON.stringify({ loggingDefaults: { channels: { [select.dataset.logKey]: select.value } } }) });
          toast('Saved');
        } catch (error) { toast(error.message); }
      };
    });
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
      const permissions = ['view_all_guilds', 'manage_guilds', 'leave_guilds', 'blacklist_guilds', 'manage_bot_status', 'manage_staff', 'view_analytics'];
      permissionRoot.innerHTML = permissions.map((permission) => `<label class="check"><input type="checkbox" value="${permission}">${permission}</label>`).join('');
    }

    try {
      const [staff, blacklist, guildData] = await Promise.all([api('/api/admin/staff'), api('/api/admin/blacklist'), api('/api/guilds')]);
      document.querySelector('[data-admin-staff-count]')?.replaceChildren(document.createTextNode(String((staff.staff || []).length)));
      document.querySelector('[data-admin-blacklist-count]')?.replaceChildren(document.createTextNode(String((blacklist.entries || []).length)));
      document.querySelector('[data-admin-guild-count]')?.replaceChildren(document.createTextNode(String((guildData.guilds || []).length)));
      const staffRoot = document.querySelector('[data-admin-staff]');
      const blacklistRoot = document.querySelector('[data-admin-blacklist]');
      if (staffRoot) {
        staffRoot.innerHTML = (staff.staff || []).map((entry) => `<div class="list-item"><div><strong>${esc(entry.userId)}</strong><span>${esc(entry.label || 'Auralis Staff')}</span></div><button class="button danger" data-remove-staff="${entry.userId}">Remove</button></div>`).join('') || '<div class="loading">No staff configured.</div>';
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

    document.querySelector('[data-admin-add]')?.setAttribute('onclick','void 0'); document.querySelector('[data-admin-add]').onclick = async () => {
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

  function renderPageSpecific() {
    if (page === 'logs') renderLogChannels();
    if (page === 'commands') renderPrefixCommands();
    if (page === 'welcome') renderWelcomeDesigner();
    if (page === 'admin') renderAdmin();
    if (page === 'automod') renderImageOnlyChannels();
    if (page === 'security') renderHoneypotChannels();
    if (page === 'community') { renderAutoroles(); renderPollComposer(); }
    if (page === 'messages') renderMessageComposer();
    if (page === 'panels') renderSendPanels();
    if (page === 'commands') renderSlashCommandPermissions();
  }

  async function boot() {
    document.querySelector('[data-login]')?.setAttribute('href', loginUrl());
    try {
      const me = await api('/api/me');
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
    } catch (error) {
      toast(error.message);
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
