# Atlas Converter

Desktop-приложение на PySide6 для сборки спрайт-атласов из видео/PNG-секвенций и пакетной обработки PNG-файлов.

## Стек

- PySide6 (GUI), PyAV (видео), OpenCV (обработка изображений), NumPy (альфа/маски/трансформации)
- PyInstaller (сборка в exe)

## Структура

- `main.py` — точка входа
- `gui.py` — UI + вся прикладная логика (режимы Atlas и Sprites, таймлайн, превью, экспорт, настройки)
- `backend.py` — данные и обработка: `VideoLoader`, `ImageProcessor`, `AtlasBuilder`
- `theme.py` — тёмно-серая тема (AE-style): палитра, QSS, цвета таймлайна и вьюпорта
- `build.py` / `AtlasConverter.spec` — сборка exe (Windows)
- `build_mac.py` — сборка `.app` (запускать на macOS)

## Две вкладки (работают параллельно)

- **Atlas** — загрузка видео/PNG-секвенции, chroma key, выбор диапазона кадров, сборка атласа, экспорт `atlas.png` + `atlas.json`
- **Sprites** — загрузка набора PNG, resize/crop/смещение/масштаб каждого спрайта, композиция на фон, пакетный экспорт PNG

Вкладки независимы: ассеты Atlas не попадают в Sprites и наоборот.

## Важные особенности

- Preview и export идут раздельными пайплайнами — при изменении одного обязательно проверяй второй
- Таймлайн только для Atlas: ключи (ромбы) можно перетаскивать мышью, поэтому `timeline.markers` не всегда равномерны — `Refresh Atlas` пересобирает их
- Тексты интерфейса — только английские (UI приложения английский), комментарии в коде — русские
- Frames/Cols/Rows пересобирают ключи и превью сами через `on_atlas_grid_changed()`
- Загрузить файлы можно тремя способами: кнопка, клик по пустому вьюпорту, drag&drop на вьюпорт
- Keying применяется только в режиме Atlas
- Один `VideoLoader` используется для обоих режимов
- В Sprites два режима трансформации: на текущий файл или на все файлы сразу

## Как менять

- Новый параметр keying: UI в `setup_ui()`, сигнал в `setup_connections()`, обработка в `ImageProcessor`, использование в `process_and_display()`, `frame_to_rgba()`, `update_atlas_preview()`, `export_atlas()`
- Новый источник импорта: расширять `VideoLoader.load_video()` или `VideoLoader.load_image_list()`
- Изменение логики выбора кадров: `rebuild_markers()` (равномерно) и `TimelineWidget._move_key()` (перетаскивание ключа)
- Внешний вид таймлайна: `TimelineWidget` + константы `TL_*` в `theme.py`
- Тема и цвета: `theme.py` (`_QSS`, `VIEWPORT_*`, `DROPZONE_*`)
- Drag&drop и клик по вьюпорту: `ViewportWidget.dropEvent()`, `MainWindow.on_files_dropped()`
- Спрайтовые трансформации: `get_sprite_transform()`, `set_sprite_transform()`, `build_sprite_rgba()`
- Формат экспорта атласа: `export_atlas()`
- Пакетный экспорт PNG: `export_sprites()`
- Crop/resize: `ImageProcessor.resize_frame()` и `update_crop_rect()`
- Новый параметр настроек: добавить в `save_settings()` и `load_settings()`

## Подробная техкарта

См. `_utils/project.md` — полная документация по потокам данных, сущностям и слабым местам.
