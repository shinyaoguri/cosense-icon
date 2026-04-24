export const BUILTIN_FONTS = ["sans", "serif", "rounded", "mono", "custom"] as const;
export type BuiltinFont = (typeof BUILTIN_FONTS)[number];

export const BUILTIN_LABELS: Record<BuiltinFont, string> = {
  sans: "ゴシック (sans)",
  serif: "明朝 (serif)",
  rounded: "丸ゴシック (rounded)",
  mono: "等幅 (mono)",
  custom: "カスタム...",
};

export type FontGroup = [string, string[]];

export const GOOGLE_FONTS: FontGroup[] = [
  ["日本語 Sans",    ["Noto Sans JP", "M PLUS 1p", "M PLUS 2", "M PLUS Rounded 1c", "Kosugi", "Kosugi Maru", "Sawarabi Gothic", "Zen Kaku Gothic New", "Zen Kaku Gothic Antique", "Zen Maru Gothic", "BIZ UDPGothic", "BIZ UDGothic"]],
  ["日本語 Serif",   ["Noto Serif JP", "Sawarabi Mincho", "Shippori Mincho", "Shippori Mincho B1", "Shippori Antique", "Shippori Antique B1", "Kaisei Decol", "Kaisei HarunoUmi", "Kaisei Opti", "Kaisei Tokumin", "Klee One", "Hina Mincho", "Zen Old Mincho", "Zen Antique", "Zen Antique Soft", "BIZ UDPMincho", "BIZ UDMincho", "New Tegomin"]],
  ["日本語 Display", ["Dela Gothic One", "DotGothic16", "Hachi Maru Pop", "Mochiy Pop One", "Mochiy Pop P One", "Potta One", "Rampart One", "Reggae One", "RocknRoll One", "Stick", "Train One", "Yomogi", "Yuji Boku", "Yuji Mai", "Yuji Syuku", "Yusei Magic"]],
  ["ラテン Sans",    ["Roboto", "Open Sans", "Noto Sans", "Lato", "Montserrat", "Poppins", "Raleway", "Nunito", "Nunito Sans", "Inter", "DM Sans", "Public Sans", "Work Sans", "Ubuntu", "Rubik", "Karla", "Mulish", "IBM Plex Sans", "Barlow", "Manrope", "Be Vietnam Pro", "Fira Sans", "Oxygen", "Quicksand", "Comfortaa", "Josefin Sans", "PT Sans", "Kanit", "Source Sans 3", "Hind", "Titillium Web", "Archivo", "Cabin", "Exo 2", "Assistant"]],
  ["ラテン Serif",   ["Merriweather", "Playfair Display", "Lora", "PT Serif", "Noto Serif", "Source Serif 4", "IBM Plex Serif", "Bitter", "Cormorant", "Cormorant Garamond", "EB Garamond", "Libre Baskerville", "Crimson Text", "Crimson Pro", "Cardo", "DM Serif Display", "DM Serif Text", "Roboto Serif", "Noticia Text", "Arvo", "Alegreya", "Vollkorn", "Spectral", "Cormorant Infant", "Young Serif"]],
  ["Mono",           ["Roboto Mono", "JetBrains Mono", "Fira Code", "Source Code Pro", "IBM Plex Mono", "Space Mono", "Inconsolata", "Cousine", "Ubuntu Mono", "Noto Sans Mono", "PT Mono", "Anonymous Pro", "DM Mono"]],
  ["Display",        ["Bebas Neue", "Oswald", "Anton", "Archivo Black", "Black Ops One", "Bungee", "Russo One", "Alfa Slab One", "Abril Fatface", "Fjalla One", "Staatliches", "Righteous", "Lobster", "Chakra Petch", "Orbitron", "Press Start 2P", "Major Mono Display"]],
  ["Handwriting",    ["Dancing Script", "Pacifico", "Caveat", "Indie Flower", "Shadows Into Light", "Great Vibes", "Sacramento", "Satisfy", "Kalam", "Amatic SC", "Parisienne", "Cookie", "Allura", "Courgette", "Kaushan Script", "Permanent Marker", "Homemade Apple"]],
];

export const GOOGLE_FONT_SET = new Set(GOOGLE_FONTS.flatMap(([, fonts]) => fonts));

export function isGoogleFont(v: string): boolean {
  return GOOGLE_FONT_SET.has(v);
}

export function isBuiltinFont(v: string): v is BuiltinFont {
  return (BUILTIN_FONTS as readonly string[]).includes(v);
}
