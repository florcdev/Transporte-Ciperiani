const fmtDinero = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const fmtDineroConCentavos = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2
});
const fmtNumero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

export const dinero = n => {
  const importe = Number(n) || 0;
  const importeVisible = Math.abs(importe) < 0.5 ? 0 : importe;
  return fmtDinero.format(importeVisible).replace(/\s/g, '');
};
export const dineroConCentavos = n => fmtDineroConCentavos.format(Number(n) || 0).replace(/\s/g, '');
export const numero = n => fmtNumero.format(Number(n) || 0);
/** Importe sin el símbolo $ (para inputs que ya muestran el prefijo). */
export const importe = n => dinero(n).replace('$', '');

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY' */
export function fecha(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Timestamp con zona horaria -> fecha local 'DD/MM/YYYY'. */
export function fechaHora(iso) {
  return iso ? new Date(iso).toLocaleDateString('es-AR') : '—';
}

/** Fecha de hoy en 'YYYY-MM-DD' usando la hora local (no UTC). */
export function hoyISO() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[c]));
}