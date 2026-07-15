// Tiny module-level store so the React Query global error handler and the
// window-level unhandledrejection listener can both signal session expiry
// without prop-drilling or context coupling.

let _expired = false;
const _subs = new Set();

export function isSessionExpired() {
  return _expired;
}

export function reportSessionExpired() {
  if (_expired) return;
  _expired = true;
  _subs.forEach((cb) => cb(true));
}

export function clearSessionExpired() {
  if (!_expired) return;
  _expired = false;
  _subs.forEach((cb) => cb(false));
}

export function subscribeAuthError(cb) {
  _subs.add(cb);
  return () => _subs.delete(cb);
}

// Normalises the many shapes an auth error can take (axios, fetch, SDK-wrapped)
export function isAuthError(err) {
  if (!err) return false;
  const status = err.status || err.response?.status || err.statusCode || err.code;
  return status === 401 || status === 403;
}