import postgres from "postgres";

export function isolatedDatabase(name: string) {
  const serverUrl = process.env.TEST_DATABASE_URL;
  const databaseName = `${name}_${process.pid}`;
  const url = serverUrl && Object.assign(new URL(serverUrl), { pathname: `/${databaseName}` }).toString();

  async function withServer(statement: string) {
    const admin = postgres(serverUrl!, { max: 1 });
    try {
      await admin.unsafe(statement);
    } finally {
      await admin.end();
    }
  }

  return {
    url,
    create: async () => {
      await withServer(`drop database if exists ${databaseName} with (force)`);
      await withServer(`create database ${databaseName}`);
    },
    drop: () => withServer(`drop database if exists ${databaseName} with (force)`),
  };
}
