import {
  fetchCourseTree,
  toChapters,
  getCourseChapters,
  getCourseSectionContent,
  getCachedCourseChapters
} from '../../api';

// 获取课程章节目录树（使用统一课程 ID 接口）
export async function getChaptersForCourse(courseId = '1') {
  const tree = await fetchCourseTree(courseId || '1');
  return toChapters(tree);
}

// 获取讲义正文与大纲模型
export async function getNodeContent(courseId = '1', sectionId = '') {
  return await getCourseSectionContent(courseId || '1', sectionId);
}

export { getCachedCourseChapters };
