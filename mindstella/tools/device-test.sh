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
