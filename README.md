# 123Kasi

A GitHub Pages-ready media discovery site for albums, photos, and videos.

## What this does

123Kasi scans the `feed/` folder and turns every folder inside it into an album.

Example:

```text
feed/
  kasi-night-sessions/
    photo-01.jpg
    photo-02.png
    clip-01.mp4

  weekend-streets/
    image-01.jpg
    image-02.webp
```

The scanner creates this file:

```text
data/feed.json
```

The website reads `data/feed.json` and displays the homepage feed from newest to oldest.

## Important GitHub Pages note

GitHub Pages is good for an MVP where you are the uploader.

It is not a full public upload platform. If visitors must upload from the website, you will need a backend, authentication, storage, moderation, and reporting.

## Supported media

Images:

```text
.jpg .jpeg .png .gif .webp .avif .svg
```

Videos:

```text
.mp4 .webm .mov .m4v
```

For best GitHub Pages performance, keep videos small. Later, move serious video hosting to Cloudinary, Bunny, Cloudflare R2, Backblaze B2, or similar.

## How to add a new album

1. Create a new folder inside `feed/`.
2. Put your images and videos inside that folder.
3. Push to GitHub.
4. GitHub Actions runs `scripts/generate-feed.js`.
5. The homepage updates automatically.

## Run locally

From the project folder:

```bash
node scripts/generate-feed.js
```

Then open `index.html` in a browser, or use a simple local server:

```bash
python3 -m http.server 8080
```

Then visit:

```text
http://localhost:8080
```

## GitHub Pages setup

1. Upload this folder to a GitHub repo.
2. Go to repo Settings.
3. Open Pages.
4. Source: Deploy from branch.
5. Branch: `main`.
6. Folder: `/root`.
7. Save.

Your site will appear at:

```text
https://YOURUSERNAME.github.io/REPOSITORY-NAME/
```

## Safety and content ownership

Only upload content you own or have permission to publish. If 123Kasi later allows public uploads, add consent checks, takedown reporting, moderation, account controls, and legal policies before launch.
