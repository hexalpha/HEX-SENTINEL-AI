"use strict";
async function analyzeSubmission(form,data) {
  const record=selectedCase();
  if(!record)throw Error("Create or select a case before submitting evidence.");
  const route=form.dataset.route;
  if(route==="apk"){
    data.append("case_id",record.id);
    data.set("notes",data.get("evidence-notes")||"");
    const output=await request("/analyze/apk",data);
    setEntry(await api("/cases/"+record.id));
    state.evidence=output.evidence_id;
    paint();
    return output.duplicate?"Duplicate evidence · "+output.evidence_id:"APK retained · "+output.evidence_id;
  }
  const text=String(data.get("analysis-text")||"");
  if(!text.trim())throw Error("Enter text or a URL.");
  const format=data.get("analysis-kind");
  const kind=format==="auto"?detect(text):format;
  if(route==="message"&&!["message","email"].includes(kind))throw Error("Use URL and domain analysis for addresses.");
  if(!offline){
    const output=await request("/analyze/"+(route==="url"&&kind==="website"?"website":route),{
      case_id:record.id,text,kind:route==="url"&&kind==="message"?"auto":kind,source:data.get("source")||"Analyst submission",
      notes:data.get("evidence-notes")||""});
    setEntry(await api("/cases/"+record.id));
    state.evidence=output.evidence_id;
    paint();
    return output.duplicate?"Duplicate evidence · "+output.evidence_id:"Evidence retained · "+output.evidence_id;
  }
  const hash=await digest(text);
  const duplicate=record.evidence.find(entry=>hash?entry.sha256===hash:entry.text===text);
  if(duplicate){state.evidence=duplicate.id;paint();return "Evidence already present · "+duplicate.id;}
  const id="EV-DEMO-"+shortId(), finalKind=route==="url"&&kind==="message"?"url":kind;
  const analysis=analyzeOffline(finalKind,text,id);
  record.evidence.push({id,kind:finalKind,text,sha256:hash,source:"Offline analyst input",filename:finalKind==="email"?"input.eml":"input.txt",
    disposition:"offline demonstration",created_at:now(),analysis});
  state.evidence=id;
  persist();paint();
  return "Offline evidence analysed · "+id;
}
async function saveCase(formId,values){
  const payload={title:values.get("title").trim(),priority:values.get("priority"),notes:values.get("notes"),
    tags:values.get("tags").split(",").map(value=>value.trim().slice(0,40)).filter(Boolean).slice(0,12)};
  if(payload.title.length<3)throw Error("Enter a case title with at least three characters.");
  const editing=formId==="case-edit",current=selectedCase();
  let result;
  if(editing)payload.status=values.get("status");
  else payload.synthetic=offline||values.get("synthetic")==="true";
  if(offline){
    result=editing?{...current,...payload}:{...payload,id:"HEX-DEMO-"+shortId(),status:"Open",created_at:now(),evidence:[]};
    setEntry(result);persist();
  }else{
    result=await request(editing?"/cases/"+current.id:"/cases",payload,editing?"PATCH":"POST");
    setEntry(result);
  }
  await openCase(result.id);
  return editing?"Case updated":"Case created";
}
async function submitForm(form) {
  const data=new FormData(form),record=selectedCase();
  if(form.id==="case-filter"){
    state.query=data.get("case-query");state.caseStage=data.get("case-stage");state.band=data.get("case-band");paint();return;
  }
  if(form.id==="login-form"){
    state.token=data.get("token");
    try{
      state.role=(await api("/session")).role;
      await reloadCases();await show("overview");
      return "Signed in as "+state.role;
    }catch(error){
      state.token="";state.role="";throw error;
    }
  }
  if(form.id==="case-create"||form.id==="case-edit")return saveCase(form.id,data);
  if(form.id==="analyze")return analyzeSubmission(form,data);
  if(form.id==="upload-evidence"){
    if(!record)throw Error("Select a case before uploading evidence.");
    data.set("case_id",record.id);data.set("source",data.get("upload-source"));data.set("notes",data.get("upload-notes"));
    const response=await request("/evidence/upload",data);
    setEntry(await api("/cases/"+record.id));paint();
    return (response.duplicate?"Duplicate evidence · ":"Evidence retained · ")+response.evidence_id;
  }
  if(form.id==="osint-form"){
    if(offline){
      state.osintQuery=data.get("indicator")||"";
      const term=state.osintQuery.trim().toLowerCase();
      const match=term&&state.cases.find(candidate=>[candidate.domain,candidate.title,candidate.tag].some(value=>value?.toLowerCase().includes(term)));
      if(match){const query=state.osintQuery;active(match.id);state.osintQuery=query;}
      paint();return;
    }
    const selection=$("#indicator")?.selectedOptions[0];
    if(!record||!selection)throw Error("Select a case with a domain indicator first.");
    state.intel[record.id]=await request("/osint/search",{case_id:record.id,evidence_id:selection.dataset.ref,indicator:selection.value});
    paint();return "DNS lookup status · "+state.intel[record.id].status;
  }
  return submitAdvanced(form,data,record);
}
async function handleAction(action,id,control) {
  const record=selectedCase();
  if($("#command").open&&!["search","search-close"].includes(action))$("#command").close();
  switch(action) {
    case "route": return show(id);
    case "open": return openCase(id);
    case "menu": $("#rail").classList.toggle("open");return;
    case "search": return commandSearch();
    case "search-close": return $("#command").close();
    case "day": state.day=state.day===id?"":id;return paint();
    case "filter-risk": state.band=id;state.query="";state.caseStage="";return show("cases");
    case "clear-filters": state.query="";state.band="";state.caseStage="";return paint();
    case "sample-case": return openCase(id,state.route);
    case "fill-sample": {
      const fixture=HEX_DEMO.find(entry=>entry.id===id);
      $("#analysis-text").value=fixture.input;
      $("#analysis-kind").value=fixture.type==="website"?"website":"auto";
      $("#analysis-text").focus();
      return;
    }
    case "graph-mode": state.graphMode=id;paint();$("#work [data-action='graph-mode'][aria-pressed='true']")?.focus();return;
    case "reset-replay": resetReplay();return paint();
    case "play": return playReplay();
    case "explain":
      if(!record)throw Error("Select a case before requesting an explanation.");
      if(offline)state.aiFixture=true;
      else state.explanations[record.id]=await request("/explain",{case_id:record.id,use_local_model:true});
      return paint();
    case "health":
      if(offline){touchToast("Offline workspace ready. Integrations are unavailable.");return;}
      await getHealth();touchToast("System state refreshed.");return;
    case "verify": {
      const result=await api("/evidence/"+id+"/verify");
      touchToast(result.valid?"Original SHA-256 matches the acquisition record.":"Integrity mismatch. Review this evidence item.");
      return;
    }
    case "report":
      if(!record)throw Error("Select a case before exporting.");
      if(offline)exportDemo(record,id);
      else {
        const report=await request("/reports/generate",{case_id:record.id,format:id,profile:state.reportProfile,browser_transport:true});
        if(report.encoding!=="base64"||!report.content)throw Error("The service returned an empty or unsupported report.");
        const bytes=Uint8Array.from(atob(report.content),letter=>letter.charCodeAt(0));
        saveFile(new Blob([bytes],{type:report.media_type}),id,report.filename.replace(/\.(pdf|json|csv|html)$/,""));
      }
      touchToast(id.toUpperCase()+" report downloaded.");return;
    case "demo-login": return show("overview",false);
    case "logout":
      state.token="";state.role="";state.cases=[];state.explanations={};state.graphs={};state.ledger={};state.intel={};
      state.observations={};state.matches={};state.answers={};state.risks={};state.revisions={};state.historyRecords=[];
      state.savedSearches=[];state.historyFilters={q:"",kind:"",start:"",end:""};state.focusedEvidence="";active("");
      return show("login",false);
    default: return advancedAction(action,id,control,record);
  }
}
document.addEventListener("click",async event=>{
  const control=event.target.closest("[data-action]");
  if(!control)return;
  if(control.dataset.action!=="menu")$("#rail").classList.remove("open");
  try{control.disabled=true;await handleAction(control.dataset.action,control.dataset.id,control);}
  catch(error){touchToast(error.message||"The action could not complete.");}
  finally{control.disabled=false;}
});
document.addEventListener("submit",async event=>{
  event.preventDefault();
  const form=event.target, button=$('button[type="submit"]',form),status=$("[data-form-status]",form);
  if(button)button.disabled=true;
  if(status)status.textContent="Working…";
  try{
    const notice=await submitForm(form);
    if(notice)touchToast(notice);
    if(status)status.textContent=notice||"";
  }catch(error){
    const message=error.message||"The request could not complete.";
    if(status)status.textContent=message;
    else touchToast(message);
  }finally{if(button)button.disabled=false;}
});
document.addEventListener("change",event=>{
  const target=event.target;
  if(target.id==="active-case")openCase(target.value,state.route).catch(error=>touchToast(error.message));
  if(target.id==="evidence-select"){state.evidence=target.value;paint();$("#evidence-select")?.focus();}
  if(target.id==="graph-select")selectNode(target.value);
  if(target.id==="graph-filter"){state.graphFilter=target.value;state.node="";paint();$("#graph-filter")?.focus();}
  if(target.id==="graph-query"){state.graphQuery=target.value;state.node="";paint();$("#graph-query")?.focus();}
  if(target.id==="report-profile"){state.reportProfile=target.value;paint();$("#report-profile")?.focus();}
});
document.addEventListener("input",event=>{if(event.target.id==="command-query")commandSearch(event.target.value);});
document.addEventListener("keydown",event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"&&(offline||state.role)){
    event.preventDefault();commandSearch();
  }
  if(event.key==="Enter"&&event.target.id==="command-query"){
    event.preventDefault();$("#command-results button")?.click();
  }
});
window.addEventListener("hashchange",()=>show(location.hash.slice(1),true,false));
async function initialize(){
  if(offline){
    try{state.savedSearches=JSON.parse(localStorage.getItem("hex-saved-search")||"[]");}catch{}
    try{
      const saved=localStorage.getItem(storedKey);
      if(saved){const parsed=JSON.parse(saved);if(Array.isArray(parsed))state.cases=parsed;}
    }catch{}
    if(!state.cases.length)state.cases=seedCases();
    active(state.cases[0].id);
    state.role="Demo analyst";
    await Promise.all(state.cases.flatMap(entry=>entry.evidence.map(async item=>{
      if(!item.sha256&&typeof item.text==="string")item.sha256=await digest(item.text);
    })));
    await show(location.hash.slice(1)||"overview",true,false);
  }else{
    await show("login",false,false);
    getHealth().catch(error=>touchToast(error.message));
  }
}
initialize().catch(error=>{ $("#work").textContent="Workspace initialization failed. "+error.message; });

