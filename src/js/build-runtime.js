/**
 * Generates a standalone runtime ZIP of the flowchart.
 * The ZIP contains:
 *   - index.html (self-contained runtime page)
 *   - audio/ and images/ folders (fetched from /public)
 */
import JSZip from 'jszip';
import { serialiseDiagram } from './inspector.js';
import { AUDIO_FILES } from './audio-manifest.js';
import { IMAGE_FILES } from './image-manifest.js';

function generateRuntimeHTML(diagramJson) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Flowchart Runtime</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; background: #000; color: #fff; overflow: hidden; }
#stage { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.say-dialog { position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%); width: 700px; max-width: 90vw; background: #3d4554; border: 4px solid #e0e0e0; border-radius: 16px; padding: 20px 24px; color: #f0f0f0; font-size: 18px; line-height: 1.6; z-index: 200; box-shadow: 0 8px 40px rgba(0,0,0,0.5); min-height: 80px; transition: opacity 0.25s; }
.say-char { font-weight: 700; color: #60a5fa; margin-bottom: 4px; }
.say-next { position: absolute; bottom: 10px; right: 14px; width: 36px; height: 36px; border-radius: 50%; border: 2px solid #4dd0e1; background: transparent; color: #4dd0e1; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.say-next:hover { background: rgba(77,208,225,0.15); }
.menu-overlay { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; z-index: 200; }
.menu-btn { width: 500px; max-width: 80vw; padding: 16px 24px; background: #3d4554; border: none; border-radius: 8px; color: #e0e0e0; font-size: 18px; font-family: inherit; cursor: pointer; text-align: center; }
.menu-btn:hover { background: #4b5563; }
</style>
</head>
<body>
<div id="stage"></div>
<div id="output"></div>
<script>
const DIAGRAM = ${diagramJson};

const S = {
  variables: DIAGRAM.variables || [],
  messages: DIAGRAM.messages || [],
  enums: DIAGRAM.enums || [],
  nodes: DIAGRAM.nodes || [],
};

let running = false, callStack = [], currentNode = null, currentCmd = 0;
let waitTimer = null, menuEl = null, audioElements = {};
let ifBranchTaken = [];
function rel(url) { return url && url.startsWith('/') ? url.slice(1) : url; }
const output = document.getElementById('output');
const stage = document.getElementById('stage');

function coerce(val, type) {
  if (type === 'Integer') return parseInt(val, 10) || 0;
  if (type === 'Float') return parseFloat(val) || 0;
  if (type === 'Boolean') return val === true || val === 'true';
  return String(val ?? '');
}

function evalCond(c) {
  const v = S.variables.find(x => x.name === c.variableName);
  const vt = v ? v.type : 'String';
  const left = v ? coerce(v.value, vt) : undefined;
  let right;
  if (c.compareType === 'variable') { const rv = S.variables.find(x => x.name === c.compareVarName); right = rv ? coerce(rv.value, vt) : undefined; }
  else right = coerce(c.compareValue, vt);
  switch (c.operator) {
    case '==': return left == right; case '!=': return left != right;
    case '<': return left < right; case '<=': return left <= right;
    case '>': return left > right; case '>=': return left >= right;
  }
  return false;
}

function evalFullCond(cmd) {
  let r = evalCond(cmd);
  if (cmd.extraConditions) for (const ec of cmd.extraConditions) { const er = evalCond(ec); r = ec.logic === 'OR' ? r || er : r && er; }
  return r;
}

function appendOutput(html) { const d = document.createElement('div'); d.innerHTML = html; output.appendChild(d); output.scrollTop = output.scrollHeight; }

function start() {
  const entry = S.nodes.find(n => n.event?.type === 'gameStarted');
  if (!entry) { appendOutput('<div class="say">No "Game Started" block found.</div>'); return; }
  running = true; callStack = []; ifBranchTaken = [];
  execBlock(entry);
}

function execBlock(node) {
  if (!running) return;
  currentNode = node; currentCmd = 0;
  next();
}

function next() {
  if (!running) return;
  if (currentCmd >= currentNode.commands.length) {
    if (callStack.length > 0) { const f = callStack.pop(); currentNode = f.node; currentCmd = f.cmdIdx; next(); }
    else { running = false; }
    return;
  }
  const cmd = currentNode.commands[currentCmd]; currentCmd++;
  exec(cmd);
}

function skipToNext() {
  let d = 1;
  for (let i = currentCmd; i < currentNode.commands.length; i++) {
    const c = currentNode.commands[i];
    if (c.type === 'ifCondition') d++;
    if (c.type === 'endIf') { d--; if (d === 0) { currentCmd = i + 1; next(); return; } }
    if (d === 1 && (c.type === 'elseIf' || c.type === 'elseCmd')) { currentCmd = i; next(); return; }
  }
  next();
}

function skipToEndIf() {
  let d = 1;
  for (let i = currentCmd; i < currentNode.commands.length; i++) {
    if (currentNode.commands[i].type === 'ifCondition') d++;
    if (currentNode.commands[i].type === 'endIf') { d--; if (d === 0) { currentCmd = i + 1; next(); return; } }
  }
  next();
}

function exec(cmd) {
  if (!running) return;
  switch (cmd.type) {
    case 'say': {
      const text = cmd.text?.replace(/\\{\\$(\\w+)\\}/g, (_, n) => { const v = S.variables.find(x => x.name === n); return v ? String(v.value) : '{$' + n + '}'; }) || '';
      const dlg = document.createElement('div'); dlg.className = 'say-dialog';
      if (cmd.character) { const ch = document.createElement('div'); ch.className = 'say-char'; ch.textContent = cmd.character; dlg.appendChild(ch); }
      const txt = document.createElement('div'); dlg.appendChild(txt);
      document.body.appendChild(dlg);
      const ta = cmd.typingAudio !== false && cmd.typingAudioUrl ? new Audio(rel(cmd.typingAudioUrl)) : null;
      function finSay() {
        if (cmd.waitForNext !== false) {
          const nb = document.createElement('button'); nb.className = 'say-next'; nb.innerHTML = '▼';
          nb.addEventListener('click', () => { dlg.style.opacity = '0'; setTimeout(() => { dlg.remove(); next(); }, 250); });
          dlg.appendChild(nb);
        } else { waitTimer = setTimeout(() => { dlg.style.opacity = '0'; setTimeout(() => { dlg.remove(); next(); }, 250); }, 600); }
      }
      if (cmd.typingAnimation !== false) {
        let i = 0; function tc() { if (!running) { dlg.remove(); return; } if (i < text.length) { txt.textContent += text[i]; if (ta && text[i] !== ' ') { ta.currentTime = 0; ta.volume = 0.3; ta.play().catch(() => {}); } i++; waitTimer = setTimeout(tc, 30); } else { finSay(); } } tc();
      } else { txt.textContent = text; finSay(); }
      break;
    }
    case 'call': {
      const target = S.nodes.find(n => n.id === cmd.targetBlockId);
      if (!target) { next(); break; }
      if (cmd.mode === 'continue') callStack.push({ node: currentNode, cmdIdx: currentCmd });
      execBlock(target);
      break;
    }
    case 'menu': {
      const choices = [{ text: cmd.text, targetBlockId: cmd.targetBlockId }];
      while (currentCmd < currentNode.commands.length && currentNode.commands[currentCmd].type === 'menu') {
        choices.push({ text: currentNode.commands[currentCmd].text, targetBlockId: currentNode.commands[currentCmd].targetBlockId });
        currentCmd++;
      }
      const menuDiv = document.createElement('div'); menuDiv.className = 'menu-overlay';
      for (const ch of choices) {
        const btn = document.createElement('button'); btn.className = 'menu-btn'; btn.textContent = ch.text;
        btn.addEventListener('click', () => { menuDiv.remove();
          if (ch.targetBlockId != null) { const t = S.nodes.find(n => n.id === ch.targetBlockId); if (t) { execBlock(t); return; } } next(); });
        menuDiv.appendChild(btn);
      }
      document.body.appendChild(menuDiv);
      break;
    }
    case 'wait': waitTimer = setTimeout(() => { waitTimer = null; next(); }, (cmd.duration || 1) * 1000); break;
    case 'setVarValue': { const v = S.variables.find(x => x.name === cmd.variableName); if (v) v.value = coerce(cmd.value, v.type); next(); break; }
    case 'setVarCopy': { const t = S.variables.find(x => x.name === cmd.variableName); const s = S.variables.find(x => x.name === cmd.sourceVariableName); if (t && s) t.value = s.value; next(); break; }
    case 'sendMessage': { const targets = S.nodes.filter(n => n.event?.type === 'messageReceived' && n.event.message === cmd.message); if (targets.length > 0) { callStack.push({ node: currentNode, cmdIdx: currentCmd }); execBlock(targets[0]); } else next(); break; }
    case 'playMusic': { if (cmd.audioUrl) { try { const u = rel(cmd.audioUrl); if (audioElements[u]) audioElements[u].pause(); const a = new Audio(u); a.loop = cmd.loop ?? true; a.volume = cmd.volume ?? 1; a.play().catch(() => {}); audioElements[u] = a; } catch(_){} } next(); break; }
    case 'playSound': { if (cmd.audioUrl) { try { const a = new Audio(rel(cmd.audioUrl)); a.volume = cmd.volume ?? 1; if (cmd.waitUntilFinished) { a.addEventListener('ended', () => next()); a.play().catch(() => next()); return; } a.play().catch(() => {}); } catch(_){} } next(); break; }
    case 'stopAudio': { for (const [u, a] of Object.entries(audioElements)) { a.pause(); a.currentTime = 0; delete audioElements[u]; } next(); break; }
    case 'stageBgColor': stage.style.backgroundColor = cmd.color || ''; stage.style.backgroundImage = ''; next(); break;
    case 'stageBgImage': if (cmd.imageUrl) { stage.style.backgroundImage = 'url(' + rel(cmd.imageUrl) + ')'; stage.style.backgroundSize = 'cover'; stage.style.backgroundPosition = 'center'; } next(); break;
    case 'ifCondition': { const r = evalFullCond(cmd); ifBranchTaken.push(r); if (r) next(); else skipToNext(); break; }
    case 'elseIf': { if (ifBranchTaken.length > 0 && ifBranchTaken[ifBranchTaken.length - 1]) { skipToEndIf(); break; } const r = evalFullCond(cmd); if (r) { ifBranchTaken[ifBranchTaken.length - 1] = true; next(); } else skipToNext(); break; }
    case 'elseCmd': { if (ifBranchTaken.length > 0 && ifBranchTaken[ifBranchTaken.length - 1]) { skipToEndIf(); break; } ifBranchTaken[ifBranchTaken.length - 1] = true; next(); break; }
    case 'endIf': ifBranchTaken.pop(); next(); break;
    default: next();
  }
}

start();
<\/script>
</body>
</html>`;
}

export async function buildRuntime() {
  const zip = new JSZip();
  const diagram = serialiseDiagram();
  const diagramJson = JSON.stringify(diagram, null, 2);

  // Generate the runtime HTML
  zip.file('index.html', generateRuntimeHTML(diagramJson));

  // Fetch and add audio files
  for (const file of AUDIO_FILES) {
    try {
      const resp = await fetch(file);
      if (resp.ok) zip.file(file.slice(1), await resp.blob()); // remove leading /
    } catch (_) {}
  }

  // Fetch and add image files
  for (const file of IMAGE_FILES) {
    try {
      const resp = await fetch(file);
      if (resp.ok) zip.file(file.slice(1), await resp.blob());
    } catch (_) {}
  }

  // Generate and download ZIP
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'flowchart-runtime.zip';
  a.click();
  URL.revokeObjectURL(url);
}
