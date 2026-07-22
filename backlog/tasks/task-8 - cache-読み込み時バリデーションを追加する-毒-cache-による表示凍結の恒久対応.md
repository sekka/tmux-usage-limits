---
id: TASK-8
title: cache 読み込み時バリデーションを追加する (毒 cache による表示凍結の恒久対応)
status: Done
assignee: []
created_date: '2026-07-20 10:20'
updated_date: '2026-07-20 14:15'
labels:
  - fix
dependencies: []
priority: high
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## 背景 (インシデント)

2026-07-13、旧 herdr-usage-limits 1.1.1 が epoch 2,000,000,000 秒 (= 2033-05-18)
由来の未来値を cache に書き込み、7日間 usage 表示が凍結した (2026-07-20 発見・応急処置済み)。

- Claude 側: `nextRetryAt: 2033-05-18` → backoff 判定で fetch 永久 skip
- Codex 側: `timestamp: 2033-05-18` → age が負になり永久 fresh 扱いで再取得なし
- 現行 core は書き込み時に backoff を 10 分で cap するが、**読み込み時に異常値を
  検証しない**ため、旧版の書いた毒が新版でも効き続けた

## 修正方針

本リポの `usage-limits-core.ts` が canonical (herdr へはコピー同期)。パッケージ化
(TASK-7) を待たず、ここで先に修正して herdr へ同期する。パッケージはこの修正済み
コードを引き継ぐ。

cache 読み込み時のバリデーション (TDD、毒 cache fixture でテスト先行):

1. `nextRetryAt` は `now + MAX_429_BACKOFF_MS` (10分) に clamp
2. `timestamp > now` のレコードは stale 扱い (または破棄)
3. 効果: 毒 cache が何らかの経路で入っても最大 10 分で自己回復する

バリデーションは **Claude 側・Codex 側の両方の cache 読み込み経路に適用する**こと
(インシデントでは Claude 側は nextRetryAt、Codex 側は timestamp と、毒の効き方が
別経路だった)。

参考: cc-statusline-usage-limits では同種脆弱性 (`shouldFetch` の未来 lastAttempt
永久 skip / `readCache` の未来 timestamp 永久 fresh) を 2026-07-20 に修正済み。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 未来 nextRetryAt / 未来 timestamp の毒 cache fixture を使ったテストが先行して書かれ、修正後に全パスしている
- [x] #2 usage-limits-core.ts の読み込み時バリデーションが実装されている
- [x] #3 herdr-usage-limits へコピー同期され、両リポで md5 一致と bun test 全パスを確認している
<!-- AC:END -->
