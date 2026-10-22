// 控制台安全警示与开源共建说明
let hasPrinted = false;

// 输出安全法警示与开源共建
export function printSecurityWarning() {
  if (hasPrinted) return;
  hasPrinted = true;

  console.log(
    '%c网络安全警示',
    'color: #b91c1c; font-size: 22px; font-weight: bold;'
  );

  console.log(
    '%c根据《中华人民共和国网络安全法》第二十九条之规定，任何个人和组织不得从事非法侵入他人网络、干扰他人网络正常功能、窃取网络数据等危害网络安全的活动；不得提供专门用于从事侵入网络、干扰网络正常功能及防护措施、窃取网络数据等危害网络安全活动的程序、工具；明知他人从事危害网络安全的活动的，不得为其提供技术支持、广告推广、支付结算等帮助。',
    'font-size: 14px; line-height: 1.8;'
  );

  console.log(
    '%c根据《中华人民共和国网络安全法》第六十六条，违反第二十九条规定，从事危害网络安全的活动，或者提供专门用于从事危害网络安全活动的程序、工具，或者为他人从事危害网络安全的活动提供技术支持、广告推广、支付结算等帮助，尚不构成犯罪的，依法给予相应行政处罚；构成犯罪的，依法追究刑事责任。',
    'color: #991b1b; font-size: 14px; font-weight: bold; line-height: 1.8;'
  );

  console.log(
    '%c请立即停止任何未经授权的系统访问、非法获取数据、绕过安全控制或破坏系统的行为。未经授权的操作可能产生相应法律责任。',
    'color: #b91c1c; font-size: 14px; font-weight: bold; line-height: 1.8;'
  );

  console.log(
    '%c本警示针对违法违规的系统访问及数据操作行为。打开浏览器开发者工具本身不当然构成违法行为。',
    'font-size: 12px;'
  );

  console.log('');
  console.log(
    '%cMakiMath 开源共建',
    'color: #3b82f6; font-size: 16px; font-weight: bold;'
  );

  console.log(
    '%cMakiMath 是一个纯粹的开源公益数学项目，旨在为考研同学与数学学习者提供自由、开放、免费的知识检索与学习体验。没有商业推广，不设付费门槛。',
    'font-size: 13px; line-height: 1.8;'
  )

  console.log(
    '%c我们欢迎所有热爱数学与开源的伙伴参与共建——无论是内容勘误、Typst 排版补充，还是前端交互与工程优化。点滴贡献，皆能让优质教育资源惠及更多求学者。',
    'font-size: 13px; line-height: 1.8;'
  )

  console.log(
    '%c期待与你在开源社区相遇，一起把这份公益资源做得更好。',
    'color: #3b82f6; font-size: 13px; font-weight: bold;'
  );
}

// 监听开发者工具开启并提示
export function setupDevToolsWarning() {
  if (typeof window === 'undefined') return;

  // 页面初始加载时触发
  printSecurityWarning();

  // 窗口尺寸突变（开发者工具展开）
  const threshold = 160;
  const checkDevTools = () => {
    const widthDiff = window.outerWidth - window.innerWidth > threshold;
    const heightDiff = window.outerHeight - window.innerHeight > threshold;
    if (widthDiff || heightDiff) {
      printSecurityWarning();
    }
  };

  window.addEventListener('resize', checkDevTools);

  // 快捷键唤起
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j'))) {
      printSecurityWarning();
    }
  });
}
