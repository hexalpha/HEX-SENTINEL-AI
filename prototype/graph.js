"use strict";

const entityColors={url:"#ad9df8",domain:"#f57096",ip:"#7acaed",email:"#a8a5fd",upi_candidate:"#f8bb79",phone:"#7ae0bd",package:"#b0d3fc",case:"#f692ad"};
const hexPath=(context,x,y,radius)=>{
  context.beginPath();
  for(let i=0;i<6;i++){
    const radians=(i*60-30)*Math.PI/180;
    const px=x+radius*Math.cos(radians),py=y+radius*Math.sin(radians);
    if(!i)context.moveTo(px,py);else context.lineTo(px,py);
  }
  context.closePath();
};
function canvasContext(canvas) {
  const width=canvas.clientWidth,height=canvas.clientHeight;
  const dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.width=width*dpr;
  canvas.height=height*dpr;
  const context=canvas.getContext("2d");
  context.scale(dpr,dpr);
  return {context,width,height};
}
function cameraArt(canvas) {
  if (!canvas) return;
  const paint=()=>{
    const {context:c,width:w,height:h}=canvasContext(canvas);
    const x=w*.62,y=h*.51,r=Math.min(72,h*.29),glow=c.createRadialGradient(x,y,3,x,y,r*1.9);
    glow.addColorStop(0,"#ed6d9560");glow.addColorStop(1,"#eb689200");
    c.fillStyle=glow;c.fillRect(0,0,w,h);
    for (const [i,alpha] of [1.43,1.2,1,.8,.6].map((radii,i)=>[radii,[.14,.3,.7,.34,.48][i]])) {
      hexPath(c,x,y,r*i);c.strokeStyle="rgba(241,117,160,"+alpha+")";c.lineWidth=1;c.stroke();
    }
    const nodes=[[.18,.29],[.36,.18],[.45,.75],[.87,.25],[.91,.71],[.71,.9],[.18,.75],[.99,.44],[.66,.07]];
    for(const [i,[nx,ny]] of nodes.entries()){
      const px=w*nx,py=h*ny;
      const a=(i*60-30)*Math.PI/180;
      c.beginPath();c.moveTo(px,py);c.lineTo(x+r*Math.cos(a),y+r*Math.sin(a));
      c.strokeStyle=i%2?"#8c5376aa":"#ab79936e";c.stroke();
      c.beginPath();c.arc(px,py,i%3===0?4:2.5,0,Math.PI*2);c.fillStyle=i%2?"#eda0b8":"#c496e1";c.fill();
    }
    c.strokeStyle="#fe9cb8";c.lineWidth=2.2;c.lineCap="round";
    c.beginPath();c.moveTo(x-18,y-15);c.lineTo(x-18,y+15);c.moveTo(x+18,y-15);c.lineTo(x+18,y+15);
    c.moveTo(x-18,y);c.lineTo(x+18,y);c.stroke();
  };
  paint();
  observeCanvas(canvas,paint);
}
function observeCanvas(canvas,paint) {
  if (!("ResizeObserver" in window)) return;
  const observer=new ResizeObserver(()=>{
    if(canvas.isConnected) paint(); else observer.disconnect();
  });
  observer.observe(canvas);
}
function paintLocations(canvas,records) {
  if(!canvas)return;
  const cityPositions={Bikaner:[.29,.23],Jaipur:[.73,.41],Ajmer:[.57,.61],Jodhpur:[.26,.72],Kota:[.76,.83]};
  const counts=new Map();
  for(const entry of records) {
    if(entry.synthetic&&cityPositions[entry.region])counts.set(entry.region,(counts.get(entry.region)||0)+1);
  }
  const paint=()=>{
    const {context:c,width:w,height:h}=canvasContext(canvas);
    c.fillStyle="#10111b";c.fillRect(0,0,w,h);
    c.strokeStyle="#2c2b3c";c.lineWidth=1;
    for(let i=0;i<w;i+=25){c.beginPath();c.moveTo(i,0);c.lineTo(i,h);c.stroke();}
    for(let i=0;i<h;i+=25){c.beginPath();c.moveTo(0,i);c.lineTo(w,i);c.stroke();}
    for(const [city,count] of counts) {
      const [a,b]=cityPositions[city],x=w*a,y=h*b;
      const gradient=c.createRadialGradient(x,y,1,x,y,16+9*count);
      gradient.addColorStop(0,"#e95c91cc");gradient.addColorStop(1,"#e95c9100");
      c.fillStyle=gradient;c.fillRect(x-36,y-36,72,72);
      c.fillStyle="#ffb1ce";c.beginPath();c.arc(x,y,3+count,0,Math.PI*2);c.fill();
      c.fillStyle="#f1dce9";c.font="11px Segoe UI";
      c.textAlign=a>.62?"right":"left";c.fillText(city+" · "+count,x+(a>.62?-7:7),y-7);
    }
  };
  paint();
  observeCanvas(canvas,paint);
}
function drawGraph(canvas,data,mode,onSelect) {
  if (!canvas) return;
  let angle=.45,tilt=.3,selected=null,pointer=null,positions=[],moved=false;
  let zoom=1,panX=0,panY=0,panMode=false;
  const nodes=data.nodes.slice(0,32);
  const related=data.related_cases.slice(0,8);
  function paint(){
    const {context:c,width:w,height:h}=canvasContext(canvas),cx=w*.5+panX,cy=h*.5+panY;
    const radius=Math.min(w*.32,h*.39)*zoom;
    positions=nodes.map((node,index)=>{
      const t=index*2.3999632;
      if(mode==="2d"){
        const a=index*2*Math.PI/Math.max(1,nodes.length)-Math.PI/2;
        return {node,x:cx+Math.cos(a)*radius*1.3,y:cy+Math.sin(a)*radius,z:0};
      }
      const initialY=1-2*(index+.5)/nodes.length;
      const horizontal=Math.sqrt(1-initialY*initialY),x=Math.cos(t+angle)*horizontal,
        z=Math.sin(t+angle)*horizontal,y=initialY*Math.cos(tilt)-z*Math.sin(tilt),
        depth=initialY*Math.sin(tilt)+z*Math.cos(tilt),scale=1+.29*depth;
      return {node,x:cx+x*radius*scale*1.4,y:cy+y*radius*scale,z:depth};
    });
    c.strokeStyle="#45405b";c.lineWidth=1;
    for(const p of positions){
      c.beginPath();c.moveTo(cx,cy);c.lineTo(p.x,p.y);c.stroke();
    }
    related.forEach((caseId,i)=>{
      const x=30,y=27+i*26;
      for (const pos of positions.filter(pos=>data.edges.some(edge=>edge.case_id===caseId&&edge.id===pos.node.id))){
        c.beginPath();c.moveTo(x,y);c.lineTo(pos.x,pos.y);c.strokeStyle="#87657462";c.stroke();
      }
      c.fillStyle=entityColors.case;c.fillRect(x-4,y-4,8,8);
      c.fillStyle="#d4b5c8";c.font="9px Consolas";c.fillText(caseId,x+8,y-5);
    });
    hexPath(c,cx,cy,16);c.fillStyle="#9e365e";c.fill();c.strokeStyle="#ffa8ca";c.stroke();
    c.fillStyle="#fff";c.font="bold 11px Consolas";c.textAlign="center";c.fillText("HEX",cx,cy+4);c.textAlign="left";
    for(const {node,x,y,z} of [...positions].sort((a,b)=>a.z-b.z)){
      c.beginPath();c.arc(x,y,node.id===selected?8:5+z*1.3,0,Math.PI*2);
      c.fillStyle=entityColors[node.type]||"#c7c6da";c.fill();
      if(node.id===selected||((mode==="2d"||nodes.length<7)&&nodes.length<15)){
        c.fillStyle="#e7daed";c.font="10px Consolas";
        const text=node.value.length>27?node.value.slice(0,25)+"…":node.value;
        c.textAlign=x>cx?"right":"left";c.fillText(text,x+(x>cx?-7:7),y-8);c.textAlign="left";
      }
    }
    if (!nodes.length) {c.fillStyle="#b9b6c8";c.font="14px Segoe UI";c.fillText("Add evidence to show connections",18,28);}
  }
  canvas.addEventListener("pointerdown",event=>{
    pointer={x:event.clientX,y:event.clientY};
    moved=false;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove",event=>{
    if(!pointer)return;
    const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;
    if(Math.abs(dx)+Math.abs(dy)<2)return;
    moved=true;
    if(panMode||event.shiftKey||mode==="2d"){panX+=dx;panY+=dy;}
    else{angle+=dx*.012;tilt+=dy*.009;}
    pointer={x:event.clientX,y:event.clientY};paint();
  });
  canvas.addEventListener("pointerup",event=>{
    pointer=null;
    if(moved)return;
    const box=canvas.getBoundingClientRect(),x=event.clientX-box.left,y=event.clientY-box.top;
    const node=positions.find(pos=>Math.hypot(pos.x-x,pos.y-y)<13)?.node;
    if(node){selected=node.id;paint();onSelect(node.id);}
  });
  canvas.addEventListener("pointercancel",()=>{pointer=null;});
  paint();
  observeCanvas(canvas,paint);
  const focus=id=>{selected=id;paint();};
  focus.camera=action=>{
    if(action==="in")zoom=Math.min(2.3,zoom*1.24);
    if(action==="out")zoom=Math.max(.45,zoom/1.24);
    if(action==="pan"){
      panMode=!panMode;
      $("#pan-toggle")?.setAttribute("aria-pressed",String(panMode));
    }
    if(action==="reset"){zoom=1;panX=0;panY=0;angle=.45;tilt=.3;panMode=false;$("#pan-toggle")?.setAttribute("aria-pressed","false");}
    paint();
  };
  return focus;
}

