import React,{useState,useEffect} from 'react'
import Chat from './Chat.jsx'
import {BarChart,Bar,XAxis,YAxis,Tooltip,ResponsiveContainer} from 'recharts'

async function api(path,o={}){
  const fd=o.body instanceof FormData
  const r=await fetch('/api'+path,{method:o.method,headers:{Authorization:'Bearer '+localStorage.token,...(o.body&&!fd?{'Content-Type':'application/json'}:{})},body:o.body&&(fd?o.body:JSON.stringify(o.body))})
  if(!r.ok) throw new Error((await r.json().catch(()=>({}))).detail||r.statusText)
  return o.blob?r.blob():r.json()
}
function useLoad(path){const[d,setD]=useState(null),[e,setE]=useState('')
  const load=()=>api(path).then(x=>{setD(x);setE('')}).catch(x=>setE(x.message))
  useEffect(()=>{load()},[path]);return[d,load,e]}
const Card=({t,v})=><div className="bg-white rounded-xl shadow p-4"><div className="text-sm text-slate-500">{t}</div><div className="text-2xl font-semibold">{v??'-'}</div></div>
const Box=({title,children})=><section className="bg-white rounded-xl shadow p-4 mb-4"><h2 className="font-semibold mb-3">{title}</h2>{children}</section>
const Err=({e})=>e?<p className="text-red-600 text-sm my-1">{e}</p>:null
const col={COMPLETED:'bg-green-100',NEEDS_REVISION:'bg-amber-100',REVIEW_FAILED:'bg-red-100',ASSIGNED:'bg-blue-100'}
const Badge=({s})=><span className={`px-2 py-0.5 rounded text-xs ${col[s]||'bg-slate-100'}`}>{s}</span>

function Login({onOk}){const[f,setF]=useState({email:'',password:''}),[e,setE]=useState('')
  const go=async()=>{try{const r=await api('/auth/login',{method:'POST',body:f});localStorage.token=r.token;localStorage.role=r.role;onOk(r.role)}catch(x){setE(x.message)}}
  return <div className="max-w-sm mx-auto mt-24"><Box title="Sign in"><div className="space-y-2">
    <input placeholder="Email" value={f.email} onChange={x=>setF({...f,email:x.target.value})}/>
    <input type="password" placeholder="Password" value={f.password} onChange={x=>setF({...f,password:x.target.value})}/>
    <Err e={e}/><button onClick={go}>Login</button></div></Box></div>}

function Overview(){const[d,,e]=useLoad('/dashboard')
  const dl=async()=>{const b=await api('/export/excel',{blob:true});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='intern_records.xlsx';a.click()}
  if(!d) return <Err e={e}/>
  return <>
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4"><Card t="Interns" v={d.interns}/><Card t="Tasks" v={d.tasks}/><Card t="Completed" v={d.completed}/><Card t="Needs revision" v={d.needs_revision}/><Card t="Needs admin attention" v={d.attention_review_failed}/></div>
    <div className="grid md:grid-cols-2 gap-4">
      <Box title="Tasks by review round"><div style={{height:220}}><ResponsiveContainer><BarChart data={Object.entries(d.rounds).map(([k,v])=>({round:'R'+k,tasks:v}))}><XAxis dataKey="round"/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="tasks" fill="#4f46e5"/></BarChart></ResponsiveContainer></div></Box>
      <Box title="Recent email activity">{d.recent_emails.map((m,i)=><div key={i} className="text-sm border-b py-1">{m.type} → {m.to} <span className="text-slate-500">({m.status})</span></div>)}
        <p className="text-xs text-slate-500 mt-2">MOCK_NOT_SENT = SMTP not configured; nothing was actually sent.</p></Box></div>
    <button onClick={dl}>Download Excel workbook</button></>}

function Interns(){const[list,load,e]=useLoad('/interns'),[draft,setDraft]=useState(null),[msg,setMsg]=useState(''),[err,setErr]=useState(''),[saving,setSaving]=useState(false)
  const up=async ev=>{const fd=new FormData();fd.append('f',ev.target.files[0]);fd.append('file',ev.target.files[0])
    try{const r=await api('/resumes/extract',{method:'POST',body:fd});setDraft({...r.draft,skills:r.draft.skills.join(', ')});setErr('')}catch(x){setErr(x.message)}}
  const save=async()=>{setSaving(true);try{const r=await api('/interns',{method:'POST',body:{...draft,name:draft.name||'',email:draft.email||'',phone:draft.phone||'',skills:draft.skills.split(',').map(s=>s.trim()).filter(Boolean)}})
    const emailMessage=r.email_status==='SENT'?`Welcome email sent to ${r.email_to}.`:r.email_status==='MOCK_NOT_SENT'?`Intern created, but no email was sent to ${r.email_to} because SMTP_HOST is not configured.`:r.email_status.startsWith('NOT_CONFIGURED:')?`Intern created, but email was not sent to ${r.email_to}: ${r.email_status}.`:`Intern created, but email delivery failed for ${r.email_to}: ${r.email_status}.`
    setMsg(`${r.intern_id} is now in the interns list. ${emailMessage} Temporary password (shown once): ${r.temporary_password}`);setDraft(null);load()}catch(x){setErr(x.message)}finally{setSaving(false)}}
  const downloadResume=async id=>{try{const b=await api(`/interns/${id}/resume`,{blob:true});const url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download=`${id}-resume`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(x){setErr(x.message)}}
  const decide=async(id,decision)=>{try{await api(`/interns/${id}/decision`,{method:'POST',body:{decision}});load()}catch(x){setErr(x.message)}}
  const suggest=async id=>{const r=await api(`/interns/${id}/task-recommendations`);alert(r.suggestions.join('\n')+'\n\n(Heuristic suggestion; admin approval required)')}
  return <>
    <Box title="Add intern from resume (PDF/DOCX)"><input type="file" accept=".pdf,.docx" onChange={up}/><Err e={err}/>{msg&&<p className="text-green-700 text-sm">{msg}</p>}
      {draft&&<div className="mt-3 space-y-2">{draft.missing_fields.length>0&&<p className="text-amber-700 text-sm">Not found in resume, please fill: {draft.missing_fields.join(', ')}</p>}
        {['name','email','phone','skills'].map(k=><label key={k} className="block text-sm capitalize">{k}<input value={draft[k]||''} readOnly={k==='email'&&Boolean(draft.resume)} onChange={x=>setDraft({...draft,[k]:x.target.value})}/></label>)}
        {draft.resume&&<p className="text-xs text-slate-500">The candidate email will be taken directly from the uploaded resume.</p>}
        <button disabled={saving} onClick={save}>{saving?'Saving…':'Confirm & save intern'}</button></div>}</Box>
    <Box title="Interns"><Err e={e}/><table className="w-full text-sm"><thead><tr className="text-left"><th>ID</th><th>Name</th><th>Email</th><th>Resume</th><th>Decision</th><th></th></tr></thead>
      <tbody>{list?.map(i=><tr key={i.id} className="border-t"><td>{i.id}</td><td>{i.name}</td><td>{i.email}</td><td>{i.has_resume?<button className="!bg-slate-600" onClick={()=>downloadResume(i.id)}>Download</button>:'—'}</td><td><Badge s={i.decision}/></td>
        <td className="space-x-1"><button onClick={()=>suggest(i.id)}>Suggest task</button><button onClick={()=>decide(i.id,'REJECT')}>Approve rejection</button><button onClick={()=>decide(i.id,'EXTEND')}>Extend</button></td></tr>)}</tbody></table></Box></>}

function Reviews({id}){const[r]=useLoad(`/tasks/${id}/reviews`)
  return <div className="mt-2">{r?.map(x=><div key={x.round} className="border rounded p-2 mb-2 text-sm"><b>Round {x.round}</b> · score {x.score?.toFixed(0)} · {x.recommendation}
    <table className="w-full mt-1"><tbody>{x.checklist.map((c,i)=><tr key={i}><td>{c.requirement}</td><td className={c.result==='PASSED'?'text-green-700':'text-red-600'}>{c.result}</td><td className="text-xs text-slate-500">evidence: {c.evidence.join(', ')||'none'}</td></tr>)}</tbody></table>
    <p className="mt-1">{x.feedback}</p></div>)}{r?.length===0&&<p className="text-sm text-slate-500">No reviews yet.</p>}</div>}

function Tasks({admin}){const[list,load,e]=useLoad('/tasks'),[interns]=useLoad(admin?'/interns':'/tasks'),[open,setOpen]=useState(null),[createOpen,setCreateOpen]=useState(false),[f,setF]=useState({intern_id:'',title:'',description:'',deadline:'',crit:''}),[err,setErr]=useState(''),[message,setMessage]=useState(''),[saving,setSaving]=useState(false),[sub,setSub]=useState({})
  const make=async()=>{setSaving(true);try{const r=await api('/tasks',{method:'POST',body:{intern_id:f.intern_id,title:f.title,description:f.description,deadline:f.deadline,criteria:f.crit.split('\n').filter(Boolean).map(text=>({text,mandatory:true}))}});setErr('');const emailMessage=r.email_status==='SENT'?'Email sent to the candidate.':r.email_status==='MOCK_NOT_SENT'?'Email not sent (SMTP_HOST is not configured).':r.email_status.startsWith('NOT_CONFIGURED:')?`Email not sent: ${r.email_status}.`:`Email delivery failed: ${r.email_status}.`;setMessage(`Task ${r.task_id} created. ${emailMessage}`);setCreateOpen(false);setF({intern_id:'',title:'',description:'',deadline:'',crit:''});load()}catch(x){setErr(x.message)}finally{setSaving(false)}}
  const send=async id=>{try{const r=await api(`/tasks/${id}/submit`,{method:'POST',body:sub[id]});setErr(r.message||'');load()}catch(x){setErr(x.message)}}
  return <>
    {admin&&<div className="mb-4"><button onClick={()=>{setErr('');setCreateOpen(true)}}>Create task</button>{message&&<p className="text-sm mt-2">{message}</p>}</div>}
    <Err e={err||e}/>
    {admin&&createOpen&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={x=>{if(x.target===x.currentTarget)setCreateOpen(false)}}>
      <section role="dialog" aria-modal="true" aria-labelledby="create-task-title" className="bg-white rounded-xl shadow-xl p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3"><h2 id="create-task-title" className="font-semibold">Create &amp; assign task</h2><button className="!bg-slate-500" onClick={()=>setCreateOpen(false)}>Close</button></div>
        <div className="grid md:grid-cols-2 gap-2">
          <select value={f.intern_id} onChange={x=>setF({...f,intern_id:x.target.value})}><option value="">Select intern</option>{interns?.map(i=><option key={i.id} value={i.id}>{i.id} {i.name}</option>)}</select>
          <input placeholder="Title" value={f.title} onChange={x=>setF({...f,title:x.target.value})}/><input type="date" value={f.deadline} onChange={x=>setF({...f,deadline:x.target.value})}/>
          <textarea placeholder="Description" value={f.description} onChange={x=>setF({...f,description:x.target.value})}/>
          <textarea className="md:col-span-2" rows={5} placeholder="Acceptance criteria — one per line" value={f.crit} onChange={x=>setF({...f,crit:x.target.value})}/>
        </div><button className="mt-3" disabled={saving} onClick={make}>{saving?'Creating…':'Create task and email intern'}</button>
      </section></div>}
    {list?.map(t=><Box key={t.id} title={`${t.id} · ${t.title}`}><div className="text-sm"><Badge s={t.status}/> Round {t.round}/3 · Deadline {t.deadline}
      <ul className="list-disc ml-5 my-2">{t.criteria.map((c,i)=><li key={i}>{c.text}</li>)}</ul>
      {!admin&&['ASSIGNED','NEEDS_REVISION'].includes(t.status)&&<div className="space-y-1"><textarea rows={4} placeholder="Describe your work / paste code evidence" onChange={x=>setSub({...sub,[t.id]:{...sub[t.id],content:x.target.value}})}/>
        <input placeholder="Repository / deployment link" onChange={x=>setSub({...sub,[t.id]:{...sub[t.id],links:x.target.value}})}/><button onClick={()=>send(t.id)}>Submit round {t.round+1}</button></div>}
      <button className="mt-2" onClick={()=>setOpen(open===t.id?null:t.id)}>{open===t.id?'Hide':'Show'} review history</button>{open===t.id&&<Reviews id={t.id}/>}</div></Box>)}</>}

const CATS=["Task Assignment","Task Requirements and Clarity","AI Evaluation and Review Process","Mentor or Reviewer Support","Email Notifications and Communication","Workload and Deadlines","Internship Learning Experience","Technical Issues","General Feedback"]
const RK={overall:'Overall satisfaction',difficulty:'Task difficulty',clarity:'Task clarity',ai_fairness:'AI evaluation fairness',reviewer_support:'Reviewer support',email:'Email communication'}
function FeedbackForm(){const[mine,load]=useLoad('/feedback/mine'),[f,setF]=useState({category:CATS[0],ratings:Object.fromEntries(Object.keys(RK).map(k=>[k,3])),description:'',challenges:'',suggestions:'',comments:'',confidential:false}),[m,setM]=useState('')
  const go=async()=>{try{await api('/feedback',{method:'POST',body:f});setM('Thank you — feedback submitted.');load()}catch(x){setM(x.message)}}
  return <><Box title="Share feedback (optional)"><p className="text-xs text-slate-600 mb-2">Only authorized administrators can read this. It does not affect your task scores or internship decision. Confidential mode hides your name from reports, though content or access logs could still reveal you.</p>
    <div className="grid md:grid-cols-2 gap-2"><select value={f.category} onChange={x=>setF({...f,category:x.target.value})}>{CATS.map(c=><option key={c}>{c}</option>)}</select>
      {Object.entries(RK).map(([k,l])=><label key={k} className="text-sm">{l}<select value={f.ratings[k]} onChange={x=>setF({...f,ratings:{...f.ratings,[k]:+x.target.value}})}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{'★'.repeat(n)}</option>)}</select></label>)}
      {['description','challenges','suggestions','comments'].map(k=><textarea key={k} placeholder={k[0].toUpperCase()+k.slice(1)} onChange={x=>setF({...f,[k]:x.target.value})}/>)}</div>
    <label className="text-sm block my-2"><input type="checkbox" className="!w-auto mr-2" onChange={x=>setF({...f,confidential:x.target.checked})}/>Confidential feedback</label><button onClick={go}>Submit</button><Err e={m}/></Box>
    <Box title="My feedback history">{mine?.map(x=><div key={x.id} className="text-sm border-t py-1">#{x.id} {x.category} · {x.status} · {x.created.slice(0,10)}</div>)}</Box></>}

function FeedbackAdmin(){const[cat,setCat]=useState(''),[a]=useLoad('/admin/feedback/analysis'),[list,load,e]=useLoad('/admin/feedback?category='+encodeURIComponent(cat))
  const upd=async(id,body)=>{await api('/admin/feedback/'+id,{method:'PATCH',body});load()}
  return <>
    {a&&<Box title="Feedback analysis"><p className="text-xs bg-amber-50 p-2 rounded mb-2">AI-generated ({a.mode}). {a.caveat}</p>
      <div className="grid md:grid-cols-3 gap-3"><Card t="Responses (n)" v={a.responses}/>{a.suggestions.map((s,i)=><Card key={i} t="Suggestion" v={s}/>)}</div>
      <div style={{height:220}} className="mt-3"><ResponsiveContainer><BarChart data={Object.entries(a.averages).map(([k,v])=>({k:RK[k],v}))}><XAxis dataKey="k" tick={{fontSize:10}}/><YAxis domain={[0,5]}/><Tooltip/><Bar dataKey="v" fill="#0ea5e9"/></BarChart></ResponsiveContainer></div>
      <p className="text-sm mt-2">Theme mentions: {Object.entries(a.theme_mentions).map(([k,v])=>`${k}: ${v}`).join(' · ')}</p></Box>}
    <Box title="Submissions"><select className="mb-2 md:w-72" value={cat} onChange={x=>setCat(x.target.value)}><option value="">All categories</option>{CATS.map(c=><option key={c}>{c}</option>)}</select><Err e={e}/>
      {list?.map(x=><div key={x.id} className="border-t py-2 text-sm"><b>#{x.id}</b> {x.category} · {x.confidential?'Confidential':x.intern_name} · ★{x.ratings.overall}<p>{x.description||x.challenges||x.suggestions}</p>
        <select className="md:w-40 inline-block" value={x.status} onChange={y=>upd(x.id,{status:y.target.value})}>{['Open','Under Review','In Progress','Resolved'].map(s=><option key={s}>{s}</option>)}</select>
        <input className="md:w-72 ml-2 inline-block" placeholder="Add internal note + Enter" onKeyDown={y=>{if(y.key==='Enter'&&y.target.value){upd(x.id,{note:y.target.value});y.target.value=''}}}/>
        {x.notes&&<pre className="text-xs text-slate-500 whitespace-pre-wrap">{x.notes}</pre>}</div>)}</Box></>}

export default function App(){const[role,setRole]=useState(localStorage.role),[tab,setTab]=useState('overview')
  if(!localStorage.token||!role) return <Login onOk={r=>{setRole(r);setTab(r==='admin'?'overview':'tasks')}}/>
  const tabs=role==='admin'?{overview:'Overview',interns:'Interns',tasks:'Tasks',feedback:'Feedback',chat:'Assistant'}:{tasks:'My tasks',feedback:'Feedback',chat:'Assistant'}
  const view={chat:<Chat api={api}/>,overview:<Overview/>,interns:<Interns/>,tasks:<Tasks admin={role==='admin'}/>,feedback:role==='admin'?<FeedbackAdmin/>:<FeedbackForm/>}[tab]
  return <div className="max-w-6xl mx-auto p-4"><header className="flex flex-wrap gap-2 items-center mb-4"><h1 className="font-bold text-lg mr-4">Intern Management</h1>
    {Object.entries(tabs).map(([k,l])=><button key={k} className={tab===k?'':'!bg-slate-300 !text-slate-800'} onClick={()=>setTab(k)}>{l}</button>)}
    <button className="ml-auto !bg-slate-700" onClick={()=>{localStorage.clear();location.reload()}}>Logout</button></header>{view}</div>}
