import { parsePostalCodes } from '../../scripts/scrapers/locations';

describe('KaufDA postal-code locations', () => {
  it('combines GeoNames points by five-digit postal code', () => {
    const locations = parsePostalCodes(
      [
        'DE\t10115\tBerlin\tBerlin\t11\tBerlin\t00\tBerlin\t11000\t52.5\t13.3',
        'DE\t10115\tBerlin Mitte\tBerlin\t11\tBerlin\t00\tBerlin\t11000\t52.7\t13.5',
        'DE\t22043\tHamburg\tHamburg\t02\tHamburg\t00\tHamburg\t02000\t53.5\t10.0',
        'DE\t01067\tDresden\tSachsen\t13\tDresden\t00\tDresden\t01067\t51.05\t13.73',
        'FR\t75001\tParis\tÎle-de-France\t11\tParis\t00\tParis\t75056\t48.8\t2.3',
        'DE\t1234\tInvalid\tBerlin\t11\tBerlin\t00\tBerlin\t11000\t52.5\t13.3',
      ].join('\n'),
    );

    expect(locations).toEqual([
      { zipCode: '01067', city: 'Dresden', latitude: 51.05, longitude: 13.73 },
      { zipCode: '10115', city: 'Berlin', latitude: 52.6, longitude: 13.4 },
      { zipCode: '22043', city: 'Hamburg', latitude: 53.5, longitude: 10 },
    ]);
  });
});
