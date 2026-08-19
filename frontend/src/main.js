document.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
        e.preventDefault();
    }
});

document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

document.addEventListener('DOMContentLoaded', async () => {
    const viewTitle = document.getElementById('view-title');
    const fileArea = document.getElementById('file-area');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const contextMenu = document.getElementById('context-menu');
    const driveSelector = document.getElementById('drive-selector');
    let settingsBtn = document.getElementById('settings-btn');
    const driveLogoutBtn = document.getElementById('drive-logout-btn');
    const fileOpenBar = document.getElementById('file-open-bar');
    const customAppInput = document.getElementById('custom-app-input');
    const btnOpenFile = document.getElementById('btn-open-file');
    
    const customAlert = document.getElementById('custom-alert');
    const alertText = document.getElementById('alert-text');
    const alertOk = document.getElementById('alert-ok');

    const inputModal = document.getElementById('input-modal');
    const inputText = document.getElementById('input-text');
    const inputField = document.getElementById('input-field-modal');
    const archiveTypeSelect = document.getElementById('archive-type-select');
    const inputOk = document.getElementById('input-ok');
    const inputCancel = document.getElementById('input-cancel');

    const confirmModal = document.getElementById('confirm-modal');
    const confirmText = document.getElementById('confirm-text');
    const confirmYes = document.getElementById('confirm-yes');
    const confirmNo = document.getElementById('confirm-no');
    
    let currentMode = 'local';
    let previousMode = 'local';
    let currentDir = "";
    let parentDir = "";
    let currentFiles = [];
    let selectedIndex = 0;
    let selectedFiles = new Set();
    let driveHistory = ["root"];
    let osType = "";

    let localDirState = "";
    let cloudDirState = "root";

    let clipboardFiles = [];
    let clipboardAction = null; 
    let pendingCreateType = null;
    let confirmResolve = null;
    let fileAssociations = {};
    
    let cloneUrlCache = "";
    let cloneBranchCache = "";
    let customCleanPaths = [];
    let disabledModules = [];
    let customModules = [];

    let appScale = 1.0;
    let showHidden = false;
    let showExtensions = true;
    let foldersFirst = true;
    let isDarkTheme = true;
    let defaultPath = "";
    let confirmDelete = true;
    let customTerminal = "";
    let cacheCleanupDays = 7;
    let projectsPath = "";
    let appLang = "pl";
    let i18n = {};

    let shortcuts = {
        copy: "c", cut: "x", paste: "v", delete: "Delete",
        newFile: "n", newDir: "n", terminal: "t", mark: "z", archive: "p", unzip: "u", dualPane: "d", download: "s", switchDrive: "w", settings: ","
    };

    const knownShortcutLabels = {
        mark: "Zaznacz", copy: "Kopiuj", cut: "Wytnij", paste: "Wklej", delete: "Usuń",
        newFile: "Nowy Plik", newDir: "Nowy Folder", terminal: "Terminal", archive: "Spakuj",
        unzip: "Rozpakuj", download: "Pobierz", gitMacro: "Makro Git", dualPane: "Dual Pane", switchDrive: "Zmień dysk", settings: "Ustawienia (Ctrl)"
    };

    let rangerRenderId = 0;

    function t(key, fallback) {
        return (i18n && i18n[key]) ? i18n[key] : fallback;
    }

    function safeTranslateEl(selector, key, fallback) {
        const el = document.querySelector(selector);
        if (el) {
            let hasTextNode = false;
            for (let node of el.childNodes) {
                if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim().length > 0) {
                    node.nodeValue = t(key, fallback);
                    hasTextNode = true;
                    break;
                }
            }
            if (!hasTextNode) {
                el.appendChild(document.createTextNode(t(key, fallback)));
            }
        }
    }

    function formatSc(key, needsShift) {
        if (!key) return "";
        return needsShift ? `[Shift+${key.toUpperCase()}]` : `[${key.toUpperCase()}]`;
    }

    function updateShortcutUI() {
        const scBar = document.querySelector('.bottom-shortcuts');
        if (!scBar) return;

        let settingsShortcut = (shortcuts.settings || ',').toUpperCase();
        let globalShortcuts = `<span>[Ctrl+${settingsShortcut}] ${t('view_settings', 'Ustawienia')}</span>`;

        customModules.forEach(mod => {
            if (!disabledModules.includes(mod.id) && shortcuts['mod-' + mod.id]) {
                globalShortcuts += `<span>[${shortcuts['mod-' + mod.id].toUpperCase()}] ${mod.name}</span>`;
            }
        });

        if (currentMode === 'local') {
            let driveShortcutHtml = osType === 'windows' ? `<span>${formatSc(shortcuts.switchDrive, false)} ${t('sc_switchDrive', 'Zmień dysk')}</span>` : "";
            scBar.innerHTML = `
                <span>${formatSc(shortcuts.mark, false)} ${t('sc_mark', 'Zaznacz')}</span>
                <span>${formatSc(shortcuts.copy, false)} ${t('sc_copy', 'Kopiuj')}</span>
                <span>${formatSc(shortcuts.cut, false)} ${t('sc_cut', 'Wytnij')}</span>
                <span>${formatSc(shortcuts.paste, false)} ${t('sc_paste', 'Wklej')}</span>
                <span>${formatSc(shortcuts.delete, false)} ${t('sc_delete', 'Usuń')}</span>
                <span>${formatSc(shortcuts.newFile, false)} ${t('sc_newFile', 'Nowy plik')}</span>
                <span>${formatSc(shortcuts.newDir, true)} ${t('sc_newDir', 'Nowy folder')}</span>
                <span>${formatSc(shortcuts.terminal, false)} ${t('sc_terminal', 'Terminal')}</span>
                <span>${formatSc(shortcuts.archive, true)} ${t('sc_archive', 'Spakuj')}</span>
                <span>${formatSc(shortcuts.unzip, false)} ${t('sc_unzip', 'Rozpakuj')}</span>
                ${driveShortcutHtml}
                <span>[Enter] ${t('btn_open', 'Otwórz')}</span>
                ${globalShortcuts}
            `;
        } else if (currentMode === 'cloud-browse' || currentMode === 'cloud') {
            scBar.innerHTML = `
                <span>${formatSc(shortcuts.mark, false)} ${t('sc_mark', 'Zaznacz')}</span>
                <span>${formatSc(shortcuts.download, false)} ${t('sc_download', 'Pobierz')}</span>
                <span>${formatSc(shortcuts.delete, false)} ${t('sc_delete', 'Usuń')}</span>
                <span>[Enter] ${t('btn_open', 'Otworz')} (Pobiera do Cache)</span>
                ${globalShortcuts}
            `;
        } else if (currentMode === 'git') {
            scBar.innerHTML = `
                <span>[Tab] Nawiguj po elementach</span>
                <span>[Enter] Skanuj / Szukaj / Wybierz element</span>
                ${globalShortcuts}
            `;
        } else if (currentMode === 'cleaner') {
            let cleanerHtml = `<span>[1 / T] ${t('clean_temp_btn', 'Temp')}</span><span>[2 / C] ${t('clean_cache_btn', 'Cache')}</span>`;
            if (osType === 'windows') {
                cleanerHtml += `<span>[3 / N] ${t('clean_custom_btn', 'Niestandardowe')}</span>`;
            }
            scBar.innerHTML = cleanerHtml + globalShortcuts;
        } else if (currentMode === 'settings') {
            scBar.innerHTML = `
                <span>[Enter] Zapisz skróty / Dodaj folder</span>
                ${globalShortcuts}
            `;
        } else if (currentMode.startsWith('mod-')) {
            scBar.innerHTML = globalShortcuts;
        } else {
            scBar.innerHTML = globalShortcuts;
        }
    }

    async function loadSettingsFromBackend() {
        try {
            const s = await window.go.main.App.GetSettings();
            appScale = s.appScale || 1.0;
            showHidden = s.showHidden || false;
            showExtensions = s.showExtensions !== false;
            foldersFirst = s.foldersFirst !== false;
            isDarkTheme = s.isDarkTheme !== false;
            defaultPath = s.defaultPath || "";
            confirmDelete = s.confirmDelete !== false;
            customTerminal = s.customTerminal || "";
            cacheCleanupDays = s.cacheCleanupDays !== undefined ? s.cacheCleanupDays : 7;
            projectsPath = s.projectsPath || "";
            
            customCleanPaths = s.customCleanPaths || [];
            if (!Array.isArray(customCleanPaths)) customCleanPaths = [];
            
            disabledModules = s.disabledModules || [];
            if (!Array.isArray(disabledModules)) disabledModules = [];
            
            appLang = s.language || "pl";
            if (s.shortcuts) shortcuts = s.shortcuts;

            i18n = await window.go.main.App.GetLanguagePack(appLang) || {};
            customModules = await window.go.main.App.GetCustomModules() || [];
            if (!Array.isArray(customModules)) customModules = [];

            safeTranslateEl('[data-view="local"]', 'view_local', 'Lokalne pliki');
            safeTranslateEl('[data-view="cloud"]', 'view_cloud', 'Google Drive');
            safeTranslateEl('[data-view="git"]', 'view_git', 'Projekty Git');
            safeTranslateEl('[data-view="cleaner"]', 'view_cleaner', 'Oczyszczanie');
            
            safeTranslateEl('#theme-toggle-btn', 'theme_toggle', 'Zmień motyw');
            safeTranslateEl('#alert-ok', 'btn_ok', 'OK');
            safeTranslateEl('#confirm-yes', 'btn_yes', 'Tak');
            safeTranslateEl('#confirm-no', 'btn_no', 'Nie');
            safeTranslateEl('#input-ok', 'btn_ok', 'OK');
            safeTranslateEl('#input-cancel', 'btn_cancel', 'Anuluj');
            safeTranslateEl('#btn-open-file', 'btn_open', 'Otwórz');

            if (!settingsBtn) {
                const navContainer = document.querySelector('.nav-links');
                if (navContainer && !document.querySelector('[data-view="settings"]')) {
                    const li = document.createElement('li');
                    li.dataset.view = 'settings';
                    li.textContent = t('view_settings', 'Ustawienia');
                    navContainer.appendChild(li);
                }
            } else {
                safeTranslateEl('[data-view="settings"]', 'view_settings', 'Ustawienia');
            }

            const setCtx = (id, key, fallback) => {
                const el = document.getElementById(id);
                if (el) el.textContent = t(key, fallback);
            };
            setCtx('cm-new-file', 'cm_new_file', 'Nowy plik');
            setCtx('cm-new-dir', 'cm_new_dir', 'Nowy folder');
            setCtx('cm-copy', 'cm_copy', 'Kopiuj');
            setCtx('cm-cut', 'cm_cut', 'Wytnij');
            setCtx('cm-paste', 'cm_paste', 'Wklej');
            setCtx('cm-delete', 'cm_delete', 'Usuń');

            const navContainer = document.querySelector('.nav-links');
            document.querySelectorAll('.dynamic-nav').forEach(el => el.remove());
            customModules.forEach(mod => {
                if(!disabledModules.includes(mod.id)) {
                    if(!document.querySelector(`[data-view="mod-${mod.id}"]`)) {
                        const li = document.createElement('li');
                        li.className = 'dynamic-nav';
                        li.dataset.view = 'mod-' + mod.id;
                        li.textContent = mod.name;
                        if (navContainer) navContainer.appendChild(li);
                    }
                }
            });

            if (defaultPath !== "" && localDirState === "") {
                localDirState = defaultPath;
            }
            applyTheme();
            document.documentElement.style.setProperty('--app-scale', appScale);
            updateShortcutUI();
        } catch(err) {
            console.error("Błąd ładowania ustawień: ", err);
        }
    }

    async function saveSettings() {
        try {
            await window.go.main.App.SaveSettings({
                appScale: appScale, showHidden: showHidden, showExtensions: showExtensions,
                foldersFirst: foldersFirst, isDarkTheme: isDarkTheme, defaultPath: defaultPath,
                confirmDelete: confirmDelete, customTerminal: customTerminal, cacheCleanupDays: cacheCleanupDays,
                projectsPath: projectsPath, customCleanPaths: customCleanPaths, disabledModules: disabledModules, language: appLang, shortcuts: shortcuts
            });
            updateShortcutUI();
        } catch(err) {}
    }

    function applyTheme() {
        if (isDarkTheme) {
            document.body.classList.add('dark-theme');
            document.body.classList.remove('light-theme');
        } else {
            document.body.classList.add('light-theme');
            document.body.classList.remove('dark-theme');
        }
    }

    await loadSettingsFromBackend();

    try {
        fileAssociations = await window.go.main.App.GetFileAssociations();
        osType = await window.go.main.App.GetOS();
        if (osType === 'windows') {
            const drives = await window.go.main.App.GetDrives();
            if (drives && drives.length > 0 && driveSelector) {
                driveSelector.innerHTML = drives.map(d => `<option value="${d}">${d}</option>`).join('');
                driveSelector.style.display = 'block';
            }
        }
    } catch (e) {}

    if (driveSelector) {
        driveSelector.addEventListener('change', (e) => {
            if (currentMode === 'local') {
                selectedIndex = 0;
                selectedFiles.clear();
                loadRangerView(e.target.value);
            }
        });
        driveSelector.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault();
                e.target.blur();
            }
        });
    }

    if (driveLogoutBtn) {
        driveLogoutBtn.addEventListener('click', async () => {
            try {
                await window.go.main.App.LogoutGoogle();
                driveHistory = ["root"];
                cloudDirState = "root";
                updateView('cloud');
                showAlert(t('alert_logged_out', 'Wylogowano.'));
            } catch (err) {
                showAlert(err);
            }
        });
    }

    function showAlert(message) {
        if (!alertText || !customAlert || !alertOk) return;
        alertText.innerText = message;
        customAlert.style.display = 'flex';
        alertOk.focus();
    }

    if (alertOk) {
        alertOk.addEventListener('click', () => {
            customAlert.style.display = 'none';
        });
    }

    function showInputPrompt(message, type) {
        pendingCreateType = type;
        if (inputText) inputText.textContent = message;
        if (inputField) inputField.value = "";
        
        if (archiveTypeSelect) {
            archiveTypeSelect.style.display = (type === 'archive') ? 'block' : 'none';
        }
        if (inputModal) {
            inputModal.style.display = 'flex';
            if (inputField) inputField.focus();
        }
    }

    function showConfirmPrompt(message) {
        return new Promise((resolve) => {
            if (confirmText) confirmText.textContent = message;
            if (confirmModal) confirmModal.style.display = 'flex';
            if (confirmYes) confirmYes.focus();
            confirmResolve = resolve;
        });
    }

    if (confirmYes) {
        confirmYes.addEventListener('click', () => {
            confirmModal.style.display = 'none';
            if (confirmResolve) confirmResolve(true);
            confirmResolve = null;
        });
    }

    if (confirmNo) {
        confirmNo.addEventListener('click', () => {
            confirmModal.style.display = 'none';
            if (confirmResolve) confirmResolve(false);
            confirmResolve = null;
        });
    }

    if (inputCancel) {
        inputCancel.addEventListener('click', () => {
            inputModal.style.display = 'none';
            if (archiveTypeSelect) archiveTypeSelect.style.display = 'none';
            pendingCreateType = null;
        });
    }

    if (inputOk) {
        inputOk.addEventListener('click', async () => {
            const val = inputField.value.trim();
            if (pendingCreateType === 'clone' && val) {
                inputModal.style.display = 'none';
                pendingCreateType = null;
                showAlert(t('alert_cloning', 'Trwa klonowanie...'));
                try {
                    await window.go.main.App.CloneRemoteRepo(cloneUrlCache, cloneBranchCache, val);
                    showAlert(t('alert_download_success', 'Pobrano pomyślnie.'));
                } catch(err) {
                    showAlert(err);
                }
                return;
            }

            if (val && currentDir && pendingCreateType) {
                try {
                    if (pendingCreateType === 'archive') {
                        const format = archiveTypeSelect.value;
                        const filesToZip = Array.from(selectedFiles);
                        if (filesToZip.length === 0) {
                            const currentF = currentFiles[selectedIndex];
                            if (currentF) filesToZip.push(currentF.path);
                        }
                        await window.go.main.App.CreateArchive(filesToZip, val, format);
                        selectedFiles.clear();
                        showAlert(t('alert_created', 'Utworzono: ') + `${val}.${format}`);
                    } else {
                        const newPath = currentDir + (currentDir.endsWith("\\") || currentDir.endsWith("/") ? "" : (osType === 'windows' ? "\\" : "/")) + val;
                        const isDir = pendingCreateType === 'dir';
                        await window.go.main.App.CreateItem(newPath, isDir);
                    }
                    inputModal.style.display = 'none';
                    if (archiveTypeSelect) archiveTypeSelect.style.display = 'none';
                    pendingCreateType = null;
                    loadRangerView(currentDir);
                } catch (err) {
                    showAlert(err);
                }
            } else {
                inputModal.style.display = 'none';
                if (archiveTypeSelect) archiveTypeSelect.style.display = 'none';
            }
        });
    }

    if (inputField) {
        inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') inputOk.click();
            if (e.key === 'Escape') inputCancel.click();
        });
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            isDarkTheme = !isDarkTheme;
            applyTheme();
            saveSettings();
        });
    }

    const navContainer = document.querySelector('.nav-links');
    if (navContainer) {
        navContainer.addEventListener('click', (e) => {
            const li = e.target.closest('li');
            if (!li) return;
            
            if (currentMode === 'local') localDirState = currentDir;
            if (currentMode === 'cloud-browse') cloudDirState = currentDir;
            selectedFiles.clear();

            document.querySelectorAll('.nav-links li').forEach(nav => nav.classList.remove('active'));
            li.classList.add('active');
            previousMode = currentMode;
            currentMode = li.dataset.view;
            updateView(currentMode);
        });
    }

    function toggleSettingsView() {
        if (currentMode === 'settings') {
            currentMode = previousMode;
            document.querySelectorAll('.nav-links li').forEach(nav => {
                let targetView = currentMode;
                if (currentMode === 'cloud-browse') targetView = 'cloud';
                if (nav.dataset.view === targetView) nav.classList.add('active');
            });
            updateView(currentMode);
        } else {
            if (currentMode === 'local') localDirState = currentDir;
            if (currentMode === 'cloud-browse') cloudDirState = currentDir;
            selectedFiles.clear();

            previousMode = currentMode;
            document.querySelectorAll('.nav-links li').forEach(nav => nav.classList.remove('active'));
            const navSettings = document.querySelector('[data-view="settings"]');
            if (navSettings) navSettings.classList.add('active');

            currentMode = 'settings';
            updateView('settings');
        }
    }

    if (settingsBtn && !settingsBtn.closest('.nav-links')) {
        settingsBtn.addEventListener('click', toggleSettingsView);
    }

    function syncDriveSelector(path) {
        if (osType === 'windows' && currentMode === 'local' && path.length >= 2 && driveSelector) {
            const driveLetter = path.substring(0, 2).toUpperCase() + "\\";
            for (let i = 0; i < driveSelector.options.length; i++) {
                if (driveSelector.options[i].value === driveLetter) {
                    driveSelector.selectedIndex = i;
                    break;
                }
            }
        }
    }

    function sortFiles(files) {
        if (!files) return [];
        return files.sort((a, b) => {
            if (foldersFirst) {
                if (a.isDir && !b.isDir) return -1;
                if (!a.isDir && b.isDir) return 1;
            }
            return a.name.localeCompare(b.name);
        });
    }

    function getDisplayName(file) {
        if (!showExtensions && !file.isDir) {
            const lastDot = file.name.lastIndexOf('.');
            if (lastDot > 0) {
                return file.name.substring(0, lastDot);
            }
        }
        return file.name;
    }

    function updateFileOpenBar(file) {
        if (!fileOpenBar) return;
        if (currentMode === 'local' || currentMode === 'cloud-browse') {
            if (file && !file.isDir) {
                fileOpenBar.style.display = 'flex';
                let ext = "";
                if (file.name.includes('.')) {
                    ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
                }
                if (customAppInput) customAppInput.value = fileAssociations[ext] || "";
            } else {
                fileOpenBar.style.display = 'none';
            }
        } else {
            fileOpenBar.style.display = 'none';
        }
    }

    function highlightSyntax(text, ext) {
        let html = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        if (['.js', '.py', '.cpp', '.c', '.go', '.sh', '.nix', '.tex'].includes(ext)) {
            html = html.replace(/\b(import|export|const|let|var|function|def|class|return|if|else|for|while|package|func|include|int|string|void|bool|echo|begin|end|documentclass|usepackage)\b/g, '<span class="hl-keyword">$1</span>');
            html = html.replace(/(["'`].*?["'`])/g, '<span class="hl-string">$1</span>');
        } else if (ext === '.md') {
            html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>')
                       .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                       .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                       .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
            return `<div class="md-preview">${html}</div>`;
        }
        return html;
    }

    async function loadRangerView(targetPath, previousPathToSelect = null) {
        const renderId = ++rangerRenderId;
        const reqMode = currentMode;
        
        try {
            let state;
            if (reqMode === 'local') {
                state = await window.go.main.App.GetRangerData(targetPath, showHidden);
            } else if (reqMode === 'cloud-browse') {
                state = await window.go.main.App.GetDriveData(targetPath);
            } else {
                return;
            }
            
            if (renderId !== rangerRenderId || currentMode !== reqMode) return;
            
            currentDir = state.currentPath;
            parentDir = state.parentPath;
            currentFiles = sortFiles(state.files || []);
            
            if (previousPathToSelect) {
                selectedIndex = currentFiles.findIndex(f => f.path === previousPathToSelect || f.id === previousPathToSelect);
                if (selectedIndex === -1) selectedIndex = 0;
            } else {
                if (selectedIndex >= currentFiles.length) selectedIndex = 0;
            }
            
            syncDriveSelector(currentDir);

            let parentState = { files: [] };
            if (reqMode === 'local' && parentDir !== "") {
                parentState = await window.go.main.App.GetRangerData(parentDir, showHidden);
                parentState.files = sortFiles(parentState.files);
            } else if (reqMode === 'cloud-browse' && driveHistory.length > 1) {
                const parentId = driveHistory[driveHistory.length - 2];
                parentState = await window.go.main.App.GetDriveData(parentId);
                parentState.files = sortFiles(parentState.files);
            }

            if (renderId !== rangerRenderId || currentMode !== reqMode) return;
            renderRangerColumns(parentState.files, currentFiles);
            
        } catch (err) {
            if (renderId === rangerRenderId && currentMode === reqMode && fileArea) {
                fileArea.innerHTML = `<div class="standard-view">${t('alert_no_access', 'Błąd')}: ${err}</div>`;
            }
        }
    }

    function renderRangerColumns(parentFilesList, currentFilesList) {
        if (!fileArea) return;
        let html = `<div class="ranger-container">`;
        
        html += `<div class="ranger-col" id="parent-col">`;
        if (parentFilesList) {
            html += parentFilesList.map((f, idx) => {
                const isSelected = f.path === currentDir || f.id === currentDir ? "selected" : "";
                const typeClass = f.isDir ? "dir" : "file";
                return `<div class="ranger-item ${typeClass} ${isSelected}" data-idx="${idx}">${getDisplayName(f)}</div>`;
            }).join('');
        }
        html += `</div>`;

        html += `<div class="ranger-col" id="current-col">`;
        html += currentFilesList.map((f, idx) => {
            const isSelected = idx === selectedIndex ? "selected" : "";
            const isMarked = selectedFiles.has(f.path) || selectedFiles.has(f.id) ? "marked" : "";
            const typeClass = f.isDir ? "dir" : "file";
            return `<div class="ranger-item ${typeClass} ${isSelected} ${isMarked}" data-idx="${idx}">${getDisplayName(f)}</div>`;
        }).join('');
        html += `</div>`;

        html += `<div class="ranger-col" id="preview-col"></div>`;
        html += `</div>`;
        
        fileArea.innerHTML = html;
        if (viewTitle) viewTitle.textContent = currentMode === 'local' && osType === 'windows' ? currentDir.substring(2) || "\\" : currentDir;

        const currentCol = document.getElementById('current-col');
        if (currentCol && currentCol.children[selectedIndex]) {
            currentCol.children[selectedIndex].scrollIntoView({ block: 'nearest' });
        }

        document.querySelectorAll('#parent-col .ranger-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.idx);
                const clickedFile = parentFilesList[idx];
                selectedFiles.clear();
                handleBackNavigation(currentMode === 'local' ? clickedFile.path : clickedFile.id);
            });
        });

        document.querySelectorAll('#current-col .ranger-item').forEach(item => {
            item.addEventListener('click', (e) => {
                selectedIndex = parseInt(e.currentTarget.dataset.idx);
                renderRangerColumns(parentFilesList, currentFilesList);
            });
            item.addEventListener('dblclick', (e) => {
                const idx = parseInt(e.currentTarget.dataset.idx);
                if (currentFilesList[idx].isDir) {
                    selectedFiles.clear();
                    handleForwardNavigation(currentFilesList[idx]);
                } else {
                    if(currentMode === 'local') handleFileOpen(currentFilesList[idx]);
                    else handleCloudOpen(currentFilesList[idx]);
                }
            });
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                selectedIndex = parseInt(e.currentTarget.dataset.idx);
                renderRangerColumns(parentFilesList, currentFilesList);
                showContextMenu(e.pageX, e.pageY);
            });
        });

        loadPreview(currentFilesList[selectedIndex]);
        updateFileOpenBar(currentFilesList[selectedIndex]);
    }

    async function loadPreview(file) {
        const previewCol = document.getElementById('preview-col');
        if (!previewCol) return;
        if (!file) {
            previewCol.innerHTML = "";
            return;
        }
        if (file.isDir) {
            try {
                let state;
                if (currentMode === 'local') {
                    state = await window.go.main.App.GetRangerData(file.path, showHidden);
                } else {
                    state = await window.go.main.App.GetDriveData(file.path);
                }
                
                const sortedFiles = sortFiles(state.files || []);
                
                previewCol.innerHTML = sortedFiles.map((f, idx) => {
                    const typeClass = f.isDir ? "dir" : "file";
                    return `<div class="ranger-item ${typeClass}" data-idx="${idx}">${getDisplayName(f)}</div>`;
                }).join('');

                document.querySelectorAll('#preview-col .ranger-item').forEach(item => {
                    item.addEventListener('click', (e) => {
                        const idx = parseInt(e.currentTarget.dataset.idx);
                        const clickedFile = sortedFiles[idx];
                        selectedFiles.clear();
                        handleForwardNavigation(file, currentMode === 'local' ? clickedFile.path : clickedFile.id);
                    });
                });
            } catch (err) {
                previewCol.innerHTML = `<div class="preview-box">${t('alert_no_access', 'Brak dostępu')}</div>`;
            }
        } else {
            if (currentMode === 'local') {
                try {
                    const stats = await window.go.main.App.GetFileInfo(file.path);
                    let sizeStr = "";
                    if (stats) {
                        sizeStr = (stats.size / 1024).toFixed(2) + " KB";
                        if (stats.size > 1024 * 1024) sizeStr = (stats.size / (1024 * 1024)).toFixed(2) + " MB";
                    }

                    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
                    const text = await window.go.main.App.ReadFilePreview(file.path);
                    
                    let htmlContent = `<div class="file-info-header">`;
                    if (stats) htmlContent += `<strong>${t('txt_size', 'Rozmiar:')}</strong> ${sizeStr} | <strong>${t('txt_mod', 'Modyfikacja:')}</strong> ${stats.modTime} | <strong>${t('txt_perm', 'Uprawnienia:')}</strong> ${stats.mode}`;
                    htmlContent += `</div><div class="preview-box">${highlightSyntax(text, ext)}</div>`;
                    
                    previewCol.innerHTML = htmlContent;
                } catch (err) {
                    previewCol.innerHTML = `<div class="preview-box">${t('alert_no_preview', 'Brak podglądu')}</div>`;
                }
            } else {
                previewCol.innerHTML = `<div class="preview-box">${t('txt_preview_remote', 'Podgląd zdalny (naciśnij Enter aby pobrać/otworzyć)')}</div>`;
            }
        }
    }

    function showContextMenu(x, y) {
        if (!contextMenu) return;
        contextMenu.style.display = 'block';
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
    }

    document.addEventListener('click', () => {
        if (contextMenu) contextMenu.style.display = 'none';
    });

    document.getElementById('cm-new-file')?.addEventListener('click', () => {
        if (currentMode !== 'local') return showAlert(t('alert_local_only', 'Tylko lokalnie.'));
        showInputPrompt(t('prompt_new_file', 'Podaj nazwę nowego pliku:'), "file");
    });
    document.getElementById('cm-new-dir')?.addEventListener('click', () => {
        if (currentMode !== 'local') return showAlert(t('alert_local_only', 'Tylko lokalnie.'));
        showInputPrompt(t('prompt_new_dir', 'Podaj nazwę nowego folderu:'), "dir");
    });
    document.getElementById('cm-copy')?.addEventListener('click', () => {
        handleAction('copy');
        if (contextMenu) contextMenu.style.display = 'none';
    });
    document.getElementById('cm-cut')?.addEventListener('click', () => {
        handleAction('cut');
        if (contextMenu) contextMenu.style.display = 'none';
    });
    document.getElementById('cm-paste')?.addEventListener('click', () => {
        handleAction('paste');
        if (contextMenu) contextMenu.style.display = 'none';
    });
    document.getElementById('cm-delete')?.addEventListener('click', () => {
        handleAction('delete');
        if (contextMenu) contextMenu.style.display = 'none';
    });

    async function handleAction(action) {
        let targetFiles = Array.from(selectedFiles);
        if (targetFiles.length === 0) {
            const file = currentFiles[selectedIndex];
            if (file) targetFiles.push(currentMode === 'local' ? file.path : file.id);
        }
        if (targetFiles.length === 0 && action !== 'paste') return;
        
        try {
            if (action === 'copy' || action === 'cut') {
                if (currentMode !== 'local') return showAlert(t('alert_local_only', 'Tylko lokalnie.'));
                clipboardFiles = targetFiles;
                clipboardAction = action;
                showAlert(t('alert_saved', 'Zapisano.'));
                selectedFiles.clear();
                loadRangerView(currentDir);
            } else if (action === 'paste') {
                if (currentMode !== 'local') return showAlert(t('alert_local_only', 'Tylko lokalnie.'));
                if (clipboardFiles.length > 0 && clipboardAction) {
                    await window.go.main.App.FileAction(clipboardAction, clipboardFiles, currentDir);
                    if (clipboardAction === 'cut') {
                        clipboardFiles = [];
                        clipboardAction = null;
                    }
                    selectedFiles.clear();
                    loadRangerView(currentDir);
                } else {
                    showAlert(t('alert_clipboard_empty', 'Schowek pusty.'));
                }
            } else if (action === 'delete') {
                if (confirmDelete) {
                    const isConfirmed = await showConfirmPrompt(t('confirm_delete', 'Usunąć?'));
                    if (!isConfirmed) return;
                }
                
                if (currentMode === 'local') {
                    await window.go.main.App.FileAction('delete', targetFiles, "");
                } else if (currentMode === 'cloud-browse') {
                    for (let id of targetFiles) {
                        await window.go.main.App.DeleteDriveFile(id);
                    }
                }
                selectedFiles.clear();
                loadRangerView(currentDir);
            }
        } catch (err) {
            showAlert(err);
        }
    }

    async function handleCloudDownload() {
        let targetFiles = Array.from(selectedFiles);
        if (targetFiles.length === 0) {
            const file = currentFiles[selectedIndex];
            if (file && !file.isDir) targetFiles.push(file.id);
        }
        if (targetFiles.length === 0) return;

        try {
            showAlert(t('alert_downloading', 'Pobieranie...'));
            for (let id of targetFiles) {
                const fileObj = currentFiles.find(f => f.id === id);
                let name = fileObj ? fileObj.name : "pobrany_plik";
                await window.go.main.App.DownloadFromDrive(id, name, "DOWNLOADS");
            }
            showAlert(t('alert_download_done', 'Zakończono.'));
            selectedFiles.clear();
            loadRangerView(currentDir);
        } catch(err) {
            showAlert(err);
        }
    }

    function handleForwardNavigation(file, pathToSelect = null) {
        if (file && file.isDir) {
            if (currentMode === 'cloud-browse') driveHistory.push(file.id);
            selectedFiles.clear();
            loadRangerView(currentMode === 'local' ? file.path : file.id, pathToSelect);
        }
    }

    function handleBackNavigation(pathToSelect = null) {
        if (currentMode === 'local' && parentDir !== "") {
            selectedFiles.clear();
            loadRangerView(parentDir, pathToSelect || currentDir);
        } else if (currentMode === 'cloud-browse' && driveHistory.length > 1) {
            const oldId = driveHistory.pop();
            const newTarget = driveHistory[driveHistory.length - 1];
            selectedFiles.clear();
            loadRangerView(newTarget, pathToSelect || oldId);
        }
    }

    async function handleFileOpen(file) {
        if (currentMode !== 'local') return;
        let appName = "";
        if (customAppInput) appName = customAppInput.value.trim();
        try {
            await window.go.main.App.OpenFileCustom(file.path, appName);
        } catch (err) {
            showAlert(err);
        }
    }

    async function handleCloudOpen(file) {
        try {
            showAlert(t('alert_downloading_cache', 'Pobieranie do cache...'));
            const downloadedPath = await window.go.main.App.DownloadFromDrive(file.id, file.name, "CACHE");
            if (customAlert) customAlert.style.display = 'none';
            let appName = "";
            if (customAppInput) appName = customAppInput.value.trim();
            await window.go.main.App.OpenFileCustom(downloadedPath, appName);
        } catch (err) {
            showAlert(err);
        }
    }

    if (btnOpenFile) {
        btnOpenFile.addEventListener('click', () => {
            const file = currentFiles[selectedIndex];
            if (file && !file.isDir) {
                if (currentMode === 'local') handleFileOpen(file);
                else handleCloudOpen(file);
            }
        });
    }

    window.addEventListener('keydown', async (e) => {
        if (customAlert && customAlert.style.display === 'flex') {
            if (e.key === 'Enter' || e.key === 'Escape') customAlert.style.display = 'none';
            return;
        }
        if (inputModal && inputModal.style.display === 'flex') return; 
        if (confirmModal && confirmModal.style.display === 'flex') {
            if (e.key === 'Escape') confirmNo.click();
            return;
        }

        if (e.ctrlKey && !e.shiftKey && !e.altKey) {
            if (e.key === '1') { e.preventDefault(); document.querySelector('[data-view="local"]')?.click(); return; }
            if (e.key === '2') { e.preventDefault(); document.querySelector('[data-view="cloud"]')?.click(); return; }
            if (e.key === '3') { e.preventDefault(); document.querySelector('[data-view="git"]')?.click(); return; }
            if (e.key === '4') { e.preventDefault(); document.querySelector('[data-view="cleaner"]')?.click(); return; }
            
            const settingsSc = (shortcuts.settings || ',').toLowerCase();
            if (e.key.toLowerCase() === settingsSc) {
                e.preventDefault(); 
                toggleSettingsView();
                return;
            }
        } else if (!e.ctrlKey && !e.altKey) {
            let modTriggered = false;
            for (let mod of customModules) {
                if (!disabledModules.includes(mod.id)) {
                    let sc = shortcuts['mod-' + mod.id];
                    if (sc && e.key.toLowerCase() === sc.toLowerCase()) {
                        e.preventDefault();
                        const navMod = document.querySelector(`[data-view="mod-${mod.id}"]`);
                        if (navMod) navMod.click();
                        modTriggered = true;
                        break;
                    }
                }
            }
            if (modTriggered) return;
        }

        if (e.key === 'Escape') {
            if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT')) {
                document.activeElement.blur();
                return;
            }
        }

        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') {
            if (e.key === 'Enter') {
                if (document.activeElement.id === 'g-client-secret') {
                    document.getElementById('auth-btn')?.click();
                } else if (document.activeElement.id === 'git-path-input') {
                    document.getElementById('git-scan-btn')?.click();
                } else if (document.activeElement.id === 'git-search-input') {
                    document.getElementById('git-search-btn')?.click();
                } else if (document.activeElement.id === 'settings-add-custom-path' && osType === 'windows') {
                    document.getElementById('settings-btn-add-custom-path')?.click();
                }
            }
            return;
        }

        if (currentMode === 'cleaner') {
            if (osType === 'windows' && (e.key === '1' || e.key.toLowerCase() === 't')) {
                e.preventDefault();
                document.getElementById('clean-btn')?.click();
                return;
            }
            if (e.key === '2' || e.key.toLowerCase() === 'c') {
                e.preventDefault();
                document.getElementById('clean-cache-btn')?.click();
                return;
            }
            if (osType === 'windows' && (e.key === '3' || e.key.toLowerCase() === 'n')) {
                e.preventDefault();
                document.getElementById('clean-custom-btn')?.click();
                return;
            }
        }
        
        if (currentMode !== 'local' && currentMode !== 'cloud-browse') {
            return;
        }

        if (osType === 'windows' && e.key.toLowerCase() === (shortcuts.switchDrive || 'w').toLowerCase() && !e.ctrlKey) {
            e.preventDefault();
            const ds = document.getElementById('drive-selector');
            if (ds && ds.style.display !== 'none') {
                ds.focus();
            }
            return;
        }
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (selectedIndex < currentFiles.length - 1) {
                selectedIndex++;
                loadRangerView(currentDir);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (selectedIndex > 0) {
                selectedIndex--;
                loadRangerView(currentDir);
            }
        } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const file = currentFiles[selectedIndex];
            if (file && file.isDir) {
                handleForwardNavigation(file);
            } else if (file && !file.isDir) {
                if (currentMode === 'local') handleFileOpen(file);
                else handleCloudOpen(file);
            }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            const file = currentFiles[selectedIndex];
            if (file && file.isDir) {
                handleForwardNavigation(file);
            }
        } else if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
            e.preventDefault();
            handleBackNavigation();
        } else if (e.key.toLowerCase() === (shortcuts.mark || 'z').toLowerCase() && !e.ctrlKey) {
            e.preventDefault();
            const file = currentFiles[selectedIndex];
            if (file) {
                const targetKey = currentMode === 'local' ? file.path : file.id;
                if (selectedFiles.has(targetKey)) {
                    selectedFiles.delete(targetKey);
                } else {
                    selectedFiles.add(targetKey);
                }
                if (selectedIndex < currentFiles.length - 1) selectedIndex++;
                loadRangerView(currentDir);
            }
        } else if (e.key.toLowerCase() === (shortcuts.copy || 'c').toLowerCase() && !e.ctrlKey) {
            e.preventDefault(); handleAction('copy');
        } else if (e.key.toLowerCase() === (shortcuts.cut || 'x').toLowerCase() && !e.ctrlKey) {
            e.preventDefault(); handleAction('cut');
        } else if (e.key.toLowerCase() === (shortcuts.paste || 'v').toLowerCase() && !e.ctrlKey) {
            e.preventDefault(); handleAction('paste');
        } else if (e.key === (shortcuts.delete || 'Delete')) {
            e.preventDefault(); handleAction('delete');
        } else if (e.key.toLowerCase() === (shortcuts.newFile || 'n').toLowerCase() && !e.shiftKey) {
            e.preventDefault();
            if (currentMode === 'local') showInputPrompt(t('prompt_new_file', "Podaj nazwę nowego pliku:"), "file");
        } else if (e.key.toLowerCase() === (shortcuts.newDir || 'n').toLowerCase() && e.shiftKey) {
            e.preventDefault();
            if (currentMode === 'local') showInputPrompt(t('prompt_new_dir', "Podaj nazwę nowego folderu:"), "dir");
        } else if (e.key.toLowerCase() === (shortcuts.terminal || 't').toLowerCase() && currentMode === 'local' && currentDir) {
            e.preventDefault();
            await window.go.main.App.OpenTerminal(currentDir, customTerminal);
        } else if (e.key.toLowerCase() === (shortcuts.archive || 'p').toLowerCase() && e.shiftKey && currentMode === 'local') {
            e.preventDefault();
            if (selectedFiles.size === 0 && currentFiles[selectedIndex]) {
                selectedFiles.add(currentFiles[selectedIndex].path);
            }
            if (selectedFiles.size > 0) {
                showInputPrompt(t('prompt_archive_name', "Podaj nazwę archiwum (bez rozszerzenia):"), "archive");
            }
        } else if (e.key.toLowerCase() === (shortcuts.unzip || 'u').toLowerCase() && currentMode === 'local') {
            e.preventDefault();
            const file = currentFiles[selectedIndex];
            if (file && !file.isDir && (file.path.endsWith('.zip') || file.path.endsWith('.tar') || file.path.endsWith('.rar'))) {
                try {
                    await window.go.main.App.UnzipItem(file.path);
                    loadRangerView(currentDir);
                } catch(err) { showAlert(err); }
            }
        } else if (e.key.toLowerCase() === (shortcuts.download || 's').toLowerCase() && !e.ctrlKey) {
            e.preventDefault();
            if (currentMode === 'cloud-browse') handleCloudDownload();
        } else if (e.key.toLowerCase() === (shortcuts.dualPane || 'd').toLowerCase()) {
            e.preventDefault();
            showAlert("Opcja wkrotce.");
        }
    });

    async function updateView(view) {
        if (!fileArea) return;

        if (view.startsWith('mod-')) {
            const modId = view.substring(4);
            const mod = customModules.find(m => m.id === modId);
            if (mod) {
                if (fileOpenBar) fileOpenBar.style.display = 'none';
                if (viewTitle) viewTitle.textContent = mod.name;
                fileArea.innerHTML = `<div class="standard-view" style="width: 100%; height: 100%; box-sizing: border-box; padding: 20px;">${mod.html}</div>`;
                if (mod.js && !mod.jsExecuted) {
                    try {
                        const script = document.createElement('script');
                        script.textContent = `(function(){\n${mod.js}\n})();`;
                        document.body.appendChild(script);
                        mod.jsExecuted = true;
                    } catch(e) {}
                }
                updateShortcutUI();
            }
            return;
        }

        if (osType === 'windows' && driveSelector) {
            driveSelector.style.display = view === 'local' ? 'block' : 'none';
        }
        if (driveLogoutBtn) {
            driveLogoutBtn.style.display = (view === 'cloud-browse') ? 'inline-block' : 'none';
        }
        
        updateShortcutUI();

        switch(view) {
            case 'local':
                if (localDirState === "") {
                    await loadRangerView("");
                } else {
                    await loadRangerView(localDirState);
                }
                break;
            case 'cloud':
                if (fileOpenBar) fileOpenBar.style.display = 'none';
                try {
                    const isAuth = await window.go.main.App.IsDriveAuthenticated();
                    if (isAuth) {
                        currentMode = 'cloud-browse';
                        updateShortcutUI();
                        if (driveLogoutBtn) driveLogoutBtn.style.display = 'inline-block';
                        if (driveHistory.length === 0) driveHistory = ["root"];
                        await loadRangerView(cloudDirState);
                        break;
                    }
                } catch (e) {}

                if (viewTitle) viewTitle.textContent = t('view_cloud', 'Google Drive');
                fileArea.innerHTML = `
                    <div class="standard-view">
                        <h3>${t('cloud_config', 'Konfiguracja')}</h3>
                        <input type="text" id="g-client-id" class="input-field" placeholder="${t('cloud_client_id', 'Client ID')}">
                        <input type="password" id="g-client-secret" class="input-field" placeholder="${t('cloud_client_secret', 'Client Secret')}">
                        <button class="btn primary" id="auth-btn">${t('cloud_login_btn', 'Zaloguj')}</button>
                    </div>
                `;
                setTimeout(() => {
                    document.getElementById('g-client-id')?.focus();
                    document.getElementById('auth-btn')?.addEventListener('click', async () => {
                        const clientId = document.getElementById('g-client-id').value;
                        const clientSecret = document.getElementById('g-client-secret').value;
                        try {
                            await window.go.main.App.LoginGoogle(clientId, clientSecret);
                            currentMode = 'cloud-browse';
                            updateShortcutUI();
                            if (driveLogoutBtn) driveLogoutBtn.style.display = 'inline-block';
                            driveHistory = ["root"];
                            cloudDirState = "root";
                            await loadRangerView(cloudDirState);
                        } catch (err) {
                            showAlert(err);
                        }
                    });
                }, 0);
                break;
            case 'cloud-browse':
                if (fileOpenBar) fileOpenBar.style.display = 'none';
                if (driveHistory.length === 0) driveHistory = ["root"];
                await loadRangerView(cloudDirState);
                break;
            case 'git':
                if (fileOpenBar) fileOpenBar.style.display = 'none';
                if (viewTitle) viewTitle.textContent = t('view_git', 'Projekty Git');
                
                let isGit = false;
                try {
                    isGit = await window.go.main.App.IsGitInstalled();
                } catch(e) {}

                if (!isGit) {
                    fileArea.innerHTML = `
                        <div class="standard-view" style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; box-sizing: border-box;">
                            <h2 style="color: #ff5555; margin-top: 0;">${t('git_no_git_title', 'Brak zainstalowanego Git')}</h2>
                            <p style="opacity: 0.8; max-width: 400px; margin-bottom: 20px;">${t('git_no_git_desc', 'Moduł wymaga zainstalowanego w systemie narzędzia Git (dodanego do PATH).')}</p>
                            <button class="btn primary" id="git-download-btn">${t('git_download_btn', 'Pobierz Git z oficjalnej strony')}</button>
                        </div>
                    `;
                    setTimeout(() => {
                        document.getElementById('git-download-btn')?.addEventListener('click', async () => {
                            try {
                                await window.go.main.App.OpenFileCustom("https://git-scm.com/downloads", "");
                            } catch(err) {
                                showAlert(err);
                            }
                        });
                    }, 0);
                    break;
                }

                fileArea.innerHTML = `
                    <div class="standard-view" style="width: 100%; height: 100%; box-sizing: border-box; padding: clamp(20px, 3vw, 40px); display: flex; gap: 20px;">
                        <div style="flex: 1; border-right: 1px solid var(--border); padding-right: 20px; overflow-y: auto; min-width: 0;">
                            <h3 style="margin-top:0; color: var(--accent);">${t('git_local_repos', 'Lokalne Repozytoria')}</h3>
                            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                                <input type="text" id="git-path-input" class="input-field" style="margin-bottom: 0;" placeholder="${t('git_path_placeholder', 'Ścieżka')}" value="${projectsPath}">
                                <button class="btn primary" id="git-scan-btn">${t('git_scan_btn', 'Skanuj')}</button>
                            </div>
                            <div id="git-local-results" style="display: flex; flex-direction: column; gap: 5px;"></div>

                            <h3 style="margin-top: 20px; color: var(--accent);">${t('git_search_github', 'Wyszukaj na GitHub')}</h3>
                            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                                <input type="text" id="git-search-input" class="input-field" style="margin-bottom: 0;" placeholder="${t('git_search_placeholder', 'Nazwa repo lub użytkownika...')}">
                                <button class="btn primary" id="git-search-btn">${t('git_search_btn', 'Szukaj')}</button>
                            </div>
                            <div id="git-remote-results" style="display: flex; flex-direction: column; gap: 5px;"></div>
                        </div>
                        <div style="flex: 1; overflow-y: auto; min-width: 0;" id="git-details-panel">
                            <div style="color: var(--text-main); opacity: 0.7;">${t('git_select_left', 'Wybierz repozytorium z lewej strony...')}</div>
                        </div>
                    </div>
                `;
                setTimeout(() => {
                    document.getElementById('git-path-input')?.focus();
                    const scanBtn = document.getElementById('git-scan-btn');
                    const localResDiv = document.getElementById('git-local-results');
                    const pathInput = document.getElementById('git-path-input');
                    const searchBtn = document.getElementById('git-search-btn');
                    const searchInput = document.getElementById('git-search-input');
                    const remoteResDiv = document.getElementById('git-remote-results');
                    const detailsPanel = document.getElementById('git-details-panel');

                    scanBtn?.addEventListener('click', async () => {
                        scanBtn.disabled = true;
                        localResDiv.innerHTML = `<span style="color: var(--accent);">${t('git_scanning', 'Skanowanie...')}</span>`;
                        projectsPath = pathInput.value.trim();
                        saveSettings();

                        try {
                            const repos = await window.go.main.App.ScanGitRepos(projectsPath);
                            localResDiv.innerHTML = "";
                            if (!repos || repos.length === 0) {
                                localResDiv.innerHTML = `<span>${t('git_no_results', 'Brak wyników.')}</span>`;
                            } else {
                                repos.forEach(repo => {
                                    const d = document.createElement('div');
                                    d.tabIndex = 0;
                                    d.style.cssText = "padding: 12px; border: 1px solid var(--border); background: var(--bg-panel); border-left: 4px solid var(--accent); cursor: pointer; display: flex; justify-content: space-between; align-items: center;";
                                    d.addEventListener('focus', () => d.style.borderColor = 'var(--accent)');
                                    d.addEventListener('blur', () => d.style.borderColor = 'var(--border)');
                                    
                                    const statusColor = repo.status === "czyste" ? "var(--dir-color)" : "#ff79c6";
                                    
                                    d.innerHTML = `
                                        <div style="flex: 1; min-width: 0;">
                                            <div class="text-ellipsis" style="font-weight: bold; font-size: 1.1em; color: var(--text-main);">${repo.name}</div>
                                            <div class="text-ellipsis" style="font-size: 0.85em; opacity: 0.7; margin-top: 4px;">${repo.path}</div>
                                        </div>
                                        <div style="flex-shrink: 0; text-align: right;">
                                            <div style="font-weight: bold; margin-bottom: 4px;">[${repo.branch}]</div>
                                            <div style="color: ${statusColor}; font-size: 0.9em;">${repo.status}</div>
                                        </div>
                                    `;
                                    const action = async () => {
                                        detailsPanel.innerHTML = `<span style="color: var(--accent);">${t('git_loading_details', 'Wczytywanie szczegółów...')}</span>`;
                                        try {
                                            const branches = await window.go.main.App.GetLocalGitBranches(repo.path);
                                            const commits = await window.go.main.App.GetGitHistory(repo.path);
                                            
                                            detailsPanel.innerHTML = `<h3 class="text-ellipsis" style="margin-top:0;">${t('git_details', 'Szczegóły: ')}${repo.name}</h3>`;
                                            
                                            const branchHeader = document.createElement('h4');
                                            branchHeader.style.color = "var(--accent)";
                                            branchHeader.style.margin = "0 0 10px 0";
                                            branchHeader.textContent = t('git_branches', 'Gałęzie (Branches):');
                                            detailsPanel.appendChild(branchHeader);
                                            
                                            const branchContainer = document.createElement('div');
                                            branchContainer.style.cssText = "display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;";
                                            if(branches && branches.length > 0) {
                                                branches.forEach(b => {
                                                    const isCurrent = b === repo.branch;
                                                    const btn = document.createElement('button');
                                                    btn.className = isCurrent ? "btn primary" : "btn";
                                                    btn.style.padding = "4px 8px";
                                                    btn.textContent = b;
                                                    if(!isCurrent) {
                                                        btn.addEventListener('click', async () => {
                                                            const ok = await showConfirmPrompt(`${t('git_checkout_branch', 'Przełączyć na gałąź: ')}${b}?`);
                                                            if(ok) {
                                                                try {
                                                                    await window.go.main.App.CheckoutGitCommit(repo.path, b);
                                                                    showAlert(t('git_branch_changed', 'Zmieniono gałąź.'));
                                                                    scanBtn.click();
                                                                } catch(err) {
                                                                    showAlert(err);
                                                                }
                                                            }
                                                        });
                                                    }
                                                    branchContainer.appendChild(btn);
                                                });
                                            } else {
                                                branchContainer.innerHTML = `<span style='opacity: 0.5;'>${t('git_no_other_branches', 'Brak innych gałęzi.')}</span>`;
                                            }
                                            detailsPanel.appendChild(branchContainer);

                                            const commitHeader = document.createElement('h4');
                                            commitHeader.style.color = "var(--accent)";
                                            commitHeader.style.margin = "0 0 10px 0";
                                            commitHeader.textContent = t('git_history', 'Historia commitów:');
                                            detailsPanel.appendChild(commitHeader);
                                            
                                            if(!commits || commits.length === 0) {
                                                const noCommits = document.createElement('div');
                                                noCommits.textContent = t('git_no_commits', 'Brak commitów.');
                                                detailsPanel.appendChild(noCommits);
                                            } else {
                                                commits.forEach(c => {
                                                    const cd = document.createElement('div');
                                                    cd.tabIndex = 0;
                                                    cd.style.cssText = "padding: 8px; border-bottom: 1px solid var(--border); cursor: pointer; display: flex; flex-direction: column; outline: none; border: 1px solid transparent;";
                                                    cd.addEventListener('focus', () => cd.style.borderColor = 'var(--accent)');
                                                    cd.addEventListener('blur', () => cd.style.borderColor = 'transparent');
                                                    
                                                    cd.innerHTML = `
                                                        <div class="text-ellipsis" style="width: 100%;">
                                                            <span style="color: var(--accent);">${c.hash}</span> - ${c.message}
                                                        </div>
                                                        <div style="opacity:0.5; font-size: 0.8em; margin-top: 4px;">(${c.date})</div>
                                                    `;
                                                    const commitAction = async () => {
                                                        const ok = await showConfirmPrompt(`${t('git_checkout_commit', 'Przywrócić (checkout) do: ')}${c.hash}?`);
                                                        if(ok) {
                                                            try {
                                                                await window.go.main.App.CheckoutGitCommit(repo.path, c.hash);
                                                                showAlert(t('git_version_changed', 'Zmieniono wersję.'));
                                                                scanBtn.click();
                                                            } catch(err) {
                                                                showAlert(err);
                                                            }
                                                        }
                                                    };
                                                    cd.addEventListener('click', commitAction);
                                                    cd.addEventListener('keydown', (e) => {
                                                        if(e.key === 'Enter') {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            commitAction();
                                                        }
                                                    });
                                                    detailsPanel.appendChild(cd);
                                                });
                                            }
                                        } catch(err) {
                                            detailsPanel.innerHTML = `${t('alert_no_access', 'Błąd')}: ${err}`;
                                        }
                                    };
                                    d.addEventListener('click', action);
                                    d.addEventListener('keydown', (e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            action();
                                        }
                                    });
                                    localResDiv.appendChild(d);
                                });
                            }
                        } catch(err) {
                            localResDiv.innerHTML = `${t('alert_no_access', 'Błąd')}: ${err}`;
                        }
                        scanBtn.disabled = false;
                    });

                    searchBtn?.addEventListener('click', async () => {
                        searchBtn.disabled = true;
                        remoteResDiv.innerHTML = `<span style="color: var(--accent);">${t('git_searching', 'Szukanie...')}</span>`;
                        try {
                            const repos = await window.go.main.App.SearchGitHub(searchInput.value.trim());
                            remoteResDiv.innerHTML = "";
                            if (!repos || repos.length === 0) {
                                remoteResDiv.innerHTML = `<span>${t('git_no_results', 'Brak wyników.')}</span>`;
                            } else {
                                repos.forEach(repo => {
                                    const d = document.createElement('div');
                                    d.tabIndex = 0;
                                    d.style.cssText = "padding: 8px; border: 1px solid var(--border); background: var(--bg-panel); cursor: pointer; display: flex; flex-direction: column; outline: none;";
                                    d.addEventListener('focus', () => d.style.borderColor = 'var(--accent)');
                                    d.addEventListener('blur', () => d.style.borderColor = 'var(--border)');
                                    
                                    d.innerHTML = `
                                        <div class="text-ellipsis" style="font-weight: bold; color: var(--text-main);">${repo.fullName}</div>
                                        <div class="text-ellipsis" style="font-size: 0.85em; opacity: 0.7; margin-top: 4px;">${repo.description || 'Brak opisu'}</div>
                                    `;
                                    const action = async () => {
                                        detailsPanel.innerHTML = `<span style="color: var(--accent);">${t('git_loading_versions', 'Wczytywanie wersji...')}</span>`;
                                        try {
                                            const branches = await window.go.main.App.GetGitHubBranches(repo.fullName);
                                            detailsPanel.innerHTML = `<h3 class="text-ellipsis" style="margin-top:0;">${t('git_download', 'Pobierz: ')}${repo.name}</h3>`;
                                            if(!branches) {
                                                detailsPanel.innerHTML += t('git_no_branches', 'Brak gałęzi.');
                                                return;
                                            }
                                            branches.forEach(b => {
                                                const cd = document.createElement('div');
                                                cd.tabIndex = 0;
                                                cd.style.cssText = "padding: 8px; border-bottom: 1px solid var(--border); cursor: pointer; outline: none; border: 1px solid transparent;";
                                                cd.addEventListener('focus', () => cd.style.borderColor = 'var(--accent)');
                                                cd.addEventListener('blur', () => cd.style.borderColor = 'transparent');
                                                
                                                cd.innerHTML = `${t('git_branch', 'Gałąź: ')}<span style="color: var(--accent); font-weight: bold;">${b}</span>`;
                                                const cloneAction = () => {
                                                    cloneUrlCache = repo.cloneUrl;
                                                    cloneBranchCache = b;
                                                    showInputPrompt(t('git_prompt_clone', 'Podaj lokalny folder docelowy dla pobrania:'), 'clone');
                                                };
                                                cd.addEventListener('click', cloneAction);
                                                cd.addEventListener('keydown', (e) => {
                                                    if(e.key === 'Enter') {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        cloneAction();
                                                    }
                                                });
                                                detailsPanel.appendChild(cd);
                                            });
                                        } catch(err) {
                                            detailsPanel.innerHTML = `${t('alert_no_access', 'Błąd')}: ${err}`;
                                        }
                                    };
                                    d.addEventListener('click', action);
                                    d.addEventListener('keydown', (e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            action();
                                        }
                                    });
                                    remoteResDiv.appendChild(d);
                                });
                            }
                        } catch(err) {
                            remoteResDiv.innerHTML = `${t('alert_no_access', 'Błąd')}: ${err}`;
                        }
                        searchBtn.disabled = false;
                    });
                }, 0);
                break;
            case 'cleaner':
                if (fileOpenBar) fileOpenBar.style.display = 'none';
                if (viewTitle) viewTitle.textContent = t('view_cleaner', 'Oczyszczanie dysku');
                
                let cleanerHtml = `<div class="standard-view" style="width: 100%; box-sizing: border-box; padding: clamp(20px, 3vw, 40px);">`;
                
                if (osType === 'windows') {
                    cleanerHtml += `
                        <button class="btn primary" id="clean-btn">${t('clean_temp_btn', 'Tymczasowe pliki systemu (Temp) [1 / T]')}</button>
                        <br><br>
                        <button class="btn primary" id="clean-cache-btn">${t('clean_cache_btn', 'Cache Google Drive [2 / C]')}</button>
                        <br><br>
                        <button class="btn primary" id="clean-custom-btn">${t('clean_custom_btn', 'Niestandardowe foldery [3 / N]')}</button>
                    `;
                } else {
                    cleanerHtml += `
                        <button class="btn primary" id="clean-cache-btn">${t('clean_cache_btn', 'Cache Google Drive [2 / C]')}</button>
                        <br><br>
                        <p style="opacity: 0.7;">${t('clean_os_unsupported', 'Oczyszczanie plików Temp OS oraz niestandardowych folderów jest dostępne tylko na systemie Windows.')}</p>
                    `;
                }
                cleanerHtml += `</div>`;
                fileArea.innerHTML = cleanerHtml;
                
                setTimeout(() => {
                    if (osType === 'windows') {
                        document.getElementById('clean-btn')?.focus();
                        document.getElementById('clean-btn')?.addEventListener('click', async () => {
                            try {
                                const result = await window.go.main.App.CleanTempFiles();
                                showAlert(result);
                            } catch (err) {
                                showAlert(err);
                            }
                        });
                        document.getElementById('clean-custom-btn')?.addEventListener('click', async () => {
                            try {
                                const result = await window.go.main.App.CleanCustomPaths();
                                showAlert(result);
                            } catch (err) {
                                showAlert(err);
                            }
                        });
                    } else {
                        document.getElementById('clean-cache-btn')?.focus();
                    }
                    
                    document.getElementById('clean-cache-btn')?.addEventListener('click', async () => {
                        try {
                            const result = await window.go.main.App.CleanAppCache();
                            showAlert(result);
                        } catch (err) {
                            showAlert(err);
                        }
                    });
                }, 0);
                break;
            case 'settings':
                try {
                    if (fileOpenBar) fileOpenBar.style.display = 'none';
                    if (viewTitle) viewTitle.textContent = t('view_settings', 'Ustawienia');
                    
                    let shortcutsHtml = '';
                    for (const [key, value] of Object.entries(shortcuts)) {
                        if (key.startsWith('mod-')) continue; // Standardowe idą pierwsze
                        if (key === 'switchDrive' && osType !== 'windows') continue;
                        const label = t('sc_' + key, knownShortcutLabels[key] || key);
                        shortcutsHtml += `<div class="shortcut-item" style="width: auto; margin:0; align-items:center;"><span>${label}:</span> <input type="text" data-shortcut="${key}" class="shortcut-input dynamic-shortcut" value="${value}"></div>`;
                    }
                    
                    customModules.forEach(mod => {
                        if (!disabledModules.includes(mod.id)) {
                            const key = 'mod-' + mod.id;
                            const value = shortcuts[key] || '';
                            shortcutsHtml += `<div class="shortcut-item" style="width: auto; margin:0; align-items:center;"><span style="color:var(--dir-color)">Moduł: ${mod.name}:</span> <input type="text" data-shortcut="${key}" class="shortcut-input dynamic-shortcut" value="${value}"></div>`;
                        }
                    });

                    let customPathsHtml = '';
                    if (osType === 'windows') {
                        customPathsHtml = `
                            <h3 style="color: var(--accent); border-bottom: 1px solid var(--border); padding-bottom: 8px;">${t('settings_custom_clean', 'Oczyszczanie niestandardowe')}</h3>
                            <div style="margin-bottom: 2rem;">
                                <p style="font-size: 0.85em; opacity: 0.7;">${t('settings_custom_clean_desc', 'Zdefiniuj foldery, których zawartość ma być usuwana podczas czyszczenia.')}</p>
                                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                                    <input type="text" id="settings-add-custom-path" class="input-field" placeholder="${t('settings_add_folder_ph', 'np. C:\\Pobrane\\Smieci')}" style="margin: 0; width: 100%; max-width: 500px;">
                                    <button class="btn primary" id="settings-btn-add-custom-path">${t('settings_add_folder_btn', 'Dodaj folder')}</button>
                                </div>
                                <div id="settings-custom-paths-list" style="display: flex; flex-direction: column; gap: 5px; max-width: 600px;">
                                </div>
                            </div>
                        `;
                    }

                    let modulesHtml = `
                        <h3 style="color: var(--accent); border-bottom: 1px solid var(--border); padding-bottom: 8px;">${t('settings_modules_title', 'Zarządzanie modułami')}</h3>
                        <p style="font-size: 0.85em; opacity: 0.7;">${t('settings_modules_desc', 'Włącz lub wyłącz dynamiczne moduły.')}</p>
                        <div style="margin-bottom: 2rem; display: flex; flex-direction: column; gap: 10px;">
                    `;
                    if (customModules.length === 0) {
                        modulesHtml += `<span style="opacity:0.5">${t('modules_none', 'Brak modułów.')}</span>`;
                    } else {
                        customModules.forEach(mod => {
                            const isChecked = !disabledModules.includes(mod.id) ? 'checked' : '';
                            modulesHtml += `
                                <label class="checkbox-container" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                    <input type="checkbox" class="module-toggle-cb" data-modid="${mod.id}" ${isChecked}> 
                                    <span>${mod.name} (${mod.id})</span>
                                </label>
                            `;
                        });
                    }
                    modulesHtml += `</div>`;

                    fileArea.innerHTML = `
                        <div class="standard-view" style="width: 100%; height: 100%; box-sizing: border-box; padding: clamp(20px, 3vw, 40px);">
                            <div style="display: flex; gap: 1rem; margin-bottom: 2rem;">
                                <button class="btn primary" id="settings-open-config">${t('settings_open_json', 'Otwórz plik konfiguracyjny (JSON)')}</button>
                                <button class="btn" id="settings-reload-config">${t('settings_reload', 'Odśwież z pliku')}</button>
                            </div>

                            <h3 style="color: var(--accent); border-bottom: 1px solid var(--border); padding-bottom: 8px;">${t('settings_lang', 'Język aplikacji (Language)')}</h3>
                            <div style="margin-bottom: 2rem;">
                                <select id="settings-lang-select" class="input-field" style="width: 100%; max-width: 400px;"></select>
                                <p style="font-size: 0.85em; opacity: 0.7;">${t('settings_lang_desc', 'Dodaj nowe pliki .json do folderu lang w konfiguracji, by dodać języki.')}</p>
                            </div>
                            
                            <h3 style="color: var(--accent); border-bottom: 1px solid var(--border); padding-bottom: 8px;">${t('settings_ui', 'Wygląd interfejsu')}</h3>
                            <div style="margin-bottom: 2rem;">
                                <label style="display: block; margin-bottom: 8px; font-weight: bold;">
                                    ${t('settings_scale', 'Skala aplikacji:')} <span id="scale-val-display" style="color: var(--accent);">${appScale}x</span>
                                </label>
                                <input type="range" id="settings-scale-slider" min="0.5" max="2.0" step="0.1" value="${appScale}" style="width: 100%; max-width: 400px; cursor: pointer;">
                            </div>

                            ${modulesHtml}
                            ${customPathsHtml}

                            <h3 style="color: var(--accent); border-bottom: 1px solid var(--border); padding-bottom: 8px;">${t('settings_nav_options', 'Opcje nawigacji i zachowania')}</h3>
                            <div style="margin-bottom: 2rem; display: flex; flex-direction: column; gap: 1.5rem;">
                                <label class="checkbox-container" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                    <input type="checkbox" id="settings-show-hidden-cb"> 
                                    <span>${t('settings_show_hidden', 'Pokaż ukryte pliki')}</span>
                                </label>
                                <label class="checkbox-container" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                    <input type="checkbox" id="settings-show-extensions-cb"> 
                                    <span>${t('settings_show_ext', 'Pokaż rozszerzenia plików')}</span>
                                </label>
                                <label class="checkbox-container" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                    <input type="checkbox" id="settings-folders-first-cb"> 
                                    <span>${t('settings_folders_first', 'Pokazuj foldery na początku listy')}</span>
                                </label>
                                <label class="checkbox-container" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                    <input type="checkbox" id="settings-confirm-delete-cb"> 
                                    <span>${t('settings_confirm_del', 'Pytaj o potwierdzenie przed usunięciem elementów')}</span>
                                </label>
                                
                                <div>
                                    <label style="display: block; margin-bottom: 4px; font-weight: bold;">${t('settings_def_path', 'Domyślny katalog startowy')}</label>
                                    <div style="font-size: 0.85em; opacity: 0.7; margin-bottom: 8px;">${t('settings_def_path_desc', 'Zostaw puste, aby otwierać systemowy katalog domowy użytkownika.')}</div>
                                    <input type="text" id="settings-default-path" class="input-field" value="${defaultPath}" style="width: 100%; max-width: 600px;">
                                </div>
                                
                                <div>
                                    <label style="display: block; margin-bottom: 4px; font-weight: bold;">${t('settings_custom_term', 'Niestandardowy emulator terminala')}</label>
                                    <div style="font-size: 0.85em; opacity: 0.7; margin-bottom: 8px;">${t('settings_custom_term_desc', 'Zostaw puste, aby używać domyślnego w systemie.')}</div>
                                    <input type="text" id="settings-custom-terminal" class="input-field" value="${customTerminal}" style="width: 100%; max-width: 600px;">
                                </div>
                                
                                <div>
                                    <label style="display: block; margin-bottom: 4px; font-weight: bold;">${t('settings_cache_days', 'Czas życia Cache (w dniach)')}</label>
                                    <div style="font-size: 0.85em; opacity: 0.7; margin-bottom: 8px;">${t('settings_cache_days_desc', 'Po ilu dniach aplikacja ma automatycznie czyścić pobrane pliki z Google Drive.')}</div>
                                    <input type="number" id="settings-cache-days" class="input-field" value="${cacheCleanupDays}" min="0" max="365" style="width: 120px;">
                                </div>
                            </div>

                            <h3 style="color: var(--accent); border-bottom: 1px solid var(--border); padding-bottom: 8px;">${t('settings_shortcuts_title', 'Skróty klawiszowe')}</h3>
                            <div id="dynamic-shortcuts-container" style="margin-bottom: 2rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px;">
                                ${shortcutsHtml}
                            </div>
                            <button class="btn primary" id="save-shortcuts-btn" style="width: 100%; max-width: 300px; margin-bottom: 2rem;">${t('settings_save_shortcuts', 'Zapisz Skróty')}</button>

                            <h3 style="color: var(--accent); border-bottom: 1px solid var(--border); padding-bottom: 8px;">${t('settings_assoc_title', 'Zaawansowane powiązania plików')}</h3>
                            <p style="font-size: 0.85em; opacity: 0.7;">${t('settings_assoc_desc', 'Konfiguracja aplikacji domyślnych do otwierania określonych rozszerzeń plików.')}</p>
                            <div style="margin-bottom: 2rem; display: flex; gap: 1rem;">
                                <button class="btn primary" id="settings-open-json">${t('settings_edit_assoc', 'Edytuj powiązania (JSON)')}</button>
                                <button class="btn" id="settings-reload-json">${t('settings_reload_assoc', 'Odśwież powiązania')}</button>
                            </div>
                        </div>
                    `;

                    setTimeout(async () => {
                        const langSelect = document.getElementById('settings-lang-select');
                        try {
                            const langs = await window.go.main.App.GetAvailableLanguages();
                            if(langSelect) {
                                langSelect.innerHTML = langs.map(l => `<option value="${l}" ${l === appLang ? 'selected' : ''}>${l.toUpperCase()}</option>`).join('');
                            }
                        } catch(e) {}

                        if(langSelect) {
                            langSelect.addEventListener('change', async (e) => {
                                appLang = e.target.value;
                                await saveSettings();
                                showAlert(t('alert_reloading', 'Przeładowywanie aplikacji...'));
                                setTimeout(() => window.location.reload(), 800);
                            });
                        }

                        document.querySelectorAll('.module-toggle-cb').forEach(cb => {
                            cb.addEventListener('change', async (e) => {
                                const modId = e.target.getAttribute('data-modid');
                                if (!e.target.checked) {
                                    if (!disabledModules.includes(modId)) disabledModules.push(modId);
                                } else {
                                    disabledModules = disabledModules.filter(id => id !== modId);
                                }
                                await saveSettings();
                                showAlert(t('alert_reloading', 'Przeładowywanie aplikacji...'));
                                setTimeout(() => window.location.reload(), 800);
                            });
                        });

                        const slider = document.getElementById('settings-scale-slider');
                        const scaleDisplay = document.getElementById('scale-val-display');
                        
                        if(slider) {
                            slider.addEventListener('input', (e) => {
                                let tempScale = parseFloat(e.target.value);
                                if(scaleDisplay) scaleDisplay.textContent = tempScale.toFixed(1) + 'x';
                            });
                            
                            slider.addEventListener('change', (e) => {
                                appScale = parseFloat(e.target.value);
                                document.documentElement.style.setProperty('--app-scale', appScale);
                                saveSettings();
                            });
                        }

                        if (osType === 'windows') {
                            const customPathInput = document.getElementById('settings-add-custom-path');
                            const customPathBtn = document.getElementById('settings-btn-add-custom-path');
                            const customPathsList = document.getElementById('settings-custom-paths-list');

                            function renderCustomPaths() {
                                if(!customPathsList) return;
                                customPathsList.innerHTML = '';
                                if (customCleanPaths.length === 0) {
                                    return;
                                }
                                customCleanPaths.forEach((p, idx) => {
                                    const item = document.createElement('div');
                                    item.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background: var(--bg-panel); border: 1px solid var(--border); border-radius: 4px;";
                                    item.innerHTML = `<span class="text-ellipsis" style="flex: 1; margin-right: 10px;">${p}</span>`;
                                    const delBtn = document.createElement('button');
                                    delBtn.className = "btn danger";
                                    delBtn.style.padding = "2px 8px";
                                    delBtn.textContent = t('btn_delete', 'Usuń');
                                    delBtn.onclick = async () => {
                                        customCleanPaths.splice(idx, 1);
                                        await saveSettings();
                                        renderCustomPaths();
                                    };
                                    item.appendChild(delBtn);
                                    customPathsList.appendChild(item);
                                });
                            }
                            renderCustomPaths();

                            if(customPathBtn) {
                                customPathBtn.addEventListener('click', async () => {
                                    const val = customPathInput.value.trim();
                                    if (val && !customCleanPaths.includes(val)) {
                                        customCleanPaths.push(val);
                                        customPathInput.value = '';
                                        await saveSettings();
                                        renderCustomPaths();
                                    }
                                });
                            }
                        }

                        const showHiddenCb = document.getElementById('settings-show-hidden-cb');
                        if(showHiddenCb) {
                            showHiddenCb.checked = showHidden;
                            showHiddenCb.addEventListener('change', (e) => {
                                showHidden = e.target.checked;
                                saveSettings();
                            });
                        }

                        const showExtensionsCb = document.getElementById('settings-show-extensions-cb');
                        if(showExtensionsCb) {
                            showExtensionsCb.checked = showExtensions;
                            showExtensionsCb.addEventListener('change', (e) => {
                                showExtensions = e.target.checked;
                                saveSettings();
                            });
                        }

                        const foldersFirstCb = document.getElementById('settings-folders-first-cb');
                        if(foldersFirstCb) {
                            foldersFirstCb.checked = foldersFirst;
                            foldersFirstCb.addEventListener('change', (e) => {
                                foldersFirst = e.target.checked;
                                saveSettings();
                            });
                        }

                        const confirmCb = document.getElementById('settings-confirm-delete-cb');
                        if(confirmCb) {
                            confirmCb.checked = confirmDelete;
                            confirmCb.addEventListener('change', (e) => {
                                confirmDelete = e.target.checked;
                                saveSettings();
                            });
                        }

                        const defaultPathInput = document.getElementById('settings-default-path');
                        if(defaultPathInput) {
                            defaultPathInput.addEventListener('change', (e) => {
                                defaultPath = e.target.value;
                                saveSettings();
                            });
                        }

                        const customTerminalInput = document.getElementById('settings-custom-terminal');
                        if (customTerminalInput) {
                            customTerminalInput.addEventListener('change', (e) => {
                                customTerminal = e.target.value;
                                saveSettings();
                            });
                        }

                        const cacheDaysInput = document.getElementById('settings-cache-days');
                        if (cacheDaysInput) {
                            cacheDaysInput.addEventListener('change', (e) => {
                                cacheCleanupDays = parseInt(e.target.value) || 0;
                                saveSettings();
                            });
                        }

                        document.getElementById('settings-open-config')?.addEventListener('click', async () => {
                            try {
                                await window.go.main.App.OpenSettingsFile();
                            } catch(err) {
                                showAlert(t('alert_error', 'Błąd'));
                            }
                        });

                        document.getElementById('settings-reload-config')?.addEventListener('click', async () => {
                            await loadSettingsFromBackend();
                            updateView('settings');
                            showAlert(t('alert_reloaded', 'Odświeżono.'));
                        });

                        document.getElementById('save-shortcuts-btn')?.addEventListener('click', async () => {
                            document.querySelectorAll('.dynamic-shortcut').forEach(input => {
                                const key = input.getAttribute('data-shortcut');
                                shortcuts[key] = input.value;
                            });
                            await saveSettings();
                            showAlert(t('alert_saved', 'Zapisano.'));
                        });

                        document.getElementById('settings-open-json')?.addEventListener('click', async () => {
                            try {
                                await window.go.main.App.OpenAssociationsFile();
                            } catch(err) {
                                showAlert(t('alert_error', 'Błąd'));
                            }
                        });

                        document.getElementById('settings-reload-json')?.addEventListener('click', async () => {
                            try {
                                fileAssociations = await window.go.main.App.GetFileAssociations();
                                showAlert(t('alert_reloaded', 'Odświeżono.'));
                            } catch(err) {
                                showAlert(t('alert_error', 'Błąd'));
                            }
                        });
                    }, 0);
                } catch (e) {
                    if (fileArea) fileArea.innerHTML = `<div style="color:#ff5555; padding: 20px;">Błąd ładowania ustawień: ${e.message}</div>`;
                }
                break;
        }
    }

    updateView('local');
});