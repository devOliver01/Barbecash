// ─────────────────────────────────────────────────────────────────────────────
// home.js — Tela Home
// ─────────────────────────────────────────────────────────────────────────────
import { brl, div, irTela, monthRange, state, today } from './main.js';

export function renderHome() {
    const frag = document.createDocumentFragment();
    const wrap = div('');

    // ── Saudação ──────────────────────────────────────────────────────────────
    const h = new Date().getHours();
    const saudacao = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const greet = div('home-greeting');
    greet.innerHTML = `<div class="greeting-line">${saudacao}, ${state.nomeUsuario || 'Barbeiro'} 👋</div>`;

    const painelRow = div('');
    painelRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between';
    painelRow.innerHTML = `<div class="greeting-name">Painel do negócio</div>`;
    const eyeBtn = document.createElement('button');
    eyeBtn.className = 'eye-btn';
    eyeBtn.title = 'Mostrar/ocultar valores';
    eyeBtn.innerHTML = state._homeValoresVisiveis ? '👁' : '👁‍🗨';
    eyeBtn.onclick = () => { state._homeValoresVisiveis = !state._homeValoresVisiveis; renderHomeUpdate(); };
    painelRow.appendChild(eyeBtn);
    greet.appendChild(painelRow);
    wrap.appendChild(greet);

    const blur = !state._homeValoresVisiveis ? ' val-blur' : '';

    // ── Cards financeiros ──────────────────────────────────────────────────────
    const regHoje = state.registros.filter(r => r.data === today() && r.barbeiro === state.barbeiroAtual);
    const totalHoje = regHoje.reduce((s, r) => s + r.valor + (r.gorjeta || 0), 0);
    const [mesIni, mesFim] = monthRange();
    const regMes = state.registros.filter(r => r.data >= mesIni && r.data <= mesFim && r.barbeiro === state.barbeiroAtual);
    const totalMes = regMes.reduce((s, r) => s + r.valor + (r.gorjeta || 0), 0);
    const metaMes = state.metas.mes || 0;
    const pctMeta = metaMes > 0 ? Math.min(100, Math.round((totalMes / metaMes) * 100)) : 0;

    const ontem = new Date(); ontem.setDate(ontem.getDate() - 1);
    const ontemStr = ontem.toISOString().slice(0, 10);
    const regOntem = state.registros.filter(r => r.data === ontemStr && r.barbeiro === state.barbeiroAtual);
    const totalOntem = regOntem.reduce((s, r) => s + r.valor + (r.gorjeta || 0), 0);
    let subHoje = '';
    if (totalOntem > 0) {
        const diff = Math.round(((totalHoje - totalOntem) / totalOntem) * 100);
        subHoje = `<span class="${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '↑' : '↓'} ${Math.abs(diff)}%</span> vs ontem`;
    } else {
        subHoje = `${regHoje.length} atendimento${regHoje.length !== 1 ? 's' : ''}`;
    }

    const cards = div('fin-cards');
    const c1 = div('fin-card');
    c1.innerHTML = `<div class="fin-card-label">Hoje</div><div class="fin-card-val${blur}">${brl(totalHoje)}</div><div class="fin-card-sub">${subHoje}</div>`;
    c1.onclick = () => irTela('historico', document.getElementById('nav-historico'));

    const c2 = div('fin-card');
    c2.innerHTML = `<div class="fin-card-label">Este mês</div><div class="fin-card-val${blur}">${brl(totalMes)}</div><div class="fin-card-sub"><span class="up">✂</span> ${regMes.length} cortes</div>`;
    c2.onclick = () => irTela('historico', document.getElementById('nav-historico'));
    cards.appendChild(c1); cards.appendChild(c2);

    if (metaMes > 0) {
        const r28 = 28, circ = 2 * Math.PI * r28, offset = circ * (1 - pctMeta / 100);
        const cFull = div('fin-card full');
        cFull.innerHTML = `
      <div>
        <div class="fin-card-label">Meta mensal — ${pctMeta}%</div>
        <div class="fin-card-val${blur}">${brl(totalMes)} <span style="font-size:14px;color:var(--muted)">/ ${brl(metaMes)}</span></div>
      </div>
      <div style="width:70px;height:70px;position:relative;flex-shrink:0">
        <svg viewBox="0 0 70 70" style="transform:rotate(-90deg);width:70px;height:70px">
          <circle cx="35" cy="35" r="${r28}" fill="none" stroke="var(--border)" stroke-width="6"/>
          <circle cx="35" cy="35" r="${r28}" fill="none" stroke="${pctMeta >= 100 ? 'var(--green)' : 'var(--gold)'}" stroke-width="6"
            stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}" stroke-linecap="round"
            style="transition:stroke-dashoffset .8s ease"/>
        </svg>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-size:14px;color:${pctMeta >= 100 ? 'var(--green)' : 'var(--gold)'}">${pctMeta}%</div>
      </div>`;
        cards.appendChild(cFull);
    }
    wrap.appendChild(cards);

    // ── Agendamentos de Hoje ──────────────────────────────────────────────────
    const agora = Date.now();
    const hojeStr = today();
    const agHoje = state.agendamentos
        .filter(a => !a.atendido && new Date(a.dataHora || 0).toISOString().slice(0, 10) === hojeStr)
        .map(a => ({ ...a, _ts: a.dataHora || 0 }))
        .sort((a, b) => a._ts - b._ts);

    const MAX_PROX = 3;
    const proxVisiveis = state._proxExpandido ? agHoje : agHoje.slice(0, MAX_PROX);

    const proxHeader = div('home-section-header');
    const btnVerAgenda = document.createElement('button');
    btnVerAgenda.className = 'home-section-link'; btnVerAgenda.textContent = 'Ver agenda →';
    btnVerAgenda.onclick = () => irTela('agendamentos', document.getElementById('nav-agendamentos'));
    proxHeader.innerHTML = `<div class="home-section-title">📅 Hoje (${agHoje.length})</div>`;
    proxHeader.appendChild(btnVerAgenda);
    wrap.appendChild(proxHeader);

    if (agHoje.length === 0) {
        const vz = div(''); vz.style.cssText = 'text-align:center;color:var(--muted);padding:24px 0;font-size:13px';
        vz.innerHTML = '<div style="font-size:28px;margin-bottom:8px">📅</div>Nenhum agendamento para hoje';
        wrap.appendChild(vz);
    } else {
        proxVisiveis.forEach(ag => {
            const diffMin = Math.round((ag._ts - agora) / 60000);
            let badgeHtml = '';
            if (diffMin <= 30 && diffMin >= -5) badgeHtml = `<div class="prox-badge badge-iminente">em ${diffMin <= 0 ? 'agora' : diffMin + 'min'}</div>`;
            else if (diffMin < -5) badgeHtml = `<div class="prox-badge" style="background:rgba(119,119,119,.15);color:var(--muted)">passou</div>`;
            else badgeHtml = `<div class="prox-badge badge-hoje-conf">confirmado</div>`;
            const dt = new Date(ag._ts);
            const horaStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const item = div('prox-item');
            item.innerHTML = `
        <div class="prox-hora"><div class="prox-hora-val">${horaStr}</div><div class="prox-hora-label">hoje</div></div>
        <div class="prox-divider"></div>
        <div class="prox-info"><div class="prox-nome">${ag.nome || '—'}</div><div class="prox-servico">✂ ${ag.servico || '—'}</div></div>
        ${badgeHtml}`;
            item.onclick = () => irTela('agendamentos', document.getElementById('nav-agendamentos'));
            wrap.appendChild(item);
        });
        if (agHoje.length > MAX_PROX) {
            const btnTodos = document.createElement('button');
            btnTodos.style.cssText = 'width:100%;margin-top:6px;padding:10px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--muted);font-size:12px;cursor:pointer;font-family:"DM Sans",sans-serif';
            btnTodos.textContent = state._proxExpandido ? '▲ Mostrar menos' : `▼ Ver todos do dia (${agHoje.length - MAX_PROX} a mais)`;
            btnTodos.onclick = () => { state._proxExpandido = !state._proxExpandido; renderHomeUpdate(); };
            wrap.appendChild(btnTodos);
        }
    }

    // ── Resumo mensal compacto ─────────────────────────────────────────────────
    const [mIni, mFim] = monthRange();
    const agMesTodos = state.agendamentos.filter(a => {
        const dStr = new Date(a.dataHora || 0).toISOString().slice(0, 10);
        return dStr >= mIni && dStr <= mFim;
    });
    const agMesPendentes = agMesTodos.filter(a => !a.atendido && new Date(a.dataHora || 0).toISOString().slice(0, 10) >= hojeStr);
    const agMesAtendidos = agMesTodos.filter(a => a.atendido);
    const em7d = new Date(); em7d.setDate(em7d.getDate() + 7);
    const agProx7 = agMesPendentes.filter(a => a.dataHora <= em7d.getTime()).sort((a, b) => a.dataHora - b.dataHora);

    const semHeader = div('home-section-header'); semHeader.style.marginTop = '16px';
    const btnVerAgendaMes = document.createElement('button');
    btnVerAgendaMes.className = 'home-section-link'; btnVerAgendaMes.textContent = 'Ver agenda →';
    btnVerAgendaMes.onclick = () => irTela('agendamentos', document.getElementById('nav-agendamentos'));
    semHeader.innerHTML = `<div class="home-section-title">🗓 Este mês</div>`;
    semHeader.appendChild(btnVerAgendaMes);
    wrap.appendChild(semHeader);

    const mesCard = div('');
    mesCard.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:8px';

    // Stats 3 colunas
    const mesStats = div('');
    mesStats.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px';
    mesStats.innerHTML = `
    <div style="background:#0a0a0a;border-radius:10px;padding:12px;text-align:center;border:1px solid var(--border)">
      <div style="font-family:'Playfair Display',serif;font-size:22px;color:var(--gold);line-height:1">${agMesTodos.length}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:4px;text-transform:uppercase;letter-spacing:.5px">Total</div>
    </div>
    <div style="background:#0a0a0a;border-radius:10px;padding:12px;text-align:center;border:1px solid var(--border)">
      <div style="font-family:'Playfair Display',serif;font-size:22px;color:var(--green);line-height:1">${agMesAtendidos.length}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:4px;text-transform:uppercase;letter-spacing:.5px">Atendidos</div>
    </div>
    <div style="background:#0a0a0a;border-radius:10px;padding:12px;text-align:center;border:1px solid var(--border)">
      <div style="font-family:'Playfair Display',serif;font-size:22px;color:var(--gold);line-height:1">${agMesPendentes.length}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:4px;text-transform:uppercase;letter-spacing:.5px">Pendentes</div>
    </div>`;
    mesCard.appendChild(mesStats);

    // Barra de progresso
    if (agMesTodos.length > 0) {
        const pct = Math.round((agMesAtendidos.length / agMesTodos.length) * 100);
        const prog = div('');
        prog.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:11px;color:var(--muted)">Taxa de atendimento</span>
        <span style="font-size:12px;color:${pct >= 80 ? 'var(--green)' : 'var(--gold)'};font-weight:600">${pct}%</span>
      </div>
      <div style="height:4px;background:var(--surface2);border-radius:2px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:${pct >= 80 ? 'var(--green)' : 'linear-gradient(90deg,var(--gold-dim),var(--gold))'};border-radius:2px;transition:width .8s"></div>
      </div>`;
        mesCard.appendChild(prog);
    }

    // Próximos 7 dias
    if (agProx7.length > 0) {
        const divider = div('');
        divider.style.cssText = 'border-top:1px solid var(--border);margin:12px 0 10px;display:flex;align-items:center;gap:8px';
        divider.innerHTML = `<span style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;white-space:nowrap">Próximos 7 dias</span><div style="flex:1;height:1px;background:var(--border)"></div><span style="font-size:11px;color:var(--gold);font-weight:600">${agProx7.length}</span>`;
        mesCard.appendChild(divider);

        const proxLista = div('');
        proxLista.style.cssText = 'display:flex;flex-direction:column;gap:5px';
        agProx7.slice(0, 4).forEach(ag => {
            const dtAg = new Date(ag.dataHora || 0);
            const diaLabel = dtAg.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
            const horaLabel = dtAg.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const row = div('');
            row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:#0a0a0a;border-radius:8px;cursor:pointer;transition:background .15s';
            row.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-family:'Playfair Display',serif;font-size:14px;color:var(--gold);min-width:36px">${horaLabel}</span>
          <div>
            <div style="font-size:12px;font-weight:500">${ag.nome || '—'}</div>
            <div style="font-size:10px;color:var(--muted)">${diaLabel} · ✂ ${ag.servico || '—'}</div>
          </div>
        </div>
        <span style="font-size:11px;color:var(--muted)">›</span>`;
            row.onmouseenter = () => row.style.background = 'var(--surface2)';
            row.onmouseleave = () => row.style.background = '#0a0a0a';
            row.onclick = () => irTela('agendamentos', document.getElementById('nav-agendamentos'));
            proxLista.appendChild(row);
        });
        if (agProx7.length > 4) {
            const mais = div('');
            mais.style.cssText = 'text-align:center;font-size:11px;color:var(--muted);padding:6px 0;cursor:pointer';
            mais.textContent = `+ ${agProx7.length - 4} agendamento(s)`;
            mais.onclick = () => irTela('agendamentos', document.getElementById('nav-agendamentos'));
            proxLista.appendChild(mais);
        }
        mesCard.appendChild(proxLista);
    } else if (agMesTodos.length === 0) {
        const vz = div(''); vz.style.cssText = 'text-align:center;color:var(--muted);padding:16px 0;font-size:13px';
        vz.textContent = 'Nenhum agendamento neste mês';
        mesCard.appendChild(vz);
    }

    wrap.appendChild(mesCard);
    frag.appendChild(wrap);
    return frag;
}

function renderHomeUpdate() {
    // Re-renderiza só o body sem recriar o app inteiro
    const el = document.getElementById('body-content'); if (!el) return;
    const { render } = window._bc || {};
    if (render) render();
    else { el.innerHTML = ''; el.appendChild(renderHome()); }
}