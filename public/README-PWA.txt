SUPER SMASH ISLAND CLOUD - PWA

INSTALACIÓN EN RENDER
1. Descomprime este ZIP.
2. Conserva server.js y el resto del proyecto que ya tienes.
3. Reemplaza tu carpeta public por la carpeta public incluida aquí, o copia estos archivos a las mismas rutas:
   - public/index.html
   - public/manifest.json
   - public/sw.js
   - public/icons/icon-192.png
   - public/icons/icon-512.png
   - public/icons/apple-touch-icon.png
4. Haz un deploy en Render y abre el sitio mediante HTTPS.

El botón de instalación está en el menú principal, justo debajo de Multijugador. En iPhone/iPad muestra los pasos de Safari. En Android y navegadores compatibles de PC usa beforeinstallprompt.

NOTAS
- No se modificó server.js ni la base de datos.
- La caché guarda la interfaz y recursos estáticos que el jugador ya haya descargado. La primera visita requiere internet.
- Salas, 1v1, inicio de sesión, rankings y demás funciones que dependen del servidor requieren conexión.
- Las librerías CDN externas se guardan en caché después de cargarse correctamente al menos una vez con internet.
