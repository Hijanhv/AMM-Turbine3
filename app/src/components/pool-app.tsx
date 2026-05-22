"use client";

import { useCallback, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount,
  getMint,
} from "@solana/spl-token";
import BN from "bn.js";
import type { Wallet as AnchorWallet } from "@coral-xyz/anchor";

import { buildProgram, explorerUrl, ProgramHandle } from "../lib/program";
import {
  PROGRAM_ID,
  configPda,
  findAta,
  formatAmount,
  lpMintPda,
  parseAmount,
  shortAddress,
} from "../lib/pool";
import { createTestMint } from "../lib/create-mint";

type Banner = { kind: "ok" | "err"; text: string; tx?: string };

type PoolView = {
  seed: BN;
  config: PublicKey;
  mintLp: PublicKey;
  vaultA: PublicKey;
  vaultB: PublicKey;
  mintA: PublicKey;
  mintB: PublicKey;
  feeBps: number;
  locked: boolean;
  authority: PublicKey | null;
  reserveA: bigint;
  reserveB: bigint;
  lpSupply: bigint;
  userLp: bigint | null;
};

const DECIMALS = 6;

export function PoolApp() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [banner, setBanner] = useState<Banner | null>(null);
  const [busy, setBusy] = useState(false);

  const program = useMemo<ProgramHandle | null>(() => {
    if (!wallet.publicKey || !wallet.signTransaction) return null;
    return buildProgram(connection, wallet as unknown as AnchorWallet);
  }, [connection, wallet]);

  const flash = useCallback((b: Banner) => {
    setBanner(b);
    setTimeout(() => setBanner(null), 12_000);
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 w-full">
      <header className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">AMM</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Constant-product pool on Solana devnet · program{" "}
            <a
              className="underline decoration-dotted"
              href={explorerUrl("address", PROGRAM_ID)}
              target="_blank"
              rel="noreferrer"
            >
              {shortAddress(PROGRAM_ID)}
            </a>
          </p>
        </div>
        <WalletMultiButton />
      </header>

      {banner && (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
            banner.kind === "ok"
              ? "border-emerald-700 bg-emerald-950/40 text-emerald-200"
              : "border-rose-700 bg-rose-950/40 text-rose-200"
          }`}
        >
          {banner.text}
          {banner.tx && (
            <>
              {" "}
              <a
                className="underline"
                href={explorerUrl("tx", banner.tx)}
                target="_blank"
                rel="noreferrer"
              >
                view tx
              </a>
            </>
          )}
        </div>
      )}

      {!wallet.publicKey && (
        <p className="text-zinc-400">
          Connect a wallet (Phantom or Solflare on devnet) to start.
        </p>
      )}

      {wallet.publicKey && program && (
        <Workspace
          program={program}
          busy={busy}
          setBusy={setBusy}
          flash={flash}
          connection={connection}
        />
      )}

      <footer className="mt-16 text-xs text-zinc-500">
        Built from scratch for the Turbine3 cohort. The on-chain program lives
        on devnet; this UI is a thin client. Source on GitHub.
      </footer>
    </main>
  );
}

type WorkspaceProps = {
  program: ProgramHandle;
  busy: boolean;
  setBusy: (b: boolean) => void;
  flash: (b: Banner) => void;
  connection: ReturnType<typeof useConnection>["connection"];
};

function Workspace({ program, busy, setBusy, flash, connection }: WorkspaceProps) {
  const wallet = useWallet();
  const [seedInput, setSeedInput] = useState("");
  const [pool, setPool] = useState<PoolView | null>(null);
  const [poolError, setPoolError] = useState<string | null>(null);

  const loadPool = useCallback(
    async (seedStr: string) => {
      setPoolError(null);
      if (!seedStr.trim()) {
        setPool(null);
        return;
      }
      let seed: BN;
      try {
        seed = new BN(seedStr.trim(), 10);
      } catch {
        setPoolError("Seed must be a non-negative integer.");
        return;
      }
      const config = configPda(seed);
      try {
        // Fetch returns null if the account doesn't exist; throw means decode error.
        const cfg = await program.account.config.fetchNullable(config);
        if (!cfg) {
          setPool(null);
          setPoolError(
            `No pool found for seed ${seed.toString()} (config ${shortAddress(config)}).`,
          );
          return;
        }
        const mintLp = lpMintPda(config);
        const vaultA = findAta(cfg.mintA, config);
        const vaultB = findAta(cfg.mintB, config);

        const [vaA, vaB, lpMintInfo] = await Promise.all([
          getAccount(connection, vaultA).catch(() => null),
          getAccount(connection, vaultB).catch(() => null),
          getMint(connection, mintLp).catch(() => null),
        ]);

        let userLp: bigint | null = null;
        if (wallet.publicKey) {
          const userLpAta = findAta(mintLp, wallet.publicKey);
          const acc = await getAccount(connection, userLpAta).catch(() => null);
          userLp = acc ? acc.amount : 0n;
        }

        setPool({
          seed,
          config,
          mintLp,
          vaultA,
          vaultB,
          mintA: cfg.mintA,
          mintB: cfg.mintB,
          feeBps: cfg.feeBps,
          locked: cfg.locked,
          authority: cfg.authority,
          reserveA: vaA ? vaA.amount : 0n,
          reserveB: vaB ? vaB.amount : 0n,
          lpSupply: lpMintInfo ? lpMintInfo.supply : 0n,
          userLp,
        });
      } catch (err) {
        setPool(null);
        setPoolError((err as Error).message);
      }
    },
    [program, connection, wallet.publicKey],
  );

  const refresh = useCallback(() => {
    if (pool) void loadPool(pool.seed.toString());
  }, [pool, loadPool]);

  return (
    <div className="space-y-8">
      <Section title="1. Initialize a pool">
        <InitializeForm
          program={program}
          busy={busy}
          setBusy={setBusy}
          flash={flash}
          onCreated={(seed) => {
            setSeedInput(seed.toString());
            void loadPool(seed.toString());
          }}
        />
      </Section>

      <Section title="2. Load an existing pool">
        <div className="flex gap-2">
          <input
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
            placeholder="seed (u64, e.g. 42)"
            className="flex-1 rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm"
          />
          <button
            className="rounded-md bg-zinc-100 text-zinc-900 px-4 py-2 text-sm font-medium disabled:opacity-50"
            disabled={busy}
            onClick={() => void loadPool(seedInput)}
          >
            Load
          </button>
        </div>
        {poolError && (
          <p className="text-rose-400 text-sm mt-2">{poolError}</p>
        )}
      </Section>

      {pool && (
        <>
          <PoolCard pool={pool} onRefresh={refresh} />

          <Section title="Deposit">
            <DepositForm
              program={program}
              pool={pool}
              busy={busy}
              setBusy={setBusy}
              flash={flash}
              onDone={refresh}
            />
          </Section>

          <Section title="Swap">
            <SwapForm
              program={program}
              pool={pool}
              busy={busy}
              setBusy={setBusy}
              flash={flash}
              onDone={refresh}
            />
          </Section>

          <Section title="Withdraw">
            <WithdrawForm
              program={program}
              pool={pool}
              busy={busy}
              setBusy={setBusy}
              flash={flash}
              onDone={refresh}
            />
          </Section>

          <Section title="Lock / unlock (authority only)">
            <LockControls
              program={program}
              pool={pool}
              busy={busy}
              setBusy={setBusy}
              flash={flash}
              onDone={refresh}
            />
          </Section>
        </>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

function PoolCard({
  pool,
  onRefresh,
}: {
  pool: PoolView;
  onRefresh: () => void;
}) {
  const price =
    pool.reserveA > 0n
      ? Number(pool.reserveB) / Number(pool.reserveA)
      : null;
  return (
    <Section title="Pool state">
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-y-2 text-sm">
        <div>
          <dt className="text-zinc-500">Config</dt>
          <dd className="font-mono">{shortAddress(pool.config)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">LP mint</dt>
          <dd className="font-mono">{shortAddress(pool.mintLp)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Mint A</dt>
          <dd className="font-mono">{shortAddress(pool.mintA)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Mint B</dt>
          <dd className="font-mono">{shortAddress(pool.mintB)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Reserve A</dt>
          <dd>{formatAmount(pool.reserveA, DECIMALS)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Reserve B</dt>
          <dd>{formatAmount(pool.reserveB, DECIMALS)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">LP supply</dt>
          <dd>{formatAmount(pool.lpSupply, DECIMALS)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Your LP</dt>
          <dd>
            {pool.userLp === null
              ? "—"
              : formatAmount(pool.userLp, DECIMALS)}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Fee</dt>
          <dd>{(pool.feeBps / 100).toFixed(2)}%</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Status</dt>
          <dd>
            {pool.locked ? (
              <span className="text-amber-400">Locked</span>
            ) : (
              <span className="text-emerald-400">Active</span>
            )}
          </dd>
        </div>
        <div className="md:col-span-2">
          <dt className="text-zinc-500">Price (B per A)</dt>
          <dd>{price === null ? "—" : price.toFixed(6)}</dd>
        </div>
      </dl>
      <div className="mt-4">
        <button
          className="text-xs text-zinc-400 underline decoration-dotted"
          onClick={onRefresh}
        >
          Refresh
        </button>
      </div>
    </Section>
  );
}

function InitializeForm({
  program,
  busy,
  setBusy,
  flash,
  onCreated,
}: {
  program: ProgramHandle;
  busy: boolean;
  setBusy: (b: boolean) => void;
  flash: (b: Banner) => void;
  onCreated: (seed: BN) => void;
}) {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [seed, setSeed] = useState(() =>
    Math.floor(Math.random() * 1_000_000).toString(),
  );
  const [mintA, setMintA] = useState("");
  const [mintB, setMintB] = useState("");
  const [feeBps, setFeeBps] = useState("30");

  const createTestMints = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    setBusy(true);
    try {
      const initial = 1_000_000n * 10n ** 6n; // 1,000,000 tokens at 6 decimals
      const a = await createTestMint(connection, wallet, 6, initial);
      const b = await createTestMint(connection, wallet, 6, initial);
      setMintA(a.mint.toBase58());
      setMintB(b.mint.toBase58());
      flash({
        kind: "ok",
        text: "Minted 1,000,000 of each test token to your wallet.",
        tx: b.signature,
      });
    } catch (err) {
      flash({ kind: "err", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async () => {
    if (!wallet.publicKey) return;
    setBusy(true);
    try {
      const seedBn = new BN(seed.trim(), 10);
      const mintAPk = new PublicKey(mintA.trim());
      const mintBPk = new PublicKey(mintB.trim());
      const cfg = configPda(seedBn);
      const lp = lpMintPda(cfg);
      const vA = findAta(mintAPk, cfg);
      const vB = findAta(mintBPk, cfg);

      const tx = await program.methods
        .initialize(seedBn, Number(feeBps), wallet.publicKey)
        .accountsPartial({
          initializer: wallet.publicKey,
          mintA: mintAPk,
          mintB: mintBPk,
          config: cfg,
          mintLp: lp,
          vaultA: vA,
          vaultB: vB,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      flash({
        kind: "ok",
        text: `Pool initialized with seed ${seedBn.toString()}.`,
        tx,
      });
      onCreated(seedBn);
    } catch (err) {
      flash({ kind: "err", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-3">
      <Field label="Seed (u64)">
        <input
          className="input"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
        />
      </Field>
      <div className="flex items-center justify-between rounded-md border border-dashed border-zinc-700 px-3 py-2">
        <span className="text-xs text-zinc-400">
          Don&apos;t have SPL mints? Create two fresh devnet tokens funded to
          your wallet.
        </span>
        <button
          disabled={busy}
          onClick={createTestMints}
          className="rounded-md bg-zinc-100 text-zinc-900 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          Create test mints
        </button>
      </div>
      <Field label="Mint A">
        <input
          className="input font-mono"
          value={mintA}
          onChange={(e) => setMintA(e.target.value)}
          placeholder="pubkey"
        />
      </Field>
      <Field label="Mint B">
        <input
          className="input font-mono"
          value={mintB}
          onChange={(e) => setMintB(e.target.value)}
          placeholder="pubkey"
        />
      </Field>
      <Field label="Fee (bps, max 9999)">
        <input
          className="input"
          value={feeBps}
          type="number"
          onChange={(e) => setFeeBps(e.target.value)}
        />
      </Field>
      <button
        disabled={busy}
        onClick={onSubmit}
        className="rounded-md bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium px-4 py-2 text-sm disabled:opacity-50"
      >
        Initialize
      </button>
      <p className="text-xs text-zinc-500">
        You become the pool authority and can lock/unlock trading.
      </p>
    </div>
  );
}

function DepositForm({
  program,
  pool,
  busy,
  setBusy,
  flash,
  onDone,
}: {
  program: ProgramHandle;
  pool: PoolView;
  busy: boolean;
  setBusy: (b: boolean) => void;
  flash: (b: Banner) => void;
  onDone: () => void;
}) {
  const wallet = useWallet();
  const [amountA, setAmountA] = useState("");
  const [maxB, setMaxB] = useState("");

  const submit = async () => {
    if (!wallet.publicKey) return;
    setBusy(true);
    try {
      const a = parseAmount(amountA, DECIMALS);
      const b = parseAmount(maxB, DECIMALS);
      const tx = await program.methods
        .deposit(a, b, new BN(0))
        .accountsPartial({
          user: wallet.publicKey,
          mintA: pool.mintA,
          mintB: pool.mintB,
          config: pool.config,
          mintLp: pool.mintLp,
          vaultA: pool.vaultA,
          vaultB: pool.vaultB,
          userAtaA: findAta(pool.mintA, wallet.publicKey),
          userAtaB: findAta(pool.mintB, wallet.publicKey),
          userAtaLp: findAta(pool.mintLp, wallet.publicKey),
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      flash({ kind: "ok", text: "Deposit confirmed.", tx });
      onDone();
    } catch (err) {
      flash({ kind: "err", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-3">
      <Field label="Amount A (decimal)">
        <input
          className="input"
          value={amountA}
          onChange={(e) => setAmountA(e.target.value)}
          placeholder="100"
        />
      </Field>
      <Field label="Max B to spend">
        <input
          className="input"
          value={maxB}
          onChange={(e) => setMaxB(e.target.value)}
          placeholder="400"
        />
      </Field>
      <button
        disabled={busy}
        onClick={submit}
        className="rounded-md bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium px-4 py-2 text-sm disabled:opacity-50"
      >
        Deposit
      </button>
      <p className="text-xs text-zinc-500">
        On the very first deposit, &ldquo;Max B&rdquo; defines the initial
        price.
      </p>
    </div>
  );
}

function SwapForm({
  program,
  pool,
  busy,
  setBusy,
  flash,
  onDone,
}: {
  program: ProgramHandle;
  pool: PoolView;
  busy: boolean;
  setBusy: (b: boolean) => void;
  flash: (b: Banner) => void;
  onDone: () => void;
}) {
  const wallet = useWallet();
  const [amountIn, setAmountIn] = useState("");
  const [minOut, setMinOut] = useState("0");
  const [aToB, setAToB] = useState(true);

  const submit = async () => {
    if (!wallet.publicKey) return;
    setBusy(true);
    try {
      const tx = await program.methods
        .swap(parseAmount(amountIn, DECIMALS), parseAmount(minOut, DECIMALS), aToB)
        .accountsPartial({
          user: wallet.publicKey,
          mintA: pool.mintA,
          mintB: pool.mintB,
          config: pool.config,
          vaultA: pool.vaultA,
          vaultB: pool.vaultB,
          userAtaA: findAta(pool.mintA, wallet.publicKey),
          userAtaB: findAta(pool.mintB, wallet.publicKey),
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      flash({ kind: "ok", text: "Swap confirmed.", tx });
      onDone();
    } catch (err) {
      flash({ kind: "err", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="flex gap-2 text-sm">
        <button
          onClick={() => setAToB(true)}
          className={`flex-1 rounded-md px-3 py-2 border ${
            aToB
              ? "border-emerald-500 bg-emerald-500/10"
              : "border-zinc-800 hover:border-zinc-700"
          }`}
        >
          A → B
        </button>
        <button
          onClick={() => setAToB(false)}
          className={`flex-1 rounded-md px-3 py-2 border ${
            !aToB
              ? "border-emerald-500 bg-emerald-500/10"
              : "border-zinc-800 hover:border-zinc-700"
          }`}
        >
          B → A
        </button>
      </div>
      <Field label="Amount in">
        <input
          className="input"
          value={amountIn}
          onChange={(e) => setAmountIn(e.target.value)}
          placeholder="10"
        />
      </Field>
      <Field label="Minimum out (slippage floor)">
        <input
          className="input"
          value={minOut}
          onChange={(e) => setMinOut(e.target.value)}
        />
      </Field>
      <button
        disabled={busy}
        onClick={submit}
        className="rounded-md bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium px-4 py-2 text-sm disabled:opacity-50"
      >
        Swap
      </button>
    </div>
  );
}

function WithdrawForm({
  program,
  pool,
  busy,
  setBusy,
  flash,
  onDone,
}: {
  program: ProgramHandle;
  pool: PoolView;
  busy: boolean;
  setBusy: (b: boolean) => void;
  flash: (b: Banner) => void;
  onDone: () => void;
}) {
  const wallet = useWallet();
  const [lpAmount, setLpAmount] = useState("");

  const submit = async () => {
    if (!wallet.publicKey) return;
    setBusy(true);
    try {
      const tx = await program.methods
        .withdraw(parseAmount(lpAmount, DECIMALS), new BN(0), new BN(0))
        .accountsPartial({
          user: wallet.publicKey,
          mintA: pool.mintA,
          mintB: pool.mintB,
          config: pool.config,
          mintLp: pool.mintLp,
          vaultA: pool.vaultA,
          vaultB: pool.vaultB,
          userAtaA: findAta(pool.mintA, wallet.publicKey),
          userAtaB: findAta(pool.mintB, wallet.publicKey),
          userAtaLp: findAta(pool.mintLp, wallet.publicKey),
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      flash({ kind: "ok", text: "Withdraw confirmed.", tx });
      onDone();
    } catch (err) {
      flash({ kind: "err", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-3">
      <Field label="LP tokens to burn">
        <input
          className="input"
          value={lpAmount}
          onChange={(e) => setLpAmount(e.target.value)}
          placeholder="50"
        />
      </Field>
      <button
        disabled={busy}
        onClick={submit}
        className="rounded-md bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium px-4 py-2 text-sm disabled:opacity-50"
      >
        Withdraw
      </button>
    </div>
  );
}

function LockControls({
  program,
  pool,
  busy,
  setBusy,
  flash,
  onDone,
}: {
  program: ProgramHandle;
  pool: PoolView;
  busy: boolean;
  setBusy: (b: boolean) => void;
  flash: (b: Banner) => void;
  onDone: () => void;
}) {
  const wallet = useWallet();
  const isAuthority =
    wallet.publicKey && pool.authority?.equals(wallet.publicKey);

  const call = async (kind: "lock" | "unlock") => {
    if (!wallet.publicKey) return;
    setBusy(true);
    try {
      const builder = kind === "lock" ? program.methods.lock() : program.methods.unlock();
      const tx = await builder
        .accountsPartial({
          authority: wallet.publicKey,
          config: pool.config,
        })
        .rpc();
      flash({ kind: "ok", text: `Pool ${kind}ed.`, tx });
      onDone();
    } catch (err) {
      flash({ kind: "err", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  if (!isAuthority) {
    return (
      <p className="text-sm text-zinc-500">
        Only the configured authority{" "}
        <span className="font-mono">
          {pool.authority ? shortAddress(pool.authority) : "(none)"}
        </span>{" "}
        can lock or unlock this pool.
      </p>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        disabled={busy || pool.locked}
        onClick={() => void call("lock")}
        className="rounded-md bg-amber-500 hover:bg-amber-400 text-zinc-950 font-medium px-4 py-2 text-sm disabled:opacity-50"
      >
        Lock
      </button>
      <button
        disabled={busy || !pool.locked}
        onClick={() => void call("unlock")}
        className="rounded-md bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium px-4 py-2 text-sm disabled:opacity-50"
      >
        Unlock
      </button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
