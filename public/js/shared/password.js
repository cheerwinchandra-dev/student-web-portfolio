// Password rules, shared by the server (dashboard password change), the setup
// page (/admin/setup) and "npm run hash-password".

// Fragments that make a password easy to guess wherever they appear.
export const WEAK_PARTS = ['password', 'passw0rd', 'qwerty', '123456', 'letmein', 'iloveyou', 'abc123'];

export function passwordProblem(password, username) {
  if (typeof password !== 'string') return 'Enter a new password.';
  if (password.length < 10) return 'Use at least 10 characters.';
  if (password.length > 128) return 'Use at most 128 characters.';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Use both letters and numbers.';
  const lower = password.toLowerCase();
  if (username && lower.includes(username.toLowerCase())) return 'Don’t include your username in the password.';
  if (WEAK_PARTS.some((c) => lower.includes(c))) return 'That password is too easy to guess. Avoid words like “password” or runs like “123456”.';
  if (/^(.)\1+$/.test(password)) return 'Don’t repeat a single character.';
  return '';
}
