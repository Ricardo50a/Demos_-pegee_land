// ============================================
// MiContaBeta Pro - JavaScript Principal
// ============================================

// ============ NAVEGACIÓN ENTRE PESTAÑAS ============
document.querySelectorAll('.nav-btn[data-target]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const targetView = document.getElementById(btn.dataset.target);
    if (targetView) targetView.classList.add('active');
  });
});

// ============ REFERENCIAS A ELEMENTOS ============
const backdrop = document.getElementById('sheet-backdrop');
const sheetNueva = document.getElementById('sheet-nueva');
const sheetImport = document.getElementById('sheet-import');
const checkoutContainer = document.getElementById('checkout-container');

// ============ VARIABLES GLOBALES ============
let totalAPagar = 0.00;
let qrGenerator = null;
let carrito = [];

// ============ FUNCIÓN: CERRAR TODOS LOS MODALES ============
function closeAllSheets() {
  if (backdrop) backdrop.classList.remove('active');
  if (sheetNueva) sheetNueva.classList.remove('active');
  if (sheetImport) sheetImport.classList.remove('active');
  if (checkoutContainer) checkoutContainer.style.display = 'none';
  resetearApp();
}

// ============ FUNCIÓN: RESETEAR ESTADO ============
function resetearApp() {
  carrito = [];
  totalAPagar = 0.00;
  const displayTotal = document.getElementById('checkout-total');
  if (displayTotal) displayTotal.innerText = '$ 0.00';
}

// ============ BOTÓN "+" (NUEVA TRANSACCIÓN) ============
const openFab = document.getElementById('open-fab');
if (openFab) {
  openFab.addEventListener('click', () => {
    closeAllSheets();
    // Abrimos el bottom sheet de nueva transacción
    if (backdrop) backdrop.classList.add('active');
    if (sheetNueva) sheetNueva.classList.add('active');
  });
}

// ============ BOTÓN IMPORTAR ============
const openImport = document.getElementById('open-import');
if (openImport) {
  openImport.addEventListener('click', () => {
    closeAllSheets();
    if (backdrop) backdrop.classList.add('active');
    if (sheetImport) sheetImport.classList.add('active');
  });
}

// ============ CERRAR MODALES ============
document.querySelectorAll('[data-close-sheet]').forEach(b =>
  b.addEventListener('click', closeAllSheets)
);
if (backdrop) backdrop.addEventListener('click', closeAllSheets);

// ============ BUSCADOR EN TIEMPO REAL ============
const searchInput = document.getElementById('search-input');
const filterTipo  = document.getElementById('filter-tipo');
const tbody       = document.getElementById('tx-tbody');

function filterRows() {
  if (!searchInput || !filterTipo || !tbody) return;
  const q    = searchInput.value.toLowerCase().trim();
  const tipo = filterTipo.value;

  tbody.querySelectorAll('tr').forEach(tr => {
    const coincideTexto =
      (tr.dataset.factura || '').includes(q) ||
      (tr.dataset.desc || '').includes(q);
    const coincideTipo = !tipo || tr.dataset.tipo === tipo;
    const visible = coincideTexto && coincideTipo;
    tr.style.display = visible ? '' : 'none';
  });
}

if (searchInput) searchInput.addEventListener('input', filterRows);
if (filterTipo)  filterTipo.addEventListener('change', filterRows);

// ============ PAGINACIÓN "CARGAR MÁS" ============
const PAGE_SIZE = 20;
const loadMoreBtn = document.getElementById('btn-load-more');
let shown = PAGE_SIZE;

function applyPagination() {
  if (!tbody) return;
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

// ============ LÓGICA DE COBRO ============

// Actualizar el monto en la pantalla
function actualizarTotal(nuevoTotal) {
  totalAPagar = nuevoTotal;
  const display = document.getElementById('checkout-total');
  if (display) display.innerText = `$ ${totalAPagar.toFixed(2)}`;
}

// Métodos de pago directos (Efectivo y Tarjeta)
function seleccionarPago(metodo) {
  if (metodo === 'Efectivo') {
    alert(`Cobrando $${totalAPagar.toFixed(2)} en Efectivo. ¡Listo!`);
    finalizarVenta(metodo);
  } 
  else if (metodo === 'Tarjeta') {
    const voucher = prompt("Ingrese el número de voucher de la máquina POS:");
    if (voucher) {
      alert(`Pago con Tarjeta registrado. Voucher: ${voucher}`);
      finalizarVenta('Tarjeta', voucher);
    }
  }
}

// Pago Móvil (Generar el QR)
function mostrarQRPagoMovil() {
  const qrModal = document.getElementById('qr-modal');
  if (qrModal) qrModal.style.display = 'flex';
  
  const qrMonto = document.getElementById('qr-monto');
  if (qrMonto) qrMonto.innerText = `$ ${totalAPagar.toFixed(2)}`;

  const qrContainer = document.getElementById('qrcode-container');
  if (!qrContainer) return;
  qrContainer.innerHTML = '';
  
  const datosPagoMovil = {
    banco: "0102",
    telefono: "04141234567",
    cedula: "V-12345678",
    monto: totalAPagar.toFixed(2)
  };

  const qrData = `banco=${datosPagoMovil.banco}&telefono=${datosPagoMovil.telefono}&cedula=${datosPagoMovil.cedula}&monto=${datosPagoMovil.monto}`;

  if (typeof QRCode !== 'undefined') {
    qrGenerator = new QRCode(qrContainer, {
      text: qrData,
      width: 200,
      height: 200,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
  } else {
    console.error("La librería QRCode no está cargada.");
    alert("Error: No se pudo generar el código QR.");
  }
}

// Confirmar pago móvil
function confirmarPagoMovil() {
  const referencia = prompt("Ingrese los últimos 4 dígitos de la referencia del Pago Móvil:");
  if (referencia) {
    alert(`Pago Móvil confirmado. Referencia: ${referencia}`);
    cerrarQR();
    finalizarVenta('Pago Móvil', referencia);
  } else {
    alert("Debe ingresar la referencia para confirmar el pago.");
  }
}

// Cerrar el modal del QR
function cerrarQR() {
  const qrModal = document.getElementById('qr-modal');
  if (qrModal) qrModal.style.display = 'none';
  if (qrGenerator) {
    qrGenerator.clear();
    qrGenerator = null;
  }
}

// Función final: guardar venta y cerrar todo
function finalizarVenta(metodoPago, referencia = '') {
  const ventaData = {
    total: totalAPagar,
    metodo_pago: metodoPago,
    referencia: referencia,
    fecha: new Date().toISOString()
  };

  console.log("Enviando a Django:", ventaData);
  
  // ⚠️ AQUÍ CONECTARÁS CON TU BACKEND EN DJANGO
  /*
  fetch('/api/guardar-venta/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ventaData)
  })
  .then(res => res.json())
  .then(data => {
    alert(`¡Venta registrada! Total: $${ventaData.total.toFixed(2)}`);
    closeAllSheets();
  })
  .catch(err => console.error('Error:', err));
  */
  
  // Simulación por ahora:
  alert(`¡Venta registrada! Total: $${ventaData.total.toFixed(2)} - Método: ${metodoPago}`);
  closeAllSheets();
}
