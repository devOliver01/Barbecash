// ─────────────────────────────────────────────────────────────────────────────
// registrar.js — Tela de Registrar Novo Atendimento
// ─────────────────────────────────────────────────────────────────────────────
import {
    brl, div, fmtValorInput, getPagConfig, hora, limparRascunho,
    openModal, rawToNum, render, salvarRascunho, saveRegistro,
    showFeedback, state, today
} from './main.js';
import { renderQrPix } from './pix.js';

export function renderRegistrar() {
    const frag = document.createDocumentFragment();
    const card = div('card');
    card.innerHTML = `<div class="card-title">Novo Atendimento</div>`;

    // ── Serviço ───────────────────────────────────────────────────────────────
    const fieldCorte = div('field');
    fieldCorte.innerHTML = `<label>Serviço *</label>`;
    const inputWrap = div('input-wrap');
    const inp = document.createElement('input');
    inp.className = 'input';
    inp.placeholder = 'Ex: Degradê, Barba...';
    inp.value = state.corteNome;
    inp.oninput = e => { state.corteNome = e.target.value; renderDropdown(e.target.value, drop, inp); salvarRascunho(); };
    inp.onblur = () => setTimeout(() => drop.classList.remove('show'), 150);
    inp.onfocus = () => renderDropdown(inp.value, drop, inp);
    const drop = div('dropdown');
    inputWrap.appendChild(inp);
    inputWrap.appendChild(drop);
    fieldCorte.appendChild(inputWrap);

    // Chips / acesso rápido
    const chipsSection = div('chips-section');
    const chipsHeader = div('chips-header');
    chipsHeader.innerHTML = `<span class="chips-label">Acesso rápido</span>`;
    const btnGer = document.createElement('button');
    btnGer.className = 'btn-gerenciar';
    btnGer.innerHTML = '✏ Editar serviços';
    btnGer.onclick = () => { renderModalCortes(); openModal('modalCortes'); };
    chipsHeader.appendChild(btnGer);

    // Filtros por categoria
    const catRow = div('');
    catRow.style.cssText = 'display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap';
    if (!state._chipCat) state._chipCat = 'todos';
    [['todos', 'Todos'], ['cabelo', '✂ Cabelo'], ['barba', '🪒 Barba'], ['completo', '✦ Completo']].forEach(([k, l]) => {
        const btn = document.createElement('button');
        btn.style.cssText = `padding:4px 12px;border-radius:20px;font-size:11px;cursor:pointer;border:1px solid var(--border);font-family:'DM Sans',sans-serif;transition:all .15s;background:${state._chipCat === k ? 'var(--gold)' : 'var(--surface2)'};color:${state._chipCat === k ? '#000' : 'var(--muted)'}`;
        btn.textContent = l;
        btn.onclick = () => { state._chipCat = k; render(); };
        catRow.appendChild(btn);
    });
    chipsSection.appendChild(catRow);

    const chipsDiv = div('chips');
    const categorizar = nome => {
        const n = nome.toLowerCase();
        if (n.includes('barba')) return 'barba';
        if (n.includes('completo') || n.includes('combo') || n.includes('corte + barba') || n.includes('barba + corte')) return 'completo';
        return 'cabelo';
    };
    const listaFiltrada = state._chipCat === 'todos'
        ? state.cortesLista
        : state.cortesLista.filter(c => categorizar(c.nome) === state._chipCat);
    listaFiltrada.forEach(c => {
        const ch = document.createElement('span');
        ch.className = 'chip';
        ch.textContent = c.nome;
        ch.onclick = () => {
            state.corteNome = c.nome;
            inp.value = c.nome;
            if (c.preco) { state.precoRaw = String(Math.round(c.preco * 100)); updatePrecoInput(); }
            drop.classList.remove('show');
            salvarRascunho();
        };
        chipsDiv.appendChild(ch);
    });
    chipsSection.appendChild(chipsHeader);
    chipsSection.appendChild(chipsDiv);
    fieldCorte.appendChild(chipsSection);
    card.appendChild(fieldCorte);

    // ── Valor ─────────────────────────────────────────────────────────────────
    const fieldVal = div('field');
    fieldVal.innerHTML = `<label>Valor do Serviço *</label>`;
    const inpVal = document.createElement('input');
    inpVal.className = 'input input-valor';
    inpVal.placeholder = '0,00';
    inpVal.inputMode = 'numeric';
    inpVal.value = fmtValorInput(state.precoRaw);
    inpVal.id = 'inp-preco';
    inpVal.oninput = e => { state.precoRaw = e.target.value.replace(/\D/g, ''); e.target.value = fmtValorInput(state.precoRaw); salvarRascunho(); };
    fieldVal.appendChild(inpVal);
    card.appendChild(fieldVal);

    // ── Gorjeta ───────────────────────────────────────────────────────────────
    const fieldGorj = div('field');
    fieldGorj.innerHTML = `<label>Gorjeta</label>`;
    const gorjRow = div('gorjeta-row');
    const togLabel = document.createElement('label');
    togLabel.className = 'gorjeta-toggle';
    const togBox = div('toggle-box' + (state.gorjetaOn ? ' on' : ''));
    const knob = div('toggle-knob');
    togBox.appendChild(knob);
    togLabel.appendChild(togBox);
    togLabel.append(' Incluir');
    togLabel.onclick = () => {
        state.gorjetaOn = !state.gorjetaOn;
        togBox.className = 'toggle-box' + (state.gorjetaOn ? ' on' : '');
        inpGorj.style.display = state.gorjetaOn ? '' : 'none';
        salvarRascunho();
    };
    const inpGorj = document.createElement('input');
    inpGorj.className = 'input';
    inpGorj.placeholder = 'Valor...';
    inpGorj.inputMode = 'numeric';
    inpGorj.style.display = state.gorjetaOn ? '' : 'none';
    inpGorj.value = fmtValorInput(state.gorjetaRaw);
    inpGorj.oninput = e => { state.gorjetaRaw = e.target.value.replace(/\D/g, ''); e.target.value = fmtValorInput(state.gorjetaRaw); salvarRascunho(); };
    gorjRow.appendChild(togLabel);
    gorjRow.appendChild(inpGorj);
    fieldGorj.appendChild(gorjRow);
    card.appendChild(fieldGorj);

    // ── Pagamento + QR PIX ────────────────────────────────────────────────────
    const fieldPag = div('field');
    fieldPag.innerHTML = `<label>Forma de Pagamento</label>`;
    const pagTabs = div('pag-tabs');
    const pagCfg = getPagConfig();
    const pagsDisponiveis = [
        pagCfg.pix && ['pix', `◈ ${pagCfg.nomePix}`],
        pagCfg.dinheiro && ['dinheiro', `$ ${pagCfg.nomeDinheiro}`],
        pagCfg.cartao && ['cartao', `💳 ${pagCfg.nomeCartao}`],
    ].filter(Boolean);
    if (!pagsDisponiveis.find(p => p[0] === state.pagamento)) state.pagamento = pagCfg.padrao;
    pagsDisponiveis.forEach(([k, l]) => {
        const btn = document.createElement('button');
        btn.className = 'pag-tab' + (state.pagamento === k ? ' active' : '');
        btn.innerHTML = l;
        btn.onclick = () => {
            state.pagamento = k;
            pagTabs.querySelectorAll('.pag-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderQrPix();
            salvarRascunho();
        };
        pagTabs.appendChild(btn);
    });
    fieldPag.appendChild(pagTabs);

    const qrWrap = div('');
    qrWrap.id = 'qr-pix-wrap';
    qrWrap.style.cssText = 'text-align:center;margin-top:12px;display:none';
    qrWrap.innerHTML = `
    <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">QR Code PIX</div>
    <div id="qr-canvas-container" style="display:inline-block;border-radius:12px;background:#fff;padding:10px"></div>
    <div id="qr-chave" style="font-size:12px;color:var(--muted);margin-top:8px;word-break:break-all;padding:0 8px"></div>
    <button onclick="copiarPixBarbeiro()" style="margin-top:8px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--muted);font-size:11px;cursor:pointer;padding:5px 14px;font-family:'DM Sans',sans-serif">📋 Copiar chave</button>`;
    fieldPag.appendChild(qrWrap);
    card.appendChild(fieldPag);
    setTimeout(() => renderQrPix(), 0);

    // ── Observação ────────────────────────────────────────────────────────────
    const fieldObs = div('field');
    fieldObs.innerHTML = `<label>Observação (opcional)</label>`;
    const inpObs = document.createElement('textarea');
    inpObs.className = 'input';
    inpObs.placeholder = 'Ex: cliente VIP, desconto amigo...';
    inpObs.rows = 2;
    inpObs.value = state.obs;
    inpObs.oninput = e => { state.obs = e.target.value; salvarRascunho(); };
    fieldObs.appendChild(inpObs);
    card.appendChild(fieldObs);

    // ── Botão registrar ───────────────────────────────────────────────────────
    const btn = document.createElement('button');
    btn.className = 'btn-primary';
    btn.textContent = '✂ Registrar Atendimento';
    btn.onclick = registrar;
    card.appendChild(btn);

    // ── Resumo do dia ─────────────────────────────────────────────────────────
    const regHoje = state.registros.filter(r => r.data === today() && r.barbeiro === state.barbeiroAtual);
    const totalHoje = regHoje.reduce((s, r) => s + r.valor, 0);
    const gorjetaHoje = regHoje.reduce((s, r) => s + (r.gorjeta || 0), 0);
    const resumo = div('resumo-dia');
    resumo.innerHTML = `
    <div class="resumo-item"><div class="resumo-val">${brl(totalHoje)}</div><div class="resumo-label">Total Hoje</div></div>
    <div class="resumo-item"><div class="resumo-val">${regHoje.length}</div><div class="resumo-label">Cortes</div></div>
    <div class="resumo-item"><div class="resumo-val">${brl(gorjetaHoje)}</div><div class="resumo-label">Gorjetas</div></div>`;
    card.appendChild(resumo);

    if (state.metas.dia > 0) {
        const pct = Math.min(100, Math.round((totalHoje / state.metas.dia) * 100));
        const metaDiv = div('meta-bar-wrap');
        metaDiv.innerHTML = `
      <div class="meta-header"><span class="meta-label">Meta do dia: ${brl(state.metas.dia)}</span><span class="meta-pct">${pct}%</span></div>
      <div class="meta-track"><div class="meta-fill${pct >= 100 ? ' done' : ''}" style="width:${pct}%"></div></div>`;
        card.appendChild(metaDiv);
    }

    frag.appendChild(card);
    return frag;
}

// ── Helpers internos ──────────────────────────────────────────────────────────
function updatePrecoInput() {
    const el = document.getElementById('inp-preco');
    if (el) el.value = fmtValorInput(state.precoRaw);
}

function renderDropdown(q, drop, inp) {
    if (!q) { drop.classList.remove('show'); return; }
    const matches = state.cortesLista.filter(c => c.nome.toLowerCase().includes(q.toLowerCase()));
    if (!matches.length) { drop.classList.remove('show'); return; }
    drop.innerHTML = '';
    matches.forEach(c => {
        const item = div('drop-item');
        item.innerHTML = `${c.nome} <span style="color:var(--gold);font-size:12px">${c.preco ? brl(c.preco) : ''}</span>`;
        item.onmousedown = () => {
            state.corteNome = c.nome;
            inp.value = c.nome;
            if (c.preco) { state.precoRaw = String(Math.round(c.preco * 100)); updatePrecoInput(); }
            drop.classList.remove('show');
            salvarRascunho();
        };
        drop.appendChild(item);
    });
    drop.classList.add('show');
}

async function registrar() {
    if (!state.corteNome.trim()) { showFeedback('Informe o serviço!', 'erro'); return; }
    const val = rawToNum(state.precoRaw);
    if (!val || val <= 0) { showFeedback('Informe o valor!', 'erro'); return; }
    const gorj = state.gorjetaOn ? rawToNum(state.gorjetaRaw) : 0;
    const tempId = 't' + Date.now();
    const novoReg = {
        _tempId: tempId, id: tempId,
        corte: state.corteNome.trim(), valor: val, gorjeta: gorj,
        pagamento: state.pagamento, obs: state.obs.trim(),
        data: today(), hora: hora(), barbeiro: state.barbeiroAtual
    };
    state.registros.unshift(novoReg);
    state.corteNome = ''; state.precoRaw = ''; state.gorjetaRaw = ''; state.gorjetaOn = false; state.obs = '';
    limparRascunho();
    showFeedback('Atendimento registrado! ✂', 'ok');
    render();
    await saveRegistro(novoReg);
}

// ── Expõe para o modal de cortes (chamado de config.js também) ────────────────
export function renderModalCortes() {
    const list = document.getElementById('cortes-list');
    list.innerHTML = '';
    state.cortesLista.forEach((c, idx) => {
        const item = div('corte-item');
        item.id = `corte-item-${idx}`;
        item.innerHTML = `<span class="corte-nome">${c.nome}</span><span class="corte-preco">${c.preco ? brl(c.preco) : ''}</span><button class="btn-icone" onclick="editarCorte(${idx})">✏️</button><button class="btn-icone" style="color:var(--red)" onclick="excluirCorte(${idx})">🗑</button>`;
        list.appendChild(item);
    });
    const inpP = document.getElementById('novo-corte-preco');
    if (inpP) inpP.oninput = e => { const raw = e.target.value.replace(/\D/g, ''); e.target.value = fmtValorInput(raw); };
}
window.renderModalCortes = renderModalCortes;

window.editarCorte = function (idx) {
    const item = document.getElementById(`corte-item-${idx}`);
    const c = state.cortesLista[idx];
    item.innerHTML = `<div class="corte-edit-row"><input class="input" id="edit-nome-${idx}" value="${c.nome}" style="font-size:14px;padding:8px 10px;flex:1"/><input class="input" id="edit-preco-${idx}" value="${c.preco ? fmtValorInput(String(Math.round(c.preco * 100))) : ''}" placeholder="Preço" style="font-size:14px;padding:8px 10px;width:90px;flex:none" inputmode="numeric"/></div><button class="btn-sm btn-ok" onclick="salvarCorte(${idx})">✓</button><button class="btn-sm btn-cancel" onclick="renderModalCortes()">✕</button>`;
    document.getElementById(`edit-preco-${idx}`).oninput = e => { const raw = e.target.value.replace(/\D/g, ''); e.target.value = fmtValorInput(raw); };
};

window.salvarCorte = function (idx) {
    const nome = document.getElementById(`edit-nome-${idx}`).value.trim();
    const precoRaw = document.getElementById(`edit-preco-${idx}`).value.replace(/\D/g, '');
    if (!nome) return;
    state.cortesLista[idx] = { nome, preco: precoRaw ? rawToNum(precoRaw) : 0 };
    import('./main.js').then(m => m.saveConfig());
    showFeedback('Serviço atualizado!', 'ok');
    renderModalCortes();
    render();
};

window.excluirCorte = function (idx) {
    state.cortesLista.splice(idx, 1);
    import('./main.js').then(m => m.saveConfig());
    showFeedback('Serviço removido.', 'ok');
    renderModalCortes();
    render();
};

window.adicionarCorte = function () {
    const nome = document.getElementById('novo-corte-nome').value.trim();
    const precoRaw = document.getElementById('novo-corte-preco').value.replace(/\D/g, '');
    if (!nome) { showFeedback('Digite um nome!', 'erro'); return; }
    if (state.cortesLista.find(c => c.nome.toLowerCase() === nome.toLowerCase())) { showFeedback('Serviço já existe!', 'erro'); return; }
    state.cortesLista.push({ nome, preco: precoRaw ? rawToNum(precoRaw) : 0 });
    document.getElementById('novo-corte-nome').value = '';
    document.getElementById('novo-corte-preco').value = '';
    import('./main.js').then(m => m.saveConfig());
    showFeedback('Serviço adicionado!', 'ok');
    renderModalCortes();
    render();
};