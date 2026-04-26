// localStorage に保存するお気に入り一覧 (端末ローカル限定。アカウント不要)
const KEY = "cosense-icon:favorites";
const PANE_KEY = "cosense-icon:favPaneOpen";

export interface Favorite {
  id: string;
  path: string;
  text: string;
  createdAt: number;
}

function isFavorite(x: unknown): x is Favorite {
  if (!x || typeof x !== "object") return false;
  const v = x as Partial<Favorite>;
  return (
    typeof v.id === "string" &&
    typeof v.path === "string" &&
    typeof v.text === "string" &&
    typeof v.createdAt === "number"
  );
}

export function loadFavs(): Favorite[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isFavorite);
  } catch {
    return [];
  }
}

function saveFavs(list: Favorite[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // localStorage 不可 (private mode 等) は無視
  }
}

export function addFav(path: string, text: string): Favorite[] {
  const list = loadFavs();
  // 同一 path は重複追加せず、先頭に持ち上げる
  const existing = list.findIndex(f => f.path === path);
  if (existing >= 0) {
    const [item] = list.splice(existing, 1);
    if (item) list.unshift(item);
    saveFavs(list);
    return list;
  }
  const fav: Favorite = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    path,
    text,
    createdAt: Date.now(),
  };
  list.unshift(fav);
  saveFavs(list);
  return list;
}

export function removeFavByPath(path: string): Favorite[] {
  const next = loadFavs().filter(f => f.path !== path);
  saveFavs(next);
  return next;
}

export function removeFavById(id: string): Favorite[] {
  const next = loadFavs().filter(f => f.id !== id);
  saveFavs(next);
  return next;
}

export function isFav(path: string): boolean {
  return loadFavs().some(f => f.path === path);
}

export function loadPaneOpen(): boolean {
  try {
    return localStorage.getItem(PANE_KEY) === "1";
  } catch {
    return false;
  }
}

export function savePaneOpen(open: boolean): void {
  try {
    localStorage.setItem(PANE_KEY, open ? "1" : "0");
  } catch {
    // ignore
  }
}
