import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface PublishModalProps {
  visible: boolean;
  onCancel: () => void;
  onPublish: () => void;
}

export function PublishModal({ visible, onCancel, onPublish }: PublishModalProps) {
  return (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View style={styles.modalContent}>
          <Text style={styles.title}>Publish Recipe</Text>
          <Text style={styles.message}>Are you sure you want to publish the recipe?</Text>
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel publish">
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={[styles.button, styles.publishButton]}
              onPress={onPublish}
              accessibilityRole="button"
              accessibilityLabel="Confirm publish">
              <Text style={styles.publishText}>Publish</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FF5262',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    fontWeight: '400',
    color: '#332222',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  button: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#FFE2E2',
  },
  publishButton: {
    backgroundColor: '#FF5262',
  },
  cancelText: {
    color: '#FF5262',
    fontSize: 16,
    fontWeight: '600',
  },
  publishText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
