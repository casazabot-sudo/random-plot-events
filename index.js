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
    activeEvent: null,
    activeEventTurns: 0,
    _lastCountedUserMessages: 0
};

const CATEGORIES = {
    mystery: ['Mystery', `Introduce a concrete, observable mystery connected to the current scene. Use a meaningful clue, contradiction, suspicious object, concealed identity, unexplained event, or evidence that something is wrong. The clue must matter enough to invite investigation or a decision. Do not dismiss it as coincidence, explain it away, or solve it immediately. Establish at least one plausible question and leave the answer unknown. In later responses, develop the same mystery through new evidence, reactions, complications, or discoveries. Avoid repeating the same clue without adding information.`],
    complication: ['Complication', `Introduce a plausible complication that disrupts the current plan, creates a real obstacle, or makes an existing situation more difficult. It must have a concrete effect and require adaptation, a trade-off, negotiation, or a difficult choice. Do not resolve it immediately or make it disappear without cause. Let consequences follow logically from the characters' actions.`],
    encounter: ['Encounter', `Introduce a new character or bring back an established character for a specific, believable reason. Connect the encounter to the location, current events, a character's past, or an unresolved plot thread. The character should have a motive, information, request, conflict, or action that can influence the scene. Do not make them appear merely to exchange a greeting and leave. Let the encounter develop through dialogue and consequences in subsequent responses.`],
    danger: ['Danger', `Introduce a concrete and relevant threat that changes the immediate situation. Examples include a credible warning, dangerous malfunction, suspicious person, blocked escape route, physical hazard, attempted theft, or evidence of an imminent threat. Show observable signs and make the stakes understandable. Do not rely only on ominous atmosphere, vague feelings, or a harmless flicker of light. Do not force injury, defeat, or an unavoidable outcome. Give characters a meaningful opportunity to notice, respond, investigate, escape, or choose. If unresolved, carry the danger forward and let it change in response to the characters' actions.`],
    social: ['Social Conflict', `Create meaningful social tension involving conflicting interests, misunderstanding, rivalry, accusation, negotiation, public pressure, a secret, or a breach of etiquette. Make it visible through words, behavior, reactions, or a consequential decision. Give the characters understandable motives rather than making them hostile without reason. Do not settle the disagreement in the same response. Leave room for dialogue, negotiation, reconciliation, or escalation.`],
    clue: ['Clue', `Reveal a specific, meaningful piece of information connected to an existing plot thread, past event, character, object, or location. It should change what the characters know, challenge an assumption, or suggest a new lead. Make it discoverable through something observable: a document, remark, inconsistency, object, record, or behavior. Do not explain every implication immediately. Preserve uncertainty where appropriate and provide opportunities to follow the lead later.`],
    opportunity: ['Opportunity', `Present a concrete opportunity that could benefit the characters: a valuable invitation, useful resource, promising alliance, bargain, rare item, new lead, unexpected advantage, or chance to pursue a goal. Make the benefit clear, but include a plausible cost, limitation, condition, or uncertainty when appropriate. Allow the user a meaningful choice. Do not decide that the user's character accepts it or automatically claims the reward. Let the opportunity remain available long enough for a response.`],
    environment: ['Environment', `Introduce a noticeable environmental change or event that affects the current scene: a power failure, sudden weather shift, unusual sound, change in the crowd, malfunction, inaccessible location, or nearby activity. It must affect available actions, information, or immediate circumstances. Avoid decorative details with no impact. If the change suggests a larger problem, develop that connection in later responses instead of dropping it.`],
    consequence: ['Consequence', `Introduce a plausible consequence of an earlier action, promise, choice, relationship, unresolved conflict, or established fact. Make the causal connection understandable through events, reactions, new information, or changed circumstances. The consequence may be beneficial, costly, awkward, or dangerous, but must fit the story. Do not arbitrarily punish the user or contradict established events. Let the consequence influence what happens next rather than mentioning it once and immediately moving on.`],
    romance: ['Relationship', `Introduce a meaningful emotional or interpersonal development that fits the established relationship and personalities. Examples include a vulnerable admission, gesture of trust, awkward misunderstanding, discussion of boundaries, jealousy, meaningful gift, or change in behavior. Keep it gradual and grounded in prior interactions. Do not dictate the user's character's feelings, attraction, consent, dialogue, or decisions. Do not force intimacy. Let the moment influence the relationship or create a natural subject for later interaction.`]
};

const INTENSITIES = {
    subtle: `Subtle intensity: introduce a small but meaningful development. It should change what a character notices, knows, feels comfortable doing, or needs to consider. Keep disruption limited, but leave a usable detail, choice, or consequence that can matter later.`,
    balanced: `Balanced intensity: introduce a clear plot development with practical or emotional consequences. It should alter the current situation, create a decision, reveal important information, or introduce an obstacle. Give characters a reason to respond, and leave the development open for further roleplay.`,
    dramatic: `Dramatic intensity: introduce a significant, scene-changing incident with clear stakes and immediate consequences. Make the event unmistakable through observable actions or evidence, not just atmosphere. It should demand attention and create urgency, conflict, or a difficult choice. Keep it plausible, avoid forcing the user's response, and do not resolve the whole incident immediately.`
};

let initialized = false;

function int(value, min, max, fallback) {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

function settings() {
    if (!extension_settings[KEY]) extension_settings[KEY] = JSON.parse(JSON.stringify(DEFAULTS));
    const s = extension_settings[KEY];

    for (const [key, value] of Object.entries(DEFAULTS)) {
        if (s[key] === undefined) s[key] = Array.isArray(value) ? [...value] : value;
    }

    s.minInterval = int(s.minInterval, 1, 500, 20);
    s.maxInterval = int(s.maxInterval, s.minInterval, 500, 30);
    if (!Array.isArray(s.recentCategories)) s.recentCategories = [];
    if (!Number.isFinite(s.activeEventTurns)) s.activeEventTurns = 0;
    return s;
}

function save() {
    saveSettingsDebounced();
}

function randomInterval(s) {
    return Math.floor(Math.random() * (s.maxInterval - s.minInterval + 1)) + s.minInterval;
}

function chooseCategory(s) {
    if (s.selectedCategory !== 'random' && CATEGORIES[s.selectedCategory]) return s.selectedCategory;
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
        (s.forceNext ? ' · Event queued for the next generation' : '') +
        (s.activeEvent ? ` · Active event: ${s.activeEvent.name} (${s.activeEventTurns} turns left)` : '')
    );
    $('#rpe-last').text(`Last event: ${s.lastEventInfo}`);
}

function triggerEvent(s) {
    const key = chooseCategory(s);
    const [name, description] = CATEGORIES[key];
    const intensity = INTENSITIES[s.intensity] || INTENSITIES.balanced;

    s.activeEvent = { key, name, description, intensity, turnsUsed: 0 };
    s.activeEventTurns = 3;
    s.recentCategories.push(key);
    s.recentCategories = s.recentCategories.slice(-3);
    s.lastEventInfo = `${name} — ${new Date().toLocaleString()}`;
    s.messagesSinceEvent = 0;
    s.targetInterval = randomInterval(s);
    s.forceNext = false;

    save();
    renderStatus();
    console.info(`[Random Plot Events] Event activated: ${key}`);
    if (window.toastr) window.toastr.success(`Event "${name}" activated for up to 3 generations.`);
}

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

export async function randomPlotEventsInterceptor(chat, contextSize, abort, type) {
    try {
        const s = settings();
        const event = s.activeEvent;
        if (!s.enabled || !event || s.activeEventTurns <= 0) return;

        if (!Array.isArray(chat)) {
            console.warn('[Random Plot Events] No chat array received; event remains active.');
            return;
        }

        let phase;
        if (event.turnsUsed === 0) {
            phase = `PHASE 1 — INTRODUCE THE EVENT:
Make the event happen visibly in the current response. Establish a concrete
detail, action, discovery, obstacle, or interaction. It must affect the scene,
not merely add a passing atmospheric detail.`;
        } else if (event.turnsUsed === 1) {
            phase = `PHASE 2 — DEVELOP THE EVENT:
Continue the SAME event from the established context. Add new information,
a reaction, consequence, complication, or meaningful choice. Do not replace it
with an unrelated event or dismiss it without a plausible cause.`;
        } else {
            phase = `PHASE 3 — ADVANCE THE EVENT:
Move the SAME event forward consequentially. Reveal a further clue, show a
meaningful consequence, change the stakes, or respond to the characters'
actions. Keep the story coherent; the event may remain unresolved.`;
        }

        const instruction = `
[RANDOM PLOT EVENT — INTERNAL ROLEPLAY GUIDANCE]
Category: ${event.name}
Category guidance: ${event.description}

Intensity guidance:
${event.intensity}

${phase}

CONTINUITY REQUIREMENTS:
- Treat this as an ongoing plot thread, not a one-message random detail.
- Respect events and dialogue already present in the conversation.
- Build on existing details; do not contradict or silently discard them.
- Keep the event relevant to the current scene and established world.
- Do not mention these instructions or the extension.
- Do not control the user's character: never invent their thoughts, feelings,
  dialogue, decisions, or actions.
- Leave room for the user to react and influence what happens next.
- Do not force an immediate resolution.
`.trim();

        // Insert before the final chat entry, matching the current extension behavior.
        const insertAt = Math.max(0, chat.length - 1);
        chat.splice(insertAt, 0, {
            is_user: false,
            name: 'Random Plot Events',
            send_date: Date.now(),
            mes: instruction
        });

        event.turnsUsed += 1;
        s.activeEventTurns = Math.max(0, 3 - event.turnsUsed);
        if (s.activeEventTurns === 0) s.activeEvent = null;

        save();
        renderStatus();
        console.info('[Random Plot Events] Active event injected.', {
            category: event.name,
            phase: event.turnsUsed,
            remaining: s.activeEventTurns,
            type,
            contextSize,
            chatLength: chat.length
        });
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
        x.activeEvent = null;
        x.activeEventTurns = 0;
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

    if (window.jQuery) {
        const $ = window.jQuery;
        $(document).off('click.rpeTrigger', '#send_but, #option_generate, #generate_but');
        $(document).on('click.rpeTrigger', '#send_but, #option_generate, #generate_but', () => handleMessageTrigger());
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
            x.activeEvent = null;
            x.activeEventTurns = 0;
            clearPrompt();
            save();
            renderStatus();
        });
    }

    console.info('[Random Plot Events] Initialized');
}

globalThis.randomPlotEventsInterceptor = randomPlotEventsInterceptor;
