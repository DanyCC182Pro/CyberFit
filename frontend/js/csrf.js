// Añade el token CSRF a toda petición de escritura hacia la API del mismo origen.
(() => {
  const nativeFetch = window.fetch.bind(window);
  let token = null;
  async function getToken(force) {
    if (!token || force) { const r = await nativeFetch('/api/auth/csrf', { credentials: 'same-origin' }); token = (await r.json()).csrfToken; }
    return token;
  }
  window.fetch = async (url, options = {}) => {
    const method = String(options.method || 'GET').toUpperCase();
    if (typeof url !== 'string' || !url.startsWith('/') || ['GET', 'HEAD', 'OPTIONS'].includes(method)) return nativeFetch(url, options);
    const send = async (force) => { const h = new Headers(options.headers || {}); h.set('X-CSRF-Token', await getToken(force)); return nativeFetch(url, { ...options, headers: h }); };
    let res = await send(false);
    if (res.status === 403) { try { if ((await res.clone().json()).code === 'CSRF') res = await send(true); } catch (_) {} } // el token cambia al regenerar la sesión
    return res;
  };
})();
