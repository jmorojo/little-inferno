# Despliegue

La aplicación es estática: el juego se ejecuta en el navegador. Netlify sirve los archivos, sin funciones ni servidor de emulación.

## Carpeta preparada

Desde la raíz del proyecto:

```sh
npm run build
npm run verify:deploy
```

Se genera `dist/netlify/`, con unos 419 MiB y archivos de un máximo de 8 MiB. Incluye `index.html`, el lanzador, cuatro idiomas y sus manifiestos de webapp, el motor JS/WASM, licencias, cabeceras y los fragmentos del juego y Wine.

El empaquetado conserva los bytes originales y genera SHA-256 de cada fragmento y de cada archivo completo. El navegador comprueba esas sumas antes de montar los ZIP. Los fragmentos tienen nombres basados en su contenido y se pueden almacenar en caché. Una descarga incompleta o alterada muestra un error.

Para comprobar esta carpeta localmente:

```sh
npm run preview
```

Para probar el juego real usando el mismo paquete:

```sh
npm run test:game:deploy
```

## Publicar con la CLI

Para un paquete de este tamaño se recomienda la CLI en lugar de arrastrar la carpeta al navegador:

```sh
npx netlify-cli deploy --no-build --dir=dist/netlify --prod
```

El comando publica en el sitio que selecciones en Netlify. Omite `--prod` si quieres primero una URL de prueba. No se ha publicado ningún sitio automáticamente durante la preparación del proyecto.

La documentación de Netlify indica que los archivos de más de 10 MB no están bien soportados por su CDN. Por eso los dos ZIP grandes se sirven aquí en fragmentos de 8 MiB. [Netlify: archivos o sitios grandes](https://docs.netlify.com/build/configure-builds/troubleshooting-tips/#large-files-or-sites).

Netlify recomienda la CLI para despliegues grandes; los de menos de 50 MB funcionan mejor con Drop. Este proyecto supera ese tamaño total aunque sus archivos individuales sean pequeños. [Netlify Drop: resolución de problemas](https://docs.netlify.com/start/quickstarts/netlify-drop-quickstart/#troubleshooting-tips).

## Builds desde Git o CI

La configuración de la raíz ya declara:

- Comando: `npm run build`.
- Carpeta de publicación: `dist/netlify`.

El repositorio contiene el código; el juego original se mantiene fuera de Git. En un equipo o CI que tenga el ZIP, indica su ruta con `LITTLE_INFERNO_GAME_ZIP`, o déjalo en `local/littleinferno.zip`.

Para un build remoto sin ese archivo puedes configurar **`LITTLE_INFERNO_GAME_URL`** como variable del entorno de compilación. El build descargará el ZIP desde esa dirección, sin incluir la URL en la web generada. Opcionalmente configura **`LITTLE_INFERNO_GAME_SHA256`** para verificar el origen del ZIP. Guarda enlaces privados o firmados como variables del servicio, no en los archivos del repositorio. El script verifica siempre que el ZIP contiene los cuatro archivos principales del juego.

El motor libre se descarga desde versiones fijadas y se verifica con sus hashes. Si los archivos ya existen y coinciden, no vuelve a descargarlos. El empaquetado y el servidor solo necesitan la biblioteca estándar de Python.

## Transferencia y webapp

Una carga completa transfiere alrededor de **419 MiB por navegador sin caché**, además de pequeños archivos de interfaz. Netlify puede alojar el contenido preparado, pero conviene comprobar la cuota de transferencia del plan antes de compartirlo con muchos visitantes. Los planes actuales por créditos miden la transferencia; los planes anteriores pueden tener condiciones distintas. [Netlify: consumo de créditos y transferencia](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/).

Se incluyen COOP/COEP, el MIME del WASM y las cabeceras de los fragmentos en `_headers` y `netlify.toml`. Usa HTTPS en el dominio público. Los manifiestos permiten abrir la web como aplicación en navegadores compatibles; no se incluye caché sin conexión. Cambiar el idioma de la web también cambia el idioma y la URL de inicio del manifiesto.

Las partidas se guardan en el navegador, asociadas al dominio del sitio. Mantener el mismo dominio conserva ese origen de almacenamiento entre despliegues.

## GitHub Pages

La rama de preparación en Gitea es `feat/github-pages`. El destino de GitHub es [jmorojo/little-inferno](https://github.com/jmorojo/little-inferno). El workflow usa el nombre del repositorio que lo ejecuta, sin fijar un usuario ni un dominio en el código.

```sh
npm ci
npm run build:pages
npm run verify:pages
npm run preview:pages
```

Abre **http://127.0.0.1:8089/little-inferno/**. Esta previsualización sirve la aplicación bajo una subruta y sin COOP/COEP del servidor, como GitHub Pages. El paquete está en **`dist/github-pages/`**. Incluye `.nojekyll`; las rutas de scripts, WASM, fragmentos y manifiestos son relativas y funcionan también con un dominio propio.

### Aislamiento y audio

GitHub Pages no interpreta `_headers` ni `netlify.toml`. Este paquete carga `isolation.js`, que registra el worker dentro de la carpeta del proyecto y realiza una recarga inicial para activar COOP/COEP. El emulador espera a que termine ese paso antes de descargar el juego. El worker reenvía las peticiones a la red; no guarda los 419 MiB en una caché adicional ni recarga una partida en curso al actualizarse. Hay un límite de un intento de recarga automática y los errores de preparación están traducidos a los cuatro idiomas.

Así se conserva el backend AudioWorklet con `SharedArrayBuffer`. Si el servidor ya aporta aislamiento, no se registra ningún worker. El backend y los ajustes de Netlify siguen disponibles como destino independiente. La dependencia MIT y su revisión fijada están documentadas en [la procedencia del runtime](../web-boxedwine/third-party/README.md).

### Código y archivos grandes

El historial antiguo de Gitea contiene binarios de más de 100 MiB que GitHub rechaza al subir por Git. Se conserva ese historial en Gitea. Para GitHub se prepara una instantánea de la rama actual, sin `.git`, ZIP del juego, cachés, credenciales ni binarios del motor:

```sh
# La rama debe estar completamente guardada en un commit.
npm run prepare:github
```

Se generan:

- `dist/github/source/`: código listo para iniciar el repositorio de GitHub con un historial nuevo.
- `dist/github/release-assets/`: `littleinferno.zip` y su checksum, para la release de datos.
- `dist/github/preparation.json`: commit de origen y hashes de los datos.

La exportación usa solo los archivos del commit y comprueba que no incluya enlaces simbólicos ni archivos grandes inesperados. No reescribe el historial de Gitea. La carpeta completa `dist/` sigue ignorada por Git; la subcarpeta `source/` se publica como un repositorio separado.

### Configuración inicial del repositorio de GitHub

1. Subir `dist/github/source/` a la rama `main` del repositorio de destino.
2. Crear una release publicada con el tag **`game-data`** y adjuntar los dos archivos de `dist/github/release-assets/`. El tag debe señalar un commit existente del repositorio.
3. En **Settings → Pages → Build and deployment → Source**, elegir **GitHub Actions**.
4. En **Actions → Deploy GitHub Pages → Run workflow**, ejecutar el workflow en `main`.

El juego queda como un asset de release, fuera de Git. Los [assets de release admiten archivos de menos de 2 GiB](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases#storage-and-bandwidth-quotas); el ZIP actual ocupa unos 320 MiB. `scripts/github-game.json` fija su tamaño y SHA-256. La compilación verifica el ZIP y reconstruye el paquete completo, por lo que el navegador descarga los fragmentos desde Pages y no depende de Netlify ni de la API de GitHub durante la partida.

Como alternativa a la release puede definirse el secreto **`LITTLE_INFERNO_GAME_URL`** con una URL HTTPS al mismo ZIP. La URL se usa solo durante el build y no se incluye en la web. Para cambiar de versión del juego, actualiza sus datos de `scripts/github-game.json` junto con la release.

El primer push puede iniciar un workflow antes de que existan la release o la configuración de Pages. Tras completar los pasos anteriores basta con ejecutar el workflow manualmente. No se necesitan tokens personales en secretos: el workflow usa `GITHUB_TOKEN` con `contents: read` para descargar los datos y concede `pages: write` e `id-token: write` solo al job de publicación.

### Workflow y validación

El workflow [`.github/workflows/github-pages.yml`](../.github/workflows/github-pages.yml) se ejecuta manualmente y al subir cambios a `main`, `master` o `feat/github-pages`. Las acciones están fijadas por SHA. Instala las dependencias, descarga la release de datos, construye el paquete, verifica todos los hashes, ejecuta las pruebas de la web y de aislamiento y arranca el juego original con audio antes de publicar. Si falla una comprobación, no se ejecuta el despliegue. Los permisos y el entorno `github-pages` siguen el [workflow oficial de Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

```sh
npm test
npm run test:pages
npm run test:game:pages -- --smooth --audio
```

`test:pages` comprueba en un navegador real la recarga inicial, `crossOriginIsolated`, la disponibilidad de memoria compartida, el scope del worker, las rutas bajo `/little-inferno/`, el FS WASM y la conservación de guardado, idioma y volumen. También comprueba un worker ausente, la prevención de bucles y un servidor que ya ofrece las cabeceras. La prueba del juego comprueba expresamente que se usa AudioWorklet, además de salida audible, silencio tras reanudar el motor y ajuste del volumen.

Pages admite un [sitio de hasta 1 GB y tiene un límite orientativo de 100 GB/mes](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits). El paquete de unos 419 MiB cabe; la transferencia equivale a unas 230 cargas completas sin caché al mes. Al cambiar de Netlify a `github.io`, las partidas siguen asociadas al origen anterior del navegador y no se transfieren automáticamente.
