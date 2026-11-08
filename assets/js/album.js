const albumHero = document.querySelector('#albumHero');
const mediaGrid = document.querySelector('#mediaGrid');
const mediaDialog = document.querySelector('#mediaDialog');
const mediaViewer = document.querySelector('#mediaViewer');
const closeMediaDialog = document.querySelector('#closeMediaDialog');
const prevMedia = document.querySelector('#prevMedia');
const nextMedia = document.querySelector('#nextMedia');
const viewerCaption = document.querySelector('#viewerCaption');
let currentAlbum = null;
let currentIndex = -1;

function showMedia(album, index, updateUrl = true) {
  if (!album || !album.files || index < 0 || index >= album.files.length) return;
  currentAlbum = album;
  currentIndex = index;
  const file = album.files[index];
  mediaViewer.innerHTML = mediaElement(file, { controls: true });
  const label = file.type === 'video' ? 'Video' : 'Photo';
  if (viewerCaption) viewerCaption.textContent = album.title + ' · ' + label + ' ' + (index + 1) + ' of ' + album.files.length;
  if (prevMedia) prevMedia.disabled = index === 0;
  if (nextMedia) nextMedia.disabled = index === album.files.length - 1;
  if (!mediaDialog.open) mediaDialog.showModal();
  if (updateUrl) {
    const url = new URL(location.href);
    url.searchParams.set('media', String(index));
    history.replaceState(null, '', url);
  }
}

function navigateMedia(delta) {
  if (currentAlbum) showMedia(currentAlbum, currentIndex + delta);
}


function text(value = '') {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[character]));
}

function formatDate(value) {
  if (!value) return 'Recently uploaded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently uploaded';
  return new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function mediaElement(file, options = {}) {
  const label = text(file.name || 'media');
  if (file.type === 'video') {
    const controls = options.controls ? 'controls' : '';
    const autoplay = options.autoplay ? 'autoplay' : '';
    const muted = options.controls ? '' : 'muted';
    return `<video src="${text(file.url)}" ${controls} ${autoplay} ${muted} playsinline preload="metadata" aria-label="${label}"></video>`;
  }
  return `<img src="${text(file.url)}" alt="${label}" loading="lazy">`;
}

function renderAlbum(album) {
  const cover = album.cover || album.files[0];
  albumHero.innerHTML = `
    <div class="album-hero-inner">
      <div class="album-cover">${cover ? mediaElement(cover) : ''}</div>
      <div class="album-details">
        <div class="meta-row">
          <span class="meta-chip hot">Model</span>
          <span class="meta-chip">${album.totalCount} items</span>
          <span class="meta-chip">${formatDate(album.updatedAt)}</span>
        </div>
        <h1>${text(album.title)}</h1>
        <p>${text((album.imageCount || 0) + ' photos · ' + (album.videoCount || 0) + ' videos')}</p>
        <a class="open-album" href="index.html">← Back to feed</a>
      </div>
    </div>
  `;

  mediaGrid.innerHTML = album.files.map((file, index) => `
    <button class="media-tile" type="button" data-index="${index}" aria-label="Open ${text(file.name)}">
      ${mediaElement(file)}
      <span class="media-label">${file.type}</span>
      ${file.type === 'video' ? '<span class="play-dot">▶</span>' : ''}
    </button>
  `).join('');

  mediaGrid.querySelectorAll('.media-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      showMedia(album, Number(tile.dataset.index));
    });
  });
  const selected = Number(new URLSearchParams(location.search).get('media'));
  if (new URLSearchParams(location.search).has('media') && Number.isInteger(selected) && selected >= 0 && selected < album.files.length) {
    showMedia(album, selected, false);
  }
}

function renderMissing() {
  albumHero.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">?</div>
      <h3>Album not found.</h3>
      <p>This album might have been removed or the feed index needs to be regenerated.</p>
      <a class="open-album" href="index.html">Return to feed</a>
    </div>
  `;
  mediaGrid.innerHTML = '';
}

async function loadAlbum() {
  const slug = new URLSearchParams(window.location.search).get('album');
  if (!slug) {
    renderMissing();
    return;
  }

  try {
    const response = await fetch('data/feed.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Feed file not found');
    const data = await response.json();
    const albums = Array.isArray(data.albums) ? data.albums : [];
    const album = albums.find(item => item.slug === slug);
    if (!album) return renderMissing();
    document.title = `123Kasi — ${album.title}`;
    renderAlbum(album);
  } catch (error) {
    console.error(error);
    renderMissing();
  }
}

if (closeMediaDialog) closeMediaDialog.addEventListener('click', () => mediaDialog.close());
if (prevMedia) prevMedia.addEventListener('click', () => navigateMedia(-1));
if (nextMedia) nextMedia.addEventListener('click', () => navigateMedia(1));


if (mediaDialog) {
  mediaDialog.addEventListener('click', event => {
    if (event.target === mediaDialog) mediaDialog.close();
  });
  mediaDialog.addEventListener('keydown', event => {
    if (event.target.tagName === 'VIDEO') return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); navigateMedia(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); navigateMedia(1); }
  });
  mediaDialog.addEventListener('close', () => {
    mediaViewer.innerHTML = '';
    currentAlbum = null;
    currentIndex = -1;
    const url = new URL(location.href);
    if (url.searchParams.has('media')) {
      url.searchParams.delete('media');
      history.replaceState(null, '', url);
    }
  });
}

loadAlbum();
