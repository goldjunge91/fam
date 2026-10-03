import Testing
@testable import FamSiri

@Suite("Siri shopping item parser")
struct SiriShoppingItemParserTests {
    @Test("splits comma, semicolon, and German ‘und’ separators")
    func parsesSupportedSeparators() throws {
        #expect(
            try SiriShoppingItemParser.parse("Wurst, Marmelade und Käse")
                == ["Wurst", "Marmelade", "Käse"],
        )
        #expect(
            try SiriShoppingItemParser.parse("Rote Paprika; Hafer Milch UND Brot")
                == ["Rote Paprika", "Hafer Milch", "Brot"],
        )
    }

    @Test("trims whitespace around each item")
    func trimsWhitespace() throws {
        #expect(
            try SiriShoppingItemParser.parse("  Wurst  ,  Marmelade und Käse  ")
                == ["Wurst", "Marmelade", "Käse"],
        )
    }

    @Test("accepts a single item")
    func acceptsSingleItem() throws {
        #expect(try SiriShoppingItemParser.parse("Hafer Milch") == ["Hafer Milch"])
    }

    @Test(arguments: ["", "Milch,,Brot", "Milch und "])
    func rejectsMalformedLists(rawItems: String) {
        #expect(throws: SiriShoppingItemParserError.self) {
            try SiriShoppingItemParser.parse(rawItems)
        }
    }

    @Test("accepts the maximum of fifty items")
    func acceptsFiftyItems() throws {
        let rawItems = Array(repeating: "A", count: 50).joined(separator: ",")
        #expect(try SiriShoppingItemParser.parse(rawItems).count == 50)
    }

    @Test("rejects more than fifty items")
    func rejectsFiftyOneItems() {
        let rawItems = Array(repeating: "A", count: 51).joined(separator: ",")
        #expect(throws: SiriShoppingItemParserError.self) {
            try SiriShoppingItemParser.parse(rawItems)
        }
    }

    @Test("accepts a five-hundred-character item")
    func acceptsFiveHundredCharacterItem() throws {
        let longItem = String(repeating: "A", count: 500)
        #expect(try SiriShoppingItemParser.parse("\(longItem),B") == [longItem, "B"])
    }

    @Test("rejects an item longer than five hundred characters")
    func rejectsFiveHundredOneCharacterItem() {
        let longItem = String(repeating: "A", count: 501)
        #expect(throws: SiriShoppingItemParserError.self) {
            try SiriShoppingItemParser.parse("\(longItem),B")
        }
    }

    @Test("accepts an input of exactly four thousand characters")
    func acceptsFourThousandCharacterInput() throws {
        let items = Array(repeating: String(repeating: "A", count: 500), count: 7)
            + [String(repeating: "B", count: 493)]
        let rawItems = items.joined(separator: ",")

        #expect(rawItems.count == 4000)
        #expect(try SiriShoppingItemParser.parse(rawItems) == items)
    }

    @Test("rejects input longer than four thousand characters")
    func rejectsFourThousandOneCharacterInput() {
        let longItems = Array(repeating: String(repeating: "A", count: 80), count: 50)
        let rawItems = longItems.joined(separator: ",")

        #expect(rawItems.count > 4000)
        #expect(throws: SiriShoppingItemParserError.self) {
            try SiriShoppingItemParser.parse(rawItems)
        }
    }
}
