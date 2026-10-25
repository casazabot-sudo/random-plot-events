import { extension_settings, getContext } from "../../../extensions.js";
import { eventSource, event_types } from "../../../script.js";

const MODULE_NAME = "random_plot_events";

// Настройки по умолчанию
const defaultSettings = {
    enabled: true,
    minInterval: 20,
    maxInterval: 30,
    intensity: "balanced", // subtle, balanced, dramatic
    currentCount: 0,
    targetInterval: 25,
    forceNext: false,
    recentCategories: [],
    lastEventInfo: "Событий пока не было."
};

// Категории событий
const CATEGORIES = [
    { id: "mystery", name: "Тайны", desc: "Неожиданная загадка, странный артефакт, необъяснимый феномен или намёк на скрытую тайну." },
    { id: "complication", name: "Осложнения", desc: "Непредвиденная техническая проблема, задержка, поломка или помеха текущим планам." },
    { id: "encounter", name: "Встреча", desc: "Появление нового или неожиданного старого знакомого, случайного прохожего или вестника." },
    { id: "danger", name: "Опасность", desc: "Внезапная угроза, ловушка, враждебное окружение или появление недоброжелателей." },
    { id: "social", name: "Социальный конфликт", desc: "Спор, недопонимание, слухи, напряжение в коллективе или столкновение интересов." },
    { id: "clue", name: "Улика", desc: "Полезная деталь, подсказка, документ или след, проливающий свет на текущую ситуацию." },
    { id: "opportunity", name: "Возможность", desc: "Шанс быстро продвинуться вперед, удачная находка, выгодное предложение или короткий путь." },
    { id: "environment", name: "Событие окружения", desc: "Резкая смена погоды, шум на улице, природное явление или изменение обстановки вокруг." },
    { id: "consequence", name: "Последствие поступков", desc: "Эффект от прошлых действий персонажей, реакция мира или отголоски прошлых решений." },
    { id: "romance", name: "Романтическое развитие", desc: "Интимный момент сближения, случайное прикосновение, смущение, искра или эмоциональное откровение." }
];

// Интенсивность
const INTENSITIES = {
    subtle: "Ненавязчивое событие: легкий штрих к фону сцены, минимальное вмешательство.",
    balanced: "Сбалансированное событие: умеренный сюжетный поворот, требующий реакции персонажей.",
    dramatic: "Драматичное событие: серьезное происшествие, резко меняющее обстановку или создающее сильное напряжение."
};

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function initSettings() {
    if (!extension_settings[MODULE_NAME]) {
        extension_settings[MODULE_NAME] = { ...defaultSettings };
    } else {
        for (const key in defaultSettings) {
            if (extension_settings[MODULE_NAME][key] === undefined) {
                extension_settings[MODULE_NAME][key] = defaultSettings[key];
            }
        }
    }
    if (!extension_settings[MODULE_NAME].targetInterval) {
        resetTargetInterval();
    }
}

function resetTargetInterval() {
    const s = extension_settings[MODULE_NAME];
    s.targetInterval = getRandomInt(s.minInterval, s.maxInterval);
    s.currentCount = 0;
}

function selectCategory() {
    const s = extension_settings[MODULE_NAME];
    let available = CATEGORIES.filter(cat => !s.recentCategories.includes(cat.id));
    if (available.length === 0) {
        available = CATEGORIES;
    }
    
    const chosen = available[Math.floor(Math.random() * available.length)];
    
    s.recentCategories.push(chosen.id);
    if (s.recentCategories.length > 3) {
        s.recentCategories.shift();
    }
    
    return chosen;
}

function onChatCompletionPromptReady(data) {
    const s = extension_settings[MODULE_NAME];
    if (!s.enabled) return;

    let triggerEvent = false;

    if (s.forceNext) {
        triggerEvent = true;
        s.forceNext = false;
        $("#rpe_force_btn").removeClass("forced");
    } else {
        s.currentCount++;
        if (s.currentCount >= s.targetInterval) {
            triggerEvent = true;
            resetTargetInterval();
        }
    }

    if (triggerEvent) {
        const category = selectCategory();
        const intensityDesc = INTENSITIES[s.intensity] || INTENSITIES.balanced;
        
        s.lastEventInfo = `Последнее событие: [${category.name}] (${new Date().toLocaleTimeString()})`;
        updateUIStatus();

        const eventInstruction = `
[СЮЖЕТНОЕ СОБЫТИЕ СИСТЕМЫ]
Внезапно в текущую сцену вмешивается случайное событие.
Категория: "${category.name}" — ${category.desc}
Уровень интенсивности: ${intensityDesc}

СТРОГИЕ ПРАВИЛА ДЛЯ ИИ:
1. Строго соблюдай характеры персонажей, историю их отношений и уже установленные факты лора.
2. Категорически ЗАПРЕЩЕНО произвольно управлять действиями, мыслями или словами персонажа пользователя. Опиши событие и реакцию мира/окружающих NPC, предоставив игроку полную свободу действий.
3. Органично вплети событие в текущий диалог или действие, не ломая логику повествования.
`;

        if (data.system_prompt) {
            data.system_prompt += "\n" + eventInstruction;
        } else if (Array.isArray(data.prompt)) {
            data.prompt.push({ role: "system", content: eventInstruction });
        }
    }
}

function updateUIStatus() {
    const s = extension_settings[MODULE_NAME];
    $("#rpe_status").text(s.lastEventInfo);
    $("#rpe_counter").text(`Сообщений до события: ${s.currentCount} / ${s.targetInterval}`);
}

function setupUI() {
    const s = extension_settings[MODULE_NAME];

    const html = `
    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>Случайные сюжетные события</b>
            <div class="inline-drawer-icon">
                <i class="fa-solid fa-chevron-down"></i>
            </div>
        </div>
        <div class="inline-drawer-content" style="display: none;">
            <div class="rpe-settings-container">
                <div class="flex-container">
                    <label class="checkbox_label">
                        <input type="checkbox" id="rpe_enabled" ${s.enabled ? "checked" : ""}>
                        <span>Включить случайные события</span>
                    </label>
                </div>

                <hr class="sys-hr">

                <div class="rpe-setting-row">
                    <label>Интервал сообщений (мин / макс):</label>
                    <div class="rpe-inputs">
                        <input type="number" id="rpe_min" value="${s.minInterval}" min="1" max="100" style="width: 60px;">
                        <span>до</span>
                        <input type="number" id="rpe_max" value="${s.maxInterval}" min="2" max="200" style="width: 60px;">
                    </div>
                </div>

                <div class="rpe-setting-row">
                    <label>Интенсивность событий:</label>
                    <select id="rpe_intensity" class="text_pole">
                        <option value="subtle" ${s.intensity === 'subtle' ? 'selected' : ''}>Ненавязчивые события</option>
                        <option value="balanced" ${s.intensity === 'balanced' ? 'selected' : ''}>Сбалансированные сюжетные повороты</option>
                        <option value="dramatic" ${s.intensity === 'dramatic' ? 'selected' : ''}>Драматичные происшествия</option>
                    </select>
                </div>

                <hr class="sys-hr">

                <div class="rpe-actions">
                    <button id="rpe_force_btn" class="menu_button">Вызвать событие в следующем ответе</button>
                </div>

                <div class="rpe-info-panel">
                    <div id="rpe_status">${s.lastEventInfo}</div>
                    <div id="rpe_counter">Сообщений до события: ${s.currentCount} / ${s.targetInterval}</div>
                </div>
            </div>
        </div>
    </div>
    `;

    $("#extensions_settings").append(html);

    // Обработчики событий UI
    $("#rpe_enabled").on("change", function() {
        s.enabled = $(this).is(":checked");
    });

    $("#rpe_min").on("change", function() {
        s.minInterval = parseInt($(this).val()) || 20;
        if (s.minInterval >= s.maxInterval) {
            s.maxInterval = s.minInterval + 5;
            $("#rpe_max").val(s.maxInterval);
        }
    });

    $("#rpe_max").on("change", function() {
        s.maxInterval = parseInt($(this).val()) / 1 || 30;
        if (s.maxInterval <= s.minInterval) {
            s.minInterval = Math.max(1, s.maxInterval - 5);
            $("#rpe_min").val(s.minInterval);
        }
    });

    $("#rpe_intensity").on("change", function() {
        s.intensity = $(this).val();
    });

    $("#rpe_force_btn").on("click", function() {
        s.forceNext = true;
        $(this).addClass("forced");
        toastr.success("Случайное событие будет вызвано в следующем сообщении ИИ!", "Сюжет");
    });

    updateUIStatus();
}

jQuery(async () => {
    initSettings();
    setupUI();
    eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, onChatCompletionPromptReady);
});
