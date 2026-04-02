// ─────────────────────────────────────────────────────────────────────────────
// config.js — Tela de Configurações e todos os seus modais
// ─────────────────────────────────────────────────────────────────────────────
import {
    EmailAuthProvider,
    reauthenticateWithCredential,
    updateEmail,
    updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
    auth,
    closeModal, db, deleteRegistro, diasRestantesPremium,
    div, fmtValorInput, isPremium, LS, openModal, planoAtivo,
    rawToNum, render, saveConfig, showFeedback, state
} from './main.js';
import { abrirModalPix, gerarPixPayload, gerarQR } from './pix.js';

// ── Tela Config ───────────────────────────────────────────────────────────────
export function renderConfig() {
    const frag = document.createDocumentFragment();

    // Card principal de opções
    const card = div('card');
    card.innerHTML = `<div class="card-title">Configurações</div>`;

    const opcoes = [
        { icon: '👤', label: 'Meu Nome', sub: `Exibido como: ${state.nomeUsuario}`, fn: () => { document.getElementById('nome-input').value = state.nomeUsuario; openModal('modalNome'); } },
        { icon: '✂', label: 'Gerenciar Serviços', sub: 'Editar cortes e preços padrão', fn: () => { import('./registrar.js').then(m => { m.renderModalCortes(); openModal('modalCortes'); }); } },
        { icon: '🎯', label: 'Metas de Faturamento', sub: 'Defina metas diária, semanal e mensal', fn: () => { abrirModalMeta(); openModal('modalMeta'); } },
        {
            icon: '◈', label: 'Chave PIX',
            sub: state.chavePix ? `Chave: ${state.chavePix}${state.chavePixTipo ? ' (' + ({ celular: 'Celular', email: 'E-mail', cpf: 'CPF', aleatoria: 'Aleatória' }[state.chavePixTipo] || state.chavePixTipo) + ')' : ''}` : 'Cadastrar chave para receber via PIX',
            fn: () => abrirModalPix()
        },
        { icon: '🔐', label: 'Alterar E-mail / Senha', sub: 'Atualizar credenciais de acesso', fn: () => { document.getElementById('cred-senha-atual').value = ''; document.getElementById('cred-novo-email').value = ''; document.getElementById('cred-nova-senha').value = ''; document.getElementById('cred-error').style.display = 'none'; openModal('modalCredenciais'); } },
        { icon: '☁', label: 'Sincronizar com a nuvem', sub: 'Salva todos os dados no Firebase agora', fn: () => window.sincronizarNuvem() },
        { icon: '🗑', label: 'Limpar todos os dados', sub: 'Remove todos os registros permanentemente', fn: () => confirmarLimpar(), danger: true },
    ];

    opcoes.forEach(item => {
        const row = div('corte-item');
        row.style.cursor = 'pointer';
        row.innerHTML = `
      <div style="width:36px;height:36px;background:var(--surface2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">${item.icon}</div>
      <div style="flex:1">
        <div style="font-size:15px${item.danger ? ';color:var(--red)' : ''}">${item.label}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${item.sub}</div>
      </div>
      <div style="color:var(--muted)">›</div>`;
        row.onclick = item.fn;
        card.appendChild(row);
    });

    // Bloco Premium
    const plano = planoAtivo();
    const diasRest = diasRestantesPremium();
    const premCard = div('');
    premCard.innerHTML = `
    <div style="background:linear-gradient(135deg,#1a1200,#201800);border:1px solid var(--gold-dim);border-radius:14px;padding:16px;margin-top:4px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="width:36px;height:36px;background:var(--gold);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">✦</div>
        <div>
          <div style="font-family:'Playfair Display',serif;font-size:15px;color:var(--gold)">${plano === 'premium' ? 'Plano Premium Ativo' : 'BarberCash Premium'}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:1px">${plano === 'premium' ? `Acesso completo · ${diasRest} dia${diasRest !== 1 ? 's' : ''} restante${diasRest !== 1 ? 's' : ''}` : `R$ ${state.adminCfg.preco || '19,90'}/mês`}</div>
        </div>
        ${plano === 'premium' ? '<span style="font-size:11px;background:rgba(76,175,120,.15);color:var(--green);border:1px solid var(--green);border-radius:6px;padding:2px 8px;margin-left:auto">Ativo</span>' : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${['Registros ilimitados', 'Múltiplos barbeiros', 'Exportar relatório PDF', 'Metas de faturamento', 'QR Code PIX automático', 'Agendamento online', 'Mensagens WhatsApp automáticas'].map(f => `<div style="display:flex;align-items:center;gap:8px;font-size:13px"><span style="color:var(--green)">✓</span>${f}</div>`).join('')}
      </div>
      ${plano !== 'premium' ? `<button onclick="abrirUpgrade()" style="margin-top:14px;width:100%;padding:13px;background:linear-gradient(135deg,var(--gold-dim),var(--gold));border:none;border-radius:12px;color:#000;font-size:14px;font-weight:700;cursor:pointer;font-family:'Playfair Display',serif;letter-spacing:1px">✦ Assinar Premium</button>` : ''}
    </div>`;
    card.appendChild(premCard);
    frag.appendChild(card);

    // Suporte WhatsApp
    const supCard = div('card');
    supCard.innerHTML = `
    <div class="card-title">Suporte</div>
    <div style="display:flex;align-items:center;gap:14px;padding:4px 0">
      <div style="width:44px;height:44px;background:#25D366;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">💬</div>
      <div style="flex:1">
        <div style="font-size:15px;font-weight:500">Falar com Suporte</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px">Tire dúvidas ou reporte problemas</div>
      </div>
    </div>
    <button onclick="window.open('https://wa.me/5527988658676?text=${encodeURIComponent('Olá! Preciso de suporte com o BarberCash.')}','_blank')"
      style="margin-top:14px;width:100%;padding:14px;background:#25D366;border:none;border-radius:12px;color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;display:flex;align-items:center;justify-content:center;gap:8px">
      <span>💬</span> Abrir WhatsApp
    </button>`;
    frag.appendChild(supCard);

    // Segurança & Acesso
    const secCard = div('card');
    secCard.innerHTML = `<div class="card-title">Segurança & Acesso</div>`;
    const autoRow = div('seguranca-opt');
    autoRow.innerHTML = `
    <div>
      <div class="seguranca-opt-label">Login automático</div>
      <div class="seguranca-opt-sub">Entrar direto sem digitar senha</div>
    </div>
    <div class="toggle-box${LS.get('bc_auto_login', true) ? ' on' : ''}" id="sec-auto-login-tog" style="cursor:pointer;flex-shrink:0" onclick="toggleAutoLoginSec()">
      <div class="toggle-knob"></div>
    </div>`;
    secCard.appendChild(autoRow);
    const sairRow = div('');
    sairRow.style.cssText = 'margin-top:14px';
    sairRow.innerHTML = `
    <button onclick="fazerLogout()" style="width:100%;padding:12px;background:rgba(224,85,85,.12);border:1px solid rgba(224,85,85,.3);border-radius:10px;color:var(--red);font-size:14px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;display:flex;align-items:center;justify-content:center;gap:8px">
      ⏻ Sair da conta
    </button>`;
    secCard.appendChild(sairRow);
    frag.appendChild(secCard);

    return frag;
}

// ── Modal Nome ────────────────────────────────────────────────────────────────
window.salvarNome = function () {
    const nome = document.getElementById('nome-input').value.trim();
    if (!nome) { showFeedback('Digite um nome!', 'erro'); return; }
    state.nomeUsuario = nome;
    const label = document.getElementById('nome-usuario-label');
    if (label) label.textContent = nome[0].toUpperCase();
    saveConfig();
    showFeedback('Nome atualizado!', 'ok');
    closeModal('modalNome');
    render();
};

// ── Modal Metas ───────────────────────────────────────────────────────────────
export function abrirModalMeta() {
    const fmt = v => v ? fmtValorInput(String(Math.round(v * 100))) : '';
    document.getElementById('meta-dia-input').value = fmt(state.metas.dia);
    document.getElementById('meta-sem-input').value = fmt(state.metas.sem);
    document.getElementById('meta-mes-input').value = fmt(state.metas.mes);
    ['meta-dia-input', 'meta-sem-input', 'meta-mes-input'].forEach(id => {
        document.getElementById(id).oninput = e => { const raw = e.target.value.replace(/\D/g, ''); e.target.value = fmtValorInput(raw); };
    });
}

window.salvarMetas = function () {
    const toNum = id => { const raw = document.getElementById(id).value.replace(/\D/g, ''); return rawToNum(raw); };
    state.metas = { dia: toNum('meta-dia-input'), sem: toNum('meta-sem-input'), mes: toNum('meta-mes-input') };
    saveConfig();
    showFeedback('Metas salvas!', 'ok');
    closeModal('modalMeta');
    render();
};

// ── Modal Barbeiros ───────────────────────────────────────────────────────────
export function renderModalBarbeiros() {
    const list = document.getElementById('barbeiros-list');
    list.innerHTML = '';
    state.barbeiros.forEach(b => {
        const item = div('barbeiro-item');
        item.onclick = () => { state.barbeiroAtual = b.id; saveConfig(); renderModalBarbeiros(); render(); };
        const avatar = div('barbeiro-avatar'); avatar.textContent = b.nome[0].toUpperCase();
        const nome = div('barbeiro-nome'); nome.textContent = b.nome;
        item.appendChild(avatar); item.appendChild(nome);
        if (b.id === state.barbeiroAtual) { const chk = document.createElement('span'); chk.className = 'barbeiro-check'; chk.textContent = '✓'; item.appendChild(chk); }
        if (b.id !== 'eu') {
            const del = document.createElement('button'); del.className = 'btn-icone'; del.style.color = 'var(--red)'; del.textContent = '🗑';
            del.onclick = e => { e.stopPropagation(); excluirBarbeiro(b.id); };
            item.appendChild(del);
        }
        list.appendChild(item);
    });

    const footer = document.getElementById('barbeiros-footer');
    if (!footer) return;
    if (isPremium()) {
        footer.innerHTML = `<div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Adicionar barbeiro</div><div class="add-row"><input class="input" id="novo-barbeiro-nome" placeholder="Nome do barbeiro" style="font-size:14px;padding:10px 12px"/><button class="btn-add" onclick="adicionarBarbeiro()">+</button></div>`;
    } else {
        footer.innerHTML = `<div style="background:rgba(201,168,76,.08);border:1px solid var(--gold-dim);border-radius:12px;padding:12px;text-align:center;font-size:12px;color:var(--muted)">✦ Múltiplos barbeiros disponível no <span style="color:var(--gold);cursor:pointer" onclick="closeModal('modalBarbeiros');abrirUpgrade()">Premium</span></div>`;
    }
}
window.renderModalBarbeiros = renderModalBarbeiros;

window.adicionarBarbeiro = function () {
    const nome = document.getElementById('novo-barbeiro-nome').value.trim();
    if (!nome) return;
    const id = 'b' + Date.now();
    state.barbeiros.push({ id, nome });
    document.getElementById('novo-barbeiro-nome').value = '';
    saveConfig();
    showFeedback('Barbeiro adicionado!', 'ok');
    renderModalBarbeiros();
};

function excluirBarbeiro(id) {
    state.barbeiros = state.barbeiros.filter(b => b.id !== id);
    if (state.barbeiroAtual === id) state.barbeiroAtual = 'eu';
    saveConfig();
    renderModalBarbeiros();
    render();
}

// ── Confirmar exclusão de registro ────────────────────────────────────────────
window.confirmarExcluir = function (id) {
    document.getElementById('confirm-title-text').textContent = 'Excluir registro?';
    document.querySelector('.confirm-sub').textContent = 'Esta ação não pode ser desfeita.';
    document.getElementById('btn-confirm-del').onclick = async () => {
        state.registros = state.registros.filter(r => r.id !== id);
        closeModal('overlayConfirm');
        showFeedback('Registro removido.', 'ok');
        render();
        await deleteRegistro(id);
    };
    openModal('overlayConfirm');
};

function confirmarLimpar() {
    document.getElementById('confirm-title-text').textContent = 'Limpar todos os dados?';
    document.querySelector('.confirm-sub').textContent = 'Esta ação não pode ser desfeita.';
    document.getElementById('btn-confirm-del').onclick = async () => {
        const ids = state.registros.map(r => r.id);
        state.registros = [];
        closeModal('overlayConfirm');
        showFeedback('Dados apagados.', 'ok');
        render();
        for (const id of ids) await deleteRegistro(id);
    };
    openModal('overlayConfirm');
}

// ── Alterar credenciais ───────────────────────────────────────────────────────
window.salvarCredenciais = async function () {
    const senhaAtual = document.getElementById('cred-senha-atual').value;
    const novoEmail = document.getElementById('cred-novo-email').value.trim();
    const novaSenha = document.getElementById('cred-nova-senha').value;
    const errEl = document.getElementById('cred-error');
    const btn = document.getElementById('btn-salvar-cred');
    errEl.style.display = 'none';
    if (!senhaAtual) { errEl.textContent = 'Informe sua senha atual.'; errEl.style.display = 'block'; return; }
    if (!novoEmail && !novaSenha) { errEl.textContent = 'Informe o novo e-mail ou a nova senha.'; errEl.style.display = 'block'; return; }
    btn.disabled = true; btn.textContent = 'Salvando...';
    try {
        const user = auth.currentUser;
        const cred = EmailAuthProvider.credential(user.email, senhaAtual);
        await reauthenticateWithCredential(user, cred);
        if (novoEmail && novoEmail !== user.email) await updateEmail(user, novoEmail);
        if (novaSenha) await updatePassword(user, novaSenha);
        showFeedback('Dados atualizados! ✓', 'ok');
        closeModal('modalCredenciais');
        document.getElementById('cred-senha-atual').value = '';
        document.getElementById('cred-novo-email').value = '';
        document.getElementById('cred-nova-senha').value = '';
        render();
    } catch (e) {
        const msgs = { 'auth/wrong-password': 'Senha atual incorreta.', 'auth/invalid-credential': 'Senha atual incorreta.', 'auth/email-already-in-use': 'E-mail já cadastrado.', 'auth/invalid-email': 'E-mail inválido.', 'auth/weak-password': 'Nova senha fraca (mín. 6 caracteres).' };
        errEl.textContent = msgs[e.code] || 'Erro: ' + e.message;
        errEl.style.display = 'block';
    }
    btn.disabled = false; btn.textContent = 'Salvar Alterações';
};

// ── Premium / Upgrade ─────────────────────────────────────────────────────────
window.abrirUpgrade = function (isRenovacao = false) {
    openModal('modalUpgrade');
    renderModalUpgrade();
    const plano = planoAtivo();
    const btnFechar = document.getElementById('btn-fechar-upgrade');
    const btnContinuar = document.getElementById('btn-continuar-trial');
    const tituloEl = document.getElementById('modal-upgrade-titulo');

    if (btnFechar) btnFechar.style.display = 'block';

    if (isRenovacao && plano === 'premium') {
        if (tituloEl) tituloEl.textContent = '✦ Renovar Premium';
        if (btnContinuar) { btnContinuar.style.display = 'block'; btnContinuar.textContent = 'Pagar depois (via Config)'; btnContinuar.onclick = () => closeModal('modalUpgrade'); }
    } else if (plano === 'premium') {
        if (tituloEl) tituloEl.textContent = '✦ BarberCash Premium';
        if (btnContinuar) btnContinuar.style.display = 'none';
    } else {
        if (tituloEl) tituloEl.textContent = '✦ BarberCash Premium';
        if (btnContinuar) { btnContinuar.style.display = 'block'; btnContinuar.textContent = 'Continuar com acesso limitado'; btnContinuar.onclick = () => closeModal('modalUpgrade'); }
    }
    const inp = document.getElementById('codigo-premium-input');
    if (inp) inp.value = '';
    const fb = document.getElementById('codigo-feedback');
    if (fb) fb.style.display = 'none';
};

window.tentarFecharUpgrade = function () { closeModal('modalUpgrade'); };

function renderModalUpgrade() {
    const cfg = state.adminCfg;
    const precoEl = document.getElementById('modal-preco');
    const suporteEl = document.getElementById('modal-suporte');
    if (precoEl) precoEl.textContent = `R$ ${cfg.preco || '19.90'}`;
    if (suporteEl) suporteEl.textContent = cfg.suporteMsg || 'Para assinar, entre em contato via WhatsApp ou Instagram';

    const pixAdmin = (cfg.pixAdmin || '').trim();
    const qrWrap = document.getElementById('modal-qr-wrap');
    const qrContainer = document.getElementById('modal-qr-container');
    const qrChave = document.getElementById('modal-qr-chave');
    if (!qrWrap || !qrContainer) return;
    if (!pixAdmin) { qrWrap.style.display = 'none'; return; }
    qrWrap.style.display = 'block';
    qrContainer.innerHTML = '';
    if (qrChave) qrChave.textContent = pixAdmin;
    const pixPayload = gerarPixPayload(pixAdmin, 0, state.nomeUsuario);
    setTimeout(() => {
        try { gerarQR(qrContainer, pixPayload, 180); }
        catch (e) { qrContainer.innerHTML = `<div style="padding:16px;font-size:12px;color:#333;text-align:center">${pixAdmin}</div>`; }
    }, 150);
}

window.abrirWhatsappComprovante = function () {
    const wa = (state.adminCfg.whatsapp || '').replace(/\D/g, '');
    if (!wa) { showFeedback('WhatsApp do admin não configurado.', 'erro'); return; }
    const nome = state.nomeUsuario || 'Usuário';
    const preco = state.adminCfg.preco || '19,90';
    const msg = encodeURIComponent(`Olá! Quero assinar o BarberCash Premium.\n\n👤 Nome: ${nome}\n💰 Valor: R$ ${preco}/mês\n\nSegue abaixo o comprovante do pagamento via PIX. Aguardo o código de ativação! 🙏`);
    window.open(`https://wa.me/${wa}?text=${msg}`, '_blank');
};

window.ativarPremium = async function () {
    const codigo = document.getElementById('codigo-premium-input').value.trim().toUpperCase();
    const fbEl = document.getElementById('codigo-feedback');
    const estilo = (ok) => `display:block;border-radius:8px;padding:8px 12px;font-size:12px;background:${ok ? 'rgba(76,175,120,.12)' : 'rgba(224,85,85,.12)'};color:${ok ? 'var(--green)' : 'var(--red)'}`;

    if (!codigo) { fbEl.textContent = 'Digite o código recebido do administrador.'; fbEl.style.cssText = estilo(false); return; }

    try {
        const codigoRef = doc(db, 'codigos', state.uid);
        const codigoDoc = await getDoc(codigoRef);
        const codigoData = codigoDoc.exists() ? codigoDoc.data() : null;

        if (!codigoData?.codigo) { fbEl.textContent = 'Nenhum código foi gerado para sua conta ainda. Entre em contato com o admin.'; fbEl.style.cssText = estilo(false); return; }
        if (codigo !== codigoData.codigo.toUpperCase()) { fbEl.textContent = 'Código inválido. Verifique com o administrador.'; fbEl.style.cssText = estilo(false); return; }
        if (codigoData.usado) { fbEl.textContent = 'Este código já foi utilizado. Solicite um novo ao administrador.'; fbEl.style.cssText = estilo(false); return; }

        const agora = Date.now();
        const expiracao = agora + (30 * 24 * 60 * 60 * 1000);
        await setDoc(codigoRef, { ...codigoData, usado: true, ativadoEm: agora }, { merge: true });
        state.plano = { tipo: 'premium', inicio: state.plano.inicio || agora, premium: true, premiumExpiracao: expiracao, codigoUsado: codigo };
        await saveConfig();

        fbEl.textContent = '✦ Premium ativado! Acesso completo liberado por 30 dias.';
        fbEl.style.cssText = estilo(true);
        showFeedback('✦ Premium ativado! Acesso liberado por 30 dias.', 'ok');

        const btnContinuar = document.getElementById('btn-continuar-trial');
        if (btnContinuar) { btnContinuar.textContent = 'Fechar'; btnContinuar.style.display = 'block'; btnContinuar.onclick = () => { closeModal('modalUpgrade'); render(); }; }
        render();
    } catch (e) {
        console.error(e);
        fbEl.textContent = 'Erro ao verificar. Tente novamente.';
        fbEl.style.cssText = `display:block;background:rgba(224,85,85,.12);color:var(--red);border-radius:8px;padding:8px 12px;font-size:12px`;
    }
};