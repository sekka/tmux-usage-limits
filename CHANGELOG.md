# Changelog

## [1.1.2](https://github.com/sekka/tmux-usage-limits/compare/v1.1.1...v1.1.2) (2026-07-20)


### Bug Fixes

* cache 読み込み時に未来 timestamp/nextRetryAt を無害化する ([810120a](https://github.com/sekka/tmux-usage-limits/commit/810120a46d6dd9711b461a2e0afde72d5fcf9eee))
* cache 読み込み時バリデーションで毒 cache から自己回復する (M1) ([ec22b02](https://github.com/sekka/tmux-usage-limits/commit/ec22b02afd371da227a81363b129d4dcedc7ca10))
* 毒 cache の fetch 判定を自己回復させる ([d914c38](https://github.com/sekka/tmux-usage-limits/commit/d914c385dfb45a209b2c10215afb527fe8464f32))

## [1.1.1](https://github.com/sekka/tmux-usage-limits/compare/v1.1.0...v1.1.1) (2026-07-13)


### Bug Fixes

* percent の % 記号色を gray に揃える ([26692e3](https://github.com/sekka/tmux-usage-limits/commit/26692e389a107d4a5eaa9e30ac55b02af08f3c56))
* tmuxBraille に 0-100 clamp を追加し範囲外入力の crash を防ぐ ([4d7153a](https://github.com/sekka/tmux-usage-limits/commit/4d7153a790bd929817fa115c44d68174efea2d47))
* 同期 fetch 経路のエラーを背景経路と対称に握り潰しステータス消失を防ぐ ([3259357](https://github.com/sekka/tmux-usage-limits/commit/3259357e4fbb77f6a7a9e11d8f1cd46e54e228e2))

## [1.1.0](https://github.com/sekka/tmux-usage-limits/compare/v1.0.0...v1.1.0) (2026-07-13)


### Features

* usage limits core を追加 ([fac6cc7](https://github.com/sekka/tmux-usage-limits/commit/fac6cc75cba91ee2ab222f7fc55f772b3deca40d))


### Bug Fixes

* engine の実行権限を維持 ([d7233fa](https://github.com/sekka/tmux-usage-limits/commit/d7233fa017095cce681ba6629088c4eceaf0a972))
* malformed JSON でも stale cache を保持 ([229802c](https://github.com/sekka/tmux-usage-limits/commit/229802cddf0fccc70bf47ade33a8bf957192905c))

## [1.0.0](https://github.com/sekka/ai-usage-limits/compare/v0.3.0...v1.0.0) (2026-07-11)


### ⚠ BREAKING CHANGES

* herdr プラグインサポートを削除。herdr 利用者は sekka/herdr-usage-limits へ移行すること。

### Features

* herdr サポートを削除し tmux 専用プラグイン化 ([4e59c97](https://github.com/sekka/ai-usage-limits/commit/4e59c97ee2a56eb148acc64214c939fecddfa243))

## [0.3.0](https://github.com/sekka/ai-usage-limits/compare/v0.2.0...v0.3.0) (2026-07-10)


### Features

* Limit表示にfable(CCF)を追加しSonnet(CCS)を廃止 ([9cdf6e3](https://github.com/sekka/ai-usage-limits/commit/9cdf6e310fb50806bdb9aaaf372b7a3dcad7dc3e))

## [0.2.0](https://github.com/sekka/ai-usage-limits/compare/v0.1.0...v0.2.0) (2026-07-09)


### Features

* initial ai usage limits plugin ([c53ceaf](https://github.com/sekka/ai-usage-limits/commit/c53ceaf850fd3c3737b4a183e410b3b5e053f667))
