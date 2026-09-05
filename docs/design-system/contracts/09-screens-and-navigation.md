# Vertrag: Screens und Navigation

## Zweck

`Screen` ist das gemeinsame Gerüst für Safe Area, Hintergrund, Inhaltsbreite,
Scrollen, Tastatur, unteren Freiraum und Header.

## Header-Modi

- `chrome`: Hauptbereich mit Menü, zentriertem Titel, Aktion und Profil
- `back`: Unterseite mit Historie und optionalem Fallback-Ziel
- normaler Titel: einfacher Screen ohne Hauptbereichschrome
- `ScreenHeader`: bewusst manuell aufgebauter Header

## Vertrag umgesetzt

```tsx
<Screen
  title="Produktsuche"
  back={{ label: 'Einstellungen', href: '/settings' }}
  backStyle="icon">
  {content}
</Screen>
```

## Vertrag nicht umgesetzt

```tsx
<SafeAreaView>
  <Pressable onPress={() => router.back()}><Text>‹</Text></Pressable>
  <Text style={{ fontSize: 27 }}>Produktsuche</Text>
</SafeAreaView>
```

Das Gegenbeispiel dupliziert Safe Area und Header, hat kein Fallback-Ziel und
driftet typografisch. `chrome` und `back` werden nicht kombiniert. Sichtbar im
Referenz-Screen **Screens**.

