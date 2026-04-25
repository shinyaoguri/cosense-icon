import { $, $input, $select, $textarea } from "./dom";
import { updateContrast, randomPalette } from "./colors";
import { isGoogleFont, randomFont } from "./fonts";
import { buildFontPicker, populateHiddenFontSelect } from "./fontPicker";
import { applyPathname } from "./pathname";
import {
  cancelScheduledPreview,
  revokePreviewUrl,
  schedulePathifyPreview,
  setPreviewToUrl,
} from "./preview";
import {
  applyPreviewPadding,
  applyPreviewRadius,
  applyPreviewSize,
  setupPreviewResize,
} from "./previewResize";
import {
  applyColors,
  applyFont,
  applyPreset,
  renderPresets,
  resetForm,
} from "./presets";
import { registerCurrentPath, registeredPaths } from "./register";
import {
  build,
  currentFontValue,
} from "./state";
import { setupTurnstileWidget } from "./turnstile";

function updateRegisterUI(): void {
  const useGF = isGoogleFont(currentFontValue());
  const registered = useGF && registeredPaths.has(build());

  $("googleFontHelp").style.display = useGF ? "" : "none";
  if (!useGF) $("copyStatus").textContent = "";

  document
    .querySelectorAll<HTMLButtonElement>("button[data-copy]")
    .forEach(btn => {
      // コピー直後の "コピー済" 表示中は触らない
      if (btn.classList.contains("copied")) return;
      btn.disabled = false;
      if (useGF && !registered) {
        btn.classList.add("needs-register");
        btn.textContent = "登録してコピー";
      } else {
        btn.classList.remove("needs-register");
        btn.textContent = "コピー";
      }
    });
}

// ---- init ----
setupTurnstileWidget();
populateHiddenFontSelect();
buildFontPicker();
setupPreviewResize(() => update());

function update(): void {
  const path = build();
  const full = location.origin + path;
  $input("url").value = full;
  $input("cosense").value = "[" + full + "]";
  $input("markdown").value = "![icon](" + full + ")";
  applyPreviewSize(+$input("w").value, +$input("h").value);
  applyPreviewPadding(+$input("padding").value);
  applyPreviewRadius(+$input("radius").value);
  updateContrast();
  updateRegisterUI();

  if (isGoogleFont(currentFontValue())) {
    schedulePathifyPreview();
  } else {
    cancelScheduledPreview();
    revokePreviewUrl();
    setPreviewToUrl(path);
  }
}

function linkSliderNumber(sliderId: string, numberId: string): void {
  const s = $input(sliderId);
  const n = $input(numberId);
  s.addEventListener("input", () => {
    n.value = s.value;
    update();
  });
  n.addEventListener("input", () => {
    if (n.value !== "") s.value = n.value;
    update();
  });
}
(["w", "h", "padding", "radius", "size", "lh", "ls"] as const).forEach(k =>
  linkSliderNumber(k + "Range", k),
);

function syncColor(pair: "bg" | "fg"): void {
  const c = $input(pair);
  const t = $input(pair + "Hex");
  c.addEventListener("input", () => {
    t.value = c.value;
    update();
  });
  t.addEventListener("input", () => {
    if (/^#[0-9a-fA-F]{3,8}$/.test(t.value)) {
      c.value = t.value;
      update();
    }
  });
}
syncColor("bg");
syncColor("fg");

$input("sizeAuto").addEventListener("change", () => {
  const auto = $input("sizeAuto").checked;
  $input("size").disabled = auto;
  $input("sizeRange").disabled = auto;
  update();
});

$select("font").addEventListener("change", () => {
  $("customFontWrap").classList.toggle(
    "show",
    $select("font").value === "custom",
  );
  update();
});

$("reset").addEventListener("click", () => resetForm(update));
$("random").addEventListener("click", () => {
  const p = randomPalette();
  applyColors(p.bg, p.fg, update);
});
$("randomFont").addEventListener("click", () => {
  const f = randomFont($textarea("text").value, currentFontValue());
  applyFont(f, update);
});

renderPresets(p => applyPreset(p, update));

document
  .querySelectorAll<HTMLElement>("input, select, textarea")
  .forEach(el => el.addEventListener("input", update));

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

document
  .querySelectorAll<HTMLButtonElement>("button[data-copy]")
  .forEach(btn => {
    btn.addEventListener("click", async () => {
      if (btn.disabled) return;
      const targetId = btn.dataset["copy"];
      if (!targetId) return;
      const target = document.getElementById(targetId) as HTMLInputElement;
      const status = $("copyStatus");
      const needsRegister =
        isGoogleFont(currentFontValue()) && !registeredPaths.has(build());

      if (needsRegister) {
        btn.classList.remove("needs-register");
        btn.disabled = true;
        btn.textContent = "登録中...";
        try {
          await registerCurrentPath(msg => {
            status.textContent = msg;
          });
          status.textContent = "登録完了";
          setPreviewToUrl(build() + "?_=" + Date.now());
        } catch (e) {
          console.error(e);
          status.textContent =
            "エラー: " + (e instanceof Error ? e.message : String(e));
          updateRegisterUI();
          return;
        }
      }

      const ok = await copyToClipboard(target.value);
      if (!ok) {
        target.select();
        document.execCommand("copy");
      }
      btn.classList.remove("needs-register");
      btn.classList.add("copied");
      btn.disabled = false;
      btn.textContent = "コピー済";
      setTimeout(() => {
        btn.classList.remove("copied");
        if (needsRegister) status.textContent = "";
        updateRegisterUI();
      }, 1500);
    });
  });

(function handleRegen() {
  const params = new URLSearchParams(location.search);
  const regen = params.get("regen");
  if (!regen) return;
  try {
    const b64 = regen.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const pathname = new TextDecoder().decode(bytes);
    applyPathname(pathname);
    update();
    setTimeout(() => {
      if (isGoogleFont(currentFontValue())) {
        registerCurrentPath(msg => {
          $("copyStatus").textContent = msg;
        })
          .then(() => {
            $("copyStatus").textContent = "登録完了";
            setPreviewToUrl(build() + "?_=" + Date.now());
            updateRegisterUI();
          })
          .catch(e => {
            $("copyStatus").textContent =
              "エラー: " + (e instanceof Error ? e.message : String(e));
            updateRegisterUI();
          });
      }
    }, 800);
  } catch (e) {
    console.error("regen decode failed", e);
  }
})();

update();
