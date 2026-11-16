import {FontLoader} from './vendor/FontLoader.js';
import {localText} from './language.js';

// 标注值来自模型；线、界线、斜划和文字均为场景中的网格实体。
export function createDimensions({T,scene,camera,viewport,parts=[],cfg={},getView=()=>'',onChange,onModeChange}){
 const group=new T.Group();group.name='model-dimensions';scene.add(group);
 // 放入透明渲染队列末尾，但保持完全不透明，避免透明基础在后续通道盖住字形。
 const material=new T.MeshBasicMaterial({color:0x17666d,transparent:true,opacity:1,depthTest:false,depthWrite:false,toneMapped:false});
 const sideMaterial=material.clone();sideMaterial.color.setHex(0x0b4146);
 const cylinder=new T.CylinderGeometry(1,1,1,8),segments=[],labels=[],values=[];
 const byId=new Map(parts.map(p=>[p.c.id,p]));
 let owner=null,enabled=false,mode='layout',font=null,error='',lastView='',unplaced=0;
 let screenSegments=[];
 const control=document.createElement('section');control.className='dimension-control';
 control.style.cssText='margin:14px 0;padding:14px;border:2px solid #527d75;border-radius:6px;color:#234f55;background:#e6eee8;font-size:15px';
 const row=document.createElement('label'),toggle=document.createElement('input');toggle.type='checkbox';toggle.id='dimensions-toggle';
 toggle.style.cssText='width:23px;height:23px;margin:0;accent-color:#286b63';row.style.cssText='display:flex;align-items:center;gap:10px;min-height:38px;font-weight:700;cursor:pointer';
 const title=document.createElement('span'),select=document.createElement('select');select.id='dimension-mode';
 for(const value of ['member','layout']){const option=document.createElement('option');option.value=value;select.append(option);}
 select.value=mode;select.style.cssText='width:100%;display:block;margin-top:8px;padding:8px';
 const note=document.createElement('small');note.style.cssText='display:block;margin-top:5px;line-height:1.5';
 const spacingNote=document.createElement('small');spacingNote.hidden=true;
 row.append(toggle,title);control.append(row,select,note,spacingNote);document.querySelector('#shared-controls summary').after(control);
 function updateText(){
  title.textContent=enabled?localText('Dimensions: ON','尺寸标注：已开启'):localText('Show dimensions','显示尺寸标注');
  select.options[0].textContent=localText('Selected member','选中构件');select.options[1].textContent=localText('Layout dimension chains','布置尺寸链');
  select.setAttribute('aria-label',localText('Dimension mode','标注模式'));
  note.textContent=error||(!font?localText('Loading 3D glyphs…','正在加载实体字形…'):mode==='member'?localText('Select a member · model extents in mm','点击构件 · 模型外包尺寸 · mm'):localText('Use Subfloor structure, Joist layout or Foundation plan · mm','用于楼面与桩基础、搁栅平面、基础平面 · mm'));
 }
 function modeChanged(){
  rebuild();
  const available=[...new Set((cfg.dimension_chains||[]).flatMap(c=>c.view_ids))];
  const target=enabled&&mode==='layout'&&!available.includes(getView())?(available.includes('structure')?'structure':available[0]):null;
  onModeChange?.(target);
 }
 toggle.onchange=()=>{enabled=toggle.checked;modeChanged();};select.onchange=()=>{mode=select.value;modeChanged();};
 document.addEventListener('model-language',updateText);
 function reset(){for(const mesh of labels)mesh.geometry.dispose();group.clear();segments.length=0;labels.length=0;values.length=0;screenSegments=[];unplaced=0;spacingNote.hidden=true;}
 function line(a,b){
  const direction=b.clone().sub(a),length=direction.length();if(length<1e-9)return;
  const mesh=new T.Mesh(cylinder,material);mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize());mesh.renderOrder=9000;
  group.add(mesh);segments.push({mesh,length,a:a.clone(),b:b.clone()});
 }
 function text(content,point,direction=new T.Vector3(1,0,0),outward=null){
  const depth=.14,geometry=new T.ExtrudeGeometry(font.generateShapes(content,1),{depth,bevelEnabled:false,curveSegments:5,steps:1});
  // 轻微斜向挤出使正面始终朝向用户时也能看到侧壁；每个字仍是带厚度的网格。
  const position=geometry.attributes.position;
  for(let i=0;i<position.count;i++){const back=depth-position.getZ(i);position.setXY(i,position.getX(i)+back*.6,position.getY(i)-back*.45);}
  position.needsUpdate=true;geometry.computeVertexNormals();
  geometry.computeBoundingBox();const b=geometry.boundingBox;geometry.translate(-(b.max.x+b.min.x)/2,-(b.max.y+b.min.y)/2,0);
  const mesh=new T.Mesh(geometry,[material,sideMaterial]);mesh.renderOrder=10000;
  mesh.userData={text:content,anchor:point.clone(),direction:direction.clone(),outward,height:b.max.y-b.min.y,width:b.max.x-b.min.x};labels.push(mesh);group.add(mesh);
 }
 function dimension(a,b,start,end,record){
  const axis=record.axis,length=Math.abs(b[axis]-a[axis]);if(length<1e-6)return;
  const direction=end.clone().sub(start).normalize(),tick=axis==='y'?new T.Vector3(1,1,0):new T.Vector3(1,0,1);
  tick.normalize().multiplyScalar(.12);
  // 界线仅保留尺寸线附近的一小段，外侧略伸出；真实测量锚点仍保留在记录中。
  const extension=(source,end)=>{const toSource=source.clone().sub(end),length=toSource.length();toSource.normalize();line(end.clone().addScaledVector(toSource,Math.min(.36,length*.8)),end.clone().addScaledVector(toSource,-.10));};
  extension(a,start);extension(b,end);line(start,end);line(start.clone().sub(tick),start.clone().add(tick));line(end.clone().sub(tick),end.clone().add(tick));
  const mm=Number((length*1000).toFixed(1)),outward=start.clone().add(end).sub(a).sub(b).normalize();
  text(String(mm),start.clone().add(end).multiplyScalar(.5),direction,outward);
  values.push({...record,mm,start:a.toArray(),end:b.toArray(),lineStart:start.toArray(),lineEnd:end.toArray()});
 }
 function buildMember(){
  if(!owner||owner.box.isEmpty())return;
  const {min,max}=owner.box,size=owner.box.getSize(new T.Vector3());if(!size.toArray().every(Number.isFinite))return;
  const offset=Math.max(.28,Math.max(size.x,size.y,size.z)*.12);
  for(const [axis,other,sign] of [['x','z',-1],['y','x',1],['z','x',-1]]){
   const a=min.clone(),b=min.clone();b[axis]=max[axis];if(sign>0)a[other]=b[other]=max[other];
   const start=a.clone(),end=b.clone();start[other]+=sign*offset;end[other]+=sign*offset;
   dimension(a,b,start,end,{axis,basis:'model-extents',refs:[owner.c.id]});
  }
 }
 function buildLayout(){
  for(const chain of cfg.dimension_chains||[]){
   if(!chain.view_ids.includes(getView()))continue;
   const refs=chain.station_refs.map(id=>{const part=byId.get(id);if(!part)throw Error(`Missing dimension reference: ${id}`);return part.box.getCenter(new T.Vector3());});
   for(let i=1;i<refs.length;i++){
    const a=refs[i-1].clone(),b=refs[i].clone();a.y=b.y=chain.elevation;
    const start=a.clone(),end=b.clone();start[chain.offset_axis]=end[chain.offset_axis]=chain.offset;
    dimension(a,b,start,end,{axis:chain.axis,basis:chain.basis,chain:chain.id,refs:chain.station_refs.slice(i-1,i+1)});
   }
  }
 }
 function rebuild(){
  reset();lastView=getView();error='';
  if(enabled&&font){try{mode==='member'?buildMember():buildLayout();}catch(e){reset();error=e.message;}}
  placeLabels();updateText();update();onChange();
 }
 function set(part){owner=part;if(mode==='member')rebuild();}
 // 只在标注重建时排字。此函数不读相机，字形始终固定在模型水平面。
 function placeLabels(){
  const occupied=[],overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  const intersects=(a,b,r)=>{
   let lo=0,hi=1;const dx=b.x-a.x,dz=b.z-a.z;
   for(const [v,q] of [[-dx,a.x-r.left],[dx,r.right-a.x],[-dz,a.z-r.top],[dz,r.bottom-a.z]]){
    if(Math.abs(v)<1e-9){if(q<0)return false;continue;}const t=q/v;
    if(v<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return false;
   }return true;
  };
  const extent=owner?owner.box.getSize(new T.Vector3()):new T.Vector3();
  const textHeight=mode==='layout'?.20:Math.max(.025,Math.min(.20,Math.max(extent.x,extent.y,extent.z)*.025));
  unplaced=0;
  for(const {mesh,length} of segments)mesh.scale.set(.008,length,.008);
  for(const mesh of labels){
   const {anchor,direction,height,outward}=mesh.userData;
   const axis=Math.abs(direction.y)>.5?new T.Vector3(1,0,0):direction.clone().normalize();
   const up=new T.Vector3(0,1,0).cross(axis).normalize();
   mesh.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(axis,up,new T.Vector3(0,1,0)));
   mesh.userData.plane='horizontal';mesh.scale.setScalar(textHeight/Math.max(height,.01));
   const move=outward?.clone()||up.clone();move.y=0;if(move.lengthSq()<1e-8)move.copy(up);move.normalize();
   const box=mesh.geometry.boundingBox;
   const corners=Array.from({length:8},(_,i)=>new T.Vector3(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z).multiply(mesh.scale).applyQuaternion(mesh.quaternion));
   let chosen=null;
   for(let step=0;step<32&&!chosen;step++){
    const position=anchor.clone().addScaledVector(move,textHeight*1.1+.09+step*textHeight*1.4);
    const bounds={left:position.x+Math.min(...corners.map(q=>q.x))-.025,right:position.x+Math.max(...corners.map(q=>q.x))+.025,top:position.z+Math.min(...corners.map(q=>q.z))-.025,bottom:position.z+Math.max(...corners.map(q=>q.z))+.025};
    if(occupied.some(r=>overlaps(bounds,r))||segments.some(({a,b})=>intersects(a,b,bounds)))continue;
    chosen={position,bounds};
   }
   mesh.visible=Boolean(chosen);
   if(chosen){occupied.push(chosen.bounds);mesh.position.copy(chosen.position);}else unplaced++;
  }
  spacingNote.hidden=unplaced===0;spacingNote.textContent=unplaced?localText('Some labels need layout review.','部分标注需要检查排布。'):'';
 }
 function update(allowedVisible=true){
  if(lastView!==getView()){rebuild();return;}
  group.visible=enabled&&Boolean(values.length)&&(mode==='layout'||Boolean(owner?.o.visible)&&allowedVisible);
  if(!group.visible)return;
  // 更新只回读屏幕范围供验证；不改变字形位置、旋转、尺寸或可见性。
  camera.updateMatrixWorld();
  const project=p=>{const q=p.clone().project(camera);return {x:(q.x+1)*viewport.clientWidth/2,y:(1-q.y)*viewport.clientHeight/2,z:q.z};};
  screenSegments=segments.map(({a,b})=>[project(a),project(b)]);
  for(const mesh of labels){
   const b=mesh.geometry.boundingBox;
   const points=Array.from({length:8},(_,i)=>project(new T.Vector3(i&1?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&4?b.max.z:b.min.z).multiply(mesh.scale).applyQuaternion(mesh.quaternion).add(mesh.position)));
   mesh.userData.screenBounds={left:Math.min(...points.map(q=>q.x)),right:Math.max(...points.map(q=>q.x)),top:Math.min(...points.map(q=>q.y)),bottom:Math.max(...points.map(q=>q.y))};
  }
 }
 new FontLoader().loadAsync(new URL('./vendor/helvetiker_regular.typeface.json',import.meta.url).href).then(value=>{font=value;rebuild();}).catch(e=>{error=localText('3D font unavailable: ','实体字形加载失败：')+e.message;updateText();});
 updateText();group.visible=false;
 return {set,update,frameScale:()=>enabled&&mode==='layout'&&(cfg.dimension_chains||[]).some(c=>c.view_ids.includes(getView()))?1.25:1,state:()=>({enabled,visible:group.visible,mode,fontReady:Boolean(font),error,unplaced,screenSegments,component:owner?.c.id||null,unit:'mm',values:values.map(v=>({...v})),labels:labels.map(m=>({text:m.userData.text,plane:m.userData.plane,baselineAlignment:Math.abs(new T.Vector3(1,0,0).applyQuaternion(m.quaternion).dot(m.userData.direction)),midpointDrift:m.position.clone().sub(m.userData.anchor).dot(m.userData.direction),planeNormal:new T.Vector3(0,0,1).applyQuaternion(m.quaternion).toArray(),visible:m.visible,screenBounds:m.userData.screenBounds,position:m.position.toArray(),quaternion:m.quaternion.toArray(),scale:m.scale.toArray(),isMesh:m.isMesh,isSprite:Boolean(m.isSprite),geometry:m.geometry.type,vertices:m.geometry.attributes.position.count,depth:m.geometry.parameters.options.depth,normalDot:new T.Vector3(0,0,1).applyQuaternion(m.quaternion).dot(new T.Vector3(0,0,1).applyQuaternion(camera.quaternion))})),sceneObjects:group.children.length})};
}
