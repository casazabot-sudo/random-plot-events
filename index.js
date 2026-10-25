(function () {
    const MODULE_NAME = "random-plot-events";

    const defaultSettings = {
        enabled: true,
        minInterval: 20,
        maxInterval: 30,
        intensity: "balanced",
        selectedCategory: "random", // Новый параметр: random или конкретный id категории
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

    function getSettings() {
        if (!window.extension_settings) {
            window.extension_settings = {};
        }
        if (!window.extension_settings[MODULE_NAME]) {
            window.extension_settings[MODULE_NAME] = Object.assign({}, defaultSettings);
        }
        return window.extension_settings[MODULE_NAME];
    }

    function resetTargetInterval(s) {
        s.targetInterval = getRandomInt(s.minInterval, s.maxInterval);
        s.currentCount = 0;
    }

    function selectCategory(s) {
        // Если пользователь выбрал конкретную категорию в меню — используем её
        if (s.selectedCategory && s.selectedCategory !== "random") {
            const specific = CATEGORIES.find(c => c.id === s.selectedCategory);
            if (specific) return specific;
        }

        // Иначе выбираем случайно с защитой от повторов последних 3
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

    function updateUIStatus(s) {
        $("#rpe_status").text(s.lastEventInfo);
        $("#rpe_counter").text(`До события: ${s.currentCount} / ${s.targetInterval}`);
    }

    function setupUI() {
        const s = getSettings();

        // Генерация опций для выпадающего списка категорий
        let categoryOptions = `<option value="random">🎲 Случайная категория (по умолчанию)</option>`;
        CATEGORIES.forEach(cat => {
            const selected = s.selectedCategory === cat.id ? "selected" : "";
            categoryOptions += `<option value="${cat.id}" ${selected}>${cat.name}</option>`;
        });

        const html = `
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Случайные сюжетные события</b>
                <div class="inline-drawer-icon"><i class="fa-solid fa-chevron-down"></i></div>
            </div>
            <div class="inline-drawer-content" style="display: none;">
                <div class="rpe-settings-container" style="padding: 10px; display: flex; flex-direction: column; gap: 10px;">
                    <label class="checkbox_label">
                        <input type="checkbox" id="rpe_enabled" ${s.enabled ? "checked" : ""}>
                        <span>Включить случайные события</span>
                    </label>
                    <hr class="sys-hr">
                    
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <label>Интервал (мин / макс):</label>
                        <div style="display: flex; gap: 5px; align-items: center;">
                            <input type="number" id="rpe_min" value="${s.minInterval}" min="1" max="100" style="width: 50px;" class="text_pole">
                            <span>-</span>
                            <input type="number" id="rpe_max" value="${s.maxInterval}" min="2" max="200" style="width: 50px;" class="text_pole">
                        </div>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <label>Интенсивность:</label>
                        <select id="rpe_intensity" class="text_pole">
                            <option value="subtle" ${s.intensity === 'subtle' ? 'selected' : ''}>Ненавязчивые</option>
                            <option value="balanced" ${s.intensity === 'balanced' ? 'selected' : ''}>Сбалансированные</option>
                            <option value="dramatic" ${s.intensity === 'dramatic' ? 'selected' : ''}>Драматичные</option>
                        </select>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <label>Категория для вызова:</label>
                        <select id="rpe_category_select" class="text_pole" style="max-width: 180px;">
                            ${categoryOptions}
                        </select>
                    </div>

                    <hr class="sys-hr">
                    <div style="display: flex; justify-content: center;">
                        <button id="rpe_force_btn" class="menu_button">Вызвать событие в след. ответе</button>
                    </div>
                    <div style="background: rgba(0, 0, 0, 0.2); padding: 8px; border-radius: 6px; font-size: 0.9em; text-align: center;">
                        <div id="rpe_status">${s.lastEventInfo}</div>
                        <div id="rpe_counter">До события: ${s.currentCount} / ${s.targetInterval}</div>
                    </div>
                </div>
            </div>
        </div>`;

        if ($("#extensions_settings").length) {
            $("#extensions_settings").append(html);
        } else {
            setTimeout(() => {
                $("#extensions_settings").append(html);
            }, 1000);
        }

        $(document).off("change", "#rpe_enabled").on("change", "#rpe_enabled", function() { s.enabled = $(this).is(":checked"); });
        $(document).off("change", "#rpe_min").on("change", "#rpe_min", function() { s.minInterval = parseInt($(this).val()) || 20; });
        $(document).off("change", "#rpe_max").on("change", "#rpe_max", function() { s.maxInterval = parseInt($(this).val()) || 30; });
        $(document).off("change", "#rpe_intensity").on("change", "#rpe_intensity", function() { s.intensity = $(this).val(); });
        $(document).off("change", "#rpe_category_select").on("change", "#rpe_category_select", function() { s.selectedCategory = $(this).val(); });
        
        $(document).off("click", "#rpe_force_btn").on("click", "#rpe_force_btn", function() {
            s.forceNext = true;
            $(this).css("background-color", "#c0392b");
            if (typeof toastr !== "undefined") {
                toastr.success("Событие будет вызвано в следующем сообщении!", "Сюжет");
            }
        });

        updateUIStatus(s);
    }

    jQuery(async () => {
        const s = getSettings();
        if (!s.targetInterval) {
            resetTargetInterval(s);
        }
        setupUI();

        if (window.eventSource && window.event_types) {
            window.eventSource.on(window.event_types.CHAT_COMPLETION_PROMPT_READY, function (data) {
                if (!s.enabled) return;

                let triggerEvent = false;

                if (s.forceNext) {
                    triggerEvent = true;
                    s.forceNext = false;
                    $("#rpe_force_btn").css("background-color", "");
                } else {
                    s.currentCount++;
                    if (s.currentCount >= s.targetInterval) {
                        triggerEvent = true;
                        resetTargetInterval(s);
                    }
                }

                if (triggerEvent) {
                    const category = selectCategory(s);
                    const intensityDesc = INTENSITIES[s.intensity] || INTENSITIES.balanced;
                    
                    s.lastEventInfo = `Последнее событие: [${category.name}]`;
                    updateUIStatus(s);

                    const eventInstruction = `\n[СЮЖЕТНОЕ СОБЫТИЕ СИСТЕМЫ]\nВнезапно в текущую сцену вмешивается случайное событие.\nКатегория: "${category.name}" — ${category.desc}\nИнтенсивность: ${intensityDesc}\nПРАВИЛА:\n1. Строго соблюдай характеры персонажей, историю отношений и факты.\n2. ЗАПРЕЩЕНО управлять действиями персонажа пользователя.\n3. Опиши реакцию мира и дай игроку свободу действий.\n`;

                    if (data && data.system_prompt) {
                        data.system_prompt += "\n" + eventInstruction;
                    } else if (data && Array.isArray(data.prompt)) {
                        data.prompt.push({ role: "system", content: eventInstruction });
                    }
                }
            });
        }
    });
})();
