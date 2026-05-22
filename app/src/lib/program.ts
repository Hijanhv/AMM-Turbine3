import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import type { Amm } from "./amm-types";
import idl from "./amm-idl.json";

export function buildProgram(
  connection: Connection,
  wallet: AnchorProvider["wallet"],
): Program<Amm> {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  return new Program<Amm>(idl as Amm, provider);
}

export type ProgramHandle = Program<Amm>;

export const DEVNET_EXPLORER = "https://explorer.solana.com";

export function explorerUrl(
  kind: "address" | "tx",
  value: string | PublicKey,
  cluster = "devnet",
): string {
  const v = typeof value === "string" ? value : value.toBase58();
  return `${DEVNET_EXPLORER}/${kind}/${v}?cluster=${cluster}`;
}
