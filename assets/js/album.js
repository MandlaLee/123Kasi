const albumHero = document.querySelector('#albumHero');
const mediaGrid = document.querySelector('#mediaGrid');
const mediaDialog = document.querySelector('#mediaDialog');
const mediaViewer = document.querySelector('#mediaViewer');
const closeMediaDialog = document.querySelector('#closeMediaDialog');

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
    return `<video src="${file.url}" ${controls} ${autoplay} muted playsinline preload="metadata" aria-label="${label}"></video>`;
  }
  return `<img src="${file.url}" alt="${label}" loading="lazy">`;
}

function renderAlbum(album) {
  const cover = album.cover || album.files[0];
  albumHero.innerHTML = `
    <div class="album-hero-inner">
      <div class="album-cover">${cover ? mediaElement(cover) : ''}</div>
      <div class="album-details">
        <div class="meta-row">
          <span class="meta-chip hot">Album</span>
          <span class="meta-chip">${album.totalCount} items</span>
          <span class="meta-chip">${formatDate(album.updatedAt)}</span>
        </div>
        <h1>${text(album.title)}</h1>
        <p>${text(album.description || 'Every photo and video on this page comes from the matching folder inside the feed directory.')}</p>
        <a class="open-album" href="index.html">Back to latest</a>
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
      const file = album.files[Number(tile.dataset.index)];
      mediaViewer.innerHTML = mediaElement(file, { controls: true, autoplay: file.type === 'video' });
      mediaDialog.showModal();
    });
  });
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

if (closeMediaDialog) {
  closeMediaDialog.addEventListener('click', () => {
    mediaDialog.close();
    mediaViewer.innerHTML = '';
  });
}

if (mediaDialog) {
  mediaDialog.addEventListener('close', () => {
    mediaViewer.innerHTML = '';
  });
}

loadAlbum();
