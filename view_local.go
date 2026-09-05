package main

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"sort"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/driver/desktop"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"
)

var clipboardPaths []string
var clipboardAction string
var markedFiles map[string]bool
var isNavigatingHistory = false
var BindLocalKeys func()

var binaryExtensions = map[string]bool{
	".exe": true, ".dll": true, ".so": true, ".zip": true, ".tar": true,
	".gz": true, ".7z": true, ".rar": true, ".png": true, ".jpg": true,
	".jpeg": true, ".gif": true, ".bmp": true, ".ico": true, ".pdf": true,
	".mp3": true, ".mp4": true, ".mkv": true, ".avi": true, ".iso": true,
}

func isHidden(f os.DirEntry) bool {
	if strings.HasPrefix(f.Name(), ".") {
		return true
	}
	if runtime.GOOS == "windows" {
		info, err := f.Info()
		if err == nil {
			val := reflect.ValueOf(info.Sys())
			if val.Kind() == reflect.Ptr {
				val = val.Elem()
				if val.Kind() == reflect.Struct {
					if attr := val.FieldByName("FileAttributes"); attr.IsValid() {
						return attr.Uint()&2 != 0
					}
				}
			}
		}
	}
	return false
}

func doBatchCopy(srcs []string, destDir string, action string, onDone func()) {
	go func() {
		for _, src := range srcs {
			dest := filepath.Join(destDir, filepath.Base(src))
			if action == "copy" {
				source, err := os.Open(src)
				if err == nil {
					destination, err := os.Create(dest)
					if err == nil {
						io.Copy(destination, source)
						destination.Close()
					}
					source.Close()
				}
			} else if action == "cut" {
				os.Rename(src, dest)
			}
		}
		if onDone != nil {
			onDone()
		}
	}()
}

type customSearchEntry struct {
	widget.Entry
	onEsc func()
}

func newCustomSearchEntry() *customSearchEntry {
	e := &customSearchEntry{}
	e.ExtendBaseWidget(e)
	return e
}

func (e *customSearchEntry) TypedKey(k *fyne.KeyEvent) {
	if k.Name == fyne.KeyEscape && e.onEsc != nil {
		e.onEsc()
		return
	}
	e.Entry.TypedKey(k)
}

type customList struct {
	widget.List
	onCustomKey  func(*fyne.KeyEvent) bool
	onCustomRune func(rune) bool
}

func newCustomList(length func() int, createItem func() fyne.CanvasObject, updateItem func(widget.ListItemID, fyne.CanvasObject)) *customList {
	l := &customList{}
	l.Length = length
	l.CreateItem = createItem
	l.UpdateItem = updateItem
	l.ExtendBaseWidget(l)
	return l
}

func (l *customList) TypedKey(k *fyne.KeyEvent) {
	if l.onCustomKey != nil && l.onCustomKey(k) {
		return
	}
	l.List.TypedKey(k)
}

func (l *customList) TypedRune(r rune) {
	if l.onCustomRune != nil && l.onCustomRune(r) {
		return
	}
	l.List.TypedRune(r)
}

type myListItem struct {
	widget.BaseWidget
	icon    *widget.Icon
	label   *widget.Label
	id      widget.ListItemID
	list    *customList
	onTap   func(widget.ListItemID, fyne.KeyModifier)
	onRight func(widget.ListItemID, *fyne.PointEvent)
	lastMod fyne.KeyModifier
	lastTap time.Time
}

func newMyListItem(l *customList, t func(widget.ListItemID, fyne.KeyModifier), r func(widget.ListItemID, *fyne.PointEvent)) *myListItem {
	i := &myListItem{
		icon:    widget.NewIcon(theme.DocumentIcon()),
		label:   widget.NewLabel(""),
		list:    l,
		onTap:   t,
		onRight: r,
	}
	i.ExtendBaseWidget(i)
	return i
}

func (i *myListItem) MouseDown(e *desktop.MouseEvent) {
	i.lastMod = e.Modifier
}
func (i *myListItem) MouseUp(e *desktop.MouseEvent) {}

func (i *myListItem) Tapped(e *fyne.PointEvent) {
	if i.onTap != nil {
		i.onTap(i.id, i.lastMod)
	}
	i.lastMod = 0
}

func (i *myListItem) TappedSecondary(e *fyne.PointEvent) {
	i.list.Select(i.id)
	if i.onRight != nil {
		i.onRight(i.id, e)
	}
}

func (i *myListItem) CreateRenderer() fyne.WidgetRenderer {
	return widget.NewSimpleRenderer(container.NewHBox(i.icon, i.label))
}

func MakeLocalView(w fyne.Window, openSettings func()) fyne.CanvasObject {
	var currentPath string
	var leftEntries, midEntries, rightEntries []os.DirEntry
	var selectedIndex widget.ListItemID = -1
	markedFiles = make(map[string]bool)

	var loadDirImpl func(string, string, string)
	var loadDir func(string, string)

	var leftList, rightList *widget.List
	var midList *customList
	rightContainer := container.NewStack()
	var previewTimer *time.Timer

	var lastTapTime time.Time
	var lastTapId widget.ListItemID

	isUpdatingPath := false
	pathSelector := widget.NewSelect([]string{}, func(s string) {
		if isUpdatingPath {
			return
		}
		if s != "" && s != currentPath {
			loadDir(s, "")
			w.Canvas().Focus(midList)
		}
	})

	searchEntry := newCustomSearchEntry()
	searchEntry.PlaceHolder = L("search")
	searchEntry.onEsc = func() {
		searchEntry.SetText("")
		w.Canvas().Focus(midList)
	}

	searchEntry.OnChanged = func(s string) {
		if runtime.GOOS == "windows" && len(s) == 2 && s[0] == '/' {
			driveLetter := strings.ToUpper(string(s[1]))
			if driveLetter >= "A" && driveLetter <= "Z" {
				targetPath := driveLetter + ":\\"
				if _, err := os.Stat(targetPath); err == nil {
					searchEntry.SetText("")
					loadDir(targetPath, "")
					w.Canvas().Focus(midList)
					return
				}
			}
		}
		loadDirImpl(currentPath, s, "")
	}

	getEntries := func(dir, filter string) []os.DirEntry {
		files, err := os.ReadDir(dir)
		if err != nil {
			return nil
		}
		var res []os.DirEntry
		filter = strings.ToLower(filter)
		for _, f := range files {
			if !Settings.ShowHidden && isHidden(f) {
				continue
			}
			if filter != "" && !strings.Contains(strings.ToLower(f.Name()), filter) {
				continue
			}
			res = append(res, f)
		}
		sort.Slice(res, func(i, j int) bool {
			if Settings.FoldersFirst {
				if res[i].IsDir() && !res[j].IsDir() {
					return true
				}
				if !res[i].IsDir() && res[j].IsDir() {
					return false
				}
			}
			return strings.ToLower(res[i].Name()) < strings.ToLower(res[j].Name())
		})
		return res
	}

	setPreviewText := func(text string) {
		l := widget.NewLabel(text)
		l.Wrapping = fyne.TextWrapWord
		rightContainer.Objects = []fyne.CanvasObject{container.NewVScroll(l)}
		rightContainer.Refresh()
	}

	updatePreview := func(target string, isDir bool) {
		if previewTimer != nil {
			previewTimer.Stop()
		}
		if isDir {
			rightEntries = getEntries(target, "")
			rightList.Refresh()
			rightContainer.Objects = []fyne.CanvasObject{rightList}
			rightContainer.Refresh()
		} else {
			rightContainer.Objects = []fyne.CanvasObject{widget.NewLabel("...")}
			rightContainer.Refresh()

			previewTimer = time.AfterFunc(150*time.Millisecond, func() {
				ext := strings.ToLower(filepath.Ext(target))
				if binaryExtensions[ext] {
					setPreviewText("[BIN]")
					return
				}

				info, err := os.Stat(target)
				if err != nil || info.Size() == 0 {
					setPreviewText("[EMPTY]")
					return
				}

				f, err := os.Open(target)
				if err != nil {
					setPreviewText("[ERR]")
					return
				}
				defer f.Close()

				buf := make([]byte, 2048)
				n, _ := f.Read(buf)
				if n == 0 {
					return
				}

				for i := 0; i < n; i++ {
					if buf[i] == 0 {
						setPreviewText("[BIN]")
						return
					}
				}

				var cleanText strings.Builder
				for _, r := range string(buf[:n]) {
					if r == utf8.RuneError {
						continue
					}
					if unicode.IsPrint(r) || r == '\n' || r == '\r' || r == '\t' {
						cleanText.WriteRune(r)
					}
				}

				finalText := cleanText.String()
				if info.Size() > 2048 {
					finalText += "\n\n[...]"
				}
				setPreviewText(finalText)
			})
		}
	}

	leftList = widget.NewList(
		func() int { return len(leftEntries) },
		func() fyne.CanvasObject {
			return container.NewHBox(widget.NewIcon(theme.FolderOpenIcon()), widget.NewLabel(""))
		},
		func(id widget.ListItemID, obj fyne.CanvasObject) {
			obj.(*fyne.Container).Objects[1].(*widget.Label).SetText(leftEntries[id].Name())
		},
	)

	rightList = widget.NewList(
		func() int { return len(rightEntries) },
		func() fyne.CanvasObject {
			return container.NewHBox(widget.NewIcon(theme.DocumentIcon()), widget.NewLabel(""))
		},
		func(id widget.ListItemID, obj fyne.CanvasObject) {
			hbox := obj.(*fyne.Container)
			icon := hbox.Objects[0].(*widget.Icon)
			label := hbox.Objects[1].(*widget.Label)
			label.SetText(rightEntries[id].Name())
			if rightEntries[id].IsDir() {
				icon.SetResource(theme.FolderOpenIcon())
			} else {
				icon.SetResource(theme.DocumentIcon())
			}
		},
	)

	leftList.OnSelected = func(id widget.ListItemID) {
		if id >= 0 && id < len(leftEntries) {
			clickedName := leftEntries[id].Name()
			leftList.UnselectAll()
			parent := filepath.Dir(currentPath)
			if parent != currentPath {
				loadDir(parent, clickedName)
			}
		}
	}

	rightList.OnSelected = func(id widget.ListItemID) {
		if selectedIndex >= 0 && selectedIndex < len(midEntries) {
			target := filepath.Join(currentPath, midEntries[selectedIndex].Name())
			if rightEntries[id].IsDir() {
				loadDir(filepath.Join(target, rightEntries[id].Name()), "")
			}
		}
	}

	actionDouble := func(id widget.ListItemID) {
		if id < 0 || id >= len(midEntries) {
			return
		}
		entry := midEntries[id]
		target := filepath.Join(currentPath, entry.Name())
		if entry.IsDir() {
			loadDir(target, "")
		} else {
			OpenFileOS(target)
		}
	}

	doDelete := func(target string) {
		var toDelete []string
		for k, v := range markedFiles {
			if v {
				toDelete = append(toDelete, k)
			}
		}
		if len(toDelete) == 0 && target != "" {
			toDelete = append(toDelete, target)
		}
		if len(toDelete) == 0 {
			return
		}

		delFunc := func() {
			for _, p := range toDelete {
				os.RemoveAll(p)
			}
			markedFiles = make(map[string]bool)
			loadDir(currentPath, "")
		}

		if Settings.ConfirmDelete {
			msg := L("del_msg")
			if len(toDelete) > 1 {
				msg = fmt.Sprintf("Czy usunąć wybrane elementy? (%d plików)", len(toDelete))
			}
			dialog.ShowConfirm(L("del_title"), msg, func(b bool) {
				if b {
					delFunc()
				}
			}, w)
		} else {
			delFunc()
		}
	}

	actionTap := func(id widget.ListItemID, mod fyne.KeyModifier) {
		now := time.Now()
		isDouble := false
		if now.Sub(lastTapTime) < 300*time.Millisecond && lastTapId == id {
			isDouble = true
		}
		lastTapTime = now
		lastTapId = id

		midList.Select(id)
		w.Canvas().Focus(midList)

		if isDouble {
			actionDouble(id)
			return
		}

		if mod&(fyne.KeyModifierControl|fyne.KeyModifierShift) != 0 {
			if id >= 0 && id < len(midEntries) {
				target := filepath.Join(currentPath, midEntries[id].Name())
				markedFiles[target] = !markedFiles[target]
				midList.Refresh()
			}
		}
	}

	actionRight := func(id widget.ListItemID, e *fyne.PointEvent) {
		if id < 0 || id >= len(midEntries) {
			return
		}
		target := filepath.Join(currentPath, midEntries[id].Name())
		menu := fyne.NewMenu("",
			fyne.NewMenuItem(L("copy"), func() {
				clipboardPaths = nil
				for k, v := range markedFiles {
					if v {
						clipboardPaths = append(clipboardPaths, k)
					}
				}
				if len(clipboardPaths) == 0 {
					clipboardPaths = append(clipboardPaths, target)
				}
				clipboardAction = "copy"
				markedFiles = make(map[string]bool)
				midList.Refresh()
			}),
			fyne.NewMenuItem(L("cut"), func() {
				clipboardPaths = nil
				for k, v := range markedFiles {
					if v {
						clipboardPaths = append(clipboardPaths, k)
					}
				}
				if len(clipboardPaths) == 0 {
					clipboardPaths = append(clipboardPaths, target)
				}
				clipboardAction = "cut"
				markedFiles = make(map[string]bool)
				midList.Refresh()
			}),
			fyne.NewMenuItem(L("paste"), func() {
				if len(clipboardPaths) > 0 {
					doBatchCopy(clipboardPaths, currentPath, clipboardAction, func() {
						if clipboardAction == "cut" {
							clipboardPaths = nil
						}
						loadDir(currentPath, "")
					})
				}
			}),
			fyne.NewMenuItem(L("delete"), func() { doDelete(target) }),
			fyne.NewMenuItem(L("term_here"), func() { OpenTerminal(currentPath) }),
		)
		widget.ShowPopUpMenuAtPosition(menu, w.Canvas(), e.AbsolutePosition)
	}

	midList = newCustomList(
		func() int { return len(midEntries) },
		func() fyne.CanvasObject { return newMyListItem(midList, actionTap, actionRight) },
		func(id widget.ListItemID, obj fyne.CanvasObject) {
			item := obj.(*myListItem)
			item.id = id
			if id < 0 || id >= len(midEntries) {
				return
			}

			entry := midEntries[id]
			name := entry.Name()
			if !Settings.ShowExtensions && !entry.IsDir() {
				name = strings.TrimSuffix(name, filepath.Ext(name))
			}
			if markedFiles[filepath.Join(currentPath, entry.Name())] {
				name = "[Z] " + name
			}
			item.label.SetText(name)

			if entry.IsDir() {
				item.icon.SetResource(theme.FolderOpenIcon())
			} else {
				item.icon.SetResource(theme.DocumentIcon())
			}
		},
	)
	midList.OnSelected = func(id widget.ListItemID) {
		selectedIndex = id
		if id >= 0 && id < len(midEntries) {
			entry := midEntries[id]
			updatePreview(filepath.Join(currentPath, entry.Name()), entry.IsDir())
		}
	}

	loadDirImpl = func(path, filter, targetToSelect string) {
		markedFiles = make(map[string]bool)
		midEntries = getEntries(path, filter)
		currentPath = path

		isUpdatingPath = true
		var opts []string
		if runtime.GOOS == "windows" {
			for _, d := range "ABCDEFGHIJKLMNOPQRSTUVWXYZ" {
				p := fmt.Sprintf("%c:\\", d)
				if _, err := os.Stat(p); err == nil {
					opts = append(opts, p)
				}
			}
		} else {
			opts = append(opts, "/")
		}
		found := false
		for _, o := range opts {
			if o == currentPath {
				found = true
				break
			}
		}
		if !found {
			opts = append(opts, currentPath)
		}

		pathSelector.Options = opts
		pathSelector.SetSelected(currentPath)
		isUpdatingPath = false

		parent := filepath.Dir(path)
		if parent != path && filter == "" {
			leftEntries = getEntries(parent, "")
		} else {
			leftEntries = nil
		}
		leftList.UnselectAll()
		leftList.Refresh()

		midList.UnselectAll()
		midList.Refresh()

		targetIndex := -1
		if targetToSelect != "" {
			for i, entry := range midEntries {
				if entry.Name() == targetToSelect {
					targetIndex = i
					break
				}
			}
		}

		if len(midEntries) > 0 {
			if targetIndex != -1 {
				midList.Select(targetIndex)
			} else {
				midList.UnselectAll()
				selectedIndex = -1
				rightContainer.Objects = []fyne.CanvasObject{widget.NewLabel("")}
				rightContainer.Refresh()
			}

			if w.Canvas().Focused() != searchEntry {
				w.Canvas().Focus(midList)
			}
		} else {
			selectedIndex = -1
			rightEntries = nil
			rightContainer.Objects = []fyne.CanvasObject{widget.NewLabel(L("empty_dir"))}
			rightContainer.Refresh()

			if w.Canvas().Focused() != searchEntry || searchEntry.Text == "" {
				w.Canvas().Focus(nil)
			}
		}
	}

	loadDir = func(path, targetToSelect string) {
		searchEntry.SetText("")
		loadDirImpl(path, "", targetToSelect)
	}

	handleKey := func(ke *fyne.KeyEvent) bool {
		isSearchActive := w.Canvas().Focused() == searchEntry

		if ke.Name == fyne.KeyEscape {
			if isSearchActive || searchEntry.Text != "" {
				searchEntry.SetText("")
				w.Canvas().Focus(midList)
				return true
			}
			if len(markedFiles) > 0 {
				markedFiles = make(map[string]bool)
				midList.Refresh()
			}
			w.Canvas().Focus(midList)
			return true
		}

		if ke.Name == fyne.KeyBackspace || ke.Name == fyne.KeyLeft {
			if isSearchActive {
				if ke.Name == fyne.KeyLeft || searchEntry.Text != "" {
					return false
				}
			}
			parent := filepath.Dir(currentPath)
			if parent != currentPath {
				loadDir(parent, filepath.Base(currentPath))
			}
			return true
		}

		if isSearchActive {
			return false
		}

		if ke.Name == fyne.KeyUp {
			if selectedIndex > 0 {
				midList.Select(selectedIndex - 1)
			}
			return true
		}
		if ke.Name == fyne.KeyDown {
			if selectedIndex < len(midEntries)-1 {
				midList.Select(selectedIndex + 1)
			} else if selectedIndex == -1 && len(midEntries) > 0 {
				midList.Select(0)
			}
			return true
		}

		keyStr := strings.ToLower(string(ke.Name))
		checkKey := func(action string) bool {
			if Settings.Shortcuts[action] == "" {
				return false
			}
			return keyStr == strings.ToLower(Settings.Shortcuts[action])
		}

		if ke.Name == fyne.KeyRight || ke.Name == fyne.KeyReturn {
			if selectedIndex >= 0 && selectedIndex < len(midEntries) {
				actionDouble(selectedIndex)
			}
			return true
		}

		if checkKey("mark") && selectedIndex >= 0 && selectedIndex < len(midEntries) {
			t := filepath.Join(currentPath, midEntries[selectedIndex].Name())
			markedFiles[t] = !markedFiles[t]
			midList.Refresh()
			if selectedIndex < len(midEntries)-1 {
				midList.Select(selectedIndex + 1)
			}
			return true
		} else if checkKey("copy") || checkKey("cut") {
			clipboardPaths = nil
			for k, v := range markedFiles {
				if v {
					clipboardPaths = append(clipboardPaths, k)
				}
			}
			if len(clipboardPaths) == 0 && selectedIndex >= 0 && selectedIndex < len(midEntries) {
				clipboardPaths = append(clipboardPaths, filepath.Join(currentPath, midEntries[selectedIndex].Name()))
			}
			if checkKey("copy") {
				clipboardAction = "copy"
			} else {
				clipboardAction = "cut"
			}

			markedFiles = make(map[string]bool)
			midList.Refresh()
			return true

		} else if checkKey("paste") && len(clipboardPaths) > 0 {
			doBatchCopy(clipboardPaths, currentPath, clipboardAction, func() {
				if clipboardAction == "cut" {
					clipboardPaths = nil
				}
				loadDir(currentPath, "")
			})
			return true
		} else if (checkKey("delete") || ke.Name == fyne.KeyDelete) && selectedIndex >= 0 && selectedIndex < len(midEntries) {
			doDelete(filepath.Join(currentPath, midEntries[selectedIndex].Name()))
			return true
		} else if checkKey("newFile") {
			dialog.ShowEntryDialog(L("new_file"), "...", func(name string) {
				if name != "" {
					os.Create(filepath.Join(currentPath, name))
					loadDir(currentPath, "")
				}
			}, w)
			return true
		} else if checkKey("newDir") {
			dialog.ShowEntryDialog(L("new_dir"), "...", func(name string) {
				if name != "" {
					os.MkdirAll(filepath.Join(currentPath, name), 0755)
					loadDir(currentPath, "")
				}
			}, w)
			return true
		} else if checkKey("archive") {
			dialog.ShowEntryDialog(L("archive"), "Nazwa (.zip):", func(name string) {
				if name != "" {
					var toZip []string
					for key, val := range markedFiles {
						if val {
							toZip = append(toZip, key)
						}
					}
					if len(toZip) == 0 && selectedIndex >= 0 && selectedIndex < len(midEntries) {
						toZip = append(toZip, filepath.Join(currentPath, midEntries[selectedIndex].Name()))
					}
					if len(toZip) > 0 {
						if !strings.HasSuffix(name, ".zip") {
							name += ".zip"
						}
						CreateZipAsync(toZip, filepath.Join(currentPath, name), func() {
							markedFiles = make(map[string]bool)
							loadDir(currentPath, "")
						})
					}
					markedFiles = make(map[string]bool)
					midList.Refresh()
				}
			}, w)
			return true
		}

		return false
	}

	midList.onCustomKey = handleKey

	midList.onCustomRune = func(r rune) bool {
		if r == '/' && w.Canvas().Focused() != searchEntry {
			w.Canvas().Focus(searchEntry)
			return true
		}
		return false
	}

	footerStr := fmt.Sprintf(L("footer_text"),
		strings.ToUpper(Settings.Shortcuts["copy"]),
		strings.ToUpper(Settings.Shortcuts["cut"]),
		strings.ToUpper(Settings.Shortcuts["paste"]),
		strings.ToUpper(Settings.Shortcuts["delete"]),
		strings.ToUpper(Settings.Shortcuts["newFile"]),
		strings.ToUpper(Settings.Shortcuts["archive"]),
		strings.ToUpper(Settings.Shortcuts["mark"]),
	)

	footerArea := container.NewVBox(
		widget.NewSeparator(),
		widget.NewLabelWithStyle(footerStr, fyne.TextAlignCenter, fyne.TextStyle{}),
	)

	BindLocalKeys = func() {
		w.Canvas().SetOnTypedKey(func(k *fyne.KeyEvent) { handleKey(k) })

		w.Canvas().SetOnTypedRune(func(r rune) {
			if r == '/' && w.Canvas().Focused() != searchEntry {
				w.Canvas().Focus(searchEntry)
			}
		})

		if Settings.ShowShortcuts {
			footerArea.Show()
		} else {
			footerArea.Hide()
		}

		if len(midEntries) > 0 {
			w.Canvas().Focus(midList)
		} else {
			w.Canvas().Focus(nil)
		}
	}

	ctrlTilde := &desktop.CustomShortcut{KeyName: fyne.KeyBackTick, Modifier: fyne.KeyModifierControl}
	w.Canvas().AddShortcut(ctrlTilde, func(shortcut fyne.Shortcut) { OpenTerminal(currentPath) })

	actionToolbar := widget.NewToolbar(
		widget.NewToolbarAction(theme.MoveUpIcon(), func() {
			parent := filepath.Dir(currentPath)
			if parent != currentPath {
				loadDir(parent, filepath.Base(currentPath))
			}
		}),
		widget.NewToolbarSeparator(),
		widget.NewToolbarAction(theme.DocumentCreateIcon(), func() { handleKey(&fyne.KeyEvent{Name: fyne.KeyName(Settings.Shortcuts["newFile"])}) }),
		widget.NewToolbarAction(theme.FolderNewIcon(), func() { handleKey(&fyne.KeyEvent{Name: fyne.KeyName(Settings.Shortcuts["newDir"])}) }),
		widget.NewToolbarSeparator(),
		widget.NewToolbarAction(theme.ContentCopyIcon(), func() { handleKey(&fyne.KeyEvent{Name: fyne.KeyName(Settings.Shortcuts["copy"])}) }),
		widget.NewToolbarAction(theme.ContentCutIcon(), func() { handleKey(&fyne.KeyEvent{Name: fyne.KeyName(Settings.Shortcuts["cut"])}) }),
		widget.NewToolbarAction(theme.ContentPasteIcon(), func() { handleKey(&fyne.KeyEvent{Name: fyne.KeyName(Settings.Shortcuts["paste"])}) }),
		widget.NewToolbarSeparator(),
		widget.NewToolbarAction(theme.DeleteIcon(), func() { handleKey(&fyne.KeyEvent{Name: fyne.KeyDelete}) }),
	)

	settingsBtn := widget.NewButtonWithIcon("", theme.SettingsIcon(), openSettings)
	settingsBtn.Importance = widget.LowImportance
	smallSettings := container.NewGridWrap(fyne.NewSize(36, 36), settingsBtn)

	emptyLeftSpace := container.NewHBox()

	searchBar := container.NewBorder(nil, nil, widget.NewIcon(theme.SearchIcon()), nil, searchEntry)
	topHeader := container.NewBorder(nil, nil, emptyLeftSpace, smallSettings, pathSelector)

	topArea := container.NewVBox(topHeader, widget.NewSeparator(), searchBar, widget.NewSeparator(), actionToolbar, widget.NewSeparator())

	cols := container.NewGridWithColumns(3, leftList, midList, container.NewPadded(rightContainer))

	startDir := Settings.DefaultPath
	if startDir == "" {
		startDir, _ = os.UserHomeDir()
	}
	loadDir(startDir, "")

	return container.NewBorder(topArea, footerArea, nil, nil, cols)
}
