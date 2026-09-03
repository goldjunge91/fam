import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';
import { Button } from './buttons/button';
import { SnackbarProvider, useSnackbar } from './snackbar';

// Snackbar ist ein Provider+Hook (showUndoSnackbar), keine eigenstaendige Komponente
// mit Props — die Story braucht deshalb einen Ausloeser, der den Hook aufruft.
function SnackbarDemo() {
  const { showUndoSnackbar } = useSnackbar();

  return (
    <View style={{ padding: 24 }}>
      <Button
        label="Element löschen"
        onPress={() =>
          showUndoSnackbar({
            message: 'Element gelöscht',
            onUndo: () => {},
          })
        }
      />
    </View>
  );
}

const meta = {
  title: 'UI/Snackbar',
  component: SnackbarDemo,
  decorators: [
    (Story) => (
      <SnackbarProvider>
        <Story />
      </SnackbarProvider>
    ),
  ],
  parameters: {
    notes: 'Tippe auf den Button — die Undo-Snackbar erscheint unten am Bildschirmrand.',
  },
} satisfies Meta<typeof SnackbarDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TriggerUndo: Story = {};
