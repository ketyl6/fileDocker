package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

type AppSettings struct {
	ShowHidden     bool              `json:"showHidden"`
	ShowExtensions bool              `json:"showExtensions"`
	FoldersFirst   bool              `json:"foldersFirst"`
	DefaultPath    string            `json:"defaultPath"`
	ConfirmDelete  bool              `json:"confirmDelete"`
	CustomTerminal string            `json:"customTerminal"`
	Language       string            `json:"language"`
	ShowShortcuts  bool              `json:"showShortcuts"`
	Shortcuts      map[string]string `json:"shortcuts"`
}

var Settings AppSettings
var Lang map[string]string

func getSettingsPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "config.json")
}

func getLangDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".config", "fileDocker", "lang")
}

func LoadConfig() {
	Settings = AppSettings{
		ShowHidden:     false,
		ShowExtensions: true,
		FoldersFirst:   true,
		ConfirmDelete:  true,
		ShowShortcuts:  true,
		Language:       "en",
		Shortcuts: map[string]string{
			"copy":     "c",
			"cut":      "x",
			"paste":    "v",
			"delete":   "Delete",
			"newFile":  "n",
			"newDir":   "N",
			"terminal": "t",
			"mark":     "z",
			"archive":  "P",
			"unzip":    "u",
		},
	}

	data, err := os.ReadFile(getSettingsPath())
	if err == nil {
		json.Unmarshal(data, &Settings)
	}
	if Settings.Shortcuts == nil {
		Settings.Shortcuts = make(map[string]string)
	}
}

func SaveConfig() {
	data, err := json.MarshalIndent(Settings, "", "  ")
	if err == nil {
		os.WriteFile(getSettingsPath(), data, 0644)
	}
}

func InitLang() {
	baseLang := map[string]string{
		"loading":       "Loading...",
		"search":        "Search files... (/)",
		"empty_dir":     "Empty directory",
		"del_title":     "Delete",
		"del_msg":       "Are you sure you want to delete?",
		"copy":          "Copy",
		"cut":           "Cut",
		"paste":         "Paste",
		"delete":        "Delete",
		"term_here":     "Terminal here",
		"new_file":      "New file",
		"new_dir":       "New folder",
		"archive":       "Create ZIP",
		"unzip":         "Extract",
		"settings":      "Settings",
		"opt_hidden":    "Show hidden files",
		"opt_ext":       "Show file extensions",
		"opt_folders":   "Folders first",
		"opt_confirm":   "Confirm deletion",
		"opt_def_path":  "Default path",
		"opt_term":      "Custom terminal (leave empty for default)",
		"opt_lang":      "Language",
		"opt_shortcuts": "Show shortcuts footer",
		"footer_text":   "Shortcuts: [/] Search | [%s] Copy | [%s] Cut | [%s] Paste | [%s] Delete | [%s] File | [Ctrl+~] Terminal | [%s] Zip | [%s] Mark | [Arrows] Navigation",
	}

	Lang = make(map[string]string)
	for k, v := range baseLang {
		Lang[k] = v
	}

	langDir := getLangDir()
	os.MkdirAll(langDir, 0755)

	langFile := filepath.Join(langDir, Settings.Language+".json")
	data, err := os.ReadFile(langFile)

	if err == nil {
		var loadedLang map[string]string
		if json.Unmarshal(data, &loadedLang) == nil {
			for k, v := range loadedLang {
				Lang[k] = v
			}
		}
	}

	d, _ := json.MarshalIndent(Lang, "", "  ")
	os.WriteFile(langFile, d, 0644)
}

func GetAvailableLanguages() []string {
	langDir := getLangDir()
	files, err := os.ReadDir(langDir)
	if err != nil {
		return []string{"en"}
	}

	var langs []string
	for _, f := range files {
		if !f.IsDir() && strings.HasSuffix(f.Name(), ".json") {
			langs = append(langs, strings.TrimSuffix(f.Name(), ".json"))
		}
	}

	if len(langs) == 0 {
		return []string{"en"}
	}
	return langs
}

func L(k string) string {
	if v, ok := Lang[k]; ok {
		return v
	}
	return k
}
