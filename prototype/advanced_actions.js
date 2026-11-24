"use strict";
async function refreshObservations(record){
  state.observations[record.id]=await api("/cases/"+record.id+"/enrichment");
  if(state.active===record.id)paint();
}
async function loadStoredHistory(offset=0){
  const query=new URLSearchParams({...state.historyFilters,offset:String(offset)});
  for(const [key,value] of [...query])if(!value)query.delete(key);
  const output=await api("/history?"+query);
  state.historyRecords=offset?[...state.historyRecords,...output.records]:output.records;
  state.historyNext=output.next_offset;
}
function assistantFixture(query,language,record){
  const hi=language==="hi"||/[\u0900-\u097f]/.test(query),risk=riskOf(record),score=risk?.score??0;
  const wantsRisk=/risk|score|जोखिम|स्कोर/i.test(query);
  const facts=wantsRisk?(risk?.contributions||[]).map(rule=>"+"+rule.weight+" · "+rule.title):
    (record.evidence||[]).flatMap(ev=>ev.analysis.indicators.map(row=>row.type+" · "+row.value));
  return {summary:hi?(wantsRisk?"इस नमूने का जाँच स्कोर "+score+"/100 है।":"ये पहचानकर्ता काल्पनिक साक्ष्य में मिले हैं।"):
    wantsRisk?"The fixture assessment is "+score+"/100. These rules contribute to the result.":"The case evidence contains the following fixture identifiers.",
    facts,citations:(record.evidence||[]).map(ev=>({evidence_ref:ev.id})),mode:"synthetic workflow"};
}
async function submitAdvanced(form,data,record){
  if(!record&&["domain-query","live-observe","app-identity","listing-query","reviews-import","assistant-question"].includes(form.id))
    throw Error("Select a case first.");
  const value=key=>String(data.get(key)||"").trim(),select=id=>$("#"+id)?.selectedOptions[0],case_id=record?.id;
  switch(form.id){
    case "domain-query": {
      const selected=select("domain-host");
      if(!selected?.dataset.ref)throw Error("Choose an observed hostname.");
      await request("/domain/lookup",{case_id,evidence_id:selected.dataset.ref,indicator:selected.value,
        sources:data.getAll("sources"),consent:data.has("consent")});
      await refreshObservations(record);return "Source observations recorded";
    }
    case "live-observe": {
      const selected=select("observe-url");
      if(!selected?.dataset.ref)throw Error("Choose the submitted URL.");
      let result=await request("/website/jobs",{case_id,evidence_id:selected.dataset.ref,consent:data.has("consent")});
      for(let checks=0;checks<75&&["queued","running"].includes(result.status);checks++){
        const status=form.querySelector("[data-form-status]");
        if(status)status.textContent="Document observation · "+result.status;
        await new Promise(resolve=>setTimeout(resolve,1500));
        if(!state.token)return;
        result=await api("/website/jobs/"+result.id);
      }
      await refreshObservations(record);return "Document observation · "+result.status;
    }
    case "app-identity": {
      const result=await request("/analyze/app",{case_id,text:value("app-name"),source:"Analyst-supplied application identifier"});
      setEntry(await api("/cases/"+case_id));paint();
      return (result.duplicate?"Identifier already recorded · ":"App identifier acquired · ")+result.evidence_id;
    }
    case "listing-query": {
      const selected=select("listing-package");
      if(!selected?.dataset.ref)throw Error("Choose an observed Android package.");
      await request("/apps/lookup",{case_id,evidence_id:selected.dataset.ref,indicator:selected.value,consent:data.has("consent")});
      await refreshObservations(record);return "Catalogue lookup recorded";
    }
    case "reviews-import": {
      await request("/reviews/import",{case_id,evidence_id:value("review-evidence"),items:[{source_url:value("review-url"),text:value("review-text"),
        published_at:value("review-date")||null,rating:value("review-rating")?Number(value("review-rating")):null}]});
      await refreshObservations(record);return "Public reference recorded";
    }
    case "assistant-question": {
      const query=value("question"),language=value("answer-language");
      state.answers[case_id]=offline?assistantFixture(query,language,record):await request("/assistant/question",{case_id,query,language});
      paint();return "Cited answer ready";
    }
    case "history-form": {
      state.historyFilters={q:value("history-q"),kind:value("history-kind"),start:value("history-start"),end:value("history-end")};
      if(state.historyFilters.start&&state.historyFilters.end&&state.historyFilters.start>state.historyFilters.end)throw Error("Choose an end date after the start date.");
      if(!offline)await loadStoredHistory();
      paint();return "Historical results ready";
    }
  }
}
async function advancedAction(action,id,control,record){
  switch(action) {
    case "save-history": {
      const {q,kind,start,end}=state.historyFilters,label=q||kind||"All evidence";
      if(offline){
        state.savedSearches.unshift({id:"FIND-DEMO-"+shortId(),label,query:q,filters:{kind,start,end}});
        try{localStorage.setItem("hex-saved-search",JSON.stringify(state.savedSearches.slice(0,30)));}catch{}
      } else {
        const row=await request("/history/saved",{label:(label.length<3?"Query "+label:label).slice(0,60),query:q,kind,start:start||null,end:end||null});
        state.savedSearches.unshift(row);
      }
      paint();touchToast("Search saved");return;
    }
    case "saved-history": {
      const row=state.savedSearches.find(value=>value.id===id);
      if(!row)return;
      state.historyFilters={q:row.query,kind:row.filters.kind,start:row.filters.start||"",end:row.filters.end||""};
      if(!offline)await loadStoredHistory();
      paint();return;
    }
    case "next-history":
      if(state.historyNext!=null){await loadStoredHistory(state.historyNext);paint();}
      return;
    case "evidence-link":
      state.focusedEvidence=id;
      return show("vault",false);
    case "revision-history":
      state.focusedEvidence=id;
      state.revisions[id]=await api("/evidence/"+id+"/history");paint();return;
    case "reanalyze": {
      const result=await request("/evidence/"+id+"/reanalyze",{});
      setEntry(await api("/cases/"+record.id));
      state.revisions[id]=await api("/evidence/"+id+"/history");
      state.focusedEvidence=id;paint();touchToast("Analysis revision "+result.revision+" recorded");return;
    }
    case "globe":
      if(id==="list"){
        $("#globe-locations").setAttribute("tabindex","-1");$("#globe-locations").focus();
      }else globeFocus?.(id);
      return;
    case "graph-camera":
      graphFocus?.camera(id);return;
  }
}

