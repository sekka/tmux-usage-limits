---
id: TASK-7
title: usage-limits-core を共有パッケージリポへ切り出し git dependency 参照に切り替える
status: Done
assignee: []
created_date: '2026-07-20 10:00'
updated_date: '2026-07-21 21:43'
labels:
  - refactor
dependencies: []
priority: high
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## 背景

`src/usage-limits-core.ts` (credential 読み取り・oauth/usage API・パース・cache・429 backoff)
は herdr-usage-limits と**バイト同一のコピー**を持ち合っている (2026-07-20 diff 確認)。
自動同期の仕組みは無く、undocumented endpoint の仕様変更時に複数リポを手で同時修正する
リスクがある。

2026-07-20 に方針決定済み: 専用の共有パッケージリポ (兄妹標準テンプレート:
release-please + conventional commits) を新設し、コピーを廃止する。

## 修正方針

1. 共有パッケージリポ (例: `sekka/usage-limits-core`) を新設し、core を移す
2. 本リポは git dependency をリリースタグに pin して参照する
   (例: `"usage-limits-core": "github:sekka/usage-limits-core#v1.0.0"`)
3. `src/usage-limits-core.ts` のコピーを削除し、import を package 参照へ切り替える
4. engine.ts (tmux 固有部分) は本リポに残す

## 必須要件: cache 読み込み時バリデーション (2026-07-20 インシデント由来)

herdr-usage-limits で、旧版が書いた未来 timestamp (2033-05-18) の毒 cache により
7日間表示が凍結するインシデントが発生した (Claude 側 `nextRetryAt` 未来値で fetch
永久 skip、Codex 側 `timestamp` 未来値で永久 fresh)。現行 core は書き込み時に
backoff を 10 分で cap するが、読み込み時に異常値を検証しないため、旧版の書いた
毒が新版でも効き続けた。共有パッケージには以下を必須要件として含める:

- `nextRetryAt` は読み込み時に `now + MAX_429_BACKOFF_MS` (10分) へ clamp する
- `timestamp > now` のレコードは stale 扱い (または破棄) にする
- 効果: 毒 cache がどの経路で入っても最大 10 分で自己回復する

TASK-8 (パッケージ化前の暫定 fix) を先行させ、パッケージはその修正済みコードを
引き継ぐこと。

## 設計判断事項 (2026-07-20 M1 レビューで指摘、パッケージ化時に解決)

1. **毒 cache 時の方針差異の統一**: cc-statusline は data を保持して stale 扱い
   (最終取得値を表示し続ける)、tmux/herdr core は record ごと破棄 (data: null)。
   共有パッケージではどちらかに統一するか、オプション化するかを決める。
2. **expired 時の並行 sync fetch に lock がない** (既存挙動): 複数 pane / 複数
   consumer が同時に expired を観測すると fetch が stampede しうる。lockfile 等の
   排他を検討する (cache 書き込み自体は atomic rename 済み)。

## 関連

- herdr-usage-limits 側の同種タスク、cc-statusline-usage-limits 側は build 時生成
  (単一ファイル limits-fetch.mjs をスクリプト生成してコミット) で参加する
- 暫定 fix: 本リポ TASK-8 (canonical で修正 → herdr へコピー同期)

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 共有パッケージリポが兄妹標準構成 (release-please, CI, README) で存在する
- [x] #2 本リポの src/usage-limits-core.ts が削除され、タグ pin の git dependency 参照になっている
- [x] #3 bun test が全パスし、tmux 表示の実挙動が変わらないことを確認している
<!-- AC:END -->
