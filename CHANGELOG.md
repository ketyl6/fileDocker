# Changelog

All notable changes to fileDocker are documented in this file.

## [beta1] - 2026-09-06

First native beta release. fileDocker was rebuilt from the ground up in Go with the Fyne toolkit, replacing the previous web-technology-based version.

### Added

- Three-pane file browser: parent folder, current folder, and a live preview pane (subfolder contents or file preview).
- Keyboard-first navigation: arrow keys to move the selection, Enter/Right arrow to open, Left arrow/Backspace to go back, with the previous folder auto-selected on return.
- Mouse support: double-click to open, Ctrl+Click/Shift+Click to select multiple items, right-click context menu (copy, cut, paste, delete, open terminal here).
- Temporary file marking/selection (default key `z`), cleared automatically after copy, cut, or archive actions.
- Safe file preview with binary-file detection (by extension and by scanning for null bytes) and stripping of invalid/control characters from text previews.
- Quick search bar, opened with `/`, filters the current folder as you type; Esc clears it and returns focus to the file list.
- File operations: copy, cut, paste, delete (with an optional confirmation dialog), new file, new folder.
- ZIP archive creation and extraction.
- Built-in terminal launcher on a global shortcut (default Ctrl + `` ` ``), with support for a custom terminal command.
- Drive/root switcher in the top bar: drive letters on Windows, root path on Linux/macOS.
- Fully configurable single-key shortcuts for every file action, editable from Settings.
- Dynamic, JSON-based translation system; English is bundled by default, additional language files are auto-detected from `~/.config/fileDocker/lang`.
- Automatic completion of translation files: missing keys are filled in from the built-in English base and written back to disk.
- In-app Settings screen (full window, not a popup) covering hidden files, file extensions, folders-first sorting, delete confirmation, default startup path, custom terminal, language, and shortcut bindings, with a dedicated Save Settings button.
- Persistent configuration stored at `~/config.json`.
- Minimalist folder and file icons.
- Optional shortcuts footer bar, showing the currently bound keys and updating live with the selected language.

### Changed

- Migrated the application from a web-technology-based version to a native Go + Fyne desktop app.
- Moved settings and language storage from the program folder to the user's home directory (`~/config.json` and `~/.config/fileDocker/lang`) for a proper cross-platform install.
- Replaced the plain drive dropdown with a path/drive switcher built into the top bar.
- Removed the dedicated terminal toolbar button in favor of the global Ctrl + `` ` `` shortcut.
- Removed the up-arrow navigation button; going back now works by clicking a folder in the parent-folder pane or using the keyboard.
- Removed custom Tab-key handling; Tab now uses Fyne's native focus order.
- Replaced the default folder icon with a lighter, minimalist version.

### Fixed

- Crash when previewing binary files or files containing invalid UTF-8.
- Application crash when quickly hovering over or switching between files (text-shaping panic in the underlying font engine).
- Unreadable navigation icons on Windows caused by missing Unicode glyphs, replaced with supported icons and labels.
- Keyboard shortcuts not responding due to a case-sensitivity mismatch between physical key events and configured letters.
- Language switching not applying correctly at runtime.
- Search field trapping keyboard focus and blocking Esc and navigation keys.
- Navigation breaking after entering an empty folder (arrow keys and Backspace stopped responding).
- File marks persisting after an action instead of clearing automatically.
- Right-click context menu ignoring an existing multi-selection and only acting on the clicked item.
- Shortcut labels in the footer bar staying hardcoded to Polish regardless of the selected language.
- Search shortcut (`/`) being swallowed by the file list's built-in type-to-select behavior.
- Various compilation errors from incorrect Fyne API usage (window key events, theme icon names, mouse event modifiers).
