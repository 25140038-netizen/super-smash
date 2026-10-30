# Super Smash Island: versión con administrador privado

## Archivos
- `public/index.html`: juego actualizado con panel oculto de administración.
- `server.js`: autenticación y permisos verificados en el servidor.
- `package.json`: dependencias y arranque.
- `.env.example`: variables necesarias.

## Variables de Render
Conserva `DATABASE_URL`, `SESSION_SECRET` y `NODE_ENV=production`. Agrega `ADMIN_SETUP_KEY` con una clave aleatoria privada de al menos 32 caracteres (recomendado: 48 o más). No la pongas en el HTML, GitHub, capturas ni chats públicos.

Puedes generar una clave con un generador criptográfico de contraseñas. Si tienes Node instalado, ejecuta: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

## Despliegue
Sube el contenido de esta carpeta a la raíz del repositorio conectado a Render, conservando `public/index.html`. No borres ni reinicies la base de datos Neon. Al arrancar, el servidor agrega la columna `role` y crea la tabla de registros administrativos de forma compatible con las cuentas existentes.

## Convertirte en administrador
1. En Render, agrega `ADMIN_SETUP_KEY` con tu clave privada y despliega.
2. Abre el juego e inicia sesión con TU cuenta normal (no modo invitado).
3. Pulsa `Alt + Shift + A` o haz cinco clics rápidos sobre el logotipo superior.
4. Pega la misma clave privada y pulsa **Convertir esta cuenta en admin**.
5. Después de reclamar el puesto, el servidor no permitirá que otra cuenta lo reclame. Puedes quitar `ADMIN_SETUP_KEY` de Render después de confirmar que ya eres admin; tu rol queda guardado en Neon.

## Seguridad
- El rol se guarda en Neon y cada ruta administrativa lo verifica en el servidor.
- Solo existe un puesto de administrador. La reclamación inicial usa bloqueo transaccional para evitar que dos cuentas lo reclamen a la vez.
- Las claves y contraseñas no se guardan en el HTML.
- Las acciones administrativas quedan registradas en `ssi_admin_logs`.
- El panel permite ver las últimas 100 cuentas, añadir 1,000 monedas y desbloquear todos los personajes.
- Los invitados y las cuentas normales no pueden usar estas rutas.

Nota: no incluye expulsión en vivo porque el servidor actual no mantiene una lista de conexiones activas de jugadores; mostrar un botón que no pueda desconectar realmente sería engañoso.
