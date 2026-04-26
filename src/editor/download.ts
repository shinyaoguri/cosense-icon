// SVG / PNG ダウンロード
// プレビュー用に既に SVG が <img id="preview"> の objectURL or 直リンク URL になっている

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeBaseName(text: string): string {
  // ファイル名として使える形に。空なら "icon"
  const cleaned = text
    .replace(/[\\/:*?"<>|\r\n\t]/g, "")
    .trim()
    .slice(0, 40);
  return cleaned || "icon";
}

export async function downloadSvg(svgText: string, baseName: string): Promise<void> {
  const blob = new Blob([svgText], { type: "image/svg+xml" });
  triggerDownload(blob, `${safeBaseName(baseName)}.svg`);
}

export async function downloadPng(
  svgText: string,
  outerW: number,
  outerH: number,
  scale: number,
  baseName: string,
): Promise<void> {
  const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
  const svgUrl = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("SVG の読み込みに失敗しました"));
      img.src = svgUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(outerW * scale);
    canvas.height = Math.round(outerH * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context 取得失敗");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(res =>
      canvas.toBlob(b => res(b), "image/png"),
    );
    if (!blob) throw new Error("PNG 生成失敗");
    const suffix = scale === 1 ? "" : `@${scale}x`;
    triggerDownload(blob, `${safeBaseName(baseName)}${suffix}.png`);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
