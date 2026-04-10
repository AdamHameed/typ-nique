import { getServerEnv } from "./lib/env";

export async function register() {
  getServerEnv();
}
