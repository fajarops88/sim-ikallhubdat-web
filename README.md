# SIM IKALLHUBDAT — Frontend (GitHub Pages)

Sistem Informasi Manajemen Data Alumni IKALLHUBDAT DPD Kalimantan Timur.

- **Frontend**: HTML/CSS/JS statis (folder ini) — di-host di GitHub Pages.
- **Backend**: Google Apps Script sebagai REST API JSON (`Kode.gs`, tidak ada di repo ini).
- **Konfigurasi**: edit `js/config.js` (`GAS_URL`).

Struktur:
```
index.html
css/app.min.css  ← gaya (Tailwind hasil build + style kustom, sudah diperkecil)
js/config.js     ← URL API (GAS /exec)
js/api.js        ← fetch ke GAS (pengganti google.script.run)
js/app.min.js    ← seluruh logika aplikasi (sudah diperkecil)
```

Panduan lengkap: lihat `PANDUAN-INSTALASI.md`.
