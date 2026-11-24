"use strict";

const currentObservations=record=>state.observations[record?.id]||[];
const latestObservation=(record,kind)=>currentObservations(record).filter(value=>value.kind===kind).at(-1);
const observedIndicators=(record,types)=>unique((record?.evidence||[]).flatMap(item=>item.analysis.indicators.filter(row=>types.includes(row.type))),row=>row.value);
const selectRecords=(id,rows,label="Choose evidence")=>'<select id="'+id+'" name="'+id+'" required><option value="">'+safe(label)+'</option>'+rows.map(row=>
  '<option value="'+safe(row.value)+'" data-ref="'+safe(row.evidence_ref)+'">'+safe(row.value)+'</option>').join("")+'</select>';
const sourceTag=(status)=>pill(status,status==="live"||status==="complete"?"live":status==="synthetic"?"demo":"");
const sourceLabel={dns:"DNS",rdap:"Registry",ct:"Certificate transparency",network:"Routing",fdroid:"Public catalogue"};
const evidenceControl=(id)=>btn("Open "+id,"evidence-link",'data-id="'+safe(id)+'"');

function opsSummary(){
  const record=selectedCase(),evidence=state.cases.flatMap(row=>row.evidence||[]);
  const counts=kind=>new Set(evidence.flatMap(row=>row.analysis.indicators.filter(item=>item.type===kind).map(item=>item.value))).size;
  const summaries=[
    ["Pending cases",state.cases.filter(row=>row.status!=="Closed").length,"cases"],
    ["Website evidence",evidence.filter(row=>["website","url"].includes(row.kind)).length,"website"],
    ["Observed domains",counts("domain"),"domain"],["Phone identifiers",counts("phone"),"history"],
    ["UPI candidates",counts("upi_candidate"),"history"],["APK results",evidence.filter(row=>row.kind==="apk").length,"apps"]
  ];
  const runtime=[["Database",offline?"Fixture storage":state.health?.database||"Unknown"],["Observation worker",offline?"Synthetic replay":state.health?.sandbox?.live||"Unavailable"],
    ["Local model",offline?"Synthetic preview":state.health?.local_model?.state||"Unavailable"]];
  return '<div class="grid">'+panel("Intelligence inventory",'<div class="metric-mini">'+summaries.map(([label,value,view])=>
    '<button class="metric" data-action="route" data-id="'+view+'"><small>'+label+'</small><strong>'+value+'</strong></button>').join("")+'</div>',
    pill(offline?"Synthetic workspace":"Loaded case evidence",offline?"demo":""))+
    panel("Investigation services",runtime.map(([key,value])=>term(key,value)).join("")+
    term("Available campaign links",offline?caseMatches(record).length:"Open Campaign Detection")+
    '<div class="actions" style="margin-top:10px">'+link("Campaign detection","campaign")+link("Threat analytics","analytics")+'</div>')+'</div>';
}

function graphSelection(record){
  const data=graphData(record),query=state.graphQuery.trim().toLowerCase();
  const nodes=data.nodes.filter(node=>(!state.graphFilter||node.type===state.graphFilter) && (!query||node.value.toLowerCase().includes(query)));
  const ids=new Set(nodes.map(node=>node.id)),edges=data.edges.filter(edge=>ids.has(edge.id));
  return {...data,nodes,edges,related_cases:data.related_cases.filter(id=>edges.some(edge=>edge.case_id===id))};
}

function domainFixture(record) {
  if(!record?.domain)return null;
  const host=record.domain,ref=best(record)?.id,at=record.created_at;
  const values=[
    {kind:"registration",source_record_id:"SRC-DEMO-RDAP",source_name:"Fictional registry",source_url:"https://registry.example/",value:host,
     registrar:"Example Registry Desk",events:{registration:"2026-11-12T05:00:00Z","last changed":"2026-11-18T05:00:00Z",expiration:null},
     domain_age_days:10,nameservers:["ns1.registry.example"],retrieved_at:at,provenance:"synthetic"},
    {kind:"dns",source_record_id:"SRC-DEMO-DNS",source_name:"Fictional resolver",source_url:"https://resolver.example/",value:"192.0.2.44",
     name:host,type:"A",ttl:300,dnssec:"unconfirmed",retrieved_at:at,provenance:"synthetic"},
    {kind:"certificate_transparency",source_record_id:"SRC-DEMO-CT",source_name:"Fictional transparency log",source_url:"https://certs.example/",value:"Illustrative certificate",
     names:["portal."+host],issuer:"Example Demo CA",not_before:"2026-11-13T05:00:00Z",not_after:"2027-02-13T05:00:00Z",
     retrieved_at:at,provenance:"synthetic"}
  ];
  return {evidence_ref:ref,host,registered_domain:host,subdomains:["portal."+host],addresses:["192.0.2.44"],
    first:at,timeline:[{type:"registration",at:values[0].events.registration,record_id:"SRC-DEMO-RDAP"},
      {type:"certificate validity begins",at:values[2].not_before,record_id:"SRC-DEMO-CT"},
      {type:"DNS retrieval",at,record_id:"SRC-DEMO-DNS"},{type:"case acquisition",at,record_id:ref}],
    sources:values.map((entry,i)=>({source:["rdap","dns","ct"][i],status:"synthetic",results:[{...entry,evidence_ref:ref}],gaps:[]}))};
}
function domainView() {
  const record=selectedCase(),data=offline?domainFixture(record):latestObservation(record,"domain");
  const domains=observedIndicators(record,["domain"]);
  const rows=data?.sources.flatMap(src=>src.results)||[];
  const details=rows.find(row=>row.kind==="registration");
  const lookup='<form id="domain-query">'+field("Observed hostname","domain-host",selectRecords("domain-host",domains))+
    '<div class="check-stack">'+["dns","rdap","ct","network"].map(name=>'<label><input type="checkbox" name="sources" value="'+name+'" '+(["dns","rdap"].includes(name)?'checked':'')+'> '+sourceLabel[name]+'</label>').join("")+
    '</div><label><input required type="checkbox" name="consent"> Send hostname to the selected public providers</label>'+
    '<div class="actions" style="margin-top:10px">'+submit("Retrieve intelligence")+'</div>'+statusSlot+'</form>';
  const schema=data?term("Registered domain",data.registered_domain)+term("Registrar",details?.registrar||"Not available")+
    term("Domain age",details?.domain_age_days!=null?details.domain_age_days+" days at lookup":"Not available")+
    term("Delegation DNSSEC",details?.dnssec_delegation_signed==null?"Not available":details.dnssec_delegation_signed?"Registry reports signed":"Registry reports unsigned")+
    term("Nameservers",details?.nameservers?.join(", ")||"Not available")+term("Passive subdomains",data.subdomains.join(", ")||"Not available"):
    empty("Choose stored evidence and retrieve observations.");
  const ipView=data?.addresses?.length?'<div class="relationship-flow"><span class="chip">'+safe(data.host)+'</span><span aria-hidden="true">→</span>'+
    data.addresses.map(address=>'<span class="chip mono">'+safe(address)+'</span>').join("")+'</div>':empty("No address records were returned.");
  return heading("Domain intelligence","Read registration, DNS and certificate observations with source and retrieval times.")+
    (offline?box("Synthetic fixture","The registration dates, DNS addresses and certificates on this screen are fictional."): "")+
    '<div class="grid">'+panel("Registration",schema,scenarioMark(record))+
    panel("Provider coverage",offline?arrList(data?.sources||[],row=>item(sourceLabel[row.source],"Recorded simulation","Synthetic")):lookup)+'</div>'+
    '<div class="grid">'+panel("DNS and registration timeline",arrList(data?.timeline||[],row=>item(row.type,dateLabel(row.at),row.record_id)))+
    panel("Domain-to-IP relationships",ipView)+ '</div>'+
    panel("Source observations",rows.length?table(["Kind","Value","Source / retrieval","Evidence"],rows.map(row=>[
      safe(row.type||row.kind),'<span class="break">'+safe(row.value)+'</span>'+(row.issuer?'<br>'+safe(row.issuer):"")+
         (row.names?.length?'<br>'+safe(row.names.join(", ")):""),
      safe(row.source_name)+"<br>"+safe(dateLabel(row.retrieved_at))+"<br>"+safe(row.source_url),
      safe(row.source_record_id)+"<br>"+safe(row.evidence_ref)+" "+sourceTag(row.provenance)])):
      data?arrList(data.sources,row=>item(sourceLabel[row.source]||row.source,row.gaps.join(" · "),row.status)):empty("No source results yet."));
}

function websiteView() {
  const record=selectedCase(),list=currentObservations(record).filter(row=>row.kind==="sandbox"&&row.provenance==="live"),run=list.at(-1);
  const choices=(record?.evidence||[]).filter(row=>["url","website"].includes(row.kind)).map(row=>({value:row.analysis.details.submitted,evidence_ref:row.id}));
  const status=offline?"Fixture replay":state.health?.sandbox?.live||"unavailable";
  const controls=offline?box("Offline replay","The offline demonstration uses a fictional event trace with zero network requests.")+link("Open website sandbox","sandbox","primary"):
    '<form id="live-observe">'+field("Submitted website evidence","observe-url",selectRecords("observe-url",choices))+
    '<label><input type="checkbox" name="consent" required> Approve a bounded public GET and validated redirects</label>'+
    '<div class="actions" style="margin-top:9px">'+submit("Observe document")+' '+link("Configuration","settings")+'</div>'+statusSlot+'</form>';
  const requests=run?.requests||[];
  const screenshot=run?.worker?.policy_status==="verified"&&/^[A-Za-z0-9+/=]{1,870000}$/.test(run.worker.screenshot)?
    '<img class="snapshot" alt="Inert rendered snapshot of the selected public document" src="data:image/png;base64,'+safe(run.worker.screenshot)+'"><p class="small muted">'+safe(run.worker.caption)+'</p>':
    empty("A verified inert snapshot will appear after successful collection and rendering.");
  return heading("Website investigation","Inspect a public document, its redirect chain and an inert snapshot.")+
    '<div class="grid">'+panel("Observation controls",controls,sourceTag(status))+
    panel("Collection boundary",term("Public gateway","One bounded GET per validated step")+term("Renderer","Disposable networkless browser")+
    term("Website scripts and resources","Reference extraction only")+term("Form actions","Recorded as metadata")+term("Status",run?.capture_status||status))+'</div>'+
    '<div class="grid">'+panel("Redirect chain",requests.length?'<div class="relationship-flow">'+requests.map(row=>'<span class="chip">'+safe(row.status_code+" · "+row.host)+'</span>').join('<span aria-hidden="true">→</span>')+'</div>':
      offline?arrList(HEX_EVENTS.slice(0,2),row=>item(row[1],row[3],"Synthetic replay")):empty("No public network observations."))+
    panel("Render evidence",screenshot,run?.worker?.policy_status==="verified"?pill("Policy verified","live"):"")+'</div>'+
    panel("Network events",run?.events?.length?table(["Time","Observation","Supporting evidence"],run.events.map(row=>[
      safe(dateLabel(row.timestamp)),safe(row.category+" · "+row.detail),safe(run.id+" / "+row.evidence_ref)])):
      offline?empty("Open Website Sandbox to play the synthetic network events."):empty("Start a public document observation."))+
    (run?.document?'<div class="grid" style="margin-top:15px">'+panel("Forms",arrList(run.document.forms,row=>item(row.declared_method,row.action||"Unavailable",
      row.fields.map(field=>field.name||field.type).join(", "))))+panel("Resource references",arrList(run.document.resources.slice(0,25),row=>item(row.element,row.url,"Reference only · no request")))+'</div>':"");
}

function appsView() {
  const record=selectedCase(),observations=currentObservations(record).filter(row=>row.kind==="app_listing"),data=observations.at(-1);
  const packages=observedIndicators(record,["package"]);
  const apk=record?.evidence?.findLast(row=>row.kind==="apk");
  const fixture=HEX_DEMO.find(row=>row.type==="apk");
  const inputControls=offline?box("Synthetic listing","Manifest and permission observations use the included fictional RapidCredit case.")+
      btn("Open loan APK case","sample-case",'data-id="'+fixture.id+'"')+link("APK analysis","apk"):
    '<form id="app-identity">'+field("App name or package ID","app-name",input("app-name","",'required maxlength="200"'))+
    submit("Acquire app identifier")+statusSlot+'</form><hr class="divider"><form id="listing-query">'+
    field("Observed package","listing-package",selectRecords("listing-package",packages))+
    '<label><input type="checkbox" name="consent" required> Send the package ID to the public Android catalogue</label>'+
    '<div class="actions" style="margin-top:9px">'+submit("Lookup public listing")+'</div>'+statusSlot+'</form>';
  const results=data?.results||[];
  const coverage=offline?term("App","RapidCredit Demo")+term("Package",fixture.apk.package)+term("Developer","Not available")+
    term("Version",fixture.apk.versionName)+term("Source","Synthetic manifest fixture"):
    results.length?arrList(results,row=>item(row.value,"Suggested version code "+(row.suggested_version_code??"unknown")+
        " · "+row.versions.map(version=>version.version_name).join(", "),row.source_record_id+" · "+row.source_url+" · "+row.provenance)):
    data?empty(data.gaps.join(" · ")):empty("Collect a catalogue result to show public versions.");
  return heading("Application intelligence","Investigate an Android identity, public versions and permission evidence.")+
    '<div class="grid">'+panel("Application intake",inputControls,scenarioMark(record))+panel("Public listing",coverage,sourceTag(offline?"synthetic":data?.status||"unavailable"))+'</div>'+
    '<div class="grid">'+panel("APK inspection",apk?term("Package",apk.analysis.details.package)+term("Signature",apk.analysis.details.signature_verification||"Fixture only")+
    term("SDK markers",apk.analysis.details.sdk_candidates?.join(", ")||"None observed in the sample")+link("Open APK analysis","apk"):
    link("Open APK analysis","apk"))+panel("Public review coverage",term("Collection","Investigator-supplied public references")+
      term("Attribution","Opinions or allegations")+link("Review analysis","reviews"))+'</div>';
}

function offlineMatches(record) {
  if(!record)return [];
  const data=graphData(record);
  const weights={upi_candidate:42,phone:40,package:32,email:28,domain:21,url:22,ip:8};
  const matches=[];
  for(const id of data.related_cases){
    const owned=data.edges.filter(edge=>edge.case_id===record.id),other=data.edges.filter(edge=>edge.case_id===id);
    const groups=new Map();
    for(const edge of owned){
      const linked=other.find(row=>row.id===edge.id);
      if(!linked)continue;
      const signal={...edge,related_evidence_ref:linked.evidence_ref,weight:weights[edge.type]||5};
      const name=edge.type==="url"?"domain":edge.type;
      if(!groups.has(name)||groups.get(name).weight<signal.weight)groups.set(name,signal);
    }
    const signals=[...groups.values()].sort((a,b)=>b.weight-a.weight);
    matches.push({match_id:"CMP-DEMO-"+id.slice(-4),related_case_id:id,title:state.cases.find(row=>row.id===id)?.title||id,
      similarity:Math.min(100,signals.reduce((sum,row)=>sum+row.weight,0)),signals});
  }
  return matches.sort((a,b)=>b.similarity-a.similarity);
}
const caseMatches=record=>offline?offlineMatches(record):(state.matches[record?.id]||[]);
function campaignView() {
  const record=selectedCase(),matches=caseMatches(record);
  return heading("Campaign detection","Inspect weighted historical overlap and follow the evidence into related cases.")+
    box(offline?"Synthetic campaign examples":"Association scope","Similarity indicates which records to review together. Shared infrastructure and identifiers alone cannot establish common ownership.")+
    '<div class="grid">'+panel("Historical matches",matches.length?table(["Related case","Similarity","Indicators",""],matches.map(row=>[
      safe(row.title)+"<br><span class='mono small'>"+safe(row.match_id)+"</span>",
      '<strong>'+row.similarity+' / 100</strong><div class="scale"><span style="width:'+row.similarity+'%"></span></div>',
      safe(row.signals.length),btn("Open","open",'data-id="'+safe(row.related_case_id)+'"')])):empty("No eligible historical matches."),
      link("Explore relationship graph","graph"))+
    panel("Scoring method",term("Signal types","Typed identifiers, exact overlap and recorded wording")+term("Caps","Correlated network signals are capped in connected mode.")+
      term("Implication","Case review priority")+term("Risk effect","0 points"))+'</div>'+
    panel("Evidence behind matches",matches.length?arrList(matches.flatMap(row=>row.signals.map(signal=>({...signal,case:row.related_case_id}))),signal=>
      item("+"+signal.weight+" · "+(typeLabel[signal.type]||signal.type),signal.value,
        signal.evidence_ref+" ↔ "+signal.related_evidence_ref+" · "+signal.case)):empty("No supporting links yet."));
}

