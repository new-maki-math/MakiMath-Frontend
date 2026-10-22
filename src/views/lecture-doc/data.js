import {
  getCourseChapters,
  getCourseSectionContent,
  getCachedCourseChapters
} from '../../api';

// 获取课程章节目录树
export async function getChaptersForCourse(courseId = 'kaoyan') {
  return await getCourseChapters(courseId);
}

// 获取讲义正文与大纲模型
export async function getNodeContent(courseId = 'kaoyan', sectionId = '') {
  return await getCourseSectionContent(courseId, sectionId);
}

export { getCachedCourseChapters };
