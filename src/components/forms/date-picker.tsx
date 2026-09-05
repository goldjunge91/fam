import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { Button, Txt } from '@/constants/ui';

interface DatePickerProps {
  label?: string;
  value: string; // "YYYY-MM-DD"
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
}

export function DatePicker({
  label = 'Geburtsdatum',
  value,
  onChangeText,
  placeholder = 'JJJJ-MM-TT (z.B. 2020-05-14)',
  error,
}: DatePickerProps) {
  const [showModal, setShowModal] = useState(false);

  // Default year/month/day selection state in modal
  const initialDate = /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
    ? new Date(value.trim())
    : new Date();
  const [selYear, setSelYear] = useState(initialDate.getFullYear());
  const [selMonth, setSelMonth] = useState(initialDate.getMonth() + 1);
  const [selDay, setSelDay] = useState(initialDate.getDate());

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

  return (
    <View className="gap-one">
      <View className="flex-row items-end gap-two">
        <View className="flex-1">
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
          accessibilityRole="button"
          accessibilityLabel="Datum auswählen"
          className="h-[48px] px-three rounded-control border-hairline items-center justify-center bg-background-element border-border">
          <Txt variant="body">📅</Txt>
        </Pressable>
      </View>

      {formattedDisplay && (
        <Txt variant="body" tone="secondary" className="ml-one -mt-[2px]">
          📅 {formattedDisplay}
        </Txt>
      )}

      {/* Modal Date Selector */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}>
        <View className="modal-backdrop">
          <View className="modal-sheet">
            <Txt variant="title" weight="600">
              Datum auswählen
            </Txt>

            <View className="flex-row justify-around my-two">
              {/* Year Adjust */}
              <View className="items-center gap-two">
                <Txt variant="body" weight="700">
                  Jahr
                </Txt>
                <View className="items-center gap-[6px]">
                  <Pressable
                    onPress={() => setSelYear((y) => Math.max(1900, y - 1))}
                    className="w-[40px] h-[40px] rounded-sheet items-center justify-center bg-background-element">
                    <Txt variant="body" weight="700">
                      -
                    </Txt>
                  </Pressable>
                  <Txt variant="body" weight="700">
                    {selYear}
                  </Txt>
                  <Pressable
                    onPress={() => setSelYear((y) => Math.min(2100, y + 1))}
                    className="w-[40px] h-[40px] rounded-sheet items-center justify-center bg-background-element">
                    <Txt variant="body" weight="700">
                      +
                    </Txt>
                  </Pressable>
                </View>
              </View>

              {/* Month Adjust */}
              <View className="items-center gap-two">
                <Txt variant="body" weight="700">
                  Monat
                </Txt>
                <View className="items-center gap-[6px]">
                  <Pressable
                    onPress={() => setSelMonth((m) => (m <= 1 ? 12 : m - 1))}
                    className="w-[40px] h-[40px] rounded-sheet items-center justify-center bg-background-element">
                    <Txt variant="body" weight="700">
                      -
                    </Txt>
                  </Pressable>
                  <Txt variant="body" weight="700">
                    {String(selMonth).padStart(2, '0')}
                  </Txt>
                  <Pressable
                    onPress={() => setSelMonth((m) => (m >= 12 ? 1 : m + 1))}
                    className="w-[40px] h-[40px] rounded-sheet items-center justify-center bg-background-element">
                    <Txt variant="body" weight="700">
                      +
                    </Txt>
                  </Pressable>
                </View>
              </View>

              {/* Day Adjust */}
              <View className="items-center gap-two">
                <Txt variant="body" weight="700">
                  Tag
                </Txt>
                <View className="items-center gap-[6px]">
                  <Pressable
                    onPress={() => setSelDay((d) => (d <= 1 ? 31 : d - 1))}
                    className="w-[40px] h-[40px] rounded-sheet items-center justify-center bg-background-element">
                    <Txt variant="body" weight="700">
                      -
                    </Txt>
                  </Pressable>
                  <Txt variant="body" weight="700">
                    {String(selDay).padStart(2, '0')}
                  </Txt>
                  <Pressable
                    onPress={() => setSelDay((d) => (d >= 31 ? 1 : d + 1))}
                    className="w-[40px] h-[40px] rounded-sheet items-center justify-center bg-background-element">
                    <Txt variant="body" weight="700">
                      +
                    </Txt>
                  </Pressable>
                </View>
              </View>
            </View>

            <View className="flex-row gap-two mt-two">
              <View className="flex-1">
                <Button title="Übernehmen" onPress={handleApplyModal} />
              </View>
              <View className="flex-1">
                <Button title="Abbrechen" variant="secondary" onPress={() => setShowModal(false)} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
