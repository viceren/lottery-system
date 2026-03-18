# 初始化 Git 仓库
git init

# 创建 .gitignore 忽略依赖项
@'
node_modules/
dist/
.env
.DS_Store
'@ | Out-File -FilePath .gitignore -Encoding utf8

# 添加所有文件并提交
git add .
git commit -m "Initial commit for lottery system"

Write-Host "`n[系统提示] 代码已准备就绪！" -ForegroundColor Green
Write-Host "由于我无法获取您的 GitHub 令牌，请您手动执行最后一步：`n"
Write-Host "1. 在 GitHub 上新建一个名为 'lottery-system' 的仓库。"
Write-Host "2. 复制 GitHub 提供的地址，并运行："
Write-Host "   git remote add origin <您的仓库地址>"
Write-Host "   git branch -M main"
Write-Host "   git push -u origin main"
