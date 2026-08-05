// Jest kann CSS nicht als JavaScript parsen. `src/global.css` wird von
// `src/constants/theme.ts` per Side-Effect-Import eingebunden und definiert
// ausschliesslich CSS-Custom-Properties fuer die Web-Ausgabe — auf iOS und
// Android ist der Import ohnehin wirkungslos.
//
// Das hier ist bewusst KEIN Mock von Anwendungslogik, sondern die Antwort auf
// die Frage "wie laedt der Test-Runner eine Nicht-JS-Datei". Es gibt kein
// Verhalten, das ersetzt wuerde.
module.exports = {};
