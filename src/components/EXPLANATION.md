# Component Documentation (`src/components`)

Overview of all non-test component files located in `src/components/` (and its subdirectories like `ui/`).

---

## 1. `animated-icon.module.css`

### Lines 1–7

```css
.expoLogoBackground {
  background-image: linear-gradient(180deg, #3c9ffe, #0274df);
  border-radius: 40px;
  width: 128px;
  height: 128px;
}
```

**Explanation:**

- **Lines 1–6:** Defines the CSS class `.expoLogoBackground` used specifically on web (`animated-icon.web.tsx`). It applies a vertical linear gradient from `#3c9ffe` to `#0274df`, a 40px border radius, and fixed dimensions of 128x128px.
- **Why it's written this way:** CSS modules allow scoped CSS styling on web without style leaks. Web bundlers support CSS modules natively, offering clean linear gradient rendering on the web platform where React Native NativeStyle properties like `experimental_backgroundImage` might not be standard across all browsers.

---

## 2. `animated-icon.tsx`

### Lines 1–6

```typescript
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
```

**Explanation:**

- **Lines 1–6:** Imports core dependencies: `expo-image` for optimized image rendering, `expo-splash-screen` to control native splash screen hiding, React's `useState`, React Native layout utilities (`Dimensions`, `StyleSheet`, `View`), `react-native-reanimated` keyframe animation utilities, and `scheduleOnRN` from `react-native-worklets` to safely trigger React state updates from Reanimated worklet callbacks.

### Lines 8–9

```typescript
const INITIAL_SCALE_FACTOR = Dimensions.get('screen').height / 90;
const DURATION = 600;
```

**Explanation:**

- **Line 8:** Dynamically calculates an initial scale factor based on screen height divided by 90 so that the initial background animation scales up to fill the full screen height on any device display.
- **Line 9:** Defines a baseline animation duration constant of 600 ms for smooth splash transition timing.

### Lines 11–16

```typescript
export function AnimatedSplashOverlay() {
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!visible) return null;
```

**Explanation:**

- **Lines 11–14:** Declares `AnimatedSplashOverlay`, managing `animate` (whether the transition animation has started) and `visible` (whether the overlay is still mounted).
- **Line 15:** Returns `null` if `visible` is false to unmount the splash overlay after the hide animation finishes, freeing memory and revealing underlying screens.

### Lines 17–34

```typescript
  const splashKeyframe = new Keyframe({
    0: {
      transform: [{ scale: 1 }],
      opacity: 1,
    },
    20: {
      opacity: 1,
    },
    70: {
      opacity: 0,
      easing: Easing.elastic(0.7),
    },
    100: {
      opacity: 0,
      transform: [{ scale: 1 }],
      easing: Easing.elastic(0.7),
    },
  });
```

**Explanation:**

- **Lines 17–34:** Creates a Reanimated `Keyframe` sequence for the splash overlay exit transition. It holds full opacity until 20% progress, fades out to 0 opacity with elastic easing by 70%, and holds full transition state until 100%.

### Lines 36–59

```typescript
  const image = <Image style={styles.image} source={require('@/assets/images/expo-logo.png')} />;

  return animate ? (
    <Animated.View
      entering={splashKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={styles.splashOverlay}>
      {image}
    </Animated.View>
  ) : (
    <View
      onLayout={() => {
        SplashScreen.hideAsync().finally(() => {
          setAnimate(true);
        });
      }}
      style={styles.splashOverlay}>
      {image}
    </View>
  );
}
```

**Explanation:**

- **Line 36:** Reusable JSX reference for the logo image.
- **Lines 38–48:** If `animate` is true, renders an `Animated.View` with the entering keyframe. When finished, the worklet uses `scheduleOnRN` to toggle `setVisible(false)` on the main JS thread.
- **Lines 49–58:** Initial un-animated state. Once laid out (`onLayout`), `SplashScreen.hideAsync()` hides the native OS splash screen, and `.finally()` switches `animate` to true to trigger the seamless React animation transition.

### Lines 62–96

```typescript
const keyframe = new Keyframe({
  0: {
    transform: [{ scale: INITIAL_SCALE_FACTOR }],
  },
  100: {
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.7),
  },
});

const logoKeyframe = new Keyframe({
  0: {
    transform: [{ scale: 1.3 }],
    opacity: 0,
  },
  40: {
    transform: [{ scale: 1.3 }],
    opacity: 0,
    easing: Easing.elastic(0.7),
  },
  100: {
    opacity: 1,
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.7),
  },
});

const glowKeyframe = new Keyframe({
  0: {
    transform: [{ rotateZ: '0deg' }],
  },
  100: {
    transform: [{ rotateZ: '7200deg' }],
  },
});
```

**Explanation:**

- **Lines 62–70:** `keyframe` animates the icon background from full screen scale down to 1:1 with elastic bounce.
- **Lines 72–87:** `logoKeyframe` fades in and scales down the foreground logo image.
- **Lines 89–96:** `glowKeyframe` rotates the glowing background 7200 degrees (20 full rotations) over a long period.

### Lines 98–111

```typescript
export function AnimatedIcon() {
  return (
    <View style={styles.iconContainer}>
      <Animated.View entering={glowKeyframe.duration(60 * 1000 * 4)} style={styles.glow}>
        <Image style={styles.glow} source={require('@/assets/images/logo-glow.png')} />
      </Animated.View>

      <Animated.View entering={keyframe.duration(DURATION)} style={styles.background} />
      <Animated.View style={styles.imageContainer} entering={logoKeyframe.duration(DURATION)}>
        <Image style={styles.image} source={require('@/assets/images/expo-logo.png')} />
      </Animated.View>
    </View>
  );
}
```

**Explanation:**

- **Lines 98–111:** Renders `AnimatedIcon`, compositing three animated layers (rotating glow background, scaling gradient background, and fading/scaling logo image).

### Lines 113–148

```typescript
const styles = StyleSheet.create({
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    width: 201,
    height: 201,
    position: 'absolute',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 128,
    height: 128,
    zIndex: 100,
  },
  image: {
    width: 76,
    height: 71,
  },
  background: {
    borderRadius: 40,
    experimental_backgroundImage: `linear-gradient(180deg, #3C9FFE, #0274DF)`,
    width: 128,
    height: 128,
    position: 'absolute',
  },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});
```

**Explanation:**

- **Lines 113–148:** StyleSheet definitions for container bounds, positioning overlays, experimental background linear gradients for native, and absolute screen fill for the splash screen overlay.

---

## 3. `animated-icon.web.tsx`

### Lines 1–7

```typescript
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';

import classes from './animated-icon.module.css';

const DURATION = 300;
```

**Explanation:**

- **Lines 1–7:** Web-specific implementation of the animated icon component. Imports `expo-image`, React Native basic views, Reanimated keyframes, and CSS module styles (`classes`). Sets web animation `DURATION` to 300 ms for faster web loading feel.

### Lines 9–11

```typescript
export function AnimatedSplashOverlay() {
  return null;
}
```

**Explanation:**

- **Lines 9–11:** On web, `AnimatedSplashOverlay` simply returns `null` because web browsers rely on standard HTML/CSS splash or shell loading rather than native mobile splash screens.

### Lines 13–56

```typescript
const keyframe = new Keyframe({
  0: {
    transform: [{ scale: 0 }],
  },
  60: {
    transform: [{ scale: 1.2 }],
    easing: Easing.elastic(1.2),
  },
  100: {
    transform: [{ scale: 1 }],
    easing: Easing.elastic(1.2),
  },
});

const logoKeyframe = new Keyframe({
  0: {
    opacity: 0,
  },
  60: {
    transform: [{ scale: 1.2 }],
    opacity: 0,
    easing: Easing.elastic(1.2),
  },
  100: {
    transform: [{ scale: 1 }],
    opacity: 1,
    easing: Easing.elastic(1.2),
  },
});

const glowKeyframe = new Keyframe({
  0: {
    transform: [{ rotateZ: '-180deg' }, { scale: 0.8 }],
    opacity: 0,
  },
  [DURATION / 1000]: {
    transform: [{ rotateZ: '0deg' }, { scale: 1 }],
    opacity: 1,
    easing: Easing.elastic(0.7),
  },
  100: {
    transform: [{ rotateZ: '7200deg' }],
  },
});
```

**Explanation:**

- **Lines 13–25:** Keyframe for scaling up the container on web with a springy overshoot (`scale: 1.2`).
- **Lines 27–41:** Keyframe for logo image opacity and scaling transition on web.
- **Lines 43–56:** Keyframe for continuous glow rotation starting from `-180deg` scale `0.8` up to full rotation.

### Lines 58–74

```typescript
export function AnimatedIcon() {
  return (
    <View style={styles.iconContainer}>
      <Animated.View entering={glowKeyframe.duration(60 * 1000 * 4)} style={styles.glow}>
        <Image style={styles.glow} source={require('@/assets/images/logo-glow.png')} />
      </Animated.View>

      <Animated.View style={styles.background} entering={keyframe.duration(DURATION)}>
        <div className={classes.expoLogoBackground} />
      </Animated.View>

      <Animated.View style={styles.imageContainer} entering={logoKeyframe.duration(DURATION)}>
        <Image style={styles.image} source={require('@/assets/images/expo-logo.png')} />
      </Animated.View>
    </View>
  );
}
```

**Explanation:**

- **Lines 58–74:** Web implementation of `AnimatedIcon`. Uses a standard HTML `<div className={classes.expoLogoBackground} />` inside `Animated.View` for the background gradient to ensure perfect browser rendering.

### Lines 76–109

```typescript
const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
    zIndex: 1000,
    position: 'absolute',
    top: 128 / 2 + 138,
  },
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    width: 201,
    height: 201,
    position: 'absolute',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 128,
    height: 128,
  },
  image: {
    position: 'absolute',
    width: 76,
    height: 71,
  },
  background: {
    width: 128,
    height: 128,
    position: 'absolute',
  },
});
```

**Explanation:**

- **Lines 76–109:** Style definitions positioning elements relative to 128x128 bounding boxes on web.

---

## 7. `card.tsx`

### Lines 1–15

```typescript
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type CardProps = {
  children: ReactNode;
  title?: string;
  footer?: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
};
```

**Explanation:**

- **Lines 1–6:** Imports React types and React Native primitives along with theme components and spacing constants.
- **Lines 8–14:** `CardProps` type defining optional title, child content, optional footer, optional tap handler `onPress`, and custom `style`.

### Lines 16–36

```typescript
/** Flaeche fuer zusammengehoerende Inhalte. Antippbar, sobald `onPress` gesetzt ist. */
export function Card({ children, title, footer, onPress, style }: CardProps) {
  const content = (
    <ThemedView type="backgroundElement" style={[styles.card, style]}>
      {title ? <ThemedText type="smallBold">{title}</ThemedText> : null}
      {children}
      {footer}
    </ThemedView>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
      {content}
    </Pressable>
  );
}
```

**Explanation:**

- **Lines 16–24:** Builds internal content structure wrapped in `<ThemedView type="backgroundElement">` containing optional title, child body, and optional footer.
- **Lines 26–35:** If `onPress` is provided, wraps the card content in a `<Pressable>` with button accessibility role and visual press feedback (opacity change). Otherwise returns static content.

### Lines 38–47

```typescript
const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.four,
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
```

**Explanation:**

- **Lines 38–47:** Defines padding, rounded border radius, and child spacing for content cards.

---

## 8. `date-picker.tsx`

### Lines 1–16

```typescript
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/buttons';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface DatePickerProps {
  label?: string;
  value: string; // "YYYY-MM-DD"
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
}
```

**Explanation:**

- **Lines 1–9:** Imports React state hook, React Native modal and layout components, local custom components (`Button`, `TextField`, `ThemedText`), theme constants, and `useTheme` hook.
- **Lines 10–16:** Props interface for `DatePicker`. Expects `value` in `"YYYY-MM-DD"` ISO string format and `onChangeText` callback.

### Lines 18–35

```typescript
export function DatePicker({
  label = 'Geburtsdatum',
  value,
  onChangeText,
  placeholder = 'JJJJ-MM-TT (z.B. 2020-05-14)',
  error,
}: DatePickerProps) {
  const theme = useTheme();
  const [showModal, setShowModal] = useState(false);

  // Default year/month/day selection state in modal
  const initialDate = /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
    ? new Date(value.trim())
    : new Date();
  const [selYear, setSelYear] = useState(initialDate.getFullYear());
  const [selMonth, setSelMonth] = useState(initialDate.getMonth() + 1);
  const [selDay, setSelDay] = useState(initialDate.getDate());
```

**Explanation:**

- **Lines 18–26:** Initializes component state including `showModal` visibility toggle.
- **Lines 28–35:** Parses `value` string with regex `/^\d{4}-\d{2}-\d{2}$/`. If valid, initializes selection states (`selYear`, `selMonth`, `selDay`) from `value`; otherwise defaults to today's date.

### Lines 36–60

```typescript
  function handleChange(text: string) {
    onChangeText(text);
  }

  function handleApplyModal() {
    const y = String(selYear).padStart(4, '0');
    const m = String(selMonth).padStart(2, '0');
    const d = String(selDay).padStart(2, '0');
    const formatted = `${y}-${m}-${d}`;
    onChangeText(formatted);
    setShowModal(false);
  }

  // Format valid ISO date into readable German format
  let formattedDisplay: string | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const dateObj = new Date(value.trim());
    if (!Number.isNaN(dateObj.getTime())) {
      formattedDisplay = dateObj.toLocaleDateString('de-DE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
  }
```

**Explanation:**

- **Lines 36–38:** Direct handler delegating manual text input edits to `onChangeText`.
- **Lines 40–47:** Modal confirm handler (`handleApplyModal`). Zero-pads year/month/day, formats as `"YYYY-MM-DD"`, calls `onChangeText`, and closes modal.
- **Lines 49–60:** Converts valid ISO date string into human-readable German date format (e.g. "14. Mai 2020") for live feedback below the text input.

### Lines 62–90

```typescript
  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <View style={styles.flex}>
          <TextField
            label={label}
            placeholder={placeholder}
            value={value}
            onChangeText={handleChange}
            keyboardType="numeric"
            error={error}
          />
        </View>
        <Pressable
          onPress={() => setShowModal(true)}
          style={[
            styles.pickerBtn,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}>
          <ThemedText style={{ fontSize: 18 }}>📅</ThemedText>
        </Pressable>
      </View>

      {formattedDisplay && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          📅 {formattedDisplay}
        </ThemedText>
      )}
```

**Explanation:**

- **Lines 62–83:** Renders text field input side-by-side with a calendar button (`📅`) that opens the picker modal.
- **Lines 85–89:** Displays formatted German date preview string below the input if valid.

### Lines 92–170

```typescript
      {/* Modal Date Selector */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.background }]}>
            <ThemedText type="subtitle">Datum auswählen</ThemedText>

            <View style={styles.pickerGrid}>
              {/* Year Adjust */}
              <View style={styles.column}>
                <ThemedText type="smallBold">Jahr</ThemedText>
                <View style={styles.stepper}>
                  <Pressable
                    onPress={() => setSelYear((y) => Math.max(1900, y - 1))}
                    style={[styles.stepBtn, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText style={styles.btnText}>-</ThemedText>
                  </Pressable>
                  <ThemedText type="smallBold">{selYear}</ThemedText>
                  <Pressable
                    onPress={() => setSelYear((y) => Math.min(2100, y + 1))}
                    style={[styles.stepBtn, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText style={styles.btnText}>+</ThemedText>
                  </Pressable>
                </View>
              </View>

              {/* Month Adjust */}
              <View style={styles.column}>
                <ThemedText type="smallBold">Monat</ThemedText>
                <View style={styles.stepper}>
                  <Pressable
                    onPress={() => setSelMonth((m) => (m <= 1 ? 12 : m - 1))}
                    style={[styles.stepBtn, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText style={styles.btnText}>-</ThemedText>
                  </Pressable>
                  <ThemedText type="smallBold">{String(selMonth).padStart(2, '0')}</ThemedText>
                  <Pressable
                    onPress={() => setSelMonth((m) => (m >= 12 ? 1 : m + 1))}
                    style={[styles.stepBtn, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText style={styles.btnText}>+</ThemedText>
                  </Pressable>
                </View>
              </View>

              {/* Day Adjust */}
              <View style={styles.column}>
                <ThemedText type="smallBold">Tag</ThemedText>
                <View style={styles.stepper}>
                  <Pressable
                    onPress={() => setSelDay((d) => (d <= 1 ? 31 : d - 1))}
                    style={[styles.stepBtn, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText style={styles.btnText}>-</ThemedText>
                  </Pressable>
                  <ThemedText type="smallBold">{String(selDay).padStart(2, '0')}</ThemedText>
                  <Pressable
                    onPress={() => setSelDay((d) => (d >= 31 ? 1 : d + 1))}
                    style={[styles.stepBtn, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText style={styles.btnText}>+</ThemedText>
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={styles.modalActions}>
              <View style={styles.flex}>
                <Button label="Übernehmen" onPress={handleApplyModal} />
              </View>
              <View style={styles.flex}>
                <Button label="Abbrechen" variant="secondary" onPress={() => setShowModal(false)} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
```

**Explanation:**

- **Lines 92–100:** Modal backdrop dialog with translucent background (`rgba(0,0,0,0.5)`).
- **Lines 101–155:** 3-column stepper grid for Year (bounded 1900–2100), Month (wraps 1–12), and Day (wraps 1–31) with increment (`+`) and decrement (`-`) buttons.
- **Lines 157–167:** Modal action buttons: "Übernehmen" (Apply) and "Abbrechen" (Cancel).

### Lines 172–236

```typescript
const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  pickerBtn: {
    height: 48,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    marginLeft: 4,
    marginTop: -2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  modalBox: {
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  pickerGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: Spacing.two,
  },
  column: {
    alignItems: 'center',
    gap: 8,
  },
  stepper: {
    alignItems: 'center',
    gap: 6,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
});
```

**Explanation:**

- **Lines 172–236:** Layout styling for rows, rounded modal overlay dialog, grid columns, circular stepper buttons (40x40px), and modal action buttons.

---

## 9. `empty-state.tsx`

### Lines 1–18

```typescript
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type EmptyStateProps = {
  /**
   * SF-Symbol-Name. Der Typ kommt aus expo-symbols und ist auf die tatsaechlich
   * existierenden Symbole eingeschraenkt — ein Tippfehler faellt beim Typecheck
   * auf, nicht erst als leere Flaeche auf dem Geraet.
   */
  symbol: SymbolViewProps['name'];
  title: string;
  /** Was der Nutzer als Naechstes tun kann — ein leerer Screen ohne Hinweis ist eine Sackgasse. */
  hint: string;
};
```

**Explanation:**

- **Lines 1–6:** Imports `SymbolView` from `expo-symbols`, React Native components, theme text component, spacing constants, and `useTheme`.
- **Lines 8–18:** `EmptyStateProps` defining type-safe `symbol` name strictly limited to valid SF Symbols by TypeScript, main `title`, and user-actionable `hint` text.

### Lines 20–34

```typescript
export function EmptyState({ symbol, title, hint }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <SymbolView name={symbol} size={40} tintColor={theme.textSecondary} />
      <ThemedText type="smallBold" style={styles.centered}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
        {hint}
      </ThemedText>
    </View>
  );
}
```

**Explanation:**

- **Lines 20–34:** Renders centered empty-state view featuring a 40px SF Symbol, bold title, and secondary hint text giving clear next steps so empty screens do not feel like dead ends.

### Lines 36–47

```typescript
const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  centered: {
    textAlign: 'center',
  },
});
```

**Explanation:**

- **Lines 36–47:** Centers icon and text elements vertically and horizontally with standard vertical padding (`Spacing.six`).

---

## 10. `external-link.tsx`

### Lines 1–6

```typescript
import { type Href, Link } from 'expo-router';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import type { ComponentProps } from 'react';

type Props = Omit<ComponentProps<typeof Link>, 'href'> & { href: Href & string };
```

**Explanation:**

- **Lines 1–3:** Imports `Link` from `expo-router` and `openBrowserAsync` from `expo-web-browser`.
- **Line 5:** Defines component props extending Expo Router's `Link` props while restricting `href` to string types compatible with web browsers.

### Lines 7–25

```typescript
export function ExternalLink({ href, ...rest }: Props) {
  return (
    <Link
      target="_blank"
      {...rest}
      href={href}
      onPress={async (event) => {
        if (process.env.EXPO_OS !== 'web') {
          // Prevent the default behavior of linking to the default browser on native.
          event.preventDefault();
          // Open the link in an in-app browser.
          await openBrowserAsync(href, {
            presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
          });
        }
      }}
    />
  );
}
```

**Explanation:**

- **Lines 7–12:** Renders `<Link target="_blank" href={href} />` for standard browser tab opening on web.
- **Lines 13–22:** Intercepts click events on native platforms (`process.env.EXPO_OS !== 'web'`), calls `event.preventDefault()`, and opens the URL in an in-app system browser sheet via `openBrowserAsync` for a seamless mobile experience.

---

## 11. `hint-row.tsx`

### Lines 1–10

```typescript
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

type HintRowProps = {
  title?: string;
  hint?: ReactNode;
};
```

**Explanation:**

- **Lines 1–6:** Imports React types, React Native components, theme constants, and local themed text/view components.
- **Lines 7–10:** `HintRowProps` interface allowing optional title string and code/hint content node.

### Lines 12–21

```typescript
export function HintRow({ title = 'Try editing', hint = 'app/index.tsx' }: HintRowProps) {
  return (
    <View style={styles.stepRow}>
      <ThemedText type="small">{title}</ThemedText>
      <ThemedView type="backgroundSelected" style={styles.codeSnippet}>
        <ThemedText themeColor="textSecondary">{hint}</ThemedText>
      </ThemedView>
    </View>
  );
}
```

**Explanation:**

- **Lines 12–21:** Renders a row displaying a title label alongside a highlighted code snippet box (`backgroundSelected`).

### Lines 23–33

```typescript
const styles = StyleSheet.create({
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  codeSnippet: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
});
```

**Explanation:**

- **Lines 23–33:** Flexbox space-between layout for side-by-side display and pill padding for the code snippet background.

---

## 12. `macro-bar.tsx`

### Lines 1–20

```typescript
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type MacroBarProps = {
  label: string;
  /** Aufgenommene Menge in Gramm. */
  value: number;
  /** Zielmenge in Gramm. 0 bedeutet "kein Ziel gesetzt". */
  target: number;
};

/**
 * Fortschrittsbalken je Makronaehrstoff (#92).
 *
 * Ist- und Zielwert stehen immer als Text daneben. Der Balken allein waere fuer
 * Farbfehlsichtige und Screenreader wertlos.
 */
```

**Explanation:**

- **Lines 1–5:** Imports React Native layout modules, `ThemedText`, spacing theme constants, and `useTheme`.
- **Lines 7–13:** Defines `MacroBarProps`: nutrient label, current consumed amount in grams (`value`), and target amount in grams (`target`).
- **Lines 15–20:** Documentation emphasizing accessibility: numerical text values are always rendered alongside progress bars so screen readers and color-blind users get full information.

### Lines 21–57

```typescript
export function MacroBar({ label, value, target }: MacroBarProps) {
  const theme = useTheme();

  const ratio = target > 0 ? Math.min(value / target, 1) : 0;
  const exceeded = target > 0 && value > target;

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={
        target > 0
          ? `${label}: ${Math.round(value)} von ${Math.round(target)} Gramm`
          : `${label}: ${Math.round(value)} Gramm, kein Ziel gesetzt`
      }>
      <View style={styles.labelRow}>
        <ThemedText type="small">{label}</ThemedText>
        <ThemedText type="small" themeColor={exceeded ? 'warning' : 'textSecondary'}>
          {Math.round(value)} / {target > 0 ? Math.round(target) : '–'} g
        </ThemedText>
      </View>

      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${ratio * 100}%`,
              backgroundColor: exceeded ? theme.warning : theme.accent,
            },
          ]}
        />
      </View>
    </View>
  );
}
```

**Explanation:**

- **Lines 24–25:** Computes fill `ratio` (clamped to 1.0 maximum) and `exceeded` boolean flag.
- **Lines 28–36:** Configures root container as an accessible progress bar with dynamic voiceover labels.
- **Lines 37–42:** Renders label and numeric readout, highlighting in `warning` color if exceeded.
- **Lines 44–54:** Renders outer track and inner dynamic width progress bar (`width: ratio * 100%`). Switches fill background color to warning theme color when target is exceeded.

### Lines 59–77

```typescript
const styles = StyleSheet.create({
  row: {
    gap: Spacing.one,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});
```

**Explanation:**

- **Lines 59–77:** Track height (8px), rounded corners (4px overflow hidden), and flexbox row layouts.

---

## 13. `progress-ring.tsx`

### Lines 1–26

```typescript
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type ProgressRingProps = {
  /** Erreichter Wert, z. B. aufgenommene Kalorien. */
  value: number;
  /** Zielwert. Bei 0 oder negativ wird der Ring leer dargestellt. */
  target: number;
  size?: number;
  strokeWidth?: number;
  label: string;
  unit?: string;
};
```

**Explanation:**

- **Lines 1–9:** Imports Reanimated animation hooks (`useAnimatedProps`, `useReducedMotion`, `useSharedValue`, `withTiming`) and SVG elements (`Svg`, `Circle`).
- **Line 15:** Creates animated SVG circle component `AnimatedCircle`.
- **Lines 17–26:** `ProgressRingProps` defining consumed value, target goal, ring diameter `size` (default 160), `strokeWidth` (default 14), accessibility label, and `unit` (default `'kcal'`).

### Lines 28–74

```typescript
/**
 * Fortschrittsring fuer Kalorien und andere Tagesziele (#91).
 *
 * Ueberschreitung wird sichtbar gemacht, statt den Ring still bei 100 % stehen
 * zu lassen: der Fuellstand ist bei 1.0 gedeckelt, aber die Farbe wechselt und
 * der Text nennt die Ueberschreitung. Wer sein Ziel ueberschritten hat, soll das
 * sehen — ohne dass die App es bewertet.
 */
export function ProgressRing({
  value,
  target,
  size = 160,
  strokeWidth = 14,
  label,
  unit = 'kcal',
}: ProgressRingProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const ratio = target > 0 ? value / target : 0;
  const clamped = Math.min(Math.max(ratio, 0), 1);
  const exceeded = ratio > 1;

  const progress = useSharedValue(0);

  useEffect(() => {
    // `useReducedMotion` respektiert die Systemeinstellung "Bewegung reduzieren".
    // Ohne das laufen Fuellanimationen auch bei Nutzern, die genau das abgestellt
    // haben — fuer manche ein echtes Problem, nicht nur Geschmack.
    progress.value = reducedMotion ? clamped : withTiming(clamped, { duration: 700 });
  }, [clamped, reducedMotion, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const remaining = Math.round(target - value);
  const accessibilityLabel =
    target > 0
      ? `${label}: ${Math.round(value)} von ${Math.round(target)} ${unit}, ${
          exceeded ? `${Math.abs(remaining)} ${unit} darüber` : `${remaining} ${unit} übrig`
        }`
      : `${label}: ${Math.round(value)} ${unit}, kein Ziel gesetzt`;
```

**Explanation:**

- **Lines 47–48:** Geometry math: `radius = (size - strokeWidth) / 2`, `circumference = 2 * Math.PI * radius`.
- **Lines 50–52:** Clamps fill progress ratio between 0 and 1. Checks if target is exceeded.
- **Lines 56–61:** `useEffect` updates Reanimated `progress` shared value. Respects OS accessibility preference `useReducedMotion()`: if reduced motion is enabled, skips timing animation; otherwise animates over 700 ms.
- **Lines 63–65:** `useAnimatedProps` computes SVG `strokeDashoffset` dynamically based on progress.
- **Lines 67–73:** Calculates remaining/exceeded difference and builds descriptive screen reader label.

### Lines 75–121

```typescript
  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.backgroundSelected}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={exceeded ? theme.warning : theme.accent}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          // Bei -90 Grad beginnt der Ring oben statt rechts.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      <View style={styles.center}>
        <ThemedText type="subtitle">{Math.round(value)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {target > 0 ? `von ${Math.round(target)} ${unit}` : unit}
        </ThemedText>
        {target > 0 ? (
          <ThemedText
            type="small"
            themeColor={exceeded ? 'warning' : 'textSecondary'}
            style={styles.remaining}>
            {exceeded ? `${Math.abs(remaining)} darüber` : `${remaining} übrig`}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}
```

**Explanation:**

- **Lines 81–89:** Background SVG `<Circle>` track rendered using `theme.backgroundSelected`.
- **Lines 90–102:** `<AnimatedCircle>` stroke rendered in `warning` color if exceeded or `accent` color normally. `transform="rotate(-90 ...)"` ensures progress starts at top (12 o'clock) instead of right (3 o'clock).
- **Lines 105–119:** Center overlay showing numeric intake value, target description, and remaining/exceeded badge.

### Lines 123–145

```typescript
const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  center: {
    // Nicht StyleSheet.absoluteFillObject: das Feld fehlt in den RN-0.86-Typen.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
    // Als Prop ist pointerEvents seit RN 0.76 deprecated, im Style ist es korrekt.
    pointerEvents: 'none',
  },
  remaining: {
    marginTop: Spacing.half,
  },
});
```

**Explanation:**

- **Lines 123–145:** Center overlay uses absolute positioning (`top: 0, left: 0, right: 0, bottom: 0`) and `pointerEvents: 'none'` in styles (compatible with RN 0.76+ / 0.86 typings).

---

## 14. `screen.tsx`

### Lines 1–20

```typescript
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing, TabBarHeight } from '@/constants/theme';

type ScreenProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Aktion rechts neben dem Titel, z. B. ein Hinzufuegen-Button. */
  action?: ReactNode;
  scroll?: boolean;
  /** Zeigt explizit einen Zurueck-Button an (oder automatisch wenn router.canGoBack() true ist). */
  showBackButton?: boolean;
};
```

**Explanation:**

- **Lines 1–8:** Imports Expo Router navigation controller, React types, React Native components, `react-native-safe-area-context` hooks, and layout constants.
- **Lines 10–19:** `ScreenProps` type definition: screen `title`, `subtitle`, `children` body, optional header `action` component (e.g. Add button), `scroll` toggle (default true), and optional `showBackButton` override.

### Lines 21–47

```typescript
/**
 * Gemeinsames Geruest aller Tab-Screens: Safe Area, Titelzeile, begrenzte
 * Breite und genug Abstand nach unten, damit die Tab-Leiste nichts verdeckt.
 *
 * `BottomTabInset` beruecksichtigt, dass die native Tab-Leiste auf iOS und
 * Android unterschiedlich hoch ist — ohne den Abstand liegt der letzte
 * Listeneintrag unter der Leiste und ist nicht antippbar.
 */
export function Screen({
  title,
  subtitle,
  children,
  action,
  scroll = true,
  showBackButton,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const body = <View style={styles.body}>{children}</View>;

  const hasBack = showBackButton !== undefined ? showBackButton : router.canGoBack();

  // Die native Tab-Leiste liegt ueber dem Inhalt und wird nicht von der Safe Area
  // erfasst. Ohne diesen Abstand verschwindet der letzte Listeneintrag darunter
  // und ist weder lesbar noch antippbar — im Simulator gemessen: die Leiste
  // beginnt bei 90,5 % der Bildschirmhoehe, der Text lag bei 93,8 %.
  const bottomPadding = insets.bottom + TabBarHeight + Spacing.four;
```

**Explanation:**

- **Lines 21–28:** Explains standard screen shell responsibilities (Safe Area handling, title header, max-width responsive clamping, tab-bar bottom padding).
- **Line 40:** Evaluates `hasBack`: explicitly uses `showBackButton` boolean if passed, otherwise auto-detects stack navigation depth via `router.canGoBack()`.
- **Line 46:** Dynamically computes `bottomPadding = insets.bottom + TabBarHeight + Spacing.four` so scroll content is never obscured by translucent floating/native tab bars.

### Lines 48–87

```typescript
  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {hasBack ? (
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Zurück"
            style={styles.backButton}>
            <ThemedText type="smallBold" themeColor="accent">
              ← Zurück
            </ThemedText>
          </Pressable>
        ) : null}

        <View style={styles.header}>
          <View style={styles.headerText}>
            <ThemedText type="subtitle">{title}</ThemedText>
            {subtitle ? (
              <ThemedText type="small" themeColor="textSecondary">
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
          {action}
        </View>

        {scroll ? (
          <ScrollView
            contentContainerStyle={{ paddingBottom: bottomPadding }}
            showsVerticalScrollIndicator={false}>
            {body}
          </ScrollView>
        ) : (
          <View style={[styles.body, { flex: 1, paddingBottom: bottomPadding }]}>{children}</View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}
```

**Explanation:**

- **Lines 49–50:** Outer `<ThemedView>` and `<SafeAreaView>` configured for top/left/right inset padding.
- **Lines 51–61:** Conditional back button rendering (`← Zurück`) invoking `router.back()`.
- **Lines 63–73:** Header layout displaying title, optional subtitle, and right-aligned header `action` element.
- **Lines 75–84:** Toggles between `<ScrollView>` (with `bottomPadding`) or fixed non-scrolling `<View>` based on `scroll` prop.

### Lines 89–121

```typescript
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
    paddingRight: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
  },
  headerText: {
    flexShrink: 1,
    gap: Spacing.half,
  },
  body: {
    gap: Spacing.three,
  },
});
```

**Explanation:**

- **Lines 89–121:** Screen layout styles ensuring consistent header margins and responsive center alignment (`maxWidth: MaxContentWidth`, `alignSelf: 'center'`).

---

## 15. `sync-status-banner.tsx`

### Lines 1–24

```typescript
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { useTheme } from '@/hooks/use-theme';
import { getDatabase } from '@/lib/db/client';
import { retryFailedOutboxEntries } from '@/lib/db/outbox-retry';
import type { SqlDatabase } from '@/lib/db/types';

export type SyncStatusBannerProps = {
  /**
   * Wird bei einem Tap auf den Fehlerzustand aufgerufen. Ohne Vorgabe macht
   * der Default nur die Eintraege wieder faellig (`retryFailedOutboxEntries`)
   * — er kann keinen echten Sync anstossen, weil dafuer eine household_id
   * noetig ist, die es vor Epic 4 nirgends im App-Code gibt. Wer die Engine
   * spaeter verdrahtet, uebergibt eine eigene Funktion, die zusaetzlich
   * `syncHousehold(...)` aufruft.
   */
  onRetry?: () => Promise<void>;
  /** Nur fuer Tests: injiziert eine andere `SqlDatabase`-Quelle als die echte `getDatabase()`. */
  getDb?: () => Promise<SqlDatabase>;
};
```

**Explanation:**

- **Lines 1–10:** Imports components, hooks (`useSyncStatus`, `useTheme`), database helpers (`getDatabase`, `retryFailedOutboxEntries`), and database types.
- **Lines 12–24:** `SyncStatusBannerProps` defining optional `onRetry` async handler and dependency-injected `getDb` getter (primarily for unit testing).

### Lines 26–29

```typescript
async function defaultRetry(): Promise<void> {
  const db = await getDatabase();
  await retryFailedOutboxEntries(db);
}
```

**Explanation:**

- **Lines 26–29:** Default retry implementation. Acquires database handle and resets failed outbox entries so background sync can re-process them.

### Lines 31–82

```typescript
/**
 * Dezenter Hinweis auf Offline-/Sync-Status (#51).
 *
 * Rendert `null` im `hidden`-Zustand — nimmt dann keinen Platz ein. Das,
 * nicht Insets oder z-index, ist der Grund, warum diese Komponente als
 * normaler Flex-Sibling ueber `RootNavigator` in `_layout.tsx` sitzt, statt
 * absolut positioniert zu werden: sichtbar schiebt sie den Inhalt nach unten,
 * unsichtbar verdeckt sie nichts, weil sie schlicht nicht da ist.
 */
export function SyncStatusBanner({
  onRetry = defaultRetry,
  getDb = getDatabase,
}: SyncStatusBannerProps) {
  const status = useSyncStatus(getDb);
  const theme = useTheme();

  if (status.kind === 'hidden') return null;

  const isFailed = status.kind === 'failed';
  const background = isFailed ? theme.danger : theme.warning;

  const label =
    status.kind === 'offline'
      ? status.pendingCount > 0
        ? `Offline, ${status.pendingCount} Änderungen ausstehend`
        : 'Offline'
      : status.kind === 'syncing'
        ? `Synchronisiere … ${status.pendingCount} ausstehend`
        : `${status.failedCount} Änderungen konnten nicht synchronisiert werden. Erneut versuchen.`;

  const content = (
    <ThemedText type="smallBold" style={styles.text}>
      {label}
    </ThemedText>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: background }]}>
      {isFailed ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Fehlgeschlagene Änderungen erneut versuchen"
          style={styles.row}>
          {content}
        </Pressable>
      ) : (
        <View style={styles.row}>{content}</View>
      )}
    </SafeAreaView>
  );
}
```

**Explanation:**

- **Lines 31–39:** Explains layout design decision: returning `null` when state is `hidden` allows the banner to act as a normal layout sibling in `_layout.tsx` without needing absolute positioning overlays.
- **Line 47:** If `status.kind === 'hidden'`, returns `null`.
- **Lines 49–50:** Picks `theme.danger` for failed sync status and `theme.warning` for offline/syncing statuses.
- **Lines 52–59:** Formats status strings based on `status.kind` (`offline`, `syncing`, `failed`) and pending/failed entry counts.
- **Lines 67–81:** Wraps content in `<SafeAreaView edges={['top']}>`. If `isFailed` is true, wraps banner text in `<Pressable>` to trigger `onRetry`.

### Lines 84–96

```typescript
const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  row: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  text: {
    color: '#ffffff',
    textAlign: 'center',
  },
});
```

**Explanation:**

- **Lines 84–96:** Full-width banner styling with centered white bold text.

---

## 16. `text-field.tsx`

### Lines 1–11

```typescript
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TextFieldProps = TextInputProps & {
  label?: string;
  /** Fehlermeldung fuer genau dieses Feld — nicht fuer das ganze Formular. */
  error?: string;
};
```

**Explanation:**

- **Lines 1–5:** Imports `TextInput` primitives and local themed components.
- **Lines 7–11:** `TextFieldProps` extending standard React Native `TextInputProps` with an optional `label` string and field-specific `error` message string.

### Lines 13–51

```typescript
export function TextField({ label, error, style, ...rest }: TextFieldProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {label ? (
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      ) : null}

      <TextInput
        {...rest}
        placeholderTextColor={theme.textSecondary}
        // accessibilityLabel setzt das Label mit dem Feld in Beziehung; ohne das
        // liest ein Screenreader nur "Textfeld".
        accessibilityLabel={label || rest.placeholder}
        // Bei einem Fehler wird die Meldung mit vorgelesen, statt sie nur
        // farblich zu markieren.
        accessibilityHint={error}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.backgroundElement,
            borderColor: error ? theme.danger : theme.border,
          },
          style,
        ]}
      />

      {error ? (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}
```

**Explanation:**

- **Lines 18–22:** Renders optional field label text above the input.
- **Lines 24–42:** Renders `<TextInput>`. Dynamically applies theme colors (`theme.text`, `theme.backgroundElement`, `theme.border`). If `error` is present, highlights border in `theme.danger` and passes `error` to `accessibilityHint` for screen readers.
- **Lines 44–48:** Renders error message string in red (`themeColor="danger"`) directly below the text field.

### Lines 53–64

```typescript
const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 16,
  },
});
```

**Explanation:**

- **Lines 53–64:** Defines border width (1px), rounded corner radius (`Spacing.three`), vertical/horizontal padding, and font size (16px to prevent iOS auto-zoom on input focus).

---

## 17. `themed-text.tsx`

### Lines 1–9

```typescript
import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};
```

**Explanation:**

- **Lines 1–4:** Imports React Native `Text`, `Platform`, typography constants `Fonts`, theme types, and `useTheme`.
- **Lines 6–9:** `ThemedTextProps` extending `TextProps`. Supports typography variants (`default`, `title`, `small`, `smallBold`, `subtitle`, `link`, `linkPrimary`, `code`) and customizable `themeColor`.

### Lines 11–31

```typescript
export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}
```

**Explanation:**

- **Lines 11–31:** Resolves color from current theme (`theme[themeColor ?? 'text']`), combines typography style rules based on `type`, and merges incoming `style` overrides.

### Lines 33–73

```typescript
const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  title: {
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 52,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: 600,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: '#3c87f7',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
```

**Explanation:**

- **Lines 33–73:** Font scale definitions for small (14px), default body (16px), subtitle (32px), title (48px), link (14px), and code/monospace variants (`Fonts.mono`). Platform select adjusts Android monospace font weights.

---

## 18. `themed-view.tsx`

### Lines 1–16

```typescript
import { View, type ViewProps } from 'react-native';

import type { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemeColor;
};

export function ThemedView({ style, lightColor, darkColor, type, ...otherProps }: ThemedViewProps) {
  const theme = useTheme();

  return <View style={[{ backgroundColor: theme[type ?? 'background'] }, style]} {...otherProps} />;
}
```

**Explanation:**

- **Lines 1–10:** Imports React Native `View` and `useTheme` hook. `ThemedViewProps` defines optional theme background color key `type` (defaulting to `'background'`).
- **Lines 12–16:** `ThemedView` component wrapper that applies current theme background color automatically to any layout container.

---

## 19. `ui/collapsible.tsx`

### Lines 1–10

```typescript
import { SymbolView } from 'expo-symbols';
import { PropsWithChildren, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
```

**Explanation:**

- **Lines 1–10:** Imports `SymbolView` from `expo-symbols`, React state hooks, React Native `Pressable`, Reanimated `Animated` view with `FadeIn` transition, theme components, and `useTheme`.

### Lines 11–41

```typescript
export function Collapsible({ children, title }: PropsWithChildren & { title: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const theme = useTheme();

  return (
    <ThemedView>
      <Pressable
        style={({ pressed }) => [styles.heading, pressed && styles.pressedHeading]}
        onPress={() => setIsOpen((value) => !value)}>
        <ThemedView type="backgroundElement" style={styles.button}>
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            size={14}
            weight="bold"
            tintColor={theme.text}
            style={{ transform: [{ rotate: isOpen ? '-90deg' : '90deg' }] }}
          />
        </ThemedView>

        <ThemedText type="small">{title}</ThemedText>
      </Pressable>
      {isOpen && (
        <Animated.View entering={FadeIn.duration(200)}>
          <ThemedView type="backgroundElement" style={styles.content}>
            {children}
          </ThemedView>
        </Animated.View>
      )}
    </ThemedView>
  );
}
```

**Explanation:**

- **Lines 11–13:** Maintains `isOpen` boolean state toggled on press.
- **Lines 17–31:** Heading trigger row featuring a chevron icon (`chevron.right` / `chevron_right`). Rotates icon (`rotate: isOpen ? '-90deg' : '90deg'`) to indicate expanded/collapsed state.
- **Lines 32–38:** Conditional expansion panel. When `isOpen` is true, animates child content entry with Reanimated `FadeIn.duration(200)`.

### Lines 43–65

```typescript
const styles = StyleSheet.create({
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pressedHeading: {
    opacity: 0.7,
  },
  button: {
    width: Spacing.four,
    height: Spacing.four,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    marginTop: Spacing.three,
    borderRadius: Spacing.three,
    marginLeft: Spacing.four,
    padding: Spacing.four,
  },
});
```

**Explanation:**

- **Lines 43–65:** Layout rules for heading pressable, circular chevron icon button container, and indented content panel (`marginLeft: Spacing.four`).

---

## 20. `web-badge.tsx`

### Lines 1–7

```typescript
import { version } from 'expo/package.json';
import { Image } from 'expo-image';
import { StyleSheet, useColorScheme } from 'react-native';
import { Spacing } from '@/constants/theme';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
```

**Explanation:**

- **Lines 1–7:** Imports Expo version string directly from `expo/package.json`, `Image` from `expo-image`, `useColorScheme`, theme constants, and local themed text/view components.

### Lines 8–26

```typescript
export function WebBadge() {
  const scheme = useColorScheme();

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="code" themeColor="textSecondary" style={styles.versionText}>
        v{version}
      </ThemedText>
      <Image
        source={
          scheme === 'dark'
            ? require('@/assets/images/expo-badge-white.png')
            : require('@/assets/images/expo-badge.png')
        }
        style={styles.badgeImage}
      />
    </ThemedView>
  );
}
```

**Explanation:**

- **Lines 8–10:** Reads system color scheme (`'dark'` vs `'light'`).
- **Lines 13–15:** Displays current Expo SDK version string (e.g. `v52.0.0`) using monospace font (`type="code"`).
- **Lines 16–23:** Displays Expo badge image, dynamically switching between `expo-badge-white.png` for dark mode and `expo-badge.png` for light mode.

### Lines 28–41

```typescript
const styles = StyleSheet.create({
  container: {
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
  },
  versionText: {
    textAlign: 'center',
  },
  badgeImage: {
    width: 123,
    aspectRatio: 123 / 24,
  },
});
```

**Explanation:**

- **Lines 28–41:** Styling for web footer badge: centers elements vertically, defines 123px badge width with 123:24 aspect ratio.
