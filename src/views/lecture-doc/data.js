import {
  getCourseChapters,
  getCourseSectionContent,
  getCachedCourseChapters
} from '../../api';

/**
 * 动态获取指定课程的完整章节目录树（来自后端服务器数据）
 */
export async function getChaptersForCourse(courseId = 'kaoyan') {
  return await getCourseChapters(courseId);
}

/**
 * 动态获取指定课程指定讲次/小节的讲义正文与大纲模型
 */
export async function getNodeContent(courseId = 'kaoyan', sectionId = '') {
  return await getCourseSectionContent(courseId, sectionId);
}

export { getCachedCourseChapters };
