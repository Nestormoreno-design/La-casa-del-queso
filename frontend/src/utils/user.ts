// Nombres visibles DEMO (sin cambios de backend).
// username -> nombre para mostrar. Login sigue siendo admin/admin.
const DISPLAY_NAMES: Record<string, string> = {
  admin: "Néstor",
};

export function displayName(username?: string | null): string {
  if (!username) return "Usuario";
  return DISPLAY_NAMES[username] ?? username;
}

export function displayRole(rol?: string | null): string {
  if (!rol) return "";
  return rol.charAt(0).toUpperCase() + rol.slice(1);
}
