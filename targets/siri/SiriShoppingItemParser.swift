import Foundation

enum SiriShoppingItemParserError: Error {
    case invalidItemList
}

enum SiriShoppingItemParser {
    static func parse(_ rawItems: String) throws -> [String] {
        guard rawItems.count <= 4000 else {
            throw SiriShoppingItemParserError.invalidItemList
        }

        let separated = rawItems.replacingOccurrences(
            of: #"\s+und\s+"#, with: ";", options: [.regularExpression, .caseInsensitive],
        )
        let items = separated.components(separatedBy: CharacterSet(charactersIn: ",;"))
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }

        guard (1...50).contains(items.count),
              items.allSatisfy({ !$0.isEmpty && $0.count <= 500 }) else {
            throw SiriShoppingItemParserError.invalidItemList
        }

        return items
    }
}
