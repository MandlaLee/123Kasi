/* Keep the 123Kasi page in place while opening Google-hosted account forms
   in a compact browser popup. No credentials are collected by GitHub Pages.
   Apps Script currently rejects cross-origin iframe embedding. */
(() => {
  'use strict';

  const links = [...document.querySelectorAll('.account-link, .reels-signin')];
  if (!links.length) return;

  const dialog = document.createElement('dialog');
  dialog.className = 'account-popup-fallback';
  dialog.setAttribute('aria-labelledby', 'accountPopupTitle');
  dialog.innerHTML = [
    '<div class="account-popup-content">',
    '  <button class="account-popup-close" type="button" aria-label="Close">×</button>',
    '  <h2 id="accountPopupTitle">Sign in to 123Kasi</h2>',
    '  <p>Your browser blocked the secure sign-in popup. Allow popups for 123Kasi, or open the account page in a separate tab.</p>',
    '  <a class="account-popup-continue" target="_blank" rel="noopener noreferrer">Open secure sign in / sign up</a>',
    '</div>'
  ].join('');
  document.body.append(dialog);

  const closeButton = dialog.querySelector('.account-popup-close');
  const alternate = dialog.querySelector('.account-popup-continue');
  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });

  function openAccount(url) {
    // Blank first so we can explicitly remove the opener before navigating
    // to the authentication page. This avoids giving the cross-origin page
    // access to the original browsing context.
    const width = Math.min(470, screen.availWidth || 470);
    const height = Math.min(800, screen.availHeight || 800);
    const left = Math.max(0, Math.round((screen.availWidth - width) / 2));
    const top = Math.max(0, Math.round((screen.availHeight - height) / 2));
    const features = `popup=yes,width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`;

    let popup;
    try {
      popup = window.open('about:blank', '123KasiAccount', features);
    } catch (_) {
      popup = null;
    }

    if (!popup) {
      alternate.href = url;
      if (!dialog.open) dialog.showModal();
      return;
    }

    try {
      popup.opener = null;
      popup.location.replace(url);
      popup.focus();
    } catch (_) {
      // Some browsers restrict named windows. In that case, let the user
      // choose the secure link rather than unexpectedly redirecting the site.
      try { popup.close(); } catch (_) {}
      alternate.href = url;
      if (!dialog.open) dialog.showModal();
    }
  }

  links.forEach(link => {
    link.setAttribute('aria-haspopup', 'dialog');
    link.title = 'Sign in or create an account (opens a secure popup)';
    link.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openAccount(link.href);
    });
  });
})();
