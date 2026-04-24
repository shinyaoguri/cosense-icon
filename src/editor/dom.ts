export function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`element not found: #${id}`);
  return el;
}

export function $input(id: string): HTMLInputElement {
  return $(id) as HTMLInputElement;
}

export function $select(id: string): HTMLSelectElement {
  return $(id) as HTMLSelectElement;
}

export function $textarea(id: string): HTMLTextAreaElement {
  return $(id) as HTMLTextAreaElement;
}

export function xmlEscape(s: unknown): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
