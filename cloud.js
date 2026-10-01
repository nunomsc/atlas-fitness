/* Sincronização opcional: API HTTPS do Supabase, sem bibliotecas externas. */
(() => {
  'use strict';
  const CONFIG = 'atlas.supabase.config.v1';
  const SESSION = 'atlas.supabase.session.v1';
  let config = window.ATLAS_SUPABASE || {}, session = null, cache = null;
  let cacheKey = '', lastStored = null, busy = false, conflict = null, debounce;
  let status = 'Modo local', blocked = false;
  const encode = JSON.stringify;
  // Postgres jsonb pode devolver propriedades noutra ordem.
  const canonical = value => encode(sort(value));
  function sort(value) {
    if (Array.isArray(value)) return value.map(sort);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, sort(value[k])]));
    return value;
  }
  const same = (a, b) => canonical(a) === canonical(b);
  function checked(list) {
    if (!Array.isArray(list)) throw Error('O histórico recebido é inválido.');
    const ids = new Set();
    for (const r of list) {
      if (!r || typeof r.id !== 'string' || ids.has(r.id)) throw Error('O histórico contém identificadores inválidos.');
      ids.add(r.id); Core.validate(r.treino);
      if (!r.done || typeof r.done !== 'object' || Array.isArray(r.done)) throw Error('O progresso recebido é inválido.');
    }
    return list;
  }
  function configuration(url, key) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw Error('Indica o URL HTTPS do projeto, sem caminhos adicionais.');
    if (!key) throw Error('Indica a chave pública do projeto.');
    if (!key.startsWith('sb_publishable_')) {
      let role;
      try { role = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role; } catch {}
      if (role !== 'anon') throw Error('Usa apenas uma chave Publishable ou anon. Nunca uma chave secreta.');
    }
    return { url: parsed.origin, key };
  }
  try {
    const saved = localStorage.getItem(CONFIG);
    if (!config.url && saved) config = JSON.parse(saved);
  } catch { status = 'Configuração local indisponível'; }
  function setStatus(message) {
    status = message;
    document.querySelectorAll('[data-cloud-status]').forEach(el => el.textContent = message);
    const foot = document.querySelector('.sidebar-foot span');
    if (foot) foot.textContent = session ? message : 'Guardado neste dispositivo';
  }
  async function request(path, { body, token, method } = {}) {
    const response = await fetch(config.url + path, {
      method: method || (body ? 'POST' : 'GET'),
      headers: { apikey: config.key, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      ...(body ? { body: encode(body) } : {}), signal: AbortSignal.timeout(20000)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const err = Error(response.status === 401 ? 'Sessão expirada. Volta a entrar na conta.' :
        response.status === 404 ? 'Configuração incompleta: executa supabase.sql no projeto.' :
        data?.msg || data?.message || data?.error_description || 'Não foi possível contactar o Supabase.');
      err.status = response.status; throw err;
    }
    return data;
  }
  function rememberSession(data) {
    const next = { access_token: data.access_token, refresh_token: data.refresh_token,
      expires_at: data.expires_at || Math.floor(Date.now() / 1000) + data.expires_in, user: data.user };
    sessionStorage.setItem(SESSION, encode({ url: config.url, session: next }));
    session = next;
  }
  async function token() {
    if (session.expires_at * 1000 < Date.now() + 60000) {
      const data = await request('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: session.refresh_token } });
      if (data.user.id !== session.user.id) throw Error('A conta da sessão mudou. Volta a entrar.');
      rememberSession(data);
    }
    return session.access_token;
  }
  function saveCache() {
    if (blocked) throw Error('O histórico mudou noutra aba. Exporta as alterações desta aba e recarrega.');
    if (localStorage.getItem(cacheKey) !== lastStored) {
      blocked = true;
      throw Error('O histórico mudou noutra aba. Exporta as alterações desta aba e recarrega.');
    }
    const serialized = encode(cache);
    localStorage.setItem(cacheKey, serialized); lastStored = serialized;
  }
  function replaceRecords(next) {
    records = clone(next); active = records.some(r => r.id === active) ? active : records[0]?.id || '';
    timers.clear(); localSuggestion = null; render();
  }
  function activate() {
    cacheKey = 'atlas.cloud.history.v1:' + config.url + ':' + session.user.id;
    lastStored = localStorage.getItem(cacheKey);
    const next = lastStored ? JSON.parse(lastStored) : { records: [], base: [], revision: 0 };
    checked(next.records); checked(next.base);
    if (!Number.isSafeInteger(next.revision) || next.revision < 0) throw Error('A revisão local é inválida.');
    cache = next;
    blocked = false; conflict = null;
    replaceRecords(cache.records);
    setStatus('Conta ligada · a sincronizar');
  }
  async function sync() {
    if (!session || !cache || busy || conflict || blocked || storageError) return;
    // Não substituir o plano enquanto o utilizador edita ou escreve notas.
    if (draft || document.activeElement?.id === 'session-notes') return;
    busy = true; setStatus('A sincronizar…');
    try {
      if (!navigator.onLine) throw Error('Sem ligação · alterações pendentes neste dispositivo');
      saveCache();
      const access = await token();
      if (!same(cache.records, cache.base)) {
        const sent = clone(cache.records);
        const result = await request('/rest/v1/rpc/atlas_save_history', { token: access,
          body: { p_revision: cache.revision, p_records: sent } });
        if (!result.ok) {
          checked(result.records);
          // Recuperar de uma resposta perdida após a gravação no servidor.
          if (same(result.records, sent)) { cache.revision = result.revision; cache.base = sent; }
          else { conflict = result; setStatus('Há alterações noutro dispositivo · abre a conta para resolver'); return; }
        } else { cache.revision = result.revision; cache.base = sent; }
        saveCache();
      } else {
        const before = canonical(cache.records);
        const rows = await request('/rest/v1/atlas_histories?select=revision,records&user_id=eq.' + encodeURIComponent(session.user.id), { token: access });
        const remote = rows[0] || { revision: 0, records: [] };
        checked(remote.records);
        if (remote.revision !== cache.revision && before === canonical(cache.records) && !draft && document.activeElement?.id !== 'session-notes') {
          cache = { records: remote.records, base: clone(remote.records), revision: remote.revision };
          saveCache(); replaceRecords(cache.records);
        }
      }
      setStatus(same(cache.records, cache.base) ? 'Sincronizado' : 'Alterações pendentes');
    } catch (e) { setStatus(e.message || 'Sem ligação · tenta novamente'); }
    finally { busy = false; }
  }
  function persistCloud() {
    if (!session || !cache) return false;
    cache.records = clone(records);
    try { saveCache(); setStatus(conflict ? 'Conflito pendente · alterações guardadas neste dispositivo' : 'Guardado neste dispositivo · a aguardar sincronização'); }
    catch (e) { blocked = true; setStatus(e.message); notify('Não foi possível guardar. Exporta os treinos antes de fechar.'); }
    clearTimeout(debounce); debounce = setTimeout(sync, 1200); return true;
  }
  function panel() {
    const body = session && cache ? `
      <p>Conta: <strong>${esc(session.user.email)}</strong></p>
      <p class="note" data-cloud-status role="status">${esc(status)}</p>
      ${conflict ? `<section class="editblock"><h3>Escolher o histórico a manter</h3><p class="note">Este dispositivo e outro alteraram o histórico. A escolha aplica-se ao histórico completo. Antes de substituir, guarda uma cópia da versão que pretendes conservar para consulta ou importação.</p><div class="row wrap" style="margin-top:12px"><button data-cloud="backup-local">Exportar esta versão</button><button data-cloud="backup-remote">Exportar versão da nuvem</button><button data-cloud="use-remote">Usar versão da nuvem</button><button data-cloud="use-local">Substituir nuvem por esta versão</button></div></section>` : ''}
      <div class="modal-foot wrap"><button data-cloud="migrate">Copiar treinos do modo local</button><button data-cloud="sync">Sincronizar agora</button><button data-cloud="logout">Sair da conta</button></div>
      <p class="note">A cópia desta conta fica separada do modo local. Alterações pendentes serão retomadas ao entrar novamente nesta conta. A sincronização ocorre com a aplicação aberta.</p>` : `
      <p class="muted">Entra com a mesma conta nos teus dispositivos para sincronizar treinos, notas e progresso.</p>
      <form id="cloud-login" class="stack" style="margin-top:18px">
      <details ${config.url ? '' : 'open'}><summary>Configurar ligação</summary><div class="stack" style="margin-top:12px"><label>URL do projeto Supabase<input id="cloud-url" type="url" required value="${esc(config.url || '')}" placeholder="https://…supabase.co"></label><label>Chave pública (Publishable ou anon)<input id="cloud-key" required value="${esc(config.key || '')}" autocomplete="off"></label><p class="note">Usa apenas a chave pública. Executa previamente o ficheiro supabase.sql no SQL Editor do teu projeto.</p></div></details>
      <label>Email<input id="cloud-email" type="email" autocomplete="username" required></label>
      <label>Palavra-passe<input id="cloud-password" type="password" autocomplete="current-password" required minlength="6"></label>
      <p id="cloud-error" class="error" role="alert"></p><div class="row wrap"><button type="submit" class="primary" name="mode" value="login">Entrar</button><button type="submit" name="mode" value="signup">Criar conta</button></div></form>`;
    modal('Conta e sincronização', body);
  }
  async function login(e) {
    e.preventDefault(); if (busy) return;
    busy = true;
    const buttons = [...e.target.querySelectorAll('button')]; buttons.forEach(b => b.disabled = true);
    try {
      if (storageError) throw Error(storageError);
      config = configuration($('#cloud-url').value.trim(), $('#cloud-key').value.trim());
      localStorage.setItem(CONFIG, encode(config));
      const signup = e.submitter?.value === 'signup';
      const data = await request(signup ? '/auth/v1/signup' : '/auth/v1/token?grant_type=password', {
        body: { email: $('#cloud-email').value.trim(), password: $('#cloud-password').value }
      });
      const passwordInput = $('#cloud-password'); if (passwordInput) passwordInput.value = '';
      if (!data.access_token) { const message = 'Confirma o email recebido e depois entra com a tua palavra-passe.'; const error = $('#cloud-error'); if (error) error.textContent = message; else notify(message); return; }
      rememberSession(data); activate(); closeModal();
    } catch (err) {
      if (!cache) { session = null; sessionStorage.removeItem(SESSION); }
      const error = $('#cloud-error'); if (error) error.textContent = err.message; else notify(err.message);
    } finally { busy = false; buttons.forEach(b => b.disabled = false); }
    if (session && cache) await sync();
  }
  function backup(list, filename) { download({ treinos: list.map(r => ({ treino: r.treino })) }, filename); }
  async function action(name) {
    if (name === 'panel') return panel();
    if (busy) { notify('Aguarda a operação em curso.'); return; }
    try {
      if (name === 'sync') { await sync(); panel(); }
      if (name === 'backup-local') backup(records, 'atlas-versao-local.json');
      if (name === 'backup-remote' && conflict) backup(conflict.records, 'atlas-versao-nuvem.json');
      if (name === 'migrate') {
        const local = checked(JSON.parse(localStorage.getItem(KEY) || '[]')).filter(r => !r.demo);
        const added = local.filter(r => !records.some(x => x.id === r.id));
        records.push(...clone(added)); active ||= records[0]?.id || ''; persist(); render();
        notify(`${added.length} treinos copiados. O modo local foi preservado.`); panel();
      }
      if ((name === 'use-local' || name === 'use-remote') && conflict) {
        if (!window.confirm(name === 'use-local' ? 'Substituir o histórico completo da nuvem por esta versão?' : 'Substituir o histórico desta conta neste dispositivo pela versão da nuvem?')) return;
        // Guardar ambas as versões antes de qualquer substituição.
        localStorage.setItem(cacheKey + ':backup:' + Date.now(), encode({ local: cache, remote: conflict }));
        cache.revision = conflict.revision; cache.base = clone(conflict.records);
        if (name === 'use-remote') cache.records = clone(conflict.records);
        saveCache(); conflict = null; replaceRecords(cache.records); await sync(); panel();
      }
      if (name === 'logout') {
        persistCloud(); if (blocked) throw Error('Exporta esta versão e recarrega antes de sair.');
        // Terminar a sessão desta aba. Não revogar outras sessões/dispositivos.
        sessionStorage.removeItem(SESSION); session = null; cache = null; conflict = null;
        const local = localStorage.getItem(KEY);
        replaceRecords(local ? checked(JSON.parse(local)) : DEMOS.map(t => ({ id: uid(), treino: clone(t), done: {}, demo: true })));
        setStatus('Modo local'); closeModal();
      }
    } catch (e) { setStatus(e.message); notify(e.message); }
  }
  window.AtlasCloud = { persist: persistCloud };
  // A confirmação de email termina no site. A entrada é feita pelo formulário;
  // não conservar tokens de confirmação no endereço nem iniciar uma conta inesperada.
  const callback = new URLSearchParams(window.location.hash.slice(1));
  if (callback.has('access_token') || callback.has('error_description')) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    notify(callback.has('error_description') ? 'Não foi possível confirmar o email. Tenta novamente.' : 'Email confirmado. Entra em Conta e sincronização.');
  }
  const style = document.createElement('style');
  style.textContent = '.cloud-account{display:grid;gap:5px}.cloud-account button{width:100%}.cloud-account small{font-size:12px;color:var(--muted)}@media print{.cloud-account{display:none}}';
  document.head.append(style);
  const box = document.createElement('div'); box.className = 'cloud-account';
  box.innerHTML = '<button data-cloud="panel">☁ Conta e sincronização</button><small data-cloud-status role="status"></small>';
  document.querySelector('.sidebar-foot').before(box);
  document.querySelector('.footer span:last-child').textContent = 'Dados locais · Sincronização opcional';
  setStatus(status);
  document.addEventListener('click', e => { const button = e.target.closest('[data-cloud]'); if (button) action(button.dataset.cloud); });
  document.addEventListener('submit', e => { if (e.target.id === 'cloud-login') login(e); });
  document.addEventListener('focusout', e => { if (e.target.id === 'session-notes') setTimeout(sync, 0); });
  window.addEventListener('online', sync);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  window.addEventListener('storage', e => { if (cache && e.key === cacheKey && e.newValue !== lastStored) { blocked = true; setStatus('Histórico alterado noutra aba · exporta alterações e recarrega'); } });
  setInterval(() => { if (!document.hidden) sync(); }, 30000);
  (async () => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION) || 'null');
      if (!saved || saved.url !== config.url || storageError) return;
      config = configuration(config.url, config.key);
      session = saved.session; activate(); await sync();
    } catch (e) { session = null; cache = null; setStatus(e.message); }
  })();
})();
