import { isOffDumpAttached, resetOffDumpAttachment, setOffDumpAttached } from './off-dump-state';

describe('off-dump-state', () => {
  beforeEach(() => {
    resetOffDumpAttachment();
  });

  it('ist standardmäßig nicht angehängt', () => {
    expect(isOffDumpAttached()).toBe(false);
  });

  it('setzt den Attach-Status auf true', () => {
    setOffDumpAttached(true);
    expect(isOffDumpAttached()).toBe(true);
  });

  it('setzt den Attach-Status bei resetOffDumpAttachment zurück', () => {
    setOffDumpAttached(true);
    expect(isOffDumpAttached()).toBe(true);

    resetOffDumpAttachment();
    expect(isOffDumpAttached()).toBe(false);
  });
});
