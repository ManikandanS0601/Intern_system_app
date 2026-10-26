import React,{useState,useEffect,useRef} from 'react'
const HINTS=['What are my deadlines?','What is my task status?','Show my requirements','Why did my review fail?','Give me an overview']
export default function Chat({api}){
  const[msgs,setM]=useState([]),[t,setT]=useState(''),[busy,setB]=useState(false),[e,setE]=useState(''),end=useRef()
  useEffect(()=>{api('/chat/history').then(setM).catch(x=>setE(x.message))},[])
  useEffect(()=>{end.current?.scrollIntoView()},[msgs])
  const send=async(text=t)=>{
    if(!text.trim()||busy) return
    setT('');setB(true);setM(x=>[...x,{role:'user',content:text}])
    try{const r=await api('/chat',{method:'POST',body:{message:text}});setM(x=>[...x,{role:'assistant',content:r.reply,mode:r.mode}]);setE('')}
    catch(x){setE(x.message)}
    setB(false)}
  const clear=async()=>{await api('/chat/history',{method:'DELETE'});setM([])}
  return <section className="bg-white rounded-xl shadow p-4 max-w-3xl mx-auto">
    <div className="flex justify-between mb-2"><h2 className="font-semibold">Assistant</h2><button className="!bg-slate-500" onClick={clear}>Clear history</button></div>
    <p className="text-xs text-slate-500 mb-2">Read-only helper. It can't change scores, reviews or decisions. Mode shown under each reply (mock = rule-based, not an LLM).</p>
    <div className="h-96 overflow-y-auto border rounded p-2 space-y-2 bg-slate-50">
      {msgs.map((m,i)=><div key={i} className={m.role==='user'?'text-right':''}><div className={`inline-block max-w-[85%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap text-left ${m.role==='user'?'bg-indigo-600 text-white':'bg-white border'}`}>{m.content}</div>
        {m.role==='assistant'&&m.mode&&<div className="text-[10px] text-slate-400">{m.mode}</div>}</div>)}
      {busy&&<div className="text-sm text-slate-400">Thinking…</div>}<div ref={end}/></div>
    {e&&<p className="text-red-600 text-sm">{e}</p>}
    <div className="flex flex-wrap gap-1 my-2">{HINTS.map(h=><button key={h} className="!bg-slate-200 !text-slate-700" onClick={()=>send(h)}>{h}</button>)}</div>
    <div className="flex gap-2"><input value={t} placeholder="Ask a question…" onChange={x=>setT(x.target.value)} onKeyDown={x=>x.key==='Enter'&&send()}/><button disabled={busy} onClick={()=>send()}>Send</button></div></section>}
