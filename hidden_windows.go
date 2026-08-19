//go:build windows

package main

import (
	"syscall"
)

func isFileHidden(path string, name string) bool {
	if len(name) > 0 && name[0] == '.' {
		return true
	}
	ptr, err := syscall.UTF16PtrFromString(path)
	if err == nil {
		attrs, err := syscall.GetFileAttributes(ptr)
		if err == nil {
			return attrs&syscall.FILE_ATTRIBUTE_HIDDEN != 0
		}
	}
	return false
}
