/// <reference types="expo/types" />

// Expo erzeugt `expo-env.d.ts` erst beim ersten Metro-Start und haelt die Datei
// per .gitignore aus dem Repo heraus. Auf einem frischen Checkout — und damit
// auch in der CI — fehlen dadurch die Deklarationen fuer `*.css` und
// `*.module.css`, und `tsc --noEmit` schlaegt fehl.
//
// Diese Datei referenziert die Expo-Typen explizit und ist committet. Sie
// ersetzt `expo-env.d.ts` nicht, sondern ergaenzt sie: beide zeigen auf
// dieselbe Quelle, doppelte Referenzen sind fuer TypeScript unproblematisch.
