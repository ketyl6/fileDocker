# fileDocker ver. alpha4

**fileDocker** is a lightweight, cross-platform desktop file explorer built with [Wails](https://wails.io/) (Go backend + HTML/CSS/JS frontend). It's designed as a fast, keyboard-driven alternative to the default OS file manager, inspired by tools like **Ranger** and **Total Commander**.

## Features

### File management
- Cascading, column-based navigation (Ranger-style) through the local filesystem
- Dedicated multi-select: press `z` to mark/unmark files, then run a batch operation (Copy, Cut, Delete, or Pack) on everything marked - `Enter` is reserved for its classic job of opening files / entering folders
- Copy, cut, paste, delete, create file/folder - all via configurable keyboard shortcuts
- Pack marked files into an archive with `Shift+P`, choosing the format from a dropdown: **.zip**, **.tar**, or **.rar** (`.rar` creation requires the `rar` binary on your system `PATH`)
- Unzip archives directly from the explorer
- Built-in file info panel (size and other metadata, similar to Windows Explorer)
- File preview pane with:
  - Syntax highlighting for common languages (Go, Python, JavaScript, C++, Bash, NixOS configs, etc.)
  - Markdown rendering
  - LaTeX rendering
- "Open with" file associations - configurable per file type via an editable JSON file, with a quick-access option in the UI to pick the program to open a file with
- Launch a system terminal directly in the current directory, with a **custom terminal emulator** setting (e.g. `alacritty`, `kitty`, `gnome-terminal`) instead of relying on the OS default
- One-click temporary file cleanup, plus automatic cache cleanup on startup (`cacheCleanupDays` setting, default 7 days) that clears out old cached downloads
- **Custom cleanup paths**: maintain your own list of folders to purge (add/remove from Settings, `customCleanPaths`), available on Windows, Linux, and macOS. Cleaning shows an alert listing exactly which folders were removed. OS Temp-file cleanup itself stays Windows-only, since it targets Windows-specific paths
- On Windows, jump straight to the drive selector with a dedicated shortcut (`w` by default) and switch drives with the arrow keys, without touching the mouse

### Interface & customization
- Adjustable UI scale via a slider in Settings (scales the whole app, not just individual elements)
- Dark and light themes, now with dedicated styling for the multi-select "marked" highlight so it no longer hides the navigation cursor
- View options (show hidden files, show file extensions, folders-first sorting) toggled directly from checkboxes in Settings, similar to Windows view options
- Fully remappable keyboard shortcuts, configured in Settings and reflected live in the bottom shortcut bar (shift-required shortcuts are shown clearly, e.g. `[Z]`) - including the Settings shortcut itself (default `Ctrl+,`), which stays Ctrl-modified but can be reassigned to a different key
- The bottom shortcut bar is now shown on every tab (Local Files, Google Drive, Git Projects, Cleaner, Settings), not just Local Files and Google Drive
- Settings panel laid out in clear sections with a short description under each option, and a responsive grid for the shortcuts list
- Settings persist to a `settings.json` file in the user's home directory (cross-platform: Windows & Linux) and are read on every app startup
- Switching languages or enabling/disabling a module reloads the app's frontend automatically in the background - no need to quit and relaunch
- First app branding pass: a terminal-inspired `>_fD` logo (SVG + PNG) in the app's purple/Dracula accent color, wired up as the Wails window/taskbar icon

### Cloud
- **Google Drive** read/write support and logging via Google Cloud API and Google Drive API.

### Git Projects
- A dedicated "Projekty Git" tab scans a configurable root folder (`projectsPath` setting, up to 2 levels deep) for local `.git` repositories and lists each one with its current branch and number of changed/untracked files
- Click into a repo to browse its commit history - clicking a commit checks it out (standard Git detached-HEAD behavior; Git blocks the checkout if it would overwrite uncommitted changes)
- A Branches panel lists all local branches, with the current one highlighted; clicking another branch checks it out and refreshes the view
- Built-in GitHub search (by repository name and by username at once) with one-click cloning of a result into a chosen local folder
- If `git` isn't found on `PATH`, the tab shows a clear "Git not installed" message with a download prompt instead of failing with errors
- fileDocker does not connect to SMB shares or FTP servers - a full network-share module was evaluated and dropped to keep the app lightweight

### Localization
- Every string in the app - buttons, alerts, the shortcut bar, the theme toggle, even system messages - is routed through a translation system, not hardcoded
- Add a language by dropping a `xx.json` file (e.g. `en.json`) into `.config/fileDocker/lang/`; after a reload it appears as a selectable language in Settings
- Deleting the default `pl.json` regenerates it with the complete, current key list - a ready-made template for new translations
- An `en.json` English pack ships as a working example

### Modules (plugins)
- A VSCode-style plugin system: drop a subfolder into `.config/fileDocker/modules/` containing `manifest.json`, `index.html`, and `script.js`, and it's automatically picked up as a new sidebar entry
- Clicking a module injects its HTML into the main view and runs its JS in an isolated call
- Modules can be individually enabled/disabled from Settings; the disabled list is saved to `settings.json`
- Each enabled module gets its own dynamic, rebindable keyboard shortcut for jumping straight to it from anywhere in the app
- A "Todo List" module ships as a working example of the module API

### Interface navigation
- `Ctrl+1` / `Ctrl+2` / `Ctrl+3` / `Ctrl+4` jump directly between the Local Files, Google Drive, Git Projects, and Cleaner tabs; `Ctrl+,` (or `Ctrl+5`) opens Settings from anywhere
- Pressing `Escape` while typing in any text field (commit message, GitHub search, rename, etc.) returns keyboard control to the file view instead of doing nothing
- Sidebar tabs show their shortcut hint next to the label

### Planned / in progress
- **Dual Pane mode** (Total Commander–style split view) - the setting and keyboard shortcut (`d`) exist in the UI, but the feature is currently disabled to avoid destabilizing the column-view renderer. Triggering it shows a "coming in a future version" notice.
- An advanced cleanup module that scans for reclaimable space from dev artifacts (Python `venv`, `node_modules`, compiled binaries, etc.)

## Tech stack

- **Backend:** Go, using the [Wails](https://wails.io/) framework to bridge Go and the web frontend
  - Standard library only: `archive/tar`, `archive/zip`, `encoding/json`, `net/http`, `net/url`, `os/exec`, `path/filepath`, `runtime`, `strings`, `sync`, `time`
  - Hidden-file detection is split into `hidden_windows.go` (build tag `windows`, uses `syscall`) and `hidden_unix.go` (build tag `!windows`), so `syscall` never leaks into the cross-platform build
  - `.rar` creation/extraction shells out to an external `rar` executable if present on `PATH`
  - Git Projects features shell out to a local `git` client (repo scanning, branches, checkout) and call the public GitHub REST API for remote search/clone
- **Frontend:** Vanilla HTML, CSS, and JavaScript (no framework)
- **Persistence:** Local JSON files (`settings.json`, file-association config) stored in the user's home directory; language packs and modules are loaded at runtime from `.config/fileDocker/lang/` and `.config/fileDocker/modules/`
- **Branding:** SVG/PNG app logo, embedded as the native Wails window/taskbar icon

## Project structure

```
.
├── app.go                      # Wails backend: filesystem ops, settings, archiving, Drive auth, etc.
├── hidden_windows.go           # isFileHidden implementation for Windows (build tag: windows)
├── hidden_unix.go              # isFileHidden implementation for Linux/macOS (build tag: !windows)
├── main.go                     # Wails app entrypoint, embeds build/appicon.png as the window icon
├── build/
│   └── appicon.png             # App icon source used by Wails to generate platform icons
└── frontend/
    ├── index.html              # App shell: sidebar, topbar, settings/view menus, modals
    └── src/
        ├── main.js             # Frontend logic: navigation, shortcuts, settings, previews
        ├── style.css           # Theming (dark/light), layout, scaling, selection variables
        └── assets/
            └── logo.svg / logo.png   # App logo/branding assets
```

## Key backend methods (Go / Wails bindings)

| Method | Purpose |
|---|---|
| `GetOS`, `GetDrives` | System info / available drives |
| `GetRangerData` | Column-view directory listing |
| `GetFileInfo` | File metadata / stats |
| `ReadFilePreview` | Content for the preview pane |
| `FileAction` | Copy / cut / paste / delete (single or marked-batch) |
| `CreateItem` | New file or folder |
| `ZipItem`, `ZipMultipleItems`, `UnzipItem` | Archive management (zip/tar/rar) |
| `OpenTerminal` | Launch system terminal in a directory (respects custom terminal setting) |
| `CleanTempFiles` | Clear temporary files |
| `autoCleanCache` | Auto-purge cached downloads older than `cacheCleanupDays` on startup |
| `GetSettings`, `SaveSettings`, `OpenSettingsFile` | App settings persistence |
| `GetFileAssociations`, `OpenAssociationsFile`, `OpenFileCustom` | "Open with" configuration |
| `IsDriveAuthenticated`, `LoginGoogle`, `GetDriveData` | Google Drive integration |
| `ScanGitProjects` | Scan `projectsPath` for local repos, branch, and change count |
| `GetLocalGitBranches` | List local branches for a repo |
| `GitAction` | Run a Git operation (checkout, restore) on a repo/file |
| `IsGitInstalled` | Check whether `git` is available on `PATH` |
| `SearchGitHub` | Search GitHub by repo name and username, merged and de-duplicated |
| `CloneRepo` | Clone a remote GitHub repo into a local folder |
| `CleanCustomPaths` | Purge the user-defined list of custom cleanup folders |
| `GetAvailableLanguages`, `GetLanguagePack` | List installed language packs / load one for the UI |
| `GetCustomModules` | Load installed plugin modules from `.config/fileDocker/modules/` |

## Default keyboard shortcuts

| Key | Action |
|---|---|
| `Enter` | Open file / enter folder |
| `z` | Mark / unmark file for a batch operation |
| `Shift+P` | Pack all marked files into an archive |
| `u` | Unzip |
| `c` / `x` / `v` | Copy / Cut / Paste |
| `Delete` | Delete |
| `n` | New file |
| `Shift+N` | New folder |
| `t` | Open terminal |
| `s` | Download remote item (Drive/Git) to local cache |
| `w` | Jump to the drive selector to switch drives with arrow keys (Windows only) |
| `d` | Dual Pane (not yet active - shows a "coming soon" notice) |
| `1` / `T` | *(Cleaner tab)* Clean OS temp files (Windows only) |
| `2` / `C` | *(Cleaner tab)* Clean Google Drive cache |
| `3` / `N` | *(Cleaner tab)* Clean custom cleanup folders |
| `Ctrl+1` / `Ctrl+2` / `Ctrl+3` / `Ctrl+4` | Switch to Local Files / Google Drive / Git Projects / Cleaner |
| `Ctrl+,` or `Ctrl+5` | Open Settings |
| `Escape` | Blur the active text field and return focus to the file view |

Enabled modules each get their own dynamic shortcut, listed at the bottom of the shortcuts section in Settings.

All shortcuts, including the Settings shortcut, are remappable from Settings; only the `Ctrl+1`-`Ctrl+4` tab-navigation shortcuts are fixed.

## Getting started

This project is built with Wails, so the usual Wails workflow applies:

```bash
# Install Wails CLI (if not already installed)
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# Run in development mode with hot reload
wails dev

# Build a production binary
wails build

# Force a clean rebuild (useful after changing build/appicon.png)
wails build -clean
```

## Localization

fileDocker ships with Polish as the default UI language, but every string in the app now goes through a translation system, so any language can be added by dropping a JSON file into `.config/fileDocker/lang/` (see the Localization feature section above for details). An English pack (`en.json`) is included as a working example.

## Known limitations (alpha4)

- Dual Pane mode is present in settings/shortcuts but non-functional
- `.rar` archiving/extraction depends on an external `rar` binary being installed and on `PATH`
- No automated tests
- Custom modules run with direct HTML/JS injection and no sandboxing beyond the isolated call - only install modules you trust
- OS Temp-file cleanup and the quick drive-switch shortcut are Windows-only

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for the full list of changes.