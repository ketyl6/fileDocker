document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

document.addEventListener('DOMContentLoaded', async () => {
    const navItems = document.querySelectorAll('.nav-links li');
    const viewTitle = document.getElementById('view-title');
    const fileArea = document.getElementById('file-area');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const contextMenu = document.getElementById('context-menu');
    const driveSelector = document.getElementById('drive-selector');
    const settingsBtn = document.getElementById('settings-btn');
    const fileOpenBar = document.getElementById('file-open-bar');
    const customAppInput = document.getElementById('custom-app-input');
    const btnOpenFile = document.getElementById('btn-open-file');
    
    const customAlert = document.getElementById('custom-alert');
    const alertText = document.getElementById('alert-text');
    const alertOk = document.getElementById('alert-ok');

    const inputModal = document.getElementById('input-modal');
    const inputText = document.getElementById('input-text');
    const inputField = document.getElementById('input-field-modal');
    const inputOk = document.getElementById('input-ok');
    const inputCancel = document.getElementById('input-cancel');
    
    let currentMode = 'local';
    let previousMode = 'local';
    let currentDir = "";
    let parentDir = "";
    let currentFiles = [];
    let selectedIndex = 0;
    let driveHistory = ["root"];
    let osType = "";

    let localDirState = "";
    let cloudDirState = "root";

    let clipboardFile = null;
    let clipboardAction = null; 
    let pendingCreateType = null;
    let fileAssociations = {};

    let appScale = 1.0;
    let showHidden = false;
    let showExtensions = true;
    let foldersFirst = true;
    let isDarkTheme = true;
    let defaultPath = "";
    let confirmDelete = true;
    let shortcuts = {
        copy: "c", cut: "x", paste: "v", delete: "Delete",
        newFile: "n", newDir: "N", terminal: "t", zip: "z", unzip: "u", dualPane: "d"
    };

    function updateShortcutUI() {
        const scBar = document.querySelector('.bottom-shortcuts');
        if (scBar) {
            scBar.innerHTML = `
                <span>[${shortcuts.copy.toUpperCase()}] Kopiuj</span>
                <span>[${shortcuts.cut.toUpperCase()}] Wytnij</span>
                <span>[${shortcuts.paste.toUpperCase()}] Wklej</span>
                <span>[${shortcuts.delete}] Usun</span>
                <span>[${shortcuts.newFile.toUpperCase()}] Nowy plik</span>
                <span>[${shortcuts.newDir}] Nowy folder</span>
                <span>[${shortcuts.terminal.toUpperCase()}] Terminal</span>
                <span>[${shortcuts.zip.toUpperCase()}] Spakuj</span>
                <span>[${shortcuts.unzip.toUpperCase()}] Rozpakuj</span>
                <span>[${shortcuts.dualPane.toUpperCase()}] Dual Pane</span>
                <span>[Back] / [&larr;] Wstecz</span>
                <span>[Enter] / [&rarr;] Otworz</span>
            `;
        }
    }

    async function loadSettingsFromBackend() {
        try {
            const s = await window.go.main.App.GetSettings();
            appScale = s.appScale;
            showHidden = s.showHidden;
            showExtensions = s.showExtensions;
            foldersFirst = s.foldersFirst;
            isDarkTheme = s.isDarkTheme;
            defaultPath = s.defaultPath;
            confirmDelete = s.confirmDelete;
            if (s.shortcuts) shortcuts = s.shortcuts;

            if (defaultPath !== "" && localDirState === "") {
                localDirState = defaultPath;
            }
            applyTheme();
            document.documentElement.style.setProperty('--app-scale', appScale);
            updateShortcutUI();
        } catch(err) {
            console.warn("Nie udalo sie zaladowac ustawien", err);
        }
    }

    async function saveSettings() {
        try {
            await window.go.main.App.SaveSettings({
                appScale: appScale, showHidden: showHidden, showExtensions: showExtensions,
                foldersFirst: foldersFirst, isDarkTheme: isDarkTheme, defaultPath: defaultPath,
                confirmDelete: confirmDelete, shortcuts: shortcuts
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
            if (drives && drives.length > 0) {
                driveSelector.innerHTML = drives.map(d => `<option value="${d}">${d}</option>`).join('');
                driveSelector.style.display = 'block';
            }
        }
    } catch (e) {}

    driveSelector.addEventListener('change', (e) => {
        if (currentMode === 'local') {
            selectedIndex = 0;
            loadRangerView(e.target.value);
        }
        e.target.blur();
    });

    function showAlert(message) {
        alertText.textContent = message;
        customAlert.style.display = 'flex';
        alertOk.focus();
    }

    alertOk.addEventListener('click', () => {
        customAlert.style.display = 'none';
    });

    function showInputPrompt(message, type) {
        pendingCreateType = type;
        inputText.textContent = message;
        inputField.value = "";
        inputModal.style.display = 'flex';
        inputField.focus();
    }

    inputCancel.addEventListener('click', () => {
        inputModal.style.display = 'none';
        pendingCreateType = null;
    });

    inputOk.addEventListener('click', async () => {
        const name = inputField.value.trim();
        if (name && currentDir && pendingCreateType) {
            const newPath = currentDir + (currentDir.endsWith("\\") || currentDir.endsWith("/") ? "" : (osType === 'windows' ? "\\" : "/")) + name;
            try {
                const isDir = pendingCreateType === 'dir';
                await window.go.main.App.CreateItem(newPath, isDir);
                inputModal.style.display = 'none';
                pendingCreateType = null;
                loadRangerView(currentDir);
            } catch (err) {
                showAlert(err);
            }
        } else {
            inputModal.style.display = 'none';
        }
    });

    inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') inputOk.click();
        if (e.key === 'Escape') inputCancel.click();
    });

    themeToggleBtn.addEventListener('click', () => {
        isDarkTheme = !isDarkTheme;
        applyTheme();
        saveSettings();
    });

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            if (currentMode === 'local') localDirState = currentDir;
            if (currentMode === 'cloud-browse') cloudDirState = currentDir;

            navItems.forEach(nav => nav.classList.remove('active'));
            e.target.classList.add('active');
            previousMode = currentMode;
            currentMode = e.target.dataset.view;
            updateView(currentMode);
        });
    });

    settingsBtn.addEventListener('click', () => {
        if (currentMode === 'settings') {
            currentMode = previousMode;
            navItems.forEach(nav => {
                let targetView = currentMode;
                if (currentMode === 'cloud-browse') targetView = 'cloud';
                if (nav.dataset.view === targetView) nav.classList.add('active');
            });
            updateView(currentMode);
        } else {
            if (currentMode === 'local') localDirState = currentDir;
            if (currentMode === 'cloud-browse') cloudDirState = currentDir;

            previousMode = currentMode;
            navItems.forEach(nav => nav.classList.remove('active'));
            currentMode = 'settings';
            updateView('settings');
        }
    });

    function syncDriveSelector(path) {
        if (osType === 'windows' && currentMode === 'local' && path.length >= 2) {
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
        if (currentMode === 'local' && file && !file.isDir) {
            fileOpenBar.style.display = 'flex';
            let ext = "";
            if (file.name.includes('.')) {
                ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
            }
            customAppInput.value = fileAssociations[ext] || "";
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
        try {
            let state;
            if (currentMode === 'local') {
                state = await window.go.main.App.GetRangerData(targetPath, showHidden);
            } else if (currentMode === 'cloud-browse') {
                state = await window.go.main.App.GetDriveData(targetPath);
            }
            
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
            if (currentMode === 'local' && parentDir !== "") {
                parentState = await window.go.main.App.GetRangerData(parentDir, showHidden);
                parentState.files = sortFiles(parentState.files);
            } else if (currentMode === 'cloud-browse' && driveHistory.length > 1) {
                const parentId = driveHistory[driveHistory.length - 2];
                parentState = await window.go.main.App.GetDriveData(parentId);
                parentState.files = sortFiles(parentState.files);
            }

            renderRangerColumns(parentState.files, currentFiles);
        } catch (err) {
            fileArea.innerHTML = `<div class="standard-view">Blad: ${err}</div>`;
        }
    }

    function renderRangerColumns(parentFilesList, currentFilesList) {
        let html = `<div class="ranger-container">`;
        
        html += `<div class="ranger-col" id="parent-col">`;
        if (parentFilesList) {
            html += parentFilesList.map((f, idx) => {
                const isSelected = f.path === currentDir ? "selected" : "";
                const typeClass = f.isDir ? "dir" : "file";
                return `<div class="ranger-item ${typeClass} ${isSelected}" data-idx="${idx}">${getDisplayName(f)}</div>`;
            }).join('');
        }
        html += `</div>`;

        html += `<div class="ranger-col" id="current-col">`;
        html += currentFilesList.map((f, idx) => {
            const isSelected = idx === selectedIndex ? "selected" : "";
            const typeClass = f.isDir ? "dir" : "file";
            return `<div class="ranger-item ${typeClass} ${isSelected}" data-idx="${idx}">${getDisplayName(f)}</div>`;
        }).join('');
        html += `</div>`;

        html += `<div class="ranger-col" id="preview-col"></div>`;
        html += `</div>`;
        
        fileArea.innerHTML = html;
        viewTitle.textContent = currentMode === 'local' && osType === 'windows' ? currentDir.substring(2) || "\\" : currentDir;

        const currentCol = document.getElementById('current-col');
        if (currentCol && currentCol.children[selectedIndex]) {
            currentCol.children[selectedIndex].scrollIntoView({ block: 'nearest' });
        }

        document.querySelectorAll('#parent-col .ranger-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.idx);
                const clickedFile = parentFilesList[idx];
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
                    handleForwardNavigation(currentFilesList[idx]);
                } else {
                    handleFileOpen(currentFilesList[idx]);
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
                        handleForwardNavigation(file, currentMode === 'local' ? clickedFile.path : clickedFile.id);
                    });
                });
            } catch (err) {
                previewCol.innerHTML = `<div class="preview-box">Brak dostepu</div>`;
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
                    if (stats) htmlContent += `<strong>Rozmiar:</strong> ${sizeStr} | <strong>Modyfikacja:</strong> ${stats.modTime} | <strong>Uprawnienia:</strong> ${stats.mode}`;
                    htmlContent += `</div><div class="preview-box">${highlightSyntax(text, ext)}</div>`;
                    
                    previewCol.innerHTML = htmlContent;
                } catch (err) {
                    previewCol.innerHTML = `<div class="preview-box">Nie mozna wczytac podgladu</div>`;
                }
            } else {
                previewCol.innerHTML = `<div class="preview-box">Podglad niedostepny</div>`;
            }
        }
    }

    function showContextMenu(x, y) {
        contextMenu.style.display = 'block';
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
    }

    document.addEventListener('click', () => {
        contextMenu.style.display = 'none';
    });

    document.getElementById('cm-new-file').addEventListener('click', () => {
        if (currentMode !== 'local') return showAlert("Opcja dostepna tylko lokalnie");
        showInputPrompt("Podaj nazwe nowego pliku:", "file");
    });
    document.getElementById('cm-new-dir').addEventListener('click', () => {
        if (currentMode !== 'local') return showAlert("Opcja dostepna tylko lokalnie");
        showInputPrompt("Podaj nazwe nowego folderu:", "dir");
    });
    document.getElementById('cm-copy').addEventListener('click', () => handleAction('copy'));
    document.getElementById('cm-cut').addEventListener('click', () => handleAction('cut'));
    document.getElementById('cm-paste').addEventListener('click', () => handleAction('paste'));
    document.getElementById('cm-delete').addEventListener('click', () => handleAction('delete'));

    async function handleAction(action) {
        if (currentMode !== 'local') return;
        const file = currentFiles[selectedIndex];
        
        try {
            if (action === 'copy' || action === 'cut') {
                if (file) {
                    clipboardFile = file.path;
                    clipboardAction = action;
                }
            } else if (action === 'paste') {
                if (clipboardFile && clipboardAction) {
                    const fileName = clipboardFile.split(/[/\\]/).pop();
                    const destPath = currentDir + (currentDir.endsWith("\\") || currentDir.endsWith("/") ? "" : (osType === 'windows' ? "\\" : "/")) + fileName;
                    await window.go.main.App.FileAction(clipboardAction, clipboardFile, destPath);
                    if (clipboardAction === 'cut') {
                        clipboardFile = null;
                        clipboardAction = null;
                    }
                    loadRangerView(currentDir);
                }
            } else if (action === 'delete') {
                if (file) {
                    if (confirmDelete && !confirm(`Czy na pewno chcesz usunac: ${file.name}?`)) return;
                    await window.go.main.App.FileAction('delete', file.path, "");
                    loadRangerView(currentDir);
                }
            }
        } catch (err) {
            showAlert(err);
        }
    }

    function handleForwardNavigation(file, pathToSelect = null) {
        if (file && file.isDir) {
            if (currentMode === 'cloud-browse') driveHistory.push(file.id);
            loadRangerView(file.path, pathToSelect);
        }
    }

    function handleBackNavigation(pathToSelect = null) {
        if (currentMode === 'local' && parentDir !== "") {
            loadRangerView(parentDir, pathToSelect || currentDir);
        } else if (currentMode === 'cloud-browse' && driveHistory.length > 1) {
            const oldId = driveHistory.pop();
            const newTarget = driveHistory[driveHistory.length - 1];
            loadRangerView(newTarget, pathToSelect || oldId);
        }
    }

    async function handleFileOpen(file) {
        if (currentMode !== 'local') return;
        const appName = customAppInput.value.trim();
        try {
            await window.go.main.App.OpenFileCustom(file.path, appName);
        } catch (err) {
            showAlert(err);
        }
    }

    btnOpenFile.addEventListener('click', () => {
        const file = currentFiles[selectedIndex];
        if (file && !file.isDir) handleFileOpen(file);
    });

    window.addEventListener('keydown', async (e) => {
        if (customAlert.style.display === 'flex') {
            if (e.key === 'Enter' || e.key === 'Escape') customAlert.style.display = 'none';
            return;
        }
        if (inputModal.style.display === 'flex') return; 

        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') return;
        
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
        } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
            e.preventDefault();
            const file = currentFiles[selectedIndex];
            if (file && file.isDir) {
                handleForwardNavigation(file);
            } else if (file && !file.isDir) {
                handleFileOpen(file);
            }
        } else if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
            e.preventDefault();
            handleBackNavigation();
        } else if (e.key === shortcuts.copy && !e.ctrlKey) {
            e.preventDefault(); handleAction('copy');
        } else if (e.key === shortcuts.cut && !e.ctrlKey) {
            e.preventDefault(); handleAction('cut');
        } else if (e.key === shortcuts.paste && !e.ctrlKey) {
            e.preventDefault(); handleAction('paste');
        } else if (e.key === shortcuts.delete) {
            e.preventDefault(); handleAction('delete');
        } else if (e.key === shortcuts.newFile) {
            e.preventDefault();
            if (currentMode === 'local') showInputPrompt("Podaj nazwe nowego pliku:", "file");
        } else if (e.key === shortcuts.newDir) {
            e.preventDefault();
            if (currentMode === 'local') showInputPrompt("Podaj nazwe nowego folderu:", "dir");
        } else if (e.key === shortcuts.terminal && currentMode === 'local' && currentDir) {
            e.preventDefault();
            await window.go.main.App.OpenTerminal(currentDir);
        } else if (e.key === shortcuts.zip && currentMode === 'local') {
            e.preventDefault();
            const file = currentFiles[selectedIndex];
            if (file) {
                try {
                    await window.go.main.App.ZipItem(file.path);
                    loadRangerView(currentDir);
                } catch(err) { showAlert(err); }
            }
        } else if (e.key === shortcuts.unzip && currentMode === 'local') {
            e.preventDefault();
            const file = currentFiles[selectedIndex];
            if (file && !file.isDir && file.path.endsWith('.zip')) {
                try {
                    await window.go.main.App.UnzipItem(file.path);
                    loadRangerView(currentDir);
                } catch(err) { showAlert(err); }
            }
        } else if (e.key === shortcuts.dualPane) {
            e.preventDefault();
            showAlert("Opcja Dual Pane jest zaplanowana do aktywacji w kolejnej wersji, aby zapewnic stabilnosc interfejsu Ranger.");
        }
    });

    async function updateView(view) {
        if (osType === 'windows') {
            driveSelector.style.display = view === 'local' ? 'block' : 'none';
        }
        
        switch(view) {
            case 'local':
                if (localDirState === "") {
                    await loadRangerView("");
                } else {
                    await loadRangerView(localDirState);
                }
                break;
            case 'cloud':
                fileOpenBar.style.display = 'none';
                try {
                    const isAuth = await window.go.main.App.IsDriveAuthenticated();
                    if (isAuth) {
                        currentMode = 'cloud-browse';
                        if (driveHistory.length === 0) driveHistory = ["root"];
                        await loadRangerView(cloudDirState);
                        break;
                    }
                } catch (e) {}

                viewTitle.textContent = 'Google Drive';
                fileArea.innerHTML = `
                    <div class="standard-view">
                        <h3>Konfiguracja klienta Google</h3>
                        <input type="text" id="g-client-id" class="input-field" placeholder="Client ID">
                        <input type="password" id="g-client-secret" class="input-field" placeholder="Client Secret">
                        <button class="btn primary" id="auth-btn">Zaloguj do Google</button>
                    </div>
                `;
                setTimeout(() => {
                    document.getElementById('auth-btn').addEventListener('click', async () => {
                        const clientId = document.getElementById('g-client-id').value;
                        const clientSecret = document.getElementById('g-client-secret').value;
                        try {
                            await window.go.main.App.LoginGoogle(clientId, clientSecret);
                            currentMode = 'cloud-browse';
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
                fileOpenBar.style.display = 'none';
                if (driveHistory.length === 0) driveHistory = ["root"];
                await loadRangerView(cloudDirState);
                break;
            case 'network':
                fileOpenBar.style.display = 'none';
                viewTitle.textContent = 'Siec SMB/FTP';
                fileArea.innerHTML = `
                    <div class="standard-view">
                        <input type="text" id="smb-address" class="input-field" placeholder="Adres IP / Host">
                        <input type="text" id="smb-user" class="input-field" placeholder="Uzytkownik">
                        <input type="password" id="smb-pass" class="input-field" placeholder="Haslo">
                        <button class="btn primary" id="connect-btn">Polacz</button>
                    </div>
                `;
                break;
            case 'cleaner':
                fileOpenBar.style.display = 'none';
                viewTitle.textContent = 'Oczyszczanie dysku';
                fileArea.innerHTML = `
                    <div class="standard-view">
                        <button class="btn primary" id="clean-btn">Rozpocznij czyszczenie</button>
                    </div>
                `;
                setTimeout(() => {
                    document.getElementById('clean-btn').addEventListener('click', async () => {
                        try {
                            const result = await window.go.main.App.CleanTempFiles();
                            showAlert(result);
                        } catch (err) {
                            showAlert(err);
                        }
                    });
                }, 0);
                break;
            case 'settings':
                fileOpenBar.style.display = 'none';
                viewTitle.textContent = 'Ustawienia';
                fileArea.innerHTML = `
                    <div class="standard-view">
                        <div style="display: flex; gap: 1rem; margin-bottom: 2rem;">
                            <button class="btn primary" id="settings-open-config">Otworz plik konfiguracyjny (JSON)</button>
                            <button class="btn" id="settings-reload-config">Odswiez ustawienia z pliku</button>
                        </div>
                        
                        <h3>Opcje wygladu</h3>
                        <div style="margin-bottom: 1.5rem;">
                            <label class="checkbox-container" style="margin-bottom: 1rem;">
                                <input type="checkbox" id="settings-show-hidden-cb">
                                Pokaz ukryte pliki
                            </label>
                            <label class="checkbox-container" style="margin-bottom: 1rem;">
                                <input type="checkbox" id="settings-show-ext-cb">
                                Pokaz rozszerzenia plikow
                            </label>
                            <label class="checkbox-container" style="margin-bottom: 1rem;">
                                <input type="checkbox" id="settings-folders-first-cb">
                                Katalogi na poczatku
                            </label>
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: bold; margin-top: 1rem;">
                                Skala interfejsu: <span id="scale-val-display" style="color: var(--accent);">${appScale}x</span>
                            </label>
                            <input type="range" id="settings-scale-slider" min="0.5" max="2.0" step="0.1" value="${appScale}" style="width: 20rem; max-width: 100%;">
                        </div>

                        <h3>Opcje nawigacji i plikow</h3>
                        <div style="margin-bottom: 1.5rem;">
                            <label class="checkbox-container" style="margin-bottom: 1rem;">
                                <input type="checkbox" id="settings-confirm-delete-cb">
                                Pytaj o potwierdzenie przy usuwaniu
                            </label>
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: bold;">
                                Domyslny katalog startowy (zostaw puste dla domowego):
                            </label>
                            <input type="text" id="settings-default-path" class="input-field" value="${defaultPath}" placeholder="np. C:\\Users lub /home">
                        </div>

                        <h3>Skroty Klawiszowe</h3>
                        <div style="margin-bottom: 2rem; display: flex; flex-direction: column; gap: 0.5rem;">
                            <div class="shortcut-item"><span>Kopiuj:</span> <input type="text" id="sc-copy" class="shortcut-input" value="${shortcuts.copy}"></div>
                            <div class="shortcut-item"><span>Wytnij:</span> <input type="text" id="sc-cut" class="shortcut-input" value="${shortcuts.cut}"></div>
                            <div class="shortcut-item"><span>Wklej:</span> <input type="text" id="sc-paste" class="shortcut-input" value="${shortcuts.paste}"></div>
                            <div class="shortcut-item"><span>Usun:</span> <input type="text" id="sc-delete" class="shortcut-input" value="${shortcuts.delete}"></div>
                            <div class="shortcut-item"><span>Nowy Plik:</span> <input type="text" id="sc-newFile" class="shortcut-input" value="${shortcuts.newFile}"></div>
                            <div class="shortcut-item"><span>Nowy Folder:</span> <input type="text" id="sc-newDir" class="shortcut-input" value="${shortcuts.newDir}"></div>
                            <div class="shortcut-item"><span>Terminal:</span> <input type="text" id="sc-terminal" class="shortcut-input" value="${shortcuts.terminal}"></div>
                            <div class="shortcut-item"><span>Spakuj Zip:</span> <input type="text" id="sc-zip" class="shortcut-input" value="${shortcuts.zip}"></div>
                            <div class="shortcut-item"><span>Rozpakuj Zip:</span> <input type="text" id="sc-unzip" class="shortcut-input" value="${shortcuts.unzip}"></div>
                            <div class="shortcut-item"><span>Dual Pane (wkrótce):</span> <input type="text" id="sc-dualPane" class="shortcut-input" value="${shortcuts.dualPane}"></div>
                            <button class="btn primary" id="save-shortcuts-btn" style="width: 250px; margin-top: 10px;">Zapisz Skroty</button>
                        </div>

                        <h3>Powiazania plikow</h3>
                        <div style="margin-bottom: 2rem;">
                            <button class="btn primary" id="settings-open-json">Edytuj powiazania (JSON)</button>
                            <button class="btn" id="settings-reload-json">Odswiez powiazania z pliku</button>
                        </div>
                    </div>
                `;
                setTimeout(() => {
                    const hiddenCb = document.getElementById('settings-show-hidden-cb');
                    hiddenCb.checked = showHidden;
                    hiddenCb.addEventListener('change', (e) => {
                        showHidden = e.target.checked;
                        saveSettings();
                    });

                    const extCb = document.getElementById('settings-show-ext-cb');
                    extCb.checked = showExtensions;
                    extCb.addEventListener('change', (e) => {
                        showExtensions = e.target.checked;
                        saveSettings();
                    });

                    const foldersCb = document.getElementById('settings-folders-first-cb');
                    foldersCb.checked = foldersFirst;
                    foldersCb.addEventListener('change', (e) => {
                        foldersFirst = e.target.checked;
                        saveSettings();
                    });

                    const slider = document.getElementById('settings-scale-slider');
                    const scaleDisplay = document.getElementById('scale-val-display');
                    
                    slider.addEventListener('input', (e) => {
                        let tempScale = parseFloat(e.target.value);
                        scaleDisplay.textContent = tempScale.toFixed(1) + 'x';
                    });
                    
                    slider.addEventListener('change', (e) => {
                        appScale = parseFloat(e.target.value);
                        document.documentElement.style.setProperty('--app-scale', appScale);
                        saveSettings();
                    });

                    const confirmCb = document.getElementById('settings-confirm-delete-cb');
                    confirmCb.checked = confirmDelete;
                    confirmCb.addEventListener('change', (e) => {
                        confirmDelete = e.target.checked;
                        saveSettings();
                    });

                    const defaultPathInput = document.getElementById('settings-default-path');
                    defaultPathInput.addEventListener('change', (e) => {
                        defaultPath = e.target.value;
                        saveSettings();
                    });

                    document.getElementById('settings-open-config').addEventListener('click', async () => {
                        try {
                            await window.go.main.App.OpenSettingsFile();
                        } catch(err) {
                            showAlert(err);
                        }
                    });

                    document.getElementById('settings-reload-config').addEventListener('click', async () => {
                        await loadSettingsFromBackend();
                        updateView('settings');
                        showAlert("Pomyslnie odswiezono ustawienia konfiguracyjne.");
                    });

                    document.getElementById('save-shortcuts-btn').addEventListener('click', async () => {
                        shortcuts.copy = document.getElementById('sc-copy').value;
                        shortcuts.cut = document.getElementById('sc-cut').value;
                        shortcuts.paste = document.getElementById('sc-paste').value;
                        shortcuts.delete = document.getElementById('sc-delete').value;
                        shortcuts.newFile = document.getElementById('sc-newFile').value;
                        shortcuts.newDir = document.getElementById('sc-newDir').value;
                        shortcuts.terminal = document.getElementById('sc-terminal').value;
                        shortcuts.zip = document.getElementById('sc-zip').value;
                        shortcuts.unzip = document.getElementById('sc-unzip').value;
                        shortcuts.dualPane = document.getElementById('sc-dualPane').value;
                        await saveSettings();
                        showAlert("Skroty zapisane!");
                    });

                    document.getElementById('settings-open-json').addEventListener('click', async () => {
                        try {
                            await window.go.main.App.OpenAssociationsFile();
                        } catch(err) {
                            showAlert(err);
                        }
                    });

                    document.getElementById('settings-reload-json').addEventListener('click', async () => {
                        try {
                            fileAssociations = await window.go.main.App.GetFileAssociations();
                            showAlert("Pomyslnie odswiezono powiazania plikow.");
                        } catch(err) {
                            showAlert("Blad podczas odswiezania: " + err);
                        }
                    });
                }, 0);
                break;
        }
    }

    updateView('local');
});