# fileDocker — ver. alpha1

**fileDocker** is a lightweight, cross-platform desktop file explorer built with [Wails](https://wails.io/) (Go backend + HTML/CSS/JS frontend). It's designed as a fast, keyboard-driven alternative to the default OS file manager, inspired by tools like **Ranger** and **Total Commander**.

> ⚠️ **Status: alpha1** — core local file management is functional, but some features (Dual Pane, SMB/FTP) are UI-only stubs and not yet wired up. Expect rough edges.

## Features

### File management
- Cascading, column-based navigation (Ranger-style) through the local filesystem
- Multi-select mode (`Enter` to toggle selection) for batch operations
- Copy, cut, paste, delete, create file/folder — all via configurable keyboard shortcuts
- Send single file to Zop archive (multi-select and diffrent archrives types pending)
- Unzip archives directly from the explorer
- Built-in file info panel (size and other metadata, similar to Windows Explorer)
- File preview pane with:
  - Syntax highlighting for common languages (Go, Python, JavaScript, C++, Bash, NixOS configs, etc.)
- "Open with" file associations — configurable per file type via an editable JSON file, with a quick-access option in the UI to pick the program to open a file with
- Launch a system terminal directly in the current directory
- One-click temporary file cleanup

### Interface & customization
- Adjustable UI scale via a slider in Settings (scales the whole app, not just individual elements)
- Dark and light themes
- View options (show hidden files, show file extensions, folders-first sorting) accessible from Settings, similar to Windows view options
- Fully remappable keyboard shortcuts, configured in Settings and reflected live in the bottom shortcut bar
- Settings persist to a `settings.json` file in the user's home directory (cross-platform: Windows & Linux) and are read on every app startup

### Cloud & network (partial)
- **Google Drive** integration with OAuth login and browsing of Drive contents; not functional yet
- **SMB/FTP** network browsing — UI (host/user/password form) is in place; backend connectivity is not yet implemented

### Planned / in progress
- **Dual Pane mode** (Total Commander–style split view) — the setting and keyboard shortcut exist in the UI, but the feature is currently disabled to avoid destabilizing the column-view renderer. Triggering it shows a "coming in a future version" notice.

## Tech stack

- **Backend:** Go, using the [Wails](https://wails.io/) framework to bridge Go and the web frontend
  - Standard library only: `archive/zip`, `encoding/json`, `net/http`, `net/url`, `os/exec`, `path/filepath`, `runtime`, `syscall`
- **Frontend:** Vanilla HTML, CSS, and JavaScript (no framework)
- **Persistence:** Local JSON files (`settings.json`, file-association config) stored in the user's home directory

## Project structure

```
.
├── app.go                     # Wails backend: filesystem ops, settings, zip/unzip, Drive auth, etc.
├── main.go                    # Wails app entrypoint (not shown in source chat, standard Wails bootstrap)
└── frontend/
    ├── index.html              # App shell: sidebar, topbar, settings/view menus, modals
    └── src/
        ├── main.js             # Frontend logic: navigation, shortcuts, settings, previews
        └── style.css           # Theming (dark/light), layout, scaling variables
```

## Key backend methods (Go / Wails bindings)

| Method | Purpose |
|---|---|
| `GetOS`, `GetDrives` | System info / available drives |
| `GetRangerData` | Column-view directory listing |
| `GetFileInfo` | File metadata / stats |
| `ReadFilePreview` | Content for the preview pane |
| `FileAction` | Copy / cut / paste / delete |
| `CreateItem` | New file or folder |
| `ZipItem`, `ZipMultipleItems`, `UnzipItem` | Archive management |
| `OpenTerminal` | Launch system terminal in a directory |
| `CleanTempFiles` | Clear temporary files |
| `GetSettings`, `SaveSettings`, `OpenSettingsFile` | App settings persistence |
| `GetFileAssociations`, `OpenAssociationsFile`, `OpenFileCustom` | "Open with" configuration |
| `IsDriveAuthenticated`, `LoginGoogle`, `GetDriveData` | Google Drive integration |

## Getting started

This project is built with Wails, so the usual Wails workflow applies:

```bash
# Install Wails CLI (if not already installed)
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# Run in development mode with hot reload
wails dev

# Build a production binary
wails build
```

> Note: `main.go`, `wails.json`, and `go.mod` were not part of the reviewed conversation and may need to be scaffolded via `wails init` if starting from this README alone.

## Localization

The current UI strings are in **Polish**. Internationalization has not been implemented yet.

## Known limitations (alpha1)

- Dual Pane mode is present in settings/shortcuts but non-functional
- SMB/FTP is a front-end placeholder with no backend connection logic
- No automated tests
- Single-language (Polish) UI only
