const state = {
  albums: [],
  activeFilter: 'all',
  search: ''
};

const albumGrid = document.querySelector('#albumGrid');
const featuredPanel = document.querySelector('#featuredPanel');
const emptyState = document.querySelector('#emptyState');
const resultCount = document.querySelector('#resultCount');
const searchInput = document.querySelector('#searchInput');
const uploadDialog = document.querySelector('#uploadDialog');
const uploadHelpButton = document.querySelector('#uploadHelpButton');
const closeUploadDialog = document.querySelector('#closeUploadDialog');

const imageTypes = ['image'];
const videoTypes = ['video'];

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

function albumKind(album) {
  if (album.videoCount && album.imageCount) return 'mixed';
  if (album.videoCount) return 'videos';
  if (album.imageCount) return 'photos';
  return 'albums';
}

function matchesFilter(album) {
  const kind = albumKind(album);
  if (state.activeFilter === 'all') return true;
  if (state.activeFilter === 'albums') return true;
  return kind === state.activeFilter;
}

function matchesSearch(album) {
  const query = state.search.trim().toLowerCase();
  if (!query) return true;
  return [album.title, album.slug, album.description].join(' ').toLowerCase().includes(query);
}

function getFilteredAlbums() {
  return state.albums.filter(album => matchesFilter(album) && matchesSearch(album));
}

function mediaElement(file, extraClass = '') {
  if (!file) return '<div></div>';
  const label = text(file.name || 'media');
  if (file.type === 'video') {
    return `<video class="${extraClass}" src="${file.url}" muted playsinline preload="metadata" aria-label="${label}"></video>`;
  }
  return `<img class="${extraClass}" src="${file.url}" alt="${label}" loading="lazy">`;
}

function renderPreview(album) {
  const previews = album.preview && album.preview.length ? album.preview : album.files.slice(0, 4);
  const first = previews[0] || album.files[0];
  const hasVideo = album.files.some(file => file.type === 'video');

  if (!first) {
    return `<div class="preview-stack one"><div class="play-dot">+</div></div>`;
  }

  if (previews.length === 1) {
    return `<div class="preview-stack one">${mediaElement(first)}${hasVideo ? '<span class="play-dot">▶</span>' : ''}</div>`;
  }

  return `
    <div class="preview-stack">
      ${mediaElement(first)}
      <div class="mini-stack">
        ${mediaElement(previews[1] || first)}
        ${mediaElement(previews[2] || previews[1] || first)}
      </div>
      ${hasVideo ? '<span class="play-dot">▶</span>' : ''}
    </div>
  `;
}

function renderFeatured(album) {
  if (!album) {
    featuredPanel.innerHTML = '';
    return;
  }

  const cover = album.cover || album.files[0];
  featuredPanel.innerHTML = `
    <article class="featured-card">
      <a class="featured-media" href="album.html?album=${encodeURIComponent(album.slug)}" aria-label="Open ${text(album.title)}">
        ${mediaElement(cover)}
      </a>
      <div class="featured-info">
        <div class="meta-row">
          <span class="meta-chip hot">Newest</span>
          <span class="meta-chip">${album.totalCount} items</span>
          <span class="meta-chip">${formatDate(album.updatedAt)}</span>
        </div>
        <h2>${text(album.title)}</h2>
        <p>${text(album.description || 'Open this album to view every photo and video inside the folder.')}</p>
        <a class="open-album" href="album.html?album=${encodeURIComponent(album.slug)}">Open Album</a>
      </div>
    </article>
  `;
}

function renderAlbumCard(album) {
  const kind = albumKind(album);
  return `
    <a class="album-card" href="album.html?album=${encodeURIComponent(album.slug)}" aria-label="Open ${text(album.title)}">
      ${renderPreview(album)}
      <div class="album-body">
        <span class="album-kind">${kind}</span>
        <h3>${text(album.title)}</h3>
        <p>${album.totalCount} items · ${formatDate(album.updatedAt)}</p>
      </div>
      <span class="card-menu">⋮</span>
    </a>
  `;
}

function renderCounts(albums) {
  const totals = albums.reduce((sum, album) => {
    sum.albums += 1;
    sum.photos += album.imageCount || 0;
    sum.videos += album.videoCount || 0;
    return sum;
  }, { albums: 0, photos: 0, videos: 0 });

  document.querySelector('#albumCount').textContent = totals.albums;
  document.querySelector('#photoCount').textContent = totals.photos;
  document.querySelector('#videoCount').textContent = totals.videos;
}

function render() {
  const albums = getFilteredAlbums();
  renderFeatured(albums[0] || state.albums[0]);
  renderCounts(state.albums);

  resultCount.textContent = albums.length === 1 ? '1 album' : `${albums.length} albums`;
  albumGrid.innerHTML = albums.map(renderAlbumCard).join('');
  emptyState.hidden = albums.length > 0;
}

function setFilter(filter) {
  state.activeFilter = filter;
  document.querySelectorAll('[data-filter], [data-side-filter]').forEach(button => {
    const value = button.dataset.filter || button.dataset.sideFilter;
    button.classList.toggle('active', value === filter || (filter === 'all' && value === 'all'));
  });
  render();
}

async function loadFeed() {
  try {
    const response = await fetch('data/feed.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Feed file not found');
    const data = await response.json();
    state.albums = Array.isArray(data.albums) ? data.albums : [];
    render();
  } catch (error) {
    console.error(error);
    state.albums = [];
    render();
  }
}

document.querySelectorAll('[data-filter]').forEach(button => {
  button.addEventListener('click', () => setFilter(button.dataset.filter));
});

document.querySelectorAll('[data-side-filter]').forEach(button => {
  button.addEventListener('click', () => setFilter(button.dataset.sideFilter));
});

if (searchInput) {
  searchInput.addEventListener('input', event => {
    state.search = event.target.value;
    render();
  });
}

if (uploadHelpButton && uploadDialog) {
  uploadHelpButton.addEventListener('click', () => uploadDialog.showModal());
}

if (closeUploadDialog && uploadDialog) {
  closeUploadDialog.addEventListener('click', () => uploadDialog.close());
}

loadFeed();
