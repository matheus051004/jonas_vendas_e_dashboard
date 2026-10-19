/**
 * Intervalos padrão de follow-up em minutos (1h, 2h, 3h).
 */
export const DEFAULT_FOLLOW_UP_INTERVALS = [60, 120, 180];

/**
 * Converte minutos em representação legível em português (ex: "15 min", "1 hora", "2 horas", "1 dia").
 */
export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "0 min";
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return `${days} ${days === 1 ? "dia" : "dias"}`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${hours === 1 ? "hora" : "horas"}`;
  }
  if (minutes > 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }
  return `${minutes} min`;
}
