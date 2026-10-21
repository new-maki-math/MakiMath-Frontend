/**
 * 数据转换与适配工具 (Adapters & Transformers)
 * 将后端原始数据格式规整为适合现代前端渲染、树状导航与组件绑定的数据模型
 */

/**
 * 将后端 GET /api/courses 返回的大类与课程数据规整为侧边栏手风琴树模型
 * @param {Array} rawCats - 后端返回的 { cats: [ { name, courses: [ { id, title, live, ... } ] } ] }
 * @returns {Array} 规范化后的分类列表
 */
export function transformCourseCategories(rawCats = []) {
  if (!Array.isArray(rawCats)) return [];

  return rawCats.map((cat, catIdx) => {
    const courses = Array.isArray(cat.courses) ? cat.courses : [];
    return {
      id: cat.id || `cat-${catIdx}-${cat.name}`,
      name: cat.name || '未命名分类',
      totalCourses: cat.totalCourses !== undefined ? cat.totalCourses : courses.length,
      liveCount: cat.liveCount !== undefined ? cat.liveCount : courses.filter(c => c.live).length,
      courses: courses.map(course => ({
        id: course.id || course.slug,
        slug: course.id || course.slug,
        title: course.title || '',
        desc: course.desc || course.descr || '',
        live: !!course.live,
        nodes: Number(course.nodes) || 0,
        hidden: !!course.hidden
      }))
    };
  });
}

/**
 * 扁平化所有课程为字典或列表，方便快速查询
 * @param {Array} transformedCats 
 * @returns {Array} 扁平课程清单
 */
export function flattenCourses(transformedCats = []) {
  return transformedCats.flatMap(cat =>
    cat.courses.map(course => ({
      ...course,
      categoryName: cat.name
    }))
  );
}

/**
 * 根据 slug 获取课程名称辅助工具
 */
export function getCourseTitleBySlug(slug, categories = []) {
  for (const cat of categories) {
    const found = cat.courses.find(c => c.id === slug || c.slug === slug);
    if (found) return found.title;
  }
  return slug;
}
