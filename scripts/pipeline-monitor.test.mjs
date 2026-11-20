import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/lib/pipeline-monitor.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const { createPipelineMonitor, createPipelineRefresh, consumePipelineEvents }=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const settle=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
test('SSE parser handles split UTF8 frames, comments and repeated revisions',async()=>{
  const encoder=new TextEncoder(); const values=[];
  const stream=new ReadableStream({start(controller){for(const text of [': heartbeat\n\nevent: pipe','line\ndata: {"revision":"a"}\n','\nevent: pipeline\r\ndata: {"revision":"b"}\r\n\r\n'])controller.enqueue(encoder.encode(text));controller.close();}});
  await consumePipelineEvents(stream,value=>values.push(value));
  assert.deepEqual(values,['a','b']);
});
test('one stream is shared, revisions deduplicate, reconnect and fallback refresh; unmount aborts',async()=>{
  const timers=new Map();let serial=0,now=0,resume,opened=0,onRevision,rejectConnection,signal;
  const subscribe=createPipelineMonitor((abort,receive)=>{opened++;signal=abort;onRevision=receive;return new Promise((_,reject)=>{rejectConnection=reject;abort.addEventListener('abort',()=>reject(Error('aborted')),{once:true});});},{schedule:(fn,ms)=>{const id=++serial;timers.set(id,{fn,ms});return id;},cancel:id=>timers.delete(id),now:()=>now,onResume:fn=>{resume=fn;return()=>{resume=undefined;};}});
  let first=0,second=0;
  const off1=subscribe(()=>first++),off2=subscribe(()=>second++);
  assert.equal(opened,1);onRevision('one');onRevision('one');await settle();assert.equal(first,1);assert.equal(second,1);
  let late=0;const offLate=subscribe(()=>late++);assert.equal(late,1,'late subscriber synchronizes without opening another stream');offLate();
  rejectConnection(Error('network'));await settle();
  const timer=[...timers.values()][0];timers.clear();now+=timer.ms;timer.fn();await settle();assert.equal(opened,2);
  onRevision('one');assert.equal(first,2,'reconnect resyncs even when revision is unchanged');
  resume();await settle();assert.equal(opened,3);onRevision('two');assert.ok(first>=3);
  rejectConnection(Error('blocked'));await settle();
  for(let i=0;i<5;i++){const task=[...timers.values()][0];timers.clear();now+=task.ms;task.fn();await settle();rejectConnection(Error('blocked'));await settle();}
  assert.ok(first>3,'fallback refetch remains active when streaming is blocked');
  const pending=[...timers.values()][0];timers.clear();pending.fn();await settle();
  off1();assert.equal(signal.aborted,false);off2();await settle();assert.equal(signal.aborted,true);assert.equal(timers.size,0);assert.equal(resume,undefined);
});
test('refreshes coalesce and serialize so an older response cannot overwrite a newer one',async()=>{
  let calls=0,release;const values=[];
  const refresh=createPipelineRefresh(async()=>{const value=++calls;await new Promise(resolve=>release=resolve);values.push(value);});
  refresh();refresh();refresh();assert.equal(calls,1);release();await settle();assert.equal(calls,2);release();await settle();assert.deepEqual(values,[1,2]);
});
test('a failed REST read retries without another SSE revision and disposal cancels retries',async()=>{
  let retry,canceled=false,calls=0;
  const refresh=createPipelineRefresh(async()=>{if(++calls===1)throw Error('temporary read failure');},{schedule:fn=>{retry=fn;return 1;},cancel:()=>{canceled=true;}});
  refresh();await settle();assert.equal(calls,1);assert.equal(typeof retry,'function');retry();await settle();assert.equal(calls,2);
  refresh.dispose();refresh();assert.equal(calls,2);
  const fail=createPipelineRefresh(async()=>{throw Error('offline');},{schedule:fn=>{retry=fn;return 2;},cancel:()=>{canceled=true;}});
  fail();await settle();fail.dispose();assert.equal(canceled,true);
});
