import { useState } from 'react';

import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { ReceiptCaptureReviewFlow } from '@/features/ocr/processing/review/receipt-capture-review-flow';
import { ReceiptScannerDummyScreen } from './receipt-scanner-dummy-screen';

/** Connects the scanner presentation to the existing capture, OCR, and review flow. */
export function ReceiptScannerScreen() {
  const [flowOpen, setFlowOpen] = useState(false);
  const { session } = useSession();
  const { activeHouseholdId } = useActiveHousehold();
  const userId = session?.user.id;

  return (
    <>
      <ReceiptScannerDummyScreen
        onCapture={() => setFlowOpen(true)}
        onPickFromGallery={() => setFlowOpen(true)}
      />
      {userId && activeHouseholdId ? (
        <ReceiptCaptureReviewFlow
          visible={flowOpen}
          householdId={activeHouseholdId}
          createdBy={userId}
          onDismiss={() => setFlowOpen(false)}
        />
      ) : null}
    </>
  );
}
