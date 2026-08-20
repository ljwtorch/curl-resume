// src/config.ts
// 用户配置文件 - 每页独立配置

import type { Config } from "./types";

export const config: Config = {
  // ============ 全局设置 ============
  global: {
    // 默认动画速度
    speed: {
      typing: 20, // 打字速度 (ms)
      typingPause: 100, // 标点停顿 (ms)
      transition: 80, // 切换动画速度 (ms)
      effect: 40, // 动效速度 (ms)
    },

    // 颜色主题
    theme: {
      primary: "brightCyan",
      secondary: "green",
      accent: "yellow",
      highlight: "brightGreen",
      error: "red",
    },
  },

  // ============ 页面配置 ============
  // 每个页面独立配置，不依赖全局 name/title
  pages: [
    // // 第一页: Logo
    // {
    //   type: "logo",
    //   content: {
    //     text: "一个命令行展示工具", // 要转换为ASCII大字的文本
    //     subtitle: "I don't know what the fuck going on, Just kidding.",
    //     tagline: "",
    //   },
    //   effect: "none", // 内容动效: none | typing | decrypt | glitch | matrix
    //   transition: "none", // 过渡动画: none | fade | glitch | scanline
    // },

    // 1. GIF 演示
    // {
    //   type: "image",
    //   content: {
    //     src: "assets/rog.gif",
    //     width: 50,
    //     colored: true,
    //     animated: true,
    //   },
    //   effect: "none",
    //   transition: "fade"
    // },
    // 2. 图像演示
    {
      type: "image",
      content: {
        src: "assets/huitailang.png",
        width: 50,
        colored: true,
        animated: false,
      },
      effect: "matrix",
      transition: "fade",
      stayTime: 2000,
    },
    // 3. 纯文本演示
    {
      type: "raw",
      content: {
        text: "摘下最喜欢的麦穗，然后闭着眼睛穿过整个麦田。",
      },
      effect: "decrypt", // 解密效果
      transition: "fade",
      stayTime: 2500,
    },
    // 4. Markdown 演示
    {
      type: "markdown",
      content: {
        markdown: `
## 家规

1. 花花永远是对的;
2. 什么都听花花的;
3. 不能惹花花生气;
4. 如果花花错了,请看第一条;

`,
      },
      effect: "typing", // 打字机效果
      transition: "glitch",
    },
  ],
};

// ============ 页面类型说明 ============
//
// type: "logo"
//   content: {
//     text: string,          // 转换为ASCII大字的文本
//     ascii?: string,        // 或者直接提供ASCII art
//     subtitle?: string,     // 副标题
//     tagline?: string,      // 标语
//   }
//
// type: "markdown"
//   content: {
//     markdown: string,      // Markdown 内容
//   }
//
// type: "image"
//   content: {
//     src: string,           // 图片URL
//     width?: number,        // ASCII宽度 (默认80)
//     height?: number,       // ASCII高度 (自动计算)
//     colored?: boolean,     // 是否使用颜色
//     animated?: boolean,    // 是否为GIF动画
//   }
//
// type: "raw"
//   content: {
//     text: string,          // 原始文本
//   }
//
// ============ 效果说明 ============
//
// effect (内容动效 - 内容构建完成后的动画):
//   - "none":     无动效，直接显示
//   - "typing":   逐字键入
//   - "decrypt":  黑客解密效果
//   - "glitch":   故障抖动
//   - "matrix":   黑客帝国下落效果
//
// transition (过渡动画 - 切换到下一页的动画):
//   - "none":     无过渡
//   - "fade":     渐隐
//   - "glitch":   故障切换
//   - "scanline": 扫描线
//
// stayTime (页面停留时间):
//   - 数值类型，单位为毫秒 (ms)
//   - 页面渲染完成后停留的时间
//   - 例如: stayTime: 2000 表示停留 2 秒
//
// speedMultiplier (动画速度倍率):
//   - 数值类型，默认为 1
//   - 控制页面所有动画的速度倍率
//   - 1 = 正常速度
//   - <1 = 加快 (如 0.5 = 2倍速)
//   - >1 = 减慢 (如 2 = 0.5倍速)
//   - 例如: speedMultiplier: 0.5 表示动画以 2 倍速播放
