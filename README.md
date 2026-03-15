# Bilibili视频下载器

一个基于Node.js和yt-dlp的Bilibili视频下载工具，支持最高清晰度下载。

## 功能特性

- 支持Bilibili视频下载（最高清晰度）
- 实时下载进度显示
- 开始/暂停/恢复下载控制
- 下载文件列表展示
- 自动按UP主分类保存

## 安装步骤

### 1. 安装Node.js依赖

```bash
npm install
```

### 2. 安装yt-dlp

#### Windows系统：
```bash
# 使用pip安装
pip install yt-dlp

# 或者从GitHub下载最新版本
# https://github.com/yt-dlp/yt-dlp/releases
# 下载后将yt-dlp.exe放到系统PATH目录中
```

#### macOS/Linux系统：
```bash
# 使用pip安装
pip install yt-dlp

# 或者使用包管理器
# macOS (Homebrew)
brew install yt-dlp

# Linux (Ubuntu/Debian)
sudo apt install yt-dlp
```

### 3. 验证安装

```bash
yt-dlp --version
```

## 使用方法

### 1. 启动服务器

```bash
npm start
```

服务器将在 http://localhost:3000 启动

### 2. 打开浏览器

访问 http://localhost:3000

### 3. 下载视频

1. 在"视频地址"输入框中粘贴Bilibili视频链接
   - 例如：`https://www.bilibili.com/video/BV1E7wtzaEdq/`
2. 点击"开始下载"按钮
3. 等待下载完成

**注意**：视频将自动保存到项目目录下的 `downloads` 文件夹中，并按UP主名称自动分类

### 4. 控制下载

- **暂停下载**：点击"暂停下载"按钮暂停当前下载
- **恢复下载**：点击"恢复下载"按钮继续下载

## API接口

### 开始下载
```
POST /api/download
Content-Type: application/json

{
  "url": "视频地址"
}
```

### 暂停下载
```
POST /api/download/:id/pause
```

### 恢复下载
```
POST /api/download/:id/resume
```

### 获取下载状态
```
GET /api/download/:id/status
```

### 获取文件列表
```
GET /api/files
```

## 注意事项

1. 确保已正确安装yt-dlp并添加到系统PATH
2. 项目目录下的 `downloads` 文件夹需要有写入权限
3. 某些视频可能需要登录才能下载
4. 下载速度取决于网络连接和视频服务器
5. 建议使用最新版本的yt-dlp以获得最佳兼容性

## 故障排除

### yt-dlp命令未找到
- 确认yt-dlp已正确安装
- 检查是否已添加到系统PATH
- 尝试使用完整路径

### 下载失败
- 检查视频链接是否有效
- 确认网络连接正常
- 查看服务器控制台错误信息

### 无法暂停/恢复
- Windows系统可能不支持进程暂停功能
- 这是操作系统的限制，不影响下载功能

## 技术栈

- **前端**：HTML5, CSS3, JavaScript
- **后端**：Node.js, Express
- **下载器**：yt-dlp

## 许可证

MIT License