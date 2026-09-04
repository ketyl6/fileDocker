# Changelog

All notable changes to fileDocker are documented in this file.

## [legacy] - 2026-09-05

### Status changed
- **Moving to another framework**: due to high memory usage and pretty tricky and unstable Linux support fileDocker is changing its framework to much less "memory hungry" and more compatible Fyne framework. For now this version will not be updated further.

## [alpha4.1] - 2026-08-20

### Added
- **Added script support for the modules**: modules can now have more advanced scripts that can be written in any programming launguage.

## [alpha4] - 2026-08-20

### Added
- **Localization system (i18n)**: fileDocker is no longer Polish-only. Drop a `xx.json` file into `.config/fileDocker/lang/` (e.g. `en.json`) and, after a reload, it appears as a selectable language in Settings. Every string in the app - buttons, alerts (OK/Yes/No/Cancel), the bottom shortcut bar, the theme toggle, even system messages like "clipboard empty" or "saved" - is now routed through a translation function instead of being hardcoded. Deleting the default `pl.json` regenerates it with a complete, up-to-date key list, making it easy to use as a template for new translations. An `en.json` English pack is included as a working example.
- **Custom Modules (plugins)**: a VSCode-style plugin system. Drop a subfolder into `.config/fileDocker/modules/` containing `manifest.json`, `index.html`, and `script.js`, and it's automatically picked up as a new item in the sidebar - clicking it injects the module's HTML into the main view and runs its JS in an isolated call. Modules can be individually toggled on/off from Settings (the disabled list is saved to `settings.json`), and every enabled module gets its own dynamic, rebindable keyboard shortcut for jumping straight to it. A "Todo List" module ships as a working example of the module API.
- **Auto-reload on config change**: switching languages or toggling a module on/off now reloads the frontend in place, in the background - no more quitting and relaunching the app to see the change take effect.
- **Custom cleanup paths**: a new "Custom folders" cleaner action (`customCleanPaths` setting) lets you manage a list of your own paths to purge, added/removed from Settings. Cleaning shows an alert listing exactly which folders were removed. New Cleaner-tab shortcuts: `1`/`T` (OS temp files), `2`/`C` (Google Drive cache), `3`/`N` (custom folders).
- **Git-not-installed guard**: the Git Projects tab now checks for a working `git` on `PATH` before rendering; if it's missing, it shows a clear message and a download prompt instead of failing with errors.
- **Windows quick drive switch**: a new `w` shortcut (Windows only) moves focus to the drive selector so you can change drives with the arrow keys and confirm with `Enter`/`Escape`, without touching the mouse.
- **In-app view-option toggles**: "Show hidden files", "Show file extensions", and "Folders first" - previously settings.json-only despite being listed as GUI options - now have real checkboxes in the Settings tab.
- **Shortcut bar in every tab**: the bottom keyboard-shortcut bar, previously only shown on Local Files and Google Drive, now also appears on Git Projects, Cleaner, and Settings.

### Changed
- **Custom cleanup paths now cross-platform**: after briefly being restricted to Windows alongside OS-temp cleanup, custom folder cleanup was reopened for Linux, macOS, and Windows alike. OS Temp-file cleanup and the drive-switch shortcut remain Windows-only, since they depend on Windows-specific paths and concepts.
- **Settings shortcut is now remappable**: opening Settings (default `Ctrl+,`) is now listed in the shortcuts panel like any other action - it can be reassigned to a different key, but stays Ctrl-modified.

### Fixed
- **Settings button could silently vanish**: a missing DOM element during interface generation (introduced while wiring up modules/languages) could break the Settings button/menu entirely. A "bulletproof" fallback now guarantees a working Settings entry always renders in the sidebar, and duplicate-click handling was cleaned up.
- **Broken shortcuts panel after refactor**: a `knownShortcutLabels` dictionary needed to render shortcut names was accidentally dropped during a rewrite, breaking the Settings shortcuts view; restored, alongside a pass to make sure literally every UI element (not just most) goes through translation.

### Known issues / carried over
- **Dual Pane** mode is still a stub - the setting and `d` shortcut exist, but activating it just shows a "coming soon" message.
- Need for Google account logging improvement for easier and smoother user experience (OAuth2).
- Custom modules run with direct HTML/JS injection - no sandboxing beyond the isolated call, so only install modules you trust.

### Roadmap (proposed, not yet started)
1. Improving OAuth2 (Google account logging) process.
2. Completing **Dual Pane** (Total Commander-style split view).
3. An advanced cleanup module - a smart scanner for reclaiming disk space from dev artifacts like Python `venv`, `node_modules`, and compiled C++ binaries.
4. A way to discover/share community language packs and modules.

## [alpha3.1] - 2026-08-19

### Fixed
- Linux support (due to syscall using in app.go file Linux building was impossible)

### Changed
- Major bugfixes - changed style.css to match the themes

### Planned in next updates
- ***Plugins/Modules***
- ***More launguages***
- ***More bugfixes and testing***

## [alpha3] - 2026-08-12

### Added
- **Git Projects tab**: replaced the "Sieć" (SMB/FTP) tab entirely with a new "Projekty Git" tab. It scans a configurable root folder (new `projectsPath` setting, up to 2 levels deep) for local `.git` repositories and lists each one with its current branch and number of changed/untracked files.
- **Commit history browsing**: clicking into a local repo shows its commit history. Clicking a commit checks it out (standard Git detached-HEAD behavior - Git itself blocks the checkout if you have uncommitted changes that would be overwritten).
- **Branch switching**: a Branches panel lists all local branches for the selected repo, with the current one highlighted; clicking another branch checks it out and refreshes the view.
- **GitHub search & clone**: a built-in search box queries GitHub concurrently by repository name and by username, merges and de-duplicates the results, and lets you clone a result straight into a chosen local folder.
- **Auto cache cleanup**: a new `cacheCleanupDays` setting (default 7) automatically clears out old cached downloads (from Google Drive, etc.) on startup based on their age.
- **Keyboard-only interface navigation**:
  - `Ctrl+1` / `Ctrl+2` / `Ctrl+3` / `Ctrl+4` switch directly between the Local Files, Google Drive, Git Projects, and Cleaner tabs.
  - `Ctrl+,` (and `Ctrl+5`) opens Settings from anywhere.
  - Pressing `Escape` while typing in any text field (commit message, GitHub search, rename, etc.) blurs the field and returns keyboard control to the file view instead of doing nothing.
  - Sidebar tabs now show their shortcut hint next to the label.
- New `download` shortcut (`s`) for pulling remote items (Drive/Git) down to the local cache.
- **Google Drive fully operational**: app now can connect to user's Google account and can browse, download and remove files to the Drive

### Changed
- Settings panel redesigned with clearer section headers, short descriptions under each option, and a responsive grid layout for the keyboard shortcuts list so it no longer looks cramped or unlabeled.
- Google Drive item in the sidebar remains the only working cloud/remote source; the old "Sieć" label and everything tied to it is gone.

### Removed
- **SMB/FTP networking dropped**: a full local-subnet SMB/FTP scanner (Go goroutines probing ports 445/21) and manual connection UI were built, then removed before release in favor of the lighter Git Projects tab. fileDocker does not connect to network shares or FTP servers.

### Known issues / carried over
- **Dual Pane** mode is still a stub - the setting and `d` shortcut exist, but activating it just shows a "coming soon" message.
- Need for Google account logging improvment for easier and smoother user expierience.

### Roadmap (proposed, not yet started)
1. Improving OAuth2 (Google account logging) process.
2. Completing **Dual Pane** (Total Commander-style split view)
3. An advanced cleanup module - a smart scanner for reclaiming disk space from dev artifacts like Python `venv`, `node_modules`, and compiled C++ binaries and other yet to be established.

---

## [alpha2.2] - 2026-08-12

### Added
- **More archives unpack support**: addes tar and rar support for unpacking local files.

## [alpha2.1] - 2026-08-12

### Changed
- **Changed alert window**: changed alert window from default webview to custom-made window that matches app theme.

## [alpha2] - 2026-08-12

### Added
- **Multiple archive formats**: packing now supports `.zip`, `.tar`, and `.rar` (rar requires the `rar` binary to be available on the system `PATH`), selectable from a dropdown in the pack dialog.
- **Dedicated selection & packing shortcuts**: file marking and archiving now have their own, independent keys instead of overloading `Enter`.
  - `z` - mark/unmark a file for a batch operation (multi-select)
  - `Shift+P` - pack all currently marked files into an archive
  - `Enter` is reserved again for its classic behavior: open a file / navigate into a folder
- Marked (multi-selected) files now support **Copy, Cut, Delete, and Pack** as group operations, not just packing.
- **Custom terminal setting**: a new `customTerminal` option lets you choose which terminal emulator is launched (e.g. `alacritty`, `kitty`, `gnome-terminal`) instead of relying on the OS default.
- New theming CSS variables to support the marked-selection highlight and syntax/preview colors (`--marked-bg`, `--hl-keyword`, `--hl-string`, `--hl-comment`, `--info-bg`).

### Changed
- Bottom shortcut bar now clearly distinguishes shift-required shortcuts (e.g. shows `[N]`/`[Z]` style formatting to signal `Shift` is needed).
- Selection/marking logic reworked twice this session before settling on the final `z` (mark) / `Shift+P` (pack) split described above.

### Fixed
- **Path-doubling bug**: archiving previously concatenated an absolute destination path onto the current folder path (e.g. `C:\folder\C:\folder\archive.zip`), which broke packing entirely. The backend now handles path resolution correctly.
- **Paste into empty folder**: pasting used to silently fail if the destination directory had no files in it (the "item under cursor" check blocked it).
- **Copy onto itself**: copying a file/folder into its own current location now creates a proper "Copy" instead of attempting to overwrite itself.
- **Windows archive corruption**: ZIP archives created on Windows now correctly use forward-slash (`/`) internal paths, fixing corrupted archives.
- **Self-packing hang**: packing no longer tries to include the archive file being created into itself.
- **Infinite loop on self-paste**: pasting a folder into itself (which previously caused an unbounded recursive copy and froze the app) is now blocked.
- **Selection cursor visibility**: fixed a CSS stacking issue where the "marked" (multi-select) background color visually covered the navigation cursor, making it impossible to tell which item was currently focused. Cursor now always renders with a visible outline.

### Known issues / carried over from alpha1
- **Dual Pane** mode is still a stub - the setting and `d` shortcut exist, but activating it just shows a "coming soon" message.
- **SMB/FTP** network browsing is still front-end only (login form UI with no backend connection logic).
- **Google Drive** integration still only supports login(no browsing/upload/download/delete yet).

### Roadmap (proposed, not yet started)
Discussed as candidates for the next milestone:
1. Full Google Drive support (browsing, upload, download, delete)
2. A working SMB/FTP client
3. Completing **Dual Pane** (Total Commander–style split view)
4. An advanced cleanup module - a smart scanner for reclaiming disk space from dev artifacts like Python `venv`, `node_modules`, and compiled C++ binaries

---

## [alpha1] - 2026-08-11

Initial alpha release. See `README.md` for the full feature set at this stage, including:
- Ranger-style column navigation, copy/cut/paste/delete, create file/folder
- Basic zip/unzip
- Adjustable UI scale, dark/light themes, configurable view options
- Settings persisted to `settings.json` in the user's home directory
- File-type "open with" associations via editable JSON
- Syntax highlighting, Markdown & LaTeX preview rendering
- Built-in terminal launcher, temp file cleanup
- Google Drive login + basic browsing
- SMB/FTP and Dual Pane present in the UI but not functional
