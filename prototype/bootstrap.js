"use strict";
{
  const prefix = location.protocol === "file:" ? "./" : "./ui/";
  (async () => {
    for (const file of ["rules.js","data.js","engine.js","graph.js","globe.js","views.js","tools.js",
      "advanced.js","research.js","app.js","actions.js","advanced_actions.js"]) {
      await new Promise((resolve,reject)=>{
        const script = document.createElement("script");
        script.src = prefix + file;
        script.onload = resolve;
        script.onerror = reject;
        document.head.append(script);
      });
    }
  })().catch(() => document.querySelector("#work").textContent = "The workspace could not load. Extract the whole prototype folder before opening index.html.");
}
