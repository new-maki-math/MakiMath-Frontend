const stage = MakiAnimation.stage;
stage.innerHTML = '<div class="demo"><h1>勾股定理</h1><p class="intro">直角三角形的两条直角边为 a、b，斜边为 c。</p><div class="formula"></div></div>';
const formula = stage.querySelector('.formula');
formula.innerHTML = katex.renderToString('a^2+b^2=c^2', { throwOnError: false });
MakiAnimation.register({
  pages: [
    { title: '勾股定理', steps: [{ start: 0, end: 1 }, { start: 1, end: 2 }] }
  ],
  render(time) {
    formula.style.opacity = String(Math.max(0, Math.min(1, time - 1)));
  }
});
