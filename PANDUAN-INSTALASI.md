# Panduan Migrasi SIM IKALLHUBDAT ke GitHub Pages

Arsitektur baru: **frontend statis di GitHub Pages** + **Google Apps Script sebagai REST API** (JSON).
Data tetap di Google Sheets/Drive Anda; tidak ada yang dipindah.

> **Folder yang di-`git init` = folder hasil ekstrak ZIP ini** (yang langsung berisi `index.html`, `css/`, `js/`). Bukan folder di atasnya, bukan masuk lebih dalam.

---

## BAGIAN A — Backend (Google Apps Script)

File backend **tidak ada di dalam ZIP** — `Kode.gs` dikirim terpisah.

1. Buka proyek Apps Script SIM IKALLHUBDAT yang sudah ada.
2. Ganti isi `Kode.gs` dengan `Kode.gs` yang baru (paste seluruhnya).
3. **Pertahankan** `Kartu.html` dan `Laporan.html` apa adanya (tidak berubah; dipakai untuk membuat PDF kartu & rekap).
4. **Hapus** `Index.html`, `Stylesheet.html`, `JavaScript.html` dari proyek Apps Script (sudah pindah ke GitHub Pages).
5. Di `Kode.gs` baris atas, isi nanti `SITE_URL_DEFAULT` dengan URL GitHub Pages Anda (lihat Bagian D langkah 3). Contoh:
   `const SITE_URL_DEFAULT = 'https://budi.github.io/sim-ikallhubdat/';`
6. **Deploy → Manage deployments → ikon pensil (Edit) → Version: New version → Deploy.**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Dengan cara ini URL `/exec` **tidak berubah**, jadi `js/config.js` sudah terisi benar.
7. Tes cepat: buka URL `/exec` di browser — harus tampil JSON `{"success":true,...,"message":"SIM IKALLHUBDAT API aktif."}`.

> Jika Apps Script meminta izin baru (scope), klik **Review permissions** dan izinkan.

---

## BAGIAN B — Siapkan Git & GitHub (sekali saja)

**B1. Install Git** — Windows: https://git-scm.com/download/win (pengaturan default). Lalu buka **PowerShell**. Cek:
```
git --version
```

**B2. Akun GitHub** — daftar di https://github.com (username jadi bagian URL situs: `username.github.io`).

**B3. Identitas Git** (label di riwayat, bukan untuk login):
```
git config --global user.name "Nama Anda"
git config --global user.email "email-akun-github@contoh.com"
```

**B4. Buat repository** — github.com → **+** → **New repository** → nama mis. `sim-ikallhubdat` → **Public** → **jangan** centang README/.gitignore/license → **Create repository**.

---

## BAGIAN C — Push dari terminal (jangan "Upload files" di web GitHub!)

Upload lewat web membuat folder `css/` dan `js/` rata dan situs rusak. Selalu lewat terminal.

**C1. Masuk ke folder hasil ekstrak ZIP.** Di File Explorer buka folder itu → klik address bar → ketik `powershell` → Enter.

**C2. Verifikasi isi folder (WAJIB sebelum `git init`):**
```
dir
```
Harus terlihat `index.html`, `css`, `js` langsung di sini. Jika yang terlihat hanya satu folder lain, Anda satu level terlalu tinggi — masuk ke dalamnya dulu.

**C3. Satu per satu:**
```
git init
git add .
git commit -m "Upload pertama"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```
(ganti `USERNAME` dan `NAMA-REPO`; `git add .` ada titik di akhir.)

**C4. Login saat `git push`:** Username = username GitHub. Password = **Personal Access Token**, bukan password akun.
Buat token: https://github.com/settings/tokens → *Generate new token (classic)* → centang **repo** → Generate → salin `ghp_...` (hanya tampil sekali).
Saat paste token di terminal, layar **tampak kosong — itu normal**. Tekan Enter.
Tanda berhasil: `* [new branch] main -> main`.

(Alternatif tanpa token manual: GitHub Desktop → Add Local Repository → Publish.)

---

## BAGIAN D — Aktifkan GitHub Pages

1. Repo di github.com → **Settings → Pages**.
2. Source: **Deploy from a branch** → Branch **main** · **/ (root)** → **Save**. Centang **Enforce HTTPS**.
3. Tunggu 1–2 menit → muncul `https://USERNAME.github.io/NAMA-REPO/`. **Salin URL ini.**
4. Kembali ke Apps Script → isi `SITE_URL_DEFAULT` di `Kode.gs` dengan URL itu (berakhiran `/`) → **deploy New version** lagi (Bagian A langkah 6).
   - Ini yang membuat tautan **reset kata sandi** dan **QR kartu baru** mengarah ke situs baru.
   - Alternatif tanpa edit kode: tambah baris `site_url` | `<URL>` di sheet **Pengaturan**.
5. Kartu lama yang sudah dicetak/dikirim (QR ke URL `/exec`) tetap berfungsi: halaman perantara akan mengarahkan ke situs baru. Kartu **baru/cetak ulang** langsung memakai URL baru.

---

## BAGIAN E — Uji

1. Buka situs → Beranda, Profil, Berita, Galeri tampil (data dari Sheets).
2. **Login Admin** dengan email + kata sandi Pengurus (login Google dihapus).
3. Daftar Alumni Baru → cek baris masuk di sheet Anggota.
4. Cetak ulang satu kartu → pindai QR → halaman verifikasi tampil.
5. Lupa kata sandi → email berisi tautan `github.io/...?reset=...`.
6. Jika ada error: F12 → **Console** / **Network**, kirim screenshot.

## Update di kemudian hari
```
git add .
git commit -m "Deskripsi perubahan"
git push
```
Jika tampilan lama masih muncul: **Ctrl+Shift+R**.

## Troubleshooting singkat
| Gejala | Penyebab / solusi |
|---|---|
| 404 di GitHub Pages | `index.html` tidak di root repo (salah folder saat `git init`). Pindah ke folder yang benar → `git init`, `git add .`, `git commit`, `git push -u origin main --force` |
| Halaman tanpa styling | Folder `css/` `js/` rata di root (upload via web). Push ulang dari terminal |
| "Respons server tidak valid" | Web App belum "Anyone", atau `GAS_URL` di `js/config.js` salah, atau belum deploy *New version* |
| Data tidak muncul / error "Fungsi API tidak dikenal" | `Kode.gs` di Apps Script belum versi baru / belum deploy ulang |
| Tautan email/QR membuka `USERNAME.github.io/NAMA-REPO` | `SITE_URL_DEFAULT` belum diisi |
| `Password authentication is not supported` | Pakai Personal Access Token |
| `LF will be replaced by CRLF` | Warning, abaikan |
