SUPER SMASH ISLAND CLOUD | ACTUALIZACION OFFLINE + SINCRONIZACION AUTOMATICA

CONTENIDO
- public/: reemplaza los archivos de la carpeta public del repositorio.
- server.js: reemplaza el server.js de la raiz del repositorio.
- No reemplaces package.json ni cambies las variables de entorno de Render/Neon.

COMO PUBLICAR (SIN GITHUB DESKTOP)
1. Descomprime el ZIP.
2. En GitHub abre la carpeta public. Sube/reemplaza index.html y sw.js, y conserva manifest.json e icons/.
3. Vuelve a la raiz del repositorio y reemplaza server.js.
4. Pulsa Commit changes.
5. En Render abre el servicio y pulsa Manual Deploy > Deploy latest commit.
6. Abre el juego con internet una vez para que el Service Worker descargue la nueva version.

COMO FUNCIONA LA SINCRONIZACION
- Inicia sesion con internet al menos una vez en el dispositivo.
- El perfil se guarda localmente y en Neon mientras hay conexion.
- Si se pierde internet, el progreso offline se guarda en el dispositivo y cada partida/compra se anota en una cola pendiente.
- Al volver internet, la app autentica la cuenta y envia los eventos pendientes automaticamente.
- El servidor calcula las recompensas y procesa cada evento una sola vez. Las compras de personajes y accesorios se aplican despues de las recompensas anteriores, respetando el orden.
- Se sincronizan partidas offline de Bot, Zombies y Arcade. No se acreditan partidas PvP offline.
- Se mantiene un limite de 15 partidas offline sincronizables por cuenta y dia UTC. Las partidas demasiado cortas no reciben recompensas.

LIMITACIONES IMPORTANTES
- El dispositivo debe conservar los datos del sitio. Si borras almacenamiento/cookies del sitio, puedes perder eventos pendientes.
- Multijugador, salas, 1v1, ranking, misiones y operaciones de cuenta requieren internet.
- El progreso offline se puede usar localmente de inmediato; la nube se actualiza al reconectar y validar la cuenta.
- El servidor limita y recalcula recompensas, pero una partida jugada totalmente offline no tiene verificacion autoritativa completa. Por eso se limita la cantidad de partidas offline que se pueden sincronizar.
