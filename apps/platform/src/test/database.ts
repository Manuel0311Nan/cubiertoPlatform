/** Los tests de integración necesitan una base migrada y exclusiva para tests. */
export function requireTestDatabase(): void {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error(
      "Falta TEST_DATABASE_URL: una base de datos migrada solo para tests (en Neon, la rama `test`). " +
        "Añádela al .env de la raíz y ejecuta `pnpm db:migrate:test`.",
    );
  }
}

/** Sufijo único para que los datos de un test no choquen con otros ni con el seed. */
export function uniqueSuffix(): string {
  return crypto.randomUUID().slice(0, 8);
}
