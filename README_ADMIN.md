# Super Smash Island: administrador privado (acceso sencillo)

## Archivos
- `public/index.html`: juego con un botón discreto de candado en la esquina inferior derecha para abrir el panel.
- `server.js`: autenticación y permisos verificados en el servidor.
- `package.json`: dependencias y comando de inicio.
- `.env.example`: variables de ejemplo.

## Instalar
1. Haz una copia de seguridad de tu repositorio actual.
2. Reemplaza los archivos del proyecto por los de esta carpeta, conservando la estructura: `server.js`, `package.json` y `public/index.html`.
3. En Render conserva `DATABASE_URL`, `SESSION_SECRET` y `NODE_ENV=production`. Agrega `ADMIN_SETUP_KEY` con una clave aleatoria privada de al menos 32 caracteres. No la publiques en GitHub ni la compartas.
4. Despliega y espera a que Render indique que el servicio está activo. No borres ni reinicies Neon.

## Activar tu cuenta
1. Abre el juego e inicia sesión con tu cuenta normal de la nube. No uses invitado.
2. Pulsa el botón pequeño de candado en la esquina inferior derecha. Ya no necesitas `Alt + Shift + A` ni hacer clics repetidos en el logo.
3. Si todavía no existe un administrador y `ADMIN_SETUP_KEY` está configurada, aparecerá el formulario para introducir esa clave.
4. Escribe la misma clave configurada en Render y pulsa **Convertir esta cuenta en admin**.
5. Comprueba que se abra el panel. Después puedes quitar `ADMIN_SETUP_KEY` de Render y desplegar otra vez. El permiso ya guardado en Neon permanece.

## Seguridad
- El botón solo abre la interfaz; no concede permisos.
- El servidor verifica la sesión y el rol en Neon en cada ruta administrativa.
- Solo se puede reclamar un puesto de administrador.
- El nombre de usuario no concede permisos.
- Las acciones administrativas se registran.
- No incluye expulsión en vivo porque este servidor no mantiene conexiones activas de jugadores.
