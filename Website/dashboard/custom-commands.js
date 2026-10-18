(() => {
  'use strict';
  if (document.body.dataset.page !== 'custom-commands') return;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const apiBase = String((window.AURALIS_CONFIG || {}).apiBase || '').replace(/\/$/, '');
  const api = async (path, options = {}) => {
    const response = await fetch(`${apiBase}${path}`, { credentials:'include', ...options, headers:{Accept:'application/json','Content-Type':'application/json',...(options.headers||{})} });
    const type = response.headers.get('content-type') || ''; const raw = await response.text(); let data = raw;
    if (type.includes('json')) { try { data = JSON.parse(raw); } catch { data = {error:'The API returned invalid JSON.'}; } }
    if (!response.ok) throw new Error(data?.error || data || `Request failed (${response.status})`);
    return data;
  };
  const $ = s => document.querySelector(s);
  const guild = () => new URLSearchParams(location.search).get('guild') || localStorage.getItem('auralis:selected-guild') || '';
  const toast = text => { const node=document.createElement('div');node.className='toast';node.textContent=text;document.body.append(node);setTimeout(()=>node.remove(),2600); };
  let commands = [], selectedName = '', channels = [], roles = [], maxCommands = 500;
  const blank = () => ({name:'',response:'',enabled:true,responseMode:'channel',replyMode:'reply',deleteInvocation:false,cooldownSeconds:0,allowedRoleIds:[],requiredPermission:'None',embed:{enabled:false,title:'',description:'',color:'#7c6cf5',url:'',authorName:'',authorIconUrl:'',thumbnailUrl:'',imageUrl:'',footerText:'',footerIconUrl:'',timestamp:false}});
  let editor = blank();
  function setEditor(value) {
    editor = structuredClone(value || blank());
    $('[data-custom-editor-title]').textContent = selectedName ? `Edit ${selectedName}` : 'Create a command';
    $('[data-custom-state]').textContent = selectedName ? 'Saved command' : 'New command';
    $('[data-custom-name]').value = editor.name || '';
    $('[data-custom-name]').readOnly = Boolean(selectedName);
    $('[data-custom-response]').value = editor.response || '';
    $('[data-custom-enabled]').checked = editor.enabled !== false;
    $('[data-custom-response-mode]').value = editor.responseMode || 'channel';
    $('[data-custom-reply-mode]').value = editor.replyMode || 'reply';
    $('[data-custom-delete]').checked = Boolean(editor.deleteInvocation);
    $('[data-custom-cooldown]').value = Number(editor.cooldownSeconds || 0);
    $('[data-custom-permission]').value = editor.requiredPermission || 'None';
    const roleSelect=$('[data-custom-roles]');
    roleSelect.innerHTML=roles.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('');
    [...roleSelect.options].forEach(o=>o.selected=(editor.allowedRoleIds||[]).map(String).includes(o.value));
    const e=editor.embed||blank().embed;
    $('[data-custom-embed-enabled]').checked=Boolean(e.enabled);
    $('[data-custom-embed-title]').value=e.title||''; $('[data-custom-embed-description]').value=e.description||''; $('[data-custom-embed-color]').value=/^#[0-9a-f]{6}$/i.test(e.color||'')?e.color:'#7c6cf5';
    $('[data-custom-embed-url]').value=e.url||''; $('[data-custom-embed-author]').value=e.authorName||''; $('[data-custom-embed-author-icon]').value=e.authorIconUrl||''; $('[data-custom-embed-thumbnail]').value=e.thumbnailUrl||''; $('[data-custom-embed-image]').value=e.imageUrl||''; $('[data-custom-embed-footer]').value=e.footerText||''; $('[data-custom-embed-footer-icon]').value=e.footerIconUrl||''; $('[data-custom-embed-timestamp]').checked=Boolean(e.timestamp);
    $('[data-custom-delete-command]').disabled=!selectedName;
    $('[data-custom-result]').textContent=selectedName?'Changes affect this command on this server.':'Create a new command for this server.';
    $('[data-custom-prefix-inline]').textContent=$('[data-custom-prefix]')?.textContent || '.';
    $('[data-custom-name-preview]').textContent=editor.name||'rules';
  }
  function collect() {
    return {
      name:$('[data-custom-name]').value.trim().toLowerCase(), response:$('[data-custom-response]').value,
      enabled:$('[data-custom-enabled]').checked, responseMode:$('[data-custom-response-mode]').value,
      replyMode:$('[data-custom-reply-mode]').value, deleteInvocation:$('[data-custom-delete]').checked,
      cooldownSeconds:Number($('[data-custom-cooldown]').value||0), requiredPermission:$('[data-custom-permission]').value,
      allowedRoleIds:[...$('[data-custom-roles]').selectedOptions].map(o=>o.value),
      embed:{enabled:$('[data-custom-embed-enabled]').checked,title:$('[data-custom-embed-title]').value,description:$('[data-custom-embed-description]').value,color:$('[data-custom-embed-color]').value,url:$('[data-custom-embed-url]').value,authorName:$('[data-custom-embed-author]').value,authorIconUrl:$('[data-custom-embed-author-icon]').value,thumbnailUrl:$('[data-custom-embed-thumbnail]').value,imageUrl:$('[data-custom-embed-image]').value,footerText:$('[data-custom-embed-footer]').value,footerIconUrl:$('[data-custom-embed-footer-icon]').value,timestamp:$('[data-custom-embed-timestamp]').checked}
    };
  }
  function renderList() {
    const query=$('[data-custom-search]').value.trim().toLowerCase();
    const list=commands.filter(c=>`${c.name} ${c.response}`.toLowerCase().includes(query));
    $('[data-custom-count]').textContent=commands.length;
    $('[data-custom-list]').innerHTML=list.length?list.map(c=>`<button type="button" class="panel-list-item custom-command-item ${c.name===selectedName?'active':''}" data-select-custom="${esc(c.name)}"><div><strong><code>${esc($('[data-custom-prefix]')?.textContent||'.')}${esc(c.name)}</code></strong><span>${c.responseMode==='dm'?'Private DM':'Server reply'} · ${c.enabled?'Enabled':'Disabled'}</span></div><span>✎</span></button>`).join(''):'<div class="empty-state">No commands match this search.</div>';
    $('[data-custom-list]').querySelectorAll('[data-select-custom]').forEach(button=>button.addEventListener('click',()=>{const name=button.dataset.selectCustom;const command=commands.find(c=>c.name===name);selectedName=name;setEditor(command);renderList();}));
  }
  async function load() {
    const id=guild(); if(!id)return;
    try {
      const [payload, resources]=await Promise.all([api(`/api/guilds/${id}/custom-commands`),api(`/api/guilds/${id}/resources`)]);
      commands=payload.commands||[];maxCommands=Number(payload.limit||500);roles=resources.roles||[];channels=resources.channels||[];
      $('[data-custom-prefix]').textContent=payload.prefix||'.';$('[data-custom-prefix-inline]').textContent=payload.prefix||'.';$('[data-custom-limit]').textContent=maxCommands;
      if(selectedName&&!commands.some(c=>c.name===selectedName))selectedName='';
      setEditor(selectedName?commands.find(c=>c.name===selectedName):blank());renderList();
    } catch(error) { $('[data-custom-list]').innerHTML=`<div class="error-card">${esc(error.message)}</div>`;toast(error.message); }
  }
  async function save() {
    const body=collect();const id=guild();
    if(!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(body.name))return toast('Use a valid command name: letters, numbers, _ or - (max 32).');
    if(!body.response.trim())return toast('Enter a response first.');
    const button=$('[data-custom-save]');button.disabled=true;
    try {
      const out=selectedName?await api(`/api/guilds/${id}/custom-commands/${encodeURIComponent(selectedName)}`,{method:'PATCH',body:JSON.stringify(body)}):await api(`/api/guilds/${id}/custom-commands`,{method:'POST',body:JSON.stringify(body)});
      selectedName=out.command.name;toast(`Saved ${body.name}.`);await load();
    } catch(error) { $('[data-custom-result]').textContent=error.message;toast(error.message); }
    finally {button.disabled=false;}
  }
  async function remove() {
    if(!selectedName||(window.AuralisConfirmDestructive?!window.AuralisConfirmDestructive(`Delete custom command “${selectedName}” from this server?`):!confirm(`Delete the custom command “${selectedName}” from this server?`)))return;
    try{await api(`/api/guilds/${guild()}/custom-commands/${encodeURIComponent(selectedName)}`,{method:'DELETE'});toast(`Removed ${selectedName}.`);selectedName='';setEditor(blank());await load();}catch(error){toast(error.message);}
  }
  $('[data-custom-save]').addEventListener('click',save);
  $('[data-custom-new]').addEventListener('click',()=>{selectedName='';setEditor(blank());renderList();});
  $('[data-custom-reset]').addEventListener('click',()=>setEditor(selectedName?commands.find(c=>c.name===selectedName):blank()));
  $('[data-custom-delete-command]').addEventListener('click',remove);
  $('[data-custom-refresh]').addEventListener('click',load);
  $('[data-custom-search]').addEventListener('input',renderList);
  $('[data-custom-name]').addEventListener('input',()=>{$('[data-custom-name-preview]').textContent=$('[data-custom-name]').value||'rules';});
  window.addEventListener('auralis:guild-ready',load);
  if(document.readyState==='complete')setTimeout(load,700);else window.addEventListener('load',()=>setTimeout(load,300));
})();
