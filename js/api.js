// ============================================
// API CLIENT — pengganti google.script.run
// ============================================
// Satu endpoint: POST ke GAS_URL dengan body JSON { fn, args }.
// WAJIB Content-Type text/plain agar browser tidak mengirim CORS preflight
// (Apps Script tidak menjawab preflight OPTIONS).

async function callApi(fn, args) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ fn: fn, args: args || [] })
  });
  if (!res.ok) throw new Error('Server mengembalikan status ' + res.status + '.');
  let json;
  try {
    json = await res.json();
  } catch (e) {
    throw new Error('Respons server tidak valid. Pastikan Web App di-deploy dengan akses "Anyone" dan GAS_URL di js/config.js benar.');
  }
  return json;
}

// Pola pemakaian TIDAK berubah dari versi lama:
//   gsrun({ success: res => ..., fail: err => ... }).namaFungsiServer(arg1, arg2)
// Proxy meneruskan nama fungsi apa pun ke callApi(); daftar fungsi yang diizinkan
// ditentukan di backend (API_WHITELIST di Kode.gs).
function gsrun(handlers) {
  handlers = handlers || {};
  const onFail = handlers.fail || (err => showToast('Error', (err && err.message) || String(err), 'danger'));
  return new Proxy({}, {
    get: function (_, fn) {
      if (typeof fn !== 'string') return undefined;
      return function () {
        const args = Array.prototype.slice.call(arguments);
        callApi(fn, args).then(
          function (res) { if (handlers.success) handlers.success(res); },
          function (err) { onFail(err); }
        );
      };
    }
  });
}
