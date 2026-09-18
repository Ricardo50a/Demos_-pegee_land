
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

// ============ REFERENCIAS ============
const backdrop = document.getElementById('sheet-backdrop');
const sheetNueva = document.getElementById('sheet-nueva');
const sheetImport = document.getElementById('sheet-import');
const checkoutContainer = document.getElementById('checkout-container');
const qrModal = document.getElementById('qr-modal');

// ============ VARIABLES GLOBALES ============
let totalAPagar = 0.00;
let qrGenerator = null;

// ============ ACTUALIZAR TOTAL ============
function actualizarTotal(nuevoTotal) {
  totalAPagar = nuevoTotal;
  const display = document.getElementById('checkout-total');
  if (display) display.innerText = '$ ' + totalAPagar.toFixed(2);
}

// ============ CERRAR TODO ============
function closeAllSheets() {
  if (backdrop) backdrop.classList.remove('active');
  if (sheetNueva) sheetNueva.classList.remove('active');
  if (sheetImport) sheetImport.classList.remove('active');
  if (checkoutContainer) checkoutContainer.classList.remove('active');
}

function cerrarCheckout() {
  if (checkoutContainer) checkoutContainer.classList.remove('active');
}

// ============ BOTÓN "+" → FORMULARIO VACÍO (INGRESO POR DEFECTO) ============
// Este botón es para el CONTADOR: abre el formulario manual.
const openFab = document.getElementById('open-fab');
if (openFab) {
  openFab.addEventListener('click', () => {
    closeAllSheets();
    if (backdrop) backdrop.classList.add('active');
    if (sheetNueva) sheetNueva.classList.add('active');
    // Resetear a "Ingreso"
    const radioIngreso = document.getElementById('t-income');
    if (radioIngreso) radioIngreso.checked = true;
    // Enfocar el primer campo
    setTimeout(() => {
      const inputFactura = document.getElementById('factura_numero');
      if (inputFactura) inputFactura.focus();
    }, 300);
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

// ============ BUSCADOR ============
const searchInput = document.getElementById('search-input');
const filterTipo  = document.getElementById('filter-tipo');
const tbody       = document.getElementById('tx-tbody');

function filterRows() {
  if (!searchInput || !filterTipo || !tbody) return;
  const q = searchInput.value.toLowerCase().trim();
  const tipo = filterTipo.value;
  tbody.querySelectorAll('tr').forEach(tr => {
    const coincideTexto = (tr.dataset.factura || '').includes(q) || (tr.dataset.desc || '').includes(q);
    const coincideTipo = !tipo || tr.dataset.tipo === tipo;
    tr.style.display = (coincideTexto && coincideTipo) ? '' : 'none';
  });
}
if (searchInput) searchInput.addEventListener('input', filterRows);
if (filterTipo) filterTipo.addEventListener('change', filterRows);

// ============ PAGINACIÓN ============
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
  if (loadMoreBtn) loadMoreBtn.classList.toggle('hidden', shown >= rows.length);
}
if (loadMoreBtn) {
  loadMoreBtn.addEventListener('click', () => { shown += PAGE_SIZE; applyPagination(); });
  applyPagination();
}

// ============ TOASTS ============
setTimeout(() => {
  document.querySelectorAll('.toast').forEach(t => {
    t.style.transition = 'opacity .4s';
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 400);
  });
}, 4000);

// ============================================
// ACCIONES RÁPIDAS - CADA UNA HACE ALGO DISTINTO
// ============================================
function accionNuevaVenta() {
  closeAllSheets();
  
  // Pedir el monto al usuario
  const montoIngresado = prompt("Ingrese el monto a cobrar:", "");
  
  // Validar que sea un número válido
  const monto = parseFloat(montoIngresado);
  if (isNaN(monto) || monto <= 0) {
    mostrarToast("❌ Monto no válido", "error");
    return;
  }

  // Asignar el monto y abrir checkout
  actualizarTotal(monto);
  if (checkoutContainer) {
    checkoutContainer.classList.add('active');
  }
}

// 2. NUEVO GASTO → FORMULARIO DIRECTO CON EGRESO SELECCIONADO
function accionNuevoGasto() {
  closeAllSheets();
  if (backdrop) backdrop.classList.add('active');
  if (sheetNueva) sheetNueva.classList.add('active');
  // Preseleccionamos "Egreso"
  const radioEgreso = document.getElementById('t-expense');
  if (radioEgreso) {
    radioEgreso.checked = true;
    radioEgreso.dispatchEvent(new Event('change'));
  }
  setTimeout(() => {
    const inputFactura = document.getElementById('factura_numero');
    if (inputFactura) inputFactura.focus();
  }, 300);
}

// 3. CIERRE DE CAJA → NAVEGA A LA VISTA DE CIERRE/AUDITORÍA
function accionCierreCaja() {
  closeAllSheets();
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const btnCierre = document.querySelector('.nav-btn[data-target="view-cierre"]');
  if (btnCierre) btnCierre.classList.add('active');
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const viewCierre = document.getElementById('view-cierre');
  if (viewCierre) viewCierre.classList.add('active');
}

// ============ PAGOS ============
function seleccionarPago(metodo) {
  if (metodo === 'Efectivo') {
    // Aquí ya no pide nada. Cierra la venta directo.
    finalizarVenta('Efectivo');
  } else if (metodo === 'Tarjeta') {
    const voucher = prompt("Ingrese el número de voucher de la máquina POS:");
    if (voucher) {
      finalizarVenta('Tarjeta', voucher);
    }
  }
}

function mostrarQRPagoMovil() {
  if (!qrModal) return;
  qrModal.classList.add('active');

  const qrMonto = document.getElementById('qr-monto');
  if (qrMonto) qrMonto.innerText = '$ ' + totalAPagar.toFixed(2);

  const qrContainer = document.getElementById('qrcode-container');
  if (!qrContainer) return;
  qrContainer.innerHTML = '';

  const qrData = 'banco=0102&telefono=04141234567&cedula=V-12345678&monto=' + totalAPagar.toFixed(2);

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
    alert("Error: La librería QR no está cargada.");
  }
}

function confirmarPagoMovil() {
  const referencia = prompt("Ingrese los últimos 4 dígitos de la referencia:");
  if (referencia) {
    cerrarQR();
    finalizarVenta('Pago Móvil', referencia);
  }
}

function cerrarQR() {
  if (qrModal) qrModal.classList.remove('active');
  if (qrGenerator) {
    qrGenerator.clear();
    qrGenerator = null;
  }
}

// ============ FINALIZAR VENTA ============
function finalizarVenta(metodoPago, referencia) {
  referencia = referencia || '';
  const ventaData = {
    total: totalAPagar,
    metodo_pago: metodoPago,
    referencia: referencia,
    fecha: new Date().toISOString()
  };

  console.log("Venta registrada:", ventaData);

  // Aquí conectarás con tu SMS o tu backend para autorizar el pago
  // Por ahora, simulamos la autorización
  setTimeout(() => {
    closeAllSheets();
    // Un solo mensaje corto, no dos alerts
    const mensaje = metodoPago === 'Efectivo'
      ? '✅ Venta en efectivo: $' + ventaData.total.toFixed(2)
      : '✅ Venta autorizada por ' + metodoPago + ': $' + ventaData.total.toFixed(2);
    
    // Usamos un toast en lugar de un alert (menos intrusivo)
    mostrarToast(mensaje, 'success');
  }, 300);
}

// ============ TOAST DE NOTIFICACIÓN (MEJOR QUE ALERT) ============
function mostrarToast(mensaje, tipo) {
  const container = document.querySelector('.toast-container') || (() => {
    const c = document.createElement('div');
    c.className = 'toast-container';
    document.body.appendChild(c);
    return c;
  })();
  
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + (tipo || 'success');
  toast.innerText = mensaje;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.transition = 'opacity .4s';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}
