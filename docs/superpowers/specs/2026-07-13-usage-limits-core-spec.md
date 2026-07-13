# usage-limits vendored-core 化 設計

日付: 2026-07-13
基点コミット: `tmux-usage-limits@34895a34915ad4b6f9a5b48a609f774f1c69994d`
関連: `2026-07-11-plugin-split-design.md`(本 spec が L18 の方針を supersede。詳細は当該ファイルの supersede 注記を参照)
状態: ドラフト(実装は別タスク。本 spec はコード変更を含まない)

## 背景・目的

`2026-07-11-plugin-split-design.md` の分離作業により `engine.ts` は tmux-usage-limits と
herdr-usage-limits の 2 リポジトリに複製され、「以後は独立進化(分岐容認)」と決定された。
実際には分離後も `認証・キャッシュ・usage API 呼び出し・percent 計算・backoff` はほぼ同一実装のまま
保守されており、この不変ロジックが 2 箇所で独立にメンテされる状態は下記のリスクを生む。

- 認証まわりのバグ修正・セキュリティ修正が片方のリポジトリにしか反映されない
- Anthropic / OpenAI 側の usage API 仕様変更(例: `seven_day_sonnet` → `weekly_scoped` への変更)を
  2 箇所で個別に追従する必要がある
- 3rd consumer である dotfiles 側 `limits-fetch.ts` が独自に同種のロジックを再実装しており
  (下記 API 節参照)、実質 3 箇所目の類似実装が存在する

本 spec は「不変コア(invariant-core)」と「描画・ランタイム依存(rendering)」を関数単位で分類し、
コアのみを vendored core としてプラグインリポジトリ間で同期する設計を定義する。dotfiles 側
`limits-fetch.ts` は今回のベンダリング対象に**含めない**(制約参照)。

## 分類方法(実施した診断コマンド)

```
$ diff tmux-usage-limits/src/engine.ts herdr-usage-limits/src/engine.ts
7c7
< const CLAUDE_CACHE_FILE = `${HOME}/.claude/data/usage-limits-cache.json`;
---
> const CLAUDE_CACHE_FILE = `${HOME}/.claude/data/herdr-usage-limits-cache.json`;
9c9
< const CODEX_CACHE_FILE = `${HOME}/.codex/cache/tmux-usage-limits-cache.json`;
---
> const CODEX_CACHE_FILE = `${HOME}/.codex/cache/herdr-usage-limits-cache.json`;
(exit code 1, 全 514 行中この 2 行のみ差分)

$ shasum -a 256 tmux-usage-limits/src/engine.ts herdr-usage-limits/src/engine.ts
85d5e5a4...  tmux-usage-limits/src/engine.ts
898bcca0...  herdr-usage-limits/src/engine.ts
(2 行の定数差分のみでハッシュも不一致 — それ以外バイト一致)
```

`engine.ts` は 2026-07-11 の分離以降も**キャッシュファイルパスの定数 2 行を除き完全にバイト一致**
していることを確認した。この 2 行は現行実装ではモジュールレベル定数だが、後述の公開 API 設計で
関数引数化することで、コア部分は 2 リポジトリ間で**文字通り同一ファイル**になる(sha256 一致)。

`display.ts` / `title-daemon.ts` / `limits-fetch.ts` は tmux-usage-limits に対応物がないため、
コード実体としての diff 対象ではなく、`engine.ts` への依存関係・import 文・Bun API 使用有無を
grep して分類した(下記 grep 結果は分類表の根拠)。

```
$ grep -n "Bun\." tmux-usage-limits/src/engine.ts
248,253,257,271,299,322,348,357,411 行など — Bun.file / Bun.spawn / Bun.write を多用
(→ 現行 engine.ts はそのままでは runtime非依存ではない。ポート必須)

$ grep -n "^import" .../engine.ts .../display.ts .../title-daemon.ts .../limits-fetch.ts
tmux/herdr engine.ts:      import { homedir } from "os"; import { chmod, mkdir } from "fs/promises";
herdr display.ts:          import { getUsageStatus } from "./engine.ts";
herdr title-daemon.ts:     import { fetchRaw, ... } from "./display.ts";
dotfiles limits-fetch.ts:  import "node:fs/promises", "node:os", "node:path" (node: prefix)

$ grep -n "resetTime\|resetDate" home/.claude/statusline.ts
136: export function resetTime(resetsAt: string, now: number = Date.now()): string
149: export function resetDate(resetsAt: string, now: number = Date.now()): string
(→ dotfiles/statusline.ts は resetTime/resetDate を engine.ts から import せず独自に
   3 個目の実装を持つ。テンプレ関数シグネチャは now を引数化済み)

$ grep -n "credentials\.json\|find-generic-password\|accessToken\|auth\.json\|access_token" \
    tmux-usage-limits/src/engine.ts herdr-usage-limits/src/engine.ts \
    dotfiles/home/.claude/statusline/limits-fetch.ts
tmux engine.ts:246-277   getToken() / getCodexToken()
herdr engine.ts:246-277  getToken() / getCodexToken() (tmux と byte-identical、上の diff で確認済み)
limits-fetch.ts:18-85    tokenFromCredentialsJson() / tokenFromKeychain() / getToken()
                         (Claude のみ、Codex 非対応。DI 可能な引数設計は既にこちらが先行)
```

## 1. 関数単位の分類表

凡例: **core**=vendored core に含める / **rendering**=各リポジトリに残し分岐容認 / **runtime**=
プラグイン固有のランタイム統合(herdr socket・pane API 等)で core 化対象外 / **out-of-scope**=
dotfiles 側で構造上類似するが本 spec のベンダリング対象外(3rd consumer、参考情報)

| ファイル:関数/定数                                                                                                                       | 分類                                  | 根拠                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine.ts` 型定義 (`LimitEntry`, `RawScopedLimit`, `UsageLimits`, `CodexUsageWindow`, `CodexUsageResponse`, `Staleness`, `CacheRecord`) | core                                  | 認証・API・percent 計算すべての入出力契約。2 リポジトリでバイト一致                                                                                                                                                                                   |
| `CACHE_FRESH_MS`, `CACHE_STALE_MS`, `API_TIMEOUT`, `MAX_429_BACKOFF_MS`                                                                  | core(デフォルト値)                    | backoff/staleness の閾値。2 リポジトリでバイト一致。公開 API では呼び出し側が上書き可能なデフォルト引数にする                                                                                                                                         |
| `CLAUDE_CACHE_FILE`, `CODEX_CACHE_FILE`                                                                                                  | リポジトリ固有設定(コア対象外)        | diff で確認した唯一の分岐点。新 API では関数引数化しコアから追い出す                                                                                                                                                                                  |
| `CLAUDE_CRED_FILE`, `CODEX_AUTH_FILE`                                                                                                    | リポジトリ固有設定(コア対象外)        | 値は現状 2 リポジトリで同一だが、呼び出し元が指定すべき環境依存パスであり定数として埋め込まない                                                                                                                                                       |
| `shouldFetchNow()`                                                                                                                       | core                                  | 純関数、staleness/backoff 判定。2 リポジトリでバイト一致                                                                                                                                                                                              |
| `parseRetryAfter()`                                                                                                                      | core                                  | 純関数、429 backoff 計算。バイト一致                                                                                                                                                                                                                  |
| `parseCache()`                                                                                                                           | core                                  | 純関数、キャッシュ JSON パース。バイト一致                                                                                                                                                                                                            |
| `computeStaleness()`                                                                                                                     | core                                  | 純関数。バイト一致                                                                                                                                                                                                                                    |
| `shouldShowStaleMark()`                                                                                                                  | core                                  | 純関数。バイト一致                                                                                                                                                                                                                                    |
| `compute429Record()`                                                                                                                     | core                                  | 純関数、backoff レコード生成。バイト一致                                                                                                                                                                                                              |
| `fableFromLimits()`                                                                                                                      | core                                  | percent 抽出ロジック(Anthropic API の `weekly_scoped` 解釈)。バイト一致                                                                                                                                                                               |
| `limitFromCodexWindow()`                                                                                                                 | core                                  | percent 抽出ロジック(Codex API 解釈)。バイト一致                                                                                                                                                                                                      |
| `normalizeCodexUsage()`                                                                                                                  | core                                  | Codex レスポンス正規化。バイト一致                                                                                                                                                                                                                    |
| `t` (tmux 色定数)                                                                                                                        | rendering                             | tmux エスケープシーケンス表そのもの                                                                                                                                                                                                                   |
| `tmuxBraille()`                                                                                                                          | rendering                             | tmux 点字ゲージ描画。herdr は `display.ts:tmuxToAnsi()` で ANSI 変換して再利用するのみで、ANSI 直接出力への進化(2026-07-11 spec の意図)を妨げないよう rendering 側に残す                                                                              |
| `resetTime()`, `resetDate()`                                                                                                             | rendering(コア非対象、GAP として記録) | ユーザー分類基準(認証/キャッシュ/API/percent/backoff)に percent 表示のフォーマットは含まれない。ただし dotfiles/statusline.ts が 3 個目の独立実装を持つことを確認済み — 将来的な共通化候補として GAPS に記録                                          |
| `getToken()` (Claude 認証)                                                                                                               | core                                  | credential 読み取り。バイト一致。Bun.file/Bun.spawn を node:fs/node:child_process へポート必須                                                                                                                                                        |
| `getCodexToken()`                                                                                                                        | core                                  | credential 読み取り。バイト一致。Bun.file をポート必須                                                                                                                                                                                                |
| `readCache()`, `readRawRecord()` (CLAUDE_CACHE_FILE 固定ラッパー)                                                                        | 廃止(コア対象外)                      | `readCacheFile(cacheFile)` / `readRawRecordFile(cacheFile)` と冗長。新 API では汎用版のみを公開し、呼び出し側が cacheFile を渡す                                                                                                                      |
| `readCacheFile()`, `readRawRecordFile()`                                                                                                 | core                                  | 既に `cacheFile` を引数化済み。Bun.file を node:fs/promises へポート                                                                                                                                                                                  |
| `fetchAndCacheLimits()`, `fetchAndCacheCodexLimits()`                                                                                    | core(統合対象)                        | URL・headers・token 取得・normalize 手順のみが異なる実質同一ロジック。新 API では単一の `fetchAndCacheUsage()` に統合し、URL/headers/normalize を引数化する                                                                                           |
| `formatLimit()`                                                                                                                          | rendering                             | tmux 色定数・`tmuxBraille()` を直接組み込み                                                                                                                                                                                                           |
| `collectParts()`                                                                                                                         | 分割(core + rendering)                | 前半(read → `shouldFetchNow` 判定 → 必要なら fetch → re-read → `shouldShowStaleMark` 判定)は core 相当のオーケストレーション。後半(`formatLimit` 呼び出しで文字列組み立て)は rendering。新 API では前半を `resolveUsageData()` として core に切り出す |
| `main()`, `getUsageStatus()`                                                                                                             | rendering/runtime                     | tmux status-right 向けの文字列結合エントリポイント                                                                                                                                                                                                    |
| `display.ts: NAMED_COLORS`, `tmuxToAnsi()`, `stripTmux()`, `shortStatus()`, `titleText()`                                                | rendering                             | herdr 固有の ANSI/表示整形。tmux 書式文字列を入力に取る時点で tmux-usage-limits 側 core とは無関係                                                                                                                                                    |
| `display.ts: fetchRaw()`                                                                                                                 | rendering                             | `engine.ts` の `getUsageStatus()`(rendering 層)を呼ぶだけで core を直接呼ばない                                                                                                                                                                       |
| `display.ts: reportToSidebar()`, `setWindowTitle()`, `render()`                                                                          | runtime                               | herdr pane/socket API 統合。プラグイン固有のランタイム連携で他リポジトリに移植不可能                                                                                                                                                                  |
| `title-daemon.ts: main()`                                                                                                                | runtime                               | herdr デーモンのライフサイクル管理。core と無関係                                                                                                                                                                                                     |
| `limits-fetch.ts: tokenFromCredentialsJson()`, `tokenFromKeychain()`, `getToken()`                                                       | out-of-scope(参考)                    | Claude 認証の 3 個目の独立実装。制約により今回はベンダリング対象外だが、DI 可能な引数設計(`credentialsFile`, `keychainToken`)は新 core API 設計の参考にした                                                                                           |
| `limits-fetch.ts: buildSuccessRecord()`, `buildFailureRecord()`                                                                          | out-of-scope(参考)                    | `{timestamp, lastAttempt, data}` という engine.ts の `CacheRecord`(`{data, timestamp, nextRetryAt}`)とは異なるキャッシュスキーマ。統合は dotfiles 側のキャッシュファイル形式を破壊的変更するため本 spec の範囲外                                      |
| `limits-fetch.ts: fetchAndCacheLimits()`                                                                                                 | out-of-scope(参考)                    | `fetchImpl`/`getToken`/`now` を引数で差し替え可能な DI 設計。新 core の `fetchAndCacheUsage()` はこのテスト容易性パターンを踏襲する                                                                                                                   |

## 2. core の公開 API(関数シグネチャ)

**ランタイム制約**: core は web 標準 `fetch` と `node:fs/promises` のみに依存する。`Bun.*` API
(`Bun.file`, `Bun.write`, `Bun.spawn`)は使用しない — consumer 側に将来 Node 互換 `.mjs` の
statusline が加わりうるため(dotfiles 側 `limits-fetch.ts` は現状 `#!/usr/bin/env bun` シバンで
`Bun.file`/`Bun.write` を使っているが、これは vendoring 対象外の 3rd consumer であり、新 core の
制約はそれとは独立に設定する)。

**逸脱の明記**: keychain フォールバック(`security find-generic-password`)は `node:fs` の範囲外で
`node:child_process` の `execFile` が必要になる。ユーザー指定の「fetch + node:fs のみ」を字義通り
満たせないため、コアのランタイム依存を「web fetch + node:fs/promises + node:child_process
(keychain フォールバックの呼び出しに限定)」に拡張する。`keychainFallback` は呼び出し側が注入する
オプション引数とし、Codex-only や keychain 不要な consumer では省略できる設計にすることで
依存の強制を避ける。

```typescript
// ---- 型 ----
export interface LimitEntry {
  utilization: number;
  resets_at: string | null;
}

export interface RawScopedLimit {
  kind?: string;
  percent?: number;
  resets_at?: string | null;
  scope?: { model?: { display_name?: string | null } | null } | null;
}

export interface UsageLimits {
  five_hour: LimitEntry | null;
  seven_day: LimitEntry | null;
  limits?: RawScopedLimit[] | null;
}

export interface CodexUsageWindow {
  used_percent: number;
  limit_window_seconds: number;
  reset_after_seconds: number;
  reset_at: number;
}

export interface CodexUsageResponse {
  rate_limit?: {
    primary_window?: CodexUsageWindow | null;
    secondary_window?: CodexUsageWindow | null;
  } | null;
}

export type Staleness = "fresh" | "stale" | "expired";

export interface CacheRecord {
  data: UsageLimits | null;
  timestamp: number;
  nextRetryAt: number | null;
}

// ---- 純関数(既存 engine.ts からシグネチャ変更なしで移植) ----
export function shouldFetchNow(args: {
  staleness: Staleness;
  now: number;
  nextRetryAt: number | null;
}): "skip" | "background" | "sync";

export function parseRetryAfter(header: string | null, now: number, defaultMs: number): number;

export function parseCache(json: string): CacheRecord | null;

export function computeStaleness(timestamp: number, now: number): Staleness;

export function shouldShowStaleMark(args: {
  staleness: Staleness;
  nextRetryAt: number | null;
  now: number;
}): boolean;

export function compute429Record(
  existing: CacheRecord | null,
  retryAfterHeader: string | null,
  now: number,
  defaultMs: number,
): CacheRecord;

export function fableFromLimits(limits: RawScopedLimit[] | null | undefined): LimitEntry | null;

export function limitFromCodexWindow(
  window: CodexUsageWindow | null | undefined,
): LimitEntry | null;

export function normalizeCodexUsage(data: CodexUsageResponse): UsageLimits;

// ---- 認証(集約設計。詳細は 4. security 節) ----
export type KeychainFallback = () => Promise<string | null>;

export async function getClaudeToken(args: {
  credentialsFile: string;
  keychainFallback?: KeychainFallback;
}): Promise<string | null>;

export async function getCodexToken(args: { authFile: string }): Promise<string | null>;

// macOS keychain 読み取りの標準実装。呼び出し側が getClaudeToken の keychainFallback に注入する。
// node:child_process execFile で `security find-generic-password` を呼ぶ薄いラッパー。
export async function keychainToken(service: string): Promise<string | null>;

// ---- キャッシュ IO(node:fs/promises) ----
export async function readCacheFile(
  cacheFile: string,
  now?: number,
): Promise<{
  data: UsageLimits | null;
  staleness: Staleness;
  ageMs: number;
  nextRetryAt: number | null;
}>;

export async function readRawRecordFile(cacheFile: string): Promise<CacheRecord | null>;

export async function writeCacheRecord(cacheFile: string, record: CacheRecord): Promise<void>;
// 実装: mkdir(dirname, {recursive: true, mode: 0o700}) → writeFile → chmod(0o600)
// (既存の CLAUDE_CACHE_FILE 書き込み手順と同じセキュリティ属性を node:fs/promises で再現)

// ---- API 呼び出し + キャッシュ書き込み(統合。旧 fetchAndCacheLimits/fetchAndCacheCodexLimits を統合) ----
export interface FetchAndCacheArgs {
  cacheFile: string;
  token: string | null;
  url: string;
  headers: Record<string, string>;
  normalize?: (raw: unknown) => UsageLimits; // 省略時は恒等関数(Claude 用)。Codex 用途では normalizeCodexUsage を渡す
  now?: number; // default: Date.now()
  timeoutMs?: number; // default: 5000
  defaultBackoffMs?: number; // default: 60_000
  maxBackoffMs?: number; // default: 600_000 (MAX_429_BACKOFF_MS)
  fetchImpl?: typeof fetch; // default: グローバル fetch。テスト時に差し替え
}
export async function fetchAndCacheUsage(args: FetchAndCacheArgs): Promise<void>;

// ---- read → decide → fetch オーケストレーション(旧 collectParts の core 部分を分離) ----
export interface ResolveUsageArgs {
  cacheFile: string;
  now?: number;
  fetchAndCache: () => Promise<void>; // 呼び出し側が fetchAndCacheUsage を束縛して渡す
}
export interface ResolvedUsage {
  data: UsageLimits | null;
  showStale: boolean;
  ageMs: number;
}
export async function resolveUsageData(args: ResolveUsageArgs): Promise<ResolvedUsage>;
```

各リポジトリの `engine.ts` は上記コアを import し、`formatLimit()` / `tmuxBraille()` /
`resetTime()` / `resetDate()` / `collectParts()` の rendering 部分と `CLAUDE_CACHE_FILE` などの
パス定数のみを自リポジトリ側に残す薄いラッパーになる。

## 3. 配布機構

### 比較: script 方式 vs git subtree

| 観点                       | script 方式(採用)                                                                                                                                                                                  | git subtree                                                                                                                                                                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 前提となるファイル構成変更 | core を `src/usage-limits-core.ts` に切り出せば十分                                                                                                                                                | サブツリー化には donor 側でディレクトリ単位の分離が必要。今回は 1 ファイルのみが対象で恩恵が薄い                                                                                                                                       |
| 2 リポジトリ間の分岐吸収   | 2. の API 設計でキャッシュパスを引数化した結果、core ファイルは両リポジトリで sha256 一致になる → 単純 `cp` で足りる、パッチ再適用不要                                                             | 同様に sha256 一致するため、subtree 特有の「部分マージ」機能は活用されない。history 保持がメリットだが下記の理由で価値が薄い                                                                                                           |
| リリース運用との整合性     | 両リポジトリとも release-please + Conventional Commits で独立バージョニング(2026-07-11 spec 記載)。sync は手動コミットとして通常の `docs:`/`chore:` prefix で行え、commit-message 規約と衝突しない | subtree pull は squash commit や外部 history を持ち込み、Conventional Commits 前提の release-please 解析(feat!/fix! 等のプレフィックス)と衝突しうる。手動での commit message 整形が結局必要になり subtree の自動化メリットが相殺される |
| 運用コスト                 | `cp` だけで十分。実行時は stdout に同期元パスと短縮 SHA を出すが、ファイル内ヘッダーは刻印しない。個人開発・単一メンテナのため低頻度手動実行で足りる(80% ルール相当の考え方)                         | remote 登録・`git subtree pull --squash` のコマンド習熟・失敗時のコンフリクト解決など運用コストが高い。1 ファイルの同期には過剰                                                                                                        |
| 同期漏れの検知             | 両リポジトリの `src/usage-limits-core.ts` を `diff` / `sha256` で比較する。ファイル内ヘッダーを刻印すると sha256 一致契約が壊れるため採用しない                                                     | subtree も自動検知は別途必要であり script 方式に対する優位性なし                                                                                                                                                                       |
| 採用可否                   | **採用**                                                                                                                                                                                           | 不採用                                                                                                                                                                                                                                 |

### 採用案: script 方式

- 正典(canonical source)は `tmux-usage-limits/src/usage-limits-core.ts` に置く(2026-07-11 spec で
  herdr-usage-limits は tmux-usage-limits から「コピー」して作られた経緯があり、tmux 側が原本という
  位置づけと整合する)
- herdr-usage-limits 側に `scripts/sync-core.sh`(または同等の shell script)を置く。script は
  自身の配置ディレクトリを基準に herdr リポジトリ root と隣接する `tmux-usage-limits` を解決し、
  `tmux-usage-limits/src/usage-limits-core.ts` を `herdr-usage-limits/src/usage-limits-core.ts` へ
  `cp` する。呼び出し時の cwd には依存しない
- 実行時は stdout に同期元パスと短縮 SHA を出すが、`usage-limits-core.ts` のファイル内には
  vendored header を刻印しない。ヘッダーを入れると両リポジトリの sha256 一致という DoD を満たせないため
- 実行タイミングはメンテナの手動トリガー(tmux-usage-limits の core に変更を加えた後、任意のタイミングで
  herdr-usage-limits 側で実行)。CI 常時実行は導入しない(dotfiles Test Policy と同じ「常時回る基盤は
  持たない」考え方に合わせる — tmux-usage-limits/herdr-usage-limits も同一メンテナの個人プロジェクトであり
  同じ運用哲学が妥当)
- npm dependency 化は不採用: 2 リポジトリとも Bun 単体実行可能なスクリプト集であり、パッケージ公開・
  semver 管理・レジストリ運用のコストに見合わない(2026-07-11 spec の「ユーザーが導入を意識するのは
  プラグイン 2 つだけであるべき」という前提とも整合し、npm 経由の間接依存を持ち込まない)
- 導入対象は tmux-usage-limits / herdr-usage-limits の 2 プラグインリポジトリのみ。dotfiles 側
  `limits-fetch.ts` は対象外(制約節参照)

## 4. security 節: credential 集約設計

### 現状の credential 触点(診断結果)

| #   | 場所                                                                                                                     | 内容                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `tmux-usage-limits/src/engine.ts:246-267` `getToken()`                                                                   | `~/.claude/.credentials.json` 読み取り → 失敗時 `security find-generic-password -s "Claude Code-credentials" -w` にフォールバック |
| 2   | `tmux-usage-limits/src/engine.ts:269-277` `getCodexToken()`                                                              | `~/.codex/auth.json` 読み取り                                                                                                     |
| 3   | `herdr-usage-limits/src/engine.ts:246-277` `getToken()`/`getCodexToken()`                                                | tmux 側と byte-identical な複製(diff で確認済み)                                                                                  |
| 4   | `dotfiles/home/.claude/statusline/limits-fetch.ts:18-85` `tokenFromCredentialsJson()`/`tokenFromKeychain()`/`getToken()` | Claude のみの独立した第 3 実装(Codex 非対応、DI 可能な引数設計)                                                                   |

file 単位で 3 箇所、function 実装単位で 5 箇所(#1,#2 が #3 で複製、#4 が独自実装)に credential
読み取りロジックが存在する。2026-07-11 spec は engine.ts の「複製・分岐容認」を決定事項としており、
認証コードもその対象に含まれていた — つまり将来 keychain フォールバックにセキュリティ修正が入っても
tmux 側にしか反映されない、といったリスクを構造的に許容していた。

### 集約設計: 4 箇所 → 1 箇所(vendoring スコープ内)

- vendoring 対象の 2 リポジトリ(#1+#2 と #3)は `usage-limits-core.ts` の
  `getClaudeToken()` / `getCodexToken()` / `keychainToken()` に一本化する。両リポジトリの
  credential 読み取りコードは sync script により同一ファイルとなり、実質「1 箇所」に集約される
- `keychainToken()` は `node:child_process` の `execFile` ラッパーとして core に切り出し、
  `getClaudeToken()` の `keychainFallback` 引数に呼び出し側が注入する(Codex 認証は keychain を
  使わないため `getCodexToken()` には keychain 引数を持たせない — 不要な依存注入を避ける)
- `#4`(dotfiles `limits-fetch.ts`)は制約により本 spec のベンダリング対象外。集約は 3 箇所目として
  残存する。将来的な統合候補として GAPS に記録する(黙って無視しない — fail-loud の方針に従い明記)
- 認証情報そのもの(トークン文字列)を core がログ出力・キャッシュファイルに書き込むことは元々ない
  (既存実装通り、`CacheRecord.data` は usage API のレスポンス JSON のみを保持しトークンを含まない)
  ことを新 API でも維持する制約として明記する

## 5. supersede 対象と保持する意図

`2026-07-11-plugin-split-design.md` の決定事項テーブル L18「core 専用リポジトリ | 作らない」を
本 spec が supersede する。

- **supersede する内容**: L18 の「作らない」は L17(`engine.ts は両リポジトリに複製、以後は独立進化
(分岐容認)`)とセットで、「同期機構を一切持たない」ことまで意味していた。本 spec はこの「同期機構
  なし」を撤回し、core を script 方式で同期する仕組みを導入する
- **supersede しない内容(保持する意図)**: L18 の rationale「ユーザーが導入を意識するのはプラグイン
  2 つだけであるべき」はそのまま維持する。本 spec は新しいリポジトリを作らない — 正典は既存の
  tmux-usage-limits リポジトリ内に置き、herdr-usage-limits へは script でファイルを同期するのみで、
  npm パッケージ化も専用リポジトリ化もしない。エンドユーザーが `herdr plugin install` /
  `TPM install` で意識する対象は従来通り 2 リポジトリのままである
- **rendering-divergence の意図は保持**: L17 の rationale「herdr 側は将来 tmux 書式を捨てて ANSI
  直接出力に進化できる」という意図は、本 spec の「core/rendering 分割」設計そのものが体現している。
  `tmuxBraille()` / `formatLimit()` / `t` 色定数 / `resetTime()` / `resetDate()` はいずれも
  rendering 分類とし、vendoring 対象外のまま各リポジトリで自由に分岐できる状態を維持する。ANSI
  直接出力化(2026-07-11 spec が YAGNI として据え置いた作業)は本 spec でも引き続き対象外

## 実装ステップ(参考、本 spec は着手しない)

1. tmux-usage-limits: `src/engine.ts` から core 部分を `src/usage-limits-core.ts` に切り出し、
   Bun.\* API を node:fs/promises・node:child_process へポート。`engine.ts` は core を import する
   薄いラッパーへ縮小
2. herdr-usage-limits: 同様に `src/usage-limits-core.ts` を追加、`scripts/sync-core.sh` を新設し
   初回同期を実行。`engine.ts` を薄いラッパー化
3. 両リポジトリで `bun test` を通す(core の純関数群は既存 `engine.test.ts` のテストケースを
   そのまま移植できるはず — シグネチャ変更なしのため)
4. verify ハーネス(`verify/`)でエンドツーエンドの実描画を確認

## 検証基準(Definition of Done、実装タスク向け)

- 両リポジトリで `src/usage-limits-core.ts` が sha256 一致する
- 両リポジトリで `bun test` が通る
- `usage-limits-core.ts` が `Bun.*` を一切 import/使用しない(`grep -n "Bun\."` の結果が空)
- credential 読み取りロジック(vendoring スコープ内)が `usage-limits-core.ts` 経由のみになっている
  (`engine.ts` に `find-generic-password` や `.credentials.json` の直接参照が残っていない)
- 両リポジトリのローカルレビューゲートを通過。手順は (1) agmsg で codex peer review、(2)
  `coderabbit review --base master --agent --type all` の妥当な指摘を修正、(3) いずれか不可なら
  独立 Opus reviewer-judgment、(4) 両レビューまたはフォールバック完了後にのみ "local review passed" と報告
