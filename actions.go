package main

import (
	"archive/zip"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

func OpenFileOS(path string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", path)
	case "darwin":
		cmd = exec.Command("open", path)
	default:
		cmd = exec.Command("xdg-open", path)
	}
	cmd.Start()
}

func OpenTerminal(dir string) {
	term := Settings.CustomTerminal
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		if term == "" {
			cmd = exec.Command("cmd", "/c", "start", "cmd")
		} else {
			cmd = exec.Command("cmd", "/c", "start", "", term)
		}
	} else if runtime.GOOS == "darwin" {
		if term == "" {
			term = "Terminal"
		}
		cmd = exec.Command("open", "-a", term, dir)
	} else {
		if term == "" {
			term = "x-terminal-emulator"
		}
		cmd = exec.Command(term)
	}
	cmd.Dir = dir
	cmd.Start()
}

func CopyFileAsync(src, dst string, onDone func()) {
	go func() {
		source, err := os.Open(src)
		if err == nil {
			defer source.Close()
			destination, err := os.Create(dst)
			if err == nil {
				defer destination.Close()
				io.Copy(destination, source)
			}
		}
		onDone()
	}()
}

func CreateZipAsync(srcPaths []string, dest string, onDone func()) {
	go func() {
		f, err := os.Create(dest)
		if err == nil {
			writer := zip.NewWriter(f)
			for _, src := range srcPaths {
				filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
					if err != nil {
						return err
					}
					header, _ := zip.FileInfoHeader(info)
					header.Method = zip.Deflate
					relPath, _ := filepath.Rel(filepath.Dir(srcPaths[0]), path)
					header.Name = filepath.ToSlash(relPath)
					if info.IsDir() {
						header.Name += "/"
					}
					headerWriter, _ := writer.CreateHeader(header)
					if !info.IsDir() {
						f1, _ := os.Open(path)
						io.Copy(headerWriter, f1)
						f1.Close()
					}
					return nil
				})
			}
			writer.Close()
			f.Close()
		}
		onDone()
	}()
}
