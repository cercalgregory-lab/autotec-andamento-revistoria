(() => {
  if (window.__autotecRevistoriaInjected) return;
  window.__autotecRevistoriaInjected = true;

  const STORAGE_KEY_OFICINAS = 'autotec_oficinas_cadastro';
  const STORAGE_KEY_PANEL = 'autotec_panel_state';
  let panelOpen = false;
  let host = null;
  let shadow = null;
  let dragAbort = null;
  let previewTimer = null;

  function loadOficinas() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY_OFICINAS], (res) => {
        resolve(res[STORAGE_KEY_OFICINAS] || {});
      });
    });
  }
  function saveOficinas(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY_OFICINAS]: data }, resolve);
    });
  }
  function loadPanelState() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY_PANEL], (res) => {
        resolve(res[STORAGE_KEY_PANEL] || {});
      });
    });
  }
  function savePanelState(state) {
    chrome.storage.local.set({ [STORAGE_KEY_PANEL]: state });
  }

  function detectOficina() {
    const links = document.querySelectorAll('a');
    for (const a of links) {
      const t = a.textContent.trim();
      const m = t.match(/^(\d{4,8})\s*-\s*(.+)$/);
      if (m) return { codigo: m[1], nome: m[2].trim() };
    }
    const allText = document.body.innerText || '';
    const m = allText.match(/(\d{4,8})\s*-\s*([A-ZÀ-Ú][A-ZÀ-Ú\s\-\.]+)/);
    if (m) return { codigo: m[1], nome: m[2].trim() };
    return null;
  }

  function findAnotacaoTextarea() {
    const tas = document.querySelectorAll('textarea');
    for (const ta of tas) {
      const label = ta.closest('table, div, form')?.innerText || '';
      if (/Nova Anota[çc][aã]o/i.test(label)) return ta;
    }
    let best = null, bestArea = 0;
    for (const ta of tas) {
      const r = ta.getBoundingClientRect();
      const area = r.width * r.height;
      if (area > bestArea && r.width > 100) { best = ta; bestArea = area; }
    }
    return best;
  }

  function joinList(arr) {
    if (!arr.length) return '';
    if (arr.length === 1) return arr[0];
    if (arr.length === 2) return `${arr[0]} e ${arr[1]}`;
    return arr.slice(0, -1).join(', ') + ' e ' + arr[arr.length - 1];
  }

  function formatDateBR(date) {
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    return `${date.getDate()} de ${meses[date.getMonth()]} de ${date.getFullYear()}`;
  }
  function formatTimeBR(date) {
    return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
  }

  function buildText(f) {
    const data = f.data || formatDateBR(new Date());
    const hora = f.hora || formatTimeBR(new Date());
    const estagios = joinList(f.estagios);
    const faltaPeca = f.faltaPeca === 'sim'
      ? `sim — ${f.faltaPecaDetalhe || ''}`.trim().replace(/—\s*$/, '— (descrever)')
      : 'não';
    const fotosGlosa = f.fotosGlosa === 'houve' ? 'houve glosa — fotos anexadas' : 'não houve glosa de peças';
    let sucatas;
    switch (f.sucatas) {
      case 'recolhidas': sucatas = 'recolhidas'; break;
      case 'fotografadas': sucatas = 'fotografadas'; break;
      case 'parc_recolhidas': sucatas = `parcialmente recolhidas — ${f.sucatasDetalhe || '(descrever)'}`; break;
      case 'parc_fotografadas': sucatas = `parcialmente fotografadas — ${f.sucatasDetalhe || '(descrever)'}`; break;
      default: sucatas = 'recolhidas';
    }
    const fornecimentoMap = {
      companhia: 'peças com fornecimento pela companhia',
      oficina: 'peças com compra pela oficina',
      misto: 'peças com fornecimento misto (companhia e oficina)',
    };
    const fornecimento = fornecimentoMap[f.fornecimento] || fornecimentoMap.companhia;
    let pendencia;
    switch (f.pendencia) {
      case 'sem': pendencia = 'sem pendência de peças ou notas fiscais'; break;
      case 'pecas': pendencia = `com pendência de peças — ${f.pendenciaDetalhe || '(descrever)'}`; break;
      case 'nf': pendencia = `com pendência de notas fiscais — ${f.pendenciaDetalhe || '(descrever)'}`; break;
      case 'ambos': pendencia = `com pendência de peças e notas fiscais — ${f.pendenciaDetalhe || '(descrever)'}`; break;
      default: pendencia = 'sem pendência de peças ou notas fiscais';
    }
    let conferidos;
    switch (f.conferidos) {
      case 'dentro': conferidos = 'dentro dos padrões'; break;
      case 'fora': conferidos = `fora dos padrões — ${f.conferidosDetalhe || '(justificar)'}`; break;
      case 'parcial': conferidos = `parcialmente dentro dos padrões — ${f.conferidosDetalhe || '(justificar)'}`; break;
      default: conferidos = 'dentro dos padrões';
    }
    const deducoes = f.deducoes === 'com'
      ? `com deduções — ${f.deducoesDetalhe || '(descrever)'}` : 'sem deduções';
    let negociacao;
    switch (f.negociacao) {
      case 'nenhum': negociacao = 'sem negociação ou glosa de peças'; break;
      case 'negociacao': negociacao = `houve negociação — ${f.negociacaoDetalhe || '(descrever)'}`; break;
      case 'glosa': negociacao = `houve glosa — ${f.negociacaoDetalhe || '(descrever)'}`; break;
      case 'ambos': negociacao = `houve negociação e glosa — ${f.negociacaoDetalhe || '(descrever)'}`; break;
      default: negociacao = 'sem negociação ou glosa de peças';
    }
    return `Revistoria realizada in loco ${data} às ${hora}.
Processo: ${f.processo || 'Regular'}
Versão: ${f.versao || ''}

Estágios dos reparos: ${estagios}
Falta chegar alguma peça: ${faltaPeca}
Fotos da parte interna / Externa da peça glosada: ${fotosGlosa}
Atendido na Oficina por: ${f.atendente || ''}
Telefone de contato da oficina: ${f.telefone || ''}
E-mail da oficina: ${f.email || ''}

Constatado em vistoria in loco na versão ${f.versao || ''} do orçamento que peças orçadas para troca e recuperação dentro dos padrões. Reparos em estágio de "${estagios}", sucatas ${sucatas}, ${fornecimento}, ${pendencia}, orçamento e valores conferidos ${conferidos}, ${deducoes}, ${negociacao}.`;
  }

  function injectIntoTextarea(text) {
    const ta = findAnotacaoTextarea();
    if (!ta) return { ok: false, msg: 'textarea de anotação não encontrado nesta página' };
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, text);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new Event('change', { bubbles: true }));
    ta.focus();
    return { ok: true };
  }

  function makeDraggable(panel, handle, signal) {
    let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
    handle.addEventListener('mousedown', (e) => {
      if (e.target.closest('.atc-btn-close')) return;
      dragging = true;
      sx = e.clientX; sy = e.clientY;
      const r = host.getBoundingClientRect();
      ox = r.left; oy = r.top;
      e.preventDefault();
    }, { signal });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      host.style.left = `${ox + (e.clientX - sx)}px`;
      host.style.top = `${oy + (e.clientY - sy)}px`;
      host.style.right = 'auto';
    }, { signal });
    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      const r = host.getBoundingClientRect();
      savePanelState({ left: r.left, top: r.top, width: r.width, height: r.height });
    }, { signal });
  }
  function makeResizable(panel, grip, signal) {
    let resizing = false, sx = 0, sy = 0, sw = 0, sh = 0;
    grip.addEventListener('mousedown', (e) => {
      resizing = true;
      sx = e.clientX; sy = e.clientY;
      const r = host.getBoundingClientRect();
      sw = r.width; sh = r.height;
      e.preventDefault(); e.stopPropagation();
    }, { signal });
    document.addEventListener('mousemove', (e) => {
      if (!resizing) return;
      host.style.width = `${Math.max(340, sw + (e.clientX - sx))}px`;
      host.style.height = `${Math.max(300, sh + (e.clientY - sy))}px`;
    }, { signal });
    document.addEventListener('mouseup', () => {
      if (!resizing) return;
      resizing = false;
      const r = host.getBoundingClientRect();
      savePanelState({ left: r.left, top: r.top, width: r.width, height: r.height });
    }, { signal });
  }

  const PANEL_STYLE = `
    :host, * { box-sizing: border-box; }
    .atc-panel {
      width: 100%; height: 100%;
      background: #fff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.18);
      display: flex; flex-direction: column;
      font: 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #1e293b;
      overflow: hidden;
    }
    .atc-header {
      background: #1e3a5f; color: #fff;
      padding: 8px 12px; cursor: move;
      display: flex; justify-content: space-between; align-items: center;
      user-select: none;
    }
    .atc-title { font-weight: 600; font-size: 13px; }
    .atc-btn-close {
      background: transparent; color: #fff;
      border: none; cursor: pointer; font-size: 18px; line-height: 1; padding: 0 6px;
    }
    .atc-btn-close:hover { color: #fca5a5; }
    .atc-body { flex: 1; overflow-y: auto; padding: 12px; }
    .atc-section { border-bottom: 1px solid #e2e8f0; padding: 8px 0; }
    .atc-section:last-child { border-bottom: none; }
    .atc-label {
      display: block; font-weight: 600; font-size: 11px;
      text-transform: uppercase; color: #475569; margin-bottom: 4px; letter-spacing: 0.3px;
    }
    .atc-input, .atc-select, .atc-textarea {
      width: 100%; padding: 6px 8px; border: 1px solid #cbd5e1;
      border-radius: 4px; font: inherit; background: #fff;
    }
    .atc-input:focus, .atc-select:focus, .atc-textarea:focus {
      outline: none; border-color: #1e3a5f;
      box-shadow: 0 0 0 2px rgba(30,58,95,0.15);
    }
    .atc-textarea { resize: vertical; min-height: 50px; }
    .atc-row { display: flex; gap: 6px; }
    .atc-row > * { flex: 1; }
    .atc-checks { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 2px; }
    .atc-checks label { display: flex; align-items: center; gap: 4px; font-size: 12px; cursor: pointer; }
    .atc-hint { font-size: 11px; color: #64748b; margin-top: 2px; }
    .atc-footer {
      padding: 10px 12px; border-top: 1px solid #e2e8f0;
      background: #f8fafc; display: flex; gap: 8px;
    }
    .atc-btn {
      flex: 1; padding: 8px 12px; border: none;
      border-radius: 4px; cursor: pointer; font: inherit; font-weight: 600;
    }
    .atc-btn-primary { background: #1e3a5f; color: #fff; }
    .atc-btn-primary:hover { background: #2c5282; }
    .atc-btn-secondary { background: #e2e8f0; color: #1e293b; }
    .atc-btn-secondary:hover { background: #cbd5e1; }
    .atc-status { font-size: 11px; padding: 4px 8px; margin-top: 4px; border-radius: 4px; }
    .atc-status.ok { background: #dcfce7; color: #166534; }
    .atc-status.err { background: #fee2e2; color: #991b1b; }
    .atc-resize-grip {
      position: absolute; bottom: 0; right: 0;
      width: 14px; height: 14px; cursor: nwse-resize;
      background: linear-gradient(135deg, transparent 50%, #94a3b8 50%);
    }
    .atc-oficina-info {
      background: #f1f5f9; padding: 6px 8px; border-radius: 4px;
      font-size: 11px; color: #475569; margin-bottom: 8px;
    }
    .atc-oficina-info strong { color: #1e3a5f; }
    .atc-preview {
      background: #f8fafc; border: 1px solid #cbd5e1;
      padding: 8px; border-radius: 4px;
      font-family: ui-monospace, Menlo, Consolas, monospace;
      font-size: 11px; white-space: pre-wrap;
      max-height: 180px; overflow-y: auto;
    }
    details summary {
      cursor: pointer; font-weight: 600; font-size: 11px;
      color: #475569; text-transform: uppercase; padding: 4px 0;
    }
  `;

  const PANEL_HTML = `
    <div class="atc-panel">
      <div class="atc-header" id="atc-header">
        <span class="atc-title">Andamento Revistoria</span>
        <button class="atc-btn-close" id="atc-close" title="Fechar">×</button>
      </div>
      <div class="atc-body">
        <div class="atc-oficina-info" id="atc-oficina-info">Oficina não detectada</div>
        <div class="atc-section">
          <div class="atc-row">
            <div><label class="atc-label">Data</label><input class="atc-input" id="f-data" placeholder="24 de Maio de 2026"></div>
            <div><label class="atc-label">Hora</label><input class="atc-input" id="f-hora" placeholder="14:36"></div>
          </div>
          <div class="atc-row" style="margin-top:6px;">
            <div><label class="atc-label">Processo</label><input class="atc-input" id="f-processo" value="Regular"></div>
            <div><label class="atc-label">Versão</label><input class="atc-input" id="f-versao" type="number" min="1" value="1"></div>
          </div>
        </div>
        <div class="atc-section">
          <label class="atc-label">Estágios dos reparos (múltipla)</label>
          <div class="atc-checks" id="f-estagios">
            <label><input type="checkbox" value="desmontagem"> desmontagem</label>
            <label><input type="checkbox" value="montagem"> montagem</label>
            <label><input type="checkbox" value="pintura"> pintura</label>
            <label><input type="checkbox" value="polimento"> polimento</label>
            <label><input type="checkbox" value="finalização"> finalização</label>
            <label><input type="checkbox" value="entregue"> entregue</label>
          </div>
        </div>
        <div class="atc-section">
          <label class="atc-label">Falta chegar alguma peça</label>
          <select class="atc-select" id="f-faltaPeca"><option value="nao">não</option><option value="sim">sim</option></select>
          <textarea class="atc-textarea" id="f-faltaPecaDetalhe" placeholder="descrição das peças" style="margin-top:4px;display:none;"></textarea>
        </div>
        <div class="atc-section">
          <label class="atc-label">Fotos peça glosada</label>
          <select class="atc-select" id="f-fotosGlosa">
            <option value="nao">não houve glosa de peças</option>
            <option value="houve">houve glosa — fotos anexadas</option>
          </select>
        </div>
        <div class="atc-section">
          <label class="atc-label">Sucatas</label>
          <select class="atc-select" id="f-sucatas">
            <option value="recolhidas">recolhidas</option>
            <option value="fotografadas">fotografadas</option>
            <option value="parc_recolhidas">parcialmente recolhidas</option>
            <option value="parc_fotografadas">parcialmente fotografadas</option>
          </select>
          <textarea class="atc-textarea" id="f-sucatasDetalhe" placeholder="detalhe" style="margin-top:4px;display:none;"></textarea>
        </div>
        <div class="atc-section">
          <label class="atc-label">Fornecimento de peças</label>
          <select class="atc-select" id="f-fornecimento">
            <option value="companhia">companhia</option>
            <option value="oficina">oficina</option>
            <option value="misto">misto</option>
          </select>
        </div>
        <div class="atc-section">
          <label class="atc-label">Pendência de peças / NF</label>
          <select class="atc-select" id="f-pendencia">
            <option value="sem">sem pendência</option>
            <option value="pecas">pendência de peças</option>
            <option value="nf">pendência de NF</option>
            <option value="ambos">pendência de peças e NF</option>
          </select>
          <textarea class="atc-textarea" id="f-pendenciaDetalhe" placeholder="detalhe" style="margin-top:4px;display:none;"></textarea>
        </div>
        <div class="atc-section">
          <label class="atc-label">Orçamento conferido</label>
          <select class="atc-select" id="f-conferidos">
            <option value="dentro">dentro dos padrões</option>
            <option value="fora">fora dos padrões</option>
            <option value="parcial">parcialmente dentro dos padrões</option>
          </select>
          <textarea class="atc-textarea" id="f-conferidosDetalhe" placeholder="justificativa" style="margin-top:4px;display:none;"></textarea>
        </div>
        <div class="atc-section">
          <label class="atc-label">Deduções</label>
          <select class="atc-select" id="f-deducoes">
            <option value="sem">sem deduções</option>
            <option value="com">com deduções</option>
          </select>
          <textarea class="atc-textarea" id="f-deducoesDetalhe" placeholder="detalhe" style="margin-top:4px;display:none;"></textarea>
        </div>
        <div class="atc-section">
          <label class="atc-label">Negociação / glosa</label>
          <select class="atc-select" id="f-negociacao">
            <option value="nenhum">não houve</option>
            <option value="negociacao">houve negociação</option>
            <option value="glosa">houve glosa</option>
            <option value="ambos">houve negociação e glosa</option>
          </select>
          <textarea class="atc-textarea" id="f-negociacaoDetalhe" placeholder="detalhe" style="margin-top:4px;display:none;"></textarea>
        </div>
        <div class="atc-section">
          <label class="atc-label">Atendente / Contato</label>
          <input class="atc-input" id="f-atendente" placeholder="Sr. Fernando">
          <div class="atc-row" style="margin-top:4px;">
            <input class="atc-input" id="f-telefone" placeholder="Telefone">
            <input class="atc-input" id="f-email" placeholder="E-mail">
          </div>
          <div class="atc-hint" id="f-cadastro-hint">Salva automaticamente por oficina ao colar.</div>
        </div>
        <div class="atc-section">
          <details>
            <summary>Pré-visualização</summary>
            <div class="atc-preview" id="atc-preview" style="margin-top:6px;"></div>
          </details>
        </div>
        <div id="atc-status"></div>
      </div>
      <div class="atc-footer">
        <button class="atc-btn atc-btn-secondary" id="atc-copy">Copiar</button>
        <button class="atc-btn atc-btn-primary" id="atc-inject">Colar no SOMA</button>
      </div>
      <div class="atc-resize-grip" id="atc-resize"></div>
    </div>
  `;

  async function buildPanel() {
    host = document.createElement('div');
    host.id = 'autotec-revistoria-host';
    shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = PANEL_STYLE;
    shadow.appendChild(style);
    const wrap = document.createElement('div');
    wrap.style.cssText = 'width:100%;height:100%;position:relative;';
    wrap.innerHTML = PANEL_HTML;
    shadow.appendChild(wrap);
    document.documentElement.appendChild(host);
    const st = await loadPanelState();
    if (st.left != null) {
      host.style.left = `${st.left}px`;
      host.style.top = `${st.top}px`;
      host.style.right = 'auto';
    }
    if (st.width != null) {
      host.style.width = `${st.width}px`;
      host.style.height = `${st.height}px`;
    }
    dragAbort = new AbortController();
    bindEvents(dragAbort.signal);
    await loadOficinaIntoForm();
  }

  function $(sel) { return shadow.querySelector(sel); }
  function $$(sel) { return shadow.querySelectorAll(sel); }

  function readForm() {
    return {
      data: $('#f-data').value.trim(),
      hora: $('#f-hora').value.trim(),
      processo: $('#f-processo').value.trim(),
      versao: $('#f-versao').value.trim(),
      estagios: Array.from($$('#f-estagios input:checked')).map(i => i.value),
      faltaPeca: $('#f-faltaPeca').value,
      faltaPecaDetalhe: $('#f-faltaPecaDetalhe').value.trim(),
      fotosGlosa: $('#f-fotosGlosa').value,
      sucatas: $('#f-sucatas').value,
      sucatasDetalhe: $('#f-sucatasDetalhe').value.trim(),
      fornecimento: $('#f-fornecimento').value,
      pendencia: $('#f-pendencia').value,
      pendenciaDetalhe: $('#f-pendenciaDetalhe').value.trim(),
      conferidos: $('#f-conferidos').value,
      conferidosDetalhe: $('#f-conferidosDetalhe').value.trim(),
      deducoes: $('#f-deducoes').value,
      deducoesDetalhe: $('#f-deducoesDetalhe').value.trim(),
      negociacao: $('#f-negociacao').value,
      negociacaoDetalhe: $('#f-negociacaoDetalhe').value.trim(),
      atendente: $('#f-atendente').value.trim(),
      telefone: $('#f-telefone').value.trim(),
      email: $('#f-email').value.trim(),
    };
  }

  function updatePreview() {
    $('#atc-preview').textContent = buildText(readForm());
  }
  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(updatePreview, 80);
  }

  function showStatus(msg, kind) {
    const el = $('#atc-status');
    el.className = `atc-status ${kind}`;
    el.textContent = msg;
    setTimeout(() => { el.textContent = ''; el.className = ''; }, 4000);
  }

  async function loadOficinaIntoForm() {
    const of = detectOficina();
    const info = $('#atc-oficina-info');
    if (!of) { info.innerHTML = '<em>Oficina não detectada nesta página.</em>'; return; }
    info.innerHTML = `<strong>${of.codigo}</strong> — ${of.nome}`;
    const cadastro = await loadOficinas();
    const dados = cadastro[of.codigo];
    if (dados) {
      $('#f-atendente').value = dados.atendente || '';
      $('#f-telefone').value = dados.telefone || '';
      $('#f-email').value = dados.email || '';
      $('#f-cadastro-hint').textContent = `Contato carregado do cadastro (${of.codigo}).`;
    } else {
      $('#f-cadastro-hint').textContent = `Sem cadastro para ${of.codigo} — atendente/telefone/e-mail digitados serão salvos.`;
    }
  }

  async function saveOficinaAtual() {
    const of = detectOficina();
    if (!of) return;
    const cadastro = await loadOficinas();
    cadastro[of.codigo] = {
      nome: of.nome,
      atendente: $('#f-atendente').value.trim(),
      telefone: $('#f-telefone').value.trim(),
      email: $('#f-email').value.trim(),
      atualizadoEm: new Date().toISOString(),
    };
    await saveOficinas(cadastro);
  }

  function bindEvents(signal) {
    makeDraggable($('.atc-panel'), $('#atc-header'), signal);
    makeResizable($('.atc-panel'), $('#atc-resize'), signal);
    $('#atc-close').addEventListener('click', closePanel);
    const wireConditional = (selectId, detalheId, mostrarSe) => {
      const sel = $(selectId), det = $(detalheId);
      const apply = () => { det.style.display = mostrarSe.includes(sel.value) ? 'block' : 'none'; };
      sel.addEventListener('change', () => { apply(); schedulePreview(); });
      apply();
    };
    wireConditional('#f-faltaPeca', '#f-faltaPecaDetalhe', ['sim']);
    wireConditional('#f-sucatas', '#f-sucatasDetalhe', ['parc_recolhidas', 'parc_fotografadas']);
    wireConditional('#f-pendencia', '#f-pendenciaDetalhe', ['pecas', 'nf', 'ambos']);
    wireConditional('#f-conferidos', '#f-conferidosDetalhe', ['fora', 'parcial']);
    wireConditional('#f-deducoes', '#f-deducoesDetalhe', ['com']);
    wireConditional('#f-negociacao', '#f-negociacaoDetalhe', ['negociacao', 'glosa', 'ambos']);
    shadow.querySelectorAll('input, select, textarea').forEach(el => {
      el.addEventListener('input', schedulePreview);
      el.addEventListener('change', schedulePreview);
    });
    const now = new Date();
    $('#f-data').value = formatDateBR(now);
    $('#f-hora').value = formatTimeBR(now);
    $('#atc-copy').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(buildText(readForm()));
        await saveOficinaAtual();
        showStatus('Texto copiado para a área de transferência.', 'ok');
      } catch (e) { showStatus('Falha ao copiar: ' + e.message, 'err'); }
    });
    $('#atc-inject').addEventListener('click', async () => {
      const res = injectIntoTextarea(buildText(readForm()));
      if (res.ok) { await saveOficinaAtual(); showStatus('Texto inserido no campo de anotação.', 'ok'); }
      else { showStatus('Erro: ' + res.msg, 'err'); }
    });
    updatePreview();
  }

  function openPanel() { if (panelOpen) return; buildPanel(); panelOpen = true; }
  function closePanel() {
    if (!panelOpen) return;
    if (dragAbort) { dragAbort.abort(); dragAbort = null; }
    clearTimeout(previewTimer);
    if (host && host.parentNode) host.parentNode.removeChild(host);
    host = null; shadow = null;
    panelOpen = false;
  }
  function togglePanel() { if (panelOpen) closePanel(); else openPanel(); }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'TOGGLE_PANEL') togglePanel();
  });
})();
