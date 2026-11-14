# Expo + Fastlane: standalone store-build example

Copy this entire directory to a separate repository. It does not import anything
from the parent app. It has no Bash wrappers, CI configuration, EAS dependency,
Firebase integration, or real credentials.

The accompanying [article](../../docs/expo-fastlane-article.md) explains the setup.
This README is sufficient when the example is copied without the article.

## What this example targets

- Expo SDK 57 (`expo` 57.0.7), React 19.2.3, React Native 0.86.0.
- Node.js 24 LTS, Yarn 3.7.0, a maintained Ruby 3.3 installation and Bundler.
- Fastlane 2.229.1 (the reference project's version), CocoaPods 1.16.2.
- macOS and an Xcode release supported by SDK 57 for iOS archives.
- JDK 17, Android SDK and accepted Android SDK licenses for Android bundles.

These are explicit example dependencies, not an instruction to upgrade an existing
app. Check Expo's SDK-specific requirements when adapting this to another SDK.
Native compilation and store acceptance depend on your installed toolchains and
current Apple/Google requirements; they are not established by the local tests.

## 1. Install

Run all commands from this directory, not the parent application's root.

```sh
corepack enable
yarn install
gem install bundler
bundle install
cp fastlane/.env.example fastlane/.env.production
mkdir -p credentials
```

If your Node installation does not include Corepack, install it first using its
[official instructions](https://github.com/nodejs/corepack#manual-installs).
Use your Ruby manager's Ruby, not macOS's system Ruby or `sudo gem install`.
Commit the generated `yarn.lock` and `Gemfile.lock` in your example repository.
Top-level dependencies are pinned here; the first install still resolves
transitive dependencies. Once locks are committed, use `yarn install --immutable`
and `bundle config set --local frozen true` before `bundle install` for repeatable
dependency resolution. Keep lockfiles consistent with the OS/toolchain you support.

## 2. Configure accounts and secrets

First, set your registered application identifiers, public version and platform
build counters in `app.config.ts`. These values belong to Expo, not Fastlane env.

Then edit `fastlane/.env`:

1. Keep application identifiers and version numbers out of this environment file.
2. Set `APPLE_TEAM_ID` to your Apple Developer team.
3. Create a **team** App Store Connect API key with sufficient access for signing
   and uploads, normally App Manager; account permissions must allow Certificates,
   Identifiers & Profiles access. Set its key/issuer IDs and place its `.p8` in
   `credentials/`. The private key is downloadable only once.
4. Create an App Store Connect app record for your iOS bundle ID.
5. Create a **separate private Git repository** for Match assets, accessible with
   your existing SSH key. Set `MATCH_GIT_URL` and a strong `MATCH_PASSWORD`.
   That password encrypts Match's repository; it is not your Apple password or
   Git authentication credential.
6. Configure an Android upload keystore and a Play service account as below.

Relative credential paths resolve from this example's root, irrespective of
Fastlane's working directory. Absolute paths also work. Do not use `~` in dotenv
paths. A platform build does not require the other platform's private credentials.

Never commit `.env`, `credentials/`, private keys or keystores.
The placeholder `.env.example` is deliberately included. Keep encrypted backups
of signing assets outside the app repository.

## 3. Prepare iOS certificates

On an authorized maintainer's Mac, with an unlocked login keychain:

```sh
bundle exec fastlane ios certificates
```

Match creates or renews App Store distribution certificates/profiles, installs
them locally, and pushes encrypted assets to the private signing repository.
Subsequent builds use `readonly: true`. Re-run `certificates` deliberately when
renewal is necessary. Do not use `match nuke` as a routine setup step.

## 4. Prepare Android credentials

For a **new** app, create an upload key; keytool prompts for passwords:

```sh
keytool -genkeypair -v -keystore credentials/upload.jks \
  -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

Set the keystore passwords and alias in `.env.production`. For an existing app,
use its registered upload key instead of generating an unrelated one.

In Play Console, create the app and enroll in Play App Signing. Enable the Google
Play Android Developer API in Google Cloud, create a service account, download its
JSON key into `credentials/play-service-account.json`, and grant that account
access to this app through Play Console Users and permissions. Grant the release
permissions needed for the internal test track, not blanket project ownership.
This JSON is **not** Firebase's `google-services.json`.

## 5. Build without uploading

```sh
bundle exec fastlane ios build
bundle exec fastlane android build
```

Each lane runs `yarn expo prebuild --clean --platform ... --no-install`. iOS then
installs Pods through Bundler, then reapplies signing with Fastlane's
`update_code_signing_settings` before archiving. Android signing is injected into
Gradle at build time with command/output logging disabled. No signing config
plugin or manual edits under `ios/` or `android/` are needed.

**Warning:** `--clean` deletes and regenerates the selected native project.
Only use it when native customizations are reproducible through app config,
plugins, or deliberate post-prebuild automation. This example reapplies iOS
signing through Fastlane on every build. These native projects are gitignored.

Expected outputs:

- iOS: `build/ios/ExpoFastlaneExample.ipa`
- Android: `android/app/build/outputs/bundle/release/app-release.aab`

The Fastfile uses Fastlane's generated artifact paths for uploads rather than
assuming the Android output path.

## 6. Upload

For the first Android release, upload the AAB manually in Play Console to establish
the app and signing setup before using Supply's API uploads. Finish any required
Play Console declarations. Then:

```sh
bundle exec fastlane ios beta
bundle exec fastlane android beta
```

- iOS: builds and uploads to TestFlight, without waiting for Apple processing.
  Check processing/export compliance in App Store Connect and assign tester groups.
- Android: builds and uploads a **draft** internal-track release. Finish the
  release in Play Console before expecting testers to receive it.

For an iOS App Store binary instead:

```sh
bundle exec fastlane ios store
```

This uploads the binary but does **not** submit it for review or publish it.
Complete metadata, screenshots, privacy/export information and build selection
in App Store Connect, then submit for review. A TestFlight build can also be
selected for the App Store; do not upload the same build number twice.

All upload lanes build first. After a successful upload, increase that platform's
counter in `app.config.ts` before uploading again: `ios.buildNumber` is a string
and `android.versionCode` is an integer. Update `version` for a new public version.
Prebuild uses these existing values unchanged; Fastlane does not set them.
Signing and upload lanes read identifiers using `yarn expo config --type public
--json`, so there is no duplicate identifier in Appfile, Matchfile or dotenv.

## Validate safely

```sh
yarn test
ruby -c fastlane/Fastfile
ruby -c fastlane/Appfile
ruby -c fastlane/Matchfile
bundle exec fastlane lanes --env production
```

The Node test uses no credentials and verifies that environment variables cannot
override Expo-owned release values. Syntax checks and lane listing do not prove a
signed archive builds. Real build/upload lanes require your accounts and tools.
There is deliberately no "dry run" that disguises a real store upload.

## Environment behavior

`--env production` loads Fastlane's `.env`, `.env.default` (if present), and
`.env.production` files. It does **not** set `ACTIVE_ENV` automatically.
The supplied production file sets it, and the commands show it explicitly too.
Fastlane's child Expo/Gradle processes inherit its loaded environment. You do not
need to source dotenv files or parse them in config plugins.

The Expo config contains the app's release values, so direct prebuild commands
do not need Fastlane's credential file. Fastlane reads resolved Expo configuration
only where signing or store actions require an identifier.

This intentionally supports one app target and one production identity. Extensions,
ad-hoc device distribution, multiple environments, CI keychains, production Play
rollouts and metadata automation are separate additions.
