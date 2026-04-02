// ─────────────────────────────────────────────────────────────────────────────
// relatorio.js — Relatório de Rendimento (tela inline + exportar PDF)
// ─────────────────────────────────────────────────────────────────────────────
import { brl, div, irTela, periodoLabel, showFeedback, state } from './main.js';

// ── Abre a tela de rendimento inline (dentro do app) ─────────────────────────
export function abrirTelaRendimento(filtrados, total, gorjTotal) {
    state.tela = 'rendimento';
    state._rendDados = { filtrados, total, gorjTotal };
    const el = document.getElementById('body-content'); if (!el) return;
    el.innerHTML = '';

    // Barra superior: Voltar + Exportar
    const topoBar = div('');
    topoBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px';

    const btnVoltar = document.createElement('button');
    btnVoltar.style.cssText = 'background:none;border:none;color:var(--muted);font-size:13px;cursor:pointer;font-family:"DM Sans",sans-serif;display:flex;align-items:center;gap:6px;padding:0;transition:color .2s';
    btnVoltar.innerHTML = '← Voltar';
    btnVoltar.onmouseenter = () => btnVoltar.style.color = 'var(--text)';
    btnVoltar.onmouseleave = () => btnVoltar.style.color = 'var(--muted)';
    btnVoltar.onclick = () => irTela('historico', document.getElementById('nav-historico'));

    const btnExportar = document.createElement('button');
    btnExportar.style.cssText = 'background:var(--gold);border:none;border-radius:10px;color:#000;font-size:12px;font-weight:700;cursor:pointer;font-family:"DM Sans",sans-serif;padding:9px 16px;display:flex;align-items:center;gap:6px;transition:opacity .2s';
    btnExportar.innerHTML = '📤 Exportar PDF';
    btnExportar.onclick = () => exportarRendimento(filtrados, total, gorjTotal);

    topoBar.appendChild(btnVoltar);
    topoBar.appendChild(btnExportar);
    el.appendChild(topoBar);
    el.appendChild(buildRendimentoView(filtrados, total, gorjTotal));

    el.classList.remove('fade-in'); void el.offsetWidth; el.classList.add('fade-in');
    const fab = document.getElementById('fab-registrar');
    if (fab) fab.style.display = 'none';
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
}

// ── renderRelatorio (rota 'relatorio' do router) ─────────────────────────────
export function renderRelatorio() {
    // Se tiver dados salvos (voltou da tela), usa-os
    if (state._rendDados) {
        const { filtrados, total, gorjTotal } = state._rendDados;
        return buildRendimentoViewWrapper(filtrados, total, gorjTotal);
    }
    const frag = document.createDocumentFragment();
    const vz = div('vazio'); vz.innerHTML = `<div class="vazio-icon">📋</div>Acesse via Financeiro → Relatório de Rendimento`;
    frag.appendChild(vz);
    return frag;
}

function buildRendimentoViewWrapper(filtrados, total, gorjTotal) {
    const frag = document.createDocumentFragment();
    const topoBar = div('');
    topoBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px';
    const btnVoltar = document.createElement('button');
    btnVoltar.style.cssText = 'background:none;border:none;color:var(--muted);font-size:13px;cursor:pointer;font-family:"DM Sans",sans-serif;display:flex;align-items:center;gap:6px;padding:0';
    btnVoltar.innerHTML = '← Voltar';
    btnVoltar.onclick = () => irTela('historico', document.getElementById('nav-historico'));
    const btnExportar = document.createElement('button');
    btnExportar.style.cssText = 'background:var(--gold);border:none;border-radius:10px;color:#000;font-size:12px;font-weight:700;cursor:pointer;font-family:"DM Sans",sans-serif;padding:9px 16px;display:flex;align-items:center;gap:6px';
    btnExportar.innerHTML = '📤 Exportar PDF';
    btnExportar.onclick = () => exportarRendimento(filtrados, total, gorjTotal);
    topoBar.appendChild(btnVoltar); topoBar.appendChild(btnExportar);
    frag.appendChild(topoBar);
    frag.appendChild(buildRendimentoView(filtrados, total, gorjTotal));
    return frag;
}

// ── Conteúdo da tela de rendimento ─────────────────────────────────────────
function buildRendimentoView(filtrados, total, gorjTotal) {
    const frag = document.createDocumentFragment();
    const totalGeral = total + gorjTotal;
    const periodo = periodoLabel[state.periodo] || state.periodo;
    const nome = state.nomeUsuario || 'Barbeiro';
    const ticketMedio = filtrados.length ? total / filtrados.length : 0;

    const pagMap = { pix: 0, dinheiro: 0, cartao: 0 };
    filtrados.forEach(r => pagMap[r.pagamento || 'pix'] += r.valor + (r.gorjeta || 0));

    const mapCorte = {};
    filtrados.forEach(r => { if (!mapCorte[r.corte]) mapCorte[r.corte] = { qtd: 0, total: 0 }; mapCorte[r.corte].qtd++; mapCorte[r.corte].total += r.valor; });
    const porCorte = Object.entries(mapCorte).sort((a, b) => b[1].total - a[1].total);
    const maxCorte = porCorte[0] ? porCorte[0][1].total || 1 : 1;

    const dias7 = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const porDiaSem = [0, 0, 0, 0, 0, 0, 0], porDiaSemQtd = [0, 0, 0, 0, 0, 0, 0];
    filtrados.forEach(r => { const d = new Date(r.data + 'T12:00:00').getDay(); porDiaSem[d] += r.valor + (r.gorjeta || 0); porDiaSemQtd[d]++; });
    const maxDiaSem = Math.max(...porDiaSem) || 1;

    const porData = {};
    filtrados.forEach(r => { if (!porData[r.data]) porData[r.data] = { total: 0, qtd: 0 }; porData[r.data].total += r.valor + (r.gorjeta || 0); porData[r.data].qtd++; });
    const datasOrdenadas = Object.keys(porData).sort();
    const melhorDia = datasOrdenadas.reduce((best, d) => porData[d].total > (porData[best]?.total || 0) ? d : best, datasOrdenadas[0]);
    const melhorDiaSemNome = dias7[porDiaSem.indexOf(Math.max(...porDiaSem))];

    // ── KPI card ──
    const kpiCard = div('card');
    kpiCard.innerHTML = `
    <div class="card-title">Resumo do Período</div>
    <div style="background:linear-gradient(135deg,rgba(201,168,76,.06),rgba(201,168,76,.12));border:1px solid var(--gold-dim);border-radius:12px;padding:16px;text-align:center;margin-bottom:14px">
      <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:2px;margin-bottom:4px">${periodo} · ${nome}</div>
      <div style="font-family:'Playfair Display',serif;font-size:36px;color:var(--gold)">${brl(totalGeral)}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px">${filtrados.length} atendimento(s) · ticket médio ${brl(ticketMedio)}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div style="background:#0a0a0a;border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Melhor dia</div>
        <div style="font-size:14px;font-weight:600;color:var(--text)">${melhorDia ? new Date(melhorDia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) : '—'}</div>
      </div>
      <div style="background:#0a0a0a;border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Dia + movimentado</div>
        <div style="font-size:14px;font-weight:600;color:var(--text)">${melhorDiaSemNome}</div>
      </div>
    </div>`;
    frag.appendChild(kpiCard);

    // ── Pagamentos ──
    const pagCard = div('card');
    pagCard.innerHTML = `
    <div class="card-title">Por Pagamento</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
      <div style="background:#0a0a0a;border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:14px;font-weight:600;color:var(--blue);margin-bottom:4px">${brl(pagMap.pix)}</div>
        <div style="font-size:10px;color:var(--muted)">◈ Pix</div>
      </div>
      <div style="background:#0a0a0a;border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:14px;font-weight:600;color:var(--green);margin-bottom:4px">${brl(pagMap.dinheiro)}</div>
        <div style="font-size:10px;color:var(--muted)">$ Dinheiro</div>
      </div>
      <div style="background:#0a0a0a;border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:14px;font-weight:600;color:#c97de8;margin-bottom:4px">${brl(pagMap.cartao)}</div>
        <div style="font-size:10px;color:var(--muted)">💳 Cartão</div>
      </div>
    </div>`;
    frag.appendChild(pagCard);

    // ── Gráfico dias da semana ──
    const semCard = div('card'); semCard.innerHTML = `<div class="card-title">Por Dia da Semana</div>`;
    const barsWrap = div(''); barsWrap.style.cssText = 'display:flex;align-items:flex-end;gap:6px;height:110px;padding-top:8px';
    dias7.forEach((d, i) => {
        const h = porDiaSem[i] > 0 ? Math.max(12, Math.round((porDiaSem[i] / maxDiaSem) * 88)) : 4;
        const isMelhor = porDiaSem[i] > 0 && porDiaSem[i] === Math.max(...porDiaSem);
        const col = div(''); col.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;flex:1';
        col.innerHTML = `
      <div style="font-size:9px;color:${isMelhor ? 'var(--gold)' : 'var(--muted)'};font-weight:${isMelhor ? '700' : '400'};min-height:14px;text-align:center">${porDiaSem[i] > 0 ? 'R$' + Math.round(porDiaSem[i]) : ''}</div>
      <div style="width:100%;height:${h}px;background:${isMelhor ? 'var(--gold)' : 'var(--surface3)'};border-radius:4px 4px 0 0;border:1px solid ${isMelhor ? 'var(--gold)' : 'var(--border)'}"></div>
      <div style="font-size:11px;color:${isMelhor ? 'var(--gold)' : 'var(--muted)'};font-weight:${isMelhor ? '700' : '400'}">${d}</div>
      <div style="font-size:9px;color:var(--muted2)">${porDiaSemQtd[i] > 0 ? porDiaSemQtd[i] + 'x' : ''}</div>`;
        barsWrap.appendChild(col);
    });
    semCard.appendChild(barsWrap); frag.appendChild(semCard);

    // ── Top serviços ──
    if (porCorte.length) {
        const svcCard = div('card'); svcCard.innerHTML = `<div class="card-title">Top Serviços</div>`;
        porCorte.slice(0, 6).forEach(([nome, info]) => {
            const pct = Math.round((info.total / maxCorte) * 100);
            const row = div('barra-row');
            row.innerHTML = `<div class="barra-info"><span class="barra-nome">${nome}</span><span class="barra-qtd">${info.qtd}x</span></div><div class="barra-track"><div class="barra-fill" style="width:${pct}%"></div></div><div class="barra-val">${brl(info.total)}</div>`;
            svcCard.appendChild(row);
        });
        frag.appendChild(svcCard);
    }

    // ── Gorjetas ──
    if (gorjTotal > 0) {
        const taxaGorj = Math.round((filtrados.filter(r => r.gorjeta > 0).length / filtrados.length) * 100);
        const gorjCard = div('card');
        gorjCard.innerHTML = `
      <div class="card-title">Gorjetas</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div style="background:#0a0a0a;border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">
          <div style="font-family:'Playfair Display',serif;font-size:18px;color:var(--green)">${brl(gorjTotal)}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:4px;text-transform:uppercase">Total</div>
        </div>
        <div style="background:#0a0a0a;border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">
          <div style="font-family:'Playfair Display',serif;font-size:18px;color:var(--text)">${filtrados.filter(r => r.gorjeta > 0).length}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:4px;text-transform:uppercase">Qtd</div>
        </div>
        <div style="background:#0a0a0a;border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">
          <div style="font-family:'Playfair Display',serif;font-size:18px;color:var(--text)">${taxaGorj}%</div>
          <div style="font-size:10px;color:var(--muted);margin-top:4px;text-transform:uppercase">Taxa</div>
        </div>
      </div>`;
        frag.appendChild(gorjCard);
    }

    // ── Métricas extras ──
    const metCard = div('card'); metCard.innerHTML = `<div class="card-title">Métricas</div>`;
    const metGrid = div('metricas-grid');
    metGrid.innerHTML = `
    <div class="metrica-item"><div class="metrica-val">${filtrados.length}</div><div class="metrica-label">Total cortes</div></div>
    <div class="metrica-item"><div class="metrica-val">${brl(ticketMedio)}</div><div class="metrica-label">Ticket médio</div></div>
    <div class="metrica-item"><div class="metrica-val">${brl(gorjTotal)}</div><div class="metrica-label">Gorjetas</div></div>
    <div class="metrica-item"><div class="metrica-val">${porCorte.length}</div><div class="metrica-label">Tipos serviço</div></div>`;
    metCard.appendChild(metGrid); frag.appendChild(metCard);
    return frag;
}

// ── Exportar PDF (abre em nova aba) ─────────────────────────────────────────
export function exportarRendimento(filtrados, total, gorjTotal) {
    if (!filtrados.length) { showFeedback('Sem dados no período.', 'erro'); return; }
    const periodo = periodoLabel[state.periodo] || state.periodo;
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    const nome = state.nomeUsuario || 'Barbeiro';
    const totalGeral = total + gorjTotal;
    const ticketMedio = filtrados.length ? total / filtrados.length : 0;
    const pagMap = { pix: 0, dinheiro: 0, cartao: 0 };
    filtrados.forEach(r => pagMap[r.pagamento || 'pix'] += r.valor + (r.gorjeta || 0));
    const mapCorte = {};
    filtrados.forEach(r => { if (!mapCorte[r.corte]) mapCorte[r.corte] = { qtd: 0, total: 0 }; mapCorte[r.corte].qtd++; mapCorte[r.corte].total += r.valor; });
    const porCorte = Object.entries(mapCorte).sort((a, b) => b[1].total - a[1].total);
    const maxCorte = porCorte[0] ? porCorte[0][1].total || 1 : 1;
    const dias7 = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const porDiaSem = [0, 0, 0, 0, 0, 0, 0], porDiaSemQtd = [0, 0, 0, 0, 0, 0, 0];
    filtrados.forEach(r => { const d = new Date(r.data + 'T12:00:00').getDay(); porDiaSem[d] += r.valor + (r.gorjeta || 0); porDiaSemQtd[d]++; });
    const maxDiaSem = Math.max(...porDiaSem) || 1;
    const porData = {};
    filtrados.forEach(r => { if (!porData[r.data]) porData[r.data] = { total: 0, qtd: 0 }; porData[r.data].total += r.valor + (r.gorjeta || 0); porData[r.data].qtd++; });
    const datasOrdenadas = Object.keys(porData).sort();
    const melhorDia = datasOrdenadas.reduce((best, d) => porData[d].total > (porData[best]?.total || 0) ? d : best, datasOrdenadas[0]);
    const melhorDiaSemNome = dias7[porDiaSem.indexOf(Math.max(...porDiaSem))];

    const barrasDiaSem = dias7.map((d, i) => {
        const h = porDiaSem[i] > 0 ? Math.max(8, Math.round((porDiaSem[i] / maxDiaSem) * 120)) : 4;
        const isMelhor = porDiaSem[i] === Math.max(...porDiaSem) && porDiaSem[i] > 0;
        return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1">
      <div style="font-size:10px;color:#c9a84c;font-weight:600;min-height:16px">${porDiaSem[i] > 0 ? 'R$' + Math.round(porDiaSem[i]) : ''}</div>
      <div style="width:100%;max-width:36px;height:${h}px;background:${isMelhor ? '#c9a84c' : '#2a2a2a'};border-radius:4px 4px 0 0"></div>
      <div style="font-size:11px;color:${isMelhor ? '#c9a84c' : '#777'};font-weight:${isMelhor ? '700' : '400'}">${d}</div>
      <div style="font-size:10px;color:#555">${porDiaSemQtd[i] > 0 ? porDiaSemQtd[i] + 'x' : ''}</div>
    </div>`;
    }).join('');

    const topServicos = porCorte.slice(0, 6).map(([n, info]) => {
        const pct = Math.round((info.total / maxCorte) * 100);
        return `<div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px">
        <span style="font-size:13px;color:#e8e5e0">${n}</span>
        <div style="display:flex;gap:12px"><span style="font-size:11px;color:#777">${info.qtd}x</span><span style="font-size:13px;color:#c9a84c;font-weight:600">R$ ${info.total.toFixed(2).replace('.', ',')}</span></div>
      </div>
      <div style="height:6px;background:#1a1a1a;border-radius:3px;overflow:hidden"><div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#7a6230,#c9a84c);border-radius:3px"></div></div>
    </div>`;
    }).join('');

    const gorjSection = gorjTotal > 0 ? `<div class="section"><div class="section-title">Gorjetas</div><div class="kpi-grid">
    <div class="kpi verde"><div class="kpi-val">R$ ${gorjTotal.toFixed(2).replace('.', ',')}</div><div class="kpi-label">Total</div></div>
    <div class="kpi"><div class="kpi-val">${filtrados.filter(r => r.gorjeta > 0).length}</div><div class="kpi-label">Qtd</div></div>
    <div class="kpi"><div class="kpi-val">${Math.round((filtrados.filter(r => r.gorjeta > 0).length / filtrados.length) * 100)}%</div><div class="kpi-label">Taxa</div></div>
  </div></div>`: '';

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Rendimento · ${nome} · ${periodo}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#080808;color:#f0ede8;min-height:100vh;padding:24px 16px 48px}
.page{max-width:640px;margin:0 auto}
.top-header{display:flex;align-items:center;gap:14px;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid #1e1e1e}
.logo-box{width:46px;height:46px;background:#c9a84c;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0}
.top-title{font-size:22px;font-weight:700;color:#c9a84c}
.top-sub{font-size:12px;color:#777;margin-top:3px}
.section{background:#111;border:1px solid #1e1e1e;border-radius:14px;padding:18px;margin-bottom:14px}
.section-title{font-size:10px;color:#666;text-transform:uppercase;letter-spacing:2px;margin-bottom:14px;font-weight:600}
.kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.kpi{background:#0a0a0a;border:1px solid #1e1e1e;border-radius:10px;padding:14px;text-align:center}
.kpi-val{font-size:19px;font-weight:700;color:#c9a84c;margin-bottom:3px}
.kpi-label{font-size:10px;color:#666;text-transform:uppercase}
.kpi.verde .kpi-val{color:#4caf78}
.highlight-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
.highlight{background:#0a0a0a;border:1px solid #1e1e1e;border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:10px}
.highlight-icon{font-size:22px;flex-shrink:0}
.highlight-label{font-size:10px;color:#666;text-transform:uppercase;margin-bottom:2px}
.highlight-val{font-size:14px;font-weight:600;color:#f0ede8}
.pag-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.pag-box{background:#0a0a0a;border:1px solid #1e1e1e;border-radius:10px;padding:12px;text-align:center}
.pag-val{font-size:15px;font-weight:600;margin-bottom:3px}
.pag-label{font-size:10px;color:#666}
.bars-wrap{display:flex;align-items:flex-end;gap:4px;height:160px;padding-top:20px}
.footer{text-align:center;font-size:11px;color:#444;margin-top:28px;padding-top:16px;border-top:1px solid #1e1e1e}
@media print{body{background:#fff;color:#1a1a1a}.section{background:#fafafa;border-color:#eee}.kpi{background:#fff;border-color:#eee}.kpi-val,.top-title{color:#c9a84c}}
</style></head><body>
<div class="page">
  <div class="top-header">
    <div class="logo-box">✂</div>
    <div><div class="top-title">Relatório de Rendimento</div><div class="top-sub">${nome} · ${periodo} · Gerado em ${dataHoje}</div></div>
  </div>
  <div class="section">
    <div class="section-title">Resumo</div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-val">R$ ${totalGeral.toFixed(2).replace('.', ',')}</div><div class="kpi-label">Total</div></div>
      <div class="kpi"><div class="kpi-val">${filtrados.length}</div><div class="kpi-label">Atendimentos</div></div>
      <div class="kpi verde"><div class="kpi-val">R$ ${ticketMedio.toFixed(2).replace('.', ',')}</div><div class="kpi-label">Ticket médio</div></div>
    </div>
    <div class="highlight-row">
      <div class="highlight"><div class="highlight-icon">🏆</div><div><div class="highlight-label">Melhor dia</div><div class="highlight-val">${melhorDia ? new Date(melhorDia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) : '—'}</div></div></div>
      <div class="highlight"><div class="highlight-icon">📅</div><div><div class="highlight-label">Dia + movimentado</div><div class="highlight-val">${melhorDiaSemNome}</div></div></div>
    </div>
  </div>
  <div class="section"><div class="section-title">Por Dia da Semana</div><div class="bars-wrap">${barrasDiaSem}</div></div>
  <div class="section"><div class="section-title">Por Pagamento</div><div class="pag-grid">
    <div class="pag-box"><div class="pag-val" style="color:#5b9cf6">R$ ${pagMap.pix.toFixed(2).replace('.', ',')}</div><div class="pag-label">◈ Pix</div></div>
    <div class="pag-box"><div class="pag-val" style="color:#4caf78">R$ ${pagMap.dinheiro.toFixed(2).replace('.', ',')}</div><div class="pag-label">$ Dinheiro</div></div>
    <div class="pag-box"><div class="pag-val" style="color:#c97de8">R$ ${pagMap.cartao.toFixed(2).replace('.', ',')}</div><div class="pag-label">💳 Cartão</div></div>
  </div></div>
  <div class="section"><div class="section-title">Top Serviços</div>${topServicos || '<p style="color:#555;font-size:13px">Sem dados</p>'}</div>
  ${gorjSection}
  <div class="footer">BarberCash · Relatório de Rendimento · ${dataHoje}</div>
</div>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    showFeedback('Relatório aberto! 📊', 'ok');
}