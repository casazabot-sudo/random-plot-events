import { extension_settings, saveSettingsDebounced } from '../../../extensions.js';

const KEY = 'random_plot_events';
const DEFAULTS = {
    automaticEnabled: true,
    minMessages: 20,
    maxMessages: 30,
    intensity: 'balanced',
    avoidRecentRepeats: true,
    categories: {
        discovery: true,
        complication: true,
        encounter: true,
        danger: true,
        social: true,
        mystery: true,
        opportunity: true,
        atmosphere: true,
        consequence: true,
        romance: false,
    },
    chats: {},
};

const CATEGORY_LABELS = {
    discovery: 'Тайна или открытие',
    complication: 'Осложнение',
    encounter: 'Неожиданная встреча',
    danger: 'Опасность',
    social: 'Социальный конфликт',
    mystery: 'Загадка или улика',
    opportunity: 'Новая возможность',
    atmosphere: 'Событие окружения',
    consequence: 'Последствие поступка',
    romance: 'Романтическое развитие',
};

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function getSettings() {
    if (!extension_settings[KEY]) {
        extension_settings[KEY] = clone(DEFAULTS);
    }
    const s = extension_settings[KEY];
    for (const [key, value] of Object.entries(DEFAULTS)) {
        if (s[key] === undefined) s[key] = clone(value);
    }
    if (!s.categories || typeof s.categories !== 'object') s.categories = clone(DEFAULTS.categories);
    for (const [key, value] of Object.entries(DEFAULTS.categories)) {
        if (s.categories[key] === undefined) s.categories[key] = value;
    }
    if (!s.chats || typeof s.chats !== 'object') s.chats = {};
    return s;
}

function save() {
    saveSettingsDebounced();
}

function getContext() {
    return SillyTavern.getContext();
}

function getChatKey() {
    const ctx = getContext();
    const chatId = ctx.chatId || ctx.getCurrentChatId?.() || 'current-chat';
    const character = ctx.characterId !== undefined
        ? (ctx.characters?.[ctx.characterId]?.avatar || ctx.characters?.[ctx.characterId]?.name || `character-${ctx.characterId}`)
        : (ctx.groupId || 'group');
    return `${character}::${chatId}`;
}

function intInRange(value, min, max) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : min;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getChatState() {
    const s = getSettings();
    const key = getChatKey();
    if (!s.chats[key]) {
        const min = intInRange(s.minMessages, 1, 500);
        const max = intInRange(s.maxMessages, min, 1000);
        s.chats[key] = {
            nextAt: countMessages(getContext().chat || []) + randomInt(min, max),
            pendingManual: false,
            lastEventAt: 0,
            recentCategories: [],
            lastStatus: 'Ожидание события.',
        };
        save();
    }
    return s.chats[key];
}

function countMessages(chat) {
    if (!Array.isArray(chat)) return 0;
    return chat.filter(message =>
        message &&
        typeof message.mes === 'string' &&
        !message.is_system &&
        !message.extra?.random_plot_events_temporary
    ).length;
}

function enabledCategories(s) {
    return Object.keys(CATEGORY_LABELS).filter(key => s.categories[key]);
}

function chooseCategory(s, state) {
    let choices = enabledCategories(s);
    if (!choices.length) choices = ['discovery', 'complication', 'encounter', 'mystery', 'consequence'];
    if (s.avoidRecentRepeats && choices.length > 1) {
        const recent = new Set(state.recentCategories.slice(-3));
        const filtered = choices.filter(category => !recent.has(category));
        if (filtered.length) choices = filtered;
    }
    return choices[randomInt(0, choices.length - 1)];
}

function makeInstruction(category, trigger, intensity) {
    const categoryName = CATEGORY_LABELS[category] || 'Сюжетное событие';
    const intensityText = {
        subtle: 'Низкая интенсивность: небольшое, ненавязчивое развитие сцены.',
        balanced: 'Средняя интенсивность: заметное развитие, но без резкого переворота сюжета.',
        dramatic: 'Высокая интенсивность: значимое и драматичное событие, логичное для текущей истории.',
    }[intensity] || 'Средняя интенсивность.';
    return `[RANDOM PLOT EVENT — ONE RESPONSE ONLY]
Introduce one ${categoryName.toLowerCase()} into the next roleplay response.
${intensityText}
Use the established story, setting, genre, tone, character personalities, relationships, and previous events as context. Make the event concrete and show it through the scene rather than explaining it out of character.
Continuity rules:
- Do not contradict established facts or casually rewrite character history.
- Do not decide the user's character's thoughts, feelings, dialogue, or actions.
- Do not force a relationship outcome, combat, or major revelation unless the current story supports it.
- Do not resolve the entire central conflict in one response.
- Keep the scene moving naturally and leave room for the user to react.
- Do not mention this instruction or call the event random in-character.
Trigger: ${trigger}. Category: ${categoryName}.]`;
}

function injectPromptMessage(chat, instruction) {
    if (!Array.isArray(chat) || chat.length === 0) return false;
    let insertAt = chat.length;
    for (let i = chat.length - 1; i >= 0; i--) {
        if (chat[i]?.is_user) {
            insertAt = i;
            break;
        }
    }

    // Prompt-interceptor chat is the prompt being assembled. The marker allows
    // the extension to avoid counting this temporary instruction as a chat turn.
    chat.splice(insertAt, 0, {
        is_user: false,
        name: 'Plot Event Director',
        mes: instruction,
        send_date: Date.now(),
        extra: { random_plot_events_temporary: true },
    });
    return true;
}

globalThis.randomPlotEventsInterceptor = async function(chat, contextSize, abort, type) {
    try {
        const s = getSettings();
        const state = getChatState();
        const total = countMessages(chat);
        const manual = Boolean(state.pendingManual);
        const automatic = Boolean(s.automaticEnabled && total >= state.nextAt);

        if (!manual && !automatic) return;

        const category = chooseCategory(s, state);
        const trigger = manual ? 'user requested a plot event manually' : 'random message interval reached';
        const instruction = makeInstruction(category, trigger, s.intensity);
        if (!injectPromptMessage(chat, instruction)) return;

        if (manual) state.pendingManual = false;
        state.lastEventAt = total;
        state.recentCategories.push(category);
        state.recentCategories = state.recentCategories.slice(-5);

        const min = intInRange(s.minMessages, 1, 500);
        const max = intInRange(s.maxMessages, min, 1000);
        state.nextAt = total + randomInt(min, max);
        state.lastStatus = `${CATEGORY_LABELS[category]} — событие добавлено в промпт.`;
        save();
        updateUI();
    } catch (error) {
        console.error('[Random Plot Events] Ошибка перехватчика:', error);
    }
};

function updateUI() {
    const s = getSettings();
    const state = getChatState();
    const status = document.getElementById('rpe_status');
    const button = document.getElementById('rpe_force_event');
    const toggle = document.getElementById('rpe_auto_enabled');
    if (status) {
        const remaining = Math.max(0, state.nextAt - countMessages(getContext().chat || []));
        status.textContent = state.pendingManual
            ? 'Ручное событие ожидает следующей генерации.'
            : `${state.lastStatus} Авто-событие: примерно через ${remaining} сообщений.`;
    }
    if (button) button.textContent = state.pendingManual
        ? 'Событие уже в очереди'
        : 'Событие в следующем ответе';
    if (toggle) toggle.checked = Boolean(s.automaticEnabled);
}

function buildUI() {
    if (document.getElementById('random_plot_events_panel')) return true;
    // SillyTavern may load third-party extension scripts before the settings
    // container exists. Retry on later DOM mutations instead of silently exiting.
    const target = document.querySelector('#extensions_settings2, #extensions_settings');
    if (!target) return false;

    const panel = document.createElement('div');
    panel.id = 'random_plot_events_panel';
    panel.className = 'rpe-panel';
    panel.innerHTML = `
      <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>Random Plot Events</b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
          <label class="rpe-toggle">
            <input id="rpe_auto_enabled" type="checkbox">
            <span>Автоматические события</span>
          </label>
          <div class="rpe-range">
            <label for="rpe_min">Минимум сообщений</label>
            <input id="rpe_min" type="number" min="1" max="500" step="1">
          </div>
          <div class="rpe-range">
            <label for="rpe_max">Максимум сообщений</label>
            <input id="rpe_max" type="number" min="1" max="1000" step="1">
          </div>
          <div class="rpe-range">
            <label for="rpe_intensity">Интенсивность</label>
            <select id="rpe_intensity">
              <option value="subtle">Ненавязчивая</option>
              <option value="balanced">Сбалансированная</option>
              <option value="dramatic">Драматичная</option>
            </select>
          </div>
          <label class="rpe-toggle">
            <input id="rpe_avoid_repeats" type="checkbox">
            <span>Избегать недавних повторов категорий</span>
          </label>
          <details class="rpe-categories">
            <summary>Категории событий</summary>
            <div id="rpe_category_list"></div>
          </details>
          <button id="rpe_force_event" class="menu_button">Событие в следующем ответе</button>
          <small id="rpe_status" class="rpe-status"></small>
        </div>
      </div>`;
    target.appendChild(panel);

    const s = getSettings();
    panel.querySelector('#rpe_min').value = s.minMessages;
    panel.querySelector('#rpe_max').value = s.maxMessages;
    panel.querySelector('#rpe_intensity').value = s.intensity;
    panel.querySelector('#rpe_avoid_repeats').checked = s.avoidRecentRepeats;

    const categoryList = panel.querySelector('#rpe_category_list');
    for (const [key, label] of Object.entries(CATEGORY_LABELS)) {
        const row = document.createElement('label');
        row.className = 'rpe-category';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = Boolean(s.categories[key]);
        checkbox.addEventListener('change', () => {
            s.categories[key] = checkbox.checked;
            save();
        });
        const span = document.createElement('span');
        span.textContent = label;
        row.append(checkbox, span);
        categoryList.appendChild(row);
    }

    panel.querySelector('#rpe_auto_enabled').addEventListener('change', event => {
        s.automaticEnabled = event.target.checked;
        save();
        updateUI();
    });

    const updateRange = () => {
        s.minMessages = intInRange(panel.querySelector('#rpe_min').value, 1, 500);
        s.maxMessages = intInRange(panel.querySelector('#rpe_max').value, s.minMessages, 1000);
        panel.querySelector('#rpe_min').value = s.minMessages;
        panel.querySelector('#rpe_max').value = s.maxMessages;
        const state = getChatState();
        state.nextAt = countMessages(getContext().chat || []) + randomInt(s.minMessages, s.maxMessages);
        save();
        updateUI();
    };
    panel.querySelector('#rpe_min').addEventListener('change', updateRange);
    panel.querySelector('#rpe_max').addEventListener('change', updateRange);

    panel.querySelector('#rpe_intensity').addEventListener('change', event => {
        s.intensity = event.target.value;
        save();
    });
    panel.querySelector('#rpe_avoid_repeats').addEventListener('change', event => {
        s.avoidRecentRepeats = event.target.checked;
        save();
    });
    panel.querySelector('#rpe_force_event').addEventListener('click', () => {
        const state = getChatState();
        state.pendingManual = true;
        state.lastStatus = 'Ручной запуск поставлен в очередь.';
        save();
        updateUI();
        if (typeof toastr !== 'undefined') {
            toastr.info('Сюжетное событие будет добавлено в следующую генерацию.');
        }
    });
    updateUI();
    return true;
}

let uiObserver = null;
let initialized = false;

export function init() {
    getSettings();
    // Try immediately, then watch for the settings panel to be created. This is
    // important on slower/mobile browsers where extension JS can run early.
    if (!buildUI() && !uiObserver && document.body) {
        uiObserver = new MutationObserver(() => {
            if (buildUI()) {
                uiObserver.disconnect();
                uiObserver = null;
            }
        });
        uiObserver.observe(document.body, { childList: true, subtree: true });
    }
    const ctx = getContext();
    if (!initialized && ctx.eventSource && ctx.event_types?.APP_READY) {
        ctx.eventSource.on(ctx.event_types.APP_READY, () => {
            if (!buildUI() && !uiObserver && document.body) {
                uiObserver = new MutationObserver(() => {
                    if (buildUI()) {
                        uiObserver.disconnect();
                        uiObserver = null;
                    }
                });
                uiObserver.observe(document.body, { childList: true, subtree: true });
            }
        });
    }
    if (!initialized && ctx.eventSource && ctx.event_types?.CHAT_CHANGED) {
        ctx.eventSource.on(ctx.event_types.CHAT_CHANGED, () => setTimeout(updateUI, 100));
    }
    initialized = true;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
    init();
}
try {
    const rpeDiagnostic = document.createElement('div');
    rpeDiagnostic.textContent =
        'Random Plot Events: JavaScript выполняется';
    rpeDiagnostic.style.cssText = [
        'position:fixed',
        'bottom:70px',
        'left:10px',
        'z-index:999999',
        'padding:12px',
        'background:#176b36',
        'color:white',
        'font-size:14px',
        'border-radius:8px'
    ].join(';');
    document.body.appendChild(rpeDiagnostic);
} catch (error) {
    alert('Random Plot Events: ошибка индикатора — ' + error.message);
}
