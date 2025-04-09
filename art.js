#!/usr/bin/env node

//half of this is ai ok im sorry

const fs = require("fs");
const path = require("path");
const { prideFlags } = require("./flags");

const exitWithError = (message) => {
  console.error("err: " + message);
  process.exit(1);
};

const hexToAnsi = (hex, isBg = false) => {
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);
  return isBg ? `48;2;${r};${g};${b}` : `38;2;${r};${g};${b}`;
};

const colorMap = {
  black: "30",
  red: "31",
  green: "32",
  yellow: "33",
  blue: "34",
  purple: "35",
  magenta: "35",
  cyan: "36",
  white: "37",
};

const bgMap = Object.fromEntries(
  Object.entries(colorMap).map(([k, v]) => [k, String(Number(v) + 10)])
);

const formatMap = {
  bold: "1",
  dim: "2",
  italic: "3",
  underline: "4",
  blink: "5",
  reverse: "7",
  hidden: "8",
  strikethrough: "9",
};

let inputFile = null;
let fg = null,
  bg = null,
  fmt = null,
  custom = null;
let multi = false;

let pride = null;
let prideMode = null;
let prideOrient = "horiz";

let endMode = null;

const parseColorFunc = (str) => {
  str = str.trim();
  let match;

  if ((match = str.match(/^hex\((#?[0-9a-fA-F]{6})\)$/))) {
    const hex = match[1].startsWith("#") ? match[1] : `#${match[1]}`;
    return hex;
  }

  if ((match = str.match(/^rgb\((\d+),(\d+),(\d+)\)$/))) {
    const [_, r, g, b] = match;
    return `#${(+r).toString(16).padStart(2, "0")}${(+g)
      .toString(16)
      .padStart(2, "0")}${(+b).toString(16).padStart(2, "0")}`;
  }

  if ((match = str.match(/^hsl\((\d+),(\d+)%,(\d+)%\)$/))) {
    const [_, h, s, l] = match.map(Number);
    return hslToHex(h, s / 100, l / 100);
  }

  return null;
};

const hslToHex = (h, s, l) => {
  let c = (1 - Math.abs(2 * l - 1)) * s;
  let x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  let m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;

  if (h >= 0 && h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (n) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Parse the command line arguments
for (let i = 0; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (!arg.startsWith("--")) {
    if (!inputFile && i > 1) inputFile = arg;
  } else {
    const next = process.argv[i + 1];
    switch (arg) {
      case "--fg":
        if (next) {
          const parsed = parseColorFunc(next);
          if (parsed) {
            fg = hexToAnsi(parsed, false);
          } else {
            fg = colorMap[next.toLowerCase()] || next;
          }
          i++;
        }
        break;
      case "--bg":
        if (next) {
          const parsed = parseColorFunc(next);
          if (parsed) {
            bg = hexToAnsi(parsed, true);
          } else {
            bg = bgMap[next.toLowerCase()] || next;
          }
          i++;
        }
        break;
      case "--fmt":
        if (next) {
          fmt = formatMap[next.toLowerCase()] || next;
          i++;
        }
        break;
      case "--multi":
        multi = true;
        break;
      case "--custom":
        if (next) {
          custom = next;
          i++;
        }
        break;
      case "--pride":
        if (
          next &&
          (next.toLowerCase() === "fg" || next.toLowerCase() === "bg")
        ) {
          prideMode = next.toLowerCase();
          i++;
          if (process.argv[i + 1]) {
            pride = process.argv[i + 1].toLowerCase();
            i++;
          } else {
            exitWithError(
              `--pride ${prideMode} requires an argument (e.g., trans, gay, etc.).`
            );
          }
        } else {
          exitWithError("--pride requires a subflag 'fg' or 'bg'.");
        }
        break;
      case "--pride-orient":
        if (next) {
          if (next.toLowerCase() === "horiz" || next.toLowerCase() === "vert") {
            prideOrient = next.toLowerCase();
          } else {
            exitWithError("--pride-orient must be either 'horiz' or 'vert'.");
          }
          i++;
        }
        break;
      // NEW: parsing the new --end flag
      case "--end":
        if (next) {
          const validEnds = ["fade", "triangle", "saw", "none"]; // Added "none"
          if (validEnds.includes(next.toLowerCase())) {
            endMode = next.toLowerCase();
            i++;
          } else {
            exitWithError(
              "--end flag must be one of: fade, triangle, saw, none"
            );
          }
        } else {
          exitWithError(
            "--end flag requires an argument (fade, triangle, saw, none)"
          );
        }
        break;
      default:
        break;
    }
  }
}

if (!inputFile) {
  exitWithError(
    "Usage: script <input-file.txt> [--fg <color>] [--bg <color>] [--fmt <style>] [--custom <ansi-code>] [--multi] [--pride fg|bg <flag>] [--pride-orient horiz|vert] [--end fade|triangle|saw]"
  );
}

if (!fs.existsSync(inputFile)) {
  exitWithError(`File ${inputFile} not found!`);
}

if (pride) {
  if (!prideFlags[pride]) {
    exitWithError(
      `Unknown pride flag '${pride}'. Options: ${Object.keys(prideFlags).join(
        ", "
      )}`
    );
  }
}

let stylePrefix = "";
// If not in pride mode, set style based on custom or fg/bg/fmt info.

if (!pride) {
  if (custom) {
    stylePrefix = `\\033[${custom}m`;
  } else if (fg || bg || fmt) {
    const codes = [fmt, fg, bg].filter(Boolean).join(";");
    stylePrefix = `\\033[${codes}m`;
  }
}

const outputFile = path.basename(inputFile, ".txt") + ".sh";

const escapeString = (str) =>
  str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\$/g, "\\$")
    .replace(/%/g, "%%");

const escapeForBashDollar = (str) =>
  str
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, "\\n")
    .replace("", "");

const outputLines = ["#!/bin/bash"];

const getEndString = (lineNumber, lineLength, totalLines) => {
  if (!endMode || endMode === "none") return "";
  if (endMode === "fade") {
    return `\\033[0m\\033[${bg.replace("48", "38")}m▓▒░`;
  } else if (endMode === "triangle") {
    const mid = totalLines / 2;
    return " ".repeat(Math.floor(Math.abs(mid - Math.abs(lineNumber - mid))));
  } else if (endMode === "saw") {
    const pattern = [0, 1, 2, 1];
    const count = pattern[lineNumber % pattern.length];
    return " ".repeat(count);
  }
  return "";
};

// A little flag to know if we have a background defined.
const backgroundEnabled = bg !== null || (pride && prideMode === "bg");

if (pride) {
  const processPrideLines = (linesArray, includeEcho = true) => {
    const flagData = prideFlags[pride];
    const numBands = flagData.length;
    const resetCode = "\\033[0m";
    let processed = [];
    let lineCounter = 0; // keep track of the line number for --end effects

    if (prideOrient === "horiz") {
      const totalProp = flagData.reduce((acc, [, prop]) => acc + prop, 0);
      const L = linesArray.length;
      let bandLineCounts = flagData.map(([, prop]) =>
        Math.floor((prop / totalProp) * L)
      );
      let assigned = bandLineCounts.reduce((a, b) => a + b, 0);
      let i = 0;
      while (assigned < L) {
        bandLineCounts[i % numBands]++;
        assigned++;
        i++;
      }
      let lineIndex = 0;
      for (let band = 0; band < numBands; band++) {
        let codes = [];
        if (fmt) codes.push(fmt);
        if (prideMode === "bg") {
          if (fg) codes.push(fg);
          codes.push(hexToAnsi(flagData[band][0], true));
        } else {
          if (bg) codes.push(bg);
          codes.push(hexToAnsi(flagData[band][0], false));
        }
        const ansi = `\\033[${codes.join(";")}m`;
        for (let j = 0; j < bandLineCounts[band]; j++) {
          const escapedLine = escapeString(linesArray[lineIndex]);
          let extra = "";
          if (backgroundEnabled && endMode) {
            extra = getEndString(lineCounter, escapedLine.length, L);
          }

          if (includeEcho) {
            processed.push(
              `echo -e "${
                endMode !== "none" ? "" : resetCode
              }${ansi}${escapedLine}${extra}${
                endMode === "none" ? "" : resetCode
              }"`
            );
          } else {
            processed.push(
              `${
                endMode !== "none" ? "" : resetCode
              }${ansi}${escapedLine}${extra}${
                endMode === "none" ? "" : resetCode
              }`
            );
          }
          lineIndex++;
          lineCounter++;
        }
      }
    } else {
      const maxLength = Math.max(...linesArray.map((line) => line.length));
      linesArray = linesArray.map((line) => line.padEnd(maxLength, " "));

      const totalProp = flagData.reduce((acc, [, prop]) => acc + prop, 0);
      linesArray.forEach((line) => {
        const lineLength = line.length; // Now every line is of length maxLength
        const lineLength = line.length;
        let widths = flagData.map(([, prop]) =>
          Math.floor((prop / totalProp) * lineLength)
        );
        let assigned = widths.reduce((a, b) => a + b, 0);
        let k = 0;
        while (assigned < lineLength) {
          widths[k % numBands]++;
          assigned++;
          k++;
        }
        let pos = 0;
        let composed = endMode !== "none" ? "" : resetCode;

        for (let band = 0; band < numBands; band++) {
          const seg = line.substr(pos, widths[band]);
          pos += widths[band];

          let codes = [];
          if (fmt) codes.push(fmt);
          if (prideMode === "bg") {
            if (fg) codes.push(fg);
            codes.push(hexToAnsi(flagData[band][0], true));
          } else {
            if (bg) codes.push(bg);
            codes.push(hexToAnsi(flagData[band][0], false));
          }
          const ansi = `\\033[${codes.join(";")}m`;
          composed += `${ansi}${escapeString(seg)}`;
        }
        // Append the end-effect just before resetting colors.
        if (backgroundEnabled && endMode) {
          composed += getEndString(lineCounter, lineLength, linesArray.length);
        }
        composed += endMode === "none" ? "" : resetCode;
        if (includeEcho) {
          processed.push(`echo -e "${composed}"`);
        } else {
          processed.push(`${composed}`);
        }
        lineCounter++;
      });
    }
    if (includeEcho) {
      processed.push(`echo -e "${resetCode}"`);
    } else {
      processed.push(`${resetCode}`);
    }
    return processed;
  };

  if (multi) {
    const content = fs.readFileSync(inputFile, "utf-8");
    const segmentsRaw = content
      .split(/\n(?:\s*\n){2,}/)
      .filter((segment) => segment.trim());
    if (segmentsRaw.length === 0) {
      exitWithError("No segments found in the input file!");
    }

    let processedSegments = [];
    segmentsRaw.forEach((segment) => {
      const segLines = segment.split("\n");
      while (segLines.length && !segLines[0].trim()) {
        segLines.shift();
      }
      while (segLines.length && !segLines[segLines.length - 1].trim()) {
        segLines.pop();
      }
      const processed = processPrideLines(segLines, false);

      processedSegments.push(processed.join("\n"));
    });

    outputLines.push("segments=(");
    processedSegments.forEach((seg) => {
      outputLines.push(`$'${seg.replace(/'/g, "\\'")}'`);
    });
    outputLines.push(")");
    outputLines.push("selected=${segments[$RANDOM % ${#segments[@]}]}");
    outputLines.push('echo -e "$selected"');
  } else {
    const lines = fs.readFileSync(inputFile, "utf-8").split("\n");
    const processed = processPrideLines(lines);
    processed.forEach((line) => outputLines.push(line));
  }
} else if (multi) {
  const content = fs.readFileSync(inputFile, "utf-8");
  let segments = content.split(/\n(?:\s*\n){2,}/).filter((seg) => seg.trim());
  if (segments.length === 0) {
    exitWithError("No segments found in the input file!");
  }
  outputLines.push("segments=(");
  segments.forEach((segment) => {
    const segLines = segment.split("\n");
    while (segLines.length && !segLines[0].trim()) {
      segLines.shift();
    }
    while (segLines.length && !segLines[segLines.length - 1].trim()) {
      segLines.pop();
    }
    const cleanedSegment = segLines.join("\n");
    const escaped = escapeForBashDollar(cleanedSegment);
    outputLines.push(`$'${escaped}'`);
  });
  outputLines.push(")");
  outputLines.push("selected=${segments[$RANDOM % ${#segments[@]}]}");
  if (stylePrefix) {
    outputLines.push(`echo -e "${stylePrefix}$selected\\033[0m"`);
  } else {
    outputLines.push('echo -e "$selected"');
  }
} else {
  // Non-pride, non-multi branch.
  if (stylePrefix) {
    outputLines.push(`echo -e "${stylePrefix}"`);
  }
  const lines = fs
    .readFileSync(inputFile, "utf-8")
    .split("\n")
    .filter((line) => line.trim());
  lines.forEach((line, idx) => {
    let extra = "";
    if (backgroundEnabled && endMode) {
      extra = getEndString(idx, line.length, lines.length);
    }
    // Use echo -e so that any escape sequences work their magic.
    outputLines.push(`echo -e "${escapeString(line)}${extra}"`);
  });
  if (stylePrefix) {
    outputLines.push(`echo -e "\\033[0m"`);
  }
}

fs.writeFileSync(outputFile, outputLines.join("\n"), "utf-8");
fs.chmodSync(outputFile, 0o755);
console.log(`Script created successfully: ${outputFile}`);
