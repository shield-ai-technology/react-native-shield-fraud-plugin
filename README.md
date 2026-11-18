# React Native Shield Fraud Plugin

React Native Plugin for Shield Fraud (www.shield.com)

React Native Shield Fraud Plugin helps developers to assess malicious activities performed on mobile devices and return risk intelligence based on user's behaviour. It collects device's fingerprint, social metrics and network information.

## iOS: ShieldFraud through Swift Package Manager

From native iOS SDK **2.3.0**, ShieldFraud is published through **Swift Package
Manager only**; no new versions go to CocoaPods trunk. The fraud and full plugins
therefore resolve ShieldFraud from
[`shieldfraud-spm`](https://github.com/shield-ai-technology/shieldfraud-spm),
using an exact version requirement. The npm wrapper has its own version.
The alpha plugin continues to use the separate ShieldAlpha CocoaPod.

SHIELD's native SDK and the plugin podspecs declare **iOS 12.0** as their
minimum. The consuming React Native version can require a higher deployment
target. In particular, the RN 0.79.6 example requires iOS 15.1; it does not
validate iOS 12 compatibility.

### React Native apps using CocoaPods

This integration requires React Native's `spm_dependency` helper (RN 0.75+).
The example app uses RN 0.79.6. Older RN consumers should keep the previous
plugin release or upgrade their app. The plugin's development dependency remains
RN 0.71.7; that is separate from the consuming app's integration requirements.

Install the npm package and run `bundle exec pod install` from the app's `ios`
directory, then build the `.xcworkspace`. **No Podfile changes are needed**, and
static libraries (React Native's default), `use_frameworks! :linkage => :static`
and `use_frameworks! :linkage => :dynamic` are all supported. Keep the podspec:
React Native uses it to autolink and compile the bridge, while SPM fetches the
native ShieldFraud SDK.

During `pod install`, the podspec extends React Native's SPM step so that the
ShieldFraud framework is also linked into and embedded in the app; React
Native's own helper attaches it only to the plugin's pod target. It also
prevents Xcode 26 archives from collecting duplicate SPM XCFramework signature
metadata. React Native prints a static-linking warning for SPM packages; with
this plugin it can be ignored.

Apps that followed an earlier pre-release of these instructions and call
`shield_spm_post_install(installer)` from their Podfile can keep or remove that
call; it is idempotent. The effective minimum iOS version also depends on the
consuming React Native version.

Do not add ShieldFraud manually in Xcode or retain a separate
`pod 'ShieldFraud'` declaration. On upgrade, `pod install` removes the old
transitive native pod. Remove any manually linked duplicate framework/package.
Commit the app's dependency resolution files according to its CI policy; resolve
Swift packages before building on CI:

```sh
xcodebuild -resolvePackageDependencies -workspace YourApp.xcworkspace -scheme YourApp
```

### CocoaPods-free React Native apps (SwiftPM preview)

Fraud and full also ship `Package.swift` and `swiftpmConfig.name` for React
Native's [SwiftPM preview autolinker](https://github.com/react/react-native/blob/main/packages/react-native/scripts/spm/__docs__/spm-scripts.md).
This path has no podspec or Ruby-hook execution: the manifest depends directly
on the ShieldFraud SPM product. It builds the bridge as Objective-C++ with the
New Architecture and uses the consuming app's generated spec.

The manifest targets the **local-artifact mode** of the upstream preview contract
reviewed at React Native commit `7619e9c58be9f35ffef8ff6d04bafe42e465753a`.
It expects the official autolinker alias
`build/generated/autolinking/libs/ShieldFraudPlugin`, the React headers package
at `build/xcframeworks`, and `ReactAppHeaders` from `build/generated/ios`.
These references follow the official scaffolder's alias-relative paths and
require no CocoaPods-generated files. Remote React Native package mode is not
supported by this manifest. Do not add this package to Xcode independently of
the RN autolinker: its React dependencies are supplied by the app's SwiftPM setup.

Use a React Native build that provides this preview tooling and follow its
official setup, including codegen. In the consuming app's `ios` directory:

```sh
npx react-native spm add --deintegrate
```

Build the generated/integrated `.xcodeproj`. This command is **not available in
the example's RN 0.79.6 or the plugin's RN 0.71.7 development toolchain**.
The SwiftPM preview bridge requires Swift tools 6.0 and declares iOS 15.1 to
match its React Native/codegen dependencies. This does not change the native
ShieldFraud SDK's iOS 12.0 minimum. Lowering the bridge manifest alone cannot
make those React Native dependencies run on iOS 12. The alpha variant does not
ship this manifest.
React Native labels full SwiftPM integration an early preview, not recommended
for production; compatibility must be checked against the actual preview
version used by the consuming app.

The preview manifest's discovery and ShieldFraud binary resolution have been
checked with upstream tooling and temporary React header-package fixtures.
A complete CocoaPods-free app build and device runtime validation remain
required before treating that path as production support.

### Troubleshooting

- **Missing `spm_dependency`:** upgrade the consuming RN app to a version that
  provides the helper, or keep the previous plugin release.
- **`Undefined symbols ... ShieldFraud` or `Library not loaded:
  ...ShieldFraud.framework`:** make sure the Podfile's `post_install` still calls
  `react_native_post_install`, then reinstall pods and rebuild. Validate a
  Release archive as well as Debug.
- **Missing generated spec header:** rerun React Native codegen. SwiftPM preview
  apps must provide `ReactAppHeaders` through the official tooling.
- **Duplicate symbols or frameworks:** remove the manually installed SHIELD pod,
  package, or framework. Install the fraud or full plugin, not both in one app.
- **Codegen `ENOENT ... ReactAppHeaders/...` during `pod install` after leaving
  the SwiftPM preview:** `npx react-native spm deinit` leaves generated headers in
  `ios/build` that point at removed packages. Delete `ios/build` and run
  `pod install` again.
- **Package resolution failure:** check access to GitHub and the S3 binary URL
  declared in the pinned upstream package, then resolve packages again.
