// 上中央に出すトースト通知。type に応じて自動消滅 / 進捗中は手動更新までは消えない
type ToastType = "info" | "progress" | "success" | "error";

let currentTimeout: number | null = null;

const DEFAULT_DURATION: Record<ToastType, number> = {
  info: 2400,
  progress: 0, // 0 = 自動非表示しない
  success: 2200,
  error: 5000,
};

function ensureEl(): HTMLElement | null {
  return document.getElementById("toast");
}

export function showToast(
  message: string,
  type: ToastType = "info",
  durationMs?: number,
): void {
  const el = ensureEl();
  if (!el) return;

  el.classList.remove(
    "toast-info",
    "toast-progress",
    "toast-success",
    "toast-error",
  );
  el.classList.add(`toast-${type}`);
  const msgEl = el.querySelector<HTMLElement>(".toast-message");
  if (msgEl) msgEl.textContent = message;

  el.classList.add("show");
  el.setAttribute("aria-hidden", "false");

  if (currentTimeout !== null) {
    clearTimeout(currentTimeout);
    currentTimeout = null;
  }
  const dur = durationMs ?? DEFAULT_DURATION[type];
  if (dur > 0) {
    currentTimeout = window.setTimeout(() => hideToast(), dur);
  }
}

export function hideToast(): void {
  const el = ensureEl();
  if (!el) return;
  el.classList.remove("show");
  el.setAttribute("aria-hidden", "true");
  if (currentTimeout !== null) {
    clearTimeout(currentTimeout);
    currentTimeout = null;
  }
}
