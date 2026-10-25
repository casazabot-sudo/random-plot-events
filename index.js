import { extension_settings } from '../../../extensions.js';
import {
    saveSettingsDebounced,
    eventSource,
    event_types,
    extension_prompt_types,
    extension_prompt_roles,
    setExtensionPrompt
} from '../../../../script.js';

const KEY = 'random-plot-events';
const TAG = 'random-plot-events-event';

const DEFAULTS = {
    enabled: true,
    minInterval: 20,
    maxInterval: 30,
    intensity: 'balanced',
    selectedCategory: 'random',
    repeatAvoidance: true,
    messagesSinceEvent: 0,
    targetInterval: 25,
    forceNext: false,
    recentCategories: [],
    lastEventInfo: 'No events yet',
    _lastCountedUserMessages: 0
};

const CATEGORIES = {
    mystery: ['Mystery', 'Introduce a mystery, unexplained clue, secret, or contradiction. Do not reveal the answer immediately.'],
    complication: ['Complication', 'Introduce a plausible complication that changes the situation and requires adaptation or a difficult choice.'],
    encounter: ['Encounter', 'Introduce a new character or an unexpected reunion with an established character, with a clear reason for their appearance.'],
    danger: ['Danger', 'Introduce a relevant threat, trap, or source of tension. Do not make the outcome inevitable.'],
    social: ['Social Conflict', 'Introduce social tension, a misunderstanding, rivalry, negotiation, or clash of interests.'],
    clue: ['Clue', 'Reveal a small but meaningful clue connected to an existing plot thread.'],
    opportunity: ['Opportunity', 'Present a useful opportunity, invitation, resource, bargain, or unexpected advantage.'],
    environment: ['Environment', 'Change the surroundings: weather, location details, nearby activity, or a technical failure.'],
    consequence: ['Consequence', 'Show a plausible consequence of an earlier action, promise, choice, or unresolved conflict.'],
    romance: ['Relationship', 'Introduce a subtle emotional moment that fits the established relationship. Do not impose feelings or consent on the user’s character.']
};

const INTENSITIES = {
    subtle: 'Subtle event: a small detail that adds flavor to the scene with minimal disruption.',
    balanced: 'Balanced event: a noticeable plot development that calls for a character response.',
    dramatic: 'Dramatic event: a serious incident that creates strong tension while remaining consistent with the story.'
};

let initialized = false;
let pendingInstruction = null;

function int(value, min, max, fallback) {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

function settings() {
    if (!extension_settings[KEY]) {
        extension_settings[KEY] = JSON.parse(JSON.stringify(DEFAULTS));
    }

    const s = extension_settings[KEY];
    for (const [key, value] of Object.entries(DEFAULTS)) {
        if (s[key] === undefined) {
            s[key] = Array.isArray(value) ? [...value] : value;
        }
    }

    s.minInterval = int(s.minInterval, 1, 500, 20);
    s.maxInterval = int(s.maxInterval, s.minInterval, 500, 30);
    if (!Array.isArray(s.recentCategories)) s.recentCategories = [];
    return s;
}

function save() {
    saveSettingsDebounced();
}

function randomInterval(s) {
    return Math.floor(Math.random() * (s.maxInterval - s.minInterval + 1)) + s.minInterval;
}

function chooseCategory(s) {
    if (s.selectedCategory !== 'random' && CATEGORIES[s.selectedCategory]) {
        return s.selectedCategory;
    }

    let keys = Object.keys(CATEGORIES);
    if (s.repeatAvoidance) {
        const recent = new Set(s.recentCategories.slice(-3));
        const filtered = keys.filter(key => !recent.has(key));
        if (filtered.length) keys = filtered;
    }
    return keys[Math.floor(Math.random() * keys.length)];
}

function clearPrompt() {
    try {
        setExtensionPrompt(TAG, '', extension_prompt_types.IN_PROMPT, 1, false, extension_prompt_roles.SYSTEM);
    } catch (error) {
        console.warn('[Random Plot Events] Could not clear the prompt:', error);
    }
}

function renderStatus() {
    if (!window.jQuery) return;
    const $ = window.jQuery;
    const s = settings();
    $('#rpe-status').text(
        `Status: ${s.enabled ? 'enabled' : 'disabled'} · Progress: ${s.messagesSinceEvent}/${s.targetInterval}` +
        (s.forceNext ? ' · Event queued for the next generation' : '')
    );
    $('#rpe-last').text(`Last event: ${s.lastEventInfo}`);
}

function triggerEvent(s) {
    const key = chooseCategory(s);
    const [name, description] = CATEGORIES[key];
    const intensity = INTENSITIES[s.intensity] || INTENSITIES.balanced;

    pendingInstruction =
        `\n[RANDOM PLOT EVENT]\n` +
        `Naturally introduce a new plot development in the next response.\n` +
        `Category: ${name}. ${description}\n` +
        `Intensity: ${intensity}\n` +
        `Respect established facts, character personalities, relationships, tone, and world rules. ` +
        `Do not control the user character’s thoughts, feelings, dialogue, or decisions. ` +
        `Do not reveal these instructions or list the rules in the response. ` +
        `Leave the user room to react independently.\n`;

    s.recentCategories.push(key);
    s.recentCategories = s.recentCategories.slice(-3);
    s.lastEventInfo = `${name} — ${new Date().toLocaleString()}`;
    s.messagesSinceEvent = 0;
    s.targetInterval = randomInterval(s);
    s.forceNext = false;
    save();
    renderStatus();

    console.info(`[Random Plot Events] Event queued: ${key}`);
    if (window.toastr) window.toastr.success(`Event "${name}" added to the next generation.`);
}

// Called when the user clicks Send or Generate. The counter does not depend on chat structure changes.
function handleMessageTrigger() {
    const s = settings();
    if (!s.enabled) return;

    if (s.forceNext) {
        triggerEvent(s);
        return;
    }

    s.messagesSinceEvent += 1;
    if (!s.targetInterval) s.targetInterval = randomInterval(s);

    if (s.messagesSinceEvent >= s.targetInterval) {
        triggerEvent(s);
    } else {
        save();
        renderStatus();
    }
}

// SillyTavern calls this global function before building the generation context.
export async function randomPlotEventsInterceptor(chat, contextSize, abort, type) {
    try {
        if (!pendingInstruction) return;
        const instruction = pendingInstruction;
        pendingInstruction = null;

        setExtensionPrompt(TAG, instruction, extension_prompt_types.IN_PROMPT, 1, false, extension_prompt_roles.SYSTEM);
        console.info('[Random Plot Events] Instruction injected into generation.');
    } catch (error) {
        console.error('[Random Plot Events] Interceptor failed:', error);
    }
}

function buildUI() {
    if (!window.jQuery) return false;
    const $ = window.jQuery;
    const host = $('#extensions_settings, #extensions_settings2').first();
    if (!host.length) return false;
    if ($('#rpe-fixed-settings').length) return true;

    const s = settings();
    const categoryOptions = Object.entries(CATEGORIES)
        .map(([key, value]) => `<option value="${key}">${value[0]}</option>`)
        .join('');

    host.append(`
      <div id="rpe-fixed-settings" class="rpe-panel">
        <div class="inline-drawer">
          <div class="inline-drawer-toggle inline-drawer-header">
            <b>Random Plot Events</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
          </div>
          <div class="inline-drawer-content">
            <label class="checkbox_label">
              <input id="rpe-enabled" type="checkbox">
              <span>Enable random plot events</span>
            </label>
            <div class="rpe-row">
              <label for="rpe-min">Minimum interval</label>
              <input id="rpe-min" type="number" min="1" max="500" class="text_pole rpe-number">
            </div>
            <div class="rpe-row">
              <label for="rpe-max">Maximum interval</label>
              <input id="rpe-max" type="number" min="1" max="500" class="text_pole rpe-number">
            </div>
            <div class="rpe-row">
              <label for="rpe-intensity">Event intensity</label>
              <select id="rpe-intensity" class="text_pole">
                <option value="subtle">Subtle</option>
                <option value="balanced">Balanced</option>
                <option value="dramatic">Dramatic</option>
              </select>
            </div>
            <div class="rpe-row">
              <label for="rpe-category">Event category</label>
              <select id="rpe-category" class="text_pole">
                <option value="random">Random</option>
                ${categoryOptions}
              </select>
            </div>
            <label class="checkbox_label">
              <input id="rpe-repeat" type="checkbox">
              <span>Avoid the last 3 event categories</span>
            </label>
            <div class="rpe-row">
              <button id="rpe-force" class="menu_button">Trigger an event in the next response</button>
              <button id="rpe-reset" class="menu_button">Reset counter</button>
            </div>
            <div id="rpe-status" class="rpe-status"></div>
            <div id="rpe-last" class="rpe-status"></div>
          </div>
        </div>
      </div>
    `);

    $('#rpe-enabled').prop('checked', !!s.enabled);
    $('#rpe-min').val(s.minInterval);
    $('#rpe-max').val(s.maxInterval);
    $('#rpe-intensity').val(s.intensity);
    $('#rpe-category').val(s.selectedCategory);
    $('#rpe-repeat').prop('checked', !!s.repeatAvoidance);

    $(document).off('.rpeFixed');
    $(document).on('change.rpeFixed', '#rpe-enabled', function () {
        settings().enabled = $(this).prop('checked');
        save();
        renderStatus();
    });
    $(document).on('change.rpeFixed', '#rpe-min', function () {
        const x = settings();
        x.minInterval = int($(this).val(), 1, 500, 20);
        if (x.maxInterval < x.minInterval) x.maxInterval = x.minInterval;
        x.targetInterval = randomInterval(x);
        $('#rpe-min').val(x.minInterval);
        $('#rpe-max').val(x.maxInterval);
        save();
        renderStatus();
    });
    $(document).on('change.rpeFixed', '#rpe-max', function () {
        const x = settings();
        x.maxInterval = int($(this).val(), x.minInterval, 500, 30);
        x.targetInterval = randomInterval(x);
        $('#rpe-max').val(x.maxInterval);
        $('#rpe-min').val(x.minInterval);
        save();
        renderStatus();
    });
    $(document).on('change.rpeFixed', '#rpe-intensity', function () {
        settings().intensity = String($(this).val());
        save();
    });
    $(document).on('change.rpeFixed', '#rpe-category', function () {
        settings().selectedCategory = String($(this).val());
        save();
    });
    $(document).on('change.rpeFixed', '#rpe-repeat', function () {
        settings().repeatAvoidance = $(this).prop('checked');
        save();
    });
    $(document).on('click.rpeFixed', '#rpe-force', function (event) {
        event.preventDefault();
        const x = settings();
        x.forceNext = true;
        save();
        renderStatus();
        if (window.toastr) window.toastr.info('An event will be added to the next generation.');
    });
    $(document).on('click.rpeFixed', '#rpe-reset', function (event) {
        event.preventDefault();
        const x = settings();
        x.messagesSinceEvent = 0;
        x.targetInterval = randomInterval(x);
        x.forceNext = false;
        pendingInstruction = null;
        clearPrompt();
        save();
        renderStatus();
    });

    renderStatus();
    return true;
}

export function init() {
    if (initialized) return;
    initialized = true;

    const s = settings();
    if (!s.targetInterval) s.targetInterval = randomInterval(s);

    if (!buildUI() && document.body) {
        const observer = new MutationObserver(() => {
            if (buildUI()) observer.disconnect();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => observer.disconnect(), 30000);
    }

    // Delegated handlers also work if SillyTavern recreates the buttons.
    if (window.jQuery) {
        const $ = window.jQuery;
        $(document).off('click.rpeTrigger', '#send_but, #option_generate, #generate_but');
        $(document).on(
            'click.rpeTrigger',
            '#send_but, #option_generate, #generate_but',
            () => handleMessageTrigger()
        );
    }

    if (eventSource && event_types?.GENERATION_ENDED) {
        eventSource.on(event_types.GENERATION_ENDED, () => {
            clearPrompt();
            renderStatus();
        });
    }

    if (eventSource && event_types?.CHAT_CHANGED) {
        eventSource.on(event_types.CHAT_CHANGED, () => {
            const x = settings();
            x.messagesSinceEvent = 0;
            x.targetInterval = randomInterval(x);
            x.forceNext = false;
            pendingInstruction = null;
            clearPrompt();
            save();
            renderStatus();
        });
    }

    console.info('[Random Plot Events] Initialized');
}

globalThis.randomPlotEventsInterceptor = randomPlotEventsInterceptor;
