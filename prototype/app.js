"use strict";
const storedKey="hex-sentinel-offline-v1";
const state={cases:[],route:offline?"overview":"login",active:"",evidence:"",role:"",token:"",
  query:"",caseStage:"",band:"",day:"",node:"",graphMode:"2d",graphs:{},
  events:[],timers:[],replayCase:"",intel:{},osintQuery:"",explanations:{},ledger:{},aiFixture:false,health:null,
  observations:{},matches:{},answers:{},risks:{},revisions:{},historyRecords:[],savedSearches:[],historyNext:null,
  historyFilters:{q:"",kind:"",start:"",end:""},reportProfile:"technical",graphFilter:"",graphQuery:"",focusedEvidence:""};
const selectedCase=()=>state.cases.find(entry=>entry.id===state.active);
const shortId=()=>globalThis.crypto.randomUUID().replaceAll("-","").slice(0,12).toUpperCase();
const screens={overview,cases:casesView,newcase:()=>caseForm(false),case:()=>caseForm(true),message:()=>analyzeView("message"),
  url:()=>analyzeView("url"),apk:()=>analyzeView("apk"),risk:riskView,sandbox:sandboxView,osint:osintView,
  reviews:()=>osintView(true),graph:graphView,vault:vaultView,assistant:assistantView,reports:reportsView,
  intelligence:intelligenceView,system:systemView,audit:()=>systemView(true),login:loginView,domain:domainView,website:websiteView,
  apps:appsView,campaign:campaignView,history:historyView,reputation:reputationView,analytics:analyticsView,settings:settingsView};
let graphFocus=null,globeFocus=null,toastTime, requestVersion=0;
function touchToast(text) {
  const element=$("#toast");
  element.textContent=text;
  element.classList.add("visible");
  clearTimeout(toastTime);
  toastTime=setTimeout(()=>element.classList.remove("visible"),4200);
}
function persist() {
  try{localStorage.setItem(storedKey,JSON.stringify(state.cases));}
  catch{touchToast("Browser storage is unavailable. Changes are retained for this session.");}
}
function navButton([route,icon,title]) {
  const current=state.route===route?' aria-current="page"':"";
  return '<button class="nav-item" data-action="route" data-id="'+route+'" '+current+'><span class="nav-icon" aria-hidden="true">'+icon+'</span><span>'+title+'</span></button>';
}
function paint() {
  const title=ROUTES.find(item=>item[0]===state.route)?.[2]||({newcase:"New investigation",case:"Case record",login:"Access control"})[state.route];
  $("#rail").innerHTML='<button class="brand btn ghost" data-action="route" data-id="overview"><span class="brandmark">H</span><span><strong>HEX SENTINEL AI</strong><small>INVESTIGATION DESK / 2.0</small></span></button>'+
    (offline||state.role?NAV.map(([heading,entries])=>'<div class="nav-label">'+heading+'</div><nav aria-label="'+heading+'">'+entries.map(navButton).join("")+'</nav>').join(""):"")+
    '<div class="rail-footer"><div class="status-tile small"><span class="status-dot"></span>'+safe(offline?"Offline demo ready":state.health?.service==="ready"?"Local service ready":"Local service pending")+
    '<br><span class="quiet">PS01 · Evidence workspace</span></div></div>';
  $("#topbar").innerHTML='<div class="row">'+btn("☰ Menu","menu",'aria-controls="rail"',"menu-button")+
    '<span class="crumb">Investigation workspace <b>/ &nbsp;'+safe(title)+'</b></span></div><div class="top-right">'+
    ((offline||state.role)?'<button class="btn search-button" data-action="search">Search workspace <kbd>Ctrl K</kbd></button>':"")+
    (offline?pill("Offline demo","demo"):state.role?pill(state.role,"live"):pill("Access locked"))+
    ((offline||state.role)?link("New case","newcase","primary"):"")+'</div>';
  $("#work").innerHTML=screens[state.route]();
  if(state.route==="overview") cameraArt($("#hero-art"));
  if(state.route==="analytics")globeFocus=globeDisplay($("#threat-globe"),state.cases);
  if(state.route==="intelligence") paintLocations($("#location-canvas"),state.cases);
  if(state.route==="graph"){
    const data=graphSelection(selectedCase());
    graphFocus=drawGraph($("#graph-canvas"),data,state.graphMode,selectNode);
    if(state.node)graphFocus(state.node);
  }
}
function active(id) {
  if(state.active===id)return;
  state.active=id;
  state.evidence="";
  state.node="";
  state.osintQuery="";
  state.aiFixture=false;
  resetReplay();
}
function selectRoute(route,{preset=true}={}) {
  return show(route,preset);
}
async function show(route,preset=true,updateHash=true) {
  if(!Object.hasOwn(screens,route))route="overview";
  if(!offline&&!state.role&&route!=="system")route="login";
  if(offline&&preset){
    const types={message:["message","email"],url:["website","url","app_store"],apk:["apk"],apps:["apk"],sandbox:["website"],website:["website"]}[route];
    if(types && selectedCase()?.id?.match(/^HEX-\d{4}$/) && !selectedCase()?.evidence?.some(entry=>types.includes(entry.kind))){
      active(state.cases.find(entry=>entry.evidence?.some(item=>types.includes(item.kind)))?.id||state.active);
    }
  }
  state.route=route;
  const version=++requestVersion;
  if(updateHash && location.hash!=="#"+route) history.pushState(null,"","#"+route);
  paint();
  document.documentElement.scrollTop=0;
  $("#work").focus({preventScroll:true});
  if(!offline&&state.role&&state.active){
    try {
      if(route==="graph"||route==="intelligence"){
        state.graphs[state.active]=await api("/cases/"+state.active+"/graph");
      }else if(route==="audit"){
        state.ledger[state.active]=await api("/cases/"+state.active+"/audit");
      }else if(route==="campaign"){
        state.matches[state.active]=await api("/cases/"+state.active+"/matches");
      }else if(route==="risk"){
        state.risks[state.active]=await api("/cases/"+state.active+"/risk");
      }else if(["osint","assistant","domain","website","apps","reviews","reputation"].includes(route)){
        const id=state.active, collection=await api("/cases/"+id+"/enrichment");
        state.observations[id]=collection;
        if(route==="osint")state.intel[id]=collection.filter(entry=>entry.kind==="osint").at(-1);
        if(route==="assistant")state.explanations[id]=collection.filter(entry=>entry.kind==="explanation").at(-1);
      }else if(route==="history"){
        state.savedSearches=await api("/history/saved");
        await loadStoredHistory();
      }else return;
      if(version===requestVersion)paint();
    }catch(error){touchToast(error.message);}
  }
}
function setEntry(record) {
  const index=state.cases.findIndex(entry=>entry.id===record.id);
  if(index<0)state.cases.unshift(record);
  else state.cases[index]={...state.cases[index],...record};
  return state.cases.find(entry=>entry.id===record.id);
}
async function openCase(id,route="case") {
  if(!id){active("");return show(route,false);}
  if(!offline)setEntry(await api("/cases/"+id));
  active(id);
  await show(route,false);
}
function selectNode(id) {
  state.node=id;
  const data=graphSelection(selectedCase());
  if($("#graph-select"))$("#graph-select").value=id;
  if($("#node-detail"))$("#node-detail").innerHTML=nodeDetail(data,data.nodes.find(node=>node.id===id));
  if(graphFocus)graphFocus(id);
}
function graphData(record) {
  if(!record)return {nodes:[],edges:[],related_cases:[]};
  if(!offline)return state.graphs[record.id]||{nodes:[],edges:[],related_cases:[]};
  const signature=entry=>entry.type+" "+entry.value;
  const nodes=unique(record.evidence.flatMap(entry=>entry.analysis.indicators),signature).map((entry,index)=>
    ({id:"demo-"+index,type:entry.type,value:entry.value}));
  const keys=new Map(nodes.map(node=>[signature(node),node.id]));
  const edges=state.cases.flatMap(other=>(other.evidence||[]).flatMap(entry=>entry.analysis.indicators.
    filter(ind=>keys.has(signature(ind))).map(ind=>({...ind,id:keys.get(signature(ind)),case_id:other.id,
    relation:"observed_in",confidence:"direct"}))));
  return {nodes,edges,related_cases:[...new Set(edges.map(edge=>edge.case_id).filter(id=>id!==record.id))]};
}
async function api(path,init={}) {
  const headers=new Headers(init.headers||{});
  if(state.token)headers.set("Authorization","Bearer "+state.token);
  if(init.body&&!(init.body instanceof FormData))headers.set("Content-Type","application/json");
  const response=await fetch("/api"+path,{...init,headers,cache:"no-store"});
  if(!response.ok){
    const out=await response.json().catch(()=>({}));
    const detail=Array.isArray(out.detail)?out.detail.map(entry=>entry.msg).join(". "):out.detail;
    throw Error(detail||"Request failed ("+response.status+").");
  }
  return response.json();
}
const request=(path,body,method="POST")=>api(path,{method,body:body instanceof FormData?body:JSON.stringify(body)});
async function reloadCases() {
  const cases=await api("/cases");
  state.cases=cases.map(record=>({...state.cases.find(entry=>entry.id===record.id),...record}));
  if(!state.active&&cases[0]){active(cases[0].id);setEntry(await api("/cases/"+state.active));}
}
async function getHealth() {
  state.health=await api("/system/health");
  paint();
}
const replayEvidence=record=>record?.evidence?.find(entry=>entry.analysis.details.host==="wallet-review.example");
function replayRecords(record){
  const evidence_ref=replayEvidence(record)?.id||"EV-DEMO-05";
  return HEX_EVENTS.map(([offset_ms,category,source,destination,method,status_code,detail,severity],index)=>
    ({id:"SBX-DEMO-"+(index+1),timestamp:new Date(Date.parse("2026-11-22T05:47:00Z")+offset_ms).toISOString(),
      offset_ms,category,source,destination,method,status_code,detail,severity,evidence_ref,status:"fixture",provenance:"synthetic"}));
}
function resetReplay() {
  state.timers.forEach(clearTimeout);state.timers=[];state.events=[];state.replayCase="";
}
async function playReplay() {
  resetReplay();
  const record=selectedCase();
  let records=offline?replayRecords(record):null;
  if(!offline){
    const fixture=replayEvidence(record);
    if(!record?.synthetic||!fixture)throw Error("Use a synthetic case with the wallet-review.example website evidence.");
    const created=await request("/sandbox/run",{case_id:record.id,evidence_id:fixture.id});
    records=(await api("/sandbox/"+created.job_id+"/events?case_id="+record.id)).events;
  }
  state.replayCase=record?.id||"";
  paint();
  $("#play").disabled=true;
  records.forEach((entry,index)=>state.timers.push(setTimeout(()=>{
    state.events.push(entry);
    if($("#event-list"))$("#event-list").innerHTML=eventRows();
    if($("#event-count"))$("#event-count").innerHTML=pill(state.events.length+" events","demo");
    if(index===records.length-1&&$("#play"))$("#play").disabled=false;
  },entry.offset_ms)));
}
function demoReport(record){
  const evidence=record.evidence||[],risk=riskOf(record);
  return {provenance:"offline demonstration",profile:state.reportProfile,report_version:"2.0",case_id:record.id,title:record.title,case_status:record.status,analyst_notes:record.notes,
    generated_at:now(),summary:risk?"Highest evidence assessment "+risk.score+"/100 ("+risk.band+"). Independent verification required.":"This case has no assessed evidence.",
    evidence:evidence.map(({text,analysis,...entry})=>entry),analysis:evidence.map(entry=>entry.analysis),
    sandbox:record.type==="website"?replayRecords(record):[],osint:record.complaint?[{provenance:"synthetic",claim:record.complaint,
    url:"https://complaints.example/"+record.id.toLowerCase(),corroboration:"none",retrieval:"fixture only",evidence_ref:evidence[0]?.id}]:[],
    reviews:fixtureReviews(record),graph:graphData(record),campaign_matches:offlineMatches(record),domain_fixture:domainFixture(record),
    explanation:{mode:"deterministic",references:risk?.contributions.map(entry=>entry.evidence_ref)||[]},
    limitations:["Offline demonstration. No live browser, reputation query, or model inference.",
    "Risk prioritises analyst review. Exact overlap establishes co-occurrence."],
    recommendations:["Preserve the acquired original and verify independent source records.","Confirm payment destination and claimed identity through a trusted channel."],
    custody:evidence.map(entry=>({action:"demo acquisition",timestamp:entry.created_at,evidence_ref:entry.id,sha256:entry.sha256}))};
}
function exportDemo(record,format) {
  const report=demoReport(record);
  const name=record.id+"-"+state.reportProfile+"-demo";
  if(format==="json"){saveFile(JSON.stringify(report,null,2),format,name);return;}
  if(format==="csv"){
    const rows=[["case_id","evidence_id","indicator_type","value"],...report.analysis.flatMap(value=>value.indicators.map(row=>[record.id,row.evidence_ref,row.type,row.value]))];
    const quote=value=>'"'+String(value).replace(/^([=+@-])/,"'$1").replaceAll('"','""')+'"';
    saveFile(rows.map(row=>row.map(quote).join(",")).join("\r\n"),format,name);return;
  }
  if(format==="html"){
    const content='<!doctype html><meta charset="utf-8"><title>HEX SENTINEL AI</title><style>body{font:16px system-ui;max-width:65em;margin:2em auto;padding:1em}</style>'+
      '<h1>'+safe(record.title)+'</h1><p>HEX SENTINEL AI · '+safe(state.reportProfile)+' · Offline demonstration</p><p>'+safe(report.summary)+'</p>'+
      '<h2>Evidence</h2><ul>'+report.evidence.map(it=>'<li>'+safe(it.id+" · "+it.filename+" · "+it.sha256)+'</li>').join("")+
      '</ul><h2>Limitations</h2><ul>'+report.limitations.map(value=>'<li>'+safe(value)+'</li>').join("")+'</ul>';
    saveFile(content,format,name);return;
  }
  const content=[
    [state.reportProfile==="technical"?"Technical case overview":"Executive case overview",[record.id+" / "+record.title,"Provenance: OFFLINE DEMO / FICTIONAL FIXTURES",report.summary]],
    ["Evidence inventory and SHA-256",report.evidence.map(entry=>entry.id+" / "+entry.filename+" / "+entry.source+" / "+(entry.sha256||"unavailable"))],
    ["Static findings",report.analysis.flatMap(analysis=>analysis.findings.map(entry=>entry.rule_id+" / "+entry.evidence_ref+" / "+entry.title+" / "+entry.snippet))],
    ["Extracted identifiers",report.analysis.flatMap(analysis=>analysis.indicators.map(entry=>entry.type+" / "+entry.value+" / "+entry.evidence_ref))],
    ["Sandbox observations",report.sandbox.map(entry=>"Synthetic / "+entry.id+" / "+entry.category+" / "+entry.evidence_ref)],
    ["OSINT and source references",report.osint.map(entry=>"Synthetic / "+entry.claim+" / "+entry.url)],
    ["Public review analysis",report.reviews.map(entry=>"Synthetic / "+entry.stance+" / "+entry.published_at+" / "+entry.text)],
    ["Risk explanation",report.analysis.flatMap(analysis=>[analysis.risk.score+"/100 / "+analysis.risk.band+" / "+analysis.risk.confidence+" confidence",
      ...analysis.risk.contributions.map(entry=>"+"+entry.weight+" / "+entry.rule_id+" / "+entry.evidence_ref),...analysis.risk.missing.map(value=>"Missing / "+value)])],
    ["Historical case correlations",report.campaign_matches.map(row=>row.match_id+" / "+row.related_case_id+" / "+row.similarity+" of 100 similarity")],
    ["Domain intelligence fixture",report.domain_fixture?.timeline.map(row=>row.type+" / "+row.at+" / "+row.record_id)||[]],
    ["Entity relationship evidence",report.graph.edges.map(entry=>entry.case_id+" / "+entry.evidence_ref+" / "+entry.value)],
    ["Deterministic explanation",[report.summary]],["Limitations and uncertainty",report.limitations],
    ["Investigation recommendations",report.recommendations],
    ["Custody demonstration",report.custody.map(entry=>entry.timestamp+" / "+entry.action+" / "+entry.evidence_ref)],
  ];
  const selected=state.reportProfile==="technical"?content:content.filter(([label])=>
    !["Sandbox observations","Custody demonstration","Entity relationship evidence","Domain intelligence fixture","Static findings"].includes(label));
  saveFile(makePDF(selected.map(([label,lines])=>[label,lines.length?lines:["No records in this demo section."]])),format,name);
}
function commandSearch(query="") {
  const dialog=$("#command");
  if(!dialog.open){
    dialog.innerHTML='<div class="panel-title"><h2>Search workspace</h2>'+btn("Close","search-close")+'</div>'+
      field("Find a tool or case","command-query",input("command-query","",'placeholder="Try risk, sandbox or electricity"'))+
      '<div class="search-results" id="command-results"></div>';
    dialog.showModal();$("#command-query").focus();
  }
  const needle=query.trim().toLowerCase();
  const matches=ROUTES.filter(([, ,title])=>title.toLowerCase().includes(needle));
  const cases=state.cases.filter(record=>(record.id+" "+record.title).toLowerCase().includes(needle)).slice(0,8);
  $("#command-results").innerHTML=matches.map(navButton).join("")+cases.map(record=>'<button class="nav-item" data-action="open" data-id="'+safe(record.id)+'"><span aria-hidden="true" class="nav-icon">▣</span><span>'+
    safe(record.title+" · "+record.id)+'</span></button>').join("")||empty("No matching tools or cases.");
}

