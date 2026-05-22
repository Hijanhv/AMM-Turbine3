"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((b: Banner) => {
    if (bannerTimer.current) {
      clearTimeout(bannerTimer.current);
    }
    setBanner(b);
    bannerTimer.current = setTimeout(() => setBanner(null), 12_000);
  }, []);

  useEffect(
    () => () => {
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    },
    [],
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 w-full">
      <header className="flex items-center justify-between mb-12 animate-rise">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              AMM
              <span className="ml-2 text-xs font-normal text-zinc-500 uppercase tracking-widest">
                Turbine3
              </span>
            </h1>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-emerald-400" />
                devnet
              </span>
              <span className="text-zinc-700">·</span>
              <a
                className="font-mono hover:text-emerald-300 transition-colors"
                href={explorerUrl("address", PROGRAM_ID)}
                target="_blank"
                rel="noreferrer"
              >
                {shortAddress(PROGRAM_ID)}
              </a>
            </div>
          </div>
        </div>
        <WalletMultiButton />
      </header>

      {banner && (
        <div
          className={`mb-6 rounded-xl border px-4 py-3 text-sm backdrop-blur animate-rise ${
            banner.kind === "ok"
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-200"
              : "border-rose-500/30 bg-rose-500/5 text-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.kind === "ok" ? (
              <CheckIcon className="w-4 h-4 shrink-0" />
            ) : (
              <AlertIcon className="w-4 h-4 shrink-0" />
            )}
            <span className="flex-1">{banner.text}</span>
            {banner.tx && (
              <a
                className="underline decoration-dotted hover:opacity-80"
                href={explorerUrl("tx", banner.tx)}
                target="_blank"
                rel="noreferrer"
              >
                view tx ↗
              </a>
            )}
          </div>
        </div>
      )}

      {!wallet.publicKey && <Hero />}

      {wallet.publicKey && program && (
        <Workspace
          program={program}
          busy={busy}
          setBusy={setBusy}
          flash={flash}
          connection={connection}
        />
      )}

      <footer className="mt-20 pt-8 border-t border-zinc-800/60 text-xs text-zinc-500 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          Built from scratch for the{" "}
          <span className="text-zinc-300">Turbine3</span> cohort. The on-chain
          program lives on devnet; this UI is a thin client.
        </div>
        <a
          href="https://github.com/Hijanhv/AMM-Turbine3"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-zinc-300 transition-colors"
        >
          <GitHubIcon className="w-3.5 h-3.5" />
          Source
        </a>
      </footer>
    </main>
  );
}

function Logo() {
  return (
    <div className="relative w-9 h-9 rounded-lg overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#9945ff] via-[#7b2cff] to-[#14f195]" />
      <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm">
        Σ
      </div>
    </div>
  );
}

function Hero() {
  return (
    <div className="card animate-rise">
      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-8 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 mb-4">
            <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Live on Solana devnet
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
            A constant-product AMM,
            <br />
            <span className="bg-gradient-to-r from-[#19fb9b] to-[#9945ff] bg-clip-text text-transparent">
              built from first principles.
            </span>
          </h2>
          <p className="mt-4 text-sm text-zinc-400 max-w-md leading-relaxed">
            Initialize an{" "}
            <code className="text-zinc-300 bg-zinc-800/60 px-1 rounded">
              (A, B)
            </code>{" "}
            pool, supply liquidity for LP tokens, swap along the{" "}
            <code className="text-zinc-300 bg-zinc-800/60 px-1 rounded">
              x · y = k
            </code>{" "}
            curve, and withdraw your share — all in one page.
          </p>
          <div className="mt-6 flex items-center gap-2 text-xs text-zinc-500">
            Connect Phantom or Solflare (set to devnet) to begin.
          </div>
        </div>
        <ul className="space-y-2.5 text-sm">
          {[
            "Initialize new pools with custom seed + fee",
            "One-click test mints — no CLI needed",
            "Real-time reserves, LP supply, price",
            "Authority-gated lock & unlock",
          ].map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-zinc-300">
              <CheckIcon className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
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
    <div className="space-y-5">
      <Section title="Initialize a pool" step="01" icon={<SparkIcon />}>
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

      <Section title="Load an existing pool" step="02" icon={<SearchIcon />}>
        <div className="flex gap-2">
          <input
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
            placeholder="seed (u64, e.g. 42)"
            className="input flex-1"
          />
          <button
            className="btn-ghost"
            disabled={busy}
            onClick={() => void loadPool(seedInput)}
          >
            Load
          </button>
        </div>
        {poolError && (
          <p className="text-rose-400 text-xs mt-3 flex items-center gap-1.5">
            <AlertIcon className="w-3.5 h-3.5" />
            {poolError}
          </p>
        )}
      </Section>

      {pool && (
        <>
          <PoolCard pool={pool} onRefresh={refresh} />

          <Section title="Deposit" icon={<DepositIcon />}>
            <DepositForm
              program={program}
              pool={pool}
              busy={busy}
              setBusy={setBusy}
              flash={flash}
              onDone={refresh}
            />
          </Section>

          <Section title="Swap" icon={<SwapIcon />}>
            <SwapForm
              program={program}
              pool={pool}
              busy={busy}
              setBusy={setBusy}
              flash={flash}
              onDone={refresh}
            />
          </Section>

          <Section title="Withdraw" icon={<WithdrawIcon />}>
            <WithdrawForm
              program={program}
              pool={pool}
              busy={busy}
              setBusy={setBusy}
              flash={flash}
              onDone={refresh}
            />
          </Section>

          <Section
            title="Lock / unlock"
            icon={<LockIcon />}
            subtitle="Authority only"
          >
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
  step,
  icon,
  subtitle,
  children,
}: {
  title: string;
  step?: string;
  icon?: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card animate-rise">
      <header className="flex items-center gap-3 mb-4">
        {step && (
          <span className="font-mono text-[10px] text-zinc-600 tracking-widest">
            {step}
          </span>
        )}
        {icon && (
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-zinc-800/60 border border-zinc-700/50 text-emerald-300">
            {icon}
          </span>
        )}
        <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
          {title}
        </h2>
        {subtitle && (
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 ml-auto">
            {subtitle}
          </span>
        )}
      </header>
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
    <section className="card animate-rise overflow-hidden">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gradient-to-br from-emerald-400/20 to-purple-400/20 border border-emerald-400/30 text-emerald-300">
            <PoolIcon />
          </span>
          <h2 className="text-sm font-semibold tracking-tight">Pool state</h2>
          {pool.locked ? (
            <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
              Locked
            </span>
          ) : (
            <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              Active
            </span>
          )}
        </div>
        <button
          className="text-xs text-zinc-400 hover:text-zinc-200 inline-flex items-center gap-1 transition-colors"
          onClick={onRefresh}
        >
          <RefreshIcon className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="Reserve A" value={formatAmount(pool.reserveA, DECIMALS)} />
        <Stat label="Reserve B" value={formatAmount(pool.reserveB, DECIMALS)} />
        <Stat
          label="LP supply"
          value={formatAmount(pool.lpSupply, DECIMALS)}
        />
        <Stat
          label="Your LP"
          value={
            pool.userLp === null ? "—" : formatAmount(pool.userLp, DECIMALS)
          }
          highlight
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <Meta label="Price (B / A)" value={price === null ? "—" : price.toFixed(6)} />
        <Meta label="Fee" value={`${(pool.feeBps / 100).toFixed(2)}%`} />
        <Meta label="Config" mono value={shortAddress(pool.config)} />
        <Meta label="LP mint" mono value={shortAddress(pool.mintLp)} />
        <Meta label="Mint A" mono value={shortAddress(pool.mintA)} />
        <Meta label="Mint B" mono value={shortAddress(pool.mintB)} />
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        highlight
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-zinc-800/80 bg-zinc-900/40"
      }`}
    >
      <div className="text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </div>
      <div
        className={`text-base font-medium mt-0.5 tabular-nums ${
          highlight ? "text-emerald-200" : "text-zinc-100"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-zinc-900/40 border border-zinc-800/60 px-3 py-1.5">
      <span className="text-zinc-500">{label}</span>
      <span className={`text-zinc-200 ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
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
          className="btn-ghost text-xs px-3 py-1.5"
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
        className="btn-primary"
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
        className="btn-primary"
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
        className="btn-primary"
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
        className="btn-primary"
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
        className="btn-warning"
      >
        Lock
      </button>
      <button
        disabled={busy || !pool.locked}
        onClick={() => void call("unlock")}
        className="btn-primary"
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
      <span className="text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

type IconProps = { className?: string };

function CheckIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 10.5l3.5 3.5L16 6" />
    </svg>
  );
}

function AlertIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M10 7v4" />
      <circle cx="10" cy="14" r="0.5" fill="currentColor" />
      <path d="M10 2L1.5 17h17z" />
    </svg>
  );
}

function SparkIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M10 2v4M10 14v4M2 10h4M14 10h4M5 5l2.5 2.5M12.5 12.5L15 15M5 15l2.5-2.5M12.5 7.5L15 5" />
    </svg>
  );
}

function SearchIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="9" cy="9" r="5" />
      <path d="M13 13l4 4" />
    </svg>
  );
}

function DepositIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M10 3v10M6 9l4 4 4-4" />
      <path d="M3 17h14" />
    </svg>
  );
}

function SwapIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 7h12l-3-3M16 13H4l3 3" />
    </svg>
  );
}

function WithdrawIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M10 17V7M6 11l4-4 4 4" />
      <path d="M3 3h14" />
    </svg>
  );
}

function LockIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="4" y="9" width="12" height="8" rx="2" />
      <path d="M7 9V6a3 3 0 016 0v3" />
    </svg>
  );
}

function PoolIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M2 8c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2" />
      <path d="M2 13c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2" />
    </svg>
  );
}

function RefreshIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 10a7 7 0 0112-5l2 2M17 4v3h-3M17 10a7 7 0 01-12 5l-2-2M3 16v-3h3" />
    </svg>
  );
}

function GitHubIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.27-.01-1-.02-1.96-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.97.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.89-.39.98 0 1.97.13 2.89.39 2.21-1.49 3.18-1.18 3.18-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.41-5.26 5.69.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.67.8.55C20.21 21.38 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}
