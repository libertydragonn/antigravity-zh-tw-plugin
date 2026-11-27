#!/bin/sh
set -eu
agy_root=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
exec sh "$agy_root/install.sh" --uninstall "$@"
