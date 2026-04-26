import { $, $input, $textarea } from "./dom";

interface EmojiCategory {
  id: string;
  label: string;
  icon: string;
  emojis: string[];
}

const CATEGORIES: EmojiCategory[] = [
  {
    id: "smiley",
    label: "顔・感情",
    icon: "😀",
    emojis: [
      "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","🫠","😉","😊","😇",
      "🥰","😍","🤩","😘","😗","☺️","😚","😙","🥲","😋","😛","😜","🤪","😝",
      "🤑","🤗","🤭","🫢","🫣","🤫","🤔","🫡","🤐","🤨","😐","😑","😶","🫥",
      "😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢",
      "🤮","🤧","🥵","🥶","🥴","😵","🤯","🤠","🥳","🥸","😎","🤓","🧐","😕",
      "🫤","😟","🙁","☹️","😮","😯","😲","😳","🥺","🥹","😦","😧","😨","😰",
      "😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠",
      "🤬","😈","👿","💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖",
      "😺","😸","😹","😻","😼","😽","🙀","😿","😾",
      "💋","💌","💘","💝","💖","💗","💓","💞","💕","💟","❣️","💔",
      "❤️","🧡","💛","💚","💙","💜","🤎","🖤","🤍",
      "💯","💢","💥","💫","💦","💨","🕳️","💣","💬","🗨️","🗯️","💭","💤",
    ],
  },
  {
    id: "people",
    label: "人・身体",
    icon: "👋",
    emojis: [
      "👋","🤚","🖐️","✋","🖖","🫱","🫲","🫳","🫴","👌","🤌","🤏","✌️","🤞",
      "🫰","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","🫵","👍","👎","✊",
      "👊","🤛","🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","✍️","💅","🤳",
      "💪","🦾","🦵","🦿","🦶","👂","🦻","👃","🧠","🫀","🫁","🦷","🦴",
      "👀","👁️","👅","👄","🫦",
      "👶","🧒","👦","👧","🧑","👱","👨","🧔","🧔‍♂️","🧔‍♀️","👨‍🦰","👨‍🦱",
      "👨‍🦳","👨‍🦲","👩","👩‍🦰","🧑‍🦰","👩‍🦱","🧑‍🦱","👩‍🦳","🧑‍🦳",
      "👩‍🦲","🧑‍🦲","👱‍♀️","👱‍♂️","🧓","👴","👵",
      "🙍","🙎","🙅","🙆","💁","🙋","🧏","🙇","🤦","🤷",
      "🧑‍⚕️","👨‍⚕️","👩‍⚕️","🧑‍🎓","👨‍🎓","👩‍🎓","🧑‍🏫","👨‍🏫","👩‍🏫",
      "🧑‍⚖️","👨‍⚖️","👩‍⚖️","🧑‍🌾","👨‍🌾","👩‍🌾","🧑‍🍳","👨‍🍳","👩‍🍳",
      "🧑‍🔧","👨‍🔧","👩‍🔧","🧑‍🏭","👨‍🏭","👩‍🏭","🧑‍💼","👨‍💼","👩‍💼",
      "🧑‍🔬","👨‍🔬","👩‍🔬","🧑‍💻","👨‍💻","👩‍💻","🧑‍🎤","👨‍🎤","👩‍🎤",
      "🧑‍🎨","👨‍🎨","👩‍🎨","🧑‍✈️","👨‍✈️","👩‍✈️","🧑‍🚀","👨‍🚀","👩‍🚀",
      "🧑‍🚒","👨‍🚒","👩‍🚒","👮","🕵️","💂","🥷","👷","🫅","🤴","👸","👳",
      "🧕","🤵","👰","🤰","🫃","🫄","🤱","👼","🎅","🤶","🦸","🦹","🧙","🧚",
      "🧛","🧜","🧝","🧞","🧟","🧌",
      "💆","💇","🚶","🧍","🧎","🏃","💃","🕺","🕴️","👯","🧖","🧗","🤺","🏇",
      "⛷️","🏂","🏌️","🏄","🚣","🏊","⛹️","🏋️","🚴","🚵","🤸","🤼","🤽","🤾",
      "🤹","🧘","🛀","🛌","👫","👬","👭","💏","💑","👪","🗣️","👤","👥","🫂",
      "👣",
    ],
  },
  {
    id: "animal",
    label: "動物・自然",
    icon: "🐶",
    emojis: [
      "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐻‍❄️","🐨","🐯","🦁","🐮","🐷",
      "🐽","🐸","🐵","🙈","🙉","🙊","🐒","🐔","🐧","🐦","🐤","🐣","🐥","🦆",
      "🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🪱","🐛","🦋","🐌","🐞","🐜",
      "🪰","🪲","🪳","🦟","🦗","🕷️","🕸️","🦂","🐢","🐍","🦎","🦖","🦕","🐙",
      "🦑","🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🦭","🐊","🐅",
      "🐆","🦓","🦍","🦧","🦣","🐘","🦛","🦏","🐪","🐫","🦒","🦘","🦬","🐃",
      "🐂","🐄","🐎","🐖","🐏","🐑","🦙","🐐","🦌","🐕","🐩","🦮","🐕‍🦺","🐈",
      "🐈‍⬛","🪶","🐓","🦃","🦤","🦚","🦜","🦢","🦩","🕊️","🐇","🦝","🦨","🦡",
      "🦫","🦦","🦥","🐁","🐀","🐿️","🦔",
      "🐾","🐉","🐲","🌵","🎄","🌲","🌳","🌴","🪵","🌱","🌿","☘️","🍀","🎍",
      "🪴","🎋","🍃","🍂","🍁","🍄","🐚","🪨","🌾","💐","🌷","🌹","🥀","🪷",
      "🌺","🌸","🌼","🌻","🌞","🌝","🌛","🌜","🌚","🌕","🌖","🌗","🌘","🌑",
      "🌒","🌓","🌔","🌙","🌎","🌍","🌏","🪐","💫","⭐","🌟","✨","⚡","☄️",
      "💥","🔥","🌪️","🌈","☀️","🌤️","⛅","🌥️","☁️","🌦️","🌧️","⛈️","🌩️","🌨️",
      "❄️","☃️","⛄","🌬️","💨","💧","💦","🫧","☔","☂️","🌊","🌫️",
    ],
  },
  {
    id: "food",
    label: "食べ物",
    icon: "🍎",
    emojis: [
      "🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭",
      "🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶️","🫑","🌽","🥕","🫒",
      "🧄","🧅","🥔","🍠","🥐","🥯","🍞","🥖","🥨","🧀","🥚","🍳","🧈","🥞",
      "🧇","🥓","🥩","🍗","🍖","🦴","🌭","🍔","🍟","🍕","🫓","🥪","🥙","🧆",
      "🌮","🌯","🫔","🥗","🥘","🫕","🥫","🍝","🍜","🍲","🍛","🍣","🍱","🥟",
      "🦪","🍤","🍙","🍚","🍘","🍥","🥠","🥮","🍢","🍡","🍧","🍨","🍦","🥧",
      "🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","🌰","🥜","🫘","🍯",
      "🥛","🫗","🍼","🫖","☕","🍵","🧃","🥤","🧋","🍶","🍺","🍻","🥂","🍷",
      "🥃","🍸","🍹","🧉","🍾","🧊","🥄","🍴","🍽️","🥣","🥡","🥢","🧂",
    ],
  },
  {
    id: "travel",
    label: "旅行・場所",
    icon: "✈️",
    emojis: [
      "🌍","🌎","🌏","🗺️","🗾","🧭","🏔️","⛰️","🌋","🗻","🏕️","🏖️","🏜️","🏝️",
      "🏞️","🏟️","🏛️","🏗️","🧱","🪨","🪵","🛖","🏘️","🏚️","🏠","🏡","🏢","🏣",
      "🏤","🏥","🏦","🏨","🏩","🏪","🏫","🏬","🏭","🏯","🏰","💒","🗼","🗽",
      "⛪","🕌","🛕","🕍","⛩️","🕋","⛲","⛺","🌁","🌃","🏙️","🌄","🌅","🌆",
      "🌇","🌉","♨️","🎠","🛝","🎡","🎢","💈","🎪",
      "🚂","🚃","🚄","🚅","🚆","🚇","🚈","🚉","🚊","🚝","🚞","🚋","🚌","🚍",
      "🚎","🚐","🚑","🚒","🚓","🚔","🚕","🚖","🚗","🚘","🚙","🛻","🚚","🚛",
      "🚜","🏎️","🏍️","🛵","🦽","🦼","🛺","🚲","🛴","🛹","🛼","🚏","🛣️","🛤️",
      "🛢️","⛽","🛞","🚨","🚥","🚦","🛑","🚧",
      "⚓","🛟","⛵","🛶","🚤","🛳️","⛴️","🛥️","🚢","✈️","🛩️","🛫","🛬","🪂",
      "💺","🚁","🚟","🚠","🚡","🛰️","🚀","🛸","🛎️","🧳","⌛","⏳","⌚","⏰",
      "⏱️","⏲️","🕰️","🕛","🕧","🕐","🕜","🕑","🕝","🕒","🕞","🕓","🕟","🕔",
      "🕠","🕕","🕡","🕖","🕢","🕗","🕣","🕘","🕤","🕙","🕥","🕚","🕦",
    ],
  },
  {
    id: "activity",
    label: "活動",
    icon: "⚽",
    emojis: [
      "🎃","🎄","🎆","🎇","🧨","✨","🎈","🎉","🎊","🎋","🎍","🎎","🎏","🎐",
      "🎑","🧧","🎀","🎁","🎗️","🎟️","🎫","🎖️","🏆","🏅","🥇","🥈","🥉",
      "⚽","⚾","🥎","🏀","🏐","🏈","🏉","🎾","🥏","🎳","🏏","🏑","🏒","🥍",
      "🏓","🏸","🥊","🥋","🥅","⛳","⛸️","🎣","🤿","🎽","🎿","🛷","🥌","🎯",
      "🪀","🪁","🎱","🔮","🪄","🧿","🪬","🎮","🕹️","🎰","🎲","🧩","🧸","🪅",
      "🪩","🪆","♠️","♥️","♦️","♣️","♟️","🃏","🀄","🎴","🎭","🖼️","🎨","🧵",
      "🪡","🧶","🪢",
    ],
  },
  {
    id: "object",
    label: "もの",
    icon: "💡",
    emojis: [
      "👓","🕶️","🥽","🥼","🦺","👔","👕","👖","🧣","🧤","🧥","🧦","👗","👘",
      "🥻","🩱","🩲","🩳","👙","👚","🪭","👛","👜","👝","🛍️","🎒","🩴","👞",
      "👟","🥾","🥿","👠","👡","🩰","👢","🪮","👑","👒","🎩","🎓","🧢","🪖",
      "⛑️","📿","💄","💍","💎",
      "🔇","🔈","🔉","🔊","📢","📣","📯","🔔","🔕","🎼","🎵","🎶","🎙️","🎚️",
      "🎛️","🎤","🎧","📻","🎷","🪗","🎸","🎹","🎺","🎻","🪕","🥁","🪘",
      "📱","📲","☎️","📞","📟","📠","🔋","🪫","🔌","💻","🖥️","🖨️","⌨️","🖱️",
      "🖲️","💽","💾","💿","📀","🧮","🎬","📷","📸","📹","📼","🔍","🔎","🕯️",
      "💡","🔦","🏮","🪔","📔","📕","📖","📗","📘","📙","📚","📓","📒","📃",
      "📜","📄","📰","🗞️","📑","🔖","🏷️","💰","🪙","💴","💵","💶","💷","💸",
      "💳","🧾","💹",
      "✉️","📧","📨","📩","📤","📥","📦","📫","📪","📬","📭","📮","🗳️","✏️",
      "✒️","🖋️","🖊️","🖌️","🖍️","📝","💼","📁","📂","🗂️","📅","📆","🗒️","🗓️",
      "📇","📈","📉","📊","📋","📌","📍","📎","🖇️","📏","📐","✂️","🗃️","🗄️",
      "🗑️","🔒","🔓","🔏","🔐","🔑","🗝️","🔨","🪓","⛏️","⚒️","🛠️","🗡️","⚔️",
      "🔫","🪃","🏹","🛡️","🪚","🔧","🪛","🔩","⚙️","🗜️","⚖️","🦯","🔗","⛓️",
      "🪝","🧰","🧲","🪜","⚗️","🧪","🧫","🧬","🔬","🔭","📡","💉","🩸","💊",
      "🩹","🩼","🩺","🩻","🚪","🛗","🪞","🪟","🛏️","🛋️","🪑","🚽","🪠","🚿",
      "🛁","🪤","🪒","🧴","🧷","🧹","🧺","🧻","🪣","🧼","🫧","🪥","🧽","🧯",
      "🛒","🚬","⚰️","🪦","⚱️","🗿","🪧","🪪",
    ],
  },
  {
    id: "symbol",
    label: "記号",
    icon: "❤️",
    emojis: [
      "🏧","🚮","🚰","♿","🚹","🚺","🚻","🚼","🚾","🛂","🛃","🛄","🛅",
      "⚠️","🚸","⛔","🚫","🚳","🚭","🚯","🚱","🚷","📵","🔞","☢️","☣️",
      "⬆️","↗️","➡️","↘️","⬇️","↙️","⬅️","↖️","↕️","↔️","↩️","↪️","⤴️","⤵️",
      "🔃","🔄","🔙","🔚","🔛","🔜","🔝",
      "🛐","⚛️","🕉️","✡️","☸️","☯️","✝️","☦️","☪️","☮️","🕎","🔯","🪯",
      "♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓","⛎",
      "🔀","🔁","🔂","▶️","⏩","⏭️","⏯️","◀️","⏪","⏮️","🔼","⏫","🔽","⏬",
      "⏸️","⏹️","⏺️","⏏️","🎦","🔅","🔆","📶","📳","📴",
      "♀️","♂️","⚧️","✖️","➕","➖","➗","🟰","♾️","‼️","⁉️","❓","❔","❕",
      "❗","〰️","💱","💲","⚕️","♻️","⚜️","🔱","📛","🔰","⭕","✅","☑️","✔️",
      "❌","❎","➰","➿","〽️","✳️","✴️","❇️","©️","®️","™️",
      "#️⃣","*️⃣","0️⃣","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟",
      "🔠","🔡","🔢","🔣","🔤","🅰️","🆎","🅱️","🆑","🆒","🆓","ℹ️","🆔","Ⓜ️",
      "🆕","🆖","🅾️","🆗","🅿️","🆘","🆙","🆚","🈁","🈂️","🈷️","🈶","🈯","🉐",
      "🈹","🈚","🈲","🉑","🈸","🈴","🈳","㊗️","㊙️","🈺","🈵",
      "🔴","🟠","🟡","🟢","🔵","🟣","⚫","⚪","🟤","🟥","🟧","🟨","🟩","🟦",
      "🟪","⬛","⬜","🟫","◼️","◻️","◾","◽","▪️","▫️","🔶","🔷","🔸","🔹",
      "🔺","🔻","💠","🔘","🔳","🔲",
    ],
  },
  {
    id: "flag",
    label: "旗",
    icon: "🏁",
    emojis: [
      "🏁","🚩","🎌","🏴","🏳️","🏳️‍🌈","🏳️‍⚧️","🏴‍☠️",
      "🇯🇵","🇺🇸","🇬🇧","🇫🇷","🇩🇪","🇮🇹","🇪🇸","🇨🇳","🇰🇷","🇨🇦","🇦🇺","🇧🇷",
      "🇷🇺","🇮🇳","🇲🇽","🇮🇩","🇹🇷","🇸🇦","🇿🇦","🇦🇷","🇳🇱","🇧🇪","🇨🇭","🇸🇪",
      "🇳🇴","🇩🇰","🇫🇮","🇮🇸","🇮🇪","🇵🇹","🇬🇷","🇵🇱","🇨🇿","🇭🇺","🇦🇹","🇺🇦",
      "🇳🇿","🇸🇬","🇲🇾","🇹🇭","🇻🇳","🇵🇭","🇭🇰","🇹🇼","🇮🇱","🇪🇬","🇦🇪","🇨🇱",
      "🇵🇪","🇨🇴","🇻🇪","🇨🇺","🇪🇺","🇺🇳",
    ],
  },
];

// 検索キーワード (主要絵文字のみ。日本語/英語ともに小文字)
const KEYWORDS: Record<string, string> = {
  "❤️": "heart love red 愛 ハート 赤",
  "🧡": "heart orange 橙 ハート",
  "💛": "heart yellow 黄 ハート",
  "💚": "heart green 緑 ハート",
  "💙": "heart blue 青 ハート",
  "💜": "heart purple 紫 ハート",
  "🖤": "heart black 黒 ハート",
  "🤍": "heart white 白 ハート",
  "💔": "broken heart 失恋 ハート",
  "😀": "smile happy face 笑顔 にこにこ",
  "😃": "smile happy 笑顔",
  "😄": "smile happy 笑顔",
  "😆": "laugh haha 笑い",
  "🤣": "rofl laugh 爆笑",
  "😂": "joy laugh tears 嬉し涙",
  "🙂": "smile slight 笑顔",
  "😉": "wink ウインク",
  "😊": "blush smile 微笑み",
  "😍": "love heart eyes 大好き",
  "😘": "kiss キス",
  "🤔": "thinking 考える",
  "😎": "cool sunglasses クール かっこいい",
  "😢": "cry sad 涙 悲しい",
  "😭": "cry sob 号泣 大泣き",
  "😡": "angry mad 怒る",
  "😱": "scream shock びっくり",
  "🥳": "party celebrate お祝い",
  "😴": "sleep zzz 寝る 眠い",
  "🤩": "star eyes すごい きらきら",
  "🥺": "pleading 懇願 うるうる",
  "👍": "thumbs up like good いいね",
  "👎": "thumbs down dislike bad だめ",
  "👏": "clap 拍手",
  "🙏": "pray thanks please ありがとう お願い",
  "🙌": "celebrate raise hands 万歳 やった",
  "💪": "muscle strong 力こぶ がんばる",
  "✌️": "peace victory ピース",
  "👋": "wave hello bye バイバイ",
  "🔥": "fire hot 火 燃える",
  "✨": "sparkle shiny キラキラ",
  "⭐": "star 星",
  "🌟": "star glow 輝く",
  "💡": "idea light bulb アイデア 電球",
  "⚡": "lightning thunder 雷",
  "☀️": "sun sunny 太陽 晴れ",
  "🌙": "moon 月",
  "🌈": "rainbow 虹",
  "❄️": "snow snowflake 雪",
  "☔": "rain umbrella 雨",
  "✅": "check ok yes チェック OK",
  "❌": "cross no x バツ",
  "⚠️": "warning caution 警告",
  "❓": "question マーク 疑問",
  "❗": "exclamation マーク",
  "🎉": "party celebration クラッカー 祝う",
  "🎊": "confetti 紙吹雪 くす玉",
  "🎁": "gift present プレゼント",
  "🚀": "rocket ロケット 起動",
  "🎯": "target dart 的 ターゲット",
  "🏆": "trophy winner 優勝 トロフィー",
  "💰": "money bag お金",
  "💎": "gem diamond ダイヤ",
  "📝": "memo note メモ",
  "📚": "books 本",
  "📌": "pin pushpin 画鋲 ピン",
  "📅": "calendar カレンダー",
  "✏️": "pencil edit 鉛筆 編集",
  "🍀": "clover lucky クローバー 幸運",
  "☕": "coffee コーヒー",
  "🍵": "tea 茶",
  "🍩": "donut ドーナツ",
  "🍪": "cookie クッキー",
  "🌸": "cherry blossom 桜",
  "🌿": "herb 葉",
  "🐶": "dog puppy 犬",
  "🐱": "cat 猫",
  "🐰": "rabbit bunny うさぎ",
  "🐻": "bear 熊",
  "🦊": "fox きつね",
  "🐼": "panda パンダ",
  "🦁": "lion ライオン",
  "🐯": "tiger トラ",
  "🐔": "chicken にわとり",
  "🦆": "duck アヒル",
  "🐝": "bee ハチ",
  "🦋": "butterfly チョウ",
  "🐢": "turtle カメ",
  "🐍": "snake ヘビ",
  "🐳": "whale クジラ",
  "🐬": "dolphin イルカ",
  "🐟": "fish 魚",
  "🦄": "unicorn ユニコーン",
  "🍎": "apple リンゴ",
  "🍊": "orange オレンジ",
  "🍌": "banana バナナ",
  "🍇": "grapes ぶどう",
  "🍓": "strawberry イチゴ",
  "🍑": "peach 桃",
  "🍍": "pineapple パイナップル",
  "🍅": "tomato トマト",
  "🍆": "eggplant ナス",
  "🥑": "avocado アボカド",
  "🥦": "broccoli ブロッコリー",
  "🥕": "carrot にんじん",
  "🌽": "corn とうもろこし",
  "🍞": "bread パン",
  "🧀": "cheese チーズ",
  "🍕": "pizza ピザ",
  "🍔": "burger ハンバーガー",
  "🍟": "fries フライドポテト",
  "🍣": "sushi 寿司",
  "🍱": "bento 弁当",
  "🍙": "rice ball おにぎり",
  "🍜": "ramen ラーメン",
  "🍝": "spaghetti pasta スパゲッティ",
  "🍰": "cake ケーキ",
  "🎂": "birthday cake 誕生日",
  "🍦": "ice cream アイス",
  "🍷": "wine ワイン",
  "🍺": "beer ビール",
  "🚗": "car 車",
  "✈️": "plane 飛行機",
  "🚲": "bicycle 自転車",
  "🏠": "house 家",
  "🏢": "building ビル",
  "🏫": "school 学校",
  "🏥": "hospital 病院",
  "🌍": "earth globe 地球",
  "📱": "phone スマホ",
  "💻": "laptop computer ノートPC",
  "🖥️": "desktop computer デスクトップ",
  "⌨️": "keyboard キーボード",
  "🖱️": "mouse マウス",
  "📷": "camera カメラ",
  "🎵": "music note 音符",
  "🎶": "music notes 音符",
  "🔔": "bell ベル",
  "🔍": "search magnifying 検索 虫眼鏡",
  "🔎": "search magnifying 検索 虫眼鏡",
  "🔒": "lock 鍵 ロック",
  "🔓": "unlock 解除",
  "🔑": "key 鍵",
  "🔨": "hammer ハンマー",
  "🛠️": "tools 工具",
  "⚙️": "gear settings 設定 歯車",
  "📊": "chart graph グラフ 棒",
  "📈": "chart up 上昇 グラフ",
  "📉": "chart down 下降 グラフ",
  "🚩": "flag red 赤い旗",
  "🏁": "checkered flag ゴール",
  "🇯🇵": "japan flag 日本",
  "🇺🇸": "usa flag アメリカ",
};

let initialized = false;

export function setupEmojiPicker(onUpdate: () => void): void {
  if (initialized) return;
  initialized = true;

  const panel = $("emojiPanel");
  const grid = $("emojiGrid");
  const tabs = $("emojiTabs");
  const search = $input("emojiSearch");
  const btn = $("emojiBtn");
  const scrollWrap = panel.querySelector<HTMLElement>(".emoji-grid-scroll");

  let activeId = CATEGORIES[0]!.id;
  let suppressScrollSpy = false;

  function insertEmoji(em: string): void {
    const ta = $textarea("text");
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    ta.value = ta.value.slice(0, start) + em + ta.value.slice(end);
    const cursor = start + em.length;
    ta.setSelectionRange(cursor, cursor);
    ta.focus();
    onUpdate();
  }

  function emojiButton(em: string): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = em;
    b.title = em;
    b.tabIndex = -1;
    b.addEventListener("click", () => insertEmoji(em));
    return b;
  }

  function renderTabs(): void {
    tabs.replaceChildren();
    CATEGORIES.forEach(cat => {
      const t = document.createElement("button");
      t.type = "button";
      t.className = "emoji-tab" + (cat.id === activeId ? " active" : "");
      t.textContent = cat.icon;
      t.title = cat.label;
      t.setAttribute("role", "tab");
      t.dataset["catId"] = cat.id;
      t.addEventListener("click", () => {
        search.value = "";
        activeId = cat.id;
        renderGrid();
        renderTabs();
        scrollToCategory(cat.id);
      });
      tabs.appendChild(t);
    });
  }

  function scrollToCategory(id: string): void {
    if (!scrollWrap) return;
    const header = grid.querySelector<HTMLElement>(`[data-cat-header="${id}"]`);
    if (!header) return;
    suppressScrollSpy = true;
    scrollWrap.scrollTop = header.offsetTop - 4;
    setTimeout(() => {
      suppressScrollSpy = false;
    }, 250);
  }

  function renderGrid(): void {
    grid.replaceChildren();
    const q = search.value.trim().toLowerCase();
    if (q) {
      const seen = new Set<string>();
      const matches: string[] = [];
      for (const cat of CATEGORIES) {
        for (const em of cat.emojis) {
          if (seen.has(em)) continue;
          const kw = KEYWORDS[em] ?? "";
          if (em.includes(q) || kw.toLowerCase().includes(q)) {
            seen.add(em);
            matches.push(em);
          }
        }
      }
      if (matches.length === 0) {
        const empty = document.createElement("div");
        empty.className = "emoji-empty";
        empty.textContent = "見つかりません";
        grid.appendChild(empty);
        return;
      }
      matches.forEach(em => grid.appendChild(emojiButton(em)));
      return;
    }
    for (const cat of CATEGORIES) {
      const h = document.createElement("div");
      h.className = "emoji-cat-header";
      h.dataset["catHeader"] = cat.id;
      h.textContent = cat.label;
      grid.appendChild(h);
      for (const em of cat.emojis) grid.appendChild(emojiButton(em));
    }
  }

  // スクロール位置からアクティブタブを判定 (scrollspy)
  function setupScrollSpy(): void {
    if (!scrollWrap) return;
    scrollWrap.addEventListener("scroll", () => {
      if (suppressScrollSpy || search.value.trim()) return;
      const top = scrollWrap.scrollTop + 12;
      let current = CATEGORIES[0]!.id;
      for (const cat of CATEGORIES) {
        const h = grid.querySelector<HTMLElement>(`[data-cat-header="${cat.id}"]`);
        if (!h) continue;
        if (h.offsetTop <= top) current = cat.id;
        else break;
      }
      if (current !== activeId) {
        activeId = current;
        renderTabs();
      }
    }, { passive: true });
  }

  renderTabs();
  renderGrid();
  setupScrollSpy();

  // ポップオーバー配置: トリガ位置を基準に、画面端でクランプ
  function positionPanel(): void {
    if (panel.hidden) return;
    const r = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;
    // 仮配置で実寸を計測 (display:none では offsetWidth が 0 のため一旦表示)
    panel.style.left = "0px";
    panel.style.top = "0px";
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    const pw = Math.min(panel.offsetWidth || 360, vw - margin * 2);
    const ph = panel.offsetHeight || 360;
    // 既定: トリガの上にポップアップ、右端を揃える
    let left = Math.round(r.right - pw);
    let top = Math.round(r.top - ph - 6);
    // 上に入りきらなければ下に出す
    if (top < margin) top = Math.round(r.bottom + 6);
    // 横はみ出しをクランプ
    if (left + pw > vw - margin) left = vw - margin - pw;
    if (left < margin) left = margin;
    // 縦はみ出し最終クランプ
    if (top + ph > vh - margin) top = Math.max(margin, vh - margin - ph);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  function closePanel(): void {
    if (panel.hidden) return;
    panel.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  }

  search.addEventListener("input", () => {
    renderGrid();
    if (scrollWrap) scrollWrap.scrollTop = 0;
  });

  btn.addEventListener("click", e => {
    e.stopPropagation();
    const willOpen = panel.hidden;
    if (willOpen) {
      panel.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      // hidden 解除直後はサイズ未確定のため、次フレームで配置
      requestAnimationFrame(() => {
        positionPanel();
        search.focus();
      });
    } else {
      closePanel();
    }
  });

  document.addEventListener("click", e => {
    if (panel.hidden) return;
    const target = e.target as Node;
    if (btn.contains(target) || panel.contains(target)) return;
    closePanel();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !panel.hidden) {
      closePanel();
      btn.focus();
    }
  });

  // 配置追従: ウィンドウや祖先要素のスクロール/リサイズ
  window.addEventListener("resize", positionPanel);
  window.addEventListener("scroll", positionPanel, { passive: true, capture: true });
}
