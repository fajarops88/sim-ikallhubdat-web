/**
 * ============================================================
 * SIM IKALLHUBDAT — Frontend JavaScript (SPA murni, aman untuk iframe)
 * ============================================================
 */

// ── State Aplikasi (di memori, TIDAK PERNAH di URL) ──
const AppState = {
  currentPage: null,
  sessionToken: localStorage.getItem('sim_ikallhubdat_token') || sessionStorage.getItem('sim_ikallhubdat_token') || null,
  userRole: null,
  userEmail: null,
  idRecord: null,
  profil: null,
  cacheAnggota: null
};

const ORG_NAME = 'IKALLHUBDAT DPD Kalimantan Timur';
const STATUS_KEPEGAWAIAN_OPTS = ['PNS', 'P3K Penuh Waktu', 'P3K Paruh Waktu', 'Non PNS', 'Pensiun'];
const PRODI_OPTS = [
  ['D3-LLAJ', 'D3 LLAJ'],
  ['D3-LLASDP', 'D3 LLASDP'],
  ['D4-TRANSDAR', 'D4 Transdar'],
  ['D3-MTJ', 'D3 MTJ'],
  ['D3-MTP', 'D3 MTP'],
  ['D4-RSTJ', 'D4 RSTJ'],
  ['D3-TKO', 'D3 TKO'],
  ['D2-PKB', 'D2 PKB']
];

const MENU_PENGURUS = [
  { id: 'dasbor-pengurus', icon: 'space_dashboard', label: 'Dasbor Pengurus' },
  { id: 'verifikasi-pendaftaran', icon: 'how_to_reg', label: 'Verifikasi Pendaftaran', badgeKey: 'menunggu' },
  { id: 'verifikasi-perubahan-data', icon: 'sync_alt', label: 'Verifikasi Perubahan Data', badgeKey: 'perubahan' },
  { id: 'data-alumni', icon: 'groups', label: 'Data Alumni' },
  { id: 'impor-excel', icon: 'upload_file', label: 'Impor Excel' },
  { id: 'kartu-digital-alumni', icon: 'badge', label: 'Kartu Digital Alumni' },
  { id: 'rekap-dan-laporan', icon: 'analytics', label: 'Rekap & Laporan' },
  { id: 'kelola-beranda', icon: 'home', label: 'Kelola Beranda' },
  { id: 'pengaturan-organisasi', icon: 'admin_panel_settings', label: 'Pengaturan Organisasi' },
  { id: 'log-aktivitas', icon: 'history', label: 'Log Aktivitas' }
];
const MENU_ANGGOTA = [
  { id: 'dasbor-anggota', icon: 'dashboard', label: 'Beranda' },
  { id: 'profil-saya', icon: 'person', label: 'Profil Saya' },
  { id: 'keamanan-akun', icon: 'lock', label: 'Keamanan Akun' }
];

// Parameter URL yang diizinkan hanya untuk bootstrap awal (bukan routing antar halaman):
//   ?reset=<token>        → tautan atur ulang kata sandi dari email
//   ?verifikasi=<id>      → tautan QR pada kartu digital
function bacaParameterUrl() {
  const p = new URLSearchParams(window.location.search);
  window.__RESET_TOKEN__ = p.get('reset') || '';
  window.__VERIFY_ID__ = p.get('verifikasi') || '';
  // Bersihkan token dari address bar agar tidak tertinggal di riwayat/bookmark.
  if ((window.__RESET_TOKEN__ || window.__VERIFY_ID__) && window.history && history.replaceState) {
    history.replaceState(null, '', window.location.pathname);
  }
}

// Logo organisasi (diunggah di Pengaturan Organisasi) diambil dari API. Disimpan di
// localStorage agar kunjungan berikutnya langsung tampil tanpa menunggu server.
function muatBootstrap() {
  let cached = '';
  try { cached = localStorage.getItem('sim_logo_url') || ''; } catch (e) {}
  window.__LOGO_URL__ = cached;
  const ambil = callApi('getBootstrap', []).then(res => {
    if (res && res.success && res.data) {
      window.__LOGO_URL__ = res.data.logoUrl || '';
      try { localStorage.setItem('sim_logo_url', window.__LOGO_URL__); } catch (e) {}
    }
  }).catch(() => {});
  // Ada cache → jangan tunggu server (render segera; logo terbaru dipakai di kunjungan berikutnya).
  if (cached) return Promise.resolve();
  return Promise.race([ambil, new Promise(r => setTimeout(r, 6000))]);
}

document.addEventListener('DOMContentLoaded', async () => {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);

  bacaParameterUrl();
  await muatBootstrap();

  if (window.__VERIFY_ID__) {
    hideLoadingOverlay();
    navigateTo('verifikasi-kartu', { noHistory: true, pageData: { verifId: window.__VERIFY_ID__ } });
    return;
  }

  if (window.__RESET_TOKEN__) {
    hideLoadingOverlay();
    navigateTo('reset-sandi', { noHistory: true, pageData: { resetToken: window.__RESET_TOKEN__ } });
    return;
  }

  if (AppState.sessionToken) {
    gsrun({
      success: res => {
        hideLoadingOverlay();
        if (res.success) {
          AppState.userRole = res.data.peran;
          AppState.userEmail = res.data.email;
          AppState.idRecord = res.data.idRecord;
          renderNavigation(res.data.peran);
          navigateTo(res.data.peran === 'Pengurus' ? 'dasbor-pengurus' : 'dasbor-anggota', { noHistory: true });
        } else {
          localStorage.removeItem('sim_ikallhubdat_token');
          navigateTo('beranda', { noHistory: true });
        }
      },
      fail: () => { hideLoadingOverlay(); navigateTo('beranda', { noHistory: true }); }
    }).cekSesi(AppState.sessionToken);
  } else {
    hideLoadingOverlay();
    navigateTo('beranda', { noHistory: true });
  }
});

function hideLoadingOverlay() {
  const el = document.getElementById('loadingOverlay');
  if (el) { el.style.opacity = '0'; setTimeout(() => el.style.display = 'none', 250); }
}

// ════════════════════════════════════════════════════════
// ROUTER SPA
// ════════════════════════════════════════════════════════
function navigateTo(pageName, options) {
  options = options || {};
  AppState.currentPage = pageName;
  const container = document.getElementById('app-container');
  container.innerHTML = '<div class="page-loading"><div class="app-spinner" style="border-top-color:#0B2A5B"></div></div>';
  updateActiveNav(pageName);
  closeMobileMenu();
  closeBerandaMobileMenu();

  try {
    renderPage(pageName, options.pageData || {});
  } catch (e) {
    showToast('Error', 'Gagal memuat halaman: ' + e.message, 'danger');
  }
  container.scrollTop = 0;
  window.scrollTo(0, 0);
}

function renderPage(pageName, pageData) {
  switch (pageName) {
    case 'beranda': return pageBeranda();
    case 'profil-sejarah': return pageProfilSejarah();
    case 'profil-struktur': return pageProfilStruktur();
    case 'berita': return pageBerita();
    case 'galeri': return pageGaleri();
    case 'kontak': return pageKontak();
    case 'kelola-beranda': return pageKelolaBeranda();
    case 'login': return pageLogin();
    case 'daftar': return pageDaftar();
    case 'cari-data-saya': return pageCariDataSaya();
    case 'lupa-sandi': return pageLupaSandi();
    case 'reset-sandi': return pageResetSandi(pageData.resetToken);
    case 'dasbor-pengurus': return pageDasborPengurus();
    case 'verifikasi-pendaftaran': return pageVerifikasi();
    case 'verifikasi-perubahan-data': return pageVerifikasiPerubahan();
    case 'verifikasi-kartu': return pageVerifikasiKartu(pageData.verifId);
    case 'data-alumni': return pageDataAlumni();
    case 'impor-excel': return pageImporExcel();
    case 'kartu-digital-alumni': return pageKartuDigital();
    case 'rekap-dan-laporan': return pageRekap();
    case 'pengaturan-organisasi': return pagePengaturan();
    case 'log-aktivitas': return pageLogAktivitas();
    case 'dasbor-anggota': return pageDasborAnggota();
    case 'profil-saya': return pageProfilSaya();
    case 'keamanan-akun': return pageKeamananAkun();
    default: return pageNotFound(pageName);
  }
}

function pageNotFound(name) {
  setContainer('<div class="card card-pad text-center py-10"><p class="text-ink-soft">Halaman "' + escapeHtml(name) + '" tidak ditemukan.</p></div>');
}

function setContainer(html) {
  document.getElementById('app-container').innerHTML = html;
}

function requireLogin(pageOnFail) {
  if (!AppState.sessionToken) { navigateTo(pageOnFail || 'login', { noHistory: true }); return false; }
  return true;
}

// ════════════════════════════════════════════════════════
// NAVIGASI DINAMIS (topbar horizontal)
// ════════════════════════════════════════════════════════
// Menu yang langsung tampil di baris topbar desktop (yang lain masuk dropdown
// "Lainnya") — dibatasi supaya topbar TIDAK meluber/terpotong di layar biasa.
// Sebelumnya SEMUA item MENU_PENGURUS (9 item, termasuk label panjang seperti
// "Verifikasi Perubahan Data" dan "Pengaturan Organisasi") dipaksa muat dalam
// satu baris topbar-nav — di layar yang tidak cukup lebar, item di ujung kanan
// (Rekap & Laporan, Pengaturan Organisasi, Log Aktivitas) jadi terpotong/tidak
// kelihatan sama sekali karena container-nya overflow tanpa ada indikasi bisa
// discroll. Menu di halaman mobile (mobileMenuPanel, vertikal) TIDAK terpengaruh
// — tetap menampilkan semua item apa adanya.
const TOPBAR_PRIMARY_IDS = ['dasbor-pengurus', 'verifikasi-pendaftaran', 'data-alumni', 'kartu-digital-alumni'];

function renderNavigation(role, badgeCounts) {
  badgeCounts = badgeCounts || {};
  const menus = role === 'Pengurus' ? MENU_PENGURUS : MENU_ANGGOTA;
  const topbarNav = document.getElementById('topbarNav');
  const topbarMoreWrap = document.getElementById('topbarMoreWrap');
  const mobilePanel = document.getElementById('mobileMenuPanel');
  const topbar = document.getElementById('topbar');

  const linkHtml = (m) => `
    <a href="javascript:void(0)" onclick="navigateTo('${m.id}')" data-page="${m.id}">
      <span class="flex items-center gap-2"><span class="material-symbols-outlined text-[19px]">${m.icon}</span>${m.label}</span>
      ${m.badgeKey && badgeCounts[m.badgeKey] ? '<span class="nav-badge">' + badgeCounts[m.badgeKey] + '</span>' : ''}
    </a>`;

  const primer = menus.filter(m => TOPBAR_PRIMARY_IDS.indexOf(m.id) > -1);
  const lainnya = menus.filter(m => TOPBAR_PRIMARY_IDS.indexOf(m.id) === -1);

  topbarNav.innerHTML = primer.map(m => linkHtml(m)).join('');
  // Dropdown "Lainnya" dirender ke #topbarMoreWrap (di Index.html, di dalam
  // .topbar-actions) — BUKAN ke dalam #topbarNav — supaya tidak kepotong oleh
  // overflow-x:auto milik #topbarNav (lihat catatan di Index.html).
  if (topbarMoreWrap) {
    topbarMoreWrap.innerHTML = lainnya.length > 0 ? `
      <button type="button" class="topbar-more-btn" onclick="toggleTopbarMore(event)">
        <span class="material-symbols-outlined text-[19px]">more_horiz</span> Lainnya
      </button>
      <div class="topbar-more-menu" id="topbarMoreMenu" onclick="this.classList.remove('open')">
        ${lainnya.map(m => linkHtml(m)).join('')}
      </div>` : '';
  }
  mobilePanel.innerHTML = menus.map(m => linkHtml(m)).join('') +
    `<a href="javascript:void(0)" onclick="handleLogout()" class="mm-logout"><span class="flex items-center gap-2"><span class="material-symbols-outlined text-[19px]">logout</span>Keluar</span></a>`;

  topbar.classList.remove('hidden');
  document.getElementById('logoWrap').innerHTML = logoAtauFallback(40, logoSvgSmall());

  const email = AppState.userEmail || '';
  const initial = email ? email.charAt(0).toUpperCase() : '?';
  document.getElementById('topbarUserAvatar').textContent = initial;
  document.getElementById('topbarUserName').textContent = email || 'Pengguna';
  document.getElementById('topbarUserRole').textContent = (role || '-').toUpperCase();
}

function hideNavigation() {
  document.getElementById('topbar').classList.add('hidden');
  closeMobileMenu();
}

// Dropdown "Lainnya" di topbar desktop (lihat TOPBAR_PRIMARY_IDS di renderNavigation).
function toggleTopbarMore(event) {
  event.stopPropagation();
  const menu = document.getElementById('topbarMoreMenu');
  if (menu) menu.classList.toggle('open');
}
// Listener sekali pasang (bukan di dalam renderNavigation, supaya tidak dobel
// setiap kali navigasi/render ulang topbar) — tutup dropdown "Lainnya" kalau
// klik di luar area tombol/menunya.
document.addEventListener('click', function (e) {
  const menu = document.getElementById('topbarMoreMenu');
  const wrap = document.getElementById('topbarMoreWrap');
  if (menu && menu.classList.contains('open') && wrap && !wrap.contains(e.target)) {
    menu.classList.remove('open');
  }
});

function updateActiveNav(pageName) {
  document.querySelectorAll('.topbar-nav a, .topbar-more-menu a, .mobile-menu-panel a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === pageName);
  });
}

function toggleMobileMenu() {
  document.getElementById('mobileMenuPanel').classList.toggle('hidden');
}
function closeMobileMenu() {
  const p = document.getElementById('mobileMenuPanel');
  if (p) p.classList.add('hidden');
}

// ════════════════════════════════════════════════════════
// DARK MODE
// ════════════════════════════════════════════════════════
function toggleDarkMode() {
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}

// ════════════════════════════════════════════════════════
// UTIL: TOAST, MODAL, FORMAT
// ════════════════════════════════════════════════════════
// Pengganti window.open(url, '_blank') di dalam callback google.script.run.
// google.script.run bersifat ASYNCHRONOUS — window.open yang dipanggil di
// dalam callback-nya TIDAK dihitung browser sebagai hasil klik langsung
// pengguna, sehingga hampir selalu diblokir popup blocker TANPA pesan error
// apa pun (gejalanya: tombol diklik, proses di server berhasil, tapi
// kelihatannya "tidak ada respons" sama sekali). Solusinya: tampilkan link
// yang harus diklik SENDIRI oleh pengguna — klik manual pada elemen <a>
// selalu diizinkan browser, tidak pernah diblokir sebagai popup.
function tampilkanLinkUnduhan(url, pesan) {
  const c = document.getElementById('toastContainer');
  if (!c) { window.open(url, '_blank'); return; }
  const el = document.createElement('div');
  el.className = 'toast-item success';
  el.innerHTML = '<span class="material-symbols-outlined text-[20px]">check_circle</span><div><strong>' + escapeHtml(pesan || 'Berkas siap diunduh') + '</strong>' +
    '<div style="margin-top:6px"><a href="' + escapeHtml(url) + '" target="_blank" rel="noopener" class="btn-primary" style="display:inline-flex;padding:.35rem .75rem;font-size:.72rem;"><span class="material-symbols-outlined text-[16px]">open_in_new</span> Buka / Unduh</a></div></div>';
  c.appendChild(el);
  // Timeout lebih panjang dari toast biasa supaya sempat diklik.
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 20000);
}

function showToast(title, message, type) {
  type = type || 'info';
  const c = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast-item ' + type;
  const icon = type === 'success' ? 'check_circle' : type === 'danger' ? 'error' : type === 'warning' ? 'warning' : 'info';
  el.innerHTML = '<span class="material-symbols-outlined text-[20px]">' + icon + '</span><div><strong>' + escapeHtml(title) + '</strong><div style="opacity:.9">' + escapeHtml(message) + '</div></div>';
  c.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 4000);
}

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function fmtTanggal(v) {
  if (!v) return '-';
  const d = new Date(v);
  if (isNaN(d)) return '-';
  const bln = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return d.getDate() + ' ' + bln[d.getMonth()] + ' ' + d.getFullYear();
}
function badgeVerifikasi(status) {
  const map = { 'Disetujui': 'badge-disetujui', 'Menunggu': 'badge-menunggu', 'Ditolak': 'badge-ditolak' };
  return '<span class="badge ' + (map[status] || '') + '">' + escapeHtml(status || '-') + '</span>';
}
function badgeAnggota(status) {
  return '<span class="badge ' + (status === 'Aktif' ? 'badge-aktif' : 'badge-tidak-aktif') + '">' + escapeHtml(status || '-') + '</span>';
}

function openConfirmModal(title, body, onConfirm, extraHtml) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmBody').textContent = body;
  document.getElementById('confirmExtra').innerHTML = extraHtml || '';
  document.getElementById('confirmModal').classList.remove('hidden');
  document.getElementById('confirmActionBtn').onclick = () => { onConfirm(); };
}
function closeConfirmModal() {
  document.getElementById('confirmModal').classList.add('hidden');
}

// Pakai logo organisasi asli (dari Pengaturan Organisasi, dikirim sekali lewat
// window.__LOGO_URL__ saat doGet()) kalau sudah diunggah; kalau belum, tampilkan
// ikon SVG perisai bawaan sebagai placeholder. Dipakai di SEMUA tempat logo
// muncul di aplikasi (topbar, halaman Login, pratinjau kartu, halaman verifikasi)
// supaya konsisten — sebelumnya tempat-tempat ini selalu pakai SVG hardcode dan
// tidak pernah membaca logo yang diunggah user.
window.__LOGO_FALLBACKS__ = [];
function logoAtauFallback(sizePx, svgFallbackHtml) {
  if (window.__LOGO_URL__) {
    const idx = window.__LOGO_FALLBACKS__.push(svgFallbackHtml) - 1;
    return '<img src="' + window.__LOGO_URL__ + '" alt="Logo Organisasi" data-fallback-idx="' + idx + '" '
      + 'style="display:block;margin:0 auto;width:' + sizePx + 'px;height:' + sizePx + 'px;object-fit:contain;border-radius:8px;" '
      + 'onerror="logoImgFallback(this)">';
  }
  return svgFallbackHtml;
}
// Kalau URL Drive thumbnail gagal dimuat (mis. file dihapus manual dari Drive),
// ganti otomatis ke ikon SVG bawaan supaya tidak muncul ikon gambar rusak.
function logoImgFallback(imgEl) {
  const idx = imgEl.getAttribute('data-fallback-idx');
  const html = window.__LOGO_FALLBACKS__[idx];
  if (html) imgEl.outerHTML = html;
}

function logoSvgSmall() {
  return `<svg viewBox="0 0 100 100" width="40" height="40"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FCD34D"/><stop offset="50%" stop-color="#D4A72C"/><stop offset="100%" stop-color="#B45309"/></linearGradient></defs><circle cx="50" cy="50" r="47" fill="#0B2A5B" stroke="url(#g1)" stroke-width="2.5"/><circle cx="50" cy="50" r="41" fill="none" stroke="#D4A72C" stroke-width="1" stroke-dasharray="2 2"/><circle cx="50" cy="32" r="5" fill="none" stroke="url(#g1)" stroke-width="2"/><line x1="50" y1="37" x2="50" y2="68" stroke="url(#g1)" stroke-width="2.5" stroke-linecap="round"/><line x1="38" y1="44" x2="62" y2="44" stroke="url(#g1)" stroke-width="2.5" stroke-linecap="round"/><path d="M 33 55 C 33 69, 67 69, 67 55" fill="none" stroke="url(#g1)" stroke-width="2.5" stroke-linecap="round"/><polygon points="50,22 52,27 57,27 53,30 55,35 50,32 45,35 47,30 43,27 48,27" fill="#FCD34D"/></svg>`;
}

// Lencana perisai besar untuk panel kiri halaman Masuk/Daftar (mirip desain rujukan resmi).
function logoSvgShield(size) {
  const s = size || 80;
  return `<svg viewBox="0 0 100 116" width="${s}" height="${Math.round(s*1.16)}"><defs><linearGradient id="gShield" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FCD34D"/><stop offset="55%" stop-color="#D4A72C"/><stop offset="100%" stop-color="#B45309"/></linearGradient></defs><path d="M50 3 L92 18 V54 C92 82 74 101 50 112 C26 101 8 82 8 54 V18 Z" fill="#0B2A5B" stroke="url(#gShield)" stroke-width="3"/><path d="M50 12 L84 24 V53 C84 76 69 92 50 101 C31 92 16 76 16 53 V24 Z" fill="none" stroke="#D4A72C" stroke-width="1" stroke-dasharray="2 3"/><circle cx="50" cy="46" r="8" fill="none" stroke="url(#gShield)" stroke-width="2.5"/><line x1="50" y1="54" x2="50" y2="76" stroke="url(#gShield)" stroke-width="3" stroke-linecap="round"/><line x1="35" y1="62" x2="65" y2="62" stroke="url(#gShield)" stroke-width="3" stroke-linecap="round"/><path d="M28 72 C28 88 72 88 72 72" fill="none" stroke="url(#gShield)" stroke-width="3" stroke-linecap="round"/><polygon points="50,24 53,31 61,31 55,36 57,43 50,39 43,43 45,36 39,31 47,31" fill="#FCD34D"/></svg>`;
}

// gsrun() sekarang didefinisikan di js/api.js (fetch ke GAS REST API).

// PENTING (perbaikan bug "Cannot set properties of null (setting 'innerHTML')"):
// dipakai untuk hasil google.script.run yang mengisi SEBAGIAN elemen di dalam
// halaman (bukan lewat setContainer), misalnya daftar pengurus di halaman
// Pengaturan Organisasi atau tabel di Log Aktivitas. Panggilan google.script.run
// bersifat asinkron (butuh 1-3 detik) — kalau pengguna sudah pindah ke halaman
// LAIN sebelum respons server tiba, elemen tujuan (mis. #listPengurus, #logWrap)
// sudah tidak ada lagi di DOM (null), sehingga innerHTML langsung akan error dan
// menghentikan skrip. Helper ini diam-diam mengabaikan hasil yang sudah basi
// alih-alih men-crash halaman yang sedang dilihat pengguna.
function setHtmlAman(elementId, html) {
  const el = document.getElementById(elementId);
  if (!el) return; // Pengguna sudah pindah halaman — abaikan hasil yang basi
  el.innerHTML = html;
}

// Menampilkan kotak error di dalam kontainer (menggantikan spinner yang macet)
// agar kegagalan pemanggilan server TIDAK PERNAH meninggalkan tampilan "loading" selamanya.
function renderErrorBox(elementId, err, retryFn) {
  const el = document.getElementById(elementId);
  if (!el) { showToast('Error', (err && err.message) || String(err), 'danger'); return; }
  const pesan = (err && err.message) ? err.message : String(err);
  el.innerHTML = `
    <div class="card card-pad text-center py-8">
      <span class="material-symbols-outlined text-[36px]" style="color:#EF4444">error</span>
      <p class="font-head font-semibold text-ink mt-2">Gagal memuat data</p>
      <p class="text-xs text-ink-soft mt-1 mb-4">${escapeHtml(pesan)}</p>
      ${retryFn ? '<button class="btn-primary" onclick="' + retryFn + '()">Coba Lagi</button>' : ''}
    </div>`;
  showToast('Error', pesan, 'danger');
}

// ════════════════════════════════════════════════════════
// HALAMAN PUBLIK: LOGIN
// ════════════════════════════════════════════════════════
// Ikon inline (garis, tanpa dependensi library) dipakai di panel publik Masuk/Daftar.
function iconShieldCheck() { return `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>`; }
function iconCard() { return `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19"/><path d="M6 15h4"/></svg>`; }
function iconLock() { return `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10.5" width="16" height="10" rx="2"/><path d="M7.5 10.5V7a4.5 4.5 0 019 0v3.5"/></svg>`; }
function iconInfo() { return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.25"/><path d="M12 11v5.5"/><circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none"/></svg>`; }
function iconEye(open) {
  return open
    ? `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3"/></svg>`
    : `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.2A10.7 10.7 0 0112 5c7 0 10.5 7 10.5 7a13.6 13.6 0 01-3.1 3.9M6.6 6.6C3.4 8.7 1.5 12 1.5 12s3.5 7 10.5 7a10.5 10.5 0 004.2-.9"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/></svg>`;
}
function iconLoginArrow() { return `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4"/><path d="M10 8l4 4-4 4"/><path d="M14 12H2"/></svg>`; }
function iconUserPlus() { return `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5"/><path d="M19 8v6M22 11h-6"/></svg>`; }

function iconBuilding() { return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V6l8-3 8 3v15"/><path d="M4 21h16"/><path d="M9 9h.01M9 13h.01M15 9h.01M15 13h.01"/><path d="M10 21v-5h4v5"/></svg>`; }
function iconRefresh() { return `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 10-2.3 5.6"/><path d="M20 5v6h-6"/></svg>`; }

// ════════════════════════════════════════════════════════
// SHELL PUBLIK BERSAMA (navbar + footer) — dipakai oleh semua halaman publik:
// Beranda, Profil (Sejarah & Visi-Misi / Struktur Organisasi), Berita, Galeri,
// Kontak, Daftar Alumni Baru, dan Cari & Perbarui Data Saya. Setiap menu di
// navbar sekarang berpindah HALAMAN (navigateTo), bukan scroll ke bawah dalam
// satu halaman panjang seperti sebelumnya — navbar & footer tampil identik di
// semua halaman ini, hanya konten tengah dan menu aktif yang berbeda.
// ════════════════════════════════════════════════════════
const PUBLIC_PROFIL_PAGES = ['profil-sejarah', 'profil-struktur'];
const PUBLIC_ALUMNI_PAGES = ['daftar', 'cari-data-saya'];

function publicShell(activePage, innerHtml, options) {
  options = options || {};
  const year = new Date().getFullYear();
  const isProfilActive = PUBLIC_PROFIL_PAGES.indexOf(activePage) > -1;
  const isAlumniActive = PUBLIC_ALUMNI_PAGES.indexOf(activePage) > -1;
  const navLink = (page, label) => `<a href="javascript:void(0)" onclick="navigateTo('${page}',{noHistory:true})" data-page="${page}" class="${activePage === page ? 'active' : ''}">${label}</a>`;

  return `
  <div class="beranda-page">
    <header class="beranda-navbar">
      <div class="beranda-navbar-inner">
        <div class="beranda-navbar-brand" style="cursor:pointer;" onclick="navigateTo('beranda',{noHistory:true})">
          <div class="beranda-navbar-logo">${logoAtauFallback(30, logoSvgSmall())}</div>
          <div class="beranda-navbar-brand-text">
            <span class="beranda-navbar-title">IKALLHUBDAT</span>
            <span class="beranda-navbar-subtitle">DPD Kalimantan Timur</span>
          </div>
        </div>
        <nav class="beranda-navbar-menu">
          ${navLink('beranda', 'Beranda')}
          <div class="beranda-navbar-dropdown" id="berandaProfilWrap">
            <button type="button" class="beranda-navbar-dropdown-btn ${isProfilActive ? 'active' : ''}" onclick="toggleBerandaDropdown(event)">Profil <span class="material-symbols-outlined text-[16px]">expand_more</span></button>
            <div class="beranda-navbar-dropdown-menu" id="berandaProfilMenu">
              <a href="javascript:void(0)" onclick="navigateTo('profil-sejarah',{noHistory:true});closeBerandaDropdown()">Sejarah &amp; Visi-Misi</a>
              <a href="javascript:void(0)" onclick="navigateTo('profil-struktur',{noHistory:true});closeBerandaDropdown()">Struktur Organisasi</a>
            </div>
          </div>
          <div class="beranda-navbar-dropdown" id="berandaAlumniWrap">
            <button type="button" class="beranda-navbar-dropdown-btn ${isAlumniActive ? 'active' : ''}" onclick="toggleBerandaAlumniDropdown(event)">Alumni <span class="material-symbols-outlined text-[16px]">expand_more</span></button>
            <div class="beranda-navbar-dropdown-menu" id="berandaAlumniMenu">
              <a href="javascript:void(0)" onclick="navigateTo('daftar',{noHistory:true})">Daftar Alumni Baru</a>
              <a href="javascript:void(0)" onclick="navigateTo('cari-data-saya',{noHistory:true})">Cari &amp; Perbaharui Data Saya</a>
            </div>
          </div>
          ${navLink('berita', 'Berita &amp; Pengumuman')}
          ${navLink('galeri', 'Galeri Kegiatan')}
          ${navLink('kontak', 'Kontak')}
        </nav>
        <div class="beranda-navbar-cta">
          <button class="btn-primary" onclick="navigateTo('login',{noHistory:true})"><span class="material-symbols-outlined text-[17px]">lock</span> Login Admin</button>
        </div>
        <button type="button" class="beranda-navbar-mobile-btn" onclick="toggleBerandaMobileMenu()"><span class="material-symbols-outlined text-[24px]">menu</span></button>
      </div>
      <div class="beranda-navbar-mobile-panel hidden" id="berandaMobilePanel">
        ${navLink('beranda', 'Beranda')}
        ${navLink('profil-sejarah', 'Sejarah &amp; Visi-Misi')}
        ${navLink('profil-struktur', 'Struktur Organisasi')}
        ${navLink('daftar', 'Daftar Alumni Baru')}
        ${navLink('cari-data-saya', 'Cari &amp; Perbaharui Data Saya')}
        ${navLink('berita', 'Berita &amp; Pengumuman')}
        ${navLink('galeri', 'Galeri Kegiatan')}
        ${navLink('kontak', 'Kontak')}
        <a href="javascript:void(0)" onclick="navigateTo('login',{noHistory:true})" style="color:var(--gold-light);">Login Admin →</a>
      </div>
    </header>

    ${innerHtml}

    ${options.hideFooter ? '' : `
    <footer class="beranda-footer-v2">
      <div class="beranda-footer-inner">
        <div>
          <div class="beranda-footer-title">IKALLHUBDAT</div>
          <div class="beranda-footer-sub">DPD Kalimantan Timur</div>
          <p class="beranda-footer-desc">Ikatan Alumni Lalu Lintas/Perhubungan Darat — wadah silaturahmi, pengembangan karier, dan basis data keanggotaan alumni resmi di Provinsi Kalimantan Timur.</p>
        </div>
        <div>
          <div class="beranda-footer-heading">Kontak</div>
          <div class="beranda-footer-item">${iconBuilding()} Sekretariat DPD Kaltim<br>0816-4578-888</div>
        </div>
        <div>
          <div class="beranda-footer-heading">Pintasan</div>
          <div class="beranda-footer-links">
            ${navLink('profil-sejarah', 'Profil Organisasi')}
            ${navLink('berita', 'Berita &amp; Pengumuman')}
            ${navLink('galeri', 'Galeri Kegiatan')}
            ${navLink('daftar', 'Daftar Alumni Baru')}
            ${navLink('cari-data-saya', 'Cari &amp; Perbarui Data Saya')}
          </div>
        </div>
      </div>
      <div class="beranda-footer-bottom">© ${year} DPD IKALLHUBDAT Kalimantan Timur. Seluruh Hak Cipta Dilindungi.</div>
    </footer>`}
  </div>`;
}

// ════════════════════════════════════════════════════════
// HALAMAN PUBLIK: BERANDA — sekarang HANYA hero full-page (identitas, logo,
// judul, 3 kartu fitur, kontak singkat). Profil/Berita/Galeri/Kontak masing2
// sudah jadi halaman sendiri (lihat fungsi2 di bawah) — tidak lagi digulung
// sebagai section di bawah hero ini. Kontennya statis (tanpa data organisasi),
// jadi tidak perlu panggil getBerandaData() dan tampil instan.
// ════════════════════════════════════════════════════════
function pageBeranda() {
  hideNavigation();
  const heroHtml = `
    <section class="beranda-hero beranda-hero-full" id="navBeranda">
      <div class="beranda-hero-inner">
        <div style="display:flex;flex-direction:column;align-items:center;gap:.3rem;width:100%;">
          <div style="width:30px;height:30px;border-radius:7px;background:rgba(212,167,44,.15);border:1px solid rgba(212,167,44,.4);display:flex;align-items:center;justify-content:center;color:var(--gold-light);">${iconShieldCheck()}</div>
          <div class="auth-left-eyebrow">KEMENTERIAN PERHUBUNGAN RI</div>
          <div class="auth-left-org">DPD IKALLHUBDAT Provinsi Kalimantan Timur</div>
        </div>
        <div style="margin-top:2.25rem;width:100%;text-align:center;">${logoAtauFallback(130, logoSvgShield(130))}</div>
        <h1 class="auth-left-title" style="text-align:center;">IKALLHUBDAT</h1>
        <p class="auth-left-subtitle" style="text-align:center;">Ikatan Alumni Lalu Lintas / Perhubungan Darat</p>
        <p class="auth-left-line3" style="text-align:center;">Dewan Pengurus Daerah (DPD)</p>
        <p class="auth-left-line4" style="text-align:center;">Provinsi Kalimantan Timur</p>
        <div class="auth-feature-list" style="margin-top:2rem;width:100%;max-width:520px;">
          <div class="auth-feature-card"><div class="icon-wrap">${iconShieldCheck()}</div><div><b>Basis Data Alumni Terpusat &amp; Terverifikasi</b><br><span style="font-weight:500;opacity:.85;font-size:.72rem;">Validasi berjenjang oleh Pengurus Daerah sesuai data alumni resmi.</span></div></div>
          <div class="auth-feature-card"><div class="icon-wrap">${iconCard()}</div><div><b>Penerbitan KTA Digital Otomatis</b><br><span style="font-weight:500;opacity:.85;font-size:.72rem;">Kartu Tanda Anggota format PDF ber-QR Code keaslian terdaftar.</span></div></div>
          <div class="auth-feature-card"><div class="icon-wrap">${iconRefresh()}</div><div><b>Integrasi Google Workspace DPD</b><br><span style="font-weight:500;opacity:.85;font-size:.72rem;">Sinkronisasi repositori berkas dan komunikasi internal satu pintu.</span></div></div>
        </div>
      </div>
    </section>`;
  setContainer(publicShell('beranda', heroHtml));
}

// ════════════════════════════════════════════════════════
// HALAMAN PUBLIK: PROFIL — Sejarah & Visi-Misi (halaman sendiri) dan
// Struktur Organisasi (halaman sendiri). Keduanya memakai data yang sama
// dari getBerandaData() (di-cache 2 menit di server, lihat CACHE_KEY_BERANDA
// di Kode.gs) — hanya bagian yang ditampilkan yang berbeda.
// ════════════════════════════════════════════════════════
function pageProfilSejarah() {
  hideNavigation();
  setContainer(publicShell('profil-sejarah', '<div class="page-loading"><div class="app-spinner" style="border-top-color:#0B2A5B"></div></div>', { hideFooter: true }));
  gsrun({ success: renderProfilSejarah, fail: err => renderErrorBox('app-container', err, 'pageProfilSejarah') }).getBerandaData();
}
function renderProfilSejarah(res) {
  if (!res.success) { renderErrorBox('app-container', { message: res.message }, 'pageProfilSejarah'); return; }
  const p = res.data.profil;
  const sejarahParagraf = (p.profil_sejarah || '').split('\n').map(s => s.trim()).filter(Boolean);
  const misiItems = (p.profil_misi || '').split('\n').map(s => s.trim()).filter(Boolean);
  const inner = `
    <div class="beranda-content">
      <section class="beranda-section">
        <h2 class="beranda-section-title">Profil Organisasi</h2>
        <div class="card card-pad beranda-prose">
          ${sejarahParagraf.map(par => '<p>' + escapeHtml(par) + '</p>').join('')}
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div class="card card-pad card-accent gold">
            <h3 class="font-head font-semibold text-ink mb-2 flex items-center gap-2">${iconShieldCheck()} Visi</h3>
            <p class="text-sm text-ink-soft">${escapeHtml(p.profil_visi)}</p>
          </div>
          <div class="card card-pad card-accent">
            <h3 class="font-head font-semibold text-ink mb-2 flex items-center gap-2">${iconCard()} Misi</h3>
            <ol class="text-sm text-ink-soft" style="padding-left:1.1rem;display:flex;flex-direction:column;gap:.4rem;">
              ${misiItems.map(m => '<li>' + escapeHtml(m) + '</li>').join('')}
            </ol>
          </div>
        </div>
      </section>
    </div>`;
  setContainer(publicShell('profil-sejarah', inner, { hideFooter: true }));
}

function pageProfilStruktur() {
  hideNavigation();
  setContainer(publicShell('profil-struktur', '<div class="page-loading"><div class="app-spinner" style="border-top-color:#0B2A5B"></div></div>', { hideFooter: true }));
  gsrun({ success: renderProfilStruktur, fail: err => renderErrorBox('app-container', err, 'pageProfilStruktur') }).getBerandaData();
}
function renderProfilStruktur(res) {
  if (!res.success) { renderErrorBox('app-container', { message: res.message }, 'pageProfilStruktur'); return; }
  const p = res.data.profil;
  const strukturHtml = `
    <div class="struktur-chart">
      <div class="struktur-node">${escapeHtml(p.struktur_pembina || 'Pembina')}<span class="struktur-node-label">Pembina</span></div>
      <div class="struktur-connector"></div>
      <div class="struktur-node struktur-node-main">${escapeHtml(p.struktur_ketua || 'Ketua')}<span class="struktur-node-label">Ketua</span></div>
      <div class="struktur-connector"></div>
      <div class="struktur-row">
        <div class="struktur-node">${escapeHtml(p.struktur_sekretaris || 'Sekretaris')}<span class="struktur-node-label">Sekretaris</span></div>
        <div class="struktur-node">${escapeHtml(p.struktur_bendahara || 'Bendahara')}<span class="struktur-node-label">Bendahara</span></div>
      </div>
    </div>`;
  const inner = `
    <div class="beranda-content">
      <section class="beranda-section">
        <h2 class="beranda-section-title">Struktur Organisasi</h2>
        <div class="card card-pad">${strukturHtml}</div>
      </section>
    </div>`;
  setContainer(publicShell('profil-struktur', inner, { hideFooter: true }));
}

// ════════════════════════════════════════════════════════
// HALAMAN PUBLIK: BERITA & PENGUMUMAN
// ════════════════════════════════════════════════════════
function pageBerita() {
  hideNavigation();
  setContainer(publicShell('berita', '<div class="page-loading"><div class="app-spinner" style="border-top-color:#0B2A5B"></div></div>', { hideFooter: true }));
  gsrun({ success: renderBeritaPage, fail: err => renderErrorBox('app-container', err, 'pageBerita') }).getBerandaData();
}
function renderBeritaPage(res) {
  if (!res.success) { renderErrorBox('app-container', { message: res.message }, 'pageBerita'); return; }
  const d = res.data;
  const beritaHtml = d.berita.length === 0
    ? '<div class="card card-pad text-center py-8 text-ink-soft text-sm">Belum ada berita/pengumuman.</div>'
    : `<div class="berita-list">${d.berita.map(b => `
        <div class="berita-card">
          <div class="berita-card-date">${fmtTanggal(b.tanggal)}</div>
          <h3 class="berita-card-title">${escapeHtml(b.judul)}</h3>
          <p class="berita-card-body">${escapeHtml(b.isi)}</p>
        </div>`).join('')}</div>`;
  const inner = `
    <div class="beranda-content">
      <section class="beranda-section">
        <h2 class="beranda-section-title">Berita &amp; Pengumuman</h2>
        ${beritaHtml}
      </section>
    </div>`;
  setContainer(publicShell('berita', inner, { hideFooter: true }));
}

// ════════════════════════════════════════════════════════
// HALAMAN PUBLIK: GALERI KEGIATAN
// ════════════════════════════════════════════════════════
function pageGaleri() {
  hideNavigation();
  setContainer(publicShell('galeri', '<div class="page-loading"><div class="app-spinner" style="border-top-color:#0B2A5B"></div></div>', { hideFooter: true }));
  gsrun({ success: renderGaleriPage, fail: err => renderErrorBox('app-container', err, 'pageGaleri') }).getBerandaData();
}
function renderGaleriPage(res) {
  if (!res.success) { renderErrorBox('app-container', { message: res.message }, 'pageGaleri'); return; }
  const d = res.data;
  const galeriHtml = d.galeri.length === 0
    ? '<div class="card card-pad text-center py-8 text-ink-soft text-sm">Belum ada foto kegiatan.</div>'
    : `<div class="galeri-grid">${d.galeri.map(g => `
        <div class="galeri-item">
          <img src="${g.url}" alt="${escapeHtml(g.keterangan || 'Foto Kegiatan')}" loading="lazy">
          ${g.keterangan ? '<div class="galeri-item-caption">' + escapeHtml(g.keterangan) + '</div>' : ''}
        </div>`).join('')}</div>`;
  const inner = `
    <div class="beranda-content">
      <section class="beranda-section">
        <h2 class="beranda-section-title">Galeri Kegiatan</h2>
        ${galeriHtml}
      </section>
    </div>`;
  setContainer(publicShell('galeri', inner, { hideFooter: true }));
}

// ════════════════════════════════════════════════════════
// HALAMAN PUBLIK: KONTAK — statis, tidak perlu ambil data ke server.
// ════════════════════════════════════════════════════════
function pageKontak() {
  hideNavigation();
  const inner = `
    <div class="beranda-content">
      <section class="beranda-section">
        <h2 class="beranda-section-title">Kontak</h2>
        <div class="card card-pad flex items-center gap-3">
          <div class="icon-wrap" style="width:38px;height:38px;border-radius:50%;background:var(--bg-card-alt);display:flex;align-items:center;justify-content:center;color:var(--navy);flex:none;">${iconBuilding()}</div>
          <div>
            <div class="font-head font-semibold text-ink text-sm">Sekretariat DPD IKALLHUBDAT Kalimantan Timur</div>
            <div class="text-xs text-ink-soft mt-0.5">WhatsApp/Telepon: <b class="text-ink">0816-4578-888</b></div>
          </div>
        </div>
      </section>
    </div>`;
  setContainer(publicShell('kontak', inner, { hideFooter: true }));
}

function toggleBerandaDropdown(event) {
  event.stopPropagation();
  const menu = document.getElementById('berandaProfilMenu');
  if (menu) menu.classList.toggle('open');
}
function closeBerandaDropdown() {
  const menu = document.getElementById('berandaProfilMenu');
  if (menu) menu.classList.remove('open');
}
function toggleBerandaAlumniDropdown(event) {
  event.stopPropagation();
  const menu = document.getElementById('berandaAlumniMenu');
  if (menu) menu.classList.toggle('open');
}
function toggleBerandaMobileMenu() {
  const p = document.getElementById('berandaMobilePanel');
  if (p) p.classList.toggle('hidden');
}
function closeBerandaMobileMenu() {
  const p = document.getElementById('berandaMobilePanel');
  if (p) p.classList.add('hidden');
}
// Listener sekali pasang (bukan di dalam publicShell, supaya tidak dobel
// setiap kali halaman publik dirender ulang) — tutup dropdown "Profil"/"Alumni"
// kalau klik di luar area tombol/menunya. Mengikuti pola toggleTopbarMore().
document.addEventListener('click', function (e) {
  const menuProfil = document.getElementById('berandaProfilMenu');
  const wrapProfil = document.getElementById('berandaProfilWrap');
  if (menuProfil && menuProfil.classList.contains('open') && wrapProfil && !wrapProfil.contains(e.target)) {
    menuProfil.classList.remove('open');
  }
  const menuAlumni = document.getElementById('berandaAlumniMenu');
  const wrapAlumni = document.getElementById('berandaAlumniWrap');
  if (menuAlumni && menuAlumni.classList.contains('open') && wrapAlumni && !wrapAlumni.contains(e.target)) {
    menuAlumni.classList.remove('open');
  }
});

// ════════════════════════════════════════════════════════
// ADMIN: KELOLA BERANDA (Profil Organisasi / Kelola Berita / Kelola Galeri)
// ════════════════════════════════════════════════════════
let kelolaBerandaTab = 'profil';
function pageKelolaBeranda() {
  if (!requireLogin()) return;
  renderNavigation('Pengurus');
  kelolaBerandaTab = 'profil';
  setContainer(`
  <div class="flex flex-col gap-5">
    <h1 class="font-head font-bold text-xl text-ink">Kelola Beranda</h1>
    <div class="pill-tabs" id="kelolaBerandaTabs">
      <button type="button" class="pill-tab active" data-tab="profil" onclick="switchKelolaBerandaTab('profil')">Profil Organisasi</button>
      <button type="button" class="pill-tab" data-tab="berita" onclick="switchKelolaBerandaTab('berita')">Kelola Berita</button>
      <button type="button" class="pill-tab" data-tab="galeri" onclick="switchKelolaBerandaTab('galeri')">Kelola Galeri</button>
    </div>
    <div id="kelolaBerandaBody"><div class="page-loading"><div class="app-spinner" style="border-top-color:#0B2A5B"></div></div></div>
  </div>`);
  muatKelolaBerandaProfil();
}

function switchKelolaBerandaTab(tab) {
  kelolaBerandaTab = tab;
  document.querySelectorAll('#kelolaBerandaTabs .pill-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  if (tab === 'profil') muatKelolaBerandaProfil();
  else if (tab === 'berita') muatKelolaBerandaBerita();
  else muatKelolaBerandaGaleri();
}

// ── Sub-tab: Profil Organisasi ──
function muatKelolaBerandaProfil() {
  setHtmlAman('kelolaBerandaBody', '<div class="page-loading"><div class="app-spinner" style="border-top-color:#0B2A5B"></div></div>');
  gsrun({ success: renderKelolaBerandaProfil, fail: err => renderErrorBox('kelolaBerandaBody', err, 'muatKelolaBerandaProfil') }).getProfilOrganisasi(AppState.sessionToken);
}
function renderKelolaBerandaProfil(res) {
  if (!res.success) { renderErrorBox('kelolaBerandaBody', { message: res.message }, 'muatKelolaBerandaProfil'); return; }
  const p = res.data;
  setHtmlAman('kelolaBerandaBody', `
    <div class="card card-pad">
      <h3 class="font-head font-semibold mb-3">Sejarah</h3>
      <p class="text-xs text-ink-soft mb-2">Pisahkan tiap paragraf dengan baris kosong (Enter dua kali).</p>
      <textarea class="form-input" id="pf_sejarah" rows="8">${escapeHtml(p.profil_sejarah)}</textarea>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      <div class="card card-pad">
        <h3 class="font-head font-semibold mb-3">Visi</h3>
        <textarea class="form-input" id="pf_visi" rows="4">${escapeHtml(p.profil_visi)}</textarea>
      </div>
      <div class="card card-pad">
        <h3 class="font-head font-semibold mb-3">Misi</h3>
        <p class="text-xs text-ink-soft mb-2">Satu poin misi per baris.</p>
        <textarea class="form-input" id="pf_misi" rows="4">${escapeHtml(p.profil_misi)}</textarea>
      </div>
    </div>
    <div class="card card-pad mt-4">
      <h3 class="font-head font-semibold mb-3">Struktur Organisasi</h3>
      <p class="text-xs text-ink-soft mb-3">Isi nama pejabat tiap posisi. Kosongkan untuk menampilkan label jabatan saja di Beranda.</p>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><label class="form-label">Pembina</label><input class="form-input" id="pf_pembina" value="${escapeHtml(p.struktur_pembina)}" placeholder="Nama Pembina"></div>
        <div><label class="form-label">Ketua</label><input class="form-input" id="pf_ketua" value="${escapeHtml(p.struktur_ketua)}" placeholder="Nama Ketua"></div>
        <div><label class="form-label">Sekretaris</label><input class="form-input" id="pf_sekretaris" value="${escapeHtml(p.struktur_sekretaris)}" placeholder="Nama Sekretaris"></div>
        <div><label class="form-label">Bendahara</label><input class="form-input" id="pf_bendahara" value="${escapeHtml(p.struktur_bendahara)}" placeholder="Nama Bendahara"></div>
      </div>
    </div>
    <button class="btn-primary mt-4" onclick="simpanProfilOrganisasi()">Simpan Profil Organisasi</button>
  `);
}
function simpanProfilOrganisasi() {
  const data = {
    profil_sejarah: document.getElementById('pf_sejarah').value,
    profil_visi: document.getElementById('pf_visi').value,
    profil_misi: document.getElementById('pf_misi').value,
    struktur_pembina: document.getElementById('pf_pembina').value.trim(),
    struktur_ketua: document.getElementById('pf_ketua').value.trim(),
    struktur_sekretaris: document.getElementById('pf_sekretaris').value.trim(),
    struktur_bendahara: document.getElementById('pf_bendahara').value.trim()
  };
  gsrun({ success: r => showToast(r.success ? 'Tersimpan' : 'Gagal', r.message, r.success ? 'success' : 'danger') }).updateProfilOrganisasi(AppState.sessionToken, data);
}

// ── Sub-tab: Kelola Berita ──
function muatKelolaBerandaBerita() {
  setHtmlAman('kelolaBerandaBody', '<div class="page-loading"><div class="app-spinner" style="border-top-color:#0B2A5B"></div></div>');
  gsrun({ success: renderKelolaBerandaBerita, fail: err => renderErrorBox('kelolaBerandaBody', err, 'muatKelolaBerandaBerita') }).getBeritaList(AppState.sessionToken);
}
function renderKelolaBerandaBerita(res) {
  if (!res.success) { renderErrorBox('kelolaBerandaBody', { message: res.message }, 'muatKelolaBerandaBerita'); return; }
  const rows = res.data;
  setHtmlAman('kelolaBerandaBody', `
    <div class="card">
      <div class="flex items-center justify-between p-4 border-b" style="border-color:var(--border-color)">
        <span class="text-sm text-ink-soft">${rows.length} berita</span>
        <button class="btn-primary" onclick="openFormBerita(null)"><span class="material-symbols-outlined text-[18px]">add</span> Tambah Berita</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Tanggal</th><th>Judul</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${rows.length === 0 ? '<tr><td colspan="4" class="text-center py-6 text-ink-soft">Belum ada berita.</td></tr>' :
              rows.map(b => `<tr>
                <td class="text-xs">${fmtTanggal(b.tanggal)}</td>
                <td><div class="font-semibold text-sm">${escapeHtml(b.judul)}</div></td>
                <td>${b.status === 'Terbit' ? '<span class="badge badge-aktif">Terbit</span>' : '<span class="badge badge-menunggu">Draft</span>'}</td>
                <td class="text-right whitespace-nowrap">
                  <button class="icon-btn" title="Ubah" onclick='openFormBerita(${JSON.stringify(b)})'><span class="material-symbols-outlined text-[18px]">edit_note</span></button>
                  <button class="icon-btn" title="Hapus" onclick='hapusBeritaHandler(${JSON.stringify(b.id_berita)}, ${JSON.stringify(b.judul)})'><span class="material-symbols-outlined text-[18px]">delete</span></button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `);
}
function openFormBerita(data) {
  const isEdit = !!data;
  const modalHtml = `
    <div class="modal-backdrop" id="formBeritaModal">
      <div class="modal-card modal-lg">
        <h3 class="font-head font-semibold text-lg text-ink mb-4">${isEdit ? 'Ubah Berita' : 'Tambah Berita'}</h3>
        <div class="flex flex-col gap-3">
          <div><label class="form-label">Judul</label><input class="form-input" id="b_judul" value="${isEdit ? escapeHtml(data.judul) : ''}"></div>
          <div><label class="form-label">Isi Berita</label><textarea class="form-input" id="b_isi" rows="6">${isEdit ? escapeHtml(data.isi) : ''}</textarea></div>
          <div><label class="form-label">Status</label>
            <select class="form-select" id="b_status">
              <option value="Terbit" ${isEdit && data.status === 'Terbit' ? 'selected' : ''}>Terbit (tampil di Beranda)</option>
              <option value="Draft" ${isEdit && data.status === 'Draft' ? 'selected' : ''}>Draft (belum tampil)</option>
            </select>
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-5">
          <button class="btn-secondary" onclick="closeFormBeritaModal()">Batal</button>
          <button class="btn-primary" id="btnSimpanBerita" onclick="simpanFormBerita(${isEdit ? "'" + data.id_berita + "'" : 'null'})">Simpan</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}
function closeFormBeritaModal() { const m = document.getElementById('formBeritaModal'); if (m) m.remove(); }
function simpanFormBerita(idBerita) {
  const data = {
    judul: document.getElementById('b_judul').value.trim(),
    isi: document.getElementById('b_isi').value.trim(),
    status: document.getElementById('b_status').value
  };
  if (!data.judul || !data.isi) { showToast('Peringatan', 'Judul dan isi berita wajib diisi.', 'warning'); return; }
  if (idBerita) data.id_berita = idBerita;
  const btn = document.getElementById('btnSimpanBerita');
  btn.innerHTML = '<span class="spinner-inline"></span>'; btn.disabled = true;
  gsrun({
    success: r => { closeFormBeritaModal(); if (r.success) { showToast('Berhasil', r.message, 'success'); muatKelolaBerandaBerita(); } else showToast('Gagal', r.message, 'danger'); },
    fail: err => { closeFormBeritaModal(); showToast('Error', err.message, 'danger'); }
  }).simpanBerita(AppState.sessionToken, data);
}
function hapusBeritaHandler(id, judul) {
  openConfirmModal('Hapus Berita', 'Hapus berita "' + judul + '"? Tindakan ini tidak dapat dibatalkan.', () => {
    closeConfirmModal();
    gsrun({ success: r => { showToast(r.success ? 'Berhasil' : 'Gagal', r.message, r.success ? 'success' : 'danger'); if (r.success) muatKelolaBerandaBerita(); } }).hapusBerita(AppState.sessionToken, id);
  });
}

// ── Sub-tab: Kelola Galeri ──
function muatKelolaBerandaGaleri() {
  setHtmlAman('kelolaBerandaBody', '<div class="page-loading"><div class="app-spinner" style="border-top-color:#0B2A5B"></div></div>');
  gsrun({ success: renderKelolaBerandaGaleri, fail: err => renderErrorBox('kelolaBerandaBody', err, 'muatKelolaBerandaGaleri') }).getGaleriList(AppState.sessionToken);
}
function renderKelolaBerandaGaleri(res) {
  if (!res.success) { renderErrorBox('kelolaBerandaBody', { message: res.message }, 'muatKelolaBerandaGaleri'); return; }
  const rows = res.data;
  setHtmlAman('kelolaBerandaBody', `
    <div class="card card-pad">
      <h3 class="font-head font-semibold mb-3">Unggah Foto Baru</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
        <div><label class="form-label">Foto (JPG/PNG, maks. 3 MB)</label><input type="file" id="fileGaleri" accept="image/png,image/jpeg" class="form-input" style="padding:.4rem;"></div>
        <div><label class="form-label">Keterangan (opsional)</label><input class="form-input" id="galeriKeterangan" placeholder="Contoh: Rapat Kerja Daerah 2026"></div>
      </div>
      <button class="btn-primary mt-3" id="btnUnggahGaleri" onclick="unggahGaleriHandler()"><span class="material-symbols-outlined text-[18px]">upload</span> Unggah ke Galeri</button>
    </div>
    <div class="galeri-grid mt-4">
      ${rows.length === 0 ? '<div class="card card-pad text-center py-8 text-ink-soft text-sm" style="grid-column:1/-1;">Belum ada foto.</div>' :
        rows.map(g => `
        <div class="galeri-item">
          <img src="${g.url}" alt="${escapeHtml(g.keterangan || 'Foto Kegiatan')}" loading="lazy">
          ${g.keterangan ? '<div class="galeri-item-caption">' + escapeHtml(g.keterangan) + '</div>' : ''}
          <button class="galeri-item-delete" onclick="hapusFotoGaleriHandler('${g.id_foto}')" title="Hapus foto"><span class="material-symbols-outlined text-[16px]">delete</span></button>
        </div>`).join('')}
    </div>
  `);
}
function unggahGaleriHandler() {
  const input = document.getElementById('fileGaleri');
  const file = input && input.files && input.files[0];
  if (!file) { showToast('Peringatan', 'Pilih foto terlebih dahulu.', 'warning'); return; }
  if (file.size > 3 * 1024 * 1024) { showToast('Peringatan', 'Ukuran file maksimal 3 MB.', 'warning'); return; }
  const keterangan = document.getElementById('galeriKeterangan').value.trim();
  const btn = document.getElementById('btnUnggahGaleri');
  const original = btn.innerHTML;
  btn.innerHTML = '<span class="spinner-inline"></span> Mengunggah...'; btn.disabled = true;

  const reader = new FileReader();
  reader.onload = () => {
    const base64 = String(reader.result).split(',')[1];
    gsrun({
      success: r => {
        btn.innerHTML = original; btn.disabled = false;
        if (r.success) { showToast('Berhasil', r.message, 'success'); muatKelolaBerandaGaleri(); } else showToast('Gagal', r.message, 'danger');
      },
      fail: err => { btn.innerHTML = original; btn.disabled = false; showToast('Error', err.message, 'danger'); }
    }).unggahFotoGaleri(AppState.sessionToken, file.name, file.type, base64, keterangan);
  };
  reader.onerror = () => { btn.innerHTML = original; btn.disabled = false; showToast('Error', 'Gagal membaca file.', 'danger'); };
  reader.readAsDataURL(file);
}
function hapusFotoGaleriHandler(idFoto) {
  openConfirmModal('Hapus Foto', 'Hapus foto ini dari galeri? Tindakan ini tidak dapat dibatalkan.', () => {
    closeConfirmModal();
    gsrun({ success: r => { showToast(r.success ? 'Berhasil' : 'Gagal', r.message, r.success ? 'success' : 'danger'); if (r.success) muatKelolaBerandaGaleri(); } }).hapusFotoGaleri(AppState.sessionToken, idFoto);
  });
}

function pageLogin() {
  hideNavigation();
  const rightHtml = `
    <h2 class="auth-right-heading">Masuk Khusus Pengurus / Admin</h2>
    <p class="auth-right-subtext">Login ini hanya untuk Pengurus DPD. Masuk dengan email dan kata sandi Pengurus. Anggota alumni tidak memerlukan akun — gunakan menu Alumni → "Cari &amp; Perbaharui Data Saya" untuk melihat data, mengajukan pembaruan, atau mencetak kartu digital.</p>
    <form id="formLogin" onsubmit="handleLogin(event)" class="space-y-4">
      <div>
        <label class="form-label">Alamat email resmi / pribadi</label>
        <input type="email" id="loginEmail" class="form-input" placeholder="nama.alumni@instansi.go.id" required autocomplete="username">
      </div>
      <div>
        <div class="flex items-center justify-between mb-1">
          <label class="form-label" style="margin-bottom:0;">Kata sandi</label>
          <a href="javascript:void(0)" onclick="navigateTo('lupa-sandi')" class="text-primary font-semibold hover:underline" style="font-size:.72rem;">Lupa kata sandi?</a>
        </div>
        <div class="auth-password-wrap">
          <input type="password" id="loginPassword" class="form-input" required autocomplete="current-password">
          <button type="button" class="auth-password-toggle" id="toggleLoginPasswordBtn" onclick="toggleLoginPassword()" aria-label="Tampilkan kata sandi">${iconEye(false)}</button>
        </div>
      </div>
      <label class="flex items-center gap-2" style="font-size:.78rem;color:var(--text-secondary);cursor:pointer;">
        <input type="checkbox" id="loginRemember" style="width:15px;height:15px;accent-color:var(--navy);"> Ingat saya di perangkat dinas ini selama 30 hari
      </label>
      <button type="submit" class="btn-primary w-full justify-center py-2.5">${iconLoginArrow()} Masuk ke Sistem</button>
    </form>`;
  setContainer(publicShell('login', `<div class="beranda-content"><div class="auth-right-inner">${rightHtml}</div></div>`, { hideFooter: true }));
}

function toggleLoginPassword() {
  const input = document.getElementById('loginPassword');
  const btn = document.getElementById('toggleLoginPasswordBtn');
  if (!input || !btn) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.innerHTML = iconEye(show);
  btn.setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
}

// Menyimpan token sesi: "Ingat saya" -> localStorage (bertahan lintas sesi browser),
// tidak dicentang -> sessionStorage saja (hilang saat tab/browser ditutup).
const SESSION_KEY = 'sim_ikallhubdat_token';
function saveSessionToken(token, remember) {
  if (remember) {
    localStorage.setItem(SESSION_KEY, token);
    sessionStorage.removeItem(SESSION_KEY);
  } else {
    sessionStorage.setItem(SESSION_KEY, token);
    localStorage.removeItem(SESSION_KEY);
  }
}
function clearSessionToken() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

function handleLogin(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const original = btn.innerHTML;
  btn.innerHTML = '<span class="spinner-inline"></span> Memproses...';
  btn.disabled = true;
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const remember = !!document.getElementById('loginRemember')?.checked;

  gsrun({
    success: res => {
      btn.innerHTML = original; btn.disabled = false;
      if (res.success) {
        AppState.sessionToken = res.data.token;
        AppState.userRole = res.data.peran;
        AppState.userEmail = res.data.email;
        AppState.idRecord = res.data.idRecord;
        saveSessionToken(res.data.token, remember);
        renderNavigation(res.data.peran);
        navigateTo(res.data.landingPage, { noHistory: true });
        showToast('Selamat Datang', 'Login berhasil.', 'success');
      } else {
        showToast('Gagal Masuk', res.message, 'danger');
      }
    },
    fail: err => { btn.innerHTML = original; btn.disabled = false; showToast('Error', err.message, 'danger'); }
  }).login(email, password);
}

function handleLogout() {
  gsrun({ success: () => finishLogout(), fail: () => finishLogout() }).logout(AppState.sessionToken);
}
function finishLogout() {
  AppState.sessionToken = null; AppState.userRole = null; AppState.userEmail = null; AppState.idRecord = null;
  clearSessionToken();
  hideNavigation();
  navigateTo('beranda', { noHistory: true });
}

// ════════════════════════════════════════════════════════
// HALAMAN PUBLIK: DAFTAR (FORM BERTAHAP)
// ════════════════════════════════════════════════════════
let daftarStep = 1;
const daftarData = {};

function pageDaftar() {
  hideNavigation();
  daftarStep = 1;
  const rightHtml = `
    <h2 class="auth-right-heading">Pendaftaran Anggota Baru</h2>
    <p class="auth-right-subtext">Lengkapi data diri, pendidikan, pekerjaan, dan akun untuk mendaftar sebagai anggota ${ORG_NAME}.</p>
    <div class="flex items-center justify-center gap-2 mb-5" id="stepIndicator"></div>
    <div id="daftarFormArea"></div>
    <div class="auth-info-callout"><div class="icon-wrap">${iconInfo()}</div><div>Sudah terdaftar dan ingin melihat data atau mencetak kartu? <a href="javascript:void(0)" onclick="navigateTo('cari-data-saya', { noHistory: true })" class="text-primary font-semibold hover:underline">Cari data Anda di sini</a>.</div></div>`;
  setContainer(publicShell('daftar', `<div class="beranda-content"><div class="auth-right-inner">${rightHtml}</div></div>`, { hideFooter: true }));
  renderStepIndicator();
  renderDaftarStep();
}

function renderStepIndicator() {
  const labels = ['Data Diri', 'Pendidikan', 'Pekerjaan', 'Kontak'];
  document.getElementById('stepIndicator').innerHTML = labels.map((l, i) => {
    const n = i + 1;
    const cls = n < daftarStep ? 'done' : n === daftarStep ? 'active' : '';
    return '<div class="step-dot ' + cls + '">' + (n < daftarStep ? '✓' : n) + '</div>' + (i < labels.length - 1 ? '<div style="width:20px;height:2px;background:var(--border-color)"></div>' : '');
  }).join('');
}

function renderDaftarStep() {
  const area = document.getElementById('daftarFormArea');
  if (daftarStep === 1) {
    area.innerHTML = `
      <div class="space-y-3">
        <div><label class="form-label">Nama Lengkap (dengan gelar)</label><input class="form-input" id="d_nama" value="${escapeHtml(daftarData.nama||'')}" required></div>
        <div><label class="form-label">Nomor Taruna (NOTAR) <span class="text-outline font-normal">(opsional)</span></label><input class="form-input" id="d_nomor_taruna" value="${escapeHtml(daftarData.nomor_taruna||'')}"></div>
        <div><label class="form-label">No. HP / WhatsApp</label><input class="form-input" id="d_no_hp" value="${escapeHtml(daftarData.no_hp||'')}" placeholder="08xx / +62" required></div>
      </div>
      <div class="flex justify-end mt-5"><button class="btn-primary" onclick="daftarNext(1)">Lanjut</button></div>`;
  } else if (daftarStep === 2) {
    area.innerHTML = `
      <div class="space-y-3">
        <div><label class="form-label">Program Studi</label>
          <select class="form-select" id="d_prodi" required>${PRODI_OPTS.map(p => '<option value="'+p[0]+'"'+(daftarData.prodi===p[0]?' selected':'')+'>'+p[1]+'</option>').join('')}</select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">Angkatan <span class="text-outline font-normal">(opsional)</span></label><input class="form-input" id="d_angkatan" value="${escapeHtml(daftarData.angkatan||'')}"></div>
          <div><label class="form-label">Tahun Kelulusan</label><input type="number" class="form-input" id="d_tahun_kelulusan" value="${escapeHtml(daftarData.tahun_kelulusan||'')}" required></div>
        </div>
      </div>
      <div class="flex justify-between mt-5"><button class="btn-secondary" onclick="daftarBack()">Kembali</button><button class="btn-primary" onclick="daftarNext(2)">Lanjut</button></div>`;
  } else if (daftarStep === 3) {
    area.innerHTML = `
      <div class="space-y-3">
        <div><label class="form-label">Status Kepegawaian</label>
          <select class="form-select" id="d_status_kepegawaian" required>${STATUS_KEPEGAWAIAN_OPTS.map(s => '<option value="'+s+'"'+(daftarData.status_kepegawaian===s?' selected':'')+'>'+s+'</option>').join('')}</select>
        </div>
        <div><label class="form-label">Instansi Penempatan</label><input class="form-input" id="d_instansi" value="${escapeHtml(daftarData.instansi||'')}" required></div>
        <div><label class="form-label">Jabatan Terakhir</label><input class="form-input" id="d_jabatan_terakhir" value="${escapeHtml(daftarData.jabatan_terakhir||'')}" required></div>
      </div>
      <div class="flex justify-between mt-5"><button class="btn-secondary" onclick="daftarBack()">Kembali</button><button class="btn-primary" onclick="daftarNext(3)">Lanjut</button></div>`;
  } else if (daftarStep === 4) {
    area.innerHTML = `
      <div class="space-y-3">
        <div><label class="form-label">Email (untuk notifikasi status pendaftaran) <span class="text-outline font-normal">(opsional)</span></label><input type="email" class="form-input" id="d_email" value="${escapeHtml(daftarData.email||'')}"></div>
        <div class="auth-info-callout" style="margin-top:.25rem;"><div class="icon-wrap">${iconInfo()}</div><div>Pendaftaran ini <b>tidak membuat akun/kata sandi</b>. Setelah disetujui Pengurus, kartu digital dikirim otomatis ke email Anda. Untuk melihat data atau mengajukan pembaruan kapan pun, gunakan tab "Cari &amp; Perbarui Data Saya".</div></div>
      </div>
      <div class="flex justify-between mt-5"><button class="btn-secondary" onclick="daftarBack()">Kembali</button><button class="btn-accent" id="btnSubmitDaftar" onclick="submitDaftar()">Kirim Pendaftaran</button></div>`;
  }
}

function daftarNext(step) {
  if (step === 1) {
    daftarData.nama = document.getElementById('d_nama').value.trim();
    daftarData.nomor_taruna = document.getElementById('d_nomor_taruna').value.trim();
    daftarData.no_hp = document.getElementById('d_no_hp').value.trim();
    if (!daftarData.nama || !daftarData.no_hp) { showToast('Peringatan', 'Lengkapi semua field.', 'warning'); return; }
  } else if (step === 2) {
    daftarData.prodi = document.getElementById('d_prodi').value;
    daftarData.angkatan = document.getElementById('d_angkatan').value.trim();
    daftarData.tahun_kelulusan = document.getElementById('d_tahun_kelulusan').value.trim();
    if (!daftarData.tahun_kelulusan) { showToast('Peringatan', 'Lengkapi semua field.', 'warning'); return; }
  } else if (step === 3) {
    daftarData.status_kepegawaian = document.getElementById('d_status_kepegawaian').value;
    daftarData.instansi = document.getElementById('d_instansi').value.trim();
    daftarData.jabatan_terakhir = document.getElementById('d_jabatan_terakhir').value.trim();
    if (!daftarData.instansi || !daftarData.jabatan_terakhir) { showToast('Peringatan', 'Lengkapi semua field.', 'warning'); return; }
  }
  daftarStep++;
  renderStepIndicator();
  renderDaftarStep();
}
function daftarBack() { daftarStep--; renderStepIndicator(); renderDaftarStep(); }

function submitDaftar() {
  daftarData.email = document.getElementById('d_email').value.trim();
  // Email opsional: cek format HANYA kalau diisi. Kosong dibiarkan lolos —
  // konsekuensinya: tidak ada notifikasi/kartu otomatis lewat email, tapi
  // pendaftar tetap bisa cari data sendiri lewat tab "Cari & Perbarui Data
  // Saya" (cariAnggotaPublik mencari berdasarkan nama+angkatan, bukan email).
  if (daftarData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(daftarData.email)) { showToast('Peringatan', 'Format email tidak valid.', 'warning'); return; }

  const btn = document.getElementById('btnSubmitDaftar');
  btn.innerHTML = '<span class="spinner-inline"></span> Mengirim...'; btn.disabled = true;

  gsrun({
    success: res => {
      btn.disabled = false; btn.innerHTML = 'Kirim Pendaftaran';
      if (res.success) {
        showToast('Berhasil', res.message, 'success');
        navigateTo('login', { noHistory: true });
      } else {
        showToast('Gagal', res.message, 'danger');
      }
    },
    fail: err => { btn.disabled = false; btn.innerHTML = 'Kirim Pendaftaran'; showToast('Error', err.message, 'danger'); }
  }).daftar(daftarData);
}

// ════════════════════════════════════════════════════════
// LUPA / RESET SANDI
// ════════════════════════════════════════════════════════
function pageLupaSandi() {
  hideNavigation();
  setContainer(`
  <div class="auth-shell"><div class="auth-card">
    <h1 class="font-head font-bold text-lg text-ink mb-1 text-center">Lupa Kata Sandi</h1>
    <p class="text-xs text-ink-soft text-center mb-5">Masukkan email terdaftar Anda</p>
    <form onsubmit="handleLupaSandi(event)" class="space-y-4">
      <div><label class="form-label">Email</label><input type="email" id="lupaEmail" class="form-input" required></div>
      <button type="submit" class="btn-primary w-full justify-center py-2.5">Kirim Tautan Atur Ulang</button>
    </form>
    <p class="text-center text-xs mt-4"><a href="javascript:void(0)" onclick="navigateTo('login')" class="text-primary font-semibold hover:underline">Kembali ke Masuk</a></p>
  </div></div>`);
}
function handleLupaSandi(e) {
  e.preventDefault();
  const email = document.getElementById('lupaEmail').value.trim();
  gsrun({ success: res => showToast(res.success ? 'Terkirim' : 'Gagal', res.message, res.success ? 'success' : 'danger') }).lupaSandi(email);
  navigateTo('login', { noHistory: true });
}

function pageResetSandi(token) {
  hideNavigation();
  setContainer(`
  <div class="auth-shell"><div class="auth-card">
    <h1 class="font-head font-bold text-lg text-ink mb-1 text-center">Atur Ulang Kata Sandi</h1>
    <form onsubmit="handleResetSandi(event, '${escapeHtml(token)}')" class="space-y-4 mt-4">
      <div><label class="form-label">Kata Sandi Baru</label><input type="password" id="resetPass1" class="form-input" required></div>
      <div><label class="form-label">Ulangi Kata Sandi Baru</label><input type="password" id="resetPass2" class="form-input" required></div>
      <button type="submit" class="btn-primary w-full justify-center py-2.5">Simpan Kata Sandi</button>
    </form>
  </div></div>`);
}
function handleResetSandi(e, token) {
  e.preventDefault();
  const p1 = document.getElementById('resetPass1').value;
  const p2 = document.getElementById('resetPass2').value;
  if (p1 !== p2) { showToast('Peringatan', 'Kata sandi tidak cocok.', 'warning'); return; }
  gsrun({
    success: res => {
      showToast(res.success ? 'Berhasil' : 'Gagal', res.message, res.success ? 'success' : 'danger');
      if (res.success) navigateTo('login', { noHistory: true });
    }
  }).resetSandi(token, p1);
}

// ════════════════════════════════════════════════════════
// HALAMAN PUBLIK: CARI & PERBARUI DATA SAYA (TANPA LOGIN)
// Anggota alumni tidak punya akun/login sama sekali. Di sini mereka mencari
// datanya sendiri via nama/angkatan, lalu bisa mengajukan pembaruan data
// (tetap perlu persetujuan Pengurus) dan mencetak/mengunduh kartu digital
// mereka sendiri jika sudah berstatus Disetujui.
// ════════════════════════════════════════════════════════
let cariDataTerpilih = null;

function pageCariDataSaya() {
  hideNavigation();
  const rightHtml = `
    <h2 class="auth-right-heading">Cari &amp; Perbarui Data Saya</h2>
    <p class="auth-right-subtext">Tidak perlu login. Masukkan nama lengkap dan/atau angkatan Anda untuk menemukan data keanggotaan.</p>
    <form onsubmit="handleCariDataSaya(event)" class="space-y-4">
      <div><label class="form-label">Nama Lengkap</label><input class="form-input" id="cariNama" placeholder="Contoh: Ahmad Fauzi"></div>
      <div><label class="form-label">Angkatan</label><input class="form-input" id="cariAngkatan" placeholder="Contoh: 2015"></div>
      <button type="submit" class="btn-primary w-full justify-center py-2.5"><span class="material-symbols-outlined text-[18px]">search</span> Cari Data Saya</button>
    </form>
    <div id="cariHasilArea" class="mt-5"></div>
    <div class="auth-info-callout"><div class="icon-wrap">${iconInfo()}</div><div>Untuk menjaga privasi, kontak pribadi (email/No. HP) tidak ditampilkan utuh di halaman ini. Jika data Anda belum ada, silakan <a href="javascript:void(0)" onclick="navigateTo('daftar', { noHistory: true })" class="text-primary font-semibold hover:underline">daftar terlebih dahulu</a>.</div></div>`;
  setContainer(publicShell('cari-data-saya', `<div class="beranda-content"><div class="auth-right-inner">${rightHtml}</div></div>`, { hideFooter: true }));
}

function handleCariDataSaya(e) {
  e.preventDefault();
  const nama = document.getElementById('cariNama').value.trim();
  const angkatan = document.getElementById('cariAngkatan').value.trim();
  const area = document.getElementById('cariHasilArea');
  area.innerHTML = '<div class="flex justify-center py-4"><span class="spinner-inline"></span></div>';
  gsrun({
    success: res => {
      if (!res.success) { area.innerHTML = '<p class="text-xs text-ink-soft text-center py-3">' + escapeHtml(res.message) + '</p>'; return; }
      renderHasilCariData(res.data);
    },
    fail: err => { area.innerHTML = '<p class="text-xs text-ink-soft text-center py-3">' + escapeHtml(err.message) + '</p>'; }
  }).cariAnggotaPublik(nama, angkatan);
}

function renderHasilCariData(list) {
  const area = document.getElementById('cariHasilArea');
  area.innerHTML = `
    <p class="text-xs text-ink-soft mb-2">${list.length} data ditemukan. Klik nama Anda untuk melanjutkan.</p>
    <div class="space-y-2">
      ${list.map(a => `
        <button type="button" class="w-full text-left card card-pad" style="cursor:pointer;" onclick="pilihHasilCariData('${a.id_record}')">
          <div class="flex items-center justify-between gap-2">
            <div>
              <div class="font-semibold text-ink text-sm">${escapeHtml(a.nama)}</div>
              <div class="text-xs text-ink-soft">${escapeHtml(a.prodi||'-')} · Angkatan ${escapeHtml(a.angkatan)} · ${escapeHtml(a.instansi||'-')}</div>
            </div>
            ${badgeVerifikasi(a.status_verifikasi)}
          </div>
        </button>`).join('')}
    </div>`;
}

function pilihHasilCariData(idRecord) {
  const area = document.getElementById('cariHasilArea');
  area.innerHTML = '<div class="flex justify-center py-4"><span class="spinner-inline"></span></div>';
  gsrun({
    success: res => {
      if (!res.success) { area.innerHTML = '<p class="text-xs text-ink-soft text-center py-3">' + escapeHtml(res.message) + '</p>'; return; }
      cariDataTerpilih = res.data;
      renderDetailDataSaya(res.data);
    }
  }).getDetailAnggotaPublik(idRecord);
}

function renderDetailDataSaya(a) {
  const area = document.getElementById('cariHasilArea');
  const bisaCetak = a.status_verifikasi === 'Disetujui';
  area.innerHTML = `
    <div class="card card-pad">
      <div class="flex items-center justify-between mb-3">
        <div>
          <div class="font-head font-bold text-ink">${escapeHtml(a.nama)}</div>
          <div class="text-xs text-ink-soft font-mono">${escapeHtml(a.id_member || 'Belum diterbitkan')}</div>
        </div>
        ${badgeVerifikasi(a.status_verifikasi)}
      </div>
      <div class="grid grid-cols-2 gap-2 text-xs mb-4">
        <div><span class="text-ink-soft">Prodi</span><div class="font-semibold">${escapeHtml(a.prodi||'-')}</div></div>
        <div><span class="text-ink-soft">Angkatan</span><div class="font-semibold">${escapeHtml(a.angkatan||'-')}</div></div>
        <div><span class="text-ink-soft">Instansi</span><div class="font-semibold">${escapeHtml(a.instansi||'-')}</div></div>
        <div><span class="text-ink-soft">Email</span><div class="font-semibold">${escapeHtml(a.email_samar||'-')}</div></div>
      </div>
      <div class="flex flex-wrap gap-2 mb-4">
        <button class="btn-primary" onclick="bukaFormPerubahanPublik()"><span class="material-symbols-outlined text-[18px]">edit</span> Ajukan Pembaruan Data</button>
        <button class="btn-secondary" onclick="cetakKartuPublikHandler('${a.id_record}')" ${bisaCetak ? '' : 'disabled'}><span class="material-symbols-outlined text-[18px]">badge</span> Cetak / Unduh Kartu Digital</button>
      </div>
      ${bisaCetak ? '' : '<p class="text-xs text-ink-soft mb-2">Kartu digital tersedia setelah pendaftaran/pembaruan Anda disetujui Pengurus.</p>'}
      <div id="formPerubahanPublikArea"></div>
    </div>`;
}

function bukaFormPerubahanPublik() {
  const a = cariDataTerpilih;
  if (!a) return;
  const area = document.getElementById('formPerubahanPublikArea');
  area.innerHTML = `
    <div class="garis-pemisah" style="border-top:1px solid var(--border-color);margin:1rem 0;"></div>
    <h4 class="font-head font-semibold text-ink mb-3">Ajukan Pembaruan Data</h4>
    <div class="space-y-3">
      <div><label class="form-label">Nama Lengkap</label><input class="form-input" id="pp_nama" value="${escapeHtml(a.nama||'')}"></div>
      <div><label class="form-label">No. HP / WhatsApp</label><input class="form-input" id="pp_no_hp" placeholder="${escapeHtml(a.no_hp_samar||'')}"></div>
      <div><label class="form-label">Program Studi</label>
        <select class="form-select" id="pp_prodi">${PRODI_OPTS.map(p => '<option value="'+p[0]+'"'+(a.prodi===p[0]?' selected':'')+'>'+p[1]+'</option>').join('')}</select>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="form-label">Angkatan</label><input class="form-input" id="pp_angkatan" value="${escapeHtml(a.angkatan||'')}"></div>
        <div><label class="form-label">Tahun Kelulusan</label><input class="form-input" id="pp_tahun_kelulusan" value="${escapeHtml(a.tahun_kelulusan||'')}"></div>
      </div>
      <div><label class="form-label">Status Kepegawaian</label>
        <select class="form-select" id="pp_status_kepegawaian">${STATUS_KEPEGAWAIAN_OPTS.map(s => '<option value="'+s+'"'+(a.status_kepegawaian===s?' selected':'')+'>'+s+'</option>').join('')}</select>
      </div>
      <div><label class="form-label">Instansi Penempatan</label><input class="form-input" id="pp_instansi" value="${escapeHtml(a.instansi||'')}"></div>
      <div><label class="form-label">Jabatan Terakhir</label><input class="form-input" id="pp_jabatan_terakhir" value="${escapeHtml(a.jabatan_terakhir||'')}"></div>
    </div>
    <p class="text-xs text-ink-soft mt-3">Kosongkan No. HP jika tidak berubah. Perubahan akan ditinjau Pengurus sebelum berlaku di data resmi.</p>
    <div class="flex justify-end mt-3"><button class="btn-accent" id="btnKirimPerubahanPublik" onclick="submitPerubahanPublik()">Kirim Pengajuan</button></div>`;
}

function submitPerubahanPublik() {
  const a = cariDataTerpilih;
  if (!a) return;
  const payload = {
    nama: document.getElementById('pp_nama').value.trim(),
    prodi: document.getElementById('pp_prodi').value,
    angkatan: document.getElementById('pp_angkatan').value.trim(),
    tahun_kelulusan: document.getElementById('pp_tahun_kelulusan').value.trim(),
    status_kepegawaian: document.getElementById('pp_status_kepegawaian').value,
    instansi: document.getElementById('pp_instansi').value.trim(),
    jabatan_terakhir: document.getElementById('pp_jabatan_terakhir').value.trim()
  };
  const noHpBaru = document.getElementById('pp_no_hp').value.trim();
  if (noHpBaru) payload.no_hp = noHpBaru;

  const btn = document.getElementById('btnKirimPerubahanPublik');
  btn.innerHTML = '<span class="spinner-inline"></span> Mengirim...'; btn.disabled = true;
  gsrun({
    success: res => {
      btn.disabled = false; btn.innerHTML = 'Kirim Pengajuan';
      showToast(res.success ? 'Terkirim' : 'Gagal', res.message, res.success ? 'success' : 'danger');
      if (res.success) document.getElementById('formPerubahanPublikArea').innerHTML = '';
    },
    fail: err => { btn.disabled = false; btn.innerHTML = 'Kirim Pengajuan'; showToast('Error', err.message, 'danger'); }
  }).ajukanPerubahanProfilPublik(a.id_record, payload);
}

function cetakKartuPublikHandler(idRecord) {
  showToast('Memproses', 'Menyiapkan kartu digital…', 'info');
  gsrun({
    success: res => {
      if (res.success) tampilkanLinkUnduhan(res.data.url, 'Kartu digital siap.');
      else showToast('Belum Tersedia', res.message, 'warning');
    },
    fail: err => showToast('Error', err.message, 'danger')
  }).unduhKartuPublik(idRecord);
}

// ════════════════════════════════════════════════════════
// DASBOR PENGURUS
// ════════════════════════════════════════════════════════
function pageDasborPengurus() {
  if (!requireLogin()) return;
  setContainer('<div class="page-loading"><div class="app-spinner" style="border-top-color:#0B2A5B"></div></div>');
  gsrun({
    success: renderDasborPengurus,
    fail: err => renderErrorBox('app-container', err, 'pageDasborPengurus')
  }).getDashboardPengurus(AppState.sessionToken);
}

function renderDasborPengurus(res) {
  if (!res.success) { renderErrorBox('app-container', { message: res.message }, 'pageDasborPengurus'); return; }
  const d = res.data;
  renderNavigation('Pengurus', { menunggu: d.menunggu, perubahan: d.perubahanMenunggu });

  setContainer(`
  <div class="flex flex-col w-full gap-5">
    <div class="hero-banner">
      <div style="position:relative;max-width:640px;">
        <span class="hero-eyebrow">${iconShieldCheck()} Otoritas Eksekutif DPD Kaltim</span>
        <h1 class="hero-title">Selamat Datang, <strong>${escapeHtml(AppState.userEmail || 'Pengurus')}</strong></h1>
        <p class="hero-desc">Kendali penuh konsolidasi keanggotaan alumni perhubungan darat, penerbitan KTA digital otomatis, dan validasi berkas terpadu DPD Kalimantan Timur.</p>
        <div class="hero-chips">
          <span class="hero-chip"><span class="dot"></span> Kuota Email Tersisa: ${d.kuotaEmail}/100</span>
          <span class="hero-chip">${iconCard()} Kartu Siap Terbit Otomatis</span>
        </div>
      </div>
      <button class="btn-accent" style="position:relative;" onclick="navigateTo('verifikasi-pendaftaran')">${iconUserPlus()} Verifikasi Pendaftar Baru ${d.menunggu > 0 ? '<span class="nav-badge" style="margin-left:4px;">'+d.menunggu+'</span>' : ''}</button>
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="stat-card-v2 card-accent">
        <div class="stat-card-v2-top"><div><div class="stat-card-v2-label">Total Alumni Terdaftar</div><div class="stat-card-v2-value">${d.total}</div></div><div class="stat-card-v2-icon" style="background:rgba(11,42,91,.1);color:var(--navy)">${iconShieldCheck()}</div></div>
        <div class="stat-card-v2-foot">Basis data DPD Kalimantan Timur</div>
      </div>
      <div class="stat-card-v2 card-accent green">
        <div class="stat-card-v2-top"><div><div class="stat-card-v2-label">Status KTA Aktif</div><div class="stat-card-v2-value">${d.aktif}</div></div><div class="stat-card-v2-icon" style="background:rgba(16,185,129,.12);color:#059669">${iconCard()}</div></div>
        <div class="stat-card-v2-foot up">${d.total ? Math.round(d.aktif/d.total*100) : 0}% dari total anggota</div>
      </div>
      <div class="stat-card-v2 card-accent gold">
        <div class="stat-card-v2-top"><div><div class="stat-card-v2-label">Menunggu Verifikasi</div><div class="stat-card-v2-value">${d.menunggu}</div></div><div class="stat-card-v2-icon" style="background:rgba(212,167,44,.15);color:#B45309">${iconUserPlus()}</div></div>
        <div class="stat-card-v2-foot warn">${d.menunggu > 0 ? 'Tindakan diperlukan' : 'Tidak ada antrean'}</div>
      </div>
      <div class="stat-card-v2 card-accent danger">
        <div class="stat-card-v2-top"><div><div class="stat-card-v2-label">Kedaluwarsa &lt;30 Hari</div><div class="stat-card-v2-value">${d.kedaluwarsa}</div></div><div class="stat-card-v2-icon" style="background:rgba(239,68,68,.12);color:#DC2626">${iconLock()}</div></div>
        <div class="stat-card-v2-foot ${d.kedaluwarsa > 0 ? 'danger' : ''}">${d.kedaluwarsa > 0 ? 'Perlu pengingat perpanjangan' : 'Aman'}</div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <div class="lg:col-span-7 card">
        <div class="card-pad border-b flex items-center justify-between" style="border-color:var(--border-color)">
          <div><h2 class="font-head font-semibold text-ink">Verifikasi Pendaftar Baru</h2><p class="text-xs text-ink-soft">${d.menunggu} menunggu tindakan</p></div>
          <button class="btn-ghost" onclick="navigateTo('verifikasi-pendaftaran')">Lihat Semua</button>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Profil Pendaftar</th><th>No. Taruna</th><th>Instansi</th><th>Tanggal</th><th></th></tr></thead>
            <tbody>
              ${d.pendaftarTerbaru.length === 0 ? '<tr><td colspan="5" class="text-center py-6 text-ink-soft">Tidak ada pendaftar menunggu.</td></tr>' :
                d.pendaftarTerbaru.map(a => `
                <tr>
                  <td><div class="font-semibold">${escapeHtml(a.nama)}</div><div class="text-xs text-ink-soft">${escapeHtml(a.email)}</div></td>
                  <td class="font-mono text-xs">${escapeHtml(a.nomor_taruna)}</td>
                  <td class="text-xs">${escapeHtml(a.instansi)}</td>
                  <td class="text-xs">${fmtTanggal(a.dibuat_pada)}</td>
                  <td><a href="javascript:void(0)" onclick="navigateTo('verifikasi-pendaftaran')" class="icon-btn"><span class="material-symbols-outlined text-[18px]">arrow_forward</span></a></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="lg:col-span-5 flex flex-col gap-5">
        <div class="card card-pad">
          <h3 class="font-head font-semibold text-ink mb-3">Status Kepegawaian</h3>
          <p class="text-xs text-ink-soft mb-3">Komposisi aparatur sipil negara dan non-ASN.</p>
          ${Object.entries(d.perKepegawaian).sort((a,b)=>b[1]-a[1]).map(([k,v]) => `
            <div class="bar-row"><span>${escapeHtml(k||'-')}</span><span class="font-bold">${v} (${d.total?Math.round(v/d.total*100):0}%)</span></div>
            <div class="bar-track"><div class="bar-fill" style="width:${d.total?Math.round(v/d.total*100):0}%"></div></div>
          `).join('')}
        </div>
        <div class="card card-pad">
          <h3 class="font-head font-semibold text-ink mb-3">Aktivitas Sistem Terakhir</h3>
          <div class="space-y-3">
            ${d.logTerbaru.map(l => `
              <div class="flex items-start gap-2 text-xs">
                <span class="material-symbols-outlined text-[16px] text-primary mt-0.5">history</span>
                <div><div class="font-semibold text-ink">${escapeHtml(l.aksi)}</div><div class="text-ink-soft">${escapeHtml(l.detail)} · ${fmtTanggal(l.waktu)}</div></div>
              </div>`).join('') || '<p class="text-xs text-ink-soft">Belum ada aktivitas.</p>'}
          </div>
        </div>
      </div>
    </div>
  </div>`);
}

// ════════════════════════════════════════════════════════
// VERIFIKASI PENDAFTARAN
// ════════════════════════════════════════════════════════
function pageVerifikasi() {
  if (!requireLogin()) return;
  setContainer('<div class="page-loading"><div class="app-spinner" style="border-top-color:#0B2A5B"></div></div>');
  gsrun({ success: r => renderVerifikasi(r) }).getPendaftarMenunggu(AppState.sessionToken);
}
let verifikasiSelectedId = null;
function renderVerifikasi(res) {
  if (!res.success) { showToast('Error', res.message, 'danger'); return; }
  renderNavigation('Pengurus', { menunggu: res.data.length });
  window.__daftarMenunggu = res.data;
  verifikasiSelectedId = res.data.length ? res.data[0].id_record : null;
  setContainer(`
  <div class="flex flex-col gap-5">
    <div class="card card-pad flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <div class="flex items-center gap-2 flex-wrap"><h1 class="font-head font-bold text-xl text-ink">Verifikasi Pendaftaran Calon Anggota</h1>
          <span class="badge badge-menunggu">${res.data.length} Pendaftar Menunggu Verifikasi</span>
        </div>
        <p class="text-sm text-ink-soft mt-1">Tinjau dan verifikasi data alumni yang mendaftar mandiri sebelum resmi diterbitkan ID Member serta Kartu Digital.</p>
      </div>
      ${res.data.length > 0 ? '<button class="btn-accent shrink-0" onclick="setujuiSemuaMenunggu(this)"><span class="material-symbols-outlined text-[18px]">done_all</span>Setujui Semua Menunggu</button>' : ''}
    </div>

    <div id="verifikasiDetailPanel"></div>

    <div class="card">
      <div class="card-pad border-b flex items-center justify-between" style="border-color:var(--border-color)">
        <h3 class="font-head font-semibold text-ink">Daftar Antrean Verifikasi Alumni</h3>
        <span class="text-xs text-ink-soft">Menampilkan ${res.data.length} pendaftar menunggu</span>
      </div>
      <div class="table-wrap" id="verifikasiList">
        ${res.data.length === 0 ? '<div class="text-center py-10 text-ink-soft">Tidak ada pendaftar menunggu verifikasi.</div>' : renderTabelAntrean(res.data)}
      </div>
    </div>
  </div>`);
  renderVerifikasiDetail();
}
function renderTabelAntrean(rows) {
  return `<table class="data-table">
    <thead><tr><th>Nama &amp; No. Taruna</th><th>Prodi / Lulus</th><th>Instansi &amp; Jabatan</th><th>Kontak</th><th class="text-center">Aksi</th></tr></thead>
    <tbody id="verifikasiTbody">${rows.map(a => `
      <tr id="pend-${a.id_record}" style="cursor:pointer;${verifikasiSelectedId===a.id_record?'background:var(--bg-card-alt)':''}" onclick="pilihPendaftar('${a.id_record}')">
        <td><div class="font-semibold">${escapeHtml(a.nama)}</div><div class="text-xs text-ink-soft font-mono">${escapeHtml(a.nomor_taruna)}</div></td>
        <td class="text-xs">${escapeHtml(a.prodi)}<br><span class="text-ink-soft">Angkatan ${escapeHtml(a.angkatan)} (${escapeHtml(a.tahun_kelulusan)})</span></td>
        <td class="text-xs">${escapeHtml(a.instansi)}<br><span class="text-ink-soft">${escapeHtml(a.jabatan_terakhir)}</span></td>
        <td class="text-xs">${escapeHtml(a.no_hp)}<br><span class="text-ink-soft">${escapeHtml(a.email)}</span></td>
        <td class="text-center" onclick="event.stopPropagation()">
          <button class="icon-btn" title="Lihat Detail" onclick="pilihPendaftar('${a.id_record}')"><span class="material-symbols-outlined text-[18px]">visibility</span></button>
          <button class="icon-btn" title="Setujui" onclick="setujuiSatu('${a.id_record}', this)"><span class="material-symbols-outlined text-[18px]" style="color:#059669">check_circle</span></button>
          <button class="icon-btn" title="Tolak" onclick="openTolakModal('${a.id_record}')"><span class="material-symbols-outlined text-[18px]" style="color:#DC2626">cancel</span></button>
        </td>
      </tr>`).join('')}</tbody>
  </table>`;
}
function pilihPendaftar(id) {
  verifikasiSelectedId = id;
  document.querySelectorAll('#verifikasiTbody tr').forEach(tr => tr.style.background = tr.id === 'pend-' + id ? 'var(--bg-card-alt)' : '');
  renderVerifikasiDetail();
}
function renderVerifikasiDetail() {
  const panel = document.getElementById('verifikasiDetailPanel');
  if (!panel) return;
  const list = window.__daftarMenunggu || [];
  const a = list.find(x => x.id_record === verifikasiSelectedId);
  if (!a) { panel.innerHTML = ''; return; }
  panel.innerHTML = `
  <div class="card card-pad">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <div class="lg:col-span-3 flex flex-col items-center text-center gap-2 lg:border-r" style="border-color:var(--border-color)">
        <div class="topbar-user-avatar" style="width:64px;height:64px;font-size:22px;">${escapeHtml((a.nama||'?').charAt(0).toUpperCase())}</div>
        <span class="badge badge-menunggu">Pendaftar Baru</span>
        <div class="font-head font-bold text-ink">${escapeHtml(a.nama)}</div>
        <div class="text-xs text-ink-soft font-mono">${escapeHtml(a.nomor_taruna)}</div>
        <div class="text-xs text-ink-soft mt-1">${fmtTanggal(a.dibuat_pada)}</div>
        <div class="text-xs text-ink-soft">${escapeHtml(a.email)}</div>
        <div class="text-xs text-ink-soft">${escapeHtml(a.no_hp)}</div>
      </div>
      <div class="lg:col-span-9">
        <div class="flex items-center justify-between mb-3">
          <h4 class="font-head font-semibold text-ink flex items-center gap-2">${iconShieldCheck()} Data Akademik &amp; Kedinasan</h4>
          <span class="badge badge-menunggu">Status: ${escapeHtml(a.status_kepegawaian||'-')}</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-4">
          <div class="card card-pad" style="background:var(--bg-card-alt)"><div class="text-[10px] uppercase tracking-wide text-ink-soft font-bold mb-1">Program Studi</div><div class="font-semibold">${escapeHtml(a.prodi)}</div></div>
          <div class="card card-pad" style="background:var(--bg-card-alt)"><div class="text-[10px] uppercase tracking-wide text-ink-soft font-bold mb-1">Angkatan &amp; Kelulusan</div><div class="font-semibold">Angkatan ${escapeHtml(a.angkatan)} · ${escapeHtml(a.tahun_kelulusan)}</div></div>
          <div class="card card-pad" style="background:var(--bg-card-alt)"><div class="text-[10px] uppercase tracking-wide text-ink-soft font-bold mb-1">Instansi Penempatan</div><div class="font-semibold">${escapeHtml(a.instansi)}</div></div>
          <div class="card card-pad" style="background:var(--bg-card-alt)"><div class="text-[10px] uppercase tracking-wide text-ink-soft font-bold mb-1">Jabatan Terakhir</div><div class="font-semibold">${escapeHtml(a.jabatan_terakhir)}</div></div>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="btn-danger" onclick="openTolakModal('${a.id_record}')"><span class="material-symbols-outlined text-[18px]">cancel</span> Tolak Pendaftaran</button>
          <button class="btn-primary" onclick="setujuiSatu('${a.id_record}', this)"><span class="material-symbols-outlined text-[18px]">verified</span> Setujui &amp; Terbitkan Kartu Anggota</button>
        </div>
      </div>
    </div>
  </div>`;
}
// Cegah klik ganda: nonaktifkan tombol SEKETIKA saat diklik (bukan menunggu respons
// server dulu), karena proses ini agak lambat (bikin PDF kartu + kirim email) dan user
// cenderung klik lagi kalau terasa tidak merespons. Server (setujuiPendaftar) sekarang
// juga sudah punya guard idempoten sendiri sebagai lapis kedua, tapi mencegah request
// kedua terkirim sama sekali di sini lebih baik daripada mengandalkan server saja.
function nonaktifkanBtnSementara(btn, labelProses) {
  if (!btn || btn.disabled) return false;
  btn.disabled = true;
  btn.dataset.htmlAsli = btn.innerHTML;
  btn.style.opacity = '.6';
  btn.style.cursor = 'not-allowed';
  btn.innerHTML = '<span class="app-spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle;"></span> ' + (labelProses || 'Memproses…');
  return true;
}
function aktifkanKembaliBtn(btn) {
  if (!btn) return;
  btn.disabled = false;
  btn.style.opacity = '';
  btn.style.cursor = '';
  if (btn.dataset.htmlAsli) btn.innerHTML = btn.dataset.htmlAsli;
}
function setujuiSatu(id, btnEl) {
  if (btnEl && !nonaktifkanBtnSementara(btnEl, 'Menyetujui…')) return; // sudah diproses, abaikan klik ganda
  gsrun({
    success: r => {
      if (r.success) { showToast('Berhasil', r.message, 'success'); pageVerifikasi(); }
      else { showToast('Gagal', r.message, 'danger'); aktifkanKembaliBtn(btnEl); }
    },
    fail: err => { showToast('Error', err.message || String(err), 'danger'); aktifkanKembaliBtn(btnEl); }
  }).setujuiPendaftar(AppState.sessionToken, id);
}
function setujuiSemuaMenunggu(btnEl) {
  if (btnEl && btnEl.disabled) return;
  const ids = (window.__daftarMenunggu || []).map(a => a.id_record);
  openConfirmModal('Setujui Semua', 'Setujui ' + ids.length + ' pendaftar sekaligus? Kartu digital akan diterbitkan otomatis.', () => {
    closeConfirmModal();
    if (btnEl) nonaktifkanBtnSementara(btnEl, 'Memproses…');
    gsrun({
      success: r => { showToast('Selesai', r.message, 'success'); pageVerifikasi(); },
      fail: err => { showToast('Error', err.message || String(err), 'danger'); aktifkanKembaliBtn(btnEl); }
    }).setujuiMassal(AppState.sessionToken, ids);
  });
}
function openTolakModal(id) {
  openConfirmModal('Tolak Pendaftar', 'Masukkan alasan penolakan:', () => {
    const alasan = document.getElementById('alasanTolak').value.trim();
    if (!alasan) { showToast('Peringatan', 'Alasan wajib diisi.', 'warning'); return; }
    closeConfirmModal();
    gsrun({
      success: r => {
        if (r.success) { showToast('Ditolak', r.message, 'success'); pageVerifikasi(); }
        else showToast('Gagal', r.message, 'danger');
      }
    }).tolakPendaftar(AppState.sessionToken, id, alasan);
  }, '<textarea id="alasanTolak" class="form-input" rows="3" placeholder="Contoh: Scan SK tidak jelas"></textarea>');
  document.getElementById('confirmActionBtn').className = 'btn-danger';
}

// ════════════════════════════════════════════════════════
// DATA ALUMNI (CRUD, MASSAL, EXPORT)
// ════════════════════════════════════════════════════════
let alumniFilter = { search: '', prodi: 'ALL', angkatan: 'ALL', statusKepegawaian: 'ALL', statusVerifikasi: 'ALL', page: 1, pageSize: 25 };
let selectedAlumni = new Set();

function pageDataAlumni() {
  if (!requireLogin()) return;
  renderNavigation('Pengurus');
  setContainer(`
  <div class="flex flex-col gap-4">
    <div class="breadcrumb"><span class="material-symbols-outlined text-[16px]">folder_open</span> Pangkalan Data DPD <span class="sep">›</span> Kelola Master Alumni</div>
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      <div><h1 class="font-head font-bold text-xl text-ink">Database Master Alumni IKALLHUBDAT Kaltim</h1><p class="text-sm text-ink-soft">Cari, filter, tambah, ubah, dan kelola data alumni.</p></div>
      <div class="flex flex-wrap gap-2">
        <button class="btn-ghost" onclick="eksporDataAlumni()"><span class="material-symbols-outlined text-[18px]">table_view</span> Export Excel</button>
        <button class="btn-primary" onclick="openFormAnggota(null)"><span class="material-symbols-outlined text-[18px]">person_add</span> Tambah Anggota</button>
      </div>
    </div>
    <div id="alumniStatStrip" class="grid grid-cols-2 lg:grid-cols-4 gap-4"></div>
    <div class="card card-pad">
      <div class="flex flex-col lg:flex-row gap-3 mb-3">
        <input id="alumniSearch" class="form-input flex-1" placeholder="Cari nama, ID member, NOTAR, instansi, email…" value="${escapeHtml(alumniFilter.search)}" onkeyup="if(event.key==='Enter')applyAlumniFilter()">
        <button class="btn-secondary" onclick="applyAlumniFilter()">Cari</button>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <select class="form-select" id="filterProdi" onchange="applyAlumniFilter()">
          <option value="ALL">Semua Prodi</option>${PRODI_OPTS.map(p=>'<option value="'+p[0]+'">'+p[1]+'</option>').join('')}
        </select>
        <input class="form-input" id="filterAngkatan" placeholder="Angkatan" onkeyup="if(event.key==='Enter')applyAlumniFilter()">
        <select class="form-select" id="filterKepegawaian" onchange="applyAlumniFilter()">
          <option value="ALL">Semua Kepegawaian</option>${STATUS_KEPEGAWAIAN_OPTS.map(s=>'<option value="'+s+'">'+s+'</option>').join('')}
        </select>
        <select class="form-select" id="filterVerifikasi" onchange="applyAlumniFilter()">
          <option value="ALL">Semua Status</option><option value="Menunggu">Menunggu</option><option value="Disetujui">Disetujui</option><option value="Ditolak">Ditolak</option>
        </select>
      </div>
    </div>
    <div id="bulkBar" class="hidden card card-pad flex flex-wrap items-center justify-between gap-2" style="background:var(--navy);color:#fff">
      <span><strong id="selCount">0</strong> data dipilih</span>
      <div class="flex gap-2 flex-wrap">
        <button class="btn-ghost" onclick="openUbahMassalModal()">Ubah Massal</button>
        <button class="btn-ghost" onclick="kirimUlangMassalTerpilih()">Kirim Ulang Kartu</button>
        <button class="btn-danger" onclick="openHapusMassalModal()">Hapus Massal</button>
      </div>
    </div>
    <div class="card"><div id="tabelAlumniWrap" class="table-wrap"><div class="page-loading"><div class="app-spinner" style="border-top-color:#0B2A5B"></div></div></div>
    <div id="paginasiAlumni" class="flex items-center justify-between px-4 py-3 text-xs text-ink-soft"></div></div>
  </div>`);
  muatDataAlumni();
  gsrun({ success: renderAlumniStatStrip }).getDashboardPengurus(AppState.sessionToken);
}
function renderAlumniStatStrip(res) {
  if (!res.success) return;
  const d = res.data;
  setHtmlAman('alumniStatStrip', `
    <div class="stat-card-v2 card-accent">
      <div class="stat-card-v2-top"><div><div class="stat-card-v2-label">Anggota Aktif</div><div class="stat-card-v2-value">${d.aktif}</div></div><div class="stat-card-v2-icon" style="background:rgba(11,42,91,.1);color:var(--navy)">${iconShieldCheck()}</div></div>
      <div class="stat-card-v2-foot up">${d.total?Math.round(d.aktif/d.total*100):0}% terverifikasi</div>
    </div>
    <div class="stat-card-v2 card-accent green">
      <div class="stat-card-v2-top"><div><div class="stat-card-v2-label">Total Alumni</div><div class="stat-card-v2-value">${d.total}</div></div><div class="stat-card-v2-icon" style="background:rgba(16,185,129,.12);color:#059669">${iconCard()}</div></div>
      <div class="stat-card-v2-foot">Seluruh basis data DPD</div>
    </div>
    <div class="stat-card-v2 card-accent danger">
      <div class="stat-card-v2-top"><div><div class="stat-card-v2-label">Masa Berlaku Kedaluwarsa</div><div class="stat-card-v2-value">${d.kedaluwarsa}</div></div><div class="stat-card-v2-icon" style="background:rgba(239,68,68,.12);color:#DC2626">${iconLock()}</div></div>
      <div class="stat-card-v2-foot ${d.kedaluwarsa>0?'danger':''}">Perlu pembaruan SK &lt;30 hari</div>
    </div>
    <div class="stat-card-v2 card-accent gold">
      <div class="stat-card-v2-top"><div><div class="stat-card-v2-label">Menunggu Verifikasi</div><div class="stat-card-v2-value">${d.menunggu}</div></div><div class="stat-card-v2-icon" style="background:rgba(212,167,44,.15);color:#B45309">${iconUserPlus()}</div></div>
      <div class="stat-card-v2-foot warn">Terhubung Google Sheet DPD</div>
    </div>`);
}

function applyAlumniFilter() {
  alumniFilter.search = document.getElementById('alumniSearch').value.trim();
  alumniFilter.prodi = document.getElementById('filterProdi').value;
  alumniFilter.angkatan = document.getElementById('filterAngkatan').value.trim() || 'ALL';
  alumniFilter.statusKepegawaian = document.getElementById('filterKepegawaian').value;
  alumniFilter.statusVerifikasi = document.getElementById('filterVerifikasi').value;
  alumniFilter.page = 1;
  muatDataAlumni();
}

function muatDataAlumni() {
  gsrun({
    success: renderTabelAlumni,
    fail: err => renderErrorBox('tabelAlumniWrap', err, 'muatDataAlumni')
  }).getAnggotaList(AppState.sessionToken, alumniFilter);
}

function renderTabelAlumni(res) {
  if (!res.success) { renderErrorBox('tabelAlumniWrap', { message: res.message }, 'muatDataAlumni'); return; }
  const rows = res.data.rows;
  window.__alumniRows = rows;
  setHtmlAman('tabelAlumniWrap', `
    <table class="data-table">
      <thead><tr>
        <th><input type="checkbox" onchange="toggleSelectAllAlumni(this)"></th>
        <th>ID Member</th><th>Nama</th><th>NOTAR</th><th>Prodi/Angkatan</th><th>Instansi</th><th>Kepegawaian</th><th>Status</th><th class="text-center">Aksi</th>
      </tr></thead>
      <tbody>
        ${rows.length === 0 ? '<tr><td colspan="9" class="text-center py-8 text-ink-soft">Tidak ada data.</td></tr>' : rows.map(a => `
        <tr>
          <td><input type="checkbox" class="rowchk" data-id="${a.id_record}" ${selectedAlumni.has(a.id_record)?'checked':''} onchange="toggleSelectAlumni('${a.id_record}', this)"></td>
          <td class="font-mono text-xs">${escapeHtml(a.id_member || '-')}</td>
          <td><div class="font-semibold">${escapeHtml(a.nama)}</div><div class="text-xs text-ink-soft">${escapeHtml(a.email)}</div></td>
          <td class="font-mono text-xs">${escapeHtml(a.nomor_taruna)}</td>
          <td>${escapeHtml(a.prodi)} / ${escapeHtml(a.angkatan)}</td>
          <td class="text-xs">${escapeHtml(a.instansi)}</td>
          <td class="text-xs">${escapeHtml(a.status_kepegawaian)}</td>
          <td>${badgeVerifikasi(a.status_verifikasi)}${a.status_verifikasi==='Disetujui' ? '<div class="mt-1">'+badgeAnggota(a.status_anggota)+'</div>' : ''}</td>
          <td class="text-center">
            <button class="icon-btn" title="Ubah" onclick='openFormAnggota(${JSON.stringify(a)})'><span class="material-symbols-outlined text-[18px]">edit_note</span></button>
            ${a.url_kartu_pdf ? '<a class="icon-btn" title="Unduh Kartu" href="'+a.url_kartu_pdf+'" target="_blank"><span class="material-symbols-outlined text-[18px]">badge</span></a>' : ''}
            <button class="icon-btn" title="Hapus" onclick="hapusSatuAnggota('${a.id_record}','${escapeHtml(a.nama)}')"><span class="material-symbols-outlined text-[18px]">delete</span></button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>`);
  const totalHal = Math.ceil(res.data.total / res.data.pageSize) || 1;
  setHtmlAman('paginasiAlumni', `
    <span>Menampilkan ${rows.length} dari ${res.data.total} alumni — Halaman ${res.data.page}/${totalHal}</span>
    <div class="flex gap-1">
      <button class="icon-btn" ${res.data.page<=1?'disabled':''} onclick="gantiHalamanAlumni(${res.data.page-1})"><span class="material-symbols-outlined text-[18px]">chevron_left</span></button>
      <button class="icon-btn" ${res.data.page>=totalHal?'disabled':''} onclick="gantiHalamanAlumni(${res.data.page+1})"><span class="material-symbols-outlined text-[18px]">chevron_right</span></button>
    </div>`);
  updateBulkBar();
}
function gantiHalamanAlumni(p) { alumniFilter.page = p; muatDataAlumni(); }

function toggleSelectAlumni(id, el) { if (el.checked) selectedAlumni.add(id); else selectedAlumni.delete(id); updateBulkBar(); }
function toggleSelectAllAlumni(master) {
  document.querySelectorAll('.rowchk').forEach(cb => { cb.checked = master.checked; toggleSelectAlumni(cb.dataset.id, cb); });
}
function updateBulkBar() {
  const bar = document.getElementById('bulkBar');
  if (!bar) return;
  if (selectedAlumni.size > 0) { bar.classList.remove('hidden'); document.getElementById('selCount').textContent = selectedAlumni.size; }
  else bar.classList.add('hidden');
}

function openFormAnggota(data) {
  const isEdit = !!data;
  const modalHtml = `
    <div class="modal-backdrop" id="formAnggotaModal">
      <div class="modal-card modal-lg">
        <h3 class="font-head font-semibold text-lg text-ink mb-4">${isEdit ? 'Ubah Data Anggota' : 'Tambah Anggota Manual'}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label class="form-label">Nama Lengkap</label><input class="form-input" id="f_nama" value="${isEdit?escapeHtml(data.nama):''}"></div>
          <div><label class="form-label">Nomor Taruna</label><input class="form-input" id="f_nomor_taruna" value="${isEdit?escapeHtml(data.nomor_taruna):''}"></div>
          <div><label class="form-label">Program Studi</label><select class="form-select" id="f_prodi">${PRODI_OPTS.map(p=>'<option value="'+p[0]+'"'+(isEdit&&data.prodi===p[0]?' selected':'')+'>'+p[1]+'</option>').join('')}</select></div>
          <div><label class="form-label">Angkatan</label><input class="form-input" id="f_angkatan" value="${isEdit?escapeHtml(data.angkatan):''}"></div>
          <div><label class="form-label">Tahun Kelulusan</label><input type="number" class="form-input" id="f_tahun_kelulusan" value="${isEdit?escapeHtml(data.tahun_kelulusan):''}"></div>
          <div><label class="form-label">Status Kepegawaian</label><select class="form-select" id="f_status_kepegawaian">${STATUS_KEPEGAWAIAN_OPTS.map(s=>'<option value="'+s+'"'+(isEdit&&data.status_kepegawaian===s?' selected':'')+'>'+s+'</option>').join('')}</select></div>
          <div><label class="form-label">Instansi</label><input class="form-input" id="f_instansi" value="${isEdit?escapeHtml(data.instansi):''}"></div>
          <div><label class="form-label">Jabatan Terakhir</label><input class="form-input" id="f_jabatan_terakhir" value="${isEdit?escapeHtml(data.jabatan_terakhir):''}"></div>
          <div><label class="form-label">No. HP</label><input class="form-input" id="f_no_hp" value="${isEdit?escapeHtml(data.no_hp):''}"></div>
          <div><label class="form-label">Email</label><input type="email" class="form-input" id="f_email" value="${isEdit?escapeHtml(data.email):''}" ${isEdit?'readonly':''}></div>
          ${isEdit ? `
          <div><label class="form-label">Status Anggota</label><select class="form-select" id="f_status_anggota"><option value="Aktif"${data.status_anggota==='Aktif'?' selected':''}>Aktif</option><option value="Tidak Aktif"${data.status_anggota==='Tidak Aktif'?' selected':''}>Tidak Aktif</option></select></div>
          <div><label class="form-label">Masa Berlaku Kartu</label><input type="date" class="form-input" id="f_masa_berlaku_kartu" value="${data.masa_berlaku_kartu ? new Date(data.masa_berlaku_kartu).toISOString().slice(0,10) : ''}"></div>` : ''}
        </div>
        <div class="flex justify-end gap-2 mt-5">
          <button class="btn-secondary" onclick="closeFormAnggotaModal()">Batal</button>
          <button class="btn-primary" id="btnSimpanAnggota" onclick="simpanFormAnggota(${isEdit ? "'"+data.id_record+"'" : 'null'})">Simpan</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}
function closeFormAnggotaModal() { const m = document.getElementById('formAnggotaModal'); if (m) m.remove(); }

function simpanFormAnggota(idRecord) {
  const data = {
    nama: document.getElementById('f_nama').value.trim(),
    nomor_taruna: document.getElementById('f_nomor_taruna').value.trim(),
    prodi: document.getElementById('f_prodi').value,
    angkatan: document.getElementById('f_angkatan').value.trim(),
    tahun_kelulusan: document.getElementById('f_tahun_kelulusan').value.trim(),
    status_kepegawaian: document.getElementById('f_status_kepegawaian').value,
    instansi: document.getElementById('f_instansi').value.trim(),
    jabatan_terakhir: document.getElementById('f_jabatan_terakhir').value.trim(),
    no_hp: document.getElementById('f_no_hp').value.trim(),
    email: document.getElementById('f_email').value.trim()
  };
  if (!data.nama) { showToast('Peringatan', 'Nama wajib diisi.', 'warning'); return; }

  const btn = document.getElementById('btnSimpanAnggota');
  btn.innerHTML = '<span class="spinner-inline"></span>'; btn.disabled = true;

  if (idRecord) {
    data.id_record = idRecord;
    data.status_anggota = document.getElementById('f_status_anggota').value;
    const mb = document.getElementById('f_masa_berlaku_kartu').value;
    if (mb) data.masa_berlaku_kartu = mb;
    gsrun({
      success: r => { closeFormAnggotaModal(); if (r.success) { showToast('Berhasil', r.message, 'success'); muatDataAlumni(); } else showToast('Gagal', r.message, 'danger'); },
      fail: err => { closeFormAnggotaModal(); showToast('Error', err.message, 'danger'); }
    }).ubahAnggota(AppState.sessionToken, data);
  } else {
    gsrun({
      success: r => { closeFormAnggotaModal(); if (r.success) { showToast('Berhasil', r.message, 'success'); muatDataAlumni(); } else showToast('Gagal', r.message, 'danger'); },
      fail: err => { closeFormAnggotaModal(); showToast('Error', err.message, 'danger'); }
    }).tambahAnggota(AppState.sessionToken, data);
  }
}

function hapusSatuAnggota(id, nama) {
  openConfirmModal('Hapus Anggota', 'Hapus data "' + nama + '"? Data akan diarsipkan dan dapat dipulihkan pengurus.', () => {
    closeConfirmModal();
    gsrun({ success: r => { showToast(r.success?'Berhasil':'Gagal', r.message, r.success?'success':'danger'); if (r.success) muatDataAlumni(); } }).hapusAnggota(AppState.sessionToken, id);
  });
}

function openHapusMassalModal() {
  openConfirmModal('Hapus Massal', 'Anda akan menghapus ' + selectedAlumni.size + ' data. Ketik "HAPUS" untuk konfirmasi:', () => {
    const teks = document.getElementById('konfirmasiHapusTeks').value;
    closeConfirmModal();
    gsrun({ success: r => { showToast(r.success?'Berhasil':'Gagal', r.message, r.success?'success':'danger'); if (r.success) { selectedAlumni.clear(); muatDataAlumni(); } } })
      .hapusMassal(AppState.sessionToken, Array.from(selectedAlumni), teks);
  }, '<input id="konfirmasiHapusTeks" class="form-input" placeholder="Ketik HAPUS">');
  document.getElementById('confirmActionBtn').className = 'btn-danger';
}

function openUbahMassalModal() {
  openConfirmModal('Ubah Massal', selectedAlumni.size + ' data akan diperbarui. Isi field yang ingin diubah (kosongkan jika tidak diubah):', () => {
    const fields = {};
    const sa = document.getElementById('um_status_anggota').value;
    const mb = document.getElementById('um_masa_berlaku').value;
    const sk = document.getElementById('um_status_kepegawaian').value;
    if (sa) fields.status_anggota = sa;
    if (mb) fields.masa_berlaku_kartu = mb;
    if (sk) fields.status_kepegawaian = sk;
    closeConfirmModal();
    gsrun({ success: r => { showToast(r.success?'Berhasil':'Gagal', r.message, r.success?'success':'danger'); if (r.success) { selectedAlumni.clear(); muatDataAlumni(); } } })
      .ubahMassal(AppState.sessionToken, Array.from(selectedAlumni), fields);
  }, `
    <div class="space-y-2">
      <select class="form-select" id="um_status_anggota"><option value="">— Status Anggota —</option><option value="Aktif">Aktif</option><option value="Tidak Aktif">Tidak Aktif</option></select>
      <input type="date" class="form-input" id="um_masa_berlaku" placeholder="Masa Berlaku Kartu">
      <select class="form-select" id="um_status_kepegawaian"><option value="">— Status Kepegawaian —</option>${STATUS_KEPEGAWAIAN_OPTS.map(s=>'<option value="'+s+'">'+s+'</option>').join('')}</select>
    </div>`);
  document.getElementById('confirmActionBtn').className = 'btn-primary';
}

function kirimUlangMassalTerpilih() {
  const ids = Array.from(selectedAlumni);
  openConfirmModal('Kirim Ulang Kartu', 'Kirim ulang kartu digital ke ' + ids.length + ' anggota terpilih?', () => {
    closeConfirmModal();
    gsrun({ success: r => showToast(r.success?'Selesai':'Gagal', r.message, r.success?'success':'danger') }).kirimUlangMassal(AppState.sessionToken, ids);
  });
}

function eksporDataAlumni() {
  showToast('Memproses', 'Menyiapkan file Excel…', 'info');
  gsrun({
    success: r => {
      if (!r.success) { showToast('Gagal', r.message, 'danger'); return; }
      unduhBase64(r.data.base64, r.data.fileName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      showToast('Berhasil', 'File Excel siap diunduh.', 'success');
    }
  }).eksporExcel(AppState.sessionToken, alumniFilter, 'Data_Alumni_IKALLHUBDAT');
}

function unduhBase64(b64, fileName, mime) {
  const byteChars = atob(b64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: mime });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link); link.click(); link.remove();
}

// ════════════════════════════════════════════════════════
// IMPOR EXCEL
// ════════════════════════════════════════════════════════
let importRows = [];
function pageImporExcel() {
  if (!requireLogin()) return;
  renderNavigation('Pengurus');
  importRows = [];
  setContainer(`
  <div class="flex flex-col gap-4">
    <div><h1 class="font-head font-bold text-xl text-ink">Impor Data dari Excel</h1><p class="text-sm text-ink-soft">Unggah file .xlsx/.csv berisi data alumni.</p></div>
    <div class="card card-pad">
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <input type="file" id="fileImpor" accept=".xlsx,.xls,.csv" class="form-input" onchange="handleFilePreview(event)">
        <select id="modeImpor" class="form-select" style="max-width:220px">
          <option value="lewati">Lewati data duplikat</option>
          <option value="perbarui">Perbarui data lama</option>
        </select>
      </div>
      <p class="text-xs text-ink-soft mt-2">Kolom yang diharapkan: nama, nomor_taruna, angkatan, prodi, tahun_kelulusan, status_kepegawaian, instansi, jabatan_terakhir, no_hp, email, status_anggota</p>
    </div>
    <div id="previewImporWrap"></div>
  </div>`);
}

function handleFilePreview(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    const wb = XLSX.read(evt.target.result, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
    importRows = json.map(r => {
      const o = {};
      Object.keys(r).forEach(k => { o[String(k).trim().toLowerCase().replace(/ /g,'_')] = r[k]; });
      return o;
    });
    renderPreviewImpor();
  };
  reader.readAsArrayBuffer(file);
}

function renderPreviewImpor() {
  const valid = importRows.filter(r => r.nama); // Sinkron dengan backend: hanya nama yang wajib.
  const invalid = importRows.length - valid.length;
  document.getElementById('previewImporWrap').innerHTML = `
    <div class="card card-pad">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-head font-semibold text-ink">Pratinjau (${importRows.length} baris — ${valid.length} valid, ${invalid} bermasalah)</h3>
        <button class="btn-primary" onclick="prosesImpor()"><span class="material-symbols-outlined text-[18px]">cloud_upload</span> Proses Impor</button>
      </div>
      <div class="table-wrap" style="max-height:360px;overflow-y:auto">
        <table class="data-table">
          <thead><tr><th>Status</th><th>Nama</th><th>NOTAR</th><th>Email</th><th>Instansi</th></tr></thead>
          <tbody>
            ${importRows.slice(0, 200).map(r => {
              const ok = !!r.nama;
              return '<tr>' +
                '<td>' + (ok ? '<span class="badge badge-aktif">Valid</span>' : '<span class="badge badge-ditolak">Bermasalah</span>') + '</td>' +
                '<td>' + escapeHtml(r.nama) + '</td><td>' + escapeHtml(r.nomor_taruna) + '</td><td>' + escapeHtml(r.email) + '</td><td>' + escapeHtml(r.instansi) + '</td></tr>';
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function prosesImpor() {
  const mode = document.getElementById('modeImpor').value;
  const batchSize = 100;
  let hasilTotal = { berhasil: 0, dilewati: 0, gagal: 0, detail: [] };
  let idx = 0;
  showToast('Memproses', 'Mengimpor ' + importRows.length + ' baris…', 'info');

  function nextBatch() {
    const batch = importRows.slice(idx, idx + batchSize);
    if (batch.length === 0) {
      showToast('Selesai', hasilTotal.berhasil + ' berhasil, ' + hasilTotal.dilewati + ' dilewati, ' + hasilTotal.gagal + ' gagal.', 'success');
      pageDataAlumni();
      return;
    }
    gsrun({
      success: r => {
        if (r.success) {
          hasilTotal.berhasil += r.data.berhasil; hasilTotal.dilewati += r.data.dilewati; hasilTotal.gagal += r.data.gagal;
        }
        idx += batchSize;
        nextBatch();
      },
      fail: err => showToast('Error', err.message, 'danger')
    }).prosesImporBatch(AppState.sessionToken, batch, mode);
  }
  nextBatch();
}

// ════════════════════════════════════════════════════════
// KARTU DIGITAL (PENGURUS)
// ════════════════════════════════════════════════════════
function pageKartuDigital() {
  if (!requireLogin()) return;
  renderNavigation('Pengurus');
  setContainer(`
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div><h1 class="font-head font-bold text-xl text-ink">Kartu Digital Alumni</h1><p class="text-sm text-ink-soft">Cetak ulang atau kirim ulang kartu digital.</p></div>
      <div class="flex gap-2 flex-wrap">
        <button class="btn-secondary" onclick="tesKoneksiQrHandler()"><span class="material-symbols-outlined text-[18px]">network_check</span> Tes Koneksi QR</button>
        <button class="btn-secondary" onclick="cetakUlangSemua()"><span class="material-symbols-outlined text-[18px]">refresh</span> Cetak Ulang Semua Kartu (Perbaiki QR)</button>
        <button class="btn-secondary" onclick="migrasiHurufProdiHandler()"><span class="material-symbols-outlined text-[18px]">sync_alt</span> Migrasi Huruf Prodi ke ID Lama</button>
        <button class="btn-secondary" onclick="migrasiIdRecordHandler()"><span class="material-symbols-outlined text-[18px]">key</span> Perbaiki ID Record Kosong</button>
        <button class="btn-secondary" onclick="migrasiStatusVerifikasiHandler()"><span class="material-symbols-outlined text-[18px]">verified</span> Tandai Data Lama sebagai Disetujui</button>
        <button class="btn-secondary" onclick="migrasiNomorUrutHandler()"><span class="material-symbols-outlined text-[18px]">format_list_numbered</span> Rapikan Nomor Urut Global</button>
        <button class="btn-primary" onclick="buatIdKartuMassal()"><span class="material-symbols-outlined text-[18px]">badge</span> Terbitkan ID/Kartu Massal (Impor)</button>
      </div>
    </div>
    <div class="card">
      <div class="table-wrap"><div id="kartuTableWrap"><div class="page-loading"><div class="app-spinner" style="border-top-color:#0B2A5B"></div></div></div></div>
    </div>
  </div>`);
  gsrun({
    success: r => renderTabelKartu(r),
    fail: err => renderErrorBox('kartuTableWrap', err, 'pageKartuDigital')
  }).getAnggotaList(AppState.sessionToken, { statusVerifikasi: 'Disetujui', pageSize: 100 });
}
function renderTabelKartu(res) {
  if (!res.success) { renderErrorBox('kartuTableWrap', { message: res.message }, 'pageKartuDigital'); return; }
  setHtmlAman('kartuTableWrap', `
    <table class="data-table">
      <thead><tr><th>ID Member</th><th>Nama</th><th>Masa Berlaku</th><th>Status</th><th class="text-center">Aksi</th></tr></thead>
      <tbody>${res.data.rows.map(a => `
        <tr>
          <td class="font-mono text-xs">${escapeHtml(a.id_member || '-')}</td>
          <td>${escapeHtml(a.nama)}</td>
          <td>${fmtTanggal(a.masa_berlaku_kartu)}</td>
          <td>${badgeAnggota(a.status_anggota)}</td>
          <td class="text-center flex justify-center gap-1">
            ${a.url_kartu_pdf ? '<a class="icon-btn" href="'+a.url_kartu_pdf+'" target="_blank" title="Lihat"><span class="material-symbols-outlined text-[18px]">visibility</span></a>' : ''}
            <button class="icon-btn" title="Cetak Ulang" onclick="cetakUlangSatu('${a.id_record}')"><span class="material-symbols-outlined text-[18px]">print</span></button>
            <button class="icon-btn" title="Kirim Ulang" onclick="kirimUlangSatu('${a.id_record}')"><span class="material-symbols-outlined text-[18px]">forward_to_inbox</span></button>
          </td>
        </tr>`).join('')}</tbody>
    </table>`);
}
function cetakUlangSatu(id) {
  showToast('Diproses', 'Mencetak ulang kartu…', 'info');
  gsrun({
    success: r => { if (r.success) tampilkanLinkUnduhan(r.data.url, r.message); else showToast('Gagal', r.message, 'danger'); },
    fail: err => showToast('Error', err.message, 'danger')
  }).cetakUlangKartu(AppState.sessionToken, id);
}
function kirimUlangSatu(id) {
  gsrun({ success: r => showToast(r.success?'Terkirim':'Gagal', r.message, r.success?'success':'danger') }).kirimUlangKartu(AppState.sessionToken, id);
}
function buatIdKartuMassal() {
  gsrun({ success: r => { showToast(r.success?'Selesai':'Gagal', r.message, r.success?'success':'danger'); pageKartuDigital(); } }).buatIdDanKartuMassal(AppState.sessionToken);
}
function tesKoneksiQrHandler() {
  showToast('Menguji...', 'Menghubungi provider QR, mohon tunggu...', 'success');
  gsrun({
    success: r => {
      if (r.success) {
        alert('Hasil Tes Koneksi QR:\n\n' + r.data.hasil.join('\n\n'));
      } else {
        showToast('Gagal', r.message, 'danger');
      }
    },
    fail: err => showToast('Error', err.message, 'danger')
  }).tesKoneksiQr(AppState.sessionToken);
}
// Migrasi satu-kali: tambahkan huruf kode prodi ke id_member lama (format
// nomor/tahun/KALTIM tanpa huruf) supaya konsisten dengan id_member baru yang
// sudah pakai format nomor/tahun/huruf/KALTIM. Cuma ubah teks di data, TIDAK
// mencetak ulang PDF — kalau perlu PDF-nya juga ikut berubah, jalankan "Cetak
// Ulang Semua Kartu" setelah ini.
function migrasiHurufProdiHandler() {
  openConfirmModal(
    'Migrasi Huruf Prodi ke ID Lama?',
    'ID Member lama (format tanpa huruf prodi) akan diubah jadi format baru (dengan huruf prodi). PERHATIAN: kalau kartu lama sudah tercetak/terkirim ke alumni, nomor di kartu fisik itu akan beda dari yang tersimpan di sistem setelah migrasi ini — sampai kartunya dicetak ulang. Lanjutkan?',
    () => {
      closeConfirmModal();
      showToast('Diproses', 'Sedang migrasi ID Member, mohon tunggu...', 'success');
      gsrun({
        success: r => { showToast(r.success ? 'Selesai' : 'Gagal', r.message, r.success ? 'success' : 'danger'); pageKartuDigital(); },
        fail: err => showToast('Error', err.message, 'danger')
      }).migrasiHurufProdiIdMember(AppState.sessionToken);
    }
  );
}
// Migrasi satu-kali: isi id_record yang kosong (biasanya karena baris ditempel/
// diketik langsung di Google Sheet, bukan lewat menu aplikasi). id_record kosong
// menyebabkan anggota itu gagal dibuka lewat "Cari & Perbarui Data Saya" dengan
// pesan "ID tidak valid." — aman dijalankan berkali-kali, baris yang sudah
// punya id_record tidak akan diubah.
function migrasiIdRecordHandler() {
  openConfirmModal(
    'Perbaiki ID Record Kosong?',
    'Baris data alumni yang kolom id_record-nya masih kosong (biasanya karena ditempel langsung di Google Sheet) akan diisi ID unik baru secara otomatis. Baris yang sudah punya id_record tidak akan diubah. Lanjutkan?',
    () => {
      closeConfirmModal();
      showToast('Diproses', 'Sedang memeriksa & mengisi id_record kosong, mohon tunggu...', 'success');
      gsrun({
        success: r => { showToast(r.success ? 'Selesai' : 'Gagal', r.message, r.success ? 'success' : 'danger'); pageKartuDigital(); },
        fail: err => showToast('Error', err.message, 'danger')
      }).migrasiIsiIdRecordKosong(AppState.sessionToken);
    }
  );
}
// Migrasi satu-kali: tandai "Disetujui" untuk data lama yang status_verifikasi-nya
// kosong (biasanya karena ditempel langsung di Google Sheet, bukan lewat alur
// pendaftaran+verifikasi aplikasi). Tanpa status "Disetujui", tombol Cetak/Unduh
// Kartu Digital di halaman publik tetap nonaktif dan menu "Terbitkan ID/Kartu
// Massal" tidak akan memproses baris itu. Baris yang statusnya sudah dikenal
// (Menunggu/Disetujui/Ditolak) tidak akan diubah.
function migrasiStatusVerifikasiHandler() {
  openConfirmModal(
    'Tandai Data Lama sebagai Disetujui?',
    'Baris data alumni yang kolom status_verifikasi-nya masih kosong (data lama yang ditempel langsung di Google Sheet) akan ditandai "Disetujui", supaya bisa diproses menu "Terbitkan ID/Kartu Massal" dan bisa diunduh alumni sendiri lewat "Cari & Perbarui Data Saya". Baris yang statusnya sudah Menunggu/Disetujui/Ditolak tidak akan diubah. Lanjutkan?',
    () => {
      closeConfirmModal();
      showToast('Diproses', 'Sedang memeriksa & menandai status verifikasi kosong, mohon tunggu...', 'success');
      gsrun({
        success: r => { showToast(r.success ? 'Selesai' : 'Gagal', r.message, r.success ? 'success' : 'danger'); pageKartuDigital(); },
        fail: err => showToast('Error', err.message, 'danger')
      }).migrasiStatusVerifikasiKosong(AppState.sessionToken);
    }
  );
}
// Migrasi satu-kali: rapikan nomor urut id_member yang SUDAH TERLANJUR
// diterbitkan supaya jadi satu deret global (001, 002, 003, ... terus naik),
// tidak reset per tahun kelulusan seperti sebelumnya. Penerbitan ID BARU
// (lewat Verifikasi Pendaftaran / Terbitkan ID Massal) sudah otomatis global
// sejak perbaikan ini — tombol ini KHUSUS untuk merapikan ID yang sudah ada.
function migrasiNomorUrutHandler() {
  openConfirmModal(
    'Rapikan Nomor Urut Global?',
    'Nomor urut pada ID Member yang SUDAH TERBIT akan dihitung ulang jadi SATU deret global (001, 002, 003, ... terus naik untuk semua alumni), tidak lagi reset per tahun kelulusan. Urutan penomoran mengikuti tahun kelulusan lebih dulu, baru nomor lama. PERHATIAN: nomor di kartu yang sudah tercetak/terkirim ke alumni bisa berbeda dari yang tersimpan setelah ini — cetak ulang kartu kalau perlu. Lanjutkan?',
    () => {
      closeConfirmModal();
      showToast('Diproses', 'Sedang merapikan nomor urut, mohon tunggu...', 'success');
      gsrun({
        success: r => { showToast(r.success ? 'Selesai' : 'Gagal', r.message, r.success ? 'success' : 'danger'); pageKartuDigital(); },
        fail: err => showToast('Error', err.message, 'danger')
      }).migrasiNomorUrutGlobal(AppState.sessionToken);
    }
  );
}
function cetakUlangSemua() {
  openConfirmModal(
    'Cetak Ulang Semua Kartu?',
    'Semua kartu anggota berstatus Disetujui akan dibuat ulang (termasuk QR code). Proses ini bisa memakan waktu beberapa menit tergantung jumlah anggota. Lanjutkan?',
    () => {
      closeConfirmModal();
      showToast('Diproses', 'Sedang mencetak ulang semua kartu, mohon tunggu...', 'success');
      gsrun({
        success: r => { showToast(r.success?'Selesai':'Gagal', r.message, r.success?'success':'danger'); pageKartuDigital(); },
        fail: err => showToast('Error', err.message, 'danger')
      }).cetakUlangSemuaKartu(AppState.sessionToken);
    }
  );
}

// ════════════════════════════════════════════════════════
// REKAP & LAPORAN
// ════════════════════════════════════════════════════════
function pageRekap() {
  if (!requireLogin()) return;
  renderNavigation('Pengurus');
  const now = new Date();
  setContainer(`
  <div class="flex flex-col gap-4">
    <div class="breadcrumb"><span class="material-symbols-outlined text-[16px]">description</span> Modul F-10 · Arsip &amp; Rekapitulasi Berkala</div>
    <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
      <div><h1 class="font-head font-bold text-xl text-ink">Rekapitulasi &amp; Laporan Bulanan Alumni IKALLHUBDAT</h1><p class="text-sm text-ink-soft mt-1">Laporan statistik resmi keanggotaan DPD Kalimantan Timur per periode bulanan.</p></div>
    </div>
    <div class="card card-pad flex flex-wrap items-end gap-3">
      <div><label class="form-label">Bulan</label>
        <select id="rekapBulan" class="form-select">
          ${['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'].map((b,i)=>'<option value="'+(i+1)+'"'+(i+1===now.getMonth()+1?' selected':'')+'>'+b+'</option>').join('')}
        </select>
      </div>
      <div><label class="form-label">Tahun</label><input type="number" id="rekapTahun" class="form-input" value="${now.getFullYear()}" style="width:110px"></div>
      <button class="btn-primary" onclick="tampilkanRekap()">Tampilkan Rekap</button>
      <button class="btn-ghost" id="btnUnduhRekapPdf" onclick="unduhRekapPdf()"><span class="material-symbols-outlined text-[18px]">picture_as_pdf</span> Unduh Laporan Resmi (PDF)</button>
      <button class="btn-ghost" onclick="unduhRekapExcel()"><span class="material-symbols-outlined text-[18px]">table_view</span> Unduh Spreadsheet (.xlsx)</button>
    </div>
    <div id="rekapPdfLinkArea"></div>
    <div id="rekapArea"></div>
  </div>`);
  tampilkanRekap();
}
function tampilkanRekap() {
  const bulan = document.getElementById('rekapBulan').value;
  const tahun = document.getElementById('rekapTahun').value;
  setHtmlAman('rekapArea', '<div class="page-loading"><div class="app-spinner" style="border-top-color:#0B2A5B"></div></div>');
  gsrun({ success: r => renderRekapArea(r), fail: err => renderErrorBox('rekapArea', err, 'tampilkanRekap') }).getRekapBulanan(AppState.sessionToken, bulan, tahun);
}
function donutGradient(entries, total, colors) {
  let acc = 0;
  const parts = entries.map(([k,v], i) => {
    const start = acc / total * 360; acc += v; const end = acc / total * 360;
    return (colors[i % colors.length]) + ' ' + start.toFixed(1) + 'deg ' + end.toFixed(1) + 'deg';
  });
  return 'conic-gradient(' + parts.join(', ') + ')';
}
function renderRekapArea(res) {
  if (!res.success) { renderErrorBox('rekapArea', { message: res.message }, 'tampilkanRekap'); return; }
  const d = res.data;
  const namaBulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][d.bulan-1];
  const kepegawaian = Object.entries(d.perStatusKepegawaian).sort((a,b)=>b[1]-a[1]);
  const prodi = Object.entries(d.perProdi).sort((a,b)=>b[1]-a[1]);
  const donutColors = ['#0B2A5B','#D4A72C','#3B82F6','#94A3B8','#10B981','#F97316'];
  setHtmlAman('rekapArea', `
    <div class="card card-pad card-accent">
      <div class="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h3 class="font-head font-semibold text-ink">Ringkasan Eksekutif Periode Terpilih — ${namaBulan} ${d.tahun}</h3>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
        <div class="stat-card-v2"><div class="stat-card-v2-label">Total Anggota Terdaftar</div><div class="stat-card-v2-value">${d.totalAnggota}</div><div class="stat-card-v2-foot">Basis data DPD · 100% Valid</div></div>
        <div class="stat-card-v2"><div class="stat-card-v2-label">Anggota Baru Bulan Ini</div><div class="stat-card-v2-value">${d.anggotaBaru}</div><div class="stat-card-v2-foot up">Tercatat pada ${namaBulan}</div></div>
        <div class="stat-card-v2"><div class="stat-card-v2-label">Anggota Aktif</div><div class="stat-card-v2-value">${d.perStatusAnggota['Aktif']||0}</div><div class="stat-card-v2-foot">${d.totalAnggota?Math.round((d.perStatusAnggota['Aktif']||0)/d.totalAnggota*100):0}% rasio aktif</div></div>
        <div class="stat-card-v2"><div class="stat-card-v2-label">Masa KTA Menjelang Habis</div><div class="stat-card-v2-value" style="color:#DC2626">${d.akanKedaluwarsa.length}</div><div class="stat-card-v2-foot ${d.akanKedaluwarsa.length>0?'danger':''}">≤ 30 hari ke depan</div></div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
      <div class="card card-pad">
        <h4 class="font-head font-semibold mb-1 text-sm">Status Kepegawaian</h4>
        <p class="text-xs text-ink-soft mb-3">Komposisi profesi alumni.</p>
        ${kepegawaian.map(([k,v])=>`
          <div class="bar-row"><span>${escapeHtml(k||'-')}</span><span class="font-bold">${v} (${d.totalAnggota?Math.round(v/d.totalAnggota*100):0}%)</span></div>
          <div class="bar-track"><div class="bar-fill" style="width:${d.totalAnggota?Math.round(v/d.totalAnggota*100):0}%"></div></div>
        `).join('')}
      </div>
      <div class="card card-pad text-center">
        <h4 class="font-head font-semibold mb-1 text-sm text-left">Program Studi Asal</h4>
        <p class="text-xs text-ink-soft mb-3 text-left">Latar belakang pendidikan alumni.</p>
        <div class="donut-wrap" style="background:${donutGradient(prodi, d.totalAnggota||1, donutColors)};border-radius:50%;">
          <div class="donut-wrap" style="width:78px;height:78px;background:var(--bg-card);border-radius:50%;">
            <div class="donut-center"><span class="n">${prodi.length}</span><span class="l">Prodi</span></div>
          </div>
        </div>
        <div class="flex flex-col gap-1 mt-3 text-left">
          ${prodi.map(([k,v],i)=>`<div class="flex items-center justify-between text-xs"><span class="flex items-center gap-1.5"><span class="legend-dot" style="background:${donutColors[i%donutColors.length]}"></span>${escapeHtml(k||'-')}</span><strong>${v}</strong></div>`).join('')}
        </div>
      </div>
      <div class="card card-pad">
        <h4 class="font-head font-semibold mb-1 text-sm">Per Angkatan</h4>
        <p class="text-xs text-ink-soft mb-3">Sebaran angkatan alumni terdaftar.</p>
        ${Object.entries(d.perAngkatan).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))).map(([k,v])=>'<div class="flex justify-between text-sm py-1.5 border-b" style="border-color:var(--border-color)"><span>Angkatan '+escapeHtml(k||'-')+'</span><strong>'+v+'</strong></div>').join('')}
      </div>
    </div>

    <div class="card card-pad mt-4">
      <div class="letterhead">
        ${logoWrapKecilInline()}
        <div><div class="letterhead-title">Ikatan Alumni Lalu Lintas Angkutan Jalan / Hubungan Darat</div><div class="letterhead-sub">Dewan Pengurus Daerah Kalimantan Timur</div></div>
        <div class="letterhead-code ml-auto">Periode ${namaBulan} ${d.tahun}</div>
      </div>
      <div class="flex items-center justify-between mb-2">
        <h4 class="font-head font-semibold text-ink">Rekap Data Alumni (Seluruh Data)</h4>
        <span class="badge badge-aktif">${d.seluruhAlumni.length} Alumni</span>
      </div>
      <p class="text-xs text-ink-soft mb-3">Daftar lengkap seluruh alumni yang tercatat di database, diurutkan berdasarkan nama. Untuk mengunduh sebagai file, gunakan tombol "Unduh Spreadsheet (.xlsx)" atau "Unduh Laporan Resmi (PDF)" di atas.</p>
      <div class="table-wrap" style="max-height:480px; overflow-y:auto;">
        <table class="data-table">
          <thead><tr><th>ID Member / NOTAR</th><th>Nama</th><th>Prodi / Angkatan</th><th>Instansi</th><th>Status Anggota</th><th>Status Verifikasi</th><th>Masa Berlaku Kartu</th></tr></thead>
          <tbody>
            ${d.seluruhAlumni.length === 0 ? '<tr><td colspan="7" class="text-center py-6 text-ink-soft">Belum ada data alumni.</td></tr>' :
              d.seluruhAlumni.map(a => `<tr>
                <td class="text-xs font-mono">${escapeHtml(a.id_member || a.nomor_taruna || '-')}</td>
                <td><div class="font-semibold">${escapeHtml(a.nama)}</div></td>
                <td class="text-xs">${escapeHtml(a.prodi||'-')} / ${escapeHtml(a.angkatan||'-')}</td>
                <td class="text-xs">${escapeHtml(a.instansi||'-')}</td>
                <td class="text-xs">${badgeAnggota(a.status_anggota)}</td>
                <td class="text-xs">${badgeVerifikasi(a.status_verifikasi)}</td>
                <td class="text-xs">${fmtTanggal(a.masa_berlaku_kartu)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card card-pad mt-4">
      <div class="flex items-center justify-between mb-2">
        <h4 class="font-head font-semibold text-ink">Kartu Akan Kedaluwarsa (&lt; 30 Hari)</h4>
        <span class="badge ${d.akanKedaluwarsa.length>0?'badge-menunggu':'badge-aktif'}">${d.akanKedaluwarsa.length} Berkas</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Nama &amp; No. Anggota</th><th>Prodi / Angkatan</th><th>Instansi</th><th>Masa Berlaku</th></tr></thead>
          <tbody>
            ${d.akanKedaluwarsa.length === 0 ? '<tr><td colspan="4" class="text-center py-6 text-ink-soft">Tidak ada kartu yang akan kedaluwarsa.</td></tr>' :
              d.akanKedaluwarsa.map(a => `<tr>
                <td><div class="font-semibold">${escapeHtml(a.nama)}</div><div class="text-xs text-ink-soft font-mono">${escapeHtml(a.id_member||a.nomor_taruna)}</div></td>
                <td class="text-xs">${escapeHtml(a.prodi)} / ${escapeHtml(a.angkatan)}</td>
                <td class="text-xs">${escapeHtml(a.instansi)}</td>
                <td class="text-xs font-semibold" style="color:#DC2626">${fmtTanggal(a.masa_berlaku_kartu)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`);
}
function logoWrapKecilInline() { return '<div style="flex:none;">' + logoAtauFallback(32, logoSvgSmall()) + '</div>'; }
function unduhRekapPdf() {
  const bulan = document.getElementById('rekapBulan').value, tahun = document.getElementById('rekapTahun').value;
  const btn = document.getElementById('btnUnduhRekapPdf');
  const linkArea = document.getElementById('rekapPdfLinkArea');
  if (linkArea) linkArea.innerHTML = '';
  if (btn) { btn.dataset.label = btn.innerHTML; btn.innerHTML = '<span class="spinner-inline"></span> Membuat PDF…'; btn.disabled = true; }
  showToast('Memproses', 'Membuat PDF rekap, mohon tunggu…', 'info');
  gsrun({
    success: r => {
      if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.label; }
      if (r.success) {
        // SENGAJA TIDAK pakai window.open(url,'_blank') di sini — panggilan
        // google.script.run bersifat asynchronous, jadi window.open yang
        // dipanggil di dalam callback-nya TIDAK dianggap browser sebagai hasil
        // klik langsung pengguna, dan hampir selalu diblokir popup blocker
        // TANPA pesan error apa pun (makanya sebelumnya terasa "tidak ada
        // respons" walau PDF-nya sebenarnya sudah berhasil dibuat di Drive).
        // Solusinya: tampilkan link yang diklik SENDIRI oleh pengguna — klik
        // manual pada <a> selalu diizinkan browser, tidak pernah diblokir.
        if (linkArea) {
          linkArea.innerHTML = `<div class="card card-pad" style="border:1px solid #10B981;background:rgba(16,185,129,.06);">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div class="flex items-center gap-2 text-sm"><span class="material-symbols-outlined text-[20px]" style="color:#10B981">check_circle</span> PDF rekap berhasil dibuat.</div>
              <a class="btn-primary" href="${escapeHtml(r.data.url)}" target="_blank" rel="noopener"><span class="material-symbols-outlined text-[18px]">open_in_new</span> Buka / Unduh PDF</a>
            </div>
          </div>`;
        }
        showToast('Berhasil', 'PDF siap — klik tombol "Buka / Unduh PDF" di atas.', 'success');
      } else {
        showToast('Gagal', r.message, 'danger');
      }
    },
    fail: err => { if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.label; } showToast('Error', err.message, 'danger'); }
  }).buatRekapPDF(AppState.sessionToken, bulan, tahun);
}
function unduhRekapExcel() {
  const bulan = document.getElementById('rekapBulan').value, tahun = document.getElementById('rekapTahun').value;
  showToast('Memproses', 'Membuat file Excel…', 'info');
  gsrun({ success: r => { if (r.success) { unduhBase64(r.data.base64, r.data.fileName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); showToast('Berhasil', 'File Excel siap diunduh.', 'success'); } else showToast('Gagal', r.message, 'danger'); } }).buatRekapExcel(AppState.sessionToken, bulan, tahun);
}

// ════════════════════════════════════════════════════════
// PENGATURAN ORGANISASI
// ════════════════════════════════════════════════════════
function pagePengaturan() {
  if (!requireLogin()) return;
  renderNavigation('Pengurus');
  setContainer('<div class="page-loading"><div class="app-spinner" style="border-top-color:#0B2A5B"></div></div>');
  gsrun({ success: renderPengaturan }).getPengaturan(AppState.sessionToken);
}
function renderPengaturan(res) {
  if (!res.success) { showToast('Error', res.message, 'danger'); return; }
  const c = res.data;
  setContainer(`
  <div class="flex flex-col gap-5">
    <h1 class="font-head font-bold text-xl text-ink">Pengaturan Organisasi</h1>
    <div class="card card-pad">
      <h3 class="font-head font-semibold mb-3">Umum</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><label class="form-label">Nama Ketua</label><input class="form-input" id="p_nama_ketua" value="${escapeHtml(c.nama_ketua||'')}"></div>
        <div><label class="form-label">Masa Berlaku Kartu (tahun)</label><input type="number" class="form-input" id="p_masa_berlaku_tahun" value="${escapeHtml(c.masa_berlaku_tahun||'5')}"></div>
        <div class="md:col-span-2"><label class="form-label">Daftar Program Studi (pisahkan dengan |)</label><input class="form-input" id="p_daftar_prodi" value="${escapeHtml(c.daftar_prodi||'')}"></div>
      </div>
      <button class="btn-primary mt-4" onclick="simpanPengaturanUmum()">Simpan Pengaturan</button>
    </div>
    <div class="card card-pad">
      <h3 class="font-head font-semibold mb-3">Logo &amp; Tanda Tangan Digital</h3>
      <p class="text-xs text-ink-soft mb-4">Dipakai pada Kartu Digital Alumni dan Laporan PDF. Format PNG/JPG, maksimal 2 MB. Mengunggah file baru langsung menggantikan yang lama.</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="form-label">Logo Organisasi</label>
          <div class="flex items-center gap-3 mb-2">
            <div id="asetPreviewLogo" class="aset-preview-box">${c.logoPreview ? '<img src="'+c.logoPreview+'" alt="Logo Organisasi">' : '<span class="material-symbols-outlined text-[22px]">image</span>'}</div>
            <div class="flex-1">
              <input type="file" id="fileLogo" accept="image/png,image/jpeg" class="form-input" style="padding:.4rem;">
              <button class="btn-secondary mt-2 w-full justify-center" onclick="unggahAsetHandler('logo')">Unggah Logo</button>
            </div>
          </div>
        </div>
        <div>
          <label class="form-label">Tanda Tangan Digital Ketua</label>
          <div class="flex items-center gap-3 mb-2">
            <div id="asetPreviewTtd" class="aset-preview-box">${c.ttdPreview ? '<img src="'+c.ttdPreview+'" alt="Tanda Tangan Ketua">' : '<span class="material-symbols-outlined text-[22px]">draw</span>'}</div>
            <div class="flex-1">
              <input type="file" id="fileTtd" accept="image/png,image/jpeg" class="form-input" style="padding:.4rem;">
              <button class="btn-secondary mt-2 w-full justify-center" onclick="unggahAsetHandler('ttd_ketua')">Unggah Tanda Tangan</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="card card-pad">
      <h3 class="font-head font-semibold mb-3">Kelola Pengurus</h3>
      <div class="flex gap-2 mb-3"><input id="emailPengurusBaru" class="form-input" placeholder="Email anggota untuk dijadikan pengurus"><button class="btn-primary" onclick="tambahPengurusBaru()">Tambah</button></div>
      <div id="listPengurus" class="space-y-1"></div>
    </div>
  </div>`);
  gsrun({ success: r => { if (r.success) setHtmlAman('listPengurus', r.data.map(e => '<div class="flex items-center justify-between text-sm py-1.5 border-b" style="border-color:var(--border-color)"><span>'+escapeHtml(e)+'</span><button class="icon-btn" onclick="cabutPengurusEmail(\''+e+'\')"><span class="material-symbols-outlined text-[18px]">person_remove</span></button></div>').join('')); else showToast('Error', r.message, 'danger'); } }).getDaftarPengurus(AppState.sessionToken);
}
function simpanPengaturanUmum() {
  const data = {
    nama_ketua: document.getElementById('p_nama_ketua').value,
    masa_berlaku_tahun: document.getElementById('p_masa_berlaku_tahun').value,
    daftar_prodi: document.getElementById('p_daftar_prodi').value
  };
  gsrun({ success: r => showToast(r.success?'Tersimpan':'Gagal', r.message, r.success?'success':'danger') }).updatePengaturan(AppState.sessionToken, data);
}

// Membaca file dari <input type=file> sebagai base64 (FileReader), lalu mengirimkannya
// ke unggahAsetOrganisasi() via google.script.run. Ukuran dibatasi 2MB di sisi server.
function unggahAsetHandler(jenis) {
  const inputId = jenis === 'logo' ? 'fileLogo' : 'fileTtd';
  const previewId = jenis === 'logo' ? 'asetPreviewLogo' : 'asetPreviewTtd';
  const input = document.getElementById(inputId);
  const file = input && input.files && input.files[0];
  if (!file) { showToast('Peringatan', 'Pilih file terlebih dahulu.', 'warning'); return; }
  if (file.size > 2 * 1024 * 1024) { showToast('Peringatan', 'Ukuran file maksimal 2 MB.', 'warning'); return; }

  const reader = new FileReader();
  reader.onload = () => {
    const base64 = String(reader.result).split(',')[1];
    gsrun({
      success: r => {
        if (r.success) {
          showToast('Berhasil', r.message, 'success');
          setHtmlAman(previewId, '<img src="' + r.data.preview + '" alt="Pratinjau">');
        } else {
          showToast('Gagal', r.message, 'danger');
        }
      }
    }).unggahAsetOrganisasi(AppState.sessionToken, jenis, file.name, file.type, base64);
  };
  reader.onerror = () => showToast('Error', 'Gagal membaca file.', 'danger');
  reader.readAsDataURL(file);
}
function tambahPengurusBaru() {
  const email = document.getElementById('emailPengurusBaru').value.trim();
  if (!email) return;
  gsrun({ success: r => { showToast(r.success?'Berhasil':'Gagal', r.message, r.success?'success':'danger'); if (r.success) pagePengaturan(); } }).tambahPengurus(AppState.sessionToken, email);
}
function cabutPengurusEmail(email) {
  gsrun({ success: r => { showToast(r.success?'Berhasil':'Gagal', r.message, r.success?'success':'danger'); if (r.success) pagePengaturan(); } }).cabutPengurus(AppState.sessionToken, email);
}

// ════════════════════════════════════════════════════════
// LOG AKTIVITAS
// ════════════════════════════════════════════════════════
function pageLogAktivitas() {
  if (!requireLogin()) return;
  renderNavigation('Pengurus');
  setContainer(`<div class="flex flex-col gap-4"><h1 class="font-head font-bold text-xl text-ink">Log Aktivitas</h1><div class="card"><div class="table-wrap" id="logWrap"><div class="page-loading"><div class="app-spinner" style="border-top-color:#0B2A5B"></div></div></div></div></div>`);
  gsrun({ success: r => {
    if (!r.success) { renderErrorBox('logWrap', { message: r.message }, 'pageLogAktivitas'); return; }
    setHtmlAman('logWrap', `<table class="data-table"><thead><tr><th>Waktu</th><th>Email</th><th>Aksi</th><th>Detail</th></tr></thead><tbody>${r.data.rows.map(l=>'<tr><td class="text-xs">'+fmtTanggal(l.waktu)+'</td><td class="text-xs">'+escapeHtml(l.email)+'</td><td class="text-xs font-semibold">'+escapeHtml(l.aksi)+'</td><td class="text-xs">'+escapeHtml(l.detail)+'</td></tr>').join('')}</tbody></table>`);
  }, fail: err => renderErrorBox('logWrap', err, 'pageLogAktivitas') }).getLogAktivitas(AppState.sessionToken, 1, 100);
}

// ════════════════════════════════════════════════════════
// AREA ANGGOTA: DASBOR, PROFIL, KEAMANAN
// ════════════════════════════════════════════════════════
function pageDasborAnggota() {
  if (!requireLogin()) return;
  renderNavigation('Anggota');
  setContainer('<div class="page-loading"><div class="app-spinner" style="border-top-color:#0B2A5B"></div></div>');
  gsrun({ success: r => renderDasborAnggota(r) }).getProfilSaya(AppState.sessionToken);
}
let dasborAnggotaTab = 'pribadi';
function renderDasborAnggota(res) {
  if (!res.success) { showToast('Error', res.message, 'danger'); return; }
  const a = res.data;
  AppState.profil = a;
  dasborAnggotaTab = 'pribadi';
  const sudahAktif = a.status_verifikasi === 'Disetujui';
  setContainer(`
  <div class="flex flex-col gap-5">
    <div class="card card-pad flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="topbar-user-avatar" style="width:52px;height:52px;font-size:18px;">${escapeHtml((a.nama||'?').charAt(0).toUpperCase())}</div>
        <div>
          <div class="flex items-center gap-2"><h2 class="font-head font-bold text-lg text-ink">Halo, ${escapeHtml(a.nama)}</h2>${badgeVerifikasi(a.status_verifikasi)}</div>
          <div class="text-xs text-ink-soft flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            <span>🏷️ No. KTA: <strong>${escapeHtml(a.id_member || 'Belum diterbitkan')}</strong></span>
            <span>Status: <strong class="${a.status_anggota==='Aktif'?'':'text-ink-soft'}" style="${a.status_anggota==='Aktif'?'color:#059669':''}">${a.masa_berlaku_kartu ? 'Berlaku hingga ' + fmtTanggal(a.masa_berlaku_kartu) : '-'}</strong></span>
            <span>📍 ${escapeHtml(a.instansi || '-')}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <div class="lg:col-span-5 flex flex-col gap-3">
        <h3 class="font-head font-semibold text-ink flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full" style="background:var(--gold)"></span> Kartu Tanda Anggota Digital</h3>
        <div class="kta-v2">
          <div class="kta-v2-head">
            <div class="flex items-center gap-2">${logoAtauFallback(28, logoSvgSmall())}<div><div class="text-[10px] tracking-wider font-bold" style="color:#FCD34D">IKATAN ALUMNI PERHUBUNGAN DARAT</div><div class="text-[8.5px]" style="color:#D8E2FF">DPD KALIMANTAN TIMUR</div></div></div>
            <span class="kta-v2-badge">ISO 7810 ID-1</span>
          </div>
          <div class="mt-3 flex gap-3" style="position:relative;">
            <div class="kta-photo-circle">${escapeHtml((a.nama||'?').charAt(0).toUpperCase())}</div>
            <div class="flex-1 min-w-0">
              <div class="text-[9px] uppercase tracking-wider" style="color:#B9C4E0">Nomor Anggota / ID</div>
              <div class="font-head font-bold" style="color:#FCD34D;font-size:1.05rem;">${escapeHtml(a.id_member||'—')}</div>
              <div class="text-[9px] uppercase tracking-wider mt-2" style="color:#B9C4E0">Nama Lengkap</div>
              <div class="font-head font-bold text-sm truncate">${escapeHtml(a.nama)}</div>
            </div>
            ${a.qrDataUri ? `<div class="kta-qr-box" title="Pindai untuk verifikasi asli"><img src="${a.qrDataUri}" width="54" height="54" alt="QR Verifikasi"/></div>` : `<div class="kta-qr-box kta-qr-empty"><span class="material-symbols-outlined text-[22px]">qr_code_2</span></div>`}
          </div>
          <div class="flex gap-6 mt-3">
            <div><div class="text-[8.5px]" style="color:#B9C4E0">Angkatan</div><div class="text-[10.5px] font-semibold" style="color:#D8E2FF">${escapeHtml(a.angkatan)}</div></div>
          </div>
          <div class="mt-2"><div class="text-[8.5px]" style="color:#B9C4E0">Instansi Penempatan</div><div class="text-[10.5px] font-semibold" style="color:#D8E2FF">${escapeHtml(a.instansi)}</div></div>
          <div class="flex items-end justify-between mt-3 pt-2" style="border-top:1px solid rgba(212,167,44,.25);position:relative;">
            <div><div class="text-[8px]" style="color:#B9C4E0">Masa Berlaku</div><div class="text-[10.5px] font-bold" style="color:#FCD34D">${fmtTanggal(a.masa_berlaku_kartu)}</div></div>
            ${badgeAnggota(a.status_anggota)}
          </div>
        </div>

        ${sudahAktif ? `
        <div class="kta-cert-note"><span class="material-symbols-outlined text-[14px]">verified</span> Tersertifikasi Digital GAS Engine — QR kartu terhubung langsung ke halaman verifikasi resmi sistem.</div>
        <div class="flex flex-col gap-2">
          <button class="btn-primary w-full justify-center py-2.5" onclick="unduhKartuSayaHandler()"><span class="material-symbols-outlined text-[18px]">download</span> Unduh Kartu Digital (PDF Asli Ber-Barcode)</button>
          <div class="grid grid-cols-2 gap-2">
            <button class="btn-secondary justify-center py-2" onclick="kirimKartuSayaKeEmailHandler()"><span class="material-symbols-outlined text-[16px]">mail</span> Kirim ke Email Saya</button>
            <button class="btn-secondary justify-center py-2" onclick="salinTautanKartuHandler()"><span class="material-symbols-outlined text-[16px]">link</span> Salin Tautan Kartu</button>
          </div>
        </div>` : `
        <div class="card card-pad card-accent gold">
          <p class="text-xs text-ink-soft">Kartu digital akan tersedia untuk diunduh, dikirim ke email, dan dipindai (QR) setelah data Anda diverifikasi oleh Pengurus.</p>
        </div>`}

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="card card-pad card-accent">
            <h4 class="font-head font-semibold text-xs mb-1 flex items-center gap-1.5">${iconBuilding()} Sekretariat DPD Kaltim</h4>
            <p class="text-xs text-ink-soft">WhatsApp/Telepon: <strong class="text-ink">0816-4578-888</strong></p>
          </div>
          <div class="card card-pad card-accent gold">
            <h4 class="font-head font-semibold text-xs mb-1 flex items-center gap-1.5">${iconInfo()} Masa Berlaku &amp; AD/ART</h4>
            <p class="text-xs text-ink-soft">Keanggotaan dan kartu digital tunduk pada ketentuan AD/ART IKALLHUBDAT DPD Kalimantan Timur yang berlaku.</p>
          </div>
        </div>
      </div>

      <div class="lg:col-span-7 flex flex-col gap-3">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <h3 class="font-head font-semibold text-ink">Pembaruan Data Mandiri</h3>
          <div class="pill-tabs" id="dasborTabs">
            <button type="button" class="pill-tab active" data-tab="pribadi" onclick="switchDasborTab('pribadi')">${iconShieldCheck()} Data Pribadi &amp; Kontak</button>
            <button type="button" class="pill-tab" data-tab="pekerjaan" onclick="switchDasborTab('pekerjaan')">${iconCard()} Pekerjaan &amp; Karir</button>
          </div>
        </div>
        <div id="dasborPerubahanBanner"></div>
        <div class="card card-pad" id="dasborFormArea"></div>
        <div class="card card-pad card-accent gold">
          <h4 class="font-head font-semibold text-sm mb-2 flex items-center gap-2">${iconInfo()} Informasi &amp; Bantuan Keanggotaan</h4>
          <p class="text-xs text-ink-soft">Perubahan pada nama, program studi, angkatan, atau instansi yang Anda ajukan akan DITINJAU DAN DISETUJUI Pengurus terlebih dahulu sebelum masuk ke data resmi dan Kartu Digital Anda. Untuk perubahan email login atau status keanggotaan, hubungi Pengurus DPD Kaltim.</p>
        </div>
      </div>
    </div>
  </div>`);
  renderDasborForm();
  muatPerubahanSayaBanner();
}
function switchDasborTab(tab) {
  dasborAnggotaTab = tab;
  document.querySelectorAll('#dasborTabs .pill-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  renderDasborForm();
}
function renderDasborForm() {
  const a = AppState.profil; if (!a) return;
  const area = document.getElementById('dasborFormArea');
  if (!area) return;
  if (dasborAnggotaTab === 'pribadi') {
    area.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><label class="form-label">Nama Lengkap &amp; Gelar</label><input class="form-input" id="pd_nama" value="${escapeHtml(a.nama)}"></div>
        <div class="field-locked"><label class="form-label">Nomor Induk Taruna <span class="field-lock-tag">🔒 Referensi</span></label><input class="form-input" value="${escapeHtml(a.nomor_taruna)}" disabled></div>
        <div class="field-locked"><label class="form-label">Email Akun (Login) <span class="field-lock-tag">🔒 Terkunci</span></label><input class="form-input" value="${escapeHtml(a.email)}" disabled></div>
        <div><label class="form-label">Nomor WhatsApp / HP Aktif</label><input class="form-input" id="pd_no_hp" value="${escapeHtml(a.no_hp)}"></div>
      </div>
      <button class="btn-primary mt-4" onclick="simpanProfilDasbor()"><span class="material-symbols-outlined text-[18px]">save</span> Simpan Perubahan Data</button>`;
  } else {
    area.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><label class="form-label">Program Studi Alumni</label><select class="form-select" id="pd_prodi">${PRODI_OPTS.map(p=>'<option value="'+p[0]+'"'+(a.prodi===p[0]?' selected':'')+'>'+p[1]+'</option>').join('')}</select></div>
        <div><label class="form-label">Angkatan / Tahun Kelulusan</label><div class="flex gap-2"><input class="form-input" id="pd_angkatan" value="${escapeHtml(a.angkatan)}" placeholder="Angkatan"><input class="form-input" id="pd_tahun_kelulusan" value="${escapeHtml(a.tahun_kelulusan)}" placeholder="Tahun"></div></div>
        <div><label class="form-label">Status Kepegawaian</label><select class="form-select" id="pd_status_kepegawaian">${STATUS_KEPEGAWAIAN_OPTS.map(s=>'<option value="'+s+'"'+(a.status_kepegawaian===s?' selected':'')+'>'+s+'</option>').join('')}</select></div>
        <div><label class="form-label">Instansi Penempatan</label><input class="form-input" id="pd_instansi" value="${escapeHtml(a.instansi)}"></div>
        <div class="md:col-span-2"><label class="form-label">Jabatan Terakhir</label><input class="form-input" id="pd_jabatan_terakhir" value="${escapeHtml(a.jabatan_terakhir)}"></div>
      </div>
      <button class="btn-primary mt-4" onclick="simpanProfilDasbor()"><span class="material-symbols-outlined text-[18px]">save</span> Simpan Perubahan Data</button>`;
  }
}
function simpanProfilDasbor() {
  const a = AppState.profil || {};
  const data = {
    nama: document.getElementById('pd_nama') ? document.getElementById('pd_nama').value.trim() : a.nama,
    no_hp: document.getElementById('pd_no_hp') ? document.getElementById('pd_no_hp').value.trim() : a.no_hp,
    prodi: document.getElementById('pd_prodi') ? document.getElementById('pd_prodi').value : a.prodi,
    angkatan: document.getElementById('pd_angkatan') ? document.getElementById('pd_angkatan').value.trim() : a.angkatan,
    tahun_kelulusan: document.getElementById('pd_tahun_kelulusan') ? document.getElementById('pd_tahun_kelulusan').value.trim() : a.tahun_kelulusan,
    status_kepegawaian: document.getElementById('pd_status_kepegawaian') ? document.getElementById('pd_status_kepegawaian').value : a.status_kepegawaian,
    instansi: document.getElementById('pd_instansi') ? document.getElementById('pd_instansi').value.trim() : a.instansi,
    jabatan_terakhir: document.getElementById('pd_jabatan_terakhir') ? document.getElementById('pd_jabatan_terakhir').value.trim() : a.jabatan_terakhir
  };
  // Diajukan ke antrean persetujuan Pengurus (ajukanPerubahanProfil), BUKAN langsung
  // menulis ke data resmi — lihat muatPerubahanSayaBanner() untuk status pengajuan.
  gsrun({ success: r => { showToast(r.success?'Diajukan':'Gagal', r.message, r.success?'success':'danger'); if (r.success) pageDasborAnggota(); } }).ajukanPerubahanProfil(AppState.sessionToken, data);
}
function unduhKartuSayaHandler() {
  showToast('Memproses', 'Menyiapkan kartu digital…', 'info');
  gsrun({
    success: r => { if (r.success) tampilkanLinkUnduhan(r.data.url, 'Kartu digital siap.'); else showToast('Belum Bisa', r.message, 'warning'); },
    fail: err => showToast('Error', err.message, 'danger')
  }).unduhKartuSaya(AppState.sessionToken);
}
function kirimKartuSayaKeEmailHandler() {
  gsrun({ success: r => showToast(r.success ? 'Terkirim' : 'Gagal', r.message, r.success ? 'success' : 'danger') }).kirimKartuSayaKeEmail(AppState.sessionToken);
}
function salinTautanKartuHandler() {
  const a = AppState.profil || {};
  if (!a.url_kartu_pdf) { showToast('Belum Tersedia', 'Kartu digital belum diterbitkan.', 'warning'); return; }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(a.url_kartu_pdf)
      .then(() => showToast('Tersalin', 'Tautan kartu digital disalin ke clipboard.', 'success'))
      .catch(() => showToast('Gagal', 'Tidak dapat menyalin tautan otomatis. Salin manual dari tombol unduh.', 'warning'));
  } else {
    showToast('Info', a.url_kartu_pdf, 'info');
  }
}

// Menampilkan pita status di atas form "Pembaruan Data Mandiri" jika Anggota
// memiliki pengajuan perubahan yang masih menunggu persetujuan Pengurus —
// mencegah pengajuan ganda dan memberi transparansi status ke Anggota.
function muatPerubahanSayaBanner() {
  gsrun({
    success: r => {
      const el = document.getElementById('dasborPerubahanBanner');
      if (!el) return;
      if (!r.success || !r.data) { el.innerHTML = ''; return; }
      const p = r.data;
      const daftarField = Object.keys(p.data_baru || {}).map(f => '<code>' + escapeHtml(f) + '</code>').join(', ');
      el.innerHTML = `
        <div class="card card-pad card-accent gold flex items-start gap-2">
          <span class="material-symbols-outlined text-[18px]" style="color:#B45309">hourglass_top</span>
          <div>
            <div class="text-xs font-bold text-ink">Pengajuan perubahan data Anda sedang ditinjau Pengurus</div>
            <div class="text-xs text-ink-soft mt-0.5">Field yang diajukan: ${daftarField || '-'} · Diajukan ${fmtTanggal(p.diajukan_pada)}</div>
          </div>
        </div>`;
    },
    fail: () => {}
  }).getPerubahanSaya(AppState.sessionToken);
}

function pageProfilSaya() {
  if (!requireLogin()) return;
  renderNavigation('Anggota');
  setContainer('<div class="page-loading"><div class="app-spinner" style="border-top-color:#0B2A5B"></div></div>');
  gsrun({ success: r => renderProfilSaya(r) }).getProfilSaya(AppState.sessionToken);
}
function renderProfilSaya(res) {
  if (!res.success) { showToast('Error', res.message, 'danger'); return; }
  const a = res.data;
  setContainer(`
  <div class="flex flex-col gap-4">
    <h1 class="font-head font-bold text-xl text-ink">Profil Saya</h1>
    <div class="card card-pad">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><label class="form-label">Nama Lengkap</label><input class="form-input" id="ps_nama" value="${escapeHtml(a.nama)}"></div>
        <div><label class="form-label">Nomor Taruna</label><input class="form-input" value="${escapeHtml(a.nomor_taruna)}" disabled></div>
        <div><label class="form-label">Program Studi</label><select class="form-select" id="ps_prodi">${PRODI_OPTS.map(p=>'<option value="'+p[0]+'"'+(a.prodi===p[0]?' selected':'')+'>'+p[1]+'</option>').join('')}</select></div>
        <div><label class="form-label">Angkatan</label><input class="form-input" id="ps_angkatan" value="${escapeHtml(a.angkatan)}"></div>
        <div><label class="form-label">Tahun Kelulusan</label><input class="form-input" id="ps_tahun_kelulusan" value="${escapeHtml(a.tahun_kelulusan)}"></div>
        <div><label class="form-label">Status Kepegawaian</label><select class="form-select" id="ps_status_kepegawaian">${STATUS_KEPEGAWAIAN_OPTS.map(s=>'<option value="'+s+'"'+(a.status_kepegawaian===s?' selected':'')+'>'+s+'</option>').join('')}</select></div>
        <div><label class="form-label">Instansi</label><input class="form-input" id="ps_instansi" value="${escapeHtml(a.instansi)}"></div>
        <div><label class="form-label">Jabatan Terakhir</label><input class="form-input" id="ps_jabatan_terakhir" value="${escapeHtml(a.jabatan_terakhir)}"></div>
        <div><label class="form-label">No. HP</label><input class="form-input" id="ps_no_hp" value="${escapeHtml(a.no_hp)}"></div>
        <div><label class="form-label">Email</label><input class="form-input" value="${escapeHtml(a.email)}" disabled></div>
      </div>
      <button class="btn-primary mt-4" onclick="simpanProfilSaya()">Simpan Perubahan</button>
    </div>
  </div>`);
}
function simpanProfilSaya() {
  const data = {
    nama: document.getElementById('ps_nama').value.trim(),
    prodi: document.getElementById('ps_prodi').value,
    angkatan: document.getElementById('ps_angkatan').value.trim(),
    tahun_kelulusan: document.getElementById('ps_tahun_kelulusan').value.trim(),
    status_kepegawaian: document.getElementById('ps_status_kepegawaian').value,
    instansi: document.getElementById('ps_instansi').value.trim(),
    jabatan_terakhir: document.getElementById('ps_jabatan_terakhir').value.trim(),
    no_hp: document.getElementById('ps_no_hp').value.trim()
  };
  // Diajukan ke antrean persetujuan Pengurus (ajukanPerubahanProfil), BUKAN langsung
  // menulis ke data resmi — konsisten dengan alur di Dasbor Anggota.
  gsrun({ success: r => showToast(r.success?'Diajukan':'Gagal', r.message, r.success?'success':'danger') }).ajukanPerubahanProfil(AppState.sessionToken, data);
}

function pageKeamananAkun() {
  if (!requireLogin()) return;
  renderNavigation('Anggota');
  setContainer(`
  <div class="flex flex-col gap-4">
    <h1 class="font-head font-bold text-xl text-ink">Keamanan Akun</h1>
    <div class="card card-pad">
      <h3 class="font-head font-semibold mb-3">Ganti Kata Sandi</h3>
      <div class="space-y-3">
        <div><label class="form-label">Kata Sandi Lama</label><input type="password" id="ks_lama" class="form-input"></div>
        <div><label class="form-label">Kata Sandi Baru</label><input type="password" id="ks_baru1" class="form-input"></div>
        <div><label class="form-label">Ulangi Kata Sandi Baru</label><input type="password" id="ks_baru2" class="form-input"></div>
      </div>
      <button class="btn-primary mt-4" onclick="gantiSandiHandler()">Ganti Kata Sandi</button>
    </div>
  </div>`);
}
function gantiSandiHandler() {
  const lama = document.getElementById('ks_lama').value;
  const b1 = document.getElementById('ks_baru1').value;
  const b2 = document.getElementById('ks_baru2').value;
  if (b1 !== b2) { showToast('Peringatan', 'Konfirmasi kata sandi tidak cocok.', 'warning'); return; }
  gsrun({ success: r => showToast(r.success?'Berhasil':'Gagal', r.message, r.success?'success':'danger') }).gantiSandi(AppState.sessionToken, lama, b1);
}

// ════════════════════════════════════════════════════════
// VERIFIKASI PUBLIK KARTU DIGITAL (QR SCAN, TANPA LOGIN)
// Halaman ini TIDAK memerlukan login (dipanggil dari window.__VERIFY_ID__,
// bootstrap oleh ?verifikasi=<id_record> — lihat DOMContentLoaded di atas)
// dan TIDAK menampilkan topbar/navigasi aplikasi.
// ════════════════════════════════════════════════════════
function pageVerifikasiKartu(verifId) {
  hideNavigation();
  setContainer(`
  <div class="auth-shell">
    <div class="auth-card" style="max-width:460px;">
      <div class="flex items-center gap-2 mb-4">${logoAtauFallback(32, logoSvgSmall())}<div><div class="font-head font-bold text-sm text-ink">SIM IKALLHUBDAT</div><div class="text-[10px] text-ink-soft uppercase tracking-wide">Verifikasi Kartu Digital Resmi</div></div></div>
      <div id="verifKartuBody" class="text-center py-6">
        <div class="app-spinner" style="border-top-color:#0B2A5B;margin:0 auto;"></div>
        <p class="mt-3 text-sm text-ink-soft">Memverifikasi kartu digital…</p>
      </div>
    </div>
  </div>`);
  gsrun({
    success: r => renderVerifikasiKartu(r),
    fail: err => renderVerifikasiKartu({ success: false, message: (err && err.message) || String(err) })
  }).getVerifikasiPublik(verifId);
}
function renderVerifikasiKartu(res) {
  const el = document.getElementById('verifKartuBody');
  if (!el) return;
  if (!res.success || !res.data) {
    el.innerHTML = `
      <div class="flex flex-col items-center gap-3">
        <div style="width:64px;height:64px;border-radius:9999px;background:#FEF2F2;display:flex;align-items:center;justify-content:center;">
          <span class="material-symbols-outlined text-[34px]" style="color:#DC2626;">gpp_maybe</span>
        </div>
        <h2 class="font-head font-bold text-lg text-ink">Kartu Tidak Terverifikasi</h2>
        <p class="text-sm text-ink-soft">${escapeHtml(res.message || 'Data tidak ditemukan atau kartu belum diverifikasi resmi oleh Pengurus.')}</p>
        <a href="javascript:void(0)" onclick="navigateTo('login',{noHistory:true})" class="text-xs font-semibold mt-2" style="color:var(--navy)">← Kembali ke halaman masuk</a>
      </div>`;
    return;
  }
  const d = res.data;
  const valid = d.validSaatIni;
  el.innerHTML = `
    <div class="flex flex-col items-center gap-3 text-center">
      <div style="width:64px;height:64px;border-radius:9999px;background:${valid ? '#ECFDF5' : '#FFFBEB'};display:flex;align-items:center;justify-content:center;">
        <span class="material-symbols-outlined text-[34px]" style="color:${valid ? '#059669' : '#92400E'};">${valid ? 'verified' : 'schedule'}</span>
      </div>
      <h2 class="font-head font-bold text-lg text-ink">${valid ? 'Kartu Anggota Terverifikasi Asli' : 'Kartu Ditemukan — Status Tidak Aktif'}</h2>
      <p class="text-xs text-ink-soft">${escapeHtml(d.organisasi)}</p>
      <div class="card card-pad w-full text-left mt-2" style="background:var(--bg-card-alt);">
        <div class="text-[10px] uppercase tracking-wider text-ink-soft">Nama Lengkap</div>
        <div class="font-head font-bold text-ink mb-2">${escapeHtml(d.nama)}</div>
        <div class="grid grid-cols-2 gap-3 text-xs">
          <div><div class="text-[9px] uppercase text-ink-soft">No. Anggota</div><div class="font-semibold">${escapeHtml(d.id_member || '-')}</div></div>
          <div><div class="text-[9px] uppercase text-ink-soft">Prodi / Angkatan</div><div class="font-semibold">${escapeHtml(d.prodi)} / ${escapeHtml(d.angkatan)}</div></div>
          <div><div class="text-[9px] uppercase text-ink-soft">Status Keanggotaan</div><div>${badgeAnggota(d.status_anggota)}</div></div>
          <div><div class="text-[9px] uppercase text-ink-soft">Masa Berlaku</div><div class="font-semibold">${fmtTanggal(d.masa_berlaku_kartu)}</div></div>
        </div>
      </div>
      <p class="text-[10.5px] text-ink-soft mt-1">Halaman ini menampilkan data resmi dari sistem SIM IKALLHUBDAT dan hanya menampilkan informasi identitas dasar — bukan data kontak pribadi anggota.</p>
      <a href="javascript:void(0)" onclick="navigateTo('login',{noHistory:true})" class="text-xs font-semibold mt-1" style="color:var(--navy)">← Kembali ke halaman masuk</a>
    </div>`;
}

// ════════════════════════════════════════════════════════
// VERIFIKASI PERUBAHAN DATA MANDIRI (PENGURUS)
// ════════════════════════════════════════════════════════
function pageVerifikasiPerubahan() {
  if (!requireLogin()) return;
  renderNavigation('Pengurus');
  setContainer('<div class="page-loading"><div class="app-spinner" style="border-top-color:#0B2A5B"></div></div>');
  gsrun({
    success: r => renderVerifikasiPerubahan(r),
    fail: err => renderErrorBox('app-container', err, 'pageVerifikasiPerubahan')
  }).getPerubahanMenunggu(AppState.sessionToken);
}
function renderVerifikasiPerubahan(res) {
  if (!res.success) { renderErrorBox('app-container', { message: res.message }, 'pageVerifikasiPerubahan'); return; }
  const rows = res.data || [];
  setContainer(`
  <div class="flex flex-col gap-5">
    <div class="card card-pad">
      <div class="flex items-center gap-2 flex-wrap"><h1 class="font-head font-bold text-xl text-ink">Verifikasi Perubahan Data Mandiri</h1>
        <span class="badge badge-menunggu">${rows.length} Pengajuan Menunggu</span>
      </div>
      <p class="text-sm text-ink-soft mt-1">Tinjau pembaruan data yang diajukan mandiri oleh Anggota sebelum diterapkan ke data resmi dan Kartu Digital.</p>
    </div>
    <div id="daftarPerubahanArea" class="flex flex-col gap-3">
      ${rows.length === 0 ? '<div class="card card-pad text-center py-10 text-ink-soft">Tidak ada pengajuan perubahan data yang menunggu.</div>' : rows.map(renderKartuPerubahan).join('')}
    </div>
  </div>`);
}
function renderKartuPerubahan(p) {
  const baris = Object.keys(p.data_baru || {}).map(f => `
    <tr>
      <td class="text-xs font-semibold">${escapeHtml(f)}</td>
      <td class="text-xs text-ink-soft">${escapeHtml(p.data_lama[f] == null || p.data_lama[f] === '' ? '-' : p.data_lama[f])}</td>
      <td class="text-xs" style="color:#059669">${escapeHtml(p.data_baru[f] == null || p.data_baru[f] === '' ? '-' : p.data_baru[f])}</td>
    </tr>`).join('');
  return `
  <div class="card card-pad" id="perubahan-${p.id_perubahan}">
    <div class="flex items-center justify-between flex-wrap gap-2 mb-2">
      <div><div class="font-head font-semibold text-ink">${escapeHtml(p.nama_pemohon)}</div><div class="text-xs text-ink-soft">${escapeHtml(p.email_pemohon)} · Diajukan ${fmtTanggal(p.diajukan_pada)}</div></div>
      <div class="flex gap-2">
        <button class="btn-danger" onclick="openTolakPerubahanModal('${p.id_perubahan}')"><span class="material-symbols-outlined text-[16px]">cancel</span> Tolak</button>
        <button class="btn-primary" onclick="setujuiPerubahanHandler('${p.id_perubahan}')"><span class="material-symbols-outlined text-[16px]">check_circle</span> Setujui</button>
      </div>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Field</th><th>Data Lama</th><th>Data Baru (Diajukan)</th></tr></thead>
        <tbody>${baris}</tbody>
      </table>
    </div>
  </div>`;
}
function setujuiPerubahanHandler(idPerubahan) {
  gsrun({
    success: r => {
      if (r.success) { showToast('Disetujui', r.message, 'success'); pageVerifikasiPerubahan(); }
      else showToast('Gagal', r.message, 'danger');
    }
  }).setujuiPerubahan(AppState.sessionToken, idPerubahan);
}
function openTolakPerubahanModal(idPerubahan) {
  openConfirmModal('Tolak Pengajuan Perubahan', 'Masukkan alasan penolakan:', () => {
    const alasan = document.getElementById('alasanTolakPerubahan').value.trim();
    if (!alasan) { showToast('Peringatan', 'Alasan wajib diisi.', 'warning'); return; }
    closeConfirmModal();
    gsrun({
      success: r => {
        if (r.success) { showToast('Ditolak', r.message, 'success'); pageVerifikasiPerubahan(); }
        else showToast('Gagal', r.message, 'danger');
      }
    }).tolakPerubahan(AppState.sessionToken, idPerubahan, alasan);
  }, '<textarea id="alasanTolakPerubahan" class="form-input" rows="3" placeholder="Contoh: Mohon lampirkan SK mutasi terbaru ke Pengurus"></textarea>');
  document.getElementById('confirmActionBtn').className = 'btn-danger';
}
