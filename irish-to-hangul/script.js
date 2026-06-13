const input = document.getElementById('irish-input');
const output = document.getElementById('hangul-output');
const altToggle = document.getElementById('alt-hangul-toggle');

const properties = { alternativeHangul: false };

const ALLOWED = /[^a-záéíóú\s.,!?;:'"‘’“”()\-–—…0123456789`~@#$%^&*_=+[\]{}\\|<>\/]/gi;

function toHangul(text) {
	if (text.trim() === '') { return ''; }
	return text.split('\n').map(line => {
		if (line.trim() === '') { return ''; }
		// 글자 사이에 낀 '’-는 변환 전에 제거 (d'ith → dith, sean-nós → seannós)
		line = line.replace(/([a-záéíóú])['’-](?=[a-záéíóú])/gi, '$1');
		return line.split(/([^a-záéíóú\s]+)/i).map((seg, i) => {
			if (i % 2 === 1) { return seg; }
			if (seg.trim() === '') { return seg; }
			const lead = /^\s/.test(seg) ? ' ' : '';
			const trail = /\s$/.test(seg) ? ' ' : '';
			return lead + sound_get_han(seg) + trail;
		}).join('').trim();
	}).join('\n');
}

function render() {
	output.textContent = toHangul(input.value);
}

input.addEventListener('input', () => {
	const cleaned = input.value.replace(ALLOWED, '');
	if (cleaned !== input.value) {
		const pos = input.selectionStart - (input.value.length - cleaned.length);
		input.value = cleaned;
		input.setSelectionRange(pos, pos);
	}
	render();
});

altToggle.addEventListener('change', () => {
	properties.alternativeHangul = altToggle.checked;
	render();
});
