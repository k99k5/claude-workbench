@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

echo.
echo ===== Claude Workbench 代理商切换验证工具 =====
echo.
echo 本工具用于验证代理商切换功能是否正常工作
echo.

REM 检查 Claude Workbench 配置目录
set "CLAUDE_DIR=%USERPROFILE%\.claude"
set "PROVIDERS_FILE=%CLAUDE_DIR%\providers.json"

echo 🔍 检查配置文件...
if not exist "%CLAUDE_DIR%" (
    echo ❌ Claude 配置目录不存在: %CLAUDE_DIR%
    echo 请先运行 Claude Workbench 或执行 import_providers.bat
    pause
    exit /b 1
)

if not exist "%PROVIDERS_FILE%" (
    echo ❌ 代理商配置文件不存在: %PROVIDERS_FILE%
    echo 请先执行 import_providers.bat 导入配置
    pause
    exit /b 1
)

echo ✅ 配置文件存在: %PROVIDERS_FILE%
echo.

echo 📋 当前代理商配置:
type "%PROVIDERS_FILE%"
echo.

echo 🔧 当前环境变量:
echo ----------------------------------------
echo ANTHROPIC_BASE_URL = %ANTHROPIC_BASE_URL%
echo ANTHROPIC_AUTH_TOKEN = %ANTHROPIC_AUTH_TOKEN%
echo ANTHROPIC_API_KEY = %ANTHROPIC_API_KEY%
echo ANTHROPIC_MODEL = %ANTHROPIC_MODEL%
echo ----------------------------------------
echo.

REM 检查 Claude CLI 是否可用
echo 🧪 测试 Claude CLI 可用性...
claude --version >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo ✅ Claude CLI 可用
    claude --version
) else (
    echo ❌ Claude CLI 不可用或未安装
    echo 请确保 Claude CLI 已正确安装并在 PATH 中
)
echo.

echo 📝 代理商切换测试说明:
echo.
echo 1. 打开 Claude Workbench
echo 2. 进入设置 → 代理商标签
echo 3. 选择任意代理商点击 "切换到此配置"
echo 4. 观察是否出现成功消息
echo 5. 再次运行此脚本验证环境变量是否已更新
echo.

echo 🚨 常见问题排查:
echo.
echo 如果切换失败，请检查:
echo • Windows 防火墙是否阻止了 setx/reg 命令
echo • 是否有足够的系统权限
echo • Claude Workbench 是否以管理员身份运行
echo • 是否有其他程序占用了 Claude 进程
echo.

echo 🔄 手动验证方法:
echo 1. 切换代理商后，关闭并重新打开命令提示符
echo 2. 运行: echo %%ANTHROPIC_BASE_URL%%
echo 3. 应该显示新的 API 地址
echo.

pause
exit /b 0