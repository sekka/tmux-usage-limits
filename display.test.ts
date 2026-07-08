import { describe, expect, test } from "bun:test";
import { shortStatus, stripTmux, titleText, tmuxToAnsi } from "./display.ts";

describe("tmuxToAnsi", () => {
  test("256色コード (colourN) を 38;5;N に変換する", () => {
    expect(tmuxToAnsi("#[fg=colour240]5h#[default]")).toBe("\x1b[38;5;240m5h\x1b[0m");
    expect(tmuxToAnsi("#[fg=colour208]!")).toBe("\x1b[38;5;208m!");
  });

  test("名前付き色を ANSI 基本色に変換する", () => {
    expect(tmuxToAnsi("#[fg=white]80%")).toBe("\x1b[37m80%");
    expect(tmuxToAnsi("#[fg=yellow]x")).toBe("\x1b[33mx");
    expect(tmuxToAnsi("#[fg=brightred]95%")).toBe("\x1b[91m95%");
  });

  test("#[default] はリセットになる", () => {
    expect(tmuxToAnsi("#[default]")).toBe("\x1b[0m");
  });

  test("未知の書式トークンは除去する (生の #[...] を画面に出さない)", () => {
    expect(tmuxToAnsi("#[bg=blue bold]X#[nobold]Y")).toBe("XY");
  });

  test("書式トークンを含まない文字列はそのまま", () => {
    expect(tmuxToAnsi("CC:⣿⣿⣀⣀⣀ 42%")).toBe("CC:⣿⣿⣀⣀⣀ 42%");
  });

  test("tmux-status.ts の実出力形式 (formatLimit 相当) を通しで変換できる", () => {
    const input =
      "#[fg=colour240]5h:#[default]#[fg=yellow]⣿⣿⣿⣀⣀#[default] #[fg=white]58%#[default] #[fg=colour240](7/5|14:00)#[default]";
    const out = tmuxToAnsi(input);
    expect(out).not.toContain("#[");
    expect(out).toContain("\x1b[38;5;240m5h:");
    expect(out).toContain("\x1b[37m58%");
  });
});

describe("stripTmux", () => {
  test("書式トークンだけ除去し、点字ゲージ等の文字は残す (tmux表示のテキスト再現)", () => {
    const raw = "#[fg=colour240]CC5:#[default]#[fg=yellow]⣿⣿⣀⣀⣀#[default] #[fg=white]41%#[default]";
    expect(stripTmux(raw)).toBe("CC5:⣿⣿⣀⣀⣀ 41%");
  });

  test("トークンなしはそのまま", () => {
    expect(stripTmux("CC5 41%")).toBe("CC5 41%");
  });
});

describe("titleText", () => {
  test("点字ゲージを除去する (タイトルバーはプロポーショナルフォントで崩れるため)", () => {
    const raw =
      "#[fg=colour240]CC5:#[default]#[fg=yellow]⣿⣿⣷⣀⣀#[default] #[fg=white]55%#[default] #[fg=colour240](7/6 01:10|2h20m)#[default] CCW:⣿⣷⣀⣀⣀ 38% (7/6 06:00|7h10m)";
    expect(titleText(raw)).toBe("CC5: 55% (7/6 01:10|2h20m) CCW: 38% (7/6 06:00|7h10m)");
  });

  test("stale 表示 (?と(Xm ago)) は残す", () => {
    expect(titleText("CC5?:⣿⣀⣀⣀⣀ 12% (5m ago)")).toBe("CC5?: 12% (5m ago)");
  });
});

describe("shortStatus", () => {
  test("ラベルと%だけをサイドバー向けに抽出する", () => {
    const raw =
      "#[fg=colour240]CC5:#[default]#[fg=colour240]⣿⣿⣀⣀⣀#[default] #[fg=white]41%#[default] #[fg=colour240](7/6 01:10|2h55m)#[default] #[fg=colour240]CCW:#[default]#[fg=colour240]⣿⣷⣀⣀⣀#[default] #[fg=white]36%#[default] #[fg=colour240](7/6 06:00|7h45m)#[default]";
    expect(shortStatus(raw)).toBe("CC5 41% CCW 36%");
  });

  test("stale マーク付きラベル (CC5?) も拾う", () => {
    const raw = "#[fg=colour240]CC5?:#[default]⣿⣀⣀⣀⣀ #[fg=white]12%#[default]";
    expect(shortStatus(raw)).toBe("CC5? 12%");
  });

  test("抽出できなければ空文字", () => {
    expect(shortStatus("")).toBe("");
    expect(shortStatus("no limits here")).toBe("");
  });
});
