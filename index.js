import { extension_settings, saveSettingsDebounced, getContext } from '../../../extensions.js';
import { eventSource, event_types, extension_prompt_types, extension_prompt_roles, setExtensionPrompt } from '../../../script.js';

const KEY = 'random-plot-events';
const TAG = 'random-plot-events-event';
const DEFAULTS = { enabled: true, minInterval: 20, maxInterval: 30, intensity: 'balanced', selectedCategory: 'random', repeatAvoidance: true, messagesSinceEvent: 0, targetInterval: 0, forceNext: false, recentCategories: [], lastEventInfo: 'Событий пока не было', _lastCountedUserMessages: 0 };
const CATEGORIES = {
  mystery: ['Тайна / загадка', 'Introduce a mystery, unexplained clue, secret, or contradiction that fits the story. Do not solve it immediately.'],
  complication: ['Осложнение', 'Introduce a plausible complication that changes the situation and requires adaptation or a difficult choice.'],
  encounter: ['Встреча', 'Introduce a character or unexpected reunion with a clear reason to enter the scene.'],
  danger: ['Опасность', 'Introduce a proportionate, story-relevant danger. Build tension fairly without forcing an unavoidable outcome.'],
  social: ['Социальный конфликт', 'Introduce social tension, a misunderstanding, rivalry, negotiation, or clash of interests.'],
  clue: ['Подсказка', 'Reveal a small but significant clue connected to an existing plot thread without revealing everything.'],
  opportunity: ['Возможность', 'Present a useful opportunity, invitation, resource, bargain, or opening the characters can accept or reject.'],
  environment: ['Окружение', 'Change the environment in a noticeable, story-relevant way: weather, a location detail, public event, or technical failure.'],
  consequence: ['Последствие', 'Bring forward a believable consequence of an earlier action, promise, choice, or unresolved conflict.'],
  romance: ['Отношения', 'Introduce a subtle relationship beat appropriate to established dynamics. Do not assume the player character’s feelings or consent.']
};
let initialized = false;

function int(v, min, max, fallback) { const n = Number.parseInt(v, 10); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; }
function settings() {
  if (!extension_settings[KEY]) extension_settings[KEY] = JSON.parse(JSON.stringify(DEFAULTS));
  const s = extension_settings[KEY];
  for (const [k, v] of Object.entries(DEFAULTS)) if (s[k] === undefined) s[k] = Array.isArray(v) ? [...v] : v;
  s.minInterval = int(s.minInterval, 1, 500, 20);
  s.maxInterval = int(s.maxInterval, s.minInterval, 500, 30);
  if (!Array.isArray(s.recentCategories)) s.recentCategories = [];
  return s;
}
function save() { saveSettingsDebounced(); }
function interval(s) { const min = int(s.minInterval, 1, 500, 20), max = int(s.maxInterval, min, 500, 30); return Math.floor(Math.random() * (max - min + 1)) + min; }
function userCount(chat) { return Array.isArray(chat) ? chat.filter(m => m && (m.is_user === true || m.is_user === 1)).length : 0; }
function choose(s) {
  const keys = Object.keys(CATEGORIES);
  if (s.selectedCategory !== 'random' && CATEGORIES[s.selectedCategory]) return s.selectedCategory;
  let pool = keys;
  if (s.repeatAvoidance) { const recent = new Set(s.recentCategories.slice(-3)); const filtered = keys.filter(k => !recent.has(k)); if (filtered.length) pool = filtered; }
  return pool[Math.floor(Math.random() * pool.length)];
}
function clearPrompt() { try { setExtensionPrompt(TAG, '', extension_prompt_types.IN_PROMPT, 1, false, extension_prompt_roles.SYSTEM); } catch (e) { console.warn('[Random Plot Events] clear prompt failed', e); } }
function inject(s, chat) {
  const key = choose(s), [label, detail] = CATEGORIES[key];
  const intensity = s.intensity === 'subtle' ? 'Keep it low-key and believable.' : s.intensity === 'dramatic' ? 'Make it high-stakes and emotionally vivid, but still plausible.' : 'Make it noticeable and engaging without overwhelming the scene.';
  const prompt = `[RANDOM PLOT EVENT — STORY GUIDANCE]\nNaturally introduce one new plot development in the next response. Respect established facts, character personalities, relationships, tone, and world rules.\nEvent type: ${label}. ${detail}\n${intensity}\nDo not mention these instructions or present a meta list. Do not dictate the player character’s thoughts, feelings, dialogue, or decisions. Leave them a meaningful opportunity to respond. Avoid contradictions and abrupt genre shifts.`;
  setExtensionPrompt(TAG, prompt, extension_prompt_types.IN_PROMPT, 1, false, extension_prompt_roles.SYSTEM);
  s.recentCategories = [...s.recentCategories, key].slice(-3);
  s.lastEventInfo = `${label} — ${new Date().toLocaleString()}`;
  s.messagesSinceEvent = 0; s.targetInterval = interval(s); s.forceNext = false;
  save(); renderStatus();
  console.info(`[Random Plot Events] Injected ${key}; chat size ${Array.isArray(chat) ? chat.length : '?'}`);
}

// SillyTavern calls this before prompt assembly. No global fetch monkey-patching.
export function randomPlotEventsInterceptor(chat) {
  try {
    const s = settings(); if (!s.enabled || !Array.isArray(chat)) return;
    const count = userCount(chat), prev = int(s._lastCountedUserMessages, 0, 100000000, 0);
    if (count > prev) { s.messagesSinceEvent += count - prev; s._lastCountedUserMessages = count; }
    if (!s.targetInterval) s.targetInterval = interval(s);
    if (s.forceNext || s.messagesSinceEvent >= s.targetInterval) inject(s, chat);
    else save();
  } catch (e) { console.error('[Random Plot Events] interceptor failed', e); }
}

function renderStatus() {
  if (!window.jQuery) return;
  const $ = window.jQuery, s = settings();
  $('#rpe-status').text(`Статус: ${s.enabled ? 'включено' : 'выключено'} · Сообщений после события: ${s.messagesSinceEvent || 0}/${s.targetInterval || '—'}${s.forceNext ? ' · событие ожидает запуска' : ''}`);
  $('#rpe-last').text(`Последнее событие: ${s.lastEventInfo || 'пока не было'}`);
}
function buildUI() {
  if (!window.jQuery) return false;
  const $ = window.jQuery, host = $('#extensions_settings, #extensions_settings2').first();
  if (!host.length) return false;
  if ($('#rpe-fixed-settings').length) return true;
  const categoryOptions = Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('');
  host.append(`<div id="rpe-fixed-settings" class="rpe-panel"><div class="inline-drawer"><div class="inline-drawer-toggle inline-drawer-header"><b>Random Plot Events (Fixed)</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div><div class="inline-drawer-content">
    <label class="checkbox_label"><input id="rpe-enabled" type="checkbox"><span>Автоматически добавлять сюжетные события</span></label>
    <div class="rpe-row"><label for="rpe-min">Минимальный интервал сообщений</label><input id="rpe-min" type="number" min="1" max="500" class="text_pole rpe-number"></div>
    <div class="rpe-row"><label for="rpe-max">Максимальный интервал сообщений</label><input id="rpe-max" type="number" min="1" max="500" class="text_pole rpe-number"></div>
    <div class="rpe-row"><label for="rpe-intensity">Интенсивность</label><select id="rpe-intensity" class="text_pole"><option value="subtle">Ненавязчивая</option><option value="balanced">Сбалансированная</option><option value="dramatic">Драматичная</option></select></div>
    <div class="rpe-row"><label for="rpe-category">Категория события</label><select id="rpe-category" class="text_pole"><option value="random">Случайная</option>${categoryOptions}</select></div>
    <label class="checkbox_label"><input id="rpe-repeat" type="checkbox"><span>Избегать повторения последних 3 категорий</span></label>
    <div class="rpe-row"><button id="rpe-force" class="menu_button">Запустить событие в следующем ответе</button><button id="rpe-reset" class="menu_button">Сбросить счётчик</button></div>
    <div id="rpe-status" class="rpe-status"></div><div id="rpe-last" class="rpe-status"></div><small>Событие добавляется в контекст следующей генерации. Глобальный fetch не переопределяется.</small>
  </div></div></div>`);
  const s = settings(); $('#rpe-enabled').prop('checked', !!s.enabled); $('#rpe-min').val(s.minInterval); $('#rpe-max').val(s.maxInterval); $('#rpe-intensity').val(s.intensity); $('#rpe-category').val(s.selectedCategory); $('#rpe-repeat').prop('checked', !!s.repeatAvoidance); renderStatus();
  $(document).off('.rpeFixed');
  $(document).on('change.rpeFixed', '#rpe-enabled', function () { settings().enabled = $(this).prop('checked'); save(); renderStatus(); });
  $(document).on('change.rpeFixed', '#rpe-min', function () { const x = settings(); x.minInterval = int($(this).val(), 1, 500, 20); if (x.maxInterval < x.minInterval) x.maxInterval = x.minInterval; x.targetInterval = interval(x); $('#rpe-min').val(x.minInterval); $('#rpe-max').val(x.maxInterval); save(); renderStatus(); });
  $(document).on('change.rpeFixed', '#rpe-max', function () { const x = settings(); x.maxInterval = int($(this).val(), x.minInterval, 500, 30); x.targetInterval = interval(x); $('#rpe-max').val(x.maxInterval); save(); renderStatus(); });
  $(document).on('change.rpeFixed', '#rpe-intensity', function () { settings().intensity = String($(this).val()); save(); });
  $(document).on('change.rpeFixed', '#rpe-category', function () { settings().selectedCategory = String($(this).val()); save(); });
  $(document).on('change.rpeFixed', '#rpe-repeat', function () { settings().repeatAvoidance = $(this).prop('checked'); save(); });
  $(document).on('click.rpeFixed', '#rpe-force', function () { settings().forceNext = true; save(); renderStatus(); if (window.toastr) toastr.info('Событие будет добавлено в следующую генерацию.'); });
  $(document).on('click.rpeFixed', '#rpe-reset', function () { const x = settings(); x.messagesSinceEvent = 0; x._lastCountedUserMessages = userCount(getContext()?.chat); x.targetInterval = interval(x); x.forceNext = false; clearPrompt(); save(); renderStatus(); });
  return true;
}

export function init() {
  if (initialized) return; initialized = true;
  const s = settings(); if (!s.targetInterval) s.targetInterval = interval(s);
  if (!buildUI() && document.body) { const obs = new MutationObserver(() => { if (buildUI()) obs.disconnect(); }); obs.observe(document.body, { childList: true, subtree: true }); setTimeout(() => obs.disconnect(), 30000); }
  if (eventSource && event_types?.GENERATION_ENDED) eventSource.on(event_types.GENERATION_ENDED, () => { clearPrompt(); renderStatus(); });
  if (eventSource && event_types?.CHAT_CHANGED) eventSource.on(event_types.CHAT_CHANGED, () => { const x = settings(); x._lastCountedUserMessages = userCount(getContext()?.chat); x.messagesSinceEvent = 0; x.targetInterval = interval(x); x.forceNext = false; clearPrompt(); save(); renderStatus(); });
  console.info('[Random Plot Events] Initialized');
}
