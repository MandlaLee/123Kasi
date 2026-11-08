/* Lightweight reveal behaviour for the media grids. */
(() => {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (preference.matches || !('IntersectionObserver' in window) || !('MutationObserver' in window)) return;

  const grid = document.querySelector('#mediaGrid');
  if (!grid) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      target.classList.add('is-visible');
      observer.unobserve(target);
    });
  }, { threshold: 0.06, rootMargin: '0px 0px 45px 0px' });

  function observeNew() {
    grid.querySelectorAll('.media-card:not(.is-visible):not(.motion-observed), .media-tile:not(.is-visible):not(.motion-observed)').forEach((card, index) => {
      card.classList.add('motion-observed');
      card.style.setProperty('--reveal-delay', Math.min(index % 5, 4) * 30 + 'ms');
      observer.observe(card);
    });
  }

  document.documentElement.classList.add('motion-ready');
  new MutationObserver(observeNew).observe(grid, { childList: true });
  observeNew();

  preference.addEventListener?.('change', event => {
    if (!event.matches) return;
    document.documentElement.classList.remove('motion-ready');
    observer.disconnect();
  });
})();
