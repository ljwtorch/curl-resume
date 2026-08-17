#!/usr/bin/env -S pnpm exec tsx
/**
 * 构建时预处理脚本
 * 在 Node.js 环境运行，处理图片和 Markdown
 * 注意：需要设置 FORCE_COLOR=1 环境变量以启用 chalk 颜色输出
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { Jimp } from "jimp";
// @ts-ignore
import decodeGif from "decode-gif";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

// ============ 类型定义 ============

interface ImageData {
  width: number;
  height: number;
  data: Uint8Array;
}

interface AsciiResult {
  text: string;
  colored?: string;
}

interface AsciiFrame {
  ascii: string;
  coloredAscii?: string;
  delay: number;
}

interface PreprocessedImage {
  type: "static";
  result: AsciiResult;
}

interface PreprocessedGif {
  type: "animated";
  frames: AsciiFrame[];
}

interface PreprocessedMarkdown {
  type: "markdown";
  rendered: string;
}

type PreprocessedData = PreprocessedImage | PreprocessedGif | PreprocessedMarkdown;

interface ImageConfig {
  src: string;
  width?: number;
  height?: number;
  colored?: boolean;
  animated?: boolean;
}

interface MarkdownConfig {
  markdown: string;
  pageIndex: number;
}

// ============ Markdown 渲染器配置 ============

// 配置 marked-terminal (使用默认配置 + 部分自定义)
marked.use(
  markedTerminal({
    showSectionPrefix: false,   // 不显示标题编号前缀
    reflowText: true,           // 自动换行
    width: 80,                  // 宽度限制
    tab: 2,                     // 缩进
    emoji: false,               // 禁用 emoji 转换，保留原始 Unicode emoji
  })
);

function renderMarkdownToTerminal(markdown: string): string {
  const result = marked.parse(markdown);
  return typeof result === "string" ? result : markdown;
}

// ============ ANSI 颜色 ============

const ANSI = {
  reset: "\x1b[0m",
};

function rgbToAnsiTrueColor(r: number, g: number, b: number, type: "fg" | "bg" = "fg"): string {
  return type === "fg" ? `\x1b[38;2;${r};${g};${b}m` : `\x1b[48;2;${r};${g};${b}m`;
}

// ============ ASCII 字符集 ============

const ASCII_CHARS = " .:-=+*#%@";

function rgbToGray(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function grayToChar(gray: number): string {
  const index = Math.floor((gray / 255) * (ASCII_CHARS.length - 1));
  return ASCII_CHARS[index];
}

// ============ 渲染函数 ============

function renderHalfBlock(pixels: Uint8Array, width: number, height: number): string {
  let output = "";

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x++) {
      const idx1 = (y * width + x) * 4;
      const r1 = pixels[idx1];
      const g1 = pixels[idx1 + 1];
      const b1 = pixels[idx1 + 2];
      const a1 = pixels[idx1 + 3];

      const idx2 = ((y + 1) * width + x) * 4;
      const hasBottom = y + 1 < height;
      const r2 = hasBottom ? pixels[idx2] : 0;
      const g2 = hasBottom ? pixels[idx2 + 1] : 0;
      const b2 = hasBottom ? pixels[idx2 + 2] : 0;
      const a2 = hasBottom ? pixels[idx2 + 3] : 0;

      if (a1 < 128 && a2 < 128) {
        output += `${ANSI.reset} `;
        continue;
      }

      const fg = a1 >= 128 ? rgbToAnsiTrueColor(r1, g1, b1, "fg") : "\x1b[39m";
      const bg = a2 >= 128 ? rgbToAnsiTrueColor(r2, g2, b2, "bg") : "\x1b[49m";
      output += `${fg}${bg}▀`;
    }
    output += `${ANSI.reset}\n`;
  }
  return output;
}

function renderChar(pixels: Uint8Array, width: number, height: number): string {
  let output = "";
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const a = pixels[idx + 3];

      if (a < 128) {
        output += " ";
        continue;
      }

      const gray = rgbToGray(r, g, b);
      output += grayToChar(gray);
    }
    output += "\n";
  }
  return output;
}

// ============ 图片源处理 ============

function isLocalPath(src: string): boolean {
  return !src.startsWith("http://") && !src.startsWith("https://");
}

function resolveImagePath(src: string): string {
  if (path.isAbsolute(src)) {
    return src;
  }
  return path.resolve(PROJECT_ROOT, src);
}

async function fetchImageData(src: string): Promise<Buffer> {
  if (isLocalPath(src)) {
    const filePath = resolveImagePath(src);
    console.log(`  Reading local file: ${filePath}`);
    return fs.readFileSync(filePath);
  } else {
    console.log(`  Fetching URL: ${src}`);
    const response = await fetch(src);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
  }
}

// ============ 格式检测 ============

function detectFormat(data: Buffer): "png" | "jpeg" | "gif" | "bmp" | "unknown" {
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
    return "png";
  }
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return "jpeg";
  }
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) {
    return "gif";
  }
  if (data[0] === 0x42 && data[1] === 0x4d) {
    return "bmp";
  }
  return "unknown";
}

// ============ 使用 Jimp 处理静态图片 ============

async function processStaticImage(data: Buffer, config: ImageConfig): Promise<AsciiResult> {
  const { colored = true } = config;
  const targetWidth = config.width || 80;

  const image = await Jimp.read(data);
  const aspectRatio = image.height / image.width;

  let resizeH = colored
    ? Math.round(targetWidth * aspectRatio)
    : Math.round(targetWidth * aspectRatio * 0.5);

  if (config.height) {
    resizeH = config.height;
  }

  image.resize({ w: targetWidth, h: resizeH });

  const width = image.width;
  const height = image.height;
  const pixels = new Uint8Array(image.bitmap.data);

  const asciiText = renderChar(pixels, width, height);
  const coloredText = colored ? renderHalfBlock(pixels, width, height) : undefined;

  return { text: asciiText, colored: coloredText };
}

// ============ 处理 GIF 动画 ============

function compositeFrame(
  canvas: Buffer,
  frameData: Uint8Array,
  width: number,
  height: number
): void {
  for (let i = 0; i < width * height * 4; i += 4) {
    const alpha = frameData[i + 3];
    if (alpha > 0) {
      canvas[i] = frameData[i];
      canvas[i + 1] = frameData[i + 1];
      canvas[i + 2] = frameData[i + 2];
      canvas[i + 3] = alpha;
    }
  }
}

async function processGifAnimation(data: Buffer, config: ImageConfig): Promise<AsciiFrame[]> {
  const { colored = true } = config;
  const targetWidth = config.width || 80;

  const gif = decodeGif(new Uint8Array(data));
  const frames: AsciiFrame[] = [];

  const aspectRatio = gif.height / gif.width;
  const resizeH = colored
    ? Math.round(targetWidth * aspectRatio)
    : Math.round(targetWidth * aspectRatio * 0.5);

  const canvas = Buffer.alloc(gif.width * gif.height * 4, 0);

  for (let i = 0; i < gif.frames.length; i++) {
    const frame = gif.frames[i];
    compositeFrame(canvas, new Uint8Array(frame.data), gif.width, gif.height);

    // @ts-ignore
    const image = new Jimp({ width: gif.width, height: gif.height, color: 0x00000000 });
    image.bitmap.data = Buffer.from(canvas);
    image.resize({ w: targetWidth, h: resizeH });

    const pixels = new Uint8Array(image.bitmap.data);
    const w = image.width;
    const h = image.height;

    const frameText = renderChar(pixels, w, h);
    const frameColored = colored ? renderHalfBlock(pixels, w, h) : undefined;

    frames.push({
      ascii: frameText,
      coloredAscii: frameColored,
      delay: frame.delay * 10 || 100,
    });

    process.stdout.write(`\r  Processing frame ${i + 1}/${gif.frames.length}`);
  }
  console.log("\n  Done!");

  return frames;
}

// ============ 主处理函数 ============

async function processImage(config: ImageConfig): Promise<PreprocessedImage | PreprocessedGif> {
  const data = await fetchImageData(config.src);
  const format = detectFormat(data);

  console.log(`  Format: ${format}`);

  if (config.animated && format === "gif") {
    console.log("  Processing as GIF animation...");
    const frames = await processGifAnimation(data, config);
    return { type: "animated", frames };
  } else {
    console.log("  Processing as static image...");
    const result = await processStaticImage(data, config);
    console.log("  Done!");
    return { type: "static", result };
  }
}

function processMarkdown(config: MarkdownConfig): PreprocessedMarkdown {
  console.log(`  Rendering markdown (page ${config.pageIndex})...`);
  const rendered = renderMarkdownToTerminal(config.markdown);
  console.log("  Done!");
  return { type: "markdown", rendered };
}

// ============ 配置解析 ============

function extractImageConfigs(configPath: string): { index: number; config: ImageConfig }[] {
  const content = fs.readFileSync(configPath, "utf-8");
  const configs: { index: number; config: ImageConfig }[] = [];

  const pageRegex = /\{\s*type:\s*["']image["']\s*,\s*content:\s*\{([^}]+)\}/g;
  let match;
  let index = 0;

  while ((match = pageRegex.exec(content)) !== null) {
    const contentBlock = match[1];

    const srcMatch = contentBlock.match(/src:\s*["']([^"']+)["']/);
    if (!srcMatch) continue;

    const config: ImageConfig = { src: srcMatch[1] };

    const widthMatch = contentBlock.match(/width:\s*(\d+)/);
    if (widthMatch) config.width = parseInt(widthMatch[1]);

    const heightMatch = contentBlock.match(/height:\s*(\d+)/);
    if (heightMatch) config.height = parseInt(heightMatch[1]);

    const coloredMatch = contentBlock.match(/colored:\s*(true|false)/);
    if (coloredMatch) config.colored = coloredMatch[1] === "true";

    const animatedMatch = contentBlock.match(/animated:\s*(true|false)/);
    if (animatedMatch) config.animated = animatedMatch[1] === "true";

    configs.push({ index, config });
    index++;
  }

  return configs;
}

function extractMarkdownConfigs(configPath: string): MarkdownConfig[] {
  const content = fs.readFileSync(configPath, "utf-8");
  const configs: MarkdownConfig[] = [];

  // 匹配 type: "markdown" 的页面，提取 markdown 内容
  // 使用更宽松的正则来匹配多行 markdown 内容
  const pageRegex = /\{\s*type:\s*["']markdown["']\s*,\s*content:\s*\{\s*markdown:\s*`([^`]*)`/gs;
  let match;
  let pageIndex = 0;

  while ((match = pageRegex.exec(content)) !== null) {
    const markdown = match[1];
    configs.push({ markdown, pageIndex });
    pageIndex++;
  }

  return configs;
}

// ============ 主程序 ============

async function main() {
  console.log("🔧 Content Preprocessor\n");

  const configPath = path.resolve(__dirname, "../src/config.ts");
  const outputPath = path.resolve(__dirname, "../src/preprocessed-data.json");

  // 提取图片配置
  console.log("📖 Reading config...\n");
  const imageConfigs = extractImageConfigs(configPath);
  const markdownConfigs = extractMarkdownConfigs(configPath);

  console.log(`Found ${imageConfigs.length} image(s) and ${markdownConfigs.length} markdown page(s) to process.\n`);

  const results: Record<string, PreprocessedData> = {};

  // 处理 Markdown
  if (markdownConfigs.length > 0) {
    console.log("📝 Processing Markdown pages...\n");
    for (const config of markdownConfigs) {
      console.log(`[Markdown ${config.pageIndex}]`);
      try {
        const data = processMarkdown(config);
        // 使用 markdown 内容的 hash 作为 key
        const key = `markdown:${config.pageIndex}`;
        results[key] = data;
      } catch (error) {
        console.error(`  ❌ Error: ${error}`);
      }
      console.log("");
    }
  }

  // 处理图片
  if (imageConfigs.length > 0) {
    console.log("🖼️  Processing Images...\n");
    for (const { index, config } of imageConfigs) {
      console.log(`[${index + 1}/${imageConfigs.length}] Processing: ${config.src}`);
      console.log(`  Local: ${isLocalPath(config.src) ? "Yes" : "No"}`);
      try {
        const data = await processImage(config);
        results[config.src] = data;
      } catch (error) {
        console.error(`  ❌ Error: ${error}`);
      }
      console.log("");
    }
  }

  // 保存结果为 TypeScript 文件（直接嵌入 emoji，避免 JSON 导入时的编码问题）
  console.log("💾 Saving preprocessed data as TypeScript module...");

  // 生成 TypeScript 模块内容
  const tsContent = `// 此文件由构建脚本自动生成，请勿手动修改
// Generated by scripts/preprocess.ts

export const preprocessedData = ${JSON.stringify(results, null, 2)} as const;

export default preprocessedData;
`;

  const tsOutputPath = outputPath.replace('.json', '.ts');
  fs.writeFileSync(tsOutputPath, tsContent, 'utf8');
  console.log(`Saved to: ${tsOutputPath}`);

  // 统计
  const markdownCount = Object.values(results).filter((r) => r.type === "markdown").length;
  const staticCount = Object.values(results).filter((r) => r.type === "static").length;
  const animatedCount = Object.values(results).filter((r) => r.type === "animated").length;
  const totalFrames = Object.values(results)
    .filter((r): r is PreprocessedGif => r.type === "animated")
    .reduce((sum, r) => sum + r.frames.length, 0);

  const tsOutputPath2 = outputPath.replace('.json', '.ts');
  const stats = fs.statSync(tsOutputPath2);
  const sizeKB = (stats.size / 1024).toFixed(1);

  console.log(`\n✅ Done!`);
  console.log(`   Markdown pages: ${markdownCount}`);
  console.log(`   Static images: ${staticCount}`);
  console.log(`   Animated GIFs: ${animatedCount} (${totalFrames} frames total)`);
  console.log(`   Output size: ${sizeKB} KB`);
}

main().catch(console.error);
