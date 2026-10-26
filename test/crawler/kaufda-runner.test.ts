import { scanAndPublishLocation } from '../../scripts/scrapers/run-kaufda';
import type { ScrapedBrochure, ScrapeOptions } from '../../scripts/scrapers/kaufda';

const location = {
  zipCode: '22043',
  city: 'Hamburg',
  latitude: 53.5659,
  longitude: 10.0254,
};

function brochure(
  publisherId: string,
  publisherName: string,
  contentId: string,
): ScrapedBrochure {
  return {
    id: `kaufda:22043:kaufda:${publisherId}:${contentId}`,
    content_id: contentId,
    source_zip_code: '22043',
    store_id: `kaufda:${publisherId}`,
    store_name: publisherName,
    title: `${publisherName} - Aktuelle Angebote`,
    valid_from: '2026-10-26T00:00:00.000Z',
    valid_until: '2026-10-30T23:59:59.000Z',
    source_url: 'https://www.kaufda.de/',
    cover_image_url: 'https://content-media.bonial.biz/page-1.jpg',
    page_count: 1,
    pages: [
      {
        page_number: 1,
        image_url: 'https://content-media.bonial.biz/page-1.jpg',
        hotspots: [],
      },
    ],
    available_zip_codes: ['22043'],
  };
}

const allCategoryBrochures = [
  brochure('retailer-1', 'ALDI Nord', 'content-1'),
  brochure('retailer-2', 'MediaMarkt Saturn', 'content-2'),
];

describe('KaufDA runner publication boundary', () => {
  it('publishes all category results together for one ZIP', async () => {
    const publish = jest.fn(async () => undefined);
    const scrape = jest.fn(async (_options: ScrapeOptions) => allCategoryBrochures);

    await expect(
      scanAndPublishLocation(location, { scrape, publish, dryRun: false }),
    ).resolves.toMatchObject({
      brochureCount: 2,
      pageCount: 2,
      hotspotCount: 0,
      stores: [
        expect.objectContaining({ storeName: 'ALDI Nord', brochureCount: 1 }),
        expect.objectContaining({ storeName: 'MediaMarkt Saturn', brochureCount: 1 }),
      ],
    });

    expect(scrape).toHaveBeenCalledTimes(1);
    expect(scrape).toHaveBeenCalledWith(location);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      '22043',
      expect.arrayContaining([
        expect.objectContaining({
          id: 'kaufda:22043:kaufda:retailer-1:content-1',
          source_content_id: 'content-1',
          source_zip_code: '22043',
          store_id: 'kaufda:retailer-1',
          store_name: 'ALDI Nord',
          cover_image: 'https://content-media.bonial.biz/page-1.jpg',
        }),
        expect.objectContaining({
          id: 'kaufda:22043:kaufda:retailer-2:content-2',
          store_id: 'kaufda:retailer-2',
          store_name: 'MediaMarkt Saturn',
        }),
      ]),
    );
  });

  it('does not publish a ZIP when any shelf or viewer response is incomplete', async () => {
    const publish = jest.fn(async () => undefined);
    const scrape = jest.fn(async () => {
      throw new Error('MediaMarkt Saturn viewer response incomplete');
    });

    await expect(
      scanAndPublishLocation(location, { scrape, publish, dryRun: false }),
    ).rejects.toThrow('PLZ 22043: MediaMarkt Saturn viewer response incomplete');
    expect(publish).not.toHaveBeenCalled();
  });

  it('does not publish when run in dry-run mode', async () => {
    const publish = jest.fn(async () => undefined);
    const scrape = jest.fn(async () => allCategoryBrochures);

    const result = await scanAndPublishLocation(location, { scrape, publish, dryRun: true });

    expect(result.brochureCount).toBe(2);
    expect(publish).not.toHaveBeenCalled();
  });
});
