// Uso: node scripts/crear-usuario.mjs <usuario> "<Nombre visible>" <password> [admin|vendedor]
// Si el usuario ya existe, le cambia nombre y contraseña (sirve para resetear).
import pg from 'pg';
import bcrypt from 'bcryptjs';

const [usuario, nombre, password, rolArg = 'vendedor'] = process.argv.slice(2);
if (!usuario || !nombre || !password) {
  console.error('Uso: node scripts/crear-usuario.mjs <usuario> "<Nombre>" <password> [admin|vendedor]');
  process.exit(1);
}
if (rolArg !== 'admin' && rolArg !== 'vendedor') {
  console.error('El rol debe ser admin o vendedor.');
  process.exit(1);
}
if (password.length < 8) {
  console.error('La contraseña debe tener al menos 8 caracteres.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL.');
  process.exit(1);
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await db.query(`
  CREATE TABLE IF NOT EXISTS dados_usuarios (
    id serial PRIMARY KEY,
    usuario text UNIQUE NOT NULL,
    nombre text NOT NULL,
    password_hash text NOT NULL,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
await db.query("ALTER TABLE dados_usuarios ADD COLUMN IF NOT EXISTS rol text NOT NULL DEFAULT 'vendedor'");
const hash = await bcrypt.hash(password, 10);
await db.query(
  `INSERT INTO dados_usuarios (usuario, nombre, password_hash, rol)
   VALUES ($1, $2, $3, $4)
   ON CONFLICT (usuario) DO UPDATE
     SET nombre = EXCLUDED.nombre, password_hash = EXCLUDED.password_hash, rol = EXCLUDED.rol, activo = true`,
  [usuario.toLowerCase(), nombre, hash, rolArg]
);
await db.end();
console.log(`Usuario "${usuario.toLowerCase()}" listo (${rolArg}).`);
