"use strict";
function globeDisplay(canvas,cases) {
  if(!canvas)return null;
  const places={Jaipur:[26.91,75.79],Ajmer:[26.45,74.64],Jodhpur:[26.24,73.02],Kota:[25.21,75.86],Bikaner:[28.02,73.31]};
  const counts=cases.filter(row=>row.synthetic&&places[row.region]).reduce((map,row)=>
    map.set(row.region,(map.get(row.region)||0)+1),new Map());
  const continents=[
    [[66,-165],[73,-137],[70,-105],[80,-81],[69,-55],[55,-59],[46,-50],[29,-79],[17,-89],[9,-80],[5,-78],[15,-97],[29,-115],[49,-125],[59,-143],[66,-165]],
    [[11,-74],[5,-51],[-7,-35],[-24,-43],[-40,-59],[-55,-69],[-46,-76],[-25,-70],[-5,-82],[11,-74]],
    [[71,-11],[78,28],[71,60],[75,111],[66,169],[54,164],[40,142],[22,132],[11,106],[2,100],[17,84],[8,76],[21,64],[27,56],[35,41],[45,33],[36,13],[37,-10],[50,-5],[60,-6],[71,-11]],
    [[35,-11],[35,17],[25,33],[12,50],[-12,41],[-35,19],[-28,10],[-7,7],[4,-16],[20,-17],[35,-11]],
    [[-12,129],[-16,143],[-33,153],[-40,145],[-34,116],[-23,114],[-12,129]],
    [[83,-51],[78,-22],[60,-42],[67,-56],[83,-51]]
  ];
  let lon=68,lat=21,zoom=1,drag=null;
  const radians=value=>value*Math.PI/180;
  function paint(){
    const {context:c,width:w,height:h}=canvasContext(canvas),cx=w/2,cy=h/2,r=Math.min(w,h)*.42*zoom;
    const p=radians(lat);
    const project=(north,east)=>{
      const latitude=radians(north),longitude=radians(east-lon);
      return {x:cx+r*Math.cos(latitude)*Math.sin(longitude),
        y:cy-r*(Math.cos(p)*Math.sin(latitude)-Math.sin(p)*Math.cos(latitude)*Math.cos(longitude)),
        visible:Math.sin(p)*Math.sin(latitude)+Math.cos(p)*Math.cos(latitude)*Math.cos(longitude)>=0};
    };
    const line=points=>{
      let visible=false;c.beginPath();
      for(const [north,east] of points){
        const node=project(north,east);
        if(node.visible){if(visible)c.lineTo(node.x,node.y);else c.moveTo(node.x,node.y);}
        visible=node.visible;
      }
      c.stroke();
    };
    const glow=c.createRadialGradient(cx-r*.25,cy-r*.35,r*.1,cx,cy,r);
    glow.addColorStop(0,"#302242");glow.addColorStop(1,"#121320");
    c.fillStyle=glow;c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.fill();
    c.save();c.clip();
    c.strokeStyle="#74577f62";c.lineWidth=1;
    for(let meridian=-180;meridian<180;meridian+=20)line(Array.from({length:37},(_,i)=>[i*5-90,meridian]));
    for(let parallel=-80;parallel<=80;parallel+=20)line(Array.from({length:73},(_,i)=>[parallel,i*5-180]));
    c.strokeStyle="#937ca9c1";c.lineWidth=1.8;
    for(const chain of continents)line(chain);
    const dots=[];
    for(const [name,count] of counts) {
      const node=project(...places[name]);
      if(node.visible)dots.push({node,name,count});
    }
    dots.forEach(({node,count})=>{
      const {x,y}=node;
      c.beginPath();c.arc(x,y,3+count,0,Math.PI*2);c.fillStyle="#ff8aad";c.shadowColor="#ff638a";c.shadowBlur=15;c.fill();c.shadowBlur=0;
    });
    c.restore();
    c.strokeStyle="#b091c6";c.lineWidth=1.1;c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.stroke();
    if(dots.length){
      const sample=dots.find(row=>row.name==="Jaipur")||dots.at(-1);
      c.fillStyle="#ffd3e1";c.font="600 12px Segoe UI";
      c.fillText("Rajasthan fixtures",Math.min(w-115,sample.node.x+10),sample.node.y-10);
    }
  }
  canvas.addEventListener("pointerdown",event=>{drag=[event.clientX,event.clientY];canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener("pointermove",event=>{
    if(!drag)return;
    lon-=(event.clientX-drag[0])*.46;
    lat=Math.min(80,Math.max(-80,lat+(event.clientY-drag[1])*.35));
    drag=[event.clientX,event.clientY];paint();
  });
  const release=()=>{drag=null;};
  canvas.addEventListener("pointerup",release);canvas.addEventListener("pointercancel",release);
  paint();observeCanvas(canvas,paint);
  return action=>{
    if(action==="in")zoom=Math.min(2,zoom*1.23);
    if(action==="out")zoom=Math.max(.65,zoom/1.23);
    if(action==="reset"){zoom=1;lat=21;lon=68;}
    paint();
  };
}

