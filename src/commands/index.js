export const commandServiceKey = Symbol('commandService');

// 集中定义浏览器调试命令
const commands = Object.freeze({
  '/knowledge radomMaster': {
    description: '随机标记当前知识库中未掌握的知识点',
    run: (context) => context.updateMastery(true)
  },
  '/knowledge clearMaster': {
    description: '清空当前知识库中的掌握状态',
    run: (context) => context.updateMastery(false)
  }
});

export function createCommandService() {
  let context = null;
  function registerKnowledgeContext(next) {
    context = next;
    return () => {
      if (context === next) {
        context = null;
      }
    };
  }
  async function run(input) {
    const name = typeof input === 'string' ? input.trim().replace(/\s+/g, ' ') : '';
    const command = commands[name];
    if (!command) {
      return {
        ok: false,
        message: '未知命令，请检查命令名称。'
      };
    }
    const current = context;
    if (!current) {
      return {
        ok: false,
        message: '请先进入知识库页面。'
      };
    }
    const reason = current.unavailableReason();
    if (reason) {
      return {
        ok: false,
        message: reason
      };
    }
    try {
      return await command.run(current);
    } catch {
      return {
        ok: false,
        message: '命令执行失败，请重试。'
      };
    }
  }
  return {
    registerKnowledgeContext,
    run
  };
}

// 安装浏览器控制台入口
export function installConsoleCommands(service) {
  if (typeof window === 'undefined') {
    return;
  }
  const existing = window.maki;
  if (existing != null && (typeof existing !== 'object' || 'run' in existing)) {
    console.warn('[MakiMath] 控制台命令入口已被占用，未覆盖现有对象。');
    return;
  }
  try {
    const namespace = existing || {};
    namespace.run = (command) => service.run(command);
    if (!existing) {
      window.maki = namespace;
    }
  } catch {
    console.warn('[MakiMath] 无法安装控制台命令入口。');
  }
}
