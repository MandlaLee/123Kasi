/**
 * Offline Apps Script authentication smoke test.
 * Run from repository root: node auth/test-auth.js
 * No real emails, Google Sheets, or credentials are used.
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

class Sheet {
  constructor(name){this.name=name;this.rows=[];}
  getName(){return this.name;}
  getLastRow(){return this.rows.length;}
  appendRow(row){this.rows.push(row.slice());return this;}
  setFrozenRows(){}
  getDataRange(){return {getValues:()=>this.rows.map(row=>row.slice())};}
  getRange(row,col,numRows=1,numCols=1){
    const sheet=this;
    return {
      setValue(value){while(sheet.rows.length<row)sheet.rows.push([]);sheet.rows[row-1][col-1]=value;},
      setValues(values){
        for(let r=0;r<numRows;r++){
          while(sheet.rows.length<row+r)sheet.rows.push([]);
          for(let c=0;c<numCols;c++)sheet.rows[row+r-1][col+c-1]=values[r][c];
        }
      }
    };
  }
  deleteRow(row){this.rows.splice(row-1,1);}
}
class Book {
  constructor(){this.id='test-spreadsheet-id';this.sheets=new Map([['Sheet1',new Sheet('Sheet1')]]);}
  getId(){return this.id;}
  getUrl(){return 'https://docs.google.com/spreadsheets/d/'+this.id;}
  getSheetByName(name){return this.sheets.get(name)||null;}
  getSheets(){return [...this.sheets.values()];}
  insertSheet(name){const sheet=new Sheet(name);this.sheets.set(name,sheet);return sheet;}
  deleteSheet(sheet){this.sheets.delete(sheet.name);}
}
const book=new Book(), properties=new Map(), cache=new Map(), mail=[];
const bytes=a=>[...a].map(v=>v>127?v-256:v);
const ctx={
  console,
  setTimeout:callback=>callback(),
  Date,Math,Array,String,Number,Error,JSON,Map,Set,
  SpreadsheetApp:{create:()=>book,openById:id=>{assert.equal(id,book.id);return book;}},
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k)||null,setProperty:(k,v)=>properties.set(k,v)})},
  CacheService:{getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v)})},
  LockService:{getScriptLock:()=>({waitLock:()=>{},releaseLock:()=>{}})},
  MailApp:{sendEmail:args=>mail.push(args)},
  Logger:{log:()=>{}},
  Utilities:{
    getUuid:()=>crypto.randomUUID(),
    newBlob:value=>({getBytes:()=>bytes(Buffer.from(value,'utf8'))}),
    DigestAlgorithm:{SHA_256:'sha256'},
    Charset:{UTF_8:'utf8'},
    computeDigest:(_,value)=>bytes(crypto.createHash('sha256').update(value).digest()),
    computeHmacSha256Signature:(value,key)=>bytes(crypto.createHmac('sha256',key).update(value).digest())
  }
};
vm.createContext(ctx);
const root=__dirname;
vm.runInContext(fs.readFileSync(path.join(root,'Bcrypt.gs'),'utf8'),ctx,{filename:'Bcrypt.gs'});
vm.runInContext(fs.readFileSync(path.join(root,'Code.gs'),'utf8'),ctx,{filename:'Code.gs'});

function lastCode(){
  assert.ok(mail.length,'Expected a verification email');
  const match=mail.at(-1).body.match(/\b\d{6}\b/);
  assert.ok(match,'Expected a six-digit code');
  return match[0];
}
function rejects(fn,part){
  try{fn();}catch(e){assert.ok(String(e.message).includes(part),String(e));return;}
  assert.fail('Expected failure: '+part);
}

ctx.initialize123Kasi_();
assert.ok(book.getSheetByName('Users'));
assert.ok(properties.get('TOKEN_PEPPER'));

const validPassword='A fairly long password! 2026';
const registration=ctx.registerUser({name:'Kasi Creator',email:'CREATOR@example.com',password:validPassword});
assert.equal(registration.ok,true);
const userSheet=book.getSheetByName('Users');
assert.equal(userSheet.getLastRow(),2);
const user=userSheet.getDataRange().getValues()[1];
assert.equal(user[2],'creator@example.com');
assert.ok(user[3].startsWith('$2b$12$'),'Must use bcrypt cost 12');
assert.ok(!JSON.stringify(book.getSheets().map(s=>s.rows)).includes(validPassword),'Plain password found in Sheet!');
assert.equal(user[4],false);
rejects(()=>ctx.loginUser({email:user[2],password:validPassword}),'Verify');

ctx.verifyEmail(user[2],lastCode());
assert.equal(userSheet.getDataRange().getValues()[1][4],true);
const login=ctx.loginUser({email:user[2],password:validPassword});
assert.equal(login.user.email,user[2]);
assert.ok(login.token.length>=100);
assert.equal(ctx.getSessionUser(login.token).displayName,'Kasi Creator');
assert.equal(ctx.getSessionUser('invalid'),null);
ctx.logoutUser(login.token);
assert.equal(ctx.getSessionUser(login.token),null);

ctx.requestPasswordReset(user[2]);
const resetCode=lastCode();
const newPassword='Another long password 2027!';
ctx.resetPassword({email:user[2],code:resetCode,password:newPassword});
rejects(()=>ctx.loginUser({email:user[2],password:validPassword}),'Invalid');
const newLogin=ctx.loginUser({email:user[2],password:newPassword});
assert.equal(newLogin.user.email,user[2]);
assert.ok(!JSON.stringify(book.getSheets().map(s=>s.rows)).includes(newPassword),'Reset password leaked in Sheet');

console.log('PASS: private Users sheet, bcrypt cost 12, email verification, login, sessions, logout, password reset, and no plaintext passwords');
