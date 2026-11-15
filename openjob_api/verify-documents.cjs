const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const express = require('express');
const jwt = require('jsonwebtoken');
const rows = new Map();
let failInsert = false;
const dbPath = require.resolve('./src/config/database');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {query: async (sql, args = []) => {
  if (sql.startsWith('INSERT')) {
    if (failInsert) throw new Error('Injected metadata failure');
    rows.set(args[0], {id: args[0], user_id: args[1], filename: args[2], originalName: args[3], size: args[4]});
    return {rowCount: 1};
  }
  if (sql.startsWith('DELETE')) {
    const row = rows.get(args[0]);
    if (!row || row.user_id !== args[1]) return {rowCount: 0, rows: []};
    rows.delete(args[0]); return {rowCount: 1, rows: [row]};
  }
  if (sql.includes('WHERE id')) {
    const row = rows.get(args[0]); return {rowCount: row ? 1 : 0, rows: row ? [row] : []};
  }
  return {rows: [...rows.values()]};
}}};
process.env.ACCESS_TOKEN_KEY = 'isolated-local-verification-secret';
const app = express();
app.use('/documents', require('./src/routes/documents'));
app.use((err, req, res, next) => res.status(err.statusCode || 500).json({status:'failed', message:err.message}));
const server = app.listen(0, '127.0.0.1', async () => {
 let checks = 0;
 const base = `http://127.0.0.1:${server.address().port}/documents`;
 const token = jwt.sign({id:'test-user-a'}, process.env.ACCESS_TOKEN_KEY, {algorithm:'HS256'});
 const otherToken = jwt.sign({id:'test-user-b'}, process.env.ACCESS_TOKEN_KEY, {algorithm:'HS256'});
 const auth = {Authorization:`Bearer ${token}`};
 async function upload(bytes, mime='application/pdf', headers=auth, field='document') {
   const form = new FormData();form.append(field, new Blob([bytes], {type:mime}), 'resume.pdf');
   return fetch(base, {method:'POST', headers, body:form});
 }
 function status(response, expected) {assert.equal(response.status,expected);checks++;}
 try {
   status(await upload('%PDF-1.7\n', 'application/pdf', {}),401);
   status(await fetch(base,{method:'POST',headers:auth,body:new FormData()}),400);
   status(await upload('text','text/plain'),400);
   status(await upload('fake pdf'),400);
   status(await upload(''),400);
   status(await upload(Buffer.alloc(5*1024*1024+1)),400);
   status(await upload('%PDF-1.7\n', 'application/pdf', auth, 'wrong'),400);
   const valid = await upload('%PDF-1.7\n%%EOF');status(valid,201);
   const body=await valid.json();assert.equal(typeof body.data.documentId,'string');checks++;
   const id=body.data.documentId;
   const download=await fetch(`${base}/${id}`);status(download,200);
   assert.equal(download.headers.get('content-type'),'application/pdf');checks++;
   assert.ok(download.headers.get('content-disposition'));checks++;
   assert.equal(await download.text(),'%PDF-1.7\n%%EOF');checks++;
   const list=await fetch(base);status(list,200);assert.equal((await list.json()).data.documents.length,1);checks++;
   status(await fetch(`${base}/xxx`),404);
   status(await fetch(`${base}/${id}`,{method:'DELETE'}),401);
   status(await fetch(`${base}/${id}`,{method:'DELETE',headers:{Authorization:`Bearer ${otherToken}`}}),404);
   assert.equal(rows.size,1);checks++;
   failInsert=true;
   const before=await fs.readdir('uploads/documents');
   status(await upload('%PDF-1.7\n'),500);
   assert.deepEqual(await fs.readdir('uploads/documents'),before);checks++;
   failInsert=false;
   status(await fetch(`${base}/${id}`,{method:'DELETE',headers:auth}),200);
   status(await fetch(`${base}/${id}`),404);
   assert.equal((await fs.readdir('uploads/documents')).length,0);checks++;
   console.log(`${checks} assertions passed. Real HTTP, Multer, JWT, filesystem. PostgreSQL replaced with an in-memory query stub.`);
 } catch(err) {console.error(err);process.exitCode=1;} finally {server.close();}
});
