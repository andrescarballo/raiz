// PWA lifecycle: installable app shell + an explicit "update available" flow.
//
// Vite hashes build output per deploy, so a stale service worker means a
// stale game forever unless something evicts it. The worker (public/sw.js)
// parks a ready update in the "waiting" state instead of activating it
// immediately — forcing a reload mid-session would yank the canvas out
// from under whoever is playing. This module surfaces a banner instead and
// lets the reload happen on the player's terms.

const swUrl = `${import.meta.env.BASE_URL}sw.js`;
const scope = import.meta.env.BASE_URL;

function $(sel){ return document.querySelector(sel); }

function offerUpdate(worker){
  const el = $('#update'), btn = $('#updateBtn');
  if (!el || !btn) return;
  el.classList.add('on');
  btn.onclick = () => { el.classList.remove('on'); worker.postMessage('SKIP_WAITING'); };
}

export function initPWA(){
  if (!('serviceWorker' in navigator)) return;

  addEventListener('load', async () => {
    let reg;
    try { reg = await navigator.serviceWorker.register(swUrl, { scope }); }
    catch { return; }

    if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);

    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker);
      });
    });

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });

    // The tab can sit open for a whole play session — keep checking so an
    // update doesn't wait for a manual reload to even be noticed.
    const check = () => reg.update().catch(() => {});
    setInterval(check, 60 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  });
}

// Manifest orientation:"landscape" already locks installed/fullscreen apps
// on platforms that honor it (Android Chrome). This is the imperative
// fallback for the rest — it only succeeds in a fullscreen context, so it's
// wrapped defensively; the CSS rotate overlay is what actually guarantees
// landscape play everywhere else.
export function initOrientationLock(){
  const orientation = screen.orientation;
  if (!orientation || !orientation.lock) return;
  const tryLock = () => orientation.lock('landscape').catch(() => {});
  tryLock();
  document.addEventListener('fullscreenchange', tryLock);
}
