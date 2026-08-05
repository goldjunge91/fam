/// <reference types="jest" />

// TypeScript 6 zieht die Pakete unter `node_modules/@types` nicht mehr
// automatisch ein, wie es TS 5 noch getan hat. Ohne diese Referenz kennt
// `tsc --noEmit` die Jest-Globals (`describe`, `it`, `expect`) nicht und
// bricht in jeder Testdatei mit TS2593 ab — obwohl `@types/jest` installiert
// ist und die Tests zur Laufzeit einwandfrei durchlaufen.
//
// Alternative waere `compilerOptions.types` in der tsconfig gewesen; das
// haette aber die automatische Einbindung aller uebrigen Typpakete
// abgeschaltet und muesste bei jeder neuen Abhaengigkeit nachgepflegt werden.
