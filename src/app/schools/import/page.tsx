'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, FileSpreadsheet, Upload, AlertTriangle, Loader2, Save, Users } from 'lucide-react';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';

type Row = { [key: string]: string; __status?: string; __error?: string };
type Field = 'name'|'udise_code'|'principal_name'|'district'|'state'|'address'|'school_type'|'contact_name'|'contact_designation'|'contact_phone'|'contact_whatsapp';
const fields: {key:Field; label:string; aliases:string[]}[] = [
 {key:'name',label:'School name *',aliases:['school name','school','विद्यालय का नाम','विद्यालय','स्कूल का नाम','संस्था का नाम','name of school','school_name']},
 {key:'udise_code',label:'UDISE code',aliases:['udise','udise code','udise code number','udise_code']},
 {key:'principal_name',label:'Headmaster / Principal name',aliases:['headmaster','head master','headmaster name','principal','principal name','hm name','प्रधानाध्यापक','प्रधानाध्यापक का नाम','हेडमास्टर का नाम','प्रधानाचार्य']},
 {key:'district',label:'District',aliases:['district','जनपद','जिला','जनपद का नाम']},
 {key:'state',label:'State',aliases:['state','राज्य']},
 {key:'address',label:'Address (no GPS location)',aliases:['address','school address','पता','विद्यालय का पता','block','विकास खंड','ब्लॉक']},
 {key:'school_type',label:'School type',aliases:['school type','type','विद्यालय का प्रकार','category']},
 {key:'contact_name',label:'Teacher / contact name',aliases:['teacher name','teacher','contact name','staff name','शिक्षक का नाम','अध्यापक का नाम','संपर्क व्यक्ति','नाम']},
 {key:'contact_designation',label:'Teacher designation',aliases:['designation','post','role','पद','पदनाम','teacher designation']},
 {key:'contact_phone',label:'Phone number',aliases:['phone','phone number','mobile','mobile number','contact number','मोबाइल','मोबाइल नंबर','फोन नंबर']},
 {key:'contact_whatsapp',label:'WhatsApp number',aliases:['whatsapp','whatsapp number','व्हाट्सएप नंबर']}
];
const norm=(s:string)=>String(s??'').trim().toLocaleLowerCase().replace(/[\\s_./-]+/g,' ').replace(/[ः:]/g,'').trim();
const matchHeader=(header:string, f:typeof fields[number])=>f.aliases.some(a=>norm(a)===norm(header)) || (f.key==='name'&&norm(header)==='name');
declare global { interface Window { XLSX?: any } }

export default function SchoolExcelImportPage(){
 const [fileName,setFileName]=useState(''),[headers,setHeaders]=useState<string[]>([]),[rows,setRows]=useState<Row[]>([]),[mapping,setMapping]=useState<Record<Field,string>>({} as Record<Field,string>);
 const [busy,setBusy]=useState(false),[saving,setSaving]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const inputRef=useRef<HTMLInputElement>(null);
 const validRows=useMemo(()=>rows.filter(r=>String(r[mapping.name]||'').trim()),[rows,mapping]);
 async function loadXlsx(){
  if(window.XLSX)return window.XLSX;
  await new Promise<void>((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.onload=()=>resolve();s.onerror=()=>reject(new Error('Excel reader could not load. Check internet and try again.'));document.head.appendChild(s);});
  if(!window.XLSX)throw new Error('Excel reader did not initialize.');return window.XLSX;
 }
 async function handleFile(file?:File){
  if(!file)return;setBusy(true);setError('');setMessage('');setFileName(file.name);
  try{
   const XLSX=await loadXlsx();const data=await file.arrayBuffer();const wb=XLSX.read(data,{type:'array',cellDates:false});
   const sheet=wb.Sheets[wb.SheetNames[0]];const matrix=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false}) as unknown[][];
   if(matrix.length<2)throw new Error('The first worksheet needs a header row and at least one data row.');
   const hs=(matrix[0]||[]).map((v,i)=>String(v??'').trim()||('Column '+(i+1)));
   const map={} as Record<Field,string>;for(const f of fields){const h=hs.find(x=>matchHeader(x,f));if(h)map[f.key]=h;}
   setHeaders(hs);setMapping(map);
   const parsed=matrix.slice(1).filter(a=>a.some(v=>String(v??'').trim())).map(a=>{const r:Row={};hs.forEach((h,i)=>r[h]=String(a[i]??'').trim());return r;});
   setRows(parsed);if(!map.name)setError('School-name column was not recognized automatically. Choose the correct column in “School name” below.');
   else setMessage('Read '+parsed.length+' spreadsheet rows. Please review the column matches before saving.');
  }catch(e){setError(e instanceof Error?e.message:'Could not read this file.');setRows([]);setHeaders([])}finally{setBusy(false)}
 }
 const updateMap=(key:Field,value:string)=>setMapping(m=>({...m,[key]:value}));
 async function importRows(){
  if(!mapping.name){setError('Map the School name column before importing.');return}
  const ready=validRows;if(!ready.length){setError('No rows with a school name were found.');return}
  if(!confirm('Import '+ready.length+' school rows? Existing schools with the same UDISE code or school name will be skipped. GPS location will remain empty.'))return;
  setSaving(true);setError('');setMessage('');
  try{
   const client=createClient();const existing=await client.from('schools').select('id,name,udise_code');
   if(existing.error)throw new Error(existing.error.message);
   const names=new Set((existing.data||[]).map((s:any)=>norm(s.name)));const codes=new Set((existing.data||[]).map((s:any)=>norm(s.udise_code||'' )).filter(Boolean));
   let added=0,skipped=0,failed=0;const problems:string[]=[];
   const {data:{user}}=await client.auth.getUser();
   for(let i=0;i<ready.length;i++){
    const r=ready[i];const get=(k:Field)=>String(r[mapping[k]||'']||'').trim();
    const name=get('name'),code=get('udise_code');
    if(names.has(norm(name))||(code&&codes.has(norm(code)))){skipped++;r.__status='Skipped duplicate';continue}
    const rawType=get('school_type').toUpperCase().replace(/[ -]+/g,'_');
    const schoolType=['PRIMARY','UPPER_PRIMARY','SECONDARY','SENIOR_SECONDARY','OTHER'].includes(rawType)?rawType:
      /upper|उच्च/.test(rawType)?'UPPER_PRIMARY':/senior|higher secondary/.test(rawType)?'SENIOR_SECONDARY':/secondary|माध्यमिक/.test(rawType)?'SECONDARY':/primary|प्राथमिक/.test(rawType)?'PRIMARY':'OTHER';
    const payload={name,udise_code:code||null,address:get('address')||null,district:get('district')||null,state:get('state')||'Uttar Pradesh',school_type:schoolType,principal_name:get('principal_name')||null,latitude:null,longitude:null};
    const saved=await client.from('schools').insert(payload).select('id').single();
    if(saved.error||!saved.data?.id){failed++;r.__status='Failed';r.__error=saved.error?.message||'School could not be saved';if(problems.length<5)problems.push('Row '+(i+2)+': '+r.__error);continue}
    names.add(norm(name));if(code)codes.add(norm(code));
    const contactName=get('contact_name')||get('principal_name');
    if(contactName){
      const contact=await client.from('school_contacts').insert({school_id:saved.data.id,name:contactName,designation:get('contact_designation')||(get('principal_name')?'Headmaster / Principal':null),phone:get('contact_phone')||null,whatsapp_number:get('contact_whatsapp')||get('contact_phone')||null,is_primary:true,created_by:user?.id});
      if(contact.error){r.__status='School saved; contact failed';r.__error=contact.error.message;failed++;if(problems.length<5)problems.push('Row '+(i+2)+' contact: '+contact.error.message);continue}
    }
    added++;r.__status='Imported';
   }
   setRows([...rows]);setMessage('Finished: '+added+' schools added, '+skipped+' duplicates skipped, '+failed+' errors. Check row statuses below.');
   if(problems.length)setError(problems.join(' | '));
  }catch(e){setError(e instanceof Error?e.message:'Import failed.');}finally{setSaving(false)}
 }
 return <div className="min-h-screen flex bg-slate-50"><AppNav/><main className="flex-1 min-w-0 p-4 md:p-8"><div className="max-w-6xl mx-auto animate-fade-up">
  <Link href="/schools" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-700 mb-4"><ArrowLeft size={16}/>Back to Schools</Link>
  <div className="mb-6"><p className="text-sm font-semibold text-emerald-600 flex items-center gap-2"><FileSpreadsheet size={16}/>Bulk school setup</p><h1 className="text-3xl font-bold mt-1">Import schools from Excel</h1><p className="text-slate-500 mt-2 max-w-3xl">Upload an .xlsx, .xls or .csv file with 200–300 school rows. The app detects likely columns, lets you correct the matches, skips existing schools, and leaves GPS location blank.</p></div>
  {error&&<div className="mb-4 rounded-xl bg-red-50 border border-red-100 text-red-700 p-3 text-sm flex gap-2"><AlertTriangle size={18} className="shrink-0 mt-0.5"/><span>{error}</span></div>}
  {message&&<div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 p-3 text-sm flex gap-2"><CheckCircle2 size={18} className="shrink-0"/><span>{message}</span></div>}
  <section className="card p-5 md:p-6 mb-5"><div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();handleFile(e.dataTransfer.files?.[0])}} className="rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 p-7 md:p-10 text-center">
   <span className="section-icon bg-emerald-100 text-emerald-700 mx-auto mb-3"><FileSpreadsheet size={24}/></span><h2 className="font-bold text-lg">Upload your school Excel sheet</h2><p className="text-sm text-slate-500 mt-1">Excel workbook (.xlsx / .xls) or CSV. The first worksheet is used.</p>
   <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e=>handleFile(e.target.files?.[0])}/>
   <button onClick={()=>inputRef.current?.click()} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-5 py-3 font-semibold shadow-sm disabled:opacity-60">{busy?<Loader2 className="animate-spin" size={18}/>:<Upload size={18}/>} {busy?'Reading file…':'Choose Excel file'}</button>
   {fileName&&<p className="text-xs text-slate-500 mt-3">Selected: {fileName}</p>}
  </div></section>
  {headers.length>0&&<><section className="card p-5 mb-5"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4"><div><h2 className="font-bold text-lg">Check column matching</h2><p className="text-sm text-slate-500">Detected by header names; adjust any field that is mapped incorrectly. Location coordinates are intentionally not imported.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-sm">{validRows.length} school rows</span></div>
   <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{fields.map(f=><label key={f.key} className="block text-sm font-medium">{f.label}<select value={mapping[f.key]||''} onChange={e=>updateMap(f.key,e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"><option value="">— Not mapped —</option>{headers.map(h=><option key={h} value={h}>{h}</option>)}</select></label>)}</div>
   <div className="mt-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between"><p className="text-xs text-slate-500">Review the preview below before saving. 100% accuracy cannot be guaranteed when headers or source data are ambiguous.</p><button onClick={importRows} disabled={saving||!mapping.name||!validRows.length} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white px-5 py-3 font-semibold disabled:opacity-50">{saving?<Loader2 className="animate-spin" size={18}/>:<Save size={18}/>} {saving?'Importing schools…':'Import '+validRows.length+' schools'}</button></div>
  </section>
  <section className="card overflow-hidden"><div className="p-4 border-b border-slate-100"><h2 className="font-bold">Preview and import status</h2><p className="text-xs text-slate-500 mt-1">Showing first 25 rows. Original spreadsheet values are preserved.</p></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-3">#</th>{[...fields.filter(f=>mapping[f.key]).slice(0,5)].map(f=><th className="p-3 whitespace-nowrap" key={f.key}>{f.label.replace(' *','')}</th>)}<th className="p-3">Status</th></tr></thead><tbody>{rows.slice(0,25).map((r,i)=><tr key={i} className="border-t border-slate-100"><td className="p-3 text-slate-400">{i+2}</td>{fields.filter(f=>mapping[f.key]).slice(0,5).map(f=><td key={f.key} className="p-3 max-w-56 truncate">{r[mapping[f.key]]||'—'}</td>)}<td className="p-3 whitespace-nowrap">{r.__status||'Ready'}{r.__error&&<p className="text-xs text-red-600 max-w-48 whitespace-normal">{r.__error}</p>}</td></tr>)}</tbody></table></div></section></>}
  <div className="mt-5 flex items-start gap-2 text-xs text-slate-500"><Users size={16} className="shrink-0"/><p>School name and headmaster fields are stored on the school record. A teacher/contact record is created when a teacher or headmaster name is available. If your Excel has multiple teachers in separate rows for one school, review the sheet structure before importing; duplicate school rows are skipped rather than merged automatically.</p></div>
 </div></main></div>;
}
