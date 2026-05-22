import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";

export type CreatedMint = {
  mint: PublicKey;
  ata: PublicKey;
  signature: string;
};

/**
 * Creates a fresh SPL mint, the user's ATA, and an initial balance in a
 * single transaction. The wallet signs as fee payer; a new keypair signs as
 * the mint account.
 */
export async function createTestMint(
  connection: Connection,
  wallet: WalletContextState,
  decimals: number,
  mintAmount: bigint,
): Promise<CreatedMint> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }

  const mintKp = Keypair.generate();
  const ata = getAssociatedTokenAddressSync(
    mintKp.publicKey,
    wallet.publicKey,
  );
  const rent = await getMinimumBalanceForRentExemptMint(connection);

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: mintKp.publicKey,
      space: MINT_SIZE,
      lamports: rent,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMint2Instruction(
      mintKp.publicKey,
      decimals,
      wallet.publicKey,
      null,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      wallet.publicKey,
      ata,
      wallet.publicKey,
      mintKp.publicKey,
    ),
    createMintToInstruction(
      mintKp.publicKey,
      ata,
      wallet.publicKey,
      mintAmount,
    ),
  );

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet.publicKey;
  tx.partialSign(mintKp);

  const signed = await wallet.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );

  return { mint: mintKp.publicKey, ata, signature };
}
