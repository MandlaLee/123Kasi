/**
 * 123Kasi account portal — Google Apps Script + private Google Sheets.
 *
 * Passwords are NEVER stored or logged. Users stores bcrypt password hashes.
 * Installation: see auth/README.md. The portal runs on Apps Script's own origin,
 * using google.script.run; do not send credentials to Github Pages or JSONP.
 *
 * Production note: Sheets + Apps Script is a low-volume MVP, not a large-scale
 * identity provider. Add CAPTCHA, abuse protection and monitoring before public
 * rollout.
 */

const APP_NAME = '123Kasi';
const SITE_URL = 'https://mandlalee.github.io/123Kasi/';
const HASH_COST = 12;
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const CODE_DURATION_MS = 10 * 60 * 1000;
const MAX_LOGIN_FAILURES = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

const USER_HEADERS = ['userId','displayName','email','passwordHash','verified','createdAt','updatedAt','failedAttempts','lockUntil'];
const VERIFICATION_HEADERS = ['email','purpose','codeHash','expiresAt','attempts'];
const SESSION_HEADERS = ['tokenHash','userId','expiresAt','revokedAt'];

/**
 * Run ONCE manually in the Apps Script editor as the Google account owner.
 * This function ends with _ so google.script.run cannot invoke it.
 */
function initialize123Kasi_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('ACCOUNT_SHEET_ID');
  let book = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create('123Kasi Accounts — PRIVATE');
  for (const [name, headers] of [['Users', USER_HEADERS],['Verification', VERIFICATION_HEADERS],['Sessions', SESSION_HEADERS]]) {
    let tab = book.getSheetByName(name);
    if (!tab) tab = book.insertSheet(name);
    if (tab.getLastRow() === 0) tab.appendRow(headers);
    tab.setFrozenRows(1);
  }
  const starter = book.getSheetByName('Sheet1');
  if (starter && starter.getLastRow() === 0 && book.getSheets().length > 1) book.deleteSheet(starter);
  props.setProperty('ACCOUNT_SHEET_ID', book.getId());
  if (!props.getProperty('TOKEN_PEPPER')) {
    props.setProperty('TOKEN_PEPPER', Array.from({length:6}, () => Utilities.getUuid()).join('-'));
  }
  Logger.log('Private account database: ' + book.getUrl());
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Login')
    .setTitle('123Kasi — Sign in')
    .addMetaTag('viewport','width=device-width,initial-scale=1');
}

// Helpers are deliberately private (suffix _).
function book_() {
  const id = PropertiesService.getScriptProperties().getProperty('ACCOUNT_SHEET_ID');
  if (!id) throw new Error('Account system not configured. Ask the site owner to finish setup.');
  return SpreadsheetApp.openById(id);
}

function tab_(name) {
  const sheet = book_().getSheetByName(name);
  if (!sheet) throw new Error('Missing account database tab: ' + name);
  return sheet;
}

function normalizeEmail_(value) {
  const email = String(value || '').trim().toLowerCase();
  if (email.length > 254 || !/^[a-z0-9][a-z0-9.!#$%&'*+/=?^_`{|}~-]*@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(email)) throw new Error('Enter a valid email address.');
  return email;
}

function displayName_(value) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  // A leading equals sign in Sheets creates a formula. Restrict names at entry.
  if (!/^[\p{L}\p{M}0-9 ._'\-]{2,50}$/u.test(name)) throw new Error('Use a name between 2 and 50 characters.');
  return name;
}

function password_(value) {
  if (typeof value !== 'string') throw new Error('Enter a password.');
  const byteLength = Utilities.newBlob(value).getBytes().length;
  if (byteLength < 12 || byteLength > 72) throw new Error('Password must contain 12–72 UTF-8 bytes.');
  return value;
}

function bcrypt_() {
  const b = globalThis.BCRYPT_123KASI;
  if (!b || typeof b.hashSync !== 'function') throw new Error('bcrypt vendor bundle is missing.');
  // Apps Script has Utilities.getUuid rather than WebCrypto's random APIs.
  b.setRandomFallback(length => {
    const bytes = [];
    while (bytes.length < length) {
      const uuid = Utilities.getUuid().replace(/-/g, '');
      for (let i = 0; i < uuid.length && bytes.length < length; i += 2) bytes.push(parseInt(uuid.slice(i,i+2),16));
    }
    return bytes;
  });
  return b;
}

function sha256Hex_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)
    .map(byte => (byte & 255).toString(16).padStart(2,'0')).join('');
}

function hmacHex_(value) {
  const secret = PropertiesService.getScriptProperties().getProperty('TOKEN_PEPPER');
  if (!secret) throw new Error('System is not configured.');
  return Utilities.computeHmacSha256Signature(String(value),secret,Utilities.Charset.UTF_8)
    .map(byte => (byte & 255).toString(16).padStart(2,'0')).join('');
}

function constantEqual_(a,b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i=0;i<a.length;i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function findRow_(sheet,keyColumn,key) {
  const entries = sheet.getDataRange().getValues();
  for (let i=1;i<entries.length;i++) {
    if (String(entries[i][keyColumn]) === key) return {row:i+1,data:entries[i]};
  }
  return null;
}

function rateLimit_(purpose,email,max,seconds) {
  const cache = CacheService.getScriptCache();
  const key = 'rate:' + sha256Hex_(purpose + ':' + email).slice(0,42);
  const next = Number(cache.get(key) || 0)+1;
  if (next > max) throw new Error('Too many requests. Please try again later.');
  cache.put(key,String(next),seconds);
}

function createCode_(email,purpose) {
  rateLimit_('send-'+purpose,email,3,3600);
  const code = String(parseInt(Utilities.getUuid().replace(/-/g,'').slice(0,8),16)%1000000).padStart(6,'0');
  const sheet = tab_('Verification');
  const identifier = email + ':' + purpose;
  const rows = sheet.getDataRange().getValues();
  let row = null;
  for (let i=1;i<rows.length;i++) {
    if (String(rows[i][0]) === email && String(rows[i][1]) === purpose) { row=i+1; break; }
  }
  const entry=[email,purpose,hmacHex_(identifier+':'+code),Date.now()+CODE_DURATION_MS,0];
  if (row) sheet.getRange(row,1,1,5).setValues([entry]);
  else sheet.appendRow(entry);
  const subject=purpose==='reset' ? '123Kasi password reset code' : '123Kasi email verification code';
  MailApp.sendEmail({to:email,subject,body:'Your 123Kasi code is '+code+'. It expires in 10 minutes. Do not share it. If you did not request this, ignore this email.'});
}

function consumeCode_(email,purpose,code) {
  const sheet = tab_('Verification');
  const entries = sheet.getDataRange().getValues();
  for (let i=1;i<entries.length;i++) {
    const row=entries[i];
    if (String(row[0])!==email || String(row[1])!==purpose) continue;
    if (Number(row[3]) < Date.now() || Number(row[4])>=5) throw new Error('Code expired or too many attempts. Request a new code.');
    const digest=hmacHex_(email+':'+purpose+':'+String(code||'').trim());
    if (!constantEqual_(String(row[2]),digest)) {
      sheet.getRange(i+1,5).setValue(Number(row[4])+1);
      throw new Error('Invalid code.');
    }
    sheet.deleteRow(i+1);
    return;
  }
  throw new Error('No active code. Request a new one.');
}

function sessionToken_() {
  return Array.from({length:5}, () => Utilities.getUuid().replace(/-/g,'')).join('');
}

function issueSession_(user) {
  const token = sessionToken_();
  const expiry = Date.now()+SESSION_DURATION_MS;
  tab_('Sessions').appendRow([hmacHex_('session:'+token),user[0],expiry,'']);
  return {token,expiresAt:expiry,user:{displayName:String(user[1]),email:String(user[2])}};
}

function registerUser(form) {
  const email=normalizeEmail_(form && form.email);
  const name=displayName_(form && form.name);
  const password=password_(form && form.password);
  rateLimit_('register',email,3,3600);
  const users=tab_('Users');
  if (findRow_(users,2,email)) return {ok:true,message:'If the account is not yet verified, request a new code.'};
  const hash=bcrypt_().hashSync(password,HASH_COST);
  const lock=LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (findRow_(users,2,email)) return {ok:true,message:'If the account is not yet verified, request a new code.'};
    const now=new Date().toISOString();
    users.appendRow([Utilities.getUuid(),name,email,hash,false,now,now,0,0]);
  } finally { lock.releaseLock(); }
  createCode_(email,'verify');
  return {ok:true,message:'Check your email for the six-digit verification code.'};
}

function resendVerification(emailValue) {
  const email=normalizeEmail_(emailValue);
  rateLimit_('verify-request',email,3,3600);
  const user=findRow_(tab_('Users'),2,email);
  if (user && user.data[4]!==true) createCode_(email,'verify');
  return {ok:true,message:'If the account needs verification, a code has been sent.'};
}

function verifyEmail(emailValue,code) {
  const email=normalizeEmail_(emailValue);
  const lock=LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const users=tab_('Users');
    const user=findRow_(users,2,email);
    if (!user) throw new Error('Account not found.');
    if (user.data[4]===true) return {ok:true,message:'Email already verified. You can sign in.'};
    consumeCode_(email,'verify',code);
    users.getRange(user.row,5).setValue(true);
    users.getRange(user.row,7).setValue(new Date().toISOString());
    return {ok:true,message:'Email verified. You can sign in.'};
  } finally { lock.releaseLock(); }
}

function loginUser(form) {
  const email=normalizeEmail_(form && form.email);
  const password=password_(form && form.password);
  rateLimit_('login',email,18,900);
  const users=tab_('Users');
  const match=findRow_(users,2,email);
  if (!match) throw new Error('Invalid email or password.');
  const user=match.data;
  if (Number(user[8])>Date.now()) throw new Error('Too many failed attempts. Try again later.');
  if (user[4]!==true) throw new Error('Verify your email before signing in.');
  const success=bcrypt_().compareSync(password,String(user[3]));
  const lock=LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const current=findRow_(users,2,email);
    if (!current) throw new Error('Invalid email or password.');
    if (Number(current.data[8])>Date.now()) throw new Error('Too many failed attempts. Try again later.');
    if (!success) {
      const count=Number(current.data[7]||0)+1;
      users.getRange(current.row,8,1,2).setValues([[count,count>=MAX_LOGIN_FAILURES?Date.now()+LOCK_DURATION_MS:0]]);
      throw new Error('Invalid email or password.');
    }
    users.getRange(current.row,8,1,2).setValues([[0,0]]);
    return issueSession_(current.data);
  } finally { lock.releaseLock(); }
}

function getSessionUser(token) {
  if (typeof token!=='string' || token.length>250 || token.length<100) return null;
  const session=findRow_(tab_('Sessions'),0,hmacHex_('session:'+token));
  if (!session || session.data[3] || Number(session.data[2])<=Date.now()) return null;
  const user=findRow_(tab_('Users'),0,String(session.data[1]));
  if (!user || user.data[4]!==true) return null;
  return {displayName:String(user.data[1]),email:String(user.data[2])};
}

function logoutUser(token) {
  if (typeof token!=='string' || token.length>250 || token.length<100) return {ok:true};
  const sheet=tab_('Sessions');
  const session=findRow_(sheet,0,hmacHex_('session:'+token));
  if (session) sheet.getRange(session.row,4).setValue(Date.now());
  return {ok:true};
}

function requestPasswordReset(emailValue) {
  const email=normalizeEmail_(emailValue);
  rateLimit_('password-reset',email,3,3600);
  const user=findRow_(tab_('Users'),2,email);
  if (user && user.data[4]===true) createCode_(email,'reset');
  return {ok:true,message:'If this email is registered, a reset code will be sent.'};
}

function resetPassword(form) {
  const email=normalizeEmail_(form&&form.email);
  const password=password_(form&&form.password);
  const hash=bcrypt_().hashSync(password,HASH_COST);
  const lock=LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const users=tab_('Users');
    const user=findRow_(users,2,email);
    if (!user || user.data[4]!==true) throw new Error('Account not available.');
    consumeCode_(email,'reset',form.code);
    users.getRange(user.row,4).setValue(hash);
    users.getRange(user.row,7,1,3).setValues([[new Date().toISOString(),0,0]]);
    const sessions=tab_('Sessions');
    const values=sessions.getDataRange().getValues();
    for (let i=1;i<values.length;i++) {
      if (String(values[i][1])===String(user.data[0]) && !values[i][3]) sessions.getRange(i+1,4).setValue(Date.now());
    }
    return {ok:true,message:'Password changed. Please sign in again.'};
  } finally { lock.releaseLock(); }
}
