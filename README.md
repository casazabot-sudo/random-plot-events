# Random Plot Events / Случайные сюжетные события

**Version / Версия:** 2.0.3  
**For / Для:** SillyTavern  
**Author / Автор:** casazabot

---

# English

## Overview

Random Plot Events adds configurable story developments to SillyTavern. It counts clicks on supported Send/Generate buttons and queues an event when the configured interval is reached. The instruction is passed to the next generation through SillyTavern's `generate_interceptor` mechanism.

## Features and settings

- **Enable random plot events** — enables or disables automatic events.
- **Minimum interval** — lower bound for the number of Send/Generate clicks between events.
- **Maximum interval** — upper bound for the number of Send/Generate clicks between events. The target is randomly selected within the configured range.
- **Event intensity**
  - **Subtle** — adds a small detail with minimal disruption.
  - **Balanced** — adds a noticeable development that invites a response.
  - **Dramatic** — introduces a more serious incident and stronger tension while remaining consistent with the story.
- **Event category** — selects a specific category or **Random** for automatic selection.
- **Avoid the last 3 event categories** — tries to avoid the three most recently selected categories during random selection. Repeats may occur if no alternatives are available.
- **Trigger an event in the next response** — queues an event for the next generation.
- **Reset counter** — resets progress and chooses a new target interval.
- **Progress status** — displays the current count, target interval, and whether a manually requested event is queued.
- **Last event** — displays the most recently queued event and its timestamp.

## Event categories

1. **Mystery** — introduces an unexplained clue, secret, mystery, or contradiction without immediately revealing the answer.
2. **Complication** — adds a plausible obstacle that changes the situation or requires adaptation or a difficult choice.
3. **Encounter** — introduces a new character or an unexpected reunion with an established character for a story-relevant reason.
4. **Danger** — adds a relevant threat, trap, or source of tension without making the outcome inevitable.
5. **Social Conflict** — creates social tension through misunderstanding, rivalry, negotiation, or conflicting interests.
6. **Clue** — reveals a small but meaningful clue connected to an existing plot thread.
7. **Opportunity** — presents an opportunity, invitation, resource, bargain, or unexpected advantage.
8. **Environment** — changes the surroundings, such as weather, location details, nearby activity, or a technical failure.
9. **Consequence** — explores a plausible consequence of an earlier action, promise, choice, or unresolved conflict.
10. **Relationship** — adds a subtle emotional moment that fits established relationship dynamics without imposing feelings or consent on the user's character.

## How it works

1. Each click on a supported Send or Generate button increases the counter while the extension is enabled.
2. When the counter reaches its target interval, the extension selects a category and queues an event instruction.
3. A new target interval is randomly selected between the configured minimum and maximum.
4. The instruction is added to the next generation through SillyTavern's generation interceptor and extension prompt APIs.
5. The extension clears its prompt after generation ends or when the active chat changes.

The instruction asks the model to respect established facts, character personalities, relationships, tone, and world rules. It also asks the model not to dictate the user's character's thoughts, feelings, dialogue, or decisions.


## Troubleshooting

- Make sure the extension is enabled in its settings panel.
- If the counter does not increase, check whether the Send/Generate button in your layout matches a selector handled by the extension.
- If an event is queued but does not appear in the response, inspect the browser console for `[Random Plot Events]` messages and verify that `generate_interceptor` in the manifest matches the globally registered interceptor name.

---

# Русский

## Описание

Random Plot Events добавляет в SillyTavern настраиваемые сюжетные события. Расширение считает нажатия поддерживаемых кнопок Send/Generate и ставит событие в очередь при достижении заданного интервала. Инструкция передаётся следующей генерации через механизм `generate_interceptor` SillyTavern.

## Функции и настройки

- **Enable random plot events / Включить случайные сюжетные события** — включает или отключает автоматические события.
- **Minimum interval / Минимальный интервал** — нижняя граница количества нажатий Send/Generate между событиями.
- **Maximum interval / Максимальный интервал** — верхняя граница количества нажатий Send/Generate между событиями. Целевой интервал случайно выбирается в указанном диапазоне.
- **Event intensity / Интенсивность события**
  - **Subtle / Ненавязчивая** — добавляет небольшой штрих, минимально меняющий сцену.
  - **Balanced / Сбалансированная** — вводит заметное развитие сюжета, на которое персонажам стоит отреагировать.
  - **Dramatic / Драматичная** — создаёт более серьёзное происшествие и сильное напряжение, не противоречащее истории.
- **Event category / Категория события** — позволяет выбрать конкретную категорию или **Random / Случайная** для автоматического выбора.
- **Avoid the last 3 event categories / Избегать последних 3 категорий** — при случайном выборе старается не повторять три последние категории. Если альтернатив нет, повторение возможно.
- **Trigger an event in the next response / Вызвать событие в следующем ответе** — ставит событие в очередь для следующей генерации.
- **Reset counter / Сбросить счётчик** — обнуляет прогресс и выбирает новый целевой интервал.
- **Progress status / Состояние счётчика** — показывает текущий счётчик, целевой интервал и ожидает ли запуска событие, вызванное вручную.
- **Last event / Последнее событие** — показывает последнее добавленное в очередь событие и время его постановки.

## Категории событий

1. **Mystery / Тайна** — вводит необъяснимую улику, секрет, загадку или противоречие, не раскрывая ответ сразу.
2. **Complication / Осложнение** — добавляет правдоподобное препятствие, меняющее ситуацию или требующее адаптации либо трудного выбора.
3. **Encounter / Встреча** — вводит нового персонажа или неожиданную встречу со знакомым персонажем по сюжетно обоснованной причине.
4. **Danger / Опасность** — добавляет уместную угрозу, ловушку или источник напряжения, не предопределяя исход.
5. **Social Conflict / Социальный конфликт** — создаёт напряжение через недопонимание, соперничество, переговоры или конфликт интересов.
6. **Clue / Подсказка** — раскрывает небольшую, но значимую улику, связанную с существующей сюжетной линией.
7. **Opportunity / Возможность** — предлагает шанс, приглашение, ресурс, сделку или неожиданное преимущество.
8. **Environment / Окружение** — меняет обстановку: погоду, детали локации, происходящее вокруг или работу техники.
9. **Consequence / Последствие** — показывает правдоподобные последствия предыдущего действия, обещания, выбора или нерешённого конфликта.
10. **Relationship / Отношения** — добавляет тонкий эмоциональный момент, соответствующий установленным отношениям, не навязывая персонажу пользователя чувства или согласие.

## Как это работает

1. Каждое нажатие поддерживаемой кнопки Send или Generate увеличивает счётчик, если расширение включено.
2. Когда счётчик достигает целевого интервала, расширение выбирает категорию и формирует инструкцию для сюжетного события.
3. Новый целевой интервал случайно выбирается между минимальным и максимальным значениями.
4. Инструкция добавляется к следующей генерации через interceptor генерации и API промптов SillyTavern.
5. После завершения генерации или смены активного чата расширение очищает свою инструкцию.

Инструкция просит модель соблюдать установленные факты, характеры, отношения, тон и правила мира, а также не управлять мыслями, чувствами, репликами и решениями персонажа пользователя.


## Устранение неполадок

- Убедитесь, что расширение включено в панели настроек.
- Если счётчик не увеличивается, проверьте, распознаётся ли используемая кнопка Send/Generate одним из селекторов расширения.
- Если событие добавлено в очередь, но не появляется в ответе, проверьте сообщения `[Random Plot Events]` в консоли браузера и убедитесь, что `generate_interceptor` в манифесте совпадает с именем глобально зарегистрированного interceptor.
