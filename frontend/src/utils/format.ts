// Formato natural de cantidades según unidad (punto 5).
// Internamente se conserva Numeric(12,3); solo cambia la presentación:
// KG: 1, 2.5, 10 (nunca "1.000") · UND: 1, 2, 10
export function fmtCantidad(valor: string | number | null | undefined, unidad?: string | null): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  const n = Number(valor);
  if (Number.isNaN(n)) return String(valor);
  const u = (unidad ?? "").toUpperCase();
  if (u === "UND") return String(Math.round(n));
  // Peso: recortar ceros innecesarios (1.000 -> 1, 2.500 -> 2.5)
  const s = n.toFixed(3);
  return s.replace(/\.?0+$/, "") || "0";
}

export function fmtMoney(valor: string | number | null | undefined): string {
  const n = Number(valor ?? 0);
  if (Number.isNaN(n)) return "$0";
  return `$${n.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
}

export function fmtFechaHora(iso: string | null | undefined): string {
  const w = isoToBogotaWall(iso);
  if (!w) return iso ? String(iso) : "—";
  return `${w.date} ${w.time}`;
}

export function fmtFecha(iso: string | null | undefined): string {
  const w = isoToBogotaWall(iso);
  if (!w) return iso ? String(iso).slice(0, 10) : "—";
  return w.date;
}

// "2026-09-23 10:30" corto para tablas (hora de Bogotá, no UTC crudo).
export function fmtFechaHoraCorta(iso: string | null | undefined): string {
  const w = isoToBogotaWall(iso);
  if (!w) return "—";
  return `${w.date} ${w.time}`;
}

// Colombia = UTC-5 fijo (sin horario de verano). Todas las conversiones
// usan este offset explícito para que lo seleccionado sea lo guardado/mostrado,
// sin depender de la zona del navegador.

// Convierte datetime-local (YYYY-MM-DDTHH:mm) a ISO para el backend.
export function localToISO(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// Convierte ISO del backend a valor para <input type="datetime-local">.
export function isoToLocal(iso: string | null | undefined): string {
  const w = isoToBogotaWall(iso);
  if (!w) return "";
  return `${w.date}T${w.time}`;
}

// Hora de Bogotá (UTC-5) como partes {date: "23/09/2026", time: "10:30"}.
// date en formato es-CO (DD/MM/AAAA) para mostrar; para inputs usar las
// funciones isoToDatePart / isoToTimePart de abajo.
export function isoToBogotaWall(iso: string | null | undefined): { date: string; time: string; isoDate: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const bog = new Date(d.getTime() - 5 * 3600 * 1000);
  const p = (x: number) => String(x).padStart(2, "0");
  const dd = p(bog.getUTCDate());
  const mm = p(bog.getUTCMonth() + 1);
  const yyyy = bog.getUTCFullYear();
  const hh = p(bog.getUTCHours());
  const mi = p(bog.getUTCMinutes());
  return { date: `${dd}/${mm}/${yyyy}`, time: `${hh}:${mi}`, isoDate: `${yyyy}-${mm}-${dd}` };
}

// Parte de fecha (YYYY-MM-DD) para <input type="date"> (hora de Bogotá).
export function isoToDatePart(iso: string | null | undefined): string {
  return isoToBogotaWall(iso)?.isoDate ?? "";
}

// Parte de hora (HH:MM) para <input type="time"> (hora de Bogotá, selector nativo).
export function isoToTimePart(iso: string | null | undefined): string {
  return isoToBogotaWall(iso)?.time ?? "";
}

// Combina fecha (YYYY-MM-DD) + hora (HH:MM) interpretadas como hora de
// Bogotá (UTC-5) y devuelve ISO (UTC) para el backend. Lo que el usuario
// selecciona es exactamente lo que queda guardado.
export function dateTimeToISO(fecha: string, hora: string): string | null {
  if (!fecha) return null;
  const d = new Date(`${fecha}T${hora || "12:00"}:00-05:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
