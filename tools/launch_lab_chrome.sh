#!/bin/sh
# Отдельный профиль Chrome для лабы 7: основной профиль (куки, сессии, пароли) не трогаем.
# Порт 9333 нужен, чтобы скрипты tools/*.mjs управляли браузером по CDP.
DIR="$(cd "$(dirname "$0")/.." && pwd)"
exec "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --user-data-dir="$DIR/tmp/chrome-profile" \
  --remote-debugging-port=9333 \
  --remote-allow-origins=https://chrome-devtools-frontend.appspot.com \
  --no-first-run --no-default-browser-check \
  --window-size=1440,900 --window-position=40,40 "$@"
