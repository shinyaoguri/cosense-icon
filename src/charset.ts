// グリフパックに含める文字集合の決め方。
//
// **エディタと Worker が同じ結果を出すことが正しさの前提**になっている。
// パックの R2 キーはこの文字集合から作られるので、両者がずれるとキーがずれて
// 必ず miss になる (壊れた絵は出ないが、いつまでも登録済みにならない)。
// 新しい文字を描くようになったら、必ずここへ足すこと。

/** 日数に使う文字。substituteCountToken のフォールバックが空白を挟むので空白も要る。 */
const COUNT_EXTRA = "0123456789 ";

/**
 * 動的キーワード 4 種 (today / week / month / year) が描きうる文字。
 * - today:  "MM/DD" と "(曜)"
 * - week:   "YYYY年 M月" と曜日と日付
 * - month:  同上 + 曜日ヘッダ
 * - year:   "YYYY"
 * 4 種で 1 つのパックを共有するため、和集合をそのまま定数にしている。
 */
export const DYNAMIC_CHARSET = normalizeCharset(
  "0123456789/() 年月日火水木金土",
);

/** 文字集合を重複なしのコードポイント昇順に正規化する (キーの決定性のため) */
export function normalizeCharset(chars: string): string {
  return [...new Set(Array.from(chars))].sort().join("");
}

/**
 * countdown / countup 用の文字集合。
 * テキストからプレースホルダ ({d} / {} / {n} / {days}) を落とした残りに、
 * 日数として現れうる文字 (数字と空白) を足す。
 */
export function charsetForCount(text: string[]): string {
  const stripped = text.join("").replace(/\{(?:d|n|days)?\}/g, "");
  return normalizeCharset(stripped + COUNT_EXTRA);
}
