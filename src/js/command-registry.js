/**
 * Command Registry — single source of truth for every command type.
 *
 * Each entry defines:
 *   label, category, description  — metadata (was COMMAND_TYPES)
 *   create()                      — default properties (was createCommand switch)
 *   detail(cmd, nodes)            — one-line summary (was cmdDetail switch)
 *   renderFields(container, cmd, node)  — inspector editor fields (was renderCommandFields switch)
 *   color { dark, light }         — row colours (mirrors inspector.css classes)
 */

import { S } from './state.js';
import { AUDIO_FILES } from './audio-manifest.js';
import { IMAGE_FILES } from './image-manifest.js';
import {
  labeledInput,
  labeledSelect,
  labeledTextarea,
  labeledCheckbox,
  labeledBlockSelect,
  labeledIntegerInput,
  labeledFloatInput,
  renderConditionFields,
  createInput,
  getFieldCallbacks,
} from './field-builders.js';

// ── Registry ────────────────────────────────────────────────────────────────

export const COMMAND_REGISTRY = {

  say: {
    label: 'Say',
    category: 'Narrative',
    description: 'Display dialogue text',
    color: { dark: '#3b1f4a', light: '#f3e8ff' },
    create() {
      return { character: '', text: 'Hello!', portrait: '', waitForNext: true, typingAnimation: true, typingAudio: true, typingAudioUrl: '/audio/defaults/MidVoice.wav' };
    },
    detail(cmd) {
      const t = cmd.text || '';
      const charName = cmd.character ? `[${cmd.character}] ` : '';
      return `${charName}"${t.substring(0, 20)}${t.length > 20 ? '\u2026' : ''}"`;
    },
    renderFields(container, cmd, node) {
      const { updateCmdSummaryRow: _updateCmdSummaryRow } = getFieldCallbacks();
      // Character dropdown
      const { updateInspector: _updateInspector } = getFieldCallbacks();
      const charOpts = [['', '— none —'], ...S.characters.map(c => [c.name, c.name])];
      container.appendChild(labeledSelect('Character', cmd.character || '', charOpts, v => { cmd.character = v; cmd.portrait = ''; _updateCmdSummaryRow(); _updateInspector(); }));

      // Portrait dropdown (if character selected and has portraits)
      if (cmd.character) {
        const charObj = S.characters.find(c => c.name === cmd.character);
        if (charObj?.portraits?.length > 0) {
          const pOpts = [['', '— none —'], ...charObj.portraits.filter(p => p.description && p.imageUrl).map(p => [p.description, p.description])];
          container.appendChild(labeledSelect('Portrait', cmd.portrait || '', pOpts, v => { cmd.portrait = v; }));
        }
      }

      container.appendChild(labeledTextarea('Text', cmd.text, v => { cmd.text = v; _updateCmdSummaryRow(); }));
      container.appendChild(labeledCheckbox('Wait for next', cmd.waitForNext ?? true, v => { cmd.waitForNext = v; }));
      container.appendChild(labeledCheckbox('Typing animation', cmd.typingAnimation ?? true, v => { cmd.typingAnimation = v; }));
      container.appendChild(labeledCheckbox('Typing audio', cmd.typingAudio ?? true, v => { cmd.typingAudio = v; }));
      if (cmd.typingAudio !== false) {
        const audioOpts = [['', '— none —'], ...AUDIO_FILES.map(f => [f, f])];
        container.appendChild(labeledSelect('Typing sound', cmd.typingAudioUrl || '/audio/defaults/MidVoice.wav', audioOpts, v => { cmd.typingAudioUrl = v; }));
      }
    },
  },

  menu: {
    label: 'Menu',
    category: 'Flow',
    description: 'Present a player choice',
    color: { dark: '#1e293b', light: '#e0e7ff' },
    create() {
      return { text: 'Choice', targetBlockId: null };
    },
    detail(cmd, nodes) {
      const t = nodes.find(n => n.id === cmd.targetBlockId);
      return `"${cmd.text || ''}" \u2192 ${t ? t.label : '(none)'}`;
    },
    renderFields(container, cmd, node) {
      const { onNodeDataChanged: _onNodeDataChanged, updateCmdSummaryRow: _updateCmdSummaryRow } = getFieldCallbacks();
      container.appendChild(labeledInput('Button Text', cmd.text, v => { cmd.text = v; _updateCmdSummaryRow(); }));
      container.appendChild(labeledBlockSelect('\u2192 Block', cmd.targetBlockId, v => { cmd.targetBlockId = v; _onNodeDataChanged(); }, node));
    },
  },

  call: {
    label: 'Call',
    category: 'Flow',
    description: 'Transfer execution to another block',
    color: { dark: '#2a2a2a', light: '#e5e7eb' },
    create() {
      return { targetBlockId: null, mode: 'stop' };
    },
    detail(cmd, nodes) {
      const target = nodes.find(n => n.id === cmd.targetBlockId);
      return `<${target ? target.label : 'None'}> : ${cmd.mode === 'stop' ? 'Stop' : 'Continue'}`;
    },
    renderFields(container, cmd, node) {
      const { onNodeDataChanged: _onNodeDataChanged } = getFieldCallbacks();
      container.appendChild(labeledBlockSelect('Target Block', cmd.targetBlockId, v => { cmd.targetBlockId = v; _onNodeDataChanged(); }, node));
      container.appendChild(labeledSelect('Mode', cmd.mode, [['stop', 'Stop'], ['continue', 'Continue']], v => { cmd.mode = v; }));
    },
  },

  setVarValue: {
    label: 'Set Variable',
    category: 'Variables',
    description: 'Set a variable to a typed value',
    color: { dark: '#3a2a1a', light: '#fef3c7' },
    create() {
      return { variableName: '', value: '' };
    },
    detail(cmd) {
      return `${cmd.variableName || ''} = ${cmd.value ?? ''}`;
    },
    renderFields(container, cmd, node) {
      const { updateInspector: _updateInspector } = getFieldCallbacks();
      const varOpts = [['', '— select variable —'], ...S.variables.map(v => [v.name, `${v.name} (${v.type})`])];
      container.appendChild(labeledSelect('Variable', cmd.variableName || '', varOpts, v => { cmd.variableName = v; _updateInspector(); }));
      const selVar = S.variables.find(v => v.name === cmd.variableName);
      if (selVar) {
        if (selVar.type === 'Boolean') {
          container.appendChild(labeledSelect('Value', String(cmd.value ?? false), [['false', 'false'], ['true', 'true']], v => { cmd.value = v === 'true'; }));
        } else if (selVar.type === 'Enum' && selVar.enumName) {
          const enumSet = S.enums.find(e => e.name === selVar.enumName);
          if (enumSet) {
            const enumOpts = [['', '— select —'], ...enumSet.values.map(ev => [ev.key, ev.label || ev.key])];
            container.appendChild(labeledSelect('Value', cmd.value || '', enumOpts, v => { cmd.value = v; }));
          }
        } else if (selVar.type === 'Integer') {
          container.appendChild(labeledIntegerInput('Value', cmd.value ?? 0, v => { cmd.value = v; }));
        } else if (selVar.type === 'Float') {
          container.appendChild(labeledFloatInput('Value', cmd.value ?? 0, v => { cmd.value = v; }));
        } else {
          container.appendChild(labeledInput('Value', cmd.value ?? '', v => { cmd.value = v; }));
        }
      }
    },
  },

  setVarCopy: {
    label: 'Copy Variable',
    category: 'Variables',
    description: 'Copy the value of one variable into another',
    color: { dark: '#3a2a1a', light: '#fef3c7' },
    create() {
      return { variableName: '', sourceVariableName: '' };
    },
    detail(cmd) {
      return `${cmd.variableName || ''} \u2190 ${cmd.sourceVariableName || ''}`;
    },
    renderFields(container, cmd, node) {
      const varOpts = [['', '— select variable —'], ...S.variables.map(v => [v.name, `${v.name} (${v.type})`])];
      container.appendChild(labeledSelect('Set Variable', cmd.variableName || '', varOpts, v => { cmd.variableName = v; }));
      container.appendChild(labeledSelect('Copy From', cmd.sourceVariableName || '', varOpts, v => { cmd.sourceVariableName = v; }));
    },
  },

  playMusic: {
    label: 'Play Music',
    category: 'Audio',
    description: 'Play a looping music track',
    color: { dark: '#1a2a3a', light: '#dbeafe' },
    create() {
      return { audioUrl: '', volume: 1.0, loop: true };
    },
    detail(cmd) {
      return cmd.audioUrl || '(none)';
    },
    renderFields(container, cmd, node) {
      const audioOptions = [['', '— none —'], ...AUDIO_FILES.map(f => [f, f])];
      container.appendChild(labeledSelect('Audio File', cmd.audioUrl || '', audioOptions, v => { cmd.audioUrl = v; }));
      container.appendChild(labeledInput('Volume', cmd.volume, v => { cmd.volume = parseFloat(v) || 0; }));
    },
  },

  playSound: {
    label: 'Play Sound',
    category: 'Audio',
    description: 'Play a one-shot sound effect',
    color: { dark: '#1a2a3a', light: '#dbeafe' },
    create() {
      return { audioUrl: '', volume: 1.0, waitUntilFinished: false };
    },
    detail(cmd) {
      return cmd.audioUrl || '(none)';
    },
    renderFields(container, cmd, node) {
      const audioOptions = [['', '— none —'], ...AUDIO_FILES.map(f => [f, f])];
      container.appendChild(labeledSelect('Audio File', cmd.audioUrl || '', audioOptions, v => { cmd.audioUrl = v; }));
      container.appendChild(labeledInput('Volume', cmd.volume, v => { cmd.volume = parseFloat(v) || 0; }));
      container.appendChild(labeledCheckbox('Wait for sound to finish playing', cmd.waitUntilFinished ?? false, v => { cmd.waitUntilFinished = v; }));
    },
  },

  stopAudio: {
    label: 'Stop Audio',
    category: 'Audio',
    description: 'Stop currently playing audio',
    color: { dark: '#1a2a3a', light: '#dbeafe' },
    create() {
      return {};
    },
    detail() {
      return '';
    },
    renderFields() {},
  },

  ifCondition: {
    label: 'If',
    category: 'Flow',
    description: 'Conditional execution',
    color: { dark: '#2d1a3a', light: '#ede9fe' },
    create() {
      return { variableName: '', operator: '==', compareType: 'literal', compareValue: '', compareVarName: '', extraConditions: [], logic: '' };
    },
    detail(cmd) {
      let s = `${cmd.variableName || '?'} ${cmd.operator} ${cmd.compareType === 'variable' ? cmd.compareVarName || '?' : cmd.compareValue ?? '?'}`;
      if (cmd.extraConditions?.length > 0) {
        for (const ec of cmd.extraConditions) {
          s += ` ${ec.logic} ${ec.variableName || '?'} ${ec.operator} ${ec.compareType === 'variable' ? ec.compareVarName || '?' : ec.compareValue ?? '?'}`;
        }
      }
      return s;
    },
    renderFields(container, cmd, node) {
      renderConditionFields(container, cmd);
    },
  },

  elseIf: {
    label: 'Else-If',
    category: 'Flow',
    description: 'Alternative condition',
    color: { dark: '#2d1a3a', light: '#ede9fe' },
    create() {
      return { variableName: '', operator: '==', compareType: 'literal', compareValue: '', compareVarName: '', extraConditions: [], logic: '' };
    },
    detail(cmd) {
      let s = `${cmd.variableName || '?'} ${cmd.operator} ${cmd.compareType === 'variable' ? cmd.compareVarName || '?' : cmd.compareValue ?? '?'}`;
      if (cmd.extraConditions?.length > 0) {
        for (const ec of cmd.extraConditions) {
          s += ` ${ec.logic} ${ec.variableName || '?'} ${ec.operator} ${ec.compareType === 'variable' ? ec.compareVarName || '?' : ec.compareValue ?? '?'}`;
        }
      }
      return s;
    },
    renderFields(container, cmd, node) {
      renderConditionFields(container, cmd);
    },
  },

  elseCmd: {
    label: 'Else',
    category: 'Flow',
    description: 'Execute if no conditions matched',
    color: { dark: '#2d1a3a', light: '#ede9fe' },
    create() {
      return {};
    },
    detail() {
      return '';
    },
    renderFields() {},
  },

  endIf: {
    label: 'End',
    category: 'Flow',
    description: 'End of conditional block',
    color: { dark: '#2d1a3a', light: '#ede9fe' },
    create() {
      return {};
    },
    detail() {
      return '';
    },
    renderFields() {},
  },

  stageBgColor: {
    label: 'Stage BG Color',
    category: 'Stage',
    description: 'Set the stage background color',
    color: { dark: '#2a1a2a', light: '#fce7f3' },
    create() {
      return { color: '#ffffff' };
    },
    detail(cmd) {
      return cmd.color || '';
    },
    renderFields(container, cmd, node) {
      const colorRow = document.createElement('div');
      colorRow.className = 'cmd-field';
      colorRow.innerHTML = '<span class="cmd-field-label">Color</span>';
      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.className = 'inspector-input';
      colorInput.value = cmd.color || '#ffffff';
      colorInput.addEventListener('input', () => { cmd.color = colorInput.value; });
      colorInput.addEventListener('keydown', (e) => e.stopPropagation());
      colorRow.appendChild(colorInput);
      container.appendChild(colorRow);
    },
  },

  stageBgImage: {
    label: 'Stage BG Image',
    category: 'Stage',
    description: 'Set the stage background image',
    color: { dark: '#2a1a2a', light: '#fce7f3' },
    create() {
      return { imageUrl: '' };
    },
    detail(cmd) {
      return cmd.imageUrl || '(none)';
    },
    renderFields(container, cmd, node) {
      const imgOptions = [['', '— none —'], ...IMAGE_FILES.map(f => [f, f])];
      container.appendChild(labeledSelect('Image', cmd.imageUrl || '', imgOptions, v => { cmd.imageUrl = v; }));
    },
  },

  portrait: {
    label: 'Portrait',
    category: 'Stage',
    description: 'Show, hide, or move a character portrait on stage',
    color: { dark: '#2a1a2a', light: '#fce7f3' },
    create() {
      return { display: 'show', character: '', portraitDesc: '', move: false, moveSpeed: 0.6, fromPosition: 'offscreen-right', toPosition: 'right', waitUntilFinished: false };
    },
    detail(cmd) {
      const ch = cmd.character || '?';
      const action = cmd.display === 'hide' ? 'Hide' : (cmd.move ? `Move → ${cmd.toPosition}` : 'Show');
      return `${ch}: ${action}`;
    },
    renderFields(container, cmd, node) {
      const { updateInspector: _updateInspector } = getFieldCallbacks();
      container.appendChild(labeledSelect('Display', cmd.display || 'show', [['show', 'Show'], ['hide', 'Hide']], v => { cmd.display = v; _updateInspector(); }));

      const charOpts = [['', '— select —'], ...S.characters.map(c => [c.name, c.name])];
      container.appendChild(labeledSelect('Character', cmd.character || '', charOpts, v => { cmd.character = v; cmd.portraitDesc = ''; _updateInspector(); }));

      if (cmd.character) {
        const charObj = S.characters.find(c => c.name === cmd.character);
        if (charObj?.portraits?.length > 0) {
          const pOpts = [['', '— select —'], ...charObj.portraits.filter(p => p.description && p.imageUrl).map(p => [p.description, p.description])];
          container.appendChild(labeledSelect('Portrait', cmd.portraitDesc || '', pOpts, v => { cmd.portraitDesc = v; }));
        }
      }

      if (cmd.display !== 'hide') {
        container.appendChild(labeledCheckbox('Move', cmd.move ?? false, v => { cmd.move = v; _updateInspector(); }));
        if (cmd.move) {
          // Speed slider (0.1s to 3s, default 0.6s)
          const speedRow = document.createElement('div');
          speedRow.className = 'cmd-field';
          speedRow.innerHTML = '<span class="cmd-field-label">Speed</span>';
          const speedWrap = document.createElement('div');
          speedWrap.style.cssText = 'display:flex;align-items:center;gap:6px;';
          const speedSlider = document.createElement('input');
          speedSlider.type = 'range';
          speedSlider.min = '0.1';
          speedSlider.max = '3';
          speedSlider.step = '0.1';
          speedSlider.value = String(cmd.moveSpeed ?? 0.6);
          speedSlider.style.flex = '1';
          const speedLabel = document.createElement('span');
          speedLabel.style.cssText = 'font-size:11px;color:var(--text-secondary);min-width:30px;';
          speedLabel.textContent = `${cmd.moveSpeed ?? 0.6}s`;
          speedSlider.addEventListener('input', () => { cmd.moveSpeed = parseFloat(speedSlider.value); speedLabel.textContent = `${cmd.moveSpeed}s`; });
          speedWrap.appendChild(speedSlider);
          speedWrap.appendChild(speedLabel);
          speedRow.appendChild(speedWrap);
          container.appendChild(speedRow);

          const fromOpts = [['offscreen-right', 'Offscreen Right'], ['offscreen-left', 'Offscreen Left'], ['offscreen-top', 'Offscreen Top'], ['offscreen-bottom', 'Offscreen Bottom']];
          container.appendChild(labeledSelect('From Position', cmd.fromPosition || 'offscreen-right', fromOpts, v => { cmd.fromPosition = v; }));
        }
        const toOpts = [['right', 'Right'], ['left', 'Left'], ['center', 'Center']];
        container.appendChild(labeledSelect('To Position', cmd.toPosition || 'right', toOpts, v => { cmd.toPosition = v; }));
        container.appendChild(labeledCheckbox('Wait Until Finished', cmd.waitUntilFinished ?? false, v => { cmd.waitUntilFinished = v; }));
      }
    },
  },

  wait: {
    label: 'Wait',
    category: 'Flow',
    description: 'Pause execution for a duration',
    color: { dark: '#3a3a1a', light: '#fef9c3' },
    create() {
      return { duration: 1.0 };
    },
    detail(cmd) {
      return `${cmd.duration}s`;
    },
    renderFields(container, cmd, node) {
      container.appendChild(labeledInput('Duration (s)', cmd.duration, v => { cmd.duration = parseFloat(v) || 0; }));
    },
  },

  comment: {
    label: 'Comment',
    category: 'Metadata',
    description: 'Add a note that does not affect execution',
    color: { dark: '#2a2e2a', light: '#e8ece8' },
    create() {
      return { name: '', description: '' };
    },
    detail(cmd) {
      const parts = [cmd.name, cmd.description].filter(Boolean);
      return parts.length ? parts.join(' — ') : '(empty)';
    },
    renderFields(container, cmd, node) {
      const { updateCmdSummaryRow: _updateCmdSummaryRow } = getFieldCallbacks();
      container.appendChild(labeledInput('Name', cmd.name, v => { cmd.name = v; _updateCmdSummaryRow(); }));
      container.appendChild(labeledTextarea('Description', cmd.description, v => { cmd.description = v; _updateCmdSummaryRow(); }));
    },
  },

  sendMessage: {
    label: 'Send Message',
    category: 'Flow',
    description: 'Broadcast a named message',
    color: { dark: '#1a3a3a', light: '#ccfbf1' },
    create() {
      return { message: '' };
    },
    detail(cmd) {
      return `"${cmd.message || ''}"`;
    },
    renderFields(container, cmd, node) {
      const msgOptions = [['', '— select message —'], ...S.messages.map(m => [m, m])];
      container.appendChild(labeledSelect('Message', cmd.message || '', msgOptions, v => { cmd.message = v; }));
    },
  },

};

// ── Derived exports (backward-compatible) ───────────────────────────────────

/**
 * COMMAND_TYPES — { [key]: { label, category, description } }
 * Built from the registry so existing code that reads COMMAND_TYPES keeps working.
 */
export const COMMAND_TYPES = Object.fromEntries(
  Object.entries(COMMAND_REGISTRY).map(([key, def]) => [
    key,
    { label: def.label, category: def.category, description: def.description },
  ])
);

/**
 * createCommand(type) — factory that stamps out a new command instance.
 */
export function createCommand(type) {
  const base = { type, id: crypto.randomUUID?.() || String(Date.now() + Math.random()) };
  const entry = COMMAND_REGISTRY[type];
  if (entry) {
    return { ...base, ...entry.create() };
  }
  return base;
}

/**
 * renderCommandFields(container, cmd, node) — delegates to registry renderFields.
 */
export function renderCommandFields(container, cmd, node) {
  const entry = COMMAND_REGISTRY[cmd.type];
  if (entry && entry.renderFields) {
    entry.renderFields(container, cmd, node);
  }
}
