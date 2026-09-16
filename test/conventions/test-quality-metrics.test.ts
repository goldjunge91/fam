import { analyzeTestSource } from '../../scripts/analyze-test-declarations';

describe('test quality declaration metrics', () => {
  it('counts nested declarations and supported markers without matching comments or strings', () => {
    const metrics = analyzeTestSource(
      `
        // test('comment')
        const sourceText = "it.only('string')";
        describe('outer', () => {
          it('indented nested test', () => {});
          test.only('focused test', () => {});
          test.skip('skipped test', () => {});
          fit('focused shorthand', () => {});
          xit('skipped shorthand', () => {});
          describe.skip('skipped group', () => {});
          fdescribe('focused group', () => {});
          xdescribe('skipped group shorthand', () => {});
        });
      `,
      'fixture.ts',
    );

    expect(metrics.testDeclarations).toBe(5);
    expect(metrics.describeBlocks).toBe(4);
    expect(metrics.markers).toEqual({
      '.only': 1,
      '.skip': 2,
      fit: 1,
      fdescribe: 1,
      xit: 1,
      xdescribe: 1,
    });
  });
});
