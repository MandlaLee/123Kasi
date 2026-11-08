/* 123Kasi Reels: a shuffled, no-repeat cycle of all photos and videos. */
'use strict';

const reelsPlayer = document.querySelector('#reelsPlayer');
const reelsStage = document.querySelector('#reelsStage');
const reelsCounter = document.querySelector('#reelsCounter');
const mediaKind = document.querySelector('#mediaKind');
const modelLink = document.querySelector('#modelLink');
const reelsDescription = document.querySelector('#reelsDescription');
const progressTrack = document.querySelector('#progressTrack');
const progressFill = document.querySelector('#progressFill');
const reelsMessage = document.querySelector('#reelsMessage');
const prevButton = document.querySelector('#previousReel');
const nextButton = document.querySelector('#nextReel');
const pauseButton = document.querySelector('#pauseReel');
const muteButton = document.querySelector('#muteReel');
const fullscreenButton = document.querySelector('#fullscreenReel');

const PHOTO_DURATION_MS = 6500;
const reelsState = {
  library: [],
  order: [],
  position: 0,
  round: 0,
  lastPlayedId: null,
  paused: false,
  muted: true,
  photoElapsedMs: 0,
  photoTimer: null,
  lastTick: 0,
  currentMedia: null,
  lastGesture: 0
};

function setProgress(value) {
  const amount = Math.max(0, Math.min(100, Number(value) || 0));
  progressFill.style.width = amount + '%';
  progressTrack.setAttribute('aria-valuenow', String(Math.round(amount)));
}

function setMessage(message) {
  reelsMessage.textContent = message || '';
  reelsMessage.hidden = !message;
}

function validMediaURL(value) {
  if (typeof value !== 'string') return null;
  try {
    const resource = new URL(value, location.href);
    const mediaFolder = new URL('feed/', location.href);
    if (resource.origin !== mediaFolder.origin || !resource.pathname.startsWith(mediaFolder.pathname)) return null;
    return resource.href;
  } catch (_) {
    return null;
  }
}

function shuffleNewRound() {
  const order = Array.from({length: reelsState.library.length}, (_, index) => index);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  // The last reel of the previous round cannot be the first of the next.
  if (order.length > 1 && order[0] === reelsState.lastPlayedId) {
    [order[0], order[1]] = [order[1], order[0]];
  }
  reelsState.order = order;
  reelsState.position = 0;
  reelsState.round++;
}

function stopCurrent() {
  if (reelsState.photoTimer !== null) {
    clearInterval(reelsState.photoTimer);
    reelsState.photoTimer = null;
  }
  if (reelsState.currentMedia?.tagName === 'VIDEO') reelsState.currentMedia.pause();
  reelsState.currentMedia = null;
  reelsState.photoElapsedMs = 0;
  reelsState.lastTick = 0;
}

function paintButtons() {
  const video = reelsState.currentMedia?.tagName === 'VIDEO';
  prevButton.disabled = reelsState.position === 0;
  pauseButton.textContent = reelsState.paused ? '▶' : 'Ⅱ';
  pauseButton.setAttribute('aria-label', reelsState.paused ? 'Resume automatic playback' : 'Pause automatic playback');
  pauseButton.title = reelsState.paused ? 'Resume' : 'Pause';
  muteButton.textContent = reelsState.muted ? '🔇' : '🔊';
  muteButton.setAttribute('aria-label', reelsState.muted ? 'Unmute video' : 'Mute video');
  muteButton.disabled = !video;
  muteButton.title = reelsState.muted ? 'Unmute' : 'Mute';
}

function startPhotoClock() {
  if (reelsState.photoTimer !== null || reelsState.paused || document.hidden) return;
  reelsState.lastTick = Date.now();
  reelsState.photoTimer = setInterval(() => {
    const now = Date.now();
    if (document.hidden || reelsState.paused) {
      reelsState.lastTick = now;
      return;
    }
    reelsState.photoElapsedMs += Math.min(now - reelsState.lastTick, 1000);
    reelsState.lastTick = now;
    setProgress((reelsState.photoElapsedMs / PHOTO_DURATION_MS) * 100);
    if (reelsState.photoElapsedMs >= PHOTO_DURATION_MS) nextReel();
  }, 100);
}

function resumePlayback() {
  const media = reelsState.currentMedia;
  if (!media || reelsState.paused || document.hidden) return;
  if (media.tagName === 'VIDEO') {
    media.play().catch(() => {
      if (media !== reelsState.currentMedia) return;
      reelsState.paused = true;
      paintButtons();
      setMessage('Tap play to start this video.');
    });
  } else {
    startPhotoClock();
  }
}

function renderReel() {
  stopCurrent();
  setMessage('');
  setProgress(0);

  if (!reelsState.order.length) {
    reelsCounter.textContent = 'No reels available';
    reelsStage.textContent = '';
    setMessage('No photos or videos have been published yet.');
    return;
  }

  const entry = reelsState.library[reelsState.order[reelsState.position]];
  const file = entry.file;
  const url = validMediaURL(file.url);
  reelsCounter.textContent = (reelsState.position + 1) + ' / ' + reelsState.order.length + ' · Round ' + reelsState.round;
  modelLink.textContent = entry.album.title || entry.album.slug;
  modelLink.href = 'album.html?album=' + encodeURIComponent(entry.album.slug);
  mediaKind.textContent = file.type === 'video' ? 'VIDEO' : 'PHOTO';
  reelsDescription.textContent = (entry.index + 1) + ' of ' + entry.album.files.length + ' posts by this model';

  if (!url) {
    reelsStage.textContent = '';
    setMessage('This file has an invalid media address. Moving on…');
    setTimeout(() => { if (reelsState.order[reelsState.position] === entry.id && !reelsState.paused) nextReel(); }, 2500);
    return;
  }

  let media;
  if (file.type === 'video') {
    media = document.createElement('video');
    media.playsInline = true;
    media.autoplay = false;
    media.controls = false;
    media.loop = false;
    media.muted = reelsState.muted;
    media.preload = 'metadata';
    media.setAttribute('aria-label', 'Video by ' + (entry.album.title || entry.album.slug));
    media.addEventListener('timeupdate', () => {
      if (Number.isFinite(media.duration) && media.duration > 0) setProgress((media.currentTime / media.duration) * 100);
    });
    media.addEventListener('ended', () => {
      if (media === reelsState.currentMedia && !reelsState.paused) nextReel();
    });
    media.addEventListener('error', () => {
      if (media === reelsState.currentMedia) {
        reelsState.paused = true;
        paintButtons();
        setMessage('Video cannot be played. Swipe or press Next to continue.');
      }
    });
  } else {
    media = document.createElement('img');
    media.alt = 'Photo by ' + (entry.album.title || entry.album.slug);
    media.decoding = 'async';
    media.addEventListener('error', () => {
      if (media === reelsState.currentMedia) setMessage('Image unavailable. Swipe or press Next to continue.');
    });
  }
  reelsStage.replaceChildren(media);
  reelsState.currentMedia = media;
  media.src = url;
  paintButtons();
  resumePlayback();
}

function nextReel() {
  if (!reelsState.order.length) return;
  const current = reelsState.order[reelsState.position];
  reelsState.lastPlayedId = current;
  if (reelsState.position < reelsState.order.length - 1) {
    reelsState.position++;
  } else {
    shuffleNewRound();
  }
  renderReel();
}

function previousReel() {
  if (reelsState.position < 1) return;
  reelsState.position--;
  renderReel();
}

function togglePause() {
  if (!reelsState.currentMedia) return;
  reelsState.paused = !reelsState.paused;
  if (reelsState.paused) {
    reelsState.currentMedia?.pause?.();
    if (reelsState.photoTimer !== null) {
      clearInterval(reelsState.photoTimer);
      reelsState.photoTimer = null;
    }
  } else {
    setMessage('');
    resumePlayback();
  }
  paintButtons();
}

function toggleMute() {
  reelsState.muted = !reelsState.muted;
  if (reelsState.currentMedia?.tagName === 'VIDEO') reelsState.currentMedia.muted = reelsState.muted;
  paintButtons();
}

function moveByGesture(delta) {
  const now = Date.now();
  if (now - reelsState.lastGesture < 460) return;
  reelsState.lastGesture = now;
  if (delta > 0) nextReel();
  else previousReel();
}

prevButton.addEventListener('click', previousReel);
nextButton.addEventListener('click', nextReel);
pauseButton.addEventListener('click', togglePause);
muteButton.addEventListener('click', toggleMute);
fullscreenButton.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (reelsPlayer.requestFullscreen) await reelsPlayer.requestFullscreen();
    else if (reelsState.currentMedia?.webkitEnterFullscreen) reelsState.currentMedia.webkitEnterFullscreen();
  } catch (_) { setMessage('Fullscreen is not supported on this device.'); }
});
reelsStage.addEventListener('click', togglePause);
reelsPlayer.addEventListener('wheel', event => {
  if (Math.abs(event.deltaY) < 10) return;
  event.preventDefault();
  moveByGesture(event.deltaY);
}, { passive: false });

let touchStartY = null;
reelsPlayer.addEventListener('touchstart', event => {
  touchStartY = event.touches.length === 1 ? event.touches[0].clientY : null;
}, { passive: true });
reelsPlayer.addEventListener('touchend', event => {
  if (touchStartY === null || !event.changedTouches.length) return;
  const delta = touchStartY - event.changedTouches[0].clientY;
  touchStartY = null;
  if (Math.abs(delta) > 45) moveByGesture(delta);
}, { passive: true });

document.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
    event.preventDefault();
    nextReel();
  } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
    event.preventDefault();
    previousReel();
  } else if (event.code === 'Space' && tag !== 'BUTTON' && tag !== 'A') {
    event.preventDefault();
    togglePause();
  } else if (event.key.toLowerCase() === 'm' && tag !== 'BUTTON' && tag !== 'A') {
    toggleMute();
  }
});

document.addEventListener('visibilitychange', () => {
  reelsState.lastTick = Date.now();
  if (document.hidden) {
    reelsState.currentMedia?.pause?.();
  } else {
    resumePlayback();
  }
});

async function loadReels() {
  try {
    const response = await fetch('data/feed.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load media library');
    const data = await response.json();
    const seen = new Set();
    const library = [];
    for (const album of Array.isArray(data.albums) ? data.albums : []) {
      for (const [index, file] of (album.files || []).entries()) {
        if (!['image', 'video'].includes(file.type) || !validMediaURL(file.url)) continue;
        const id = album.slug + '::' + file.url;
        if (seen.has(id)) continue;
        seen.add(id);
        library.push({ id: library.length, album, file, index });
      }
    }
    reelsState.library = library;
    if (!library.length) {
      setMessage('There are no valid photos or videos to show yet.');
      reelsCounter.textContent = 'No reels available';
      return;
    }
    shuffleNewRound();
    renderReel();
  } catch (error) {
    console.error(error);
    reelsCounter.textContent = 'Reels unavailable';
    setMessage('Reels could not load. Check your connection and refresh this page.');
  }
}

loadReels();
