import { ref } from 'vue';

// 界面文案集中维护；讲义、题目和用户输入不经过翻译。
const messages = {
  我的书架: ['我的书架', '我的書架', 'マイ本棚', 'My bookshelf'],
  知识库: ['知识库', '知識庫', '知識ベース', 'Knowledge base'],
  题库: ['题库', '題庫', '問題バンク', 'Question bank'],
  错题本: ['错题本', '錯題本', '間違いノート', 'Mistake book'],
  图书推荐: ['图书推荐', '圖書推薦', 'おすすめの本', 'Recommended books'],
  资源中心: ['资源中心', '資源中心', 'リソースセンター', 'Resource center'],
  知识库工作台: ['知识库工作台', '知識庫工作台', '知識ベース管理', 'Knowledge workspace'],
  题库工作台: ['题库工作台', '題庫工作台', '問題バンク管理', 'Question workspace'],
  图书工作台: ['图书工作台', '圖書工作台', '書籍ワークスペース', 'Book workspace'],
  平台管理: ['平台管理', '平台管理', 'プラットフォーム管理', 'Platform administration'],
  本地讲义: ['本地讲义', '本機講義', 'ローカル講義', 'Local lecture notes'],
  我创作的讲义: ['我创作的讲义', '我創作的講義', '自分の講義', 'My lecture notes'],
  本地题目册: ['本地题目册', '本機題目冊', 'ローカル問題集', 'Local workbooks'],
  我创作的题目册: ['我创作的题目册', '我創作的題目冊', '自分の問題集', 'My workbooks'],
  '正在加载本地讲义…': [
    '正在加载本地讲义…',
    '正在載入本機講義…',
    'ローカル講義を読み込み中…',
    'Loading local lecture notes…'
  ],
  '正在加载我创作的讲义…': [
    '正在加载我创作的讲义…',
    '正在載入我創作的講義…',
    '自分の講義を読み込み中…',
    'Loading your lecture notes…'
  ],
  '正在加载本地题目册…': [
    '正在加载本地题目册…',
    '正在載入本機題目冊…',
    'ローカル問題集を読み込み中…',
    'Loading local workbooks…'
  ],
  '正在加载我创作的题目册…': [
    '正在加载我创作的题目册…',
    '正在載入我創作的題目冊…',
    '自分の問題集を読み込み中…',
    'Loading your workbooks…'
  ],
  未命名讲义: ['未命名讲义', '未命名講義', '無題の講義', 'Untitled lecture notes'],
  未命名题目册: ['未命名题目册', '未命名題目冊', '無題の問題集', 'Untitled workbook'],
  '去图书推荐，添加一本讲义到本地': [
    '去图书推荐，添加一本讲义到本地',
    '前往圖書推薦，將講義加入本機',
    'おすすめの本から講義を追加',
    'Add lecture notes from recommended books'
  ],
  空空如也: ['空空如也', '空空如也', 'まだ何もありません', 'Nothing here yet'],
  重试: ['重试', '重試', '再試行', 'Retry'],
  上一页: ['上一页', '上一頁', '前のページ', 'Previous'],
  下一页: ['下一页', '下一頁', '次のページ', 'Next'],
  每页条数: ['每页条数', '每頁筆數', 'ページあたりの件数', 'Items per page'],
  '共 {count} 条': ['共 {count} 条', '共 {count} 筆', '全 {count} 件', '{count} total'],
  '{count} 条/页': ['{count} 条/页', '{count} 筆/頁', '{count} 件/ページ', '{count} per page'],
  '{count} 本': ['{count} 本', '{count} 本', '{count} 冊', '{count} books'],
  语言: ['语言', '語言', '言語', 'Language'],
  跟随系统: ['跟随系统', '跟隨系統', 'システム設定に従う', 'System default'],
  深色: ['深色', '深色', 'ダーク', 'Dark'],
  浅色: ['浅色', '淺色', 'ライト', 'Light'],
  春: ['春', '春', '春', 'Spring'],
  夏: ['夏', '夏', '夏', 'Summer'],
  秋: ['秋', '秋', '秋', 'Autumn'],
  冬: ['冬', '冬', '冬', 'Winter'],
  选择主题: ['选择主题', '選擇主題', 'テーマを選択', 'Choose theme'],
  '主题：{name}': ['主题：{name}', '主題：{name}', 'テーマ：{name}', 'Theme: {name}'],
  确定: ['确定', '確定', '確認', 'Confirm'],
  取消: ['取消', '取消', 'キャンセル', 'Cancel'],
  关闭窗口: ['关闭窗口', '關閉視窗', 'ウィンドウを閉じる', 'Close dialog'],
  '处理中...': ['处理中...', '處理中...', '処理中...', 'Processing...'],
  '加载中…': ['加载中…', '載入中…', '読み込み中…', 'Loading…'],
  更新日志: ['更新日志', '更新日誌', '更新履歴', 'Release notes'],
  '更新日志，有未读版本': [
    '更新日志，有未读版本',
    '更新日誌，有未讀版本',
    '未読の更新履歴があります',
    'Unread release notes'
  ],
  '正在加载更新日志…': [
    '正在加载更新日志…',
    '正在載入更新日誌…',
    '更新履歴を読み込み中…',
    'Loading release notes…'
  ],
  历史版本: ['历史版本', '歷史版本', '過去のバージョン', 'Previous releases'],
  '保存中…': ['保存中…', '儲存中…', '保存中…', 'Saving…'],
  已读: ['已读', '已讀', '既読', 'Read'],
  标记已读: ['标记已读', '標記已讀', '既読にする', 'Mark as read'],
  刷新内容区域: ['刷新内容区域', '重新整理內容區域', '内容を更新', 'Refresh content'],
  '查找节点、公式定义或输入命令...': [
    '查找节点、公式定义或输入命令...',
    '查找節點、公式定義或輸入指令...',
    '項目・公式を検索、またはコマンドを入力...',
    'Search topics or formulas, or enter a command...'
  ],
  清除内容: ['清除内容', '清除內容', '入力を消去', 'Clear input'],
  匹配知识点与图书: [
    '匹配知识点与图书',
    '符合的知識點與圖書',
    '一致する知識項目と書籍',
    'Matching topics and books'
  ],
  推荐图书: ['推荐图书', '推薦圖書', 'おすすめの本', 'Recommended books'],
  '{count} 节点': ['{count} 节点', '{count} 個節點', '{count} 件', '{count} results'],
  知识点: ['知识点', '知識點', '知識項目', 'Topic'],
  题目册: ['题目册', '題目冊', '問題集', 'Workbook'],
  讲义: ['讲义', '講義', '講義', 'Lecture notes'],
  正在搜索: ['正在搜索', '正在搜尋', '検索中', 'Searching'],
  '未找到与「{query}」相关的内容': [
    '未找到与「{query}」相关的内容',
    '找不到與「{query}」相關的內容',
    '「{query}」に一致する内容がありません',
    'No results for “{query}”'
  ],
  暂无推荐图书: [
    '暂无推荐图书',
    '暫無推薦圖書',
    'おすすめの本はまだありません',
    'No recommendations yet'
  ],
  导航: ['导航', '導覽', '移動', 'Navigate'],
  确认跳转: ['确认跳转', '確認前往', '開く', 'Open'],
  退出: ['退出', '退出', '閉じる', 'Close'],
  '搜索考研高数核心定理，如: 泰勒公式...': [
    '搜索考研高数核心定理，如: 泰勒公式...',
    '搜尋考研高等數學核心定理，如：泰勒公式...',
    '数学の定理を検索（例：テイラーの定理）...',
    'Search for a theorem, e.g. Taylor’s theorem...'
  ],
  '搜索课程或章节，如: 极限与连续...': [
    '搜索课程或章节，如: 极限与连续...',
    '搜尋課程或章節，如：極限與連續...',
    'コースや章を検索（例：極限と連続）...',
    'Search courses or chapters, e.g. limits and continuity...'
  ],
  '键入 Typst 公式代码，如: $f(x) = \\int_0^x e^{-t^2} dt$...': [
    '键入 Typst 公式代码，如: $f(x) = \\int_0^x e^{-t^2} dt$...',
    '輸入 Typst 公式程式碼，例如：$f(x) = \\int_0^x e^{-t^2} dt$...',
    'Typst の数式コードを入力...',
    'Enter a Typst formula...'
  ],
  '搜索线性代数，如: 特征值与相似对角化...': [
    '搜索线性代数，如: 特征值与相似对角化...',
    '搜尋線性代數，如：特徵值與相似對角化...',
    '線形代数を検索（例：固有値）...',
    'Search linear algebra, e.g. eigenvalues...'
  ],
  用户管理: ['用户管理', '使用者管理', 'ユーザー管理', 'User management'],
  邀请码管理: ['邀请码管理', '邀請碼管理', '招待コード管理', 'Invitation codes'],
  内容审核: ['内容审核', '內容審核', 'コンテンツ審査', 'Content review'],
  全站审计日志: ['全站审计日志', '全站稽核日誌', '監査ログ', 'Audit log'],
  正在验证登录状态: [
    '正在验证登录状态',
    '正在驗證登入狀態',
    'ログイン状態を確認中',
    'Checking login status'
  ],
  '登录状态验证失败，请重试': [
    '登录状态验证失败，请重试',
    '登入狀態驗證失敗，請重試',
    'ログイン状態を確認できませんでした',
    'Could not check login status. Please retry.'
  ],
  用户设置与详情: [
    '用户设置与详情',
    '使用者設定與詳情',
    'ユーザー設定と詳細',
    'Account settings and details'
  ],
  查看用户设置与详情: [
    '查看用户设置与详情',
    '查看使用者設定與詳情',
    'ユーザー設定と詳細を表示',
    'View account settings and details'
  ],
  登录或注册: ['登录或注册', '登入或註冊', 'ログインまたは登録', 'Sign in or register'],
  退出登录: ['退出登录', '登出', 'ログアウト', 'Sign out'],
  如何使用: ['如何使用', '如何使用', '使い方', 'Help'],
  展开导航栏: ['展开导航栏', '展開導覽列', 'ナビゲーションを開く', 'Expand navigation'],
  收起导航栏: ['收起导航栏', '收合導覽列', 'ナビゲーションを閉じる', 'Collapse navigation'],
  打开导航目录: ['打开导航目录', '開啟導覽目錄', 'ナビゲーションを開く', 'Open navigation'],
  搜索数学节点或公式: [
    '搜索数学节点或公式',
    '搜尋數學節點或公式',
    '数学項目や数式を検索',
    'Search topics or formulas'
  ],
  个人中心: ['个人中心', '個人中心', 'マイアカウント', 'My account'],
  关闭搜索: ['关闭搜索', '關閉搜尋', '検索を閉じる', 'Close search'],
  电脑端: ['电脑端', '電腦版', 'パソコン版', 'Desktop only'],
  请在电脑端使用: [
    '请在电脑端使用',
    '請在電腦端使用',
    'パソコンでご利用ください',
    'Please use a desktop browser'
  ],
  返回首页: ['返回首页', '返回首頁', 'ホームに戻る', 'Back to home'],
  登录已过期: ['登录已过期', '登入已過期', 'ログインの有効期限が切れました', 'Session expired'],
  '请使用当前账号重新登录，正在编辑的内容会保留': [
    '请使用当前账号重新登录，正在编辑的内容会保留',
    '請使用目前帳號重新登入，正在編輯的內容會保留',
    '現在のアカウントで再ログインしてください。編集中の内容は保持されます',
    'Sign in again with the current account. Your edits will be preserved.'
  ],
  账号: ['账号', '帳號', 'アカウント', 'Account'],
  密码: ['密码', '密碼', 'パスワード', 'Password'],
  '正在登录…': ['正在登录…', '正在登入…', 'ログイン中…', 'Signing in…'],
  重新登录: ['重新登录', '重新登入', '再ログイン', 'Sign in again'],
  '登录已恢复，请继续编辑': [
    '登录已恢复，请继续编辑',
    '登入已恢復，請繼續編輯',
    'ログインしました。編集を続けてください',
    'Signed in. You can continue editing.'
  ],
  重新登录失败: [
    '重新登录失败',
    '重新登入失敗',
    '再ログインに失敗しました',
    'Could not sign in again'
  ],
  查看用户并管理账号状态: [
    '查看用户并管理账号状态',
    '查看使用者並管理帳號狀態',
    'ユーザーとアカウント状態を管理',
    'View users and manage account status'
  ],
  刷新列表: ['刷新列表', '重新整理清單', '一覧を更新', 'Refresh list'],
  刷新日志: ['刷新日志', '重新整理日誌', 'ログを更新', 'Refresh log'],
  用户名: ['用户名', '使用者名稱', 'ユーザー名', 'Username'],
  显示昵称: ['显示昵称', '顯示暱稱', '表示名', 'Display name'],
  系统角色: ['系统角色', '系統角色', 'システム権限', 'System role'],
  账号状态: ['账号状态', '帳號狀態', 'アカウント状態', 'Account status'],
  注册时间: ['注册时间', '註冊時間', '登録日時', 'Registration date'],
  操作: ['操作', '操作', '操作', 'Actions'],
  版本: ['版本', '版本', 'バージョン', 'Version'],
  标题: ['标题', '標題', 'タイトル', 'Title'],
  提交时间: ['提交时间', '提交時間', '提出日時', 'Submitted'],
  审核: ['审核', '審核', '審査', 'Review'],
  时间: ['时间', '時間', '日時', 'Time'],
  操作者: ['操作者', '操作者', '操作ユーザー', 'User'],
  角色: ['角色', '角色', '権限', 'Role'],
  方法: ['方法', '方法', 'メソッド', 'Method'],
  状态: ['状态', '狀態', '状態', 'Status'],
  耗时: ['耗时', '耗時', '所要時間', 'Duration'],
  '匿名/系统': ['匿名/系统', '匿名/系統', '匿名／システム', 'Anonymous / system'],
  超级管理员: ['超级管理员', '超級管理員', 'スーパー管理者', 'Super administrator'],
  编者: ['编者', '編者', '編集者', 'Editor'],
  正常: ['正常', '正常', '有効', 'Active'],
  已禁用: ['已禁用', '已停用', '無効', 'Disabled'],
  禁用: ['禁用', '停用', '無効にする', 'Disable'],
  启用: ['启用', '啟用', '有効にする', 'Enable'],
  请验证超级管理员凭据以进入系统管理控制台: [
    '请验证超级管理员凭据以进入系统管理控制台',
    '請驗證超級管理員憑證以進入系統管理主控台',
    '管理コンソールに入るには管理者認証が必要です',
    'Verify your administrator credentials to enter the console'
  ],
  管理员账号: ['管理员账号', '管理員帳號', '管理者アカウント', 'Administrator account'],
  请输入超级管理员用户名: [
    '请输入超级管理员用户名',
    '請輸入超級管理員使用者名稱',
    '管理者のユーザー名を入力',
    'Enter administrator username'
  ],
  登录密码: ['登录密码', '登入密碼', 'ログインパスワード', 'Password'],
  请输入管理员密码: [
    '请输入管理员密码',
    '請輸入管理員密碼',
    '管理者パスワードを入力',
    'Enter administrator password'
  ],
  '验证中...': ['验证中...', '驗證中...', '認証中...', 'Verifying...'],
  进入控制台: ['进入控制台', '進入主控台', 'コンソールを開く', 'Open console'],
  保存: ['保存', '儲存', '保存', 'Save'],
  删除: ['删除', '刪除', '削除', 'Delete'],
  编辑: ['编辑', '編輯', '編集', 'Edit'],
  创建: ['创建', '建立', '作成', 'Create'],
  新增: ['新增', '新增', '追加', 'Add'],
  导入: ['导入', '匯入', 'インポート', 'Import'],
  导出: ['导出', '匯出', 'エクスポート', 'Export'],
  搜索: ['搜索', '搜尋', '検索', 'Search'],
  刷新: ['刷新', '重新整理', '更新', 'Refresh'],
  返回: ['返回', '返回', '戻る', 'Back'],
  关闭: ['关闭', '關閉', '閉じる', 'Close'],
  展开: ['展开', '展開', '展開', 'Expand'],
  收起: ['收起', '收合', '折りたたむ', 'Collapse'],
  更多: ['更多', '更多', 'その他', 'More'],
  提交: ['提交', '提交', '送信', 'Submit'],
  确认: ['确认', '確認', '確認', 'Confirm'],
  名称: ['名称', '名稱', '名前', 'Name'],
  类型: ['类型', '類型', '種類', 'Type'],
  描述: ['描述', '描述', '説明', 'Description'],
  备注: ['备注', '備註', 'メモ', 'Notes'],
  创建时间: ['创建时间', '建立時間', '作成日時', 'Created'],
  更新时间: ['更新时间', '更新時間', '更新日時', 'Updated'],
  暂无数据: ['暂无数据', '暫無資料', 'データがありません', 'No data'],
  全部: ['全部', '全部', 'すべて', 'All'],
  加载中: ['加载中', '載入中', '読み込み中', 'Loading'],
  加载失败: ['加载失败', '載入失敗', '読み込みに失敗しました', 'Could not load'],
  保存成功: ['保存成功', '儲存成功', '保存しました', 'Saved'],
  保存失败: ['保存失败', '儲存失敗', '保存に失敗しました', 'Could not save'],
  删除成功: ['删除成功', '刪除成功', '削除しました', 'Deleted'],
  删除失败: ['删除失败', '刪除失敗', '削除に失敗しました', 'Could not delete'],
  移动端不支持: [
    '{name}暂不支持移动端，请使用电脑访问。',
    '{name}暫不支援行動裝置，請使用電腦瀏覽。',
    '{name}はモバイルに対応していません。パソコンでアクセスしてください。',
    '{name} is not available on mobile. Please use a desktop browser.'
  ],
  基本信息: ['基本信息', '基本資訊', '基本情報', 'Profile'],
  账号安全: ['账号安全', '帳號安全', 'アカウントのセキュリティ', 'Account security'],
  管理员: ['管理员', '管理員', '管理者', 'Administrator'],
  普通用户: ['普通用户', '一般使用者', '一般ユーザー', 'User'],
  账号角色: ['账号角色', '帳號角色', 'アカウント権限', 'Account role'],
  登录账号: ['登录账号', '登入帳號', 'ログインアカウント', 'Sign-in account'],
  用户名不可修改: [
    '用户名不可修改',
    '使用者名稱無法修改',
    'ユーザー名は変更できません',
    'Username cannot be changed'
  ],
  用户昵称: ['用户昵称', '使用者暱稱', '表示名', 'Display name'],
  请输入您的昵称: ['请输入您的昵称', '請輸入您的暱稱', '表示名を入力', 'Enter your display name'],
  '保存中...': ['保存中...', '儲存中...', '保存中...', 'Saving...'],
  保存修改: ['保存修改', '儲存修改', '変更を保存', 'Save changes'],
  当前密码: ['当前密码', '目前密碼', '現在のパスワード', 'Current password'],
  请输入原登录密码: [
    '请输入原登录密码',
    '請輸入原登入密碼',
    '現在のパスワードを入力',
    'Enter your current password'
  ],
  新密码: ['新密码', '新密碼', '新しいパスワード', 'New password'],
  至少六位新密码: [
    '至少六位新密码',
    '至少六位新密碼',
    '新しいパスワードを入力',
    'Enter a new password'
  ],
  确认新密码: ['确认新密码', '確認新密碼', '新しいパスワードの確認', 'Confirm new password'],
  请再次输入新密码: [
    '请再次输入新密码',
    '請再次輸入新密碼',
    '新しいパスワードを再入力',
    'Enter the new password again'
  ],
  '提交中...': ['提交中...', '提交中...', '送信中...', 'Submitting...'],
  确认修改密码: ['确认修改密码', '確認修改密碼', 'パスワードを変更', 'Change password'],
  账号登录: ['账号登录', '帳號登入', 'ログイン', 'Sign in'],
  邀请码注册: ['邀请码注册', '邀請碼註冊', '招待コードで登録', 'Register with invitation code'],
  请输入用户名: ['请输入用户名', '請輸入使用者名稱', 'ユーザー名を入力', 'Enter username'],
  请输入密码: ['请输入密码', '請輸入密碼', 'パスワードを入力', 'Enter password'],
  '登录中...': ['登录中...', '登入中...', 'ログイン中...', 'Signing in...'],
  立即登录: ['立即登录', '立即登入', 'ログイン', 'Sign in'],
  邀请码: ['邀请码', '邀請碼', '招待コード', 'Invitation code'],
  请输入专属邀请码: [
    '请输入专属邀请码',
    '請輸入專屬邀請碼',
    '招待コードを入力',
    'Enter invitation code'
  ],
  设置用户名: ['设置用户名', '設定使用者名稱', 'ユーザー名を設定', 'Choose a username'],
  至少三个字符: ['至少三个字符', '至少三個字元', '3文字以上', 'At least three characters'],
  '例如 高数助教': [
    '例如 高数助教',
    '例如 高數助教',
    '例：数学アシスタント',
    'For example, Math tutor'
  ],
  设置密码: ['设置密码', '設定密碼', 'パスワードを設定', 'Choose a password'],
  至少八位密码: ['至少八位密码', '至少八位密碼', '8文字以上', 'At least eight characters'],
  确认密码: ['确认密码', '確認密碼', 'パスワードの確認', 'Confirm password'],
  请再次输入密码: [
    '请再次输入密码',
    '請再次輸入密碼',
    'パスワードを再入力',
    'Enter the password again'
  ],
  '注册中...': ['注册中...', '註冊中...', '登録中...', 'Registering...'],
  验证并注册: ['验证并注册', '驗證並註冊', '確認して登録', 'Verify and register'],
  全部资源: ['全部资源', '全部資源', 'すべてのリソース', 'All resources'],
  资源路径: ['资源路径', '資源路徑', 'リソースのパス', 'Resource path'],
  上一级: ['上一级', '上一層', '上の階層', 'Go up'],
  新建文件夹: ['新建文件夹', '新增資料夾', 'フォルダーを作成', 'New folder'],
  '上传 PDF': ['上传 PDF', '上傳 PDF', 'PDF をアップロード', 'Upload PDF'],
  '替换 PDF': ['替换 PDF', '取代 PDF', 'PDF を置き換え', 'Replace PDF'],
  复制: ['复制', '複製', 'コピー', 'Copy'],
  移动: ['移动', '移動', '移動', 'Move'],
  永久删除: ['永久删除', '永久刪除', '完全に削除', 'Delete permanently'],
  大小: ['大小', '大小', 'サイズ', 'Size'],
  下载量: ['下载量', '下載次數', 'ダウンロード数', 'Downloads'],
  修改时间: ['修改时间', '修改時間', '更新日時', 'Modified'],
  升序: ['升序', '升冪', '昇順', 'Ascending'],
  降序: ['降序', '降冪', '降順', 'Descending'],
  下载额度暂不可用: [
    '下载额度暂不可用',
    '下載額度暫時無法使用',
    'ダウンロード枠を取得できません',
    'Download allowance unavailable'
  ],
  '正在加载资源…': [
    '正在加载资源…',
    '正在載入資源…',
    'リソースを読み込み中…',
    'Loading resources…'
  ],
  正在加载预览: ['正在加载预览', '正在載入預覽', 'プレビューを読み込み中', 'Loading preview'],
  '正在准备 PDF，请稍候': [
    '正在准备 PDF，请稍候',
    '正在準備 PDF，請稍候',
    'PDF を準備しています',
    'Preparing PDF, please wait'
  ],
  已发起下载: ['已发起下载', '已開始下載', 'ダウンロードを開始しました', 'Download started'],
  返回预览: ['返回预览', '返回預覽', 'プレビューに戻る', 'Back to preview'],
  再次下载: ['再次下载', '再次下載', '再ダウンロード', 'Download again'],
  '文件过大，无法预览': [
    '文件过大，无法预览',
    '檔案過大，無法預覽',
    'ファイルが大きすぎるためプレビューできません',
    'File is too large to preview'
  ],
  '下载 PDF': ['下载 PDF', '下載 PDF', 'PDF をダウンロード', 'Download PDF'],
  在新页面打开: ['在新页面打开', '在新頁面開啟', '新しいページで開く', 'Open in new page'],
  编辑资源: ['编辑资源', '編輯資源', 'リソースを編集', 'Edit resource'],
  复制资源: ['复制资源', '複製資源', 'リソースをコピー', 'Copy resource'],
  移动资源: ['移动资源', '移動資源', 'リソースを移動', 'Move resource'],
  永久删除资源: [
    '永久删除资源',
    '永久刪除資源',
    'リソースを完全に削除',
    'Delete resource permanently'
  ],
  '选择 PDF 文件': ['选择 PDF 文件', '選擇 PDF 檔案', 'PDF ファイルを選択', 'Select a PDF file'],
  '单个文件不超过 32 MiB': [
    '单个文件不超过 32 MiB',
    '單一檔案不超過 32 MiB',
    'ファイルは 32 MiB 以下',
    'Maximum 32 MiB per file'
  ],
  说明: ['说明', '說明', '説明', 'Description'],
  '处理中…': ['处理中…', '處理中…', '処理中…', 'Processing…'],
  全部题目: ['全部题目', '全部題目', 'すべての問題', 'All questions'],
  题库路径: ['题库路径', '題庫路徑', '問題バンクのパス', 'Question bank path'],
  搜索题目: ['搜索题目', '搜尋題目', '問題を検索', 'Search questions'],
  '搜索题干、标识或来源题号': [
    '搜索题干、标识或来源题号',
    '搜尋題幹、標識或來源題號',
    '問題文、ID、出典番号を検索',
    'Search question text, ID or source number'
  ],
  '正在加载题库…': [
    '正在加载题库…',
    '正在載入題庫…',
    '問題バンクを読み込み中…',
    'Loading question bank…'
  ],
  '正在加载题目…': ['正在加载题目…', '正在載入題目…', '問題を読み込み中…', 'Loading question…'],
  题目详情: ['题目详情', '題目詳情', '問題の詳細', 'Question details'],
  文件内题目切换: [
    '文件内题目切换',
    '檔案內題目切換',
    'ファイル内の問題を切り替え',
    'Navigate questions in file'
  ],
  上一题: ['上一题', '上一題', '前の問題', 'Previous question'],
  下一题: ['下一题', '下一題', '次の問題', 'Next question'],
  '切换加载失败，点击重试': [
    '切换加载失败，点击重试',
    '切換載入失敗，點擊重試',
    '読み込みに失敗しました。再試行してください',
    'Could not load question. Select to retry'
  ],
  搜索整个题库: ['搜索整个题库', '搜尋整個題庫', '問題バンク全体を検索', 'Search all questions'],
  搜索当前目录及子目录: [
    '搜索当前目录及子目录',
    '搜尋目前目錄及子目錄',
    '現在のフォルダーとサブフォルダーを検索',
    'Search this folder and subfolders'
  ],
  知识点列表: ['知识点列表', '知識點清單', '知識項目一覧', 'Topic list'],
  缩小画布: ['缩小画布', '縮小畫布', '縮小', 'Zoom out'],
  放大画布: ['放大画布', '放大畫布', '拡大', 'Zoom in'],
  全览: ['全览', '全覽', '全体を表示', 'Fit to view'],
  请选择知识库: ['请选择知识库', '請選擇知識庫', '知識ベースを選択', 'Select a knowledge base'],
  所选分类不可用: [
    '所选分类不可用',
    '所選分類無法使用',
    '選択したカテゴリは利用できません',
    'Selected category unavailable'
  ],
  '正在加载知识地图…': [
    '正在加载知识地图…',
    '正在載入知識地圖…',
    '知識マップを読み込み中…',
    'Loading knowledge map…'
  ],
  筛选与搜索: ['筛选与搜索', '篩選與搜尋', '絞り込みと検索', 'Filter and search'],
  选择知识库: ['选择知识库', '選擇知識庫', '知識ベースを選択', 'Select knowledge base'],
  搜索知识点标题: [
    '搜索知识点标题',
    '搜尋知識點標題',
    '知識項目のタイトルを検索',
    'Search topic titles'
  ],
  '正在加载知识库分类…': [
    '正在加载知识库分类…',
    '正在載入知識庫分類…',
    'カテゴリを読み込み中…',
    'Loading knowledge categories…'
  ],
  暂无可选择的一级知识库分类: [
    '暂无可选择的一级知识库分类',
    '暫無可選擇的第一層知識庫分類',
    '選択できるカテゴリがありません',
    'No knowledge categories available'
  ],
  清空: ['清空', '清空', 'クリア', 'Clear'],
  当前范围没有匹配的知识点: [
    '当前范围没有匹配的知识点',
    '目前範圍沒有符合的知識點',
    'この範囲に一致する項目はありません',
    'No matching topics in this scope'
  ],
  '显示前 50 条，请继续输入缩小范围': [
    '显示前 50 条，请继续输入缩小范围',
    '顯示前 50 筆，請繼續輸入縮小範圍',
    '先頭の50件を表示しています。入力を続けて絞り込んでください',
    'Showing the first 50 results. Keep typing to narrow them down'
  ],
  当前分类暂无公开知识点: [
    '当前分类暂无公开知识点',
    '目前分類暫無公開知識點',
    'このカテゴリに公開項目はありません',
    'No public topics in this category'
  ],
  当前筛选没有匹配的知识点: [
    '当前筛选没有匹配的知识点',
    '目前篩選沒有符合的知識點',
    '条件に一致する項目はありません',
    'No topics match the current filters'
  ],
  前置: ['前置', '前置', '前提', 'Prerequisite'],
  后续: ['后续', '後續', '後続', 'Next'],
  前置和后续仅在当前地图范围内高亮: [
    '前置和后续仅在当前地图范围内高亮',
    '前置和後續僅在目前地圖範圍內醒目顯示',
    '前提と後続は現在のマップ内のみ強調表示されます',
    'Related topics are highlighted within the current map'
  ],
  退出关系查看: ['退出关系查看', '退出關係檢視', '関連表示を終了', 'Exit relationship view'],
  未掌握: ['未掌握', '未掌握', '未習得', 'Not mastered'],
  已掌握: ['已掌握', '已掌握', '習得済み', 'Mastered'],
  分区: ['分区', '分區', '区分', 'Section'],
  子分区: ['子分区', '子分區', '小区分', 'Subsection'],
  正在加载知识点: ['正在加载知识点', '正在載入知識點', '知識項目を読み込み中', 'Loading topic'],
  文件夹: ['文件夹', '資料夾', 'フォルダー', 'Folder'],
  归档: ['归档', '封存', 'アーカイブ', 'Archive'],
  '{count} 项': ['{count} 项', '{count} 項', '{count} 件', '{count} items'],
  '{count} 次下载': [
    '{count} 次下载',
    '下載 {count} 次',
    '{count} 回ダウンロード',
    '{count} downloads'
  ],
  '下载额度 {used} / {limit} MiB（最近 12 小时）': [
    '下载额度 {used} / {limit} MiB（最近 12 小时）',
    '下載額度 {used} / {limit} MiB（最近 12 小時）',
    'ダウンロード枠 {used} / {limit} MiB（過去12時間）',
    'Download allowance {used} / {limit} MiB (last 12 hours)'
  ],
  '替换 {name}': ['替换 {name}', '取代 {name}', '{name} を置き換え', 'Replace {name}'],
  '{action} {name}': ['{action} {name}', '{action} {name}', '{name} を{action}', '{action} {name}'],
  '永久删除后无法恢复。文件夹及其中的所有内容都会被删除。': [
    '永久删除后无法恢复。文件夹及其中的所有内容都会被删除。',
    '永久刪除後無法還原。資料夾及其中的所有內容都會被刪除。',
    '完全に削除すると元に戻せません。フォルダーとその中身はすべて削除されます。',
    'Permanent deletion cannot be undone. The folder and all its contents will be deleted.'
  ],
  '确认所选 1/3': ['确认所选 1/3', '確認所選 1/3', '選択を確認 1/3', 'Confirm selection 1/3'],
  '再次确认 2/3': ['再次确认 2/3', '再次確認 2/3', '再確認 2/3', 'Confirm again 2/3'],
  '永久删除 3/3': ['永久删除 3/3', '永久刪除 3/3', '完全に削除 3/3', 'Delete permanently 3/3'],
  '题目详情 · {title}': [
    '题目详情 · {title}',
    '題目詳情 · {title}',
    '問題の詳細 · {title}',
    'Question details · {title}'
  ],
  题目不存在或已删除: [
    '题目不存在或已删除',
    '題目不存在或已刪除',
    '問題が見つからないか削除されました',
    'Question not found or deleted'
  ],
  题目加载失败: [
    '题目加载失败',
    '題目載入失敗',
    '問題の読み込みに失敗しました',
    'Could not load question'
  ],
  '难度 {value} / 5': [
    '难度 {value} / 5',
    '難度 {value} / 5',
    '難易度 {value} / 5',
    'Difficulty {value} / 5'
  ],
  '{count} 条结果': ['{count} 条结果', '{count} 筆結果', '{count} 件の結果', '{count} results'],
  '正在查看：{title}': [
    '正在查看：{title}',
    '正在檢視：{title}',
    '表示中：{title}',
    'Viewing: {title}'
  ],
  '{title}，{status}，激活打开阅读': [
    '{title}，{status}，激活打开阅读',
    '{title}，{status}，啟用以開啟閱讀',
    '{title}、{status}。選択して開く',
    '{title}, {status}. Activate to read'
  ],
  下载额度不足: [
    '下载额度不足',
    '下載額度不足',
    'ダウンロード枠が不足しています',
    'Download allowance exceeded'
  ],
  无法开始下载: [
    '无法开始下载',
    '無法開始下載',
    'ダウンロードを開始できません',
    'Could not start download'
  ],
  'PDF 加载失败': [
    'PDF 加载失败',
    'PDF 載入失敗',
    'PDF の読み込みに失敗しました',
    'Could not load PDF'
  ],
  '剩余额度 {amount} MiB': [
    '剩余额度 {amount} MiB',
    '剩餘額度 {amount} MiB',
    '残り {amount} MiB',
    '{amount} MiB remaining'
  ],
  '，最早释放时间 {time}': [
    '，最早释放时间 {time}',
    '，最早釋放時間 {time}',
    '、最短回復時刻 {time}',
    ', available again at {time}'
  ],
  '{size} · 预览上限 5 MiB，请下载后查看': [
    '{size} · 预览上限 5 MiB，请下载后查看',
    '{size} · 預覽上限 5 MiB，請下載後檢視',
    '{size} · プレビューの上限は 5 MiB です。ダウンロードしてご覧ください',
    '{size} · Preview limit is 5 MiB. Download to view'
  ],
  当前账号无法访问此编辑内容: [
    '当前账号无法访问此编辑内容',
    '目前帳號無法存取此編輯內容',
    '現在のアカウントではこの内容を編集できません',
    'This account cannot access the editor'
  ],
  '请使用原账号重新登录，或离开后选择其他图书。': [
    '请使用原账号重新登录，或离开后选择其他图书。',
    '請使用原帳號重新登入，或離開後選擇其他圖書。',
    '元のアカウントで再ログインするか、別の書籍を選択してください。',
    'Sign in with the original account or select another book.'
  ],
  '导出 JSON': ['导出 JSON', '匯出 JSON', 'JSON をエクスポート', 'Export JSON'],
  恢复归档: ['恢复归档', '還原封存', 'アーカイブを復元', 'Restore from archive'],
  重新读取会放弃未保存的修改: [
    '重新读取会放弃未保存的修改',
    '重新讀取會放棄未儲存的修改',
    '再読み込みすると未保存の変更は破棄されます',
    'Reloading discards unsaved changes'
  ],
  重新读取: ['重新读取', '重新讀取', '再読み込み', 'Reload'],
  下载到本地: ['下载到本地', '下載至本機', 'ローカルにダウンロード', 'Download locally'],
  请先保存所有修改: [
    '请先保存所有修改',
    '請先儲存所有修改',
    'すべての変更を保存してください',
    'Save all changes first'
  ],
  已有待审核快照: [
    '已有待审核快照',
    '已有待審核快照',
    '審査待ちのスナップショットがあります',
    'A snapshot is awaiting review'
  ],
  提交已保存的草稿: [
    '提交已保存的草稿',
    '提交已儲存的草稿',
    '保存済みの下書きを提出',
    'Submit saved draft'
  ],
  审核中: ['审核中', '審核中', '審査中', 'In review'],
  提交审核: ['提交审核', '提交審核', '審査に提出', 'Submit for review'],
  选择一份图书: ['选择一份图书', '選擇一本圖書', '書籍を選択', 'Select a book'],
  '从左侧选择本地图书或我创作的图书，选择课程、章节或小节。': [
    '从左侧选择本地图书或我创作的图书，选择课程、章节或小节。',
    '從左側選擇本機圖書或我創作的圖書，再選擇課程、章節或小節。',
    '左側から書籍とコース、章、節を選択してください。',
    'Select a local or authored book, then choose a course, chapter or section.'
  ],
  导入本地图书: ['导入本地图书', '匯入本機圖書', 'ローカル書籍をインポート', 'Import local book'],
  导入在线图书: [
    '导入在线图书',
    '匯入線上圖書',
    'オンライン書籍をインポート',
    'Import online book'
  ],
  '图书 JSON 文件': ['图书 JSON 文件', '圖書 JSON 檔案', '書籍の JSON ファイル', 'Book JSON file'],
  '正在读取文件…': ['正在读取文件…', '正在讀取檔案…', 'ファイルを読み込み中…', 'Reading file…'],
  选择一份完整图书文件: [
    '选择一份完整图书文件',
    '選擇一份完整圖書檔案',
    '完全な書籍ファイルを選択',
    'Select a complete book file'
  ],
  重新选择: ['重新选择', '重新選擇', '選び直す', 'Choose again'],
  选择文件: ['选择文件', '選擇檔案', 'ファイルを選択', 'Choose file'],
  题目册标识: ['题目册标识', '題目冊識別碼', '問題集の識別子', 'Workbook identifier'],
  讲义标识: ['讲义标识', '講義識別碼', '講義の識別子', 'Lecture identifier'],
  '导入将新建图书，标识不能与已有图书重复': [
    '导入将新建图书，标识不能与已有图书重复',
    '匯入將新增圖書，識別碼不能與現有圖書重複',
    'インポートすると書籍が作成されます。識別子は一意にしてください',
    'Import creates a new book. Its identifier must be unique.'
  ],
  关闭并核对: ['关闭并核对', '關閉並核對', '閉じて確認', 'Close and check'],
  '导入中…': ['导入中…', '匯入中…', 'インポート中…', 'Importing…'],
  确认导入: ['确认导入', '確認匯入', 'インポートを確認', 'Confirm import'],
  确认提交审核: ['确认提交审核', '確認提交審核', '審査への提出を確認', 'Confirm submission'],
  提交后由系统分配: [
    '提交后由系统分配',
    '提交後由系統分配',
    '提出後に自動割り当て',
    'Assigned after submission'
  ],
  '提交会基于已保存内容创建独立且不可修改的审核快照，原草稿仍可继续编辑。': [
    '提交会基于已保存内容创建独立且不可修改的审核快照，原草稿仍可继续编辑。',
    '提交會根據已儲存內容建立獨立且不可修改的審核快照，原草稿仍可繼續編輯。',
    '保存済みの内容から変更できない審査用スナップショットを作成します。元の下書きは引き続き編集できます。',
    'Submission creates an immutable review snapshot from saved content. You can continue editing the draft.'
  ],
  提交中: ['提交中', '提交中', '送信中', 'Submitting'],
  确认提交: ['确认提交', '確認提交', '提出を確認', 'Confirm submission'],
  本地图书标识: ['本地图书标识', '本機圖書識別碼', 'ローカル書籍の識別子', 'Local book identifier'],
  本地图书标识需在本浏览器中唯一: [
    '本地图书标识需在本浏览器中唯一',
    '本機圖書識別碼需在本瀏覽器中唯一',
    'このブラウザー内で一意の識別子が必要です',
    'The identifier must be unique in this browser'
  ],
  放弃未保存的修改: [
    '放弃未保存的修改',
    '放棄未儲存的修改',
    '未保存の変更を破棄',
    'Discard unsaved changes'
  ],
  离开后当前修改将丢失: [
    '离开后当前修改将丢失',
    '離開後目前修改將遺失',
    '移動すると変更は失われます',
    'Your changes will be lost if you leave'
  ],
  放弃修改: ['放弃修改', '放棄修改', '変更を破棄', 'Discard changes'],
  新建本地图书: ['新建本地图书', '新增本機圖書', 'ローカル書籍を作成', 'New local book'],
  新建在线图书: ['新建在线图书', '新增線上圖書', 'オンライン書籍を作成', 'New online book'],
  图书名称: ['图书名称', '圖書名稱', '書籍名', 'Book title'],
  图书类型: ['图书类型', '圖書類型', '書籍の種類', 'Book type'],
  需在本浏览器的本地图书中唯一: [
    '需在本浏览器的本地图书中唯一',
    '需在本瀏覽器的本機圖書中唯一',
    'このブラウザーのローカル書籍内で一意にしてください',
    'Must be unique among local books in this browser'
  ],
  创建后不能修改: [
    '创建后不能修改',
    '建立後無法修改',
    '作成後は変更できません',
    'Cannot be changed after creation'
  ],
  确认移除: ['确认移除', '確認移除', '削除を確認', 'Confirm removal'],
  移除: ['移除', '移除', '削除', 'Remove'],
  '本地课程及其章节和小节将被删除，此操作无法撤销。': [
    '本地课程及其章节和小节将被删除，此操作无法撤销。',
    '本機課程及其章節和小節將被刪除，此操作無法復原。',
    'ローカルコースとその章・節を削除します。この操作は取り消せません。',
    'The local course and its chapters and sections will be deleted. This cannot be undone.'
  ],
  '移除将在保存草稿后生效，保存前可放弃修改。': [
    '移除将在保存草稿后生效，保存前可放弃修改。',
    '移除將在儲存草稿後生效，儲存前可放棄修改。',
    '削除は下書きの保存後に反映されます。保存前なら変更を破棄できます。',
    'Removal takes effect when the draft is saved. You can discard changes before saving.'
  ],
  小节分步动画: ['小节分步动画', '小節分步動畫', '節のステップアニメーション', 'Section animation'],
  小节动画: ['小节动画', '小節動畫', '節のアニメーション', 'Section animation'],
  '正在加载动画…': [
    '正在加载动画…',
    '正在載入動畫…',
    'アニメーションを読み込み中…',
    'Loading animation…'
  ],
  上一步: ['上一步', '上一步', '前のステップ', 'Previous step'],
  下一步: ['下一步', '下一步', '次のステップ', 'Next step'],
  跳转到页码: ['跳转到页码', '跳轉到頁碼', 'ページへ移動', 'Jump to page'],
  '第 {page} 页': ['第 {page} 页', '第 {page} 頁', '{page} ページ', 'Page {page}'],
  '第 {page} 页 · {title}': [
    '第 {page} 页 · {title}',
    '第 {page} 頁 · {title}',
    '{page} ページ · {title}',
    'Page {page} · {title}'
  ],
  讲义章节切换导航: [
    '讲义章节切换导航',
    '講義章節切換導覽',
    '講義の章ナビゲーション',
    'Lecture navigation'
  ],
  'PREV // 上一讲': ['PREV // 上一讲', 'PREV // 上一講', 'PREV // 前の講義', 'PREV // Previous'],
  '下一讲 // NEXT': ['下一讲 // NEXT', '下一講 // NEXT', '次の講義 // NEXT', 'Next // NEXT'],
  课程章节目录导航: ['课程章节目录导航', '課程章節目錄導覽', 'コースの目次', 'Course contents'],
  'CHAPTERS // 目录': [
    'CHAPTERS // 目录',
    'CHAPTERS // 目錄',
    'CHAPTERS // 目次',
    'CHAPTERS // Contents'
  ],
  收起章节目录: ['收起章节目录', '收合章節目錄', '目次を閉じる', 'Collapse contents'],
  本节大纲: ['本节大纲', '本節大綱', 'この節の概要', 'Section outline'],
  目录: ['目录', '目錄', '目次', 'Contents'],
  '正在加载内容和引用…': [
    '正在加载内容和引用…',
    '正在載入內容和引用…',
    '内容と参照を読み込み中…',
    'Loading content and references…'
  ],
  暂无源码: ['暂无源码', '暫無原始碼', 'ソースがありません', 'No source available'],
  暂无讲义小节: ['暂无讲义小节', '暫無講義小節', '講義の節がありません', 'No lecture sections'],
  当前目标: ['当前目标', '目前目標', '現在の移動先', 'Current destination'],
  目录加载失败: [
    '目录加载失败',
    '目錄載入失敗',
    'フォルダーの読み込みに失敗しました',
    'Could not load folders'
  ],
  选择目标文件夹: [
    '选择目标文件夹',
    '選擇目標資料夾',
    '移動先のフォルダーを選択',
    'Choose destination folder'
  ],
  目标目录路径: ['目标目录路径', '目標目錄路徑', '移動先のパス', 'Destination path'],
  子文件夹列表: ['子文件夹列表', '子資料夾清單', 'サブフォルダー一覧', 'Subfolder list'],
  '正在读取目录…': [
    '正在读取目录…',
    '正在讀取目錄…',
    'フォルダーを読み込み中…',
    'Loading folders…'
  ],
  '本页没有可选择的文件夹，可翻页查看': [
    '本页没有可选择的文件夹，可翻页查看',
    '本頁沒有可選擇的資料夾，可換頁查看',
    'このページに選択できるフォルダーはありません',
    'No folders on this page. Try another page'
  ],
  没有可选择的子文件夹: [
    '没有可选择的子文件夹',
    '沒有可選擇的子資料夾',
    '選択できるサブフォルダーはありません',
    'No subfolders available'
  ],
  '可多选，单个文件不超过 32 MiB': [
    '可多选，单个文件不超过 32 MiB',
    '可多選，單一檔案不超過 32 MiB',
    '複数選択可。各ファイルは 32 MiB 以下',
    'Select multiple files, up to 32 MiB each'
  ],
  逐个上传: ['逐个上传', '逐一上傳', '順番にアップロード', 'Uploading one at a time'],
  等待上传: ['等待上传', '等待上傳', 'アップロード待ち', 'Waiting to upload'],
  正在处理: ['正在处理', '正在處理', '処理中', 'Processing'],
  已完成: ['已完成', '已完成', '完了', 'Completed'],
  未完成: ['未完成', '未完成', '未完了', 'Incomplete'],
  停止上传: ['停止上传', '停止上傳', 'アップロードを停止', 'Stop upload'],
  '上传中…': ['上传中…', '上傳中…', 'アップロード中…', 'Uploading…'],
  上传: ['上传', '上傳', 'アップロード', 'Upload'],
  上传失败: ['上传失败', '上傳失敗', 'アップロードに失敗しました', 'Upload failed'],
  '请选择不超过 32 MiB 的非空 PDF 文件': [
    '请选择不超过 32 MiB 的非空 PDF 文件',
    '請選擇不超過 32 MiB 的非空 PDF 檔案',
    '32 MiB 以下の空でない PDF を選択してください',
    'Choose a non-empty PDF no larger than 32 MiB'
  ],
  '已选择 {count} 个文件': [
    '已选择 {count} 个文件',
    '已選擇 {count} 個檔案',
    '{count} 個のファイルを選択',
    '{count} files selected'
  ],
  '上传 {count} 个文件': [
    '上传 {count} 个文件',
    '上傳 {count} 個檔案',
    '{count} 個のファイルをアップロード',
    'Upload {count} files'
  ],
  '移除 {name}': ['移除 {name}', '移除 {name}', '{name} を削除', 'Remove {name}'],
  '{name} 上传进度': [
    '{name} 上传进度',
    '{name} 上傳進度',
    '{name} のアップロード進捗',
    'Upload progress for {name}'
  ],
  '动画无法显示：{error}': [
    '动画无法显示：{error}',
    '動畫無法顯示：{error}',
    'アニメーションを表示できません：{error}',
    'Could not display animation: {error}'
  ],
  '{page} / {pages} 页 · {step} / {steps} 步': [
    '{page} / {pages} 页 · {step} / {steps} 步',
    '{page} / {pages} 頁 · {step} / {steps} 步',
    '{page} / {pages} ページ · {step} / {steps} ステップ',
    'Page {page} / {pages} · Step {step} / {steps}'
  ],
  批量导入小节: ['批量导入小节', '批次匯入小節', '節をまとめてインポート', 'Import sections'],
  'Typst 文件': ['Typst 文件', 'Typst 檔案', 'Typst ファイル', 'Typst files'],
  '可选择一个或多个 .typ 文件，导入后请保存图书': [
    '可选择一个或多个 .typ 文件，导入后请保存图书',
    '可選擇一個或多個 .typ 檔案，匯入後請儲存圖書',
    '1つ以上の .typ ファイルを選択し、インポート後に書籍を保存してください',
    'Select one or more .typ files and save the book after import'
  ],
  '请确认每个文件的小节标题和小节标识，导入后保存图书生效。': [
    '请确认每个文件的小节标题和小节标识，导入后保存图书生效。',
    '請確認每個檔案的小節標題和小節識別碼，匯入後儲存圖書生效。',
    '各ファイルの節タイトルと識別子を確認し、インポート後に書籍を保存してください。',
    'Confirm each section title and identifier, then save the book to apply the import.'
  ],
  添加小节: ['添加小节', '新增小節', '節を追加', 'Add sections'],
  小节标题: ['小节标题', '小節標題', '節タイトル', 'Section title'],
  小节标识: ['小节标识', '小節識別碼', '節の識別子', 'Section identifier'],
  章节内唯一: ['章节内唯一', '章節內唯一', '章内で一意', 'Unique within the chapter'],
  章节名称: ['章节名称', '章節名稱', '章の名前', 'Chapter name'],
  章节标识: ['章节标识', '章節識別碼', '章の識別子', 'Chapter identifier'],
  课程内唯一: ['课程内唯一', '課程內唯一', 'コース内で一意', 'Unique within the course'],
  标签: ['标签', '標籤', 'タグ', 'Tags'],
  摘要: ['摘要', '摘要', '概要', 'Summary'],
  分步动画: ['分步动画', '分步動畫', 'ステップアニメーション', 'Step animation'],
  '正在检查动画文件…': [
    '正在检查动画文件…',
    '正在檢查動畫檔案…',
    'アニメーションファイルを確認中…',
    'Checking animation files…'
  ],
  小节动画资源: [
    '小节动画资源',
    '小節動畫資源',
    '節のアニメーションリソース',
    'Section animation assets'
  ],
  '包含 animation.json 和场景资源，最大 22 MB': [
    '包含 animation.json 和场景资源，最大 22 MB',
    '包含 animation.json 和場景資源，最大 22 MB',
    'animation.json とシーンのリソースを含む、最大 22 MB',
    'Includes animation.json and scene assets, up to 22 MB'
  ],
  替换文件夹: ['替换文件夹', '取代資料夾', 'フォルダーを置き換え', 'Replace folder'],
  选择文件夹: ['选择文件夹', '選擇資料夾', 'フォルダーを選択', 'Choose folder'],
  移除动画: ['移除动画', '移除動畫', 'アニメーションを削除', 'Remove animation'],
  '当前动画不是资源包，请选择动画文件夹替换。': [
    '当前动画不是资源包，请选择动画文件夹替换。',
    '目前動畫不是資源套件，請選擇動畫資料夾取代。',
    '現在のアニメーションはリソースパッケージではありません。フォルダーを選択して置き換えてください。',
    'The current animation is not an asset package. Choose a folder to replace it.'
  ],
  小节内容: ['小节内容', '小節內容', '節の内容', 'Section content'],
  未命名小节: ['未命名小节', '未命名小節', '無題の節', 'Untitled section'],
  未命名章节: ['未命名章节', '未命名章節', '無題の章', 'Untitled chapter'],
  图书封面: ['图书封面', '圖書封面', '書籍の表紙', 'Book cover'],
  更换封面: ['更换封面', '更換封面', '表紙を変更', 'Change cover'],
  选择封面: ['选择封面', '選擇封面', '表紙を選択', 'Choose cover'],
  删除封面: ['删除封面', '刪除封面', '表紙を削除', 'Remove cover'],
  '支持 JPG、PNG、WebP，最大 5 MB，选择后请保存图书': [
    '支持 JPG、PNG、WebP，最大 5 MB，选择后请保存图书',
    '支援 JPG、PNG、WebP，最大 5 MB，選擇後請儲存圖書',
    'JPG、PNG、WebP、最大 5 MB。選択後に書籍を保存してください',
    'JPG, PNG or WebP, up to 5 MB. Save the book after selecting.'
  ],
  '支持 JPG、PNG、WebP，最大 512 KB，修改后立即保存': [
    '支持 JPG、PNG、WebP，最大 512 KB，修改后立即保存',
    '支援 JPG、PNG、WebP，最大 512 KB，修改後立即儲存',
    'JPG、PNG、WebP、最大 512 KB。変更はすぐに保存されます',
    'JPG, PNG or WebP, up to 512 KB. Changes are saved immediately.'
  ],
  副标题: ['副标题', '副標題', 'サブタイトル', 'Subtitle'],
  图书类型创建后不可修改: [
    '图书类型创建后不可修改',
    '圖書類型建立後無法修改',
    '作成後に書籍の種類は変更できません',
    'Book type cannot be changed after creation'
  ],
  修改后图书地址会改变: [
    '修改后图书地址会改变',
    '修改後圖書網址會改變',
    '変更すると書籍の URL が変わります',
    'Changing this also changes the book URL'
  ],
  未分类: ['未分类', '未分類', '未分類', 'Uncategorized'],
  简介: ['简介', '簡介', '紹介', 'Introduction'],
  修改说明: ['修改说明', '修改說明', '変更メモ', 'Change notes'],
  图书动画基础资源: [
    '图书动画基础资源',
    '圖書動畫基礎資源',
    '書籍共通のアニメーションリソース',
    'Shared book animation assets'
  ],
  '在这里配置所有小节共用的脚本、字体和图片；播放器和数学公式依赖由平台提供。': [
    '在这里配置所有小节共用的脚本、字体和图片；播放器和数学公式依赖由平台提供。',
    '在此設定所有小節共用的指令碼、字型和圖片；播放器和數學公式依賴由平台提供。',
    'すべての節で共有するスクリプト、フォント、画像を設定します。プレーヤーと数式の依存関係はプラットフォームが提供します。',
    'Configure scripts, fonts and images shared by all sections. The platform provides the player and math dependencies.'
  ],
  '正在读取动画基础包…': [
    '正在读取动画基础包…',
    '正在讀取動畫基礎套件…',
    'アニメーションの基本パッケージを読み込み中…',
    'Reading animation base package…'
  ],
  动画基础包: [
    '动画基础包',
    '動畫基礎套件',
    'アニメーション基本パッケージ',
    'Animation base package'
  ],
  '共用脚本、字体与图片，最大 22 MB': [
    '共用脚本、字体与图片，最大 22 MB',
    '共用指令碼、字型與圖片，最大 22 MB',
    '共有スクリプト、フォント、画像、最大 22 MB',
    'Shared scripts, fonts and images, up to 22 MB'
  ],
  移除动画基础资源: [
    '移除动画基础资源',
    '移除動畫基礎資源',
    '共通アニメーションリソースを削除',
    'Remove shared animation assets'
  ],
  已上架: ['已上架', '已上架', '公開中', 'Published'],
  未上架: ['未上架', '未上架', '非公開', 'Unpublished'],
  已下架: ['已下架', '已下架', '公開終了', 'Withdrawn'],
  已归档: ['已归档', '已封存', 'アーカイブ済み', 'Archived'],
  状态未知: ['状态未知', '狀態未知', '状態不明', 'Unknown status'],
  草稿: ['草稿', '草稿', '下書き', 'Draft'],
  已通过: ['已通过', '已通過', '承認済み', 'Approved'],
  已驳回: ['已驳回', '已駁回', '却下', 'Rejected'],
  暂无版本: ['暂无版本', '暫無版本', 'バージョンがありません', 'No versions'],
  草稿版本: ['草稿版本', '草稿版本', '下書きバージョン', 'Draft version'],
  快照版本: ['快照版本', '快照版本', 'スナップショット', 'Snapshot version'],
  版本类型未知: ['版本类型未知', '版本類型未知', 'バージョンの種類は不明', 'Unknown version type'],
  图书信息: ['图书信息', '圖書資訊', '書籍情報', 'Book information'],
  '正在加载图书信息…': [
    '正在加载图书信息…',
    '正在載入圖書資訊…',
    '書籍情報を読み込み中…',
    'Loading book information…'
  ],
  所有者: ['所有者', '擁有者', '所有者', 'Owner'],
  未提供: ['未提供', '未提供', '未指定', 'Not provided'],
  图书状态: ['图书状态', '圖書狀態', '書籍の状態', 'Book status'],
  最新版本: ['最新版本', '最新版本', '最新バージョン', 'Latest version'],
  版本审核状态: ['版本审核状态', '版本審核狀態', 'バージョンの審査状況', 'Version review status'],
  打开图书: ['打开图书', '開啟圖書', '書籍を開く', 'Open book'],
  '已导入 {count} 个文件': [
    '已导入 {count} 个文件',
    '已匯入 {count} 個檔案',
    '{count} 個のファイルをインポート済み',
    '{count} files imported'
  ],
  '已导入 {count} 个基础文件': [
    '已导入 {count} 个基础文件',
    '已匯入 {count} 個基礎檔案',
    '{count} 個の基本ファイルをインポート済み',
    '{count} base files imported'
  ],
  '{kind}标识': ['{kind}标识', '{kind}識別碼', '{kind}の識別子', '{kind} identifier'],
  '{kind}分类': ['{kind}分类', '{kind}分類', '{kind}のカテゴリ', '{kind} category'],
  '{kind} · 版本号未提供': [
    '{kind} · 版本号未提供',
    '{kind} · 未提供版本號',
    '{kind} · バージョン番号未指定',
    '{kind} · Version number unavailable'
  ],
  '章节已变化，请重新选择要导入的文件': [
    '章节已变化，请重新选择要导入的文件',
    '章節已變更，請重新選擇要匯入的檔案',
    '章が変更されました。インポートするファイルを選び直してください',
    'The chapter changed. Select the files again.'
  ],
  '请选择 .typ 文件': [
    '请选择 .typ 文件',
    '請選擇 .typ 檔案',
    '.typ ファイルを選択してください',
    'Choose a .typ file'
  ],
  读取文件失败: [
    '读取文件失败',
    '讀取檔案失敗',
    'ファイルの読み込みに失敗しました',
    'Could not read file'
  ],
  '无法读取 {name}，请确认文件为 UTF-8 编码': [
    '无法读取 {name}，请确认文件为 UTF-8 编码',
    '無法讀取 {name}，請確認檔案為 UTF-8 編碼',
    '{name} を読み込めません。UTF-8 でエンコードされていることを確認してください',
    'Could not read {name}. Ensure it is encoded as UTF-8.'
  ],
  '请填写 {name} 的小节标题和小节标识': [
    '请填写 {name} 的小节标题和小节标识',
    '請填寫 {name} 的小節標題和小節識別碼',
    '{name} の節タイトルと識別子を入力してください',
    'Enter a section title and identifier for {name}'
  ],
  '小节标识 {slug} 与章节内已有或待导入的小节重复': [
    '小节标识 {slug} 与章节内已有或待导入的小节重复',
    '小節識別碼 {slug} 與章節內現有或待匯入的小節重複',
    '節の識別子 {slug} が既存またはインポート予定の節と重複しています',
    'Section identifier {slug} duplicates an existing or pending section'
  ],
  '已添加 {count} 个小节，请保存图书': [
    '已添加 {count} 个小节，请保存图书',
    '已新增 {count} 個小節，請儲存圖書',
    '{count} 件の節を追加しました。書籍を保存してください',
    'Added {count} sections. Save the book to apply.'
  ],
  请选择分类: ['请选择分类', '請選擇分類', 'カテゴリを選択', 'Select category'],
  正在读取分类: ['正在读取分类', '正在讀取分類', 'カテゴリを読み込み中', 'Loading category'],
  选择目标分类: [
    '选择目标分类',
    '選擇目標分類',
    '対象カテゴリを選択',
    'Choose destination category'
  ],
  题目分类路径: ['题目分类路径', '題目分類路徑', '問題カテゴリのパス', 'Question category path'],
  '正在加载分类…': [
    '正在加载分类…',
    '正在載入分類…',
    'カテゴリを読み込み中…',
    'Loading categories…'
  ],
  已选择: ['已选择', '已選擇', '選択済み', 'Selected'],
  请选择题目: ['请选择题目', '請選擇題目', '問題を選択', 'Select a question'],
  选择题目: ['选择题目', '選擇題目', '問題を選択', 'Choose question'],
  无来源题目: ['无来源题目', '無來源題目', '出典のない問題', 'Questions without a source'],
  题干: ['题干', '題幹', '問題文', 'Question'],
  考点: ['考点', '考點', '出題ポイント', 'Tested concepts'],
  解答: ['解答', '解答', '解答', 'Solution'],
  结论: ['结论', '結論', '結論', 'Conclusion'],
  易错点: ['易错点', '易錯點', '間違いやすい点', 'Common mistakes'],
  新建: ['新建', '新增', '新規作成', 'New'],
  删除分类: ['删除分类', '刪除分類', 'カテゴリを削除', 'Delete category'],
  删除来源: ['删除来源', '刪除來源', '出典を削除', 'Delete source'],
  加载更多: ['加载更多', '載入更多', 'さらに読み込む', 'Load more'],
  清空无来源题目: [
    '清空无来源题目',
    '清空無來源題目',
    '出典のない問題をすべて削除',
    'Clear unsourced questions'
  ],
  新建顶级分类: ['新建顶级分类', '新增頂層分類', '最上位カテゴリを作成', 'New top-level category'],
  刷新题库: ['刷新题库', '重新整理題庫', '問題バンクを更新', 'Refresh question bank'],
  请使用超级管理员账号登录: [
    '请使用超级管理员账号登录',
    '請使用超級管理員帳號登入',
    'スーパー管理者アカウントでログインしてください',
    'Sign in with a super administrator account'
  ],
  新建题目: ['新建题目', '新增題目', '問題を作成', 'New question'],
  '保存结果尚未确认，请保留当前内容并刷新核对。': [
    '保存结果尚未确认，请保留当前内容并刷新核对。',
    '儲存結果尚未確認，請保留目前內容並重新整理核對。',
    '保存結果を確認できません。内容を保持し、更新して確認してください。',
    'Save result is unconfirmed. Keep your content and refresh to check.'
  ],
  添加来源: ['添加来源', '新增來源', '出典を追加', 'Add source'],
  编辑来源: ['编辑来源', '編輯來源', '出典を編集', 'Edit source'],
  删除题目: ['删除题目', '刪除題目', '問題を削除', 'Delete question'],
  题目标识: ['题目标识', '題目識別碼', '問題の識別子', 'Question identifier'],
  来源题号: ['来源题号', '來源題號', '出典の問題番号', 'Source question number'],
  难度: ['难度', '難度', '難易度', 'Difficulty'],
  关联知识点: ['关联知识点', '關聯知識點', '関連する知識項目', 'Related topics'],
  添加: ['添加', '新增', '追加', 'Add'],
  未关联知识点: [
    '未关联知识点',
    '未關聯知識點',
    '関連する知識項目はありません',
    'No related topics'
  ],
  来源: ['来源', '來源', '出典', 'Source'],
  暂无来源: ['暂无来源', '暫無來源', '出典なし', 'No sources'],
  从左侧选择分类或题目: [
    '从左侧选择分类或题目',
    '從左側選擇分類或題目',
    '左側からカテゴリまたは問題を選択',
    'Select a category or question from the left'
  ],
  新建子分类: ['新建子分类', '新增子分類', 'サブカテゴリを作成', 'New subcategory'],
  关联题目: ['关联题目', '關聯題目', '問題を関連付ける', 'Link question'],
  新建分类: ['新建分类', '新增分類', 'カテゴリを作成', 'New category'],
  分类名称: ['分类名称', '分類名稱', 'カテゴリ名', 'Category name'],
  分类标识: ['分类标识', '分類識別碼', 'カテゴリの識別子', 'Category identifier'],
  顶级分类: ['顶级分类', '頂層分類', '最上位カテゴリ', 'Top-level category'],
  添加题目来源: ['添加题目来源', '新增題目來源', '問題の出典を追加', 'Add question source'],
  编辑题目来源: ['编辑题目来源', '編輯題目來源', '問題の出典を編集', 'Edit question source'],
  来源分类: ['来源分类', '來源分類', '出典カテゴリ', 'Source category'],
  排序: ['排序', '排序', '並び順', 'Order'],
  导入题目: ['导入题目', '匯入題目', '問題をインポート', 'Import questions'],
  'JSON 文件': ['JSON 文件', 'JSON 檔案', 'JSON ファイル', 'JSON file'],
  选择符合导入格式的文件: [
    '选择符合导入格式的文件',
    '選擇符合匯入格式的檔案',
    'インポート形式に合ったファイルを選択',
    'Choose a file in the import format'
  ],
  确认永久清空: ['确认永久清空', '確認永久清空', '完全削除を確認', 'Confirm permanent removal'],
  确认删除: ['确认删除', '確認刪除', '削除を確認', 'Confirm deletion'],
  '将永久删除题目及其所有来源和知识点关联，已有图书引用将无法显示该题目。': [
    '将永久删除题目及其所有来源和知识点关联，已有图书引用将无法显示该题目。',
    '將永久刪除題目及其所有來源和知識點關聯，現有圖書引用將無法顯示該題目。',
    '問題とすべての出典・知識項目との関連を完全に削除します。書籍内の参照は表示できなくなります。',
    'The question, its sources and topic links will be permanently deleted. Existing book references will no longer display it.'
  ],
  '将删除此来源，题目本身会保留。': [
    '将删除此来源，题目本身会保留。',
    '將刪除此來源，題目本身會保留。',
    'この出典を削除します。問題は残ります。',
    'This source will be deleted; the question will remain.'
  ],
  刷新分类与知识点: [
    '刷新分类与知识点',
    '重新整理分類與知識點',
    'カテゴリと知識項目を更新',
    'Refresh categories and topics'
  ],
  暂无分类或知识点: [
    '暂无分类或知识点',
    '暫無分類或知識點',
    'カテゴリや知識項目がありません',
    'No categories or topics'
  ],
  未命名知识点: ['未命名知识点', '未命名知識點', '無題の知識項目', 'Untitled topic'],
  知识点标题: ['知识点标题', '知識點標題', '知識項目のタイトル', 'Topic title'],
  知识点标识: ['知识点标识', '知識點識別碼', '知識項目の識別子', 'Topic identifier'],
  知识点内容: ['知识点内容', '知識點內容', '知識項目の内容', 'Topic content'],
  选择一个知识点: ['选择一个知识点', '選擇一個知識點', '知識項目を選択', 'Select a topic'],
  '从左侧选择分类或知识点。': [
    '从左侧选择分类或知识点。',
    '從左側選擇分類或知識點。',
    '左側からカテゴリまたは知識項目を選択してください。',
    'Select a category or topic from the left.'
  ],
  '请使用超级管理员账号登录。': [
    '请使用超级管理员账号登录。',
    '請使用超級管理員帳號登入。',
    'スーパー管理者アカウントでログインしてください。',
    'Sign in with a super administrator account.'
  ],
  父分类: ['父分类', '父分類', '親カテゴリ', 'Parent category'],
  导入知识点: ['导入知识点', '匯入知識點', '知識項目をインポート', 'Import topics'],
  '导入不会覆盖现有内容。': [
    '导入不会覆盖现有内容。',
    '匯入不會覆蓋現有內容。',
    'インポートしても既存の内容は上書きされません。',
    'Import will not overwrite existing content.'
  ],
  新建知识点: ['新建知识点', '新增知識點', '知識項目を作成', 'New topic'],
  创建后无法修改: [
    '创建后无法修改',
    '建立後無法修改',
    '作成後は変更できません',
    'Cannot be changed after creation'
  ],
  正文: ['正文', '正文', '本文', 'Content'],
  创建时必须填写正文: [
    '创建时必须填写正文',
    '建立時必須填寫正文',
    '作成時に本文を入力してください',
    'Content is required when creating'
  ],
  永久删除分类: [
    '永久删除分类',
    '永久刪除分類',
    'カテゴリを完全に削除',
    'Delete category permanently'
  ],
  永久删除知识点: [
    '永久删除知识点',
    '永久刪除知識點',
    '知識項目を完全に削除',
    'Delete topic permanently'
  ],
  '删除中…': ['删除中…', '刪除中…', '削除中…', 'Deleting…'],
  '在“{name}”下新建': [
    '在“{name}”下新建',
    '在「{name}」下新增',
    '「{name}」の下に作成',
    'Create under “{name}”'
  ],
  '父分类：{name}': [
    '父分类：{name}',
    '父分類：{name}',
    '親カテゴリ：{name}',
    'Parent category: {name}'
  ],
  '继续确认 {step} / 3': [
    '继续确认 {step} / 3',
    '繼續確認 {step} / 3',
    '確認を続ける {step} / 3',
    'Continue confirmation {step} / 3'
  ],
  '第 {step} 次确认，共 3 次。': [
    '第 {step} 次确认，共 3 次。',
    '第 {step} 次確認，共 3 次。',
    '確認 {step} 回目（全3回）。',
    'Confirmation {step} of 3.'
  ],
  '请使用原账号重新登录，或离开后选择其他知识点。': [
    '请使用原账号重新登录，或离开后选择其他知识点。',
    '請使用原帳號重新登入，或離開後選擇其他知識點。',
    '元のアカウントで再ログインするか、別の知識項目を選択してください。',
    'Sign in with the original account or select another topic.'
  ],
  '分类已删除，正在核对当前知识点。若列表加载失败，请刷新后再继续编辑。': [
    '分类已删除，正在核对当前知识点。若列表加载失败，请刷新后再继续编辑。',
    '分類已刪除，正在核對目前知識點。若清單載入失敗，請重新整理後再繼續編輯。',
    'カテゴリは削除されました。現在の知識項目を確認中です。一覧の読み込みに失敗した場合は更新してください。',
    'The category was deleted. Checking the current topic. Refresh if the list fails to load.'
  ],
  '确定永久删除“{name}”吗？此操作不可撤销。': [
    '确定永久删除“{name}”吗？此操作不可撤销。',
    '確定永久刪除「{name}」嗎？此操作無法復原。',
    '「{name}」を完全に削除しますか？この操作は取り消せません。',
    'Permanently delete “{name}”? This cannot be undone.'
  ],
  空: ['空', '空', '空', 'Empty'],
  上移: ['上移', '上移', '上へ移動', 'Move up'],
  下移: ['下移', '下移', '下へ移動', 'Move down'],
  新建子项: ['新建子项', '新增子項', '子項目を作成', 'New child item'],
  '导入 JSON': ['导入 JSON', '匯入 JSON', 'JSON をインポート', 'Import JSON'],
  归档讲义: ['归档讲义', '封存講義', '講義をアーカイブ', 'Archive lecture'],
  '加载中...': ['加载中...', '載入中...', '読み込み中...', 'Loading...'],
  暂无内容: ['暂无内容', '暫無內容', '内容がありません', 'No content'],
  刷新讲义: ['刷新讲义', '重新整理講義', '講義を更新', 'Refresh lecture notes'],
  暂无讲义: ['暂无讲义', '暫無講義', '講義がありません', 'No lecture notes'],
  有未保存的改动: ['有未保存的改动', '有未儲存的變更', '未保存の変更があります', 'Unsaved changes'],
  放弃: ['放弃', '放棄', '破棄', 'Discard'],
  '课程讲义正在审核中...': [
    '课程讲义正在审核中...',
    '課程講義正在審核中...',
    '講義を審査中です...',
    'Lecture notes are under review...'
  ],
  '提交用户：未提供': [
    '提交用户：未提供',
    '提交使用者：未提供',
    '提出ユーザー：未指定',
    'Submitted by: not provided'
  ],
  '课程讲义被驳回了！': [
    '课程讲义被驳回了！',
    '課程講義已被駁回！',
    '講義は却下されました',
    'Lecture notes were rejected'
  ],
  '课程讲义审核通过！': [
    '课程讲义审核通过！',
    '課程講義審核通過！',
    '講義が承認されました',
    'Lecture notes were approved'
  ],
  '恭喜你🎉讲义审核通过': [
    '恭喜你🎉讲义审核通过',
    '恭喜你🎉講義審核通過',
    '講義が承認されました 🎉',
    'Your lecture notes have been approved 🎉'
  ],
  '提交日期：{date}': [
    '提交日期：{date}',
    '提交日期：{date}',
    '提出日時：{date}',
    'Submitted: {date}'
  ],
  '驳回时间：{date}': [
    '驳回时间：{date}',
    '駁回時間：{date}',
    '却下日時：{date}',
    'Rejected: {date}'
  ],
  '驳回原因：未提供；{message}': [
    '驳回原因：未提供；{message}',
    '駁回原因：未提供；{message}',
    '却下理由：未指定；{message}',
    'Reason: not provided; {message}'
  ],
  '{action}{name}': ['{action}{name}', '{action}{name}', '{name}を{action}', '{action} {name}'],
  '归档讲义 {name}': [
    '归档讲义 {name}',
    '封存講義 {name}',
    '講義 {name} をアーカイブ',
    'Archive lecture {name}'
  ],
  'USERS // 用户管理': [
    'USERS // 用户管理',
    'USERS // 使用者管理',
    'USERS // ユーザー管理',
    'USERS // User management'
  ],
  'INVITATIONS // 邀请码管理': [
    'INVITATIONS // 邀请码管理',
    'INVITATIONS // 邀請碼管理',
    'INVITATIONS // 招待コード管理',
    'INVITATIONS // Invitation codes'
  ],
  'AUDIT // 全站操作审计日志': [
    'AUDIT // 全站操作审计日志',
    'AUDIT // 全站操作稽核日誌',
    'AUDIT // 監査ログ',
    'AUDIT // Audit log'
  ],
  '生成系统准入注册邀请码，设定授权角色、限制使用频次与监控使用进度。': [
    '生成系统准入注册邀请码，设定授权角色、限制使用频次与监控使用进度。',
    '產生註冊邀請碼，設定授權角色、限制使用次數並追蹤使用情況。',
    '登録用の招待コードを作成し、権限や利用回数を設定して使用状況を確認します。',
    'Create registration invitation codes, set roles and usage limits, and monitor use.'
  ],
  '实时留痕全站所有需鉴权管理与讲义编撰接口的调用流水，保障系统运维安全。': [
    '实时留痕全站所有需鉴权管理与讲义编撰接口的调用流水，保障系统运维安全。',
    '即時記錄全站需授權的管理與講義編輯介面呼叫，以維護系統安全。',
    '認証が必要な管理・講義編集 API の操作履歴を記録します。',
    'Record authenticated administration and lecture editing API activity.'
  ],
  生成邀请码: ['生成邀请码', '產生邀請碼', '招待コードを作成', 'Generate invitation code'],
  使用次数: ['使用次数', '使用次數', '使用回数', 'Uses'],
  有效期至: ['有效期至', '有效期限至', '有効期限', 'Expires'],
  生成时间: ['生成时间', '產生時間', '作成日時', 'Created'],
  复制邀请码: ['复制邀请码', '複製邀請碼', '招待コードをコピー', 'Copy invitation code'],
  有效: ['有效', '有效', '有効', 'Active'],
  已耗尽: ['已耗尽', '已用盡', '使用上限到達', 'Exhausted'],
  已作废: ['已作废', '已作廢', '無効', 'Revoked'],
  永久有效: ['永久有效', '永久有效', '無期限', 'Never expires'],
  废弃此邀请码: [
    '废弃此邀请码',
    '作廢此邀請碼',
    'この招待コードを無効化',
    'Revoke this invitation code'
  ],
  作废: ['作废', '作廢', '無効化', 'Revoke'],
  生成注册邀请码: [
    '生成注册邀请码',
    '產生註冊邀請碼',
    '登録用招待コードを作成',
    'Generate registration code'
  ],
  生成: ['生成', '產生', '作成', 'Generate'],
  允许使用次数: ['允许使用次数', '允許使用次數', '使用回数の上限', 'Maximum uses'],
  '默认为 1 次': ['默认为 1 次', '預設為 1 次', '初期値は1回', 'Defaults to 1 use'],
  有效期天数: ['有效期天数', '有效期限天數', '有効日数', 'Validity in days'],
  '填 0 为永久有效，默认 7 天': [
    '填 0 为永久有效，默认 7 天',
    '填 0 為永久有效，預設 7 天',
    '0 は無期限、初期値は7日',
    '0 means no expiry; defaults to 7 days'
  ],
  用途备注: ['用途备注', '用途備註', '用途メモ', 'Purpose'],
  '例如：指派给微积分课程团队': [
    '例如：指派给微积分课程团队',
    '例如：指派給微積分課程團隊',
    '例：微積分コースチーム用',
    'For example: calculus course team'
  ],
  注册绑定角色: ['注册绑定角色', '註冊綁定角色', '登録時の権限', 'Assigned registration role'],
  'API 路由': ['API 路由', 'API 路由', 'API パス', 'API route'],
  'IP 地址': ['IP 地址', 'IP 位址', 'IP アドレス', 'IP address'],
  用户名和密码不能为空: [
    '用户名和密码不能为空',
    '使用者名稱和密碼不能為空',
    'ユーザー名とパスワードを入力してください',
    'Username and password are required'
  ],
  登录成功: ['登录成功', '登入成功', 'ログインしました', 'Signed in'],
  '登录失败，请检查账号密码': [
    '登录失败，请检查账号密码',
    '登入失敗，請檢查帳號密碼',
    'ログインに失敗しました。アカウントとパスワードを確認してください',
    'Sign-in failed. Check your credentials.'
  ],
  请输入邀请码: [
    '请输入邀请码',
    '請輸入邀請碼',
    '招待コードを入力してください',
    'Enter an invitation code'
  ],
  用户名至少需要三个字符: [
    '用户名至少需要三个字符',
    '使用者名稱至少需要三個字元',
    'ユーザー名は3文字以上必要です',
    'Username must have at least three characters'
  ],
  密码至少需要八位字符且不能超过七十二字节: [
    '密码至少需要八位字符且不能超过七十二字节',
    '密碼至少需要八個字元且不能超過七十二位元組',
    'パスワードは8文字以上72バイト以下にしてください',
    'Password must be at least eight characters and no more than 72 bytes'
  ],
  两次输入的密码不一致: [
    '两次输入的密码不一致',
    '兩次輸入的密碼不一致',
    'パスワードが一致しません',
    'Passwords do not match'
  ],
  '注册成功，请登录': [
    '注册成功，请登录',
    '註冊成功，請登入',
    '登録しました。ログインしてください',
    'Registration complete. Please sign in.'
  ],
  '注册失败，请检查邀请码或输入信息': [
    '注册失败，请检查邀请码或输入信息',
    '註冊失敗，請檢查邀請碼或輸入資訊',
    '登録に失敗しました。招待コードと入力内容を確認してください',
    'Registration failed. Check the invitation code and your details.'
  ],
  昵称不能超过一百个字符: [
    '昵称不能超过一百个字符',
    '暱稱不能超過一百個字元',
    '表示名は100文字以内にしてください',
    'Display name cannot exceed 100 characters'
  ],
  基本信息已更新: ['基本信息已更新', '基本資訊已更新', '基本情報を更新しました', 'Profile updated'],
  更新基本信息失败: [
    '更新基本信息失败',
    '更新基本資訊失敗',
    '基本情報の更新に失敗しました',
    'Could not update profile'
  ],
  请输入原密码: [
    '请输入原密码',
    '請輸入原密碼',
    '現在のパスワードを入力してください',
    'Enter your current password'
  ],
  新密码至少需要八位字符且不能超过七十二字节: [
    '新密码至少需要八位字符且不能超过七十二字节',
    '新密碼至少需要八個字元且不能超過七十二位元組',
    '新しいパスワードは8文字以上72バイト以下にしてください',
    'New password must be at least eight characters and no more than 72 bytes'
  ],
  两次输入的新密码不一致: [
    '两次输入的新密码不一致',
    '兩次輸入的新密碼不一致',
    '新しいパスワードが一致しません',
    'New passwords do not match'
  ],
  '密码修改成功，请重新登录': [
    '密码修改成功，请重新登录',
    '密碼修改成功，請重新登入',
    'パスワードを変更しました。再ログインしてください',
    'Password changed. Please sign in again.'
  ],
  修改密码失败: [
    '修改密码失败',
    '修改密碼失敗',
    'パスワードの変更に失敗しました',
    'Could not change password'
  ],
  加载用户列表失败: [
    '加载用户列表失败',
    '載入使用者清單失敗',
    'ユーザー一覧を読み込めません',
    'Could not load users'
  ],
  账号状态已更新: [
    '账号状态已更新',
    '帳號狀態已更新',
    'アカウント状態を更新しました',
    'Account status updated'
  ],
  更新账号状态失败: [
    '更新账号状态失败',
    '更新帳號狀態失敗',
    'アカウント状態を更新できません',
    'Could not update account status'
  ],
  超级管理员认证成功: [
    '超级管理员认证成功',
    '超級管理員驗證成功',
    '管理者認証に成功しました',
    'Administrator verification successful'
  ],
  加载邀请码失败: [
    '加载邀请码失败',
    '載入邀請碼失敗',
    '招待コードを読み込めません',
    'Could not load invitation codes'
  ],
  有效期天数不正确: [
    '有效期天数不正确',
    '有效期限天數不正確',
    '有効日数が正しくありません',
    'Invalid validity period'
  ],
  邀请码生成成功: [
    '邀请码生成成功',
    '邀請碼產生成功',
    '招待コードを作成しました',
    'Invitation code generated'
  ],
  生成邀请码失败: [
    '生成邀请码失败',
    '產生邀請碼失敗',
    '招待コードを作成できません',
    'Could not generate invitation code'
  ],
  邀请码已作废: [
    '邀请码已作废',
    '邀請碼已作廢',
    '招待コードを無効化しました',
    'Invitation code revoked'
  ],
  作废邀请码失败: [
    '作废邀请码失败',
    '作廢邀請碼失敗',
    '招待コードを無効化できません',
    'Could not revoke invitation code'
  ],
  已复制到剪贴板: [
    '已复制到剪贴板',
    '已複製到剪貼簿',
    'クリップボードにコピーしました',
    'Copied to clipboard'
  ],
  加载审核列表失败: [
    '加载审核列表失败',
    '載入審核清單失敗',
    '審査一覧を読み込めません',
    'Could not load review list'
  ],
  '讲义或审核版本标识缺失，请刷新审核列表': [
    '讲义或审核版本标识缺失，请刷新审核列表',
    '講義或審核版本識別碼缺失，請重新整理審核清單',
    '講義または審査バージョンの識別子がありません。一覧を更新してください',
    'Lecture or review version identifier is missing. Refresh the review list.'
  ],
  加载全站日志失败: [
    '加载全站日志失败',
    '載入全站日誌失敗',
    '監査ログを読み込めません',
    'Could not load audit log'
  ],
  '确定要作废邀请码 {code} 吗？': [
    '确定要作废邀请码 {code} 吗？',
    '確定要作廢邀請碼 {code} 嗎？',
    '招待コード {code} を無効にしますか？',
    'Revoke invitation code {code}?'
  ],
  '将删除此分类及全部子分类，并删除仅属于这些分类的知识点。还关联范围外分类的知识点会保留，仅移除范围内的分类关联。涉及被删除知识点的前置关系也会清理，讲义中的相关引用可能显示缺失占位。本地掌握记录和批注不会自动清理。':
    [
      '将删除此分类及全部子分类，并删除仅属于这些分类的知识点。还关联范围外分类的知识点会保留，仅移除范围内的分类关联。涉及被删除知识点的前置关系也会清理，讲义中的相关引用可能显示缺失占位。本地掌握记录和批注不会自动清理。',
      '將刪除此分類及全部子分類，並刪除僅屬於這些分類的知識點。也關聯範圍外分類的知識點會保留，僅移除範圍內的分類關聯。涉及被刪除知識點的前置關係也會清理，講義中的相關引用可能顯示缺失。本機掌握記錄和批註不會自動清理。',
      'このカテゴリとすべてのサブカテゴリ、およびそれらにのみ属する知識項目を削除します。範囲外のカテゴリにも属する項目は残り、対象カテゴリとの関連のみ削除されます。削除された項目の前提関係も削除され、講義の参照が欠落する場合があります。ローカルの習得記録と注釈は自動削除されません。',
      'This deletes the category, its subcategories, and topics belonging only to them. Topics also linked outside this scope remain, but their links inside it are removed. Prerequisite links to deleted topics are removed, and references in lecture notes may be missing. Local mastery records and annotations are not removed automatically.'
    ],
  '删除将同时清理此知识点的分类关联和前置、后续关系，其他知识点保留。讲义源码不会修改，引用处将显示缺失占位；本地掌握记录和批注不会自动清理。':
    [
      '删除将同时清理此知识点的分类关联和前置、后续关系，其他知识点保留。讲义源码不会修改，引用处将显示缺失占位；本地掌握记录和批注不会自动清理。',
      '刪除將同時清除此知識點的分類關聯和前置、後續關係，其他知識點保留。講義原始碼不會修改，引用處將顯示缺失；本機掌握記錄和批註不會自動清理。',
      'この知識項目のカテゴリ、前提、後続の関連も削除されます。他の項目と講義ソースは残り、参照箇所には欠落が表示されます。ローカルの習得記録と注釈は自動削除されません。',
      'This also removes the topic’s category and prerequisite relationships; other topics remain. Lecture source is unchanged and references will show as missing. Local mastery records and annotations are not removed automatically.'
    ],
  导出用户数据: [
    '导出用户数据',
    '匯出使用者資料',
    'ユーザーデータをエクスポート',
    'Export user data'
  ],
  导入用户数据: [
    '导入用户数据',
    '匯入使用者資料',
    'ユーザーデータをインポート',
    'Import user data'
  ],
  清理本地数据: ['清理本地数据', '清理本機資料', 'ローカルデータを消去', 'Clean up local data'],
  选择用户数据备份: [
    '选择用户数据备份',
    '選擇使用者資料備份',
    'ユーザーデータのバックアップを選択',
    'Choose user data backup'
  ],
  '仅支持本站导出的 JSON 备份': [
    '仅支持本站导出的 JSON 备份',
    '僅支援本站匯出的 JSON 備份',
    'このサイトからエクスポートした JSON バックアップのみ対応',
    'Only JSON backups exported from this site are supported'
  ],
  '确认后将覆盖上述数据库中的当前数据，其他数据库不会被删除。建议先导出备份，并关闭其他本站标签页。':
    [
      '确认后将覆盖上述数据库中的当前数据，其他数据库不会被删除。建议先导出备份，并关闭其他本站标签页。',
      '確認後將覆蓋上述資料庫中的目前資料，其他資料庫不會被刪除。建議先匯出備份，並關閉其他本站分頁。',
      '確認すると上記データベースの現在のデータが上書きされます。他のデータベースは削除されません。事前にバックアップをエクスポートし、他のタブを閉じてください。',
      'Confirming overwrites the current data in the databases listed above. Other databases will not be deleted. Export a backup and close other tabs for this site first.'
    ],
  '只包含当前浏览器的本地数据，不包含登录凭据和服务器在线数据。导入成功后页面将刷新。': [
    '只包含当前浏览器的本地数据，不包含登录凭据和服务器在线数据。导入成功后页面将刷新。',
    '只包含目前瀏覽器的本機資料，不包含登入憑證和伺服器線上資料。匯入成功後頁面將重新整理。',
    '現在のブラウザーのローカルデータのみが対象です。ログイン情報やサーバー上のデータは含まれません。インポート後にページが更新されます。',
    'Only local data in this browser is included, not credentials or server data. The page reloads after a successful import.'
  ],
  '检测到上次导入的恢复副本，请先保存并确认后再清除。': [
    '检测到上次导入的恢复副本，请先保存并确认后再清除。',
    '偵測到上次匯入的還原副本，請先儲存並確認後再清除。',
    '前回のインポートの復元コピーが見つかりました。保存と確認を行ってから削除してください。',
    'A recovery copy from the last import was found. Save and verify it before clearing.'
  ],
  下载恢复副本: [
    '下载恢复副本',
    '下載還原副本',
    '復元コピーをダウンロード',
    'Download recovery copy'
  ],
  清除恢复副本: ['清除恢复副本', '清除還原副本', '復元コピーを削除', 'Clear recovery copy'],
  '正在处理本地数据，请稍候…': [
    '正在处理本地数据，请稍候…',
    '正在處理本機資料，請稍候…',
    'ローカルデータを処理中です…',
    'Processing local data, please wait…'
  ],
  刷新页面: ['刷新页面', '重新整理頁面', 'ページを更新', 'Reload page'],
  确认覆盖导入: [
    '确认覆盖导入',
    '確認覆蓋匯入',
    '上書きインポートを確認',
    'Confirm overwrite and import'
  ],
  '请先确认已下载并保存恢复副本。清除后无法再从浏览器找回。': [
    '请先确认已下载并保存恢复副本。清除后无法再从浏览器找回。',
    '請先確認已下載並儲存還原副本。清除後無法再從瀏覽器找回。',
    '復元コピーのダウンロードと保存を確認してください。削除後はブラウザーから復元できません。',
    'Confirm that you have downloaded and saved the recovery copy. Once cleared, it cannot be recovered from this browser.'
  ],
  确认清除: ['确认清除', '確認清除', '消去を確認', 'Confirm clear'],
  '请选择要永久删除的数据库。不会自动保留副本，建议先导出；请关闭其他本站标签页。': [
    '请选择要永久删除的数据库。不会自动保留副本，建议先导出；请关闭其他本站标签页。',
    '請選擇要永久刪除的資料庫。不會自動保留副本，建議先匯出；請關閉其他本站分頁。',
    '完全に削除するデータベースを選択してください。コピーは自動保存されません。事前にエクスポートし、他のタブを閉じてください。',
    'Select databases to delete permanently. No copy is kept automatically; export first and close other tabs for this site.'
  ],
  已停用的数据库: [
    '已停用的数据库',
    '已停用的資料庫',
    '使用停止中のデータベース',
    'Retired databases'
  ],
  缓存数据库: ['缓存数据库', '快取資料庫', 'キャッシュデータベース', 'Cache databases'],
  全部数据库: ['全部数据库', '全部資料庫', 'すべてのデータベース', 'All databases'],
  '当前没有可确认安全删除的遗弃字段，未识别的字段不会被自动清理。': [
    '当前没有可确认安全删除的遗弃字段，未识别的字段不会被自动清理。',
    '目前沒有可確認安全刪除的遺棄欄位，未識別的欄位不會被自動清理。',
    '安全に削除できると確認された不要な項目はありません。不明な項目は自動削除されません。',
    'There are no abandoned fields confirmed safe to delete. Unrecognized fields are not cleaned automatically.'
  ],
  '缓存用于加快资源加载，不包含在用户数据备份中；删除后需要时会重新下载。': [
    '缓存用于加快资源加载，不包含在用户数据备份中；删除后需要时会重新下载。',
    '快取用於加快資源載入，不包含在使用者資料備份中；刪除後需要時會重新下載。',
    'キャッシュはリソースの読み込みを高速化し、ユーザーデータのバックアップには含まれません。削除後は必要に応じて再ダウンロードされます。',
    'Cache speeds up resource loading and is not included in user data backups. Deleted resources are downloaded again when needed.'
  ],
  全选当前范围: ['全选当前范围', '全選目前範圍', '現在の範囲をすべて選択', 'Select all in scope'],
  清空选择: ['清空选择', '清空選擇', '選択を解除', 'Clear selection'],
  未识别数据库: ['未识别数据库', '未識別資料庫', '不明なデータベース', 'Unrecognized database'],
  '（已停用）': ['（已停用）', '（已停用）', '（使用停止）', ' (retired)'],
  '（用途未知）': ['（用途未知）', '（用途未知）', '（用途不明）', ' (unknown purpose)'],
  '当前范围没有数据库。': [
    '当前范围没有数据库。',
    '目前範圍沒有資料庫。',
    'この範囲にデータベースはありません。',
    'No databases in this scope.'
  ],
  '旧版讲义册库可能包含旧讲义和收藏记录，删除后不可恢复。': [
    '旧版讲义册库可能包含旧讲义和收藏记录，删除后不可恢复。',
    '舊版講義冊資料庫可能包含舊講義和收藏記錄，刪除後無法復原。',
    '旧講義データベースには過去の講義やお気に入りが含まれる場合があり、削除後は復元できません。',
    'The legacy lecture database may contain old lecture notes and favorites. Deletion cannot be undone.'
  ],
  '再次确认要永久删除以下数据库？': [
    '再次确认要永久删除以下数据库？',
    '再次確認要永久刪除以下資料庫？',
    '次のデータベースを完全に削除しますか？',
    'Confirm again that you want to permanently delete these databases.'
  ],
  '最后确认：删除后无法恢复，且不会自动保留副本。': [
    '最后确认：删除后无法恢复，且不会自动保留副本。',
    '最後確認：刪除後無法復原，且不會自動保留副本。',
    '最終確認：削除後は復元できず、コピーも自動保存されません。',
    'Final confirmation: deletion cannot be undone and no copy will be kept automatically.'
  ],
  '其他未选择的数据库、登录凭据和服务器数据不受此操作影响。': [
    '其他未选择的数据库、登录凭据和服务器数据不受此操作影响。',
    '其他未選擇的資料庫、登入憑證和伺服器資料不受此操作影響。',
    '選択されていないデータベース、ログイン情報、サーバーデータには影響しません。',
    'Unselected databases, login credentials and server data are not affected.'
  ],
  '当前有 {count} 个无来源题目。数量可能变化，执行时所有仍无来源的题目及其知识点关联都会被永久删除，无法撤销。知识点本身不会删除，图书中的相关引用会显示缺失。':
    [
      '当前有 {count} 个无来源题目。数量可能变化，执行时所有仍无来源的题目及其知识点关联都会被永久删除，无法撤销。知识点本身不会删除，图书中的相关引用会显示缺失。',
      '目前有 {count} 個無來源題目。數量可能變動，執行時所有仍無來源的題目及其知識點關聯都會被永久刪除，無法復原。知識點本身不會刪除，圖書中的相關引用會顯示缺失。',
      '現在、出典のない問題が {count} 件あります。件数は変動する場合があります。実行時に出典のないすべての問題と知識項目への関連が完全に削除され、元に戻せません。知識項目自体は削除されず、書籍の参照は欠落します。',
      'There are currently {count} unsourced questions; this number may change. All questions still without sources and their topic links will be permanently deleted. This cannot be undone. Topics remain, but book references will be missing.'
    ],
  '将删除 {categories} 个分类和 {entries} 个来源，题目本身会保留。': [
    '将删除 {categories} 个分类和 {entries} 个来源，题目本身会保留。',
    '將刪除 {categories} 個分類和 {entries} 個來源，題目本身會保留。',
    '{categories} 件のカテゴリと {entries} 件の出典を削除します。問題は残ります。',
    'This deletes {categories} categories and {entries} sources. The questions remain.'
  ],
  '备份时间：{time}': [
    '备份时间：{time}',
    '備份時間：{time}',
    'バックアップ日時：{time}',
    'Backup time: {time}'
  ],
  '{label}：{count} 条': [
    '{label}：{count} 条',
    '{label}：{count} 筆',
    '{label}：{count} 件',
    '{label}: {count} records'
  ],
  资源文件缓存: [
    '资源文件缓存',
    '資源檔案快取',
    'リソースファイルキャッシュ',
    'Resource file cache'
  ],
  知识点掌握记录: [
    '知识点掌握记录',
    '知識點掌握記錄',
    '知識項目の習得記録',
    'Topic mastery records'
  ],
  更新日志已读记录: [
    '更新日志已读记录',
    '更新日誌已讀記錄',
    '更新履歴の既読記録',
    'Release notes read history'
  ],
  讲义封面缓存: ['讲义封面缓存', '講義封面快取', '講義の表紙キャッシュ', 'Lecture cover cache'],
  旧知识地图字形缓存: [
    '旧知识地图字形缓存',
    '舊知識地圖字形快取',
    '旧知識マップの文字キャッシュ',
    'Legacy knowledge map glyph cache'
  ],
  旧版讲义册数据: ['旧版讲义册数据', '舊版講義冊資料', '旧講義データ', 'Legacy lecture data'],
  '正在加载图书…': ['正在加载图书…', '正在載入圖書…', '書籍を読み込み中…', 'Loading books…'],
  图书加载失败: [
    '图书加载失败',
    '圖書載入失敗',
    '書籍の読み込みに失敗しました',
    'Could not load books'
  ],
  未命名图书: ['未命名图书', '未命名圖書', '無題の書籍', 'Untitled book'],
  '讲义标识缺失，请刷新列表': [
    '讲义标识缺失，请刷新列表',
    '講義識別碼缺失，請重新整理清單',
    '講義の識別子がありません。一覧を更新してください',
    'Lecture identifier is missing. Refresh the list.'
  ],
  '正在加载题目册…': [
    '正在加载题目册…',
    '正在載入題目冊…',
    '問題集を読み込み中…',
    'Loading workbook…'
  ],
  '暂无题目册简介。': [
    '暂无题目册简介。',
    '暫無題目冊簡介。',
    '問題集の紹介はありません。',
    'No workbook description.'
  ],
  '暂无课程描述信息。': [
    '暂无课程描述信息。',
    '暫無課程描述資訊。',
    'コースの説明はありません。',
    'No course description.'
  ],
  阅读题目册: ['阅读题目册', '閱讀題目冊', '問題集を読む', 'Read workbook'],
  阅读讲义: ['阅读讲义', '閱讀講義', '講義を読む', 'Read lecture'],
  查看题目册目录: [
    '查看题目册目录',
    '查看題目冊目錄',
    '問題集の目次を見る',
    'View workbook contents'
  ],
  查看大纲目录: ['查看大纲目录', '查看大綱目錄', '目次を表示', 'View outline'],
  编辑封面: ['编辑封面', '編輯封面', '表紙を編集', 'Edit cover'],
  替换封面: ['替换封面', '取代封面', '表紙を置き換え', 'Replace cover'],
  删除题目册: ['删除题目册', '刪除題目冊', '問題集を削除', 'Delete workbook'],
  删除讲义: ['删除讲义', '刪除講義', '講義を削除', 'Delete lecture'],
  删除本地题目册: [
    '删除本地题目册',
    '刪除本機題目冊',
    'ローカル問題集を削除',
    'Delete local workbook'
  ],
  删除本地讲义: ['删除本地讲义', '刪除本機講義', 'ローカル講義を削除', 'Delete local lecture'],
  添加到我的书架: ['添加到我的书架', '新增到我的書架', 'マイ本棚に追加', 'Add to my bookshelf'],
  '公开状态检查失败，重试': [
    '公开状态检查失败，重试',
    '公開狀態檢查失敗，重試',
    '公開状態を確認できませんでした。再試行',
    'Could not check publication status. Retry'
  ],
  通过审核: ['通过审核', '通過審核', '審査を承認', 'Approve'],
  驳回讲义: ['驳回讲义', '駁回講義', '講義を却下', 'Reject lecture'],
  驳回题目册: ['驳回题目册', '駁回題目冊', '問題集を却下', 'Reject workbook'],
  确认通过: ['确认通过', '確認通過', '承認を確認', 'Confirm approval'],
  确认驳回: ['确认驳回', '確認駁回', '却下を確認', 'Confirm rejection'],
  审核意见: ['审核意见', '審核意見', '審査コメント', 'Review comment'],
  'OVERVIEW // 题目册概要': [
    'OVERVIEW // 题目册概要',
    'OVERVIEW // 題目冊概要',
    'OVERVIEW // 問題集の概要',
    'OVERVIEW // Workbook overview'
  ],
  章节与小节: ['章节与小节', '章節與小節', '章と節', 'Chapters and sections'],
  题目册版本: ['题目册版本', '題目冊版本', '問題集のバージョン', 'Workbook version'],
  讲义版本: ['讲义版本', '講義版本', '講義のバージョン', 'Lecture version'],
  本地版本: ['本地版本', '本機版本', 'ローカルバージョン', 'Local version'],
  版本状态: ['版本状态', '版本狀態', 'バージョンの状態', 'Version status'],
  本地编辑: ['本地编辑', '本機編輯', 'ローカル編集', 'Local editing'],
  'GUIDE // 学习指引': [
    'GUIDE // 学习指引',
    'GUIDE // 學習指引',
    'GUIDE // 学習ガイド',
    'GUIDE // Study guide'
  ],
  'PREREQUISITES // 学习指引': [
    'PREREQUISITES // 学习指引',
    'PREREQUISITES // 學習指引',
    'PREREQUISITES // 学習ガイド',
    'PREREQUISITES // Study guide'
  ],
  '从目录中选择小节，查看题目并回顾考点与解答。': [
    '从目录中选择小节，查看题目并回顾考点与解答。',
    '從目錄中選擇小節，查看題目並複習考點與解答。',
    '目次から節を選び、問題と解説を確認しましょう。',
    'Choose a section to view questions and review concepts and solutions.'
  ],
  '点击下方目录中的小节进入阅读。': [
    '点击下方目录中的小节进入阅读。',
    '點擊下方目錄中的小節進入閱讀。',
    '下の目次から節を選んで読み始めましょう。',
    'Select a section below to start reading.'
  ],
  题目册目录: ['题目册目录', '題目冊目錄', '問題集の目次', 'Workbook contents'],
  讲义大纲与章节目录: [
    '讲义大纲与章节目录',
    '講義大綱與章節目錄',
    '講義の概要と目次',
    'Lecture outline and contents'
  ],
  讲义目录结构: ['讲义目录结构', '講義目錄結構', '講義の目次構成', 'Lecture structure'],
  全部展开: ['全部展开', '全部展開', 'すべて展開', 'Expand all'],
  全部折叠: ['全部折叠', '全部收合', 'すべて折りたたむ', 'Collapse all'],
  '查看题目 →': ['查看题目 →', '查看題目 →', '問題を見る →', 'View questions →'],
  查看题目: ['查看题目', '查看題目', '問題を見る', 'View questions'],
  进入讲义: ['进入讲义', '進入講義', '講義を開く', 'Open lecture'],
  暂无题目册目录: [
    '暂无题目册目录',
    '暫無題目冊目錄',
    '問題集の目次はありません',
    'No workbook contents yet'
  ],
  '选择不超过 5 MB 的 JPG、PNG 或 WebP 图片。': [
    '选择不超过 5 MB 的 JPG、PNG 或 WebP 图片。',
    '選擇不超過 5 MB 的 JPG、PNG 或 WebP 圖片。',
    '5 MB 以下の JPG、PNG、WebP 画像を選択してください。',
    'Choose a JPG, PNG or WebP image no larger than 5 MB.'
  ],
  '保存当前公开版本为本地题目册。': [
    '保存当前公开版本为本地题目册。',
    '將目前公開版本儲存為本機題目冊。',
    '現在の公開バージョンをローカル問題集として保存します。',
    'Save the current published version as a local workbook.'
  ],
  '下载当前版本为本地讲义，可在讲义工作台编辑。': [
    '下载当前版本为本地讲义，可在讲义工作台编辑。',
    '下載目前版本為本機講義，可在講義工作台編輯。',
    '現在のバージョンをローカル講義としてダウンロードし、ワークスペースで編集できます。',
    'Download the current version as local lecture notes to edit in the workspace.'
  ],
  本地题目册标识: [
    '本地题目册标识',
    '本機題目冊識別碼',
    'ローカル問題集の識別子',
    'Local workbook identifier'
  ],
  本地讲义标识: [
    '本地讲义标识',
    '本機講義識別碼',
    'ローカル講義の識別子',
    'Local lecture identifier'
  ],
  标识需在本浏览器中唯一: [
    '标识需在本浏览器中唯一',
    '識別碼需在本瀏覽器中唯一',
    'このブラウザー内で一意の識別子が必要です',
    'Identifier must be unique in this browser'
  ],
  本地讲义标识需在本浏览器中唯一: [
    '本地讲义标识需在本浏览器中唯一',
    '本機講義識別碼需在本瀏覽器中唯一',
    'ローカル講義の識別子はこのブラウザー内で一意にしてください',
    'Local lecture identifier must be unique in this browser'
  ],
  '本题目册按章节和小节组织题目。你可以从目录中选择小节开始阅读。': [
    '本题目册按章节和小节组织题目。你可以从目录中选择小节开始阅读。',
    '本題目冊按章節和小節組織題目。你可以從目錄中選擇小節開始閱讀。',
    'この問題集は章と節に分かれています。目次から節を選んで読み始めましょう。',
    'Questions are organized into chapters and sections. Choose a section from the contents to begin.'
  ],
  '本讲义按章节和小节组织内容。你可以从目录中选择小节开始阅读。': [
    '本讲义按章节和小节组织内容。你可以从目录中选择小节开始阅读。',
    '本講義按章節和小節組織內容。你可以從目錄中選擇小節開始閱讀。',
    'この講義は章と節に分かれています。目次から節を選んで読み始めましょう。',
    'Content is organized into chapters and sections. Choose a section from the contents to begin.'
  ],
  '点击下方目录中的小节即可查看题目。': [
    '点击下方目录中的小节即可查看题目。',
    '點擊下方目錄中的小節即可查看題目。',
    '下の目次から節を選ぶと問題を表示できます。',
    'Select a section below to view its questions.'
  ],
  '点击下方目录中的任一讲次即可直接进入全屏讲义阅读。': [
    '点击下方目录中的任一讲次即可直接进入全屏讲义阅读。',
    '點擊下方目錄中的任一講次即可直接進入全螢幕講義閱讀。',
    '下の目次から講義を選ぶと全画面で読むことができます。',
    'Select a lecture below to read it in full screen.'
  ],
  选择选项: ['选择选项', '選擇選項', '選択してください', 'Select an option'],
  暂无选项: ['暂无选项', '暫無選項', '選択肢がありません', 'No options'],
  '{chapters} 章 · {sections} 节': [
    '{chapters} 章 · {sections} 节',
    '{chapters} 章 · {sections} 節',
    '{chapters} 章 · {sections} 節',
    '{chapters} chapters · {sections} sections'
  ],
  '{chapters} 编 · {sections} 讲': [
    '{chapters} 编 · {sections} 讲',
    '{chapters} 編 · {sections} 講',
    '{chapters} 編 · {sections} 講',
    '{chapters} parts · {sections} lectures'
  ],
  '{count} 节': ['{count} 节', '{count} 節', '{count} 節', '{count} sections'],
  '{count} 讲': ['{count} 讲', '{count} 講', '{count} 講', '{count} lectures'],
  '确定删除“{title}”吗？本地题目册内容将被删除，且无法恢复。': [
    '确定删除“{title}”吗？本地题目册内容将被删除，且无法恢复。',
    '確定刪除「{title}」嗎？本機題目冊內容將被刪除，且無法復原。',
    '「{title}」を削除しますか？ローカル問題集の内容は削除され、復元できません。',
    'Delete “{title}”? The local workbook content will be permanently deleted.'
  ],
  '确定删除“{title}”吗？本地讲义内容将被删除，且无法恢复。': [
    '确定删除“{title}”吗？本地讲义内容将被删除，且无法恢复。',
    '確定刪除「{title}」嗎？本機講義內容將被刪除，且無法復原。',
    '「{title}」を削除しますか？ローカル講義の内容は削除され、復元できません。',
    'Delete “{title}”? The local lecture content will be permanently deleted.'
  ],
  'OVERVIEW // {kind}': [
    'OVERVIEW // {kind}',
    'OVERVIEW // {kind}',
    'OVERVIEW // {kind}',
    'OVERVIEW // {kind}'
  ],
  题目册概要: ['题目册概要', '題目冊概要', '問題集の概要', 'Workbook overview'],
  讲义概要: ['讲义概要', '講義概要', '講義の概要', 'Lecture overview'],
  当前讲义: ['当前讲义', '目前講義', '現在の講義', 'Current lecture'],
  请选择: ['请选择', '請選擇', '選択してください', 'Select'],
  '请选择不超过 5 MB 的 JPG、PNG 或 WebP 图片': [
    '请选择不超过 5 MB 的 JPG、PNG 或 WebP 图片',
    '請選擇不超過 5 MB 的 JPG、PNG 或 WebP 圖片',
    '5 MB 以下の JPG、PNG、WebP 画像を選択してください',
    'Choose a JPG, PNG or WebP image no larger than 5 MB'
  ],
  读取图片失败: ['读取图片失败', '讀取圖片失敗', '画像を読み込めません', 'Could not read image'],
  封面已保存: ['封面已保存', '封面已儲存', '表紙を保存しました', 'Cover saved'],
  封面保存失败: ['封面保存失败', '封面儲存失敗', '表紙を保存できません', 'Could not save cover'],
  保存封面失败: ['保存封面失败', '儲存封面失敗', '表紙を保存できません', 'Could not save cover'],
  已恢复通用封面: [
    '已恢复通用封面',
    '已還原通用封面',
    '既定の表紙に戻しました',
    'Default cover restored'
  ],
  删除封面失败: ['删除封面失败', '刪除封面失敗', '表紙を削除できません', 'Could not remove cover'],
  本地题目册已删除: [
    '本地题目册已删除',
    '本機題目冊已刪除',
    'ローカル問題集を削除しました',
    'Local workbook deleted'
  ],
  本地讲义已删除: [
    '本地讲义已删除',
    '本機講義已刪除',
    'ローカル講義を削除しました',
    'Local lecture deleted'
  ],
  删除题目册失败: [
    '删除题目册失败',
    '刪除題目冊失敗',
    '問題集を削除できません',
    'Could not delete workbook'
  ],
  删除本地讲义失败: [
    '删除本地讲义失败',
    '刪除本機講義失敗',
    'ローカル講義を削除できません',
    'Could not delete local lecture'
  ],
  已添加到我的书架: [
    '已添加到我的书架',
    '已新增到我的書架',
    'マイ本棚に追加しました',
    'Added to your bookshelf'
  ],
  添加题目册失败: [
    '添加题目册失败',
    '新增題目冊失敗',
    '問題集を追加できません',
    'Could not add workbook'
  ],
  '已添加到我的书架，可在讲义工作台编辑本地副本': [
    '已添加到我的书架，可在讲义工作台编辑本地副本',
    '已新增到我的書架，可在講義工作台編輯本機副本',
    'マイ本棚に追加しました。ワークスペースでローカルコピーを編集できます',
    'Added to your bookshelf. Edit the local copy in the workspace.'
  ],
  '添加讲义失败，请重试': [
    '添加讲义失败，请重试',
    '新增講義失敗，請重試',
    '講義を追加できませんでした。再試行してください',
    'Could not add lecture. Please retry.'
  ],
  审核已完成: ['审核已完成', '審核已完成', '審査が完了しました', 'Review completed'],
  '审核状态已变化，请刷新后重新核对': [
    '审核状态已变化，请刷新后重新核对',
    '審核狀態已變更，請重新整理後再次核對',
    '審査状態が変更されました。更新して確認してください',
    'Review status changed. Refresh and check again.'
  ],
  审核失败: ['审核失败', '審核失敗', '審査に失敗しました', 'Review failed'],
  '该版本已不再公开，请刷新后重试': [
    '该版本已不再公开，请刷新后重试',
    '該版本已不再公開，請重新整理後重試',
    'このバージョンは公開されていません。更新して再試行してください',
    'This version is no longer public. Refresh and retry.'
  ],
  '无法确认该版本仍为公开版本，请刷新后重试': [
    '无法确认该版本仍为公开版本，请刷新后重试',
    '無法確認該版本仍為公開版本，請重新整理後重試',
    'このバージョンの公開状態を確認できません。更新して再試行してください',
    'Could not confirm that this version is public. Refresh and retry.'
  ],
  题目册不存在或当前账号无权访问: [
    '题目册不存在或当前账号无权访问',
    '題目冊不存在或目前帳號無權存取',
    '問題集が存在しないか、アクセス権がありません',
    'Workbook not found or access denied'
  ],
  题目册加载失败: [
    '题目册加载失败',
    '題目冊載入失敗',
    '問題集を読み込めません',
    'Could not load workbook'
  ],
  讲义不存在或当前账号无权访问: [
    '讲义不存在或当前账号无权访问',
    '講義不存在或目前帳號無權存取',
    '講義が存在しないか、アクセス権がありません',
    'Lecture not found or access denied'
  ],
  '讲义加载失败，请重试': [
    '讲义加载失败，请重试',
    '講義載入失敗，請重試',
    '講義を読み込めません。再試行してください',
    'Could not load lecture. Please retry.'
  ],
  版本数据异常: [
    '版本数据异常',
    '版本資料異常',
    'バージョンデータに問題があります',
    'Invalid version data'
  ],
  版本号未提供: [
    '版本号未提供',
    '未提供版本號',
    'バージョン番号未指定',
    'Version number unavailable'
  ],
  请联系管理员处理: [
    '请联系管理员处理',
    '請聯絡管理員處理',
    '管理者にお問い合わせください',
    'Contact an administrator'
  ],
  当前公开: ['当前公开', '目前公開', '公開中', 'Public'],
  编辑中: ['编辑中', '編輯中', '編集中', 'Editing'],
  收起版本: ['收起版本', '收合版本', 'バージョンを閉じる', 'Collapse versions'],
  '正在加载版本…': [
    '正在加载版本…',
    '正在載入版本…',
    'バージョンを読み込み中…',
    'Loading versions…'
  ],
  版本加载失败: [
    '版本加载失败',
    '版本載入失敗',
    'バージョンの読み込みに失敗しました',
    'Could not load versions'
  ],
  暂无可查看版本: [
    '暂无可查看版本',
    '暫無可查看版本',
    '表示できるバージョンはありません',
    'No versions available'
  ],
  '版本记录异常，请联系管理员处理': [
    '版本记录异常，请联系管理员处理',
    '版本記錄異常，請聯絡管理員處理',
    'バージョン記録に問題があります。管理者にお問い合わせください',
    'Invalid version record. Contact an administrator.'
  ],
  本地讲义加载失败: [
    '本地讲义加载失败',
    '本機講義載入失敗',
    'ローカル講義を読み込めません',
    'Could not load local lecture notes'
  ],
  我创作的讲义加载失败: [
    '我创作的讲义加载失败',
    '我創作的講義載入失敗',
    '自分の講義を読み込めません',
    'Could not load your lecture notes'
  ],
  讲义版本加载失败: [
    '讲义版本加载失败',
    '講義版本載入失敗',
    '講義のバージョンを読み込めません',
    'Could not load lecture versions'
  ],
  '讲义或版本标识缺失，无法打开': [
    '讲义或版本标识缺失，无法打开',
    '講義或版本識別碼缺失，無法開啟',
    '講義またはバージョンの識別子がないため開けません',
    'Cannot open: lecture or version identifier is missing'
  ],
  '本地讲义标识无效，请在讲义工作台修改': [
    '本地讲义标识无效，请在讲义工作台修改',
    '本機講義識別碼無效，請在講義工作台修改',
    'ローカル講義の識別子が無効です。ワークスペースで変更してください',
    'Invalid local lecture identifier. Change it in the workspace.'
  ],
  '本地讲义标识重复，请在讲义工作台修改': [
    '本地讲义标识重复，请在讲义工作台修改',
    '本機講義識別碼重複，請在講義工作台修改',
    'ローカル講義の識別子が重複しています。ワークスペースで変更してください',
    'Duplicate local lecture identifier. Change it in the workspace.'
  ],
  '我创作的讲义缺少标识，无法打开': [
    '我创作的讲义缺少标识，无法打开',
    '我創作的講義缺少識別碼，無法開啟',
    '講義に識別子がないため開けません',
    'Cannot open your lecture: identifier is missing'
  ],
  日历和一言: ['日历和一言', '日曆和一言', 'カレンダーとひとこと', 'Calendar and quote'],
  本月日历: ['本月日历', '本月日曆', '今月のカレンダー', 'Monthly calendar'],
  上一年: ['上一年', '上一年', '前年', 'Previous year'],
  下一年: ['下一年', '下一年', '翌年', 'Next year'],
  上个月: ['上个月', '上個月', '前月', 'Previous month'],
  下个月: ['下个月', '下個月', '翌月', 'Next month'],
  添加日程: ['添加日程', '新增日程', '予定を追加', 'Add event'],
  这一天还没有日程: [
    '这一天还没有日程',
    '這一天還沒有日程',
    'この日の予定はありません',
    'No events on this day'
  ],
  日程内容: ['日程内容', '日程內容', '予定の内容', 'Event details'],
  输入日程内容: ['输入日程内容', '輸入日程內容', '予定を入力', 'Enter event details'],
  '无法读取日程，请稍后重试。': [
    '无法读取日程，请稍后重试。',
    '無法讀取日程，請稍後重試。',
    '予定を読み込めません。後でもう一度お試しください。',
    'Could not load events. Please try again later.'
  ],
  '保存日程失败，请重试。': [
    '保存日程失败，请重试。',
    '儲存日程失敗，請重試。',
    '予定を保存できません。再試行してください。',
    'Could not save event. Please retry.'
  ],
  '更新日程失败，请重试。': [
    '更新日程失败，请重试。',
    '更新日程失敗，請重試。',
    '予定を更新できません。再試行してください。',
    'Could not update event. Please retry.'
  ],
  '删除日程失败，请重试。': [
    '删除日程失败，请重试。',
    '刪除日程失敗，請重試。',
    '予定を削除できません。再試行してください。',
    'Could not delete event. Please retry.'
  ],
  '{date}的日程': ['{date}的日程', '{date}的日程', '{date}の予定', 'Events for {date}'],
  '完成{name}': ['完成{name}', '完成{name}', '{name}を完了', 'Complete {name}'],
  '编辑{name}': ['编辑{name}', '編輯{name}', '{name}を編集', 'Edit {name}'],
  '删除{name}': ['删除{name}', '刪除{name}', '{name}を削除', 'Delete {name}']
};

const locales = ['zh-CN', 'zh-TW', 'ja', 'en'];
const storageKey = 'maki-language';
function systemLocale() {
  for (const language of navigator.languages || [navigator.language]) {
    const value = String(language || '').toLowerCase();
    if (/^zh-(tw|hk|mo|hant)/.test(value)) {
      return 'zh-TW';
    }
    if (value.startsWith('zh')) {
      return 'zh-CN';
    }
    if (value.startsWith('ja')) {
      return 'ja';
    }
    if (value.startsWith('en')) {
      return 'en';
    }
  }
  return 'zh-CN';
}
function savedPreference() {
  try {
    return localStorage.getItem(storageKey) || 'system';
  } catch {
    return 'system';
  }
}
export const languagePreference = ref(savedPreference());
export const locale = ref(
  locales.includes(languagePreference.value) ? languagePreference.value : systemLocale()
);
function applyLocale() {
  locale.value = locales.includes(languagePreference.value)
    ? languagePreference.value
    : systemLocale();
  document.documentElement.lang = locale.value;
}
export function setLanguage(value) {
  languagePreference.value = locales.includes(value) ? value : 'system';
  try {
    localStorage.setItem(storageKey, languagePreference.value);
  } catch {
    // 使用当前会话设置
  }
  applyLocale();
}
export function t(key, params = {}) {
  const value = messages[key]?.[locales.indexOf(locale.value)] || key;
  return value.replace(/\{(\w+)\}/g, (match, name) =>
    params[name] == null ? match : String(params[name])
  );
}
applyLocale();
window.addEventListener('languagechange', () => {
  if (languagePreference.value === 'system') {
    applyLocale();
  }
});
window.addEventListener('storage', (event) => {
  if (event.key === storageKey) {
    languagePreference.value = event.newValue || 'system';
    applyLocale();
  }
});
