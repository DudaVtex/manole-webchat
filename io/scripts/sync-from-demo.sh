#!/bin/sh
# The panel's source lives in ../demo/src/webchat (also used by
# the Vercel demo). Copy it here before `vtex link` / `vtex publish`.
set -e
here="$(cd "$(dirname "$0")/.." && pwd)"
src="$here/../demo/src/webchat"
rm -rf "$here/react/webchat"
mkdir -p "$here/react/webchat"
cp "$src"/*.ts "$src"/*.tsx "$here/react/webchat/"
echo "react/webchat atualizado a partir de $src"
