// ─────────────────────────────────────────────────────────────────────────────
// main.js — State, Firebase, Helpers, Auth, Roteamento
// ─────────────────────────────────────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
    browserLocalPersistence,
    browserSessionPersistence,
    createUserWithEmailAndPassword,
    getAuth,
    onAuthStateChanged, setPersistence,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    orderBy, query,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Importa todas as telas ──────────────────────────────────────────────────
import {
    iniciarListenerAgendamentos,
    renderAgendamentos
} from './agenda.js';
import {
    atualizarBadgeClientes,
    renderClientes
} from './clientes.js';
import { renderConfig } from './config.js';
import { renderHistorico } from './historico.js';
import { renderHome } from './home.js';
import { renderRegistrar } from './registrar.js';
import { renderRelatorio } from './relatorio.js';
import {
    iniciarListenerVagas
} from './vagas.js';

// ── Firebase ────────────────────────────────────────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyDsx8SKvD4DzyLZdvC3me5iBx0s6_qhJc8",
    authDomain: "barbercash-f6891.firebaseapp.com",
    projectId: "barbercash-f6891",
    storageBucket: "barbercash-f6891.firebasestorage.app",
    messagingSenderId: "222760224701",
    appId: "1:222760224701:web:afa93064a97b10c28c34d4"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

// ── Helpers ─────────────────────────────────────────────────────────────────
export const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const today = () => new Date().toISOString().slice(0, 10);
export const fmtDate = iso => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
export const hora = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
export function weekRange() {
    const now = new Date(), day = now.getDay();
    const mon = new Date(now); mon.setDate(now.getDate() - ((day + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return [mon.toISOString().slice(0, 10), sun.toISOString().slice(0, 10)];
}
export function monthRange() {
    const now = new Date(), y = now.getFullYear(), m = now.getMonth();
    return [new Date(y, m, 1).toISOString().slice(0, 10), new Date(y, m + 1, 0).toISOString().slice(0, 10)];
}
export function filtrar(registros, periodo, barbeiroId) {
    let r = registros.filter(x => !barbeiroId || x.barbeiro === barbeiroId);
    if (periodo === 'hoje') return r.filter(x => x.data === today());
    if (periodo === 'semana') { const [a, b] = weekRange(); return r.filter(x => x.data >= a && x.data <= b); }
    if (periodo === 'mes') { const [a, b] = monthRange(); return r.filter(x => x.data >= a && x.data <= b); }
    return r;
}
export function fmtValorInput(raw) {
    const d = raw.replace(/\D/g, ''); if (!d) return '';
    return (parseInt(d) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function rawToNum(raw) { return raw ? parseFloat(raw) / 100 : 0; }
export const PAG_COLORS = { pix: '#5b9cf6', dinheiro: '#4caf78', cartao: '#c97de8' };
export const LS = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } },
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v))
};
export const periodoLabel = { hoje: 'Hoje', semana: 'Esta Semana', mes: 'Este Mês', tudo: 'Todo o Período' };

export function div(cls) { const el = document.createElement('div'); el.className = cls; return el; }

// ── State global ─────────────────────────────────────────────────────────────
export const state = {
    uid: null, nomeUsuario: 'Barbeiro', registros: [], chavePix: '', chavePixTipo: '',
    plano: { tipo: 'trial', inicio: null, premium: false },
    vagas: [], agendamentos: [], _unsubAgendamentos: null,
    adminCfg: {
        preco: '19.90', trialDias: 30, btnUpgrade: 'Assinar Premium',
        descPremium: 'Acesso completo a todos os recursos.',
        whatsapp: '', instagram: '',
        suporteMsg: 'Para assinar, entre em contato via WhatsApp ou Instagram',
        codigoPremium: 'BARBER2025', pixAdmin: '',
        pagamentos: {
            pix: true, dinheiro: true, cartao: true, padrao: 'pix',
            nomePix: 'Pix', nomeDinheiro: 'Dinheiro', nomeCartao: 'Cartão'
        },
    },
    notifAtiva: null,
    cortesLista: [
        { nome: 'Corte Simples', preco: 35 }, { nome: 'Degradê', preco: 45 }, { nome: 'Corte Tesoura', preco: 40 },
        { nome: 'Corte Navalhado', preco: 50 }, { nome: 'Barba Completa', preco: 30 }, { nome: 'Barba + Corte', preco: 70 },
        { nome: 'Pigmentação', preco: 80 }, { nome: 'Sobrancelha', preco: 15 }, { nome: 'Pezinho', preco: 10 }, { nome: 'Luzes', preco: 120 },
    ],
    barbeiros: [{ id: 'eu', nome: 'Eu' }], barbeiroAtual: 'eu',
    metas: { dia: 0, sem: 0, mes: 0 },
    tela: 'home', periodo: 'hoje',
    corteNome: '', precoRaw: '', gorjetaRaw: '', gorjetaOn: false, pagamento: 'pix', obs: '',
    _homeValoresVisiveis: true,
    _agendaPeriodo: 'hoje',
};

// ── Rascunho ──────────────────────────────────────────────────────────────────
export function salvarRascunho() {
    if (!state.uid) return;
    LS.set('bc_rascunho_' + state.uid, {
        corteNome: state.corteNome, precoRaw: state.precoRaw,
        gorjetaRaw: state.gorjetaRaw, gorjetaOn: state.gorjetaOn,
        pagamento: state.pagamento, obs: state.obs,
    });
}
export function carregarRascunho() {
    if (!state.uid) return;
    const r = LS.get('bc_rascunho_' + state.uid, null);
    if (!r) return;
    if (r.corteNome !== undefined) state.corteNome = r.corteNome;
    if (r.precoRaw !== undefined) state.precoRaw = r.precoRaw;
    if (r.gorjetaRaw !== undefined) state.gorjetaRaw = r.gorjetaRaw;
    if (r.gorjetaOn !== undefined) state.gorjetaOn = r.gorjetaOn;
    if (r.pagamento !== undefined) state.pagamento = r.pagamento;
    if (r.obs !== undefined) state.obs = r.obs;
}
export function limparRascunho() { if (state.uid) localStorage.removeItem('bc_rascunho_' + state.uid); }

// ── Local Storage por usuário ─────────────────────────────────────────────────
function _lkRegs(uid) { return 'bc_regs_' + uid; }
function _lkCfg(uid) { return 'bc_cfg_' + uid; }

export function salvarLocalUsuario(uid) {
    if (!uid) return;
    try {
        LS.set(_lkRegs(uid), state.registros);
        LS.set(_lkCfg(uid), {
            cortesLista: state.cortesLista, barbeiros: state.barbeiros,
            barbeiroAtual: state.barbeiroAtual, metas: state.metas,
            nomeUsuario: state.nomeUsuario, chavePix: state.chavePix,
            chavePixTipo: state.chavePixTipo, plano: state.plano
        });
    } catch (e) { console.error('salvarLocalUsuario:', e); }
}
export function carregarLocalUsuario(uid) {
    if (!uid) return;
    const cfg = LS.get(_lkCfg(uid), null);
    if (cfg) {
        if (cfg.cortesLista) state.cortesLista = cfg.cortesLista;
        if (cfg.barbeiros) state.barbeiros = cfg.barbeiros;
        if (cfg.barbeiroAtual) state.barbeiroAtual = cfg.barbeiroAtual;
        if (cfg.metas) state.metas = cfg.metas;
        if (cfg.nomeUsuario) state.nomeUsuario = cfg.nomeUsuario;
        if (cfg.chavePix) state.chavePix = cfg.chavePix;
        if (cfg.chavePixTipo) state.chavePixTipo = cfg.chavePixTipo;
        if (cfg.plano) state.plano = cfg.plano;
    }
    const regs = LS.get(_lkRegs(uid), []);
    if (regs.length > 0) state.registros = regs;
}
export function limparLocalUsuario(uid) {
    if (!uid) return;
    localStorage.removeItem(_lkRegs(uid));
    localStorage.removeItem(_lkCfg(uid));
}

// ── Firestore ─────────────────────────────────────────────────────────────────
export async function loadUserData(uid) {
    carregarLocalUsuario(uid);
    setSyncing(true);
    try {
        const cfgDoc = await getDoc(doc(db, 'users', uid, 'config', 'main'));
        if (cfgDoc.exists()) {
            const d = cfgDoc.data();
            if (d.cortesLista) state.cortesLista = d.cortesLista;
            if (d.barbeiros) state.barbeiros = d.barbeiros;
            if (d.barbeiroAtual) state.barbeiroAtual = d.barbeiroAtual;
            if (d.metas) state.metas = d.metas;
            if (d.nomeUsuario) state.nomeUsuario = d.nomeUsuario;
            if (d.chavePix) state.chavePix = d.chavePix;
            if (d.chavePixTipo) state.chavePixTipo = d.chavePixTipo;
            if (d.plano) state.plano = d.plano;
        }
        const snap = await getDocs(query(collection(db, 'users', uid, 'registros'), orderBy('createdAt', 'desc')));
        if (snap.docs.length > 0) state.registros = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        salvarLocalUsuario(uid);
    } catch (e) { console.warn('Firestore indisponível:', e.message || e); }
    setSyncing(false);
}

export function getPagConfig() {
    const p = state.adminCfg.pagamentos || {};
    return {
        pix: p.pix !== false, dinheiro: p.dinheiro !== false, cartao: p.cartao !== false,
        padrao: p.padrao || 'pix',
        nomePix: p.nomePix || 'Pix', nomeDinheiro: p.nomeDinheiro || 'Dinheiro',
        nomeCartao: (p.nomeCartao || 'Cartão').replace(/cart[aã]o?s/gi, 'Cartão'),
    };
}

export async function saveRegistro(reg) {
    if (!state.uid) return;
    salvarLocalUsuario(state.uid);
    setSyncing(true);
    try {
        const { id: _, _tempId: __, ...dados } = reg;
        const ref = await addDoc(collection(db, 'users', state.uid, 'registros'), { ...dados, createdAt: Date.now() });
        const i = state.registros.findIndex(r => r._tempId === reg._tempId);
        if (i >= 0) state.registros[i].id = ref.id;
        salvarLocalUsuario(state.uid);
    } catch (e) { console.warn('saveRegistro offline:', e.message || e); }
    setSyncing(false);
}

export async function deleteRegistro(id) {
    if (!state.uid) return;
    setSyncing(true);
    try { await deleteDoc(doc(db, 'users', state.uid, 'registros', id)); }
    catch (e) { console.warn('deleteRegistro offline:', e.message || e); }
    setSyncing(false);
}

export async function saveConfig() {
    if (!state.uid) return;
    salvarLocalUsuario(state.uid);
    try { localStorage.setItem('bc_cfg_pendente_' + state.uid, '1'); } catch (e) { }
    await _pushCortesBooking();
}

async function _pushCortesBooking() {
    if (!state.uid) return;
    const payload = {
        cortesLista: state.cortesLista, nomeUsuario: state.nomeUsuario,
        chavePix: state.chavePix, chavePixTipo: state.chavePixTipo, atualizadoEm: Date.now()
    };
    try {
        await setDoc(doc(db, 'users', state.uid, 'config', 'main'), {
            cortesLista: state.cortesLista, barbeiros: state.barbeiros,
            barbeiroAtual: state.barbeiroAtual, metas: state.metas,
            nomeUsuario: state.nomeUsuario, chavePix: state.chavePix,
            chavePixTipo: state.chavePixTipo, plano: state.plano
        });
    } catch (e) { console.warn('pushCortes config:', e.message || e); }
    try { await setDoc(doc(db, 'barbeiros', state.uid), payload); }
    catch (e) { console.warn('pushCortes barbeiros:', e.message || e); }
    try { await setDoc(doc(db, 'admin', 'config'), { cortesPublicos: state.cortesLista }, { merge: true }); }
    catch (e) { console.warn('pushCortes admin:', e.message || e); }
}

export async function loadAdminConfig() {
    try {
        const cfgDoc = await getDoc(doc(db, 'admin', 'config'));
        if (cfgDoc.exists()) {
            const d = cfgDoc.data();
            state.adminCfg = { ...state.adminCfg, ...d };
            if (d.pagamentos) state.adminCfg.pagamentos = { ...state.adminCfg.pagamentos, ...d.pagamentos };
            if (d.pixAdmin) state.adminCfg.pixAdmin = d.pixAdmin;
            const ultimaAtt = d.forcarAtualizacaoEm || 0;
            const vistoPor = LS.get('bc_att_visto', 0);
            if (ultimaAtt > vistoPor) { LS.set('bc_att_visto', ultimaAtt); setTimeout(() => window.location.reload(true), 800); return; }
        }
        const notifDoc = await getDoc(doc(db, 'admin', 'notificacao_ativa'));
        if (notifDoc.exists()) {
            const n = notifDoc.data();
            const visto = LS.get('bc_notif_visto', 0);
            if (n.criadoEm && n.criadoEm > visto) {
                const dest = n.destinatarios || 'todos';
                const plano = planoAtivo();
                if (dest === 'todos' || (dest === 'trial' && plano === 'trial') || (dest === 'premium' && plano === 'premium'))
                    state.notifAtiva = n;
            }
        }
    } catch (e) { console.error(e); }
}

// ── Plano ──────────────────────────────────────────────────────────────────
export const LIMITE_REGISTROS_FREE = 15;
export function planoAtivo() {
    if (state.plano.premium) {
        if (state.plano.premiumExpiracao && Date.now() > state.plano.premiumExpiracao) {
            state.plano.premium = false; state.plano.tipo = 'expirado'; saveConfig(); return 'expirado';
        }
        return 'premium';
    }
    return 'expirado';
}
export function diasRestantesPremium() {
    if (!state.plano.premiumExpiracao) return 0;
    return Math.max(0, Math.ceil((state.plano.premiumExpiracao - Date.now()) / (1000 * 60 * 60 * 24)));
}
export function isPremium() { return planoAtivo() === 'premium'; }

// ── UI helpers ──────────────────────────────────────────────────────────────
let fbTimer;
export function showFeedback(msg, tipo = 'ok') {
    const el = document.getElementById('feedback');
    el.textContent = msg; el.className = `feedback show ${tipo}`;
    clearTimeout(fbTimer); fbTimer = setTimeout(() => el.className = 'feedback', 2500);
}
export function openModal(id) { document.getElementById(id).classList.add('show'); }
export function closeModal(id) { document.getElementById(id).classList.remove('show'); }
export function setSyncing(v) { const dot = document.getElementById('sync-dot'); if (dot) dot.className = 'sync-dot' + (v ? ' syncing' : ''); }
window.openModal = openModal; window.closeModal = closeModal;

// ── Render principal ──────────────────────────────────────────────────────
export function render() {
    const el = document.getElementById('body-content'); if (!el) return;
    el.innerHTML = '';
    if (state.tela === 'home') el.appendChild(renderHome());
    if (state.tela === 'clientes') el.appendChild(renderClientes());
    if (state.tela === 'registrar') el.appendChild(renderRegistrar());
    if (state.tela === 'agendamentos') el.appendChild(renderAgendamentos());
    if (state.tela === 'historico') el.appendChild(renderHistorico());
    if (state.tela === 'relatorio') el.appendChild(renderRelatorio());
    if (state.tela === 'config') el.appendChild(renderConfig());
    el.classList.remove('fade-in'); void el.offsetWidth; el.classList.add('fade-in');
}

export function irTela(tela, btn) {
    state.tela = tela;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const fab = document.getElementById('fab-registrar');
    if (fab) fab.style.display = (tela === 'home') ? 'flex' : 'none';
    render();
}
window.irTela = irTela;

export function getBarb() { return state.barbeiros.find(b => b.id === state.barbeiroAtual) || state.barbeiros[0]; }
export function renderPeriodoRow() {
    const row = div('periodo-row');
    [['hoje', 'Hoje'], ['semana', 'Semana'], ['mes', 'Mês'], ['tudo', 'Tudo']].forEach(([k, l]) => {
        const btn = document.createElement('button');
        btn.className = 'periodo-btn' + (state.periodo === k ? ' active' : '');
        btn.textContent = l; btn.onclick = () => { state.periodo = k; render(); };
        row.appendChild(btn);
    }); return row;
}

// ── Loading / Login / App shells ─────────────────────────────────────────────
function renderLoading() {
    document.getElementById('root-content').innerHTML = `<div class="loading-screen"><div class="loading-spinner"></div><div style="color:var(--muted);font-size:14px">Carregando...</div></div>`;
}
function renderLogin(successMsg = '') {
    document.getElementById('root-content').innerHTML = `
  <div class="login-screen" style="width:100%">
    <div class="login-logo">
      <div class="login-logo-icon">✂</div>
      <div class="login-title">BarberCash</div>
      <div class="login-sub">Controle de Caixa</div>
    </div>
    <div class="login-card">
      <div class="login-tabs">
        <button class="login-tab active" id="tab-entrar" onclick="switchTab('entrar')">Entrar</button>
        <button class="login-tab" id="tab-cadastrar" onclick="switchTab('cadastrar')">Criar conta</button>
      </div>
      <input class="input" id="auth-email" type="email" placeholder="E-mail" autocomplete="email"/>
      <div class="pass-wrap">
        <input class="input" id="auth-senha" type="password" placeholder="Senha" autocomplete="current-password"/>
        <button class="pass-eye" onclick="toggleSenha('auth-senha',this)" type="button">${eyeOpen}</button>
      </div>
      <div id="auth-nome-wrap" style="display:none">
        <input class="input" id="auth-nome" placeholder="Seu nome"/>
      </div>
      ${successMsg ? `<div class="login-success">${successMsg}</div>` : ''}
      <div id="auth-error" style="display:none" class="login-error"></div>
      <button class="btn-primary" id="btn-auth" onclick="handleAuth()">Entrar</button>
    </div>
  </div>`;
}
function renderApp() {
    document.getElementById('root-content').innerHTML = `
  <div class="app-logado">
    <div class="header">
      <div class="header-logo">
        <div class="logo-icon">✂</div>
        <div>
          <div class="logo-title">BarberCash</div>
          <div class="logo-sub">Painel do negócio</div>
        </div>
      </div>
      <div class="header-right">
        <div id="sync-dot" class="sync-dot"></div>
        <button class="user-badge" onclick="openModal('modalBarbeiros')">
          <span id="nome-usuario-label">${(state.nomeUsuario || 'B')[0].toUpperCase()}</span>
        </button>
      </div>
    </div>
    <div class="body" id="body-content"></div>
    <nav class="nav">
      <button class="nav-btn active" id="nav-home" onclick="irTela('home',this)"><span class="nav-icon">🏠</span>Home</button>
      <button class="nav-btn" id="nav-clientes" onclick="irTela('clientes',this)" style="position:relative"><span class="nav-icon">👤</span>Clientes<span id="nav-clientes-badge" style="display:none;position:absolute;top:6px;right:calc(50% - 18px);width:16px;height:16px;background:var(--red);border-radius:50%;font-size:9px;font-weight:700;color:#fff;align-items:center;justify-content:center"></span></button>
      <button class="nav-btn" id="nav-agendamentos" onclick="irTela('agendamentos',this)"><span class="nav-icon">📅</span>Agenda</button>
      <button class="nav-btn" id="nav-historico" onclick="irTela('historico',this)"><span class="nav-icon">💰</span>Financeiro</button>
      <button class="nav-btn" id="nav-config" onclick="irTela('config',this)"><span class="nav-icon">⚙️</span>Config</button>
    </nav>
    <button class="fab-home" id="fab-registrar" onclick="abrirModalRegistrar()">+</button>
  </div>`;
    state.tela = 'home';
    render();
    atualizarBadgeClientes();
}

const eyeOpen = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const eyeClosed = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

window.toggleSenha = function (inputId, btn) {
    const inp = document.getElementById(inputId);
    if (inp.type === 'password') { inp.type = 'text'; btn.innerHTML = eyeClosed; }
    else { inp.type = 'password'; btn.innerHTML = eyeOpen; }
};

let authMode = 'entrar';
window.switchTab = function (mode) {
    authMode = mode;
    document.getElementById('tab-entrar').className = 'login-tab' + (mode === 'entrar' ? ' active' : '');
    document.getElementById('tab-cadastrar').className = 'login-tab' + (mode === 'cadastrar' ? ' active' : '');
    document.getElementById('auth-nome-wrap').style.display = mode === 'cadastrar' ? 'block' : 'none';
    document.getElementById('btn-auth').textContent = mode === 'entrar' ? 'Entrar' : 'Criar conta';
    document.getElementById('auth-error').style.display = 'none';
};

window.handleAuth = async function () {
    const email = document.getElementById('auth-email').value.trim();
    const senha = document.getElementById('auth-senha').value;
    const errEl = document.getElementById('auth-error');
    const btn = document.getElementById('btn-auth');
    if (!email || !senha) { errEl.textContent = 'Preencha e-mail e senha.'; errEl.style.display = 'block'; return; }
    btn.disabled = true; btn.textContent = 'Aguarde...';
    try {
        if (authMode === 'cadastrar') {
            const nome = document.getElementById('auth-nome')?.value.trim() || 'Barbeiro';
            const cred = await createUserWithEmailAndPassword(auth, email, senha);
            await setDoc(doc(db, 'users', cred.user.uid, 'config', 'main'), {
                cortesLista: state.cortesLista, barbeiros: [{ id: 'eu', nome }], barbeiroAtual: 'eu',
                metas: { dia: 0, sem: 0, mes: 0 }, nomeUsuario: nome, chavePix: '',
                plano: { tipo: 'trial', inicio: Date.now(), premium: false }
            });
            await signOut(auth);
            authMode = 'entrar';
            renderLogin('✓ Conta criada! Faça login com seu e-mail e senha.');
        } else {
            const autoLogin = LS.get('bc_auto_login', true);
            await setPersistence(auth, autoLogin ? browserLocalPersistence : browserSessionPersistence);
            await signInWithEmailAndPassword(auth, email, senha);
        }
    } catch (e) {
        const msgs = {
            'auth/invalid-email': 'E-mail inválido.', 'auth/user-not-found': 'Usuário não encontrado.',
            'auth/wrong-password': 'Senha incorreta.', 'auth/email-already-in-use': 'E-mail já cadastrado.',
            'auth/weak-password': 'Senha fraca (mín. 6 caracteres).', 'auth/invalid-credential': 'E-mail ou senha incorretos.',
            'auth/too-many-requests': 'Muitas tentativas. Aguarde.', 'auth/network-request-failed': 'Erro de conexão.',
        };
        errEl.textContent = msgs[e.code] || ('Erro: ' + e.message); errEl.style.display = 'block';
        btn.disabled = false; btn.textContent = authMode === 'entrar' ? 'Entrar' : 'Criar conta';
    }
};

// ── Reset state ──────────────────────────────────────────────────────────────
function resetState() {
    if (state._unsubAgendamentos) { state._unsubAgendamentos(); state._unsubAgendamentos = null; }
    Object.assign(state, {
        uid: null, nomeUsuario: 'Barbeiro', registros: [], chavePix: '', chavePixTipo: '',
        plano: { tipo: 'trial', inicio: null, premium: false }, vagas: [], agendamentos: [],
        _unsubAgendamentos: null, notifAtiva: null,
        cortesLista: [
            { nome: 'Corte Simples', preco: 35 }, { nome: 'Degradê', preco: 45 }, { nome: 'Corte Tesoura', preco: 40 },
            { nome: 'Corte Navalhado', preco: 50 }, { nome: 'Barba Completa', preco: 30 }, { nome: 'Barba + Corte', preco: 70 },
            { nome: 'Pigmentação', preco: 80 }, { nome: 'Sobrancelha', preco: 15 }, { nome: 'Pezinho', preco: 10 }, { nome: 'Luzes', preco: 120 },
        ],
        barbeiros: [{ id: 'eu', nome: 'Eu' }], barbeiroAtual: 'eu',
        metas: { dia: 0, sem: 0, mes: 0 }, tela: 'home', periodo: 'hoje',
        corteNome: '', precoRaw: '', gorjetaRaw: '', gorjetaOn: false, pagamento: 'pix', obs: '',
        adminCfg: {
            preco: '19.90', trialDias: 30, btnUpgrade: 'Assinar Premium',
            descPremium: 'Acesso completo a todos os recursos.',
            whatsapp: '', instagram: '', suporteMsg: 'Para assinar, entre em contato via WhatsApp ou Instagram',
            codigoPremium: 'BARBER2025', pixAdmin: '',
            pagamentos: { pix: true, dinheiro: true, cartao: true, padrao: 'pix', nomePix: 'Pix', nomeDinheiro: 'Dinheiro', nomeCartao: 'Cartão' },
        },
    });
}

// ── Auth state ────────────────────────────────────────────────────────────────
let _uidAtual = null;
renderLoading();
setPersistence(auth, browserLocalPersistence).catch(() => { });
onAuthStateChanged(auth, async user => {
    if (user) {
        if (_uidAtual && _uidAtual !== user.uid) resetState();
        try { await user.getIdToken(true); }
        catch (e) { resetState(); await signOut(auth); _uidAtual = null; renderLogin(); return; }
        _uidAtual = user.uid; state.uid = user.uid;
        renderLoading();
        await Promise.all([loadUserData(user.uid), loadAdminConfig()]);
        carregarRascunho();
        if (!state.corteNome) state.pagamento = getPagConfig().padrao;
        iniciarListenerAgendamentos();
        iniciarListenerVagas();
        renderApp();
        if (state.notifAtiva) setTimeout(() => mostrarNotifAdmin(state.notifAtiva), 1000);
    } else {
        resetState(); _uidAtual = null; renderLogin();
    }
});

window.fazerLogout = async function () { await signOut(auth); };

window.toggleAutoLogin = function () {
    const novoVal = !LS.get('bc_auto_login', true); LS.set('bc_auto_login', novoVal);
    const tog = document.getElementById('auto-login-tog');
    if (tog) tog.className = 'toggle-box' + (novoVal ? ' on' : '');
    showFeedback(novoVal ? 'Login automático ativado.' : 'Login automático desativado.', 'ok');
};
window.toggleAutoLoginSec = function () {
    const novoVal = !LS.get('bc_auto_login', true); LS.set('bc_auto_login', novoVal);
    const tog = document.getElementById('sec-auto-login-tog');
    if (tog) tog.className = 'toggle-box' + (novoVal ? ' on' : '');
    showFeedback(novoVal ? 'Login automático ativado.' : 'Login automático desativado.', 'ok');
};

function mostrarNotifAdmin(n) {
    const tipoIcons = { info: 'ℹ️', ok: '✅', aviso: '⚠️', promo: '🎁' };
    const el = document.getElementById('feedback'); if (!el) return;
    el.textContent = `${tipoIcons[n.tipo] || '📢'} ${n.titulo}: ${n.mensagem}`;
    el.className = 'feedback show ok';
    el.style.maxWidth = '320px'; el.style.whiteSpace = 'normal';
    el.style.textAlign = 'center'; el.style.top = '20px'; el.style.fontSize = '12px';
    setTimeout(() => { el.className = 'feedback'; el.style = ''; }, 6000);
    LS.set('bc_notif_visto', n.criadoEm || Date.now());
}

// Expõe funções necessárias para os modais inline do HTML
window.abrirModalRegistrar = function () {
    state.tela = 'registrar';
    const el = document.getElementById('body-content'); if (!el) return;
    el.innerHTML = '';
    const voltar = div(''); voltar.style.cssText = 'margin-bottom:12px';
    const btnV = document.createElement('button');
    btnV.style.cssText = 'background:none;border:none;color:var(--muted);font-size:13px;cursor:pointer;font-family:"DM Sans",sans-serif;display:flex;align-items:center;gap:6px;padding:0';
    btnV.innerHTML = '← Voltar ao painel';
    btnV.onclick = () => irTela('home', document.getElementById('nav-home'));
    voltar.appendChild(btnV); el.appendChild(voltar);
    el.appendChild(renderRegistrar());
    el.classList.remove('fade-in'); void el.offsetWidth; el.classList.add('fade-in');
    const fab = document.getElementById('fab-registrar'); if (fab) fab.style.display = 'none';
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
};

window.sincronizarNuvem = async function () {
    if (!state.uid) { showFeedback('Faça login primeiro.', 'erro'); return; }
    setSyncing(true); showFeedback('Sincronizando...', 'ok');
    try {
        const pendentes = state.registros.filter(r => r.id && r.id.startsWith('t'));
        const cfgPendente = localStorage.getItem('bc_cfg_pendente_' + state.uid) === '1';
        if (cfgPendente) {
            await setDoc(doc(db, 'users', state.uid, 'config', 'main'), {
                cortesLista: state.cortesLista, barbeiros: state.barbeiros, barbeiroAtual: state.barbeiroAtual,
                metas: state.metas, nomeUsuario: state.nomeUsuario, chavePix: state.chavePix,
                chavePixTipo: state.chavePixTipo, plano: state.plano
            });
            try { await setDoc(doc(db, 'admin', 'config'), { cortesPublicos: state.cortesLista }, { merge: true }); } catch (e2) { }
            localStorage.removeItem('bc_cfg_pendente_' + state.uid);
        }
        let enviados = 0;
        for (const reg of pendentes) {
            try {
                const { id, _tempId, ...dados } = reg;
                const ref = await addDoc(collection(db, 'users', state.uid, 'registros'), { ...dados, createdAt: dados.createdAt || Date.now() });
                reg.id = ref.id; delete reg._tempId; enviados++;
            } catch (err) { console.warn(err); }
        }
        const snap = await getDocs(query(collection(db, 'users', state.uid, 'registros'), orderBy('createdAt', 'desc')));
        if (snap.docs.length > 0) state.registros = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        salvarLocalUsuario(state.uid);
        setSyncing(false);
        showFeedback(enviados > 0 ? `✓ ${enviados} registro(s) enviado(s)!` : '✓ Dados sincronizados!', 'ok');
        render();
    } catch (e) { setSyncing(false); showFeedback('Erro: ' + (e.message || 'verifique sua conexão.'), 'erro'); }
};