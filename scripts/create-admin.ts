import "dotenv/config";
import { auth } from "../lib/auth";

/**
 * Creates an admin account (the couple). Public sign-up is disabled, so this is
 * the only way in.
 *
 *   npm run admin:create -- "Gabriel" gabriel@example.com "senha-secreta"
 */
async function main() {
  const [name, email, password] = process.argv.slice(2);

  if (!name || !email || !password) {
    console.error(
      'Uso: npm run admin:create -- "Nome" email@exemplo.com "senha"',
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("A senha precisa ter pelo menos 8 caracteres.");
    process.exit(1);
  }

  const ctx = await auth.$context;

  const existing = await ctx.internalAdapter.findUserByEmail(email);
  if (existing) {
    console.error(`Já existe uma conta com o e-mail ${email}.`);
    process.exit(1);
  }

  const user = await ctx.internalAdapter.createUser({
    name,
    email,
    emailVerified: true,
  });

  await ctx.internalAdapter.createAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: await ctx.password.hash(password),
  });

  console.log(`Admin criado: ${user.email} (${user.id})`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
