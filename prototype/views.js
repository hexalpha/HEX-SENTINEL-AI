"use strict";
const NAV=[
 ["Operations",[["overview","⌂","Command centre"],["newcase","+","New investigation"],["cases","▣","Investigation cases"],["analytics","◉","Threat analytics"]]],
 ["Analysis",[["message","✉","Message analysis"],["domain","◎","Domain intelligence"],["url","↗","URL intake"],["website","◫","Website investigation"],
 ["sandbox","▤","Website sandbox"],["apps","▰","Application intelligence"],["apk","◈","APK intelligence"],["osint","◎","OSINT fusion"],
 ["reputation","≋","Reputation intelligence"],["reviews","▤","Public reviews"]]],
 ["Investigation",[["campaign","◉","Campaign detection"],["graph","◇","Entity graph"],["history","⌕","Historical search"],
 ["risk","◔","Risk explanation"],["assistant","✦","Local AI assistant"],["vault","▧","Evidence vault"],["reports","▥","Reports"]]],
 ["System",[["system","◌","System health"],["audit","≡","Audit & access control"],["settings","⚙","Settings"]]]
];
const ROUTES=NAV.flatMap(group=>group[1]);
const typeLabel={message:"Message",email:"Email",url:"URL",website:"Website",app_store:"Store link",apk:"APK",attachment:"Attachment",domain:"Domain",ip:"IP address",upi_candidate:"UPI candidate",phone:"Phone",package:"APK package",case:"Case",
  app_identity:"App identity",app_name:"App name",signing_certificate:"Signing certificate",hash:"SHA-256",campaign:"Campaign reference"};
const palette={Critical:"#f26488",High:"#eba47f",Moderate:"#bf9cf6",Low:"#73d4bb"};
const riskOf=record=>record?.evidence?.map(item=>item.analysis.risk).sort((a,b)=>b.score-a.score)[0] || record?.top_risk;
const best=record=>record?.evidence?.find(item=>item.id===riskOf(record)?.evidence_ref);
const empty=(text="There are no records for this case yet.")=>'<div class="empty">'+safe(text)+'</div>';
const btn=(name,action,extra="",kind="")=>'<button type="button" class="btn '+kind+'" data-action="'+safe(action)+'" '+extra+'>'+safe(name)+'</button>';
const link=(name,id,kind="")=>btn(name,"route",'data-id="'+safe(id)+'"',kind);
const pill=(value,style="")=>'<span class="pill '+safe(style)+'">'+safe(value)+'</span>';
const riskPill=risk=>risk?pill(risk.band,risk.band.toLowerCase()):pill("Not assessed");
const panel=(title,body,aside="")=>'<section class="panel"><div class="panel-title"><h2>'+safe(title)+'</h2>'+aside+'</div>'+body+'</section>';
const term=(key,value)=>'<div class="term"><span>'+safe(key)+'</span><span>'+safe(value)+'</span></div>';
const item=(title,body,meta="")=>'<div class="item"><strong>'+safe(title)+'</strong><p class="small">'+safe(body)+'</p>'+(meta?'<div class="meta">'+safe(meta)+'</div>':'')+'</div>';
const field=(label,id,control)=>'<div class="field"><label for="'+id+'">'+safe(label)+'</label>'+control+'</div>';
const options=(values,selected)=>values.map(value=>'<option'+(value===selected?' selected':'')+'>'+safe(value)+'</option>').join("");
const input=(id,value="",extra="")=>'<input id="'+id+'" name="'+id+'" value="'+safe(value)+'" '+extra+'>';
const textArea=(id,value="",extra="")=>'<textarea id="'+id+'" name="'+id+'" '+extra+'>'+safe(value)+'</textarea>';
const submit=label=>'<button type="submit" class="btn primary">'+safe(label)+'</button>';
const arrList=(values,content)=>values.length?'<div class="item-list">'+values.map(content).join("")+'</div>':empty();
const box=(label,body)=>'<div class="banner">'+(label?'<strong>'+safe(label)+'</strong> · ':'')+safe(body)+'</div>';
const table=(head,rows)=>'<div class="table-scroll"><table><thead><tr>'+head.map(val=>'<th scope="col">'+safe(val)+'</th>').join("")+'</tr></thead><tbody>'+
  rows.map(cols=>'<tr>'+cols.map(val=>'<td>'+val+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>';
const fieldCase=()=>state.cases.length?field("Active case","active-case",'<select id="active-case"><option value="">Choose a case</option>'+
  state.cases.map(value=>'<option value="'+safe(value.id)+'"'+(state.active===value.id?' selected':'')+'>'+safe(value.id+" · "+value.title)+'</option>').join("")+'</select>'):link("Create case","newcase");
const heading=(title,sub,active=true)=>'<div class="heading"><div><div class="kicker">PS01 Investigation workspace</div><h1>'+safe(title)+'</h1><p>'+safe(sub)+'</p></div>'+
  (active?'<div class="case-field">'+fieldCase()+'</div>':'')+'</div>';
const scenarioMark=record=>record?.synthetic || offline ? pill("Synthetic demo","demo") : pill("Submitted evidence","live");
const statusSlot='<p class="status-text" data-form-status></p>';
const evidenceSelect=record=>field("Evidence","evidence-select",'<select id="evidence-select">'+ (record?.evidence||[]).map(entry=>
  '<option value="'+safe(entry.id)+'"'+(state.evidence===entry.id?' selected':'')+'>'+safe(entry.id+" · "+typeLabel[entry.kind])+'</option>').join("")+'</select>');
function caseTable(records) {
  return records.length?table(["Case","Category","Status","Risk",""],records.map(record=>[
    '<button class="table-link" data-action="open" data-id="'+safe(record.id)+'">'+safe(record.title)+'</button><br><span class="mono quiet small">'+safe(record.id)+'</span>',
    safe(record.tags?.[0]||"Uncategorised"),safe(record.status),riskPill(riskOf(record)),btn("Open","open",'data-id="'+safe(record.id)+'"')])):empty("No cases match the current filters.");
}

function overview() {
  const records=state.cases,record=selectedCase();
  const counts=Object.fromEntries(Object.keys(palette).map(band=>[band,records.filter(entry=>riskOf(entry)?.band===band).length]));
  const assessed=Object.values(counts).reduce((a,b)=>a+b,0);
  let cursor=0;
  const gradient=Object.entries(counts).filter(([,count])=>count).map(([band,count])=>{
    const start=cursor;cursor+=count*100/assessed;return palette[band]+" "+start+"% "+cursor+"%";
  }).join(",");
  const days=Array.from({length:7},(_,i)=>{
    const date=offline?new Date("2026-11-22T05:00:00Z"):new Date();
    date.setUTCDate(date.getUTCDate()-6+i);
    const label=dayLabel(date);
    return {label,amount:records.filter(entry=>dayLabel(entry.created_at)===label).length};
  });
  const stats=[["Cases",records.length,"Workspace inventory","cases"],["High or critical",counts.High+counts.Critical,"Risk prioritisation","risk"],
    ["Evidence items",records.reduce((sum,entry)=>sum+(entry.evidence?.length||entry.evidence_count||0),0),"Acquired or fixture","vault"],
    ["Live integrations",state.health?.public_dns==="enabled"?1:0,"External DNS only","system"]];
  return '<section class="hero"><canvas class="hero-art" id="hero-art" aria-hidden="true"></canvas><div class="hero-content"><div class="kicker">PS01 · Rajasthan Police Hackathon 2026</div><h1>Investigation<br>command centre</h1><p>Triage scam messages, phishing links, suspicious websites and loan or investment apps in one case workspace.</p><div class="actions">'+
   link("New investigation","newcase","primary")+link("Analyse message","message")+'</div></div></section>'+
   '<div class="kpis">'+stats.map(([name,value,detail,route])=>'<button class="metric" data-action="route" data-id="'+route+'"><small>'+name+' <span>↗</span></small><strong>'+String(value).padStart(2,"0")+'</strong><span class="detail">'+detail+'</span></button>').join("")+'</div>'+
   '<div class="grid">'+panel("Case intake trend",'<div class="trend" aria-label="Case intake over seven dates">'+days.map(day=>
   '<button data-action="day" data-id="'+day.label+'" class="'+(state.day===day.label?'active':'')+'" aria-label="'+day.label+', '+day.amount+' case records"><span>'+day.amount+'</span><span class="bar" style="--height:'+Math.max(3,Math.min(68,day.amount*47))+'px"></span><span>'+day.label.split(" ")[0]+'</span></button>').join("")+
   '</div><p class="small">'+safe(state.day?state.day+" · select Cases to review all records.":"Seven days · select a bar to filter the queue.")+'</p>',pill(offline?"Synthetic sample":"Case history",offline?"demo":"live"))+
   panel("Risk distribution",'<div class="chart-layout"><div class="donut" style="background:'+(gradient?"conic-gradient("+gradient+")":"#343542")+'"><div class="donut-inner"><b>'+assessed+'</b><small>assessed</small></div></div><div class="legend">'+
     Object.entries(counts).map(([band,count])=>'<button data-action="filter-risk" data-id="'+band+'"><span class="swatch" style="background:'+palette[band]+'"></span>'+band+' <b>'+count+'</b></button>').join("")+'</div></div>')+
   '</div><div class="grid">'+panel("Investigation queue",caseTable(state.day?records.filter(entry=>dayLabel(entry.created_at)===state.day):records.slice(0,4)),state.day?btn("Clear date","day",'data-id=""'):link("All cases","cases"))+
   panel("Evidence activity",record?.evidence?.length?arrList(record.evidence.slice(0,3),entry=>item(entry.id,typeLabel[entry.kind]+" · "+entry.source,dateLabel(entry.created_at))):empty("Choose a case to inspect its evidence."),scenarioMark(record))+'</div>'+opsSummary();
}

function casesView() {
  const filtered=state.cases.filter(entry=>[entry.title,entry.id,...(entry.tags||[])].join(" ").toLowerCase().includes(state.query.toLowerCase())&&
    (!state.caseStage||entry.status===state.caseStage)&&(!state.band||riskOf(entry)?.band===state.band));
  return heading("Investigation cases","Search, prioritise and review case records.",false)+
    panel("Case register",'<form id="case-filter" class="split-field">'+field("Search cases","case-query",input("case-query",state.query,'placeholder="Case, ID or tag"'))+
    field("Status","case-stage",'<select name="case-stage" id="case-stage"><option value="">All statuses</option>'+options(["Open","In review","Closed"],state.caseStage)+'</select>')+
    field("Risk band","case-band",'<select name="case-band" id="case-band"><option value="">All bands</option>'+options(Object.keys(palette),state.band)+'</select>')+
    '<div class="row"><button class="btn" type="submit">Apply filters</button>'+btn("Clear","clear-filters")+'</div></form>'+caseTable(filtered),link("New case","newcase","primary"));
}

function caseForm(edit) {
  const current=edit?selectedCase():null;
  if(edit&&!current)return heading("Case details","Select a case to review.")+empty();
  const buttons=edit?'<div class="actions" style="margin-bottom:11px">'+link("Evidence vault","vault")+link("Risk explanation","risk")+link("Reports","reports")+'</div>':"";
  return heading(edit?current.title:"New investigation",edit?current.id+" · "+(current.synthetic?"Synthetic fixture":"Submitted evidence"):"Create an evidence workspace and set its triage priority.",edit)+
   '<div class="grid equal">'+panel(edit?"Case record":"Case details",'<form id="'+(edit?"case-edit":"case-create")+'">'+
   field("Case title","title",input("title",current?.title,'required minlength="3" maxlength="120" placeholder="e.g. Electricity cutoff SMS"'))+
   '<div class="split-field">'+field("Priority","priority",'<select name="priority" id="priority">'+options(["Low","Normal","High","Urgent"],current?.priority||"Normal")+'</select>')+
   (edit?field("Status","status",'<select name="status" id="status">'+options(["Open","In review","Closed"],current.status)+'</select>'):
   !offline?field("Provenance","synthetic",'<select name="synthetic" id="synthetic"><option value="false">Submitted evidence</option><option value="true">Synthetic fixture</option></select>'):
   '<div class="field"><span class="label">Provenance</span>'+pill("Offline demonstration","demo")+'</div>')+'</div>'+
   field("Tags","tags",input("tags",current?.tags?.join(", "),'placeholder="Utility, SMS" maxlength="400"'))+
   field("Analyst notes","notes",textArea("notes",current?.notes,'maxlength="4000" placeholder="Source, context and verification steps"'))+
   submit(edit?"Save case":"Create case")+statusSlot+'</form>')+
   panel(edit?"Case timeline":"Intake workflow",edit?buttons+arrList(current.evidence||[],entry=>item(entry.id,"Evidence submitted · "+entry.source,dateLabel(entry.created_at))):
   arrList([["Create","Set title, priority and provenance."],["Acquire","Add a message, link or supported file."],["Review","Inspect risk contributions and case links."]],entry=>item(...entry)))+'</div>';
}

const indicatorsView=items=>arrList(items||[],entry=>item(typeLabel[entry.type]||entry.type,entry.value,entry.evidence_ref+" · "+entry.snippet));
const findingsView=items=>arrList(items||[],entry=>item(entry.title,entry.snippet,entry.rule_id+" · "+entry.kind+" · "+entry.evidence_ref));
function analyzeView(route) {
  const record=selectedCase();
  const [title,sub,types]={
    message:["Message analysis","Inspect suspicious SMS, social messages and email headers.",["message","email"]],
    url:["URL and domain","Explain suspicious characteristics in a submitted address.",["url","website","app_store"]],
    apk:["APK intelligence","Review package metadata, requested permissions and extracted identifiers.",["apk"]]}[route];
  const evidence=record?.evidence?.find(item=>item.id===state.evidence&&types.includes(item.kind))||record?.evidence?.filter(item=>types.includes(item.kind)).at(-1);
  const listing=evidence?.analysis,fixture=HEX_DEMO.find(item=>route==="message"?item.type==="message":route==="url"?item.type==="website":item.type==="apk");
  const form=route==="apk"?(offline?box("Synthetic manifest","Inspect fictional package metadata and permissions.")+btn("Load loan APK fixture","sample-case",'data-id="HEX-0253"',"primary"):
    field("Android package","analysis-file",'<input type="file" id="analysis-file" name="file" accept=".apk" required>')):
    field(route==="message"?"Submitted content":"URL or domain","analysis-text",route==="message"?
      textArea("analysis-text",offline&&evidence?.text||"",'maxlength="60000" required placeholder="Paste the original SMS, message or email"'):
      input("analysis-text",offline&&evidence?.text||"",'maxlength="4096" required placeholder="https://service-review.example/"'));
  const controls=route==="message"?field("Format","analysis-kind",'<select id="analysis-kind" name="analysis-kind"><option value="auto">Auto-detect</option><option value="message">SMS or chat text</option><option value="email">Email headers and body</option></select>'):
    route==="url"?field("Format","analysis-kind",'<select id="analysis-kind" name="analysis-kind"><option value="auto">Auto-detect URL / store link</option><option value="website">Website address</option></select>'):"";
  const detail=listing?Object.entries(listing.details).filter(([,value])=>value!==""&&value!=null).
    map(([key,value])=>term(key.replaceAll("_"," "),Array.isArray(value)?value.map(entry=>typeof entry==="object"?JSON.stringify(entry):entry).join(", "):value)).join(""):"";
  const sensitive=listing?.details.sensitive_permissions?.length??0,total=listing?.details.permissions?.length??0;
  const perms=route==="apk"&&listing?term("Sensitive permissions",sensitive+" of "+total)+
   '<div class="scale" role="meter" aria-label="Sensitive Android permissions" aria-valuemin="0" aria-valuemax="'+Math.max(1,total)+'" aria-valuenow="'+sensitive+'"><span style="width:'+Math.round(100*sensitive/Math.max(1,total))+'%"></span></div>':"";
  const scope=route==="url"?"Syntax analysis. Link destinations appear as evidence text.":route==="apk"?"Static analysis. APKs are never installed.":"Each finding includes a matched evidence snippet.";
  return heading(title,sub)+'<div class="grid">'+panel("Evidence intake",'<form id="analyze" data-route="'+route+'">'+form+
   (route==="apk"&&offline?"":controls+(!offline?'<div class="split-field">'+field("Source","source",input("source","Analyst submission",'required maxlength="200"'))+
   field("Investigator notes","evidence-notes",input("evidence-notes","",'maxlength="4000"'))+'</div>':"")+
   '<div class="actions">'+submit("Analyse evidence")+(offline?btn("Use synthetic sample","fill-sample",'data-id="'+fixture.id+'"'):"")+'</div>'+statusSlot)+'</form><p class="form-note">'+safe(scope)+'</p>',scenarioMark(record))+
   '<div class="stack">'+panel("Evidence summary",listing?term("Evidence ID",evidence.id)+term("Source",evidence.source)+term("Version",listing.version)+
   term("SHA-256",evidence.sha256||"Hash pending or unavailable")+perms+detail:empty("Submit evidence or select a case with this evidence type."),riskPill(listing?.risk))+
   panel("Indicators",listing?indicatorsView(listing.indicators):empty(),listing?link("Entity graph","graph"):"")+'</div></div>'+
   panel("Supporting findings",listing?findingsView(listing.findings):empty(),listing?link("Risk breakdown","risk"):"");
}

function riskView() {
  const record=selectedCase(),evidence=record?.evidence?.find(entry=>entry.id===state.evidence)||best(record),risk=evidence?.analysis.risk;
  const context=state.risks[record?.id]?.assessments?.find(row=>row.evidence_ref===evidence?.id);
  return heading("Risk explanation","Trace each scored rule to its evidence and review what remains unknown.")+
   (risk?'<div class="grid">'+panel("Triage assessment",evidenceSelect(record)+
   '<div class="risk-lead"><div class="score">'+risk.score+'<small>/100</small></div>'+riskPill(risk)+'</div><div class="scale" role="meter" aria-label="Triage score" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+risk.score+'"><span style="width:'+risk.score+'%"></span></div>'+
   term("Confidence",risk.confidence)+term("Rule version",risk.rule_version)+term("Updated",dateLabel(risk.updated_at))+term("Evidence",risk.evidence_ref)+
   term("Raw total",risk.raw_total)+'<p class="form-note">Each group contributes its strongest rule. Scores guide triage and require human review.</p>',scenarioMark(record))+
   panel("Missing or contradictory evidence",arrList(risk.missing,value=>item("Missing",value))+'<div class="chipbar"></div>'+
    (risk.contradictions.length?arrList(risk.contradictions,value=>item("Counterpoint",value)):empty("No contradictory evidence recorded.")))+'</div>'+
   panel("Contributing rules",arrList(risk.contributions,rule=>item("+"+rule.weight+" · "+rule.title,rule.snippet,rule.rule_id+" · "+rule.group+" · "+rule.evidence_ref+" · "+rule.confidence)))+
   (context?'<div style="margin-top:15px">'+panel("Contextual assessment",term("Triage score",context.score+" / 100 · "+context.band)+
      term("Version",context.version)+term("Static assessment",context.base_score)+arrList(context.external_signals,rule=>
      item("+"+rule.weight+" · "+rule.title,rule.snippet,rule.source+" · "+rule.observed_at)))+'</div>':""):
   empty("Analyse evidence to generate a risk assessment."));
}

