# Watch Page — Video Actions Menu

> Меню действий (три точки) над основным видео на странице `/watch/:id`. Унифицирует UX с карточками на Home и Playlist Detail.

## Текущее состояние

Реализовано: при клике на иконку «...» рядом с кнопкой Share открывается выпадающее меню с двумя пунктами — **Details** (переход на страницу packaging-аналитики видео) и **Save to playlist** (открытие модалки управления плейлистами). Меню работает для любого видео — custom и обычного YouTube. Опасные действия (Delete, Remove) намеренно скрыты, потому что плеер уже играет это видео — случайное удаление было бы плохим UX.

← YOU ARE HERE: меню MVP готово, дальнейшее расширение по запросу.

---

## Что это такое

**Аналогия:** На YouTube под видео-плеером есть кнопка «...» — она открывает короткое меню с действиями над текущим видео (сохранить, поделиться, пожаловаться). Раньше у нас эта кнопка была нарисована, но не работала. Теперь — работает.

**Зачем:**
- На сетке видео (Home, Playlist Detail) есть привычное меню действий — пользователь ожидает то же самое и здесь.
- Без меню для перехода в Details или добавления в плейлист приходилось возвращаться на Home — лишний клик и потеря контекста просмотра.

---

## User Flow

1. Пользователь открывает `/watch/:id`.
2. Под плеером — строка действий: Like / Dislike / Share / **«...»**.
3. Клик по «...» → выпадает меню с двумя пунктами:
   - **Details** → переход на `/video/{channelId}/{videoId}/details` (страница packaging).
   - **Save to playlist** → открывается модалка `AddToPlaylistModal` с чекбоксами всех плейлистов канала. Сохранение мгновенно обновляет принадлежность видео.
4. Клик вне меню или по пункту — меню закрывается.

---

## Roadmap

### Stage 1 — MVP ✅
- Подключить кнопку «...» к выпадающему меню.
- Переиспользовать `VideoCardMenu` с минимальным набором: Details + Save to playlist.
- Скрыть Delete (опасное действие в контексте «уже смотрю это видео»).

### Stage 2 — Расширение (future, по запросу)
- Sync (для видео с `publishedVideoId`).
- Switch View (custom ↔ YouTube для опубликованных custom-видео).
- Add to Home / Move to channel / Make playlist cover (если контекст имеет playlist).

---

## Связанные фичи

| Фича | Связь |
|------|-------|
| [Knowledge Items](../knowledge/knowledge-items.md) | Соседняя вкладка «AI Research» под плеером — KI для текущего видео. Меню «...» и KI работают на одном экране независимо. |
| [Ambient Mode](./ambient-mode.md) | Тот же экран. Меню рендерится через портал поверх ambient layer без визуальных конфликтов (используется существующий `Dropdown` z-index). |
| [Playlists](../playlists/playlists.md) | Пункт «Save to playlist» открывает `AddToPlaylistModal` — тот же компонент, что используется в `VideoCard` / `RecommendationCard`. |
| [Video Details / Packaging](../video-details/packaging.md) | Пункт «Details» ведёт на packaging-страницу видео. |

---

## Technical Implementation

### Ключевые файлы

| Файл | Роль |
|------|------|
| `src/features/Watch/components/WatchPageVideoInfo.tsx` | Кнопка «...», state меню, обработчики, рендер `VideoCardMenu` + `AddToPlaylistModal`. |
| `src/features/Video/VideoCardMenu.tsx` | Переиспользуемое меню. Расширено опциональным пропсом `hideDelete?: boolean`. |
| `src/features/Playlists/modals/AddToPlaylistModal.tsx` | Модалка управления принадлежностью видео к плейлистам. |
| `src/components/ui/molecules/Dropdown.tsx` | Базовый портальный dropdown, используется внутри `VideoCardMenu`. |

### Решения

- **Переиспользование `VideoCardMenu` вместо нового компонента.** Один источник правды для меню действий над видео в проекте. Контекстное скрытие пунктов через отсутствие обработчиков (`onSync` undefined → пункт не рендерится) + новый `hideDelete` для жёсткого скрытия Delete.
- **`hideDelete` как опциональный пропс**, а не инверсия существующего хардкода `showDelete = true`. Open/closed: расширение без изменения поведения трёх существующих коллеров (`VideoCard`, `RecommendationCard`, `SortableVideoCard`).
- **`Details` через `navigate`, не через модалку.** Консистентность с `VideoCard` на Home page. Открытие `AddCustomVideoModal` поверх играющего плеера ломает контекст просмотра.
- **Меню работает и для custom, и для обычных YouTube-видео.** Пункт Details осмыслен и там, и там (на packaging-странице есть данные для обоих типов).

### Связь с `useChannelStore` и navigation

Details-урла строится из `currentChannel.id` (через `useChannelStore`) и `video.id`. Если `currentChannel` ещё не загружен — пункт Details не делает ничего (guard в обработчике).
