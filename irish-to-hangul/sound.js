function sound_read_guide(text, forHangulOnly) {
	if (text === undefined) { return ""; }
	if (typeof lang_code === "undefined") { return text; }

	//split text into words
	const WORDS = text.split(" ");	let RESULTS = [];

	//wordwise
	for (let n = 0; n < WORDS.length; n ++) {
		let WORD = WORDS[n];
		//already marked
		if (/[\=\>\*\@]/.test(WORD) || [`an`, `na`, `is`, `broad`, `slender`, `weak`, `strong`].includes(WORD))
			{ RESULTS.push(WORD); continue; }

		const WORD_RAD = LANG.morph.radicalize(WORD);
		const DICT = radicalMap.get(WORD_RAD);

		//not found
		if (DICT === undefined) { RESULTS.push(WORD); continue; }

		//found
		const GUIDES = dict[DICT]["sound"]["manual"].split(";");

		for (let i = 0; i < GUIDES.length; i ++) {
			let GUIDE = GUIDES[i];

			//check H:
			if (GUIDE.includes("H:")) {
				if (forHangulOnly === false) { continue; }
				else { GUIDE = GUIDE.replaceAll("H:", ""); }
			}

			//aoghai>aoi
			if (GUIDE.includes(">")) {
				const BEF = GUIDE.split(">")[0]; const AFT = GUIDE.split(">")[1];
				WORD = WORD.replaceAll(BEF, AFT);
			}

			//n=gh
			if (GUIDE.includes("=")) {
				const BEF = GUIDE.replace(/\=/g, "");
				WORD = WORD.replaceAll(BEF, GUIDE);
			}

			//manual stress
			if (GUIDE.includes("*")) {
				const BEF = GUIDE.replace(/\*/g, "");
				WORD = WORD.replaceAll(BEF, GUIDE);
			}
		}

		//@
		WORD = WORD.replace(/\@/g, "");

		RESULTS.push(WORD);
	}

	return RESULTS.join(" ");
}


function sound_parse_text(text) {
	text = text.toLowerCase();
	text = text.replace(/['‘’"“”,;:!\.\?\(\)\-–—…]/g, "")

	//text preprocess
	const IRISH_PREPROCESS_RULES = [
		//special words
		{	pattern: REGEX_SPECIAL_WORD, map: SPECIAL_WORD_MAP},

		//Eclipsis/Prothesis
		{	pattern: /(?<=^|\s)(mb|gc|nd|bhf|bp|ts|dt)(?!h)/gi,
			map: { mb: "m", gc: "g", nd: "n", bhf: "bh", bp: "b", ts: "t", dt: "d" }},

		//Voiced + th = Unvoiced
		{ pattern: /(?<!n)[cg]th/gi, replace: "c" },
		{ pattern: /dth/gi, replace: "t" },
		{ pattern: /dt/gi, replace: "t" },
		{ pattern: /[bp]th/gi, replace: "p" },

		//nc + h, ng + h -> n + ch, n + gh
		{ pattern: /n(ch|gh)/gi, replace: "n.$1" },

		//ts > ʧ
		{ pattern: /ts/gi, replace: "ʧ" }
	];

	function PreprocessText(text) {
		return IRISH_PREPROCESS_RULES.reduce((acc, rule) => {
			if (rule.map) {
				return acc.replace(rule.pattern, (matched) => rule.map[matched.toLowerCase()] || matched);
			}
			return acc.replace(rule.pattern, rule.replace);
		}, text);
	}

	text = PreprocessText(text);

	//parse in order
	let P1 = text.split(REGEX_PARSE_LNG);

	let P2 = [];
	for (let i = 0; i < P1.length; i ++) {
		let e = P1[i];
		if (REGEX_PARSE_LNG.test(e)) { P2.push(e); }
		else { let P = e.split(REGEX_PARSE_COM); P2 = P2.concat(P); }
	}

	let P3 = [];
	for (let i = 0; i < P2.length; i ++) {
		let e = P2[i];
		if (REGEX_PARSE_LNG.test(e) || REGEX_PARSE_COM.test(e)) { P3.push(e); }
		else { let P = e.split(REGEX_PARSE_ELS); P3 = P3.concat(P); }
	}

	let Parse = P3.filter(item => item !== "" && item !== undefined);
	Parse.unshift(" "); Parse.unshift(" "); Parse.push(" "); Parse.push(" ");

	//silent parts for stack overflow
	for (let i = 0; i < Parse.length; i ++) {
		if (Parse[i - 1] != " " && Parse[i - 1] != "=" && ["."].includes(Parse[i])) {
			Parse.splice(i, 1); i --;
		}
	}

	Parse = soundHelp_mark_slender(Parse); Parse = soundHelp_mark_stress(Parse);
	return Parse;
}

function sound_get_ipa(text, forHangulOnly = null) {
	//define forHangulOnly
	forHangulOnly = forHangulOnly === true;

	let textSoundGuide = sound_read_guide(text, forHangulOnly);
	let Parse = sound_parse_text(textSoundGuide);

	//to IPA
	let IPA = new Array(Parse.length);
	IPA.fill(" ");

	//special words
	const SPECIAL_WORD = forHangulOnly ? SPECIAL_WORD_HANONLY_TRUE : SPECIAL_WORD_HANONLY_FALSE;
	for (let i = 0; i < Parse.length; i ++) {
		const char = Parse[i];
		if (SPECIAL_WORD[char] !== undefined) {
			IPA[i] = SPECIAL_WORD[char];
		}
	}

	//silenced combinations
	const ARRAY_COM_TO_IPA = forHangulOnly ? ARRAY_COM_TO_IPA_HANONLY_TRUE : ARRAY_COM_TO_IPA_HANONLY_FALSE;
	const MAP_COM_TO_IPA = new Map(
		ARRAY_COM.map((item, index) => [item, ARRAY_COM_TO_IPA[index]])
	);
	Parse.forEach((item, index) => {
		const ipaValue = MAP_COM_TO_IPA.get(item);
		if (ipaValue !== undefined) {
			IPA[index] = ipaValue;
		}
	});

	//exeptional combinations by i, u + X
	for (let i = 1; i < Parse.length; i ++) {
		const PRE = Parse[i - 1]; const NOW = Parse[i];
		const BOOLEAN_PRE_I_U = /(i|u)/i.test(PRE);
		const BOOLEAN_NOW_COM_GENERAL = REGEX_PARSE_COM.test(NOW);
		const BOOLEAN_NOW_COM_SPECIAL = /(aidh|aidhe|aigh|aighe|aighea)/i.test(NOW);

		if (BOOLEAN_PRE_I_U && BOOLEAN_NOW_COM_SPECIAL) { IPA[i] = forHangulOnly == false ? "ə" : "a"; }
	}

	//vowels
	for (let i = 2; i < Parse.length - 2; i ++) {
		//define parts; proceed if only PART_NOW is vowel
		const PART_NOW = REGEX_VOW.test(Parse[i]) ? Parse[i] : null; if (PART_NOW === null) { continue; }
		const PART_FOL = Parse.slice(i + 1, i + 3).join('').toLowerCase();

		///////////////////
		//MATCH MAIN LOOP//
		///////////////////

		//group a
		if (/^(?:A|EA|AI|EAI)$/.test(PART_NOW)) {
			IPA[i] = /^(?:ll|nn|m|rd|rl|rn|rr)/i.test(PART_FOL) ? "aː" : "a";
		}
		else if (/^(?:a|ea|ai|eai)$/.test(PART_NOW)) {
			IPA[i] = !forHangulOnly ? "ə" : "a";
		}

		//group á
		else if (/^(?:á|ái|eá|eái)$/i.test(PART_NOW)) {
			IPA[i] = "aː";
		}

		//group e
		else if (/^(?:E|EI)$/.test(PART_NOW)) {
			IPA[i] = /^(?:ll|nn|m|rd|rl|rn|rr)/i.test(PART_FOL) ? "eː" : "ɛ";
		}
		else if (/^(?:e|ei)$/.test(PART_NOW)) {
			IPA[i] = !forHangulOnly ? "ə" : "e";
		}

		//group é, ae
		else if (/^(?:ae|aei|é|éa|éi)$/i.test(PART_NOW)) {
			IPA[i] = "eː";
		}

		//group i
		else if (/^(?:I)$/.test(PART_NOW)) {
			IPA[i] = /^(?:ll|nn|m)/i.test(PART_FOL) ? "iː" : "ɪ";
		}
		else if (/^(?:i)$/.test(PART_NOW)) {
			IPA[i] = "ɪ";
		}

		//group í, ao
		else if (/^(?:aí|aío|í|ío|oí|oío|uí|uío|ao|aoi)$/i.test(PART_NOW)) {
			IPA[i] = "iː";
		}

		//group ia
		else if (/^(?:ia|iai)$/i.test(PART_NOW)) {
			IPA[i] = !forHangulOnly ? "iə" : "ia";
		}

		//group iá
		else if (/^(?:iá|iái)$/i.test(PART_NOW)) {
			IPA[i] = "iːaː";
		}

		//group io
		else if (/^(?:io)$/i.test(PART_NOW)) {
			IPA[i] = "ɪ";
		}

		//group ió
		else if (/^(?:ió|iói)$/i.test(PART_NOW)) {
			IPA[i] = "iːoː";
		}

		//group iu
		else if (/^(?:iu)$/i.test(PART_NOW)) {
			IPA[i] = "ʊ";
		}

		//group o
		else if (/^(?:O)$/.test(PART_NOW)) {
			IPA[i] = /^(?:ll|nn|m|rd|rl|rn|rr)/i.test(PART_FOL) ? "oː" : "ɔ";
		}
		else if (/^(?:o)$/.test(PART_NOW)) {
			IPA[i] = !forHangulOnly ? "ə" : "o";
		}

		//group ó, eo
		else if (/^(?:ó|ói|eo|eoi)$/i.test(PART_NOW)) {
			IPA[i] = "oː";
		}

		//group oi
		else if (/^(?:OI)$/.test(PART_NOW)) {
			if (/^(?:rd|rl|rn|rr)/i.test(PART_FOL)) { IPA[i] = "oː"; }
			else if (/^(?:ch|r|s)/i.test(PART_FOL)) { IPA[i] = "ɔ"; }
			else { IPA[i] = "ɪ"; }
		}
		else if (/^(?:oi)$/.test(PART_NOW)) {
			if (/^(?:ch|r|s)/i.test(PART_FOL)) { IPA[i] = !forHangulOnly ? "ə" : "o"; }
			else { IPA[i] = !forHangulOnly ? "ə" : "i"; }
		}

		//group u
		else if (/^(?:U)$/.test(PART_NOW)) {
			if (/^(?:rd|rl|rn)/i.test(PART_FOL)) { IPA[i] = "uː"; }
			else { IPA[i] = "ʊ"; }
		}
		else if (/^(?:u)$/.test(PART_NOW)) {
			IPA[i] = !forHangulOnly ? "ə" : "u";
		}

		//group ú
		else if (/^(?:ú|úi|iú|iúi)$/i.test(PART_NOW)) {
			IPA[i] = "uː";
		}

		//group ui
		else if (/^(?:UI)$/.test(PART_NOW)) {
			if (/^(?:rd|rl|rn|rr)/i.test(PART_FOL)) { IPA[i] = "uː"; }
			else if (/^(?:ll|nn|m)/i.test(PART_FOL)) { IPA[i] = "iː"; }
			else { IPA[i] = "ɪ"; }
		}
		else if (/^(?:ui)$/.test(PART_NOW)) {
			IPA[i] = !forHangulOnly ? "ə" : "i";
		}

		//group ua
		else if (/^(?:ua|uai)$/i.test(PART_NOW)) {
			IPA[i] = !forHangulOnly ? "uə" : "ua";
		}

		//group uá
		else if (/^(?:uá|uái)$/i.test(PART_NOW)) {
			IPA[i] = "uːaː";
		}

		//group uó
		else if (/^(?:uó|uói)$/i.test(PART_NOW)) {
			IPA[i] = "uːoː";
		}
	}

	//consonants
	for (let i = 2; i < Parse.length - 2; i ++) {
		//define parts; proceed if only PART_NOW is consonant
		const PART_NOW = REGEX_CNS.test(Parse[i]) ? Parse[i] : null; if (PART_NOW === null) { continue; }
		const PART_PRE = Parse[i - 1];
		const PART_FOL = Parse[i + 1];

		//conditions
		const IS_INITIAL = (["", " ", "="]).includes(PART_PRE);
		const IS_FINAL = (["", " "]).includes(PART_FOL);
		const IS_FOLLOWED_BY_VOWEL = /[aeiouáéíóú]/i.test(PART_FOL);

		///////////////////
		//MATCH MAIN LOOP//
		///////////////////

		if (/^(?:b)$/.test(PART_NOW)) { IPA[i] = "b"; }
		else if (/^(?:B)$/.test(PART_NOW)) { IPA[i] = "b’"; }

		else if (/^(?:bh|mh)$/.test(PART_NOW)) {
			IPA[i] = IS_INITIAL && !IS_FOLLOWED_BY_VOWEL ? "v" : "w";
		}
		else if (/^(?:BH|MH)$/.test(PART_NOW)) { IPA[i] = "v’"; }

		else if (/^(?:c)$/.test(PART_NOW)) { IPA[i] = "k"; }
		else if (/^(?:C)$/.test(PART_NOW)) { IPA[i] = "k’"; }

		else if (/^(?:ch)$/.test(PART_NOW)) { IPA[i] = "x"; }
		else if (/^(?:CH)$/.test(PART_NOW)) {
			IPA[i] = /^(?:t)$/i.test(PART_FOL) ? "x" : "x’";
		}

		else if (/^(?:d)$/.test(PART_NOW)) { IPA[i] = "d"; }
		else if (/^(?:D)$/.test(PART_NOW)) { IPA[i] = "d’"; }

		else if (/^(?:dh|gh)$/.test(PART_NOW)) {
			IPA[i] = IS_INITIAL ? "ɣ" : "";
		}
		else if (/^(?:DH|GH)$/.test(PART_NOW)) {
			IPA[i] = IS_INITIAL && !IS_FOLLOWED_BY_VOWEL ? "ʝ" : "j";
		}

		else if (/^(?:f|ph)$/.test(PART_NOW)) { IPA[i] = "f"; }
		else if (/^(?:F|PH)$/.test(PART_NOW)) { IPA[i] = "f’"; }

		else if (/^(?:fh)$/i.test(PART_NOW)) { IPA[i] = ""; }

		else if (/^(?:g)$/.test(PART_NOW)) { IPA[i] = "ɡ"; }
		else if (/^(?:G)$/.test(PART_NOW)) { IPA[i] = "ɡ’"; }

		else if (/^(?:h|sh)$/i.test(PART_NOW)) { IPA[i] = "h"; }

		else if (/^(?:l)$/.test(PART_NOW)) {
			IPA[i] = IS_INITIAL ? "L" : "l";
		}
		else if (/^(?:L)$/.test(PART_NOW)) {
			IPA[i] = IS_INITIAL ? "L’" : "l’";
		}

		else if (/^(?:ll)$/.test(PART_NOW)) { IPA[i] = "L"; }
		else if (/^(?:LL)$/.test(PART_NOW)) { IPA[i] = "L’"; }

		else if (/^(?:m|mm)$/.test(PART_NOW)) { IPA[i] = "m"; }
		else if (/^(?:M|MM)$/.test(PART_NOW)) { IPA[i] = "m’"; }

		else if (/^(?:n)$/.test(PART_NOW)) {
			if (IS_INITIAL) { IPA[i] = "N"; }
			else if (!/^(?:s|sh)$/i.test(PART_PRE) && !/[aeiouáéíóú]/i.test(PART_PRE) && (["", " ", "="]).includes(Parse[i - 2])) { IPA[i] = "ɾ"; }
			else { IPA[i] = "n"; }
		}
		else if (/^(?:N)$/.test(PART_NOW)) {
			if (IS_INITIAL) { IPA[i] = "N’"; }
			else if (!/^(?:s|sh)$/i.test(PART_PRE) && !/[aeiouáéíóú]/i.test(PART_PRE) && (["", " ", "="]).includes(Parse[i - 2])) { IPA[i] = "ɾ’"; }
			else { IPA[i] = "n’"; }
		}

		else if (/^(?:nn)$/.test(PART_NOW)) { IPA[i] = "N"; }
		else if (/^(?:NN)$/.test(PART_NOW)) { IPA[i] = "N’"; }

		else if (/^(?:nc)$/.test(PART_NOW)) { IPA[i] = "ŋk"; }
		else if (/^(?:NC)$/.test(PART_NOW)) { IPA[i] = "ɲk’"; }

		else if (/^(?:ng)$/.test(PART_NOW)) {
			IPA[i] = !IS_INITIAL && IS_FOLLOWED_BY_VOWEL ? "ŋɡ" : "ŋ";
		}
		else if (/^(?:NG)$/.test(PART_NOW)) { IPA[i] = "ɲ"; }

		else if (/^(?:p)$/.test(PART_NOW)) { IPA[i] = "p"; }
		else if (/^(?:P)$/.test(PART_NOW)) { IPA[i] = "p’"; }

		else if (/^(?:r)$/.test(PART_NOW)) { IPA[i] = "ɾ"; }
		else if (/^(?:R)$/.test(PART_NOW)) {
			if (IS_INITIAL) { IPA[i] = "ɾ"; }
			else if (/^(?:s)$/i.test(PART_PRE) && (["", " ", "="]).includes(Parse[i - 2])) { IPA[i] = "ɾ"; }
			else if (/^(?:d|l|n|s|t)$/i.test(PART_FOL)) { IPA[i] = "ɾ"; }
			else { IPA[i] = "ɾ’"; }
		}

		else if (/^(?:rr)$/i.test(PART_NOW)) { IPA[i] = "ɾ"; }

		else if (/^(?:s)$/.test(PART_NOW)) { IPA[i] = "s"; }
		else if (/^(?:S)$/.test(PART_NOW)) {
			IPA[i] = IS_INITIAL && /^(?:f|m|p)$/i.test(PART_FOL) ? "s" : "ʃ";
		}

		else if (/^(?:t)$/.test(PART_NOW)) { IPA[i] = "t"; }
		else if (/^(?:T)$/.test(PART_NOW)) { IPA[i] = "t’"; }

		else if (/^(?:th)$/i.test(PART_NOW)) {
			if (IS_FOLLOWED_BY_VOWEL) { IPA[i] = "h"; }
			else if (!/ː|au̯|au|ai̯|ai|iə|ia|uə|ua/.test(IPA[i - 1])) { IPA[i] = "h"; }
			else { IPA[i] = ""; }
		}

		else if (/^(?:v)$/i.test(PART_NOW)) { IPA[i] = "v"; }
		else if (/^(?:z)$/i.test(PART_NOW)) { IPA[i] = "z"; }
		else if (/^(?:ʧ)$/i.test(PART_NOW)) { IPA[i] = "ʧ"; }
	}

	//epenthesis
	/*Bíonn ina ghuta cúnta idir an dá chonsan sna péirí seo a leanas nuair is consain leathana iad mura mbíonn guta fada rompu: (a) lb, lbh, lf, lg, lm, lmh (b) nb, nbh, nch, nf, nm (c) rb, rbh, rf, rg, rm.
	Bíonn i ina ghuta cúnta idir an dá chonsan sna péirí seo a leanas nuair is consain chaola iad mura mbíonn guta fada rompu: (a) lb, lbh, lf, lg, lm (b) nb, nbh, nm (c) rb, rbh, rf, rg, rm.
	*/
	//sonorant + (non-dental sonorant or voiced obstruent); after short monovowel
	for (let i = 0; i < Parse.length - 1; i ++) {
		//cluster is compared case-insensitively; the epenthetic vowel quality follows
		//the leading sonorant (uppercase = slender), so mixed-case clusters still match
		const cluster = (Parse[i] + Parse[i + 1]).toLowerCase();
		const isSlenderFirst = Parse[i] !== Parse[i].toLowerCase();
		const conditionClusterBroad = !isSlenderFirst && [`lb`, `lbh`, `lf`, `lg`, `lm`, `lmh`, `nb`, `nbh`, `nch`, `nf`, `nm`, `rb`, `rbh`, `rf`, `rg`, `rm`].includes(cluster);
		const conditionClusterSlender = isSlenderFirst && [`lb`, `lbh`, `lf`, `lg`, `lm`, `nb`, `nbh`, `nm`, `rb`, `rbh`, `rf`, `rg`, `rm`].includes(cluster);
		const conditionAfterShortVowel = !/au̯|ai̯|iə|uə|ː/.test(IPA[i - 1]);

		if (forHangulOnly === false || (forHangulOnly === true && /[ln]/i.test(Parse[i])) ) {
			if (conditionClusterBroad && conditionAfterShortVowel) {
				IPA[i] = IPA[i] + "ə";
			}
			else if (conditionClusterSlender && conditionAfterShortVowel) {
				IPA[i] = IPA[i] + "ɪ";
			}
		}
	}

	//print
	IPA.shift(); IPA.shift(); IPA.pop(); IPA.pop();
	let result = IPA.join("");

	//h + sonorant = unvoiced
	//result = result.replace(/h( ?)([nNɾlLm])/g, "$1$2\u0325");

	//reduce consonant cluster
	result = result
		.replace(/x(’?)h|hx/gi, 'x')
		.replace(/( )?ɲ([nN]’)/g, (m, s, c) => s ? `ɲ ${c}` : "ɲ")
		.replace(/[ˠ=]/g, "")
		.replace(/(.)\1+/g, '$1');

	return result;
}

////////////////////
//HELPER FUNCTIONS//
////////////////////

function soundHelp_mark_slender(T) {
	const result = [...T];

	const isVowelToken = (str) => str !== " " && /[aeiouáéíóú]/i.test(str);
	const isConsonantToken = (str) => str !== " " && !/[aeiouáéíóú]/i.test(str);

	function checkVowelSlender(vowelStr, direction) {
		const lowVowel = vowelStr.toLowerCase();
		const slenderChars = /[eiéí]/;

		if (direction === 'fromRight') {
			if (lowVowel.startsWith("ae")) return false;
			return slenderChars.test(lowVowel[0]);
		} else {
			if (lowVowel.endsWith("ae")) return false;
			return slenderChars.test(lowVowel[lowVowel.length - 1]);
		}
	}

	for (let i = 0; i < T.length; i++) {
		if (!isConsonantToken(T[i])) continue;

		let rv = null, rd = Infinity; let lv = null, ld = Infinity;

		// right
		for (let j = i + 1; j < T.length; j++) {
			if (T[j] === " ") break;
			if (isVowelToken(T[j])) {
				rv = T[j];
				rd = j - i;
				break;
			}
		}

		// left
		for (let j = i - 1; j >= 0; j--) {
			if (T[j] === " ") break;
			if (isVowelToken(T[j])) {
				lv = T[j];
				ld = i - j;
				break;
			}
		}

		let targetVowel = null;
		let fromDirection = '';

		if (rd === 1) {
			// n of lena
			targetVowel = rv;
			fromDirection = 'fromRight';
		} else if (ld === 1) {
			// r of mórmhisneach
			targetVowel = lv;
			fromDirection = 'fromLeft';
		} else {
			if (rd <= ld && rv !== null) {
				targetVowel = rv;
				fromDirection = 'fromRight';
			} else if (lv !== null) {
				targetVowel = lv;
				fromDirection = 'fromLeft';
			}
		}

		if (targetVowel && checkVowelSlender(targetVowel, fromDirection)) {
			result[i] = T[i].toUpperCase();
		}
	}

	return result;
}

function soundHelp_mark_stress(T) {
	//manual
	if (T.includes("*")) {
		while (T.includes("*")) {
			const stressIndex = T.indexOf("*");
			T.splice(stressIndex, 1);
			if (stressIndex > 0) {
				T[stressIndex - 1] = T[stressIndex - 1].toUpperCase();
			}
		}
		return T;
	}

	//auto
	let word_end = false;

	for (let i = 0; i < T.length; i ++) {
		if (/[aeiouáéíóú]/i.test(T[i]) == true && word_end == false) {
			T[i] = T[i].toUpperCase();
			word_end = true;
		}
		if (T[i] == " " && word_end == true) {
			word_end = false;
		}
	}

	return T;
}

////////////////////
/////////DB/////////
////////////////////

const REGEX_SPECIAL_LIST = /X01|X02|X03|X04|X05|X06|X07|X08/i;
const REGEX_SPECIAL_WORD = /(?<=^|\s)(is|an|na|beag|bheag|beaga|bheaga|Ulaidh)(?=$|\s)/gi;

const SPECIAL_WORD_MAP = {
	"is": "X01", "an": "X02", "na": "X03", "beag": "X04", "bheag": "X05",
	"beaga": "X06", "bheaga": "X07", "Ulaidh": "X08"
}
const SPECIAL_WORD_HANONLY_TRUE = {
	"X01": "is", "X02": "an", "X03": "na", "X04": "beɡ", "X05": "beɡ",
	"X06": "beɡa", "X07": "beɡa", "X08": "ula",
	"=": "="
}
const SPECIAL_WORD_HANONLY_FALSE = {
	"X01": "ɪs", "X02": "ən", "X03": "nə", "X04": "b’eɡ", "X05": "v’eɡ",
	"X06": "b’eɡə", "X07": "v’eɡə", "X08": "ulə",
	"=": "="
}

const ARRAY_CNS = ["bhf", "bh", "bp", "ch", "dh", "dt", "fh", "gc", "gh", "ll", "mb", "mh", "nc", "nd", "ng", "nn", "ph", "rr", "sh", "th", "ts", "b", "c", "d", "f", "g", "h", "j", "l", "m", "n", "p", "r", "s", "t", "v", "z", "BHF", "BH", "BP", "CH", "DH", "DT", "FH", "GC", "GH", "LL", "MB", "MH", "NC", "ND", "NG", "NN", "PH", "RR", "SH", "TH", "TS", "B", "C", "D", "F", "G", "H", "J", "L", "M", "N", "P", "R", "S", "T", "V", "Z", "ʧ"];
const ARRAY_VOW = ["AEI", "AÍO", "AOI", "EAI", "EÁI", "EOI", "IAI", "IÁI", "IÓI", "IÚI", "OÍO", "UAI", "UÁI", "UÍO", "UÓI", "ÁI", "AE", "AI", "AÍ", "AO", "EI", "ÉA", "ÉI", "EA", "EÁ", "EO", "ÍO", "IA", "IÁ", "IO", "IÓ", "IU", "IÚ", "ÓI", "OI", "OÍ", "ÚI", "UA", "UÁ", "UI", "UÍ", "UÓ", "A", "Á", "E", "É", "I", "Í", "O", "Ó", "U", "Ú", "aei", "aío", "aoi", "eai", "eái", "eoi", "iai", "iái", "iói", "iúi", "oío", "uai", "uái", "uío", "uói", "ái", "ae", "ai", "aí", "ao", "ei", "éa", "éi", "ea", "eá", "eo", "ío", "ia", "iá", "io", "ió", "iu", "iú", "ói", "oi", "oí", "úi", "ua", "uá", "ui", "uí", "uó", "a", "á", "e", "é", "i", "í", "o", "ó", "u", "ú"];
const ARRAY_COM = ["ABH", "ABHA", "ABHAI", "EABH", "EABHA", "EABHAI", "ADH", "ADHA", "ADHAI", "AGH", "AGHA", "AGHAI", "EADH", "EADHA", "EADHAI", "EAGH", "EAGHA", "EAGHAI", "AIDH", "AIDHE", "AIGH", "AIGHE", "AIGHEA", "AMH", "AMHA", "AMHAI", "EAMH", "EAMHA", "EAMHAI", "EIDH", "EIDHEA", "EIDHI", "EIGH", "EIGHEA", "EIGHI", "IDH", "IGH", "UIGH", "OIDH", "OIDHEA", "OIDHI", "OIGH", "OIGHEA", "OIGHI", "OBH", "OBHA", "OBHAI", "ODH", "ODHA", "ODHAI", "OGH", "OGHA", "OGHAI", "EOBH", "EOBHA", "EOBHAI", "EODH", "EODHA", "EODHAI", "EOGH", "EOGHA", "EOGHAI", "OMH", "OMHA", "OMHAI", "EOMH", "EOMHA", "EOMHAI", "UBH", "IUBH", "UMH", "UMHA", "UMHAI", "IUMH", "IUMHA", "IUMHAI", "abh", "abha", "abhai", "eabh", "eabha", "eabhai", "adh", "adha", "adhai", "agh", "agha", "aghai", "eadh", "eadha", "eadhai", "eagh", "eagha", "eaghai", "aidh", "aidhe", "aigh", "aighe", "aighea", "amh", "amha", "amhai", "eamh", "eamha", "eamhai", "eidh", "eidhea", "eidhi", "eigh", "eighea", "eighi", "idh", "igh", "uigh", "oidh", "oidhea", "oidhi", "oigh", "oighea", "oighi", "obh", "obha", "obhai", "odh", "odha", "odhai", "ogh", "ogha", "oghai", "eobh", "eobha", "eobhai", "eodh", "eodha", "eodhai", "eogh", "eogha", "eoghai", "omh", "omha", "omhai", "eomh", "eomha", "eomhai", "ubh", "iubh", "umh", "umha", "umhai", "iumh", "iumha", "iumhai"];

const REGEX_CNS = new RegExp(`(${ARRAY_CNS.join('|')})`);
const REGEX_VOW = new RegExp(`(${ARRAY_VOW.join('|')})`);

const ARRAY_COM_TO_IPA_HANONLY_FALSE = [
	"au̯", "au̯", "au̯", "au̯", "au̯", "au̯", "ai̯", "ai̯", "ai̯", "ai̯", "ai̯", "ai̯", "ai̯", "ai̯", "ai̯", "ai̯", "ai̯", "ai̯", "ai̯", "ai̯", "ai̯", "ai̯", "ai̯", "au̯", "au̯", "au̯", "au̯", "au̯", "au̯", "eː", "eː", "eː", "eː", "eː", "eː", "iː", "iː", "iː", "ai̯", "ai̯", "ai̯", "ai̯", "ai̯", "ai̯", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "uː", "uː", "uː", "uː", "uː", "uː", "uː", "uː", 
	"uː", "uː", "uː", "uː", "uː", "uː", "ə", "ə", "ə", "ə", "ə", "ə", "ə", "ə", "ə", "ə", "ə", "ə", "iː", "iː", "iː", "iː", "iː", "uː", "uː", "uː", "uː", "uː", "uː", "eː", "eː", "eː", "eː", "eː", "eː", "ɪ", "ɪ", "ɪ", "ai̯", "ai̯", "ai̯", "ai̯", "ai̯", "ai̯", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "oː", "uː", "uː", "uː", "uː", "uː", "uː", "uː", "uː" 
	];
const ARRAY_COM_TO_IPA_HANONLY_TRUE = [
	"au", "au", "au", "au", "au", "au", "ai", "ai", "ai", "ai", "ai", "ai", "ai", "ai", "ai", "ai", "ai", "ai", "ai", "ai", "ai", "ai", "ai", "au", "au", "au", "au", "au", "au", "e", "e", "e", "e", "e", "e", "i", "i", "i", "ai", "ai", "ai", "ai", "ai", "ai", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "u", "u", "u", "u", "u", "u", "u", "u", 
	"u", "u", "u", "u", "u", "u", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "i", "i", "i", "i", "i", "u", "u", "u", "u", "u", "u", "e", "e", "e", "e", "e", "e", "i", "i", "i", "ai", "ai", "ai", "ai", "ai", "ai", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "u", "u", "u", "u", "u", "u", "u", "u"];

const REGEX_PARSE_LNG = /(aei|aoi|ae|ao|aío|eái|iái|iói|iúi|oío|uái|uío|uói|ái|aí|éa|éi|eá|ío|iá|ió|iú|ói|oí|úi|uá|uí|uó|á|é|í|ó|ú)/i;
const REGEX_PARSE_COM = /(aighea|eabhai|eadhai|eaghai|eamhai|eidhea|eighea|eobhai|eodhai|eoghai|eomhai|iumhai|oidhea|oighea|abhai|adhai|aghai|aidhe|aighe|amhai|eabha|eadha|eagha|eamha|eidhi|eighi|eobha|eodha|eogha|eomha|iumha|obhai|odhai|oghai|oidhi|oighi|omhai|umhai|abha|adha|agha|aidh|aigh|amha|eabh|eadh|eagh|eamh|eidh|eigh|eobh|eodh|eogh|eomh|iubh|iumh|obha|odha|ogha|oidh|oigh|omha|uigh|umha|abh|adh|agh|amh|idh|igh|obh|odh|ogh|omh|ubh|umh|eoi|eo)/i;
const REGEX_PARSE_ELS = new RegExp(`(${REGEX_SPECIAL_LIST.source}|${/eai|iai|uai|ai|ei|ea|ia|io|iu|oi|ua|ui|a|e|i|o|u|bh|ch|dh|dt|fh|gh|ll|mh|nc|ng|nn|ph|rr|sh|th|b|c|d|f|g|h|j|l|m|n|p|r|s|t|v|z|ʧ|\=|\*|\.|\s|\t+|\|/.source})`,"i");

