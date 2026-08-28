# Testing on a physical device

Transee is developed against a real Android phone. Emulator-only testing hides
the things that matter here: keyboard behaviour, font scaling, RTL scripts, and
later the camera and microphone.

## The Expo Go version rule

**Each build of Expo Go contains exactly one Expo SDK version.** It is not
backwards or forwards compatible. If the Expo Go on the phone was built for a
different SDK than this project, it refuses to open it with:

> Project is incompatible with this version of Expo Go

This is a client/project mismatch, not a project fault. The fix is to install
the Expo Go build matching the project's SDK — **never** to downgrade the
project's SDK to match an old Expo Go.

## Checking both sides

**Project SDK** — the `expo` dependency decides it; there is deliberately no
`sdkVersion` field in `app.json`, so it can never drift:

```bash
npx expo config --type public | grep sdkVersion   # -> sdkVersion: '57.0.0'
npx expo-doctor                                   # dependency alignment
```

**Expo Go SDK** — open Expo Go and read the version on its home screen, or:

```bash
adb shell dumpsys package host.exp.exponent | grep versionName
```

## Installing the matching Expo Go

Either download it from <https://expo.dev/go> (pick the SDK version and
platform), or use the CLI, which caches builds under `~/.expo`:

```bash
npx expo-go download android latest    # or a specific SDK, e.g. 57
```

Then restart the dev server and reopen the project:

```bash
npx expo start
```

## What Expo Go does and does not cover

Every dependency in this project is an Expo SDK or core React Native module, so
Expo Go runs the app fully today.

Two caveats worth knowing:

- **Config plugins do not apply in Expo Go.** It is a prebuilt binary, so the
  `expo-splash-screen` plugin, the Android adaptive icon and the app package
  name are only visible in a build of our own app.
- **Expo Go cannot load custom native code.** The moment a dependency ships its
  own native module, Expo Go stops being an option.

## When a development build becomes necessary

The on-device translation work introduces a native ML runtime, which Expo Go
cannot load. At that point we switch to a development build — a build of
Transee itself that keeps fast refresh and the debugger:

```bash
npx expo install expo-dev-client
npx expo run:android          # local build; needs Android Studio + JDK
# or
npx eas build --profile development --platform android   # cloud build
```

A development build is a superset of Expo Go for our purposes, so switching is
additive: no eject, no leaving the managed workflow, and the same
`npx expo start` workflow afterwards.

Until then Expo Go is the lighter option and stays the default.
