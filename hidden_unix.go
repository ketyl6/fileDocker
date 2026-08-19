//go:build !windows

package main

func isFileHidden(path string, name string) bool {
	return len(name) > 0 && name[0] == '.'
}
