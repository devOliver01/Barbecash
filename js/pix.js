// ─────────────────────────────────────────────────────────────────────────────
// pix.js — Geração de payload PIX (EMV/BACEN), QR Code e helpers de chave
// ─────────────────────────────────────────────────────────────────────────────
import { showFeedback, state } from './main.js';

// ── Payload PIX (EMV/BACEN) ───────────────────────────────────────────────────
export function gerarPixPayload(chave, valor, nomeBarbeiro) {
    chave = (chave || '').trim();
    const tipo = state.chavePixTipo || '';

    if (tipo === 'celular') {
        const nums = chave.replace(/\D/g, '');
        chave = !chave.startsWith('+') ? '+55' + nums.replace(/^55/, '') : '+' + nums;
    } else if (tipo === 'cpf') {
        chave = chave.replace(/\D/g, '');
    } else if (tipo === 'email') {
        chave = chave.toLowerCase();
    } else {
        // Fallback: detecção automática (compatibilidade com dados antigos)
        if (/^\+?[0-9]{10,13}$/.test(chave.replace(/[\s\-\(\)]/g, ''))) {
            const tel = chave.replace(/[\s\-\(\)]/g, '').replace(/^0/, '');
            chave = !tel.startsWith('+') ? '+55' + tel.replace(/^55/, '') : tel;
        } else if (/^\d{3}[\.\s]?\d{3}[\.\s]?\d{3}[\-\s]?\d{2}$/.test(chave)) {
            chave = chave.replace(/[\.\-\s]/g, '');
        } else if (/^\d{2}[\.\s]?\d{3}[\.\s]?\d{3}[\/\s]?\d{4}[\-\s]?\d{2}$/.test(chave)) {
            chave = chave.replace(/[\.\-\/\s]/g, '');
        }
    }

    const nomeRaw = (nomeBarbeiro || state.nomeUsuario || 'Barbeiro');
    const nomeAscii = nomeRaw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 ]/g, '').trim();
    const nome = (nomeAscii || 'Barbeiro').substring(0, 25);
    const cidade = 'SAO PAULO'.substring(0, 15);

    function lv(id, val) {
        const s = String(val);
        const l = String(s.length).padStart(2, '0');
        return id + l + s;
    }

    const merchantAccInfo = lv('00', 'BR.GOV.BCB.PIX') + lv('01', chave);
    const additionalData = lv('05', '***');

    const parts = [
        '000201',
        lv('26', merchantAccInfo),
        '52040000',
        '5303986',
    ];
    if (valor && valor > 0) parts.push(lv('54', valor.toFixed(2)));
    parts.push('5802BR');
    parts.push(lv('59', nome));
    parts.push(lv('60', cidade));
    parts.push(lv('62', additionalData));
    parts.push('6304');

    const body = parts.join('');
    let crc = 0xFFFF;
    for (let i = 0; i < body.length; i++) {
        crc ^= body.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : (crc << 1);
        crc &= 0xFFFF;
    }
    return body + crc.toString(16).toUpperCase().padStart(4, '0');
}

// ── QR Code (canvas nativo, sem API externa) ──────────────────────────────────
export function gerarQR(container, texto, sizePx) {
    container.innerHTML = '';
    try {
        const qr = qrcode(0, 'M');
        qr.addData(texto, 'Byte');
        qr.make();
        const modules = qr.getModuleCount();
        const cell = Math.floor(sizePx / modules);
        const total = cell * modules;
        const canvas = document.createElement('canvas');
        canvas.width = total; canvas.height = total;
        canvas.style.cssText = `width:${total}px;height:${total}px;border-radius:6px;display:block`;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, total, total);
        ctx.fillStyle = '#000000';
        for (let r = 0; r < modules; r++)
            for (let c = 0; c < modules; c++)
                if (qr.isDark(r, c)) ctx.fillRect(c * cell, r * cell, cell, cell);
        container.appendChild(canvas);
    } catch (e) {
        console.error('QR:', e);
        container.innerHTML = `<div style="padding:10px;font-size:11px;color:#333;text-align:center;word-break:break-all;background:#fff;border-radius:8px">${texto}</div>`;
    }
}

// ── QR PIX na tela de registrar ───────────────────────────────────────────────
export function renderQrPix() {
    const wrap = document.getElementById('qr-pix-wrap');
    if (!wrap) return;
    if (state.pagamento !== 'pix' || !state.chavePix) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    const chaveEl = document.getElementById('qr-chave');
    if (chaveEl) chaveEl.textContent = state.chavePix;
    const container = document.getElementById('qr-canvas-container');
    if (!container) return;
    try {
        const payload = gerarPixPayload(state.chavePix, 0, state.nomeUsuario);
        gerarQR(container, payload, 160);
    } catch (e) { gerarQR(container, state.chavePix, 160); }
}
window.renderQrPix = renderQrPix;

// ── QR PIX no modal de registrar agendamento (mra) ────────────────────────────
export function renderMraQrPix(pagamento) {
    const wrap = document.getElementById('mra-qr-wrap');
    if (!wrap) return;
    if (pagamento !== 'pix' || !state.chavePix) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    const chaveEl = document.getElementById('mra-qr-chave');
    if (chaveEl) chaveEl.textContent = state.chavePix;
    const container = document.getElementById('mra-qr-container');
    if (!container) return;
    try {
        const payload = gerarPixPayload(state.chavePix, 0, state.nomeUsuario);
        gerarQR(container, payload, 150);
    } catch (e) { gerarQR(container, state.chavePix, 150); }
}

// ── Copiar chave PIX do barbeiro ──────────────────────────────────────────────
window.copiarPixBarbeiro = function () {
    const chave = (state.chavePix || '').trim();
    if (!chave) { showFeedback('Nenhuma chave PIX cadastrada.', 'erro'); return; }
    navigator.clipboard.writeText(chave)
        .then(() => showFeedback('Chave PIX copiada!', 'ok'))
        .catch(() => showFeedback('Chave: ' + chave, 'ok'));
};

// ── Copiar chave PIX do admin (modal upgrade) ─────────────────────────────────
window.copiarChavePix = function () {
    const chave = (state.adminCfg.pixAdmin || '').trim();
    if (!chave) return;
    navigator.clipboard.writeText(chave)
        .then(() => showFeedback('Chave copiada!', 'ok'))
        .catch(() => showFeedback('Copie: ' + chave, 'ok'));
};

// ── Selecionar tipo de chave PIX no modal ─────────────────────────────────────
let _pixTipoAtual = '';

window.selecionarTipoPix = function (tipo, btn) {
    _pixTipoAtual = tipo;
    document.querySelectorAll('#pix-tipo-tabs .pag-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const inp = document.getElementById('pix-key-input');
    const label = document.getElementById('pix-key-label');
    const hint = document.getElementById('pix-key-hint');
    const errEl = document.getElementById('pix-key-error');
    if (errEl) errEl.style.display = 'none';
    const hints = {
        celular: 'Ex: 11999998888 (somente números, com DDD)',
        email: 'Ex: seuemail@gmail.com',
        cpf: 'Ex: 123.456.789-00 (somente números também aceito)',
        aleatoria: 'Cole aqui a chave aleatória gerada pelo seu banco',
    };
    const labels = { celular: 'Número de celular (com DDD)', email: 'E-mail', cpf: 'CPF', aleatoria: 'Chave aleatória' };
    const inputmodes = { celular: 'numeric', email: 'email', cpf: 'numeric', aleatoria: 'text' };
    if (label) label.textContent = labels[tipo] || 'Sua chave PIX';
    if (hint) hint.textContent = hints[tipo] || '';
    if (inp) { inp.placeholder = hints[tipo] || ''; inp.inputMode = inputmodes[tipo] || 'text'; inp.value = ''; inp.focus(); }
};

// ── Salvar chave PIX ──────────────────────────────────────────────────────────
import { saveConfig } from './main.js';

window.salvarChavePix = function () {
    const chave = document.getElementById('pix-key-input').value.trim();
    const errEl = document.getElementById('pix-key-error');
    if (errEl) errEl.style.display = 'none';

    if (!_pixTipoAtual) {
        if (errEl) { errEl.textContent = 'Selecione o tipo de chave PIX.'; errEl.style.display = 'block'; }
        return;
    }
    if (!chave) {
        if (errEl) { errEl.textContent = 'Digite sua chave PIX.'; errEl.style.display = 'block'; }
        return;
    }

    let chaveNorm = chave;
    if (_pixTipoAtual === 'celular') {
        const nums = chave.replace(/\D/g, '');
        if (nums.length < 10 || nums.length > 13) {
            if (errEl) { errEl.textContent = 'Celular inválido. Use DDD + número (ex: 11999998888).'; errEl.style.display = 'block'; }
            return;
        }
        chaveNorm = nums;
    } else if (_pixTipoAtual === 'email') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(chave)) {
            if (errEl) { errEl.textContent = 'E-mail inválido.'; errEl.style.display = 'block'; }
            return;
        }
        chaveNorm = chave.toLowerCase();
    } else if (_pixTipoAtual === 'cpf') {
        const nums = chave.replace(/\D/g, '');
        if (nums.length !== 11) {
            if (errEl) { errEl.textContent = 'CPF inválido. Deve ter 11 dígitos.'; errEl.style.display = 'block'; }
            return;
        }
        chaveNorm = nums;
    } else if (_pixTipoAtual === 'aleatoria') {
        if (chave.length < 10) {
            if (errEl) { errEl.textContent = 'Chave aleatória parece muito curta.'; errEl.style.display = 'block'; }
            return;
        }
        chaveNorm = chave;
    }

    state.chavePix = chaveNorm;
    state.chavePixTipo = _pixTipoAtual;
    saveConfig();
    showFeedback(chaveNorm ? 'Chave PIX salva! ✓' : 'Chave PIX removida.', 'ok');
    const { closeModal, render } = window._bc || {};
    document.getElementById('modalPix')?.classList.remove('show');
    import('./main.js').then(m => m.render());
};

// ── Expõe para abrir o modal de chave PIX a partir do config ─────────────────
export function abrirModalPix() {
    document.getElementById('pix-key-input').value = state.chavePix || '';
    document.getElementById('pix-key-error').style.display = 'none';
    _pixTipoAtual = state.chavePixTipo || '';
    document.querySelectorAll('#pix-tipo-tabs .pag-tab').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-tipo') === _pixTipoAtual);
    });
    const hints = { celular: 'Ex: 11999998888 (somente números, com DDD)', email: 'Ex: seuemail@gmail.com', cpf: 'Ex: 123.456.789-00', aleatoria: 'Cole aqui a chave aleatória gerada pelo seu banco' };
    const labels = { celular: 'Número de celular (com DDD)', email: 'E-mail', cpf: 'CPF', aleatoria: 'Chave aleatória' };
    if (state.chavePixTipo) {
        const el = document.getElementById('pix-key-label'); if (el) el.textContent = labels[state.chavePixTipo] || 'Sua chave PIX';
        const h = document.getElementById('pix-key-hint'); if (h) h.textContent = hints[state.chavePixTipo] || '';
    }
    import('./main.js').then(m => m.openModal('modalPix'));
}