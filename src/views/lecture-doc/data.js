import {
  fetchCourseTree,
  toChapters,
  getCourseSectionContent,
  getCachedCourseChapters
} from '../../api';

// 获取课程章节目录树（使用统一课程 ID 接口）
export async function getChaptersForCourse(courseId) {
  const tree = await fetchCourseTree(courseId);
  return toChapters(tree);
}

// 获取讲义正文与大纲模型
export async function getNodeContent(courseId, sectionId) {
  return await getCourseSectionContent(courseId, sectionId);
}

export { getCachedCourseChapters };
