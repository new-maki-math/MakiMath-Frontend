// 规整课程分类为侧边栏树结构
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
        id: course.id ?? '',
        slug: course.slug || '',
        title: course.title || '',
        desc: course.desc || course.descr || '',
        live: !!course.live,
        nodes: Number(course.nodes) || 0,
        hidden: !!course.hidden
      }))
    };
  });
}
