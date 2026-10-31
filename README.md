# Pedidos · Dados

Panel web para que el personal gestione los pedidos que el bot (n8n) guarda en la tabla `pedidos`.
Flujo de estados: **Por cobrar (confirmado) → Pagado → Listo → Entregado**. Se puede deshacer un paso.

## Variables de entorno
- `DATABASE_URL`: la misma base Postgres de la credencial "API Postgres" de n8n.
- `SESSION_SECRET`: 32+ caracteres aleatorios.

## Despliegue en Easypanel
1. Crear un servicio **App** nuevo en el mismo proyecto que n8n (así usa la red interna para llegar a Postgres).
2. Origen: repo Git con esta carpeta, o subir el código. Build: **Dockerfile**. Puerto: **3000**.
3. Cargar las variables de entorno. En `DATABASE_URL` usar el host interno del servicio Postgres.
4. Asignar dominio con HTTPS (la cookie de sesión es `secure` en producción).
5. Crear el primer usuario desde la consola del servicio:
   `node scripts/crear-usuario.mjs maria "María" "una-clave-de-8+"`
   (repetir para cada persona; si el usuario existe, resetea su clave).

Al primer uso la app crea `dados_usuarios` y `pedido_historial`, y quita cualquier `CHECK` sobre
`pedidos.estado` que impida los estados nuevos. No modifica el resto de la tabla.

## Qué hace el bot ahora
- `mis_pedidos` y `ver_pedido` muestran el estado actual.
- Pedidos en `pagado`, `listo` o `entregado` no se pueden modificar ni eliminar desde el chat.

## Desarrollo local
`cp .env.example .env.local`, completar, `npm install`, `npm run dev`.
