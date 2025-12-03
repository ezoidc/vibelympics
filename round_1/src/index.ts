export const digitEmoji = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

export const toEmojiNumber = (value: number, minDigits = 2): string => {
	const safe = Math.max(0, Math.floor(value));
	const raw = safe.toString().padStart(minDigits, '0');
	return raw
		.split('')
		.map((char) => digitEmoji[Number(char)] ?? digitEmoji[0])
		.join('');
};

export const formatEmojiTime = (milliseconds: number): string => {
	const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${toEmojiNumber(minutes)}🟰${toEmojiNumber(seconds)}`;
};

export const shuffle = <T,>(input: T[]): T[] => {
	const arr = [...input];
	for (let i = arr.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		const temp = arr[i]!;
		arr[i] = arr[j]!;
		arr[j] = temp;
	}
	return arr;
};