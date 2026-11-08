# 123Kasi Accounts — Google Apps Script + Google Sheets

This folder is a **deployable Google Apps Script account portal**, not a deployed service. It does not require Firebase.

**Important:** Never store readable passwords in Google Sheets. This implementation stores bcrypt hashes (cost factor 12), not passwords themselves. Only hashed session tokens and hashed email verification codes are stored. The private Sheet is created when the project owner authorizes setup.

## Files

| File | What it does |
| --- | --- |
| `Code.gs` | Apps Script server: registration, email verification, login, sessions, password reset |
| `Bcrypt.gs` | Pinned, bundled bcryptjs 3.0.3 implementation |
| `BCRYPT-LICENSE.txt` | BSD-3-Clause vendor license |
| `Login.html` | Sign in, create-account, verification and reset interfaces |
| `test-auth.js` | Offline smoke tests using simulated Sheets and Mail |

## Install (requires the Google account that will own 123Kasi)

1. Open **https://script.google.com/home/projects/create** and name the project **123Kasi Accounts**.
2. Replace the default `Code.gs` with the contents of **`auth/Code.gs`** in this repository.
3. Add another **Script** file named **Bcrypt** and paste the contents of **`auth/Bcrypt.gs`**.
4. Add an **HTML** file named **Login** and paste the contents of **`auth/Login.html`**.
5. Save. In the Apps Script editor, run **`initialize123Kasi_` once** as the owner. Approve the requested Sheets and email permissions. Review **Execution log** for the private spreadsheet URL. **Do not share this spreadsheet publicly.** If the editor does not offer private functions in the run dropdown, temporarily create a new function that calls `initialize123Kasi_()`, run it, and **delete that wrapper before deployment**.
6. Confirm the spreadsheet contains three tabs:
   - **Users:** `userId`, `displayName`, `email`, `passwordHash`, `verified`, `createdAt`, `updatedAt`, `failedAttempts`, `lockUntil`
   - **Verification:** short-lived **hashed** email codes
   - **Sessions:** **hashed** session tokens, expiry and revocation status
7. Select **Deploy → New deployment → Web app**, set **Execute as: Me** and access to **Anyone** so public visitors can request a login. Google will ask the script owner to authorize. Copy the deployed `https://script.google.com/macros/s/.../exec` URL.
8. Test on the deployed portal: create a **test account using your own email**, receive the code, verify email, sign in, sign out and test password reset. Confirm the `passwordHash` cell begins with `$2b$12$` and does not contain the test password.
9. Share the **deployed web app URL only** so it can be added to the 123Kasi top navigation. Never share the private spreadsheet, password hashes, credentials, or Google authorization tokens.

## How it connects to GitHub Pages

Google Apps Script HTML Service hosts the credential entry and server calls on Google's own origin using `google.script.run`. **Do not put a form that sends raw passwords directly from GitHub Pages to an Apps Script JSONP/GET endpoint**; browser CORS restrictions and URL logging make this unsafe.

Initially, sign in opens the Apps Script-hosted account portal. This first release **does not make content on GitHub Pages private** or authorize likes, follows, uploads or paid subscriptions. Any privileged action added later must validate the login session on the server for each request; a local browser flag is not proof of authentication. The portal stores a session token only in its own session storage while signed in.

## Security and operational limits

- Passwords: minimum 12 UTF-8 bytes and maximum 72 bytes, bcrypt cost 12.
- Login: account-specific lockout after five failures, plus request throttling.
- Email: six-digit codes expire after 10 minutes, are stored as HMAC digests, and allow at most five incorrect attempts.
- Sessions: unguessable tokens, only HMAC digests in Sheets; default expiry 7 days, manual sign-out and password reset revoke sessions.
- Passwords, verification codes and session tokens must **not** be written to logs, GitHub, URLs, client analytics or plain spreadsheet columns.
- Apps Script/Sheets is appropriate only for a **small MVP**. Do not market this as production-grade large-scale authentication. Add abuse monitoring, CAPTCHA or stronger automated-registration defenses, privacy policies and a moderation system before opening public registration.
- Apps Script email quotas and script execution limits apply. Google permissions, deployment settings and exact quotas can change.

## Development test

From repository root with Node.js:

```bash
node auth/test-auth.js
```

This runs a complete account lifecycle against a **mock Sheet and mock MailApp**. It does not authorize or deploy the live Google service.

### Third-party license

`Bcrypt.gs` bundles bcryptjs 3.0.3, Copyright © dcodeIO and contributors, BSD-3-Clause. The complete license is in `BCRYPT-LICENSE.txt`.
