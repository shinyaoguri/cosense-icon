const TURNSTILE_SITE_KEY_PROD = "0x4AAAAAADCcoss7Lly4m3Td";
// Cloudflare 公式 "always passes" テスト sitekey (managed/visible)
const TURNSTILE_SITE_KEY_DEV = "1x00000000000000000000AA";
const IS_LOCAL_DEV = ["localhost", "127.0.0.1", "0.0.0.0"].includes(
  location.hostname,
);
export const TURNSTILE_SITE_KEY = IS_LOCAL_DEV
  ? TURNSTILE_SITE_KEY_DEV
  : TURNSTILE_SITE_KEY_PROD;

// チャレンジが瞬時に通った場合でもモーダルが「チラッ」と消えるのを防ぐ最低表示時間
const MIN_MODAL_VISIBLE_MS = 350;

let _ready = false;
let _readyResolvers: Array<() => void> = [];
let _activeWidgetId: string | null = null;
let _activeReject: ((e: Error) => void) | null = null;

function openModal(): void {
  document.getElementById("authModal")?.classList.add("show");
}

function closeModal(): void {
  document.getElementById("authModal")?.classList.remove("show");
  if (_activeWidgetId !== null) {
    try {
      window.turnstile?.remove(_activeWidgetId);
    } catch (e) {
      console.error("turnstile.remove failed", e);
    }
    _activeWidgetId = null;
  }
  _activeReject = null;
}

export function setupTurnstileWidget(): void {
  // Turnstile script は ?onload=onloadTurnstileCallback で読まれる
  window.onloadTurnstileCallback = () => {
    _ready = true;
    const rs = _readyResolvers;
    _readyResolvers = [];
    for (const r of rs) r();
  };

  document.getElementById("authCancel")?.addEventListener("click", () => {
    if (_activeReject) _activeReject(new Error("認証をキャンセルしました"));
    closeModal();
  });

  // 背景クリックでもキャンセル
  document.getElementById("authModal")?.addEventListener("click", e => {
    if (e.target === e.currentTarget) {
      if (_activeReject) _activeReject(new Error("認証をキャンセルしました"));
      closeModal();
    }
  });
}

function whenReady(): Promise<void> {
  if (_ready) return Promise.resolve();
  return new Promise(resolve => _readyResolvers.push(resolve));
}

export async function getTurnstileToken(): Promise<string> {
  await whenReady();

  return new Promise<string>((resolve, reject) => {
    const container = document.getElementById("turnstileWidget");
    if (!container || !window.turnstile) {
      reject(new Error("Turnstile が初期化されていません"));
      return;
    }

    // 進行中の widget があれば破棄してからやり直し
    if (_activeWidgetId !== null) {
      try {
        window.turnstile.remove(_activeWidgetId);
      } catch (e) {
        console.error("turnstile.remove failed", e);
      }
      _activeWidgetId = null;
    }

    _activeReject = reject;
    openModal();
    const opened = Date.now();

    const finish = (action: () => void): void => {
      const elapsed = Date.now() - opened;
      const wait = Math.max(0, MIN_MODAL_VISIBLE_MS - elapsed);
      setTimeout(() => {
        closeModal();
        action();
      }, wait);
    };

    const timeoutId = setTimeout(() => {
      finish(() =>
        reject(new Error("Turnstile トークン取得タイムアウト。")),
      );
    }, 60000);

    try {
      _activeWidgetId = window.turnstile.render(container, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token: string) => {
          clearTimeout(timeoutId);
          finish(() => resolve(token));
        },
        "error-callback": () => {
          clearTimeout(timeoutId);
          finish(() => reject(new Error("Turnstile エラー")));
        },
        "expired-callback": () => {
          // モーダル内で expired した場合はその場で reset して再発行
          if (_activeWidgetId !== null) {
            try {
              window.turnstile?.reset(_activeWidgetId);
            } catch (e) {
              console.error("turnstile.reset failed", e);
            }
          }
        },
      });
    } catch (e) {
      clearTimeout(timeoutId);
      finish(() => reject(new Error("Turnstile render 失敗: " + String(e))));
    }
  });
}
