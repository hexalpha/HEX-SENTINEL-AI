"use strict";

const offline = location.protocol === "file:";
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (char) =>
  ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
const unique = (items, id) => [...new Map(items.map(item => [id(item),item])).values()];
const now = () => new Date().toISOString();
const dayLabel = (date) => new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",timeZone:"Asia/Kolkata"})
  .format(new Date(date));
const dateLabel = (date) => date ? new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",
  year:"numeric", hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kolkata"}).format(new Date(date)) + " IST" : "—";
const indicator = (type,value,evidence_ref,snippet=value) => ({type,value,evidence_ref,snippet});
const finding = (rule_id,group,title,weight,snippet,evidence_ref,kind="heuristic",confidence="medium") =>
  ({rule_id,group,title,weight:Math.max(0,Math.min(100,Math.trunc(HEX_CONFIG.weights[rule_id]??weight))),snippet,evidence_ref,kind,confidence});
const level = score => HEX_CONFIG.bands.find(([,minimum])=>score>=minimum)?.[0]||"Low";

function digest(text) {
  if (!globalThis.crypto?.subtle) return Promise.resolve(null);
  return crypto.subtle.digest("SHA-256",new TextEncoder().encode(text)).then(bytes=>
    Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,"0")).join(""));
}

function extract(text,id) {
  const patterns = [
    ["url",/https?:\/\/[^\s<>"'，।]+/gi,value=>value.replace(/[.,;:!?)}\]]+$/,"")],
    ["email",/[\w.+%-]+@[a-z\d-]+(?:\.[a-z\d-]+)+/gi,value=>value.toLowerCase()],
    ["upi_candidate",/(?<![\w@.])[a-z\d][a-z\d._-]{1,63}@[a-z][a-z\d]{1,29}(?![\w-]|\.[a-z\d])/gi,value=>value.toLowerCase()],
    ["phone",/(?<![\w.+])(?:\+91[- ]?|0)?[6-9](?:[- ]?\d){9}(?!\w|\.\d)/g,value=>"+91"+value.replace(/\D/g,"").slice(-10)],
  ];
  return unique(patterns.flatMap(([type,pattern,canonical])=>[...text.matchAll(pattern)].map(match=>
    indicator(type,canonical(match[0]),id,match[0]))), item=>item.type+item.value).slice(0,100);
}

function inspectLink(raw,id) {
  if (/[\s\\\x00-\x1f\x7f]/.test(raw.trim())) throw Error("Enter a single HTTP(S) URL or domain.");
  const url = new URL(raw.includes("://") ? raw.trim() : "https://"+raw.trim());
  const host = url.hostname.toLowerCase().replace(/\.$/,"");
  if (!["https:","http:"].includes(url.protocol) || (!host.includes(".") && !host.includes(":"))) {
    throw Error("Enter a single HTTP(S) URL or domain.");
  }
  const result = [];
  const ip = /^\d+(?:\.\d+){3}$/.test(host) || host.includes(":");
  if (url.username) result.push(finding("URL-01","host","URL contains deceptive user information",24,raw,id));
  if (ip) result.push(finding("URL-02","host","Link uses a literal IP address",16,host,id));
  if (host.includes("xn--")) result.push(finding("URL-03","host","Internationalised hostname needs visual comparison",12,host,id));
  if (/verify|kyc|login|secure|support|payment|update/.test(host)) result.push(finding("URL-04","host","Hostname contains an account or service keyword",12,host,id));
  if (/\/(?:verify|kyc|login|otp|payment|wallet|deposit)(?:[/.\-]|$)/i.test(url.pathname)) result.push(finding("URL-05","link_intent","Path suggests account, credential or payment activity",12,url.pathname,id));
  if (url.protocol==="http:") result.push(finding("URL-06","transport","Submitted URL uses HTTP",8,raw,id,"observation","high"));
  return {details:{host,scheme:url.protocol.slice(0,-1),path:url.pathname,port:url.port,query_keys:[...url.searchParams.keys()],
    store_link:["play.google.com","apps.apple.com"].includes(host)},
    indicators:[indicator("url",raw.trim().includes("://")?raw.trim():url.href,id),indicator(ip?"ip":"domain",host,id)],findings:result};
}

function analyzeOffline(kind,text,id,fixture=null) {
  let findings = [], indicators = [], details = {}, contradictions = [];
  if (kind==="apk") {
    if (!fixture) throw Error("Offline APK mode uses the included synthetic manifest.");
    const sensitive = fixture.permissions.filter(value=>!value.endsWith(".INTERNET"));
    details = {...fixture,sensitive_permissions:sensitive,signature_verification:"Fixture only"};
    indicators = [indicator("package",fixture.package,id),...extract(fixture.links.join(" "),id),
      indicator("domain","wallet-review.example",id)];
    findings = sensitive.map(permission=>finding("APK-01","app_permissions","Application requests a sensitive permission",18,
      permission,id,"observation","high"));
    if (sensitive.length>=3) findings.push(finding("APK-02","app_permissions","Application requests multiple sensitive permissions",30,
      sensitive.join(", "),id,"observation","high"));
  } else if (["website","url","app_store"].includes(kind)) {
    ({details,indicators,findings} = inspectLink(text,id));
  } else {
    if (kind==="email") {
      const header = text.split(/\r?\n\r?\n/)[0];
      for (const line of header.split(/\r?\n/)) {
        const match = line.match(/^(From|Reply-To|Return-Path|Subject|Authentication-Results):\s*(.*)$/i);
        if (match) details[match[1].toLowerCase()] = match[2];
      }
      const domain = (value)=>value?.match(/@([a-z0-9.-]+)/i)?.[1]?.toLowerCase();
      for (const key of ["reply-to","return-path"]) {
        if (domain(details[key]) && domain(details.from) && domain(details[key])!==domain(details.from)) {
          findings.push(finding("EML-"+key.toUpperCase(),"mail_alignment",key+" domain differs from From",15,details[key],id,"observation","high"));
        }
      }
      if (/(?:spf|dkim|dmarc)\s*=\s*(?:fail|softfail)\b/i.test(details["authentication-results"])) {
        findings.push(finding("EML-AUTH","mail_auth","Submitted authentication header reports a failure",12,details["authentication-results"],id));
      }
      if (/(?:spf|dkim|dmarc)\s*=\s*pass\b/i.test(details["authentication-results"])) {
        contradictions.push("A pass result appears in the supplied header. Its provenance is unverified.");
      }
    }
    indicators = extract(text,id);
    for (const [rule,group,title,weight,expression] of HEX_CONFIG.message_rules) {
      const match = text.match(new RegExp(expression,"i"));
      if (match) findings.push(finding(rule,group,title,weight,match[0],id));
    }
    for (const item of indicators.filter(entry=>entry.type==="url").slice(0,30)) {
      try {
        const link = inspectLink(item.value,id);
        indicators.push(...link.indicators);
        findings.push(...link.findings);
      } catch { /* The exact submitted string stays available as an extracted indicator. */ }
    }
  }
  const byGroup = new Map();
  for (const item of findings) {
    if(!item.weight)continue;
    if (!byGroup.has(item.group) || byGroup.get(item.group).weight<item.weight) byGroup.set(item.group,item);
  }
  const contributions = [...byGroup.values()].sort((a,b)=>b.weight-a.weight || a.rule_id.localeCompare(b.rule_id));
  const raw_total = contributions.reduce((sum,item)=>sum+item.weight,0);
  const score = Math.min(100,raw_total);
  const missing = kind==="apk" ? ["Signing certificate verification","Runtime behaviour","Developer attribution"] :
    ["External reputation","Independent attribution",kind==="email"?"Trusted server authentication":"Live website observations"];
  return {kind,details,status:"complete",version:HEX_CONFIG.version,findings:unique(findings,item=>item.rule_id+item.snippet),
    indicators:unique(indicators,item=>item.type+item.value),risk:{score,band:level(score),contributions,raw_total,
    confidence:contributions.length>=3?"medium":"low",missing,contradictions,updated_at:now(),evidence_ref:id,rule_version:HEX_CONFIG.version}};
}

function detect(text) {
  if (/^(From|Subject|Received|Return-Path|Authentication-Results):/i.test(text.trim()) && text.includes("\n")) return "email";
  try { return inspectLink(text,"").details.store_link ? "app_store" : "url"; } catch { return "message"; }
}

function seedCases() {
  return HEX_DEMO.map((item,index)=>{
    const id = "EV-DEMO-"+(index+1).toString().padStart(2,"0");
    const created_at = new Date(Date.UTC(2026,10,22-item.age,5,index*7)).toISOString();
    return {...item,synthetic:true,created_at,tags:[item.tag],notes:"",evidence:[{id,kind:item.type,source:item.source,created_at,
      filename:item.type==="apk"?"manifest.fixture.json":item.type==="email"?"mail.fixture.eml":"intake.fixture.txt",
      sha256:null,disposition:"synthetic",text:item.type==="apk"?JSON.stringify(item.apk):item.input,
      analysis:analyzeOffline(item.type,item.input,id,item.apk)}]};
  });
}

function saveFile(content,extension,name) {
  const types={json:"application/json",pdf:"application/pdf",csv:"text/csv",html:"text/html"};
  const blob = content instanceof Blob ? content : new Blob([content],{type:types[extension]||"application/octet-stream"});
  const address = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = address;
  link.download = name+"."+extension;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(address),1500);
}

function makePDF(sections) {
  const lines = [];
  for (const [heading,values] of sections) {
    lines.push({text:heading,head:true});
    for (const value of values) {
      const ascii = String(value).normalize("NFKD").replace(/[^\x20-\x7e]/g," ");
      const wrapped = ascii.match(/.{1,93}(?:\s|$)|.{1,93}/g) || [""];
      wrapped.forEach(text=>lines.push({text,head:false}));
    }
    lines.push({text:"",head:false});
  }
  const pages = [];
  const pdfText = value=>String(value).replace(/[\\()]/g,"\\$&");
  for (let i=0;i<lines.length;i+=45) {
    const body = lines.slice(i,i+45).map(({text,head},index)=>
      "BT /F1 "+(head?"12":"9")+" Tf "+(head?"0.58 0.12 0.26":"0.16 0.17 0.21")+
      " rg 44 "+(735-index*14)+" Td ("+pdfText(text)+") Tj ET").join("\n");
    pages.push("0.08 0.08 0.11 rg 0 758 595 84 re f\nBT /F1 20 Tf 1 1 1 rg 44 794 Td (HEX SENTINEL AI) Tj ET\n"+
      "BT /F1 9 Tf 1 1 1 rg 44 777 Td (OFFLINE INVESTIGATION DEMONSTRATION) Tj ET\n"+body+
      "\nBT /F1 9 Tf 0.5 0.3 0.37 rg 44 34 Td (DEMO ONLY  /  "+(pages.length+1)+") Tj ET");
  }
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>","", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  const keys=[];
  for (const body of pages) {
    const index=objects.length+1;
    keys.push(index+" 0 R");
    objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents "+(index+1)+" 0 R >>",
      "<< /Length "+body.length+" >>\nstream\n"+body+"\nendstream");
  }
  objects[1]="<< /Type /Pages /Kids ["+keys.join(" ")+"] /Count "+pages.length+" >>";
  let result="%PDF-1.4\n", offsets=[0];
  objects.forEach((object,i)=>{offsets.push(result.length);result+=(i+1)+" 0 obj\n"+object+"\nendobj\n";});
  const xref=result.length;
  return result+"xref\n0 "+offsets.length+"\n0000000000 65535 f \n"+
    offsets.slice(1).map(n=>String(n).padStart(10,"0")+" 00000 n \n").join("")+
    "trailer\n<< /Root 1 0 R /Size "+offsets.length+" >>\nstartxref\n"+xref+"\n%%EOF\n";
}

