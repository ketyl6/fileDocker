package main

import (
	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"
)

func MakeSettingsView(w fyne.Window, onClose func()) fyne.CanvasObject {
	w.Canvas().SetOnTypedKey(func(ke *fyne.KeyEvent) {
		if ke.Name == fyne.KeyEscape {
			onClose()
		}
	})

	hiddenCheck := widget.NewCheck(L("opt_hidden"), func(v bool) { Settings.ShowHidden = v })
	hiddenCheck.SetChecked(Settings.ShowHidden)

	extCheck := widget.NewCheck(L("opt_ext"), func(v bool) { Settings.ShowExtensions = v })
	extCheck.SetChecked(Settings.ShowExtensions)

	foldersCheck := widget.NewCheck(L("opt_folders"), func(v bool) { Settings.FoldersFirst = v })
	foldersCheck.SetChecked(Settings.FoldersFirst)

	confirmCheck := widget.NewCheck(L("opt_confirm"), func(v bool) { Settings.ConfirmDelete = v })
	confirmCheck.SetChecked(Settings.ConfirmDelete)

	shortcutsCheck := widget.NewCheck(L("opt_shortcuts"), func(v bool) { Settings.ShowShortcuts = v })
	shortcutsCheck.SetChecked(Settings.ShowShortcuts)

	pathEntry := widget.NewEntry()
	pathEntry.SetText(Settings.DefaultPath)
	pathEntry.OnChanged = func(s string) { Settings.DefaultPath = s }

	termEntry := widget.NewEntry()
	termEntry.SetText(Settings.CustomTerminal)
	termEntry.OnChanged = func(s string) { Settings.CustomTerminal = s }

	availableLangs := GetAvailableLanguages()
	langSelect := widget.NewSelect(availableLangs, func(s string) {
		if Settings.Language != s {
			Settings.Language = s
			SaveConfig()
			InitLang()
			dialog.ShowInformation("Restart", "Please restart the application to fully apply the language change.", w)
		}
	})
	langSelect.SetSelected(Settings.Language)

	form := widget.NewForm(
		widget.NewFormItem(L("opt_def_path"), pathEntry),
		widget.NewFormItem(L("opt_term"), termEntry),
		widget.NewFormItem(L("opt_lang"), langSelect),
	)

	scForm := widget.NewForm()
	scEntries := make(map[string]*widget.Entry)
	for k, v := range Settings.Shortcuts {
		e := widget.NewEntry()
		e.SetText(v)
		scEntries[k] = e
		scForm.Append(k, e)
	}

	topBar := container.NewBorder(nil, nil,
		widget.NewButtonWithIcon("", theme.NavigateBackIcon(), onClose),
		nil,
		widget.NewLabelWithStyle(L("settings"), fyne.TextAlignLeading, fyne.TextStyle{Bold: true}),
	)

	saveBtn := widget.NewButton("Save Settings", func() {
		for k, e := range scEntries {
			Settings.Shortcuts[k] = e.Text
		}
		SaveConfig()
		onClose()
	})
	saveBtn.Importance = widget.HighImportance

	content := container.NewVScroll(container.NewVBox(
		hiddenCheck,
		extCheck,
		foldersCheck,
		confirmCheck,
		shortcutsCheck,
		widget.NewSeparator(),
		form,
		widget.NewSeparator(),
		widget.NewLabelWithStyle("Shortcuts", fyne.TextAlignLeading, fyne.TextStyle{Bold: true}),
		scForm,
	))

	return container.NewBorder(
		container.NewVBox(topBar, widget.NewSeparator()),
		container.NewVBox(widget.NewSeparator(), container.NewPadded(saveBtn)),
		nil, nil,
		container.NewPadded(content),
	)
}
