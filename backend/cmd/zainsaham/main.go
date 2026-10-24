package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/ranggaacihuy/zainsaham/backend/internal/app"
	"github.com/ranggaacihuy/zainsaham/backend/internal/config"
)

type command struct {
	name      string
	usageLine string
	short     string
	long      string
	takesArgs bool
	setFlags  func(fs *flag.FlagSet)
	run       func(ctx context.Context, application *app.App, args []string) error
}

func main() {
	args := os.Args[1:]
	if len(args) == 0 {
		printUsage(os.Stderr)
		os.Exit(2)
	}

	switch args[0] {
	case "help", "-h", "-help", "--help":
		help(args[1:])
		return
	}

	cmd := lookup(args[0])
	if cmd == nil {
		fmt.Fprintf(os.Stderr, "zainsaham %s: perintah tidak dikenal\nJalankan 'zainsaham help' untuk melihat daftar perintah.\n", args[0])
		os.Exit(2)
	}

	fs := flag.NewFlagSet(cmd.name, flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	if cmd.setFlags != nil {
		cmd.setFlags(fs)
	}

	if err := fs.Parse(args[1:]); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			printHelp(os.Stdout, cmd)
			return
		}
		usageError(cmd, err.Error())
	}

	if !cmd.takesArgs && fs.NArg() > 0 {
		usageError(cmd, "argumen tidak dikenal: "+strings.Join(fs.Args(), " "))
	}

	application, err := app.New(config.Load())
	if err != nil {
		fatal(cmd, err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	err = cmd.run(ctx, application, fs.Args())
	stop()
	application.Close()

	if err != nil {
		fatal(cmd, err)
	}
}

func lookup(name string) *command {
	for _, cmd := range commands {
		if cmd.name == name {
			return cmd
		}
	}

	return nil
}

func help(args []string) {
	if len(args) == 0 {
		printUsage(os.Stdout)
		return
	}

	cmd := lookup(args[0])
	if cmd == nil {
		fmt.Fprintf(os.Stderr, "zainsaham help %s: perintah tidak dikenal\nJalankan 'zainsaham help' untuk melihat daftar perintah.\n", args[0])
		os.Exit(2)
	}

	printHelp(os.Stdout, cmd)
}

func printUsage(w io.Writer) {
	fmt.Fprint(w, "Zainsaham menjalankan backend ZainSaham dan mengelola datanya.\n\n")
	fmt.Fprint(w, "Penggunaan:\n\n\tzainsaham <perintah> [argumen]\n\n")
	fmt.Fprint(w, "Perintah yang tersedia:\n\n")
	for _, cmd := range commands {
		fmt.Fprintf(w, "\t%-11s %s\n", cmd.name, cmd.short)
	}
	fmt.Fprint(w, "\nJalankan \"zainsaham help <perintah>\" untuk keterangan lebih lanjut tentang sebuah perintah.\n")
}

func printHelp(w io.Writer, cmd *command) {
	fmt.Fprintf(w, "usage: %s\n\n%s\n", cmd.usageLine, strings.TrimSpace(cmd.long))
}

func usageError(cmd *command, message string) {
	fmt.Fprintf(os.Stderr, "zainsaham %s: %s\nusage: %s\nJalankan 'zainsaham help %s' untuk keterangan lengkap.\n", cmd.name, message, cmd.usageLine, cmd.name)
	os.Exit(2)
}

func fatal(cmd *command, err error) {
	fmt.Fprintf(os.Stderr, "zainsaham %s: %v\n", cmd.name, err)
	os.Exit(1)
}
