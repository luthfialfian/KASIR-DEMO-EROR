/******************************************************************
 * script.js - Kasir Demo (final)
 * Semua fitur: master, cart, pending(1), settlement, print,
 * laporan (filter + export), shortcuts, dark mode, UI effects
 ******************************************************************/

/* ---------------- Data Master ---------------- */
const MASTER = [
  {plu: '1001', name: 'Popok Bayi Uk S 28pcs', price: 42000},
  {plu: '1002', name: 'Popok Bayi M 24pcs', price: 47000},
  {plu: '1003', name: 'Susu Bubuk 400gr', price: 85000},
  {plu: '2001', name: 'Sabun Mandi Anak 200ml', price: 15000},
  {plu: '3001', name: 'Tepung Susu 100gr', price: 25000},
  {plu: '4001', name: 'Botol Susu 250ml', price: 55000},
  {plu: '5001', name: 'Tissue Basah 40pcs', price: 12000},
  {plu: '6001', name: 'Dot Bayi Silicone', price: 18000},
  {plu: '7001', name: 'Mainan Gantungan Kursi', price: 32000},
  {plu: '8001', name: 'Minyak Telon 60ml', price: 9000},
];

/* ---------------- State ---------------- */
let cart = []; // {plu,name,price,qty,discPercent,justAdded?}
const currency = v => Number(v || 0).toLocaleString('id-ID');

/* ---------------- DOM refs (safe) ---------------- */
const el = id => document.getElementById(id);
const cartBody = el('cartBody');
const grandTotalEl = el('grandTotal');
const totalItemsEl = el('totalItems');
const totalQtyEl = el('totalQty');
const totalDiscountEl = el('totalDiscount');
const barcodeInput = el('barcodeInput');
const addByBarcodeBtn = el('addByBarcode');
const modalPay = el('modalPay');
const payTotal = el('payTotal');
const payAmount = el('payAmount');
const payChange = el('payChange');
const receiptPreview = el('receiptPreview');
const btnSettle = el('btnSettle');
const settleBtnFooter = el('settle');
const btnPending = el('btnPending');
const savePendingBtn = el('savePending');
const loadPendingBtn = el('loadPending');
const loaderEl = document.getElementById('loader'); // might be null
const toggleDarkBtn = el('toggleDark');

/* ---------------- Init date & restore prefs ---------------- */
if (el('nowDate')) el('nowDate').textContent = new Date().toLocaleString('id-ID');
(function restoreDarkPref(){
  try {
    if(localStorage.getItem('darkMode') === '1') document.body.classList.add('dark');
    else {
      // auto-night fallback: if not set, auto by hour
      if(localStorage.getItem('darkMode') === null){
        const h = new Date().getHours();
        if(h >= 18 || h < 6) document.body.classList.add('dark');
      }
    }
  } catch(e){}
})();

/* ---------------- Helpers: loader ---------------- */
function showLoader(){
  if(loaderEl) loaderEl.style.display = 'flex';
}
function hideLoader(){
  if(loaderEl) loaderEl.style.display = 'none';
}

/* ---------------- Master list render ---------------- */
function renderMasterList(){
  const list = el('masterList');
  if(!list) return;
  list.innerHTML = '';
  MASTER.forEach(m=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${m.plu}</td><td>${m.name}</td><td style="text-align:right">${currency(m.price)}</td>
      <td style="text-align:right"><button class="btn small" data-plu="${m.plu}">Tambah</button></td>`;
    list.appendChild(tr);
  });
  // attach
  list.querySelectorAll('button[data-plu]').forEach(b=>{
    b.addEventListener('click', e=>{
      addItemByPLU(e.currentTarget.dataset.plu);
      closeMaster();
    });
  });
}

/* ---------------- Utilities ---------------- */
function findMasterByPLU(plu){ return MASTER.find(m => String(m.plu) === String(plu)); }

function calcItemNetPrice(item){
  return Math.round((Number(item.price)||0) * (1 - (Number(item.discPercent)||0)/100));
}
function calcItemTotal(item){ return calcItemNetPrice(item) * (Number(item.qty)||0); }

function calcTotals(){
  let grand = 0, totalQty = 0, totalItems = cart.length, totalDiscAmount = 0;
  cart.forEach(i=>{
    const lt = calcItemTotal(i);
    const base = Number(i.price) * Number(i.qty);
    totalDiscAmount += (base - lt);
    grand += lt;
    totalQty += Number(i.qty);
  });
  return {grand, totalQty, totalItems, totalDiscAmount};
}

/* ---------------- Render cart ---------------- */
function renderCart(){
  // clear & build rows
  if(!cartBody) return;
  cartBody.innerHTML = '';
  cart.forEach(item => {
    const net = calcItemNetPrice(item);
    const lt = calcItemTotal(item);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.plu}</td>
      <td><input class="tbl-input tbl-input-left" value="${item.name}" readonly /></td>
      <td><input class="tbl-input" value="${currency(item.price)}" readonly /></td>
      <td><input class="tbl-input qty" data-plu="${item.plu}" value="${item.qty}" /></td>
      <td><input class="tbl-input disc" data-plu="${item.plu}" value="${item.discPercent}" /></td>
      <td><input class="tbl-input" value="${currency(net)}" readonly /></td>
      <td><input class="tbl-input" value="${currency(lt)}" readonly /></td>
      <td style="text-align:center"><button class="btn ghost remove" data-plu="${item.plu}">X</button></td>
    `;
    if(item.justAdded) {
      tr.classList.add('added');
      // remove justAdded flag so highlight occurs once
      delete item.justAdded;
    }
    cartBody.appendChild(tr);
  });

  // attach events
  cartBody.querySelectorAll('.qty').forEach(inp => {
    inp.addEventListener('change', e => updateItem(e.target.dataset.plu, 'qty', e.target.value));
  });
  cartBody.querySelectorAll('.disc').forEach(inp => {
    inp.addEventListener('change', e => updateItem(e.target.dataset.plu, 'disc', e.target.value));
  });
  cartBody.querySelectorAll('.remove').forEach(btn => {
    btn.addEventListener('click', e => {
      if(confirm('Hapus item ini?')) {
        removeItem(e.target.dataset.plu);
      }
    });
  });

  // totals
  const t = calcTotals();
  if(grandTotalEl) {
    grandTotalEl.textContent = currency(t.grand);
    // total animation
    grandTotalEl.classList.add('updated');
    setTimeout(()=>grandTotalEl.classList.remove('updated'), 350);
  }
  if(totalItemsEl) totalItemsEl.textContent = t.totalItems;
  if(totalQtyEl) totalQtyEl.textContent = t.totalQty;
  if(totalDiscountEl) totalDiscountEl.textContent = currency(t.totalDiscAmount);

  // if pay modal open, refresh preview & totals in modal
  if(modalPay && modalPay.style.display === 'flex'){
    if(payTotal) payTotal.textContent = currency(t.grand);
    buildReceiptPreview();
  }

  // update pending badge (if we support multiple pending keys)
  updatePendingBadge();
}

/* ---------------- Add / Update / Remove ---------------- */
function addItemByPLU(plu, qty = 1){
  const master = findMasterByPLU(plu);
  if(!master){
    alert('Barang tidak ditemukan: ' + plu);
    return;
  }
  const exists = cart.find(i => i.plu === master.plu);
  if(exists){
    exists.qty = Number(exists.qty) + qty;
    exists.justAdded = true;
  } else {
    cart.push({plu: master.plu, name: master.name, price: Number(master.price), qty, discPercent: 0, justAdded: true});
  }
  renderCart();
}

function removeItem(plu){
  cart = cart.filter(i => i.plu !== plu);
  renderCart();
}

function updateItem(plu, field, value){
  const it = cart.find(i => i.plu === plu);
  if(!it) return;
  if(field === 'qty'){
    let q = Number(value) || 1;
    if(q < 1) q = 1;
    it.qty = q;
  }
  if(field === 'disc'){
    let d = Number(value) || 0;
    if(d < 0) d = 0;
    if(d > 100) d = 100;
    it.discPercent = d;
  }
  renderCart();
}

/* ---------------- Barcode input handlers ---------------- */
if(addByBarcodeBtn){
  addByBarcodeBtn.addEventListener('click', ()=> {
    const v = (barcodeInput && barcodeInput.value || '').trim();
    if(!v) return;
    addItemByPLU(v, 1);
    barcodeInput.value = '';
    barcodeInput.focus();
  });
}
if(barcodeInput){
  barcodeInput.addEventListener('keydown', e => { if(e.key === 'Enter') addByBarcodeBtn.click(); });
}

/* ---------------- Settlement / Pay Modal ---------------- */
function openPayModal(){
  if(cart.length === 0){ alert('Keranjang kosong'); return; }
  const totals = calcTotals();
  if(payTotal) payTotal.textContent = currency(totals.grand);
  if(payAmount) payAmount.value = totals.grand;
  if(payChange) payChange.value = '0';
  buildReceiptPreview();
  if(modalPay){
    modalPay.style.display = 'flex';
    modalPay.style.alignItems = 'center';
    modalPay.style.justifyContent = 'center';
  }
}
function closePayModal(){ if(modalPay) modalPay.style.display = 'none'; }

if(payAmount){
  payAmount.addEventListener('input', ()=>{
    const paid = Number(payAmount.value) || 0;
    const total = calcTotals().grand;
    const change = paid - total;
    payChange.value = change >= 0 ? currency(change) : '0';
  });
}

// confirm pay
if(el('confirmPay')){
  el('confirmPay').addEventListener('click', ()=>{
    const paid = Number(payAmount && payAmount.value) || 0;
    const totals = calcTotals();
    if(paid < totals.grand){
      if(!confirm('Pembayaran kurang. Simpan sebagai piutang?')) return;
    }
    const tx = {
      id: 'TX' + Date.now(),
      invoice: `${(el('invStore') && el('invStore').value||'')}-${(el('invTerminal')&&el('invTerminal').value||'')}-${(el('invNo')&&el('invNo').value||'')}`,
      cashier: (el('kasirName') && el('kasirName').textContent) || '',
      memberNo: (el('memberNo') && el('memberNo').value) || '',
      memberName: (el('memberName') && el('memberName').value) || '',
      items: JSON.parse(JSON.stringify(cart)),
      totals,
      paid,
      change: (paid - totals.grand),
      timestamp: Date.now()
    };
    saveTransactionHistory(tx);
    alert('Transaksi selesai. ID: ' + tx.id);
    cart = [];
    renderCart();
    closePayModal();
  });
}
if(el('cancelPay')) el('cancelPay').addEventListener('click', closePayModal);
if(btnSettle) btnSettle.addEventListener('click', openPayModal);
if(settleBtnFooter) settleBtnFooter.addEventListener('click', openPayModal);

/* ---------------- Keyboard shortcuts ---------------- */
window.addEventListener('keydown', e => {
  if(e.key === 'F11'){ e.preventDefault(); openPayModal(); }
  if(e.key === 'F2'){ savePendingClick(); }
  if(e.key === 'Escape'){ closePayModal(); closeMaster(); }
  if(e.key === 'Delete'){
    if(cart.length > 0 && confirm('Hapus item terakhir?')){
      cart.pop(); renderCart();
    }
  }
});

/* ---------------- Receipt builder & print ---------------- */
function buildReceiptPreview(){
  const totals = calcTotals();
  let r = '';
  r += 'ASOKA BABY STORE JATIWARINGIN\n';
  r += 'Invoice: ' + `${(el('invStore')&&el('invStore').value||'')}-${(el('invTerminal')&&el('invTerminal').value||'')}-${(el('invNo')&&el('invNo').value||'')}` + '\n';
  r += 'Kasir: ' + (el('kasirName') && el('kasirName').textContent || '') + '\n';
  r += 'Tanggal: ' + new Date().toLocaleString('id-ID') + '\n';
  r += '--------------------------------\n';
  cart.forEach(i => {
    const net = calcItemNetPrice(i);
    const lt = calcItemTotal(i);
    r += `${i.name}\n ${i.qty} x ${currency(net)} = ${currency(lt)}\n`;
  });
  r += '--------------------------------\n';
  r += `Total : ${currency(totals.grand)}\n`;
  r += `Disc  : ${currency(totals.totalDiscAmount)}\n`;
  r += '\nTERIMA KASIH\n';
  if(receiptPreview) receiptPreview.textContent = r;
}

if(el('btnPrint')) {
  el('btnPrint').addEventListener('click', ()=>{
    buildReceiptPreview();
    // print in new window
    const w = window.open('', 'PRINT');
    w.document.write(`
      <html>
        <head>
          <title>Struk Belanja</title>
          <style>body{font-family:monospace;font-size:12px}.receipt{white-space:pre}</style>
        </head>
        <body>
          <div class="receipt">${(receiptPreview&&receiptPreview.textContent)||''}</div>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  });
}

/* ---------------- Pending (1 slot) ---------------- */
function savePendingClick(){
  if(cart.length === 0){ alert('Tidak ada item untuk disimpan'); return; }
  try {
    localStorage.setItem('PENDING', JSON.stringify({cart, timestamp: Date.now()}));
    alert('Keranjang disimpan sebagai pending.');
    cart = [];
    renderCart();
  } catch(e){
    alert('Gagal menyimpan pending: ' + e.message);
  }
}
if(savePendingBtn) savePendingBtn.addEventListener('click', savePendingClick);

if(loadPendingBtn) loadPendingBtn.addEventListener('click', ()=>{
  try {
    const data = JSON.parse(localStorage.getItem('PENDING'));
    if(!data || !data.cart || data.cart.length === 0){ alert('Tidak ada pending tersimpan'); return; }
    cart = data.cart;
    renderCart();
    alert('Pending berhasil dimuat kembali');
    localStorage.removeItem('PENDING');
  } catch(e){
    alert('Gagal load pending: ' + e.message);
  }
});

/* ---------------- Print/Clear/Void ---------------- */
if(el('btnClear')) el('btnClear').addEventListener('click', ()=>{ if(confirm('Void: hapus semua item?')){ cart=[]; renderCart(); }});
if(el('clearCart')) el('clearCart').addEventListener('click', ()=>{ if(confirm('Bersihkan keranjang?')){ cart=[]; renderCart(); }});

/* ---------------- Master modal open/close ---------------- */
if(el('openMaster')) {
  el('openMaster').addEventListener('click', ()=>{
    renderMasterList();
    const modal = el('modalMaster');
    if(modal){ modal.style.display = 'flex'; modal.style.alignItems = 'center'; modal.style.justifyContent = 'center'; }
  });
}
function closeMaster(){ const m = el('modalMaster'); if(m) m.style.display = 'none'; }
if(el('closeMaster')) el('closeMaster').addEventListener('click', closeMaster);

/* ---------------- Member apply ---------------- */
if(el('applyMember')) el('applyMember').addEventListener('click', ()=>{
  const no = (el('memberNo') && el('memberNo').value || '').trim();
  const name = (el('memberName') && el('memberName').value || '').trim();
  if(!no){ alert('Masukkan nomor member.'); return; }
  if(el('memberPoint')) el('memberPoint').value = Math.floor(Math.random() * 500);
  alert('Member diterapkan: ' + name);
});

/* ---------------- Transaction history save ---------------- */
function saveTransactionHistory(tx){
  try {
    localStorage.setItem('TX-' + tx.id, JSON.stringify(tx));
    const invNoEl = el('invNo');
    if(invNoEl){
      const invNo = Number(invNoEl.value) || 0;
      invNoEl.value = String(invNo + 1).padStart(5, '0');
    }
  } catch(e){
    console.warn('Gagal menyimpan transaksi', e);
  }
}

/* ---------------- Report modal & filter (renderReport) ---------------- */
function renderReport(){
  const tbody = el('reportList');
  if(!tbody) return;
  tbody.innerHTML = '';
  const fromV = (el('filterFrom') && el('filterFrom').value) || '';
  const toV = (el('filterTo') && el('filterTo').value) || '';
  const from = fromV ? new Date(fromV) : null;
  const to = toV ? new Date(toV) : null;

  const keys = Object.keys(localStorage).filter(k => k.startsWith('TX-')).sort();
  if(keys.length === 0){
    tbody.innerHTML = '<tr><td colspan="5">Belum ada transaksi</td></tr>';
    return;
  }
  keys.forEach(k=>{
    try {
      const tx = JSON.parse(localStorage.getItem(k));
      if(!tx) return;
      const tgl = new Date(tx.timestamp || Date.now());
      if(from && tgl < from) return;
      if(to){ let end = new Date(to); end.setHours(23,59,59,999); if(tgl > end) return; }
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${tgl.toLocaleString('id-ID')}</td><td>${tx.invoice}</td><td>${tx.cashier}</td><td style="text-align:right">${currency(tx.totals.grand)}</td><td><button class="btn ghost small" data-id="${tx.id}">Detail</button></td>`;
      tbody.appendChild(tr);
    } catch(e){}
  });

  // attach detail
  tbody.querySelectorAll('button[data-id]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const tx = JSON.parse(localStorage.getItem('TX-' + b.dataset.id));
      if(!tx) return;
      let detail = `Invoice: ${tx.invoice}\nKasir: ${tx.cashier}\nTanggal: ${new Date(tx.timestamp||Date.now()).toLocaleString('id-ID')}\n--------------------------------\n`;
      tx.items.forEach(i=>{ detail += `${i.name}\n ${i.qty} x ${currency(calcItemNetPrice(i))} = ${currency(calcItemTotal(i))}\n`; });
      detail += `--------------------------------\nTotal: ${currency(tx.totals.grand)}\n`;
      alert(detail);
    });
  });
}
function openReport(){ renderReport(); const m = el('modalReport'); if(m){ m.style.display='flex'; m.style.alignItems='center'; m.style.justifyContent='center'; } }
function closeReport(){ const m = el('modalReport'); if(m) m.style.display='none'; }
if(el('openReport')) el('openReport').addEventListener('click', openReport);
if(el('closeReport')) el('closeReport').addEventListener('click', closeReport);
if(el('applyFilter')) el('applyFilter').addEventListener('click', renderReport);

/* ---------------- Export CSV ---------------- */
if(el('exportCSV')) el('exportCSV').addEventListener('click', ()=>{
  const keys = Object.keys(localStorage).filter(k => k.startsWith('TX-')).sort();
  if(keys.length === 0){ alert('Tidak ada transaksi untuk diexport'); return; }
  let csv = 'Tanggal,Invoice,Kasir,Total\n';
  keys.forEach(k=>{
    try {
      const tx = JSON.parse(localStorage.getItem(k));
      if(!tx) return;
      csv += `"${new Date(tx.timestamp||Date.now()).toLocaleString('id-ID')}","${tx.invoice}","${tx.cashier}","${tx.totals.grand}"\n`;
    } catch(e){}
  });
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'laporan.csv'; a.click();
  URL.revokeObjectURL(url);
});

/* ---------------- Pending badge (optional) ---------------- */
function updatePendingBadge(){
  try {
    const btn = btnPending;
    if(!btn) return;
    // We use single slot 'PENDING' in this build; show badge if present
    const has = !!localStorage.getItem('PENDING');
    if(has) btn.setAttribute('data-count', '1');
    else btn.removeAttribute('data-count');
  } catch(e){}
}
setInterval(updatePendingBadge, 1500);

/* ---------------- Dark mode toggle ---------------- */
if(toggleDarkBtn){
  toggleDarkBtn.addEventListener('click', ()=>{
    document.body.classList.toggle('dark');
    try { localStorage.setItem('darkMode', document.body.classList.contains('dark') ? '1' : '0'); } catch(e){}
  });
}

/* ---------------- Ripple effect for buttons ---------------- */
document.addEventListener('click', function(e){
  const b = e.target.closest && e.target.closest('.btn');
  if(!b) return;
  const rect = b.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  b.style.setProperty('--x', x + 'px');
  b.style.setProperty('--y', y + 'px');
  // small ripple animation by manipulating ::after via CSS already present
});

/* ---------------- Modal backdrop: click outside to close ---------------- */
document.querySelectorAll('.modal-back').forEach(mb => {
  mb.addEventListener('click', e => { if(e.target === mb) mb.style.display = 'none'; });
});

/* ---------------- Init render ---------------- */
(function init(){
  renderCart();
  renderMasterList();
  updatePendingBadge();
  // hide loader if any after short delay
  setTimeout(()=>hideLoader(), 350);
})();

// Note: we used calcItemNetPrice and calcItemTotal earlier; ensure they're in scope (yes)

/* EOF */
