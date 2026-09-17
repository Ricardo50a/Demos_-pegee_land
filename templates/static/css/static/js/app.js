// ============ NAVEGACIÓN ENTRE PESTAÑAS ============
document.querySelectorAll('.nav-btn[data-target]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(btn.dataset.target).classList.add('active');
  });
});

// ============ BOTTOM SHEET: NUEVA TRANSACCIÓN ============
const backdrop = document.getElementById('sheet-backdrop');
const sheetNueva = document.getElementById('sheet-nueva');
const sheetImport = document.getElementById('sheet-import');

function closeAllSheets() {
  backdrop.classList.remove('active');
  sheetNueva.classList.remove('active');
  sheetImport.classList.remove('active');
}

document.getElementById('open-fab').addEventListener('click', () => {
  backdrop.classList.add('active');
  sheetNueva.classList.add('active');
});

document.getElementById('open-import').addEventListener('click', () => {
  backdrop.classList.add('active');
  sheetImport.classList.add('active');
});

document.querySelectorAll('[data-close-sheet]').forEach(b =>
  b.addEventListener('click', closeAllSheets)
);
backdrop.addEventListener('click', closeAllSheets);

// ============ BUSCADOR EN TIEMPO REAL ============
const searchInput = document.getElementById('search-input');
const filterTipo  = document.getElementById('filter-tipo');
const tbody       = document.getElementById('tx-tbody');

function filterRows() {
  const q    = searchInput.value.toLowerCase().trim();
  const tipo = filterTipo.value;

  let visibles = 0;
  tbody.querySelectorAll('tr').forEach(tr => {
    const coincideTexto =
      tr.dataset.factura.includes(q) || tr.dataset.desc.includes(q);
    const coincideTipo = !tipo || tr.dataset.tipo === tipo;
    const visible = coincideTexto && coincideTipo;
    tr.style.display = visible ? '' : 'none';
    if (visible) visibles++;
  });
}

if (searchInput) searchInput.addEventListener('input', filterRows);
if (filterTipo)  filterTipo.addEventListener('change', filterRows);

// ============ PAGINACIÓN "CARGAR MÁS" ============
const PAGE_SIZE = 20;
const loadMoreBtn = document.getElementById('btn-load-more');
let shown = PAGE_SIZE;

function applyPagination() {
  const rows = Array.from(tbody.querySelectorAll('tr'));
  rows.forEach((tr, i) => {
    if (i >= shown) tr.classList.add('hidden');
    else tr.classList.remove('hidden');
  });
  if (loadMoreBtn) {
    loadMoreBtn.classList.toggle('hidden', shown >= rows.length);
  }
}

if (loadMoreBtn) {
  loadMoreBtn.addEventListener('click', () => {
    shown += PAGE_SIZE;
    applyPagination();
  });
  applyPagination();
}

// ============ AUTO-OCULTAR TOASTS ============
setTimeout(() => {
  document.querySelectorAll('.toast').forEach(t => {
    t.style.transition = 'opacity .4s';
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 400);
  });
}, 4000);
