"use strict";

function offlineSearch(filters) {
  const query=(filters.q||"").trim().toLowerCase(),kind=filters.kind||"";
  return state.cases.flatMap(record=>{
    const date=record.created_at.slice(0,10);
    if(filters.start&&date<filters.start||filters.end&&date>filters.end)return [];
    const scope={id:record.id,title:record.title,synthetic:record.synthetic,created_at:record.created_at};
    const entries=(record.evidence||[]).flatMap(ev=>[
      {evidence_ref:ev.id,type:"hash",value:ev.sha256||""},
      ...ev.analysis.indicators.map(it=>({evidence_ref:ev.id,type:it.type,value:it.value}))]);
    if(kind==="campaign")return caseMatches(record).filter(row=>!query||
      [row.match_id,row.related_case_id,row.title].join(" ").toLowerCase().includes(query)).map(row=>({...scope,type:kind,value:row.match_id}));
    if(!kind&&[record.id,record.title].join(" ").toLowerCase().includes(query))return [{...scope,type:"case",value:record.title}];
    return entries.filter(row=>(!kind||row.type===kind)&&row.value.toLowerCase().includes(query)).map(row=>({...scope,...row}));
  }).slice(0,50);
}

function historyView() {
  const filters=state.historyFilters, result=offline?offlineSearch(filters):state.historyRecords;
  const saved=state.savedSearches;
  return heading("Historical case search","Find a case, indicator, campaign reference or SHA-256 across stored investigations.",false)+
    '<div class="grid">'+panel("Query archive",'<form id="history-form" class="split-field">'+
    field("Search value","history-q",input("history-q",filters.q,'placeholder="Case, indicator or SHA-256" maxlength="240"'))+
    field("Indicator type","history-kind",'<select id="history-kind" name="history-kind"><option value="">All</option>'+
      ["domain","ip","url","phone","email","upi_candidate","package","hash","campaign"].map(kind=>'<option value="'+kind+'" '+(filters.kind===kind?'selected':'')+'>'+safe(typeLabel[kind]||kind)+'</option>').join("")+'</select>')+
    field("Acquired from","history-start",input("history-start",filters.start,'type="date"'))+
    field("Acquired to","history-end",input("history-end",filters.end,'type="date"'))+
    '<div class="actions">'+submit("Search archive")+btn("Save current search","save-history")+'</div>'+statusSlot+'</form>')+
    panel("Saved searches",saved.length?arrList(saved,entry=>'<div class="item"><strong>'+safe(entry.label)+'</strong><p class="small">'+safe(entry.query||"All cases")+
      '</p>'+btn("Run search","saved-history",'data-id="'+safe(entry.id)+'"')+'</div>'):empty("Save a query to reuse its filters."))+'</div>'+
    panel("Matches",result.length?table(["Case","Indicator","Acquired",""],result.map(row=>[
       safe(row.title)+"<br><span class='mono small'>"+safe(row.id)+"</span>",
       safe(typeLabel[row.type]||row.type||"Case")+"<br><span class='mono small break'>"+safe(row.value||row.sha256||row.evidence_ref||row.id)+"</span>",
       safe(dateLabel(row.created_at))+"<br>"+sourceTag(row.synthetic?"synthetic":"submitted"),
       btn("Open","open",'data-id="'+safe(row.id)+'"')])):empty("No matches for the current filters."),
      state.historyNext!=null&&!offline?btn("Next results","next-history"):"");
}
function reputationView() {
  const record=selectedCase(),osint=latestObservation(record,"domain"),reviews=latestObservation(record,"reviews");
  const providers=offline?[["Registry","Synthetic"],["Certificate log","Synthetic"],["Public resolver","Synthetic"]]:
    Object.entries(state.health?.sources||{}).map(([key,item])=>[item.label,item.enabled?(item.last_request?.status||"Enabled, no lookup"):"Disabled"]);
  const counts=Object.entries((osint?.sources||[]).reduce((dict,row)=>(dict[row.source]=(dict[row.source]||0)+row.results.length,dict),{}));
  return heading("Reputation intelligence","Compare source availability and the evidentiary weight of observations.")+
   '<div class="grid">'+panel("Provider status",arrList(providers,([name,status])=>item(name,status)))+
   panel("Source reliability",arrList([["Registry record","Authoritative within its registration scope"],["Resolver or certificate log","Public technical observation"],
    ["Review or complaint","Opinion or allegation"],["Malware-reputation feed","Unavailable"]],row=>item(...row)))+'</div>'+
   '<div class="grid">'+panel("Source record distribution",counts.length?arrList(counts,([name,total])=>item(sourceLabel[name]||name,total+" technical source records")):
    empty(offline?"Open the synthetic Domain Intelligence screen for example records.":"No domain source records collected."),link("Domain intelligence","domain"))+
    panel("Review coverage",term("Recorded references",reviews?.results?.length||0)+term("Risk contribution",0)+link("Inspect reviews","reviews"))+'</div>';
}
function settingsView() {
  const stateRows=Object.entries(state.health?.sources||{});
  return heading("Settings","Review enabled adapters, local inference tasks and observation policy.",false)+
    '<div class="grid">'+panel("Public-source adapters",stateRows.length?arrList(stateRows,([key,row])=>
    item(row.label,row.enabled?"Enabled":"Disabled",row.last_request?row.last_request.status+" · "+dateLabel(row.last_request.at):"No recorded lookup")):
    empty("External adapters are disabled in the local-file demo."),link("Reputation intelligence","reputation"))+
    panel("Local processing",term("Model",state.health?.local_model?.model||"Not configured")+term("Case storage",offline?"Browser local storage":"SQLite")+
    term("Worker",state.health?.sandbox?.live||"Unavailable")+term("Evidence isolation","Preserved original plus versioned analysis")+
    link("System health","system"))+'</div>'+
    panel("Task routing",arrList(Object.entries(state.health?.inference_tasks||{classifier:{engine:"Local phrase rules",state:"ready"},
      explanation:{engine:"Fictional response preview",state:"synthetic"}}),([name,details])=>item(name.replaceAll("_"," "),details.engine||"No local engine configured",details.state)));
}
function analyticsView() {
  const records=state.cases,located=records.filter(row=>row.synthetic&&row.region);
  const local=Object.entries(located.reduce((dict,row)=>(dict[row.region]=(dict[row.region]||0)+1,dict),{}));
  const counts=Object.keys(palette).map(band=>[band,records.filter(row=>riskOf(row)?.band===band).length]);
  return heading("Threat analytics","Explore case triage bands and locations supported by the evidence.",false)+
    '<div class="grid">'+panel("Global case globe",'<div class="graph-frame drag"><canvas id="threat-globe" aria-hidden="true"></canvas><p class="graph-help">Drag to rotate. Use the zoom and view controls for a keyboard alternative.</p></div>'+
      '<div class="actions" style="margin-top:10px">'+btn("Zoom in","globe",'data-id="in"')+btn("Zoom out","globe",'data-id="out"')+
      btn("Reset view","globe",'data-id="reset"')+btn("Locations list","globe",'data-id="list"')+'</div><div id="globe-locations" class="chipbar" aria-label="Location counts">'+
      local.map(([name,count])=>'<span class="chip">'+safe(name+" · "+count)+'</span>').join("")+'</div>',
      sourceTag(offline?"synthetic":located.length?"synthetic":"unavailable"))+
    '<div class="stack">'+panel("Risk distribution",arrList(counts,([band,total])=>'<div class="item">'+riskPill({band})+
      '<p class="small">'+total+' cases</p></div>'))+
    panel("Location coverage",located.length?arrList(local,([city,count])=>item(city,count+" fictional case records","Approximate fixture position")):
      empty("No case location evidence is available."))+'</div></div>';
}

function verifiedReviewPanel(record) {
  const packet=latestObservation(record,"reviews");
  const rows=(record?.evidence||[]).map(entry=>({value:entry.id,evidence_ref:entry.id}));
  const form='<form id="reviews-import">'+field("Attach to evidence","review-evidence",selectRecords("review-evidence",rows))+
    field("Public review reference","review-url",input("review-url","",'type="url" required maxlength="600" placeholder="Public HTTPS source URL"'))+
    '<div class="split-field">'+field("Published date if known","review-date",input("review-date","",'type="date"'))+
    field("Rating if known","review-rating",input("review-rating","",'type="number" min="1" max="5"'))+'</div>'+
    field("Review text","review-text",textArea("review-text","",'required maxlength="1500" placeholder="Paste publicly accessible text without personal details"'))+
    submit("Record review reference")+statusSlot+'</form>';
  const history=currentObservations(record).filter(row=>row.kind==="reviews");
  const reviews=history.flatMap(row=>row.results);
  return heading("Public review analysis","Record public references and investigate complaint topics and repeat wording.")+
    box("Source handling","References and text are supplied by an analyst. Opinions and allegations need independent corroboration.")+
    '<div class="grid">'+panel("Add public reference",form)+panel("Recorded coverage",term("References",reviews.length)+
      term("Latest topics",JSON.stringify(packet?.topics||{}))+term("Latest sentiment",JSON.stringify(packet?.sentiment||{}))+
      term("Risk contribution",0))+'</div>'+
    panel("Source records",arrList(reviews,row=>item(row.value,row.source_url,row.source_record_id+" · "+(row.published_at||"Date unavailable")+" · "+row.tone)));
}

function questionPanel(record) {
  const payload=state.answers[record?.id];
  return panel("Ask about this case",'<form id="assistant-question">'+field("Investigator question","question",
    input("question","",'required minlength="3" maxlength="480" placeholder="Which evidence supports the risk score?"'))+
    field("Answer language","answer-language",'<select name="answer-language" id="answer-language"><option value="auto">Auto-detect</option><option value="en">English</option><option value="hi">Hindi</option></select>')+
    submit("Ask investigator assistant")+statusSlot+'</form>'+
    (payload?'<div class="banner" style="margin-top:9px">'+safe(payload.summary)+'</div>'+
    arrList(payload.facts,value=>item("Evidence statement",value))+'<div class="chipbar">'+unique(payload.citations,row=>row.evidence_ref).
    map(row=>evidenceControl(row.evidence_ref)).join("")+'</div>':""));
}

