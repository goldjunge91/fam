import { useEffect } from 'react';

import { getExpiryInfo } from '@/features/inventory/expiry';
import { useInventoryItems } from '@/features/inventory/use-inventory-items';
import { getNotificationSettings, scheduleExpiryNotificationReminder } from '@/lib/notifications';

export function useExpiryNotifications(householdId: string | undefined) {
  const { data: fridgeItems = [] } = useInventoryItems(householdId);

  useEffect(() => {
    if (!householdId || fridgeItems.length === 0) return;

    let isMounted = true;

    async function syncNotifications() {
      const settings = await getNotificationSettings();
      if (!isMounted || !settings.enabled) return;

      const now = new Date();
      // Filtere Artikel, die in <= daysThreshold Tagen ablaufen oder bereits abgelaufen sind
      const expiringCount = fridgeItems.filter((item) => {
        if (!item.expiry_date) return false;
        const info = getExpiryInfo(item.expiry_date, now);
        if (info.bucket === 'expired' || info.bucket === 'critical') return true;
        if (info.daysLeft !== null && info.daysLeft <= settings.daysThreshold) {
          return true;
        }
        return false;
      }).length;

      await scheduleExpiryNotificationReminder(expiringCount, settings);
    }

    syncNotifications();

    return () => {
      isMounted = false;
    };
  }, [householdId, fridgeItems]);
}
