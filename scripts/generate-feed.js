/*
  123Kasi feed generator
  ----------------------
  Scans /feed folders and writes /data/feed.json.
  Each folder becomes one album. Supported media files become album items.
*/

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = process.cwd();
const feedDir = path.join(root, 'feed');
const dataDir = path.join(root, 'data');
const outputFile = path.join(dataDir, 'feed.json');

const supportedImages = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg']);
const supportedVideos = new Set(['.mp4', '.webm', '.mov', '.m4v']);

function ensureDirectory(directory) {
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
}

function toUrl(filePath) {
  return filePath.split(path.sep).map(encodeURIComponent).join('/');
}

function titleFromSlug(slug) {
  return slug
    .replace(/^[0-9]{4}-[0-9]{2}-[0-9]{2}[-_ ]*/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, letter => letter.toUpperCase()) || slug;
}

function getMediaType(filename) {
  const extension = path.extname(filename).toLowerCase();
  if (supportedImages.has(extension)) return 'image';
  if (supportedVideos.has(extension)) return 'video';
  return null;
}

function getGitDate(relativePath) {
  try {
    const command = `git log -1 --format=%cI -- "${relativePath.replace(/"/g, '\\"')}"`;
    const result = execSync(command, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return result || null;
  } catch (_) {
    return null;
  }
}

function getTimestamp(fullPath, relativePath) {
  const gitDate = getGitDate(relativePath);
  if (gitDate) return gitDate;
  const stats = fs.statSync(fullPath);
  return stats.mtime.toISOString();
}

function scanAlbum(folderName) {
  const albumPath = path.join(feedDir, folderName);
  const stats = fs.statSync(albumPath);
  if (!stats.isDirectory()) return null;
  if (folderName.startsWith('.') || folderName.startsWith('_')) return null;

  const entries = fs.readdirSync(albumPath, { withFileTypes: true });
  const files = entries
    .filter(entry => entry.isFile())
    .map(entry => {
      const type = getMediaType(entry.name);
      if (!type) return null;

      const fullPath = path.join(albumPath, entry.name);
      const relativePath = path.relative(root, fullPath);
      const fileStats = fs.statSync(fullPath);
      const modifiedAt = getTimestamp(fullPath, relativePath);

      return {
        name: entry.name,
        type,
        url: toUrl(relativePath),
        path: relativePath,
        size: fileStats.size,
        modifiedAt
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const dateDiff = new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime();
      return dateDiff || a.name.localeCompare(b.name);
    });

  if (!files.length) return null;

  const imageCount = files.filter(file => file.type === 'image').length;
  const videoCount = files.filter(file => file.type === 'video').length;
  const dates = files.map(file => new Date(file.modifiedAt).getTime()).filter(Boolean);
  const newest = dates.length ? new Date(Math.max(...dates)).toISOString() : stats.mtime.toISOString();
  const oldest = dates.length ? new Date(Math.min(...dates)).toISOString() : stats.birthtime.toISOString();
  const cover = files.find(file => file.type === 'image') || files[0];

  return {
    slug: folderName,
    title: titleFromSlug(folderName),
    description: `${imageCount} photos and ${videoCount} videos from this 123Kasi album.`,
    folder: `feed/${folderName}`,
    imageCount,
    videoCount,
    totalCount: files.length,
    cover,
    preview: files.slice(0, 4),
    createdAt: oldest,
    updatedAt: newest,
    files
  };
}

function buildFeed() {
  ensureDirectory(feedDir);
  ensureDirectory(dataDir);

  const albums = fs.readdirSync(feedDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => scanAlbum(entry.name))
    .filter(Boolean)
    .sort((a, b) => {
      const dateDiff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      return dateDiff || a.title.localeCompare(b.title);
    });

  const totals = albums.reduce((sum, album) => {
    sum.albums += 1;
    sum.images += album.imageCount;
    sum.videos += album.videoCount;
    sum.items += album.totalCount;
    return sum;
  }, { albums: 0, images: 0, videos: 0, items: 0 });

  const feed = {
    site: '123Kasi',
    generatedAt: new Date().toISOString(),
    totals,
    albums
  };

  fs.writeFileSync(outputFile, `${JSON.stringify(feed, null, 2)}\n`);
  console.log(`Generated ${path.relative(root, outputFile)} with ${albums.length} album(s).`);
}

buildFeed();
