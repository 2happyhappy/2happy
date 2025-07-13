// ==UserScript==
// @name         video tool
// @namespace    http://tampermonkey.net/
// @version      11.0
// @description  独立悬浮播放器，支持播放控制、进度条、缩放、音量、下载等功能。
// @author       你的名字
// @match        *://*/*
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // 添加自定义样式
    GM_addStyle(`
        #media-player-container {
            position: fixed;
            left: 10px;
            right: 10px;
            bottom: 10px;
            background-color: rgba(0, 0, 0, 0.8);
            z-index: 10000;
            display: none;
            border-radius: 10px;
            overflow: hidden;
            resize: both;
        }
        #player-video {
            width: 100%;
            height: 100%;
            object-fit: contain;
            transition: transform 0.3s ease;
            transform-origin: center center;
        }

        #player-video.zoomed {
            object-fit: cover;
            transform-origin: center center;
        }
        #play-control-button {
            position: absolute;
            bottom: 5px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(0, 0, 0, 0.5);
            color: white;
            border: none;
            padding: 0;
            border-radius: 5px;
            cursor: pointer;
            font-size: 12px;
            z-index: 10003;
            display: flex;
            justify-content: space-between;
            width: 280px;
            height: 40px;
        }
        #play-control-button > div {
            width: 14.28%;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: none !important;
        }

        #control-button-group {
            position: absolute;
            top: 5px;
            left: 0px;
            background-color: rgba(0, 0, 0, 0.5);
            color: white;
            border: none;
            padding: 0;
            border-radius: 5px;
            cursor: pointer;
            font-size: 12px;
            z-index: 10003;
            display: flex;
            justify-content: space-between;
            width: 120px;
            height: 40px;
        }
        #control-button-group > div {
            width: 33.33%;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: none !important;
        }

        #speed-control-menu {
            position: absolute;
            bottom: 45px;
            right: 64px;
            background-color: rgba(0, 0, 0, 0.5);
            border-radius: 5px;
            padding: 5px;
            display: none;
            flex-direction: column;
            z-index: 10004;
            width: 40px;
            max-height: 120px;
            overflow-y: auto;
        }
        .speed-option {
            color: white;
            padding: 5px 10px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 20px;
        }
        .controls-visible { opacity: 1; pointer-events: auto; }
        .controls-hidden { opacity: 0; pointer-events: none; }
        #detect-media-button {
            position: fixed;
            left: 20px;
            top: 70%;
            transform: translateY(-50%);
            z-index: 10001;
            background-color: #00aaff;
            color: white;
            border: none;
            padding: 10px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 15px;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        }

        #detect-media-button:active {
            transform: translateY(-50%) scale(0.95);
        }
        #detect-media-popup {
            position: fixed;
            left: 20px;
            bottom: calc(20% + 110px); /* 在检测按钮上方弹出 */
            transform: translateY(0);
            z-index: 10002;
            background-color: rgba(0, 0, 0, 0.8);
            color: white;
            border-radius: 5px;
            padding: 5px;
            display: none;
            flex-direction: column;
            gap: 5px;
            min-width: 80px;
        }

        #detect-media-popup > div {
            padding: 3px 6px;
            cursor: pointer;
            border-radius: 5px;
            background-color: rgba(255, 255, 255, 0.1);
            font-size: 13px;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        #detect-media-popup > div:hover {
            background-color: rgba(255, 255, 255, 0.2);
            transform: scale(1.05);
        }

        #detect-media-popup > div:active {
            transform: scale(0.95);
        }
        /* 进度条样式修正 */
        #simple-progress {
            position: absolute;
            bottom: 65px;
            left: 10px;
            right: 10px;
            height: 4px;
            background: rgba(255, 255, 255, 0.3);
            cursor: pointer;
            z-index: 10003;
            touch-action: none;  /* 禁用浏览器默认触摸行为 */
        -webkit-tap-highlight-color: transparent; /* 移除点击高亮 */
        user-select: none;   /* 防止文字选中 */
        }
        /* 时间显示居中 */
        #time-display {
            position: absolute;
            bottom: 45px;
            left: 50%;
            transform: translateX(-50%);
            color: white;
            font-size: 12px;
            white-space: nowrap;
            z-index: 10003;
        }

        /* 竖屏模式适配 */
        .portrait-mode {
            transform: rotate(90deg);
            transform-origin: center center;
        }

        /* 竖屏模式优化 */
        [aspect-ratio="9/16"] {
            transform: rotate(90deg) scale(1.75);
            transform-origin: center center;
        }
    `);

    // 创建播放器容器
    const mediaPlayer = document.createElement('div');
    mediaPlayer.id = 'media-player-container';
    document.body.appendChild(mediaPlayer);

    // 视频元素
    const playerVideo = document.createElement('video');
    playerVideo.id = 'player-video';
    playerVideo.controls = false;
    mediaPlayer.appendChild(playerVideo);

    // 统一状态管理
    let videoState = {
        isMirrored: false,
        currentScale: 1,
        isZoomed: false,
        isSeeking: false, // 新增 seeking 状态
        isPlaying: false, // 新增播放状态
        isDetectionVisible: true, // 新增检测按钮可见状态
        screenOrientation: 'landscape', // 合并方向状态
    };

    // 状态变量
    let screenOrientation = 'landscape'; // landscape/portrait
    let isFullscreen = false; // 新增全屏状态
    let windowStates = [
        { width: '328px', height: '185px', desc: '默认尺寸' },  // 状态0
        { width: '328px', height: '583px', desc: '竖版尺寸' },  // 状态1
    ];
    let currentWindowState = 0;
    let isDragging = false;
    let wasPlaying = false;

    // 添加全屏状态管理
    let originalDimensions = {
        width: '',
        height: ''
    };

    // 统一更新变换
function updateVideoTransform() {
    const transforms = [];
    // 方向变换（旋转 + 缩放适配）
    if (videoState.screenOrientation === 'portrait') {
        transforms.push('rotate(90deg) scale(1.78)');
    }
    // 缩放
    if (videoState.currentScale !== 1) {
        transforms.push(`scale(${videoState.currentScale})`);
    }
    // 镜像
    if (videoState.isMirrored) {
        transforms.push('scaleX(-1)');
    }
    playerVideo.style.transform = transforms.join(' ') || 'none';
}

    // 窗口尺寸监听（修复缩放动态调整）
    new ResizeObserver(() => {
        if (videoState.isZoomed && !playerVideo.classList.contains('zoomed')) {
            videoState.currentScale = Math.max(
                mediaPlayer.clientWidth / playerVideo.videoWidth,
                mediaPlayer.clientHeight / playerVideo.videoHeight
            );
            updateVideoTransform();
        }
    }).observe(mediaPlayer);

    // 播放控制按钮组
    const playControlButton = document.createElement('div');
    playControlButton.id = 'play-control-button';
    ['缩', '方', '10s', '播停', '10s', '速', '全'].forEach(text => { // 新增方/全按钮
        const btn = document.createElement('div');
        btn.innerText = text;
        playControlButton.appendChild(btn);
    });
    mediaPlayer.appendChild(playControlButton);

    // 按钮功能绑定
    playControlButton.children[0].addEventListener('click', toggleScale); // 缩
    playControlButton.children[1].addEventListener('click', toggleOrientation);
    playControlButton.children[2].addEventListener('click', () => playerVideo.currentTime -= 10); // -10s
    playControlButton.children[3].addEventListener('click', togglePlay);    // 播放/暂停
    playControlButton.children[4].addEventListener('click', () => playerVideo.currentTime += 10); // +10s
    playControlButton.children[5].addEventListener('click', toggleSpeedMenu); // 速度
    playControlButton.children[6].addEventListener('click', toggleFullscreen);

    // 缩放功能（调整使用videoState）
    function toggleScale() {
        const containerWidth = mediaPlayer.clientWidth;
        const containerHeight = mediaPlayer.clientHeight;
        const videoWidth = playerVideo.videoWidth;
        const videoHeight = playerVideo.videoHeight;

        if (!videoState.isZoomed) {
            const containerRatio = containerWidth / containerHeight;
            const videoRatio = videoWidth / videoHeight;
            if (Math.abs(containerRatio - videoRatio) > 0.01) {
                playerVideo.classList.add('zoomed');
            } else {
                videoState.currentScale = Math.max(
                    containerWidth / videoWidth,
                    containerHeight / videoHeight
                );
                updateVideoTransform();
            }
        } else {
            playerVideo.classList.remove('zoomed');
            videoState.currentScale = 1;
            updateVideoTransform();
        }
        videoState.isZoomed = !videoState.isZoomed;
    }

    // 修正后的播放控制逻辑
    function togglePlay() {
        if (playerVideo.paused) {
            playerVideo.play();
            ControlsManager.scheduleHide();
        } else {
            playerVideo.pause();
            ControlsManager.cancelHide();
            ControlsManager.show();
        }
        updatePlayButton();
    }

    // ==== 修改4：增强控件显示控制 ====
function showControls() {
    const controls = mediaPlayer.querySelectorAll(
        '#play-control-button, #control-button-group, #simple-progress,  #time-container'
    );
    controls.forEach(control => {
        control.classList.remove('controls-hidden');
        control.style.pointerEvents = 'auto';
    });
}

function hideControls() {
    if (!videoState.isPlaying) return; // 暂停状态不隐藏

    const controls = mediaPlayer.querySelectorAll(
        '#play-control-button, #control-button-group, #simple-progress,  #time-container'
    );
    controls.forEach(control => {
        control.classList.add('controls-hidden');
        control.style.pointerEvents = 'none';
    });
}

    // 新增控件管理模块
    const ControlsManager = (() => {
        let hideTimer;
        const controls = [
            '#play-control-button',
            '#control-button-group',
            '#simple-progress',
            '#time-display'
        ];

        return {
            init() {
                // 初始化事件监听
                mediaPlayer.addEventListener('mousemove', () => this.reset());
                mediaPlayer.addEventListener('mouseleave', () => this.scheduleHide());
                playerVideo.addEventListener('play', () => this.scheduleHide());
                playerVideo.addEventListener('pause', () => this.cancelHide());
            },

            show() {
                controls.forEach(selector => {
                    const el = document.querySelector(selector);
                    el?.classList.remove('controls-hidden');
                    el.style.pointerEvents = 'auto';
                });
            },

            hide() {
                if(playerVideo.paused) return;
                controls.forEach(selector => {
                    const el = document.querySelector(selector);
                    el?.classList.add('controls-hidden');
                    el.style.pointerEvents = 'none';
                });
            },

            scheduleHide(delay = 3000) {
                this.cancelHide();
                hideTimer = setTimeout(() => this.hide(), delay);
            },

            cancelHide() {
                clearTimeout(hideTimer);
            },

            reset() {
                this.show();
                this.scheduleHide();
            }
        };
    })();

    // 初始化调用
    ControlsManager.init();

    // 速度控制菜单（扩展至10种）
    const speedOptions = [0.1, 0.25, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4]; // 10种速度

    const speedControlMenu = document.createElement('div');
    speedControlMenu.id = 'speed-control-menu';
    speedOptions.forEach(speed => {
        const option = document.createElement('div');
        option.className = 'speed-option';
        option.innerText = `${speed}x`;
        option.addEventListener('click', () => {
            playerVideo.playbackRate = speed;
            speedControlMenu.style.display = 'none';
        });
        speedControlMenu.appendChild(option);
    });
    mediaPlayer.appendChild(speedControlMenu);

    // 显示/隐藏速度菜单
    function toggleSpeedMenu() {
        speedControlMenu.style.display = speedControlMenu.style.display === 'flex' ? 'none' : 'flex';
        resetMenuTimeout();
    }

    // 增强全屏函数
    function toggleFullscreen() {
        if (!isFullscreen) {
            originalDimensions = {
                width: mediaPlayer.style.width,
                height: mediaPlayer.style.height,
                aspectRatio: mediaPlayer.style.aspectRatio
            };

            mediaPlayer.requestFullscreen().then(() => {
                isFullscreen = true;
                mediaPlayer.style.width = '100%';
                mediaPlayer.style.height = '100%';
                applyOrientation(); // 应用当前方向设置
            });
        } else {
            document.exitFullscreen();
        }
    }

    // 增强全屏状态监听
    document.addEventListener('fullscreenchange', () => {
        isFullscreen = !!document.fullscreenElement;
        if (!isFullscreen) {
            mediaPlayer.style.width = originalDimensions.width;
            mediaPlayer.style.height = originalDimensions.height;
            mediaPlayer.style.aspectRatio = originalDimensions.aspectRatio;
            playerVideo.style.transform = 'none'; // 退出时重置方向
        }
    });

    // 更新全屏按钮状态
    function updateFullscreenButton() {
        const fullscreenBtn = playControlButton.children[6]; // 定位到新位置
        fullscreenBtn.innerText = isFullscreen ? '退出' : '全';
        fullscreenBtn.title = isFullscreen ? '退出全屏 (Esc)' : '进入全屏';
    }

    // 创建进度条（增加防抖处理）
    const simpleProgress = document.createElement('input');
    simpleProgress.id = 'simple-progress';
    simpleProgress.type = 'range';
    simpleProgress.min = 0;
    simpleProgress.value = 0;
    simpleProgress.step = 0.0001;
    mediaPlayer.appendChild(simpleProgress);

    // 修改1：添加触摸事件监听
simpleProgress.addEventListener('touchstart', handleDragStart);
simpleProgress.addEventListener('touchmove', handleDragMove);
simpleProgress.addEventListener('touchend', handleDragEnd);

    // 修改2：统一事件处理函数
function handleDragStart(e) {
    e.preventDefault();
    wasPlaying = !playerVideo.paused;
    playerVideo.pause();
    isDragging = true;

    // 移动端首次点击需要手动设置进度
    const rect = simpleProgress.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const percent = (clientX - rect.left) / rect.width;
    playerVideo.currentTime = percent * playerVideo.duration;
}

function handleDragMove(e) {
    if (!isDragging) return;
    e.preventDefault();

    const rect = simpleProgress.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const percent = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);

    playerVideo.currentTime = percent * playerVideo.duration;
    timeDisplay.textContent = `${formatTime(playerVideo.currentTime)} / ${formatTime(playerVideo.duration)}`;
}

function handleDragEnd() {
    isDragging = false;
    if (wasPlaying) playerVideo.play();
}

// 修改3：更新原有鼠标事件绑定
simpleProgress.addEventListener('mousedown', handleDragStart);
document.addEventListener('mousemove', handleDragMove);
document.addEventListener('mouseup', handleDragEnd);


    // 拖拽开始
    simpleProgress.addEventListener('mousedown', () => {
        wasPlaying = !playerVideo.paused;
        playerVideo.pause();
        isDragging = true;
    });

    // 拖拽中（使用requestAnimationFrame优化）
    simpleProgress.addEventListener('input', () => {
        if (!isDragging) return;
        const newTime = simpleProgress.value * playerVideo.duration;
        playerVideo.currentTime = newTime;
        timeDisplay.textContent = `${formatTime(newTime)} / ${formatTime(playerVideo.duration)}`;  // 实时更新
    });

    // 拖拽结束
    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        if (wasPlaying) playerVideo.play();  // 恢复原状态
    });



    // 进度同步（增加拖拽状态判断）
    playerVideo.addEventListener('timeupdate', () => {
        if (!isDragging) {
            simpleProgress.value = playerVideo.currentTime / playerVideo.duration;
            currentTime.textContent = formatTime(playerVideo.currentTime);
            totalTime.textContent = formatTime(playerVideo.duration);
        }
    });

    // 元数据加载（修复初始化逻辑）
    playerVideo.addEventListener('loadedmetadata', () => {
        simpleProgress.max = 1;  // 改为相对值
        simpleProgress.value = 0;
    });

    // 新增：防止NaN值
    playerVideo.addEventListener('durationchange', () => {
        if (playerVideo.duration === Infinity || isNaN(playerVideo.duration)) {
            simpleProgress.disabled = true;
        } else {
            simpleProgress.disabled = false;
        }
    });

    // 时间显示初始化
    const timeDisplay = document.createElement('div');
    timeDisplay.id = 'time-display';
    mediaPlayer.appendChild(timeDisplay);

    // 时间更新处理
    playerVideo.addEventListener('timeupdate', () => {
        timeDisplay.textContent = `${formatTime(playerVideo.currentTime)} / ${formatTime(playerVideo.duration)}`;
    });

    // ==== 检测媒体视频状态同步逻辑 ====
playerVideo.addEventListener('play', () => {
    // 播放时隐藏检测控件
    videoState.isDetectionVisible = false;
    detectMediaButton.style.display = 'none';
    detectMediaPopup.style.display = 'none';
});

playerVideo.addEventListener('pause', () => {
    // 暂停时显示检测控件
    videoState.isDetectionVisible = true;
    detectMediaButton.style.display = 'block';
});

playerVideo.addEventListener('ended', () => {
    // 结束时显示检测控件
    videoState.isDetectionVisible = true;
    detectMediaButton.style.display = 'block';
    detectMediaPopup.style.display = 'none'; // 保持菜单隐藏
});

    // 创建关闭、切换、缩按钮组
    const controlButtonGroup = document.createElement('div');
    controlButtonGroup.id = 'control-button-group';
    ['关', '切', '镜'].forEach(text => {
        const btn = document.createElement('div');
        btn.innerText = text;
        controlButtonGroup.appendChild(btn);
    });
    mediaPlayer.appendChild(controlButtonGroup);

    // 按钮功能绑定
    controlButtonGroup.children[0].addEventListener('click', closePlayer); // 关闭
    controlButtonGroup.children[1].addEventListener('click', toggleResize); // 切换
    controlButtonGroup.children[2].addEventListener('click', toggleMirror);  // 镜像

    // 新增方向切换函数
    function toggleOrientation() {
    videoState.screenOrientation =
        videoState.screenOrientation === 'landscape' ? 'portrait' : 'landscape';
    mediaPlayer.style.aspectRatio =
        videoState.screenOrientation === 'portrait' ? '9/16' : '16/9';
    updateVideoTransform(); // 触发统一变换
}

    // 应用方向样式
    function applyOrientation() {
        if (screenOrientation === 'portrait') {
            playerVideo.style.transform = 'rotate(90deg) scale(1.78)';
            mediaPlayer.style.aspectRatio = '9/16';
        } else {
            playerVideo.style.transform = 'none';
            mediaPlayer.style.aspectRatio = '16/9';
        }
    }

    // 关闭功能（增强版）
    let originalVideo = null;
    function closePlayer() {
        // 新增：退出全屏状态
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }

        // 原有关闭逻辑
        if (playerVideo.src && originalVideo) {
            originalVideo.pause();
        }
        mediaPlayer.style.display = 'none';
        playerVideo.pause();
        playerVideo.src = '';
        detectMediaButton.style.display = 'block';

        // 新增：恢复页面滚动
        document.documentElement.style.overflow = '';
    }

    // 切换窗口尺寸函数（增强版）
    function toggleResize() {
        if (isFullscreen) {
            // 全屏模式优先退出
            document.exitFullscreen().then(() => {
                // 退出后自动切换到下一个状态
                currentWindowState = (currentWindowState + 1) % windowStates.length;
                applyWindowState();
            });
        } else {
            // 正常循环切换
            currentWindowState = (currentWindowState + 1) % windowStates.length;
            applyWindowState();
        }
    }

    // 应用窗口状态
    function applyWindowState() {
        const state = windowStates[currentWindowState];
        mediaPlayer.style.width = state.width;
        mediaPlayer.style.height = state.height;
        console.log(`切换到状态: ${state.desc}`);
    }

        // 镜像功能（调整使用videoState）
    function toggleMirror() {
        videoState.isMirrored = !videoState.isMirrored;
        updateVideoTransform();
    }

    // 检测媒体功能
    const detectMediaButton = document.createElement('button');
    detectMediaButton.id = 'detect-media-button';
    detectMediaButton.innerText = '检';
    detectMediaButton.style.display = 'none'; // 初始隐藏
    document.body.appendChild(detectMediaButton);
    const detectMediaPopup = document.createElement('div');
    detectMediaPopup.id = 'detect-media-popup';
    const windowPlayOption = document.createElement('div');
    windowPlayOption.innerText = '窗口模式';
    detectMediaPopup.appendChild(windowPlayOption);
    document.body.appendChild(detectMediaPopup);
    const detectMedia = () => {
    const videos = document.querySelectorAll('video');
    let targetVideo = null;

    for (const video of videos) {
        // 检测M3U8格式 (修正后的条件判断)
        if (video.src && (
            video.src.endsWith('.m3u8') ||
            video.querySelector('source[src$=".m3u8"]') !== null
        )) {
            targetVideo = video;
            break;
        }

        // 原有检测逻辑
        if (!video.paused && !targetVideo) {
            targetVideo = video;
        }
    }
    return targetVideo || videos[0] || null;
};

    document.addEventListener('play', () => {
        detectMediaButton.style.display = 'block';
    }, true);

    // ==== 修改6：添加页面视频检测逻辑 ====
document.addEventListener('play', (e) => {
    // 当页面有视频播放时显示检测按钮
    if (e.target.tagName === 'VIDEO' && !e.target.isSameNode(playerVideo)) {
        videoState.isDetectionVisible = true;
        detectMediaButton.style.display = 'block';
    }
}, true);

    // ==== 修改4：增强检测按钮点击逻辑 ====
detectMediaButton.addEventListener('click', () => {
    if (!videoState.isDetectionVisible) return; // 状态不可见时阻止点击

    detectMediaPopup.style.display =
        detectMediaPopup.style.display === 'flex' ? 'none' : 'flex';
});
    windowPlayOption.addEventListener('click', () => {
        const media = detectMedia();
        if (media) {
            originalVideo = media;
            const source = media.src ||
                         media.querySelector('source')?.src; // 统一处理所有视频源

            playerVideo.src = source; // 直接设置视频源
        playerVideo.currentTime = media.currentTime;
        media.pause();
        mediaPlayer.style.display = 'block';
        showControls();
        playerVideo.play();
        playControlButton.children[3].innerText = '播停';
        videoState.isDetectionVisible = false;
        detectMediaButton.style.display = 'none';
        detectMediaPopup.style.display = 'none';
    }
});

    // 视频结束自动隐藏
    playerVideo.addEventListener('ended', () => {
        mediaPlayer.style.display = 'none';
        playerVideo.src = '';
        detectMediaButton.style.display = 'block';
    });

    // 格式化时间显示
    function formatTime(seconds) {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }
})();