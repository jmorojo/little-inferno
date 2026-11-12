# Little Inferno Web

El juego original de Windows en el navegador, con BoxedWine 26R2 JIT, Wine 11 y Direct3D 9 sobre WebGL 2. Se han probado menú, partida, movimiento de objetos, fuego, sonido y restauración del guardado. [Captura de una partida](docs/gameplay.png).

La interfaz de la web está disponible en **English, Español, Deutsch y Français**, incluidos ayuda, carga, errores, controles y accesibilidad. Detecta el idioma del navegador y recuerda tu elección. También puedes usar `?lang=en`, `?lang=es`, `?lang=de` o `?lang=fr`. El juego original tiene su propio selector de idioma en el menú principal. Los registros originales del motor se conservan sin traducir para facilitar el diagnóstico.

## Arranque local

Necesitas Node.js para los comandos npm y Python 3 para el servidor y el empaquetado. Usa un navegador de escritorio reciente con WebGL 2 y WebAssembly SIMD. La ejecución se ha comprobado en Chromium.

```sh
npm ci
npm run setup
```

Copia el ZIP del juego a **`local/littleinferno.zip`**, con `Little Inferno.exe`, `resource.pak`, `embed.pak` y `frontend.pak` en su raíz. En este equipo ya está preparado. `setup` descarga y verifica solo el motor libre, nunca el juego.

```sh
npm start
```

Abre **http://127.0.0.1:8088/**. Pulsa el botón de inicio y haz clic en las pantallas iniciales del propio juego para avanzar. El arranque puede tardar varios minutos y consumir varios GB de RAM. La descarga completa es de unos 419 MiB. La interfaz funciona en móvil, pero la ejecución del juego se ha validado en escritorio.

El servidor admite `--host`, `--port` y `--directory`. `?debug=1` activa trazas adicionales. Los detalles técnicos están plegados por defecto.

El botón de sonido silencia la salida del juego, incluso cuando sus clics y teclas reanudan el motor de audio. El knob de volumen admite arrastre vertical u horizontal y las teclas de flecha, Inicio y Fin. El volumen y el silencio se recuerdan en este navegador; desactivar el silencio recupera el último nivel audible.

Antes de iniciar puedes elegir **Gráficos → Más fluidez**. Reduce el escritorio virtual de 960 × 540 a 800 × 450 (un 31 % menos de píxeles) y mantiene las físicas del juego. La elección se recuerda en este navegador; para cambiarla durante una partida, recarga la web. Ambos modos usan el mismo guardado. El modo Estándar conserva la resolución anterior.

El juego se ejecuta en tu equipo. La emulación también consume CPU, por lo que una máquina capaz de ejecutar el juego nativo puede tener tirones en esta versión. El modo de fluidez reduce el trabajo gráfico; no garantiza eliminar los picos de cálculo de las físicas.

El motor incorpora una optimización del JIT: termina antes la búsqueda de bloques grandes al encontrar un retorno, reduciendo traducciones solapadas. En una comparación del juego real, a la misma resolución, el consumo de CPU por fotograma durante la combustión bajó de 114 a 94 ms, aproximadamente un 18 %. Se midió en Chromium con renderizado por software; ese porcentaje no predice los FPS en otros equipos y siguen existiendo picos de compilación. Los [resultados completos](docs/performance-results.json) incluyen las otras escenas y las limitaciones. El ajuste conserva las instrucciones y la precisión de las físicas. `setup` y `build` reproducen el parche y verifican sus hashes; el [cambio de código fuente y su procedencia](web-boxedwine/third-party/README.md) acompañan al motor.

Todos los contextos WebGL, incluida la primera comprobación de compatibilidad, solicitan `powerPreference: "high-performance"`. La [especificación WebGL](https://registry.khronos.org/webgl/specs/latest/1.0/#WEBGLCONTEXTATTRIBUTES) lo define como una preferencia que el navegador puede ignorar. El renderizador utilizado por el juego se muestra en **Detalles técnicos**, también sin `?perf=1`.

Si un equipo con dos GPU sigue usando la integrada, en Windows selecciona el **ejecutable del navegador** en Configuración → Sistema → Pantalla → Gráficos, elige **Alto rendimiento**, guarda y reinicia por completo el navegador. Es la [selección por aplicación documentada por Microsoft](https://support.microsoft.com/en-au/windows/hardware/display-graphics/optimizations-for-windowed-games-in-windows-11). En los MacBook Pro con dos GPU, Apple documenta la opción de [desactivar el cambio automático de gráficos](https://support.apple.com/en-ie/102265), cuando ese ajuste está disponible. La web no puede imponer una GPU por encima de la elección del sistema.

Para medir una partida, abre `?perf=1` (o `?lang=es&perf=1`), juega con la pestaña visible y descarga el registro desde los detalles técnicos. Incluye el renderizador gráfico utilizado y, cada diez segundos, los FPS y los intervalos entre fotogramas mediano, p95 y máximo. Se cuentan las presentaciones finales del juego a WebGL, no los callbacks de `requestAnimationFrame`. La medición está desactivada por defecto.

## Preparar Netlify

La rama `feat/github-pages` añade también el despliegue en **GitHub Pages**, con aislamiento para mantener AudioWorklet. Usa `npm run build:pages`, `npm run verify:pages` y `npm run preview:pages`; la previsualización está en **http://127.0.0.1:8089/little-inferno/**. La carpeta publicable es `dist/github-pages/`. El workflow, la release de datos y la migración sin el historial de binarios se explican en [DEPLOY.md](docs/DEPLOY.md#github-pages).

```sh
npm run build
npm run verify:deploy
npm run preview
```

El resultado está en **`dist/netlify/`**, listo para desplegar como archivos estáticos. La previsualización usa http://127.0.0.1:8088/. Incluye el juego y Wine en fragmentos de 8 MiB, con manifiesto y verificación SHA-256. El navegador reconstruye exactamente los ZIP originales; no modifica el ejecutable ni los PAK. Ningún archivo del despliegue supera 8 MiB.

Para publicar la carpeta preparada, usa la CLI de Netlify:

```sh
npx netlify-cli deploy --no-build --dir=dist/netlify --prod
```

La CLI te pedirá iniciar sesión y seleccionar o crear el sitio. **Preparar la carpeta no publica nada.** Consulta [DEPLOY.md](docs/DEPLOY.md) para opciones de alojamiento, configuración y consumo de transferencia.

## Pruebas

```sh
npx playwright install chromium
npm test
npm run verify:deploy
npm run test:game:deploy
npm run test:game:deploy -- --smooth --perf
npm run test:game:deploy -- --smooth --perf --audio
```

`npm test` comprueba la interfaz, los cuatro idiomas, estados y errores, persistencia, clics breves y reconstrucción de fragmentos con el FS y el WASM reales. `test:game:deploy` arranca el juego real desde `dist/netlify/`, espera la primera escena y comprueba que un clic normal permite avanzar. Puede tardar varios minutos. Las capturas y el registro quedan en `test-results/`.

Para repetir el ensayo de fuego con un perfil temporal nuevo, ejecuta `npm run benchmark:game -- --name optimized`. Para comparar otra compilación con la misma secuencia, usa `npm run benchmark:game -- --name baseline --wasm /ruta/boxedwine-original.wasm`. El JavaScript debe corresponder a la misma versión del motor. `--headed` muestra la ventana y `--frames 240` aumenta la muestra; usa el mismo valor en ambos ensayos. Guarda JSON y captura en `test-results/performance/`. Mide presentaciones del juego y tiempo de CPU del proceso de renderizado, no solo callbacks del navegador.

## Organización y Git

- `web-boxedwine/`: código del lanzador, traducciones y recursos de interfaz.
- `scripts/`: descarga del motor, empaquetado y verificación.
- `tests/`: pruebas de navegador y del juego real.
- `docs/`: instrucciones y captura de referencia.
- `local/`: ZIP original del juego; ignorado por Git.
- `archive/legacy-research/`: investigación y prototipo anteriores, conservados localmente e ignorados por Git.
- `dist/netlify/`: carpeta generada para desplegar; ignorada por Git.

También se ignoran los binarios descargados del motor, dependencias, cachés, resultados de pruebas y configuración local de Codex. La carpeta de despliegue se construye con una lista explícita de archivos; no copia `.git`, `.codex`, archivos de entorno ni la investigación antigua.

Para crear tu commit y subirlo:

```sh
git add -A
git diff --cached --stat
git commit -m "Run Little Inferno in the browser with multilingual UI and Netlify packaging"
git push origin HEAD
```

La limpieza elimina los archivos grandes del árbol de código actual, **sin reescribir el historial existente**. El commit inicial todavía contiene los binarios antiguos. Si se migra a un proveedor que rechace archivos grandes del historial, hará falta una migración del historial aparte.

## Guardado y procedencia

Las partidas se guardan automáticamente en IndexedDB bajo `/profile/little-inferno`. Se ha verificado que `profiles.bin`, creado por el juego, se restaura idéntico tras recargar. Borrar los datos del sitio elimina también las partidas. Sin almacenamiento disponible, la ayuda indica que la partida es temporal. El guardado pertenece al origen: cambiar de localhost al dominio de Netlify no lo transfiere automáticamente.

Las versiones, fuentes, licencias y hashes del motor están en [third-party/README.md](web-boxedwine/third-party/README.md). El sistema de Wine incluye sus avisos y parches. Little Inferno pertenece a Tomorrow Corporation.
