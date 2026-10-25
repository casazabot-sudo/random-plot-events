import { extension_settings } from "../../../extensions.js";
import { eventSource, event_types } from "../../../script.js";

const MODULE_NAME = "random_plot_events";

const defaultSettings = {
    enabled: true,
    minInterval: 20,
    maxInterval: 30,
    intensity: "balanced",
    currentCount: 0,
    targetInterval: 25,
    forceNext: false,
    recentCategories: [],
    lastEventInfo: "Событий пока не было."
};

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
        
        s.lastEventInfo = `Последнее событие: [${category.name}]`;
        updateUIStatus();

        const eventInstruction = `\n[СЮЖЕТНОЕ СОБЫТИЕ СИСТЕМЫ]\nВнезапно в текущую сцену вмешивается случайное событие.\nКатегория: "${category.name}" — ${category.desc}\nИнтенсивность: ${intensityDesc}\nПРАВИЛА: Соблюдай характеры и лор. ЗАПРЕЩЕНО управлять действиями персонажа пользователя. Опиши реакцию мира и дай игроку свободу действий.\n`;

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
    $("#rpe_counter").text(`До события: ${s.currentCount} / ${s.targetInterval}`);
}

function setupUI() {
    const s = extension_settings[MODULE_NAME];

    const html = `
    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>Случайные сюжетные события</b>
            <div class="inline-drawer-icon"><i class="fa-solid fa-chevron-down"></i></div>
        </div>
        <div class="inline-drawer-content" style="display: none;">
            <div class="rpe-settings-container">
                <label class="checkbox_label">
                    <input type="checkbox" id="rpe_enabled" ${s.enabled ? "checked" : ""}>
                    <span>Включить случайные события</span>
                </label>
                <hr class="sys-hr">
                <div class="rpe-setting-row">
                    <label>Интервал (мин / макс):</label>
                    <div class="rpe-inputs">
                        <input type="number" id="rpe_min" value="${s.minInterval}" min="1" max="100" style="width: 50px;">
                        <span>-</span>
                        <input type="number" id="rpe_max" value="${s.maxInterval}" min="2" max="200" style="width: 50px;">
                    </div>
                </div>
                <div class="rpe-setting-row">
                    <label>Интенсивность:</label>
                    <select id="rpe_intensity" class="text_pole">
                        <option value="subtle" ${s.intensity === 'subtle' ? 'selected' : ''}>Ненавязчивые</option>
                        <option value="balanced" ${s.intensity === 'balanced' ? 'selected' : ''}>Сбалансированные</option>
                        <option value="dramatic" ${s.intensity === 'dramatic' ? 'selected' : ''}>Драматичные</option>
                    </select>
                </div>
                <hr class="sys-hr">
                <div class="rpe-actions">
                    <button id="rpe_force_btn" class="menu_button">Вызвать событие в след. ответе</button>
                </div>
                <div class="rpe-info-panel">
                    <div id="rpe_status">${s.lastEventInfo}</div>
                    <div id="rpe_counter">До события: ${s.currentCount} / ${s.targetInterval}</div>
                </div>
            </div>
        </div>
    </div>`;

    $("#extensions_settings").append(html);

    $("#rpe_enabled").on("change", function() { s.enabled = $(this).is(":checked"); });
    $("#rpe_min").on("change", function() { s.minInterval = parseInt($(this).val()) || 20; });
    $("#rpe_max").on("change", function() { s.maxInterval = parseInt($(this).val()) || 30; });
    $("#rpe_intensity").on("change", function() { s.intensity = $(this).val(); });
    $("#rpe_force_btn").on("click", function() {
        s.forceNext = true;
        $(this).addClass("forced");
        toastr.success("Событие будет вызвано в следующем сообщении!", "Сюжет");
    });

    updateUIStatus();
}

jQuery(async () => {
    initSettings();
    setupUI();
    eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, onChatCompletionPromptReady);
});
