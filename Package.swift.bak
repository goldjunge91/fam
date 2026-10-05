// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "FamSiri",
    platforms: [.iOS(.v17), .macOS(.v13)],
    products: [
        .library(name: "FamSiri", targets: ["FamSiri"]),
    ],
    targets: [
        .target(
            name: "FamSiri",
            path: "targets/siri",
            exclude: [
                "Info.plist",
                "expo-target.config.js",
                "main-app-shopping-list-intent.swift",
                "pods.rb",
                "siri-extension.swift",
            ],
            sources: [
                "SiriShoppingItemParser.swift",
                "siri-shopping-list-database.swift",
                "siri-shopping-list-database-writer.swift",
                "siri-shopping-list-intents.swift",
            ],
        ),
        .testTarget(
            name: "FamSiriTests",
            dependencies: ["FamSiri"],
            path: "test/swift/siri-item-parser-tests",
        ),
    ],
)
