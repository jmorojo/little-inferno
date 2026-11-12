(() => {
  "use strict";
  const messages = {
    en: {
      title: "Little Inferno · Play",
      description:
        "Little Inferno in your browser. Light your little fireplace.",
      home: "Little Inferno, home",
      language: "Interface language",
      howToPlay: "How to play",
      welcome: "WELCOME TO YOUR FIREPLACE",
      headline: "It’s cold outside.",
      intro: "Stay a while. Set something alight.",
      canvas: "Game screen",
      spark: "It all starts\nwith a spark.",
      start: "Light the fireplace",
      graphics: "Graphics",
      qualityStandard: "Standard",
      qualitySmooth: "Smoother",
      qualityHint: "Smoother reduces resolution and keeps the physics unchanged.",
      firstLoad: "The first load may take a few minutes.",
      download: "Game download",
      retry: "Try again",
      details: "View details",
      phaseIdle: "Ready to light",
      phaseLoading: "Preparing the fireplace",
      phaseRunning: "By the fire",
      phaseError: "Unable to start",
      volume: "Volume",
      volumeLevel: "Volume: {volume}%",
      volumeMuted: "Volume: {volume}% (muted)",
      graphicsDevice: "Graphics renderer: {renderer}",
      helpGpu: "The high-performance GPU is requested. If the integrated GPU is still used, choose high performance for your browser in the system graphics settings and restart the browser. Check the renderer in the technical details.",
      sound: "Sound",
      mute: "Mute sound",
      unmute: "Enable sound",
      fullscreen: "Fullscreen",
      exitFullscreen: "Exit fullscreen",
      hint: "Click inside the game to continue. Drag objects and hold the mouse button to make fire.",
      helpTitle: "A little shelter, a great fire.",
      helpBody:
        "Use the mouse to move objects. Hold the mouse button in the fireplace to make fire. Buy more objects in the catalogue and discover combinations.",
      helpBrowser:
        "Press Esc to leave fullscreen. The original game needs a desktop browser with WebGL 2. Compatibility in this version is experimental.",
      helpLanguage:
        "This selector changes the website language. Change the game’s language from its own main menu.",
      saveDefault: "Games are saved in this browser when storage is available.",
      savePersistent:
        "Games are saved in this browser. Clearing this site’s data also deletes your saves.",
      saveTemporary:
        "Browser storage is unavailable. Your game will only be kept for this session.",
      technical: "Technical details",
      idleDetail: "The game will download when you press the start button.",
      log: "Game log",
      downloadLog: "Download log",
      jsRequired: "Enable JavaScript to run the game.",
      launchTitle: "Preparing your fireplace…",
      errorTitle: "The fire will have to wait.",
      readyDetail: "The engine has rendered the first game scene.",
      checkBrowser: "Checking your browser…",
      httpRequired:
        "Open this website through an HTTP server, for example with npm start.",
      wasmRequired: "This browser does not support WebAssembly.",
      isolationRequired: "The browser could not prepare game audio. Allow service workers and site storage, then reload the page over HTTPS.",
      webglRequired:
        "WebGL 2 is unavailable. Enable hardware acceleration in your browser.",
      prepareFailed: "The game could not be prepared.",
      starting: "Starting the game. This may take a few minutes…",
      timeout:
        "The game has not displayed a scene. Check the log and try again.",
      timeoutDetail:
        "Startup timed out (300 s after mounting the files). Check the Wine and Direct3D errors in the log.",
      scriptFailed: "Could not download {file}.",
      fullscreenFailed: "Fullscreen is unavailable: {error}",
      runtimeStopped: "The game engine has stopped.",
      gameClosed: "The game has closed. You can start it again.",
      exitCode: "BoxedWine exited with code {code}.",
      filesFailed: "The game files could not be loaded.",
      graphicsLost:
        "The connection to the graphics card was lost. Start the game again.",
      unexpected: "The game has stopped. Open the details to view the error.",
      downloadGame: "Downloading the game",
      downloadEngine: "Downloading the engine",
      loadingAsset: "Preparing {file}…",
      httpError:
        "{file}: HTTP {status}. Check that the complete file has been uploaded.",
      zipInvalid: "{file}: the ZIP is incomplete or invalid.",
      zipDirectory: "{file}: the ZIP directory is damaged.",
      zipMissing: "{name} is missing from {file}.",
      tempStorage: "Temporary saves: {error}",
      storageUnavailable: "IndexedDB is unavailable",
      manifestInvalid: "The download manifest is invalid.",
      partSize: "{file}: the downloaded size is incorrect.",
      checksum: "{file}: the integrity check failed. Try downloading again.",
    },
    es: {
      title: "Little Inferno · Jugar",
      description:
        "Little Inferno en tu navegador. Enciende tu pequeña chimenea.",
      home: "Little Inferno, inicio",
      language: "Idioma de la interfaz",
      howToPlay: "Cómo jugar",
      welcome: "BIENVENIDO A TU CHIMENEA",
      headline: "Hace frío ahí fuera.",
      intro: "Quédate un rato. Enciende algo.",
      canvas: "Pantalla del juego",
      spark: "Todo empieza\ncon una chispa.",
      start: "Encender la chimenea",
      graphics: "Gráficos",
      qualityStandard: "Estándar",
      qualitySmooth: "Más fluidez",
      qualityHint: "Más fluidez reduce la resolución y conserva las físicas.",
      firstLoad: "La primera carga puede tardar unos minutos.",
      download: "Descarga del juego",
      retry: "Volver a intentar",
      details: "Ver detalles",
      phaseIdle: "Listo para encender",
      phaseLoading: "Preparando la chimenea",
      phaseRunning: "Junto al fuego",
      phaseError: "No se ha podido iniciar",
      volume: "Volumen",
      volumeLevel: "Volumen: {volume}%",
      volumeMuted: "Volumen: {volume}% (silenciado)",
      graphicsDevice: "Renderizador gráfico: {renderer}",
      helpGpu: "Se solicita la gráfica de alto rendimiento. Si sigue usando la integrada, selecciona alto rendimiento para el navegador en los ajustes gráficos del sistema y reinicia el navegador. Puedes consultar la gráfica utilizada en los detalles técnicos.",
      sound: "Sonido",
      mute: "Silenciar sonido",
      unmute: "Activar sonido",
      fullscreen: "Pantalla completa",
      exitFullscreen: "Salir de pantalla completa",
      hint: "Haz clic en el juego para continuar. Arrastra objetos y mantén pulsado para hacer fuego.",
      helpTitle: "Un pequeño refugio, un gran fuego.",
      helpBody:
        "Usa el ratón para mover los objetos. Mantén pulsado en la chimenea para encender el fuego. Compra más objetos en el catálogo y descubre combinaciones.",
      helpBrowser:
        "Pulsa Esc para salir de pantalla completa. El juego original necesita un navegador de escritorio con WebGL 2. La compatibilidad en esta versión es experimental.",
      helpLanguage:
        "Este selector cambia el idioma de la web. Cambia el idioma del juego desde su propio menú principal.",
      saveDefault:
        "Las partidas se guardan en este navegador cuando el almacenamiento está disponible.",
      savePersistent:
        "Las partidas se guardan en este navegador. Borrar los datos del sitio también borra las partidas.",
      saveTemporary:
        "El almacenamiento del navegador no está disponible. La partida solo se conservará durante esta sesión.",
      technical: "Detalles técnicos",
      idleDetail: "El juego se descargará cuando pulses el botón de inicio.",
      log: "Registro del juego",
      downloadLog: "Descargar registro",
      jsRequired: "Activa JavaScript para ejecutar el juego.",
      launchTitle: "Preparando tu chimenea…",
      errorTitle: "El fuego tendrá que esperar.",
      readyDetail: "El motor ha dibujado la primera escena del juego.",
      checkBrowser: "Comprobando el navegador…",
      httpRequired:
        "Abre la web desde un servidor HTTP, por ejemplo con npm start.",
      wasmRequired: "Este navegador no admite WebAssembly.",
      isolationRequired: "El navegador no ha podido preparar el audio del juego. Permite los service workers y el almacenamiento del sitio y recarga la página mediante HTTPS.",
      webglRequired:
        "WebGL 2 no está disponible. Activa la aceleración gráfica del navegador.",
      prepareFailed: "No se ha podido preparar el juego.",
      starting: "Iniciando el juego. Puede tardar unos minutos…",
      timeout:
        "El juego no ha llegado a mostrar una escena. Consulta el registro e inténtalo de nuevo.",
      timeoutDetail:
        "Tiempo de arranque agotado (300 s después de montar los archivos). Comprueba los errores de Wine y Direct3D en el registro.",
      scriptFailed: "No se ha podido descargar {file}.",
      fullscreenFailed: "Pantalla completa no disponible: {error}",
      runtimeStopped: "El motor del juego se ha detenido.",
      gameClosed: "El juego se ha cerrado. Puedes volver a iniciarlo.",
      exitCode: "BoxedWine terminó con código {code}.",
      filesFailed: "No se han podido cargar los archivos del juego.",
      graphicsLost:
        "Se ha perdido la conexión con la tarjeta gráfica. Vuelve a iniciar el juego.",
      unexpected:
        "El juego se ha detenido. Abre los detalles para consultar el error.",
      downloadGame: "Descargando el juego",
      downloadEngine: "Descargando el motor",
      loadingAsset: "Preparando {file}…",
      httpError:
        "{file}: HTTP {status}. Comprueba que el archivo está publicado completo.",
      zipInvalid: "{file}: el ZIP está incompleto o no es válido.",
      zipDirectory: "{file}: el directorio ZIP está dañado.",
      zipMissing: "Falta {name} en {file}.",
      tempStorage: "Guardado temporal: {error}",
      storageUnavailable: "IndexedDB no está disponible",
      manifestInvalid: "El manifiesto de descarga no es válido.",
      partSize: "{file}: el tamaño descargado no es correcto.",
      checksum:
        "{file}: la comprobación de integridad ha fallado. Vuelve a descargarlo.",
    },
    de: {
      title: "Little Inferno · Spielen",
      description:
        "Little Inferno im Browser. Entzünde ein Feuer in deinem kleinen Kamin.",
      home: "Little Inferno, Startseite",
      language: "Sprache der Oberfläche",
      howToPlay: "Spielanleitung",
      welcome: "WILLKOMMEN AN DEINEM KAMIN",
      headline: "Draußen ist es kalt.",
      intro: "Bleib ein wenig. Zünde etwas an.",
      canvas: "Spielfenster",
      spark: "Alles beginnt\nmit einem Funken.",
      start: "Den Kamin anzünden",
      graphics: "Grafik",
      qualityStandard: "Standard",
      qualitySmooth: "Flüssiger",
      qualityHint: "Flüssiger verringert die Auflösung und behält die Physik bei.",
      firstLoad: "Das erste Laden kann einige Minuten dauern.",
      download: "Spiel herunterladen",
      retry: "Erneut versuchen",
      details: "Details anzeigen",
      phaseIdle: "Bereit zum Anzünden",
      phaseLoading: "Kamin wird vorbereitet",
      phaseRunning: "Am Feuer",
      phaseError: "Start nicht möglich",
      volume: "Lautstärke",
      volumeLevel: "Lautstärke: {volume}%",
      volumeMuted: "Lautstärke: {volume}% (stumm)",
      graphicsDevice: "Grafikrenderer: {renderer}",
      helpGpu: "Die leistungsstarke GPU wird angefordert. Wird weiterhin die integrierte GPU verwendet, wähle in den Grafikeinstellungen des Systems die hohe Leistung für den Browser und starte ihn neu. Den verwendeten Renderer findest du in den technischen Details.",
      sound: "Ton",
      mute: "Ton ausschalten",
      unmute: "Ton einschalten",
      fullscreen: "Vollbild",
      exitFullscreen: "Vollbild verlassen",
      hint: "Klicke ins Spiel, um fortzufahren. Ziehe Gegenstände und halte die Maustaste gedrückt, um Feuer zu machen.",
      helpTitle: "Ein kleiner Zufluchtsort, ein großes Feuer.",
      helpBody:
        "Bewege Gegenstände mit der Maus. Halte die Maustaste im Kamin gedrückt, um Feuer zu machen. Kaufe weitere Gegenstände im Katalog und entdecke Kombinationen.",
      helpBrowser:
        "Drücke Esc, um das Vollbild zu verlassen. Das Originalspiel benötigt einen Desktop-Browser mit WebGL 2. Die Kompatibilität dieser Version ist experimentell.",
      helpLanguage:
        "Diese Auswahl ändert die Sprache der Website. Die Spielsprache kannst du im Hauptmenü des Spiels ändern.",
      saveDefault:
        "Spielstände werden in diesem Browser gespeichert, sofern Speicher verfügbar ist.",
      savePersistent:
        "Spielstände werden in diesem Browser gespeichert. Wenn du die Websitedaten löschst, werden auch deine Spielstände gelöscht.",
      saveTemporary:
        "Der Browserspeicher ist nicht verfügbar. Dein Spielstand bleibt nur für diese Sitzung erhalten.",
      technical: "Technische Details",
      idleDetail:
        "Das Spiel wird heruntergeladen, sobald du auf die Startschaltfläche klickst.",
      log: "Spielprotokoll",
      downloadLog: "Protokoll herunterladen",
      jsRequired: "Aktiviere JavaScript, um das Spiel auszuführen.",
      launchTitle: "Dein Kamin wird vorbereitet…",
      errorTitle: "Das Feuer muss noch warten.",
      readyDetail: "Die Engine hat die erste Spielszene dargestellt.",
      checkBrowser: "Browser wird überprüft…",
      httpRequired:
        "Öffne die Website über einen HTTP-Server, zum Beispiel mit npm start.",
      wasmRequired: "Dieser Browser unterstützt WebAssembly nicht.",
      isolationRequired: "Der Browser konnte den Spielton nicht vorbereiten. Erlaube Service Worker und den Website-Speicher und lade die Seite über HTTPS neu.",
      webglRequired:
        "WebGL 2 ist nicht verfügbar. Aktiviere die Hardwarebeschleunigung deines Browsers.",
      prepareFailed: "Das Spiel konnte nicht vorbereitet werden.",
      starting: "Das Spiel wird gestartet. Das kann einige Minuten dauern…",
      timeout:
        "Das Spiel hat noch keine Szene angezeigt. Prüfe das Protokoll und versuche es erneut.",
      timeoutDetail:
        "Zeitüberschreitung beim Start (300 s nach dem Einbinden der Dateien). Prüfe die Wine- und Direct3D-Fehler im Protokoll.",
      scriptFailed: "{file} konnte nicht heruntergeladen werden.",
      fullscreenFailed: "Vollbild ist nicht verfügbar: {error}",
      runtimeStopped: "Die Spiel-Engine wurde angehalten.",
      gameClosed: "Das Spiel wurde geschlossen. Du kannst es erneut starten.",
      exitCode: "BoxedWine wurde mit Code {code} beendet.",
      filesFailed: "Die Spieldateien konnten nicht geladen werden.",
      graphicsLost:
        "Die Verbindung zur Grafikkarte wurde unterbrochen. Starte das Spiel erneut.",
      unexpected:
        "Das Spiel wurde angehalten. Öffne die Details, um den Fehler anzuzeigen.",
      downloadGame: "Spiel wird heruntergeladen",
      downloadEngine: "Engine wird heruntergeladen",
      loadingAsset: "{file} wird vorbereitet…",
      httpError:
        "{file}: HTTP {status}. Prüfe, ob die Datei vollständig hochgeladen wurde.",
      zipInvalid: "{file}: Die ZIP-Datei ist unvollständig oder ungültig.",
      zipDirectory: "{file}: Das ZIP-Verzeichnis ist beschädigt.",
      zipMissing: "{name} fehlt in {file}.",
      tempStorage: "Temporäre Spielstände: {error}",
      storageUnavailable: "IndexedDB ist nicht verfügbar",
      manifestInvalid: "Das Download-Manifest ist ungültig.",
      partSize: "{file}: Die heruntergeladene Dateigröße ist falsch.",
      checksum:
        "{file}: Die Integritätsprüfung ist fehlgeschlagen. Lade die Datei erneut herunter.",
    },
    fr: {
      title: "Little Inferno · Jouer",
      description:
        "Little Inferno dans votre navigateur. Allumez votre petite cheminée.",
      home: "Little Inferno, accueil",
      language: "Langue de l’interface",
      howToPlay: "Comment jouer",
      welcome: "BIENVENUE DEVANT VOTRE CHEMINÉE",
      headline: "Il fait froid dehors.",
      intro: "Restez un peu. Allumez quelque chose.",
      canvas: "Écran de jeu",
      spark: "Tout commence\npar une étincelle.",
      start: "Allumer la cheminée",
      graphics: "Graphismes",
      qualityStandard: "Standard",
      qualitySmooth: "Plus fluide",
      qualityHint: "Plus fluide réduit la résolution et conserve la physique.",
      firstLoad: "Le premier chargement peut prendre quelques minutes.",
      download: "Téléchargement du jeu",
      retry: "Réessayer",
      details: "Voir les détails",
      phaseIdle: "Prêt à allumer",
      phaseLoading: "Préparation de la cheminée",
      phaseRunning: "Au coin du feu",
      phaseError: "Démarrage impossible",
      volume: "Volume",
      volumeLevel: "Volume : {volume} %",
      volumeMuted: "Volume : {volume} % (coupé)",
      graphicsDevice: "Moteur graphique : {renderer}",
      helpGpu: "Le GPU haute performance est demandé. Si le GPU intégré reste utilisé, choisis les hautes performances pour le navigateur dans les paramètres graphiques du système, puis redémarre le navigateur. Le moteur utilisé figure dans les détails techniques.",
      sound: "Son",
      mute: "Couper le son",
      unmute: "Activer le son",
      fullscreen: "Plein écran",
      exitFullscreen: "Quitter le plein écran",
      hint: "Cliquez dans le jeu pour continuer. Déplacez les objets et maintenez le bouton de la souris enfoncé pour faire du feu.",
      helpTitle: "Un petit refuge, un grand feu.",
      helpBody:
        "Utilisez la souris pour déplacer les objets. Maintenez le bouton de la souris enfoncé dans la cheminée pour faire du feu. Achetez d’autres objets dans le catalogue et découvrez des combinaisons.",
      helpBrowser:
        "Appuyez sur Échap pour quitter le plein écran. Le jeu original nécessite un navigateur pour ordinateur avec WebGL 2. La compatibilité de cette version est expérimentale.",
      helpLanguage:
        "Ce sélecteur change la langue du site. Vous pouvez changer la langue du jeu dans son menu principal.",
      saveDefault:
        "Les parties sont enregistrées dans ce navigateur lorsque le stockage est disponible.",
      savePersistent:
        "Les parties sont enregistrées dans ce navigateur. Effacer les données de ce site supprime aussi vos sauvegardes.",
      saveTemporary:
        "Le stockage du navigateur n’est pas disponible. Votre partie sera conservée uniquement pendant cette session.",
      technical: "Détails techniques",
      idleDetail:
        "Le jeu sera téléchargé lorsque vous appuierez sur le bouton de démarrage.",
      log: "Journal du jeu",
      downloadLog: "Télécharger le journal",
      jsRequired: "Activez JavaScript pour lancer le jeu.",
      launchTitle: "Préparation de votre cheminée…",
      errorTitle: "Le feu devra attendre.",
      readyDetail: "Le moteur a affiché la première scène du jeu.",
      checkBrowser: "Vérification du navigateur…",
      httpRequired:
        "Ouvrez le site depuis un serveur HTTP, par exemple avec npm start.",
      wasmRequired: "Ce navigateur ne prend pas en charge WebAssembly.",
      isolationRequired: "Le navigateur n’a pas pu préparer le son du jeu. Autorisez les service workers et le stockage du site, puis rechargez la page en HTTPS.",
      webglRequired:
        "WebGL 2 n’est pas disponible. Activez l’accélération matérielle du navigateur.",
      prepareFailed: "Le jeu n’a pas pu être préparé.",
      starting: "Démarrage du jeu. Cela peut prendre quelques minutes…",
      timeout:
        "Le jeu n’a affiché aucune scène. Consultez le journal et réessayez.",
      timeoutDetail:
        "Délai de démarrage dépassé (300 s après le montage des fichiers). Vérifiez les erreurs Wine et Direct3D dans le journal.",
      scriptFailed: "Impossible de télécharger {file}.",
      fullscreenFailed: "Le plein écran n’est pas disponible : {error}",
      runtimeStopped: "Le moteur du jeu s’est arrêté.",
      gameClosed: "Le jeu a été fermé. Vous pouvez le relancer.",
      exitCode: "BoxedWine s’est terminé avec le code {code}.",
      filesFailed: "Les fichiers du jeu n’ont pas pu être chargés.",
      graphicsLost:
        "La connexion à la carte graphique a été perdue. Relancez le jeu.",
      unexpected:
        "Le jeu s’est arrêté. Ouvrez les détails pour consulter l’erreur.",
      downloadGame: "Téléchargement du jeu",
      downloadEngine: "Téléchargement du moteur",
      loadingAsset: "Préparation de {file}…",
      httpError:
        "{file} : HTTP {status}. Vérifiez que le fichier a été publié dans son intégralité.",
      zipInvalid: "{file} : le ZIP est incomplet ou invalide.",
      zipDirectory: "{file} : le répertoire ZIP est endommagé.",
      zipMissing: "{name} est absent de {file}.",
      tempStorage: "Sauvegarde temporaire : {error}",
      storageUnavailable: "IndexedDB n’est pas disponible",
      manifestInvalid: "Le manifeste de téléchargement est invalide.",
      partSize: "{file} : la taille téléchargée est incorrecte.",
      checksum:
        "{file} : la vérification d’intégrité a échoué. Téléchargez à nouveau le fichier.",
    },
  };
  const supported = Object.keys(messages);
  const normalize = (value) =>
    String(value || "")
      .toLowerCase()
      .split("-")[0];
  let stored;
  try {
    stored = localStorage.getItem("little-inferno-language");
  } catch {}
  const preferred = [
    new URLSearchParams(location.search).get("lang"),
    stored,
    ...(navigator.languages || [navigator.language]),
  ].map(normalize);
  let language = preferred.find((code) => supported.includes(code)) || "en";
  function t(key, vars = {}) {
    const value = messages[language][key];
    if (typeof value !== "string")
      throw new Error(`Missing translation: ${language}.${key}`);
    return value.replace(/\{(\w+)\}/g, (_, name) =>
      String(vars[name] ?? `{${name}}`),
    );
  }
  function translateDOM() {
    document.documentElement.lang = language;
    document.querySelector('link[rel="manifest"]').href =
      `manifests/${language}.webmanifest`;
    for (const node of document.querySelectorAll("[data-i18n]"))
      node.textContent = t(node.dataset.i18n);
    for (const attr of ["aria-label", "title", "content"])
      for (const node of document.querySelectorAll(`[data-i18n-${attr}]`))
        node.setAttribute(attr, t(node.getAttribute(`data-i18n-${attr}`)));
    document.getElementById("language-select").value = language;
  }
  window.I18n = {
    t,
    messages,
    get language() {
      return language;
    },
    error(key, vars) {
      const error = new Error(t(key, vars));
      error.i18nKey = key;
      error.i18nVars = vars;
      return error;
    },
    setLanguage(code) {
      if (!supported.includes(code)) return;
      language = code;
      try {
        localStorage.setItem("little-inferno-language", code);
      } catch {}
      const url = new URL(location.href);
      url.searchParams.set("lang", code);
      history.replaceState(null, "", url);
      translateDOM();
      window.dispatchEvent(new Event("inferno:language"));
    },
  };
  translateDOM();
  document
    .getElementById("language-select")
    .addEventListener("change", (event) =>
      I18n.setLanguage(event.target.value),
    );
})();
