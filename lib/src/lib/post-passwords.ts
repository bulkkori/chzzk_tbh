const STORAGE_KEY = "confession-post-passwords-v1";

type Map = Record<string, string>;

function read(): Map {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Map;
  } catch {
    // ignore
  }
  return {};
}

function write(next: Map) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function rememberPostPassword(postId: string, password: string) {
  const next = { ...read(), [postId]: password };
  write(next);
}

export function recallPostPassword(postId: string): string | null {
  return read()[postId] ?? null;
}

export function forgetPostPassword(postId: string) {
  const current = read();
  if (!(postId in current)) return;
  const { [postId]: _, ...rest } = current;
  write(rest);
}
