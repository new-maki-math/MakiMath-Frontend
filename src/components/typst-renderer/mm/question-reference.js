import { questionApi } from '../../../api/questions.js';
import { authStatus, currentUser } from '../../../utils/auth.js';

const pending = new Map();
let scheduled = false;
const identity = () => `${authStatus.value}:${currentUser.value?.id ?? ''}`;

async function loadBatch(tasks, context) {
  try {
    if (identity() !== context) {
      throw new Error('登录状态已变化');
    }
    const result = await questionApi.batch(tasks.map((task) => task.slug));
    if (identity() !== context) {
      throw new Error('登录状态已变化');
    }
    if (!Array.isArray(result?.items) || !Array.isArray(result?.missing_slugs)) {
      throw new Error('题目数据格式错误');
    }
    const items = new Map(result.items.map((item) => [item.question?.slug, item]));
    const missing = new Set(result.missing_slugs);
    for (const task of tasks) {
      if (items.has(task.slug)) {
        task.resolve(items.get(task.slug));
      } else if (missing.has(task.slug)) {
        task.resolve(null);
      } else {
        task.reject(new Error('题目数据不完整'));
      }
      pending.delete(task.key);
    }
  } catch (error) {
    if (error.status === 400 && error.data?.error === '题目内容过大请缩小批次') {
      if (tasks.length > 1) {
        const middle = Math.ceil(tasks.length / 2);
        await Promise.all([
          loadBatch(tasks.slice(0, middle), context),
          loadBatch(tasks.slice(middle), context)
        ]);
        return;
      }
      const task = tasks[0];
      try {
        if (identity() !== context) {
          throw new Error('登录状态已变化');
        }
        const detail = await questionApi.bySlug(task.slug);
        if (identity() !== context) {
          throw new Error('登录状态已变化');
        }
        task.resolve(detail);
      } catch (failure) {
        if (identity() === context && failure.status === 404) {
          task.resolve(null);
        } else {
          task.reject(failure);
        }
      } finally {
        pending.delete(task.key);
      }
      return;
    }
    for (const task of tasks) {
      task.reject(error);
      pending.delete(task.key);
    }
  }
}
function flush() {
  scheduled = false;
  const groups = new Map();
  for (const task of pending.values()) {
    if (task.sent) {
      continue;
    }
    task.sent = true;
    if (!groups.has(task.context)) {
      groups.set(task.context, []);
    }
    groups.get(task.context).push(task);
  }
  for (const [context, tasks] of groups) {
    for (let index = 0; index < tasks.length; index += 32) {
      loadBatch(tasks.slice(index, index + 32), context);
    }
  }
}
export function getReferencedQuestion(slug) {
  const context = identity();
  const key = `${context}:${slug}`;
  if (pending.has(key)) {
    return pending.get(key).promise;
  }
  let resolve;
  let reject;
  const promise = new Promise((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  pending.set(key, {
    key,
    context,
    slug,
    promise,
    resolve,
    reject,
    sent: false
  });
  if (!scheduled) {
    scheduled = true;
    queueMicrotask(flush);
  }
  return promise;
}
