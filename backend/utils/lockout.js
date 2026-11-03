// Bloqueo temporal por cuenta (complementa el rate limit por IP; el estado vive en MongoDB, así que se comparte entre instancias).
const MAX_ATTEMPTS = 5;
const BASE_LOCK_MS = 15 * 60 * 1000;
function nextLockState(attempts, now = Date.now()) {
  const n = attempts + 1;
  if (n < MAX_ATTEMPTS) return { failedLoginAttempts: n, lockUntil: null };
  const factor = Math.min(2 ** Math.floor((n - MAX_ATTEMPTS) / MAX_ATTEMPTS), 8); // 15, 30, 60... min (máx. 2 h)
  return { failedLoginAttempts: n, lockUntil: new Date(now + BASE_LOCK_MS * factor) };
}
const isLocked = (user, now = Date.now()) => Boolean(user && user.lockUntil && user.lockUntil.getTime() > now);
async function registerFailure(User, user) {
  const s = nextLockState(user.failedLoginAttempts || 0);
  await User.updateOne({ _id: user._id }, { $set: s });
  return s;
}
const clearFailures = (User, user) => (user.failedLoginAttempts || user.lockUntil) ? User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0, lockUntil: null } }) : null;
module.exports = { nextLockState, isLocked, registerFailure, clearFailures, MAX_ATTEMPTS };
