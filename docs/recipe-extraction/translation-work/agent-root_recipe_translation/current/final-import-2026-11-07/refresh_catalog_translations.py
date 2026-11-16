import argparse
import concurrent.futures
import copy
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path


NUMBER = re.compile(r"\d+(?:[.,]\d+)?(?:/\d+(?:[.,]\d+)?)?")
ITEM = re.compile(r"QZITEM([A-Z]{6})QZ(.*?)QZEND\1QZ", re.DOTALL)
MARKER = re.compile(r"QZ(?:ITEM|END|NUM)[A-Z]+QZ")
TRANSLATABLE_KEYS = {
    "instructions",
    "storageInstructions",
    "reheatingInstructions",
    "whyCheap",
    "cheapTips",
    "healthierTips",
    "batchPrepTips",
    "optionalAddIns",
    "swap",
    "savings",
    "source_note",
    "name",
    "ingredientName",
    "text",
    "hashtags",
    "altText",
}


def translate_request(text, source_language="en"):
    url = "https://translate.googleapis.com/translate_a/single?" + urllib.parse.urlencode(
        {
            "client": "gtx",
            "sl": source_language,
            "tl": "de",
            "dt": "t",
            "q": text,
        }
    )
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0"},
    )
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.loads(response.read())
            return "".join(
                part[0]
                for segment in payload[0]
                if isinstance(segment, list) and segment and isinstance(segment[0], str)
                for part in [segment]
            )
        except Exception:
            if attempt == 4:
                raise
            time.sleep(0.5 * (attempt + 1))


def alpha_marker(index):
    letters = []
    for _ in range(6):
        letters.append(chr(ord("A") + index % 26))
        index //= 26
    return "".join(reversed(letters))


def restore_numbers(value, source):
    source_numbers = NUMBER.findall(source)
    matches = list(NUMBER.finditer(value))
    if len(source_numbers) != len(matches):
        return None
    pieces = []
    start = 0
    for match, source_number in zip(matches, source_numbers):
        pieces.append(value[start : match.start()])
        pieces.append(source_number)
        start = match.end()
    pieces.append(value[start:])
    return "".join(pieces)


def extract_translations(batch, response):
    payload = json.loads(response)
    translated = "".join(
        segment[0]
        for segment in payload[0]
        if isinstance(segment, list) and segment and isinstance(segment[0], str)
    )
    found = {match.group(1): match.group(2).strip() for match in ITEM.finditer(translated)}
    output = {}
    for entry in batch:
        marker = alpha_marker(entry["index"])
        if marker not in found:
            return None
        restored = restore_numbers(found[marker], entry["source"])
        if not restored:
            return None
        output[entry["source"]] = restored
    return output


def request_batch(batch):
    pieces = []
    for entry in batch:
        marker = alpha_marker(entry["index"])
        pieces.append(
            f"QZITEM{marker}QZ{entry['source']}QZEND{marker}QZ"
        )
    query = "\n".join(pieces)
    url = "https://translate.googleapis.com/translate_a/single?" + urllib.parse.urlencode(
        {"client": "gtx", "sl": "en", "tl": "de", "dt": "t", "q": query}
    )
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                raw = response.read().decode("utf-8")
            translations = extract_translations(batch, raw)
            if translations is not None:
                return translations
            break
        except Exception:
            if attempt == 4:
                raise
            time.sleep(0.5 * (attempt + 1))

    translations = {}
    for entry in batch:
        marker = alpha_marker(entry["index"])
        single_query = (
            f"QZITEM{marker}QZ{entry['source']}QZEND{marker}QZ"
        )
        translated = translate_request(single_query)
        match = ITEM.search(translated)
        if match is None:
            raise ValueError(f"Übersetzungsmarkierung fehlt: {entry['index']}")
        output = restore_numbers(match.group(2).strip(), entry["source"])
        if output is None:
            protected = []

            def replace_number(number_match):
                marker_id = alpha_marker(len(protected))
                protected.append((marker_id, number_match.group(0)))
                return f"QZNUM{marker_id}QZ"

            numeric_query = NUMBER.sub(replace_number, entry["source"])
            retry_text = (
                f"QZITEM{marker}QZ{numeric_query}QZEND{marker}QZ"
            )
            translated = translate_request(retry_text)
            match = ITEM.search(translated)
            if match is None:
                raise ValueError(f"Übersetzungsmarkierung fehlt: {entry['index']}")
            output = match.group(2).strip()
            for marker_id, number in protected:
                output = output.replace(f"QZNUM{marker_id}QZ", number)
        if output is None or not output:
            raise ValueError(f"Übersetzung ist leer: {entry['index']}")
        translations[entry["source"]] = output
    return translations


def collect_values(recipes):
    values = set()

    def visit(value, parent_key=None):
        if isinstance(value, dict):
            for key, item in value.items():
                visit(item, key)
        elif isinstance(value, list):
            for item in value:
                visit(item, parent_key)
        elif (
            isinstance(value, str)
            and value.strip()
            and parent_key in TRANSLATABLE_KEYS
            and not (parent_key == "name" and value == "Zutaten")
        ):
            if MARKER.search(value):
                raise ValueError("Quelltext enthält einen reservierten Übersetzungsmarker")
            values.add(value)

    for recipe in recipes:
        visit(recipe)
    return values


def apply_translations(recipes, translations):
    def visit(value, parent_key=None):
        if isinstance(value, dict):
            for key, item in value.items():
                if (
                    isinstance(item, str)
                    and key in TRANSLATABLE_KEYS
                    and not (key == "name" and item == "Zutaten")
                ):
                    value[key] = translations[item]
                elif isinstance(item, dict):
                    visit(item, key)
                elif isinstance(item, list):
                    visit(item, key)
        elif isinstance(value, list):
            for index, item in enumerate(value):
                if isinstance(item, dict):
                    visit(item, parent_key)
                elif isinstance(item, str) and parent_key in TRANSLATABLE_KEYS:
                    value[index] = translations[item]

    for recipe in recipes:
        visit(recipe)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--current", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--map", required=True)
    parser.add_argument("--title-patches", required=True)
    args = parser.parse_args()

    source_path = Path(args.source)
    current_path = Path(args.current)
    source = json.loads(source_path.read_text())
    current = json.loads(current_path.read_text())
    values = sorted(collect_values(source["recipes"]))
    map_path = Path(args.map)
    translations = json.loads(map_path.read_text()) if map_path.exists() else {}
    pending_values = [value for value in values if value not in translations]
    print(
        f"Eindeutige Rezepttexte: {len(values)}; noch offen: {len(pending_values)}",
        flush=True,
    )

    batches = []
    pending = []
    query_chars = 0
    for index, text in enumerate(values):
        if text in translations:
            continue
        entry = {"index": index, "source": text}
        length = len(text) + 36
        if pending and (len(pending) >= 20 or query_chars + length > 3800):
            batches.append(pending)
            pending = []
            query_chars = 0
        pending.append(entry)
        query_chars += length
    if pending:
        batches.append(pending)
    print(f"API-Anfragen: {len(batches)}", flush=True)

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(request_batch, batch): batch for batch in batches}
        for count, future in enumerate(concurrent.futures.as_completed(futures), 1):
            translations.update(future.result())
            if count % 50 == 0 or count == len(futures):
                map_path.write_text(
                    json.dumps(translations, ensure_ascii=False, indent=2) + "\n"
                )
                print(f"Übersetzt: {len(translations)}/{len(values)} Texte", flush=True)

    map_path.write_text(json.dumps(translations, ensure_ascii=False, indent=2) + "\n")
    output = copy.deepcopy(current)
    source_by_order = {recipe["sortOrder"]: recipe for recipe in source["recipes"]}
    output_by_order = {recipe["sortOrder"]: recipe for recipe in output["recipes"]}
    if set(source_by_order) != set(output_by_order):
        raise ValueError("Quell- und Ausgabedatei enthalten unterschiedliche SortOrder-Werte")
    for order, source_recipe in source_by_order.items():
        apply_translations([output_by_order[order]], translations)

    patches = json.loads(Path(args.title_patches).read_text())
    for raw_order, title in patches.items():
        order = int(raw_order)
        output_by_order[order]["title"] = title

    Path(args.output).write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    print(f"Gespeicherte Rezepte: {len(output['recipes'])}", flush=True)


if __name__ == "__main__":
    main()
