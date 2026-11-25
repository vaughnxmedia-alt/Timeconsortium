export function weekStarts(count = 8) {
  const now = new Date();
  const day = now.getDay();
  now.setDate(now.getDate() - ((day + 6) % 7));
  now.setHours(0, 0, 0, 0);
  const end = now.getTime();
  return Array.from({ length: count }, (_, index) => end - (count - 1 - index) * 7 * 24 * 60 * 60 * 1000);
}

export function weekOf(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.getDay();
  date.setDate(date.getDate() - ((day + 6) % 7));
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
