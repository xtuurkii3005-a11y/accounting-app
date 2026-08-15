// ===================== دفتر — نظام الفواتير =====================
// كل البيانات تُحفظ محليًا على جهازك عبر localStorage (لا يوجد اتصال بالإنترنت أو خادم خارجي)

const STORAGE_KEY = 'daftar_invoices_v1';

let invoices = loadInvoices();
let sortState = { key: 'date', dir: 'desc' };

// ---------- تحميل / حفظ ----------
function loadInvoices(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){
    console.error('تعذر قراءة البيانات المحفوظة', e);
    return [];
  }
}

function saveInvoices(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
}

// ---------- عناصر DOM ----------
const rowsEl = document.getElementById('invoiceRows');
const tableWrap = document.querySelector('.table-wrap');
const searchInput = document.getElementById('searchInput');
const filterStatus = document.getElementById('filterStatus');
const filterCategory = document.getElementById('filterCategory');
const categoryList = document.getElementById('categoryList');

const modalOverlay = document.getElementById('modalOverlay');
const invoiceForm = document.getElementById('invoiceForm');
const modalTitle = document.getElementById('modalTitle');

const fInvoiceNumber = document.getElementById('fInvoiceNumber');
const fDate = document.getElementById('fDate');
const fParty = document.getElementById('fParty');
const fCategory = document.getElementById('fCategory');
const fStatus = document.getElementById('fStatus');
const fAmount = document.getElementById('fAmount');
const fVatRate = document.getElementById('fVatRate');
const fNotes = document.getElementById('fNotes');
const invoiceIdField = document.getElementById('invoiceId');

const previewVat = document.getElementById('previewVat');
const previewTotal = document.getElementById('previewTotal');

const defaultVatInput = document.getElementById('defaultVat');

// ---------- أدوات مساعدة ----------
function uid(){
  return 'inv_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}

function fmt(n){
  return (Math.round(n * 100) / 100).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
}

function computeVat(amount, rate){
  return (amount * (rate/100));
}

// ---------- فتح / إغلاق النافذة ----------
function openModal(editingInvoice){
  invoiceForm.reset();
  if(editingInvoice){
    modalTitle.textContent = 'تعديل الفاتورة';
    invoiceIdField.value = editingInvoice.id;
    fInvoiceNumber.value = editingInvoice.invoiceNumber;
    fDate.value = editingInvoice.date;
    fParty.value = editingInvoice.party;
    fCategory.value = editingInvoice.category || '';
    fStatus.value = editingInvoice.status;
    fAmount.value = editingInvoice.amount;
    fVatRate.value = editingInvoice.vatRate;
    fNotes.value = editingInvoice.notes || '';
  } else {
    modalTitle.textContent = 'فاتورة جديدة';
    invoiceIdField.value = '';
    fDate.value = new Date().toISOString().slice(0,10);
    fVatRate.value = defaultVatInput.value || 15;
    fStatus.value = 'unpaid';
  }
  updatePreview();
  modalOverlay.classList.add('open');
  fInvoiceNumber.focus();
}

function closeModal(){
  modalOverlay.classList.remove('open');
}

document.getElementById('openAddModal').addEventListener('click', () => openModal(null));
document.getElementById('cancelModal').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if(e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', (e) => { if(e.key === 'Escape') closeModal(); });

// ---------- معاينة حساب الضريبة أثناء الكتابة ----------
function updatePreview(){
  const amount = parseFloat(fAmount.value) || 0;
  const rate = parseFloat(fVatRate.value) || 0;
  const vat = computeVat(amount, rate);
  previewVat.textContent = fmt(vat);
  previewTotal.textContent = fmt(amount + vat);
}
fAmount.addEventListener('input', updatePreview);
fVatRate.addEventListener('input', updatePreview);

// ---------- حفظ الفاتورة (إضافة أو تعديل) ----------
invoiceForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const amount = parseFloat(fAmount.value) || 0;
  const vatRate = parseFloat(fVatRate.value) || 0;
  const vatAmount = computeVat(amount, vatRate);

  const data = {
    invoiceNumber: fInvoiceNumber.value.trim(),
    date: fDate.value,
    party: fParty.value.trim(),
    category: fCategory.value.trim() || 'غير مصنّف',
    status: fStatus.value,
    amount: amount,
    vatRate: vatRate,
    vatAmount: vatAmount,
    total: amount + vatAmount,
    notes: fNotes.value.trim()
  };

  const editingId = invoiceIdField.value;
  if(editingId){
    const idx = invoices.findIndex(inv => inv.id === editingId);
    if(idx > -1) invoices[idx] = { ...invoices[idx], ...data };
  } else {
    invoices.push({ id: uid(), ...data });
  }

  saveInvoices();
  closeModal();
  renderCategories();
  render();
});

// ---------- حذف فاتورة ----------
function deleteInvoice(id){
  const inv = invoices.find(i => i.id === id);
  if(!inv) return;
  if(!confirm(`حذف الفاتورة رقم "${inv.invoiceNumber}"؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
  invoices = invoices.filter(i => i.id !== id);
  saveInvoices();
  renderCategories();
  render();
}

// ---------- تبديل حالة السداد بضغطة واحدة ----------
function toggleStatus(id){
  const inv = invoices.find(i => i.id === id);
  if(!inv) return;
  inv.status = inv.status === 'paid' ? 'unpaid' : 'paid';
  saveInvoices();
  render();
}

// ---------- الفرز ----------
document.querySelectorAll('th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if(sortState.key === key){
      sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
    } else {
      sortState = { key, dir: 'asc' };
    }
    render();
  });
});

// ---------- التصفية والبحث ----------
[searchInput, filterStatus, filterCategory].forEach(el => {
  el.addEventListener('input', render);
  el.addEventListener('change', render);
});

function getFilteredSorted(){
  const q = searchInput.value.trim().toLowerCase();
  const statusF = filterStatus.value;
  const catF = filterCategory.value;

  let list = invoices.filter(inv => {
    const matchesQ = !q || inv.invoiceNumber.toLowerCase().includes(q) || inv.party.toLowerCase().includes(q);
    const matchesStatus = statusF === 'all' || inv.status === statusF;
    const matchesCat = catF === 'all' || inv.category === catF;
    return matchesQ && matchesStatus && matchesCat;
  });

  list.sort((a,b) => {
    let va = a[sortState.key], vb = b[sortState.key];
    if(typeof va === 'string') va = va.toLowerCase();
    if(typeof vb === 'string') vb = vb.toLowerCase();
    if(va < vb) return sortState.dir === 'asc' ? -1 : 1;
    if(va > vb) return sortState.dir === 'asc' ? 1 : -1;
    return 0;
  });

  return list;
}

// ---------- تحديث قائمة التصنيفات ----------
function renderCategories(){
  const cats = [...new Set(invoices.map(i => i.category).filter(Boolean))].sort();

  filterCategory.innerHTML = '<option value="all">كل التصنيفات</option>' +
    cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

  categoryList.innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">`).join('');
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- الرسم الرئيسي ----------
function render(){
  const list = getFilteredSorted();

  rowsEl.innerHTML = list.map(inv => `
    <tr>
      <td class="mono">${inv.date}</td>
      <td class="mono">${escapeHtml(inv.invoiceNumber)}</td>
      <td>${escapeHtml(inv.party)}</td>
      <td>${escapeHtml(inv.category)}</td>
      <td class="mono">${fmt(inv.amount)}</td>
      <td class="mono">${fmt(inv.vatAmount)} <span style="color:var(--text-dim); font-size:11px;">(${inv.vatRate}%)</span></td>
      <td class="mono"><b>${fmt(inv.total)}</b></td>
      <td>
        <span class="badge ${inv.status}" style="cursor:pointer" data-toggle="${inv.id}">
          ${inv.status === 'paid' ? 'محصّلة' : 'غير محصّلة'}
        </span>
      </td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" data-edit="${inv.id}" title="تعديل">✎</button>
          <button class="icon-btn" data-del="${inv.id}" title="حذف">✕</button>
        </div>
      </td>
    </tr>
  `).join('');

  tableWrap.classList.toggle('is-empty', invoices.length === 0);

  // ربط أزرار الصفوف
  rowsEl.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openModal(invoices.find(i => i.id === btn.dataset.edit)));
  });
  rowsEl.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => deleteInvoice(btn.dataset.del));
  });
  rowsEl.querySelectorAll('[data-toggle]').forEach(badge => {
    badge.addEventListener('click', () => toggleStatus(badge.dataset.toggle));
  });

  renderSummary(list);
}

function renderSummary(list){
  const count = list.length;
  const subtotal = list.reduce((s,i) => s + i.amount, 0);
  const vat = list.reduce((s,i) => s + i.vatAmount, 0);
  const total = list.reduce((s,i) => s + i.total, 0);
  const unpaid = list.filter(i => i.status === 'unpaid').reduce((s,i) => s + i.total, 0);

  document.getElementById('statCount').textContent = count;
  document.getElementById('statSubtotal').textContent = fmt(subtotal);
  document.getElementById('statVat').textContent = fmt(vat);
  document.getElementById('statTotal').textContent = fmt(total);
  document.getElementById('statUnpaid').textContent = fmt(unpaid);
}

// ---------- تصدير CSV ----------
document.getElementById('exportCsv').addEventListener('click', () => {
  const list = getFilteredSorted();
  if(list.length === 0){ alert('لا توجد فواتير لتصديرها'); return; }

  const headers = ['رقم الفاتورة','التاريخ','الجهة','التصنيف','المبلغ قبل الضريبة','نسبة الضريبة','مبلغ الضريبة','الإجمالي','الحالة','ملاحظات'];
  const rows = list.map(i => [
    i.invoiceNumber, i.date, i.party, i.category,
    i.amount.toFixed(2), i.vatRate + '%', i.vatAmount.toFixed(2), i.total.toFixed(2),
    i.status === 'paid' ? 'محصّلة' : 'غير محصّلة', i.notes || ''
  ]);

  const csv = '\uFEFF' + [headers, ...rows].map(r =>
    r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')
  ).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `فواتير-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

// ===================== مسح الفاتورة بالصورة (Claude Vision) =====================

const SCAN_KEY_STORAGE = 'daftar_api_key_v1';

const scanOverlay = document.getElementById('scanOverlay');
const openScanModal = document.getElementById('openScanModal');
const cancelScan = document.getElementById('cancelScan');
const apiKeyInput = document.getElementById('apiKeyInput');
const scanFileInput = document.getElementById('scanFileInput');
const scanPreviewImg = document.getElementById('scanPreviewImg');
const analyzeBtn = document.getElementById('analyzeBtn');
const scanStatus = document.getElementById('scanStatus');

let selectedImageBase64 = null;
let selectedImageMediaType = null;

// استرجاع مفتاح API المحفوظ سابقًا (إن وُجد)
apiKeyInput.value = localStorage.getItem(SCAN_KEY_STORAGE) || '';

openScanModal.addEventListener('click', () => {
  scanStatus.textContent = '';
  scanStatus.className = 'scan-status';
  scanOverlay.classList.add('open');
});
cancelScan.addEventListener('click', () => scanOverlay.classList.remove('open'));
scanOverlay.addEventListener('click', (e) => { if(e.target === scanOverlay) scanOverlay.classList.remove('open'); });

scanFileInput.addEventListener('change', () => {
  const file = scanFileInput.files[0];
  if(!file) return;
  selectedImageMediaType = file.type;
  const reader = new FileReader();
  reader.onload = () => {
    // reader.result = "data:image/jpeg;base64,XXXX" — نحتاج الجزء بعد الفاصلة فقط
    selectedImageBase64 = reader.result.split(',')[1];
    scanPreviewImg.src = reader.result;
    scanPreviewImg.style.display = 'block';
  };
  reader.readAsDataURL(file);
});

analyzeBtn.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();

  if(!apiKey){
    setScanStatus('الرجاء إدخال مفتاح API أولاً', 'error');
    return;
  }
  if(!selectedImageBase64){
    setScanStatus('الرجاء اختيار صورة الفاتورة أولاً', 'error');
    return;
  }

  localStorage.setItem(SCAN_KEY_STORAGE, apiKey);
  setScanStatus('جاري تحليل الفاتورة، انتظر لحظات...', 'loading');
  analyzeBtn.disabled = true;

  try{
    const extracted = await extractInvoiceFromImage(apiKey, selectedImageBase64, selectedImageMediaType);
    setScanStatus('تم استخراج البيانات. راجعها ثم اضغط "حفظ الفاتورة".', 'ok');
    scanOverlay.classList.remove('open');
    openModal(null); // يفتح فورم فاتورة جديدة فارغ
    // نعبّي الحقول بالبيانات المستخرجة — تبقى قابلة للتعديل قبل الحفظ
    fInvoiceNumber.value = extracted.invoiceNumber || '';
    fDate.value = extracted.date || new Date().toISOString().slice(0,10);
    fParty.value = extracted.party || '';
    fCategory.value = extracted.category || '';
    fAmount.value = extracted.amount ?? '';
    fVatRate.value = extracted.vatRate ?? (defaultVatInput.value || 15);
    fNotes.value = 'تم الاستخراج تلقائيًا من صورة — تم مراجعة الأرقام يدويًا قبل الحفظ.';
    updatePreview();
  }catch(err){
    console.error(err);
    setScanStatus('تعذر تحليل الفاتورة: ' + err.message, 'error');
  }finally{
    analyzeBtn.disabled = false;
  }
});

function setScanStatus(msg, type){
  scanStatus.textContent = msg;
  scanStatus.className = 'scan-status ' + (type || '');
}

async function extractInvoiceFromImage(apiKey, base64, mediaType){
  const prompt = `أنت أداة استخراج بيانات محاسبية. انظر لصورة الفاتورة المرفقة واستخرج منها البيانات التالية بدقة.
أعد الرد بصيغة JSON فقط بدون أي نص إضافي وبدون علامات markdown، بهذا الشكل بالضبط:
{
  "invoiceNumber": "رقم الفاتورة كما هو مكتوب",
  "date": "YYYY-MM-DD",
  "party": "اسم العميل أو المورد أو اسم المتجر",
  "category": "تصنيف مقترح قصير مثل: مبيعات أو مشتريات أو إيجار أو مواصلات",
  "amount": رقم المبلغ قبل الضريبة فقط بدون رمز عملة,
  "vatRate": رقم نسبة الضريبة إن وُجدت وإلا استخدم 15
}
إذا لم تستطع قراءة حقل معين بثقة، اجعل قيمته فارغة "" أو null، ولا تخترع أرقامًا غير موجودة في الصورة.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: prompt }
        ]
      }]
    })
  });

  if(!response.ok){
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody?.error?.message || `خطأ من الخادم (${response.status})`);
  }

  const data = await response.json();
  const textBlock = data.content.find(b => b.type === 'text');
  if(!textBlock) throw new Error('لم يصل رد نصي من النموذج');

  let clean = textBlock.text.trim().replace(/^```json/i, '').replace(/^```/,'').replace(/```$/,'').trim();

  let parsed;
  try{
    parsed = JSON.parse(clean);
  }catch(e){
    throw new Error('تعذر فهم رد النموذج، جرّب صورة أوضح');
  }
  return parsed;
}

// ---------- تشغيل أولي ----------
renderCategories();
render();
