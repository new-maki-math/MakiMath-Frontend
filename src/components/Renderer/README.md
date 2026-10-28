# 渲染器自定义宏

渲染器支持以下 14 种 MM 宏：

- 内容框：`mm-box-definition`、`mm-box-theorem`、`mm-box-example`、`mm-box-warn`、`mm-box-conclusion`、`mm-box-frequency`、`mm-box-homework`、`mm-box-custom`
- 题目：`mm-question`、`mm-question-options`、`mm-question-blank`
- 其他：`mm-knowledge`、`mm-tag`、`mm-test`

自定义内容框使用 `#mm-box-custom(title: [标题])[正文]`，省略标题或标题为空时不显示标题栏。标题支持已适配的行内内容，包括标签和公式。正文使用现有内容解析规则。
