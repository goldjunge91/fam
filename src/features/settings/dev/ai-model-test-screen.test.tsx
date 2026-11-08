import { render, screen, userEvent } from '@testing-library/react-native';
import { useDevSettingsStore } from '@/constants/dev-settings';
import { testAiModel } from '@/features/ai-assistant/data/assistant-api';
import { AiModelTestScreen } from './ai-model-test-screen';

const mockStorageData = new Map<string, string>();
let mockHasAccess = true;

jest.mock('@/lib/storage/local-device-storage', () => ({
  getDeviceStorage: () => ({
    getString: (key: string) => mockStorageData.get(key),
    remove: (key: string) => mockStorageData.delete(key),
    set: (key: string, value: string) => mockStorageData.set(key, value),
  }),
}));
jest.mock('@/hooks/use-dev-tools-access', () => ({ useDevToolsAccess: () => mockHasAccess }));
jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'household-1' }),
}));
jest.mock('@/features/ai-assistant/data/assistant-api', () => ({
  testAiModel: jest.fn(),
}));
jest.mock('@/components/layout/screen', () => {
  const { Text, View } = require('react-native');
  return {
    Screen: ({ title, children }: { title: string; children: React.ReactNode }) => (
      <View>
        <Text>{title}</Text>
        {children}
      </View>
    ),
  };
});
jest.mock('@/components/ui/content-card', () => {
  const { Text, View } = require('react-native');
  return {
    ContentCard: ({ title, children }: { title?: string; children: React.ReactNode }) => (
      <View>
        {title ? <Text>{title}</Text> : null}
        {children}
      </View>
    ),
  };
});
jest.mock('@/features/settings/settings-menu', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    SettingsGroup: ({ title, children }: { title?: string; children: React.ReactNode }) => (
      <View>
        {title ? <Text>{title}</Text> : null}
        {children}
      </View>
    ),
    SettingsRow: ({
      label,
      value,
      hint,
      onPress,
    }: {
      label: string;
      value?: string;
      hint?: string;
      onPress?: () => void;
    }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={value ? `${label}: ${value}` : label}
        onPress={onPress}>
        <Text>{label}</Text>
        {hint ? <Text>{hint}</Text> : null}
        {value ? <Text>{value}</Text> : null}
      </Pressable>
    ),
  };
});
jest.mock('@/constants/ui', () => {
  const { Pressable, Text, TextInput, View } = require('react-native');
  return {
    Button: ({
      title,
      onPress,
      disabled,
      loading,
    }: {
      title: string;
      onPress?: () => void;
      disabled?: boolean;
      loading?: boolean;
    }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        onPress={onPress}
        disabled={disabled || loading}>
        <Text>{title}</Text>
      </Pressable>
    ),
    SegmentedControl: ({
      options,
      selected,
      onSelect,
    }: {
      label: string;
      options: Array<{ value: string; label: string }>;
      selected: string;
      onSelect: (value: string) => void;
    }) => (
      <View>
        {options.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: selected === option.value }}
            onPress={() => onSelect(option.value)}
          />
        ))}
      </View>
    ),
    TextField: ({
      label,
      ...props
    }: React.ComponentProps<typeof TextInput> & { label: string }) => (
      <View>
        <Text>{label}</Text>
        <TextInput accessibilityLabel={label} {...props} />
      </View>
    ),
    Txt: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
  };
});
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
}));

describe('AiModelTestScreen', () => {
  beforeEach(() => {
    mockStorageData.clear();
    mockHasAccess = true;
    useDevSettingsStore.setState({
      aiProvider: 'openrouter',
      aiModel: 'z-ai/glm-5.3-flash',
      aiModels: {
        openrouter: 'z-ai/glm-5.3-flash',
        groq: 'qwen/qwen3.8-27b',
      },
    });
    jest.mocked(testAiModel).mockReset();
  });

  it('selects a provider and model, then tests that model through the local gateway', async () => {
    jest.mocked(testAiModel).mockResolvedValue({
      provider: 'groq',
      model: 'qwen/qwen3.8-27b',
      text: 'Linsen-Kartoffel-Eintopf',
      durationMs: 320,
      usage: { total_tokens: 42 },
    });
    await render(<AiModelTestScreen />);
    const user = userEvent.setup();

    await user.press(screen.getByRole('radio', { name: 'Groq' }));
    expect(screen.getByRole('button', { name: 'Qwen 3.8 27B: Ausgewählt' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /GPT-OSS Safeguard 20B/u })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Llama Prompt Guard 2 22M/u })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Llama Prompt Guard 2 86M/u })).toBeOnTheScreen();
    expect(useDevSettingsStore.getState()).toMatchObject({
      aiProvider: 'groq',
      aiModel: 'qwen/qwen3.8-27b',
    });
    await user.press(screen.getByRole('button', { name: 'Qwen 3.8 27B testen' }));

    expect(testAiModel).toHaveBeenCalledWith({
      householdId: 'household-1',
      provider: 'groq',
      model: 'qwen/qwen3.8-27b',
      prompt: 'Schlage ein schnelles Abendessen mit Kartoffeln und Linsen vor.',
    });
    expect(await screen.findByText('Linsen-Kartoffel-Eintopf')).toBeOnTheScreen();
    expect(screen.getByText(/320 ms · 42 Tokens/u)).toBeOnTheScreen();
  });

  it('hides the screen when developer access is unavailable', async () => {
    mockHasAccess = false;
    await render(<AiModelTestScreen />);

    expect(screen.getByText('redirect:/settings')).toBeOnTheScreen();
    expect(screen.queryByText('KI-Modell testen')).not.toBeOnTheScreen();
  });

  it('applies and tests a manually entered model ID', async () => {
    jest.mocked(testAiModel).mockResolvedValue({
      provider: 'openrouter',
      model: 'anthropic/claude-sonnet-4',
      text: 'Kartoffelsuppe',
      durationMs: 280,
    });
    await render(<AiModelTestScreen />);
    const user = userEvent.setup();

    const modelIdInput = screen.getByLabelText('OpenRouter Modell-ID');
    await user.clear(modelIdInput);
    await user.type(modelIdInput, 'anthropic/claude-sonnet-4');
    await user.press(screen.getByRole('button', { name: 'Modell-ID übernehmen' }));

    expect(useDevSettingsStore.getState()).toMatchObject({
      aiModel: 'anthropic/claude-sonnet-4',
      aiModels: { openrouter: 'anthropic/claude-sonnet-4' },
    });
    await user.press(screen.getByRole('button', { name: 'anthropic/claude-sonnet-4 testen' }));
    expect(testAiModel).toHaveBeenCalledWith({
      householdId: 'household-1',
      provider: 'openrouter',
      model: 'anthropic/claude-sonnet-4',
      prompt: 'Schlage ein schnelles Abendessen mit Kartoffeln und Linsen vor.',
    });
  });
});
