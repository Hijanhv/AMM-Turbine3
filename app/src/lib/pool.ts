import { PublicKey } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import BN from "bn.js";

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ??
    "4DmfmgZHzg7aTC11qaZGc7WsbiA7hjtgLU4TpePrSB3v",
);

export const CONFIG_SEED = Buffer.from("config");
export const LP_SEED = Buffer.from("lp");

export function configPda(seed: BN): PublicKey {
  return PublicKey.findProgramAddressSync(
    [CONFIG_SEED, seed.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID,
  )[0];
}

export function lpMintPda(config: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [LP_SEED, config.toBuffer()],
    PROGRAM_ID,
  )[0];
}

export function findAta(mint: PublicKey, owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

export function shortAddress(pk: PublicKey | string): string {
  const s = typeof pk === "string" ? pk : pk.toBase58();
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

export function formatAmount(raw: bigint | BN | string, decimals = 6): string {
  const big = typeof raw === "bigint" ? raw : BigInt(raw.toString());
  const denom = 10n ** BigInt(decimals);
  const whole = big / denom;
  const frac = big % denom;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole.toString()}.${fracStr}`;
}

export function parseAmount(input: string, decimals = 6): BN {
  if (!input.trim()) return new BN(0);
  const [whole, frac = ""] = input.trim().split(".");
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const joined = `${whole || "0"}${padded}`.replace(/^0+(?=\d)/, "");
  return new BN(joined || "0");
}
