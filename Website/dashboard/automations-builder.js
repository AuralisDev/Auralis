(() => {
  'use strict';
  const page = document.body.dataset.page;
  if (page !== 'automations') return;
  const list = document.querySelector('[data-trigger-list]');
  const source = document.querySelector('[data-trigger-json]');
  if (!list || !source) return;
  let rules = [];
  let lastGuild = '';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const toast = message => {
    const node = document.createElement('div'); node.className = 'toast'; node.textContent = message;
    document.body.appendChild(node); setTimeout(() => node.remove(), 2600);
  };
  const normalizedArray = value => Array.isArray(value) ? value.map(String) : [];
  const channelOptions = (selected = []) => {
    const current = window.AuralisDashboardContext || {};
    const items = (current.resources?.channels || []).filter(channel => [0,5,15,16].includes(Number(channel.type)));
    const seen = new Set(items.map(item => String(item.id)));
    const fallback = selected.filter(id => !seen.has(String(id))).map(id => ({id:String(id),name:`Channel ID ${id}`}));
    return [...items, ...fallback].map(item => `<option value="${esc(item.id)}"${selected.map(String).includes(String(item.id))?' selected':''}>#${esc(item.name || item.id)}</option>`).join('');
  };
  const roleOptions = (selected = []) => {
    const current = window.AuralisDashboardContext || {};
    const items = current.resources?.roles || [];
    const seen = new Set(items.map(item => String(item.id)));
    const fallback = selected.filter(id => !seen.has(String(id))).map(id => ({id:String(id),name:`Role ID ${id}`}));
    return [...items, ...fallback].map(item => `<option value="${esc(item.id)}"${selected.map(String).includes(String(item.id))?' selected':''}>@ ${esc(item.name || item.id)}</option>`).join('');
  };
  const valueField = (label, field, value, type = 'text', extra = '') => `<div class="field"><label>${label}</label><input type="${type}" data-trigger-field="${field}" value="${esc(value)}" ${extra}></div>`;
  const textArea = (label, field, value, extra = '') => `<div class="field"><label>${label}</label><textarea data-trigger-field="${field}" ${extra}>${esc(value)}</textarea></div>`;
  const multi = (label, field, type, selected = []) => `<div class="field"><label>${label}</label><select multiple size="4" data-trigger-field="${field}" aria-label="${label}">${type === 'channel' ? channelOptions(selected) : roleOptions(selected)}</select><small class="helper-text">Use Ctrl (Windows) or Command (Mac) to select multiple items.</small></div>`;
  function defaultRule() {
    const id = `response-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;
    return { id, enabled:true, keyword:'', matchType:'contains', responseMode:'channel', channelIds:[], exemptChannelIds:[], allowedRoleIds:[], exemptRoleIds:[], exemptUserIds:[], cooldownSeconds:10, caseSensitive:false, deleteInvocation:false, reply:'', embed:null };
  }
  function render() {
    const count = document.querySelector('[data-trigger-count]');
    if (count) count.textContent = `${rules.length} / 100 rules`;
    if (!rules.length) {
      list.innerHTML = '<div class="empty-state">No keyword responses yet. Choose <strong>New response</strong> to create your first one.</div>';
      syncSource(); return;
    }
    list.innerHTML = rules.map((raw, index) => {
      const rule = raw && typeof raw === 'object' ? raw : defaultRule();
      const embed = rule.embed && typeof rule.embed === 'object' ? rule.embed : {};
      const hasEmbed = Boolean(rule.embed && typeof rule.embed === 'object');
      const safeId = String(rule.id || `response-${index+1}`);
      return `<article class="trigger-card" data-trigger-card data-trigger-index="${index}">
        <div class="trigger-card-head"><div class="trigger-card-index">${index+1}</div><div class="trigger-card-title"><strong>${esc(rule.keyword || 'New keyword response')}</strong><small>${esc(safeId)}</small></div><label class="inline-check trigger-enabled"><input type="checkbox" data-trigger-field="enabled" ${rule.enabled === false ? '' : 'checked'}> Enabled</label><button type="button" class="button danger small" data-trigger-remove>Remove</button></div>
        <div class="component-grid">
          ${valueField('Rule ID','id',safeId,'text','maxlength="64"')}
          ${valueField('Keyword or phrase','keyword',rule.keyword || '','text','maxlength="200" required')}
          <div class="field"><label>Match style</label><select data-trigger-field="matchType"><option value="contains"${(rule.matchType||'contains')==='contains'?' selected':''}>Contains phrase</option><option value="startsWith"${rule.matchType==='startsWith'?' selected':''}>Starts with</option><option value="exact"${rule.matchType==='exact'?' selected':''}>Exact message</option></select></div>
          <div class="field"><label>Reply location</label><select data-trigger-field="responseMode"><option value="channel"${(rule.responseMode||'channel')==='channel'?' selected':''}>Post in channel</option><option value="reply"${rule.responseMode==='reply'?' selected':''}>Reply to the message</option><option value="dm"${rule.responseMode==='dm'?' selected':''}>Send a private DM</option></select></div>
          ${valueField('Cooldown (seconds)','cooldownSeconds',Math.max(0,Number(rule.cooldownSeconds)||0),'number','min="0" max="86400" step="1"')}
          ${textArea('Response message','reply',rule.reply||'','maxlength="1900" placeholder="Hello {user}, here is the information you asked for…"')}
          ${multi('Only in these channels (optional)','channelIds','channel',normalizedArray(rule.channelIds))}
          ${multi('Ignore these channels','exemptChannelIds','channel',normalizedArray(rule.exemptChannelIds))}
          ${multi('Only these roles (optional)','allowedRoleIds','role',normalizedArray(rule.allowedRoleIds))}
          ${multi('Ignore these roles','exemptRoleIds','role',normalizedArray(rule.exemptRoleIds))}
          ${textArea('Allowed user IDs (optional)','allowedUserIds',normalizedArray(rule.allowedUserIds).join(', '),'placeholder="Comma-separated Discord user IDs"')}
          ${textArea('Ignore these user IDs','exemptUserIds',normalizedArray(rule.exemptUserIds).join(', '),'placeholder="Comma-separated Discord user IDs"')}
        </div>
        <div class="trigger-switch-row"><label class="inline-check"><input type="checkbox" data-trigger-field="caseSensitive" ${rule.caseSensitive===true?'checked':''}> Match uppercase/lowercase exactly</label><label class="inline-check"><input type="checkbox" data-trigger-field="deleteInvocation" ${rule.deleteInvocation===true?'checked':''}> Delete the member’s message after responding</label><label class="inline-check"><input type="checkbox" data-trigger-field="embedEnabled" ${hasEmbed?'checked':''}> Send an embed</label></div>
        <div class="trigger-embed-fields${hasEmbed?'':' hidden'}" data-trigger-embed-fields><div class="component-grid">
          ${valueField('Embed title','embed.title',embed.title||'','text','maxlength="256"')}
          ${valueField('Embed colour','embed.color',embed.color||'#7c6cf5','color','')}
          ${textArea('Embed description','embed.description',embed.description||'','maxlength="4096" placeholder="Supports {user}, {server}, {channel} and other placeholders."')}
          ${valueField('Embed URL','embed.url',embed.url||'','url','placeholder="https://…"')}
          ${valueField('Thumbnail URL','embed.thumbnailUrl',embed.thumbnailUrl||'','url','placeholder="https://…/thumbnail.png"')}
          ${valueField('Large image URL','embed.imageUrl',embed.imageUrl||'','url','placeholder="https://…/banner.png"')}
          ${valueField('Footer text','embed.footerText',embed.footerText||'','text','maxlength="2048"')}
        </div><label class="inline-check"><input type="checkbox" data-trigger-field="embed.timestamp" ${embed.timestamp===true?'checked':''}> Show timestamp</label></div>
      </article>`;
    }).join('');
    syncSource();
  }
  function selectedValues(select) { return [...select.selectedOptions].map(option => option.value).filter(Boolean); }
  function readRule(card) {
    const field = name => card.querySelector(`[data-trigger-field="${CSS.escape(name)}"]`);
    const val = name => field(name)?.value ?? '';
    const checked = name => Boolean(field(name)?.checked);
    const arr = name => selectedValues(field(name) || { selectedOptions: [] });
    const userIds = String(val('exemptUserIds')).split(/[\s,;]+/).map(s => s.trim()).filter(Boolean).slice(0,100);
    const allowedUserIds = String(val('allowedUserIds')).split(/[\s,;]+/).map(s => s.trim()).filter(Boolean).slice(0,100);
    const embedEnabled = checked('embedEnabled');
    const rule = {
      id: String(val('id') || `response-${Date.now().toString(36)}`).trim().slice(0,64),
      enabled: checked('enabled'),
      keyword: String(val('keyword')).trim().slice(0,200),
      matchType: ['contains','startsWith','exact'].includes(val('matchType')) ? val('matchType') : 'contains',
      responseMode: ['channel','reply','dm'].includes(val('responseMode')) ? val('responseMode') : 'channel',
      cooldownSeconds: Math.max(0,Math.min(86400,Number(val('cooldownSeconds'))||0)),
      reply: String(val('reply')).slice(0,1900),
      channelIds: arr('channelIds'), exemptChannelIds: arr('exemptChannelIds'),
      allowedRoleIds: arr('allowedRoleIds'), exemptRoleIds: arr('exemptRoleIds'), allowedUserIds, exemptUserIds: userIds,
      caseSensitive: checked('caseSensitive'), deleteInvocation: checked('deleteInvocation')
    };
    if (embedEnabled) {
      const color = String(val('embed.color') || '#7c6cf5');
      rule.embed = { title:String(val('embed.title')).slice(0,256), description:String(val('embed.description')).slice(0,4096), color, url:String(val('embed.url')).slice(0,500), thumbnailUrl:String(val('embed.thumbnailUrl')).slice(0,500), imageUrl:String(val('embed.imageUrl')).slice(0,500), footerText:String(val('embed.footerText')).slice(0,2048), timestamp:checked('embed.timestamp') };
    }
    return rule;
  }
  function syncStateFromDom() {
    const cards = [...list.querySelectorAll('[data-trigger-card]')];
    rules = cards.map(readRule).filter(rule => rule.id || rule.keyword || rule.reply || rule.embed?.title || rule.embed?.description).slice(0,100);
    syncSource();
    const count = document.querySelector('[data-trigger-count]');
    if (count) count.textContent = `${rules.length} / 100 rules`;
  }
  function syncSource() { if (source) source.value = JSON.stringify(rules, null, 2); }
  function loadFromSource() {
    try {
      const parsed = JSON.parse(source.value || '[]');
      if (!Array.isArray(parsed)) throw new Error('The response rules must be a JSON array.');
      rules = parsed.slice(0,100).map(item => ({ ...defaultRule(), ...(item && typeof item==='object'?item:{}) }));
      render(); toast('Response rules loaded into the editor.');
    } catch (error) { toast(`Could not load JSON: ${error.message}`); }
  }
  list.addEventListener('input', event => { if (event.target.matches('[data-trigger-field]')) syncStateFromDom(); });
  list.addEventListener('change', event => {
    const field = event.target.closest('[data-trigger-field]');
    if (field?.dataset.triggerField === 'embedEnabled') field.closest('[data-trigger-card]')?.querySelector('[data-trigger-embed-fields]')?.classList.toggle('hidden', !field.checked);
    if (field) syncStateFromDom();
  });
  list.addEventListener('click', event => {
    const remove = event.target.closest('[data-trigger-remove]');
    if (!remove) return;
    syncStateFromDom();
    const card = remove.closest('[data-trigger-card]');
    rules.splice(Number(card?.dataset.triggerIndex),1);
    render();
  });
  document.querySelector('[data-trigger-new]')?.addEventListener('click', () => {
    syncStateFromDom();
    if (rules.length >= 100) { toast('You have reached the limit of 100 response rules per server.'); return; }
    rules.push(defaultRule()); render();
    list.querySelector('[data-trigger-card]:last-of-type input[data-trigger-field="keyword"]')?.focus();
  });
  document.querySelector('[data-trigger-load-json]')?.addEventListener('click', loadFromSource);
  document.addEventListener('auralis:config-loaded', event => {
    const context = window.AuralisDashboardContext || {};
    if (context.guildId !== lastGuild) lastGuild = context.guildId || '';
    if (page !== 'automations') return;
    loadFromSourceQuietly();
  });
  function loadFromSourceQuietly() {
    try { const parsed = JSON.parse(source.value || '[]'); rules = Array.isArray(parsed) ? parsed.slice(0,100).map(item => ({ ...defaultRule(), ...(item && typeof item==='object'?item:{}) })) : []; render(); }
    catch { rules = []; render(); toast('The saved response rules contain invalid JSON. Open Advanced JSON to fix them.'); }
  }
})();
