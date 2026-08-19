package main

import (
	"archive/tar"
	"archive/zip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

type App struct {
	ctx        context.Context
	driveToken string
}

type AppSettings struct {
	AppScale         float64           `json:"appScale"`
	ShowHidden       bool              `json:"showHidden"`
	ShowExtensions   bool              `json:"showExtensions"`
	FoldersFirst     bool              `json:"foldersFirst"`
	IsDarkTheme      bool              `json:"isDarkTheme"`
	DefaultPath      string            `json:"defaultPath"`
	ConfirmDelete    bool              `json:"confirmDelete"`
	CustomTerminal   string            `json:"customTerminal"`
	CacheCleanupDays int               `json:"cacheCleanupDays"`
	ProjectsPath     string            `json:"projectsPath"`
	CustomCleanPaths []string          `json:"customCleanPaths"`
	Shortcuts        map[string]string `json:"shortcuts"`
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.autoCleanCache()
}

func getAppCacheDir() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	var cacheDir string
	if runtime.GOOS == "windows" {
		cacheDir = filepath.Join(os.Getenv("LOCALAPPDATA"), "fileDocker", "Cache")
	} else {
		cacheDir = filepath.Join(homeDir, ".cache", "fileDocker")
	}
	os.MkdirAll(cacheDir, 0755)
	return cacheDir, nil
}

func (a *App) autoCleanCache() {
	settings := a.GetSettings()
	if settings.CacheCleanupDays <= 0 {
		return
	}
	cacheDir, err := getAppCacheDir()
	if err != nil {
		return
	}
	entries, err := os.ReadDir(cacheDir)
	if err != nil {
		return
	}
	now := time.Now()
	for _, e := range entries {
		info, err := e.Info()
		if err == nil {
			if now.Sub(info.ModTime()).Hours() > float64(settings.CacheCleanupDays*24) {
				os.RemoveAll(filepath.Join(cacheDir, e.Name()))
			}
		}
	}
}

func (a *App) CleanAppCache() (string, error) {
	cacheDir, err := getAppCacheDir()
	if err != nil {
		return "", err
	}
	entries, err := os.ReadDir(cacheDir)
	if err != nil {
		return "Brak plikow cache", nil
	}
	count := 0
	for _, e := range entries {
		os.RemoveAll(filepath.Join(cacheDir, e.Name()))
		count++
	}
	return fmt.Sprintf("Wyczyszczono pamięć podręczną.\nUsunięto %d plików z cache Google Drive.", count), nil
}

type FileInfo struct {
	Name  string `json:"name"`
	IsDir bool   `json:"isDir"`
	Path  string `json:"path"`
	Id    string `json:"id"`
}

type RangerState struct {
	CurrentPath string     `json:"currentPath"`
	ParentPath  string     `json:"parentPath"`
	Files       []FileInfo `json:"files"`
}

func (a *App) GetOS() string {
	return runtime.GOOS
}

func (a *App) GetDrives() []string {
	var drives []string
	if runtime.GOOS == "windows" {
		for _, drive := range "ABCDEFGHIJKLMNOPQRSTUVWXYZ" {
			path := string(drive) + ":\\"
			if _, err := os.Stat(path); err == nil {
				drives = append(drives, path)
			}
		}
	}
	return drives
}

func (a *App) GetRangerData(targetPath string, showHidden bool) (RangerState, error) {
	if targetPath == "" {
		targetPath, _ = os.UserHomeDir()
	}
	absPath, err := filepath.Abs(targetPath)
	if err == nil {
		targetPath = absPath
	}
	targetPath = filepath.Clean(targetPath)
	for {
		info, err := os.Stat(targetPath)
		if err == nil && info.IsDir() {
			break
		}
		parent := filepath.Dir(targetPath)
		if parent == targetPath || parent == "" {
			targetPath, _ = os.UserHomeDir()
			break
		}
		targetPath = parent
	}
	entries, err := os.ReadDir(targetPath)
	if err != nil {
		return RangerState{}, err
	}
	var files []FileInfo
	for _, entry := range entries {
		fullPath := filepath.Join(targetPath, entry.Name())
		if !showHidden && isFileHidden(fullPath, entry.Name()) {
			continue
		}
		files = append(files, FileInfo{
			Name:  entry.Name(),
			IsDir: entry.IsDir(),
			Path:  fullPath,
		})
	}
	parentPath := filepath.Dir(targetPath)
	if parentPath == targetPath || parentPath == targetPath+"\\" {
		parentPath = ""
	}
	return RangerState{
		CurrentPath: targetPath,
		ParentPath:  parentPath,
		Files:       files,
	}, nil
}

func (a *App) GetFileInfo(path string) map[string]interface{} {
	info, err := os.Stat(path)
	if err != nil {
		return nil
	}
	return map[string]interface{}{
		"size":    info.Size(),
		"modTime": info.ModTime().Format("2006-01-02 15:04:05"),
		"mode":    info.Mode().String(),
		"isDir":   info.IsDir(),
	}
}

func (a *App) ReadFilePreview(targetPath string) (string, error) {
	info, err := os.Stat(targetPath)
	if err != nil || info.IsDir() {
		return "", err
	}
	if info.Size() > 100000 {
		return "Plik za duzy na podglad tekstowy", nil
	}
	data, err := os.ReadFile(targetPath)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (a *App) FileAction(action string, sources []string, destination string) error {
	for _, src := range sources {
		switch action {
		case "delete":
			err := os.RemoveAll(src)
			if err != nil {
				return fmt.Errorf("blad usuwania: %v", err)
			}
		case "copy":
			info, _ := os.Stat(src)
			if info != nil && info.IsDir() {
				rel, err := filepath.Rel(src, destination)
				if err == nil && !strings.HasPrefix(rel, "..") {
					return fmt.Errorf("nie mozna wkleic folderu do jego wlasnego wnetrza")
				}
			}
			dest := filepath.Join(destination, filepath.Base(src))
			if src == dest {
				dest = filepath.Join(destination, "Kopia - "+filepath.Base(src))
			}
			err := copyItem(src, dest)
			if err != nil {
				return fmt.Errorf("blad kopiowania: %v", err)
			}
		case "cut":
			info, _ := os.Stat(src)
			if info != nil && info.IsDir() {
				rel, err := filepath.Rel(src, destination)
				if err == nil && !strings.HasPrefix(rel, "..") {
					return fmt.Errorf("nie mozna przeniesc folderu do jego wlasnego wnetrza")
				}
			}
			dest := filepath.Join(destination, filepath.Base(src))
			if src == dest {
				continue
			}
			err := copyItem(src, dest)
			if err != nil {
				return fmt.Errorf("blad przenoszenia: %v", err)
			}
			os.RemoveAll(src)
		default:
			return fmt.Errorf("nieznana akcja")
		}
	}
	return nil
}

func (a *App) CreateItem(path string, isDir bool) error {
	if isDir {
		return os.MkdirAll(path, 0755)
	}
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	f.Close()
	return nil
}

func copyItem(src, dst string) error {
	info, err := os.Stat(src)
	if err != nil {
		return err
	}
	if info.IsDir() {
		return copyDir(src, dst)
	}
	return copyFile(src, dst)
}

func copyDir(src string, dst string) error {
	err := os.MkdirAll(dst, 0755)
	if err != nil {
		return err
	}
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())
		if entry.IsDir() {
			err = copyDir(srcPath, dstPath)
			if err != nil {
				return err
			}
		} else {
			err = copyFile(srcPath, dstPath)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func copyFile(src, dst string) error {
	source, err := os.Open(src)
	if err != nil {
		return err
	}
	defer source.Close()
	destination, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destination.Close()
	_, err = io.Copy(destination, source)
	return err
}

func (a *App) CreateArchive(srcPaths []string, destName string, format string) error {
	if len(srcPaths) == 0 {
		return fmt.Errorf("brak plikow do spakowania")
	}
	baseDir := filepath.Dir(srcPaths[0])
	ext := "." + format
	if filepath.Ext(destName) == ext {
		destName = destName[:len(destName)-len(ext)]
	}
	destPath := filepath.Join(baseDir, destName+ext)
	switch format {
	case "zip":
		return createZip(srcPaths, destPath, baseDir)
	case "tar":
		return createTar(srcPaths, destPath, baseDir)
	case "rar":
		return createRar(srcPaths, destPath, baseDir)
	default:
		return fmt.Errorf("nieobslugiwany format archiwum")
	}
}

func createZip(srcPaths []string, destPath string, baseDir string) error {
	f, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer f.Close()
	writer := zip.NewWriter(f)
	defer writer.Close()
	for _, src := range srcPaths {
		err = filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			if path == destPath {
				return nil
			}
			header, err := zip.FileInfoHeader(info)
			if err != nil {
				return err
			}
			header.Method = zip.Deflate
			relPath, err := filepath.Rel(baseDir, path)
			if err != nil {
				return err
			}
			header.Name = filepath.ToSlash(relPath)
			if info.IsDir() {
				header.Name += "/"
			}
			headerWriter, err := writer.CreateHeader(header)
			if err != nil {
				return err
			}
			if info.IsDir() {
				return nil
			}
			f1, err := os.Open(path)
			if err != nil {
				return err
			}
			defer f1.Close()
			_, err = io.Copy(headerWriter, f1)
			return err
		})
		if err != nil {
			return err
		}
	}
	return nil
}

func createTar(srcPaths []string, destPath string, baseDir string) error {
	f, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer f.Close()
	writer := tar.NewWriter(f)
	defer writer.Close()
	for _, src := range srcPaths {
		err = filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			if path == destPath {
				return nil
			}
			header, err := tar.FileInfoHeader(info, info.Name())
			if err != nil {
				return err
			}
			relPath, err := filepath.Rel(baseDir, path)
			if err != nil {
				return err
			}
			header.Name = filepath.ToSlash(relPath)
			if err := writer.WriteHeader(header); err != nil {
				return err
			}
			if info.IsDir() {
				return nil
			}
			f1, err := os.Open(path)
			if err != nil {
				return err
			}
			defer f1.Close()
			_, err = io.Copy(writer, f1)
			return err
		})
		if err != nil {
			return err
		}
	}
	return nil
}

func createRar(srcPaths []string, destPath string, baseDir string) error {
	args := []string{"a", destPath}
	for _, src := range srcPaths {
		args = append(args, filepath.Base(src))
	}
	cmd := exec.Command("rar", args...)
	cmd.Dir = baseDir
	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("blad tworzenia RAR: %v", err)
	}
	return nil
}

func (a *App) UnzipItem(src string) error {
	ext := strings.ToLower(filepath.Ext(src))
	dest := src[:len(src)-len(ext)]
	err := os.MkdirAll(dest, 0755)
	if err != nil {
		return err
	}
	switch ext {
	case ".zip":
		return extractZip(src, dest)
	case ".tar":
		return extractTar(src, dest)
	case ".rar":
		return extractRar(src, dest)
	default:
		return fmt.Errorf("nieobslugiwany format do wypakowania: %s", ext)
	}
}

func extractZip(src string, dest string) error {
	reader, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer reader.Close()
	for _, file := range reader.File {
		path := filepath.Join(dest, file.Name)
		if file.FileInfo().IsDir() {
			os.MkdirAll(path, file.Mode())
			continue
		}
		os.MkdirAll(filepath.Dir(path), 0755)
		f1, err := file.Open()
		if err != nil {
			return err
		}
		f2, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, file.Mode())
		if err != nil {
			f1.Close()
			return err
		}
		io.Copy(f2, f1)
		f1.Close()
		f2.Close()
	}
	return nil
}

func extractTar(src string, dest string) error {
	f, err := os.Open(src)
	if err != nil {
		return err
	}
	defer f.Close()
	tr := tar.NewReader(f)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		path := filepath.Join(dest, hdr.Name)
		if hdr.FileInfo().IsDir() {
			os.MkdirAll(path, hdr.FileInfo().Mode())
			continue
		}
		os.MkdirAll(filepath.Dir(path), 0755)
		f2, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, hdr.FileInfo().Mode())
		if err != nil {
			return err
		}
		io.Copy(f2, tr)
		f2.Close()
	}
	return nil
}

func extractRar(src string, dest string) error {
	cmd := exec.Command("unrar", "x", "-y", src, dest+string(filepath.Separator))
	err := cmd.Run()
	if err != nil {
		cmd = exec.Command("rar", "x", "-y", src, dest+string(filepath.Separator))
		err = cmd.Run()
		if err != nil {
			return fmt.Errorf("blad wypakowywania RAR: %v", err)
		}
	}
	return nil
}

func (a *App) OpenTerminal(dir string, customTerm string) error {
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		term := "cmd"
		if customTerm != "" {
			term = customTerm
		}
		cmd = exec.Command("cmd", "/c", "start", term)
	} else if runtime.GOOS == "darwin" {
		term := "Terminal"
		if customTerm != "" {
			term = customTerm
		}
		cmd = exec.Command("open", "-a", term, dir)
		return cmd.Start()
	} else {
		term := "x-terminal-emulator"
		if customTerm != "" {
			term = customTerm
		}
		cmd = exec.Command(term)
	}
	cmd.Dir = dir
	return cmd.Start()
}

func (a *App) CleanTempFiles() (string, error) {
	if runtime.GOOS != "windows" {
		return "Oczyszczanie plików tymczasowych systemu jest dostępne tylko na systemie Windows.", nil
	}

	var dirs []string
	dirs = append(dirs, os.TempDir())
	dirs = append(dirs, filepath.Join(os.Getenv("WINDIR"), "Temp"))
	dirs = append(dirs, filepath.Join(os.Getenv("LOCALAPPDATA"), "Temp"))

	deletedCount := 0
	var cleanedDirs []string
	for _, d := range dirs {
		if d == "" {
			continue
		}
		entries, err := os.ReadDir(d)
		if err != nil {
			continue
		}
		cleanedDirs = append(cleanedDirs, d)
		for _, entry := range entries {
			fullPath := filepath.Join(d, entry.Name())
			err := os.RemoveAll(fullPath)
			if err == nil {
				deletedCount++
			}
		}
	}
	return fmt.Sprintf("Wyczyszczono tymczasowe pliki systemu.\nUsunięto %d elementów.\n\nSprawdzone lokalizacje:\n%s", deletedCount, strings.Join(cleanedDirs, "\n")), nil
}

func (a *App) CleanCustomPaths() (string, error) {
	if runtime.GOOS != "windows" {
		return "Oczyszczanie niestandardowych folderów jest dostępne tylko na systemie Windows.", nil
	}

	settings := a.GetSettings()
	if len(settings.CustomCleanPaths) == 0 {
		return "Brak zdefiniowanych niestandardowych folderów w Ustawieniach.", nil
	}

	deletedCount := 0
	var cleanedDirs []string
	for _, d := range settings.CustomCleanPaths {
		if d == "" {
			continue
		}
		info, err := os.Stat(d)
		if err != nil || !info.IsDir() {
			continue
		}
		entries, err := os.ReadDir(d)
		if err != nil {
			continue
		}
		cleanedDirs = append(cleanedDirs, d)
		for _, entry := range entries {
			fullPath := filepath.Join(d, entry.Name())
			err := os.RemoveAll(fullPath)
			if err == nil {
				deletedCount++
			}
		}
	}
	if len(cleanedDirs) == 0 {
		return "Nie znaleziono i nie wyczyszczono żadnych prawidłowych folderów zdefiniowanych w ustawieniach.", nil
	}
	return fmt.Sprintf("Wyczyszczono foldery niestandardowe.\nUsunięto %d elementów.\n\nSprawdzone lokalizacje:\n%s", deletedCount, strings.Join(cleanedDirs, "\n")), nil
}

func getDockerConfigDir() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(homeDir, ".config", "fileDocker"), nil
}

func (a *App) GetSettings() AppSettings {
	defaultSettings := AppSettings{
		AppScale:         1.0,
		ShowHidden:       false,
		ShowExtensions:   true,
		FoldersFirst:     true,
		IsDarkTheme:      true,
		DefaultPath:      "",
		ConfirmDelete:    true,
		CustomTerminal:   "",
		CacheCleanupDays: 7,
		ProjectsPath:     "",
		CustomCleanPaths: []string{},
		Shortcuts: map[string]string{
			"copy":        "c",
			"cut":         "x",
			"paste":       "v",
			"delete":      "Delete",
			"newFile":     "n",
			"newDir":      "n",
			"terminal":    "t",
			"mark":        "z",
			"archive":     "p",
			"unzip":       "u",
			"dualPane":    "d",
			"download":    "s",
			"switchDrive": "w",
			"settings":    ",",
		},
	}
	cfgDir, err := getDockerConfigDir()
	if err != nil {
		return defaultSettings
	}
	path := filepath.Join(cfgDir, "settings.json")
	data, err := os.ReadFile(path)
	if err == nil {
		json.Unmarshal(data, &defaultSettings)
	}
	a.SaveSettings(defaultSettings)
	return defaultSettings
}

func (a *App) SaveSettings(settings AppSettings) error {
	cfgDir, err := getDockerConfigDir()
	if err != nil {
		return err
	}
	os.MkdirAll(cfgDir, 0755)
	path := filepath.Join(cfgDir, "settings.json")
	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func (a *App) OpenSettingsFile() error {
	cfgDir, err := getDockerConfigDir()
	if err != nil {
		return err
	}
	os.MkdirAll(cfgDir, 0755)
	path := filepath.Join(cfgDir, "settings.json")
	a.GetSettings()
	return a.OpenFileCustom(path, "")
}

func (a *App) OpenAssociationsFile() error {
	cfgDir, err := getDockerConfigDir()
	if err != nil {
		return err
	}
	os.MkdirAll(cfgDir, 0755)
	path := filepath.Join(cfgDir, "filer.json")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		os.WriteFile(path, []byte("{\n  \".txt\": \"notepad\",\n  \".png\": \"\"\n}"), 0644)
	}
	return a.OpenFileCustom(path, "")
}

func (a *App) GetFileAssociations() map[string]string {
	assoc := make(map[string]string)
	cfgDir, err := getDockerConfigDir()
	if err != nil {
		return assoc
	}
	path := filepath.Join(cfgDir, "filer.json")
	data, err := os.ReadFile(path)
	if err == nil {
		json.Unmarshal(data, &assoc)
	}
	return assoc
}

func (a *App) OpenFileCustom(filePath string, appName string) error {
	if appName != "" {
		var cmd *exec.Cmd
		if runtime.GOOS == "windows" {
			cmd = exec.Command("cmd", "/c", "start", "", appName, filePath)
		} else {
			cmd = exec.Command(appName, filePath)
		}
		return cmd.Start()
	}
	switch runtime.GOOS {
	case "linux":
		return exec.Command("xdg-open", filePath).Start()
	case "windows":
		return exec.Command("rundll32", "url.dll,FileProtocolHandler", filePath).Start()
	case "darwin":
		return exec.Command("open", filePath).Start()
	}
	return fmt.Errorf("nieobslugiwany system")
}

func (a *App) IsDriveAuthenticated() bool {
	if a.driveToken != "" {
		return true
	}
	cfgDir, err := getDockerConfigDir()
	if err != nil {
		return false
	}
	tokenFile := filepath.Join(cfgDir, "google_token.txt")
	b, err := os.ReadFile(tokenFile)
	if err == nil && len(b) > 0 {
		a.driveToken = string(b)
		return true
	}
	return false
}

func (a *App) LogoutGoogle() error {
	a.driveToken = ""
	cfgDir, err := getDockerConfigDir()
	if err == nil {
		tokenFile := filepath.Join(cfgDir, "google_token.txt")
		os.Remove(tokenFile)
	}
	return nil
}

func (a *App) LoginGoogle(clientID string, clientSecret string) (string, error) {
	if clientID == "" || clientSecret == "" {
		return "", fmt.Errorf("brak danych logowania")
	}
	codeChan := make(chan string)
	srv := &http.Server{Addr: "127.0.0.1:8080"}
	http.HandleFunc("/oauth2callback", func(w http.ResponseWriter, r *http.Request) {
		code := r.URL.Query().Get("code")
		fmt.Fprintf(w, "<html><body>Autoryzacja zakonczona.</body></html>")
		go func() { codeChan <- code }()
	})
	go func() {
		srv.ListenAndServe()
	}()
	authURL := fmt.Sprintf("https://accounts.google.com/o/oauth2/v2/auth?client_id=%s&redirect_uri=http://127.0.0.1:8080/oauth2callback&response_type=code&scope=https://www.googleapis.com/auth/drive", clientID)
	var err error
	switch runtime.GOOS {
	case "linux":
		err = exec.Command("xdg-open", authURL).Start()
	case "windows":
		err = exec.Command("rundll32", "url.dll,FileProtocolHandler", authURL).Start()
	case "darwin":
		err = exec.Command("open", authURL).Start()
	}
	if err != nil {
		return "", err
	}
	code := <-codeChan
	srv.Shutdown(context.Background())
	resp, err := http.PostForm("https://oauth2.googleapis.com/token", url.Values{
		"code":          {code},
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"redirect_uri":  {"http://127.0.0.1:8080/oauth2callback"},
		"grant_type":    {"authorization_code"},
	})
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var tokenRes map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&tokenRes)
	if token, ok := tokenRes["access_token"].(string); ok {
		a.driveToken = token
		cfgDir, err := getDockerConfigDir()
		if err == nil {
			os.MkdirAll(cfgDir, 0755)
			tokenFile := filepath.Join(cfgDir, "google_token.txt")
			os.WriteFile(tokenFile, []byte(token), 0600)
		}
		return "Zalogowano pomyslnie", nil
	}
	return "", fmt.Errorf("blad autoryzacji")
}

func (a *App) GetDriveData(folderId string) (RangerState, error) {
	if a.driveToken == "" {
		return RangerState{}, fmt.Errorf("nie zalogowano")
	}
	if folderId == "" {
		folderId = "root"
	}
	query := fmt.Sprintf("'%s' in parents and trashed=false", folderId)
	escapedQuery := url.QueryEscape(query)
	reqURL := fmt.Sprintf("https://www.googleapis.com/drive/v3/files?q=%s&fields=files(id,name,mimeType)&supportsAllDrives=true&includeItemsFromAllDrives=true", escapedQuery)
	req, _ := http.NewRequest("GET", reqURL, nil)
	req.Header.Add("Authorization", "Bearer "+a.driveToken)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return RangerState{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode == 401 {
			a.LogoutGoogle()
			return RangerState{}, fmt.Errorf("sesja wygasla")
		}
		bodyBytes, _ := io.ReadAll(resp.Body)
		return RangerState{}, fmt.Errorf("odmowa API Google: %s", string(bodyBytes))
	}
	var res struct {
		Files []struct {
			Id       string `json:"id"`
			Name     string `json:"name"`
			MimeType string `json:"mimeType"`
		} `json:"files"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return RangerState{}, fmt.Errorf("blad JSON: %v", err)
	}
	var files []FileInfo
	for _, f := range res.Files {
		files = append(files, FileInfo{
			Name:  f.Name,
			IsDir: f.MimeType == "application/vnd.google-apps.folder",
			Path:  f.Id,
			Id:    f.Id,
		})
	}
	return RangerState{
		CurrentPath: folderId,
		ParentPath:  "",
		Files:       files,
	}, nil
}

func (a *App) DownloadFromDrive(fileId string, fileName string, target string) (string, error) {
	if a.driveToken == "" {
		return "", fmt.Errorf("nie zalogowano")
	}
	var destFolder string
	if target == "CACHE" {
		destFolder, _ = getAppCacheDir()
	} else if target == "DOWNLOADS" {
		home, _ := os.UserHomeDir()
		destFolder = filepath.Join(home, "Downloads")
		os.MkdirAll(destFolder, 0755)
	} else {
		destFolder = target
	}
	destPath := filepath.Join(destFolder, fileName)
	reqURL := fmt.Sprintf("https://www.googleapis.com/drive/v3/files/%s?alt=media", fileId)
	req, _ := http.NewRequest("GET", reqURL, nil)
	req.Header.Add("Authorization", "Bearer "+a.driveToken)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("blad pobierania")
	}
	out, err := os.Create(destPath)
	if err != nil {
		return "", err
	}
	defer out.Close()
	_, err = io.Copy(out, resp.Body)
	return destPath, err
}

func (a *App) DeleteDriveFile(fileId string) error {
	if a.driveToken == "" {
		return fmt.Errorf("nie zalogowano")
	}
	reqURL := fmt.Sprintf("https://www.googleapis.com/drive/v3/files/%s", fileId)
	req, _ := http.NewRequest("DELETE", reqURL, nil)
	req.Header.Add("Authorization", "Bearer "+a.driveToken)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 204 {
		return fmt.Errorf("blad usuwania")
	}
	return nil
}

func (a *App) IsGitInstalled() bool {
	_, err := exec.LookPath("git")
	return err == nil
}

type GitRepo struct {
	Name   string `json:"name"`
	Path   string `json:"path"`
	Branch string `json:"branch"`
	Status string `json:"status"`
}

func (a *App) ScanGitRepos(basePath string) ([]GitRepo, error) {
	if basePath == "" {
		basePath, _ = os.UserHomeDir()
	}
	var repos []GitRepo
	entries, err := os.ReadDir(basePath)
	if err != nil {
		return nil, err
	}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		p := filepath.Join(basePath, e.Name())
		if isGitRepo(p) {
			repos = append(repos, a.getGitInfo(p, e.Name()))
		} else {
			subEntries, err := os.ReadDir(p)
			if err == nil {
				for _, sub := range subEntries {
					if !sub.IsDir() {
						continue
					}
					subP := filepath.Join(p, sub.Name())
					if isGitRepo(subP) {
						repos = append(repos, a.getGitInfo(subP, sub.Name()))
					}
				}
			}
		}
	}
	return repos, nil
}

func isGitRepo(path string) bool {
	info, err := os.Stat(filepath.Join(path, ".git"))
	return err == nil && info.IsDir()
}

func (a *App) getGitInfo(path string, name string) GitRepo {
	repo := GitRepo{Name: name, Path: path, Branch: "master", Status: "czyste"}
	cmd := exec.Command("git", "rev-parse", "--abbrev-ref", "HEAD")
	cmd.Dir = path
	out, err := cmd.Output()
	if err == nil {
		repo.Branch = strings.TrimSpace(string(out))
	}
	cmd2 := exec.Command("git", "status", "-s")
	cmd2.Dir = path
	out2, err := cmd2.Output()
	if err == nil {
		strOut := strings.TrimSpace(string(out2))
		if strOut != "" {
			lines := strings.Split(strOut, "\n")
			repo.Status = fmt.Sprintf("%d zmienionych", len(lines))
		}
	}
	return repo
}

type GitCommit struct {
	Hash    string `json:"hash"`
	Message string `json:"message"`
	Date    string `json:"date"`
}

func (a *App) GetGitHistory(path string) ([]GitCommit, error) {
	cmd := exec.Command("git", "log", "-n", "50", "--pretty=format:%h|%s|%cr")
	cmd.Dir = path
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	var commits []GitCommit
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		parts := strings.SplitN(line, "|", 3)
		if len(parts) == 3 {
			commits = append(commits, GitCommit{Hash: parts[0], Message: parts[1], Date: parts[2]})
		}
	}
	return commits, nil
}

func (a *App) CheckoutGitCommit(path, hash string) error {
	cmd := exec.Command("git", "checkout", hash)
	cmd.Dir = path
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("checkout error: %s", string(out))
	}
	return nil
}

func (a *App) GetLocalGitBranches(path string) ([]string, error) {
	cmd := exec.Command("git", "branch", "--format=%(refname:short)")
	cmd.Dir = path
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	var branches []string
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			branches = append(branches, line)
		}
	}
	return branches, nil
}

type RemoteRepo struct {
	Name        string `json:"name"`
	FullName    string `json:"fullName"`
	Description string `json:"description"`
	CloneURL    string `json:"cloneUrl"`
}

func (a *App) SearchGitHub(query string) ([]RemoteRepo, error) {
	if query == "" {
		return nil, fmt.Errorf("puste zapytanie")
	}

	escaped := url.QueryEscape(query)
	var repos []RemoteRepo
	var wg sync.WaitGroup
	var mutex sync.Mutex
	seen := make(map[string]bool)

	wg.Add(1)
	go func() {
		defer wg.Done()
		resp, err := http.Get("https://api.github.com/search/repositories?q=" + escaped + "&per_page=15")
		if err == nil && resp.StatusCode == 200 {
			defer resp.Body.Close()
			var res struct {
				Items []struct {
					Name        string `json:"name"`
					FullName    string `json:"full_name"`
					Description string `json:"description"`
					CloneURL    string `json:"clone_url"`
				} `json:"items"`
			}
			if json.NewDecoder(resp.Body).Decode(&res) == nil {
				mutex.Lock()
				for _, item := range res.Items {
					if !seen[item.FullName] {
						seen[item.FullName] = true
						repos = append(repos, RemoteRepo{
							Name:        item.Name,
							FullName:    item.FullName,
							Description: item.Description,
							CloneURL:    item.CloneURL,
						})
					}
				}
				mutex.Unlock()
			}
		}
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		resp, err := http.Get("https://api.github.com/users/" + escaped + "/repos?per_page=15&sort=updated")
		if err == nil && resp.StatusCode == 200 {
			defer resp.Body.Close()
			var res []struct {
				Name        string `json:"name"`
				FullName    string `json:"full_name"`
				Description string `json:"description"`
				CloneURL    string `json:"clone_url"`
			}
			if json.NewDecoder(resp.Body).Decode(&res) == nil {
				mutex.Lock()
				for _, item := range res {
					if !seen[item.FullName] {
						seen[item.FullName] = true
						repos = append(repos, RemoteRepo{
							Name:        item.Name,
							FullName:    item.FullName,
							Description: item.Description,
							CloneURL:    item.CloneURL,
						})
					}
				}
				mutex.Unlock()
			}
		}
	}()

	wg.Wait()

	if len(repos) == 0 {
		return nil, fmt.Errorf("brak wynikow")
	}

	return repos, nil
}

func (a *App) GetGitHubBranches(fullName string) ([]string, error) {
	resp, err := http.Get("https://api.github.com/repos/" + fullName + "/branches")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var res []struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, err
	}
	var branches []string
	for _, b := range res {
		branches = append(branches, b.Name)
	}
	return branches, nil
}

func (a *App) CloneRemoteRepo(cloneUrl, branch, destParent string) error {
	cmd := exec.Command("git", "clone", "-b", branch, cloneUrl)
	cmd.Dir = destParent
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("clone error: %s", string(out))
	}
	return nil
}
