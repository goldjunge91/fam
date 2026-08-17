
### 4. Switches and checkboxes

Use `Switch` for independent on/off preferences, and `Checkbox` for selecting
multiple items. Do not use a switch for navigation or a one-time command.
Persist a setting only after the explicit value callback fires. When offline,
write to local state and enqueue the one mutation in the existing outbox flow.

### 5. Contextual actions rather than visible action clutter

Use `MenuView` for secondary actions on a row: rename, move, duplicate, or
delete. Keep destructive actions explicit and labelled. Primary workflow
actions stay visible and accessible without a long press.

```tsx
import { MenuView } from '@expo/ui/community/menu';

<MenuView
  title="Artikelaktionen"
  actions={[
    { id: 'rename', title: 'Umbenennen' },
    { id: 'delete', title: 'Löschen', attributes: { destructive: true } },
  ]}
  onPressAction={({ nativeEvent }) => {
    if (nativeEvent.event === 'delete') archiveItem();
  }}>
  <ItemOverflowButton />
</MenuView>
```

Confirm the exact action object types in the installed package before adding a
menu. Menu APIs change more often than the simple picker/sheet wrappers.

### 6. Text that must update on every keystroke

`@expo/ui`'s universal `TextInput` uses `useNativeState`, not a plain string.
Use it only when an input needs UI-thread formatting or must avoid a React
render per keystroke. Normal NutriTrack forms should keep using the existing
React Native input components unless this is a measured problem.

```tsx
import { Host, TextInput, useNativeState } from '@expo/ui';
import { useCallback } from 'react';

const amount = useNativeState('');

const changeAmount = useCallback((next: string) => {
  'worklet';
  amount.value = next.replace(',', '.');
}, [amount]);

<Host matchContents>
  <TextInput value={amount} onChangeText={changeAmount} placeholder="Menge" />
</Host>
```

This needs `react-native-worklets`. Do not mix this observable value directly
with a regular React Native `TextInput` value.

## Before adding Expo UI code

1. Check the installed version in `package.json` and the exact `.d.ts` types
   under `node_modules/@expo/ui`. The types are authoritative for our SDK.
2. Start universal. Use a community replacement when replacing an equivalent
   community control. Split by platform only for a real platform-only need.
3. Keep routes in `src/app/` free of `.ios.tsx` and `.android.tsx` filenames.
   Platform files belong to feature components.
4. Keep large collections virtualized with `FlashList`/`FlatList`, not Expo
   UI's short-list controls.
5. Verify on both iOS and Android. Verify web too when universal or community
   components are involved.
6. Run `bun run check`, `bun run typecheck`, and relevant tests.

## References

- Expo SDK 57: <https://docs.expo.dev/versions/v57.0.0/sdk/ui/>
- Universal Expo UI: <https://docs.expo.dev/versions/v57.0.0/sdk/ui/universal/>
- Native bottom sheet replacement: <https://docs.expo.dev/versions/v57.0.0/sdk/ui/drop-in-replacements/bottomsheet/>
- Expo UI playground studied for interaction ideas: <https://github.com/betomoedano/expo-ui-playground>
