# Zusätzliche Befehle. Alte Script-Namen verwenden hier Bindestriche statt Doppelpunkten.
# App-, CI- und Lifecycle-Einstiege bleiben in package.json.
set positional-arguments
set dotenv-load := false

# Wie bun run lokale CLI-Binaries finden, auch nach einem cd ins tools/-Verzeichnis.
export PATH := justfile_directory() + "/node_modules/.bin:" + env_var("PATH")

# Befehle anzeigen, ohne einen Build oder ein Experiment zu starten.
default:
    @just --list

# Bisher: bun run start:local
start-local *args:
    EXPO_NO_DOTENV=1 dotenv -o -e .env.development.local -- expo start "$@"

# Bisher: bun run start:development
start-development *args:
    EXPO_NO_DOTENV=1 dotenv -o -e .env.development.local -- expo start "$@"

# Bisher: bun run build:timer
build-timer *args:
    bun scripts/native-build/build-timer.ts "$@"

# Bisher: bun run metro:android
metro-android *args:
    bun scripts/start-android-metro.ts --env .env.local "$@"

# Bisher: bun run metro:android:development
metro-android-development *args:
    bun scripts/start-android-metro.ts --env .env.development.local "$@"

# Bisher: bun run metro:android:clear
metro-android-clear *args:
    bun scripts/start-android-metro.ts --env .env.local -- --clear "$@"

# Bisher: bun run clean
clean *args:
    FAM_HARNESS_UI=1 bun run native:prebuild -- --platform ios "$@"

# Bisher: bun run android:local
android-local *args:
    FAM_HARNESS_UI=1 bun scripts/run-android.ts --env .env.local "$@"

# Bisher: bun run android:development
android-development *args:
    FAM_HARNESS_UI=1 bun scripts/run-android.ts --env .env.development.local "$@"

# Bisher: bun run android:apk:clean
android-apk-clean *args:
    bun scripts/build-android-apk.ts --clean "$@"

# Bisher: bun run android:apk:debug
android-apk-debug *args:
    bun scripts/build-android-apk.ts --variant debug "$@"

# Bisher: bun run ios:local
ios-local *args:
    FAM_HARNESS_UI=1 EXPO_NO_DOTENV=1 dotenv -o -e .env.local -- expo run:ios "$@"

# Bisher: bun run ios:development
ios-development *args:
    FAM_HARNESS_UI=1 EXPO_NO_DOTENV=1 dotenv -o -e .env.development.local -- expo run:ios "$@"

# Bisher: bun run tools:brochures
tools-brochures *args:
    bun run tools/brochure-viewer/server.ts "$@"

# Bisher: bun run brochures:update
brochures-update *args:
    bun run scripts/seed-brochures.ts "$@"

# Bisher: bun run brochures:test-r2
brochures-test-r2 *args:
    bun run scripts/test-brochures-r2.ts "$@"

# Bisher: bun run tools:recipe-catalog
tools-recipe-catalog *args:
    bun tools/batch-import/server.ts "$@"

# Bisher: bun run crawler:brochures
crawler-brochures *args:
    bun run tools/crawler/brochures/index.ts "$@"

# Bisher: bun run crawler:aldi-v2
crawler-aldi-v2 *args:
    bun run tools/crawler/brochures/aldi-capitals-v2.ts "$@"

# Bisher: bun run crawler:aldi-sample-v2
crawler-aldi-sample-v2 *args:
    bun run tools/crawler/brochures/aldi-sample-v2.ts --stores=aldi "$@"

# Bisher: bun run crawler:retailer-sample
crawler-retailer-sample *args:
    bun run tools/crawler/brochures/aldi-sample-v2.ts "$@"

# Bisher: bun run crawler:verify
crawler-verify *args:
    bun run tools/crawler/brochures/verify-versions.ts "$@"

# Bisher: bun run crawler:review
crawler-review *args:
    bun run tools/crawler/brochures/review-server.ts "$@"

# Bisher: bun run analyze:brochure-versions
analyze-brochure-versions *args:
    bun run scripts/analyze-brochure-versions.ts "$@"

# Bisher: bun run web
web *args:
    EXPO_NO_DOTENV=1 dotenv -o -e .env.local -- expo start --web "$@"

# Bisher: bun run lint
lint *args:
    biome lint . "$@"

# Bisher: bun run format
format *args:
    biome format --write . "$@"

# Bisher: bun run test:local
test-local *args:
    EXPO_NO_DOTENV=1 dotenv -o -e .env.local -- jest "$@"

# Bisher: bun run test:development
test-development *args:
    EXPO_NO_DOTENV=1 dotenv -o -e .env.development.local -- jest "$@"

# Bisher: bun run test:watch
test-watch *args:
    EXPO_NO_DOTENV=1 dotenv -o -e .env.development.local -- jest --watchAll "$@"

# Bisher: bun run test:coverage
test-coverage *args:
    EXPO_NO_DOTENV=1 dotenv -o -e .env.development.local -- jest --coverage "$@"

# Bisher: bun run evaluate-categories
evaluate-categories *args:
    bun scripts/dump_data/evaluate-categories.ts "$@"

# Bisher: bun run debugger:category
debugger-category *args:
    cd tools/category-debugger && bun run dev "$@"

# Bisher: bun run verify:inventory-move
verify-inventory-move *args:
    EXPO_NO_DOTENV=1 bun scripts/verify-inventory-move.ts "$@"

# Bisher: bun run storage:upload-recipe-template-covers
storage-upload-recipe-template-covers *args:
    bun --env-file=.env scripts/upload-recipe-template-covers.ts "$@"

# Bisher: bun run db:init
db-init *args:
    bash scripts/init-database.sh "$@"

# Bisher: bun run harness:android
harness-android *args:
    bun run harness:dev -- --harnessRunner android "$@"

# Bisher: bun run harness:ios
harness-ios *args:
    bun run harness:dev -- --harnessRunner ios "$@"

# Bisher: bun run harness:web
harness-web *args:
    bun run harness:dev -- --harnessRunner web "$@"

# Bisher: bun run user:create
user-create *args:
    bun scripts/test-users.ts create "$@"

# Bisher: bun run user:list
user-list *args:
    bun scripts/test-users.ts list "$@"

# Bisher: bun run user:clean
user-clean *args:
    bun scripts/test-users.ts clean "$@"

# Bisher: bun run user:delete
user-delete *args:
    bun scripts/test-users.ts delete "$@"

# Bisher: bun run seed:glp1
seed-glp1 *args:
    bun scripts/glp1-seed.ts "$@"

# Bisher: bun run test:env
test-env *args:
    EXPO_NO_DOTENV=1 dotenv -o -e .env.development.local -- bun -e "console.log(process.env.EXPO_PUBLIC_SUPABASE_URL)" "$@"

# Bisher: bun run classify
classify *args:
    bun scripts/classify.ts "$@"

# Bisher: bun run analyze:inventory-duplicates
analyze-inventory-duplicates *args:
    bun scripts/analyze-inventory-duplicates.ts "$@"
