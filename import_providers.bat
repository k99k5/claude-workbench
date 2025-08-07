@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

echo.
echo ===== Claude Workbench 代理商配置导入工具 =====
echo.
echo 本工具将把您现有的代理商配置导入到 Claude Workbench 中
echo 导入后，您可以在应用内一键切换代理商，无需手动运行批处理文件
echo.

REM 检查 Claude Workbench 是否正在运行
tasklist /FI "IMAGENAME eq claude-workbench.exe" 2>NUL | find /I /N "claude-workbench.exe" >NUL
if "%ERRORLEVEL%"=="0" (
    echo [警告] 检测到 Claude Workbench 正在运行
    echo 请先关闭 Claude Workbench 再运行此导入工具
    echo.
    pause
    exit /b 1
)

REM 获取用户主目录
set "CLAUDE_DIR=%USERPROFILE%\.claude"
set "PROVIDERS_FILE=%CLAUDE_DIR%\providers.json"

REM 确保 .claude 目录存在
if not exist "%CLAUDE_DIR%" (
    echo 创建 Claude 配置目录: %CLAUDE_DIR%
    mkdir "%CLAUDE_DIR%"
)

echo 正在生成代理商配置文件: %PROVIDERS_FILE%
echo.

REM 创建 providers.json 文件
(
echo [
echo   {
echo     "id": "wenwen-ai",
echo     "name": "文文AI",
echo     "description": "wenwen-ai.com 代理服务",
echo     "base_url": "https://code.wenwen-ai.com",
echo     "auth_token": "sk-m8lNYOfPFIW3Jk7bUauGbziYN5qJ1IUjVFqPc55K2TQg5fKE",
echo     "api_key": null,
echo     "model": null
echo   },
echo   {
echo     "id": "packycode",
echo     "name": "PackyCode",
echo     "description": "api.packycode.com 代理服务",
echo     "base_url": "https://api.packycode.com",
echo     "auth_token": "sk-ClVTdybl5jayasgVHqRnxHbYFqVgAfrM",
echo     "api_key": null,
echo     "model": null
echo   },
echo   {
echo     "id": "co-yes-vg",
echo     "name": "Co Yes VG",
echo     "description": "co.yes.vg 代理服务",
echo     "base_url": "https://co.yes.vg",
echo     "auth_token": "cr_3185bbfd0eb62296badb6ca855d3840844bfbd22d9be1106715596bd78c6eb11",
echo     "api_key": null,
echo     "model": null
echo   },
echo   {
echo     "id": "siliconflow-kimi",
echo     "name": "SiliconFlow Kimi",
echo     "description": "Kimi-K2-Instruct 模型 (SiliconFlow)",
echo     "base_url": "https://api.siliconflow.cn/",
echo     "auth_token": null,
echo     "api_key": "sk-ednywbvnfwerfcxnqjkmnhxvgcqoyuhmjvfywrshpxsgjbzm",
echo     "model": "moonshotai/Kimi-K2-Instruct"
echo   },
echo   {
echo     "id": "anyrouter",
echo     "name": "AnyRouter",
echo     "description": "anyrouter.top 代理服务",
echo     "base_url": "https://anyrouter.top",
echo     "auth_token": "sk-5QCFir47vmtAOAYAF09m2rXQgwNAUnnxNfXQ70EpqqGLdlm2",
echo     "api_key": null,
echo     "model": null
echo   },
echo   {
echo     "id": "instcopilot",
echo     "name": "InstCopilot",
echo     "description": "instcopilot-api.com 代理服务",
echo     "base_url": "https://instcopilot-api.com",
echo     "auth_token": "sk-3W6BKms2pKiu2IYBnyIZ0CrFyxapdi1qKCGx4NrsaDILWu5w",
echo     "api_key": null,
echo     "model": null
echo   }
echo ]
) > "%PROVIDERS_FILE%"

if exist "%PROVIDERS_FILE%" (
    echo ✅ 成功创建代理商配置文件
    echo.
    echo 📍 配置文件位置: %PROVIDERS_FILE%
    echo.
    echo 🚀 现在请启动 Claude Workbench，然后：
    echo    1. 点击顶部的 "设置" 按钮
    echo    2. 选择 "代理商" 标签
    echo    3. 您将看到所有导入的代理商配置
    echo    4. 点击任意代理商右侧的 "切换到此配置" 按钮即可切换
    echo.
    echo ℹ️  说明：
    echo    - 切换代理商时会自动重启所有 Claude 进程
    echo    - 新的环境变量会立即生效
    echo    - 无需再手动运行批处理文件
    echo.
    echo 🔧 如需添加更多代理商，请直接在 Claude Workbench 中操作：
    echo    - 点击 "添加代理商" 按钮
    echo    - 填写相应的配置信息
    echo    - 支持 auth_token、api_key 和自定义模型
    echo.
) else (
    echo ❌ 创建配置文件失败
    echo 请检查目录权限: %CLAUDE_DIR%
    echo.
)

pause
exit /b 0