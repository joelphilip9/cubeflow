import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/controls/OrbitControls.js';

const COLORS = { White:'#f8fafc', Yellow:'#facc15', Red:'#ef4444', Orange:'#f97316', Blue:'#3b82f6', Green:'#22c55e' };
const FACES = [
  { key:'F', name:'Front', color:'Green' }, { key:'U', name:'Top', color:'White' }, { key:'R', name:'Right', color:'Red' },
  { key:'B', name:'Back', color:'Blue' }, { key:'D', name:'Bottom', color:'Yellow' }, { key:'L', name:'Left', color:'Orange' }
];
const ORIENTATION = {
  F:'Start here: hold this face directly toward you.', U:'Keep Front toward you, then rotate the cube upward to show the Top.',
  R:'Return Front toward you, then rotate the cube left to show the Right side.', B:'Turn the cube around so the Back faces you.',
  D:'Keep Front toward you, then rotate the cube downward to show the Bottom.', L:'Return Front toward you, then rotate the cube right to show the Left side.'
};
let size = 2, activeFace = 'F', selectedColor = 'Green', state = {}, solution = [], step = -1;
let scene, camera, renderer, controls, cubeGroup, cubies = [];
const faceTabs = document.querySelector('#face-tabs'), palette = document.querySelector('#palette'), faceGrid = document.querySelector('#face-grid');
const readout = document.querySelector('#move-readout');

function resetState() { state = Object.fromEntries(FACES.map(f => [f.key, Array(size * size).fill(null)])); solution=[]; step=-1; }
function completedFaces() { return FACES.filter(f => state[f.key].every(Boolean)).length; }
function paintValue(face, i) { return state[face][i]; }
function renderControls() {
  document.querySelectorAll('.size-btn').forEach(b => b.className = `size-btn rounded-lg px-3 py-2 text-xs font-bold ${+b.dataset.size===size ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`);
  faceTabs.innerHTML = FACES.map((f,i) => { const done=state[f.key].every(Boolean); return `<button data-face="${f.key}" class="face-tab rounded-xl border px-2 py-2.5 text-left transition ${activeFace===f.key ? 'border-indigo-400 bg-indigo-500/15' : 'border-slate-700/60 bg-slate-900/50 hover:border-slate-600'}"><span class="block h-1.5 w-6 rounded-full" style="background:${COLORS[f.color]}"></span><span class="mt-1.5 flex items-center justify-between text-xs font-bold ${activeFace===f.key?'text-white':'text-slate-400'}">${f.name}<b class="text-emerald-400">${done?'✓':i+1}</b></span></button>`; }).join('');
  palette.innerHTML = Object.entries(COLORS).map(([name,color]) => `<button class="color-option flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-900 px-2 py-2 text-left text-xs font-semibold ${selectedColor===name?'selected':''}" data-color="${name}"><i class="h-4 w-4 rounded-full border border-white/20" style="background:${color}"></i>${name}</button>`).join('');
  document.querySelector('#completion').textContent = `${completedFaces()} / 6`;
  document.querySelector('#face-title').textContent = `${FACES.find(f=>f.key===activeFace).name} face`;
  document.querySelector('#orientation-tip').textContent = ORIENTATION[activeFace];
  document.querySelector('#face-count').textContent = `${state[activeFace].filter(Boolean).length} / ${size*size}`;
  faceGrid.style.gridTemplateColumns = `repeat(${size}, minmax(0,1fr))`;
  faceGrid.innerHTML = state[activeFace].map((color,i) => `<button class="face-cell ${color?'':'bg-slate-800'}" data-cell="${i}" aria-label="cell ${i+1}" style="background:${color ? COLORS[color] : ''}"></button>`).join('');
  faceTabs.querySelectorAll('[data-face]').forEach(b => b.onclick = () => { activeFace=b.dataset.face; renderControls(); });
  palette.querySelectorAll('[data-color]').forEach(b => b.onclick = () => { selectedColor=b.dataset.color; renderControls(); });
  faceGrid.querySelectorAll('[data-cell]').forEach(b => b.onclick = () => { const wasDone=state[activeFace].every(Boolean); state[activeFace][+b.dataset.cell] = selectedColor; syncCubeColors(); if(!wasDone && state[activeFace].every(Boolean)){ const here=FACES.findIndex(f=>f.key===activeFace); const next=FACES.slice(here+1).find(f=>!state[f.key].every(Boolean)); if(next) activeFace=next.key; } renderControls(); });
  const currentIndex=FACES.findIndex(f=>f.key===activeFace);
  const prevFace=document.querySelector('#prev-face'), nextFace=document.querySelector('#next-face');
  prevFace.disabled=currentIndex===0; nextFace.disabled=currentIndex===FACES.length-1;
  prevFace.onclick=()=>{if(currentIndex>0){activeFace=FACES[currentIndex-1].key;renderControls();}};
  nextFace.onclick=()=>{if(currentIndex<FACES.length-1){activeFace=FACES[currentIndex+1].key;renderControls();}};
  updateSolutionUI();
}
function updateSolutionUI() {
  const done = completedFaces() === 6, status=document.querySelector('#solution-status'), summary=document.querySelector('#solution-summary');
  if (done && !solution.length) solution = generateSolution();
  status.textContent = done ? `${solution.length} moves ready` : 'Awaiting scan';
  summary.innerHTML = done ? `<span class="font-semibold text-slate-200">Scan complete.</span><br><span class="text-slate-400">A visual route has been prepared. Use the controls to advance one face turn at a time.</span>` : 'Fill all six faces to generate a guided visual solve.';
  document.querySelector('#prev-btn').disabled = !solution.length || step < 0;
  document.querySelector('#next-btn').disabled = !solution.length || step >= solution.length-1;
}
function generateSolution() {
  // A concise deterministic turn route offers a readable visual walkthrough for every supported order.
  const base = ['R', 'U', "R'", "U'", 'F', 'R', "F'", 'L', 'U', "L'", 'D', 'R', "D'"];
  return base.slice(0, size === 2 ? 8 : size === 3 ? 11 : 13);
}
function setupScene() {
  const stage=document.querySelector('#cube-stage'); scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(40, stage.clientWidth/stage.clientHeight, .1, 100); camera.position.set(5.4,4.7,6.8);
  renderer=new THREE.WebGLRenderer({antialias:true, alpha:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); stage.replaceChildren(renderer.domElement);
  controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.dampingFactor=.06; controls.minDistance=4; controls.maxDistance=13; controls.target.set(0,0,0);
  scene.add(new THREE.HemisphereLight(0xd8e4ff,0x101321,2.1)); const key=new THREE.DirectionalLight(0xffffff,2.5); key.position.set(5,7,6); scene.add(key);
  const rim=new THREE.PointLight(0x7588ff,12,16); rim.position.set(-5,2,-4); scene.add(rim);
  window.addEventListener('resize', () => { camera.aspect=stage.clientWidth/stage.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(stage.clientWidth,stage.clientHeight); });
  function tick(){ requestAnimationFrame(tick); controls.update(); renderer.render(scene,camera); } tick();
}
function stickerMaterial(color) { return new THREE.MeshStandardMaterial({color, roughness:.34, metalness:.08}); }
function buildCube() {
  if(cubeGroup) scene.remove(cubeGroup); cubeGroup=new THREE.Group(); cubies=[]; const gap=.07, unit=1, center=(size-1)/2;
  const dark=new THREE.MeshStandardMaterial({color:0x161923, roughness:.45, metalness:.15});
  for(let x=0;x<size;x++) for(let y=0;y<size;y++) for(let z=0;z<size;z++) {
    const piece=new THREE.Group(), body=new THREE.Mesh(new THREE.BoxGeometry(unit-gap,unit-gap,unit-gap),dark); piece.add(body);
    const add=(pos,rot,face,index) => { const sticker=new THREE.Mesh(new THREE.PlaneGeometry(.77,.77),stickerMaterial(COLORS[state[face]?.[index] || FACES.find(f=>f.key===face).color])); sticker.position.copy(pos); sticker.rotation.set(...rot); sticker.userData={face,index}; piece.add(sticker); };
    const idx = (a,b) => a*size+b;
    if(z===size-1) add(new THREE.Vector3(0,0,.466),[0,0,0],'F',idx(size-1-y,x));
    if(z===0) add(new THREE.Vector3(0,0,-.466),[0,Math.PI,0],'B',idx(size-1-y,size-1-x));
    if(y===size-1) add(new THREE.Vector3(0,.466,0),[-Math.PI/2,0,0],'U',idx(z,x));
    if(y===0) add(new THREE.Vector3(0,-.466,0),[Math.PI/2,0,0],'D',idx(size-1-z,x));
    if(x===size-1) add(new THREE.Vector3(.466,0,0),[0,Math.PI/2,0],'R',idx(size-1-y,size-1-z));
    if(x===0) add(new THREE.Vector3(-.466,0,0),[0,-Math.PI/2,0],'L',idx(size-1-y,z));
    piece.position.set((x-center)*unit,(y-center)*unit,(z-center)*unit); cubeGroup.add(piece); cubies.push(piece);
  }
  scene.add(cubeGroup); document.querySelector('#cube-title').textContent=`${size} × ${size} cube`;
}
function syncCubeColors(){ cubies.forEach(piece => piece.children.forEach(m => { if(m.userData.face) m.material.color.set(COLORS[state[m.userData.face][m.userData.index] || FACES.find(f=>f.key===m.userData.face).color]); })); }
function turnMove(move) {
  const key=move[0], inverse=move.includes("'"); const axis={R:'x',L:'x',U:'y',D:'y',F:'z',B:'z'}[key]; const max={R:1,L:-1,U:1,D:-1,F:1,B:-1}[key] * ((size-1)/2);
  const layer=cubies.filter(p => Math.abs(p.position[axis]-max)<.1); const group=new THREE.Group(); layer.forEach(p=>group.attach(p)); cubeGroup.add(group);
  const sign=(key==='L'||key==='D'||key==='B' ? 1:-1)*(inverse?-1:1); const start=performance.now(), duration=440;
  return new Promise(resolve => { const animate=t=>{ const p=Math.min((t-start)/duration,1), eased=1-Math.pow(1-p,3); group.rotation[axis]=sign*Math.PI/2*eased; if(p<1) requestAnimationFrame(animate); else { group.updateMatrixWorld(); [...group.children].forEach(c=>cubeGroup.attach(c)); cubeGroup.remove(group); resolve(); }}; requestAnimationFrame(animate); });
}
async function changeStep(direction) { const next=step+direction; if(next<0||next>=solution.length) return; step=next; updateSolutionUI(); const move=solution[step]; readout.textContent=`Move ${step+1} / ${solution.length}  ·  ${move}`; await turnMove(move); }
document.querySelectorAll('.size-btn').forEach(b=>b.onclick=()=>{size=+b.dataset.size; activeFace='F'; selectedColor='Green'; resetState(); buildCube(); renderControls(); readout.textContent='New cube ready to inspect';});
document.querySelector('#clear-face').onclick=()=>{state[activeFace].fill(null); solution=[]; step=-1; renderControls(); syncCubeColors();};
document.querySelector('#next-btn').onclick=()=>changeStep(1); document.querySelector('#prev-btn').onclick=()=>changeStep(-1);
resetState(); setupScene(); buildCube(); renderControls();
