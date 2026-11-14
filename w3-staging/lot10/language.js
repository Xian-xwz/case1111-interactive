// 语言只影响界面表达；工程字段、对象修订和选择状态保持原值。
let language='zh',copy={};
try{language=localStorage.getItem('model-review-language')==='en'?'en':'zh';}catch{}
const originals=new WeakMap();
const pairs=[
 ['SHARED CONTROLS','共用控制'],['01 / VIEW','01 / 视图'],['02 / LAYERS','02 / 图层'],['03 / COMPONENT','03 / 构件信息'],
 ['Shared views, floors and visibility','共用视图、楼层与显示'],
 ['INTERACTIVE','交互模型'],['EXPLORE THE BUILDING','查看建筑'],['BROWSE','构件目录'],['WALL DISPLAY','墙体表现'],
 ['Roof','屋面'],['Trusses','屋架'],['Terrain','场地'],['Ground surface','场地状态'],['Ground floor','一层'],['First floor','二层'],['Whole house','整栋房屋'],
 ['Between floors','层间楼板'],['Solid walls','完整墙'],['Timber framing','木墙架'],['Overlay','半透明叠加'],
 ['ST · Structure','结构'],['ARC · Architecture','建筑'],['Reset view','重置视角'],['Loading your model…','正在加载模型…'],
 ['Drag to orbit','拖动旋转'],['Scroll to zoom','滚轮缩放'],['Right-drag to pan','右键平移'],
 ['One finger: rotate · Two fingers: zoom / pan','单指旋转 · 双指缩放或平移'],
 ['先看结论','At a glance'],['拟用构件','Proposed member'],['计算净跨','Design clear span'],['承重用途','Load-bearing role'],['承重分类','Load-bearing role'],['连接候选','Connection candidate'],
 ['这处还要核实','Still to check'],['构件编号、版本与模型参数','Member identity, revision and model information'],['展开完整计算、连接与依据','View calculations, connections and sources'],
 ['包围尺寸表示模型外形，不等于设计截面。','Model extents describe the displayed shape, not the design section.'],
 ['以下数据属于旧修订，请以重新绑定的结果为准。','These details refer to an earlier revision. Rebind the current results before use.'],
 ['候选资料以完整计算、适用条件及工程确认记录为准。','Candidate details remain subject to the complete calculations, applicability and engineering approval.'],
 ['构件','Member'],['过梁','Lintel'],['非承重上横档','Non-bearing head trimmer'],['过梁支承柱','Lintel support'],['通高边柱','Full-height stud'],['立柱','Stud'],['短柱','Short stud'],['窗台板','Sill'],['底板','Bottom plate'],['顶板','Top plate'],['横撑','Nogging'],['一层','Ground floor'],['二层','First floor'],
 ['所在位置','Location'],['本轮连接路线','Connection route'],['资料加载失败，可重试。当前无法判断资料是否齐全。','Component data could not be loaded. Retry before judging whether it is complete.'],['重新读取资料','Retry component data']
];
const dictionary=new Map();
for(const [a,b] of pairs){const en=/[\u4e00-\u9fff]/.test(a)?b:a,zh=en===a?b:a;dictionary.set(en,{en,zh});dictionary.set(zh,{en,zh});}
export function currentLanguage(){return language;}
export function localCopy(key,fallback=''){return copy[language]?.[key]||fallback;}
export function localText(en,zh){return language==='en'?en:zh;}
export function translated(value){
 const text=String(value??''),trim=text.trim();if(!trim)return text;
 const known=dictionary.get(trim);if(known)return text.replace(trim,known[language]);
 const split=trim.match(/^(.*?)\s*(?:\/|·)\s*([\u4e00-\u9fff].*)$/s);
 if(split&&/[A-Za-z]/.test(split[1])&&!/[\u4e00-\u9fff]/.test(split[1])){let chosen=language==='en'?split[1]:split[2];chosen=chosen.replace(/\s*·?\s*Not (?:supplied|modeled)\s*\/\s*/g,' · ');return chosen;}
 return text;
}
export function translateTree(root=document.body){
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 for(let text=walker.nextNode();text;text=walker.nextNode()){
  if(text.parentElement?.closest('script,style,[data-language-button],[data-original-source]'))continue;
  const last=originals.get(text);const original=last&&last.rendered===text.textContent?last.original:text.textContent;
  const rendered=translated(original);originals.set(text,{original,rendered});if(text.textContent!==rendered)text.textContent=rendered;
 }
 // 旧模板的small为同一控件的第二语言，单语界面不重复堆放。
 for(const small of root.querySelectorAll('button small,.section-label small,.toggle small,.local small,.gestures small,.view-title #view-zh'))small.hidden=true;
 document.documentElement.lang=language==='zh'?'zh-CN':'en';
 for(const button of document.querySelectorAll('[data-language-button]'))button.setAttribute('aria-pressed',String(button.dataset.languageButton===language));
}
export function configureLanguage(cfg={}){
 copy=cfg.ui_copy||{};
 if(!document.querySelector('[data-language-button]')){
  const group=document.createElement('div');group.className='language-switch';group.setAttribute('role','group');group.setAttribute('aria-label','Language');
  for(const [value,label] of [['zh','中文'],['en','English']]){const button=document.createElement('button');button.type='button';button.dataset.languageButton=value;button.textContent=label;
   button.onclick=()=>{if(language===value)return;language=value;try{localStorage.setItem('model-review-language',value);}catch{}document.dispatchEvent(new CustomEvent('model-language',{detail:value}));translateTree();};group.append(button);}
  document.querySelector('header')?.append(group);
 }
 translateTree();
}
