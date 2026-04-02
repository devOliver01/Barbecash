// ─────────────────────────────────────────────────────────────────────────────
// vagas.js — Gerenciamento de Vagas (listener, calendário, gerador)
// ─────────────────────────────────────────────────────────────────────────────
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    onSnapshot,
    orderBy,
    query
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { closeModal, db, div, openModal, showFeedback, state } from './main.js';

// ── Estado local ──────────────────────────────────────────────────────────────
let _slotIntervalo = 60;
let _slotDias = new Set([1, 2, 3, 4, 5, 6]); // Seg–Sáb por padrão
let _calVagasMes = new Date().getMonth();
let _calVagasAno = new Date().getFullYear();
let _calVagasDiaSel = null;
let _vagasAbaAtual = 'cal';

// ── Listener em tempo real ────────────────────────────────────────────────────
export function iniciarListenerVagas() {
    if (state._unsubVagas) state._unsubVagas();
    const q = query(collection(db, 'vagas'), orderBy('dataHora', 'asc'));
    state._unsubVagas = onSnapshot(q, snap => {
        state.vagas = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(v => !v.uid || v.uid === state.uid);
    }, e => console.error('listener vagas:', e));
}

// ── Carregar vagas (uma vez) ──────────────────────────────────────────────────
export async function carregarVagas() {
    try {
        const snap = await getDocs(query(collection(db, 'vagas'), orderBy('dataHora', 'asc')));
        state.vagas = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(v => !v.uid || v.uid === state.uid);
    } catch (e) { console.error(e); }
}

// ── Controles do modal ────────────────────────────────────────────────────────
window.mudarAbaVagas = function (aba) {
    _vagasAbaAtual = aba;
    document.getElementById('vaga-tab-cal').classList.toggle('active', aba === 'cal');
    document.getElementById('vaga-tab-gen').classList.toggle('active', aba === 'gen');
    document.getElementById('vagas-painel-cal').style.display = aba === 'cal' ? '' : 'none';
    document.getElementById('vagas-painel-gen').style.display = aba === 'gen' ? '' : 'none';
};

window.navMesVagas = function (dir) {
    _calVagasMes += dir;
    if (_calVagasMes > 11) { _calVagasMes = 0; _calVagasAno++; }
    if (_calVagasMes < 0) { _calVagasMes = 11; _calVagasAno--; }
    _calVagasDiaSel = null;
    renderCalVagas();
};

window.selecionarIntervalo = function (min, btn) {
    _slotIntervalo = min;
    document.querySelectorAll('#slot-intervalo-opts .pag-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
};

window.toggleDiaSemana = function (dia, btn) {
    if (_slotDias.has(dia)) _slotDias.delete(dia);
    else _slotDias.add(dia);
    btn.classList.toggle('active');
};

// ── Calendário mensal de vagas ────────────────────────────────────────────────
export function renderCalVagas() {
    const label = document.getElementById('cal-vagas-label');
    const grid = document.getElementById('cal-vagas-grid');
    const slots = document.getElementById('cal-vagas-slots');
    if (!label || !grid || !slots) return;

    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    label.textContent = `${meses[_calVagasMes]} ${_calVagasAno}`;

    // Mapa dia → vagas
    const vagasPorDia = {};
    state.vagas.forEach(v => {
        const d = new Date(v.dataHora);
        if (d.getFullYear() === _calVagasAno && d.getMonth() === _calVagasMes) {
            const k = d.getDate();
            if (!vagasPorDia[k]) vagasPorDia[k] = [];
            vagasPorDia[k].push(v);
        }
    });

    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const primeiroDia = new Date(_calVagasAno, _calVagasMes, 1).getDay();
    const totalDias = new Date(_calVagasAno, _calVagasMes + 1, 0).getDate();

    grid.innerHTML = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => `<div class="cal-dow">${d}</div>`).join('');
    for (let i = 0; i < primeiroDia; i++) grid.innerHTML += `<div class="cal-day vazio"></div>`;

    for (let d = 1; d <= totalDias; d++) {
        const dataD = new Date(_calVagasAno, _calVagasMes, d);
        const passado = dataD < hoje;
        const temVagas = !!vagasPorDia[d];
        const sel = _calVagasDiaSel
            && new Date(_calVagasDiaSel).getDate() === d
            && new Date(_calVagasDiaSel).getMonth() === _calVagasMes
            && new Date(_calVagasDiaSel).getFullYear() === _calVagasAno;
        const isHoje = dataD.getTime() === hoje.getTime();

        let cls = 'cal-day';
        if (passado) cls += ' passado';
        else if (sel) cls += ' selecionado';
        else if (temVagas) cls += ' tem-vagas';
        if (isHoje) cls += ' hoje';

        const dot = temVagas && !sel ? `<div class="cal-day-dot"></div>` : '';
        const el = document.createElement('div');
        el.className = cls;
        el.innerHTML = `${d}${dot}`;
        if (!passado) el.onclick = () => { _calVagasDiaSel = dataD.getTime(); renderCalVagas(); };
        grid.appendChild(el);
    }

    if (!_calVagasDiaSel) {
        slots.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:12px;padding:8px 0">Toque em um dia para ver os horários</div>';
        return;
    }

    const dSel = new Date(_calVagasDiaSel);
    const dSelNum = dSel.getDate();
    const vagasDia = (vagasPorDia[dSelNum] || []).sort((a, b) => a.dataHora - b.dataHora);
    const diaFmt = dSel.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    slots.innerHTML = `<div class="cal-slots-header">${diaFmt} · ${vagasDia.length} horário(s)</div>`;

    if (!vagasDia.length) {
        slots.innerHTML += `<div style="text-align:center;color:var(--muted);font-size:13px;padding:12px 0;background:var(--surface2);border-radius:10px">Nenhum horário neste dia</div>`;
        return;
    }

    const slotGrid = div('cal-slots-grid');
    vagasDia.forEach(v => {
        const horaStr = new Date(v.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const ocupado = v.disponivel === false;
        const slotEl = div('cal-slot' + (ocupado ? ' ocupado' : ''));
        slotEl.innerHTML = `
      <button class="cal-slot-del" title="Remover" onclick="excluirVaga('${v.id}')">✕</button>
      <div class="cal-slot-hora">${horaStr}</div>
      <div class="cal-slot-status">${ocupado ? (v.agendadoPor || 'Ocupado') : 'Livre'}</div>`;
        slotGrid.appendChild(slotEl);
    });
    slots.appendChild(slotGrid);
}
window.renderCalVagas = renderCalVagas;

// ── Gerar slots automaticamente ───────────────────────────────────────────────
window.gerarSlots = async function () {
    const dataIni = document.getElementById('slot-data-ini').value;
    const dataFim = document.getElementById('slot-data-fim').value;
    const horaIni = document.getElementById('slot-hora-ini').value;
    const horaFim = document.getElementById('slot-hora-fim').value;
    const preview = document.getElementById('slot-preview');

    if (!dataIni || !dataFim || !horaIni || !horaFim) { preview.textContent = '⚠️ Preencha todas as datas e horários.'; return; }
    if (dataFim < dataIni) { preview.textContent = '⚠️ Data fim menor que data início.'; return; }
    if (!_slotDias.size) { preview.textContent = '⚠️ Selecione ao menos um dia da semana.'; return; }

    const slots = [];
    const d = new Date(dataIni + 'T00:00:00');
    const fim = new Date(dataFim + 'T23:59:59');
    while (d <= fim) {
        if (_slotDias.has(d.getDay())) {
            const [hIni, mIni] = horaIni.split(':').map(Number);
            const [hFim, mFim] = horaFim.split(':').map(Number);
            let cur = hIni * 60 + mIni;
            const fimMin = hFim * 60 + mFim;
            while (cur < fimMin) {
                const slotDate = new Date(d);
                slotDate.setHours(Math.floor(cur / 60), cur % 60, 0, 0);
                if (slotDate.getTime() > Date.now()) slots.push(slotDate.getTime());
                cur += _slotIntervalo;
            }
        }
        d.setDate(d.getDate() + 1);
    }

    if (!slots.length) { preview.textContent = 'Nenhum slot gerado. Verifique as configurações.'; return; }

    const existentes = new Set(state.vagas.map(v => v.dataHora));
    const novos = slots.filter(s => !existentes.has(s));
    if (!novos.length) { preview.innerHTML = `✓ Todos os ${slots.length} horários já existem.`; return; }

    preview.innerHTML = `<span style="color:var(--gold)">Gerando ${novos.length} horário(s)...</span>`;
    let ok = 0;
    for (const ts of novos) {
        try {
            const ref = await addDoc(collection(db, 'vagas'), { dataHora: ts, disponivel: true, criadoEm: Date.now(), uid: state.uid || '' });
            state.vagas.push({ id: ref.id, dataHora: ts, disponivel: true });
            ok++;
        } catch (e) { console.error(e); }
    }
    preview.innerHTML = `<span style="color:var(--green)">✓ ${ok} horário(s) criado(s)!</span>`;
    renderCalVagas();
};

// ── Excluir vaga ──────────────────────────────────────────────────────────────
window.excluirVaga = function (id) {
    document.getElementById('confirm-title-text').textContent = 'Excluir vaga?';
    document.querySelector('.confirm-sub').textContent = 'Esta ação não pode ser desfeita.';
    document.getElementById('btn-confirm-del').onclick = async () => {
        try {
            await deleteDoc(doc(db, 'vagas', id));
            state.vagas = state.vagas.filter(v => v.id !== id);
            closeModal('overlayConfirm');
            showFeedback('Vaga removida.', 'ok');
            renderCalVagas();
        } catch (e) { console.error(e); showFeedback('Erro ao remover.', 'erro'); }
    };
    openModal('overlayConfirm');
};

// ── Abrir modal de vagas ──────────────────────────────────────────────────────
window.abrirModalVagas = async function () {
    await carregarVagas();
    _calVagasMes = new Date().getMonth();
    _calVagasAno = new Date().getFullYear();
    _calVagasDiaSel = null;
    _vagasAbaAtual = 'cal';

    const hoje = new Date().toISOString().slice(0, 10);
    const proxSem = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    document.getElementById('slot-data-ini').value = hoje;
    document.getElementById('slot-data-fim').value = proxSem;
    document.getElementById('slot-preview').textContent = '';
    document.getElementById('vaga-tab-cal').classList.add('active');
    document.getElementById('vaga-tab-gen').classList.remove('active');
    document.getElementById('vagas-painel-cal').style.display = '';
    document.getElementById('vagas-painel-gen').style.display = 'none';

    document.querySelectorAll('#slot-intervalo-opts .pag-tab').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.min) === _slotIntervalo);
    });
    document.querySelectorAll('#slot-dias-opts .pag-tab').forEach(b => {
        b.classList.toggle('active', _slotDias.has(parseInt(b.dataset.dia)));
    });

    openModal('modalVagas');
    setTimeout(() => renderCalVagas(), 50);
};