Simulator läuft, App ist installiert und offen (zeigt den Dev-Client-Screen "Development Build", sucht nach Metro-Server). Hier die
  Terminal-Befehle, um das selbst zu wiederholen:

  # 1. Simulator "Iphone 17 Pro Max master" starten
  xcrun simctl boot 0CFE9605-FEBB-4B0F-A972-2A9C1FBCEB83
  open -a Simulator

  # 2. Dev-Client-App installieren (gelockter Build aus native-artifacts)
  xcrun simctl install 0CFE9605-FEBB-4B0F-A972-2A9C1FBCEB83 \
    /Users/marco/Github.tmp/family_app/fam/native-artifacts/ios-development-simulator/fam.app

  # 3. App starten
  xcrun simctl launch 0CFE9605-FEBB-4B0F-A972-2A9C1FBCEB83 com.goldjunge91.fam1

  # 4. Metro starten, damit sich der Dev Client verbindet
  bun start

  Alternativ der projektinterne Weg (baut ggf. neu, falls Fingerprint nicht mehr passt):

  bash scripts/ios-dev.sh --device "Iphone 17 Pro Max master" --reuse-last

  Die UDID 0CFE9605-FEBB-4B0F-A972-2A9C1FBCEB83 habe ich per xcrun simctl list devices available gefunden — falls sie sich mal ändert, einfach
  neu nachschauen.