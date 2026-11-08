# Finish the embedded 123Kasi sign-in modal

**Status:** The new 123Kasi modal has been committed to GitHub Pages. The Google Apps Script project is owned by your Google account, so its code must be updated and deployed there separately. Until this is done, the modal may show a loading message or Google's frame-blocking response.

**Your spreadsheet is already initialized.** Do not rerun setup, delete the sheet, or create a new deployment.

## 1. Update Code.gs

1. Open your existing **123Kasi Accounts** project at https://script.google.com/home/projects
2. Click **Code.gs**.
3. Find the current `function doGet()` block. Replace just that one function with the following:

```javascript
function doGet(e) {
  const embedded = !!(e && e.parameter && e.parameter.embed === '1');
  const template = HtmlService.createTemplateFromFile('Login');
  template.isEmbedded = embedded;
  template.embedNonce = embedded && /^[a-f0-9]{32}$/.test(String(e.parameter.nonce || ''))
    ? String(e.parameter.nonce)
    : '';
  const html = template.evaluate()
    .setTitle('123Kasi — Sign in')
    .addMetaTag('viewport', 'width=device-width,initial-scale=1');
  if (embedded) html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return html;
}
```

The complete, current version is here: **[auth/Code.gs](https://github.com/MandlaLee/123Kasi/blob/main/auth/Code.gs)**.

## 2. Update Login.html

1. In the same Apps Script project, click **Login.html** in the Files panel.
2. Open **[the updated Login.html source](https://raw.githubusercontent.com/MandlaLee/123Kasi/main/auth/Login.html)**.
3. Copy its **complete contents** and replace the existing Login.html code in Apps Script.
4. Save your work (`Cmd + S`).

Why this matters: the new Login.html has a small embedded-mode design and a challenge handshake. It keeps the password fields hidden until the request is confirmed as coming from 123Kasi. The form still uses `google.script.run`, so the credentials never pass through GitHub Pages.

## 3. Redeploy the SAME Apps Script web app

1. Click **Deploy** in the top right.
2. Choose **Manage deployments**.
3. Find your existing Web app, click the **pencil / Edit** button.
4. For **Version**, choose **New version**.
5. Click **Deploy**. Approve any permission requests.

**Do not select New deployment.** Updating the existing deployment preserves its URL:

https://script.google.com/macros/s/AKfycbx9YuMIsln_RxGy3EKkyxLU5lJCpjJq-28LOx1zLykP1gb9mapPJ9PrYNnLwOrXhJ7W_A/exec

## 4. Test

- Open https://mandlalee.github.io/123Kasi/ and click **Sign in**.
- The page should dim and a white 123Kasi dialog should appear on top.
- The embedded Google Apps Script form should appear inside it, with Sign in / Create account tabs.
- Close the dialog with X or Escape. The original page and selected content remain in place.
- Test sign-in and registration using your own account. Do **not** share your password or verification code.

If Google still blocks the iframe on your browser or the deployed version is stale, the dialog shows a fallback link for secure full-page login. Recent Google Apps Script iframe behavior has sometimes varied by browser and platform rollout.

## Security

The embedded route uses `XFrameOptionsMode.ALLOWALL`, which on its own allows embedding by any website. The supplied login UI keeps credentials hidden until it receives a matching challenge acknowledgment from the **https://mandlalee.github.io** origin. It is still a small-scale Apps Script authentication implementation, not a replacement for a professional identity provider. Keep the Sheets database private.
