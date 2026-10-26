#!/usr/bin/env bash
# Läuft im Android-Emulator von GitHub Actions (siehe .github/workflows/mindstella-android.yml)
set -u
cd "$(dirname "$0")/.."
adb wait-for-device
# schmaler Bildschirm: 720 × 1560 px bei 320 dpi = 360 × 780 dp
adb shell wm size 720x1560
adb shell wm density 320
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
adb install -r -g mindstella-kapitel1-*.apk
node tools/device-test.mjs | tee device-test.log
# kleine JPEG-Vorschauen ins Log, damit sie auch ohne Artefakt-Download prüfbar sind
for f in device-shots/*.png; do
  name=$(basename "$f" .png)
  ffmpeg -loglevel error -y -i "$f" -vf scale=300:-1 -q:v 7 "device-shots/$name.jpg" || continue
  echo "=====BILD $name====="
  base64 -w 0 "device-shots/$name.jpg"
  echo
  echo "=====ENDE $name====="
done
