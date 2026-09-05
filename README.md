# fileDocker

A lightweight, keyboard-first desktop file manager for Windows, Linux, and macOS, built in Go with the [Fyne](https://fyne.io/) GUI toolkit.

fileDocker is a native rewrite of an earlier web-technology-based version of the app. It follows the classic dual/triple-pane file manager style (think Ranger or Windows Explorer), with heavy focus on keyboard navigation while still supporting full mouse control.

> Status: beta1 - actively developed, expect rough edges.

## Features

- **Three-pane layout** - parent folder on the left, current folder in the middle, and a live preview (subfolder contents or file preview) on the right.
- **Keyboard-first navigation** - arrow keys to move, Enter/Right arrow to open, Left arrow/Backspace to go back (the folder you came from stays selected).
- **Mouse support** - double-click to open, Ctrl+Click/Shift+Click to select multiple items, right-click for a context menu.
- **Safe file preview** - binary files (exe, zip, images, video, etc.) are detected and skipped instead of crashing the preview pane; text previews are cleaned of invalid or control characters.
- **Quick search** - press `/` to jump into the search bar and filter the current folder; press Esc to clear it and return to the file list.
- **File operations** - copy, cut, paste, delete (with optional confirmation), create new files/folders, and build/extract ZIP archives.
- **Temporary selection/marking** - mark files with a single key (default `z`); marks clear automatically once an action is performed, the same way Ranger works.
- **Built-in terminal launcher** - opens a terminal in the current folder with a global shortcut (default Ctrl + `), supports a custom terminal command.
- **Cross-platform drive/root switching** - shows drive letters (C:\, D:\, ...) on Windows, and the root path (/) on Linux/macOS.
- **Fully translatable interface** - English is built in; additional languages are plain JSON files dropped into a folder, no rebuild required.
- **Configurable shortcuts** - every file action's keybind can be changed from the in-app Settings screen.
- **Persistent settings** - window and browsing preferences, default folder, custom terminal, language, and shortcuts are all saved between sessions.

## Requirements

- Go 1.21 or later
- A C compiler toolchain, since Fyne uses cgo for its OpenGL backend (gcc/clang on Linux/macOS, MinGW-w64 or similar on Windows)
- A desktop environment with OpenGL 2+ support (standard on any modern Windows, Linux, or macOS install)

## Installation

```
git clone <repo-url>
cd fileDocker
go mod tidy
```

## Running

```
go run .
```

## Building

```
go build -o fileDocker .
```

On Windows this produces `fileDocker.exe`.

## Configuration

fileDocker stores its data in your home directory, so it works the same way across platforms:

| Purpose        | Location                              |
|-----------------|----------------------------------------|
| Settings        | `~/.config/fileDocker/config.json`    |
| Language files  | `~/.config/fileDocker/lang/*.json`    |

Both are created automatically with sensible defaults the first time you run the app. You can edit everything from the in-app Settings screen, or by hand if you prefer.

### Language files

English (`en.json`) is generated automatically on first launch. To add another language, drop a new file into the lang folder using the same key structure, for example:

```
~/.config/fileDocker/lang/pl.json
```

New files are detected automatically at startup and show up in the language dropdown in Settings, no source changes needed. If a translation file is missing a key, fileDocker fills it in from the built-in English base and rewrites the file, so your translation never breaks the app.

### Default keyboard shortcuts

| Action                  | Key            |
|--------------------------|----------------|
| Search                   | `/`            |
| Move selection           | Arrow keys     |
| Open / enter folder      | Enter or Right |
| Go back                  | Backspace or Left |
| Mark/select file         | `z`            |
| Copy                     | `c`            |
| Cut                      | `x`            |
| Paste                    | `v`            |
| Delete                   | `Delete`       |
| New file                 | `n`            |
| New folder               | `N`            |
| Create ZIP archive       | `P`            |
| Extract ZIP              | `u`            |
| Open terminal here       | Ctrl + `` ` `` |
| Clear search / selection | Esc            |

All shortcuts except navigation and Esc can be rebound from the Settings screen.

## Project layout

| File               | Responsibility                                   |
|---------------------|--------------------------------------------------|
| `main.go`          | Application entry point and window setup         |
| `config.go`        | Settings, language loading/merging, and defaults |
| `view_local.go`    | Main file browser view, navigation, and file actions |
| `view_settings.go` | Settings screen                                  |
