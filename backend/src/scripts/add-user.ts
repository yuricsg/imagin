import "dotenv/config";
import { getPrisma } from "../db.js";
import { UserRepository } from "../users/user-repository.js";

/**
 * Provisions (or updates) a dashboard operator.
 *
 *   npm run user:add -- <email> <senha> ["Nome opcional"]
 *
 * Re-running with an existing email resets that user's password.
 */
async function main() {
  const [email, password, name] = process.argv.slice(2);

  if (!email || !password) {
    console.error(
      'Uso: npm run user:add -- <email> <senha> ["Nome opcional"]',
    );
    process.exit(1);
  }
  if (!email.includes("@")) {
    console.error(`E-mail inválido: ${email}`);
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("A senha precisa ter ao menos 6 caracteres.");
    process.exit(1);
  }

  const users = new UserRepository(getPrisma());
  const user = await users.upsert(email, password, name);
  console.log(`Usuário pronto: ${user.email}${user.name ? ` (${user.name})` : ""}`);
}

main()
  .catch((err) => {
    console.error("Falha ao cadastrar usuário:", err);
    process.exit(1);
  })
  .then(() => process.exit(0));
