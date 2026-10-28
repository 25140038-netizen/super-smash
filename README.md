# Super Smash Island Cloud

Versión de Super Smash Island preparada para ejecutarse como una aplicación web en la nube. Incluye registro, inicio de sesión, nombres de cuenta únicos, sesión persistente y perfil compartido entre dispositivos. Esta entrega **no incluye personaje admin, permisos de admin ni botón para saltar oleadas**.

## Qué contiene

- `public/index.html`: juego y pantalla de inicio de sesión/registro.
- `server.js`: servidor Node.js/Express, API de cuentas, sesiones, compras, recompensas y ranking.
- PostgreSQL: guarda cuentas, contraseñas cifradas con hash, monedas, copas, victorias, personajes desbloqueados, personaje equipado y ajustes.
- Sesiones con cookie `HttpOnly`, `SameSite=Lax` y duración de hasta 30 días.
- Restricción única de nombre por base de datos, sin distinguir mayúsculas de minúsculas. `JugadorX` y `jugadorx` cuentan como el mismo nombre.
- El navegador no puede actualizar directamente las monedas, las copas, las victorias ni los personajes desbloqueados mediante el endpoint de ajustes. Las compras y las recompensas se procesan en rutas del servidor.

## Lo que debes saber antes de usarla

1. **No está publicada en internet todavía.** Este paquete es el código preparado para desplegar. No contiene una base de datos en producción ni un dominio.
2. Cada dispositivo inicia sesión una vez. Luego carga de la nube el mismo progreso de esa cuenta. Las cookies de sesión no se comparten automáticamente entre dispositivos.
3. Las cuentas comienzan con 0 monedas/copas, 0 victorias y Guerrero Base. No se importa el perfil antiguo de `localStorage`, porque esos datos se podían editar desde el navegador. Los ajustes de controles se guardan en la nube después de cambiar/guardar los controles.
4. Las compras, monedas y copas se guardan desde el servidor. Aun así, los combates se simulan en el navegador y el cliente comunica el resultado. Este paquete reduce la manipulación fácil y evita editar balances directamente por el endpoint de perfil, pero **no es un sistema anti-trampas completo**. Para verificar honestamente cada victoria se necesita que el servidor también sea autoridad de la simulación de combate.
5. El modo multijugador existente sigue usando PeerJS y un broker MQTT público para emparejamiento. La cuenta y el nombre registrado son únicos en la base de datos, pero el protocolo P2P existente no valida todavía una identidad firmada del servidor en cada paquete de jugador. Para impedir también la suplantación de nombres dentro de una partida, se debe migrar el emparejamiento a un servicio autenticado.
6. No hay recuperación de contraseña por correo electrónico en esta primera versión. Guarda la contraseña de tu cuenta de forma privada.

## Ejecutar localmente

Necesitas Node.js 20 o posterior y una base de datos PostgreSQL accesible. Esta versión requiere PostgreSQL para que las cuentas no desaparezcan al reiniciar el servidor.

1. Crea una base de datos PostgreSQL. Puedes usar una base local o una base administrada como Neon.
2. Copia `.env.example` a un archivo llamado `.env`.
3. Completa `DATABASE_URL` con la URL de conexión a PostgreSQL. En producción usa la URL SSL del proveedor (`sslmode=require`).
4. Cambia `SESSION_SECRET` por una cadena aleatoria larga y privada. Nunca publiques `.env` ni compartas ese secreto.
5. En la carpeta del proyecto ejecuta:

   ```bash
   npm install
   npm start
   ```

6. Abre `http://localhost:3000`. Crea una cuenta. Para probar la persistencia, inicia sesión con esa misma cuenta desde otro navegador/dispositivo apuntando al mismo servidor.

La primera ejecución crea las tablas `ssi_users`, `ssi_matches` y la tabla de sesiones. No necesitas ejecutar SQL manualmente.

## Publicar en la nube (ejemplo Render + Neon)

### A. Crear la base de datos

1. Crea un proyecto PostgreSQL en Neon.
2. En el panel de Neon pulsa **Connect** y copia la URL de conexión. Usa la cadena con SSL (`sslmode=require`). Para detalles, consulta la guía oficial: https://neon.com/docs/get-started/connect-neon
3. Mantén esa URL privada. No la pegues en `index.html` ni en un repositorio público.

### B. Publicar el servidor

1. Sube la carpeta completa del proyecto a un repositorio GitHub tuyo. No subas `.env` ni contraseñas.
2. En Render crea un **Web Service** conectado a ese repositorio.
3. Usa estos comandos:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. En **Environment**, añade:
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = la URL privada de Neon
   - `SESSION_SECRET` = una cadena aleatoria larga y privada (mínimo 32 caracteres)
5. Inicia el despliegue y espera a que Render indique que el servicio está activo.
6. Abre la dirección `https://...onrender.com` que Render asigna. Prueba registrar dos cuentas con el mismo nombre variando solo mayúsculas/minúsculas: la segunda debe ser rechazada. Después inicia sesión en otro dispositivo y comprueba que carga el mismo progreso.

Referencias oficiales: https://render.com/docs/web-services y https://render.com/docs/configure-environment-variables

## Pruebas que conviene hacer antes de compartirlo

- Registrar una cuenta y comprobar que el nombre duplicado se rechaza incluso si cambian las mayúsculas.
- Recargar la página, cerrar/abrir el navegador y confirmar que la sesión permanece activa.
- Iniciar sesión en otro dispositivo y comparar monedas, copas, victorias y personajes.
- Comprar un personaje con saldo suficiente y después intentar comprar otro sin saldo.
- Confirmar que una compra rechazada no cambia las monedas.
- Cerrar sesión y verificar que se vuelve a pedir inicio de sesión.
- Probar combate contra bot, Zombies y multijugador; comparar los datos de recompensa que muestra la pantalla con el saldo de la cuenta.
- Probar una desconexión de red durante la partida; si el servidor no puede guardar el resultado, la interfaz lo indica.

## Diagnóstico

- Si aparece “No se pudo conectar al servidor”, comprueba que el servicio esté activo y que `DATABASE_URL` sea correcta.
- Si el servidor no arranca, revisa los logs de Render y asegúrate de que `SESSION_SECRET` esté definido en producción.
- `/api/health` debe responder con `{"ok":true,"database":"connected"}` cuando la base está disponible.
