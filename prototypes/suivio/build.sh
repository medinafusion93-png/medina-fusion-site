#!/bin/sh
# Génère index.html (document autonome) à partir de app.html (source publiée en Artifact).
cd "$(dirname "$0")"
{ printf '<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n'; cat app.html; printf '\n</body>\n</html>\n'; } > index.html
