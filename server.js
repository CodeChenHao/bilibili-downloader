const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const iconv = require('iconv-lite');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const downloads = new Map();

function getDefaultDownloadPath() {
    // 使用项目目录下的downloads文件夹作为默认路径
    return path.join(__dirname, 'downloads');
}

app.get('/api/default-path', (req, res) => {
    res.json({ success: true, path: getDefaultDownloadPath() });
});

app.post('/api/open-folder', async (req, res) => {
    const { path: folderPath } = req.body;
    if (!folderPath) {
        return res.json({ success: false, error: '缺少路径参数' });
    }
    
    try {
        // 使用explorer打开目录
        exec(`explorer "${folderPath}"`, (error) => {
            if (error) {
                console.error('打开目录失败:', error);
            }
        });
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/download', async (req, res) => {
    const { url, savePath } = req.body;

    if (!url || !savePath) {
        return res.json({ success: false, error: '缺少必要参数' });
    }

    const downloadId = Date.now().toString();
    const downloadInfo = {
        id: downloadId,
        url,
        savePath,
        status: 'downloading',
        progress: 0,
        message: '开始下载...',
        process: null,
        startTime: Date.now(),
        fileName: null
    };

    downloads.set(downloadId, downloadInfo);

    try {
        const ytDlpPath = path.join(__dirname, 'yt-dlp.exe');
        const ffmpegPath = path.join(__dirname, 'ffmpeg', 'ffmpeg-master-latest-win64-gpl', 'bin', 'ffmpeg.exe');
        
        // 获取视频信息（UP主名称）
        let uploader = '未知UP主';
        try {
            const { stdout } = await execPromise(
                `"${ytDlpPath}" --print uploader "${url}" --no-playlist 2>nul`,
                { encoding: 'buffer', windowsHide: true }
            );
            // 使用iconv解码GBK编码的输出
            uploader = iconv.decode(stdout, 'gbk').trim() || '未知UP主';
        } catch (e) {
            console.log('获取UP主信息失败:', e.message);
        }
        
        // 清理UP主名称中的非法字符
        const safeUploader = uploader.replace(/[\\/:*?"<>|]/g, '_');
        
        // 创建UP主子目录
        let finalSavePath = path.join(savePath, safeUploader);
        try {
            if (!fs.existsSync(finalSavePath)) {
                fs.mkdirSync(finalSavePath, { recursive: true });
            }
        } catch (mkdirError) {
            console.log('创建UP主子目录失败，使用默认路径:', mkdirError.message);
            // 如果创建失败，直接使用原始保存路径
            finalSavePath = savePath;
        }
        
        // 确保保存路径存在
        try {
            if (!fs.existsSync(savePath)) {
                fs.mkdirSync(savePath, { recursive: true });
            }
        } catch (e) {
            console.log('创建保存路径失败:', e.message);
        }

        const args = [
            url,
            '-o', path.join(finalSavePath, '%(title)s.%(ext)s'),
            '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            '--ffmpeg-location', ffmpegPath,
            '--merge-output-format', 'mp4',
            '--newline',
            '--no-playlist',
            '--concurrent-fragments', '4',
            '--fragment-retries', '10'
        ];

        const downloadProcess = spawn(ytDlpPath, args, {
            env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
            windowsHide: true
        });

        downloadInfo.process = downloadProcess;
        downloadInfo.savePath = finalSavePath;

        downloadProcess.stdout.on('data', (data) => {
            const output = iconv.decode(data, 'gbk');
            parseProgress(output, downloadInfo);
        });

        downloadProcess.stderr.on('data', (data) => {
            const output = iconv.decode(data, 'gbk');
            parseProgress(output, downloadInfo);
        });

        downloadProcess.on('close', (code) => {
            if (code === 0) {
                downloadInfo.status = 'completed';
                downloadInfo.progress = 100;
                downloadInfo.message = '下载完成';
            } else {
                downloadInfo.status = 'error';
                downloadInfo.message = `下载失败，退出码: ${code}`;
            }
        });

        downloadProcess.on('error', (error) => {
            downloadInfo.status = 'error';
            downloadInfo.message = `进程错误: ${error.message}`;
        });

        res.json({ success: true, downloadId });
    } catch (error) {
        downloads.delete(downloadId);
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/download/:id/pause', (req, res) => {
    const { id } = req.params;
    const downloadInfo = downloads.get(id);

    if (!downloadInfo) {
        return res.json({ success: false, error: '下载任务不存在' });
    }

    if (downloadInfo.process) {
        downloadInfo.process.kill('SIGSTOP');
        downloadInfo.status = 'paused';
        downloadInfo.message = '已暂停';
        res.json({ success: true });
    } else {
        res.json({ success: false, error: '无法暂停' });
    }
});

app.post('/api/download/:id/resume', (req, res) => {
    const { id } = req.params;
    const downloadInfo = downloads.get(id);

    if (!downloadInfo) {
        return res.json({ success: false, error: '下载任务不存在' });
    }

    if (downloadInfo.process) {
        downloadInfo.process.kill('SIGCONT');
        downloadInfo.status = 'downloading';
        downloadInfo.message = '继续下载...';
        res.json({ success: true });
    } else {
        res.json({ success: false, error: '无法恢复' });
    }
});

app.get('/api/download/:id/status', (req, res) => {
    const { id } = req.params;
    const downloadInfo = downloads.get(id);

    if (!downloadInfo) {
        return res.json({ success: false, error: '下载任务不存在' });
    }

    res.json({
        success: true,
        status: downloadInfo.status,
        progress: downloadInfo.progress,
        message: downloadInfo.message
    });
});

app.get('/api/files', (req, res) => {
    const files = [];

    downloads.forEach((downloadInfo, id) => {
        const fileName = downloadInfo.fileName || 
                        downloadInfo.url.match(/video\/([^\/]+)/)?.[1] || 
                        `video_${id}`;
        files.push({
            id,
            name: fileName,
            path: downloadInfo.savePath,
            status: downloadInfo.status,
            progress: downloadInfo.progress || 0,
            speed: downloadInfo.speed || ''
        });
    });

    res.json({ success: true, files });
});

function parseProgress(output, downloadInfo) {
    const progressMatch = output.match(/(\d+\.?\d*)%/);
    if (progressMatch) {
        downloadInfo.progress = parseFloat(progressMatch[1]);
    }

    const speedMatch = output.match(/(\d+\.?\d*[KMG]?iB\/s)/);
    if (speedMatch) {
        downloadInfo.speed = speedMatch[1];
    }

    const downloadMatch = output.match(/(\d+\.?\d*[KMG]?iB)\/(\d+\.?\d*[KMG]?iB)/);
    if (downloadMatch) {
        downloadInfo.message = `已下载: ${downloadMatch[1]} / ${downloadMatch[2]}`;
    }

    if (speedMatch) {
        downloadInfo.message += ` 速度: ${speedMatch[1]}`;
    }

    const destinationMatch = output.match(/Destination:\s*(.+)/);
    if (destinationMatch) {
        const fullPath = destinationMatch[1].trim();
        downloadInfo.fileName = path.basename(fullPath);
    }

    const mergingMatch = output.match(/Merging formats into "(.+)"/);
    if (mergingMatch) {
        const fullPath = mergingMatch[1].trim();
        downloadInfo.fileName = path.basename(fullPath);
    }

    const deletingMatch = output.match(/Deleting original file (.+) \(/);
    if (deletingMatch && downloadInfo.fileName) {
    }
}

app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log('请确保已安装 yt-dlp 并添加到系统 PATH');
});