/* 123Kasi in-page account modal.
 * The browser displays Apps Script's own account UI in an iframe.
 * Passwords NEVER pass through the GitHub Pages host.
 * The Apps Script deployment must support ?embed=1 and the verified
 * postMessage handshake before the form can be displayed.
 */
(() => {
  'use strict';

  const accountLinks = [...document.querySelectorAll('.account-link, .reels-signin')];
  if (!accountLinks.length) return;
  const authUrl = accountLinks[0].href;
  const hostOrigin = location.origin;
  const dialog = document.createElement('dialog');
  dialog.className = 'account-modal';
  dialog.setAttribute('aria-label', '123Kasi sign in or create account');
  dialog.innerHTML = `
    <div class="account-modal-shell">
      <header class="account-modal-header">
        <div class="account-modal-brand"><span>123</span>KASI <small>Account</small></div>
        <button class="account-modal-close" type="button" aria-label="Close account form">×</button>
      </header>
      <div class="account-modal-body">
        <div class="account-modal-status" role="status" aria-live="polite">
          <div class="account-modal-spinner" aria-hidden="true"></div>
          <strong>Loading secure account form…</strong>
          <p>The form is securely hosted by Google Apps Script.</p>
        </div>
        <iframe class="account-modal-iframe" title="123Kasi secure sign in and registration"
          referrerpolicy="origin" allow="clipboard-write" hidden></iframe>
      </div>
      <footer class="account-modal-footer">
        <span>Google Apps Script</span>
        <a class="account-modal-external" target="_blank" rel="noopener noreferrer">Open full-page login</a>
      </footer>
    </div>`;
  document.body.append(dialog);

  const iframe = dialog.querySelector('.account-modal-iframe');
  const status = dialog.querySelector('.account-modal-status');
  const title = status.querySelector('strong');
  const message = status.querySelector('p');
  const spinner = status.querySelector('.account-modal-spinner');
  const closeButton = dialog.querySelector('.account-modal-close');
  const fullLink = dialog.querySelector('.account-modal-external');
  fullLink.href = authUrl;

  let nonce = '';
  let timeoutId = null;

  const googleOrigin = origin => {
    try {
      const parsed = new URL(origin);
      return parsed.protocol === 'https:' && (
        parsed.hostname === 'script.google.com' ||
        parsed.hostname.endsWith('.googleusercontent.com')
      );
    } catch (_) {
      return false;
    }
  };

  function resetFrame() {
    if (timeoutId !== null) clearTimeout(timeoutId);
    timeoutId = null;
    nonce = '';
    iframe.hidden = true;
    iframe.removeAttribute('src');
    status.hidden = false;
    spinner.hidden = false;
    title.textContent = 'Loading secure account form…';
    message.textContent = 'The form is securely hosted by Google Apps Script.';
  }

  function openInline() {
    resetFrame();
    // Every embed uses a fresh challenge, so an unrelated third-party iframe
    // cannot mark itself trusted by the host or request form visibility.
    const random = new Uint8Array(16);
    crypto.getRandomValues(random);
    nonce = Array.from(random, b => b.toString(16).padStart(2, '0')).join('');
    const url = new URL(authUrl);
    url.searchParams.set('embed', '1');
    url.searchParams.set('nonce', nonce);
    dialog.showModal();
    iframe.src = url.href;
    closeButton.focus();

    timeoutId = setTimeout(() => {
      if (!dialog.open || !nonce || !iframe.hidden) return;
      spinner.hidden = true;
      title.textContent = 'The embedded form has not loaded';
      message.textContent = 'The Apps Script deployment may still need updating, or your browser may be blocking embedded Google pages. You can use the full-page login link below.';
    }, 11000);
  }

  window.addEventListener('message', event => {
    if (!dialog.open || !nonce || !googleOrigin(event.origin)) return;
    const data = event.data;
    if (!data || data.source !== '123kasi-auth' || data.nonce !== nonce) return;

    if (data.kind === 'ready') {
      // Reply only to the verified Google-hosted frame, never to random sites.
      event.source?.postMessage({
        source: '123kasi-auth-host', kind: 'ack', nonce
      }, event.origin);
    } else if (data.kind === 'accepted') {
      if (timeoutId !== null) clearTimeout(timeoutId);
      timeoutId = null;
      iframe.hidden = false;
      status.hidden = true;
    }
  });

  function closeDialog() {
    if (dialog.open) dialog.close();
  }

  closeButton.addEventListener('click', closeDialog);
  dialog.addEventListener('click', event => {
    if (event.target === dialog) closeDialog();
  });
  dialog.addEventListener('close', resetFrame);

  accountLinks.forEach(link => {
    link.setAttribute('aria-haspopup', 'dialog');
    link.setAttribute('aria-label', 'Open 123Kasi sign in and sign up');
    link.title = 'Sign in or create an account without leaving 123Kasi';
    link.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 ||
          event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openInline();
    });
  });
})();
