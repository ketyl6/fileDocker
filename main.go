package main

import (
	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
)

func main() {
	LoadConfig()
	InitLang()

	a := app.New()
	w := a.NewWindow("fileDocker")

	var localView, settingsView fyne.CanvasObject

	showLocal := func() {
		w.SetContent(localView)
		if BindLocalKeys != nil {
			BindLocalKeys()
		}
	}

	showSettings := func() {
		settingsView = MakeSettingsView(w, showLocal)
		w.SetContent(settingsView)
	}

	localView = MakeLocalView(w, showSettings)
	showLocal()

	w.Resize(fyne.NewSize(1100, 750))
	w.ShowAndRun()
}
