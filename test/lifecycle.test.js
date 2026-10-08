import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
test('shutdown ignores late IPC and timers after the overlay is destroyed', () => {
const root=fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');const app=new EventEmitter();app.isPackaged=false;app.disableHardwareAcceleration=()=>{};app.getAppPath=()=>root;app.getVersion=()=> 'test';app.requestSingleInstanceLock=()=>true;app.whenReady=()=>new Promise(()=>{});app.isReady=()=>true;app.quit=()=>{};
const ipc=new EventEmitter();ipc.handle=()=>{};const screen=new EventEmitter();screen.getAllDisplays=()=>[];screen.getPrimaryDisplay=()=>({bounds:{width:1920,height:1080,x:0,y:0},id:1});const electron={app,ipcMain:ipc,screen,globalShortcut:{unregisterAll(){}},powerSaveBlocker:{start:()=>1,stop(){}},dialog:{showErrorBox(){throw Error('Unexpected dialog');}}};
let timer;let cancelled=false;const sandbox={require:n=>n==='node:fs'?{existsSync:()=>false,appendFileSync(){}}:n==='electron'?electron:n==='./permissions.cjs'?require(root+'/desktop/permissions.cjs'):require(n),__dirname:root+'/desktop',process,console,setTimeout:fn=>{timer=fn;return 1;},clearTimeout:()=>{cancelled=true;}};vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(root+'/desktop/main.cjs','utf8')+`\nlet testDestroyed=false; let testSent=0; const testContents={isDestroyed:()=>false, mainFrame:{}, send:()=>{testSent++;}};controller={isDestroyed:()=>false,webContents:testContents};overlay={isDestroyed:()=>testDestroyed,get webContents(){if(testDestroyed)throw new Error('Object has been destroyed');return testContents;}};origin='http://127.0.0.1:12345';installIPC();globalThis.testEvent={sender:testContents,senderFrame:testContents.mainFrame};globalThis.destroyTestOverlay=()=>{testDestroyed=true;};globalThis.testSentCount=()=>testSent;`,sandbox);
ipc.emit('desktop:preview',sandbox.testEvent);assert.ok(sandbox.testSentCount()>0);sandbox.destroyTestOverlay();
for(const [event,value] of [['desktop:caption',''],['desktop:delta','late text'],['desktop:status','Idle'],['desktop:preview']])assert.doesNotThrow(()=>ipc.emit(event,sandbox.testEvent,value));
assert.doesNotThrow(()=>timer());assert.doesNotThrow(()=>vm.runInContext('positionOverlay()',sandbox));app.emit('before-quit');assert.ok(cancelled);const sent=sandbox.testSentCount();assert.doesNotThrow(()=>ipc.emit('desktop:caption',sandbox.testEvent,'late text'));assert.equal(sandbox.testSentCount(),sent);app.emit('will-quit');});
