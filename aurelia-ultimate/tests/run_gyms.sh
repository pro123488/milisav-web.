#!/bin/sh
# Recorre los 7 gimnasios restantes en el navegador (los entrenadores ya vencidos para centrarse en la mecánica de cada desafío).
cd "$(dirname "$0")/.."
for spec in "puerto_marea marea" "ciudad_dinamo chispa" "pico_granito cantera" "ciudad_brasa ascua" "aldea_niebla bruma" "cima_escarcha cristal" "ciudad_arcana dragon 0,1,1"; do
  set -- $spec
  echo "=== $1" 
  SKIP_TRAINERS=1 node tests/e2e_gym.mjs "$@" 2>&1 | grep -E "✔|✘|Gimnasio|errores|Error"
done
