// クローラ向けの応答。
//
// 拡張子なしのパスはすべてエディタ HTML を返す (URL = エディタの状態) ので、
// 何もしないと robots.txt まで「robots.txt と書かれたアイコンのエディタ」になり、
// 状態付き URL は無限にトップの重複として索引候補に積まれる。

export const ROBOTS_TXT = `User-agent: *
Disallow: /api/
`;

// エディタ HTML に付ける X-Robots-Tag。索引するのはトップだけにする。
// 状態付き URL は共有用で、中身はトップと同じエディタなので索引する価値がない
// (OGP は noindex でも読まれるので、共有時のプレビューには影響しない)。
export function editorRobotsTag(pathname: string): string | null {
  return pathname === "/" || pathname === "" ? null : "noindex";
}
