import { Pool } from 'pg';

const globalForPg = globalThis as unknown as {
  pgPool?: Pool;
  pgReady?: Promise<void>;
};

export const pool: Pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  });
globalForPg.pgPool = pool;

// Idempotente: crea lo propio de la web y habilita los estados nuevos en pedidos.
async function migrar() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dados_usuarios (
      id serial PRIMARY KEY,
      usuario text UNIQUE NOT NULL,
      nombre text NOT NULL,
      password_hash text NOT NULL,
      activo boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS pedido_historial (
      id serial PRIMARY KEY,
      numero_pedido text NOT NULL,
      estado_anterior text,
      estado_nuevo text NOT NULL,
      usuario text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_pedido_historial_numero
      ON pedido_historial(numero_pedido);
    CREATE INDEX IF NOT EXISTS idx_pedido_historial_fecha
      ON pedido_historial(created_at);

    -- Roles. Si todavia no hay ningun admin, el usuario mas antiguo pasa a serlo.
    ALTER TABLE dados_usuarios ADD COLUMN IF NOT EXISTS rol text NOT NULL DEFAULT 'vendedor';
    UPDATE dados_usuarios SET rol = 'admin'
      WHERE id = (SELECT min(id) FROM dados_usuarios)
        AND NOT EXISTS (SELECT 1 FROM dados_usuarios WHERE rol = 'admin');

    -- Detalle de las modificaciones de productos, y nota visible para el agente.
    ALTER TABLE pedido_historial ADD COLUMN IF NOT EXISTS detalle text;
    ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS nota_staff text;

    -- Si pedidos tuviera un CHECK sobre estado, impediria pagado/listo/entregado.
    DO $$
    DECLARE c record;
    BEGIN
      FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'pedidos'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%estado%'
      LOOP
        EXECUTE format('ALTER TABLE pedidos DROP CONSTRAINT %I', c.conname);
      END LOOP;
    END $$;
  `);
}

export function asegurarEsquema(): Promise<void> {
  if (!globalForPg.pgReady) {
    globalForPg.pgReady = migrar().catch((e) => {
      globalForPg.pgReady = undefined; // reintenta en la proxima request
      throw e;
    });
  }
  return globalForPg.pgReady;
}
