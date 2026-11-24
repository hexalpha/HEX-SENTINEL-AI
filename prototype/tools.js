"use strict";
function sandboxView() {
  const record=selectedCase(), disabled=!offline&&(!record?.synthetic||!replayEvidence(record));
  return heading("Website sandbox","Review the sequence of a fictional browser observation.")+
   box("Synthetic replay","Replay reads an included fixture and sends zero target requests.")+
   '<div class="grid">'+panel("Observation policy",term("Initial URL","https://wallet-review.example/")+term("Final URL","https://verify-wallet.example/review")+
   term("Mode","Timed fixture replay")+term("Form actions","Metadata only")+term("Live worker",offline?"Unavailable in offline mode":state.health?.sandbox?.live||"Unavailable")+
   '<div class="actions" style="margin-top:12px">'+btn("Play replay","play",'id="play" '+(disabled?'disabled':''),"primary")+btn("Reset","reset-replay")+link("Website investigation","website")+'</div>',pill("Synthetic","demo"))+
   panel("Redirect and form trace",arrList([["302 redirect","wallet-review.example"],["200 final page","verify-wallet.example"],["Cross-host action","collect-review.example"]],
   entry=>item(...entry)))+'</div>'+panel("Live console replay",'<div role="region" aria-label="Replay events" id="event-list" aria-live="polite">'+eventRows()+'</div>',
   '<span id="event-count">'+pill(state.events.length+" events","demo")+'</span>');
}
function eventRows(){
  return state.events.length?table(["Offset / event","Observation","Source / destination","Method / status","Evidence"],state.events.map(entry=>[
    safe((entry.offset_ms/1000).toFixed(2)+"s")+"<br><span class='mono small'>"+safe(entry.id)+"</span>",
    '<strong>'+safe(entry.category)+'</strong><br>'+safe(entry.detail)+'<br><span class="mono small">'+safe(entry.timestamp)+'</span>',
    safe(entry.source)+"<br>"+safe(entry.destination),
    safe((entry.method||"—")+" / "+(entry.status_code??"—")),
    '<span class="mono small">'+safe(entry.evidence_ref)+'</span><br>'+pill(entry.severity,entry.severity.toLowerCase())])):empty("Play the fixture to reveal timestamped events.");
}
function fixtureReviews(record) {
  if(!record?.reviews)return [];
  const start=Date.parse(record.created_at);
  const complaints=record.reviews.map((text,i)=>({text,stance:"Complaint",published_at:new Date(start+(i===2?1440:i*17)*60000).toISOString()}));
  const positive=record.type==="apk"?"Fast approval and helpful service":record.type==="website"?"Payout credited on time":null;
  return [...complaints,...(positive?[4,9].map(minute=>({text:positive,stance:"Positive",published_at:new Date(start+minute*60000).toISOString()})):[])]
    .map(entry=>({...entry,provenance:"synthetic",corroboration:"none"}));
}
function osintView(reviews=false) {
  const record=selectedCase(), evidence=best(record), report=state.intel[record?.id];
  const mock=record&&offline&&record.complaint, sample=state.osintQuery.trim().toLowerCase();
  const visible=!sample||[record?.domain,record?.title,record?.tag].some(value=>value?.toLowerCase().includes(sample));
  if(reviews&&!offline)return verifiedReviewPanel(record);
  if(reviews) {
    const corpus=mock?fixtureReviews(record):[],counts=new Map();
    for(const entry of corpus){
      if(!counts.has(entry.text))counts.set(entry.text,{stance:entry.stance,dates:[]});
      counts.get(entry.text).dates.push(entry.published_at);
    }
    const firstHour=corpus.filter(entry=>Date.parse(entry.published_at)-Date.parse(corpus[0].published_at)<3600000).length;
    return heading("Public review analysis","Compare repeated wording, source credibility and independent corroboration.")+
     box(offline?"Synthetic review corpus":"Collection unavailable",offline?"Fictional summaries illustrate complaint handling. Findings require independent verification.":"This service has no public review collector.")+
     '<div class="grid">'+panel("Review patterns",counts.size?arrList([...counts],([text,group])=>
      item(text,group.dates.length+" fictional mentions · "+group.stance,(group.dates.length>1?"Repeated wording · ":"")+dateLabel(group.dates[0]))):empty())+
     panel("Source assessment",term("Source class",offline?"Fictional reviews":"Unavailable")+term("Sample size",corpus.length)+
     term("Corroboration","None")+term("First-hour concentration",corpus.length?firstHour+" of "+corpus.length+" fixture posts":"Unavailable")+
     term("Timing interpretation","Independent baseline required")+term("Risk contribution","0 points"))+'</div>';
  }
  const domains=unique((record?.evidence||[]).flatMap(entry=>entry.analysis.indicators.filter(ind=>ind.type==="domain")),ind=>ind.value);
  return heading("OSINT and reputation","Inspect provenance, coverage and corroboration for external observations.")+
   '<div class="grid">'+panel("Search",'<form id="osint-form">'+field(offline?"Search case fixtures":"Observed domain","indicator",
   offline?input("indicator",state.osintQuery,'placeholder="wallet-review.example"'):
   '<select id="indicator" name="indicator">'+domains.map(domain=>'<option value="'+safe(domain.value)+'" data-ref="'+safe(domain.evidence_ref)+'">'+safe(domain.value)+'</option>').join("")+'</select>')+
   (!offline?'<label><input type="checkbox" name="dns-consent" required> Send the selected domain to public DNS</label><p class="form-note">Only the domain is sent. Availability depends on local configuration.</p>':"")+
   '<div class="actions">'+submit(offline?"Search fixtures":"Query DNS")+link("Review analysis","reviews")+'</div>'+statusSlot+'</form>',scenarioMark(record))+
   panel("Source coverage",term("Public DNS",offline?"Unavailable in offline demo":state.health?.public_dns||"Unknown")+term("Threat reputation","Connector unavailable")+
   term("Review corroboration","Unverified")+term("Score effect","0 points"))+'</div>'+
   panel("Search results",offline?(mock&&visible?item("Fictional complaint summary",record.complaint,"SYNTHETIC · UNVERIFIED · "+evidence?.id)+
   term("Original source","https://complaints.example/"+record.id.toLowerCase())+term("Published","Fixture · "+dateLabel(record.created_at))+
   term("Retrieved","Fixture preview · No external request")+term("Credibility","Fictional user reports")+term("Corroboration","None"):empty("No fictional sources match this query.")):
   report?.results?.length?arrList(report.results,entry=>item(entry.claim,entry.source_name+" · "+entry.source_url,entry.provenance+" · "+entry.retrieved_at+" · "+entry.evidence_ref)):
   empty(report?.message||"Run an opted-in DNS lookup to collect referenceable observations."),pill(offline?"Synthetic":report?.status||"Unavailable",offline?"demo":""));
}

function graphView() {
  const record=selectedCase(),data=graphSelection(record),node=data.nodes.find(entry=>entry.id===state.node);
  const types=[...new Set(graphData(record).nodes.map(row=>row.type))].sort();
  const nodeSelect='<select id="graph-select" aria-label="Select an entity"><option value="">Choose an entity</option>'+
    data.nodes.map(entry=>'<option value="'+safe(entry.id)+'"'+(entry.id===state.node?' selected':'')+'>'+safe((typeLabel[entry.type]||entry.type)+" · "+entry.value)+'</option>').join("")+'</select>';
  return heading("Entity relationship graph","Inspect exact indicator links, supporting evidence and related cases.")+
    '<div class="grid">'+panel("Investigation network",'<div class="graph-frame drag"><canvas id="graph-canvas" aria-label="Case entity network. Use the entity selector for keyboard navigation."></canvas><p class="graph-help">'+
    (state.graphMode==="3d"?"Drag to rotate. Shift-drag or use Pan to move. ":"Drag to pan the 2D projection. ")+"Select a node to inspect its edge evidence."+'</p></div>'+
    '<div class="actions" style="margin-top:9px">'+btn("Zoom in","graph-camera",'data-id="in"')+btn("Zoom out","graph-camera",'data-id="out"')+
    btn("Pan","graph-camera",'data-id="pan" id="pan-toggle" aria-pressed="false"')+btn("Reset view","graph-camera",'data-id="reset"')+'</div>',
    '<div class="row">'+["2d","3d"].map(mode=>btn(mode.toUpperCase(),"graph-mode",'data-id="'+mode+'" aria-pressed="'+(state.graphMode===mode)+'"',state.graphMode===mode?"primary":"")).join("")+'</div>')+
    '<div class="stack">'+panel("Entity evidence",'<div class="split-field">'+field("Search nodes","graph-query",input("graph-query",state.graphQuery,'placeholder="Filter by value"'))+
    field("Node type","graph-filter",'<select id="graph-filter"><option value="">All types</option>'+types.map(type=>'<option value="'+safe(type)+'" '+(type===state.graphFilter?'selected':'')+'>'+safe(typeLabel[type]||type)+'</option>').join("")+'</select>')+
    '</div>'+field("Entity","graph-select",nodeSelect)+'<div id="node-detail">'+nodeDetail(data,node)+'</div>')+
    panel("Related cases",data.related_cases.length?'<div class="chipbar">'+data.related_cases.map(id=>btn(id,"open",'data-id="'+safe(id)+'"')).join("")+'</div>':empty("No shared exact indicators recorded."),scenarioMark(record))+'</div></div>';
}
function nodeDetail(data,node) {
  return node?term("Type",typeLabel[node.type]||node.type)+term("Value",node.value)+
    arrList(data.edges.filter(edge=>edge.id===node.id),edge=>item(edge.case_id,edge.snippet,edge.evidence_ref+" · "+edge.confidence+" · "+edge.relation)):
    empty("Select a node. Shared identifiers establish co-occurrence only.");
}

function vaultView() {
  const record=selectedCase(),entries=record?.evidence||[];
  const selected=entries.find(entry=>entry.id===state.focusedEvidence),revisions=state.revisions[state.focusedEvidence];
  return heading("Evidence vault","Review evidence identifiers, original digests and acquisition records.")+
    panel("Evidence inventory",entries.length?table(["Evidence","Type / source","SHA-256","Integrity"],entries.map(entry=>[
    '<span class="mono">'+safe(entry.id)+'</span><br>'+safe(entry.filename),safe(typeLabel[entry.kind])+"<br>"+safe(entry.source),
    '<span class="mono small break">'+safe(entry.sha256||"Hash pending or unavailable")+'</span>',offline?pill("Demo digest","demo"):
    '<div class="actions">'+btn("Verify original","verify",'data-id="'+safe(entry.id)+'"')+btn("History","revision-history",'data-id="'+safe(entry.id)+'"')+'</div>'])):empty(),scenarioMark(record))+
    (selected?'<div style="margin-top:15px">'+panel("Evidence detail",term("Evidence",selected.id)+term("Acquisition",dateLabel(selected.created_at))+
    term("Source",selected.source)+(revisions?arrList(revisions,row=>item("Revision "+row.revision,row.version,dateLabel(row.updated_at))):"")+
    (!offline&&state.role!=="viewer"?btn("Reanalyse verified original","reanalyze",'data-id="'+safe(selected.id)+'"'):""))+'</div>':"")+
    '<div style="height:15px"></div>'+panel(offline?"Acquisition mode":"Upload evidence",offline?box("Offline demo","Locally entered content stays in browser storage when available. Use connected mode to retain an original."):
    '<form id="upload-evidence">'+field("Evidence file","evidence-file",'<input type="file" id="evidence-file" name="file" accept=".apk,.eml,.txt,.pdf,.jpg,.jpeg,.png" required>')+
    field("Acquisition source","upload-source",input("upload-source","Analyst upload",'required maxlength="200"'))+
    field("Notes","upload-notes",input("upload-notes","",'maxlength="4000"'))+submit("Acquire file")+statusSlot+'</form>');
}
function assistantView() {
  const record=selectedCase(), explanation=state.explanations[record?.id],risk=riskOf(record);
  const base=risk?"The highest evidence score is "+risk.score+"/100 ("+risk.band+"). Review the cited findings and verify the claimed source independently.":"Analyse evidence to generate an explanation.";
  return heading("Local AI assistant","Review an evidence-linked explanation and see the configured model status.")+
    '<div class="grid">'+panel("Explanation",box(offline?"Deterministic demo":"Deterministic",explanation?.summary||base)+
    (explanation?.model_inference?item(explanation.model_inference.label,explanation.model_inference.text,
      explanation.model+" · "+dateLabel(explanation.created_at)):"")+
    (state.aiFixture?item("Synthetic model-response preview","Compare the matched indicators with independent source records. Use the evidence reference to locate the original submission.",risk?.evidence_ref||"Synthetic fixture"):"")+
    (explanation?.model_status?'<p class="form-note">Model status · '+safe(explanation.model_status)+'</p>':"")+
    '<div class="actions">'+btn(offline?"Show model-response preview":"Request local explanation","explain","","primary")+'</div>',
    pill(offline?"Model unavailable":state.health?.local_model?.state||"Unknown",offline?"demo":""))+
    panel("Supporting rules",risk?arrList(risk.contributions.slice(0,8),value=>item(value.rule_id,value.title,value.evidence_ref)):empty())+'</div>'+
    questionPanel(record);
}
function reportsView() {
  const record=selectedCase(),data=record?demoReport(record):null;
  const technical=state.reportProfile==="technical";
  return heading("Investigation reports","Compare executive and technical case handoffs and download the selected format.")+
    (data?'<div class="grid">'+panel(technical?"Technical report preview":"Executive report preview",term("Case",record.id+" · "+record.title)+term("Scope",record.synthetic?"Synthetic investigation exercise":"Submitted evidence")+
    term("Summary",data.summary)+term("Evidence",record.evidence?.length||0)+term("Evidence hashes","See attached inventory")+
    term("Risk",riskOf(record)?riskOf(record).score+"/100 · "+riskOf(record).band:"Unassessed")+
    term("Attribution","Evidence references accompany observations")+term("Limitations","Analyst verification required"),scenarioMark(record))+
    panel("Export case record",field("Report template","report-profile",'<select id="report-profile"><option value="technical" '+(technical?'selected':'')+'>Full technical</option><option value="executive" '+(technical?'':'selected')+'>Executive</option></select>')+
    '<p class="small">'+(technical?"Detailed source records, observations, identifiers and custody.":"Plain-language findings, case priorities, sources and recommendations.")+'</p>'+
    '<div class="actions" style="margin-top:12px">'+btn("Download PDF","report",'data-id="pdf"',"primary")+btn("Download JSON","report",'data-id="json"')+
     btn("Download CSV","report",'data-id="csv"')+btn("Printable HTML","report",'data-id="html"')+'</div>')+'</div>':empty("Select or create a case to export a report."));
}
function intelligenceView() {
  const record=selectedCase(),data=graphData(record);
  const regions=Object.entries(state.cases.filter(entry=>entry.synthetic&&entry.region).reduce((d,entry)=>
    (d[entry.region]=(d[entry.region]||0)+1,d),{})).sort((a,b)=>b[1]-a[1]);
  return heading("Threat intelligence","Review identifiers, case overlap and location evidence.")+
    '<div class="grid">'+panel("Extracted indicators",indicatorsView((record?.evidence||[]).flatMap(entry=>entry.analysis.indicators)),scenarioMark(record))+
    '<div class="stack">'+panel("Shared indicator links",data.related_cases.length?arrList(data.related_cases,id=>item(id,"Exact typed indicator overlap","See graph for evidence references")):empty("No related cases identified."),link("Open graph","graph"))+
    panel("Location evidence",regions.length?
      '<div class="graph-frame"><canvas id="location-canvas" style="height:178px" aria-hidden="true"></canvas></div>'+
      '<p class="form-note">Approximate city positions. Intensity represents fictional acquisition counts.</p>'+
      '<div class="chipbar" aria-label="Location counts">'+regions.map(([name,count])=>'<span class="chip">'+safe(name+" · "+count)+'</span>').join("")+'</div>':
      empty("No verified location evidence."),pill(offline?"Synthetic regions":"Case evidence",offline?"demo":""))+'</div></div>';
}
function systemView(audit=false) {
  const record=selectedCase(),health=state.health,ledger=state.ledger[record?.id];
  if(audit) return heading("Settings and audit","Inspect access role, retention scope and case custody events.")+
    '<div class="grid">'+panel("Session settings",term("Mode",offline?"Offline demonstration":"Connected service")+term("Access role",state.role||"Demo analyst")+
    term("Storage",offline?"Browser storage where available":"SQLite and hashed originals")+
    (offline?link("Access screen","login"):btn("Sign out","logout")))+panel("Custody events",offline?
    (record?.evidence?.length?arrList(record.evidence,entry=>item("Demo acquisition",entry.id,dateLabel(entry.created_at))):empty()):
    ledger?arrList(ledger.events,event=>item(event.action,event.reference,event.time+" · "+event.actor)):empty("Select a connected case to load its ledger."),
    ledger?pill(ledger.valid?"Local chain verified":"Integrity warning",ledger.valid?"live":"critical"):offline?pill("Demo","demo"):"")+'</div>';
  return heading("System health","Check service, analysis, provenance and optional integrations.",false)+
    '<div class="grid equal">'+panel("Runtime services",term("Workspace",offline?"Offline HTML":health?.service||"Contacting service")+term("Database",offline?"Browser fixture":health?.database||"Unknown")+
    term("Risk engine",HEX_CONFIG.version)+term("Model",offline?"Unavailable":health?.local_model?.state||"Unknown")+term("Public DNS",offline?"Unavailable":health?.public_dns||"Unknown")+
    term("Live sandbox",offline?"Unavailable":health?.sandbox?.live||"Unavailable")+term("Sandbox replay","Ready · Synthetic")+term("Checked at",dateLabel(health?.checked_at)),btn("Refresh","health"))+
    panel("Provenance labels",arrList([["Submitted","Evidence acquired by an analyst."],["Live","Observation obtained through a configured DNS resolver."],
    ["Synthetic","Fictional records, replay events and model-response previews."],["Unavailable","Integration disabled, missing or unreachable."]],entry=>item(...entry)))+'</div>';
}
function loginView() {
  return '<div class="login"><div class="kicker">HEX SENTINEL AI · Access control</div>'+panel("Investigator access",
    '<p>Open the investigation workspace with '+(offline?"the demo analyst role.":"a local role token.")+'</p>'+
    (offline?box("Offline demo","This screen illustrates access control. Connected mode enforces token permissions.")+
    btn("Enter demo workspace","demo-login","","primary"):'<form id="login-form">'+field("Investigation token","token",input("token","",
    'type="password" required minlength="24" autocomplete="off" placeholder="Paste your local access token"'))+
    submit("Unlock workspace")+statusSlot+'</form>')+term("Analyst","Acquire and analyse evidence")+term("Viewer","Read cases and export reports"))+'</div>';
}

