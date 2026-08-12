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
	"syscall"
)

type App struct {
	ctx        context.Context
	driveToken string
}

type AppSettings struct {
	AppScale       float64           `json:"appScale"`
	ShowHidden     bool              `json:"showHidden"`
	ShowExtensions bool              `json:"showExtensions"`
	FoldersFirst   bool              `json:"foldersFirst"`
	IsDarkTheme    bool              `json:"isDarkTheme"`
	DefaultPath    string            `json:"defaultPath"`
	ConfirmDelete  bool              `json:"confirmDelete"`
	CustomTerminal string            `json:"customTerminal"`
	Shortcuts      map[string]string `json:"shortcuts"`
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
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

func isFileHidden(path string, name string) bool {
	if len(name) > 0 && name[0] == '.' {
		return true
	}
	if runtime.GOOS == "windows" {
		ptr, err := syscall.UTF16PtrFromString(path)
		if err == nil {
			attrs, err := syscall.GetFileAttributes(ptr)
			if err == nil {
				return attrs&syscall.FILE_ATTRIBUTE_HIDDEN != 0
			}
		}
	}
	return false
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
					return fmt.Errorf("nie mozna wkleic folderu do jego wlasnego wnetrza: %s", filepath.Base(src))
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
					return fmt.Errorf("nie mozna przeniesc folderu do jego wlasnego wnetrza: %s", filepath.Base(src))
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
		return fmt.Errorf("blad tworzenia RAR (wymaga CLI w PATH systemu): %v", err)
	}
	return nil
}

// Zmodyfikowana funkcja do dekompresji (wsparcie zip, tar, rar)
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
		return fmt.Errorf("nieobsługiwany format do wypakowania: %s", ext)
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
	// Próba wypakowania używając unrar
	cmd := exec.Command("unrar", "x", "-y", src, dest+string(filepath.Separator))
	err := cmd.Run()
	if err != nil {
		// Fallback do rar
		cmd = exec.Command("rar", "x", "-y", src, dest+string(filepath.Separator))
		err = cmd.Run()
		if err != nil {
			return fmt.Errorf("blad wypakowywania RAR (wymaga CLI unrar lub rar zainstalowanego w systemie): %v", err)
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
	var dirs []string
	dirs = append(dirs, os.TempDir())

	if runtime.GOOS == "windows" {
		dirs = append(dirs, filepath.Join(os.Getenv("WINDIR"), "Temp"))
		dirs = append(dirs, filepath.Join(os.Getenv("LOCALAPPDATA"), "Temp"))
	} else if runtime.GOOS == "linux" {
		dirs = append(dirs, "/tmp", "/var/tmp")
	}

	deletedCount := 0
	for _, d := range dirs {
		if d == "" {
			continue
		}
		entries, err := os.ReadDir(d)
		if err != nil {
			continue
		}
		for _, entry := range entries {
			fullPath := filepath.Join(d, entry.Name())
			err := os.RemoveAll(fullPath)
			if err == nil {
				deletedCount++
			}
		}
	}
	return fmt.Sprintf("Usunieto elementow: %d", deletedCount), nil
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
		AppScale:       1.0,
		ShowHidden:     false,
		ShowExtensions: true,
		FoldersFirst:   true,
		IsDarkTheme:    true,
		DefaultPath:    "",
		ConfirmDelete:  true,
		CustomTerminal: "",
		Shortcuts: map[string]string{
			"copy":     "c",
			"cut":      "x",
			"paste":    "v",
			"delete":   "Delete",
			"newFile":  "n",
			"newDir":   "n",
			"terminal": "t",
			"mark":     "z",
			"archive":  "p",
			"unzip":    "u",
			"dualPane": "d",
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
	if _, err := os.Stat(path); os.IsNotExist(err) {
		a.SaveSettings(a.GetSettings())
	}
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

func (a *App) LoginGoogle(clientID string, clientSecret string) (string, error) {
	if clientID == "" || clientSecret == "" {
		return "", fmt.Errorf("brak danych logowania")
	}
	codeChan := make(chan string)
	srv := &http.Server{Addr: "127.0.0.1:8080"}
	http.HandleFunc("/oauth2callback", func(w http.ResponseWriter, r *http.Request) {
		code := r.URL.Query().Get("code")
		fmt.Fprintf(w, "<html><body>Autoryzacja zakonczona. Mozesz zamknac to okno.</body></html>")
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
	reqURL := fmt.Sprintf("https://www.googleapis.com/drive/v3/files?q=%s&fields=files(id,name,mimeType)", escapedQuery)

	req, _ := http.NewRequest("GET", reqURL, nil)
	req.Header.Add("Authorization", "Bearer "+a.driveToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return RangerState{}, err
	}
	defer resp.Body.Close()

	var res struct {
		Files []struct {
			Id       string `json:"id"`
			Name     string `json:"name"`
			MimeType string `json:"mimeType"`
		} `json:"files"`
	}
	json.NewDecoder(resp.Body).Decode(&res)

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
