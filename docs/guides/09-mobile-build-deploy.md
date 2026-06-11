# Mobile Build & Deploy

This guide covers building, signing, and distributing the Doors iOS and Android apps for testing and production release.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Development builds](#2-development-builds)
3. [iOS setup](#3-ios-setup)
4. [iOS release build](#4-ios-release-build)
5. [Android setup](#5-android-setup)
6. [Android release build](#6-android-release-build)
7. [Metro bundler](#7-metro-bundler)
8. [Native basemap tiles](#8-native-basemap-tiles)
9. [Versioning & app metadata](#9-versioning--app-metadata)
10. [CI distribution](#10-ci-distribution)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Prerequisites

### Universal

| Tool | Version | Purpose |
|------|---------|---------|
| [Bun](https://bun.sh) | >= 1.2 | Package manager and monorepo task runner |
| [Xcode](https://developer.apple.com/xcode/) | >= 16 (macOS) | iOS SDK, simulator, and archive toolchain |
| [CocoaPods](https://cocoapods.org) | >= 1.15 | iOS dependency manager (Ruby gem) |
| [Android Studio](https://developer.android.com/studio) | Latest | Android SDK, emulator, and build tools |
| JDK | >= 17 | Required by Gradle for Android compilation |
| Ruby | >= 3.3 | Required by CocoaPods (comes with macOS) |

### Verify installations

```bash
bun --version
xcodebuild -version
pod --version
java -version
ruby --version
```

> The project uses **Bun** as its primary package manager and task runner. `bun install` at the repo root installs dependencies across all workspaces. You do not need Node.js, npm, Yarn, or pnpm installed separately.

### Install CocoaPods

macOS ships with Ruby, but you may need to install CocoaPods separately:

```bash
sudo gem install cocoapods
```

If you encounter permission errors with the system Ruby, install a version manager like `rbenv` or `chruby` first.

---

## 2. Development builds

### iOS simulator

Two terminal sessions are required:

**Terminal 1 — Metro bundler:**

```bash
bun run dev:mobile
```

This starts the React Native Metro bundler on port `8081`. Keep it running.

**Terminal 2 — iOS build:**

```bash
bun run ios
```

This runs `react-native run-ios`, which compiles the native project, opens the iOS simulator, and connects to the running Metro bundler.

To target a specific simulator device:

```bash
bun run ios -- --simulator "iPhone 16 Pro"
```

List available devices with:

```bash
xcrun simctl list devices
```

### Android emulator

Ensure the Android emulator is running (or start it from Android Studio), then:

```bash
bun run android
```

This runs `react-native run-android`, which compiles and deploys the debug APK to the running emulator.

> The first native build for either platform may take several minutes while Gradle or Xcode resolves and compiles dependencies. Subsequent builds are incremental and much faster.

### Running alongside the API

The mobile app fetches data from the Elysia API server. If the API is unreachable, the frontend must degrade gracefully (no crashes). Start the API in a third terminal:

```bash
bun run dev:server
```

---

## 3. iOS setup

### 3.1 Project files

The iOS project lives at `apps/mobile/ios/`:

```
ios/
  Doors.xcworkspace/       <-- Use this for all Xcode work
  Doors.xcodeproj/         <-- Underlying project (opened by workspace)
  Doors/                   <-- App source (AppDelegate.swift, Info.plist, assets)
  Podfile                  <-- CocoaPods manifest
  Podfile.lock             <-- Locked pod versions
  Pods/                    <-- Installed pods (gitignored)
  build/                   <-- Build artifacts (gitignored)
  .xcode.env               <-- Xcode environment (versioned)
  .xcode.env.local         <-- Local Xcode env overrides (gitignored)
```

### 3.2 Install CocoaPods dependencies

After pulling new changes or switching branches that modify native dependencies, run:

```bash
cd apps/mobile/ios
pod install
cd ../..
```

Or use the repo root shortcut (run any command from repo root):

```bash
cd apps/mobile/ios && pod install
```

`pod install` reads the `Podfile` and resolves native module dependencies. It produces an `.xcworkspace` file that includes both the main project and the Pods project.

> **Always open `.xcworkspace`**, never `.xcodeproj`. Opening the `.xcodeproj` directly will not include CocoaPods dependencies and the build will fail.

### 3.3 Xcode workspace

Open the workspace in Xcode:

```bash
open apps/mobile/ios/Doors.xcworkspace
```

### 3.4 Key iOS build settings

These are defined in `Doors.xcodeproj/project.pbxproj` (edit via Xcode UI):

| Setting | Value | Notes |
|---------|-------|-------|
| Deployment target | 15.1 | Minimum iOS version |
| Bundle identifier | `org.reactjs.native.example.Doors` | Placeholder — change for production |
| Marketing version | 1.0 | Bump for releases |
| Current project version | 1 | Bump for each build |
| Swift version | 5.0 | Project uses Swift |
| Hermes | Enabled | JavaScript engine |
| New Architecture | Enabled | Fabric renderer + TurboModules |
| Bitcode | Disabled | Not required for modern iOS |

To change the bundle identifier, version, or team, select the `Doors` target in Xcode > General tab > Identity / Signing & Capabilities.

### 3.5 iOS environment

The `.xcode.env` file sets the `NODE_BINARY` path used by Xcode's React Native build phases (Bundle React Native code and images, etc.):

```bash
export NODE_BINARY=$(command -v node)
```

A local override (`NODE_BINARY`) must point to a valid Node.js binary on your system. Create `.xcode.env.local` if the default resolution fails:

```bash
export NODE_BINARY=/opt/homebrew/Cellar/node/25.8.2/bin/node
```

> The project uses Bun for package management, but Xcode's build phases still need a `node` binary on `$PATH` for the Metro bundling step. If `node` is not installed globally, install it via Homebrew (`brew install node`) or set the path explicitly in `.xcode.env.local`.

---

## 4. iOS release build

### 4.1 Code signing overview

To distribute an iOS app outside the simulator, you need an **Apple Developer account** (individual or organization, $99/year). The build process requires:

1. **Development Certificate** — installed automatically by Xcode (for simulator and device debugging)
2. **Distribution Certificate** — for App Store or ad-hoc release
3. **Provisioning Profile** — links certificate to app identifier and devices

### 4.2 Configure signing in Xcode

1. Open `Doors.xcworkspace` in Xcode.
2. Select the `Doors` target > **Signing & Capabilities** tab.
3. Check **Automatically manage signing** (recommended for most teams).
4. Select your **Team** from the dropdown (requires an Apple Developer account added in Xcode > Settings > Accounts).
5. Xcode generates the provisioning profile and signing certificate automatically.

If using manual signing:

1. Uncheck **Automatically manage signing**.
2. Set **Provisioning Profile** to the profile matching your bundle ID and distribution method.
3. Set **Code Signing Identity** to `Apple Distribution` for a release build.

### 4.3 Update the bundle identifier for production

The default bundle identifier (`org.reactjs.native.example.Doors`) is a React Native template placeholder. For production, change it to a reverse-domain identifier you control (e.g., `com.yourcompany.doors`):

1. In Xcode, select the `Doors` target > **General** tab.
2. Change the **Bundle Identifier** field.
3. Update the same identifier in your Apple Developer portal and provisioning profiles.

### 4.4 Create an archive

1. In Xcode, select a **generic iOS device** as the build target (any real device or "Any iOS Device" from the scheme menu). The simulator cannot be used for release builds.
2. Product > Archive (or `Cmd+Shift+A`).
3. Xcode builds the project and opens the **Organizer** window with the new archive.

The archive process:

1. Compiles Swift/ObjC source code.
2. Bundles the JavaScript via Metro (the "Bundle React Native code and images" build phase).
3. Signs the binary with your distribution certificate.
4. Packages everything into an `.xcarchive`.

### 4.5 Distribute from the archive

In the Organizer window, select the archive and click **Distribute App**:

| Method | Use case |
|--------|----------|
| **App Store Connect** | Submit to the App Store (requires App Store Connect record) |
| **TestFlight** | Internal/external testing via Apple's TestFlight service |
| **Ad Hoc** | Distribution to registered devices (outside the App Store) |
| **Development** | Debug builds for registered devices |

Each method generates the appropriate provisioning profile and `.ipa` file.

### 4.6 Manual `.ipa` export (CLI)

For CI automation, export the archive from the command line:

```bash
xcodebuild -exportArchive \
  -archivePath path/to/Doors.xcarchive \
  -exportPath ./Doors.ipa \
  -exportOptionsPlist ExportOptions.plist
```

Example `ExportOptions.plist` for TestFlight:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store</string>
  <key>teamID</key>
  <string>YOUR_TEAM_ID</string>
  <key>uploadBitcode</key>
  <false/>
  <key>compileBitcode</key>
  <false/>
</dict>
</plist>
```

For ad-hoc:

```xml
<key>method</key>
<string>ad-hoc</string>
```

### 4.7 Versioning

Update version numbers before archiving:

- **Marketing version** (`CFBundleShortVersionString`): user-visible version, e.g. `1.2.0`. Set in Xcode > General > Version.
- **Build number** (`CFBundleCurrentVersion`): incremental build number, e.g. `42`. Set in Xcode > General > Build.

Both values are stored as `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` in the Xcode project build settings.

---

## 5. Android setup

### 5.1 Project files

The Android project lives at `apps/mobile/android/`:

```
android/
  app/
    build.gradle           <-- App-level build config
    debug.keystore         <-- Debug signing key (committed)
    proguard-rules.pro     <-- ProGuard rules
    src/
      main/
        AndroidManifest.xml
        java/com/doors/    <-- Kotlin source
        res/               <-- Resources (strings, styles, etc.)
  build.gradle             <-- Root build config
  gradle.properties        <-- Gradle JVM args, React Native flags
  gradlew                  <-- Gradle wrapper (Unix)
  gradlew.bat              <-- Gradle wrapper (Windows)
  settings.gradle          <-- Project settings
```

### 5.2 Android SDK setup

Android Studio installs the Android SDK. If you installed the SDK separately, point to it:

```bash
# Create local.properties (gitignored) if it does not exist
echo "sdk.dir=$HOME/Library/Android/sdk" > apps/mobile/android/local.properties
```

This file tells Gradle where to find the Android SDK. Without it, builds will fail with an SDK location error.

The `local.properties` file is not committed to the repository. Each developer creates it locally.

### 5.3 Key Android build settings

Defined in `android/app/build.gradle` and `android/build.gradle`:

| Setting | Value | Notes |
|---------|-------|-------|
| `namespace` | `com.doors` | Android application namespace |
| `applicationId` | `com.doors` | Play Store identifier |
| `minSdkVersion` | 24 | Minimum Android version (Android 7) |
| `targetSdkVersion` | 35 | Target Android version (Android 15) |
| `compileSdkVersion` | 35 | SDK to compile against |
| `buildToolsVersion` | 35.0.0 | Android build tools |
| `ndkVersion` | 27.1.12297006 | Native Development Kit version |
| `kotlinVersion` | 2.0.21 | Kotlin compiler |
| `newArchEnabled` | `true` | Fabric + TurboModules enabled |
| `hermesEnabled` | `true` | Hermes JS engine enabled |

### 5.4 Debug signing

The debug build uses a pre-generated debug keystore committed at `android/app/debug.keystore`:

```
storeFile = debug.keystore
storePassword = android
keyAlias = androiddebugkey
keyPassword = android
```

This is standard for React Native and works for local development and emulator builds. It is never used for release.

---

## 6. Android release build

### 6.1 Generate a release keystore

Before creating a release build, generate a production keystore. **This file must be kept secret and never committed to version control.**

```bash
keytool -genkey -v \
  -keystore release.keystore \
  -alias doors-release-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Store the keystore file in a secure location:
- Outside the repository (e.g., `~/.android/keystores/`)
- Or encrypted and fetched by CI (e.g., as a base64-encoded secret)

### 6.2 Configure release signing in Gradle

Edit `apps/mobile/android/app/build.gradle` and add a release signing config:

```groovy
android {
    // ... existing config ...

    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            storeFile file(System.getenv("RELEASE_STORE_FILE") ?: "release.keystore")
            storePassword System.getenv("RELEASE_STORE_PASSWORD")
            keyAlias System.getenv("RELEASE_KEY_ALIAS")
            keyPassword System.getenv("RELEASE_KEY_PASSWORD")
        }
    }

    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Replace the default debug signing with the release config
            signingConfig signingConfigs.release
            minifyEnabled enableProguardInReleaseBuilds
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
        }
    }
}
```

This approach reads credentials from environment variables, keeping them out of the source code. For local release builds, export the variables before running the build:

```bash
export RELEASE_STORE_FILE=/path/to/release.keystore
export RELEASE_STORE_PASSWORD=your-store-password
export RELEASE_KEY_ALIAS=doors-release-key
export RELEASE_KEY_PASSWORD=your-key-password
```

### 6.3 Build the release APK/AAB

```bash
cd apps/mobile/android

# Build an APK
./gradlew assembleRelease

# Or build an Android App Bundle (AAB) — preferred for Play Store
./gradlew bundleRelease
```

The output files:

- APK: `android/app/build/outputs/apk/release/app-release.apk`
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`

For CI, combine with environment variables for signing:

```bash
cd apps/mobile/android
export RELEASE_STORE_FILE=$HOME/secrets/release.keystore
export RELEASE_STORE_PASSWORD=$(cat $HOME/secrets/keystore-password.txt)
export RELEASE_KEY_ALIAS=doors-release-key
export RELEASE_KEY_PASSWORD=$(cat $HOME/secrets/key-password.txt)
./gradlew bundleRelease
```

### 6.4 ProGuard / minification

ProGuard is disabled by default (`enableProguardInReleaseBuilds = false`). Enable it for production:

```groovy
def enableProguardInReleaseBuilds = true
```

If you enable ProGuard, ensure your `proguard-rules.pro` includes React Native and library-specific keep rules:

```
# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }

# MapLibre
-keep class org.maplibre.** { *; }

# Keep JavaScript-to-native interop classes
-keep class com.doors.** { *; }
```

### 6.5 Upload to Google Play Console

1. Sign in to the [Google Play Console](https://play.google.com/console/).
2. Navigate to your app > **Release** > **Production** (or **Internal testing** / **Closed testing**).
3. Upload the `.aab` file.
4. Fill in release notes.
5. Review and roll out.

---

## 7. Metro bundler

Metro is the JavaScript bundler for React Native. During development, it runs continuously and serves incremental updates. During release builds, Xcode and Gradle invoke Metro automatically to produce the production JS bundle.

### 7.1 Start Metro manually

```bash
bun run dev:mobile
```

This runs `react-native start` inside `apps/mobile/`. The bundler:

- Serves the JS bundle on `http://localhost:8081`.
- Watches source files for changes and invalidates the cache.
- Supports monorepo layouts (configured in `metro.config.js` to watch the root `../../`).

### 7.2 Metro configuration

File: `apps/mobile/metro.config.js`

```js
const config = mergeConfig(getDefaultConfig(projectRoot), {
  watchFolders: [monorepoRoot],          // Watch the monorepo root
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(monorepoRoot, 'node_modules'),
    ],
    disableHierarchicalLookup: true,
    unstable_conditionNames: ['browser', 'require', 'react-native'],
  },
})
```

Key points:

- **`watchFolders`**: includes the monorepo root so changes to `packages/api` and `apps/server` trigger a hot reload if imported.
- **`disableHierarchicalLookup`**: prevents Metro from resolving `node_modules` above the project boundary.
- **`unstable_conditionNames`**: the `browser` condition enables `react-native-web` exports when building for web.

### 7.3 Clearing the Metro cache

If you encounter stale bundle errors, module resolution issues, or odd behavior after dependency changes:

```bash
# Kill the Metro process
kill $(lsof -ti :8081)

# Clear Metro cache and restart
bun run dev:mobile -- --reset-cache
```

---

## 8. Native basemap tiles

The Doors app uses local [PMTiles](https://github.com/protomaps/PMTiles) vector tile archives as the primary basemap source. On native (iOS/Android), the tile loading follows a phased approach.

### Phase 1: Dev server (current)

In development, the iOS simulator and Android emulator load tiles from the **host machine's webpack dev server** running on port `3001`:

```ts
// apps/mobile/src/constants/map.ts
export const WEB_DEV_SERVER_ORIGIN = 'http://localhost:3001'

export function getPmtilesHttpUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}${PMTILES_PATH}`
  }
  // Simulator loads tiles from the host machine webpack dev server
  return `${WEB_DEV_SERVER_ORIGIN}${PMTILES_PATH}`
}
```

This means:

1. The web dev server (`bun run dev:web`) must be running on port `3001` for native maps to load tiles.
2. The PMTiles file must exist at `apps/mobile/public/basemaps/basemap.pmtiles`.
3. The iOS simulator accesses `http://localhost:3001` on the host machine directly. Android emulator uses `http://10.0.2.2:3001` (which maps to the host's `localhost`).

**Workflow for native development with tiles:**

```bash
# Terminal 1: Metro bundler
bun run dev:mobile

# Terminal 2: Webpack dev server (serves PMTiles)
bun run dev:web

# Terminal 3: iOS or Android
bun run ios
```

### Phase 2: Bundled assets (future)

Phase 2 will bundle the `basemap.pmtiles` file as a native device asset:

- iOS: Include in the Xcode project as a bundled resource. The app reads it from the app bundle using a `file://` URL.
- Android: Place in `android/app/src/main/assets/` and read it from the APK/AAB assets directory.

When Phase 2 is implemented, `getPmtilesHttpUrl()` will return a local `file://` URL instead of the webpack dev server origin. This eliminates the need for a running webpack dev server in production native builds.

### Fallback to remote tiles

If the local PMTiles file cannot be loaded (missing file, network error, 404), the map automatically falls back to **OpenFreeMap remote styles**:

| Appearance | Remote URL |
|------------|-----------|
| Light | `https://tiles.openfreemap.org/styles/liberty` |
| Dark | `https://tiles.openfreemap.org/styles/dark` |

The fallback is permanent for the session. The app does not retry the local PMTiles file after a failure. This ensures the map always renders even without local tiles.

### Generating tiles

```bash
bun run basemap:refresh
```

This runs Planetiler in a Docker container to generate fresh tiles from OpenStreetMap data. See [Basemap Tiles](./04-basemap-tiles.md) for detailed instructions.

---

## 9. Versioning & app metadata

### iOS

Both version numbers are set in Xcode > target > General:

| Field | Key in Info.plist | Example |
|-------|------------------|---------|
| Version | `CFBundleShortVersionString` / `MARKETING_VERSION` | `1.2.0` |
| Build | `CFBundleCurrentVersion` / `CURRENT_PROJECT_VERSION` | `42` |

Bump the **build number** for every archive. Bump the **version** for every feature release.

### Android

Set in `android/app/build.gradle`:

```groovy
defaultConfig {
    versionCode 1      // Integer, incremented for each build (Play Store requirement)
    versionName "1.0"  // User-visible version string
}
```

- `versionCode`: a positive integer that must increase monotonically. Every upload to the Play Console must have a higher `versionCode` than the previous one.
- `versionName`: a human-readable version string displayed to users. No uniqueness constraints.

### Keeping versions in sync

For CI, consider a script that reads a canonical version from `package.json` or a `VERSION` file and writes it to both the Xcode project and `build.gradle`. Example approach:

```bash
VERSION=$(node -p "require('./package.json').version")
BUILD=${GITHUB_RUN_NUMBER:-1}

# iOS: use PlistBuddy or agvtool
xcrun agvtool new-marketing-version $VERSION
xcrun agvtool new-version -all $BUILD

# Android: sed the build.gradle
sed -i '' "s/versionCode [0-9]*/versionCode $BUILD/" android/app/build.gradle
sed -i '' "s/versionName \".*\"/versionName \"$VERSION\"/" android/app/build.gradle
```

---

## 10. CI distribution

### 10.1 Fastlane setup

[Fastlane](https://fastlane.tools/) automates building, code signing, and publishing for both iOS and Android.

**Installation:**

```bash
sudo gem install fastlane -NV
```

Or via Bundler (create a `Gemfile` at the repo root or in `apps/mobile/`):

```ruby
source "https://rubygems.org"
gem "fastlane"
```

**Initialize lanes:**

```bash
cd apps/mobile
fastlane init
```

This creates a `fastlane/` directory with a `Fastfile` and `Appfile`.

#### iOS Fastfile example

```ruby
lane :release do |options|
  # Match code signing identities (or use automatic signing)
  # match(type: "appstore")

  # Increment build number
  increment_build_number(
    build_number: options[:build_number] || latest_testflight_build_number + 1
  )

  # Build and archive
  gym(
    workspace: "ios/Doors.xcworkspace",
    scheme: "Doors",
    configuration: "Release",
    export_method: "app-store",
    clean: true,
    include_bitcode: false,
    include_symbols: true
  )

  # Upload to App Store Connect
  pilot(
    skip_waiting_for_build_processing: true,
    distribute_external: false
  )
end

lane :beta do
  # Similar but with export_method: "ad-hoc" for TestFlight
  gym(
    workspace: "ios/Doors.xcworkspace",
    scheme: "Doors",
    configuration: "Release",
    export_method: "ad-hoc",
    clean: true
  )
  pilot(skip_waiting_for_build_processing: true)
end
```

#### Android Fastfile example

```ruby
lane :release do |options|
  gradle(
    task: "bundle",
    build_type: "Release",
    project_dir: "android/",
    properties: {
      "android.injected.signing.store.file" => ENV["RELEASE_STORE_FILE"],
      "android.injected.signing.store.password" => ENV["RELEASE_STORE_PASSWORD"],
      "android.injected.signing.key.alias" => ENV["RELEASE_KEY_ALIAS"],
      "android.injected.signing.key.password" => ENV["RELEASE_KEY_PASSWORD"],
    }
  )

  # Upload to Play Console (requires setup)
  # upload_to_play_store(
  #   track: "production",
  #   aab: "android/app/build/outputs/bundle/release/app-release.aab"
  # )
end

lane :beta do
  gradle(task: "bundle", build_type: "Release", project_dir: "android/")
  # upload_to_play_store(track: "internal")
end
```

### 10.2 GitHub Actions

Below is a reusable workflow pattern for building both platforms on push to a release branch or on tag.

#### iOS build workflow

```yaml
name: iOS Build

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  build-ios:
    runs-on: macos-15

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Install CocoaPods
        run: |
          cd apps/mobile/ios
          pod install

      - name: Build and archive
        env:
          APP_STORE_CONNECT_API_KEY: ${{ secrets.APP_STORE_CONNECT_API_KEY }}
          MATCH_PASSWORD: ${{ secrets.MATCH_PASSWORD }}
        run: |
          cd apps/mobile
          fastlane release
```

#### Android build workflow

```yaml
name: Android Build

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  build-android:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17

      - name: Build AAB
        env:
          RELEASE_STORE_FILE: ${{ runner.temp }}/release.keystore
          RELEASE_STORE_PASSWORD: ${{ secrets.RELEASE_STORE_PASSWORD }}
          RELEASE_KEY_ALIAS: ${{ secrets.RELEASE_KEY_ALIAS }}
          RELEASE_KEY_PASSWORD: ${{ secrets.RELEASE_KEY_PASSWORD }}
        run: |
          echo "${{ secrets.RELEASE_KEYSTORE_BASE64 }}" | base64 --decode > $RELEASE_STORE_FILE
          cd apps/mobile/android
          ./gradlew bundleRelease

      - name: Upload AAB artifact
        uses: actions/upload-artifact@v4
        with:
          name: app-release.aab
          path: apps/mobile/android/app/build/outputs/bundle/release/app-release.aab
```

### 10.3 Bitrise

For teams using Bitrise, the setup is similar:

1. Connect the repository.
2. Add the `Xcode Archive & Export` step for iOS (use `Doors.xcworkspace`, scheme `Doors`).
3. Add the `Android Build` step for Android (task `:app:bundleRelease`).
4. Configure code signing:
   - iOS: Bitrise Code Signing step with Apple Developer account credentials.
   - Android: Upload the keystore file to the Bitrise Code Signing tab and set the environment variables.

### 10.4 Code signing strategies

#### iOS: Fastlane Match

[Fastlane Match](https://docs.fastlane.tools/actions/match/) synchronizes code signing identities across your team via a private Git repo or S3 bucket:

```bash
fastlane match appstore
fastlane match development
```

Match creates and manages certificates and provisioning profiles, ensuring every developer and CI machine uses the same set.

#### iOS: Manual

For single-developer projects, Xcode's automatic signing is sufficient. Each developer signs with their own Apple Developer account, and CI uses App Store Connect API keys for uploads.

#### Android

Keystore files are sensitive secrets. Best practices:

- Store the keystore in a secrets manager (GitHub Secrets, Bitrise Code Signing, 1Password).
- Base64-encode the keystore and store it as a CI secret. Decode it in the build step.
- **Never** commit the release keystore to version control.
- Rotate the keystore password periodically and revoke compromised keys.

---

## 11. Troubleshooting

### CocoaPods failures

**`pod install` fails with a Ruby error:**

```text
ERROR:  While executing gem ... (Gem::FilePermissionError)
```

Use a Ruby version manager or install CocoaPods with `sudo`:

```bash
sudo gem install cocoapods
```

**`pod install` fails to find `react-native`:**

Ensure `bun install` has been run at the repo root. The Podfile resolves `node_modules` paths relative to `apps/mobile/ios/`. If `node_modules` is missing, pod installation will fail.

**`pod install` fails with version conflicts:**

```bash
# Clear the CocoaPods cache and reinstall
cd apps/mobile/ios
pod cache clean --all
rm -rf Pods Podfile.lock
pod install
```

### iOS build failures

**"No matching provisioning profile" / "Failed to register bundle identifier":**

1. Ensure you have an Apple Developer account added in Xcode > Settings > Accounts.
2. Check that the bundle identifier is unique and registered in the Apple Developer portal.
3. For automatic signing, ensure the team is selected in the target's Signing & Capabilities tab.

**"The run destination My Mac is not valid" / "No devices connected":**

Select a generic iOS device or a connected device, not "My Mac". Release builds require a device target, not the simulator.

**"error: unable to find utility 'instruments', not a developer tool or in PATH":**

Install Xcode command line tools:

```bash
xcode-select --install
```

Or point to the correct Xcode installation:

```bash
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

**"Build phase 'Bundle React Native code and images' failed":**

The build phase runs `node` to bundle JavaScript. If `node` is not on the PATH used by Xcode:

1. Check `.xcode.env` and `.xcode.env.local`.
2. Ensure `node` is installed (`node --version`).
3. Set the explicit path in `.xcode.env.local`:

```bash
export NODE_BINARY=/usr/local/bin/node
```

**Metro bundler not running during archive:**

The "Bundle React Native code and images" build phase does **not** require a pre-running Metro instance. It spawns its own Node process to create the production bundle. Errors here usually indicate a missing `node` binary or an issue with the JS bundle (module resolution, missing imports).

### Android build failures

**"SDK location not found" / "local.properties missing":**

```bash
echo "sdk.dir=$HOME/Library/Android/sdk" > apps/mobile/android/local.properties
```

Adjust the path if your SDK is installed elsewhere.

**"Could not find or load main class org.gradle.wrapper.GradleWrapperMain":**

The Gradle wrapper JAR is missing. Reinstall dependencies:

```bash
cd apps/mobile/android
./gradlew --version
```

If the wrapper is absent, regenerate it:

```bash
gradle wrapper
```

**"Execution failed for task ':app:mergeReleaseNativeLibs'":**

This usually indicates a native library mismatch. Clean and rebuild:

```bash
cd apps/mobile/android
./gradlew clean
./gradlew bundleRelease
```

**"Keystore was tampered with, or password was incorrect":**

Verify that the keystore file path and passwords are correct. Use `keytool` to list the contents:

```bash
keytool -list -v -keystore /path/to/keystore -alias your-alias -storepass your-password
```

**"App not installed" on emulator:**

The emulator may have a stale install. Uninstall the app first:

```bash
adb uninstall com.doors
```

Or wipe the emulator data from Android Studio.

### Metro bundler issues

**"Unable to resolve module" from a workspace dependency:**

Metro's monorepo configuration in `metro.config.js` must include the monorepo root in `watchFolders` and the extra `nodeModulesPaths`. If you see resolution errors:

1. Verify `metro.config.js` has the correct `watchFolders` and `nodeModulesPaths`.
2. Restart Metro with `--reset-cache`.
3. Ensure `bun install` has been run at the repo root so workspace symlinks are set up.

**"Error: EMFILE: too many open files" on macOS:**

Increase the file descriptor limit:

```bash
ulimit -n 4096
bun run dev:mobile
```

### Code signing (iOS) issues

**"No signing certificate found" / "No profiles for 'com.yourcompany.doors' were found":**

1. Verify the bundle identifier in Xcode matches the one registered in your Apple Developer account.
2. Ensure there is an active App ID and provisioning profile for that identifier.
3. If using automatic signing, Xcode generates these for you. Sign in with your Apple ID first.

**"App Store Connect operation failed - No suitable application records were found":**

The app must first be created in App Store Connect (https://appstoreconnect.apple.com) before the first upload. Create a new app with the matching bundle identifier and platform.

### Map / tiles not showing

**Blank map on iOS simulator:**

1. Ensure the webpack dev server is running: `bun run dev:web`.
2. Verify `basemap.pmtiles` exists at `apps/mobile/public/basemaps/basemap.pmtiles`.
3. Check that the simulator can reach the host: `http://localhost:3001/basemaps/basemap.pmtiles` should download a file.
4. If tiles still fail, the app should fall back to remote OpenFreeMap tiles. Check for errors in Xcode's debug console.

**Blank map on Android emulator:**

The Android emulator maps `10.0.2.2` to the host machine's `localhost`. If the webpack dev server URL is hardcoded to `localhost`, the emulator may not be able to reach it. The current constant uses `localhost`, which works for iOS but on Android you may need to detect the platform and use `10.0.2.2` instead.

This will be resolved in Phase 2 when tiles are bundled as a device asset.

**Fallback not activating:**

If the map is blank and no fallback is occurring, verify that:

1. `@maplibre/maplibre-react-native` is v11 or later (pmtiles support was added in v11).
2. The `onDidFailLoadingMap` callback (or `onMapError` depending on the version) is properly wired.
3. The error detection in `isBasemapLoadError()` matches the actual error shape from MapLibre.

### CI-specific issues

**GitHub Actions: `xcodebuild` fails but local builds work:**

Runner machines may have different Xcode versions or toolchain paths. Pin the Xcode version explicitly:

```yaml
- name: Select Xcode
  run: sudo xcode-select -s /Applications/Xcode_16.app/Contents/Developer
```

Available versions change over time. Check the [macOS runner image documentation](https://github.com/actions/runner-images#available-images) for the current list.

**GitHub Actions: Gradle daemon memory issues:**

Android builds on CI can run out of memory. The Gradle JVM args in `gradle.properties` set a 2 GB heap. If builds fail with OutOfMemoryError, increase it:

```properties
org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=512m
```

**Fastlane: "App-specific shared secret required" when uploading to App Store Connect:**

Generate an app-specific shared secret in App Store Connect > Apps > your app > In-App Purchases > Manage > App-Specific Shared Secret. Add it to your Fastlane configuration or environment.

---

## Reference

| Command | What it does |
|---------|-------------|
| `bun run dev:mobile` | Start Metro bundler on port 8081 |
| `bun run ios` | Build and launch iOS simulator |
| `bun run android` | Build and launch Android emulator |
| `cd apps/mobile/ios && pod install` | Install CocoaPods dependencies |
| `open apps/mobile/ios/Doors.xcworkspace` | Open iOS project in Xcode |
| `cd apps/mobile/android && ./gradlew bundleRelease` | Build Android App Bundle for release |
| `cd apps/mobile/android && ./gradlew assembleRelease` | Build Android APK for release |
| `bun run dev:web` | Start webpack dev server (needed for native tile serving in Phase 1) |
| `bun run basemap:refresh` | Generate local PMTiles basemap via Planetiler |
