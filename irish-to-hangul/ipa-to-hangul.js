// Build a pipeline step that applies a {pattern: replacement} table via its regex.
const applyMap = (regex, table) => (s) => s.replace(regex, (m) => table[m]);

// Compile a {key: value} replacement table into one alternation regex. Keys keep their insertion order, so longer multi-character keys listed first still win.
const compileReplacements = (table) => new RegExp(Object.keys(table).join("|"), "g");

// Render the IPA produced by the phonology module as Korean. The transcription is a fixed, order-sensitive sequence of string rewrites (HAN_RULES, defined below).
function sound_get_han(text) {
	let s = " " + sound_get_ipa(text, true) + " ";

	for (const rule of HAN_RULES) {
		s = typeof rule === "function" ? rule(s) : s.replace(rule[0], rule[1]);
	}

	// optionally spell out rare/fragile syllables (e.g. 댤 -> 디알)
	if (properties.alternativeHangul === true) {
		s = s.replace(REGEX_HAN_SYLLABARY_ALTER, (m) => ARRAY_HAN_SYLLABARY_ALTER[m]);
	}

	return s;
}

// Hangul coda indices, added to a coda-less syllable's code
// point — the base syllables in ARRAY_HAN_SYLLABARY all have an empty final.
const HANGUL_CODA_OFFSET = { "n": 4, "m": 16, "ŋ": 21, "l": 8 };

function soundHelp_han_attach_coda(syllable, coda) {
	const offset = HANGUL_CODA_OFFSET[coda];
	return offset === undefined ? "쀿" : String.fromCharCode(syllable.charCodeAt(0) + offset);
}

//ipa to hangul replacements
const ARRAY_IPA_TO_HAN_PREPROCESS = {
	"ː": "", "N": "n", "L": "l", "\u0325": "",
	"nə": "nʌ", "lə": "lʌ",
	"ə": "", "ɛ": "e", "ɪ": "i", "ɔ": "o", "ʊ": "u", "i̯": "i", "u̯": "u", "ʝ": "i",
	"ɣ": "g", "ɡ": "g", "f": "p", "ʤ": "z", "ʒ": "z", "ɾ": "r", "v": "b"
};
const ARRAY_IPA_TO_HAN_CONSONANT = {
	"b’a": "ba", "b’o": "bjo", "b’u": "bju", "b’e": "be", "b’i": "bi",
	"p’a": "pa", "p’o": "pjo", "p’u": "pju", "p’e": "pe", "p’i": "pi",
	"m’a": "ma", "m’o": "mjo", "m’u": "mju", "m’e": "me", "m’i": "mi",
	"wo": "bo", "wu": "bu",
	"k’a": "kja", "k’o": "kjo", "k’u": "kju", "k’e": "ke", "k’i": "ki",
	"x’a": "hia", "x’o": "hio", "x’u": "hiu", "x’e": "he", "x’i": "hi",
	"d’a": "dja", "d’o": "djo", "d’u": "dju", "d’e": "de", "d’i": "di",
	"t’a": "tja", "t’o": "tjo", "t’u": "tju", "t’e": "te", "t’i": "ti",
	"g’a": "gja", "g’o": "gjo", "g’u": "gju", "g’e": "ge", "g’i": "gi",
	"l’a": "lja", "l’o": "ljo", "l’u": "lju", "l’e": "le", "l’i": "li",
	"r’a": "rja", "r’o": "rjo", "r’u": "rju", "r’e": "re", "r’i": "ri",
	"n’a": "nja", "n’o": "njo", "n’u": "nju", "n’e": "ne", "n’i": "ni",
	"ɲa": "nja", "ɲo": "njo", "ɲu": "nju", "ɲe": "nje", "ɲi": "ni",
	"ʃa": "sja", "ʃo": "sjo", "ʃu": "sju", "ʃe": "sje", "ʃi": "si"

	/*
	,
	"d’a": "za", "d’o": "zo", "d’u": "zu", "d’e": "ze", "d’i": "zi",
	"t’a": "ʧa", "t’o": "ʧo", "t’u": "ʧu", "t’e": "ʧe", "t’i": "ʧi"
	*/
};
const ARRAY_IPA_TO_HAN_AFTERWORK = {
	"’": "", "ɟ": "g", "x": "h", "ɲ": "n", "w ": "u ", "j ": "i ", " ʃ": " sju"
};

const REGEX_IPA_TO_HAN_PREPROCESS = compileReplacements(ARRAY_IPA_TO_HAN_PREPROCESS);
const REGEX_IPA_TO_HAN_CONSONANT = compileReplacements(ARRAY_IPA_TO_HAN_CONSONANT);
const REGEX_IPA_TO_HAN_AFTERWORK = compileReplacements(ARRAY_IPA_TO_HAN_AFTERWORK);

//hangul syllabary
const ARRAY_HAN_SYLLABARY = {
	"a": "아", "e": "에", "i": "이", "o": "오", "u": "우", "ja": "야", "je": "예", "jo": "요", "ju": "유", "ɯ": "으", "ba": "바", "be": "베", "bi": "비", "bo": "보", "bu": "부", "bja": "뱌", "bje": "볘", "bjo": "뵤", "bju": "뷰", "bɯ": "브", "da": "다", "de": "데", "di": "디", "do": "도", "du": "두", "dja": "댜", "dje": "뎨", "djo": "됴", "dju": "듀", "dɯ": "드", "ga": "가", "ge": "게", "gi": "기", "go": "고", "gu": "구", "gja": "갸", "gje": "계", "gjo": "교", "gju": "규", "gɯ": "그", "ha": "하", "he": "헤", "hi": "히", "ho": "호", "hu": "후", "hja": "흐야", "hje": "흐예", "hjo": "흐요", "hju": "흐유", "hɯ": "흐", "ka": "카", "ke": "케", "ki": "키", "ko": "코", "ku": "쿠", "kja": "캬", "kje": "켸", "kjo": "쿄", "kju": "큐", "kɯ": "크", "la": "라", "le": "레", "li": "리", "lo": "로", "lu": "루", "lja": "랴", "lje": "례", "ljo": "료", "lju": "류", "lɯ": "르", "ma": "마", "me": "메", "mi": "미", "mo": "모", "mu": "무", "mja": "먀", "mje": "몌", "mjo": "묘", "mju": "뮤", "mɯ": "므", "na": "나", "ne": "네", "ni": "니", "no": "노", "nu": "누", "nja": "냐", "nje": "녜", "njo": "뇨", "nju": "뉴", "nɯ": "느", "pa": "파", "pe": "페", "pi": "피", "po": "포", "pu": "푸", "pja": "퍄", "pje": "폐", "pjo": "표", "pju": "퓨", "pɯ": "프", "ra": "라", "re": "레", "ri": "리", "ro": "로", "ru": "루", "rja": "랴", "rje": "례", "rjo": "료", "rju": "류", "rɯ": "르", "sa": "사", "se": "세", "si": "시", "so": "소", "su": "수", "sja": "샤", "sje": "셰", "sjo": "쇼", "sju": "슈", "sɯ": "스", "ta": "타", "te": "테", "ti": "티", "to": "토", "tu": "투", "tja": "탸", "tje": "톄", "tjo": "툐", "tju": "튜", "tɯ": "트", "wa": "와", "we": "웨", "wi": "위", "wo": "워", "wu": "우", "wja": "븩", "wje": "뵥", "wjo": "뺩", "wju": "즥", "wɯ": "우", "za": "자", "ze": "제", "zi": "지", "zo": "조", "zu": "주", "zja": "자", "zje": "제", "zjo": "조", "zju": "주", "zɯ": "즈", "ʧa": "차", "ʧe": "체", "ʧi": "치", "ʧo": "초", "ʧu": "추", "ʧja": "차", "ʧje": "체", "ʧjo": "초", "ʧju": "추", "ʧɯ": "츠", "nʌ": "너", "rʌ": "러"
};
const ARRAY_HAN_SYLLABARY_ALTER = {
	"갼": "기안", "걀": "기알", "걈": "기암", "걍": "기앙", "굔": "기온", "굘": "기올", "굠": "기옴", "굥": "기옹", "균": "기운", "귤": "기울", "귬": "기움", "귱": "기웅", "냔": "니안", "냘": "니알", "냠": "니암", "냥": "니앙", "뇬": "니온", "뇰": "니올", "뇸": "니옴", "뇽": "니옹", "뉸": "니운", "뉼": "니울", "늄": "니움", "늉": "니웅", "댠": "디안", "댤": "디알", "댬": "디암", "댱": "디앙", "됸": "디온", "됼": "디올", "둄": "디옴", "둉": "디옹", "듄": "디운", "듈": "디울", "듐": "디움", "듕": "디웅", "랸": "리안", "랼": "리알", "럄": "리암", "량": "리앙", "룐": "리온", "룔": "리올", "룜": "리옴", "룡": "리옹", "륜": "리운", "률": "리울", "륨": "리움", "륭": "리웅", "먄": "미안", "먈": "미알", "먐": "미암", "먕": "미앙", "묜": "미온", "묠": "미올", "묨": "미옴", "묭": "미옹", "뮨": "미운", "뮬": "미울", "뮴": "미움", "뮹": "미웅", "뱐": "비안", "뱔": "비알", "뱜": "비암", "뱡": "비앙", "뵨": "비온", "뵬": "비올", "뵴": "비옴", "뵹": "비옹", "뷴": "비운", "뷸": "비울", "븀": "비움", "븅": "비웅", "캰": "키안", "캴": "키알", "캼": "키암", "컁": "키앙", "쿈": "키온", "쿌": "키올", "쿔": "키옴", "쿙": "키옹", "큔": "키운", "큘": "키울", "큠": "키움", "큥": "키웅", "탼": "티안", "턀": "티알", "턈": "티암", "턍": "티앙", "툔": "티온", "툘": "티올", "툠": "티옴", "툥": "티옹", "튠": "티운", "튤": "티울", "튬": "티움", "튱": "티웅", "퍈": "피안", "퍌": "피알", "퍰": "피암", "퍙": "피앙", "푠": "피온", "푤": "피올", "푬": "피옴", "푱": "피옹", "퓬": "피운", "퓰": "피울", "퓸": "피움", "퓽": "피웅", "햔": "히안", "햘": "히알", "햠": "히암", "향": "히앙", "횬": "히온", "횰": "히올", "횸": "히옴", "횽": "히옹", "휸": "히운", "휼": "히울", "흄": "히움", "흉": "히웅"
};

const REGEX_HAN_SYLLABARY = compileReplacements(ARRAY_HAN_SYLLABARY);
const REGEX_HAN_SYLLABARY_ALTER = compileReplacements(ARRAY_HAN_SYLLABARY_ALTER);

// Ordered IPA→Hangul rewrite pipeline used by sound_get_han. Each rule is either [regex, replacement] or a function (s)->s. Order is significant.
const HAN_RULES = [
	// 1) pre-clean + language-specific consonant-cluster fixes
	[/\./g, ""],
	[/(n’v’)(?![aeiouəɛɪɔʊjɯ])/g, "nib"],   // cinbh
	[/(nw)(?![aeiouəɛɪɔʊjɯ])/g, "nu"],      // leanbh

	// 2) IPA symbols → romanised syllable pieces (table lookups)
	applyMap(REGEX_IPA_TO_HAN_PREPROCESS, ARRAY_IPA_TO_HAN_PREPROCESS),
	applyMap(REGEX_IPA_TO_HAN_CONSONANT, ARRAY_IPA_TO_HAN_CONSONANT),
	applyMap(REGEX_IPA_TO_HAN_AFTERWORK, ARRAY_IPA_TO_HAN_AFTERWORK),

	// 3) glides & sibilant
	[/([w])(?![aeioujʌ])/g, "u"],
	[/(ʌu)(?![aeioujʌ])/g, "u"],
	[/ʃ/g, "si"],

	// 4) insert filler ɯ after bare consonants and between chained liquids
	[/([bkdpghkprstz])(?![aeioujʌ])/g, "$1ɯ"],
	[/([mnlr])([mnl])(?![aeioujɯʌ])/g, "$1ɯ$2"],
	[/( )([mn])([rl])/g, "$1$2ɯ$3"],

	// 5) reposition initial ŋ / nasal codas
	[/([aeiou])( )([ŋ])/g, "$1$3$2"],
	[/([aeiou])( )([mn])([ɯ])/g, "$1$3$2"],
	[/(^ŋ| ŋ)/g, "응"],

	// 6) split coda l; initial ua/ia → wa/ja; ji → i
	[/(?<=[aeiouɯ])([l])(?=[aeioujɯʌ])/g, "lr"],
	[/(?<=[ aeiou])(ua)/g, "wa"],
	[/(?<=[ aeiou])(i)([aou])/g, "j$2"],
	[/(ji)/g, "i"],

	// 7) collapse repeated characters (əə → ə)
	[/(.)\1+/g, "$1"],

	// 8) mark syllable boundaries with "."
	[/(?<=[aeiouɯ])([mnlŋ])(?![aeioujɯʌ])/g, "$1."],
	[/([aeiouɯ])(?![mnlŋ])/g, "$1."],
	[/([aeiouɯ])([mnlŋ])([aeioujɯʌ])/g, "$1.$2$3"],

	// 9) romanised pieces → Hangul syllables, then fuse a trailing nasal/liquid as coda
	applyMap(REGEX_HAN_SYLLABARY, ARRAY_HAN_SYLLABARY),
	(s) => s.replace(/([가-히])([nmlŋ])/g, (m, syl, coda) => soundHelp_han_attach_coda(syl, coda)),

	// 10) drop the boundary marks
	(s) => s.replaceAll(".", "").trim()
];
