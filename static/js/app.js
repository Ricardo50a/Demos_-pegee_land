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

// ============ BOTTOM SHEET: NUEVA TRANSACCIÓN ============
const backdrop = document.getElementById('sheet-backdrop');
const sheetNueva = document.getElementById('sheet-nueva');
const sheetImport = document.getElementById('sheet-import');
const checkoutContainer = document.querySelector('.checkout-container'); // Pantalla de cobro

// Función única para cerrar TODOS los modales y la pantalla de cobro
function closeAllSheets() {
  if (backdrop) backdrop.classList.remove('active');
  if (sheetNueva) sheetNueva.classList.remove('active');
  if (sheetImport) sheetImport.classList.remove('active');
  
  // IMPORTANTE: Cerrar la pantalla de cobro si está abierta
  if (checkoutContainer) {
    checkoutContainer.style.display = 'none';
  }
  
  // Resetear el carrito y el total
  resetearApp(); 
}

// Función para resetear el estado de la app
function resetearApp() {
  if (typeof carrito !== 'undefined') carrito = [];
  if (typeof totalAPagar !== 'undefined') {
    totalAPagar = 0.00;
    const displayTotal = document.getElementById('checkout-total');
    if (displayTotal) displayTotal.innerText = `$ 0.00`;
  }
}

// Abrir Nueva Transacción (BOTÓN +)
document.getElementById('open-fab').addEventListener('click', () => {
  closeAllSheets(); // Limpia todo antes de abrir
  if (backdrop) backdrop.classList.add('active');
  if (sheetNueva) sheetNueva.classList.add('active');
});

// Abrir Importar
document.getElementById('open-import').addEventListener('click', () => {
  closeAllSheets();
  if (backdrop) backdrop.classList.add('active');
  if (sheetImport) sheetImport.classList.add('active');
});

// Cerrar modales al hacer clic en la X o en el fondo
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
      tr.dataset.factura.includes(q) || tr.dataset.desc.includes(q);
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

// ============ LÓGICA DE COBRO Y PAGOS ============
// Variable global para guardar el total actual
let totalAPagar = 0.00; 
let qrGenerator = null; 

// 1. Actualizar el monto en la pantalla
function actualizarTotal(nuevoTotal) {
  totalAPagar = nuevoTotal;
  const display = document.getElementById('checkout-total');
  if (display) display.innerText = `$ ${totalAPagar.toFixed(2)}`;
}

// 2. Lógica para métodos de pago directos (Efectivo y Tarjeta)
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

// 3. Lógica para Pago Móvil (Generar el QR)
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

  // Verificar que la librería QRCode esté cargada
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
    console.error("La librería QRCode no está cargada. Revisa el <script> en tu HTML.");
  }
}

// 4. Confirmar que el cliente ya pagó
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

// 5. Cerrar el modal del QR
function cerrarQR() {
  const qrModal = document.getElementById('qr-modal');
  if (qrModal) qrModal.style.display = 'none';
  if (qrGenerator) {
    qrGenerator.clear();
    qrGenerator = null;
  }
}

// 6. Función final que envía los datos y CIERRA TODO
function finalizarVenta(metodoPago, referencia = '') {
  const ventaData = {
    total: totalAPagar,
    metodo_pago: metodoPago,
    referencia: referencia,
    fecha: new Date().toISOString()
  };

  console.log("Enviando a Django:", ventaData);
  
  // ⚠️ AQUÍ DEBES HACER TU FETCH A DJANGO
  // fetch('/api/guardar-venta/', { method: 'POST', ... })
  
  // Después de guardar, cerramos TODO para dejar la app lista
  closeAllSheets();
  alert(`¡Venta registrada! Total: $${ventaData.total.toFixed(2)} - Método: ${metodoPago}`);
}
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

https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js

// Variable global para guardar el total actual (esto vendría de tu carrito de compras)
let totalAPagar = 5.00; 
let qrGenerator = null; // Para guardar la instancia del QR

// 1. Actualizar el monto en la pantalla cada vez que cambie el carrito
function actualizarTotal(nuevoTotal) {
  totalAPagar = nuevoTotal;
  document.getElementById('checkout-total').innerText = `$ ${totalAPagar.toFixed(2)}`;
}

// 2. Lógica para métodos de pago directos (Efectivo y Tarjeta)
function seleccionarPago(metodo) {
  if (metodo === 'Efectivo') {
    alert(`Cobrando $${totalAPagar.toFixed(2)} en Efectivo. ¡Listo!`);
    // Aquí guardas en tu base de datos y cierras la venta
    finalizarVenta(metodo);
  } 
  else if (metodo === 'Tarjeta') {
    // Aquí pides el número de voucher de la máquina física
    const voucher = prompt("Ingrese el número de voucher de la máquina POS:");
    if (voucher) {
      alert(`Pago con Tarjeta registrado. Voucher: ${voucher}`);
      finalizarVenta('Tarjeta', voucher);
    }
  }
}

// 3. Lógica para Pago Móvil (Generar el QR)
function mostrarQRPagoMovil() {
  // Mostrar el modal
  document.getElementById('qr-modal').style.display = 'flex';
  document.getElementById('qr-monto').innerText = `$ ${totalAPagar.toFixed(2)}`;

  // Limpiar QR anterior si existe
  const qrContainer = document.getElementById('qrcode-container');
  qrContainer.innerHTML = '';
  
  // DATOS DEL NEGOCIO (Estos deberían venir de la configuración de tu app)
  // Formato estándar de Pago Móvil en Venezuela: banco, cedula/rif, telefono, monto
  const datosPagoMovil = {
    banco: "0102", // Ej: Banco de Venezuela
    telefono: "04141234567",
    cedula: "V-12345678",
    monto: totalAPagar.toFixed(2)
  };

  // Convertir los datos a un string (formato de texto plano para el QR)
  // Puedes usar un formato JSON o un texto simple. 
  // Las apps bancarias suelen leer el formato de texto "banco=...&telefono=..."
  const qrData = `banco=${datosPagoMovil.banco}&telefono=${datosPagoMovil.telefono}&cedula=${datosPagoMovil.cedula}&monto=${datosPagoMovil.monto}`;

  // Generar el código QR
  qrGenerator = new QRCode(qrContainer, {
    text: qrData,
    width: 200,
    height: 200,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
}

// 4. Confirmar que el cliente ya pagó (El cajero presiona este botón)
function confirmarPagoMovil() {
  // Opcional: Pedir el número de referencia del recibo del banco para auditoría
  const referencia = prompt("Ingrese los últimos 4 dígitos de la referencia del Pago Móvil:");
  
  if (referencia) {
    alert(`Pago Móvil confirmado. Referencia: ${referencia}`);
    cerrarQR();
    finalizarVenta('Pago Móvil', referencia);
  } else {
    alert("Debe ingresar la referencia para confirmar el pago.");
  }
}

// 5. Cerrar el modal sin guardar
function cerrarQR() {
  document.getElementById('qr-modal').style.display = 'none';
  if (qrGenerator) {
    qrGenerator.clear(); // Limpiar el QR
    qrGenerator = null;
  }
}

// 6. Función final que envía los datos a tu backend (Python/Django)
function finalizarVenta(metodoPago, referencia = '') {
  // Aquí haces el fetch a tu API en Django
  const ventaData = {
    total: totalAPagar,
    metodo_pago: metodoPago,
    referencia: referencia,
    // productos: carritoActual, // Si tienes el array de productos
    fecha: new Date().toISOString()
  };

  console.log("Enviando a Django:", ventaData);
  
