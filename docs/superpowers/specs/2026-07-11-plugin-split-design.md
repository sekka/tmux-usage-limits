# usage-limits プラグイン分離 設計

日付: 2026-07-11
基点コミット: `ai-usage-limits@4ad82d3`
状態: ユーザー承認済み(ブレインストーミングセッションで各判断を確認)

## 目的

tmux プラグインと herdr プラグインが 1 リポジトリに相乗りしている構造を解消する。
表示内容は同じだが役割が違うものであり、同居は歪み。役割ごとに独立したリポジトリに分離する。

## 決定事項

| 項目                | 決定                                                                                     | 根拠                                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| トポロジー          | 2 リポジトリ完全独立。依存・同期機構なし                                                 | 併用するかはユーザー次第。依存関係を作らない                                                                                                     |
| engine.ts           | 両リポジトリに複製、以後は独立進化(分岐容認)                                             | 複製は「役割ごとの進化の起点」。herdr 側は将来 tmux 書式を捨て ANSI 直接出力に進化できる                                                         |
| core 専用リポジトリ | 作らない                                                                                 | ユーザーが導入を意識するのはプラグイン 2 つだけであるべき                                                                                        |
| 既存リポジトリ      | tmux 専用化し `sekka/tmux-usage-limits` に改名                                           | herdr-usage-limits と対になる命名。GitHub リダイレクトで旧名 clone も動く                                                                        |
| 新リポジトリ        | `sekka/herdr-usage-limits`                                                               | 既存の `herdr-tab-title` と同じ命名パターン                                                                                                      |
| プラグイン ID       | `dotfiles.usage-limits` を維持                                                           | 既存キーバインド・`--plugin` 指定を壊さない。移行は uninstall→install のみ                                                                       |
| 新リポジトリの履歴  | 新規 1 コミット開始。初回コミットと README に `ai-usage-limits@4ad82d3` からの分離と明記 | filter-repo による履歴分割は engine.ts のような両属ファイルで不完全になる。blame は元リポジトリ参照                                              |
| 初回/安定版バージョン | 3 プラグインとも 1.0.0 で切る | 0.x 自動bump挙動を避け安定版として明示。herdr-usage-limits は manifest baseline 0.0.0、他 2 つは Release-As: 1.0.0 で pin |
| キャッシュパス      | 分離する(herdr 側をリネーム)                                                             | 共有すると両 engine のキャッシュスキーマ互換義務が生じ、切った依存が裏口から復活する。代償の API ポーリング 2 倍は許容(429 バックオフは各自持つ) |
| engine リファクタ   | 今回はしない                                                                             | display.ts が tmux 書式→ANSI 変換する現構造をそのまま持ち込む。ANSI 直接出力化は分離後の別作業(YAGNI)                                            |

## 現状の構造(参考)

- 共有コア: `engine.ts`(認証・キャッシュ・usage API・tmux 書式レンダリング)+ `engine.test.ts`
- tmux 側: `usage_limits.tmux`(TPM エントリポイント。bun 解決を内蔵し自己完結)
- herdr 側: `herdr-plugin.toml`, `display.ts`(engine を import、tmux 書式→ANSI 変換 + sidebar 集計 + window title)、`title-daemon.ts`(display を import)、`run.sh`, `ensure-open.sh`, `ensure-title-daemon.sh`, `open-or-focus.sh`, `display.test.ts`
- 検証: `verify/`(manifest.json に `tmux-status` と `herdr-pane` の両チェック、fixtures 2 種)、`verify.ts`, `verify.sh`
- リリース: release-please simple type。`extra-files` で `herdr-plugin.toml` の version を bump。現行 0.2.0

依存方向: `title-daemon.ts` → `display.ts` → `engine.ts`。engine は他に依存しない。

## 分離後の構成

### tmux-usage-limits(このリポジトリの改修)

削除するファイル:

- `herdr-plugin.toml`
- `display.ts`, `display.test.ts`, `title-daemon.ts`
- `run.sh`, `ensure-open.sh`, `ensure-title-daemon.sh`, `open-or-focus.sh`

残すファイル: `usage_limits.tmux`, `engine.ts`, `engine.test.ts`, `verify/` 一式, `verify.ts`, `verify.sh`, LICENSE

改修内容:

- `verify/manifest.json`: `herdr-pane` チェックを削除し `tmux-status` のみに。fixtures は両方残す(engine は CC/Codex 両方を読む)。`plugin_id` フィールドの要否は verify ハーネスの実装を読んで判断
- `release-please-config.json`: `extra-files`(herdr-plugin.toml bump)を削除。simple type 継続。herdr 除去リリースを安定版 1.0.0 として切るため、当該 `feat!` コミットに `Release-As: 1.0.0` フッターを付ける
- herdr サポート除去のコミットは `feat!:` + `Release-As: 1.0.0` フッターで初の安定版 1.0.0 としてリリース。`Release-As` は当該リリースのみに効く
- README: tmux 専用に書き直し。herdr ユーザー向けに移行先 `sekka/herdr-usage-limits` を明記
- CLAUDE.md: herdr 前提の記述を除去
- GitHub リポジトリ改名 `ai-usage-limits` → `tmux-usage-limits`(`gh repo rename`)

### herdr-usage-limits(新規)

構成ファイル(元リポジトリからコピー + 適応):

- `herdr-plugin.toml`(初期値は version 0.1.0 のまま、id/panes/events/actions は現行のまま。release-please が初回リリースを 1.0.0 として切る)
- `engine.ts` + `engine.test.ts`(コピー。キャッシュパスのみ変更 — 下記)
- `display.ts`, `display.test.ts`, `title-daemon.ts`
- `run.sh`, `ensure-open.sh`, `ensure-title-daemon.sh`, `open-or-focus.sh`
- `verify/` 一式(`herdr-pane` チェックのみに削減、fixtures は両方)+ `verify.ts`, `verify.sh`
- README(herdr 専用。出自として `ai-usage-limits@4ad82d3` からの分離を明記)
- LICENSE, CLAUDE.md, `.gitignore`
- release-please 一式(`.github/workflows/release-please.yml`, `release-please-config.json` — extra-files で herdr-plugin.toml を bump, `.release-please-manifest.json` = 0.0.0。未リリース baseline とし、初回 feat を release-please が 1.0.0 に昇格)

キャッシュパス変更(engine.ts のコピー側のみ):

- Claude: `~/.claude/data/usage-limits-cache.json` → `~/.claude/data/herdr-usage-limits-cache.json`
- Codex: `~/.codex/cache/tmux-usage-limits-cache.json` → `~/.codex/cache/herdr-usage-limits-cache.json`
- verify fixtures の `home_path` も同じ値に追随させる

tmux 側のキャッシュパスは無変更(移行なし)。

GitHub 設定: repo 作成後、release-please が Release PR を作れるよう Actions の
権限を設定する(既知のハマり: リポジトリ設定で workflow の PR 作成許可
`can_approve_pull_request_reviews` / "Allow GitHub Actions to create and approve pull
requests" を有効化)。

## dotfiles 移行(切り替え手順)

1. herdr: `herdr plugin uninstall dotfiles.usage-limits` → `herdr plugin install sekka/herdr-usage-limits` → `herdr plugin action invoke start-title-daemon --plugin dotfiles.usage-limits`。キーバインドは ID 維持のため無変更
2. tmux: dotfiles の tmux 設定で `@plugin 'sekka/tmux-usage-limits'` に変更、`status-right` のパスを `~/.tmux/plugins/tmux-usage-limits/...` に更新、TPM 再インストール

## 実行順序

新リポジトリを先に作り、動作確認してから旧リポジトリを削る。切り替えの瞬間まで既存プラグインが生き続ける。

1. **herdr-usage-limits 作成**: コピー → キャッシュパス等の適応 → `bun test` → `herdr plugin link` でローカル動作確認(pane 実描画・sidebar・title-daemon)→ GitHub repo 作成 → push → release-please 設定 → v1.0.0 リリース
2. **herdr 本番切り替え**: link を unlink → uninstall/install(タグ pin)→ 実描画確認
3. **tmux 専用化**: このリポジトリで削除・README・release config・verify manifest 改修 → ローカルレビューゲート(codex peer + CodeRabbit)→ ユーザーのマージ判断
4. **改名 + dotfiles 更新**: `gh repo rename tmux-usage-limits` → dotfiles の tmux 設定更新 → TPM 再インストール → status-right 実描画確認
5. **最終確認**: 両リポジトリの verify ハーネス(`verify/README.md` の手順)によるライブ確認

## 検証基準(Definition of Done)

- 両リポジトリで `bun test` が通る
- herdr: overlay pane・sidebar 集計・window title が新リポジトリ由来のインストールで実描画される
- tmux: `status-right` が新名パスで実描画される
- 旧 herdr ファイルがこのリポジトリに残っていない / 新リポジトリに tmux エントリポイントがない
- 両リポジトリのローカルレビューゲート(codex peer + CodeRabbit、不可時は reviewer-judgment フォールバック)を通過
- release-please が両リポジトリで Release PR を作成できる

## 制約・注意

- macOS 専用環境。BSD コマンドフラグのみ(GNU 拡張禁止)
- 両リポジトリとも Conventional Commits(release-please 前提)
- マージは全てユーザーの明示承認後(git-conventions)
- herdr のインストールは resolved_commit に pin される。マージ後の動作反映には
  再インストールが必要(`herdr plugin install --ref <sha>`)— 既知メモ参照
