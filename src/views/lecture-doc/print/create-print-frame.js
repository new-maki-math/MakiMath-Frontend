import { createApp, nextTick } from 'vue';

import TypstDoc from '../../../components/typst-renderer/TypstDoc.vue';
import { createCoverIllustration } from './cover-illustrations.js';
import printStyles from './print.css?inline';

export async function createPrintFrame(documentData, theme, ensureCurrent, progress, options = {}) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, {
    position: 'fixed',
    width: '794px',
    height: '1123px',
    left: '-10000px',
    top: '0',
    border: '0'
  });
  document.body.appendChild(frame);
  const apps = [];
  const dispose = () => {
    apps.forEach((app) => app.unmount());
    frame.remove();
  };
  try {
    const target = frame.contentDocument;
    target.documentElement.setAttribute('data-theme', theme);
    target.title = documentData.title;
    const styles = [];
    for (const original of document.querySelectorAll('style, link[rel="stylesheet"]')) {
      const copy = original.cloneNode(true);
      if (copy.tagName === 'LINK') {
        styles.push(
          new Promise((resolve, reject) => {
            copy.onload = resolve;
            copy.onerror = () => reject(new Error('打印样式加载失败'));
          })
        );
      }
      target.head.appendChild(copy);
    }
    const style = target.createElement('style');
    style.textContent = printStyles;
    target.head.appendChild(style);
    await Promise.all(styles);
    if (theme === 'dark') {
      const background = frame.contentWindow
        .getComputedStyle(target.documentElement)
        .getPropertyValue('--bg-app')
        .trim();
      if (background) {
        const margins = target.createElement('style');
        margins.textContent = `
          @page {
            @top-left-corner { content: ''; background: ${background}; }
            @top-center { content: ''; width: 100%; background: ${background}; }
            @top-right-corner { content: ''; background: ${background}; }
            @left-middle { content: ''; height: 100%; background: ${background}; }
            @right-middle { content: ''; height: 100%; background: ${background}; }
            @bottom-left-corner { content: ''; background: ${background}; }
            @bottom-center { content: ''; width: 100%; background: ${background}; }
            @bottom-right-corner { content: ''; background: ${background}; }
          }
        `;
        target.head.appendChild(margins);
      }
    }
    const article = target.createElement('article');
    article.className = 'print-document';
    const watermark = target.createElementNS('http://www.w3.org/2000/svg', 'svg');
    watermark.setAttribute('viewBox', '0 0 360 88');
    watermark.setAttribute('class', 'print-watermark');
    watermark.setAttribute('aria-hidden', 'true');
    const mark = target.createElementNS('http://www.w3.org/2000/svg', 'path');
    mark.setAttribute('d', 'M14 64V24l20 22 20-22v40');
    mark.setAttribute('fill', 'none');
    mark.setAttribute('stroke', 'currentColor');
    mark.setAttribute('stroke-width', '5');
    mark.setAttribute('stroke-linejoin', 'round');
    const wordmark = target.createElementNS('http://www.w3.org/2000/svg', 'text');
    wordmark.setAttribute('x', '72');
    wordmark.setAttribute('y', '54');
    wordmark.setAttribute('fill', 'currentColor');
    wordmark.setAttribute('font-family', 'Arial, sans-serif');
    wordmark.setAttribute('font-size', '30');
    wordmark.setAttribute('font-weight', '700');
    wordmark.setAttribute('letter-spacing', '2');
    wordmark.textContent = 'MAKI / MATH';
    watermark.append(mark, wordmark);
    target.body.appendChild(watermark);
    const cover = target.createElement('div');
    cover.className = 'print-cover';
    const brand = target.createElement('p');
    brand.className = 'print-cover-brand';
    brand.textContent = 'MAKI / MATH';
    cover.appendChild(brand);
    const coverMain = target.createElement('div');
    coverMain.className = 'print-cover-main';
    const label = target.createElement('p');
    label.className = 'print-cover-label';
    label.textContent = 'LECTURE NOTES  /  课程讲义';
    coverMain.appendChild(label);
    const title = target.createElement('h1');
    title.textContent = documentData.title;
    coverMain.appendChild(title);
    if (documentData.subtitle) {
      const subtitle = target.createElement('p');
      subtitle.className = 'print-cover-subtitle';
      subtitle.textContent = documentData.subtitle;
      coverMain.appendChild(subtitle);
    }
    cover.appendChild(coverMain);
    const problem = target.createElement('div');
    problem.className = 'print-cover-problem';
    const problemLabel = target.createElement('p');
    problemLabel.className = 'print-cover-problem-label';
    const illustration = createCoverIllustration(target);
    problemLabel.textContent = illustration.label;
    const problemNote = target.createElement('p');
    problemNote.className = 'print-cover-problem-note';
    problemNote.textContent = illustration.note;
    problem.append(illustration.svg, problemLabel, problemNote);
    cover.appendChild(problem);
    const footer = target.createElement('p');
    footer.className = 'print-cover-footer';
    footer.textContent = 'MAKI MATH  /  LECTURE NOTES';
    cover.appendChild(footer);
    article.appendChild(cover);
    target.body.appendChild(article);
    const total = documentData.chapters.reduce(
      (count, chapter) => count + chapter.sections.length,
      0
    );
    let rendered = 0;
    for (const chapter of documentData.chapters) {
      const group = target.createElement('section');
      group.className = 'print-chapter';
      const chapterPage = target.createElement('div');
      chapterPage.className = 'print-chapter-page';
      const heading = target.createElement('h2');
      heading.textContent = chapter.title;
      chapterPage.appendChild(heading);
      group.appendChild(chapterPage);
      article.appendChild(group);
      for (const section of chapter.sections) {
        ensureCurrent();
        const container = target.createElement('section');
        container.className = 'print-section';
        if (!options.hideSectionTitles) {
          const heading = target.createElement('h3');
          heading.textContent = section.title;
          container.appendChild(heading);
        }
        const mount = target.createElement('div');
        container.appendChild(mount);
        group.appendChild(container);
        const app = createApp(TypstDoc, { source: section.source });
        app.provide('typstPrintReferences', documentData.references);
        app.mount(mount);
        apps.push(app);
        await nextTick();
        progress(`正在排版小节 ${++rendered} / ${total}`);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    await target.fonts.ready;
    const graphicBounds = illustration.svg.getBBox();
    if (graphicBounds.width > 0 && graphicBounds.height > 0) {
      const padding = 8;
      illustration.svg.setAttribute(
        'viewBox',
        `${graphicBounds.x - padding} ${graphicBounds.y - padding} ${graphicBounds.width + padding * 2} ${graphicBounds.height + padding * 2}`
      );
    }
    const bounds = watermark.getBBox();
    if (bounds.width > 0 && bounds.height > 0) {
      watermark.setAttribute(
        'viewBox',
        `${bounds.x - 3} ${bounds.y - 3} ${bounds.width + 6} ${bounds.height + 6}`
      );
    }
    await Promise.all(
      Array.from(target.images, (image) =>
        image.decode().catch(() => {
          throw new Error('打印图片加载失败，请重试');
        })
      )
    );
    ensureCurrent();
    return { frame, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
