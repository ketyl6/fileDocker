# Changelog

All notable changes to fileDocker are documented in this file.

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