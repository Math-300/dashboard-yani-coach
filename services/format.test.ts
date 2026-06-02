import { formatDuration } from './format';

console.assert(formatDuration(0) === '0 min', `0 → ${formatDuration(0)}`);
console.assert(formatDuration(8) === '8 min', `8 → ${formatDuration(8)}`);
console.assert(formatDuration(45) === '45 min', `45 → ${formatDuration(45)}`);
console.assert(formatDuration(59) === '59 min', `59 → ${formatDuration(59)}`);
console.assert(formatDuration(60) === '1h', `60 → ${formatDuration(60)}`);
console.assert(formatDuration(119) === '1h 59m', `119 → ${formatDuration(119)}`);
console.assert(formatDuration(118.7) === '1h 59m', `118.7 → ${formatDuration(118.7)}`);
console.assert(formatDuration(120) === '2h', `120 → ${formatDuration(120)}`);
console.assert(formatDuration(125) === '2h 5m', `125 → ${formatDuration(125)}`);
console.assert(formatDuration(598) === '9h 58m', `598 → ${formatDuration(598)}`);

console.log('OK format');
