const TURNSTILE_SITE_KEY_PROD = "0x4AAAAAADCcoss7Lly4m3Td";
const TURNSTILE_SITE_KEY_DEV = "1x00000000000000000000AA";
const IS_LOCAL_DEV = ["localhost", "127.0.0.1", "0.0.0.0"].includes(
  location.hostname,
);
export const TURNSTILE_SITE_KEY = IS_LOCAL_DEV
  ? TURNSTILE_SITE_KEY_DEV
  : TURNSTILE_SITE_KEY_PROD;

export function setupTurnstileWidget(): void {
  const el = document.getElementById("turnstileWidget");
  if (el && !el.getAttribute("data-sitekey")) {
    el.setAttribute("data-sitekey", TURNSTILE_SITE_KEY);
  }
}

export function getTurnstileToken(): Promise<string> {
  if (window._turnstileToken) return Promise.resolve(window._turnstileToken);
  return new Promise((resolve, reject) => {
    window._turnstileTokenResolve = resolve;
    setTimeout(() => {
      if (window._turnstileTokenResolve === resolve) {
        window._turnstileTokenResolve = null;
        reject(
          new Error("Turnstile トークン取得タイムアウト。ページを再読込してもう一度。"),
        );
      }
    }, 30000);
  });
}
