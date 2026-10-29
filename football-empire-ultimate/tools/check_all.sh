#!/usr/bin/env bash
# FASE 12 · Ejecuta todas las comprobaciones estáticas y regenera el archivo de lugar.
set -e
cd "$(dirname "$0")/.."
python3 tools/luau_check.py src
python3 tools/field_check.py src
python3 tools/security_check.py src
python3 tools/build_place.py
