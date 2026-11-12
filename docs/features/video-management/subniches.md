# Subniches (визуальные подниши)

## Что это

Подниша — проверенная визуальная формула обложки, например «домики крупным планом в среде обитания».
У подниши есть название и **референсы** — видео конкурентов из Trends, которые доказали, что формула работает.
Каждое своё видео можно отнести к одной поднише.

Аналогия: ниши Trends — полки архива (раскладываем всё подряд по темам), подниши — доска вдохновения,
на которую приколоты только лучшие примеры.

## Зачем

- Публиковать видео не наугад, а внутри формул, которые уже набирают просмотры.
- Сравнивать свои обложки с эталоном подниши: в плейлисте наверху закреплены 3 самых просматриваемых референса,
  ниже — только мои видео этой подниши.

## Текущее состояние

- ✅ Подниши: название + референсы из Trends. Создаются прямо при добавлении референсов или из Details.
- ✅ Trends: кнопка **Use as subniche visual reference** в плавающей панели (повторное нажатие убирает референсы).
- ✅ Details: поле **Subniche** под превью, сохраняется сразу; **Manage subniches…** — переименовать, удалить, убрать референс.
- ✅ Плейлист: сортировка **By subniche** — сверху закреплены 3 самых просматриваемых референса
  (просмотры актуальные, из синхронизации Trends), ниже только мои видео этой подниши. Перетаскивание работает и не выкидывает из режима.
- ✅ CLI: `--subniche` / `--clear-subniche`, подниши видны в `--list`.
- ✅ Удаление подниши снимает её со всех видео.

## User flow

1. **Trends:** выделяю видео конкурентов → в плавающей панели **Use as subniche reference** →
   выбираю поднишу или создаю новую (**+ New subniche…**).
2. **Details:** у своего видео под превью выбираю **Subniche** (или создаю новую). Сохраняется сразу,
   без Save draft / Save as new version — подниша описывает видео, а не версию упаковки.
3. **Manage subniches…** (из Details): переименовать, удалить поднишу, убрать отдельный референс.
   При удалении подниши у всех её видео подниша снимается.
4. **Плейлист:** в сортировке раздел **By subniche** → выбираю поднишу →
   - наверху строка из 3 самых просматриваемых референсов (метка **Reference**), не уезжает при скролле;
   - ниже — только мои видео этой подниши из плейлиста; остальные не показываются.
   - Референсы нельзя перетаскивать и выделять, в порядок плейлиста они не попадают.
5. **CLI:** агент при подготовке видео сразу проставляет поднишу (`--subniche <name>`).

## Roadmap

### Stage 1 — MVP ✅
- [x] Данные и сервис подниш; поле подниши у видео; чистка при удалении подниши.
- [x] Trends: действие **Use as subniche visual reference** с созданием подниши на лету.
- [x] Details: выбор подниши + модалка **Manage subniches…**.
- [x] Плейлист: сортировка **By subniche** с закреплённой строкой топ-3 референсов.
- [x] CLI: `--subniche` / `--clear-subniche` при создании/обновлении видео, подниши в `--list`.
- [x] Тесты чистой логики (топ-N по просмотрам, слияние референсов, ключ сортировки).

### Финальное видение ← YOU ARE HERE
- Подсказка подниши для новой обложки по визуальной схожести с референсами (эмбеддинги обложек уже есть —
  `findSimilarVideos`): «похоже на “cottage close-up”, 87%».
- AI-чат знает подниши: сравнивает видео с референсами, предлагает упаковку в рамках формулы.
- Статистика подниши: сколько моих видео, их средние просмотры против референсов.
- Стоимость: только Firestore-чтения/записи, новых API нет.

## Technical Implementation

- **Firestore:** `users/{uid}/channels/{ch}/subniches/{id}` —
  `{ name, references: [{ videoId, trendChannelId, addedAt, snapshot: { title, thumbnail, channelTitle, viewCount } }], createdAt, updatedAt }`.
  `snapshot` — запасные данные на случай, если trend-канал удалён; основные данные (включая актуальный `viewCount`)
  читаются из `users/{uid}/channels/{ch}/trendChannels/{trendChannelId}/videos/{videoId}` (обновляются синхронизацией Trends).
- **Видео:** `users/{uid}/channels/{ch}/videos/{id}.subnicheId?: string` — вне `packagingHistory`.
- **Отличие от ниш Trends** (`trendNiches` + `videoNicheAssignments`): там у видео ровно одна ниша и это категоризация
  конкурентов; подниша — отдельная сущность, референс может входить в несколько подниш.
- **Ядро:** тип `src/core/types/subniche.ts`; сервис `src/core/services/subnicheService.ts`
  (CRUD, `addReferences` / `removeReference` в транзакциях, `deleteSubniche` батчем снимает `subnicheId` с видео,
  `fetchReferenceVideos` — живые данные Trends); хук `src/core/hooks/useSubniches.ts`; подписка — `useFirestoreSync`.
- **Чистые функции:** `src/core/utils/subnicheUtils.ts` — `mergeReferences`, `buildReferenceFromTrendVideo`,
  `resolveReferences`, `pickTopReferences` (`TOP_REFERENCE_COUNT = 3`), `isSubnicheNameTaken`,
  ключ сортировки `subniche:{id}` (`toSubnicheSortKey` / `parseSubnicheSortKey`). Тесты — `src/core/utils/__tests__/subnicheUtils.test.ts`.
- **UI:** `src/features/Subniches/` — `SubnicheSearchList` (поиск + создание, общий), `SubnicheField` (Details),
  `ManageSubnichesModal` + `SubnicheManageRow`, `SubnicheReferenceStrip` (колонки = `GRID_LAYOUT` + `cardsPerRow`),
  хук `useResolvedReferences` (TanStack Query, 10 мин). Trends — `src/pages/Trends/Timeline/components/SubnicheReferenceSelector.tsx`.
  Плейлист — `src/pages/Playlists/PlaylistDetailPage.tsx`; тип сортировки `PlaylistVideoSortBy` в `filterStore`
  (заодно описывает `ranking-…` без `as`-приведений).
- **CLI:** `scripts/create-custom-video.mjs` — подниша пишется отдельным `update` (не трогает упаковку), работает и для YouTube-видео;
  при создании — через `buildCustomVideoDoc({ subnicheId })` в `shared/customVideo.ts`.

## Связанные фичи

- [Trends — Niche System](../trends/niche-system.md) — ниши конкурентов (другая сущность).
- [Playlists](../playlists/playlists.md) — сортировка By subniche.
- [Create Custom Video CLI](./create-custom-video-cli.md) — флаг `--subniche`.
