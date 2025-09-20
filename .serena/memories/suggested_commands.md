# 建议命令列表

## 开发环境命令

### 主要开发命令
```bash
# 启动开发服务器（前端+后端热重载）
bun run tauri dev

# 类型检查（关键：TypeScript安全性）
npx tsc --noEmit

# 生产构建（总是用于最终测试）
bun run tauri build

# 快速开发构建（迭代测试）
bun run tauri build -- --profile dev-release
```

### Rust后端命令
```bash
# Rust后端构建
cd src-tauri && cargo build --release

# Rust代码检查和修复
cd src-tauri && cargo check && cargo clippy

# 清理构建缓存
cd src-tauri && cargo clean
```

### 包管理
```bash
# 安装依赖（推荐使用Bun）
bun install

# 更新依赖
bun update
```

## 调试命令

### 日志查看
```bash
# Windows环境变量设置（开启详细日志）
set RUST_LOG=debug
bun run tauri dev

# 查看Claude CLI版本
claude --version

# 测试Claude CLI连接
claude -p "Hello world"
```

### 进程管理
```bash
# Windows: 查看运行中的进程
tasklist | findstr claude
tasklist | findstr tauri

# 强制终止进程（如果需要）
taskkill /F /IM claude.exe
taskkill /F /IM tauri.exe
```

## Windows系统工具命令

### 文件操作
```cmd
# 目录列表
dir /B

# 递归查找文件
dir /S /B *.json

# 文件内容搜索
findstr /S /I "pattern" *.ts *.rs

# 创建目录
mkdir dirname

# 删除文件/目录
del filename
rmdir /S dirname
```

### 路径操作
```cmd
# 获取当前路径
cd

# 切换驱动器
C:
D:

# 查看环境变量
echo %PATH%
echo %USERPROFILE%
```

## Git操作
```bash
# 标准Git命令
git status
git add .
git commit -m "message"
git push

# 分支管理
git checkout -b feature-branch
git merge main
```

## 构建配置文件
- **Tauri配置**: `src-tauri/tauri.conf.json`
- **TypeScript配置**: `tsconfig.json`, `tsconfig.node.json`
- **Vite配置**: `vite.config.ts`
- **Cargo配置**: `src-tauri/Cargo.toml`