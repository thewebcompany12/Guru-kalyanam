'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, FileSpreadsheet, Upload, AlertTriangle, Loader2, Save, Users } from 'lucide-react';
import AppNav from '@/components/AppNav';
import { createClient } from '@/lib/supabase';

type Row = { [key: string]: string | undefined; __status?: string; __error?: string };
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
  if(!confirm('Process '+ready.length+' spreadsheet rows? Matching schools will be updated, unmatched schools will be created, contact details will be added/updated, and GPS/location will not be changed or created.'))return;
  setSaving(true);setError('');setMessage('');
  try{
   const client=createClient();
   const existing=await client.from('schools').select('id,name,udise_code,principal_name,district,state,address,school_type');
   if(existing.error)throw new Error(existing.error.message);
   const contactsResult=await client.from('school_contacts').select('id,school_id,name,designation,phone,whatsapp_number,is_primary');
   if(contactsResult.error)throw new Error(contactsResult.error.message);
   const schoolList:any[]=(existing.data||[]).map((s:any)=>({...s}));
   const contactsBySchool=new Map<string,any[]>();
   for(const c of (contactsResult.data||[])){const list=contactsBySchool.get(c.school_id)||[];list.push({...c});contactsBySchool.set(c.school_id,list);}
   const normName=(v:any)=>norm(String(v||''));
   const findSchool=(name:string,code:string)=> {
    if(code){const byCode=schoolList.find(s=>normName(s.udise_code)===normName(code));if(byCode)return byCode;}
    return schoolList.find(s=>normName(s.name)===normName(name));
   };
   let createdSchools=0,updated=0,contactsAdded=0,contactsUpdated=0,unmatched=0,failed=0;
   const problems:string[]=[];
   const {data:{user}}=await client.auth.getUser();
   for(let i=0;i<ready.length;i++){
    const r=ready[i];const get=(k:Field)=>String(r[mapping[k]||'']||'').trim();
    const name=get('name'),code=get('udise_code');
    let school=findSchool(name,code);
    const incomingType=get('school_type').toUpperCase().replace(/[ -]+/g,'_');
    const schoolType=['PRIMARY','UPPER_PRIMARY','SECONDARY','SENIOR_SECONDARY','OTHER'].includes(incomingType)?incomingType:
      /upper|उच्च/i.test(incomingType)?'UPPER_PRIMARY':/senior|higher secondary/i.test(incomingType)?'SENIOR_SECONDARY':/secondary|माध्यमिक/i.test(incomingType)?'SECONDARY':/primary|प्राथमिक/i.test(incomingType)?'PRIMARY':'';
    if(!school){
      const payload:any={name,udise_code:code||null,principal_name:get('principal_name')||null,district:get('district')||null,state:get('state')||'Uttar Pradesh',address:get('address')||null,school_type:schoolType||'OTHER',latitude:null,longitude:null};
      const {data:newSchool,error:createError}=await client.from('schools').insert(payload).select('id,name,udise_code,principal_name,district,state,address,school_type').single();
      if(createError||!newSchool){failed++;unmatched++;r.__status='School creation failed';r.__error=createError?.message||'Could not create school';if(problems.length<5)problems.push('Row '+(i+2)+': '+r.__error);continue;}
      school={...newSchool};schoolList.push(school);createdSchools++;
    }else{
      const patch:any={};
      const setProvided=(key:string,value:string)=>{if(value&&String(school[key]??'').trim()!==value)patch[key]=value;};
      setProvided('udise_code',code);
      setProvided('principal_name',get('principal_name'));
      setProvided('district',get('district'));
      setProvided('state',get('state'));
      setProvided('address',get('address'));
      if(schoolType&&schoolType!=='OTHER'&&school.school_type!==schoolType)patch.school_type=schoolType;
      if(Object.keys(patch).length){
        const saved=await client.from('schools').update(patch).eq('id',school.id);
        if(saved.error){failed++;r.__status='School update failed';r.__error=saved.error.message;if(problems.length<5)problems.push('Row '+(i+2)+': '+saved.error.message);continue;}
        Object.assign(school,patch);updated++;
      }
    }
    const contactName=get('contact_name')||get('principal_name');
    const designation=get('contact_designation')||(get('principal_name')?'Headmaster / Principal':'');
    const phone=get('contact_phone'),whatsapp=get('contact_whatsapp')||phone;
    const hasContactInput=!!(contactName||designation||phone||whatsapp);
    if(hasContactInput){
      const list=contactsBySchool.get(school.id)||[];
      const incomingName=normName(contactName),incomingPhone=normName(phone);
      let contact=list.find((c:any)=>(incomingName&&normName(c.name)===incomingName)||(incomingPhone&&normName(c.phone)===incomingPhone)||(incomingPhone&&normName(c.whatsapp_number)===incomingPhone));
      if(!contact){
        const {data:created,error:contactError}=await client.from('school_contacts').insert({
          school_id:school.id,name:contactName||designation||phone||'School contact',
          designation:designation||null,phone:phone||null,whatsapp_number:whatsapp||null,
          is_primary:list.length===0,created_by:user?.id
        }).select('id,school_id,name,designation,phone,whatsapp_number,is_primary').single();
        if(contactError||!created){failed++;r.__status='School matched; contact failed';r.__error=contactError?.message||'Contact could not be saved';if(problems.length<5)problems.push('Row '+(i+2)+' contact: '+r.__error);continue;}
        list.push(created);contactsBySchool.set(school.id,list);contactsAdded++;
      }else{
        const contactPatch:any={};
        if(contactName&&String(contact.name||'').trim()!==contactName)contactPatch.name=contactName;
        if(designation&&String(contact.designation||'').trim()!==designation)contactPatch.designation=designation;
        if(phone&&String(contact.phone||'').trim()!==phone)contactPatch.phone=phone;
        if(whatsapp&&String(contact.whatsapp_number||'').trim()!==whatsapp)contactPatch.whatsapp_number=whatsapp;
        if(Object.keys(contactPatch).length){
          const {error:contactError}=await client.from('school_contacts').update(contactPatch).eq('id',contact.id);
          if(contactError){failed++;r.__status='School matched; contact update failed';r.__error=contactError.message;if(problems.length<5)problems.push('Row '+(i+2)+' contact: '+contactError.message);continue;}
          Object.assign(contact,contactPatch);contactsUpdated++;
        }
      }
    }
    r.__status='School/contact details processed';
   }
   setRows([...rows]);
   setMessage('Finished: '+createdSchools+' new schools created, '+updated+' existing school records updated, '+contactsAdded+' contacts added, '+contactsUpdated+' existing contacts edited, '+failed+' errors. GPS/location was not changed; new schools have no GPS location.');
   if(problems.length)setError(problems.join(' | '));
  }catch(e){setError(e instanceof Error?e.message:'Import failed.');}finally{setSaving(false)}
 }
 return <div className="min-h-screen flex bg-slate-50"><AppNav/><main className="flex-1 min-w-0 p-4 md:p-8"><div className="max-w-6xl mx-auto animate-fade-up">
  <Link href="/schools" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-700 mb-4"><ArrowLeft size={16}/>Back to Schools</Link>
  <div className="mb-6"><p className="text-sm font-semibold text-emerald-600 flex items-center gap-2"><FileSpreadsheet size={16}/>Bulk school setup</p><h1 className="text-3xl font-bold mt-1">Import schools from Excel</h1><p className="text-slate-500 mt-2 max-w-3xl">Upload an .xlsx, .xls or .csv file. Matching schools are updated, new schools are created when no match is found, and contact details are added or edited. GPS/location is never imported.</p></div>
  {error&&<div className="mb-4 rounded-xl bg-red-50 border border-red-100 text-red-700 p-3 text-sm flex gap-2"><AlertTriangle size={18} className="shrink-0 mt-0.5"/><span>{error}</span></div>}
  {message&&<div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 p-3 text-sm flex gap-2"><CheckCircle2 size={18} className="shrink-0"/><span>{message}</span></div>}
  <section className="card p-5 md:p-6 mb-5"><div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();handleFile(e.dataTransfer.files?.[0])}} className="rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 p-7 md:p-10 text-center">
   <span className="section-icon bg-emerald-100 text-emerald-700 mx-auto mb-3"><FileSpreadsheet size={24}/></span><h2 className="font-bold text-lg">Upload your school Excel sheet</h2><p className="text-sm text-slate-500 mt-1">Excel workbook (.xlsx / .xls) or CSV. The first worksheet is used.</p>
   <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e=>handleFile(e.target.files?.[0])}/>
   <button onClick={()=>inputRef.current?.click()} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-5 py-3 font-semibold shadow-sm disabled:opacity-60">{busy?<Loader2 className="animate-spin" size={18}/>:<Upload size={18}/>} {busy?'Reading file…':'Choose Excel file'}</button>
   {fileName&&<p className="text-xs text-slate-500 mt-3">Selected: {fileName}</p>}
  </div></section>
  {headers.length>0&&<><section className="card p-5 mb-5"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4"><div><h2 className="font-bold text-lg">Check column matching</h2><p className="text-sm text-slate-500">Detected by header names; adjust any field that is mapped incorrectly. Existing schools are edited and unmatched schools are created. GPS/location is never changed.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-sm">{validRows.length} school rows</span></div>
   <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{fields.map(f=><label key={f.key} className="block text-sm font-medium">{f.label}<select value={mapping[f.key]||''} onChange={e=>updateMap(f.key,e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"><option value="">— Not mapped —</option>{headers.map(h=><option key={h} value={h}>{h}</option>)}</select></label>)}</div>
   <div className="mt-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between"><p className="text-xs text-slate-500">Review the preview below before saving. 100% accuracy cannot be guaranteed when headers or source data are ambiguous.</p><button onClick={importRows} disabled={saving||!mapping.name||!validRows.length} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white px-5 py-3 font-semibold disabled:opacity-50">{saving?<Loader2 className="animate-spin" size={18}/>:<Save size={18}/>} {saving?'Saving school and contact changes…':'Create new + update existing'}</button></div>
  </section>
  <section className="card overflow-hidden"><div className="p-4 border-b border-slate-100"><h2 className="font-bold">Preview and import status</h2><p className="text-xs text-slate-500 mt-1">Showing first 25 rows. Original spreadsheet values are preserved.</p></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-3">#</th>{[...fields.filter(f=>mapping[f.key]).slice(0,5)].map(f=><th className="p-3 whitespace-nowrap" key={f.key}>{f.label.replace(' *','')}</th>)}<th className="p-3">Status</th></tr></thead><tbody>{rows.slice(0,25).map((r,i)=><tr key={i} className="border-t border-slate-100"><td className="p-3 text-slate-400">{i+2}</td>{fields.filter(f=>mapping[f.key]).slice(0,5).map(f=><td key={f.key} className="p-3 max-w-56 truncate">{r[mapping[f.key]]||'—'}</td>)}<td className="p-3 whitespace-nowrap">{r.__status||'Ready'}{r.__error&&<p className="text-xs text-red-600 max-w-48 whitespace-normal">{r.__error}</p>}</td></tr>)}</tbody></table></div></section></>}
  <div className="mt-5 flex items-start gap-2 text-xs text-slate-500"><Users size={16} className="shrink-0"/><p>Rows are matched by UDISE code first, then school name. Matching schools are updated from non-empty spreadsheet values; unmatched rows create new school records. Contact details are added or update the matching contact. GPS/location is never imported or modified.</p></div>
 </div></main></div>;
}
