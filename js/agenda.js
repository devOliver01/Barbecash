// ─────────────────────────────────────────────────────────────────────────────
// agenda.js — Tela de Agendamentos
// ─────────────────────────────────────────────────────────────────────────────
import {
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    orderBy,
    query,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
    brl,
    db,
    div,
    getPagConfig,
    hora,
    monthRange,
    openModal, render,
    saveRegistro,
    showFeedback,
    state,
    today, weekRange
} from './main.js';
import { renderMraQrPix } from './pix.js';

let _agendaSubFiltro = 'pendentes';

export function iniciarListenerAgendamentos() {
    if (state._unsubAgendamentos) state._unsubAgendamentos();
    const { getFirestore: _gf, ..._ } = {}; // já importado via main
    const q = query(collection(db, 'agendamentos'), orderBy('dataHora', 'asc'));
    state._unsubAgendamentos = onSnapshot(q, snap => {
        state.agendamentos = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(a => !a.uid || a.uid === state.uid);
        if (state.tela === 'home' || state.tela === 'agendamentos') render();
        import('./clientes.js').then(m => m.atualizarBadgeClientes());
    }, e => console.error('listener agendamentos:', e));
}

export function renderAgendamentos() {
    const frag = document.createDocumentFragment();
    const agora = Date.now();
    const hojeStr = today();
    if (!state._agendaPeriodo) state._agendaPeriodo = 'hoje';
    const periodo = state._agendaPeriodo;

    function getRange() {
        const ini = new Date(); ini.setHours(0, 0, 0, 0);
        if (periodo === 'hoje') { const fim = new Date(ini); fim.setHours(23, 59, 59, 999); return [ini.getTime(), fim.getTime()]; }
        if (periodo === 'semana') { const [a, b] = weekRange(); return [new Date(a + 'T00:00:00').getTime(), new Date(b + 'T23:59:59').getTime()]; }
        if (periodo === 'mes') { const [a, b] = monthRange(); return [new Date(a + 'T00:00:00').getTime(), new Date(b + 'T23:59:59').getTime()]; }
        return [0, Infinity];
    }

    const [rangeIni, rangeFim] = getRange();
    const agFiltrados = state.agendamentos
        .filter(a => (a.dataHora || 0) >= rangeIni && (a.dataHora || 0) <= rangeFim)
        .sort((a, b) => a.dataHora - b.dataHora);

    const pendentes = agFiltrados.filter(a => !a.atendido);
    const atendidos = agFiltrados.filter(a => a.atendido);
    const proximoAg = periodo === 'hoje'
        ? pendentes.filter(a => a.dataHora >= agora - 5 * 60000).sort((a, b) => a.dataHora - b.dataHora)[0]
        : null;

    // ── Card topo ─────────────────────────────────────────────────────────────
    const topCard = div('card'); topCard.style.marginBottom = '10px';
    topCard.innerHTML = `<div class="card-title" style="margin-bottom:14px">📅 Agenda</div>`;

    // Filtros de período
    const periodoWrap = div(''); periodoWrap.style.cssText = 'display:flex;gap:6px;margin-bottom:14px';
    [['hoje', 'Hoje'], ['semana', 'Semana'], ['mes', 'Mês'], ['todos', 'Todos']].forEach(([k, l]) => {
        const isActive = periodo === k;
        const btn = document.createElement('button');
        btn.style.cssText = `flex:1;padding:9px 4px;border-radius:10px;font-size:12px;font-weight:${isActive ? '700' : '400'};cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .2s;border:1px solid ${isActive ? 'var(--gold)' : 'var(--border)'};background:${isActive ? 'var(--gold)' : 'var(--surface2)'};color:${isActive ? '#000' : 'var(--muted)'}`;
        btn.textContent = l;
        btn.onclick = () => { state._agendaPeriodo = k; render(); };
        periodoWrap.appendChild(btn);
    });
    topCard.appendChild(periodoWrap);

    // Stats
    const statsGrid = div('');
    statsGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px';
    const totalFat = atendidos.reduce((s, a) => {
        const reg = state.registros.find(r => r.origemAgenda === a.id);
        return s + (reg ? reg.valor + (reg.gorjeta || 0) : 0);
    }, 0);
    statsGrid.innerHTML = `
    <div style="background:#0a0a0a;border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">
      <div style="font-family:'Playfair Display',serif;font-size:20px;color:var(--text);line-height:1">${agFiltrados.length}</div>
      <div style="font-size:9px;color:var(--muted);margin-top:4px;text-transform:uppercase;letter-spacing:.5px">Total</div>
    </div>
    <div style="background:#0a0a0a;border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">
      <div style="font-family:'Playfair Display',serif;font-size:20px;color:var(--green);line-height:1">${atendidos.length}</div>
      <div style="font-size:9px;color:var(--muted);margin-top:4px;text-transform:uppercase;letter-spacing:.5px">Atendidos</div>
    </div>
    <div style="background:#0a0a0a;border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">
      <div style="font-family:'Playfair Display',serif;font-size:20px;color:var(--gold);line-height:1">${pendentes.length}</div>
      <div style="font-size:9px;color:var(--muted);margin-top:4px;text-transform:uppercase;letter-spacing:.5px">Pendentes</div>
    </div>`;
    topCard.appendChild(statsGrid);

    if (totalFat > 0) {
        const fatDiv = div('');
        fatDiv.style.cssText = 'margin-top:10px;padding:10px 14px;background:linear-gradient(135deg,rgba(201,168,76,.06),rgba(201,168,76,.12));border:1px solid var(--gold-dim);border-radius:10px;display:flex;align-items:center;justify-content:space-between';
        fatDiv.innerHTML = `<span style="font-size:12px;color:var(--muted)">💰 Faturado no período</span><span style="font-family:'Playfair Display',serif;font-size:16px;color:var(--gold)">${brl(totalFat)}</span>`;
        topCard.appendChild(fatDiv);
    }

    // Banner próximo (hoje apenas)
    if (proximoAg) {
        const dtProx = new Date(proximoAg.dataHora);
        const horaProx = dtProx.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const diffMin = Math.round((proximoAg.dataHora - agora) / 60000);
        const iminente = diffMin >= -5 && diffMin <= 30;
        const badgeLabel = diffMin <= 0 ? 'agora' : diffMin < 60 ? `em ${diffMin}min` : `em ${Math.round(diffMin / 60)}h`;
        const banner = div('agenda-prox-banner'); banner.style.marginTop = '12px';
        banner.innerHTML = `
      <div><div class="agenda-prox-hora">${horaProx}</div><div class="agenda-prox-label">próximo</div></div>
      <div class="agenda-prox-info">
        <div class="agenda-prox-nome">${proximoAg.nome || '—'}</div>
        <div class="agenda-prox-serv">✂ ${proximoAg.servico || '—'}</div>
      </div>
      <div class="agenda-prox-badge${iminente ? '' : ' ok'}">${badgeLabel}</div>`;
        topCard.appendChild(banner);
    }
    frag.appendChild(topCard);

    // ── Lista de agendamentos ──────────────────────────────────────────────────
    const listCard = div('card');
    if (_agendaSubFiltro === 'mensagens') _agendaSubFiltro = 'pendentes';
    const tabRow = div('agenda-tab-row');
    [['pendentes', `Pendentes (${pendentes.length})`], ['atendidos', `Atendidos (${atendidos.length})`]].forEach(([k, label]) => {
        const btn = document.createElement('button');
        btn.className = 'agenda-tab' + (_agendaSubFiltro === k ? ' active' : '');
        btn.textContent = label;
        btn.onclick = () => { _agendaSubFiltro = k; render(); };
        tabRow.appendChild(btn);
    });
    listCard.appendChild(tabRow);

    const lista = _agendaSubFiltro === 'pendentes' ? pendentes : atendidos;

    if (!lista.length) {
        const vazio = div('vazio'); vazio.style.padding = '32px 0';
        vazio.innerHTML = `<div class="vazio-icon">${_agendaSubFiltro === 'pendentes' ? '📭' : '✅'}</div>${_agendaSubFiltro === 'pendentes' ? 'Nenhum agendamento pendente' : 'Nenhum atendimento registrado'}`;
        listCard.appendChild(vazio);
    } else {
        const mkCard = makeAgendaCard(agora);
        if (periodo === 'hoje') {
            const passados = lista.filter(a => a.dataHora < agora - 5 * 60000);
            const futuros = lista.filter(a => a.dataHora >= agora - 5 * 60000);
            if (futuros.length > 0) {
                if (passados.length > 0) { const l = div('agenda-section-label'); l.textContent = 'Próximos'; listCard.appendChild(l); }
                futuros.forEach(ag => listCard.appendChild(mkCard(ag)));
            }
            if (passados.length > 0) {
                const l = div('agenda-section-label'); l.textContent = 'Mais cedo'; listCard.appendChild(l);
                passados.forEach(ag => listCard.appendChild(mkCard(ag)));
            }
        } else {
            // Agrupa por data em acordeões
            const porData = {};
            lista.forEach(a => {
                const dStr = new Date(a.dataHora || 0).toISOString().slice(0, 10);
                if (!porData[dStr]) porData[dStr] = [];
                porData[dStr].push(a);
            });
            Object.keys(porData).sort().forEach(dStr => {
                const regs = porData[dStr];
                const dtObj = new Date(dStr + 'T12:00:00');
                const isToday = dStr === hojeStr;
                const isPassado = new Date(dStr + 'T23:59:59') < new Date();
                const diaLabel = isToday ? 'Hoje' : dtObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
                const details = document.createElement('details');
                details.open = !isPassado;
                details.style.cssText = 'margin-bottom:8px;border-radius:12px;overflow:hidden;border:1px solid var(--border)';
                const summary = document.createElement('summary');
                summary.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:11px 14px;background:var(--surface);cursor:pointer;list-style:none;user-select:none';
                summary.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:6px;height:6px;border-radius:50%;background:${isToday ? 'var(--gold)' : 'var(--muted2)'};flex-shrink:0"></div>
            <span style="font-size:13px;font-weight:600;color:${isToday ? 'var(--gold)' : 'var(--text)'};">${diaLabel}</span>
            ${isToday ? '<span style="font-size:10px;background:rgba(201,168,76,.15);color:var(--gold);border-radius:4px;padding:1px 7px">hoje</span>' : ''}
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:12px;font-family:\'Playfair Display\',serif;color:var(--gold)">${regs.length}</span>
            <span style="font-size:12px;color:var(--muted);transition:transform .2s" class="acc-arrow">▾</span>
          </div>`;
                details.addEventListener('toggle', () => {
                    const arrow = summary.querySelector('.acc-arrow');
                    if (arrow) arrow.style.transform = details.open ? 'rotate(0deg)' : 'rotate(-90deg)';
                });
                details.appendChild(summary);
                const body = div(''); body.style.cssText = 'background:var(--bg);padding:6px 8px 8px';
                regs.forEach(ag => body.appendChild(mkCard(ag)));
                details.appendChild(body);
                listCard.appendChild(details);
            });
        }
    }
    frag.appendChild(listCard);
    return frag;
}

function makeAgendaCard(agora) {
    return function (ag) {
        const c = div('agenda-card' + (ag.atendido ? ' atendido' : ''));
        const dtHora = new Date(ag.dataHora);
        const horaStr = dtHora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const diaStr = dtHora.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
        const diffMs = ag.dataHora - agora;
        const isIminente = !ag.atendido && diffMs > 0 && diffMs < 3600000;
        c.innerHTML = `
      <div class="agenda-card-hora">
        <div class="agenda-card-hora-val">${horaStr}</div>
        <div class="agenda-card-hora-dot"></div>
      </div>
      <div class="agenda-card-divider"></div>
      <div class="agenda-card-body">
        <div class="agenda-nome">${ag.nome || '—'}</div>
        <div class="agenda-servico">✂ ${ag.servico || '—'}</div>
        <div class="agenda-meta">
          <span>${diaStr}</span>
          ${ag.whatsapp ? `<span>📱 ${formatarWppDisplay(ag.whatsapp)}</span>` : ''}
          ${isIminente ? `<span style="color:var(--red);font-weight:600">em ${Math.round(diffMs / 60000)}min</span>` : ''}
        </div>
        ${ag.obs ? `<div class="agenda-obs">"${ag.obs}"</div>` : ''}
        <div class="agenda-actions">
          ${ag.whatsapp ? `<button class="btn-agenda-wpp" onclick="wppClienteOpts('${ag.whatsapp}','${(ag.nome || '').replace(/'/g, "\\'")}','${ag.servico || ''}',${ag.dataHora})">💬 WhatsApp</button>` : ''}
          <button class="btn-agenda-ok${ag.atendido ? ' done' : ''}" onclick="toggleAtendido('${ag.id}',${!!ag.atendido})">${ag.atendido ? '✓ Atendido' : 'Marcar atendido'}</button>
          <button class="btn-agenda-del" onclick="excluirAgendamento('${ag.id}')">🗑</button>
        </div>
      </div>`;
        return c;
    };
}

export function formatarWppDisplay(num) {
    const n = (num || '').replace(/\D/g, '');
    if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
    return n;
}

// ── Ações globais ─────────────────────────────────────────────────────────────
window.excluirAgendamento = function (id) {
    document.getElementById('confirm-title-text').textContent = 'Excluir agendamento?';
    document.querySelector('.confirm-sub').textContent = 'Esta ação não pode ser desfeita.';
    document.getElementById('btn-confirm-del').onclick = async () => {
        try {
            await deleteDoc(doc(db, 'agendamentos', id));
            state.agendamentos = state.agendamentos.filter(a => a.id !== id);
            closeModal('overlayConfirm'); showFeedback('Agendamento removido.', 'ok'); render();
        } catch (e) { console.error(e); showFeedback('Erro ao remover.', 'erro'); }
    };
    openModal('overlayConfirm');
};

window.toggleAtendido = async function (id, jaAtendido) {
    if (jaAtendido) {
        try { await updateDoc(doc(db, 'agendamentos', id), { atendido: false }); showFeedback('Marcado como pendente.', 'ok'); }
        catch (e) { console.error(e); showFeedback('Erro ao atualizar.', 'erro'); }
        return;
    }
    const ag = state.agendamentos.find(a => a.id === id);
    if (!ag) return;
    abrirModalRegAgendamento(ag);
};

window.wppClienteOpts = function (wpp, nome, servico, dataHora) {
    const n = (wpp || '').replace(/\D/g, '');
    if (!n) { showFeedback('WhatsApp não disponível.', 'erro'); return; }
    const dt = new Date(dataHora);
    const diaStr = dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
    const horaStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const msgs = [
        { label: '✅ Confirmar agendamento', texto: `Olá ${nome}! 👋 Passando para confirmar seu horário:\n\n✂ *${servico}*\n📅 ${diaStr} às ${horaStr}\n\nTe esperamos! 💈` },
        { label: '⏰ Lembrete (1h antes)', texto: `Olá ${nome}! ⏰ Lembrando que seu horário é daqui a pouco:\n\n✂ *${servico}*\n📅 ${diaStr} às ${horaStr}\n\nQualquer dúvida, é só falar! 💈` },
        { label: '💬 Mensagem livre', texto: `Olá ${nome}! 👋 ` },
        { label: '🎉 Obrigado pela visita', texto: `Olá ${nome}! 🎉 Obrigado pela visita hoje!\n\nEsperamos que tenha gostado. Quando quiser agendar novamente, é só falar. Até a próxima! ✂💈` },
    ];
    let overlay = document.getElementById('wpp-opts-overlay');
    if (!overlay) { overlay = document.createElement('div'); overlay.id = 'wpp-opts-overlay'; overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:300;display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity .25s;pointer-events:none'; document.body.appendChild(overlay); }
    overlay.innerHTML = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:20px 20px 30px;transform:translateY(100%);transition:transform .3s cubic-bezier(.4,0,.2,1)" id="wpp-opts-sheet">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="font-family:'Playfair Display',serif;font-size:18px;color:var(--gold)">💬 Enviar para ${nome}</div>
      <button onclick="fecharWppOpts()" style="background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer;line-height:1;padding:4px">✕</button>
    </div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:12px">Escolha uma mensagem para enviar via WhatsApp:</div>
    ${msgs.map((m, i) => `<button onclick="enviarWppOpt(${i})" style="width:100%;text-align:left;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;color:var(--text);font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;margin-bottom:8px">${m.label}</button>`).join('')}
  </div>`;
    overlay._wpp = n; overlay._msgs = msgs;
    overlay.style.opacity = '1'; overlay.style.pointerEvents = 'all';
    setTimeout(() => { const s = document.getElementById('wpp-opts-sheet'); if (s) s.style.transform = 'translateY(0)'; }, 10);
    overlay.onclick = e => { if (e.target === overlay) fecharWppOpts(); };
};
window.enviarWppOpt = function (idx) { const o = document.getElementById('wpp-opts-overlay'); if (!o) return; window.open(`https://wa.me/55${o._wpp}?text=${encodeURIComponent(o._msgs[idx].texto)}`, '_blank'); fecharWppOpts(); };
window.fecharWppOpts = function () { const o = document.getElementById('wpp-opts-overlay'); if (!o) return; const s = document.getElementById('wpp-opts-sheet'); if (s) s.style.transform = 'translateY(100%)'; o.style.opacity = '0'; o.style.pointerEvents = 'none'; };

// ── Modal registrar a partir de agendamento ──────────────────────────────────
let _mraAgendaId = null;
function abrirModalRegAgendamento(ag) {
    _mraAgendaId = ag.id;
    const dt = new Date(ag.dataHora);
    const diaStr = dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
    const horaStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('modal-reg-agenda-nome').innerHTML = `👤 <b>${ag.nome || '—'}</b> · ✂ ${ag.servico || '—'} · 📅 ${diaStr} às ${horaStr}`;
    const inpServ = document.getElementById('mra-servico'); inpServ.value = ag.servico || '';
    const corte = state.cortesLista.find(c => c.nome === ag.servico);
    const inpVal = document.getElementById('mra-valor');
    const precoRaw = corte ? String(Math.round(corte.preco * 100)) : (ag.precoServico ? String(Math.round(ag.precoServico * 100)) : '');
    inpVal.value = fmtValorInput(precoRaw); inpVal._raw = precoRaw;
    inpVal.oninput = e => { inpVal._raw = e.target.value.replace(/\D/g, ''); e.target.value = fmtValorInput(inpVal._raw); };
    const gorjBox = document.getElementById('mra-gorj-box');
    const gorjInp = document.getElementById('mra-gorjeta');
    gorjBox.className = 'toggle-box'; gorjInp.style.display = 'none'; gorjInp.value = ''; gorjInp._raw = '';
    gorjInp.oninput = e => { gorjInp._raw = e.target.value.replace(/\D/g, ''); e.target.value = fmtValorInput(gorjInp._raw); };
    document.getElementById('mra-gorj-tog').onclick = () => { const on = gorjBox.classList.contains('on'); gorjBox.className = 'toggle-box' + (on ? '' : ' on'); gorjInp.style.display = on ? 'none' : ''; };
    const pagCfg = getPagConfig(); const tabsEl = document.getElementById('mra-pag-tabs'); tabsEl.innerHTML = '';
    let pagAtual = pagCfg.padrao;
    [[pagCfg.pix, 'pix', `◈ ${pagCfg.nomePix}`], [pagCfg.dinheiro, 'dinheiro', `$ ${pagCfg.nomeDinheiro}`], [pagCfg.cartao, 'cartao', `💳 ${pagCfg.nomeCartao}`]].filter(p => p[0]).forEach(([_, k, l]) => {
        const btn = document.createElement('button'); btn.className = 'pag-tab' + (k === pagAtual ? ' active' : ''); btn.innerHTML = l;
        btn.onclick = () => { pagAtual = k; tabsEl.querySelectorAll('.pag-tab').forEach(b => b.classList.remove('active')); btn.classList.add('active'); tabsEl._pag = k; renderMraQrPix(k); };
        tabsEl.appendChild(btn);
    });
    tabsEl._pag = pagAtual;
    document.getElementById('mra-obs').value = ag.obs || '';
    openModal('modalRegAgenda');
    setTimeout(() => renderMraQrPix(pagAtual), 50);
}

window.salvarRegistroAgendamento = async function () {
    const servico = document.getElementById('mra-servico').value.trim();
    const inpVal = document.getElementById('mra-valor');
    const val = rawToNum(inpVal._raw || '');
    const gorjInp = document.getElementById('mra-gorjeta');
    const gorjOn = document.getElementById('mra-gorj-box').classList.contains('on');
    const gorj = gorjOn ? rawToNum(gorjInp._raw || '') : 0;
    const pagCfg = getPagConfig();
    const pag = document.getElementById('mra-pag-tabs')._pag || pagCfg.padrao;
    const obs = document.getElementById('mra-obs').value.trim();
    if (!servico) { showFeedback('Informe o serviço!', 'erro'); return; }
    if (!val || val <= 0) { showFeedback('Informe o valor!', 'erro'); return; }
    const btn = document.getElementById('btn-mra-salvar');
    btn.disabled = true; btn.textContent = 'Salvando...';
    const tempId = 't' + Date.now();
    const novoReg = { _tempId: tempId, id: tempId, corte: servico, valor: val, gorjeta: gorj, pagamento: pag, obs, data: today(), hora: hora(), barbeiro: state.barbeiroAtual, origemAgenda: _mraAgendaId || null };
    state.registros.unshift(novoReg);
    if (_mraAgendaId) { try { await updateDoc(doc(db, 'agendamentos', _mraAgendaId), { atendido: true }); } catch (e) { console.error(e); } }
    closeModal('modalRegAgenda'); showFeedback('Atendimento registrado! ✂', 'ok'); render();
    await saveRegistro(novoReg);
    btn.disabled = false; btn.textContent = '✂ Registrar';
};

// imports internos
import { closeModal, fmtValorInput, rawToNum } from './main.js';
