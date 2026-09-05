import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { type ReactNode, useLayoutEffect } from 'react';
import { View } from 'react-native';
import { DraxProvider, SortableItem, useSortableList } from 'react-native-drax';

// Only the native gesture host is replaced. SortableItem and useSortableList
// are the installed Drax implementations, including their callback wiring.
jest.mock('../../node_modules/react-native-drax/src/DraxView', () => {
  const { View } = require('react-native');
  return {
    DraxView: ({ children, ...props }: { children: ReactNode }) => (
      <View {...props} testID="native-drag-host">
        {children}
      </View>
    ),
  };
});

const DATA = [{ id: 'a' }];
const keyExtractor = (item: (typeof DATA)[number]) => item.id;

function Fixture({ onComplete }: { onComplete: () => void }) {
  const sortable = useSortableList({ data: DATA, keyExtractor, onReorder: () => {} });
  useLayoutEffect(() => {
    sortable._internal.onItemSnapEnd = onComplete;
  });
  return (
    <DraxProvider>
      <SortableItem sortable={sortable} index={0}>
        <View />
      </SortableItem>
    </DraxProvider>
  );
}

it('calls the completion registered after render when the native snap finishes', async () => {
  const onComplete = jest.fn();
  await render(<Fixture onComplete={onComplete} />);
  await fireEvent(screen.getByTestId('native-drag-host'), 'snapEnd', {});
  expect(onComplete).toHaveBeenCalledTimes(1);
});

it('uses the latest completion even when a snap started before a rerender', async () => {
  const firstCompletion = jest.fn();
  const latestCompletion = jest.fn();
  const view = await render(<Fixture onComplete={firstCompletion} />);
  const pendingSnap = screen.getByTestId('native-drag-host').props.onSnapEnd;
  await view.rerender(<Fixture onComplete={latestCompletion} />);
  await act(async () => {
    pendingSnap({});
  });
  expect(firstCompletion).not.toHaveBeenCalled();
  expect(latestCompletion).toHaveBeenCalledTimes(1);
});
