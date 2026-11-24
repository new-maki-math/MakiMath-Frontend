import { canUseAi } from '../../../utils/ai-access.js';
import { knowledgeTool, searchKnowledge } from './knowledge.js';
import { lecturesTool, searchLectures } from './lectures.js';
import { getLearningMastery, masteryTool, validateMasteryArguments } from './mastery.js';
import { questionsTool, searchQuestions } from './questions.js';
import { validateQuery } from './shared.js';

const availableTools = [knowledgeTool, questionsTool, lecturesTool, masteryTool];

export function getAiToolContext(userText) {
  const value = String(userText || '');
  const allowMastery =
    /(?:掌握情况|掌握进度|掌握标记|已掌握|未掌握|没掌握|掌握了多少|标记.{0,8}掌握|(?:我|我的|本人).{0,20}(?:掌握|学习进度|学习情况|学过|学会|薄弱知识点|知识点标记)|(?:掌握|学习进度|学习情况).{0,12}(?:我|我的|情况|统计|多少|哪些))/.test(
      value
    );
  const allowLocal =
    /本地(?:讲义|资料|图书|书籍|题目册)|书架|我的(?:讲义|资料|图书|书籍|题目册)/.test(value);
  return {
    allowMastery,
    allowLocal,
    tools: availableTools
  };
}

export async function executeAiTool(call, signal, context = {}) {
  if (!canUseAi.value) {
    return {
      error: '当前账号无权使用 AI 工具'
    };
  }
  const name = call?.function?.name;
  if (
    !['search_knowledge', 'search_questions', 'search_lectures', 'get_learning_mastery'].includes(
      name
    )
  ) {
    return {
      error: '不支持此工具'
    };
  }
  if (name === 'get_learning_mastery' && !context.allowMastery) {
    return {
      error: '请先由用户明确要求查询其知识掌握标记或学习情况，再调用此工具。'
    };
  }
  let query;
  try {
    const args = JSON.parse(call.function.arguments);
    query = name === 'get_learning_mastery' ? validateMasteryArguments(args) : validateQuery(args);
  } catch {
    return {
      error:
        name === 'get_learning_mastery'
          ? '掌握统计参数无效'
          : '搜索参数无效，请使用不超过 120 个字符的关键词'
    };
  }
  try {
    if (name === 'search_knowledge') {
      return await searchKnowledge(query, signal);
    }
    if (name === 'search_questions') {
      return await searchQuestions(query, signal);
    }
    if (name === 'search_lectures') {
      return await searchLectures(query, signal, context.allowLocal);
    }
    return await getLearningMastery(query, signal);
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }
    return {
      error: {
        search_knowledge: '知识库检索失败',
        search_questions: '题库检索失败',
        search_lectures: '讲义检索失败',
        get_learning_mastery: '掌握统计读取失败'
      }[name]
    };
  }
}
