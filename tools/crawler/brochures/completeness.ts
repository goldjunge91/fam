import type {
  BrochureLocation,
  CompletenessIssueCode,
  CompletenessReport,
  CompletenessStatus,
  CrawlerBrochure,
  SourceDiagnostic,
} from './types';

export type CompletenessContext = {
  source?: string;
  location?: BrochureLocation;
  storeId?: string;
  storeName?: string;
  brochureId?: string;
};

type DiagnosticInput = CompletenessContext & {
  code: CompletenessIssueCode;
  severity: SourceDiagnostic['severity'];
  scope: SourceDiagnostic['scope'];
  message: string;
  pageNumber?: number;
  rawValue?: unknown;
  details?: Record<string, unknown>;
};

export function makeDiagnostic({ location, ...input }: DiagnosticInput): SourceDiagnostic {
  const result: SourceDiagnostic = {
    code: input.code,
    severity: input.severity,
    scope: input.scope,
    message: input.message,
    ...(input.source ? { source: input.source } : {}),
    ...(location ? { zipCode: location.zipCode } : {}),
    ...(input.storeId ? { storeId: input.storeId } : {}),
    ...(input.storeName ? { storeName: input.storeName } : {}),
    ...(input.brochureId ? { brochureId: input.brochureId } : {}),
    ...(input.pageNumber !== undefined ? { pageNumber: input.pageNumber } : {}),
    ...(input.rawValue !== undefined ? { rawValue: input.rawValue } : {}),
    ...(input.details ? { details: input.details } : {}),
  };
  return result;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function imageUrl(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  const image = asRecord(value);
  const nestedUrl = image?.imageUrl ?? image?.url;
  return typeof nestedUrl === 'string' && nestedUrl.trim() ? nestedUrl : null;
}

function firstDefined(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined);
}

function pageNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function dateDiagnostic(
  field: 'validFrom' | 'validUntil',
  value: unknown,
  context: CompletenessContext,
): SourceDiagnostic | null {
  const label = field === 'validFrom' ? 'validFrom' : 'validUntil';
  if (value === undefined || value === null || value === '') {
    return makeDiagnostic({
      ...context,
      code: field === 'validFrom' ? 'missing-valid-from' : 'missing-valid-until',
      severity: 'error',
      scope: 'brochure',
      message: `${label} fehlt für den Prospekt.`,
      rawValue: value,
    });
  }

  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    return makeDiagnostic({
      ...context,
      code: field === 'validFrom' ? 'invalid-valid-from' : 'invalid-valid-until',
      severity: 'error',
      scope: 'brochure',
      message: `${label} ist kein gültiges Datum.`,
      rawValue: value,
    });
  }

  return null;
}

/** Prüft Seitenzahlen, URLs und erkennbare Lücken einer von der Quelle gelieferten Seitenfolge. */
export function inspectPageSequence(
  pagesValue: unknown,
  context: CompletenessContext,
): SourceDiagnostic[] {
  if (!Array.isArray(pagesValue)) {
    return [
      makeDiagnostic({
        ...context,
        code: 'missing-pages',
        severity: 'error',
        scope: 'brochure',
        message: 'Die Quelle hat keine verarbeitbare Seitenliste geliefert.',
        rawValue: pagesValue,
      }),
    ];
  }

  if (pagesValue.length === 0) {
    return [
      makeDiagnostic({
        ...context,
        code: 'missing-pages',
        severity: 'error',
        scope: 'brochure',
        message: 'Der Prospekt enthält keine Seiten.',
        rawValue: pagesValue,
      }),
    ];
  }

  const diagnostics: SourceDiagnostic[] = [];
  const pageNumbers: number[] = [];
  let usablePages = 0;

  for (const [index, pageValue] of pagesValue.entries()) {
    const page = asRecord(pageValue);
    if (!page) {
      diagnostics.push(
        makeDiagnostic({
          ...context,
          code: 'detail-unprocessable',
          severity: 'error',
          scope: 'page',
          message: `Seite ${index + 1} ist keine verarbeitbare Antwort.`,
          pageNumber: index + 1,
          rawValue: pageValue,
        }),
      );
      continue;
    }

    const rawNumber = page.page ?? page.number;
    const number = pageNumber(rawNumber);
    if (number === null || !Number.isInteger(number) || number < 1) {
      diagnostics.push(
        makeDiagnostic({
          ...context,
          code: 'invalid-page-number',
          severity: 'error',
          scope: 'page',
          message: `Seite ${index + 1} hat keine gültige Seitennummer.`,
          pageNumber: index + 1,
          rawValue: rawNumber,
        }),
      );
    } else {
      if (pageNumbers.includes(number)) {
        diagnostics.push(
          makeDiagnostic({
            ...context,
            code: 'duplicate-page-number',
            severity: 'error',
            scope: 'page',
            message: `Die Seitennummer ${number} wurde mehrfach geliefert.`,
            pageNumber: number,
            rawValue: rawNumber,
          }),
        );
      }
      pageNumbers.push(number);
    }

    const rawImage = firstDefined(page.image, page.originalImage, page.original_image);
    if (!imageUrl(rawImage)) {
      diagnostics.push(
        makeDiagnostic({
          ...context,
          code: 'missing-image-url',
          severity: 'error',
          scope: 'page',
          message: `Seite ${number ?? index + 1} hat keine Bild-URL.`,
          pageNumber: number ?? index + 1,
          rawValue: rawImage,
        }),
      );
    } else {
      usablePages += 1;
    }
  }

  const sortedPageNumbers = [...new Set(pageNumbers)].sort((a, b) => a - b);
  for (let index = 1; index < sortedPageNumbers.length; index += 1) {
    const previous = sortedPageNumbers[index - 1];
    const current = sortedPageNumbers[index];
    if (current - previous > 1) {
      const missing = Array.from(
        { length: current - previous - 1 },
        (_, offset) => previous + offset + 1,
      );
      diagnostics.push(
        makeDiagnostic({
          ...context,
          code: 'page-number-gap',
          severity: 'error',
          scope: 'brochure',
          message: `Zwischen Seite ${previous} und ${current} fehlen Seiten.`,
          rawValue: { previous, current },
          details: { missingPageNumbers: missing },
        }),
      );
    }
  }

  if (usablePages === 0) {
    diagnostics.push(
      makeDiagnostic({
        ...context,
        code: 'missing-pages',
        severity: 'error',
        scope: 'brochure',
        message: 'Keine gelieferte Seite enthält eine verarbeitbare Bild-URL.',
        rawValue: pagesValue,
      }),
    );
  }

  return diagnostics;
}

/** Prüft eine Detailantwort, bevor sie in ein `CrawlerBrochure`-Objekt transformiert wird. */
export function inspectDetailResponse(
  detailValue: unknown,
  context: CompletenessContext,
): SourceDiagnostic[] {
  const detail = asRecord(detailValue);
  if (!detail) {
    return [
      makeDiagnostic({
        ...context,
        code: 'detail-unprocessable',
        severity: 'error',
        scope: 'brochure',
        message: 'Die Detailantwort ist kein verarbeitbares Objekt.',
        rawValue: detailValue,
      }),
    ];
  }

  const pages = detail.pages;
  const diagnostics = inspectPageSequence(pages, context);
  if (!Array.isArray(pages)) {
    diagnostics.unshift(
      makeDiagnostic({
        ...context,
        code: 'detail-unprocessable',
        severity: 'error',
        scope: 'brochure',
        message: 'Die Detailantwort enthält keine Seitenliste.',
        rawValue: pages,
      }),
    );
  }
  return diagnostics;
}

/** Prüft die Felder, die nach der Transformation im Prüfbericht erhalten bleiben müssen. */
export function inspectBrochureCompleteness(
  brochure: Partial<CrawlerBrochure>,
  context: CompletenessContext = {},
  options: { checkPages?: boolean } = {},
): SourceDiagnostic[] {
  const brochureContext = {
    ...context,
    brochureId: context.brochureId ?? brochure.id,
  };
  const diagnostics: SourceDiagnostic[] = [];
  const validFromDiagnostic = dateDiagnostic('validFrom', brochure.validFrom, brochureContext);
  const validUntilDiagnostic = dateDiagnostic('validUntil', brochure.validUntil, brochureContext);
  if (validFromDiagnostic) diagnostics.push(validFromDiagnostic);
  if (validUntilDiagnostic) diagnostics.push(validUntilDiagnostic);

  if (
    !validFromDiagnostic &&
    !validUntilDiagnostic &&
    typeof brochure.validFrom === 'string' &&
    typeof brochure.validUntil === 'string' &&
    Date.parse(brochure.validUntil) < Date.parse(brochure.validFrom)
  ) {
    diagnostics.push(
      makeDiagnostic({
        ...brochureContext,
        code: 'valid-until-before-valid-from',
        severity: 'error',
        scope: 'brochure',
        message: 'validUntil liegt vor validFrom.',
        rawValue: {
          validFrom: brochure.validFrom,
          validUntil: brochure.validUntil,
        },
      }),
    );
  }

  if (options.checkPages !== false) {
    diagnostics.push(...inspectPageSequence(brochure.pages, brochureContext));
  }

  return diagnostics;
}

/** Leitet den maschinenlesbaren Status aus den Diagnosen einer Quelle ab. */
export function statusFromDiagnostics(
  diagnostics: readonly SourceDiagnostic[],
): CompletenessStatus {
  const blocking = diagnostics.filter(
    ({ code }) => code !== 'offers-list-succeeded' && code !== 'brochure-found',
  );
  if (blocking.length === 0) return 'complete';

  if (blocking.every(({ code }) => code === 'store-not-found')) return 'not-found';
  if (
    blocking.some(
      ({ code }) =>
        code === 'offers-list-failed' || code === 'source-fetch-failed' || code === 'crawl-failed',
    )
  ) {
    return 'failed';
  }
  return 'incomplete';
}

/** Erzeugt einen serialisierbaren Befund für Fehler außerhalb der Live-Quelle. */
export function diagnosticForError(
  code: 'source-fetch-failed' | 'crawl-failed',
  error: unknown,
  context: CompletenessContext,
): SourceDiagnostic {
  const rawValue = error instanceof Error ? { name: error.name, message: error.message } : error;
  return makeDiagnostic({
    ...context,
    code,
    severity: 'error',
    scope: 'location',
    message: error instanceof Error ? error.message : String(error),
    rawValue,
  });
}

export function createCompletenessReport(
  location: BrochureLocation,
  diagnostics: SourceDiagnostic[],
): CompletenessReport {
  return {
    location,
    status: statusFromDiagnostics(diagnostics),
    diagnostics,
  };
}
