// 只展示上游提供的资料；这里没有计算、推断支承或工程确认写入。
import {translated,currentLanguage,localCopy,localText} from './language.js';
export const identityKeys=['project_id','object_id','object_revision','source_revision','design_revision','input_digest'];
export function sameBinding(binding,refs){
 return Boolean(binding&&refs?.length&&refs.some(ref=>identityKeys.every(key=>
  ref[key]!==undefined&&binding[key]===ref[key])));
}
export const stateText={missing_input:'Missing inputs / 缺少输入',not_calculated:'Not calculated / 尚未计算',
 calculated:'Calculated · pending review / 已算待确认',review:'Review required / 需要复核',
 fail:'Failed / 未通过',stale:'Outdated / 旧结果已过期',schematic:'Schematic / 示意',
 unlinked:'No linked engineering result / 尚无关联工程结果'};
export function engineeringState(data,refs){
 if(!data)return {status:'unlinked',confirmed:false};
 const stale=!sameBinding(data.binding,refs);
 const statuses=['beam','fixing'].map(key=>data[key]?.status);
 const status=stale?'stale':statuses.includes('fail')?'fail':statuses.includes('review')?'review':
  statuses.includes('missing_input')?'missing_input':statuses.every(s=>s==='calculated')?'calculated':
  statuses.includes('schematic')?'schematic':'not_calculated';
 const confirmation=data.confirmation;
 const confirmed=status==='calculated'&&confirmation?.status==='confirmed'&&
  sameBinding(confirmation.binding,[data.binding])&&Boolean(confirmation.record_ref&&confirmation.by&&confirmation.at&&confirmation.scope)&&
  ['beam','fixing'].every(key=>data[key]?.record_ref&&confirmation.result_refs?.includes(data[key].record_ref));
 return {status,confirmed};
}
export function wallValue(attributes,key){
 const entry=attributes?.[key];
 return entry&&['drawing','measured','derived','rule','confirmed'].includes(entry.status)&&
  entry.source_ids?.length&&entry.locator&&typeof entry.value==='boolean'?entry.value:null;
}
function node(tag,text,cl){const e=document.createElement(tag);if(text!==undefined)e.textContent=translated(text);if(cl)e.className=cl;return e;}
function fields(parent,rows){
 if(!rows?.length){parent.append(node('p','Not supplied / 尚未提供'));return;}
 const list=node('dl');
 for(const row of rows){
  list.append(node('dt',row.label),node('dd',row.value===undefined||row.value===null?'Unknown / 未知':
   `${row.value}${row.unit?' '+row.unit:''}`));
  if(row.status||row.locator)list.append(node('dd',[row.status,row.locator].filter(Boolean).join(' · '),'field-source'));
 }
 parent.append(list);
}
export function componentTitle(component){
 const title=component.parameters?.viewer?.design?.title;
 if(title)return translated(title);
 const rows=component.parameters?.viewer?.design?.fields||[];
 const location=rows.find(row=>row.label==='所在位置')?.value||'';
 const lot=String(location).match(/Lot\s*\d+/)?.[0];
 const role={lintel:'过梁',head_trimmer:'非承重上横档',jack_stud:'过梁支承柱',king_stud:'通高边柱',stud:'立柱',cripple:'短柱',sill:'窗台板',bottom_plate:'底板',top_plate:'顶板',nogging:'横撑'}[component.role];
 return [lot,component.floor==='FF'?translated('First floor / 二层'):component.floor==='GF'?translated('Ground floor / 一层'):'',translated(role||'构件')].filter(Boolean).join(' · ');
}
function renderSummary(component,refs){
 const data=component.parameters?.viewer,eng=data?.engineering;
 const review=data?.review_summary,summary=review?.[currentLanguage()]||review?.['detail_'+currentLanguage()];
 if(summary){
  const card=node('section',undefined,'component-summary');card.id='detail-summary';card.dataset.revision=review.revision||'';
  card.append(node('h3',summary.title||localCopy('card_title',translated('先看结论'))));
  const compact=review.layout==='three-row';
  if(summary.purpose&&!compact)card.append(node('p',summary.purpose,'summary-purpose'));
  if(!compact)card.append(node('p',localCopy(summary.status_key,summary.status||''),'summary-status'));
  const list=node('dl',undefined,'summary-grid');
  if(summary.rows?.length){
   for(const row of summary.rows){list.append(node('dt',row.label),node('dd',row.value));if(row.basis)list.append(node('dt',''),node('dd',row.basis,'field-source'));}
  }else for(const key of ['member','span','use','connection'])list.append(node('dt',localCopy(key,key)),node('dd',summary[key]??localCopy('not_available')));
  card.append(list);
  if(summary.pending?.length){const pending=node('details');pending.append(node('summary',localCopy('pending',translated('这处还要核实'))+' · '+summary.pending.length));const ul=node('ul');for(const item of summary.pending)ul.append(node('li',item));pending.append(ul);card.append(pending);}
  if(summary.boundary&&!compact)card.append(node('p',summary.boundary,'summary-boundary'));
  if(review.revision&&!compact)card.append(node('p',[review.revision,review.geometry_revision].filter(Boolean).join(' · '),'summary-revision'));
  return card;
 }
 if(!data?.design?.fields?.length)return null;
 const card=node('section',undefined,'component-summary');card.id='detail-summary';
 card.append(node('h3','先看结论'));
 const state=engineeringState(eng,refs);
 const text=state.confirmed?'已有对应修订的工程确认':stateText[state.status];
 card.append(node('p',text,'summary-status'));
 const find=(rows,label)=>rows?.find(row=>row.label===label);
 const rows=data.design.fields,section=find(rows,'拟用构件'),span=find(rows,'计算净跨'),type=find(rows,'承重分类');
 const list=node('dl',undefined,'summary-grid');
 for(const [label,row] of [['拟用构件',section],['计算净跨',span],['承重用途',type],['连接候选',find(eng?.fixing?.fields,'本轮连接路线')]]){
  if(row)list.append(node('dt',label),node('dd',`${row.value}${row.unit?' '+row.unit:''}`));
 }
 card.append(list);
 const pending=eng?.fixing?.missing||[];
 if(pending.length){
  card.append(node('h4','这处还要核实'));const ul=node('ul');
  for(const item of pending){
   ul.append(node('li',item));
  }card.append(ul);
 }
 if(state.status==='stale')card.append(node('p','以下数据属于旧修订，请以重新绑定的结果为准。','chip warning'));
 card.append(node('p',eng?.beam?.limitations||'候选资料以完整计算、适用条件及工程确认记录为准。','summary-boundary'));
 return card;
}
export function renderPresentation(component,refs,{selectRelated,openSource}){
 const data=component.parameters?.viewer||{},root=node('div',undefined,'presentation');
 const summary=renderSummary(component,refs);if(summary)root.append(summary);
 const nodeSource=data.sources?.find(s=>s.presentation_role==='node_detail');
 if(nodeSource){const button=node('button','View connection figure / 查看节点详图','source-button node-source-button');button.onclick=()=>openSource(nodeSource,button);root.append(button);}
 const technical=node('details',undefined,'detail-technical');technical.append(node('summary',localCopy('source_details',translated('展开完整计算、连接与依据'))));if(!summary)technical.open=true;root.append(technical);
 technical.append(node('p',localText('Source text is retained in its supplied language.','来源原文保留原语。'),'field-source'));
 if(data.detail_notes){const notes=data.detail_notes[currentLanguage()];if(notes){const s=node('section');s.append(node('h3','Member notes / 构件说明'));if(notes.status)s.append(node('p',notes.status));if(notes.purpose)s.append(node('p',notes.purpose));fields(s,notes.rows);technical.append(s);}}
 if(data.prior_review_summary){const original=data.prior_review_summary[currentLanguage()]||data.prior_review_summary.zh;if(original){const section=node('details');section.append(node('summary','Original calculation context / 原有计算与方案说明'));for(const key of ['status','use','connection','boundary'])if(original[key])section.append(node('p',original[key]));for(const item of original.pending||[])section.append(node('p',item));technical.append(section);}}
 const section=(key,title,parent=technical)=>{const s=node('section');s.id='detail-'+key;s.append(node('h3',title));parent.append(s);return s;};
 if(data.fixture)root.append(node('p','FIXTURE · Test data / 测试资料，数值与确认均为演示','chip warning'));
 if(component.group==='walls'){
  const wall=section('wall','Wall attributes / 墙体属性');
  for(const [key,label] of [['fire','Fire rating / 防火'],['load_bearing','Load bearing / 承重'],['bracing','Bracing / 抗侧力'],['non_bearing','Non-bearing / 非承重']]){
   const value=wallValue(data.wall_attributes,key),entry=data.wall_attributes?.[key];
   wall.append(node('p',`${label}：${value===null?'Unknown / 未知':value?'Yes / 是':'No / 否'}${entry?.locator?' · '+entry.locator:''}`));
  }
 }
 const design=section('design','Design & construction / 设计与构造');fields(design,data.design?.fields);
 const supports=section('supports','Supports & load path / 支承与传力');
 fields(supports,data.support_fields);
 for(const related of data.supports||[]){
  const b=node('button',`${related.label||related.component_id} · ${related.status||'Unknown / 待核'}`,'related-part');
  b.onclick=()=>selectRelated(related.component_id,b);supports.append(b);
  if(related.locator)supports.append(node('p',related.locator,'field-source'));
 }
 const inputs=section('inputs','Calculation inputs / 计算输入');fields(inputs,data.inputs);
 const eng=data.engineering,state=engineeringState(eng,refs);
 const results=section('results','Engineering result / 工程结果');
 const calculation=data.calculation,resultStatus=calculation?.status||state.status;
 results.dataset.status=resultStatus;results.append(node('p',stateText[resultStatus],'chip warning'));
 const resultPart=(key,label)=>{
  const result=eng?.[key],s=section(key,label);
  s.append(node('p',stateText[state.status==='stale'?'stale':result?.status]||stateText.not_calculated,'result-state'));
  if(result?.record_ref)s.append(node('p',`Record / 记录：${result.record_ref}`,'record-ref'));
  fields(s,result?.fields);
  if(result?.missing?.length)s.append(node('p','Missing / 缺项：'+result.missing.join('；'),'missing-inputs'));
  if(result?.limitations)s.append(node('p',result.limitations));
 };
 if(calculation){
  fields(results,calculation.fields);
  const fixing=section('fixing','Fixing basis / 连接依据');fields(fixing,data.connection_fields);
 }else{
  resultPart('beam','Beam calculation / 梁验算');resultPart('fixing','Fixing selection / 固定连接选型');
 }
 if(!calculation||data.sources?.length){
  const sources=section('sources','Sources & calculation report / 原图与计算书',technical);
  if(!data.sources?.length)sources.append(node('p','Not supplied / 尚未提供原图及计算书'));
  for(const source of data.sources||[]){
   const b=node('button',source.title||'Open source / 查看依据','source-button');
   b.onclick=()=>openSource(source,b);sources.append(b);
   if(source.locator)sources.append(node('p',source.locator,'field-source'));
  }
 }
 if(calculation)return root;
 const review=section('review','Review & CAD / 审阅与落图');
 review.append(node('p',state.status==='stale'?'Confirmation expired / 旧确认已过期':
  state.confirmed?'Confirmed record / 已有有效确认记录':'Awaiting coordinator confirmation / 待总控登记确认','confirmation-state'));
 if(eng?.confirmation?.status==='confirmed'){const c=eng.confirmation;
  fields(review,[{label:'Reviewer / 审阅人',value:c.by},{label:'Time / 时间',value:c.at},
   {label:'Scope / 范围',value:c.scope},{label:'Confirmation record / 确认记录',value:c.record_ref}]);
 }
 const cad=eng?.cad,validCad=state.confirmed&&sameBinding(cad?.binding,[eng.binding])&&cad?.confirmation_ref===eng.confirmation.record_ref;
 review.append(node('p',validCad&&cad.status==='applied'&&cad.receipt_ref?
  `CAD applied / 已落图 · ${cad.receipt_ref}`:'CAD pending / 待落图或待核回执','cad-state'));
 review.append(node('p','Review applies to the referenced revision and scope. / 审阅按引用修订与范围登记。'));
 return root;
}
