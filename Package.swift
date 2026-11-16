// swift-tools-version: 6.0
import PackageDescription

// React Native SwiftPM preview, local-artifact mode. Its autolinker exposes
// this package at build/generated/autolinking/libs/ShieldFraudPlugin. These
// paths match the official scaffolder's package references from that alias.
// React Native and codegen are supplied by the consuming app, not RN 0.71.7
// from this plugin's development dependencies. See README.md for setup.
let package = Package(
    name: "ShieldFraudPlugin",
    platforms: [.iOS("15.1")],
    products: [
        .library(name: "ShieldFraudPlugin", targets: ["ShieldFraudPlugin"])
    ],
    dependencies: [
        .package(name: "ReactNative", path: "../../../../xcframeworks"),
        .package(name: "React-GeneratedCode", path: "../../../ios"),
        .package(
            url: "https://github.com/shield-ai-technology/shieldfraud-spm.git",
            exact: "2.2.0"
        )
    ],
    targets: [
        .target(
            name: "ShieldFraudPlugin",
            dependencies: [
                .product(name: "ReactHeaders", package: "ReactNative"),
                .product(name: "ReactNativeHeaders", package: "ReactNative"),
                .product(name: "ReactNativeDependenciesHeaders", package: "ReactNative"),
                .product(name: "ReactAppHeaders", package: "React-GeneratedCode"),
                .product(name: "ShieldFraud", package: "shieldfraud-spm")
            ],
            path: "ios",
            sources: ["ShieldFraudPlugin.mm"],
            publicHeadersPath: ".",
            cxxSettings: [
                .define("RCT_NEW_ARCH_ENABLED", to: "1"),
                .define("DEBUG", .when(configuration: .debug)),
                .define("NDEBUG", .when(configuration: .release))
            ],
            linkerSettings: [.linkedFramework("Foundation"), .linkedFramework("UIKit")]
        )
    ],
    cxxLanguageStandard: .cxx20
)
