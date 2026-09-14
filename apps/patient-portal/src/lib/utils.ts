export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function isMinor(dateNaissance: string) {
  if (!dateNaissance) return false;
  const birth = new Date(dateNaissance);
  if (Number.isNaN(birth.getTime())) return false;
  const age = (Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return age < 18;
}
