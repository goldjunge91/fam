import path from 'node:path';
import { StyleSheet } from 'react-native';

// Load the dependency's real styles: mocking Drax would conceal the missing
// React Native StyleSheet export that placed the hover below the grid.
it.each(['HoverLayer', 'DebugOverlay'])('%s stays outside normal layout flow', (moduleName) => {
  const create = jest.spyOn(StyleSheet, 'create');
  try {
    const packageRoot = path.dirname(require.resolve('react-native-drax/package.json'));
    require(path.join(packageRoot, 'src', moduleName));
    const overlayStyles = create.mock.calls
      .map(([styles]) => styles)
      .filter((styles) => 'container' in styles)
      .at(-1);

    expect(overlayStyles?.container).toMatchObject({
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    });
  } finally {
    create.mockRestore();
  }
});
