# Portal Launcher

Полнофункциональный лаунчер Minecraft с поддержкой **всех версий** (от 1.7.10 до новейших снапшотов), модов, лоадеров, импорта из других лаунчеров и **облачной синхронизации аккаунтов**.

## Возможности

- ✅ **Аутентификация Microsoft** — Device Code Flow (код показывается в лаунчере)
- ✅ **Облачное хранилище токенов** — синхронизация между устройствами
- ✅ **Длительный срок входа** — refresh токены действительны 1 год!
- ✅ **Проверка лицензии** — автоматическая проверка владения Minecraft
- ✅ **Все версии Minecraft** — от 1.7.10 до последних снапшотов (включая 26w1.2)
- ✅ **Снапшоты по желанию** — отображаются только если включено в настройках
- ✅ **Лоадеры** — Fabric (1.14+), Forge (1.7.10+), Quilt (1.14+), NeoForge (1.20.1+)
- ✅ **Импорт сборок** — Modrinth App (.mrpack) и Prism Launcher (.zip)
- ✅ **Моды** — поддержка Modrinth и CurseForge, автообновление, зависимости
- ✅ **Инстансы** — изолированные сборки с настройками RAM и Java
- ✅ **Java Manager** — автозагрузка Java 8/16/17/21 (Azul Zulu / Temurin)
- ✅ **Папка PortalLauncher** — в %APPDATA% для совместимости
- ✅ **Глобальные моды** — общие моды для всех инстансов
- ✅ **Ресурс-паки и шейдеры** — полная поддержка

## Поддерживаемые версии

| Диапазон версий | Forge | Fabric | Quilt | NeoForge |
|----------------|-------|--------|-------|----------|
| 1.7.10 - 1.12.2 | ✅ | ❌ | ❌ | ❌ |
| 1.13 - 1.13.2 | ✅ | ❌ | ❌ | ❌ |
| 1.14 - 1.16.5 | ✅ | ✅ | ✅ | ❌ |
| 1.17 - 1.19.4 | ✅ | ✅ | ✅ | ❌ |
| 1.20.1+ | ✅ | ✅ | ✅ | ✅ |
| Снапшоты (26w1.2 и новее) | ❌ | ✅ | ✅ | ❌ |

## Импорт из других лаунчеров

### Modrinth App (.mrpack)
1. Экспортируйте сборку из Modrinth App в формате `.mrpack`
2. В Portal Launcher нажмите "Импорт" → "Import from .mrpack file"
3. Выберите файл `.mrpack`
4. Лаунчер автоматически:
   - Извлечёт моды и конфиги
   - Скачает все файлы модов
   - Настроит версию Minecraft и лоадер

### Prism Launcher (.zip)
1. В Prism Launcher экспортируйте инстанс в ZIP
2. В Portal Launcher нажмите "Импорт" → "Prism Launcher"
3. Выберите ZIP файл экспорта
4. Лаунчер автоматически:
   - Прочитает `instance.cfg` и `mmc-pack.json`
   - Извлечёт все файлы (моды, конфиги, ресурспаки)
   - Сохранит настройки RAM и Java

### Автообнаружение установленных лаунчеров
Лаунчер автоматически обнаружит установленные:
- Prism Launcher
- Modrinth App

И покажет доступные для импорта сборки в окне "Import Instance".

## Структура проекта

- `src/` — frontend на React + TypeScript
- `src-tauri/` — Rust backend с Tauri
- `PortalLauncher/` — данные лаунчера (в `%APPDATA%`)

## Требования

- **Node.js 18+** и npm/pnpm
- **Rust 1.77+** (установить с https://rustup.rs)
- **Windows 10/11** (также работает на Linux/macOS)

## Сборка и запуск

### 1. Установка зависимостей

```bash
npm install
```

### 2. Запуск в режиме разработки

```bash
npm run tauri dev
```

### 3. Сборка релизной версии

```bash
npm run tauri build
```

Релизные билды появятся в `src-tauri/target/release/bundle/`

## Расположение данных

```
%APPDATA%\PortalLauncher\
├── auth.json              # Microsoft токены
├── settings.json          # Настройки (вкл. show_snapshots)
├── instances/             # Инстансы
│   └── my-pack-abc123/
│       ├── instance.json
│       ├── mods/
│       ├── config/
│       ├── resourcepacks/
│       ├── shaderpacks/
│       ├── saves/
│       └── logs/
├── versions/              # Версии Minecraft
├── libraries/             # Библиотеки
├── assets/                # Ассеты
├── java/                  # Java runtime
├── mods/                  # Глобальные моды
├── resourcepacks/         # Глобальные ресурспаки
├── shaderpacks/           # Глобальные шейдеры
└── backups/               # Бэкапы
```

## Облачное хранилище токенов

### Длительный срок действия
- **Access токен**: 24 часа (автоматически обновляется)
- **Refresh токен**: **1 год** без необходимости повторного входа!
- **Автоматическое обновление**: лаунчер сам обновит токены до истечения

### Синхронизация между устройствами
Токены можно синхронизировать через:
- **Portal Cloud** (по умолчанию, локальное зашифрованное хранилище)
- **Google Drive** (требуется OAuth токен)
- **Dropbox** (требуется OAuth токен)
- **Локальный файл** (указанный путь)

### Безопасность
- ✅ Шифрование данных (XOR с SHA-256 ключом)
- ✅ Привязка к устройству
- ✅ Проверка владения аккаунтом (premium check)

### API команды

```typescript
// Сохранить текущий вход в облако
await invoke('save_auth_to_cloud');

// Загрузить из облака
const profile = await invoke('load_auth_from_cloud');

// Синхронизировать
await invoke('sync_auth_cloud');

// Проверить статус
const status = await invoke('get_cloud_sync_status');

// Установить провайдера
await invoke('set_cloud_provider', { 
  providerType: 'google', 
  accessToken: '...' 
});
```

## Настройки

### Показ снапшотов
В настройках включите `show_snapshots: true` чтобы видеть все снапшоты включая 26w1.2

```json
{
  "show_snapshots": true
}
```

## API Команды

### Версии
- `get_available_versions` — все версии (параметр `include_snapshots`)
- `get_filtered_versions` — версии с учётом настройки снапшотов
- `download_minecraft_version` — загрузить версию
- `delete_minecraft_version` — удалить версию

### Импорт
- `import_modrinth_pack` — импорт из .mrpack
- `import_prismlauncher_instance` — импорт из Prism ZIP
- `detect_prismlauncher_instances` — найти инстансы Prism
- `detect_modrinth_instances` — найти инстансы Modrinth App

### Аутентификация
- `start_device_code_flow` — начать вход (возвращает код)
- `poll_for_token` — проверить статус входа
- `get_cached_profile` — получить сохранённый профиль
- `clear_auth` — выйти
- `save_auth_to_cloud` — сохранить в облако
- `load_auth_from_cloud` — загрузить из облака
- `sync_auth_cloud` — синхронизировать
- `get_cloud_sync_status` — статус синхронизации
- `set_cloud_provider` — установить провайдера
- `delete_cloud_auth` — удалить облачные данные

### Инстансы
- `create_instance` — создать инстанс
- `get_instances` — список инстансов
- `launch_instance` — запустить
- `install_fabric/forge/quilt/neoforge` — установить лоадер

### Моды
- `search_mods` — поиск (Modrinth + CurseForge)
- `install_mod` — установить мод
- `get_instance_mods` — моды инстанса
- `check_mod_updates` — обновления
- `detect_mod_conflicts` — конфликты

### Настройки
- `get_setting` / `set_setting` — чтение/запись настроек
- `should_show_snapshots` — проверка настройки снапшотов

## Исправление ошибок

### Ошибка `alloc-no-stdlib`
```bash
cd src-tauri
rm Cargo.lock
cargo build
```

### Нет Java
Лаунчер автоматически загрузит Java нужной версии при первом запуске.

## Лицензия

MIT © Portal Team
