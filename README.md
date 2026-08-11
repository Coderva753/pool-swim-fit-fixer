# PoolFix

[English](#english) · [Русский](#русский)

## English

PoolFix is a local, browser-based application for repairing pool-swim activities where a single pool length was incorrectly split into two or more lengths.

### Usage

1. Build the application as described below.
2. Open `dist/poolfix.html` in a browser.
3. Drop the original `.fit` file into the application.
4. Select two or more adjacent active lengths within the same interval.
5. Click **Merge**, verify the corrected distance, and download the repaired FIT file.

The original file is never overwritten. The repaired file receives the `_fixed.fit` suffix. Before download, PoolFix validates its header, file size, CRC, and swimming-session aggregates using the official Garmin FIT SDK.

All processing happens locally in the browser's memory. The FIT file is not uploaded anywhere, and no installation, server, or runtime is required to use the built application.

### Development

```text
pnpm install
pnpm build
```

The FIT-processing logic is in `src/fit.ts`. The interface is implemented in `src/main.ts` and `src/styles.css`.

## Русский

PoolFix — локальное браузерное приложение для исправления тренировок в бассейне, в которых одна дорожка была ошибочно разбита на две или несколько.

### Использование

1. Соберите приложение, как описано ниже.
2. Откройте `dist/poolfix.html` в браузере.
3. Перетащите исходный `.fit`-файл в окно приложения.
4. Выберите два или несколько соседних активных отрезков одного интервала.
5. Нажмите **«Объединить»**, проверьте исправленную дистанцию и скачайте готовый FIT-файл.

Исходный файл не перезаписывается. Результат получает суффикс `_fixed.fit`. Перед скачиванием PoolFix проверяет заголовок, размер, CRC и агрегаты плавательной сессии с помощью официального Garmin FIT SDK.

Вся обработка происходит локально в памяти браузера. FIT-файл никуда не загружается, а для использования собранного приложения не нужны установка, сервер или среда выполнения.

### Разработка

```text
pnpm install
pnpm build
```

Основная логика обработки FIT находится в `src/fit.ts`, интерфейс — в `src/main.ts` и `src/styles.css`.
