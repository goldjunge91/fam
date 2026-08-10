select
  fi.id,
  h.name as haushalt,
  sl.name as lagerort,
  fi.name as lebensmittel,
  fi.quantity as menge,
  fi.unit as einheit,
  fi.expiry_date as mindesthaltbarkeitsdatum,
  p_added.display_name as hinzugefuegt_von,
  fi.created_at
from
  public.fridge_items fi
  join public.households h on h.id = fi.household_id
  join public.household_members hm on hm.household_id = h.id
  join auth.users u on u.id = hm.user_id
  left join public.storage_locations sl on sl.id = fi.location_id
  left join public.profiles p_added on p_added.id = fi.added_by
where
  u.email = 'test111@user.info' -- <--- Hier E-Mail anpassen
  and fi.deleted_at is null
order by
  h.name,
  fi.name;