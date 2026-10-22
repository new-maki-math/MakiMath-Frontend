<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();

const navigateToCourse = (courseId) => {
  router.push(`/course/${courseId}`);
};
</script>

<template>
  <div class="view-container">
    <div class="view-header">
      <div class="header-main">
        <h1 class="view-title font-mono">RECOMMENDED // 讲义推荐路线</h1>
        <p class="view-desc">
          精选公理化学习路径，按偏序依赖与逻辑演进科学编排，助力高效进阶与知识脉络梳理。
        </p>
      </div>
    </div>

    <!-- 推荐路线列表 -->
    <div class="routes-grid">
      <div class="route-card">
        <div class="route-top">
          <MTag variant="purple" size="sm">ANALYSIS</MTag>
          <span class="route-nodes font-mono">23 讲次</span>
        </div>
        <h3 class="route-title">一元函数微积分拓扑网</h3>
        <p class="route-desc">
          从实数确界原理与极限定义展开，涵盖连续性、中值定理群、不定积分原函数存在性与泰勒公式逼近体系。
        </p>
        <div class="route-actions">
          <MButton variant="primary" size="sm" :mono="true" @click="navigateToCourse('kaoyan')">
            进入课程大纲 // VIEW COURSE
          </MButton>
        </div>
      </div>

      <div class="route-card">
        <div class="route-top">
          <MTag variant="cyan" size="sm">ALGEBRA</MTag>
          <span class="route-nodes font-mono">12 讲次</span>
        </div>
        <h3 class="route-title">线性代数核心架构</h3>
        <p class="route-desc">
          向量空间基公理、线性映射矩阵化、行阶梯消元法、行列式本质、特征值对角化与二次型规范化。
        </p>
        <div class="route-actions">
          <MButton variant="primary" size="sm" :mono="true" @click="navigateToCourse('xiandai-feishuxue')">
            进入课程大纲 // VIEW COURSE
          </MButton>
        </div>
      </div>

      <div class="route-card">
        <div class="route-top">
          <MTag variant="amber" size="sm">LOGIC</MTag>
          <span class="route-nodes font-mono">8 讲次</span>
        </div>
        <h3 class="route-title">逻辑、集合与初等数论衔接</h3>
        <p class="route-desc">
          命题演算、一阶量词规则、等价关系与集合商划分、Bézout 裴蜀恒等式与中国剩余定理。
        </p>
        <div class="route-actions">
          <MButton variant="primary" size="sm" :mono="true" @click="navigateToCourse('shuxue-jichu')">
            进入课程大纲 // VIEW COURSE
          </MButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view-container {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  box-sizing: border-box;
}

.view-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-subtle);
}

.header-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 680px;
}

.view-title {
  font-size: var(--font-size-larger);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  letter-spacing: 0.5px;
  margin: 0;
}

.view-desc {
  font-size: var(--font-size-smaller);
  color: var(--text-muted);
  margin: 0;
  line-height: 1.5;
}

.routes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.route-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.route-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.route-nodes {
  font-size: var(--font-size-smallest);
  color: var(--text-muted);
}

.route-title {
  font-size: var(--font-size-larger);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0;
}

.route-desc {
  font-size: var(--font-size-smaller);
  line-height: 1.6;
  color: var(--text-muted);
  flex: 1;
  margin: 0;
}

.route-actions {
  padding-top: 8px;
}
</style>
