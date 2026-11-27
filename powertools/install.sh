#!/bin/sh
set -eu
agy_root=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
agy_mode=install
if [ "${1-}" = '--uninstall' ]; then agy_mode=uninstall; shift; fi
agy_runtime=''
case "$(uname -s)" in
  Darwin) agy_embedded="${ANTIGRAVITY_USER_DATA_DIR:-$HOME/Library/Application Support/Antigravity}/bin/agy-node" ;;
  *) agy_embedded="${ANTIGRAVITY_USER_DATA_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/Antigravity}/bin/agy-node" ;;
esac
if command -v node >/dev/null 2>&1; then
  if [ "$(node -p "Number(process.versions.node.split('.')[0])>22||(Number(process.versions.node.split('.')[0])===22&&Number(process.versions.node.split('.')[1])>=13)" 2>/dev/null)" = true ]; then agy_runtime=$(command -v node); fi
fi
if [ -z "$agy_runtime" ] && [ -x "$agy_embedded" ]; then
  if [ "$("$agy_embedded" -p "Number(process.versions.node.split('.')[0])>22||(Number(process.versions.node.split('.')[0])===22&&Number(process.versions.node.split('.')[1])>=13)" 2>/dev/null)" = true ]; then agy_runtime=$agy_embedded; fi
fi
if [ -z "$agy_runtime" ]; then printf '%s\n' 'Install Node.js 22.13 or later, or start Antigravity first.' >&2; exit 1; fi
exec "$agy_runtime" "$agy_root/scripts/$agy_mode.mjs" "$@"
