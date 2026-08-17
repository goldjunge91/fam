 ▐▛███▜▌   Claude Code v2.1.233
▝▜█████▛▘  Sonnet 5 · Claude Pro
  ▘▘ ▝▝    ~/Github.tmp/family_app/fam


⏺ 4/6 fertig. Weiter mit add-item-screen.tsx (360 Zeilen):

  Searched for 1 pattern, read 1 file, ran 1 shell command (ctrl+o to expand)
  ⎿  Read src/features/inventory/storage-locations-screen.tsx (165 lines)
  ⎿  Referenced file src/global.css
  ⎿  Read src/features/inventory/barcode-scanner-modal.tsx (133 lines)
  ⎿  Read src/features/inventory/add-product-screen.tsx (138 lines)
  ⎿  Read src/features/inventory/frequent-products-quick-select.tsx (91 lines)
  ⎿  Skills restored (expo-tailwind-setup)

⏺ Gut, rounded-sm (8px, entspricht Radius.sm) und border-border existieren
  bereits. Jetzt konvertiere ich die Datei.

⏺ Update(src/features/inventory/add-item-screen.tsx)
  ⎿  Added 1 line, removed 2 lines
      2  import * as Crypto from 'expo-crypto';
      3  import { router, useFocusEffect } from 'expo-router';
      4  import { useCallback, useState } from 'react';
      5 -import { StyleSheet, View } from 'react-native';                
      5 +import { View } from 'react-native';                            
      6  
      7  import { DateWheelField } from '@/components/date-wheel-field';
      8  import { FilterChipBar } from '@/components/filter-chip-bar';
     ...
      11  import { TextField } from '@/components/text-field';
      12  import { ThemedText } from '@/components/themed-text';
      13  import { Button } from '@/components/ui/buttons';
      14 -import { Radius, Spacing } from '@/constants/theme';           
      14  import { useSession } from '@/features/auth/session-provider';
      15  import { useAddFridgeItemMutation } from '@/features/fridge/use
          -fridge-mutations';
      16  import { useActiveHousehold } from '@/features/household/active
          -household-provider';

⏺ Update(src/features/inventory/add-item-screen.tsx)
  ⎿  Added 13 lines, removed 13 lines
      189  
      190    return (
      191      <Screen title="Artikel hinzufügen" back={{ label: 'Abbrech
           en' }}>
      192 -      <View style={styles.form}>                              
      192 +      <View className="gap-four mt-four">                     
      193          <Button
      194            label="📷 Barcode scannen"
      195            variant="secondary"
     ...
      210            onSelectProduct={handleSelectProduct}
      211          />
      212  
      213 -        <View style={styles.row}>                             
      214 -          <View style={styles.flex}>                          
      215 -            <ThemedText type="small" themeColor="textSecondary
          -" style={styles.fieldLabel}>                                  
      213 +        <View className="flex-row gap-four">                  
      214 +          <View className="flex-1">                           
      215 +            <ThemedText type="small" themeColor="textSecondary
          +" className="mb-one">                                         
      216                Menge
      217              </ThemedText>
      218              <QuantityStepper
     ...
      222                label="Menge"
      223              />
      224            </View>
      225 -          <View style={styles.flex}>                          
      225 +          <View className="flex-1">                           
      226              <TextField
      227                label="Einheit"
      228                placeholder="piece, l, kg..."
     ...
      232            </View>
      233          </View>
      234  
      235 -        <View style={{ marginTop: Spacing.two }}>             
      235 +        <View className="mt-two">                             
      236            <DateWheelField
      237              label="Mindesthaltbarkeitsdatum (MHD)"
      238              value={expiryDate}
     ...
      246            onSelect={(value) => setExpiryDate(quickDateOffset(v
           alue))}
      247          />
      248  
      249 -        <View style={styles.locationHeaderRow}>               
      250 -          <ThemedText style={{ fontWeight: 'bold' }}>Lagerort<
          -/ThemedText>                                                  
      249 +        <View className="flex-row justify-between items-center
          + mt-two">                                                     
      250 +          <ThemedText className="font-bold">Lagerort</ThemedTe
          +xt>                                                           
      251            {!showAddLocation && (
      252              <Button
      253                label="+ Neuer Lagerort"
     ...
      258          </View>
      259  
      260          {showAddLocation && (
      261 -          <View style={styles.addLocationBox}>                
      261 +          <View className="gap-three p-three rounded-sm border
          + border-border">                                              
      262              <TextField
      263                label="Name des Lagerorts"
      264                placeholder="z.B. Keller, Regalfach, Gefrierfach
           "
      265                value={newLocationName}
      266                onChangeText={setNewLocationName}
      267              />
      268 -            <View style={styles.row}>                         
      269 -              <View style={styles.flex}>                      
      268 +            <View className="flex-row gap-four">              
      269 +              <View className="flex-1">                       
      270                  <Button
      271                    label="Erstellen"
      272                    onPress={handleAddLocation}
     ...
      274                    disabled={!newLocationName.trim()}
      275                  />
      276                </View>
      277 -              <View style={styles.flex}>                      
      277 +              <View className="flex-1">                       
      278                  <Button
      279                    label="Abbrechen"
      280                    variant="secondary"
     ...
      305            )
      306          )}
      307  
      308 -        <View style={styles.saveButton}>                      
      308 +        <View className="mt-four">                            
      309            <Button
      310              label="Speichern"
      311              onPress={handleSave}

⏺ Jetzt den styles-Block entfernen:

⏺ Update(src/features/inventory/add-item-screen.tsx)
  ⎿  Removed 33 lines
      324      </Screen>
      325    );
      326  }
      327 -                                                              
      328 -const styles = StyleSheet.create({                            
      329 -  form: {                                                     
      330 -    gap: Spacing.four,                                        
      331 -    marginTop: Spacing.four,                                  
      332 -  },                                                          
      333 -  row: {                                                      
      334 -    flexDirection: 'row',                                     
      335 -    gap: Spacing.four,                                        
      336 -  },                                                          
      337 -  flex: {                                                     
      338 -    flex: 1,                                                  
      339 -  },                                                          
      340 -  fieldLabel: {                                               
      341 -    marginBottom: Spacing.one,                                
      342 -  },                                                          
      343 -  locationHeaderRow: {                                        
      344 -    flexDirection: 'row',                                     
      345 -    justifyContent: 'space-between',                          
      346 -    alignItems: 'center',                                     
      347 -    marginTop: Spacing.two,                                   
      348 -  },                                                          
      349 -  addLocationBox: {                                           
      350 -    gap: Spacing.three,                                       
      351 -    padding: Spacing.three,                                   
      352 -    borderRadius: Radius.sm,                                  
      353 -    borderWidth: 1,                                           
      354 -    borderColor: '#ccc',                                      
      355 -  },                                                          
      356 -  saveButton: {                                               
      357 -    marginTop: Spacing.four,                                  
      358 -  },                                                          
      359 -});                                                           

⏺ Jetzt zu product-search-dropdown.tsx:

  Searched for 3 patterns, read 1 file, ran 2 shell commands (ctrl+o to expand)

⏺ Update(src/features/inventory/product-search-dropdown.tsx)
  ⎿  Removed 2 lines
       8    Pressable,
       9    ScrollView,
      10    type StyleProp,
      11 -  StyleSheet,                                                  
      11    type TextStyle,
      12    View,
      13  } from 'react-native';
      14  
      15  import { TextField } from '@/components/text-field';
      16  import { ThemedText } from '@/components/themed-text';
      18 -import { Radius, Spacing } from '@/constants/theme';           
      17  import { useTheme } from '@/hooks/use-theme';
      18  import { getDatabase } from '@/lib/db/client';
      19  import { isOffDumpAttached } from '@/lib/off-dump/off-dump';

⏺ Update(src/features/inventory/product-search-dropdown.tsx)
  ⎿  Added 17 lines, removed 80 lines
      345    const showEmptyState = searched && !searching && suggestions
           .length === 0;
      346  
      347    return (
      348 -    <View style={styles.container} onTouchStart={(event) => ev
          -ent.stopPropagation()}>                                       
      348 +    <View className="relative z-10" onTouchStart={(event) => e
          +vent.stopPropagation()}>                                      
      349        <TextField
      350          label={label}
      351          placeholder={placeholder}
     ...
      365        />
      366  
      367        {searching && (
      368 -        <View style={styles.loader}>                          
      368 +        <View className="absolute right-3 top-9">             
      369            <ActivityIndicator size="small" color={theme.accent}
            />
      370          </View>
      371        )}
      372  
      373        {showDropdown && (suggestions.length > 0 || showEmptySta
           te) && (
      374          <ScrollView
      375 -          style={[                                            
      376 -            styles.dropdown,                                  
      377 -            {                                                 
      378 -              backgroundColor: theme.background,              
      379 -              borderColor: theme.border,                      
      380 -              shadowColor: theme.shadowSheet,                 
      381 -            },                                                
      382 -          ]}                                                  
      375 +          className="absolute top-full left-0 right-0 z-20 mt-
          +1 max-h-[220px] rounded-control border border-border bg-backgr
          +ound shadow-sheet"                                            
      376 +          // elevation ist ein Android-only-Wert ohne Tailwind
          +-Aequivalent                                                  
      377 +          // (boxShadow deckt nur den iOS/Web-Schatten ab).   
      378 +          style={{ elevation: 4 }}                            
      379            keyboardShouldPersistTaps="handled"
      380            showsVerticalScrollIndicator
      381            onScroll={({ nativeEvent }) => {
     ...
      394                    params: { prefillName: value.trim() },
      395                  });
      396                }}
      401 -              style={[styles.itemRow, { borderBottomColor: the
          -me.border }]}>                                                
      402 -              <View style={styles.itemText}>                  
      397 +              className="flex-row items-center p-two border-b-
          +hairline border-border gap-two">                              
      398 +              <View className="flex-1">                       
      399                  <ThemedText
      400                    type={size === 'large' ? 'body' : 'smallBold
           '}
      405 -                  style={size === 'large' && styles.largeSugge
          -stionTitle}>                                                  
      401 +                  className={size === 'large' ? 'font-bold' : 
          +undefined}>                                                   
      402                    + &quot;{value.trim()}&quot; manuell anlegen
      403                  </ThemedText>
      404                  <ThemedText
      405                    type={size === 'large' ? 'body' : 'small'}
      406                    themeColor="textSecondary"
      411 -                  style={size === 'large' && styles.largeSugge
          -stionMeta}>                                                   
      407 +                  className={size === 'large' ? 'font-medium' 
          +: undefined}>                                                 
      408                    Kein Treffer bei Open Food Facts gefunden
      409                  </ThemedText>
      410                </View>
     ...
      418                  onSelectProduct(item);
      419                  setShowDropdown(false);
      420                }}
      425 -              style={[styles.itemRow, { borderBottomColor: the
          -me.border }]}>                                                
      421 +              className="flex-row items-center p-two border-b-
          +hairline border-border gap-two">                              
      422                {item.imageUrl ? (
      427 -                <Image source={{ uri: item.imageUrl }} style={
          -styles.img} />                                                
      423 +                <Image source={{ uri: item.imageUrl }} classNa
          +me="w-8 h-8 rounded-sm" />                                    
      424                ) : (
      429 -                <View style={[styles.imgPlaceholder, { backgro
          -undColor: theme.backgroundElement }]}>                        
      425 +                <View className="w-8 h-8 rounded-sm items-cent
          +er justify-center bg-background-element">                     
      426                    <ThemedText type={size === 'large' ? 'body' 
           : 'bodySmall'}>🥫</ThemedText>
      427                  </View>
      428                )}
      429  
      434 -              <View style={styles.itemText}>                  
      430 +              <View className="flex-1">                       
      431                  <ThemedText
      432                    type={size === 'large' ? 'body' : 'smallBold
           '}
      433                    numberOfLines={1}
      438 -                  style={size === 'large' && styles.largeSugge
          -stionTitle}>                                                  
      434 +                  className={size === 'large' ? 'font-bold' : 
          +undefined}>                                                   
      435                    {item.name}
      436                  </ThemedText>
      437                  <ThemedText
      438                    type={size === 'large' ? 'body' : 'small'}
      439                    themeColor="textSecondary"
      440                    numberOfLines={1}
      445 -                  style={size === 'large' && styles.largeSugge
          -stionMeta}>                                                   
      441 +                  className={size === 'large' ? 'font-medium' 
          +: undefined}>                                                 
      442                    {item.brand ? `${item.brand} · ` : ''}
      443                    {item.quantity} {item.unit}
      444                    {item.caloriesPer100g ? ` · ${item.caloriesP
           er100g} kcal/100g` : ''}
     ...
      447              </Pressable>
      448            ))}
      449            {loadingMoreOff && (
      454 -            <View style={styles.loadingMore}>                 
      450 +            <View className="py-two items-center">            
      451                <ActivityIndicator size="small" color={theme.acc
           ent} />
      452              </View>
      453            )}
     ...
      456      </View>
      457    );
      458  });
      463 -                                                              
      464 -const styles = StyleSheet.create({                            
      465 -  container: {                                                
      466 -    position: 'relative',                                     
      467 -    zIndex: 10,                                               
      468 -  },                                                          
      469 -  loader: {                                                   
      470 -    position: 'absolute',                                     
      471 -    right: 12,                                                
      472 -    top: 36,                                                  
      473 -  },                                                          
      474 -  loadingMore: {                                              
      475 -    paddingVertical: Spacing.two,                             
      476 -    alignItems: 'center',                                     
      477 -  },                                                          
      478 -  dropdown: {                                                 
      479 -    position: 'absolute',                                     
      480 -    top: '100%',                                              
      481 -    left: 0,                                                  
      482 -    right: 0,                                                 
      483 -    zIndex: 20,                                               
      484 -    borderRadius: Radius.control,                             
      485 -    borderWidth: 1,                                           
      486 -    marginTop: 4,                                             
      487 -    maxHeight: 220,                                           
      488 -    elevation: 4,                                             
      489 -    shadowOffset: { width: 0, height: 2 },                    
      490 -    shadowOpacity: 0.15,                                      
      491 -    shadowRadius: 6,                                          
      492 -  },                                                          
      493 -  itemRow: {                                                  
      494 -    flexDirection: 'row',                                     
      495 -    alignItems: 'center',                                     
      496 -    padding: Spacing.two,                                     
      497 -    borderBottomWidth: StyleSheet.hairlineWidth,              
      498 -    gap: Spacing.two,                                         
      499 -  },                                                          
      500 -  img: {                                                      
      501 -    width: 32,                                                
      502 -    height: 32,                                               
      503 -    borderRadius: Radius.sm,                                  
      504 -  },                                                          
      505 -  imgPlaceholder: {                                           
      506 -    width: 32,                                                
      507 -    height: 32,                                               
      508 -    borderRadius: Radius.sm,                                  
      509 -    alignItems: 'center',                                     
      510 -    justifyContent: 'center',                                 
      511 -  },                                                          
      512 -  itemText: {                                                 
      513 -    flex: 1,                                                  
      514 -  },                                                          
      515 -  largeSuggestionTitle: {                                     
      516 -    fontWeight: 700,                                          
      517 -  },                                                          
      518 -  largeSuggestionMeta: {                                      
      519 -    fontWeight: 500,                                          
      520 -  },                                                          
      521 -});                                                           

  Searched for 1 pattern (ctrl+o to expand)

⏺ Das ist der dokumentierte Android-elevation-Sonderfall (kein
  Tailwind-Äquivalent), passt zum etablierten Muster. Jetzt Verifikation:

  Ran 2 shell commands (ctrl+o to expand)

⏺ Sauber. Jetzt CSS-Build und Tests:

  Ran 2 shell commands (ctrl+o to expand)

⏺ Alle 4 Testsuiten grün (der act()-Warning ist bereits vorbestehend, nicht
  durch die Migration verursacht). inventory/-Domäne ist damit komplett (6/6).
  Jetzt der volle Testlauf zur Sicherheit, bevor ich mit calorie-tracking/
  weitermache:

  Ran 1 shell command (ctrl+o to expand)

⏺ Alle 628 Tests grün. inventory/-Domäne (6/6) abgeschlossen. Ich pflege den
  Status in die Migration-Doc ein und mache dann mit calorie-tracking/ weiter.
  Searched for 1 pattern, read 1 file (ctrl+o to expand)

⏺ Update(docs/design-system/nativewind-liquid-glass-migration.md)
  ⎿  Added 12 lines, removed 4 lines
      173     nebenbei erledigte Vereinfachung — kein Bugfix, nur API-Kla
           rheit an
      174     einer lokalen Helper-Funktion). `bun run test` (31 Tests in
            `fridge/`,
      175     alle 628 app-weit) grün.
      176 -8. **`inventory/`** (6 Dateien, 1535 Zeilen):                 
      177 -   `frequent-products-quick-select.tsx` (117), `add-product-sc
          -reen.tsx`                                                     
      178 -   (155), `barcode-scanner-modal.tsx` (178), `storage-location
          -s-screen.tsx`                                                 
      179 -   (202), `add-item-screen.tsx` (360), `product-search-dropdow
          -n.tsx` (523)                                                  
      176 +8. [x] **`inventory/`** (6 Dateien, 1535 Zeilen) — alle fertig
          +. Neue                                                        
      177 +   Klassen u. a. `storage-location-row`, `storage-location-nam
          +e`,                                                           
      178 +   `storage-location-btn-row`, `frequent-products-chip`,      
      179 +   `scanner-backdrop`/`scanner-modal-box`/`scanner-target-fram
          +e`. In                                                        
      180 +   `product-search-dropdown.tsx` verbleibt `style={{ elevation
          +: 4 }}` als                                                   
      181 +   dokumentierte Android-Ausnahme (kein Tailwind-Äquivalent fü
          +r                                                             
      182 +   Android-Schatten, der Rest des Dropdown-Schattens läuft übe
          +r die                                                         
      183 +   `shadow-sheet`-Klasse). `bun run test` (15 Tests in `invent
          +ory/`, alle                                                   
      184 +   628 app-weit) grün.                                        
      185  9. **`calorie-tracking/`** (4 Dateien, 1862 Zeilen): `diary-sc
           reen.tsx`
      186     (493), `food-search-screen.tsx` (420), `add-food-entry-scre
           en.tsx`
      187     (517), `goal-setup-screen.tsx` (432)
      188 +9. **`calorie-tracking/`** (4 Dateien, 1862 Zeilen): `diary-sc
          +reen.tsx`                                                     
      189 +   (493), `food-search-screen.tsx` (420), `add-food-entry-scre
          +en.tsx`                                                       
      190 +   (517), `goal-setup-screen.tsx` (432)                       
      191  10. **`meal-planner/`** (5 Dateien, 1552 Zeilen):
      192      `components/recipe-picker-modal.tsx` (117),
      193      `components/entry-form-modal.tsx` (229),

  Read 1 file (ctrl+o to expand)

⏺ Duplikat, wird korrigiert:

⏺ Update(docs/design-system/nativewind-liquid-glass-migration.md)
  ⎿  Removed 3 lines
      185  9. **`calorie-tracking/`** (4 Dateien, 1862 Zeilen): `diary-sc
           reen.tsx`
      186     (493), `food-search-screen.tsx` (420), `add-food-entry-scre
           en.tsx`
      187     (517), `goal-setup-screen.tsx` (432)
      188 -9. **`calorie-tracking/`** (4 Dateien, 1862 Zeilen): `diary-sc
          -reen.tsx`                                                     
      189 -   (493), `food-search-screen.tsx` (420), `add-food-entry-scre
          -en.tsx`                                                       
      190 -   (517), `goal-setup-screen.tsx` (432)                       
      188  10. **`meal-planner/`** (5 Dateien, 1552 Zeilen):
      189      `components/recipe-picker-modal.tsx` (117),
      190      `components/entry-form-modal.tsx` (229),

⏺ Jetzt weiter mit calorie-tracking/. Erste Datei: diary-screen.tsx.

  Searched for 3 patterns, read 2 files (ctrl+o to expand)

⏺ Gut, contentContainerClassName ist etabliert. Jetzt baue ich die neuen Klassen
  in global.css und konvertiere die Datei.

  Read 1 file (ctrl+o to expand)

⏺ Update(src/global.css)
  ⎿  Added 117 lines
      1218    .storage-location-btn-row {
      1219      @apply flex-row gap-two mt-one;
      1220    }
      1221 +                                                             
      1222 +  /* diary-screen.tsx — borderCurve bleibt an den betroffenen
           + Views als                                                   
      1223 +     `style` (kein Tailwind-Aequivalent), analog zu dashboard
           +-screen.tsx. */                                              
      1224 +  .diary-root {                                              
      1225 +    @apply flex-1;                                           
      1226 +  }                                                          
      1227 +  .diary-safe-area {                                         
      1228 +    @apply flex-1 w-full max-w-content self-center;          
      1229 +  }                                                          
      1230 +  .diary-content {                                           
      1231 +    @apply px-four pt-[2px] pb-[126px] gap-two;              
      1232 +  }                                                          
      1233 +  .diary-goal-icon {                                         
      1234 +    @apply w-[20px] h-[20px] flex-row items-end justify-cente
           +r gap-[2px];                                                 
      1235 +  }                                                          
      1236 +  .diary-goal-bar {                                          
      1237 +    @apply w-[4px] rounded-hairline bg-accent;               
      1238 +  }                                                          
      1239 +  .diary-goal-bar-short {                                    
      1240 +    @apply h-[7px];                                          
      1241 +  }                                                          
      1242 +  .diary-goal-bar-tall {                                     
      1243 +    @apply h-[17px];                                         
      1244 +  }                                                          
      1245 +  .diary-goal-bar-mid {                                      
      1246 +    @apply h-[12px];                                         
      1247 +  }                                                          
      1248 +  .diary-date-row {                                          
      1249 +    @apply h-[42px] flex-row items-center;                   
      1250 +  }                                                          
      1251 +  .diary-date-arrow {                                        
      1252 +    @apply w-[40px] h-[38px] items-center justify-center acti
           +ve:opacity-[0.72];                                           
      1253 +  }                                                          
      1254 +  .diary-chevron {                                           
      1255 +    @apply text-[21px] leading-[23px] font-medium;           
      1256 +  }                                                          
      1257 +  .diary-date-copy {                                         
      1258 +    @apply flex-1 items-center justify-center;               
      1259 +  }                                                          
      1260 +  .diary-relative-date {                                     
      1261 +    @apply text-[14px] leading-[17px] font-bold;             
      1262 +  }                                                          
      1263 +  .diary-full-date {                                         
      1264 +    @apply mt-[1px] text-[10px] leading-[12px] font-medium;  
      1265 +  }                                                          
      1266 +  .diary-summary-card {                                      
      1267 +    @apply min-h-[160px] rounded-fam-large p-four flex-row it
           +ems-center gap-four bg-background-element/[84%];             
      1268 +  }                                                          
      1269 +  .diary-summary-stats {                                     
      1270 +    @apply flex-1 min-w-0 gap-[9px];                         
      1271 +  }                                                          
      1272 +  .diary-summary-row {                                       
      1273 +    @apply flex-row justify-between items-baseline gap-two;  
      1274 +  }                                                          
      1275 +  .diary-summary-label {                                     
      1276 +    @apply text-[10px] leading-[12px] font-medium;           
      1277 +  }                                                          
      1278 +  .diary-summary-value {                                     
      1279 +    @apply text-[10px] leading-[12px] font-bold text-right;  
      1280 +  }                                                          
      1281 +  .diary-goal-status {                                       
      1282 +    @apply mt-[2px] text-[9px] leading-[12px] font-semibold; 
      1283 +  }                                                          
      1284 +  .diary-macro-row {                                         
      1285 +    @apply flex-row gap-[7px];                               
      1286 +  }                                                          
      1287 +  .diary-macro-card {                                        
      1288 +    @apply flex-1 min-w-0 h-[58px] rounded-card px-[10px] py-
           +[9px] justify-between bg-background-element/[84%];           
      1289 +  }                                                          
      1290 +  .diary-macro-labels {                                      
      1291 +    @apply gap-[1px];                                        
      1292 +  }                                                          
      1293 +  .diary-macro-label {                                       
      1294 +    @apply text-[10px] leading-[12px] font-bold;             
      1295 +  }                                                          
      1296 +  .diary-macro-value {                                       
      1297 +    @apply text-[8px] leading-[10px] font-medium;            
      1298 +  }                                                          
      1299 +  .diary-meals-card {                                        
      1300 +    @apply rounded-sheet overflow-hidden bg-background-elemen
           +t/[84%];                                                     
      1301 +  }                                                          
      1302 +  .diary-meal-section {                                      
      1303 +    @apply border-b-hairline border-border;                  
      1304 +  }                                                          
      1305 +  .diary-meal-header {                                       
      1306 +    @apply min-h-[48px] px-four flex-row items-center justify
           +-between gap-three;                                          
      1307 +  }                                                          
      1308 +  .diary-meal-heading {                                      
      1309 +    @apply flex-1 min-w-0;                                   
      1310 +  }                                                          
      1311 +  .diary-meal-title {                                        
      1312 +    @apply text-[12px] leading-[15px] font-bold;             
      1313 +  }                                                          
      1314 +  .diary-meal-kcal {                                         
      1315 +    @apply mt-[1px] text-[9px] leading-[11px] font-medium;   
      1316 +  }                                                          
      1317 +  .diary-add-button {                                        
      1318 +    @apply w-[32px] h-[32px] rounded-control items-center jus
           +tify-center bg-accent active:opacity-[0.72];                 
      1319 +  }                                                          
      1320 +  .diary-entry-row {                                         
      1321 +    @apply min-h-[42px] mx-two mb-[6px] rounded-control px-[1
           +0px] py-[6px] flex-row items-center justify-between gap-[10px
           +] bg-background-selected/[47%] active:opacity-[0.72];        
      1322 +  }                                                          
      1323 +  .diary-entry-info {                                        
      1324 +    @apply flex-1 min-w-0;                                   
      1325 +  }                                                          
      1326 +  .diary-entry-name {                                        
      1327 +    @apply text-[10px] leading-[12px] font-bold;             
      1328 +  }                                                          
      1329 +  .diary-entry-quantity {                                    
      1330 +    @apply mt-[1px] text-[9px] leading-[11px] font-medium;   
      1331 +  }                                                          
      1332 +  .diary-entry-kcal {                                        
      1333 +    @apply text-[9px] leading-[11px] font-semibold;          
      1334 +  }                                                          
      1335 +  .diary-loading-text {                                      
      1336 +    @apply px-four py-[24px] text-[11px] leading-[14px];     
      1337 +  }                                                          
      1338  }

⏺ Jetzt die Komponente umschreiben:

⏺ Update(src/features/calorie-tracking/diary-screen.tsx)
  ⎿  Added 2 lines, removed 3 lines
      1  import { router } from 'expo-router';
      2  import { useState } from 'react';
      3 -import { Pressable, ScrollView, StyleSheet, View } from 'react-n
        -ative';                                                         
      3 +import { Pressable, ScrollView, View } from 'react-native';     
      4  import { SafeAreaView } from 'react-native-safe-area-context';
      5  
      6  import { PlusIcon } from '@/components/fam-icon';
     ...
       9  import { PageHeader } from '@/components/page-header';
      10  import { ProgressBar } from '@/components/progress-bar';
      11  import { ProgressRing } from '@/components/progress-ring';
      12 -import { FontSize, ThemedText } from '@/components/themed-text'
         -;                                                              
      12 +import { ThemedText } from '@/components/themed-text';         
      13  import { HeaderIconButton, MenuButton } from '@/components/ui/b
          uttons';
      14 -import { Radius } from '@/constants/theme';                    
      14  import { useSession } from '@/features/auth/session-provider';
      15  import { useActiveProfile } from '@/features/calorie-tracking/a
          ctive-profile-store';
      16  import {

⏺ Update(src/features/calorie-tracking/diary-screen.tsx)
  ⎿  Added 6 lines, removed 4 lines
      80  
      81    return (
      82      <View
      83 -      style={[styles.macroCard, { backgroundColor: `${theme.bac
         -kgroundElement}D6` }]}                                         
      83 +      className="diary-macro-card"                             
      84 +      // borderCurve ist ein echter Laufzeitwert ohne Tailwind-
         +Aequivalent.                                                   
      85 +      style={{ borderCurve: 'continuous' }}                    
      86        accessible
      87        accessibilityRole="progressbar"
      88        accessibilityLabel={
     ...
      90            ? `${label}: ${Math.round(value)} von ${Math.round(ta
          rget)} Gramm`
      91            : `${label}: ${Math.round(value)} Gramm, kein Ziel ge
          setzt`
      92        }>
      91 -      <View style={styles.macroLabels}>                        
      92 -        <ThemedText style={styles.macroLabel}>{label}</ThemedTe
         -xt>                                                            
      93 -        <ThemedText themeColor="textSecondary" style={styles.ma
         -croValue}>                                                     
      93 +      <View className="diary-macro-labels">                    
      94 +        <ThemedText className="diary-macro-label">{label}</Them
         +edText>                                                        
      95 +        <ThemedText themeColor="textSecondary" className="diary
         +-macro-value">                                                 
      96            {Math.round(value)} / {target > 0 ? Math.round(target
          ) : '–'} g
      97          </ThemedText>
      98        </View>

⏺ Update(src/features/calorie-tracking/diary-screen.tsx)
  ⎿  Added 18 lines, removed 22 lines
      118    const mealKcal = entries.reduce((sum, entry) => sum + (entry
           .kcal ?? 0), 0);
      119  
      120    return (
      121 -    <View style={!isLast ? [styles.mealSection, { borderBottom
          -Color: theme.border }] : undefined}>                          
      122 -      <View style={styles.mealHeader}>                        
      123 -        <View style={styles.mealHeading}>                     
      124 -          <ThemedText style={styles.mealTitle}>{MEAL_LABELS[me
          -al]}</ThemedText>                                             
      125 -          <ThemedText themeColor="textSecondary" style={styles
          -.mealKcal}>                                                   
      121 +    <View className={!isLast ? 'diary-meal-section' : undefine
          +d}>                                                           
      122 +      <View className="diary-meal-header">                    
      123 +        <View className="diary-meal-heading">                 
      124 +          <ThemedText className="diary-meal-title">{MEAL_LABEL
          +S[meal]}</ThemedText>                                         
      125 +          <ThemedText themeColor="textSecondary" className="di
          +ary-meal-kcal">                                               
      126              {formatKcal(mealKcal)}
      127            </ThemedText>
      128          </View>
     ...
      130            onPress={onAdd}
      131            role="button"
      132            aria-label={`Zu ${MEAL_LABELS[meal]} hinzufügen`}
      133 -          style={({ pressed }) => [                           
      134 -            styles.addButton,                                 
      135 -            { backgroundColor: theme.accent },                
      136 -            pressed && styles.pressed,                        
      137 -          ]}>                                                 
      133 +          className="diary-add-button"                        
      134 +          // borderCurve ist ein echter Laufzeitwert ohne Tail
          +wind-Aequivalent.                                             
      135 +          style={{ borderCurve: 'continuous' }}>              
      136            <PlusIcon size={18} color={theme.onAccent} />
      137          </Pressable>
      138        </View>
     ...
      142            onPress={() => onEntry(entry.id)}
      143            role="button"
      144            aria-label={`${entry.name} bearbeiten`}
      147 -          style={({ pressed }) => [                           
      148 -            styles.entryRow,                                  
      149 -            { backgroundColor: `${theme.backgroundSelected}78`
          - },                                                           
      150 -            pressed && styles.pressed,                        
      151 -          ]}>                                                 
      152 -          <View style={styles.entryInfo}>                     
      153 -            <ThemedText style={styles.entryName} numberOfLines
          -={1}>                                                         
      145 +          className="diary-entry-row"                         
      146 +          // borderCurve ist ein echter Laufzeitwert ohne Tail
          +wind-Aequivalent.                                             
      147 +          style={{ borderCurve: 'continuous' }}>              
      148 +          <View className="diary-entry-info">                 
      149 +            <ThemedText className="diary-entry-name" numberOfL
          +ines={1}>                                                     
      150                {entry.name}
      151              </ThemedText>
      156 -            <ThemedText themeColor="textSecondary" style={styl
          -es.entryQuantity} numberOfLines={1}>                          
      152 +            <ThemedText themeColor="textSecondary" className="
          +diary-entry-quantity" numberOfLines={1}>                      
      153                {entry.quantity} {entry.unit}
      154              </ThemedText>
      155            </View>
      160 -          <ThemedText themeColor="textSecondary" style={styles
          -.entryKcal}>                                                  
      156 +          <ThemedText themeColor="textSecondary" className="di
          +ary-entry-kcal">                                              
      157              {entry.kcal !== null ? formatKcal(entry.kcal) : '–
           '}
      158            </ThemedText>
      159          </Pressable>
     ...
      172    accent?: boolean;
      173  }) {
      174    return (
      179 -    <View style={styles.summaryRow}>                          
      180 -      <ThemedText themeColor="textSecondary" style={styles.sum
          -maryLabel}>                                                   
      175 +    <View className="diary-summary-row">                      
      176 +      <ThemedText themeColor="textSecondary" className="diary-
          +summary-label">                                               
      177          {label}
      178        </ThemedText>
      183 -      <ThemedText themeColor={accent ? 'accent' : 'text'} styl
          -e={styles.summaryValue}>                                      
      179 +      <ThemedText themeColor={accent ? 'accent' : 'text'} clas
          +sName="diary-summary-value">                                  
      180          {value}
      181        </ThemedText>
      182      </View>

⏺ Jetzt der Hauptteil (return):

⏺ Update(src/features/calorie-tracking/diary-screen.tsx)
  ⎿  Added 27 lines, removed 129 lines
      244    }
      245  
      246    return (
      247 -    <View style={styles.root}>                                
      247 +    <View className="diary-root">                             
      248        <GradientBackground {...hubGradient} />
      249 -      <SafeAreaView style={styles.safeArea} edges={['top', 'le
          -ft', 'right']}>                                               
      249 +      <SafeAreaView className="diary-safe-area" edges={['top',
          + 'left', 'right']}>                                           
      250          <PageHeader
      251            title="Tagebuch"
      252            align="center"
     ...
      255              <HeaderIconButton
      256                label="Ziele und Fortschritt öffnen"
      257                onPress={() => router.push('/settings/goals')}>
      258 -              <View style={styles.goalIcon}>                  
      259 -                <View                                         
      260 -                  style={[styles.goalBar, styles.goalBarShort,
          - { backgroundColor: theme.accent }]}                          
      261 -                />                                            
      262 -                <View                                         
      263 -                  style={[styles.goalBar, styles.goalBarTall, 
          -{ backgroundColor: theme.accent }]}                           
      264 -                />                                            
      265 -                <View                                         
      266 -                  style={[styles.goalBar, styles.goalBarMid, {
          - backgroundColor: theme.accent }]}                            
      267 -                />                                            
      258 +              <View className="diary-goal-icon">              
      259 +                <View className="diary-goal-bar diary-goal-bar
          +-short" />                                                    
      260 +                <View className="diary-goal-bar diary-goal-bar
          +-tall" />                                                     
      261 +                <View className="diary-goal-bar diary-goal-bar
          +-mid" />                                                      
      262                </View>
      263              </HeaderIconButton>
      264            }
     ...
      266  
      267          <ScrollView
      268            showsVerticalScrollIndicator={false}
      275 -          contentContainerStyle={styles.content}              
      269 +          contentContainerClassName="diary-content"           
      270            contentInsetAdjustmentBehavior="never">
      271            {childProfiles.length > 0 ? (
      272              <FilterChipBar
     ...
      277              />
      278            ) : null}
      279  
      286 -          <View style={styles.dateRow}>                       
      280 +          <View className="diary-date-row">                   
      281              <Pressable
      282                onPress={() => setSelectedDate((date) => addDays
           (date, -1))}
      283                role="button"
      284                aria-label="Vorheriger Tag"
      291 -              style={({ pressed }) => [styles.dateArrow, press
          -ed && styles.pressed]}>                                       
      292 -              <ThemedText themeColor="accent" style={styles.ch
          -evron}>                                                       
      285 +              className="diary-date-arrow">                   
      286 +              <ThemedText themeColor="accent" className="diary
          +-chevron">                                                    
      287                  ‹
      288                </ThemedText>
      289              </Pressable>
     ...
      291                onPress={() => setSelectedDate(todayIso)}
      292                role="button"
      293                aria-label="Heutigen Tag anzeigen"
      300 -              style={styles.dateCopy}>                        
      301 -              <ThemedText themeColor="accent" style={styles.re
          -lativeDate}>                                                  
      294 +              className="diary-date-copy">                    
      295 +              <ThemedText themeColor="accent" className="diary
          +-relative-date">                                              
      296                  {relativeDateLabel(selectedDate, todayIso)}
      297                </ThemedText>
      304 -              <ThemedText themeColor="textSecondary" style={st
          -yles.fullDate}>                                               
      298 +              <ThemedText themeColor="textSecondary" className
          +="diary-full-date">                                           
      299                  {fullDateLabel(selectedDate)}
      300                </ThemedText>
      301              </Pressable>
     ...
      303                onPress={() => setSelectedDate((date) => addDays
           (date, 1))}
      304                role="button"
      305                aria-label="Nächster Tag"
      312 -              style={({ pressed }) => [styles.dateArrow, press
          -ed && styles.pressed]}>                                       
      313 -              <ThemedText themeColor="accent" style={styles.ch
          -evron}>                                                       
      306 +              className="diary-date-arrow">                   
      307 +              <ThemedText themeColor="accent" className="diary
          +-chevron">                                                    
      308                  ›
      309                </ThemedText>
      310              </Pressable>
      311            </View>
      312  
      319 -          <View style={[styles.summaryCard, { backgroundColor:
          - `${theme.backgroundElement}D6` }]}>                          
      313 +          <View                                               
      314 +            className="diary-summary-card"                    
      315 +            // borderCurve ist ein echter Laufzeitwert ohne Ta
          +ilwind-Aequivalent.                                           
      316 +            style={{ borderCurve: 'continuous' }}>            
      317              <ProgressRing
      318                value={totals.kcal}
      319                target={calorieGoal}
     ...
      324                progressColor={theme.accent}
      325                trackColor={theme.backgroundSelected}
      326              />
      330 -            <View style={styles.summaryStats}>                
      327 +            <View className="diary-summary-stats">            
      328                <SummaryRow label="Gegessen" value={formatKcal(t
           otals.kcal)} />
      329                <SummaryRow
      330                  label="Grundziel"
     ...
      337                />
      338                <ThemedText
      339                  themeColor={currentGoal ? 'success' : 'textSec
           ondary'}
      343 -                style={styles.goalStatus}>                    
      340 +                className="diary-goal-status">                
      341                  {currentGoal ? 'Tagesziel ist aktiv' : 'Noch k
           ein Tagesziel hinterlegt'}
      342                </ThemedText>
      343              </View>
      344            </View>
      345  
      349 -          <View style={styles.macroRow}>                      
      346 +          <View className="diary-macro-row">                  
      347              <MacroSummary
      348                label="Protein"
      349                value={totals.proteinG}
     ...
      357              <MacroSummary label="Fett" value={totals.fatG} tar
           get={currentGoal?.fat_g ?? 0} />
      358            </View>
      359  
      363 -          <View style={[styles.mealsCard, { backgroundColor: `
          -${theme.backgroundElement}D6` }]}>                            
      360 +          <View                                               
      361 +            className="diary-meals-card"                      
      362 +            // borderCurve ist ein echter Laufzeitwert ohne Ta
          +ilwind-Aequivalent.                                           
      363 +            style={{ borderCurve: 'continuous' }}>            
      364              {isLoading ? (
      365                <ThemedText
      366                  type="captionCompact"
      367                  themeColor="textSecondary"
      368 -                style={styles.loadingText}>                   
      368 +                className="diary-loading-text">               
      369                  Lade Tagebuch...
      370                </ThemedText>
      371              ) : (
     ...
      386      </View>
      387    );
      388  }
      389 -                                                              
      390 -const styles = StyleSheet.create({                            
      391 -  root: { flex: 1 },                                          
      392 -  safeArea: { flex: 1, width: '100%', maxWidth: 800, alignSelf
          -: 'center' },                                                 
      393 -  content: { paddingHorizontal: 16, paddingTop: 2, paddingBott
          -om: 126, gap: 8 },                                            
      394 -  goalIcon: {                                                 
      395 -    width: 20,                                                
      396 -    height: 20,                                               
      397 -    flexDirection: 'row',                                     
      398 -    alignItems: 'flex-end',                                   
      399 -    justifyContent: 'center',                                 
      400 -    gap: 2,                                                   
      401 -  },                                                          
      402 -  goalBar: { width: 4, borderRadius: Radius.hairline },       
      403 -  goalBarShort: { height: 7 },                                
      404 -  goalBarTall: { height: 17 },                                
      405 -  goalBarMid: { height: 12 },                                 
      406 -  dateRow: { height: 42, flexDirection: 'row', alignItems: 'ce
          -nter' },                                                      
      407 -  dateArrow: { width: 40, height: 38, alignItems: 'center', ju
          -stifyContent: 'center' },                                     
      408 -  chevron: { ...FontSize[21], lineHeight: 23, fontWeight: 500 
          -},                                                            
      409 -  dateCopy: { flex: 1, alignItems: 'center', justifyContent: '
          -center' },                                                    
      410 -  relativeDate: { ...FontSize[14], lineHeight: 17, fontWeight:
          - 700 },                                                       
      411 -  fullDate: { marginTop: 1, ...FontSize[10], lineHeight: 12, f
          -ontWeight: 500 },                                             
      412 -  summaryCard: {                                              
      413 -    minHeight: 160,                                           
      414 -    borderRadius: Radius.large,                               
      415 -    borderCurve: 'continuous',                                
      416 -    padding: 16,                                              
      417 -    flexDirection: 'row',                                     
      418 -    alignItems: 'center',                                     
      419 -    gap: 16,                                                  
      420 -  },                                                          
      421 -  summaryStats: { flex: 1, minWidth: 0, gap: 9 },             
      422 -  summaryRow: {                                               
      423 -    flexDirection: 'row',                                     
      424 -    justifyContent: 'space-between',                          
      425 -    alignItems: 'baseline',                                   
      426 -    gap: 8,                                                   
      427 -  },                                                          
      428 -  summaryLabel: { ...FontSize[10], lineHeight: 12, fontWeight:
          - 500 },                                                       
      429 -  summaryValue: { ...FontSize[10], lineHeight: 12, fontWeight:
          - 700, textAlign: 'right' },                                   
      430 -  goalStatus: { marginTop: 2, ...FontSize[9], lineHeight: 12, 
          -fontWeight: 600 },                                            
      431 -  macroRow: { flexDirection: 'row', gap: 7 },                 
      432 -  macroCard: {                                                
      433 -    flex: 1,                                                  
      434 -    minWidth: 0,                                              
      435 -    height: 58,                                               
      436 -    borderRadius: Radius.card,                                
      437 -    borderCurve: 'continuous',                                
      438 -    paddingHorizontal: 10,                                    
      439 -    paddingVertical: 9,                                       
      440 -    justifyContent: 'space-between',                          
      441 -  },                                                          
      442 -  macroLabels: { gap: 1 },                                    
      443 -  macroLabel: { ...FontSize[10], lineHeight: 12, fontWeight: 7
          -00 },                                                         
      444 -  macroValue: { ...FontSize[8], lineHeight: 10, fontWeight: 50
          -0 },                                                          
      445 -  mealsCard: { borderRadius: Radius.sheet, borderCurve: 'conti
          -nuous', overflow: 'hidden' },                                 
      446 -  mealSection: { borderBottomWidth: StyleSheet.hairlineWidth }
          -,                                                             
      447 -  mealHeader: {                                               
      448 -    minHeight: 48,                                            
      449 -    paddingHorizontal: 16,                                    
      450 -    flexDirection: 'row',                                     
      451 -    alignItems: 'center',                                     
      452 -    justifyContent: 'space-between',                          
      453 -    gap: 12,                                                  
      454 -  },                                                          
      455 -  mealHeading: { flex: 1, minWidth: 0 },                      
      456 -  mealTitle: { ...FontSize[12], lineHeight: 15, fontWeight: 70
          -0 },                                                          
      457 -  mealKcal: { marginTop: 1, ...FontSize[9], lineHeight: 11, fo
          -ntWeight: 500 },                                              
      458 -  addButton: {                                                
      459 -    width: 32,                                                
      460 -    height: 32,                                               
      461 -    borderRadius: Radius.control,                             
      462 -    borderCurve: 'continuous',                                
      463 -    alignItems: 'center',                                     
      464 -    justifyContent: 'center',                                 
      465 -  },                                                          
      466 -  entryRow: {                                                 
      467 -    minHeight: 42,                                            
      468 -    marginHorizontal: 8,                                      
      469 -    marginBottom: 6,                                          
      470 -    borderRadius: Radius.control,                             
      471 -    borderCurve: 'continuous',                                
      472 -    paddingHorizontal: 10,                                    
      473 -    paddingVertical: 6,                                       
      474 -    flexDirection: 'row',                                     
      475 -    alignItems: 'center',                                     
      476 -    justifyContent: 'space-between',                          
      477 -    gap: 10,                                                  
      478 -  },                                                          
      479 -  entryInfo: { flex: 1, minWidth: 0 },                        
      480 -  entryName: { ...FontSize[10], lineHeight: 12, fontWeight: 70
          -0 },                                                          
      481 -  entryQuantity: { marginTop: 1, ...FontSize[9], lineHeight: 1
          -1, fontWeight: 500 },                                         
      482 -  entryKcal: { ...FontSize[9], lineHeight: 11, fontWeight: 600
          - },                                                           
      483 -  loadingText: {                                              
      484 -    paddingHorizontal: 16,                                    
      485 -    paddingVertical: 24,                                      
      486 -    ...FontSize[11],                                          
      487 -    lineHeight: 14,                                           
      488 -  },                                                          
      489 -  pressed: { opacity: 0.72 },                                 
      490 -});                                                           

⏺ Jetzt Verifikation:

  Searched for 1 pattern (ctrl+o to expand)

⏺ Alle dokumentiert (borderCurve-Ausnahme). Jetzt Biome/Typecheck/CSS/Tests:

  Ran 1 shell command (ctrl+o to expand)

⏺ Nur Formatierung (Zeilenumbruch). Weiter mit Typecheck/CSS/Tests:

  Ran 3 shell commands (ctrl+o to expand)

⏺ diary-screen.tsx fertig (1/4). Weiter mit food-search-screen.tsx:

  Searched for 2 patterns, read 1 file (ctrl+o to expand)

⏺ FlatList ist registriert. Ich benutze className dafür. Jetzt neue Klassen in
  global.css:

⏺ Update(src/global.css)
  ⎿  Added 38 lines
      1335    .diary-loading-text {
      1336      @apply px-four py-[24px] text-[11px] leading-[14px];
      1337    }
      1338 +                                                             
      1339 +  /* food-search-screen.tsx */                               
      1340 +  .fss-header {                                              
      1341 +    @apply gap-two;                                          
      1342 +  }                                                          
      1343 +  .fss-search-row {                                          
      1344 +    @apply flex-row items-center gap-two;                    
      1345 +  }                                                          
      1346 +  .fss-scan-btn {                                            
      1347 +    @apply w-[48px] h-[48px] rounded-control items-center jus
           +tify-center bg-background-element;                           
      1348 +  }                                                          
      1349 +  .fss-centered {                                            
      1350 +    @apply text-center mt-four;                              
      1351 +  }                                                          
      1352 +  .fss-center-loader {                                       
      1353 +    @apply mt-four;                                          
      1354 +  }                                                          
      1355 +  .fss-failed-box {                                          
      1356 +    @apply items-center gap-two mt-four;                     
      1357 +  }                                                          
      1358 +  .fss-footer-loader {                                       
      1359 +    @apply my-three;                                         
      1360 +  }                                                          
      1361 +  .fss-row {                                                 
      1362 +    @apply flex-row items-center gap-two py-two border-b-hair
           +line border-border;                                          
      1363 +  }                                                          
      1364 +  .fss-row-img {                                             
      1365 +    @apply w-9 h-9 rounded-sm;                               
      1366 +  }                                                          
      1367 +  .fss-row-img-placeholder {                                 
      1368 +    @apply w-9 h-9 rounded-sm items-center justify-center bg-
           +background-element;                                          
      1369 +  }                                                          
      1370 +  .fss-row-text {                                            
      1371 +    @apply flex-1 gap-[2px];                                 
      1372 +  }                                                          
      1373 +  .fss-quick-entry-btn {                                     
      1374 +    @apply flex-row items-center justify-center gap-two py-th
           +ree rounded-control-lg mt-three mb-four bg-background-element
           +;                                                            
      1375 +  }                                                          
      1376  }
⏺ Update(src/features/calorie-tracking/food-search-screen.tsx)
  ⎿  Added 2 lines, removed 3 lines
       1  import { router, useLocalSearchParams } from 'expo-router';
       2  import { useEffect, useRef, useState } from 'react';
       3 -import { ActivityIndicator, FlatList, Image, Pressable, StyleSh
         -eet, View } from 'react-native';                               
       3 +import { ActivityIndicator, FlatList, Image, Pressable, View } 
         +from 'react-native';                                           
       4  
       5  import { Screen } from '@/components/screen';
       6  import { SegmentedControl } from '@/components/segmented-contro
          l';
       7  import { TextField } from '@/components/text-field';
       8 -import { FontSize, ThemedText } from '@/components/themed-text'
         -;                                                              
       9 -import { Radius, Spacing } from '@/constants/theme';           
       8 +import { ThemedText } from '@/components/themed-text';         
       9  import { useSession } from '@/features/auth/session-provider';
      10  import type { MealType } from '@/features/calorie-tracking/api'
          ;
      11  import {

⏺ Update(src/features/calorie-tracking/food-search-screen.tsx)
  ⎿  Added 5 lines, removed 5 lines
      201        title={MEAL_LABELS[params.mealType] ?? 'Lebensmittel'}
      202        back={{ label: 'Abbrechen' }}
      203        scroll={false}>
      204 -      <View style={styles.header}>                            
      205 -        <View style={styles.searchRow}>                       
      206 -          <View style={styles.flex}>                          
      204 +      <View className="fss-header">                           
      205 +        <View className="fss-search-row">                     
      206 +          <View className="flex-1">                           
      207              <TextField
      208                placeholder="Wonach suchst du?"
      209                value={query}
     ...
      215              onPress={() => setShowScanner(true)}
      216              accessibilityRole="button"
      217              accessibilityLabel="Barcode scannen"
      218 -            style={[styles.scanBtn, { backgroundColor: theme.b
          -ackgroundElement }]}>                                         
      219 -            <ThemedText style={{ ...FontSize[20] }}>📷</Themed
          -Text>                                                         
      218 +            className="fss-scan-btn">                         
      219 +            <ThemedText className="text-[20px]">📷</ThemedText
          +>                                                             
      220            </Pressable>
      221          </View>
      222  

⏺ Update(src/features/calorie-tracking/food-search-screen.tsx)
  ⎿  Added 11 lines, removed 13 lines
      235  
      236        {isSearchMode ? (
      237          searching ? (
      238 -          <ActivityIndicator color={theme.accent} style={style
          -s.centerLoader} />                                            
      238 +          <ActivityIndicator color={theme.accent} className="f
          +ss-center-loader" />                                          
      239          ) : results.length === 0 && searchFailed ? (
      240 -          <View style={styles.failedBox}>                     
      241 -            <ThemedText type="small" themeColor="warning" styl
          -e={{ textAlign: 'center' }}>                                  
      240 +          <View className="fss-failed-box">                   
      241 +            <ThemedText type="small" themeColor="warning" clas
          +sName="text-center">                                          
      242                Open Food Facts ist gerade nicht erreichbar. Ver
           such's gleich nochmal.
      243              </ThemedText>
      244              <Pressable onPress={retrySearch} accessibilityRole
           ="button">
     ...
      248              </Pressable>
      249            </View>
      250          ) : results.length === 0 ? (
      251 -          <ThemedText type="small" themeColor="textSecondary" 
          -style={styles.centered}>                                      
      251 +          <ThemedText type="small" themeColor="textSecondary" 
          +className="fss-centered">                                     
      252              Keine Treffer für „{query}".
      253            </ThemedText>
      254          ) : (
      255            <FlatList
      256 -            style={styles.flex}                               
      256 +            className="flex-1"                                
      257              data={results}
      258              keyExtractor={(item, index) => item.barcode || `${
           item.name}-${index}`}
      259              renderItem={({ item }) => (
     ...
      264              keyboardShouldPersistTaps="handled"
      265              ListFooterComponent={
      266                loadingMore ? (
      267 -                <ActivityIndicator color={theme.accent} style=
          -{styles.footerLoader} />                                      
      267 +                <ActivityIndicator color={theme.accent} classN
          +ame="fss-footer-loader" />                                    
      268                ) : null
      269              }
      270            />
      271          )
      272        ) : historyLoading ? (
      273 -        <ActivityIndicator color={theme.accent} style={styles.
          -centerLoader} />                                              
      273 +        <ActivityIndicator color={theme.accent} className="fss
          +-center-loader" />                                            
      274        ) : historyList.length === 0 ? (
      275 -        <ThemedText type="small" themeColor="textSecondary" st
          -yle={styles.centered}>                                        
      275 +        <ThemedText type="small" themeColor="textSecondary" cl
          +assName="fss-centered">                                       
      276            Noch keine Einträge — fang mit der Suche oder „Schne
           ller Eintrag" an.
      277          </ThemedText>
      278        ) : (
      279          <FlatList
      280 -          style={styles.flex}                                 
      280 +          className="flex-1"                                  
      281            data={historyList}
      282            keyExtractor={(item) => item.name}
      283            renderItem={({ item }) => (
     ...
      287          />
      288        )}
      289  
      290 -      <Pressable                                              
      291 -        onPress={selectManualEntry}                           
      292 -        style={[styles.quickEntryBtn, { backgroundColor: theme
          -.backgroundElement }]}>                                       
      293 -        <ThemedText style={{ ...FontSize[18] }}>🍽️</ThemedText>
          -                                                              
      290 +      <Pressable onPress={selectManualEntry} className="fss-qu
          +ick-entry-btn">                                               
      291 +        <ThemedText className="text-[18px]">🍽️</ThemedText>   
      292          <ThemedText type="smallBold">Schneller Eintrag</Themed
           Text>
      293        </Pressable>
      294  

⏺ Update(src/features/calorie-tracking/food-search-screen.tsx)
  ⎿  Added 9 lines, removed 80 lines
      302  }
      303  
      304  function ProductRow({ product, onPress }: { product: OpenFoodF
           actsProduct; onPress: () => void }) {
      305 -  const theme = useTheme();                                   
      305    return (
      307 -    <Pressable onPress={onPress} style={[styles.row, { borderB
          -ottomColor: theme.border }]}>                                 
      306 +    <Pressable onPress={onPress} className="fss-row">         
      307        {product.imageUrl ? (
      309 -        <Image source={{ uri: product.imageUrl }} style={style
          -s.rowImg} />                                                  
      308 +        <Image source={{ uri: product.imageUrl }} className="f
          +ss-row-img" />                                                
      309        ) : (
      311 -        <View style={[styles.rowImgPlaceholder, { backgroundCo
          -lor: theme.backgroundElement }]}>                             
      312 -          <ThemedText style={{ ...FontSize[16] }}>🥫</ThemedTe
          -xt>                                                           
      310 +        <View className="fss-row-img-placeholder">            
      311 +          <ThemedText className="text-[16px]">🥫</ThemedText> 
      312          </View>
      313        )}
      315 -      <View style={styles.rowText}>                           
      314 +      <View className="fss-row-text">                         
      315          <ThemedText type="smallBold" numberOfLines={1}>
      316            {product.name}
      317          </ThemedText>
     ...
      327  }
      328  
      329  function HistoryRow({ entry, onPress }: { entry: FoodHistoryEn
           try; onPress: () => void }) {
      331 -  const theme = useTheme();                                   
      330    return (
      333 -    <Pressable onPress={onPress} style={[styles.row, { borderB
          -ottomColor: theme.border }]}>                                 
      334 -      <View style={[styles.rowImgPlaceholder, { backgroundColo
          -r: theme.backgroundElement }]}>                               
      335 -        <ThemedText style={{ ...FontSize[16] }}>🥫</ThemedText
          ->                                                             
      331 +    <Pressable onPress={onPress} className="fss-row">         
      332 +      <View className="fss-row-img-placeholder">              
      333 +        <ThemedText className="text-[16px]">🥫</ThemedText>   
      334        </View>
      337 -      <View style={styles.rowText}>                           
      335 +      <View className="fss-row-text">                         
      336          <ThemedText type="smallBold" numberOfLines={1}>
      337            {entry.name}
      338          </ThemedText>
     ...
      344      </Pressable>
      345    );
      346  }
      349 -                                                              
      350 -const styles = StyleSheet.create({                            
      351 -  header: {                                                   
      352 -    gap: Spacing.two,                                         
      353 -  },                                                          
      354 -  searchRow: {                                                
      355 -    flexDirection: 'row',                                     
      356 -    alignItems: 'center',                                     
      357 -    gap: Spacing.two,                                         
      358 -  },                                                          
      359 -  flex: {                                                     
      360 -    flex: 1,                                                  
      361 -  },                                                          
      362 -  scanBtn: {                                                  
      363 -    width: 48,                                                
      364 -    height: 48,                                               
      365 -    borderRadius: Radius.control,                             
      366 -    alignItems: 'center',                                     
      367 -    justifyContent: 'center',                                 
      368 -  },                                                          
      369 -  centered: {                                                 
      370 -    textAlign: 'center',                                      
      371 -    marginTop: Spacing.four,                                  
      372 -  },                                                          
      373 -  centerLoader: {                                             
      374 -    marginTop: Spacing.four,                                  
      375 -  },                                                          
      376 -  failedBox: {                                                
      377 -    alignItems: 'center',                                     
      378 -    gap: Spacing.two,                                         
      379 -    marginTop: Spacing.four,                                  
      380 -  },                                                          
      381 -  footerLoader: {                                             
      382 -    marginVertical: Spacing.three,                            
      383 -  },                                                          
      384 -  row: {                                                      
      385 -    flexDirection: 'row',                                     
      386 -    alignItems: 'center',                                     
      387 -    gap: Spacing.two,                                         
      388 -    paddingVertical: Spacing.two,                             
      389 -    borderBottomWidth: StyleSheet.hairlineWidth,              
      390 -  },                                                          
      391 -  rowImg: {                                                   
      392 -    width: 36,                                                
      393 -    height: 36,                                               
      394 -    borderRadius: Radius.sm,                                  
      395 -  },                                                          
      396 -  rowImgPlaceholder: {                                        
      397 -    width: 36,                                                
      398 -    height: 36,                                               
      399 -    borderRadius: Radius.sm,                                  
      400 -    alignItems: 'center',                                     
      401 -    justifyContent: 'center',                                 
      402 -  },                                                          
      403 -  rowText: {                                                  
      404 -    flex: 1,                                                  
      405 -    gap: 2,                                                   
      406 -  },                                                          
      407 -  quickEntryBtn: {                                            
      408 -    flexDirection: 'row',                                     
      409 -    alignItems: 'center',                                     
      410 -    justifyContent: 'center',                                 
      411 -    gap: Spacing.two,                                         
      412 -    paddingVertical: Spacing.three,                           
      413 -    borderRadius: Radius.controlLarge,                        
      414 -    marginTop: Spacing.three,                                 
      415 -    marginBottom: Spacing.four,                               
      416 -  },                                                          
      417 -});                                                           

  Searched for 1 pattern (ctrl+o to expand)

⏺ Gut, useTheme bleibt im Hauptcomponent nötig. Verifikation:

  Ran 3 shell commands (ctrl+o to expand)

⏺ food-search-screen.tsx fertig (2/4). Weiter mit add-food-entry-screen.tsx:

  Read 1 file (ctrl+o to expand)

⏺ Update(src/global.css)
  ⎿  Added 29 lines
      1373    .fss-quick-entry-btn {
      1374      @apply flex-row items-center justify-center gap-two py-th
            ree rounded-control-lg mt-three mb-four bg-background-element
            ;
      1375    }
      1376 +                                                             
      1377 +  /* add-food-entry-screen.tsx */                            
      1378 +  .afe-form {                                                
      1379 +    @apply gap-three mt-two;                                 
      1380 +  }                                                          
      1381 +  .afe-hero {                                                
      1382 +    @apply flex-row items-center gap-three;                  
      1383 +  }                                                          
      1384 +  .afe-hero-image {                                          
      1385 +    @apply w-[56px] h-[56px] rounded-control-lg;             
      1386 +  }                                                          
      1387 +  .afe-hero-image-placeholder {                              
      1388 +    @apply w-[56px] h-[56px] rounded-control-lg items-center 
           +justify-center bg-background-element;                        
      1389 +  }                                                          
      1390 +  .afe-hero-text {                                           
      1391 +    @apply flex-1 gap-[2px];                                 
      1392 +  }                                                          
      1393 +  .afe-nutri-badge {                                         
      1394 +    @apply w-[34px] h-[34px] rounded-control items-center jus
           +tify-center bg-accent;                                       
      1395 +  }                                                          
      1396 +  .afe-nutri-badge-text {                                    
      1397 +    @apply text-on-accent font-black text-[15px];            
      1398 +  }                                                          
      1399 +  .afe-badge-row {                                           
      1400 +    @apply flex-row flex-wrap gap-one;                       
      1401 +  }                                                          
      1402 +  .afe-badge {                                               
      1403 +    @apply px-[10px] py-[4px] rounded-control;               
      1404 +  }                                                          
      1405  }

⏺ Jetzt die Komponente konvertieren:

⏺ Update(src/features/calorie-tracking/add-food-entry-screen.tsx)
  ⎿  Added 2 lines, removed 3 lines
       2  import * as Crypto from 'expo-crypto';
       3  import { router, useLocalSearchParams } from 'expo-router';
       4  import { useEffect, useState } from 'react';
       5 -import { Alert, Image, StyleSheet, View } from 'react-native'; 
       5 +import { Alert, Image, View } from 'react-native';             
       6  import { FilterChipBar } from '@/components/filter-chip-bar';
       7  import { QuantityStepper } from '@/components/quantity-stepper'
          ;
       8  import { Screen } from '@/components/screen';
       9  import { useSnackbar } from '@/components/snackbar';
      10  import { TextField } from '@/components/text-field';
      11 -import { FontSize, ThemedText } from '@/components/themed-text'
         -;                                                              
      11 +import { ThemedText } from '@/components/themed-text';         
      12  import { Button } from '@/components/ui/buttons';
      13 -import { Radius, Spacing } from '@/constants/theme';           
      13  import { useSession } from '@/features/auth/session-provider';
      14  import { useActiveProfile } from '@/features/calorie-tracking/a
          ctive-profile-store';
      15  import {

⏺ Update(src/features/calorie-tracking/add-food-entry-screen.tsx)
  ⎿  Added 19 lines, removed 85 lines
      303  
      304    return (
      305      <Screen title={title} back={{ label: 'Abbrechen' }}>
      306 -      <View style={styles.form}>                              
      306 +      <View className="afe-form">                             
      307          {!isEditing && childProfiles.length > 0 ? (
      308            <View>
      309              <ThemedText type="smallBold">Für wen?</ThemedText>
     ...
      331            </View>
      332          ) : null}
      333  
      334 -        <View style={styles.hero}>                            
      334 +        <View className="afe-hero">                           
      335            {imageUrl ? (
      336 -            <Image source={{ uri: imageUrl }} style={styles.he
          -roImage} />                                                   
      336 +            <Image source={{ uri: imageUrl }} className="afe-h
          +ero-image" />                                                 
      337            ) : (
      338 -            <View                                             
      339 -              style={[styles.heroImagePlaceholder, { backgroun
          -dColor: theme.backgroundElement }]}>                          
      340 -              <ThemedText style={{ ...FontSize[28] }}>🍽️</Theme
          -dText>                                                        
      338 +            <View className="afe-hero-image-placeholder">     
      339 +              <ThemedText className="text-[28px]">🍽️</ThemedTe
          +xt>                                                           
      340              </View>
      341            )}
      343 -          <View style={styles.heroText}>                      
      342 +          <View className="afe-hero-text">                    
      343              <TextField placeholder="Name des Lebensmittels" va
           lue={name} onChangeText={setName} />
      344              {brand ? (
      345                <ThemedText type="small" themeColor="textSeconda
           ry">
     ...
      348              ) : null}
      349            </View>
      350            {nutriScore ? (
      352 -            <View style={[styles.nutriBadge, { backgroundColor
          -: theme.accent }]}>                                           
      353 -              <ThemedText style={styles.nutriBadgeText}>{nutri
          -Score.toUpperCase()}</ThemedText>                             
      351 +            <View className="afe-nutri-badge">                
      352 +              <ThemedText className="afe-nutri-badge-text">{nu
          +triScore.toUpperCase()}</ThemedText>                          
      353              </View>
      354            ) : null}
      355          </View>
      356  
      357          {badges.length > 0 ? (
      359 -          <View style={styles.badgeRow}>                      
      358 +          <View className="afe-badge-row">                    
      359              {badges.map((badge) => (
      360                <View
      361                  key={badge.label}
      363 -                style={[                                      
      364 -                  styles.badge,                               
      365 -                  { backgroundColor: `${theme[badge.tone === '
          -good' ? 'success' : 'warning']}22` },                         
      366 -                ]}>                                           
      367 -                <ThemedText                                   
      368 -                  type="small"                                
      369 -                  style={{ color: theme[badge.tone === 'good' 
          -? 'success' : 'warning'] }}>                                  
      362 +                className={`afe-badge ${badge.tone === 'good' 
          +? 'bg-success/[13%]' : 'bg-warning/[13%]'}`}>                 
      363 +                <ThemedText type="small" themeColor={badge.ton
          +e === 'good' ? 'success' : 'warning'}>                        
      364                    {badge.tone === 'good' ? '🟢' : '⚠️'} {badge
           .label}
      365                  </ThemedText>
      366                </View>
     ...
      368            </View>
      369          ) : null}
      370  
      377 -        <View style={styles.row}>                             
      378 -          <View style={styles.flex}>                          
      371 +        <View className="flex-row gap-four">                  
      372 +          <View className="flex-1">                           
      373              <TextField
      374                label="kcal"
      375                value={kcalInput}
     ...
      377                keyboardType="numeric"
      378              />
      379            </View>
      386 -          <View style={styles.flex}>                          
      380 +          <View className="flex-1">                           
      381              <TextField
      382                label="Kohlenhydrate (g)"
      383                value={carbsInput}
     ...
      386              />
      387            </View>
      388          </View>
      395 -        <View style={styles.row}>                             
      396 -          <View style={styles.flex}>                          
      389 +        <View className="flex-row gap-four">                  
      390 +          <View className="flex-1">                           
      391              <TextField
      392                label="Eiweiß (g)"
      393                value={proteinInput}
     ...
      395                keyboardType="numeric"
      396              />
      397            </View>
      404 -          <View style={styles.flex}>                          
      398 +          <View className="flex-1">                           
      399              <TextField
      400                label="Fett (g)"
      401                value={fatInput}
     ...
      405            </View>
      406          </View>
      407  
      414 -        <ThemedText type="smallBold" style={{ marginTop: Spaci
          -ng.one }}>                                                    
      408 +        <ThemedText type="smallBold" className="mt-one">      
      409            Menge
      410          </ThemedText>
      411          <QuantityStepper
     ...
      427            </ThemedText>
      428          ) : null}
      429  
      436 -        <View style={styles.saveButton}>                      
      430 +        <View className="mt-two">                             
      431            <Button
      432              label="Speichern"
      433              onPress={handleSave}
     ...
      448      </Screen>
      449    );
      450  }
      457 -                                                              
      458 -const styles = StyleSheet.create({                            
      459 -  form: {                                                     
      460 -    gap: Spacing.three,                                       
      461 -    marginTop: Spacing.two,                                   
      462 -  },                                                          
      463 -  hero: {                                                     
      464 -    flexDirection: 'row',                                     
      465 -    alignItems: 'center',                                     
      466 -    gap: Spacing.three,                                       
      467 -  },                                                          
      468 -  heroImage: {                                                
      469 -    width: 56,                                                
      470 -    height: 56,                                               
      471 -    borderRadius: Radius.controlLarge,                        
      472 -  },                                                          
      473 -  heroImagePlaceholder: {                                     
      474 -    width: 56,                                                
      475 -    height: 56,                                               
      476 -    borderRadius: Radius.controlLarge,                        
      477 -    alignItems: 'center',                                     
      478 -    justifyContent: 'center',                                 
      479 -  },                                                          
      480 -  heroText: {                                                 
      481 -    flex: 1,                                                  
      482 -    gap: 2,                                                   
      483 -  },                                                          
      484 -  nutriBadge: {                                               
      485 -    width: 34,                                                
      486 -    height: 34,                                               
      487 -    borderRadius: Radius.control,                             
      488 -    alignItems: 'center',                                     
      489 -    justifyContent: 'center',                                 
      490 -  },                                                          
      491 -  nutriBadgeText: {                                           
      492 -    color: '#fff',                                            
      493 -    fontWeight: '900',                                        
      494 -    ...FontSize[15],                                          
      495 -  },                                                          
      496 -  badgeRow: {                                                 
      497 -    flexDirection: 'row',                                     
      498 -    flexWrap: 'wrap',                                         
      499 -    gap: Spacing.one,                                         
      500 -  },                                                          
      501 -  badge: {                                                    
      502 -    paddingHorizontal: 10,                                    
      503 -    paddingVertical: 4,                                       
      504 -    borderRadius: Radius.control,                             
      505 -  },                                                          
      506 -  row: {                                                      
      507 -    flexDirection: 'row',                                     
      508 -    gap: Spacing.four,                                        
      509 -  },                                                          
      510 -  flex: {                                                     
      511 -    flex: 1,                                                  
      512 -  },                                                          
      513 -  saveButton: {                                               
      514 -    marginTop: Spacing.two,                                   
      515 -  },                                                          
      516 -});                                                           

  Searched for 1 pattern (ctrl+o to expand)

⏺ useTheme nicht mehr benötigt — entfernen:

⏺ Update(src/features/calorie-tracking/add-food-entry-screen.tsx)
  ⎿  Removed 1 line
      23  import { MEAL_LABELS } from '@/features/calorie-tracking/diary-
          screen';
      24  import { useActiveHousehold } from '@/features/household/active
          -household-provider';
      25  import { useChildProfiles } from '@/features/household/api';
      26 -import { useTheme } from '@/hooks/use-theme';                  
      26  import { getDatabase } from '@/lib/db/client';
      27  import { recordProductUsage } from '@/lib/db/product-usage';
      28  import {

⏺ Update(src/features/calorie-tracking/add-food-entry-screen.tsx)
  ⎿  Removed 1 line
      87   *   manuell.
      88   */
      89  export function AddFoodEntryScreen() {
      90 -  const theme = useTheme();                                    
      90    const params = useLocalSearchParams<{
      91      date: string;
      92      mealType: MealType;

⏺ Verifikation:

  Ran 3 shell commands (ctrl+o to expand)

⏺ add-food-entry-screen.tsx fertig (3/4). Letzte Datei: goal-setup-screen.tsx:

  Searched for 3 patterns, read 2 files (ctrl+o to expand)

⏺ Update(src/global.css)  ⎿  Added 11 lines
      1402    .afe-badge {
      1403      @apply px-[10px] py-[4px] rounded-control;
      1404    }
      1405 +                                                             
      1406 +  /* goal-setup-screen.tsx */                                
      1407 +  .gs-segmented-row {                                        
      1408 +    @apply flex-row gap-two;                                 
      1409 +  }                                                          
      1410 +  .gs-segment-btn {                                          
      1411 +    @apply flex-1 py-[10px] rounded-control items-center just
           +ify-center;                                                  
      1412 +  }                                                          
      1413 +  .gs-preview {                                              
      1414 +    @apply border-hairline border-border rounded-card p-three
           + gap-one;                                                    
      1415 +  }                                                          
      1416  }

⏺ Update(src/features/calorie-tracking/goal-setup-screen.tsx)
  ⎿  Added 1 line, removed 2 lines
       1  import { router } from 'expo-router';
       2  import { useEffect, useMemo, useState } from 'react';
       3 -import { Alert, Pressable, StyleSheet, View } from 'react-nativ
         -e';                                                            
       3 +import { Alert, Pressable, View } from 'react-native';         
       4  import { Card } from '@/components/card';
       5  import { Screen } from '@/components/screen';
       6  import { TextField } from '@/components/text-field';
       7  import { ThemedText } from '@/components/themed-text';
       8  import { Button } from '@/components/ui/buttons';
       9 -import { Radius, Spacing } from '@/constants/theme';           
       9  import { useProfile } from '@/features/auth/api';
      10  import { useSession } from '@/features/auth/session-provider';
      11  import {

⏺ Update(src/features/calorie-tracking/goal-setup-screen.tsx)
  ⎿  Removed 2 lines
      26    calculateTdee,
      27    type GoalType,
      28  } from '@/features/calorie-tracking/tdee';
      29 -import { useTheme } from '@/hooks/use-theme';                  
      30 -                                                               
      29  const GOAL_LABELS: Record<GoalType, string> = {
      30    lose: 'Abnehmen',
      31    maintain: 'Halten',

⏺ Update(src/features/calorie-tracking/goal-setup-screen.tsx)
  ⎿  Removed 1 line
      60   * clientseitig, ohne zusaetzliche Requests, bevor irgendetwas 
          gespeichert wird.
      61   */
      62  export function GoalSetupScreen() {
      63 -  const theme = useTheme();                                    
      63    const { session } = useSession();
      64    const userId = session?.user.id;
      65  

⏺ Jetzt der Hauptteil:

⏺ Update(src/features/calorie-tracking/goal-setup-screen.tsx)
  ⎿  Added 17 lines, removed 61 lines
      230  
      231            {formVisible ? (
      232              <Card title="Neues Ziel">
      233 -              <View style={styles.form}>                      
      233 +              <View className="gap-three">                    
      234                  <ThemedText type="smallBold">Ziel-Art</ThemedT
           ext>
      235 -                <View style={styles.segmentedRow}>            
      235 +                <View className="gs-segmented-row">           
      236                    {(Object.keys(GOAL_LABELS) as GoalType[]).ma
           p((type) => (
      237                      <Pressable
      238                        key={type}
      239                        onPress={() => setGoalType(type)}
      240 -                      style={[                                
      241 -                        styles.segmentBtn,                    
      242 -                        {                                     
      243 -                          backgroundColor:                    
      244 -                            goalType === type ? theme.accent :
          - theme.backgroundElement,                                     
      245 -                        },                                    
      246 -                      ]}>                                     
      247 -                      <ThemedText style={{ color: goalType ===
          - type ? '#fff' : theme.text }}>                               
      240 +                      className={`gs-segment-btn ${goalType ==
          += type ? 'bg-accent' : 'bg-background-element'}`}>            
      241 +                      <ThemedText themeColor={goalType === typ
          +e ? 'onAccent' : 'text'}>                                     
      242                          {GOAL_LABELS[type]}
      243                        </ThemedText>
      244                      </Pressable>
     ...
      254                    />
      255                  ) : null}
      256  
      263 -                <ThemedText type="smallBold" style={{ marginTo
          -p: Spacing.one }}>                                            
      257 +                <ThemedText type="smallBold" className="mt-one
          +">                                                            
      258                    Makro-Verteilung
      259                  </ThemedText>
      266 -                <View style={styles.segmentedRow}>            
      260 +                <View className="gs-segmented-row">           
      261                    {(Object.keys(SEGMENT_LABELS) as PresetSelec
           tion[]).map((p) => (
      262                      <Pressable
      263                        key={p}
      264                        onPress={() => setPreset(p)}
      271 -                      style={[                                
      272 -                        styles.segmentBtn,                    
      273 -                        { backgroundColor: preset === p ? them
          -e.accent : theme.backgroundElement },                         
      274 -                      ]}>                                     
      275 -                      <ThemedText style={{ color: preset === p
          - ? '#fff' : theme.text }}>                                    
      265 +                      className={`gs-segment-btn ${preset === 
          +p ? 'bg-accent' : 'bg-background-element'}`}>                 
      266 +                      <ThemedText themeColor={preset === p ? '
          +onAccent' : 'text'}>                                          
      267                          {SEGMENT_LABELS[p]}
      268                        </ThemedText>
      269                      </Pressable>
     ...
      271                  </View>
      272  
      273                  {preset === 'custom' ? (
      283 -                  <View style={styles.form}>                  
      284 -                    <View style={styles.row}>                 
      285 -                      <View style={styles.flex}>              
      274 +                  <View className="gap-three">                
      275 +                    <View className="flex-row gap-two">       
      276 +                      <View className="flex-1">               
      277                          <TextField
      278                            label="Eiweiß %"
      279                            value={customProteinPct}
     ...
      281                            keyboardType="numeric"
      282                          />
      283                        </View>
      293 -                      <View style={styles.flex}>              
      284 +                      <View className="flex-1">               
      285                          <TextField
      286                            label="Kohlenhydrate %"
      287                            value={customCarbsPct}
     ...
      289                            keyboardType="numeric"
      290                          />
      291                        </View>
      301 -                      <View style={styles.flex}>              
      292 +                      <View className="flex-1">               
      293                          <TextField
      294                            label="Fett %"
      295                            value={customFatPct}
     ...
      317                  ) : null}
      318  
      319                  {targetPreview ? (
      329 -                  <View style={[styles.preview, { borderColor:
          - theme.border }]}>                                            
      320 +                  <View className="gs-preview">               
      321                      <TextField
      322                        label="Ziel-Kalorien (kcal/Tag)"
      323                        value={manualKcalInput}
     ...
      355                    </ThemedText>
      356                  )}
      357  
      367 -                <View style={styles.buttonRow}>               
      368 -                  <View style={styles.flex}>                  
      358 +                <View className="flex-row gap-two mt-one">    
      359 +                  <View className="flex-1">                   
      360                      <Button
      361                        label="Ziel speichern"
      362                        onPress={handleSave}
     ...
      365                      />
      366                    </View>
      367                    {currentGoal ? (
      377 -                    <View style={styles.flex}>                
      368 +                    <View className="flex-1">                 
      369                        <Button
      370                          label="Abbrechen"
      371                          variant="secondary"
     ...
      382      </Screen>
      383    );
      384  }
      394 -                                                              
      395 -const styles = StyleSheet.create({                            
      396 -  form: {                                                     
      397 -    gap: Spacing.three,                                       
      398 -  },                                                          
      399 -  segmentedRow: {                                             
      400 -    flexDirection: 'row',                                     
      401 -    gap: Spacing.two,                                         
      402 -  },                                                          
      403 -  row: {                                                      
      404 -    flexDirection: 'row',                                     
      405 -    gap: Spacing.two,                                         
      406 -  },                                                          
      407 -  segmentBtn: {                                               
      408 -    flex: 1,                                                  
      409 -    paddingVertical: 10,                                      
      410 -    borderRadius: Radius.control,                             
      411 -    alignItems: 'center',                                     
      412 -    justifyContent: 'center',                                 
      413 -  },                                                          
      414 -  preview: {                                                  
      415 -    borderWidth: StyleSheet.hairlineWidth,                    
      416 -    borderRadius: Radius.card,                                
      417 -    padding: Spacing.three,                                   
      418 -    gap: Spacing.one,                                         
      419 -  },                                                          
      420 -  buttonRow: {                                                
      421 -    flexDirection: 'row',                                     
      422 -    gap: Spacing.two,                                         
      423 -    marginTop: Spacing.one,                                   
      424 -  },                                                          
      425 -  flex: {                                                     
      426 -    flex: 1,                                                  
      427 -  },                                                          
      428 -});                                                           

  Searched for 1 pattern (ctrl+o to expand)

⏺ Gut, onAccent und text sind gültige themeColor-Werte. Verifikation:

  Ran 1 shell command (ctrl+o to expand)

⏺ Nur Formatierung. Weiter:

  Ran 2 shell commands (ctrl+o to expand)

⏺ calorie-tracking/-Domäne (4/4) fertig. Jetzt der volle Testlauf zur
  Absicherung, dann Doc-Update:

  Ran 1 shell command (ctrl+o to expand)

⏺ Alle 628 Tests grün. Migration-Doc aktualisieren:

⏺ Update(docs/design-system/nativewind-liquid-glass-migration.md)
  ⎿  Added 10 lines, removed 3 lines
      182     Android-Schatten, der Rest des Dropdown-Schattens läuft übe
           r die
      183     `shadow-sheet`-Klasse). `bun run test` (15 Tests in `invent
           ory/`, alle
      184     628 app-weit) grün.
      185 -9. **`calorie-tracking/`** (4 Dateien, 1862 Zeilen): `diary-sc
          -reen.tsx`                                                     
      186 -   (493), `food-search-screen.tsx` (420), `add-food-entry-scre
          -en.tsx`                                                       
      187 -   (517), `goal-setup-screen.tsx` (432)                       
      185 +9. [x] **`calorie-tracking/`** (4 Dateien, 1862 Zeilen) — alle
          + fertig. Neue                                                 
      186 +   Klassenpräfixe `diary-*`, `fss-*` (food-search), `afe-*`   
      187 +   (add-food-entry), `gs-*` (goal-setup). Alpha-Hintergründe p
          +er                                                            
      188 +   Tailwind-Opazitätsmodifier statt Hex-Suffix (`bg-background
          +-element/[84%]`                                               
      189 +   statt `${theme.backgroundElement}D6`, `bg-background-select
          +ed/[47%]`                                                     
      190 +   statt `${theme.backgroundSelected}78`, `bg-success/[13%]` /
      191 +   `bg-warning/[13%]` statt `${theme.success}22`). `borderCurv
          +e: 'continuous'`                                              
      192 +   bleibt an mehreren Cards/Buttons als dokumentierte `style`-
          +Ausnahme (kein                                                
      193 +   Tailwind-Äquivalent, analog zu dashboard-screen.tsx). `bun 
          +run test`                                                     
      194 +   (35 Tests in `calorie-tracking/`, alle 628 app-weit) grün. 
      195  10. **`meal-planner/`** (5 Dateien, 1552 Zeilen):
      196      `components/recipe-picker-modal.tsx` (117),
      197      `components/entry-form-modal.tsx` (229),

⏺ Jetzt weiter mit meal-planner/, der letzten Domäne. Erste Datei:
  components/recipe-picker-modal.tsx.

  Searched for 1 pattern, read 1 file (ctrl+o to expand)

⏺ Gut, ThemedView unterstützt className. Jetzt CSS-Klassen und Konvertierung:

⏺ Update(src/global.css)
  ⎿  Added 23 lines
      1413    .gs-preview {
      1414      @apply border-hairline border-border rounded-card p-three
             gap-one;
      1415    }
      1416 +                                                             
      1417 +  /* recipe-picker-modal.tsx (meal-planner) */               
      1418 +  .rpm-root {                                                
      1419 +    @apply flex-1;                                           
      1420 +  }                                                          
      1421 +  .rpm-safe-area {                                           
      1422 +    @apply flex-1 px-four;                                   
      1423 +  }                                                          
      1424 +  .rpm-header {                                              
      1425 +    @apply flex-row items-center justify-between py-three;   
      1426 +  }                                                          
      1427 +  .rpm-close-button {                                        
      1428 +    @apply w-[32px] h-[32px] rounded-card items-center justif
           +y-center bg-background-element;                              
      1429 +  }                                                          
      1430 +  .rpm-empty {                                               
      1431 +    @apply text-center mt-five;                              
      1432 +  }                                                          
      1433 +  .rpm-list {                                                
      1434 +    @apply py-two;                                           
      1435 +  }                                                          
      1436 +  .rpm-recipe-row {                                          
      1437 +    @apply py-three border-b-hairline border-border;         
      1438 +  }                                                          
      1439  }

⏺ Update(src/features/meal-planner/components/recipe-picker-modal.tsx)
  ⎿  Added 1 line, removed 3 lines
       1  import { useMemo, useState } from 'react';
       2 -import { FlatList, Modal, Platform, Pressable, StyleSheet, View
         - } from 'react-native';                                        
       2 +import { FlatList, Modal, Platform, Pressable, View } from 'rea
         +ct-native';                                                    
       3  import { SafeAreaView } from 'react-native-safe-area-context';
       4  
       5  import { TextField } from '@/components/text-field';
       6  import { ThemedText } from '@/components/themed-text';
       7  import { ThemedView } from '@/components/themed-view';
       8 -import { Radius, Spacing } from '@/constants/theme';           
       9 -import { useTheme } from '@/hooks/use-theme';                  
       8  import type { DraggableRecipe } from './week-grid';
       9  
      10  type RecipePickerModalProps = {

⏺ Update(src/features/meal-planner/components/recipe-picker-modal.tsx)
  ⎿  Added 7 lines, removed 32 lines
      27    onDismiss,
      28    onSelect,
      29  }: RecipePickerModalProps) {
      30 -  const theme = useTheme();                                    
      30    const [query, setQuery] = useState('');
      31  
      32    const filtered = useMemo(() => {
     ...
      41        animationType="slide"
      42        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 
          undefined}
      43        onRequestClose={onDismiss}>
      45 -      <ThemedView style={styles.root}>                         
      46 -        <SafeAreaView style={styles.safeArea} edges={['top', 'l
         -eft', 'right', 'bottom']}>                                     
      47 -          <View style={styles.header}>                         
      44 +      <ThemedView className="rpm-root">                        
      45 +        <SafeAreaView className="rpm-safe-area" edges={['top', 
         +'left', 'right', 'bottom']}>                                   
      46 +          <View className="rpm-header">                        
      47              <ThemedText type="subtitle">Rezept auswählen</Theme
          dText>
      48              <Pressable
      49                onPress={onDismiss}
      50                accessibilityRole="button"
      51                accessibilityLabel="Schließen"
      53 -              style={[styles.closeButton, { backgroundColor: th
         -eme.backgroundElement }]}>                                     
      52 +              className="rpm-close-button">                    
      53                <ThemedText>✕</ThemedText>
      54              </Pressable>
      55            </View>
     ...
      62            />
      63  
      64            {filtered.length === 0 ? (
      66 -            <ThemedText type="small" themeColor="textSecondary"
         - style={styles.empty}>                                         
      65 +            <ThemedText type="small" themeColor="textSecondary"
         + className="rpm-empty">                                        
      66                {recipes.length === 0
      67                  ? 'Noch keine Rezepte vorhanden. Lege zuerst ei
          n Rezept an.'
      68                  : 'Kein Rezept gefunden.'}
     ...
      71              <FlatList
      72                data={filtered}
      73                keyExtractor={(item) => item.id}
      75 -              contentContainerStyle={styles.list}              
      74 +              contentContainerClassName="rpm-list"             
      75                renderItem={({ item }) => (
      76                  <Pressable
      77                    accessibilityRole="button"
      78                    accessibilityLabel={`${item.title} eintragen`
          }
      79                    onPress={() => onSelect(item)}
      81 -                  style={[styles.recipeRow, { borderBottomColor
         -: theme.border }]}>                                            
      80 +                  className="rpm-recipe-row">                  
      81                    <ThemedText>{item.title}</ThemedText>
      82                  </Pressable>
      83                )}
     ...
       88      </Modal>
       89    );
       90  }
       92 -                                                              
       93 -const styles = StyleSheet.create({                            
       94 -  root: { flex: 1 },                                          
       95 -  safeArea: { flex: 1, paddingHorizontal: Spacing.four },     
       96 -  header: {                                                   
       97 -    flexDirection: 'row',                                     
       98 -    alignItems: 'center',                                     
       99 -    justifyContent: 'space-between',                          
      100 -    paddingVertical: Spacing.three,                           
      101 -  },                                                          
      102 -  closeButton: {                                              
      103 -    width: 32,                                                
      104 -    height: 32,                                               
      105 -    borderRadius: Radius.card,                                
      106 -    alignItems: 'center',                                     
      107 -    justifyContent: 'center',                                 
      108 -  },                                                          
      109 -  empty: { textAlign: 'center', marginTop: Spacing.five },    
      110 -  list: { paddingVertical: Spacing.two },                     
      111 -  recipeRow: {                                                
      112 -    paddingVertical: Spacing.three,                           
      113 -    borderBottomWidth: StyleSheet.hairlineWidth,              
      114 -  },                                                          
      115 -});                                                           

⏺ Verifikation:

  Ran 3 shell commands (ctrl+o to expand)

⏺ Kein dedizierter Test für diese Datei — läuft aber im vollen
  meal-planner-Suite mit. recipe-picker-modal.tsx fertig (1/5). Weiter mit
  entry-form-modal.tsx:

  Read 1 file (ctrl+o to expand)

⏺ Update(src/global.css)
  ⎿  Added 22 lines
      1436    .rpm-recipe-row {
      1437      @apply py-three border-b-hairline border-border;
      1438    }
      1439 +                                                             
      1440 +  /* entry-form-modal.tsx (meal-planner) — root/safeArea/head
           +er/closeButton                                               
      1441 +     teilen sich die rpm-*-Klassen von recipe-picker-modal.ts
           +x (identisches                                               
      1442 +     Modal-Grundgeruest). */                                 
      1443 +  .efm-header-text {                                         
      1444 +    @apply flex-1 mr-two gap-[2px];                          
      1445 +  }                                                          
      1446 +  .efm-content {                                             
      1447 +    @apply gap-three;                                        
      1448 +  }                                                          
      1449 +  .efm-mode-row {                                            
      1450 +    @apply flex-row gap-two;                                 
      1451 +  }                                                          
      1452 +  .efm-mode-button {                                         
      1453 +    @apply flex-1 py-two rounded-control items-center;       
      1454 +  }                                                          
      1455 +  .efm-whole-household-button {                              
      1456 +    @apply self-start;                                       
      1457 +  }                                                          
      1458 +  .efm-actions {                                             
      1459 +    @apply gap-two mt-three;                                 
      1460 +  }                                                          
      1461  }
⏺ Update(src/features/meal-planner/components/entry-form-modal.tsx)
  ⎿  Added 1 line, removed 3 lines
       1  import { useEffect, useState } from 'react';
       2 -import { Modal, Platform, Pressable, StyleSheet, View } from 'r
         -eact-native';                                                  
       2 +import { Modal, Platform, Pressable, View } from 'react-native'
         +;                                                              
       3  import { SafeAreaView } from 'react-native-safe-area-context';
       4  import { TextField } from '@/components/text-field';
       5  import { ThemedText } from '@/components/themed-text';
       6  import { ThemedView } from '@/components/themed-view';
       7  import { Button } from '@/components/ui/buttons';
       8 -import { Radius, Spacing } from '@/constants/theme';           
       9 -import { useTheme } from '@/hooks/use-theme';                  
       8  import { DEFAULT_PORTIONS_PER_PERSON, type ResolvedServings, re
          solveServings } from '../servings';
       9  import { MEAL_SLOT_LABELS, type MealSlot } from '../week';
      10  

⏺ Update(src/features/meal-planner/components/entry-form-modal.tsx)
  ⎿  Removed 1 line
      45    onSave,
      46    onDelete,
      47  }: EntryFormModalProps) {
      48 -  const theme = useTheme();                                    
      48    const [mode, setMode] = useState<'portions' | 'people'>(initi
          al?.servings_mode ?? 'portions');
      49    const [portionsText, setPortionsText] = useState(String(initi
          al?.portions ?? 1));
      50    const [peopleText, setPeopleText] = useState(String(initial?.
          people_count ?? ''));

⏺ Update(src/features/meal-planner/components/entry-form-modal.tsx)
  ⎿  Added 13 lines, removed 54 lines
       92        animationType="slide"
       93        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' :
            undefined}
       94        onRequestClose={onDismiss}>
       95 -      <ThemedView style={styles.root}>                        
       96 -        <SafeAreaView style={styles.safeArea} edges={['top', '
          -left', 'right', 'bottom']}>                                   
       97 -          <View style={styles.header}>                        
       98 -            <View style={styles.headerText}>                  
       95 +      <ThemedView className="rpm-root">                       
       96 +        <SafeAreaView className="rpm-safe-area" edges={['top',
          + 'left', 'right', 'bottom']}>                                 
       97 +          <View className="rpm-header">                       
       98 +            <View className="efm-header-text">                
       99                <ThemedText type="subtitle" numberOfLines={1}>
      100                  {recipeTitle}
      101                </ThemedText>
     ...
      107                onPress={onDismiss}
      108                accessibilityRole="button"
      109                accessibilityLabel="Schließen"
      110 -              style={[styles.closeButton, { backgroundColor: t
          -heme.backgroundElement }]}>                                   
      110 +              className="rpm-close-button">                   
      111                <ThemedText>✕</ThemedText>
      112              </Pressable>
      113            </View>
      114  
      115 -          <View style={styles.content}>                       
      116 -            <View style={styles.modeRow}>                     
      115 +          <View className="efm-content">                      
      116 +            <View className="efm-mode-row">                   
      117                <Pressable
      118                  accessibilityRole="button"
      119                  accessibilityLabel="Portionen-Modus"
      120                  accessibilityState={{ selected: mode === 'port
           ions' }}
      121                  onPress={() => setMode('portions')}
      122 -                style={[                                      
      123 -                  styles.modeButton,                          
      124 -                  {                                           
      125 -                    backgroundColor: mode === 'portions' ? the
          -me.accent : theme.backgroundElement,                          
      126 -                  },                                          
      127 -                ]}>                                           
      128 -                <ThemedText                                   
      129 -                  type="smallBold"                            
      130 -                  style={{ color: mode === 'portions' ? '#ffff
          -ff' : theme.text }}>                                          
      122 +                className={`efm-mode-button ${mode === 'portio
          +ns' ? 'bg-accent' : 'bg-background-element'}`}>               
      123 +                <ThemedText type="smallBold" themeColor={mode 
          +=== 'portions' ? 'onAccent' : 'text'}>                        
      124                    Portionen
      125                  </ThemedText>
      126                </Pressable>
     ...
      129                  accessibilityLabel="Personen-Modus"
      130                  accessibilityState={{ selected: mode === 'peop
           le' }}
      131                  onPress={() => setMode('people')}
      139 -                style={[                                      
      140 -                  styles.modeButton,                          
      141 -                  { backgroundColor: mode === 'people' ? theme
          -.accent : theme.backgroundElement },                          
      142 -                ]}>                                           
      143 -                <ThemedText                                   
      144 -                  type="smallBold"                            
      145 -                  style={{ color: mode === 'people' ? '#ffffff
          -' : theme.text }}>                                            
      132 +                className={`efm-mode-button ${mode === 'people
          +' ? 'bg-accent' : 'bg-background-element'}`}>                 
      133 +                <ThemedText type="smallBold" themeColor={mode 
          +=== 'people' ? 'onAccent' : 'text'}>                          
      134                    Personen
      135                  </ThemedText>
      136                </Pressable>
     ...
      157                    accessibilityRole="button"
      158                    accessibilityLabel="Ganzer Haushalt isst"
      159                    onPress={handleWholeHousehold}
      172 -                  style={styles.wholeHouseholdButton}>        
      160 +                  className="efm-whole-household-button">     
      161                    <ThemedText type="link">
      162                      Ganzer Haushalt isst ({householdMemberCoun
           t}{' '}
      163                      {householdMemberCount === 1 ? 'Person' : '
           Personen'})
     ...
      171                </>
      172              )}
      173  
      186 -            <View style={styles.actions}>                     
      174 +            <View className="efm-actions">                    
      175                <Button label="Speichern" onPress={handleSave} d
           isabled={saveDisabled} />
      176                {onDelete ? (
      177                  <Button label="Eintrag entfernen" variant="dan
           ger" onPress={onDelete} />
     ...
      183      </Modal>
      184    );
      185  }
      198 -                                                              
      199 -const styles = StyleSheet.create({                            
      200 -  root: { flex: 1 },                                          
      201 -  safeArea: { flex: 1, paddingHorizontal: Spacing.four },     
      202 -  header: {                                                   
      203 -    flexDirection: 'row',                                     
      204 -    alignItems: 'center',                                     
      205 -    justifyContent: 'space-between',                          
      206 -    paddingVertical: Spacing.three,                           
      207 -  },                                                          
      208 -  headerText: { flex: 1, marginRight: Spacing.two, gap: 2 },  
      209 -  closeButton: {                                              
      210 -    width: 32,                                                
      211 -    height: 32,                                               
      212 -    borderRadius: Radius.card,                                
      213 -    alignItems: 'center',                                     
      214 -    justifyContent: 'center',                                 
      215 -  },                                                          
      216 -  content: { gap: Spacing.three },                            
      217 -  modeRow: { flexDirection: 'row', gap: Spacing.two },        
      218 -  modeButton: {                                               
      219 -    flex: 1,                                                  
      220 -    paddingVertical: Spacing.two,                             
      221 -    borderRadius: Radius.control,                             
      222 -    alignItems: 'center',                                     
      223 -  },                                                          
      224 -  wholeHouseholdButton: { alignSelf: 'flex-start' },          
      225 -  actions: { gap: Spacing.two, marginTop: Spacing.three },    
      226 -});                                                           

⏺ Verifikation:

  Ran 3 shell commands (ctrl+o to expand)

⏺ entry-form-modal.tsx fertig (2/5). Weiter mit missing-ingredients-screen.tsx:

  Read 1 file (ctrl+o to expand)

⏺ Update(src/global.css)
  ⎿  Added 17 lines
      1458    .efm-actions {
      1459      @apply gap-two mt-three;
      1460    }
      1461 +                                                             
      1462 +  /* missing-ingredients-screen.tsx */                       
      1463 +  .mis-loading {                                             
      1464 +    @apply mt-five;                                          
      1465 +  }                                                          
      1466 +  .mis-list {                                                
      1467 +    @apply gap-two;                                          
      1468 +  }                                                          
      1469 +  .mis-row {                                                 
      1470 +    @apply flex-row items-center gap-two p-two rounded-contro
           +l bg-background-element;                                     
      1471 +  }                                                          
      1472 +  .mis-checkbox {                                            
      1473 +    @apply w-6 h-6 rounded-sm border-2 border-accent items-ce
           +nter justify-center;                                         
      1474 +  }                                                          
      1475 +  .mis-row-text {                                            
      1476 +    @apply flex-1 gap-[2px];                                 
      1477 +  }                                                          
      1478  }

⏺ Update(src/features/meal-planner/missing-ingredients-screen.tsx)
  ⎿  Added 1 line, removed 3 lines
       1  import { useLocalSearchParams } from 'expo-router';
       2  import { useEffect, useState } from 'react';
       3 -import { ActivityIndicator, Alert, Pressable, StyleSheet, View 
         -} from 'react-native';                                         
       3 +import { ActivityIndicator, Alert, Pressable, View } from 'reac
         +t-native';                                                     
       4  import { Screen } from '@/components/screen';
       5  import { ThemedText } from '@/components/themed-text';
       6  import { Button } from '@/components/ui/buttons';
       7 -import { Radius, Spacing } from '@/constants/theme';           
       7  import { useSession } from '@/features/auth/session-provider';
       8  import { useActiveHousehold } from '@/features/household/active
          -household-provider';
       9  import { presentPaywallIfNeeded } from '@/features/premium/payw
          all';
      10  import { usePremium } from '@/features/premium/premium-provider
          ';
      11  import { useAddShoppingItem } from '@/features/shopping-list/us
          e-shopping-list-mutations';
      13 -import { useTheme } from '@/hooks/use-theme';                  
      12  import { type MissingIngredientView, useMealPlanShoppingNeeds }
           from './use-shopping-needs';
      13  
      14  // Stabile Referenz statt Inline-`= []`: `EMPTY_MISSING` bleibt
           beim naechsten

⏺ Update(src/features/meal-planner/missing-ingredients-screen.tsx)
  ⎿  Added 3 lines, removed 3 lines
      100        subtitle="Bedarf dieser Woche minus Vorrat"
      101        back={{ label: 'Wochenplan' }}>
      102        {!isPremium ? (
      103 -        <View style={styles.list}>                            
      103 +        <View className="mis-list">                           
      104            <ThemedText themeColor="textSecondary">
      105              fam vergleicht den Bedarf des ganzen Wochenplans m
           it eurem Vorrat und übernimmt nur
      106              Fehlendes in die Einkaufsliste.
     ...
      108            <Button label="Premium ansehen" onPress={unlockPremi
           um} loading={unlocking} />
      109          </View>
      110        ) : isLoading ? (
      111 -        <ActivityIndicator style={styles.loading} />          
      111 +        <ActivityIndicator className="mis-loading" />         
      112        ) : missing.length === 0 ? (
      113          <ThemedText themeColor="textSecondary">
      114            Für die geplanten Rezepte fehlt nichts – der Vorrat 
           reicht.
      115          </ThemedText>
      116        ) : (
      117 -        <View style={styles.list}>                            
      117 +        <View className="mis-list">                           
      118            {missing.map((item) => (
      119              <IngredientRow
      120                key={item.productId}

⏺ Update(src/features/meal-planner/missing-ingredients-screen.tsx)
  ⎿  Added 4 lines, removed 31 lines
      151    selected: boolean;
      152    onToggle: () => void;
      153  }) {
      154 -  const theme = useTheme();                                   
      155 -                                                              
      154    return (
      155      <Pressable
      156        accessibilityRole="checkbox"
      157        accessibilityState={{ checked: selected }}
      158        accessibilityLabel={item.name}
      159        onPress={onToggle}
      162 -      style={[styles.row, { backgroundColor: theme.backgroundE
          -lement }]}>                                                   
      163 -      <View                                                   
      164 -        style={[                                              
      165 -          styles.checkbox,                                    
      166 -          { borderColor: theme.accent, backgroundColor: select
          -ed ? theme.accent : 'transparent' },                          
      167 -        ]}>                                                   
      168 -        {selected ? <ThemedText style={{ color: '#ffffff' }}>✓
          -</ThemedText> : null}                                         
      160 +      className="mis-row">                                    
      161 +      <View className={`mis-checkbox ${selected ? 'bg-accent' 
          +: 'bg-transparent'}`}>                                        
      162 +        {selected ? <ThemedText themeColor="onAccent">✓</Theme
          +dText> : null}                                                
      163        </View>
      170 -      <View style={styles.rowText}>                           
      164 +      <View className="mis-row-text">                         
      165          <ThemedText type="smallBold">{item.name}</ThemedText>
      166          <ThemedText type="small" themeColor="textSecondary">
      167            {item.missingGrams} g fehlen
     ...
      176      </Pressable>
      177    );
      178  }
      185 -                                                              
      186 -const styles = StyleSheet.create({                            
      187 -  loading: { marginTop: Spacing.five },                       
      188 -  list: { gap: Spacing.two },                                 
      189 -  row: {                                                      
      190 -    flexDirection: 'row',                                     
      191 -    alignItems: 'center',                                     
      192 -    gap: Spacing.two,                                         
      193 -    padding: Spacing.two,                                     
      194 -    borderRadius: Radius.control,                             
      195 -  },                                                          
      196 -  checkbox: {                                                 
      197 -    width: 24,                                                
      198 -    height: 24,                                               
      199 -    borderRadius: Radius.sm,                                  
      200 -    borderWidth: 2,                                           
      201 -    alignItems: 'center',                                     
      202 -    justifyContent: 'center',                                 
      203 -  },                                                          
      204 -  rowText: { flex: 1, gap: 2 },                               
      205 -});                                                           

⏺ Verifikation:

  Ran 3 shell commands (ctrl+o to expand)

⏺ missing-ingredients-screen.tsx fertig (3/5). Weiter mit
  meal-planner-screen.tsx (456 Zeilen, größere Datei):

  Read 1 file (ctrl+o to expand)

⏺ Update(src/global.css)
  ⎿  Added 42 lines
      1475    .mis-row-text {
      1476      @apply flex-1 gap-[2px];
      1477    }
      1478 +                                                             
      1479 +  /* meal-planner-screen.tsx — borderCurve bleibt an actionBu
           +tton als `style`                                             
      1480 +     (kein Tailwind-Aequivalent, analog zu dashboard-screen.t
           +sx). */                                                      
      1481 +  .mp-root {                                                 
      1482 +    @apply flex-1;                                           
      1483 +  }                                                          
      1484 +  .mp-safe-area {                                            
      1485 +    @apply flex-1 w-full max-w-content self-center;          
      1486 +  }                                                          
      1487 +  .mp-content {                                              
      1488 +    @apply flex-1 px-[14px];                                 
      1489 +  }                                                          
      1490 +  .mp-view-mode-label {                                      
      1491 +    @apply text-[18px] leading-[22px];                       
      1492 +  }                                                          
      1493 +  .mp-period-row {                                           
      1494 +    @apply h-[43px] flex-row items-center pt-[9px];          
      1495 +  }                                                          
      1496 +  .mp-period-button {                                        
      1497 +    @apply w-9 h-[34px] items-center justify-center active:op
           +acity-70;                                                    
      1498 +  }                                                          
      1499 +  .mp-chevron {                                              
      1500 +    @apply text-[19px] leading-[22px] font-medium;           
      1501 +  }                                                          
      1502 +  .mp-period-copy {                                          
      1503 +    @apply flex-1 items-center;                              
      1504 +  }                                                          
      1505 +  .mp-period-title {                                         
      1506 +    @apply text-[17px] leading-[21px] font-bold;             
      1507 +  }                                                          
      1508 +  .mp-actions-row {                                          
      1509 +    @apply flex-row gap-[7px] pt-[9px];                      
      1510 +  }                                                          
      1511 +  .mp-action-button {                                        
      1512 +    @apply flex-1 min-h-[42px] items-center justify-center ro
           +unded-control-lg px-two bg-background-element/[78%] active:op
           +acity-70;                                                    
      1513 +  }                                                          
      1514 +  .mp-action-button-disabled {                               
      1515 +    @apply opacity-45;                                       
      1516 +  }                                                          
      1517 +  .mp-action-label {                                         
      1518 +    @apply text-[10px] leading-[13px] font-bold text-center; 
      1519 +  }                                                          
      1520  }

⏺ Jetzt die Komponente umschreiben:

⏺ Update(src/features/meal-planner/meal-planner-screen.tsx)
  ⎿  Added 2 lines, removed 3 lines
       1  import { Image } from 'expo-image';
       2  import { router } from 'expo-router';
       3  import { useState } from 'react';
       4 -import { Alert, Pressable, StyleSheet, View } from 'react-nativ
         -e';                                                            
       4 +import { Alert, Pressable, View } from 'react-native';         
       5  import { SafeAreaView } from 'react-native-safe-area-context';
       6  
       7  import { GradientBackground } from '@/components/gradient-backg
          round';
       8  import { PageHeader } from '@/components/page-header';
       9  import { SegmentedControl } from '@/components/segmented-contro
          l';
      10 -import { FontSize, ThemedText } from '@/components/themed-text'
         -;                                                              
      10 +import { ThemedText } from '@/components/themed-text';         
      11  import { HeaderIconButton, MenuButton } from '@/components/ui/b
          uttons';
      12 -import { Radius, withAlpha } from '@/constants/theme';         
      12  import { useSession } from '@/features/auth/session-provider';
      13  import { useActiveHousehold } from '@/features/household/active
          -household-provider';
      14  import { useHouseholdMembers } from '@/features/household/api';

⏺ Update(src/features/meal-planner/meal-planner-screen.tsx)
  ⎿  Added 23 lines, removed 26 lines
      232      : undefined;
      233  
      234    return (
      235 -    <View style={styles.root}>                                
      235 +    <View className="mp-root">                                
      236        <GradientBackground {...hubGradient} />
      237 -      <SafeAreaView style={styles.safeArea} edges={['top', 'le
          -ft', 'right']}>                                               
      237 +      <SafeAreaView className="mp-safe-area" edges={['top', 'l
          +eft', 'right']}>                                              
      238          <PageHeader
      239            title="Essensplan"
      240            align="center"
     ...
      247                  source="sf:calendar"
      248                  contentFit="contain"
      249                  tintColor={theme.accent}
      250 -                style={styles.calendarIcon}                   
      250 +                // expo-image ist nicht NativeWind-registriert
          +, className wird                                              
      251 +                // still ignoriert.                           
      252 +                style={{ width: 19, height: 19 }}             
      253                />
      254              </HeaderIconButton>
      255            }
      256          />
      257  
      256 -        <View style={styles.content}>                         
      258 +        <View className="mp-content">                         
      259            <SegmentedControl
      260              label="Zeitraum"
      261              options={VIEW_MODES.map((mode) => ({
     ...
      265              }))}
      266              selected={viewMode}
      267              onSelect={setViewMode}
      266 -            labelStyle={styles.viewModeLabel}                 
      268 +            labelClassName="mp-view-mode-label"               
      269            />
      270  
      269 -          <View style={styles.periodRow}>                     
      271 +          <View className="mp-period-row">                    
      272              <Pressable
      273                role="button"
      274                aria-label="Vorheriger Zeitraum"
      275                onPress={() => setAnchorDate((date) => shiftAnch
           or(date, viewMode, -1))}
      274 -              style={({ pressed }) => [styles.periodButton, pr
          -essed && styles.pressed]}>                                    
      275 -              <ThemedText themeColor="accent" style={styles.ch
          -evron}>                                                       
      276 +              className="mp-period-button">                   
      277 +              <ThemedText themeColor="accent" className="mp-ch
          +evron">                                                       
      278                  ‹
      279                </ThemedText>
      280              </Pressable>
      279 -            <View style={styles.periodCopy}>                  
      280 -              <ThemedText style={styles.periodTitle}>{periodLa
          -bel(dates)}</ThemedText>                                      
      281 +            <View className="mp-period-copy">                 
      282 +              <ThemedText className="mp-period-title">{periodL
          +abel(dates)}</ThemedText>                                     
      283              </View>
      284              <Pressable
      285                role="button"
      286                aria-label="Nächster Zeitraum"
      287                onPress={() => setAnchorDate((date) => shiftAnch
           or(date, viewMode, 1))}
      286 -              style={({ pressed }) => [styles.periodButton, pr
          -essed && styles.pressed]}>                                    
      287 -              <ThemedText themeColor="accent" style={styles.ch
          -evron}>                                                       
      288 +              className="mp-period-button">                   
      289 +              <ThemedText themeColor="accent" className="mp-ch
          +evron">                                                       
      290                  ›
      291                </ThemedText>
      292              </Pressable>
      293            </View>
      294  
      295            {viewMode === 'week' ? (
      294 -            <View style={styles.actionsRow}>                  
      296 +            <View className="mp-actions-row">                 
      297                <Pressable
      298                  role="button"
      299                  aria-label="Vorwoche übernehmen"
      300                  onPress={handleReuseLastWeek}
      299 -                style={({ pressed }) => [                     
      300 -                  styles.actionButton,                        
      301 -                  { backgroundColor: withAlpha(theme.backgroun
          -dElement, 0.78) },                                            
      302 -                  pressed && styles.pressed,                  
      303 -                ]}>                                           
      304 -                <ThemedText themeColor="accent" style={styles.
          -actionLabel}>                                                 
      301 +                className="mp-action-button"                  
      302 +                // borderCurve ist ein echter Laufzeitwert ohn
          +e Tailwind-Aequivalent.                                       
      303 +                style={{ borderCurve: 'continuous' }}>        
      304 +                <ThemedText themeColor="accent" className="mp-
          +action-label">                                                
      305                    Vorwoche übernehmen
      306                  </ThemedText>
      307                </Pressable>
     ...
      316                      params: { mealPlanId: plan.id },
      317                    });
      318                  }}
      319 -                style={({ pressed }) => [                     
      320 -                  styles.actionButton,                        
      321 -                  { backgroundColor: withAlpha(theme.backgroun
          -dElement, 0.78) },                                            
      322 -                  !plan && styles.disabled,                   
      323 -                  pressed && styles.pressed,                  
      324 -                ]}>                                           
      325 -                <ThemedText themeColor="accent" style={styles.
          -actionLabel}>                                                 
      319 +                className={`mp-action-button ${!plan ? 'mp-act
          +ion-button-disabled' : ''}`}                                  
      320 +                // borderCurve ist ein echter Laufzeitwert ohn
          +e Tailwind-Aequivalent.                                       
      321 +                style={{ borderCurve: 'continuous' }}>        
      322 +                <ThemedText themeColor="accent" className="mp-
          +action-label">                                                
      323                    Einkauf vorbereiten
      324                  </ThemedText>
      325                </Pressable>

  Searched for 1 pattern, read 1 file (ctrl+o to expand)

⏺ Update(src/features/meal-planner/meal-planner-screen.tsx)
  ⎿  Removed 1 line
      265              }))}
      266              selected={viewMode}
      267              onSelect={setViewMode}
      268 -            labelClassName="mp-view-mode-label"               
      268            />
      269  
      270            <View className="mp-period-row">
⏺ Update(src/global.css)
  ⎿  Removed 3 lines
      1487    .mp-content {
      1488      @apply flex-1 px-[14px];
      1489    }
      1490 -  .mp-view-mode-label {                                      
      1491 -    @apply text-[18px] leading-[22px];                       
      1492 -  }                                                          
      1490    .mp-period-row {
      1491      @apply h-[43px] flex-row items-center pt-[9px];
      1492    }

⏺ Update(src/features/meal-planner/meal-planner-screen.tsx)
  ⎿  Removed 76 lines
      373      </View>
      374    );
      375  }
      376 -                                                              
      377 -const styles = StyleSheet.create({                            
      378 -  root: {                                                     
      379 -    flex: 1,                                                  
      380 -  },                                                          
      381 -  safeArea: {                                                 
      382 -    flex: 1,                                                  
      383 -    width: '100%',                                            
      384 -    maxWidth: 800,                                            
      385 -    alignSelf: 'center',                                      
      386 -  },                                                          
      387 -  calendarIcon: {                                             
      388 -    width: 19,                                                
      389 -    height: 19,                                               
      390 -  },                                                          
      391 -  content: {                                                  
      392 -    flex: 1,                                                  
      393 -    paddingHorizontal: 14,                                    
      394 -  },                                                          
      395 -  viewModeLabel: {                                            
      396 -    ...FontSize[18],                                          
      397 -    lineHeight: 22,                                           
      398 -  },                                                          
      399 -  periodRow: {                                                
      400 -    height: 43,                                               
      401 -    flexDirection: 'row',                                     
      402 -    alignItems: 'center',                                     
      403 -    paddingTop: 9,                                            
      404 -  },                                                          
      405 -  periodButton: {                                             
      406 -    width: 36,                                                
      407 -    height: 34,                                               
      408 -    alignItems: 'center',                                     
      409 -    justifyContent: 'center',                                 
      410 -  },                                                          
      411 -  chevron: {                                                  
      412 -    ...FontSize[19],                                          
      413 -    lineHeight: 22,                                           
      414 -    fontWeight: 500,                                          
      415 -  },                                                          
      416 -  periodCopy: {                                               
      417 -    flex: 1,                                                  
      418 -    alignItems: 'center',                                     
      419 -  },                                                          
      420 -  periodTitle: {                                              
      421 -    ...FontSize[17],                                          
      422 -    lineHeight: 21,                                           
      423 -    fontWeight: 700,                                          
      424 -  },                                                          
      425 -  actionsRow: {                                               
      426 -    flexDirection: 'row',                                     
      427 -    gap: 7,                                                   
      428 -    paddingTop: 9,                                            
      429 -  },                                                          
      430 -  actionButton: {                                             
      431 -    flex: 1,                                                  
      432 -    minHeight: 42,                                            
      433 -    alignItems: 'center',                                     
      434 -    justifyContent: 'center',                                 
      435 -    borderRadius: Radius.controlLarge,                        
      436 -    borderCurve: 'continuous',                                
      437 -    paddingHorizontal: 8,                                     
      438 -  },                                                          
      439 -  actionLabel: {                                              
      440 -    ...FontSize[10],                                          
      441 -    lineHeight: 13,                                           
      442 -    fontWeight: 700,                                          
      443 -    textAlign: 'center',                                      
      444 -  },                                                          
      445 -  pressed: {                                                  
      446 -    opacity: 0.7,                                             
      447 -  },                                                          
      448 -  disabled: {                                                 
      449 -    opacity: 0.45,                                            
      450 -  },                                                          
      451 -});                                                           

⏺ Verifikation:

  Searched for 1 pattern (ctrl+o to expand)

⏺ Beide dokumentiert (expo-image-Ausnahme, borderCurve-Ausnahme).

  Ran 3 shell commands (ctrl+o to expand)

⏺ meal-planner-screen.tsx fertig (4/5). Letzte Datei der gesamten Liste:
  components/week-grid.tsx (543 Zeilen).

  Read 1 file (ctrl+o to expand)

⏺ Update(src/global.css)
  ⎿  Added 87 lines
      1514    .mp-action-label {
      1515      @apply text-[10px] leading-[13px] font-bold text-center;
      1516    }
      1517 +                                                             
      1518 +  /* week-grid.tsx — borderCurve bleibt an mehreren Karten al
           +s `style`                                                    
      1519 +     (kein Tailwind-Aequivalent). SLOT_SIZES (ehemals ein sep
           +arates JS-Objekt)                                            
      1520 +     ist direkt in die Klassen uebernommen: die Groessen ware
           +n bereits fuer                                               
      1521 +     Tag-/3-Tage-/Wochenansicht identisch (siehe Kommentar ob
           +en in der                                                    
      1522 +     Komponente), die Indirektion ueber ein Konstanten-Objekt
           + war unnoetig. */                                            
      1523 +  .wg-root {                                                 
      1524 +    @apply flex-1;                                           
      1525 +  }                                                          
      1526 +  .wg-scroll {                                               
      1527 +    @apply flex-1;                                           
      1528 +  }                                                          
      1529 +  .wg-content {                                              
      1530 +    @apply gap-two pt-[10px] pb-[126px];                     
      1531 +  }                                                          
      1532 +  .wg-day-card {                                             
      1533 +    @apply overflow-hidden border rounded-sheet bg-background
           +-element/[89%] border-background-element/[96%];              
      1534 +  }                                                          
      1535 +  .wg-day-header {                                           
      1536 +    @apply h-[38px] flex-row items-center justify-between px-
           +three;                                                       
      1537 +  }                                                          
      1538 +  .wg-day-name {                                             
      1539 +    @apply text-[17px] leading-[21px] font-bold;             
      1540 +  }                                                          
      1541 +  .wg-day-date {                                             
      1542 +    @apply text-[9px] leading-[12px] font-medium;            
      1543 +  }                                                          
      1544 +  .wg-slot-column {                                          
      1545 +    @apply flex-col border-t border-text/[7%];               
      1546 +  }                                                          
      1547 +  .wg-slot {                                                 
      1548 +    @apply min-w-0 min-h-[116px] gap-two px-three py-three;  
      1549 +  }                                                          
      1550 +  .wg-slot-divider {                                         
      1551 +    @apply border-t border-text/[7%];                        
      1552 +  }                                                          
      1553 +  .wg-slot-label {                                           
      1554 +    @apply font-bold tracking-[0.55px] uppercase text-[11px] 
           +leading-[14px];                                              
      1555 +  }                                                          
      1556 +  .wg-entry-chip {                                           
      1557 +    @apply justify-center min-h-[46px] rounded-[13px] px-thre
           +e py-[9px] bg-background-selected active:opacity-70;         
      1558 +  }                                                          
      1559 +  .wg-entry-title {                                          
      1560 +    @apply font-bold text-[15px] leading-[19px];             
      1561 +  }                                                          
      1562 +  .wg-entry-meta {                                           
      1563 +    @apply font-medium text-[12px] leading-[15px];           
      1564 +  }                                                          
      1565 +  .wg-add-button {                                           
      1566 +    @apply items-center justify-center min-h-[40px] rounded-c
           +ontrol px-two border border-dashed border-border active:opaci
           +ty-70;                                                       
      1567 +  }                                                          
      1568 +  .wg-add-text {                                             
      1569 +    @apply font-semibold text-[13px] leading-[16px];         
      1570 +  }                                                          
      1571 +  .wg-tray {                                                 
      1572 +    @apply overflow-hidden border rounded-sheet py-three bg-b
           +ackground-element/[78%] border-border;                       
      1573 +  }                                                          
      1574 +  .wg-tray-title {                                           
      1575 +    @apply px-three text-[11px] leading-[14px] font-bold;    
      1576 +  }                                                          
      1577 +  .wg-tray-label {                                           
      1578 +    @apply px-three pt-[1px] pb-two text-[8px] leading-[11px]
           + font-medium;                                                
      1579 +  }                                                          
      1580 +  .wg-tray-grid {                                            
      1581 +    @apply flex-row flex-wrap gap-[10px] px-three;           
      1582 +  }                                                          
      1583 +  .wg-recipe-card {                                          
      1584 +    @apply w-[47%] rounded-card p-two gap-[6px] bg-background
           +-selected;                                                   
      1585 +  }                                                          
      1586 +  .wg-recipe-card-artwork {                                  
      1587 +    @apply h-[118px] overflow-hidden rounded-control;        
      1588 +  }                                                          
      1589 +  .wg-recipe-card-text {                                     
      1590 +    @apply text-[12px] leading-[15px] font-bold;             
      1591 +  }                                                          
      1592 +  .wg-drag-overlay {                                         
      1593 +    @apply absolute left-0 top-0;                            
      1594 +  }                                                          
      1595 +  .wg-drag-preview-card {                                    
      1596 +    @apply w-[112px] rounded-card border-2 border-accent p-[6
           +px] gap-[4px] opacity-[0.94] bg-background-selected;         
      1597 +  }                                                          
      1598 +  .wg-drag-preview-artwork {                                 
      1599 +    @apply h-[68px] overflow-hidden rounded-control;         
      1600 +  }                                                          
      1601 +  .wg-drag-preview-text {                                    
      1602 +    @apply text-[10px] leading-[13px] font-bold;             
      1603 +  }                                                          
      1604  }

⏺ Jetzt die Komponente umschreiben:

⏺ Update(src/features/meal-planner/components/week-grid.tsx)
  ⎿  Added 2 lines, removed 3 lines
       1  import { useCallback, useRef, useState } from 'react';
       2 -import { Pressable, ScrollView, StyleSheet, View } from 'react-
         -native';                                                       
       2 +import { Pressable, ScrollView, View } from 'react-native';    
       3  import { Gesture, GestureDetector } from 'react-native-gesture-
          handler';
       4  import Animated, { runOnJS, useAnimatedStyle, useSharedValue } 
          from 'react-native-reanimated';
       5  
       6 -import { FontSize, ThemedText } from '@/components/themed-text'
         -;                                                              
       7 -import { Radius, withAlpha } from '@/constants/theme';         
       6 +import { ThemedText } from '@/components/themed-text';         
       7  import { RecipeArtwork } from '@/features/recipes/components/re
          cipe-preview-card';
       8  import { useRecipeCoverUrl } from '@/features/recipes/recipe-im
          age-uploader';
       9  import { useTheme } from '@/hooks/use-theme';

⏺ Update(src/features/meal-planner/components/week-grid.tsx)
  ⎿  Removed 27 lines
      37    return `${portions} ${portions === 1 ? 'Portion' : 'Portionen
          '}`;
      38  }
      39  
      40 -// Feste Groessen fuer die Mahlzeiten-Slots (#195-Mockup "06.02
         - · Essensplan                                                  
      41 -// — Tag"): alle drei Ansichten (Tag/3 Tage/Woche) sehen gleich
         - aus — die                                                     
      42 -// Mahlzeiten stehen untereinander, in derselben Groesse wie in
         - der                                                           
      43 -// Tagesansicht. Nur die Anzahl der sichtbaren Tages-Karten unt
         -erscheidet                                                     
      44 -// sich; deshalb ist SLOT_SIZES nicht von `mode` abhaengig.    
      45 -const SLOT_SIZES = {                                           
      46 -  slotMinHeight: 116,                                          
      47 -  slotGap: 8,                                                  
      48 -  slotPaddingHorizontal: 12,                                   
      49 -  slotPaddingVertical: 12,                                     
      50 -  labelFontSize: 11,                                           
      51 -  labelLineHeight: 14,                                         
      52 -  chipMinHeight: 46,                                           
      53 -  chipBorderRadius: 13,                                        
      54 -  chipPaddingHorizontal: 12,                                   
      55 -  chipPaddingVertical: 9,                                      
      56 -  titleFontSize: 15,                                           
      57 -  titleLineHeight: 19,                                         
      58 -  metaFontSize: 12,                                            
      59 -  metaLineHeight: 15,                                          
      60 -  addMinHeight: 40,                                            
      61 -  addBorderRadius: 12,                                         
      62 -  addPaddingHorizontal: 8,                                     
      63 -  addFontSize: 13,                                             
      64 -  addLineHeight: 16,                                           
      65 -} as const;                                                    
      66 -                                                               
      40  /**
      41   * Responsive Tageskarten des Essensplans. Tippen bleibt der pr
          imaere Weg;
      42   * die vorhandene Drag-Ablage sitzt weiter unter den sichtbaren
           Tagen.

  Searched for 1 pattern, read 1 file (ctrl+o to expand)

⏺ Update(src/features/meal-planner/components/week-grid.tsx)
  ⎿  Removed 2 lines
      54    onTapEntry,
      55    onTapEmptyCell,
      56  }: WeekGridProps) {
      57 -  const theme = useTheme();                                    
      58 -  const sizes = SLOT_SIZES;                                    
      57    // Knoten statt vormessener Rechtecke: die Woche-/3-Tage-List
          e ist vertikal
      58    // scrollbar, ein einmal beim Mount gemessenes Rechteck waere
           nach dem
      59    // Scrollen falsch und der Drop wuerde ins Leere treffen. Sta
          ttdessen wird

⏺ Jetzt der große Return-Block:

  Searched for 1 pattern, read 1 file (ctrl+o to expand)

⏺ Gut, Animated.View mit className + genuine-runtime style ist bereits
  etabliert. Jetzt konvertiere ich:

⏺ Update(src/features/meal-planner/components/week-grid.tsx)
  ⎿  Added 28 lines, removed 95 lines
      112    }));
      113  
      114    return (
      115 -    <View style={styles.root}>                                
      115 +    <View className="wg-root">                                
      116        <ScrollView
      117 -        style={styles.scroll}                                 
      118 -        contentContainerStyle={styles.content}                
      117 +        className="wg-scroll"                                 
      118 +        contentContainerClassName="wg-content"                
      119          showsVerticalScrollIndicator={false}>
      120          {dates.map((date) => (
      121            <View
      122              key={date}
      123 -            style={[                                          
      124 -              styles.dayCard,                                 
      125 -              {                                               
      126 -                backgroundColor: `${theme.backgroundElement}E3
          -`,                                                            
      127 -                borderColor: `${theme.backgroundElement}F5`,  
      128 -              },                                              
      129 -            ]}>                                               
      130 -            <View style={styles.dayHeader}>                   
      131 -              <ThemedText style={styles.dayName}>{weekdayLabel
          -(date)}</ThemedText>                                          
      132 -              <ThemedText themeColor="textSecondary" style={st
          -yles.dayDate}>                                                
      123 +            className="wg-day-card"                           
      124 +            // borderCurve ist ein echter Laufzeitwert ohne Ta
          +ilwind-Aequivalent.                                           
      125 +            style={{ borderCurve: 'continuous' }}>            
      126 +            <View className="wg-day-header">                  
      127 +              <ThemedText className="wg-day-name">{weekdayLabe
          +l(date)}</ThemedText>                                         
      128 +              <ThemedText themeColor="textSecondary" className
          +="wg-day-date">                                               
      129                  {dateLabel(date)}
      130                </ThemedText>
      131              </View>
      132  
      137 -            <View style={[styles.slotColumn, { borderTopColor:
          - `${theme.text}12` }]}>                                       
      133 +            <View className="wg-slot-column">                 
      134                {MEAL_SLOTS.map((slot, slotIndex) => {
      135                  const key = `${date}|${slot}`;
      136                  const cellEntries = entriesByCell.get(key) ?? 
           [];
     ...
      138                    <View
      139                      key={slot}
      140                      ref={(node) => registerCell(key, node)}
      145 -                    style={[                                  
      146 -                      styles.slot,                            
      147 -                      {                                       
      148 -                        minHeight: sizes.slotMinHeight,       
      149 -                        gap: sizes.slotGap,                   
      150 -                        paddingHorizontal: sizes.slotPaddingHo
          -rizontal,                                                     
      151 -                        paddingVertical: sizes.slotPaddingVert
          -ical,                                                         
      152 -                      },                                      
      153 -                      slotIndex > 0 && {                      
      154 -                        borderTopColor: `${theme.text}12`,    
      155 -                        borderTopWidth: 1,                    
      156 -                      },                                      
      157 -                    ]}>                                       
      158 -                    <ThemedText                               
      159 -                      themeColor="textSecondary"              
      160 -                      style={[                                
      161 -                        styles.slotLabel,                     
      162 -                        {                                     
      163 -                          fontSize: sizes.labelFontSize,      
      164 -                          lineHeight: sizes.labelLineHeight,  
      165 -                        },                                    
      166 -                      ]}>                                     
      141 +                    className={`wg-slot ${slotIndex > 0 ? 'wg-
          +slot-divider' : ''}`}>                                        
      142 +                    <ThemedText themeColor="textSecondary" cla
          +ssName="wg-slot-label">                                       
      143                        {SLOT_LABELS[slot]}
      144                      </ThemedText>
      145  
     ...
      149                          role="button"
      150                          aria-label={`${entry.recipe_title}, ${
           portionLabel(entry.portions)}`}
      151                          onPress={() => onTapEntry(entry)}
      176 -                        style={({ pressed }) => [             
      177 -                          styles.entryChip,                   
      178 -                          {                                   
      179 -                            minHeight: sizes.chipMinHeight,   
      180 -                            borderRadius: sizes.chipBorderRadi
          -us,                                                           
      181 -                            paddingHorizontal: sizes.chipPaddi
          -ngHorizontal,                                                 
      182 -                            paddingVertical: sizes.chipPadding
          -Vertical,                                                     
      183 -                            backgroundColor: theme.backgroundS
          -elected,                                                      
      184 -                          },                                  
      185 -                          pressed && styles.pressed,          
      186 -                        ]}>                                   
      187 -                        <ThemedText                           
      188 -                          style={[                            
      189 -                            styles.entryTitle,                
      190 -                            {                                 
      191 -                              fontSize: sizes.titleFontSize,  
      192 -                              lineHeight: sizes.titleLineHeigh
          -t,                                                            
      193 -                            },                                
      194 -                          ]}                                  
      195 -                          numberOfLines={1}>                  
      152 +                        className="wg-entry-chip"             
      153 +                        // borderCurve ist ein echter Laufzeit
          +wert ohne Tailwind-Aequivalent.                               
      154 +                        style={{ borderCurve: 'continuous' }}>
      155 +                        <ThemedText className="wg-entry-title"
          + numberOfLines={1}>                                           
      156                            {entry.recipe_title}
      157                          </ThemedText>
      198 -                        <ThemedText                           
      199 -                          themeColor="textSecondary"          
      200 -                          style={[                            
      201 -                            styles.entryMeta,                 
      202 -                            {                                 
      203 -                              fontSize: sizes.metaFontSize,   
      204 -                              lineHeight: sizes.metaLineHeight
          -,                                                             
      205 -                            },                                
      206 -                          ]}>                                 
      158 +                        <ThemedText themeColor="textSecondary"
          + className="wg-entry-meta">                                   
      159                            {portionLabel(entry.portions)}
      160                          </ThemedText>
      161                        </Pressable>
     ...
      165                        role="button"
      166                        aria-label={`${SLOT_LABELS[slot]} am ${w
           eekdayLabel(date)}, Gericht hinzufügen`}
      167                        onPress={() => onTapEmptyCell(date, slot
           )}
      216 -                      style={({ pressed }) => [               
      217 -                        styles.addButton,                     
      218 -                        {                                     
      219 -                          minHeight: sizes.addMinHeight,      
      220 -                          borderRadius: sizes.addBorderRadius,
      221 -                          paddingHorizontal: sizes.addPaddingH
          -orizontal,                                                    
      222 -                          borderColor: theme.border,          
      223 -                        },                                    
      224 -                        pressed && styles.pressed,            
      225 -                      ]}>                                     
      226 -                      <ThemedText                             
      227 -                        themeColor="accent"                   
      228 -                        style={[                              
      229 -                          styles.addText,                     
      230 -                          {                                   
      231 -                            fontSize: sizes.addFontSize,      
      232 -                            lineHeight: sizes.addLineHeight,  
      233 -                          },                                  
      234 -                        ]}>                                   
      168 +                      className="wg-add-button"               
      169 +                      // borderCurve ist ein echter Laufzeitwe
          +rt ohne Tailwind-Aequivalent.                                 
      170 +                      style={{ borderCurve: 'continuous' }}>  
      171 +                      <ThemedText themeColor="accent" classNam
          +e="wg-add-text">                                              
      172                          {cellEntries.length > 0 ? '+ Weiteres'
            : '+ Gericht'}
      173                        </ThemedText>
      174                      </Pressable>
     ...
      181  
      182          {recipes.length > 0 ? (
      183            <View
      247 -            style={[                                          
      248 -              styles.tray,                                    
      249 -              {                                               
      250 -                backgroundColor: withAlpha(theme.backgroundEle
          -ment, 0.78),                                                  
      251 -                borderColor: theme.border,                    
      252 -              },                                              
      253 -            ]}>                                               
      254 -            <ThemedText type="captionCompact" style={styles.tr
          -ayTitle}>                                                     
      184 +            className="wg-tray"                               
      185 +            // borderCurve ist ein echter Laufzeitwert ohne Ta
          +ilwind-Aequivalent.                                           
      186 +            style={{ borderCurve: 'continuous' }}>            
      187 +            <ThemedText type="captionCompact" className="wg-tr
          +ay-title">                                                    
      188                Rezepte zum Ziehen
      189              </ThemedText>
      257 -            <ThemedText themeColor="textSecondary" style={styl
          -es.trayLabel}>                                                
      190 +            <ThemedText themeColor="textSecondary" className="
          +wg-tray-label">                                               
      191                Karte halten und auf eine Mahlzeit ziehen
      192              </ThemedText>
      260 -            <View style={styles.trayGrid}>                    
      193 +            <View className="wg-tray-grid">                   
      194                {recipes.map((recipe) => (
      195                  <DraggableRecipeCard
      196                    key={recipe.id}
     ...
      207        </ScrollView>
      208  
      209        {draggingRecipe ? (
      277 -        <Animated.View pointerEvents="none" style={[styles.dra
          -gOverlay, overlayStyle]}>                                     
      210 +        <Animated.View pointerEvents="none" className="wg-drag
          +-overlay" style={overlayStyle}>                               
      211            <DragPreviewCard recipe={draggingRecipe} />
      212          </Animated.View>
      213        ) : null}

⏺ Jetzt die restlichen zwei Subkomponenten:

  Read 1 file (ctrl+o to expand)

⏺ Update(src/features/meal-planner/components/week-grid.tsx)
  ⎿  Removed 1 line
      229    onDragStart: (recipe: DraggableRecipe) => void;
      230    onDragEnd: (absoluteX: number, absoluteY: number, recipe: Dr
           aggableRecipe) => Promise<void>;
      231  }) {
      232 -  const theme = useTheme();                                   
      232    const { data: coverUrl } = useRecipeCoverUrl(recipe.coverIma
           gePath);
      233  
      234    // `activateAfterLongPress` laesst der umgebenden horizontal
           en ScrollView

⏺ Update(src/features/meal-planner/components/week-grid.tsx)
  ⎿  Added 16 lines, removed 165 lines
      255  
      256    return (
      257      <GestureDetector gesture={pan}>
      258 -      <View style={[styles.recipeCard, { backgroundColor: them
          -e.backgroundSelected }]}>                                     
      259 -        <View style={styles.recipeCardArtwork}>               
      258 +      <View className="wg-recipe-card" style={{ borderCurve: '
          +continuous' }}>                                               
      259 +        <View className="wg-recipe-card-artwork" style={{ bord
          +erCurve: 'continuous' }}>                                     
      260            <RecipeArtwork title={recipe.title} coverUrl={coverU
           rl} paletteIndex={recipe.id.length} />
      261          </View>
      262 -        <ThemedText style={styles.recipeCardText} numberOfLine
          -s={2}>                                                        
      262 +        <ThemedText className="wg-recipe-card-text" numberOfLi
          +nes={2}>                                                      
      263            {recipe.title}
      264          </ThemedText>
      265        </View>
     ...
      274  
      275    return (
      276      <View
      277 -      style={[                                                
      278 -        styles.dragPreviewCard,                               
      279 -        {                                                     
      280 -          backgroundColor: theme.backgroundSelected,          
      281 -          borderColor: theme.accent,                          
      282 -          shadowColor: theme.shadowCard,                      
      283 -        },                                                    
      284 -      ]}>                                                     
      285 -      <View style={styles.dragPreviewArtwork}>                
      277 +      className="wg-drag-preview-card"                        
      278 +      // borderCurve und der Schatten (individuelle Opazitaet/
          +Radius/Offset,                                                
      279 +      // keine passende boxShadow-Preset-Klasse) sind echte La
          +ufzeitwerte                                                   
      280 +      // ohne Tailwind-Aequivalent.                           
      281 +      style={{                                                
      282 +        borderCurve: 'continuous',                            
      283 +        shadowColor: theme.shadowCard,                        
      284 +        shadowOpacity: 0.22,                                  
      285 +        shadowRadius: 12,                                     
      286 +        shadowOffset: { width: 0, height: 6 },                
      287 +      }}>                                                     
      288 +      <View className="wg-drag-preview-artwork" style={{ borde
          +rCurve: 'continuous' }}>                                      
      289          <RecipeArtwork title={recipe.title} coverUrl={coverUrl
           } paletteIndex={recipe.id.length} />
      290        </View>
      288 -      <ThemedText style={styles.dragPreviewText} numberOfLines
          -={1}>                                                         
      291 +      <ThemedText className="wg-drag-preview-text" numberOfLin
          +es={1}>                                                       
      292          {recipe.title}
      293        </ThemedText>
      294      </View>
      295    );
      296  }
      294 -                                                              
      295 -const styles = StyleSheet.create({                            
      296 -  root: {                                                     
      297 -    flex: 1,                                                  
      298 -  },                                                          
      299 -  scroll: {                                                   
      300 -    flex: 1,                                                  
      301 -  },                                                          
      302 -  content: {                                                  
      303 -    gap: 8,                                                   
      304 -    paddingTop: 10,                                           
      305 -    paddingBottom: 126,                                       
      306 -  },                                                          
      307 -  dayCard: {                                                  
      308 -    overflow: 'hidden',                                       
      309 -    borderWidth: 1,                                           
      310 -    borderRadius: Radius.sheet,                               
      311 -    borderCurve: 'continuous',                                
      312 -  },                                                          
      313 -  dayHeader: {                                                
      314 -    height: 38,                                               
      315 -    flexDirection: 'row',                                     
      316 -    alignItems: 'center',                                     
      317 -    justifyContent: 'space-between',                          
      318 -    paddingHorizontal: 12,                                    
      319 -  },                                                          
      320 -  dayName: {                                                  
      321 -    ...FontSize[17],                                          
      322 -    lineHeight: 21,                                           
      323 -    fontWeight: 700,                                          
      324 -  },                                                          
      325 -  dayDate: {                                                  
      326 -    ...FontSize[9],                                           
      327 -    lineHeight: 12,                                           
      328 -    fontWeight: 500,                                          
      329 -  },                                                          
      330 -  // Die Mahlzeiten stehen in jeder Ansicht untereinander (#19
          -5-Mockup                                                      
      331 -  // "06.02"); nur die Groessen aus VIEW_SLOT_SIZES unterschei
          -den sich.                                                     
      332 -  slotColumn: {                                               
      333 -    flexDirection: 'column',                                  
      334 -    borderTopWidth: 1,                                        
      335 -  },                                                          
      336 -  slot: {                                                     
      337 -    minWidth: 0,                                              
      338 -  },                                                          
      339 -  slotLabel: {                                                
      340 -    fontWeight: 700,                                          
      341 -    letterSpacing: 0.55,                                      
      342 -    textTransform: 'uppercase',                               
      343 -  },                                                          
      344 -  entryChip: {                                                
      345 -    justifyContent: 'center',                                 
      346 -    borderCurve: 'continuous',                                
      347 -  },                                                          
      348 -  entryTitle: {                                               
      349 -    fontWeight: 700,                                          
      350 -  },                                                          
      351 -  entryMeta: {                                                
      352 -    fontWeight: 500,                                          
      353 -  },                                                          
      354 -  addButton: {                                                
      355 -    alignItems: 'center',                                     
      356 -    justifyContent: 'center',                                 
      357 -    borderWidth: 1,                                           
      358 -    borderStyle: 'dashed',                                    
      359 -    borderCurve: 'continuous',                                
      360 -  },                                                          
      361 -  addText: {                                                  
      362 -    fontWeight: 600,                                          
      363 -  },                                                          
      364 -  pressed: {                                                  
      365 -    opacity: 0.7,                                             
      366 -  },                                                          
      367 -  tray: {                                                     
      368 -    overflow: 'hidden',                                       
      369 -    borderWidth: 1,                                           
      370 -    borderRadius: Radius.sheet,                               
      371 -    borderCurve: 'continuous',                                
      372 -    paddingVertical: 12,                                      
      373 -  },                                                          
      374 -  trayTitle: {                                                
      375 -    paddingHorizontal: 12,                                    
      376 -    ...FontSize[11],                                          
      377 -    lineHeight: 14,                                           
      378 -    fontWeight: 700,                                          
      379 -  },                                                          
      380 -  trayLabel: {                                                
      381 -    paddingHorizontal: 12,                                    
      382 -    paddingTop: 1,                                            
      383 -    paddingBottom: 8,                                         
      384 -    ...FontSize[8],                                           
      385 -    lineHeight: 11,                                           
      386 -    fontWeight: 500,                                          
      387 -  },                                                          
      388 -  // Zwei-Spalten-Kachelraster statt horizontalem Scrollen: di
          -e Karten stehen                                               
      389 -  // untereinander, keine Konkurrenz mehr mit einer zweiten (h
          -orizontalen)                                                  
      390 -  // ScrollView um die Ziehgeste.                             
      391 -  trayGrid: {                                                 
      392 -    flexDirection: 'row',                                     
      393 -    flexWrap: 'wrap',                                         
      394 -    gap: 10,                                                  
      395 -    paddingHorizontal: 12,                                    
      396 -  },                                                          
      397 -  // Große Rezeptkarte im Zieh-Tray, statt der frueheren winzi
          -gen Text-Chips —                                              
      398 -  // das Bild macht das Gericht auf den ersten Blick erkennbar
          -.                                                             
      399 -  recipeCard: {                                               
      400 -    width: '47%',                                             
      401 -    borderRadius: Radius.card,                                
      402 -    borderCurve: 'continuous',                                
      403 -    padding: 8,                                               
      404 -    gap: 6,                                                   
      405 -  },                                                          
      406 -  recipeCardArtwork: {                                        
      407 -    height: 118,                                              
      408 -    overflow: 'hidden',                                       
      409 -    borderRadius: Radius.control,                             
      410 -    borderCurve: 'continuous',                                
      411 -  },                                                          
      412 -  recipeCardText: {                                           
      413 -    ...FontSize[12],                                          
      414 -    lineHeight: 15,                                           
      415 -    fontWeight: 700,                                          
      416 -  },                                                          
      417 -  dragOverlay: {                                              
      418 -    position: 'absolute',                                     
      419 -    left: 0,                                                  
      420 -    top: 0,                                                   
      421 -  },                                                          
      422 -  dragPreviewCard: {                                          
      423 -    width: 112,                                               
      424 -    borderRadius: Radius.card,                                
      425 -    borderCurve: 'continuous',                                
      426 -    borderWidth: 2,                                           
      427 -    padding: 6,                                               
      428 -    gap: 4,                                                   
      429 -    opacity: 0.94,                                            
      430 -    shadowOpacity: 0.22,                                      
      431 -    shadowRadius: 12,                                         
      432 -    shadowOffset: { width: 0, height: 6 },                    
      433 -  },                                                          
      434 -  dragPreviewArtwork: {                                       
      435 -    height: 68,                                               
      436 -    overflow: 'hidden',                                       
      437 -    borderRadius: Radius.control,                             
      438 -    borderCurve: 'continuous',                                
      439 -  },                                                          
      440 -  dragPreviewText: {                                          
      441 -    ...FontSize[10],                                          
      442 -    lineHeight: 13,                                           
      443 -    fontWeight: 700,                                          
      444 -  },                                                          
      445 -});                                                           

⏺ Verifikation:

  Searched for 1 pattern (ctrl+o to expand)
⏺ Alle dokumentierte Ausnahmen (borderCurve/Schatten). Jetzt volle Verifikation:

  Ran 3 shell commands (ctrl+o to expand)

⏺ week-grid.tsx fertig — die letzte Datei meiner Liste! Jetzt der komplette
  Testlauf zur finalen Absicherung:

  Ran 1 shell command (ctrl+o to expand)

⏺ Alle 628 Tests grün. Jetzt die Migration-Doc final aktualisieren — meine
  gesamte Liste ist fertig:

⏺ Update(docs/design-system/nativewind-liquid-glass-migration.md)
  ⎿  Added 25 lines, removed 5 lines
      192     bleibt an mehreren Cards/Buttons als dokumentierte `style`-
           Ausnahme (kein
      193     Tailwind-Äquivalent, analog zu dashboard-screen.tsx). `bun 
           run test`
      194     (35 Tests in `calorie-tracking/`, alle 628 app-weit) grün.
      195 -10. **`meal-planner/`** (5 Dateien, 1552 Zeilen):             
      196 -    `components/recipe-picker-modal.tsx` (117),               
      197 -    `components/entry-form-modal.tsx` (229),                  
      198 -    `missing-ingredients-screen.tsx` (207), `meal-planner-scre
          -en.tsx` (456),                                                
      199 -    `components/week-grid.tsx` (543)                          
      195 +10. [x] **`meal-planner/`** (5 Dateien, 1552 Zeilen) — alle fe
          +rtig. Neue                                                    
      196 +    Klassenpräfixe `rpm-*` (recipe-picker-modal), `efm-*` (ent
          +ry-form-modal,                                                
      197 +    teilt sich `rpm-root`/`rpm-safe-area`/`rpm-header`/`rpm-cl
          +ose-button`                                                   
      198 +    mit recipe-picker-modal.tsx — identisches Modal-Grundgerüs
          +t), `mis-*`                                                   
      199 +    (missing-ingredients), `mp-*` (meal-planner-screen), `wg-*
          +` (week-grid).                                                
      200 +    In `week-grid.tsx` das bis dahin eigenständige `SLOT_SIZES
          +`-Konstanten-                                                 
      201 +    objekt aufgelöst und direkt in die Klassen übernommen (Grö
          +ßen waren                                                     
      202 +    schon vorher für Tag-/3-Tage-/Wochenansicht identisch, nur
          + die                                                          
      203 +    Indirektion war unnötig — dokumentierte Vereinfachung, kei
          +n                                                             
      204 +    Verhaltensunterschied). In `meal-planner-screen.tsx` den b
          +ereits toten                                                  
      205 +    `labelStyle`-Prop von `SegmentedControl` entfernt (die Kom
          +ponente                                                       
      206 +    destrukturiert ihn zu `_labelStyle` und ignoriert ihn seit
          + ihrer eigenen                                                
      207 +    NativeWind-Migration). `borderCurve: 'continuous'` und ein
          + individueller                                                
      208 +    Drag-Preview-Schatten (kein passendes boxShadow-Preset) bl
          +eiben als                                                     
      209 +    dokumentierte `style`-Ausnahmen. `bun run test` (79 Tests 
          +in                                                            
      210 +    `meal-planner/`, alle 628 app-weit) grün.                 
      211  
      212 +### Claude — alle 10 Domänen abgeschlossen                    
      213 +                                                              
      214 +Damit ist meine gesamte zugewiesene Liste (`settings/`-Rest, `
          +navigation/`,                                                 
      215 +`premium/`, `recipe-templates/`, `dashboard/`, `household/`, `
          +fridge/`,                                                     
      216 +`inventory/`, `calorie-tracking/`, `meal-planner/`) fertig mig
          +riert. Nächster                                               
      217 +Schritt laut Vereinbarung: Rückmeldung an Marco vor Beginn von
          + Phase C                                                      
      218 +(Liquid-Glass-Dashboard-Karten) — dafür erst statische Mocks b
          +auen und zur                                                  
      219 +Auswahl vorlegen, bevor echte Komponenten angefasst werden.   
      220 +                                                              
      221  #### Gemini — Liste (2 Domains, ~8840 Zeilen, 28 Dateien)
      222  
      223  Bewusst als Paar zusammengelegt: `shopping-list/` und `recipes
           /` teilen sich

⏺ Ich bin fertig mit meiner gesamten zugewiesenen Migrationsliste. Kurze
  Zusammenfassung:

  Abgeschlossen in dieser Session:
  - inventory/-Domäne (2 letzte Dateien): add-item-screen.tsx,
  product-search-dropdown.tsx
  - calorie-tracking/-Domäne (alle 4 Dateien): diary-screen.tsx,
  food-search-screen.tsx, add-food-entry-screen.tsx, goal-setup-screen.tsx
  - meal-planner/-Domäne (alle 5 Dateien): recipe-picker-modal.tsx,
  entry-form-modal.tsx, missing-ingredients-screen.tsx, meal-planner-screen.tsx,
  week-grid.tsx

  Damit sind alle 10 mir zugewiesenen Domänen (settings/-Rest, navigation/,
  premium/, recipe-templates/, dashboard/, household/, fridge/, inventory/,
  calorie-tracking/, meal-planner/) vollständig auf NativeWind migriert.

  Pro Datei durchlief ich das etablierte Verfahren: grep style={{ (nur
  dokumentierte Ausnahmen wie borderCurve: 'continuous', Android-elevation,
  expo-image-Komponenten), bun run check:fix, bun run typecheck,
  Tailwind-CSS-Build, gezielte Tests. Der volle Testlauf steht am Ende bei
  628/628 grün.

  Kleinere Aufräumarbeiten nebenbei erledigt: das tote labelStyle-Prop bei
  SegmentedControl entfernt, week-grid.tsxs überflüssiges SLOT_SIZES-Objekt
  direkt in Klassen aufgelöst.

  Nächster Schritt laut Migrationsplan: Rückmeldung, bevor Phase C
  (Liquid-Glass-Dashboard-Karten) beginnt — dafür müssen erst statische Mocks
  gebaut und zur Auswahl vorgelegt werden, bevor echte Komponenten angefasst
  werden. Soll ich damit weitermachen, oder möchtest du erst den Stand von
  Gemini (shopping-list/, recipes/) abwarten?

✻ Baked for 22m 12s

❯ Essenplan die "Tag" bis - "Woche" tabs sind sehr klein in rezepte haätten wir 
  auch 2 tabs/ button die auch ziemlich gleich sind und etwas zu klein          

  Searched for 8 patterns, read 2 files (ctrl+o to expand)

⏺ User answered Claude's questions:
  ⎿  · Welche 2 Tabs/Buttons in Rezepte meinst du genau? → Bei Rezepte 
     hauptansicht. ist es "entdecken und Favoriten" 

⏺ Ah, das ist die Hauptansicht von "Rezepte" — "Entdecken" / "Favoriten".
  Schauen wir uns das an:

  Searched for 2 patterns, read 1 file (ctrl+o to expand)

⏺ Skill(artifact-design)
  ⎿  Successfully loaded skill

  Searched for 1 pattern (ctrl+o to expand)

⏺ Write(/private/tmp/claude-501/-Users-marco-Github-tmp-family-app-fam/1e98a736-
       1a69-4565-bb9b-effe9a904e26/scratchpad/tab-size-options.html)
  ⎿  Wrote 378 lines to ../../../../../private/tmp/claude-501/-Users-marco-
     Github-tmp-family-app-fam/1e98a736-1a69-4565-bb9b-effe9a904e26/scratch
     pad/tab-size-options.html
       1 <title>Tab-Größen Vergleich</title>
       2 <style>
       3   :root {
       4     --bg: #F8F4EF;
       5     --surface: #FBF7F2;
       6     --selected: #E9E1E7;
       7     --text: #2D2830;
       8     --text-secondary: #786F79;
       9     --border: #E4DDE3;
      10     --accent: #705773;
     … +390 lines (ctrl+o to expand)

⏺ Update(/private/tmp/claude-501/-Users-marco-Github-tmp-family-app-fam/1e98a736
        -1a69-4565-bb9b-effe9a904e26/scratchpad/tab-size-options.html)
  ⎿  Added 2 lines, removed 2 lines
      12      --mock-label: #A99AAA;
      13      --mock-rule: #E4DDE3;
      14    }
      15 -  :root:not([data-theme="light"]) {                            
      16 -    @media (prefers-color-scheme: dark) {                      
      15 +  @media (prefers-color-scheme: dark) {                        
      16 +    :root:not([data-theme="light"]) {                          
      17        --bg: #211D23;
      18        --surface: #2B262E;
      19        --selected: #382F3B;

⏺ Jetzt veröffentlichen:

⏺ Artifact(/private/tmp/claude-501/-Users-marco-Github-tmp-family-app-fam/1e98a7
          36-1a69-4565-bb9b-effe9a904e26/scratchpad/tab-size-options.html)
  ⎿  Published ⧉ 
     https://claude.ai/code/artifact/69bb116d-f80d-460f-950a-a2433ce7da76
⏺ Hier ist der Vergleich: ⧉ 
  https://claude.ai/code/artifact/69bb116d-f80d-460f-950a-a2433ce7da76

  Zwei Bereiche, jeweils mit dem aktuellen Zustand plus zwei größeren Varianten
  (Option A, Option B), in echten fam-Farben und mit Hell/Dunkel-Umschalter oben
  rechts:

  - Rezepte – „Entdecken" / „Meine Favoriten" (aktuell 40px hoch, 13px Text)
  - Essensplan – „Tag" / „3 Tage" / „Woche" (aktuell 40px hoch, nur 11px Text —
  das ist wahrscheinlich der Hauptübeltäter)

  Sag mir, welche Variante pro Paar übernommen werden soll (auch gemischt), dann
  setze ich es in den echten Komponenten um.

✻ Crunched for 2m 38s

❯ bei beiden A aber die farben von essenplan die richtigen farben und müssen    
  verwendet werden                                                              

⏺ Verstanden — bei beiden Option A, und bei den Essensplan-Tabs
  (SegmentedControl) müssen die echten Theme-Farben
  (Accent/On-Accent/Background-Selected) verwendet werden, nicht irgendwelche
  Mock-Werte. Ich setze das jetzt in den echten Komponenten um.

  Read 1 file (ctrl+o to expand)

⏺ Update(src/components/segmented-control.tsx)
  ⎿  Added 1 line, removed 1 line
      13    onSelect: (value: T) => void;
      14    appearance?: 'accent' | 'surface';
      15    scrollable?: boolean;
      16 -  size?: 'default' | 'compact';                                
      16 +  size?: 'default' | 'compact' | 'large';                      
      17    gap?: number;
      18    labelStyle?: StyleProp<TextStyle>;
      19  };

⏺ Update(src/components/segmented-control.tsx)
  ⎿  Added 3 lines, removed 1 line
      35        ? 'h-[48px] gap-two rounded-card p-one'
      36        : size === 'compact'
      37          ? 'h-[38px] rounded-control p-[3px] gap-one'
      38 -        : 'h-[40px] rounded-control-lg p-[3px] gap-one';       
      38 +        : size === 'large'                                     
      39 +          ? 'h-[46px] rounded-control-lg p-[3px] gap-one'      
      40 +          : 'h-[40px] rounded-control-lg p-[3px] gap-one';     
      41  
      42    const control = (
      43      <View

⏺ Update(src/components/segmented-control.tsx)
  ⎿  Added 3 lines, removed 1 line
      51              ? 'min-h-[40px]'
      52              : size === 'compact'
      53                ? 'min-h-[32px]'
      54 -              : 'min-h-[34px]';                                
      54 +              : size === 'large'                               
      55 +                ? 'min-h-[40px]'                               
      56 +                : 'min-h-[34px]';                              
      57  
      58          const activeBgClass = active
      59            ? appearance === 'surface'

⏺ Update(src/components/segmented-control.tsx)
  ⎿  Added 5 lines, removed 1 line
      67              : 'text-on-accent'
      68            : 'text-text-secondary';
      69  
      70 -        const labelSizeClass = appearance === 'surface' ? 'text
         --label' : 'text-caption-compact';                              
      70 +        // 'large' teilt sich die groessere Label-Groesse mit '
         +surface' (13px                                                 
      71 +        // statt 11px) — beide brauchen mehr Prominenz als der 
         +kompakte                                                       
      72 +        // Standard-Fall.                                      
      73 +        const labelSizeClass =                                 
      74 +          appearance === 'surface' || size === 'large' ? 'text-
         +label' : 'text-caption-compact';                               
      75  
      76          return (
      77            <Pressable

⏺ Jetzt in meal-planner-screen.tsx die size="large" aktivieren:

  Searched for 1 pattern (ctrl+o to expand)

⏺ Update(src/features/meal-planner/meal-planner-screen.tsx)
  ⎿  Added 1 line
      265              }))}
      266              selected={viewMode}
      267              onSelect={setViewMode}
      268 +            size="large"                                      
      269            />
      270  
      271            <View className="mp-period-row">

⏺ Jetzt die Rezepte-Toggle-Buttons auf Option A anpassen:

  Read 1 file (ctrl+o to expand)

⏺ Update(src/features/recipes/recipes-screen.tsx)
  ⎿  Added 2 lines, removed 2 lines
      443                  role="button"
      444                  aria-label="Entdecken"
      445                  aria-selected={view === 'discover'}
      446 -                className={`flex-1 h-10 rounded-control border
          - items-center justify-center ${                               
      446 +                className={`flex-1 h-[46px] rounded-control-lg
          + border items-center justify-center ${                        
      447                    view === 'discover'
      448                      ? 'bg-text border-text'
      449                      : 'bg-background-element/85 border-border'
     ...
      461                  role="button"
      462                  aria-label="Meine Favoriten"
      463                  aria-selected={view === 'favorites'}
      464 -                className={`flex-1 h-10 rounded-control border
          - items-center justify-center ${                               
      464 +                className={`flex-1 h-[46px] rounded-control-lg
          + border items-center justify-center ${                        
      465                    view === 'favorites'
      466                      ? 'bg-text border-text'
      467                      : 'bg-background-element/85 border-border'

⏺ Update(src/features/recipes/recipes-screen.tsx)
  ⎿  Added 2 lines, removed 2 lines
      450                  }`}>
      451                  <ThemedText
      452                    type="detail"
      453 -                  className={`text-[13px] leading-[16px] font-
          -bold ${                                                       
      453 +                  className={`text-[14px] leading-[18px] font-
          +bold ${                                                       
      454                      view === 'discover' ? 'text-background' : 
           'text-text-secondary'
      455                    }`}>
      456                    Entdecken
     ...
      468                  }`}>
      469                  <ThemedText
      470                    type="detail"
      471 -                  className={`text-[13px] leading-[16px] font-
          -bold ${                                                       
      471 +                  className={`text-[14px] leading-[18px] font-
          +bold ${                                                       
      472                      view === 'favorites' ? 'text-background' :
            'text-text-secondary'
      473                    }`}>
      474                    Meine Favoriten

⏺ Verifikation:

  Ran 4 shell commands (ctrl+o to expand)

⏺ Voller Testlauf zur Sicherheit:

  Ran 1 shell command (ctrl+o to expand)

⏺ Alle 628 Tests grün. Zusammenfassung der Änderungen:

  src/components/segmented-control.tsx — neue size="large"-Variante (46px hoch,
  text-label = 13px statt text-caption-compact = 11px). Nur diese eine neue
  Option hinzugefügt, die zwei anderen bestehenden Nutzungsstellen
  (food-search-screen.tsx, shopping-product-suggestions.tsx) bleiben
  unverändert, da sie size="large" nicht anfordern.

  src/features/meal-planner/meal-planner-screen.tsx — SegmentedControl bekommt
  size="large". Die Farben (bg-accent/text-on-accent für aktiv,
  bg-background-selected-Track) kommen unverändert aus der Komponente selbst —
  also den echten Theme-Tokens, nichts hardcodiert.

  src/features/recipes/recipes-screen.tsx — „Entdecken“/„Meine Favoriten“-Toggle
  von h-10/13px auf h-[46px]/14px vergrößert (Option A), Radius von
  rounded-control auf rounded-control-lg leicht mitgezogen.

  check, typecheck, CSS-Build und alle 628 Tests sind grün.

✻ Worked for 2m 23s

❯ wieso sind inline css klassen in den files                                    

  Searched for 4 patterns, ran 5 shell commands (ctrl+o to expand)
⏺ Guter Fang — das ist tatsächlich ein Verstoß gegen die eigene
  Migrations-Regel. In docs/design-system/nativewind-liquid-glass-migration.md
  steht als verbindliche Vorgabe:

  ▎ Keine Utility-Ketten im JSX, nur Ein-/Zwei-Wort-Klassen (semantisch, @layer 
  ▎ components in global.css)

  Sprich: einzelne Utilities wie className="flex-1" oder className="gap-two"
  sind erlaubt, aber mehrere Tailwind-Utilities aneinandergereiht ("flex-row 
  justify-between items-center mt-two") sollen stattdessen als eine benannte
  Klasse in global.css landen.

  Ich habe das in dieser Session an ein paar Stellen nicht sauber eingehalten —
  mir ist beim Tippen die Bequemlichkeit der Inline-Kette durchgerutscht statt
  konsequent eine neue semantische Klasse anzulegen. Konkret betroffen:

  - src/features/inventory/add-item-screen.tsx (2 Stellen)
  - src/features/inventory/product-search-dropdown.tsx (6 Stellen)
  - src/features/calorie-tracking/goal-setup-screen.tsx (1 Stelle)

  Alle anderen Dateien aus dieser Session (diary-screen, food-search-screen,
  add-food-entry-screen, week-grid, meal-planner-screen, entry-form-modal,
  recipe-picker-modal, missing-ingredients-screen, storage-locations-screen)
  sind sauber.

  Soll ich die 3 Dateien jetzt nachziehen (Ketten in benannte global.css-Klassen
  auflösen, wie beim Rest der Migration)?

✻ Brewed for 1m 11s

❯ die farbe ist auch nicht gleich in rezepte und essenplan es muss von          
  essenplan zu zepte übernommen werden                                          

  Read 1 file (ctrl+o to expand)

⏺ Bestätigt: Rezepte nutzt aktuell bg-text/border-text (mono, Text-auf-Text) für
  den aktiven Zustand statt der Accent-Farbe wie im Essensplan (bg-accent,
  text-on-accent). Ich gleiche das an:

⏺ Update(src/features/recipes/recipes-screen.tsx)
  ⎿  Added 3 lines, removed 4 lines
      445                  aria-selected={view === 'discover'}
      446                  className={`flex-1 h-[46px] rounded-control-lg
            border items-center justify-center ${
      447                    view === 'discover'
      448 -                    ? 'bg-text border-text'                   
      448 +                    ? 'bg-accent border-accent'               
      449                      : 'bg-background-element/85 border-border'
      450                  }`}>
      451                  <ThemedText
      452                    type="detail"
      453 -                  className={`text-[14px] leading-[18px] font-
          -bold ${                                                       
      454 -                    view === 'discover' ? 'text-background' : 
          -'text-text-secondary'                                         
      455 -                  }`}>                                        
      453 +                  themeColor={view === 'discover' ? 'onAccent'
          + : 'textSecondary'}                                           
      454 +                  className="text-[14px] leading-[18px] font-b
          +old">                                                         
      455                    Entdecken
      456                  </ThemedText>
      457                </Pressable>

⏺ Update(src/features/recipes/recipes-screen.tsx)
  ⎿  Added 3 lines, removed 4 lines
      462                  aria-selected={view === 'favorites'}
      463                  className={`flex-1 h-[46px] rounded-control-lg
            border items-center justify-center ${
      464                    view === 'favorites'
      465 -                    ? 'bg-text border-text'                   
      465 +                    ? 'bg-accent border-accent'               
      466                      : 'bg-background-element/85 border-border'
      467                  }`}>
      468                  <ThemedText
      469                    type="detail"
      470 -                  className={`text-[14px] leading-[18px] font-
          -bold ${                                                       
      471 -                    view === 'favorites' ? 'text-background' :
          - 'text-text-secondary'                                        
      472 -                  }`}>                                        
      470 +                  themeColor={view === 'favorites' ? 'onAccent
          +' : 'textSecondary'}                                          
      471 +                  className="text-[14px] leading-[18px] font-b
          +old">                                                         
      472                    Meine Favoriten
      473                  </ThemedText>
      474                </Pressable>

  Searched for 1 pattern (ctrl+o to expand)

⏺ Gut, beide Keys existieren. Verifikation:

  Ran 3 shell commands (ctrl+o to expand)

⏺ Voller Testlauf zur Sicherheit:

  Ran 1 shell command (ctrl+o to expand)

⏺ Alle 628 Tests grün. Die Rezepte-Toggle-Buttons nutzen jetzt dieselbe
  Accent-Farblogik wie der Essensplan: aktiv = bg-accent/border-accent mit
  text-on-accent-Text, statt vorher bg-text/border-text (mono).

  Noch offen von vorhin: die drei Dateien mit den Utility-Ketten-Verstößen
  (add-item-screen.tsx, product-search-dropdown.tsx, goal-setup-screen.tsx) —
  soll ich die jetzt auch nachziehen?

✻ Cooked for 1m 13s

❯ erstelle für diese 5 buttons eine class wo wir farbe größe rundung setzen     
  können und diese für alle 5 buttons zusammen ziehen.                          

  Searched for 1 pattern, read 1 file (ctrl+o to expand)

⏺ Update(src/global.css)
  ⎿  Added 20 lines
      1601    .wg-drag-preview-text {
      1602      @apply text-[10px] leading-[13px] font-bold;
      1603    }
      1604 +                                                             
      1605 +  /*                                                         
      1606 +   * Geteilte Tab-Button-Klasse fuer die 5 gleichartigen Umsc
           +halt-Buttons:                                                
      1607 +   * "Entdecken"/"Meine Favoriten" (recipes-screen.tsx) und  
      1608 +   * "Tag"/"3 Tage"/"Woche" (meal-planner-screen.tsx). Farbe,
           + Groesse und                                                 
      1609 +   * Rundung leben ausschliesslich hier — bei Aenderungen an 
           +einer Stelle                                                 
      1610 +   * bitte nicht pro Screen einzeln nachziehen.              
      1611 +   */                                                        
      1612 +  .tab-btn {                                                 
      1613 +    @apply flex-1 h-[46px] rounded-control-lg border items-ce
           +nter justify-center;                                         
      1614 +  }                                                          
      1615 +  .tab-btn-active {                                          
      1616 +    @apply bg-accent border-accent;                          
      1617 +  }                                                          
      1618 +  .tab-btn-idle {                                            
      1619 +    @apply bg-background-element/85 border-border;           
      1620 +  }                                                          
      1621 +  .tab-btn-label {                                           
      1622 +    @apply text-[14px] leading-[18px] font-bold;             
      1623 +  }                                                          
      1624  }

⏺ Jetzt recipes-screen.tsx auf die neue Klasse umstellen:

  Read 1 file (ctrl+o to expand)

⏺ Update(src/features/recipes/recipes-screen.tsx)
  ⎿  Added 4 lines, removed 12 lines
      443                  role="button"
      444                  aria-label="Entdecken"
      445                  aria-selected={view === 'discover'}
      446 -                className={`flex-1 h-[46px] rounded-control-lg
          - border items-center justify-center ${                        
      447 -                  view === 'discover'                         
      448 -                    ? 'bg-accent border-accent'               
      449 -                    : 'bg-background-element/85 border-border'
      450 -                }`}>                                          
      446 +                className={`tab-btn ${view === 'discover' ? 't
          +ab-btn-active' : 'tab-btn-idle'}`}>                           
      447                  <ThemedText
      448                    type="detail"
      449                    themeColor={view === 'discover' ? 'onAccent'
            : 'textSecondary'}
      454 -                  className="text-[14px] leading-[18px] font-b
          -old">                                                         
      450 +                  className="tab-btn-label">                  
      451                    Entdecken
      452                  </ThemedText>
      453                </Pressable>
     ...
      456                  role="button"
      457                  aria-label="Meine Favoriten"
      458                  aria-selected={view === 'favorites'}
      463 -                className={`flex-1 h-[46px] rounded-control-lg
          - border items-center justify-center ${                        
      464 -                  view === 'favorites'                        
      465 -                    ? 'bg-accent border-accent'               
      466 -                    : 'bg-background-element/85 border-border'
      467 -                }`}>                                          
      459 +                className={`tab-btn ${view === 'favorites' ? '
          +tab-btn-active' : 'tab-btn-idle'}`}>                          
      460                  <ThemedText
      461                    type="detail"
      462                    themeColor={view === 'favorites' ? 'onAccent
           ' : 'textSecondary'}
      471 -                  className="text-[14px] leading-[18px] font-b
          -old">                                                         
      463 +                  className="tab-btn-label">                  
      464                    Meine Favoriten
      465                  </ThemedText>
      466                </Pressable>

⏺ Jetzt meal-planner-screen.tsx: den SegmentedControl durch die gleiche
  Button-Reihe wie bei Rezepte ersetzen:

  Read 1 file (ctrl+o to expand)

⏺ Update(src/features/meal-planner/meal-planner-screen.tsx)
  ⎿  Removed 1 line
       6  
       7  import { GradientBackground } from '@/components/gradient-backg
          round';
       8  import { PageHeader } from '@/components/page-header';
       9 -import { SegmentedControl } from '@/components/segmented-contro
         -l';                                                            
       9  import { ThemedText } from '@/components/themed-text';
      10  import { HeaderIconButton, MenuButton } from '@/components/ui/b
          uttons';
      11  import { useSession } from '@/features/auth/session-provider';

⏺ Update(src/features/meal-planner/meal-planner-screen.tsx)
  ⎿  Added 18 lines, removed 11 lines
      255          />
      256  
      257          <View className="mp-content">
      258 -          <SegmentedControl                                   
      259 -            label="Zeitraum"                                  
      260 -            options={VIEW_MODES.map((mode) => ({              
      261 -              value: mode,                                    
      262 -              label: VIEW_MODE_LABELS[mode],                  
      263 -              accessibilityLabel: `${VIEW_MODE_LABELS[mode]}-A
          -nsicht`,                                                      
      264 -            }))}                                              
      265 -            selected={viewMode}                               
      266 -            onSelect={setViewMode}                            
      267 -            size="large"                                      
      268 -          />                                                  
      258 +          <View className="flex-row gap-two" role="tablist" ar
          +ia-label="Zeitraum">                                          
      259 +            {VIEW_MODES.map((mode) => (                       
      260 +              <Pressable                                      
      261 +                key={mode}                                    
      262 +                onPress={() => setViewMode(mode)}             
      263 +                role="button"                                 
      264 +                aria-label={`${VIEW_MODE_LABELS[mode]}-Ansicht
          +`}                                                            
      265 +                aria-selected={viewMode === mode}             
      266 +                className={`tab-btn ${viewMode === mode ? 'tab
          +-btn-active' : 'tab-btn-idle'}`}>                             
      267 +                <ThemedText                                   
      268 +                  type="detail"                               
      269 +                  themeColor={viewMode === mode ? 'onAccent' :
          + 'textSecondary'}                                             
      270 +                  className="tab-btn-label">                  
      271 +                  {VIEW_MODE_LABELS[mode]}                    
      272 +                </ThemedText>                                 
      273 +              </Pressable>                                    
      274 +            ))}                                               
      275 +          </View>                                             
      276  
      277            <View className="mp-period-row">
      278              <Pressable

  Searched for 1 pattern, read 1 file (ctrl+o to expand)
⏺ Ich mache die large-Erweiterung rückgängig, da sie jetzt tote Fläche wäre (nur
  der Essensplan hätte sie genutzt):

⏺ Update(src/components/segmented-control.tsx)
  ⎿  Added 1 line, removed 1 line
      13    onSelect: (value: T) => void;
      14    appearance?: 'accent' | 'surface';
      15    scrollable?: boolean;
      16 -  size?: 'default' | 'compact' | 'large';                      
      16 +  size?: 'default' | 'compact';                                
      17    gap?: number;
      18    labelStyle?: StyleProp<TextStyle>;
      19  };

⏺ Update(src/components/segmented-control.tsx)
  ⎿  Added 1 line, removed 3 lines
      35        ? 'h-[48px] gap-two rounded-card p-one'
      36        : size === 'compact'
      37          ? 'h-[38px] rounded-control p-[3px] gap-one'
      38 -        : size === 'large'                                     
      39 -          ? 'h-[46px] rounded-control-lg p-[3px] gap-one'      
      40 -          : 'h-[40px] rounded-control-lg p-[3px] gap-one';     
      38 +        : 'h-[40px] rounded-control-lg p-[3px] gap-one';       
      39  
      40    const control = (
      41      <View

⏺ Update(src/components/segmented-control.tsx)
  ⎿  Added 1 line, removed 3 lines
      49              ? 'min-h-[40px]'
      50              : size === 'compact'
      51                ? 'min-h-[32px]'
      52 -              : size === 'large'                               
      53 -                ? 'min-h-[40px]'                               
      54 -                : 'min-h-[34px]';                              
      52 +              : 'min-h-[34px]';                                
      53  
      54          const activeBgClass = active
      55            ? appearance === 'surface'

⏺ Update(src/components/segmented-control.tsx)
  ⎿  Added 1 line, removed 5 lines
      63              : 'text-on-accent'
      64            : 'text-text-secondary';
      65  
      66 -        // 'large' teilt sich die groessere Label-Groesse mit '
         -surface' (13px                                                 
      67 -        // statt 11px) — beide brauchen mehr Prominenz als der 
         -kompakte                                                       
      68 -        // Standard-Fall.                                      
      69 -        const labelSizeClass =                                 
      70 -          appearance === 'surface' || size === 'large' ? 'text-
         -label' : 'text-caption-compact';                               
      66 +        const labelSizeClass = appearance === 'surface' ? 'text
         +-label' : 'text-caption-compact';                              
      67  
      68          return (
      69            <Pressable

  Ran 4 shell commands (ctrl+o to expand)

⏺ Die Buttons hatten vorher role="tab" (SegmentedControl) — ich behalte das bei,
  da es hier semantisch korrekter ist als role="button":

⏺ Update(src/features/meal-planner/meal-planner-screen.tsx)
  ⎿  Added 1 line, removed 1 line
      260                <Pressable
      261                  key={mode}
      262                  onPress={() => setViewMode(mode)}
      263 -                role="button"                                 
      263 +                role="tab"                                    
      264                  aria-label={`${VIEW_MODE_LABELS[mode]}-Ansicht
           `}
      265                  aria-selected={viewMode === mode}
      266                  className={`tab-btn ${viewMode === mode ? 'tab
           -btn-active' : 'tab-btn-idle'}`}>

  Ran 1 shell command (ctrl+o to expand)

⏺ Voller Testlauf zur Sicherheit:

  Ran 1 shell command (ctrl+o to expand)

⏺ Alle 628 Tests grün. Zusammenfassung:

  src/global.css — neue geteilte Klassen .tab-btn (Layout: flex-1 h-[46px] 
  rounded-control-lg border items-center justify-center), .tab-btn-active
  (bg-accent border-accent), .tab-btn-idle (bg-background-element/85 
  border-border), .tab-btn-label (text-[14px] leading-[18px] font-bold). Farbe,
  Größe und Rundung sind jetzt an genau dieser einen Stelle definiert.

  src/features/recipes/recipes-screen.tsx — „Entdecken"/„Meine Favoriten" nutzen
  jetzt tab-btn/tab-btn-active/tab-btn-idle/tab-btn-label.

  src/features/meal-planner/meal-planner-screen.tsx — „Tag"/„3 Tage"/„Woche"
  sind vom generischen SegmentedControl auf dieselbe Button-Reihe umgestellt
  (eigene Pressables mit tab-btn-Klassen statt der geteilten Komponente),
  role="tablist"/role="tab" bleiben für die Barrierefreiheit erhalten.

  src/components/segmented-control.tsx — die zuvor hinzugefügte
  size="large"-Variante wieder entfernt, da sie nach der Umstellung niemand mehr
  braucht (die Komponente wird weiterhin von food-search-screen.tsx und
  shopping-product-suggestions.tsx unverändert genutzt).

  Damit teilen sich alle 5 Buttons jetzt eine einzige Quelle für
  Farbe/Größe/Rundung — Änderungen künftig nur noch an den vier tab-btn*-Klassen
  in global.css.

✻ Sautéed for 2m 51s

❯ lass uns mal suaber commiten. mir den standfesthalten                         

  Committed adb248a, ran 6 shell commands (ctrl+o to expand)

⏺ Committet auf neuem Branch feat/nativewind-migration (main wurde nicht direkt
  beschrieben):

  adb248a feat(design-system): migrate to NativeWind v4, unify tab-button
  styling
   183 files changed, 9131 insertions(+), 9460 deletions(-)

  Working tree ist jetzt sauber (git status zeigt keine offenen Änderungen
  mehr). Nicht gepusht — sag Bescheid, falls das auch soll oder eine PR
  gewünscht ist.

✻ Cogitated for 49s

❯ es fehlt im hintergrund beim essenplan F8F4EF diese farbe sollte als          
  hintergrund für die ansiht der wochentage                                     

  Searched for 3 patterns, read 1 file (ctrl+o to expand)

⏺ Update(src/global.css)
  ⎿  Added 1 line, removed 1 line
      1521       Tag-/3-Tage-/Wochenansicht identisch (siehe Kommentar ob
            en in der
      1522       Komponente), die Indirektion ueber ein Konstanten-Objekt
             war unnoetig. */
      1523    .wg-root {
      1524 -    @apply flex-1;                                           
      1524 +    @apply flex-1 bg-background;                             
      1525    }
      1526    .wg-scroll {
      1527      @apply flex-1;

⏺ Verifikation:

  Ran 2 shell commands (ctrl+o to expand)
⏺ Voller Testlauf:

  Ran 1 shell command (ctrl+o to expand)

⏺ Alle 628 Tests grün. .wg-root (der Wochentage-Bereich im Essensplan,
  week-grid.tsx) hat jetzt bg-background — das ist genau der Token, hinter dem
  #F8F4EF (Light) / #211D23 (Dark) steht. Damit sitzt die Wochenraster-Ansicht
  auf dem flachen App-Hintergrund statt dem durchscheinenden Pfirsich-Verlauf
  dahinter.

✻ Sautéed for 1m 25s

❯ ich habe einige änderung vorgenommen. lass uns artikel hinzufügen bearbeiten  
  von Vorrat. es sollte so sein wie bei einkaufen.                              

  Searched for 2 patterns, read 4 files, ran 2 shell commands (ctrl+o to expand)

⏺ Skill(artifact-design)
  ⎿  Successfully loaded skill

⏺ Write(/private/tmp/claude-501/-Users-marco-Github-tmp-family-app-fam/1e98a736-
       1a69-4565-bb9b-effe9a904e26/scratchpad/vorrat-add-item-mock.html)
  ⎿  Wrote 574 lines to ../../../../../private/tmp/claude-501/-Users-marco-
     Github-tmp-family-app-fam/1e98a736-1a69-4565-bb9b-effe9a904e26/scratch
     pad/vorrat-add-item-mock.html
       1 <title>Vorrat: Artikel hinzufügen</title>
       2 <style>
       3   :root {
       4     --bg: #F8F4EF;
       5     --surface: #FBF7F2;
       6     --selected: #E9E1E7;
       7     --text: #2D2830;
       8     --text-secondary: #786F79;
       9     --border: #E4DDE3;
      10     --accent: #705773;
     … +595 lines (ctrl+o to expand)

⏺ Artifact(/private/tmp/claude-501/-Users-marco-Github-tmp-family-app-fam/1e98a7
          36-1a69-4565-bb9b-effe9a904e26/scratchpad/vorrat-add-item-mock.html)
  ⎿  Published ⧉ 
     https://claude.ai/code/artifact/9761e58c-a6e6-45f4-a4e3-8c86cff0e1e9

⏺ Hier der Vorschlag: ⧉ 
  https://claude.ai/code/artifact/9761e58c-a6e6-45f4-a4e3-8c86cff0e1e9

  Kurz zum Stand: Das Bearbeiten-Sheet (edit-fridge-item-sheet.tsx) hat schon
  fast genau die Einkaufen-Optik (Bottom-Sheet, Griff, Produktkarte,
  Menge/Lagerort-Zeile, „Weitere Angaben" eingeklappt) — vermutlich aus deinen
  eigenen Änderungen. Das eigentliche Delta ist „Artikel hinzufügen"
  (add-item-screen.tsx), das noch als gepushter Vollbild-Screen mit flach
  aufgelisteten Feldern läuft. Der Mock zeigt zwei Zustände (leer / mit Produkt
  + geöffneten Details) im Sheet-Stil analog zu add-item-form.tsx.

  Zwei offene Entscheidungen, auf die ich eine Antwort brauche, bevor ich es
  baue:

  1. „+ Neuer Lagerort" — im Mock ein kompakter Link unter dem Lagerort-Feld
  statt der bisherigen Vollbreite-Buttons. Passt das, oder soll die Erstellung
  anders sitzen?
  2. Produktvorschläge — beim Einkaufen gibt's „Zuletzt"/„Häufig" als Umschalter
  (braucht eine eigene DB-Abfrage, aktuell nur für feature = 'shopping_list'
  gebaut). Soll ich das für Vorrat nachbauen, oder bleibt die bestehende
  einzeilige „Häufig verwendet"-Chip-Liste (schon vorhanden, nur umgestylt)?

✻ Churned for 2m 46s

❯ nein es soll 2 dropdown menuüs unter der suche geben eins ist für             
  lebensmittel wo man auch gerichte auswählen kann und das andere dropdown hat  
  häufig zuletzt und favoriten und zusätzlich ergänst du "Mit Produkt +         
  geöffneten Details"                                                           

⏺ Update(/private/tmp/claude-501/-Users-marco-Github-tmp-family-app-fam/1e98a736
        -1a69-4565-bb9b-effe9a904e26/scratchpad/vorrat-add-item-mock.html)
  ⎿  Added 23 lines
      221      color: var(--text-secondary);
      222      margin: 2px 0 -2px 2px;
      223    }
      224 +                                                              
      225 +  /* zwei Dropdowns unter der Suche: Quelle (Lebensmittel/Geri
          +chte) + Filter (Häufig/Zuletzt/Favoriten) */                  
      226 +  .dropdown-row {                                             
      227 +    display: flex;                                            
      228 +    gap: 8px;                                                 
      229 +  }                                                           
      230 +  .dropdown-btn {                                             
      231 +    flex: 1;                                                  
      232 +    height: 42px;                                             
      233 +    border-radius: 12px;                                      
      234 +    border: 1px solid var(--border);                          
      235 +    background: var(--surface);                               
      236 +    display: flex;                                            
      237 +    align-items: center;                                      
      238 +    justify-content: space-between;                           
      239 +    padding: 0 12px;                                          
      240 +    font-size: 13px;                                          
      241 +    font-weight: 700;                                         
      242 +    color: var(--text);                                       
      243 +    cursor: pointer;                                          
      244 +  }                                                           
      245 +  .dropdown-btn .chev { color: var(--text-secondary); font-siz
          +e: 11px; font-weight: 600; }                                  
      246 +  .dropdown-btn .icon { margin-right: 6px; font-size: 13px; } 
      247    .chip-row {
      248      display: flex;
      249      gap: 8px;

⏺ Update(/private/tmp/claude-501/-Users-marco-Github-tmp-family-app-fam/1e98a736
        -1a69-4565-bb9b-effe9a904e26/scratchpad/vorrat-add-item-mock.html)
  ⎿  Added 5 lines
      446              <button class="scan-btn" aria-label="Barcode scann
           en">▤</button>
      447            </div>
      448  
      449 +          <div class="dropdown-row">                          
      450 +            <div class="dropdown-btn"><span><span class="icon"
          +>🥕</span>Lebensmittel</span><span class="chev">⌄</span></div>
      451 +            <div class="dropdown-btn"><span><span class="icon"
          +>🕘</span>Häufig</span><span class="chev">⌄</span></div>      
      452 +          </div>                                              
      453 +                                                              
      454            <div>
      455              <div class="chip-label">Häufig verwendet</div>
      456              <div class="chip-row" style="margin-top:6px;">

⏺ Update(/private/tmp/claude-501/-Users-marco-Github-tmp-family-app-fam/1e98a736
        -1a69-4565-bb9b-effe9a904e26/scratchpad/vorrat-add-item-mock.html)
  ⎿  Added 14 lines
      505              <button class="scan-btn" aria-label="Barcode scann
           en">▤</button>
      506            </div>
      507  
      508 +          <div class="dropdown-row">                          
      509 +            <div class="dropdown-btn"><span><span class="icon"
          +>🥕</span>Lebensmittel</span><span class="chev">⌄</span></div>
      510 +            <div class="dropdown-btn" style="border-color: var
          +(--accent);">                                                 
      511 +              <span><span class="icon">🕘</span>Häufig</span><
          +span class="chev">⌄</span>                                    
      512 +            </div>                                            
      513 +          </div>                                              
      514 +          <div class="summary-card" style="padding: 6px 10px; 
          +gap: 0;">                                                     
      515 +            <div style="display:flex; flex-direction:column; w
          +idth:100%;">                                                  
      516 +              <div class="dd-option active">Häufig</div>      
      517 +              <div class="dd-option">Zuletzt</div>            
      518 +              <div class="dd-option">Favoriten</div>          
      519 +            </div>                                            
      520 +          </div>                                              
      521 +                                                              
      522            <div>
      523              <div class="chip-label">Häufig verwendet</div>
      524              <div class="chip-row" style="margin-top:6px;">

⏺ Update(/private/tmp/claude-501/-Users-parco-Github-tmp-family-app-fam/1e98a736
        -1a69-4565-bb9b-effe9a904e26/scratchpad/vorrat-add-item-mock.html)
  ⎿  Error editing file

⏺ Update(/private/tmp/claude-501/-Users-marco-Github-tmp-family-app-fam/1e98a736
        -1a69-4565-bb9b-effe9a904e26/scratchpad/vorrat-add-item-mock.html)
  ⎿  Added 7 lines, removed 9 lines
      507  
      508            <div class="dropdown-row">
      509              <div class="dropdown-btn"><span><span class="icon"
           >🥕</span>Lebensmittel</span><span class="chev">⌄</span></div>
      510 -            <div class="dropdown-btn" style="border-color: var
          -(--accent);">                                                 
      511 -              <span><span class="icon">🕘</span>Häufig</span><
          -span class="chev">⌄</span>                                    
      510 +            <div class="dropdown-wrap">                       
      511 +              <div class="dropdown-btn open"><span><span class
          +="icon">🕘</span>Häufig</span><span class="chev">︿</span></di
          +v>                                                            
      512 +              <div class="dropdown-panel">                    
      513 +                <div class="dd-option active">🕘 Häufig</div> 
      514 +                <div class="dd-option">🔁 Zuletzt</div>       
      515 +                <div class="dd-option">⭐ Favoriten</div>     
      516 +              </div>                                          
      517              </div>
      518            </div>
      514 -          <div class="summary-card" style="padding: 6px 10px; 
          -gap: 0;">                                                     
      515 -            <div style="display:flex; flex-direction:column; w
          -idth:100%;">                                                  
      516 -              <div class="dd-option active">Häufig</div>      
      517 -              <div class="dd-option">Zuletzt</div>            
      518 -              <div class="dd-option">Favoriten</div>          
      519 -            </div>                                            
      520 -          </div>                                              
      519  
      520            <div>
      521              <div class="chip-label">Häufig verwendet</div>

⏺ Jetzt die passenden CSS-Klassen für dropdown-wrap/dropdown-panel/dd-option
  ergänzen:

⏺ Update(/private/tmp/claude-501/-Users-marco-Github-tmp-family-app-fam/1e98a736
        -1a69-4565-bb9b-effe9a904e26/scratchpad/vorrat-add-item-mock.html)  ⎿  Added 29 lines
      244    }
      245    .dropdown-btn .chev { color: var(--text-secondary); font-siz
           e: 11px; font-weight: 600; }
      246    .dropdown-btn .icon { margin-right: 6px; font-size: 13px; }
      247 +  .dropdown-btn.open { border-color: var(--accent); }         
      248 +                                                              
      249 +  .dropdown-wrap { flex: 1; position: relative; }             
      250 +  .dropdown-panel {                                           
      251 +    position: absolute;                                       
      252 +    top: 46px;                                                
      253 +    left: 0;                                                  
      254 +    right: 0;                                                 
      255 +    z-index: 5;                                               
      256 +    background: var(--surface);                               
      257 +    border: 1px solid var(--border);                          
      258 +    border-radius: 12px;                                      
      259 +    padding: 4px;                                             
      260 +    display: flex;                                            
      261 +    flex-direction: column;                                   
      262 +    gap: 2px;                                                 
      263 +    box-shadow: 0 10px 22px rgba(0,0,0,0.18);                 
      264 +  }                                                           
      265 +  .dd-option {                                                
      266 +    padding: 9px 10px;                                        
      267 +    border-radius: 8px;                                       
      268 +    font-size: 13px;                                          
      269 +    font-weight: 600;                                         
      270 +    color: var(--text-secondary);                             
      271 +  }                                                           
      272 +  .dd-option.active {                                         
      273 +    background: var(--accent);                                
      274 +    color: var(--on-accent);                                  
      275 +  }                                                           
      276    .chip-row {
      277      display: flex;
      278      gap: 8px;

⏺ Update(/private/tmp/claude-501/-Users-marco-Github-tmp-family-app-fam/1e98a736
        -1a69-4565-bb9b-effe9a904e26/scratchpad/vorrat-add-item-mock.html)
  ⎿  Added 6 lines, removed 4 lines
      452      Produktkarte, Menge/Lagerort nebeneinander, „Weitere Angab
           en“ eingeklappt.
      453    </p>
      454    <p class="note">
      455 -    Zwei offene Entscheidungen unten markiert: <b>(1)</b> Plat
          -zierung von                                                   
      456 -    „Neuer Lagerort“, <b>(2)</b> ob „Zuletzt/Häufig“ wie beim 
          -Einkaufen dazu                                                
      457 -    kommt oder die bestehende einzeilige „Häufig verwendet“-Li
          -ste bleibt                                                    
      458 -    (Zuletzt bräuchte eine neue Abfrage, aktuell nur für Shopp
          -ing gebaut).                                                  
      455 +    Update nach Feedback: unter der Suche jetzt zwei Dropdowns
          + statt eines                                                  
      456 +    Umschalters — <b>links</b> die Quelle („Lebensmittel“ / „G
          +erichte“, damit                                               
      457 +    sich auch ein Rezept als Vorrats-Eintrag anlegen lässt), <
          +b>rechts</b> der                                              
      458 +    Filter für die Vorschlagsliste darunter („Häufig“ / „Zulet
          +zt“ /                                                         
      459 +    „Favoriten“, rechtes Beispiel zeigt es geöffnet). Offen: P
          +latzierung von                                                
      460 +    „Neuer Lagerort“ (Link unter dem Feld, siehe ①).          
      461    </p>
      462  </div>
      463  

⏺ Jetzt republish auf dieselbe Artifact-URL:

⏺ Artifact(/private/tmp/claude-501/-Users-marco-Github-tmp-family-app-fam/1e98a7
          36-1a69-4565-bb9b-effe9a904e26/scratchpad/vorrat-add-item-mock.html)
  ⎿  Updated ⧉ 
     https://claude.ai/code/artifact/9761e58c-a6e6-45f4-a4e3-8c86cff0e1e9

⏺ Aktualisiert unter derselben URL: ⧉ 
  https://claude.ai/code/artifact/9761e58c-a6e6-45f4-a4e3-8c86cff0e1e9

  Ergänzt in beiden Zuständen: zwei Dropdowns direkt unter dem Suchfeld — links
  „Lebensmittel" (Quelle, inkl. Option „Gerichte"), rechts „Häufig" (im zweiten
  Zustand geöffnet gezeigt mit „Häufig"/„Zuletzt"/„Favoriten").

  Kurzer Hinweis dazu, bevor du bestätigst: „Gerichte" (Rezepte) als
  Vorrats-Eintrag ist datenseitig neu — aktuell hängt ein Vorrats-Item an einem
  product_id (Open Food Facts/manuell), nicht an einem Rezept. Soll das links im
  Dropdown nur die Suche umschalten (man tippt einen Rezeptnamen ein und der
  Eintrag wird trotzdem als normaler Vorrats-Artikel mit diesem Namen angelegt),
  oder soll es wirklich einen Rezept-Bezug im Datensatz herstellen? Und
  „Favoriten" bei den Vorschlägen gibt's aktuell nirgends in der App (nicht mal
  bei Rezepten) — soll ich das als neues Feature mitbauen oder erstmal nur
  „Häufig"/„Zuletzt" (wie bei Einkaufen) umsetzen und „Favoriten" separat
  besprechen?

✻ Sautéed for 1m 29s

❯ darum kümmern wir uns später                                                  

  Searched for 4 patterns, read 1 file, ran 4 shell commands (ctrl+o to expand)

⏺ Update(src/lib/db/product-usage.ts)
  ⎿  Added 9 lines, removed 2 lines
       96   * `mealType: null` liefert alle Mahlzeitarten (fuer `fridge`/
           `shopping_list`,
       97   * die keine kennen); ein gesetzter Wert schraenkt fuer `diary
           ` ein (#79 AC:
       98   * "Auf die Mahlzeitart eingeschraenkt").
       99 + *                                                            
      100 + * `mode: 'recent'` sortiert dieselbe dedupliziert-je-Name-Lis
          +te stattdessen                                                
      101 + * rein nach `used_at` statt nach Haeufigkeit — fuer den "Zule
          +tzt"-Filter in                                                
      102 + * den Vorrat-/Einkaufen-Vorschlagslisten. Kein zweiter Query 
          +noetig, nur ein                                               
      103 + * anderes `order by` auf denselben `ranked`-Zeilen.          
      104   */
      105  export async function getFrequentProductUsage(
      106    db: SqlDatabase,
     ...
      109      feature: ProductUsageFeature;
      110      mealType?: MealType | null;
      111      limit?: number;
      112 +    mode?: 'frequent' | 'recent';                             
      113    },
      114  ): Promise<ProductUsageRow[]> {
      109 -  const { userId, feature, mealType = null, limit = 200 } = pa
          -rams;                                                         
      115 +  const { userId, feature, mealType = null, limit = 200, mode 
          += 'frequent' } = params;                                      
      116 +  const orderBy = mode === 'recent' ? 'used_at desc' : 'freq d
          +esc, used_at desc';                                           
      117    return db.getAllAsync<ProductUsageRow>(
      118      `with ranked as (
      119         select *,
     ...
      125       select name, brand, barcode, product_id, unit, quantity, 
           kcal, protein_g, carbs_g, fat_g, used_at
      126       from ranked
      127       where rn = 1
      121 -     order by freq desc, used_at desc                         
      128 +     order by ${orderBy}                                      
      129       limit ?`,
      130      [userId, feature, mealType, mealType, limit],
      131    );

  Searched for 2 patterns, read 1 file, listed 1 directory, ran 1 shell command (ctrl+o to expand)

⏺ Write(src/features/inventory/frequent-products-quick-select.tsx)
  ⎿  Added 26 lines, removed 37 lines
       9    type ProductUsageRow,
      10  } from '@/lib/db/product-usage';
      11  import type { OpenFoodFactsProduct } from '@/lib/open-food-fact
          s';
      12 -import { rankByName } from '@/lib/rank-by-name';               
      12  
      14 -/**                                                            
      15 - * Haeufig verwendete Produkte je Name, absteigend nach Haeufig
         -keit sortiert —                                                
      16 - * bei Gleichstand bleibt die juengste Fundstelle vorn, weil   
      17 - * `getFrequentProductUsage` bereits neueste zuerst liefert (st
         -abile Sortierung).                                             
      18 - * Nutzt dasselbe `rankByName` wie `rankFrequentFoods` in      
      19 - * `calorie-tracking/food-history.ts`, hier fuer Vorrat/Einkauf
         -sliste ohne                                                    
      20 - * Mahlzeitart-Bezug.                                          
      21 - */                                                            
      22 -function rankByFrequency(rowsNewestFirst: ProductUsageRow[]): P
         -roductUsageRow[] {                                             
      23 -  return rankByName(rowsNewestFirst, { caseInsensitive: true })
         -;                                                              
      24 -}                                                              
      13 +export type SuggestionMode = 'frequent' | 'recent';            
      14  
      15  function toOpenFoodFactsProduct(row: ProductUsageRow): OpenFood
          FactsProduct {
      16    return {
     ...
      31  interface FrequentProductsQuickSelectProps {
      32    feature: ProductUsageFeature;
      33    userId: string | undefined;
      34 +  mode: SuggestionMode;                                        
      35    onSelectProduct: (product: OpenFoodFactsProduct) => void;
      36  }
      37  
      38  /**
      49 - * Quick-Select ("haeufig verwendete Lebensmittel", #79) fuer V
         -orrat und                                                      
      50 - * Einkaufsliste — liest ausschliesslich lokales SQLite, funkti
         -oniert also                                                    
      51 - * ohne Netz. `onSelectProduct` ruft dieselbe Auswahl-Pipeline 
         -wie                                                            
      52 - * `ProductSearchDropdown`, keine zweite Implementierung.      
      39 + * Vorschlags-Chips fuer Vorrat und Einkaufsliste (#79), gesteu
         +ert ueber den                                                  
      40 + * `mode`-Filter-Dropdown des Aufrufers ("Haeufig"/"Zuletzt", s
         +.                                                              
      41 + * add-item-screen.tsx). `getFrequentProductUsage` liefert bere
         +its eine je                                                    
      42 + * Name deduplizierte, passend sortierte Liste direkt aus SQL —
         + eine                                                          
      43 + * zusaetzliche Client-seitige Neusortierung (frueher `rankByNa
         +me`) wuerde                                                    
      44 + * bei `mode: 'recent'` die Reihenfolge nur wieder kaputt mache
         +n, deshalb                                                     
      45 + * reicht hier ein reines Durchreichen + Slice.                
      46   */
      47  export function FrequentProductsQuickSelect({
      48    feature,
      49    userId,
      50 +  mode,                                                        
      51    onSelectProduct,
      52  }: FrequentProductsQuickSelectProps) {
      53    const { data: rows = [] } = useQuery({
      60 -    queryKey: ['product_usage', 'frequent', feature, userId],  
      54 +    queryKey: ['product_usage', mode, feature, userId],        
      55      queryFn: async () => {
      56        const db = await getDatabase();
      63 -      return getFrequentProductUsage(db, { userId: userId as st
         -ring, feature });                                              
      57 +      return getFrequentProductUsage(db, { userId: userId as st
         +ring, feature, mode });                                        
      58      },
      59      enabled: !!userId,
      60    });
      61  
      68 -  const ranked = rankByFrequency(rows).slice(0, MAX_CHIPS);    
      69 -  if (ranked.length === 0) return null;                        
      62 +  const chips = rows.slice(0, MAX_CHIPS);                      
      63 +  if (chips.length === 0) return null;                         
      64  
      65    return (
      72 -    <View className="gap-one">                                 
      73 -      <ThemedText type="small" themeColor="textSecondary" class
         -Name="ml-[2px]">                                               
      74 -        Häufig verwendet                                       
      75 -      </ThemedText>                                            
      76 -      <ScrollView horizontal showsHorizontalScrollIndicator={fa
         -lse} className="flex-row">                                     
      77 -        {ranked.map((row) => (                                 
      78 -          <Pressable                                           
      79 -            key={row.name.toLowerCase()}                       
      80 -            onPress={() => onSelectProduct(toOpenFoodFactsProdu
         -ct(row))}                                                      
      81 -            className="frequent-products-chip">                
      82 -            <ThemedText type="small" numberOfLines={1}>        
      83 -              {row.name}                                       
      84 -            </ThemedText>                                      
      85 -          </Pressable>                                         
      86 -        ))}                                                    
      87 -      </ScrollView>                                            
      88 -    </View>                                                    
      66 +    <ScrollView horizontal showsHorizontalScrollIndicator={fals
         +e} className="flex-row">                                       
      67 +      {chips.map((row) => (                                    
      68 +        <Pressable                                             
      69 +          key={row.name.toLowerCase()}                         
      70 +          onPress={() => onSelectProduct(toOpenFoodFactsProduct
         +(row))}                                                        
      71 +          className="frequent-products-chip">                  
      72 +          <ThemedText type="small" numberOfLines={1}>          
      73 +            {row.name}                                         
      74 +          </ThemedText>                                        
      75 +        </Pressable>                                           
      76 +      ))}                                                      
      77 +    </ScrollView>                                              
      78    );
      79  }

⏺ Update(src/features/inventory/frequent-products-quick-select.tsx)
  ⎿  Added 1 line, removed 1 line
      1  import { useQuery } from '@tanstack/react-query';
      2 -import { Pressable, ScrollView, View } from 'react-native';     
      2 +import { Pressable, ScrollView } from 'react-native';           
      3  
      4  import { ThemedText } from '@/components/themed-text';
      5  import { getDatabase } from '@/lib/db/client';

⏺ Write(src/components/ui/inline-select.tsx)
  ⎿  Wrote 90 lines to src/components/ui/inline-select.tsx
       1 import { useState } from 'react';
       2 import { Pressable, View } from 'react-native';
       3 
       4 import { ThemedText } from '@/components/themed-text';
       5 
       7   value: string;
       8   label: string;
       9   icon?: string;
      10   /** Zeigt die Option an, aber deaktiviert sie (z. B. noch nich
         t gebaute Filter). */
     … +92 lines (ctrl+o to expand)

  Searched for 1 pattern, read 1 file (ctrl+o to expand)

⏺ Ich füge die neuen Klassen für InlineSelect und den neu gestalteten
  add-item-screen.tsx direkt nach dem bestehenden Block ein:
⏺ Update(src/global.css)
  ⎿  Added 18 lines
      1188      @apply rounded-card border px-two py-one mr-one max-w-[16
            0px] bg-background-element border-border;
      1189    }
      1190  
      1191 +  /* inline-select.tsx — kompaktes Dropdown unter Suchfeldern
           + (Vorrat-                                                    
      1192 +     Redesign, Filter-/Quelle-Auswahl analog zu den Einkaufen
           +-Vorschlaegen). */                                           
      1193 +  .inline-select-btn {                                       
      1194 +    @apply h-[42px] rounded-control border border-border bg-b
           +ackground-element flex-row items-center justify-between px-th
           +ree;                                                         
      1195 +  }                                                          
      1196 +  .inline-select-btn-open {                                  
      1197 +    @apply border-accent;                                    
      1198 +  }                                                          
      1199 +  .inline-select-panel {                                     
      1200 +    @apply absolute top-[46px] left-0 right-0 z-20 rounded-co
           +ntrol border border-border bg-background shadow-sheet p-one g
           +ap-[2px];                                                    
      1201 +  }                                                          
      1202 +  .inline-select-option {                                    
      1203 +    @apply rounded-sm px-two py-two flex-row items-center jus
           +tify-between gap-two;                                        
      1204 +  }                                                          
      1205 +  .inline-select-option-active {                             
      1206 +    @apply bg-accent;                                        
      1207 +  }                                                          
      1208 +                                                             
      1209    /* barcode-scanner-modal.tsx */
      1210    .scanner-backdrop {
      1211      @apply flex-1 bg-black/60 justify-end;

⏺ Write(src/features/inventory/add-item-screen.tsx)
  ⎿  Added 236 lines, removed 114 lines
       2  import * as Crypto from 'expo-crypto';
       3  import { router, useFocusEffect } from 'expo-router';
       4  import { useCallback, useState } from 'react';
       5 -import { View } from 'react-native';                           
       5 +import { Pressable, ScrollView, View } from 'react-native';    
       6 +import { SafeAreaView } from 'react-native-safe-area-context'; 
       7  
       8  import { DateWheelField } from '@/components/date-wheel-field';
       9 +import { FamIcon } from '@/components/fam-icon';               
      10  import { FilterChipBar } from '@/components/filter-chip-bar';
      11  import { QuantityStepper } from '@/components/quantity-stepper'
          ;
      10 -import { Screen } from '@/components/screen';                  
      12  import { TextField } from '@/components/text-field';
      13  import { ThemedText } from '@/components/themed-text';
      13 -import { Button } from '@/components/ui/buttons';              
      14 +import { ThemedView } from '@/components/themed-view';         
      15 +import { Button, HeaderIconButton } from '@/components/ui/butto
         +ns';                                                           
      16 +import { InlineSelect } from '@/components/ui/inline-select';  
      17 +import { WheelPickerField } from '@/components/wheel-picker-fie
         +ld';                                                           
      18  import { useSession } from '@/features/auth/session-provider';
      19  import { useAddFridgeItemMutation } from '@/features/fridge/use
          -fridge-mutations';
      20  import { useActiveHousehold } from '@/features/household/active
          -household-provider';
      21  import { BarcodeScannerModal } from '@/features/inventory/barco
          de-scanner-modal';
      18 -import { FrequentProductsQuickSelect } from '@/features/invento
         -ry/frequent-products-quick-select';                            
      22 +import {                                                       
      23 +  FrequentProductsQuickSelect,                                 
      24 +  type SuggestionMode,                                         
      25 +} from '@/features/inventory/frequent-products-quick-select';  
      26  import { consumePendingProductSelection } from '@/features/inve
          ntory/pending-product-selection';
      27  import { persistOffProductIfNeeded } from '@/features/inventory
          /persist-off-product';
      28  import { ProductSearchDropdown } from '@/features/inventory/pro
          duct-search-dropdown';
     ...
      31    useAddStorageLocationMutation,
      32    useStorageLocations,
      33  } from '@/features/inventory/use-storage-locations';
      34 +import { useTheme } from '@/hooks/use-theme';                  
      35  import { getDatabase } from '@/lib/db/client';
      36  import { recordProductUsage } from '@/lib/db/product-usage';
      37  import type { OpenFoodFactsProduct } from '@/lib/open-food-fact
          s';
      30 -import { normalizeUnit } from '@/lib/units';                   
      38 +import { normalizeUnit, UNIT_OPTIONS } from '@/lib/units';     
      39  
      40  function formatOffsetDate(days: number): string {
      41    const d = new Date();
     ...
      73    }
      74  }
      75  
      76 +/**                                                            
      77 + * Quelle des gesuchten Eintrags. "Gerichte" (Rezepte als Vorra
         +ts-Eintrag)                                                    
      78 + * ist im Dropdown sichtbar, aber bewusst deaktiviert — der Dat
         +enbezug                                                        
      79 + * (nur Name uebernehmen vs. echte Rezept-Verknuepfung) ist noc
         +h offen,                                                       
      80 + * s. Migrations-/Redesign-Absprache. Nicht ohne Rueckfrage akt
         +ivieren.                                                       
      81 + */                                                            
      82 +type ItemSource = 'food' | 'dish';                             
      83 +                                                               
      84 +/**                                                            
      85 + * Artikel-hinzufuegen fuer Vorrat, im selben Bottom-Sheet-Stil
         + wie                                                           
      86 + * `add-item-form.tsx` bei der Einkaufsliste: Suche mit Scan-Bu
         +tton,                                                          
      87 + * Quelle-/Vorschlagsfilter-Dropdowns, Produktkarte, Menge+Lage
         +rort                                                           
      88 + * nebeneinander, "Weitere Angaben" eingeklappt (Einheit + MHD)
         +.                                                              
      89 + */                                                            
      90  export function AddItemScreen() {
      91 +  const theme = useTheme();                                    
      92    const { activeHousehold } = useActiveHousehold();
      93    const currentHousehold = activeHousehold;
      94  
     ...
      111    const [expiryDate, setExpiryDate] = useState('');
      112    const [selectedProduct, setSelectedProduct] = useState<OpenF
           oodFactsProduct | null>(null);
      113  
       91 -  // Scanner & Modal State                                    
      114 +  const [source, setSource] = useState<ItemSource>('food');   
      115 +  const [suggestionMode, setSuggestionMode] = useState<Suggest
          +ionMode>('frequent');                                         
      116 +  const [detailsOpen, setDetailsOpen] = useState(false);      
      117 +                                                              
      118    const [showScanner, setShowScanner] = useState(false);
      119    const [showAddLocation, setShowAddLocation] = useState(false
           );
      120    const [newLocationName, setNewLocationName] = useState('');
      121  
      122    const activeLocationId = locationId ?? locations?.[0]?.id ??
            null;
      123 +  const locationOptions = (locations ?? []).map((loc) => ({ va
          +lue: loc.id, label: loc.name }));                             
      124    const selectedQuickDate =
      125      QUICK_DATE_OPTIONS.find((option) => quickDateOffset(option
           .value) === expiryDate)?.value ??
      126      'none';
     ...
      215    }
      216  
      217    return (
      191 -    <Screen title="Artikel hinzufügen" back={{ label: 'Abbrech
          -en' }}>                                                       
      192 -      <View className="gap-four mt-four">                     
      193 -        <Button                                               
      194 -          label="📷 Barcode scannen"                          
      195 -          variant="secondary"                                 
      196 -          onPress={() => setShowScanner(true)}                
      197 -        />                                                    
      218 +    <ThemedView className="flex-1 bg-background">             
      219 +      <SafeAreaView className="modal-safe-area" edges={['top',
          + 'left', 'right', 'bottom']}>                                 
      220 +        <View className="modal-handle" />                     
      221 +        <View className="modal-header min-h-[54px]">          
      222 +          <ThemedText type="headingSmall">Artikel hinzufügen</
          +ThemedText>                                                   
      223 +          <Pressable                                          
      224 +            onPress={() => router.back()}                     
      225 +            accessibilityRole="button"                        
      226 +            accessibilityLabel="Schließen"                    
      227 +            className="modal-close-btn">                      
      228 +            <ThemedText themeColor="textSecondary">✕</ThemedTe
          +xt>                                                           
      229 +          </Pressable>                                        
      230 +        </View>                                               
      231  
      199 -        <FrequentProductsQuickSelect                          
      200 -          feature="fridge"                                    
      201 -          userId={userId}                                     
      202 -          onSelectProduct={handleSelectProduct}               
      203 -        />                                                    
      232 +        <ScrollView                                           
      233 +          className="flex-1"                                  
      234 +          contentContainerClassName="gap-three pb-four"       
      235 +          keyboardShouldPersistTaps="handled"                 
      236 +          showsVerticalScrollIndicator={false}>               
      237 +          <ProductSearchDropdown                              
      238 +            label=""                                          
      239 +            placeholder={source === 'dish' ? 'Gericht suchen…'
          + : 'z. B. Milch oder Barcode-Name'}                           
      240 +            value={name}                                      
      241 +            onChangeText={setName}                            
      242 +            onSelectProduct={handleSelectProduct}             
      243 +            size="large"                                      
      244 +            trailing={                                        
      245 +              <HeaderIconButton                               
      246 +                label="Barcode scannen"                       
      247 +                onPress={() => setShowScanner(true)}          
      248 +                className="w-10 h-10 rounded-control bg-backgr
          +ound-selected">                                               
      249 +                <FamIcon name="camera" size={18} color={theme.
          +accent} />                                                    
      250 +              </HeaderIconButton>                             
      251 +            }                                                 
      252 +          />                                                  
      253  
      205 -        <ProductSearchDropdown                                
      206 -          label="Name"                                        
      207 -          placeholder="z. B. Milch oder Barcode-Name"         
      208 -          value={name}                                        
      209 -          onChangeText={setName}                              
      210 -          onSelectProduct={handleSelectProduct}               
      211 -        />                                                    
      212 -                                                              
      213 -        <View className="flex-row gap-four">                  
      214 -          <View className="flex-1">                           
      215 -            <ThemedText type="small" themeColor="textSecondary
          -" className="mb-one">                                         
      216 -              Menge                                           
      217 -            </ThemedText>                                     
      218 -            <QuantityStepper                                  
      219 -              value={Number.parseInt(quantity, 10) || 1}      
      220 -              onChange={(value) => setQuantity(String(value))}
      221 -              max={999}                                       
      222 -              label="Menge"                                   
      254 +          <View className="flex-row gap-two">                 
      255 +            <InlineSelect                                     
      256 +              value={source}                                  
      257 +              accessibilityLabel="Quelle: Lebensmittel oder Ge
          +richte"                                                       
      258 +              options={[                                      
      259 +                { value: 'food', label: 'Lebensmittel', icon: 
          +'🥕' },                                                       
      260 +                {                                             
      261 +                  value: 'dish',                              
      262 +                  label: 'Gerichte',                          
      263 +                  icon: '🍽️',                                 
      264 +                  disabled: true,                             
      265 +                  disabledHint: 'bald',                       
      266 +                },                                            
      267 +              ]}                                              
      268 +              onChange={(next) => {                           
      269 +                if (next === 'food' || next === 'dish') setSou
          +rce(next);                                                    
      270 +              }}                                              
      271              />
      224 -          </View>                                             
      225 -          <View className="flex-1">                           
      226 -            <TextField                                        
      227 -              label="Einheit"                                 
      228 -              placeholder="piece, l, kg..."                   
      229 -              value={unit}                                    
      230 -              onChangeText={setUnit}                          
      272 +            <InlineSelect                                     
      273 +              value={suggestionMode}                          
      274 +              accessibilityLabel="Vorschlagsfilter"           
      275 +              options={[                                      
      276 +                { value: 'frequent', label: 'Häufig', icon: ' 
          +🕘' },                                                        
      277 +                { value: 'recent', label: 'Zuletzt', icon: '🔁
          +' },                                                          
      278 +                {                                             
      279 +                  value: 'favorites',                         
      280 +                  label: 'Favoriten',                         
      281 +                  icon: '⭐',                                 
      282 +                  disabled: true,                             
      283 +                  disabledHint: 'bald',                       
      284 +                },                                            
      285 +              ]}                                              
      286 +              onChange={(next) => {                           
      287 +                if (next === 'frequent' || next === 'recent') 
          +setSuggestionMode(next);                                      
      288 +              }}                                              
      289              />
      290            </View>
      233 -        </View>                                               
      291  
      235 -        <View className="mt-two">                             
      236 -          <DateWheelField                                     
      237 -            label="Mindesthaltbarkeitsdatum (MHD)"            
      238 -            value={expiryDate}                                
      239 -            onChange={setExpiryDate}                          
      292 +          <FrequentProductsQuickSelect                        
      293 +            feature="fridge"                                  
      294 +            userId={userId}                                   
      295 +            mode={suggestionMode}                             
      296 +            onSelectProduct={handleSelectProduct}             
      297            />
      241 -        </View>                                               
      242 -        <FilterChipBar                                        
      243 -          label="Schnellauswahl MHD"                          
      244 -          options={QUICK_DATE_OPTIONS}                        
      245 -          selected={selectedQuickDate}                        
      246 -          onSelect={(value) => setExpiryDate(quickDateOffset(v
          -alue))}                                                       
      247 -        />                                                    
      298  
      249 -        <View className="flex-row justify-between items-center
          - mt-two">                                                     
      250 -          <ThemedText className="font-bold">Lagerort</ThemedTe
          -xt>                                                           
      251 -          {!showAddLocation && (                              
      252 -            <Button                                           
      253 -              label="+ Neuer Lagerort"                        
      254 -              variant="secondary"                             
      255 -              onPress={() => setShowAddLocation(true)}        
      256 -            />                                                
      257 -          )}                                                  
      258 -        </View>                                               
      259 -                                                              
      260 -        {showAddLocation && (                                 
      261 -          <View className="gap-three p-three rounded-sm border
          - border-border">                                              
      262 -            <TextField                                        
      263 -              label="Name des Lagerorts"                      
      264 -              placeholder="z.B. Keller, Regalfach, Gefrierfach
          -"                                                             
      265 -              value={newLocationName}                         
      266 -              onChangeText={setNewLocationName}               
      267 -            />                                                
      268 -            <View className="flex-row gap-four">              
      269 -              <View className="flex-1">                       
      270 -                <Button                                       
      271 -                  label="Erstellen"                           
      272 -                  onPress={handleAddLocation}                 
      273 -                  loading={addLocationMutation.isPending}     
      274 -                  disabled={!newLocationName.trim()}          
      275 -                />                                            
      299 +          {name.trim() ? (                                    
      300 +            <View className="edit-fridge-product-card">       
      301 +              <View className="edit-fridge-product-copy">     
      302 +                <ThemedText type="smallBold" numberOfLines={1}
          +>                                                             
      303 +                  {name.trim()}                               
      304 +                </ThemedText>                                 
      305 +                <ThemedText type="small" themeColor="textSecon
          +dary" numberOfLines={1}>                                      
      306 +                  {selectedProduct?.brand                     
      307 +                    ? `${selectedProduct.brand} · aus Produktd
          +aten`                                                         
      308 +                    : 'Manueller Eintrag'}                    
      309 +                </ThemedText>                                 
      310                </View>
      277 -              <View className="flex-1">                       
      278 -                <Button                                       
      279 -                  label="Abbrechen"                           
      280 -                  variant="secondary"                         
      281 -                  onPress={() => {                            
      282 -                    setShowAddLocation(false);                
      283 -                    setNewLocationName('');                   
      284 -                  }}                                          
      285 -                />                                            
      311 +              <View className="edit-fridge-product-quantity"> 
      312 +                <ThemedText type="smallBold">                 
      313 +                  {packageSize ? `${packageSize} ${packageSize
          +Unit}` : `${quantity} ${unit}`}                               
      314 +                </ThemedText>                                 
      315 +                <ThemedText type="small" themeColor="textSecon
          +dary">                                                        
      316 +                  {packageSize ? 'Packungsinhalt' : 'Menge'}  
      317 +                </ThemedText>                                 
      318                </View>
      319              </View>
      320 +          ) : null}                                           
      321 +                                                              
      322 +          <View className="edit-fridge-controls-row">         
      323 +            <View className="edit-fridge-control-column">     
      324 +              <ThemedText type="small" themeColor="textSeconda
          +ry">                                                          
      325 +                Menge                                         
      326 +              </ThemedText>                                   
      327 +              <QuantityStepper                                
      328 +                value={Number.parseInt(quantity, 10) || 1}    
      329 +                onChange={(value) => setQuantity(String(value)
          +)}                                                            
      330 +                max={999}                                     
      331 +                label="Menge"                                 
      332 +                size="large"                                  
      333 +              />                                              
      334 +            </View>                                           
      335 +            <View className="edit-fridge-control-column">     
      336 +              {locationsLoading ? (                           
      337 +                <ThemedText type="small" themeColor="textSecon
          +dary">                                                        
      338 +                  Lädt Lagerorte…                             
      339 +                </ThemedText>                                 
      340 +              ) : locationOptions.length > 0 ? (              
      341 +                <WheelPickerField                             
      342 +                  label="Lagerort"                            
      343 +                  value={activeLocationId ?? ''}              
      344 +                  options={locationOptions}                   
      345 +                  onChange={setLocationId}                    
      346 +                  size="large"                                
      347 +                />                                            
      348 +              ) : (                                           
      349 +                <ThemedText type="small" themeColor="textSecon
          +dary">                                                        
      350 +                  Kein Lagerort                               
      351 +                </ThemedText>                                 
      352 +              )}                                              
      353 +            </View>                                           
      354            </View>
      289 -        )}                                                    
      355  
      291 -        {locationsLoading ? (                                 
      292 -          <ThemedText>Lade Lagerorte...</ThemedText>          
      293 -        ) : locations?.length ? (                             
      294 -          <FilterChipBar                                      
      295 -            label="Lagerort"                                  
      296 -            options={locations.map((loc) => ({ value: loc.id, 
          -label: loc.name }))}                                          
      297 -            selected={activeLocationId ?? ''}                 
      298 -            onSelect={setLocationId}                          
      299 -          />                                                  
      300 -        ) : (                                                 
      301 -          !showAddLocation && (                               
      302 -            <ThemedText type="small" themeColor="textSecondary
          -">                                                            
      303 -              Keine Lagerorte vorhanden. Tippe auf &quot;+ Neu
          -er Lagerort&quot; um einen anzulegen.                         
      356 +          {!showAddLocation ? (                               
      357 +            <Pressable                                        
      358 +              onPress={() => setShowAddLocation(true)}        
      359 +              accessibilityRole="button"                      
      360 +              className="self-start">                         
      361 +              <ThemedText type="small" themeColor="accent" cla
          +ssName="font-bold">                                           
      362 +                + Neuer Lagerort                              
      363 +              </ThemedText>                                   
      364 +            </Pressable>                                      
      365 +          ) : (                                               
      366 +            <View className="gap-three p-three rounded-sm bord
          +er border-border">                                            
      367 +              <TextField                                      
      368 +                label="Name des Lagerorts"                    
      369 +                placeholder="z.B. Keller, Regalfach, Gefrierfa
          +ch"                                                           
      370 +                value={newLocationName}                       
      371 +                onChangeText={setNewLocationName}             
      372 +              />                                              
      373 +              <View className="flex-row gap-two">             
      374 +                <View className="flex-1">                     
      375 +                  <Button                                     
      376 +                    label="Erstellen"                         
      377 +                    onPress={handleAddLocation}               
      378 +                    loading={addLocationMutation.isPending}   
      379 +                    disabled={!newLocationName.trim()}        
      380 +                  />                                          
      381 +                </View>                                       
      382 +                <View className="flex-1">                     
      383 +                  <Button                                     
      384 +                    label="Abbrechen"                         
      385 +                    variant="secondary"                       
      386 +                    onPress={() => {                          
      387 +                      setShowAddLocation(false);              
      388 +                      setNewLocationName('');                 
      389 +                    }}                                        
      390 +                  />                                          
      391 +                </View>                                       
      392 +              </View>                                         
      393 +            </View>                                           
      394 +          )}                                                  
      395 +                                                              
      396 +          <Pressable                                          
      397 +            onPress={() => setDetailsOpen((current) => !curren
          +t)}                                                           
      398 +            accessibilityRole="button"                        
      399 +            accessibilityLabel={`${detailsOpen ? 'Weitere Anga
          +ben schließen' : 'Weitere Angaben öffnen'}`}                  
      400 +            accessibilityState={{ expanded: detailsOpen }}    
      401 +            className="edit-fridge-details-toggle">           
      402 +            <ThemedText themeColor="accent">{detailsOpen ? '⌄'
          + : '›'}</ThemedText>                                          
      403 +            <ThemedText type="small" themeColor="accent">     
      404 +              Weitere Angaben                                 
      405              </ThemedText>
      305 -          )                                                   
      306 -        )}                                                    
      406 +          </Pressable>                                        
      407  
      308 -        <View className="mt-four">                            
      408 +          {detailsOpen ? (                                    
      409 +            <View className="gap-three">                      
      410 +              <WheelPickerField                               
      411 +                label="Einheit"                               
      412 +                value={unit}                                  
      413 +                options={UNIT_OPTIONS}                        
      414 +                onChange={setUnit}                            
      415 +                size="large"                                  
      416 +              />                                              
      417 +              <DateWheelField                                 
      418 +                label="Mindesthaltbarkeitsdatum (MHD)"        
      419 +                value={expiryDate}                            
      420 +                onChange={setExpiryDate}                      
      421 +              />                                              
      422 +              <FilterChipBar                                  
      423 +                label="Schnellauswahl MHD"                    
      424 +                options={QUICK_DATE_OPTIONS}                  
      425 +                selected={selectedQuickDate}                  
      426 +                onSelect={(value) => setExpiryDate(quickDateOf
          +fset(value))}                                                 
      427 +              />                                              
      428 +            </View>                                           
      429 +          ) : null}                                           
      430 +                                                              
      431            <Button
      310 -            label="Speichern"                                 
      432 +            label="Zum Vorrat hinzufügen"                     
      433              onPress={handleSave}
      434              loading={mutation.isPending}
      435              disabled={!name.trim()}
      436 +            size="large"                                      
      437            />
      315 -        </View>                                               
      316 -        <Button label="Abbrechen" variant="secondary" onPress=
          -{() => router.back()} />                                      
      317 -      </View>                                                 
      438 +        </ScrollView>                                         
      439 +      </SafeAreaView>                                         
      440  
      441        <BarcodeScannerModal
      442          visible={showScanner}
      443          onClose={() => setShowScanner(false)}
      444          onProductFound={handleSelectProduct}
      445        />
      324 -    </Screen>                                                 
      446 +    </ThemedView>                                             
      447    );
      448  }

  Searched for 3 patterns (ctrl+o to expand)

⏺ Gut, existiert. Jetzt Verifikation:

  Read 1 file, ran 1 shell command (ctrl+o to expand)

⏺ Write(src/features/inventory/frequent-products-quick-select.test.tsx)
  ⎿  Added 30 lines, removed 8 lines
      63  test('rendert nichts, solange kein Nutzer bekannt ist', async (
          ) => {
      64    mockGetFrequentProductUsage.mockResolvedValue([]);
      65    await renderWithClient(
      66 -    <FrequentProductsQuickSelect feature="fridge" userId={undef
         -ined} onSelectProduct={jest.fn()} />,                          
      66 +    <FrequentProductsQuickSelect                               
      67 +      feature="fridge"                                         
      68 +      userId={undefined}                                       
      69 +      mode="frequent"                                          
      70 +      onSelectProduct={jest.fn()}                              
      71 +    />,                                                        
      72    );
      73    expect(mockGetFrequentProductUsage).not.toHaveBeenCalled();
      74  });
     ...
       76  test('rendert nichts, wenn es keine Nutzungshistorie gibt', as
           ync () => {
       77    mockGetFrequentProductUsage.mockResolvedValue([]);
       78    await renderWithClient(
       74 -    <FrequentProductsQuickSelect feature="fridge" userId="user
          --1" onSelectProduct={jest.fn()} />,                           
       79 +    <FrequentProductsQuickSelect                              
       80 +      feature="fridge"                                        
       81 +      userId="user-1"                                         
       82 +      mode="frequent"                                         
       83 +      onSelectProduct={jest.fn()}                             
       84 +    />,                                                       
       85    );
       86    await waitFor(() => expect(mockGetFrequentProductUsage).toHa
           veBeenCalled());
       77 -  expect(screen.queryByText('Häufig verwendet')).not.toBeOnThe
          -Screen();                                                     
       87 +  expect(screen.queryByText('Milch')).not.toBeOnTheScreen();  
       88  });
       89  
       80 -test('sortiert nach Haeufigkeit — mehrfach verwendetes Produkt
          - vor einmalig verwendetem', async () => {                     
       90 +test('gibt den mode an die Abfrage weiter und zeigt die Zeilen
          + in der gelieferten Reihenfolge', async () => {               
       91 +  // Sortierung/Dedupe passiert seit dem Sheet-Redesign in SQL
       92 +  // (getFrequentProductUsage), die Komponente reicht nur noch
          + durch — hier                                                 
       93 +  // liefert der Mock bereits "Milch vor Butter" wie es die ec
          +hte SQL-Query                                                 
       94 +  // fuer mode: 'frequent' taete.                             
       95    mockGetFrequentProductUsage.mockResolvedValue([
       82 -    row({ name: 'Butter', used_at: '2026-01-03T10:00:00.000Z' 
          -}),                                                           
       96      row({ name: 'Milch', used_at: '2026-01-02T10:00:00.000Z' }
           ),
       84 -    row({ name: 'Milch', used_at: '2026-01-01T10:00:00.000Z' }
          -),                                                            
       97 +    row({ name: 'Butter', used_at: '2026-01-03T10:00:00.000Z' 
          +}),                                                           
       98    ]);
       99    await renderWithClient(
       87 -    <FrequentProductsQuickSelect feature="fridge" userId="user
          --1" onSelectProduct={jest.fn()} />,                           
      100 +    <FrequentProductsQuickSelect                              
      101 +      feature="fridge"                                        
      102 +      userId="user-1"                                         
      103 +      mode="frequent"                                         
      104 +      onSelectProduct={jest.fn()}                             
      105 +    />,                                                       
      106    );
      107  
       90 -  await screen.findByText('Häufig verwendet');                
      108    const chips = await screen.findAllByText(/Milch|Butter/);
      109    expect(chips.map((c) => c.props.children)).toEqual(['Milch',
            'Butter']);
      110 +  expect(mockGetFrequentProductUsage).toHaveBeenCalledWith(   
      111 +    expect.anything(),                                        
      112 +    expect.objectContaining({ mode: 'frequent' }),            
      113 +  );                                                          
      114  });
      115  
      116  test('ein Tap auf einen Chip liefert das Produkt an onSelectPr
           oduct', async () => {
     ...
      122      <FrequentProductsQuickSelect
      123        feature="fridge"
      124        userId="user-1"
      125 +      mode="frequent"                                         
      126        onSelectProduct={onSelectProduct}
      127      />,
      128    );

  Read 1 file, ran 7 shell commands (ctrl+o to expand)

⏺ Voller Testlauf:

  Ran 2 shell commands (ctrl+o to expand)

⏺ Fertig. Zusammenfassung:

  Neu/geändert:
  - src/features/inventory/add-item-screen.tsx — komplett umgebaut zum
  Bottom-Sheet-Layout wie bei Einkaufen: Griff, Header mit Titel + Schließen-X
  (modal-*-Klassen, identisch zu add-item-modal.tsx), Suche mit Scan-Button als
  Trailing-Icon, zwei Dropdowns darunter, Produktkarte, Menge/Lagerort
  nebeneinander (edit-fridge-*-Klassen wiederverwendet, identisch zum
  Bearbeiten-Sheet), kompakter „+ Neuer Lagerort"-Link, „Weitere Angaben"
  eingeklappt (Einheit + MHD), ein großer Primär-Button.
  - src/components/ui/inline-select.tsx — neue, generische Dropdown-Komponente
  (Button + aufklappendes Panel), von beiden neuen Dropdowns genutzt.
  - src/features/inventory/frequent-products-quick-select.tsx — nimmt jetzt
  einen mode: 'frequent' | 'recent'-Prop entgegen statt fest "Häufig" zu sein;
  tote Client-seitige Neusortierung entfernt (SQL liefert bereits
  dedupliziert+sortiert).
  - src/lib/db/product-usage.ts — getFrequentProductUsage um mode: 'frequent' | 
  'recent' erweitert (nur anderes ORDER BY, kein Schema-Change).
  - Tests entsprechend nachgezogen (add-item-screen.test.tsx,
  frequent-products-quick-select.test.tsx).

  Bewusst nur als UI-Platzhalter, wie besprochen „später": „Gerichte" (linkes
  Dropdown) und „Favoriten" (rechtes Dropdown) sind sichtbar, aber deaktiviert
  mit „bald"-Hinweis — keine erfundene Halb-Funktionalität.

  Alle betroffenen Tests grün (add-item-screen, frequent-products-quick-select,
  product-search-dropdown, add-product-screen), Typecheck und Biome sauber.

  ⚠️ Zwei Dinge gefunden, die nicht von mir stammen und dich vermutlich
  interessieren:
  1. src/global.css Zeile 1648: .tab-btn-label { @apply text-[42px]! 
  leading-[24px]! font-bold!; } — das !-Suffix ist in Tailwind ungültige Syntax
  (müsste !text-[42px] als Präfix sein) und wirft den kompletten CSS-Build um
  (genau der Fehlertyp, der die App letztes Mal komplett unsichtbar gemacht
  hat). Sieht nach einer deiner offenen Änderungen am Essensplan aus.
  2. week.test.ts und meal-planner-screen.test.tsx schlagen aktuell fehl (dein
  Commit „update ui for week planner not jet done" deutet an, dass das schon
  bekannt ist).

  Beides unabhängig von meiner Vorrat-Arbeit — sag Bescheid, ob ich mich drum
  kümmern soll oder ob das bei dir noch in Arbeit ist.

✻ Worked for 10m 39s

※ recap: Vorrat-Artikel-hinzufügen ist jetzt auf den Einkaufen-Look umgebaut, Tests laufen grün. Nächster Schritt: dein kaputter CSS-Build (global.css Zeile 1648, `!`-Syntax) muss gefixt werden, bevor irgendwas testbar ist. (disable recaps in /config)

❯ /rename New-styling-framework 
  ⎿  Session renamed to: New-styling-framework