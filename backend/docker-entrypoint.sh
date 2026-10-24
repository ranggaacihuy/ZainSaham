#!/bin/sh
set -e

if [ "$1" = "serve" ] && [ ! -f data/.setup-done ]; then
	zainsaham setup
	touch data/.setup-done
fi

exec zainsaham "$@"
