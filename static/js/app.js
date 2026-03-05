// 血染钟楼说书人系统 - 前端JavaScript

// ===== 全局状态 =====
let gameState = {
    gameId: null,
    scriptId: null,
    playerCount: 8,
    players: [],
    currentPhase: 'setup',
    dayNumber: 0,
    nightNumber: 0,
    nominations: [],
    nightOrder: [],
    currentNightIndex: 0
};

let scripts = [];
let roleDistribution = {};

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    await loadScripts();
    setupEventListeners();
    updatePlayerInputs();
    updateRoleDistribution();
    setupTableSizeOptimizer();
}

// ===== API 调用 =====
async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    const response = await fetch(endpoint, options);
    return response.json();
}

// ===== 加载剧本 =====
async function loadScripts() {
    scripts = await apiCall('/api/scripts');
    renderScriptGrid();
}

function renderScriptGrid() {
    const grid = document.getElementById('scriptGrid');
    grid.innerHTML = scripts.map(script => `
        <div class="script-card" data-script-id="${script.id}" onclick="selectScript('${script.id}')">
            <div class="script-name-zh">${script.name}</div>
            <div class="script-name-en">${script.name_en}</div>
            <div class="script-desc">${script.description}</div>
        </div>
    `).join('');
    
    // 默认选中第一个
    if (scripts.length > 0) {
        selectScript(scripts[0].id);
    }
}

function selectScript(scriptId) {
    gameState.scriptId = scriptId;
    
    // 更新UI
    document.querySelectorAll('.script-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.querySelector(`[data-script-id="${scriptId}"]`).classList.add('selected');
}

// ===== 玩家数量 =====
function setupEventListeners() {
    // 玩家数量滑块
    const playerSlider = document.getElementById('playerCount');
    playerSlider.addEventListener('input', (e) => {
        gameState.playerCount = parseInt(e.target.value);
        document.getElementById('playerCountValue').textContent = gameState.playerCount;
        updatePlayerInputs();
        updateRoleDistribution();
    });
    
    // 随机分配按钮
    document.getElementById('randomAssignBtn').addEventListener('click', handleRandomAssign);
    
    // 手动分配按钮
    document.getElementById('manualAssignBtn').addEventListener('click', openManualAssignModal);
    
    // 确认手动分配
    document.getElementById('confirmManualAssign').addEventListener('click', handleManualAssign);
    
    // 开始夜晚
    document.getElementById('startNightBtn').addEventListener('click', startNight);
    
    // 开始白天
    document.getElementById('startDayBtn').addEventListener('click', startDay);
    
    // 提名
    document.getElementById('nominateBtn').addEventListener('click', handleNominate);
    
    // 处决
    document.getElementById('executeBtn').addEventListener('click', handleExecute);
}

function updatePlayerInputs() {
    const grid = document.getElementById('playerInputGrid');
    grid.innerHTML = '';
    
    for (let i = 1; i <= gameState.playerCount; i++) {
        const existingName = gameState.players[i - 1]?.name || '';
        grid.innerHTML += `
            <div class="player-input-item">
                <label>座位 ${i}</label>
                <input type="text" id="playerName${i}" placeholder="玩家${i}" value="${existingName}">
            </div>
        `;
    }
}

async function updateRoleDistribution() {
    const dist = await apiCall(`/api/role_distribution/${gameState.playerCount}`);
    roleDistribution = dist;
    
    const container = document.getElementById('roleDistribution');
    container.innerHTML = `
        <div class="role-dist-item townsfolk">
            <div class="role-dist-count">${dist.townsfolk}</div>
            <div class="role-dist-label">镇民</div>
        </div>
        <div class="role-dist-item outsider">
            <div class="role-dist-count">${dist.outsider}</div>
            <div class="role-dist-label">外来者</div>
        </div>
        <div class="role-dist-item minion">
            <div class="role-dist-count">${dist.minion}</div>
            <div class="role-dist-label">爪牙</div>
        </div>
        <div class="role-dist-item demon">
            <div class="role-dist-count">${dist.demon}</div>
            <div class="role-dist-label">恶魔</div>
        </div>
    `;
}

// ===== 工具函数 =====
// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 优化圆桌尺寸，最大化利用空间
function optimizeTableSize() {
    const tableSection = document.querySelector('.table-section');
    const tableContainer = document.querySelector('.table-container');
    
    if (!tableSection || !tableContainer) return;
    
    // 获取实际可用尺寸（考虑 padding）
    const sectionRect = tableSection.getBoundingClientRect();
    const sectionStyle = window.getComputedStyle(tableSection);
    
    // 获取 padding（可能是不同方向不同的值）
    const paddingTop = parseFloat(sectionStyle.paddingTop) || 0;
    const paddingBottom = parseFloat(sectionStyle.paddingBottom) || 0;
    const paddingLeft = parseFloat(sectionStyle.paddingLeft) || 0;
    const paddingRight = parseFloat(sectionStyle.paddingRight) || 0;
    
    const availableWidth = sectionRect.width - paddingLeft - paddingRight;
    const availableHeight = sectionRect.height - paddingTop - paddingBottom;
    
    // 计算短边长度
    const shortSide = Math.min(availableWidth, availableHeight);
    
    // table-container 的尺寸直接等于 table-section 的短边长度（不做任何限制）
    // 应用尺寸
    tableContainer.style.width = `${shortSide}px`;
    tableContainer.style.height = `${shortSide}px`;
    
    // 如果玩家圆桌已渲染，只更新座位位置，不重新渲染整个圆桌
    // 这样可以避免循环调用和重复初始化
    if (gameState.players.length > 0 && document.getElementById('playerCircle')) {
        // 只更新座位位置，不重新创建 DOM
        updateSeatPositions();
    }
}

// 设置圆桌尺寸优化器
function setupTableSizeOptimizer() {
    const tableSection = document.querySelector('.table-section');
    if (!tableSection) return;
    
    // 防抖版本的优化函数
    const debouncedOptimize = debounce(optimizeTableSize, 100);
    
    // 使用 ResizeObserver 监听容器尺寸变化
    if (window.ResizeObserver) {
        const resizeObserver = new ResizeObserver(debouncedOptimize);
        resizeObserver.observe(tableSection);
        
        // 也监听 window resize（作为备用）
        window.addEventListener('resize', debouncedOptimize);
    } else {
        // 降级方案：只使用 window resize
        window.addEventListener('resize', debouncedOptimize);
    }
    
    // 初始计算
    setTimeout(optimizeTableSize, 100);
}

// ===== 角色分配 =====
function getPlayerNames() {
    const names = [];
    for (let i = 1; i <= gameState.playerCount; i++) {
        const input = document.getElementById(`playerName${i}`);
        names.push(input.value.trim() || `玩家${i}`);
    }
    return names;
}

async function handleRandomAssign() {
    if (!gameState.scriptId) {
        alert('请先选择剧本');
        return;
    }
    
    const playerNames = getPlayerNames();
    
    // 创建游戏
    const createResult = await apiCall('/api/game/create', 'POST', {
        script_id: gameState.scriptId,
        player_count: gameState.playerCount
    });
    
    if (!createResult.success) {
        alert(createResult.error || '创建游戏失败');
        return;
    }
    
    gameState.gameId = createResult.game_id;
    
    // 随机分配角色
    const assignResult = await apiCall(`/api/game/${gameState.gameId}/assign_random`, 'POST', {
        player_names: playerNames
    });
    
    if (!assignResult.success) {
        alert(assignResult.error || '分配角色失败');
        return;
    }
    
    gameState.players = assignResult.players;
    startGame();
}

async function openManualAssignModal() {
    if (!gameState.scriptId) {
        alert('请先选择剧本');
        return;
    }
    
    const playerNames = getPlayerNames();
    
    // 创建游戏获取角色列表
    const createResult = await apiCall('/api/game/create', 'POST', {
        script_id: gameState.scriptId,
        player_count: gameState.playerCount
    });
    
    if (!createResult.success) {
        alert(createResult.error || '创建游戏失败');
        return;
    }
    
    gameState.gameId = createResult.game_id;
    
    // 获取可用角色
    const roles = await apiCall(`/api/game/${gameState.gameId}/roles`);
    
    // 生成手动分配表格
    const grid = document.getElementById('manualAssignGrid');
    grid.innerHTML = playerNames.map((name, index) => `
        <div class="manual-assign-row">
            <div class="assign-seat-num">${index + 1}</div>
            <div class="assign-player-name">${name}</div>
            <select class="role-select" id="roleSelect${index}">
                <option value="">-- 选择角色 --</option>
                <optgroup label="镇民">
                    ${roles.townsfolk.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
                </optgroup>
                <optgroup label="外来者">
                    ${roles.outsider.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
                </optgroup>
                <optgroup label="爪牙">
                    ${roles.minion.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
                </optgroup>
                <optgroup label="恶魔">
                    ${roles.demon.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
                </optgroup>
            </select>
        </div>
    `).join('');
    
    showModal('manualAssignModal');
}

async function handleManualAssign() {
    const playerNames = getPlayerNames();
    const assignments = [];
    
    for (let i = 0; i < gameState.playerCount; i++) {
        const roleSelect = document.getElementById(`roleSelect${i}`);
        assignments.push({
            name: playerNames[i],
            role_id: roleSelect.value || null
        });
    }
    
    const result = await apiCall(`/api/game/${gameState.gameId}/assign_manual`, 'POST', {
        assignments
    });
    
    if (!result.success) {
        alert(result.error || '分配角色失败');
        return;
    }
    
    gameState.players = result.players;
    closeModal('manualAssignModal');
    startGame();
}

// ===== 游戏开始 =====
async function startGame() {
    // 隐藏设置面板，显示游戏面板
    document.getElementById('setupPanel').style.display = 'none';
    document.getElementById('gamePanel').style.display = 'block';
    document.getElementById('gameInfo').style.display = 'flex';
    
    // 更新游戏信息
    const script = scripts.find(s => s.id === gameState.scriptId);
    document.getElementById('currentScript').textContent = script.name;
    
    // 获取并显示游戏代码
    await showGameCode();
    
    // 优化圆桌尺寸（游戏面板显示后）
    setTimeout(() => {
        optimizeTableSize();
    }, 100);
    updatePhaseIndicator('setup');
    
    // 渲染玩家座位
    renderPlayerCircle();
    
    // 更新选择框
    updatePlayerSelects();
    
    // 添加日志
    addLogEntry('游戏开始', 'phase');
    
    // 更新日期: 2026-01-05 - 延迟检查占卜师，确保 DOM 和游戏面板已完全加载
    // 检查是否有占卜师，如果有则提示设置红鲱鱼
    setTimeout(() => {
        checkFortuneTellerSetup();
    }, 300);
}

// 更新日期: 2026-01-12 - 显示游戏代码供玩家加入
async function showGameCode() {
    if (!gameState.gameId) return;
    
    const result = await apiCall(`/api/game/${gameState.gameId}/code`);
    if (result.error) return;
    
    // 创建游戏代码显示区域
    let codePanel = document.getElementById('gameCodePanel');
    if (!codePanel) {
        codePanel = document.createElement('div');
        codePanel.id = 'gameCodePanel';
        codePanel.className = 'control-card';
        codePanel.innerHTML = `
            <h3>🔗 玩家加入</h3>
            <div style="background: rgba(0,0,0,0.4); padding: 1rem; border-radius: var(--radius-md); text-align: center;">
                <p style="color: var(--text-muted); margin-bottom: 0.5rem;">游戏代码</p>
                <div style="font-size: 1.8rem; font-family: 'Courier New', monospace; color: var(--color-gold); letter-spacing: 0.3rem; margin-bottom: 0.5rem;" id="gameCodeDisplay"></div>
                <p style="font-size: 0.85rem; color: var(--text-muted);">或完整ID: <span id="fullGameIdDisplay" style="color: var(--text-secondary);"></span></p>
                <div style="margin-top: 1rem;">
                    <button class="btn btn-secondary" onclick="copyGameCode()" style="font-size: 0.85rem;">
                        📋 复制代码
                    </button>
                    <a href="/player" target="_blank" class="btn btn-secondary" style="font-size: 0.85rem; margin-left: 0.5rem;">
                        👤 打开玩家端
                    </a>
                </div>
            </div>
        `;
        // 插入到控制面板的最前面
        const controlSection = document.querySelector('.control-section');
        if (controlSection) {
            controlSection.insertBefore(codePanel, controlSection.firstChild);
        }
    }
    
    document.getElementById('gameCodeDisplay').textContent = result.short_code;
    document.getElementById('fullGameIdDisplay').textContent = result.game_id;
}

function copyGameCode() {
    const code = document.getElementById('gameCodeDisplay')?.textContent;
    if (code) {
        navigator.clipboard.writeText(code).then(() => {
            showToast('游戏代码已复制');
        }).catch(() => {
            // 降级方案
            const fullId = document.getElementById('fullGameIdDisplay')?.textContent;
            navigator.clipboard.writeText(fullId || code);
            showToast('游戏ID已复制');
        });
    }
}

function showToast(message) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 2rem;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(39, 174, 96, 0.9);
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 2rem;
            font-size: 0.9rem;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.style.opacity = '1';
    
    setTimeout(() => {
        toast.style.opacity = '0';
    }, 2000);
}

// 更新日期: 2026-01-02 - 修复占卜师红鲱鱼弹窗未显示问题
// 检查占卜师红鲱鱼设置
async function checkFortuneTellerSetup() {
    const fortuneTeller = gameState.players.find(p => p.role && p.role.id === 'fortune_teller');
    console.log('检查占卜师:', fortuneTeller); // 调试日志
    if (fortuneTeller) {
        // 显示红鲱鱼设置弹窗
        console.log('显示红鲱鱼设置弹窗');
        showRedHerringModal();
    }
}

function showRedHerringModal() {
    let modal = document.getElementById('redHerringModal');
    if (!modal) {
        // 创建弹窗
        createRedHerringModal();
        modal = document.getElementById('redHerringModal');
    }
    
    if (modal) {
        updateRedHerringOptions();
        modal.classList.add('active');
        console.log('红鲱鱼弹窗已激活');
    } else {
        console.error('无法创建红鲱鱼弹窗');
    }
}

function createRedHerringModal() {
    // 检查是否已存在
    if (document.getElementById('redHerringModal')) {
        return;
    }
    
    const modalHtml = `
        <div class="modal" id="redHerringModal">
            <div class="modal-content">
                <h3>🔮 设置占卜师的红鲱鱼</h3>
                <p>请选择一名善良玩家作为红鲱鱼（占卜师会把该玩家误认为恶魔）</p>
                <p style="font-size: 0.85rem; color: var(--text-muted);">提示：后端已随机预选了一名红鲱鱼，您可以确认或重新选择</p>
                <div class="form-group">
                    <select id="redHerringSelect" class="form-select">
                        <option value="">-- 选择玩家 --</option>
                    </select>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-primary" onclick="confirmRedHerring()">确认选择</button>
                    <button class="btn btn-secondary" onclick="skipRedHerring()">使用随机</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function updateRedHerringOptions() {
    const select = document.getElementById('redHerringSelect');
    const goodPlayers = gameState.players.filter(p => 
        (p.role_type === 'townsfolk' || p.role_type === 'outsider') && 
        p.role && p.role.id !== 'fortune_teller'
    );
    
    // 检查后端是否已预选红鲱鱼
    const fortuneTeller = gameState.players.find(p => p.role && p.role.id === 'fortune_teller');
    const preselectedId = fortuneTeller?.red_herring_id;
    
    select.innerHTML = '<option value="">-- 选择玩家 --</option>' + 
        goodPlayers.map(p => {
            const isPreselected = p.id === preselectedId;
            return `<option value="${p.id}" ${isPreselected ? 'selected' : ''}>${p.name} (${p.role?.name || '未知'})${isPreselected ? ' [预选]' : ''}</option>`;
        }).join('');
}

async function confirmRedHerring() {
    const targetId = document.getElementById('redHerringSelect').value;
    if (!targetId) {
        alert('请选择一名玩家');
        return;
    }
    
    const result = await apiCall(`/api/game/${gameState.gameId}/set_red_herring`, 'POST', {
        target_id: parseInt(targetId)
    });
    
    if (result.success) {
        // 更新本地状态 - 清除旧的红鲱鱼标记
        gameState.players.forEach(p => p.is_red_herring = false);
        
        // 设置新的红鲱鱼标记
        const targetPlayer = gameState.players.find(p => p.id === parseInt(targetId));
        if (targetPlayer) {
            targetPlayer.is_red_herring = true;
        }
        
        // 更新占卜师的 red_herring_id
        const fortuneTeller = gameState.players.find(p => p.role && p.role.id === 'fortune_teller');
        if (fortuneTeller) {
            fortuneTeller.red_herring_id = parseInt(targetId);
        }
        
        addLogEntry(`占卜师的红鲱鱼已设置为 ${result.red_herring}`, 'setup');
        document.getElementById('redHerringModal').classList.remove('active');
        
        // 重新渲染玩家圈以显示红鲱鱼标记
        renderPlayerCircle();
    } else {
        alert(result.error || '设置失败');
    }
}

async function skipRedHerring() {
    // 使用后端已预选的红鲱鱼，或随机选择一名善良玩家
    const fortuneTeller = gameState.players.find(p => p.role && p.role.id === 'fortune_teller');
    const preselectedId = fortuneTeller?.red_herring_id;
    
    // 清除旧的红鲱鱼标记
    gameState.players.forEach(p => p.is_red_herring = false);
    
    if (preselectedId) {
        // 使用后端已预选的红鲱鱼
        const preselectedPlayer = gameState.players.find(p => p.id === preselectedId);
        if (preselectedPlayer) {
            preselectedPlayer.is_red_herring = true;
        }
        addLogEntry(`占卜师的红鲱鱼保持为 ${preselectedPlayer?.name || '未知'}（后端预选）`, 'setup');
    } else {
        // 如果后端没有预选，前端随机选择
        const goodPlayers = gameState.players.filter(p => 
            (p.role_type === 'townsfolk' || p.role_type === 'outsider') && 
            p.role && p.role.id !== 'fortune_teller'
        );
        
        if (goodPlayers.length > 0) {
            const randomPlayer = goodPlayers[Math.floor(Math.random() * goodPlayers.length)];
            const result = await apiCall(`/api/game/${gameState.gameId}/set_red_herring`, 'POST', {
                target_id: randomPlayer.id
            });
            
            if (result.success) {
                randomPlayer.is_red_herring = true;
                if (fortuneTeller) {
                    fortuneTeller.red_herring_id = randomPlayer.id;
                }
                addLogEntry(`占卜师的红鲱鱼已随机设置为 ${result.red_herring}`, 'setup');
            }
        }
    }
    
    document.getElementById('redHerringModal').classList.remove('active');
    
    // 重新渲染玩家圈以显示红鲱鱼标记
    renderPlayerCircle();
}

// 计算最优座位布局（方案 B：数学公式优化 + 碰撞检测 + 动态座位大小）
// 核心逻辑：在不触碰边界的前提下，最大化座位尺寸，同时合理分散座位
function calculateOptimalLayout(containerSize, playerCount) {
    // 1. 中心指示器占用空间（固定大小，约 120px 或容器的 20%）
    // 注意：这是中心天数指示器的大小，不是整个布局区域
    const centerSize = Math.min(120, containerSize * 0.2);
    const centerRadius = centerSize / 2;
    
    // 2. 边距设置：座位边缘与容器边界的最小距离
    // 这个值决定了座位能有多接近边界
    const boundaryMargin = 5; // 座位边缘与容器边界的最小距离（像素）
    
    // 3. 根据屏幕尺寸确定座位大小范围（响应式）
    let minSeatSize = 35; // 默认最小值
    let maxSeatSize = 70; // 默认最大值
    
    if (window.innerWidth <= 360) {
        minSeatSize = 28;
        maxSeatSize = 50;
    } else if (window.innerWidth <= 480) {
        minSeatSize = 32;
        maxSeatSize = 55;
    } else if (window.innerWidth <= 768) {
        minSeatSize = 35;
        maxSeatSize = 60;
    }
    
    // 4. 计算角度步长（相邻座位之间的角度）
    const angleStep = (2 * Math.PI) / playerCount;
    
    // 5. 核心计算：
    // - 座位中心到容器中心的距离为 radius
    // - 座位边缘不能超出容器边界：radius + seatSize/2 + boundaryMargin <= containerSize/2
    // - 座位边缘不能与中心指示器重叠：radius - seatSize/2 >= centerRadius + gap
    // - 相邻座位不能重叠：2 * radius * sin(angleStep/2) >= seatSize * 1.1
    
    // 计算最大可用半径（座位中心到容器中心的最大距离）
    // 公式：maxRadius = containerSize/2 - boundaryMargin - seatSize/2
    // 我们需要为不同的 seatSize 计算对应的 maxRadius
    
    // 6. 边界检测函数：检查给定座位尺寸和半径是否满足所有约束
    const checkLayout = (seatSize, radius) => {
        // 约束1：座位边缘不超出容器边界
        // 对于圆形布局，最边缘的座位在角度 0、90、180、270 度时最接近边界
        // 但由于是正圆，只需检查 radius + seatSize/2 + boundaryMargin <= containerSize/2
        if (radius + seatSize / 2 + boundaryMargin > containerSize / 2) {
            return false;
        }
        
        // 约束2：座位边缘不与中心指示器重叠（保留一点间隙）
        const centerGap = 10; // 座位边缘与中心指示器的最小间隙
        if (radius - seatSize / 2 < centerRadius + centerGap) {
            return false;
        }
        
        // 约束3：相邻座位之间不重叠
        // 相邻座位中心距离 = 2 * radius * sin(angleStep/2)
        // 需要 >= seatSize * overlapFactor
        const overlapFactor = 1.15; // 座位之间的最小间隙系数
        const actualDistance = 2 * radius * Math.sin(angleStep / 2);
        if (actualDistance < seatSize * overlapFactor) {
            return false;
        }
        
        return true;
    };
    
    // 7. 搜索最优布局
    // 策略：优先最大化座位尺寸，在满足约束的情况下选择较大的半径（更分散）
    let bestSeatSize = minSeatSize;
    let bestRadius = centerRadius + minSeatSize; // 初始保守值
    let foundValidLayout = false;
    
    const seatSizeStep = 2;
    const radiusStep = 3;
    
    // 从最大座位尺寸开始，逐渐减小，直到找到有效布局
    for (let testSeatSize = maxSeatSize; testSeatSize >= minSeatSize; testSeatSize -= seatSizeStep) {
        // 对于当前座位尺寸，计算允许的半径范围
        const minRadius = centerRadius + 10 + testSeatSize / 2; // 最小半径（保证与中心有间隙）
        const maxRadius = containerSize / 2 - boundaryMargin - testSeatSize / 2; // 最大半径（保证不超出边界）
        
        if (minRadius > maxRadius) {
            continue; // 当前座位尺寸太大，无法放置
        }
        
        // 检查相邻座位不重叠的约束能否满足
        // 需要的最小半径 = seatSize * overlapFactor / (2 * sin(angleStep/2))
        const overlapFactor = 1.15;
        const requiredMinRadius = (testSeatSize * overlapFactor) / (2 * Math.sin(angleStep / 2));
        
        const effectiveMinRadius = Math.max(minRadius, requiredMinRadius);
        
        if (effectiveMinRadius > maxRadius) {
            continue; // 当前座位尺寸下无法满足所有约束
        }
        
        // 找到有效布局！选择最大的半径（最分散）
        // 但如果半径太大会导致座位太接近边界，我们选择一个平衡点
        // 使用靠近边界但保留一定余量的半径
        const optimalRadius = Math.min(maxRadius, effectiveMinRadius + (maxRadius - effectiveMinRadius) * 0.8);
        
        // 验证布局是否有效
        if (checkLayout(testSeatSize, optimalRadius)) {
            bestSeatSize = testSeatSize;
            bestRadius = optimalRadius;
            foundValidLayout = true;
            break; // 找到最大座位尺寸的有效布局，停止搜索
        }
    }
    
    // 8. 如果没找到有效布局，使用保守方案
    if (!foundValidLayout) {
        // 使用最小座位尺寸，并计算安全的半径
        bestSeatSize = minSeatSize;
        const safeRadius = (centerRadius + 10 + minSeatSize / 2 + containerSize / 2 - boundaryMargin - minSeatSize / 2) / 2;
        bestRadius = Math.max(centerRadius + minSeatSize, safeRadius);
    }
    
    // 调试日志（可选）
    // console.log('Layout calculated:', { containerSize, playerCount, bestSeatSize, bestRadius, radiusPercent: (bestRadius / containerSize) * 100 });
    
    return { 
        seatSize: Math.round(bestSeatSize), 
        radius: bestRadius,
        radiusPercent: (bestRadius / containerSize) * 100
    };
}

// 更新座位位置（不重新创建 DOM，避免重复初始化）
function updateSeatPositions() {
    const circle = document.getElementById('playerCircle');
    if (!circle) return;
    
    const tableContainer = document.querySelector('.table-container');
    if (!tableContainer) return;
    
    const containerSize = Math.min(tableContainer.offsetWidth, tableContainer.offsetHeight);
    const playerCount = gameState.players.length;
    
    if (playerCount === 0) return;
    
    // 使用优化算法计算座位大小和半径
    const layout = calculateOptimalLayout(containerSize, playerCount);
    const seatSize = layout.seatSize;
    const radiusPercent = layout.radiusPercent;
    
    // 动态设置座位大小（通过 CSS 变量）
    document.documentElement.style.setProperty('--seat-size', `${seatSize}px`);
    
    // 更新每个座位的位置
    const centerPercent = 50;
    const seats = circle.querySelectorAll('.player-seat');
    
    seats.forEach((seat, index) => {
        if (index >= gameState.players.length) return;
        
        const angle = (index / gameState.players.length) * 2 * Math.PI - Math.PI / 2;
        const xPercent = centerPercent + radiusPercent * Math.cos(angle);
        const yPercent = centerPercent + radiusPercent * Math.sin(angle);
        
        seat.style.left = `${xPercent}%`;
        seat.style.top = `${yPercent}%`;
    });
}

function renderPlayerCircle() {
    const circle = document.getElementById('playerCircle');
    if (!circle) return;
    
    // 清空内容（会自动移除所有事件监听器）
    circle.innerHTML = '';
    
    // 获取容器尺寸
    const tableContainer = document.querySelector('.table-container');
    if (!tableContainer) return;
    
    const containerSize = Math.min(tableContainer.offsetWidth, tableContainer.offsetHeight);
    const playerCount = gameState.players.length;
    
    // 使用优化算法计算座位大小和半径
    const layout = calculateOptimalLayout(containerSize, playerCount);
    const seatSize = layout.seatSize;
    const radiusPercent = layout.radiusPercent;
    
    // 动态设置座位大小（通过 CSS 变量）
    document.documentElement.style.setProperty('--seat-size', `${seatSize}px`);
    
    // 使用百分比定位，座位会自动随容器尺寸缩放
    const centerPercent = 50;
    
    gameState.players.forEach((player, index) => {
        const angle = (index / gameState.players.length) * 2 * Math.PI - Math.PI / 2;
        const xPercent = centerPercent + radiusPercent * Math.cos(angle);
        const yPercent = centerPercent + radiusPercent * Math.sin(angle);
        
        const roleClass = player.role_type || '';
        const statusClasses = [];
        if (!player.alive) statusClasses.push('dead');
        if (player.poisoned) statusClasses.push('poisoned');
        if (player.drunk && !player.is_the_drunk) statusClasses.push('drunk');
        if (player.protected) statusClasses.push('protected');
        if (player.ability_used) statusClasses.push('ability-used');
        if (player.is_the_drunk) statusClasses.push('is-the-drunk');
        
        // 根据角度判断标签位置（用于小屏幕外部标签定位）
        const normalizedAngle = ((angle + Math.PI / 2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        const labelPosition = normalizedAngle < Math.PI ? 'label-bottom' : 'label-top';
        
        // 生成右下角状态图标HTML
        let statusIcons = '';
        if (player.poisoned) statusIcons += '<span class="status-icon poison-icon" title="中毒">🧪</span>';
        if (player.drunk && !player.is_the_drunk) statusIcons += '<span class="status-icon drunk-icon" title="醉酒">🍺</span>';
        if (player.protected) statusIcons += '<span class="status-icon protect-icon" title="被保护">🛡️</span>';
        if (player.ability_used) statusIcons += '<span class="status-icon used-icon" title="技能已用">✗</span>';
        if (player.is_grandchild) statusIcons += '<span class="status-icon grandchild-icon" title="祖母的孙子">👶</span>';
        if (player.is_butler_master) statusIcons += '<span class="status-icon master-icon" title="管家的主人">👑</span>';
        if (player.is_red_herring) statusIcons += '<span class="status-icon red-herring-icon" title="占卜师的红鲱鱼">🐟</span>';
        if (player.ravenkeeper_triggered) statusIcons += '<span class="status-icon ravenkeeper-icon" title="守鸦人待唤醒">🦅</span>';
        
        // 生成左下角标记HTML（酒鬼标记）
        let leftIcons = '';
        if (player.is_the_drunk) leftIcons += '<span class="left-icon drunk-role-icon" title="是酒鬼">🍺</span>';
        if (player.butler_master_id) leftIcons += '<span class="left-icon butler-icon" title="是管家">🎩</span>';
        
        // 生成自定义 tooltip 内容
        const tooltipContent = `
            <div class="seat-tooltip">
                <div class="tooltip-name">${player.name}</div>
                <div class="tooltip-role ${roleClass}">${player.role?.name || '未分配'}</div>
            </div>
        `;
        
        circle.innerHTML += `
            <button class="player-seat ${statusClasses.join(' ')} ${labelPosition}" 
                 type="button"
                 style="left: ${xPercent}%; top: ${yPercent}%;"
                 data-player-id="${player.id}"
                 data-player-name="${player.name}"
                 data-player-role="${player.role?.name || '未分配'}">
                <div class="seat-content">
                    <span class="seat-number">${player.id}</span>
                    <span class="seat-name" data-full-text="${player.name}">${player.name}</span>
                    <span class="seat-role ${roleClass}" data-full-text="${player.role?.name || '未分配'}">${player.role?.name || '未分配'}</span>
                    ${leftIcons ? `<div class="left-icons">${leftIcons}</div>` : ''}
                    ${statusIcons ? `<div class="status-icons">${statusIcons}</div>` : ''}
                </div>
                ${tooltipContent}
            </button>
        `;
    });
    
    // 初始化点击事件和自定义 tooltip
    // 使用标记避免重复添加事件监听器，使用防抖避免重复初始化
    if (window.seatInitializationTimeout) {
        clearTimeout(window.seatInitializationTimeout);
    }
    window.seatInitializationTimeout = setTimeout(() => {
        const seats = document.querySelectorAll('.player-seat:not([data-click-initialized])');
        
        seats.forEach((seat) => {
            seat.setAttribute('data-click-initialized', 'true');
            
            const playerId = seat.getAttribute('data-player-id');
            const tooltip = seat.querySelector('.seat-tooltip');
            let tooltipShowTimeout = null;
            
            // 隐藏 tooltip 的辅助函数
            const hideTooltip = () => {
                if (tooltipShowTimeout) {
                    clearTimeout(tooltipShowTimeout);
                    tooltipShowTimeout = null;
                }
                seat.classList.remove('tooltip-visible');
            };
            
            // 点击事件处理
            const clickHandler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                hideTooltip();
                
                if (playerId) {
                    try {
                        openPlayerDetail(parseInt(playerId));
                    } catch (error) {
                        console.error('Error calling openPlayerDetail:', error);
                    }
                }
            };
            
            seat.addEventListener('click', clickHandler, false);
            
            // 自定义 tooltip 事件处理
            if (tooltip) {
                seat.addEventListener('mouseenter', () => {
                    tooltipShowTimeout = setTimeout(() => {
                        seat.classList.add('tooltip-visible');
                    }, 200);
                }, false);
                
                seat.addEventListener('mouseleave', hideTooltip, false);
            }
        });
        
        window.seatInitializationTimeout = null;
    }, 200);
}

function updatePlayerSelects() {
    const nominatorSelect = document.getElementById('nominatorSelect');
    const nomineeSelect = document.getElementById('nomineeSelect');
    
    const alivePlayers = gameState.players.filter(p => p.alive);
    const allPlayers = gameState.players;
    
    nominatorSelect.innerHTML = '<option value="">选择提名者</option>' +
        alivePlayers.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    
    nomineeSelect.innerHTML = '<option value="">选择被提名者</option>' +
        allPlayers.map(p => `<option value="${p.id}">${p.name}${p.alive ? '' : ' (已死亡)'}</option>`).join('');
}

// ===== 阶段控制 =====
async function startNight() {
    const result = await apiCall(`/api/game/${gameState.gameId}/start_night`, 'POST');
    
    if (!result.success) {
        alert(result.error || '开始夜晚失败');
        return;
    }
    
    gameState.currentPhase = 'night';
    gameState.nightNumber = result.night_number;
    gameState.nightOrder = result.night_order;
    gameState.currentNightIndex = 0;
    gameState.alivePlayers = result.alive_players || [];
    
    // 重置所有玩家的保护状态
    gameState.players.forEach(p => {
        p.protected = false;
    });
    
    updatePhaseIndicator('night');
    updateDayNightIndicator();
    renderPlayerCircle(); // 刷新显示
    
    // 显示夜间面板，隐藏提名面板
    document.getElementById('nightPanel').style.display = 'block';
    document.getElementById('nominationPanel').style.display = 'none';
    
    // 渲染夜间顺序
    renderNightOrder();
    
    // 更新按钮状态
    document.getElementById('startNightBtn').disabled = true;
    document.getElementById('startDayBtn').disabled = false;
    
    addLogEntry(`第 ${gameState.nightNumber} 个夜晚开始`, 'phase');
    
    // 更新日期: 2026-01-12 - 自动通知第一位玩家行动
    if (gameState.nightOrder.length > 0) {
        await notifyNextPlayerAction(0);
    }
}

function renderNightOrder() {
    const list = document.getElementById('nightOrderList');
    
    if (gameState.nightOrder.length === 0) {
        list.innerHTML = '<p style="color: var(--text-muted); text-align: center;">今晚没有角色需要行动</p>';
        return;
    }
    
    list.innerHTML = gameState.nightOrder.map((item, index) => `
        <div class="night-order-item ${index < gameState.currentNightIndex ? 'completed' : ''}"
             data-index="${index}"
             onclick="handleNightAction(${index})">
            <div class="night-order-number">${index + 1}</div>
            <div class="night-order-info">
                <div class="night-order-name">${item.player_name}</div>
                <div class="night-order-role">${item.role_name}: ${item.ability.substring(0, 50)}...</div>
            </div>
        </div>
    `).join('');
}

// 当前夜间行动的全局变量
let currentNightActionIndex = null;
let currentNightActionTarget = null;
let currentNightActionSecondTarget = null;

async function handleNightAction(index) {
    const item = gameState.nightOrder[index];
    currentNightActionIndex = index;
    currentNightActionTarget = null;
    currentNightActionSecondTarget = null;
    
    // 获取存活玩家列表
    const alivePlayers = gameState.players.filter(p => p.alive);
    const allPlayers = gameState.players;
    
    // 更新日期: 2026-01-12 - 获取玩家的选择（如果有）
    let playerChoiceHTML = '';
    try {
        const choicesResult = await apiCall(`/api/storyteller/player_choices/${gameState.gameId}`);
        if (choicesResult.choices && choicesResult.choices[item.player_id]) {
            const choice = choicesResult.choices[item.player_id];
            if (!choice.confirmed) {
                const targetNames = choice.target_names?.join(', ') || '无';
                const extraData = choice.extra_data || {};
                
                // 特殊处理麻脸巫婆的选择
                if (item.action_type === 'pit_hag' && extraData.new_role_name) {
                    const roleInPlay = extraData.role_in_play;
                    const isDemon = extraData.is_demon;
                    
                    playerChoiceHTML = `
                        <div style="padding: var(--spacing-md); background: rgba(139, 0, 139, 0.2); border: 1px solid #da70d6; border-radius: var(--radius-md); margin-bottom: var(--spacing-md);">
                            <p style="color: #da70d6; margin-bottom: var(--spacing-sm);">🧙‍♀️ 麻脸巫婆已选择</p>
                            <p style="color: var(--text-primary);">目标: <strong>${targetNames}</strong></p>
                            <p style="color: var(--text-primary);">新角色: <strong>${extraData.new_role_name}</strong></p>
                            ${roleInPlay ? `
                            <div style="margin-top: var(--spacing-sm); padding: var(--spacing-sm); background: rgba(243, 156, 18, 0.2); border-radius: var(--radius-sm);">
                                <p style="color: #f39c12;">⚠️ 该角色已在场，无事发生</p>
                            </div>
                            ` : ''}
                            ${isDemon ? `
                            <div style="margin-top: var(--spacing-sm); padding: var(--spacing-sm); background: rgba(139, 0, 0, 0.3); border-radius: var(--radius-sm);">
                                <p style="color: #ff6b6b; font-weight: bold;">⚠️ 选择了恶魔角色！</p>
                                <p style="color: var(--text-muted); font-size: 0.85rem;">需要决定是否让新恶魔存活</p>
                            </div>
                            <div style="margin-top: var(--spacing-sm); display: flex; gap: var(--spacing-sm);">
                                <button class="btn btn-primary" onclick="confirmPitHagDemon(${item.player_id}, true)" style="flex: 1;">
                                    允许新恶魔存活
                                </button>
                                <button class="btn btn-secondary" onclick="confirmPitHagDemon(${item.player_id}, false)" style="flex: 1;">
                                    新恶魔死亡
                                </button>
                            </div>
                            ` : `
                            <button class="btn btn-secondary" onclick="confirmPitHagAction(${item.player_id})" style="margin-top: var(--spacing-sm); font-size: 0.85rem;">
                                确认并应用
                            </button>
                            `}
                        </div>
                    `;
                } else {
                    playerChoiceHTML = `
                        <div style="padding: var(--spacing-md); background: rgba(52, 152, 219, 0.2); border: 1px solid #3498db; border-radius: var(--radius-md); margin-bottom: var(--spacing-md);">
                            <p style="color: #3498db; margin-bottom: var(--spacing-sm);">📱 玩家端已提交选择</p>
                            <p style="color: var(--text-primary);">选择目标: <strong>${targetNames}</strong></p>
                            <p style="font-size: 0.8rem; color: var(--text-muted);">提交时间: ${new Date(choice.submitted_at).toLocaleTimeString()}</p>
                            <button class="btn btn-secondary" onclick="usePlayerChoice(${item.player_id})" style="margin-top: var(--spacing-sm); font-size: 0.85rem;">
                                使用玩家选择
                            </button>
                        </div>
                    `;
                    // 预设玩家的选择
                    if (choice.targets && choice.targets.length > 0) {
                        currentNightActionTarget = choice.targets[0];
                        if (choice.targets.length > 1) {
                            currentNightActionSecondTarget = choice.targets[1];
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.log('获取玩家选择失败:', e);
    }
    
    // 根据角色类型显示不同的UI
    const infoContent = document.getElementById('infoContent');
    let actionUI = '';
    
    // 基本信息
    const headerHTML = `
        <h4 style="margin-bottom: var(--spacing-md); color: var(--color-gold);">${item.player_name} - ${item.role_name}</h4>
        <p style="margin-bottom: var(--spacing-lg); color: var(--text-secondary);">${item.ability}</p>
        ${playerChoiceHTML}
    `;
    
    // 根据行动类型生成不同UI
    if (item.action_type === 'kill') {
        // 恶魔/爪牙击杀 - 可选择目标或不选择
        const roleLabel = item.role_type === 'demon' ? '恶魔' : '爪牙';
        
        // 对于珀(Po)等特殊恶魔，可能可以选择多个目标
        const isMultiKill = item.role_id === 'po' || item.role_id === 'shabaloth';
        
        // 更新日期: 2026-01-02 - 小恶魔可以选择自己（传刀功能）
        const isImp = item.role_id === 'imp';
        const killTargets = isImp ? 
            alivePlayers : // 小恶魔可以选择包括自己在内的所有存活玩家
            alivePlayers.filter(p => p.id !== item.player_id); // 其他恶魔不能选自己
        
        actionUI = `
            <div class="night-action-panel">
                <h5 style="color: var(--color-minion); margin-bottom: var(--spacing-md);">🗡️ ${roleLabel}击杀</h5>
                ${isImp ? `
                <div style="padding: var(--spacing-sm); background: rgba(139, 69, 0, 0.2); border-radius: var(--radius-sm); margin-bottom: var(--spacing-md); color: var(--color-drunk);">
                    💡 小恶魔可以选择自杀传刀给爪牙
                </div>
                ` : ''}
                <div class="target-select-group">
                    <label>选择击杀目标:</label>
                    <select id="nightActionTarget" class="form-select" onchange="updateNightActionTarget(this.value)">
                        <option value="">-- 不击杀任何人 --</option>
                        ${killTargets.map(p => 
                            `<option value="${p.id}">${p.name}${p.id === item.player_id ? ' (自己 - 传刀)' : ''}</option>`
                        ).join('')}
                    </select>
                </div>
                ${isMultiKill ? `
                <div class="target-select-group" style="margin-top: var(--spacing-md);">
                    <label>选择第二个目标 (可选):</label>
                    <select id="nightActionSecondTarget" class="form-select" onchange="updateNightActionSecondTarget(this.value)">
                        <option value="">-- 无 --</option>
                        ${alivePlayers.filter(p => p.id !== item.player_id).map(p => 
                            `<option value="${p.id}">${p.name}</option>`
                        ).join('')}
                    </select>
                </div>
                ` : ''}
                <div id="protectionWarning" style="display: none; margin-top: var(--spacing-md); padding: var(--spacing-sm); background: rgba(39, 174, 96, 0.2); border-radius: var(--radius-sm); color: var(--color-alive);">
                    ⚠️ 该目标可能被保护
                </div>
            </div>
        `;
    } else if (item.action_type === 'zombuul_kill') {
        // 更新日期: 2026-01-05 - 僵怖击杀
        actionUI = `
            <div class="night-action-panel">
                <h5 style="color: var(--color-demon); margin-bottom: var(--spacing-md);">💀 僵怖击杀</h5>
                <div style="padding: var(--spacing-sm); background: rgba(139, 0, 0, 0.2); border-radius: var(--radius-sm); margin-bottom: var(--spacing-md);">
                    <p style="color: var(--color-blood); font-size: 0.9rem;">
                        僵怖的能力：如果没有人因你的能力死亡，选择一名玩家使其死亡。<br>
                        第一次死亡时，你会活着但表现为已死亡。
                    </p>
                </div>
                <div class="target-select-group">
                    <label>选择击杀目标（如今天没人因你能力死亡）:</label>
                    <select id="nightActionTarget" class="form-select" onchange="updateNightActionTarget(this.value)">
                        <option value="">-- 不击杀任何人 --</option>
                        ${alivePlayers.filter(p => p.id !== item.player_id).map(p => 
                            `<option value="${p.id}">${p.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div id="protectionWarning" style="display: none; margin-top: var(--spacing-md); padding: var(--spacing-sm); background: rgba(39, 174, 96, 0.2); border-radius: var(--radius-sm); color: var(--color-alive);">
                    ⚠️ 该目标可能被保护
                </div>
            </div>
        `;
    } else if (item.action_type === 'shabaloth_kill') {
        // 更新日期: 2026-01-05 - 沙巴洛斯击杀（杀两人 + 可复活）
        const reviveData = await apiCall(`/api/game/${gameState.gameId}/shabaloth_revive_targets`);
        const deadPlayers = reviveData.dead_players || [];
        
        actionUI = `
            <div class="night-action-panel">
                <h5 style="color: var(--color-demon); margin-bottom: var(--spacing-md);">👹 沙巴洛斯击杀</h5>
                <div style="padding: var(--spacing-sm); background: rgba(139, 0, 0, 0.2); border-radius: var(--radius-sm); margin-bottom: var(--spacing-md);">
                    <p style="color: var(--color-blood); font-size: 0.9rem;">
                        沙巴洛斯每晚可以选择两名玩家使其死亡。<br>
                        同时，死去的玩家可能会复活（由说书人决定）。
                    </p>
                </div>
                <div class="target-select-group">
                    <label>选择第一个击杀目标:</label>
                    <select id="nightActionTarget" class="form-select" onchange="updateNightActionTarget(this.value)">
                        <option value="">-- 不击杀 --</option>
                        ${alivePlayers.filter(p => p.id !== item.player_id).map(p => 
                            `<option value="${p.id}">${p.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="target-select-group" style="margin-top: var(--spacing-md);">
                    <label>选择第二个击杀目标:</label>
                    <select id="nightActionSecondTarget" class="form-select" onchange="updateNightActionSecondTarget(this.value)">
                        <option value="">-- 不击杀 --</option>
                        ${alivePlayers.filter(p => p.id !== item.player_id).map(p => 
                            `<option value="${p.id}">${p.name}</option>`
                        ).join('')}
                    </select>
                </div>
                ${deadPlayers.length > 0 ? `
                <div class="target-select-group" style="margin-top: var(--spacing-md); padding-top: var(--spacing-md); border-top: 1px solid rgba(255,255,255,0.1);">
                    <label style="color: var(--color-alive);">🔄 选择要复活的玩家 (可选):</label>
                    <select id="shabalothReviveTarget" class="form-select">
                        <option value="">-- 不复活任何人 --</option>
                        ${deadPlayers.map(p => 
                            `<option value="${p.id}">${p.name}</option>`
                        ).join('')}
                    </select>
                </div>
                ` : '<p style="color: var(--text-muted); margin-top: var(--spacing-md);">目前没有死亡玩家可以复活</p>'}
                <div id="protectionWarning" style="display: none; margin-top: var(--spacing-md); padding: var(--spacing-sm); background: rgba(39, 174, 96, 0.2); border-radius: var(--radius-sm); color: var(--color-alive);">
                    ⚠️ 该目标可能被保护
                </div>
            </div>
        `;
    } else if (item.action_type === 'po_kill') {
        // 更新日期: 2026-01-05 - 珀击杀（上晚不杀则本晚可杀三人）
        const poStatus = await apiCall(`/api/game/${gameState.gameId}/po_status`);
        const canKillThree = poStatus.can_kill_three || false;
        
        actionUI = `
            <div class="night-action-panel">
                <h5 style="color: var(--color-demon); margin-bottom: var(--spacing-md);">🔥 珀击杀</h5>
                <div style="padding: var(--spacing-sm); background: rgba(139, 0, 0, 0.2); border-radius: var(--radius-sm); margin-bottom: var(--spacing-md);">
                    <p style="color: var(--color-blood); font-size: 0.9rem;">
                        珀每晚可以选择一名玩家使其死亡。<br>
                        如果上一晚没有选择任何人，本晚可以选择三名玩家使其死亡。
                    </p>
                    ${canKillThree ? `
                    <p style="color: var(--color-gold); font-weight: bold; margin-top: var(--spacing-sm);">
                        ⚡ 上一晚未行动，本晚可击杀三人！
                    </p>
                    ` : ''}
                </div>
                <div class="target-select-group">
                    <label>选择第一个击杀目标:</label>
                    <select id="nightActionTarget" class="form-select" onchange="updateNightActionTarget(this.value)">
                        <option value="">-- 不击杀任何人 --</option>
                        ${alivePlayers.filter(p => p.id !== item.player_id).map(p => 
                            `<option value="${p.id}">${p.name}</option>`
                        ).join('')}
                    </select>
                </div>
                ${canKillThree ? `
                <div class="target-select-group" style="margin-top: var(--spacing-md);">
                    <label>选择第二个击杀目标:</label>
                    <select id="poSecondTarget" class="form-select">
                        <option value="">-- 不击杀 --</option>
                        ${alivePlayers.filter(p => p.id !== item.player_id).map(p => 
                            `<option value="${p.id}">${p.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="target-select-group" style="margin-top: var(--spacing-md);">
                    <label>选择第三个击杀目标:</label>
                    <select id="poThirdTarget" class="form-select">
                        <option value="">-- 不击杀 --</option>
                        ${alivePlayers.filter(p => p.id !== item.player_id).map(p => 
                            `<option value="${p.id}">${p.name}</option>`
                        ).join('')}
                    </select>
                </div>
                ` : ''}
                <p style="margin-top: var(--spacing-sm); font-size: 0.85rem; color: var(--text-muted);">
                    ${canKillThree ? '选择不击杀任何人将重置三杀状态' : '选择不击杀任何人，下一晚可击杀三人'}
                </p>
                <div id="protectionWarning" style="display: none; margin-top: var(--spacing-md); padding: var(--spacing-sm); background: rgba(39, 174, 96, 0.2); border-radius: var(--radius-sm); color: var(--color-alive);">
                    ⚠️ 该目标可能被保护
                </div>
            </div>
        `;
    } else if (item.action_type === 'protect') {
        // 保护类角色 - 僧侣、旅店老板等
        const isInnkeeper = item.role_id === 'innkeeper';
        
        if (isInnkeeper) {
            // 旅店老板 - 选择两名玩家，其中一人会醉酒
            actionUI = `
                <div class="night-action-panel">
                    <h5 style="color: var(--color-alive); margin-bottom: var(--spacing-md);">🛡️ 旅店老板 - 保护</h5>
                    <div class="target-select-group">
                        <label>选择第一个保护目标:</label>
                        <select id="nightActionTarget" class="form-select" onchange="updateNightActionTarget(this.value)">
                            <option value="">-- 选择第一个玩家 --</option>
                            ${alivePlayers.filter(p => p.id !== item.player_id).map(p => 
                                `<option value="${p.id}">${p.name}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="target-select-group" style="margin-top: var(--spacing-md);">
                        <label>选择第二个保护目标:</label>
                        <select id="nightActionSecondTarget" class="form-select" onchange="updateNightActionSecondTarget(this.value)">
                            <option value="">-- 选择第二个玩家 --</option>
                            ${alivePlayers.filter(p => p.id !== item.player_id).map(p => 
                                `<option value="${p.id}">${p.name}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="target-select-group" style="margin-top: var(--spacing-md);">
                        <label>选择哪位玩家会醉酒:</label>
                        <select id="drunkTarget" class="form-select">
                            <option value="first">第一个目标醉酒</option>
                            <option value="second">第二个目标醉酒</option>
                        </select>
                    </div>
                    <p style="margin-top: var(--spacing-sm); font-size: 0.85rem; color: var(--text-muted);">
                        两名玩家今晚无法死亡，但其中一人会喝醉到明天黄昏
                    </p>
                </div>
            `;
        } else {
            // 僧侣等 - 只选择一名玩家
            actionUI = `
                <div class="night-action-panel">
                    <h5 style="color: var(--color-alive); margin-bottom: var(--spacing-md);">🛡️ 保护</h5>
                    <div class="target-select-group">
                        <label>选择保护目标:</label>
                        <select id="nightActionTarget" class="form-select" onchange="updateNightActionTarget(this.value)">
                            <option value="">-- 选择要保护的玩家 --</option>
                            ${alivePlayers.filter(p => p.id !== item.player_id).map(p => 
                                `<option value="${p.id}">${p.name}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <p style="margin-top: var(--spacing-sm); font-size: 0.85rem; color: var(--text-muted);">
                        被保护的玩家今晚不会被恶魔杀死
                    </p>
                </div>
            `;
        }
    } else if (item.action_type === 'poison') {
        // 投毒类角色
        actionUI = `
            <div class="night-action-panel">
                <h5 style="color: var(--color-poisoned); margin-bottom: var(--spacing-md);">🧪 投毒</h5>
                <div class="target-select-group">
                    <label>选择投毒目标:</label>
                    <select id="nightActionTarget" class="form-select" onchange="updateNightActionTarget(this.value)">
                        <option value="">-- 选择目标 --</option>
                        ${alivePlayers.map(p => 
                            `<option value="${p.id}">${p.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <p style="margin-top: var(--spacing-sm); font-size: 0.85rem; color: var(--text-muted);">
                    被投毒的玩家能力失效到明天白天
                </p>
            </div>
        `;
    } else if (item.action_type === 'pukka_poison') {
        // 普卡 - 特殊投毒恶魔
        const actionPlayer = gameState.players.find(p => p.id === item.player_id);
        const previousTargetId = actionPlayer?.pukka_previous_target;
        const previousTarget = previousTargetId ? gameState.players.find(p => p.id === previousTargetId) : null;
        
        actionUI = `
            <div class="night-action-panel">
                <h5 style="color: var(--color-demon); margin-bottom: var(--spacing-md);">普卡 - 投毒恶魔</h5>
                ${previousTarget && previousTarget.alive ? `
                <div style="padding: var(--spacing-md); background: rgba(139, 0, 0, 0.3); border: 1px solid var(--color-blood); border-radius: var(--radius-md); margin-bottom: var(--spacing-md);">
                    <p style="color: var(--color-blood);">💀 前一晚的目标 <strong>${previousTarget.name}</strong> 将在今晚死亡（除非被保护）</p>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: var(--spacing-xs);">该玩家的中毒状态将解除（恢复健康）</p>
                </div>
                ` : previousTarget && !previousTarget.alive ? `
                <div style="padding: var(--spacing-sm); background: rgba(100, 100, 100, 0.2); border-radius: var(--radius-md); margin-bottom: var(--spacing-md);">
                    <p style="color: var(--text-muted);">前一晚的目标 ${previousTarget.name} 已死亡</p>
                </div>
                ` : gameState.nightNumber > 1 ? `
                <div style="padding: var(--spacing-sm); background: rgba(100, 100, 100, 0.2); border-radius: var(--radius-md); margin-bottom: var(--spacing-md);">
                    <p style="color: var(--text-muted);">没有前一晚的目标需要处理</p>
                </div>
                ` : ''}
                <div class="target-select-group">
                    <label>选择今晚的投毒目标:</label>
                    <select id="nightActionTarget" class="form-select" onchange="updateNightActionTarget(this.value)">
                        <option value="">-- 选择目标 --</option>
                        ${alivePlayers.filter(p => p.id !== item.player_id).map(p => 
                            `<option value="${p.id}">${p.name}${p.id === previousTargetId ? ' (前一晚目标)' : ''}</option>`
                        ).join('')}
                    </select>
                </div>
                <p style="margin-top: var(--spacing-sm); font-size: 0.85rem; color: var(--text-muted);">
                    普卡每晚选择一名玩家使其中毒。<br>
                    被选中的前一个玩家会在今晚死亡，然后中毒状态解除。
                </p>
            </div>
        `;
    } else if (item.action_type === 'drunk') {
        // 醉酒类角色（如侍臣）- 一次性技能
        actionUI = `
            <div class="night-action-panel">
                <h5 style="color: var(--color-drunk); margin-bottom: var(--spacing-md);">🍺 使目标醉酒</h5>
                <div class="target-select-group">
                    <label>选择要使其醉酒的角色:</label>
                    <select id="nightActionTarget" class="form-select" onchange="updateNightActionTarget(this.value)">
                        <option value="">-- 选择目标 --</option>
                        ${alivePlayers.map(p => 
                            `<option value="${p.id}">${p.name} (${p.role?.name || '未知'})</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="target-select-group" style="margin-top: var(--spacing-md);">
                    <label>醉酒持续时间:</label>
                    <select id="drunkDuration" class="form-select">
                        <option value="3" selected>3 天 3 夜（侍臣默认）</option>
                        <option value="1">1 天 1 夜</option>
                        <option value="2">2 天 2 夜</option>
                        <option value="999">直到游戏结束</option>
                    </select>
                </div>
                <p style="margin-top: var(--spacing-sm); font-size: 0.85rem; color: var(--text-muted);">
                    ⚠️ 这是一次性技能，使用后将不再出现在夜间行动列表中
                </p>
            </div>
        `;
    } else if (item.action_type === 'sailor_drunk') {
        // 水手 - 选择目标，然后决定谁醉酒
        actionUI = `
            <div class="night-action-panel">
                <h5 style="color: var(--color-townsfolk); margin-bottom: var(--spacing-md);">⚓ 水手能力</h5>
                <div class="target-select-group">
                    <label>选择一名玩家:</label>
                    <select id="nightActionTarget" class="form-select" onchange="updateNightActionTarget(this.value); updateSailorDrunkPreview();">
                        <option value="">-- 选择目标 --</option>
                        ${alivePlayers.filter(p => p.id !== item.player_id).map(p => 
                            `<option value="${p.id}">${p.name} (${p.role?.name || '未知'})</option>`
                        ).join('')}
                    </select>
                </div>
                <div id="sailorDrunkChoice" style="margin-top: var(--spacing-md); display: none;">
                    <label>选择谁喝醉（水手与目标之一）:</label>
                    <select id="sailorDrunkTarget" class="form-select" onchange="updateSailorDrunkChoice(this.value);">
                        <option value="target">目标玩家喝醉</option>
                        <option value="sailor">水手自己喝醉</option>
                    </select>
                </div>
                <div id="sailorDrunkPreview" style="margin-top: var(--spacing-md); padding: var(--spacing-md); background: rgba(0,0,0,0.3); border-radius: var(--radius-md); display: none;">
                    <p style="color: var(--color-drunk);">🍺 <span id="sailorDrunkName"></span> 将喝醉到明天黄昏</p>
                </div>
                <p style="margin-top: var(--spacing-sm); font-size: 0.85rem; color: var(--text-muted);">
                    水手选择一名玩家后，说书人决定水手和目标中谁喝醉。<br>
                    水手在喝醉时无法死亡。
                </p>
            </div>
        `;
    } else if (item.action_type === 'info_select') {
        // 选择目标获取信息类
        // 更新日期: 2026-01-12 - 需要玩家选择的角色，由玩家端选择后同步过来
        const needsTwoTargets = ['fortune_teller', 'seamstress', 'chambermaid'].includes(item.role_id);
        const needsOneTarget = ['ravenkeeper', 'dreamer'].includes(item.role_id);
        const noTargetNeeded = ['empath', 'undertaker', 'oracle', 'flowergirl'].includes(item.role_id);
        
        // 检查该玩家是否处于醉酒/中毒状态
        const actionPlayer = gameState.players.find(p => p.id === item.player_id);
        const isDrunkOrPoisoned = actionPlayer && (actionPlayer.drunk || actionPlayer.poisoned);
        
        // 不需要目标的角色（洗衣妇等首夜信息角色会在info_first_night处理）
        // 这里处理的是共情者、殡仪馆老板等不需要选择目标但需要每晚获取信息的角色
        if (noTargetNeeded) {
            const infoResult = await apiCall(`/api/game/${gameState.gameId}/generate_info`, 'POST', {
                player_id: item.player_id,
                targets: []
            });
            
            actionUI = `
                <div class="night-action-panel">
                    <h5 style="color: var(--color-townsfolk); margin-bottom: var(--spacing-md);">🔮 ${item.role_name} - 获取信息</h5>
                    ${isDrunkOrPoisoned ? `
                    <div style="padding: var(--spacing-sm); background: rgba(243, 156, 18, 0.2); border: 1px solid var(--color-drunk); border-radius: var(--radius-sm); margin-bottom: var(--spacing-md);">
                        <span style="color: var(--color-drunk);">⚠️ 该玩家处于${actionPlayer.drunk ? '醉酒' : '中毒'}状态，可提供错误信息</span>
                    </div>
                    ` : ''}
                    <div class="info-message" style="padding: var(--spacing-md); background: linear-gradient(135deg, rgba(139, 0, 0, 0.2), rgba(0, 0, 0, 0.3)); border-radius: var(--radius-lg); border: 1px solid var(--color-blood);">
                        <p style="color: var(--color-gold); font-weight: 500;">${infoResult.message || '请根据角色能力提供相应信息'}</p>
                    </div>
                    <div style="margin-top: var(--spacing-md);">
                        <label style="font-size: 0.85rem; color: var(--text-muted);">自定义/修改信息:</label>
                        <textarea id="infoResultText" class="form-textarea" placeholder="${infoResult.message || ''}" style="width: 100%; margin-top: var(--spacing-sm); min-height: 60px; background: var(--bg-card-hover); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-sm); color: var(--text-primary); padding: var(--spacing-sm);">${infoResult.message || ''}</textarea>
                    </div>
                </div>
            `;
        } else {
            // 需要选择目标的角色 - 由玩家选择后同步过来
            // 检查是否已有玩家选择
            let generatedInfo = null;
            
            // currentNightActionTarget 是在代码开头从 player_choices 中预设的
            if (currentNightActionTarget) {
                // 玩家已选择，生成信息
                const targets = [currentNightActionTarget];
                if (currentNightActionSecondTarget) targets.push(currentNightActionSecondTarget);
                
                try {
                    const infoResult = await apiCall(`/api/game/${gameState.gameId}/generate_info`, 'POST', {
                        player_id: item.player_id,
                        targets: targets
                    });
                    generatedInfo = infoResult.message;
                } catch (e) {
                    console.log('生成信息失败:', e);
                }
            }
            
            actionUI = `
                <div class="night-action-panel">
                    <h5 style="color: var(--color-townsfolk); margin-bottom: var(--spacing-md);">🔮 ${item.role_name} - 获取信息</h5>
                    ${isDrunkOrPoisoned ? `
                    <div style="padding: var(--spacing-sm); background: rgba(243, 156, 18, 0.2); border: 1px solid var(--color-drunk); border-radius: var(--radius-sm); margin-bottom: var(--spacing-md);">
                        <span style="color: var(--color-drunk);">⚠️ 该玩家处于${actionPlayer.drunk ? '醉酒' : '中毒'}状态，可提供错误信息</span>
                    </div>
                    ` : ''}
                    
                    ${currentNightActionTarget ? `
                    <div style="padding: var(--spacing-md); background: rgba(52, 152, 219, 0.15); border: 1px solid #3498db; border-radius: var(--radius-md); margin-bottom: var(--spacing-md);">
                        <p style="color: #3498db; font-weight: bold; margin-bottom: var(--spacing-sm);">📱 玩家选择的目标</p>
                        <p style="color: var(--text-primary); font-size: 1.1rem;">
                            ${(() => {
                                const t1 = gameState.players.find(p => p.id === currentNightActionTarget);
                                const t2 = currentNightActionSecondTarget ? gameState.players.find(p => p.id === currentNightActionSecondTarget) : null;
                                if (t2) {
                                    return `${t1?.name || '未知'} 和 ${t2.name}`;
                                }
                                return t1?.name || '未知';
                            })()}
                        </p>
                    </div>
                    ${generatedInfo ? `
                    <div class="info-message" style="padding: var(--spacing-md); background: linear-gradient(135deg, rgba(139, 0, 0, 0.2), rgba(0, 0, 0, 0.3)); border-radius: var(--radius-lg); border: 1px solid var(--color-blood); margin-bottom: var(--spacing-md);">
                        <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: var(--spacing-xs);">系统生成的结果（真实信息）：</p>
                        <p style="color: var(--color-gold); font-weight: 500;">${generatedInfo}</p>
                    </div>
                    ` : ''}
                    <div style="margin-top: var(--spacing-md);">
                        <label style="font-size: 0.85rem; color: var(--text-muted);">发送给玩家的信息：</label>
                        <textarea id="infoResultText" class="form-textarea" placeholder="输入要发送给玩家的信息..." style="width: 100%; margin-top: var(--spacing-sm); min-height: 60px; background: var(--bg-card-hover); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-sm); color: var(--text-primary); padding: var(--spacing-sm);">${generatedInfo || ''}</textarea>
                    </div>
                    ` : `
                    <div style="padding: var(--spacing-md); background: rgba(100, 100, 100, 0.2); border-radius: var(--radius-md); text-align: center;">
                        <p style="color: var(--text-muted); margin-bottom: var(--spacing-md);">等待玩家选择目标...</p>
                        <p style="color: var(--text-muted); font-size: 0.85rem;">点击下方"通知玩家行动"让玩家选择目标</p>
                    </div>
                    `}
                </div>
            `;
        }
    } else if (item.action_type === 'grandchild_select') {
        // 祖母 - 选择孙子
        // 只能选择镇民作为孙子
        const townsfolkPlayers = alivePlayers.filter(p => 
            p.id !== item.player_id && p.role_type === 'townsfolk'
        );
        
        actionUI = `
            <div class="night-action-panel">
                <h5 style="color: var(--color-townsfolk); margin-bottom: var(--spacing-md);">👵 祖母 - 选择孙子</h5>
                <div class="target-select-group">
                    <label>选择谁是祖母的孙子:</label>
                    <select id="nightActionTarget" class="form-select" onchange="updateNightActionTarget(this.value); updateGrandchildPreview();">
                        <option value="">-- 选择孙子 --</option>
                        ${townsfolkPlayers.map(p => 
                            `<option value="${p.id}">${p.name} (${p.role?.name || '未知'})</option>`
                        ).join('')}
                    </select>
                </div>
                <div id="grandchildPreview" style="margin-top: var(--spacing-md); padding: var(--spacing-md); background: rgba(0,0,0,0.3); border-radius: var(--radius-md); display: none;">
                    <p style="color: var(--color-gold);">📋 将告知祖母的信息:</p>
                    <p id="grandchildInfo" style="margin-top: var(--spacing-sm);"></p>
                </div>
                <p style="margin-top: var(--spacing-sm); font-size: 0.85rem; color: var(--text-muted);">
                    祖母会得知孙子是谁及其角色。如果恶魔杀死孙子，祖母也会死亡。<br>
                    被选中的玩家会显示 👶 孙子标记。
                </p>
            </div>
        `;
    } else if (item.action_type === 'butler_master') {
        // 管家 - 选择主人
        const actionPlayer = gameState.players.find(p => p.id === item.player_id);
        const currentMaster = actionPlayer?.butler_master_id ? 
            gameState.players.find(p => p.id === actionPlayer.butler_master_id) : null;
        
        actionUI = `
            <div class="night-action-panel">
                <h5 style="color: var(--color-outsider); margin-bottom: var(--spacing-md);">🎩 管家 - 选择主人</h5>
                ${currentMaster ? `
                <div style="padding: var(--spacing-sm); background: rgba(100, 100, 100, 0.2); border-radius: var(--radius-sm); margin-bottom: var(--spacing-md);">
                    <span style="color: var(--text-muted);">当前主人: <strong>${currentMaster.name}</strong></span>
                </div>
                ` : ''}
                <div class="target-select-group">
                    <label>选择你的主人（不包括自己）:</label>
                    <select id="nightActionTarget" class="form-select" onchange="updateNightActionTarget(this.value);">
                        <option value="">-- 选择主人 --</option>
                        ${alivePlayers.filter(p => p.id !== item.player_id).map(p => 
                            `<option value="${p.id}"${currentMaster && p.id === currentMaster.id ? ' selected' : ''}>${p.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <p style="margin-top: var(--spacing-sm); font-size: 0.85rem; color: var(--text-muted);">
                    明天白天，只有当你的主人投赞成票时，你才能投赞成票。<br>
                    被选中的玩家会显示 👑 主人标记。
                </p>
            </div>
        `;
    } else if (item.action_type === 'exorcist') {
        // 更新日期: 2026-01-05 - 驱魔人行动 UI
        // 驱魔人 - 选择目标（不能选之前选过的）
        const exorcistData = await apiCall(`/api/game/${gameState.gameId}/exorcist_targets`);
        const previousTargets = exorcistData.previous_targets || [];
        
        // 过滤掉之前选过的目标
        const availableTargets = alivePlayers.filter(p => 
            p.id !== item.player_id && !previousTargets.includes(p.id)
        );
        
        actionUI = `
            <div class="night-action-panel">
                <h5 style="color: var(--color-townsfolk); margin-bottom: var(--spacing-md);">✝️ 驱魔人 - 选择目标</h5>
                ${previousTargets.length > 0 ? `
                <div style="padding: var(--spacing-sm); background: rgba(100, 100, 100, 0.2); border-radius: var(--radius-sm); margin-bottom: var(--spacing-md);">
                    <span style="color: var(--text-muted);">之前选过的玩家: ${previousTargets.map(id => {
                        const p = gameState.players.find(player => player.id === id);
                        return p ? p.name : '未知';
                    }).join(', ')}</span>
                </div>
                ` : ''}
                <div class="target-select-group">
                    <label>选择一名玩家（不能选择之前选过的）:</label>
                    <select id="nightActionTarget" class="form-select" onchange="updateNightActionTarget(this.value);">
                        <option value="">-- 选择目标 --</option>
                        ${availableTargets.map(p => 
                            `<option value="${p.id}">${p.name} (${p.role?.name || '未知'})</option>`
                        ).join('')}
                    </select>
                </div>
                ${availableTargets.length === 0 ? `
                <div style="padding: var(--spacing-md); background: rgba(243, 156, 18, 0.2); border: 1px solid var(--color-drunk); border-radius: var(--radius-md); margin-top: var(--spacing-md);">
                    <p style="color: var(--color-drunk);">⚠️ 没有可选择的目标（所有存活玩家都已被选过）</p>
                </div>
                ` : ''}
                <p style="margin-top: var(--spacing-sm); font-size: 0.85rem; color: var(--text-muted);">
                    如果你选择了恶魔，恶魔今晚无法行动（无法击杀任何人）。<br>
                    你不能选择之前选过的玩家。
                </p>
            </div>
        `;
    } else if (item.action_type === 'devils_advocate') {
        // 更新日期: 2026-01-05 - 恶魔代言人行动 UI
        // 恶魔代言人 - 选择目标（不能选之前选过的），保护免于处决
        const advocateData = await apiCall(`/api/game/${gameState.gameId}/devils_advocate_targets`);
        const previousTargets = advocateData.previous_targets || [];
        
        // 过滤掉之前选过的目标
        const availableTargets = alivePlayers.filter(p => 
            p.id !== item.player_id && !previousTargets.includes(p.id)
        );
        
        actionUI = `
            <div class="night-action-panel">
                <h5 style="color: var(--color-minion); margin-bottom: var(--spacing-md);">😈 恶魔代言人 - 保护玩家</h5>
                ${previousTargets.length > 0 ? `
                <div style="padding: var(--spacing-sm); background: rgba(100, 100, 100, 0.2); border-radius: var(--radius-sm); margin-bottom: var(--spacing-md);">
                    <span style="color: var(--text-muted);">之前保护过的玩家: ${previousTargets.map(id => {
                        const p = gameState.players.find(player => player.id === id);
                        return p ? p.name : '未知';
                    }).join(', ')}</span>
                </div>
                ` : ''}
                <div class="target-select-group">
                    <label>选择一名玩家（明天处决时不会死亡）:</label>
                    <select id="nightActionTarget" class="form-select" onchange="updateNightActionTarget(this.value);">
                        <option value="">-- 选择目标 --</option>
                        ${availableTargets.map(p => 
                            `<option value="${p.id}">${p.name} (${p.role?.name || '未知'})</option>`
                        ).join('')}
                    </select>
                </div>
                ${availableTargets.length === 0 ? `
                <div style="padding: var(--spacing-md); background: rgba(243, 156, 18, 0.2); border: 1px solid var(--color-drunk); border-radius: var(--radius-md); margin-top: var(--spacing-md);">
                    <p style="color: var(--color-drunk);">⚠️ 没有可选择的目标（所有存活玩家都已被选过）</p>
                </div>
                ` : ''}
                <p style="margin-top: var(--spacing-sm); font-size: 0.85rem; color: var(--text-muted);">
                    你选择的玩家明天被处决时不会死亡。<br>
                    你不能选择之前选过的玩家。
                </p>
            </div>
        `;
    } else if (item.action_type === 'pit_hag') {
        // 更新日期: 2026-01-05 - 麻脸巫婆行动 UI
        const pitHagData = await apiCall(`/api/game/${gameState.gameId}/pit_hag_roles`);
        const availableRoles = pitHagData.available_roles || [];
        
        // 按类型分组显示
        const townsfolkRoles = availableRoles.filter(r => r.type === 'townsfolk');
        const outsiderRoles = availableRoles.filter(r => r.type === 'outsider');
        const minionRoles = availableRoles.filter(r => r.type === 'minion');
        const demonRoles = availableRoles.filter(r => r.type === 'demon');
        
        actionUI = `
            <div class="night-action-panel">
                <h5 style="color: var(--color-minion); margin-bottom: var(--spacing-md);">🧙‍♀️ 麻脸巫婆 - 改变角色</h5>
                <p style="color: var(--text-muted); margin-bottom: var(--spacing-md); font-size: 0.9rem;">
                    选择一名玩家和一个不在场的角色，该玩家将变成那个角色。
                </p>
                <div class="target-select-group">
                    <label>选择目标玩家:</label>
                    <select id="nightActionTarget" class="form-select" onchange="updateNightActionTarget(this.value); updatePitHagPreview();">
                        <option value="">-- 选择玩家 --</option>
                        ${alivePlayers.filter(p => p.id !== item.player_id).map(p => 
                            `<option value="${p.id}">${p.name} (当前: ${p.role?.name || '未知'})</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="target-select-group" style="margin-top: var(--spacing-md);">
                    <label>选择新角色 (不在场的角色):</label>
                    <select id="pitHagRoleSelect" class="form-select" onchange="updatePitHagPreview();">
                        <option value="">-- 选择角色 --</option>
                        ${townsfolkRoles.length > 0 ? `
                        <optgroup label="镇民">
                            ${townsfolkRoles.map(r => `<option value="${r.id}" data-type="townsfolk">${r.name}</option>`).join('')}
                        </optgroup>
                        ` : ''}
                        ${outsiderRoles.length > 0 ? `
                        <optgroup label="外来者">
                            ${outsiderRoles.map(r => `<option value="${r.id}" data-type="outsider">${r.name}</option>`).join('')}
                        </optgroup>
                        ` : ''}
                        ${minionRoles.length > 0 ? `
                        <optgroup label="爪牙">
                            ${minionRoles.map(r => `<option value="${r.id}" data-type="minion">${r.name}</option>`).join('')}
                        </optgroup>
                        ` : ''}
                        ${demonRoles.length > 0 ? `
                        <optgroup label="恶魔">
                            ${demonRoles.map(r => `<option value="${r.id}" data-type="demon">${r.name}</option>`).join('')}
                        </optgroup>
                        ` : ''}
                    </select>
                </div>
                <div id="pitHagPreview" style="margin-top: var(--spacing-md); padding: var(--spacing-md); background: rgba(0,0,0,0.3); border-radius: var(--radius-md); display: none;">
                    <p id="pitHagPreviewText" style="color: var(--color-gold);"></p>
                </div>
                <div id="pitHagDemonWarning" style="display: none; margin-top: var(--spacing-md); padding: var(--spacing-md); background: rgba(139, 0, 0, 0.3); border: 1px solid var(--color-blood); border-radius: var(--radius-md);">
                    <p style="color: var(--color-blood);">⚠️ 你正在创造一个新的恶魔！当晚的死亡将由说书人决定。</p>
                </div>
                <p style="margin-top: var(--spacing-sm); font-size: 0.85rem; color: var(--text-muted);">
                    只能选择当前不在场的角色。<br>
                    如果创造了新恶魔，当晚的死亡由说书人决定。
                </p>
            </div>
        `;
    } else if (item.action_type === 'info_first_night') {
        // 首夜信息类 - 自动生成信息，直接发送给玩家
        // 更新日期: 2026-01-12 - 洗衣妇、厨师等不需要玩家选择的角色
        const actionPlayer = gameState.players.find(p => p.id === item.player_id);
        const isDrunkOrPoisoned = actionPlayer && (actionPlayer.drunk || actionPlayer.poisoned);
        
        const infoResult = await apiCall(`/api/game/${gameState.gameId}/generate_info`, 'POST', {
            player_id: item.player_id
        });
        
        const generatedMessage = infoResult.message || '请根据角色能力提供相应信息';
        
        actionUI = `
            <div class="night-action-panel">
                <h5 style="color: var(--color-townsfolk); margin-bottom: var(--spacing-md);">📜 ${item.role_name} - 首夜信息</h5>
                ${isDrunkOrPoisoned ? `
                <div style="padding: var(--spacing-sm); background: rgba(243, 156, 18, 0.2); border: 1px solid var(--color-drunk); border-radius: var(--radius-sm); margin-bottom: var(--spacing-md);">
                    <span style="color: var(--color-drunk);">⚠️ 该玩家处于${actionPlayer.drunk ? '醉酒' : '中毒'}状态，可提供错误信息</span>
                </div>
                ` : ''}
                <div style="padding: var(--spacing-sm); background: rgba(100, 100, 100, 0.2); border-radius: var(--radius-sm); margin-bottom: var(--spacing-md);">
                    <p style="color: var(--text-muted); font-size: 0.85rem;">系统生成的真实信息：</p>
                </div>
                <div class="info-message" style="padding: var(--spacing-md); background: linear-gradient(135deg, rgba(139, 0, 0, 0.2), rgba(0, 0, 0, 0.3)); border-radius: var(--radius-lg); border: 1px solid var(--color-blood); margin-bottom: var(--spacing-md);">
                    <p style="color: var(--color-gold); font-weight: 500;">${generatedMessage}</p>
                </div>
                <div style="margin-top: var(--spacing-md);">
                    <label style="font-size: 0.85rem; color: var(--text-muted);">发送给玩家的信息：</label>
                    <textarea id="infoResultText" class="form-textarea" style="width: 100%; margin-top: var(--spacing-sm); min-height: 60px; background: var(--bg-card-hover); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-sm); color: var(--text-primary); padding: var(--spacing-sm);">${generatedMessage}</textarea>
                </div>
            </div>
        `;
    } else {
        // 其他类型 - 通用界面
        actionUI = `
            <div class="night-action-panel">
                <h5 style="color: var(--color-gold); margin-bottom: var(--spacing-md);">⚡ 角色能力</h5>
                <div class="target-select-group">
                    <label>选择目标 (可选):</label>
                    <select id="nightActionTarget" class="form-select" onchange="updateNightActionTarget(this.value)">
                        <option value="">-- 不选择 --</option>
                        ${allPlayers.map(p => 
                            `<option value="${p.id}">${p.name}${p.alive ? '' : ' (死亡)'}</option>`
                        ).join('')}
                    </select>
                </div>
                <div style="margin-top: var(--spacing-md);">
                    <label>行动备注:</label>
                    <textarea id="infoResultText" class="form-textarea" placeholder="记录行动结果..." style="width: 100%; margin-top: var(--spacing-sm); min-height: 60px; background: var(--bg-card-hover); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-sm); color: var(--text-primary); padding: var(--spacing-sm);"></textarea>
                </div>
            </div>
        `;
    }
    
    // 更新日期: 2026-01-12 - 判断是否需要玩家选择目标
    // 需要玩家选择的角色类型
    const playerSelectRoles = ['fortune_teller', 'ravenkeeper', 'dreamer', 'seamstress', 'chambermaid'];
    const isPlayerSelectInfoRole = item.action_type === 'info_select' && playerSelectRoles.includes(item.role_id);
    
    // 首夜信息角色（不需要玩家选择）
    const isFirstNightInfo = item.action_type === 'info_first_night';
    
    // 不需要选择目标的其他信息角色
    const noTargetInfoRoles = ['empath', 'undertaker', 'oracle', 'flowergirl'];
    const isNoTargetInfoRole = item.action_type === 'info_select' && noTargetInfoRoles.includes(item.role_id);
    
    // 检查玩家是否在线
    const playerOnline = gameState.players.find(p => p.id === item.player_id)?.online || false;
    
    // 检查玩家是否已提交选择
    const hasPlayerChoice = currentNightActionTarget !== null;
    
    // 需要发送信息的角色
    const needsSendInfo = isPlayerSelectInfoRole || isFirstNightInfo || isNoTargetInfoRole;
    
    // 生成按钮 - 删除"通知行动"按钮，玩家行动自动推送
    let buttonsHTML = '';
    
    if (needsSendInfo) {
        // 信息类角色 - 显示"发送信息"按钮
        buttonsHTML = `
            <button class="btn btn-outline" onclick="sendInfoResultToPlayer(${item.player_id})" 
                    style="border-color: #27ae60; color: #27ae60;"
                    ${!playerOnline ? 'disabled title="玩家不在线"' : ''}>
                📤 发送信息 ${!playerOnline ? '(离线)' : ''}
            </button>
        `;
    }
    
    // 组合完整内容
    infoContent.innerHTML = `
        ${headerHTML}
        <div id="livePlayerChoiceArea"></div>
        ${actionUI}
        <div style="margin-top: var(--spacing-lg); display: flex; gap: var(--spacing-md); justify-content: center; flex-wrap: wrap;">
            ${buttonsHTML}
            <button class="btn btn-secondary" onclick="skipNightAction(${index})">跳过此行动</button>
            <button class="btn btn-primary" onclick="completeNightActionWithTarget(${index})">完成行动</button>
        </div>
    `;
    
    showModal('infoModal');
    
    // 启动模态框内的实时轮询，持续检查玩家是否提交了新选择
    startModalChoicePolling(item.player_id, index);
}

// 模态框内实时轮询玩家选择
let modalChoicePollingTimer = null;

function startModalChoicePolling(playerId, nightIndex) {
    stopModalChoicePolling();
    
    const poll = async () => {
        if (!gameState.gameId || gameState.currentPhase !== 'night') {
            stopModalChoicePolling();
            return;
        }
        
        try {
            const choicesResult = await apiCall(`/api/storyteller/player_choices/${gameState.gameId}`);
            if (choicesResult.choices && choicesResult.choices[playerId]) {
                const choice = choicesResult.choices[playerId];
                if (!choice.confirmed) {
                    const area = document.getElementById('livePlayerChoiceArea');
                    if (area && !area.dataset.shown) {
                        area.dataset.shown = 'true';
                        
                        // 预设选择到当前目标
                        if (choice.targets && choice.targets.length > 0) {
                            currentNightActionTarget = choice.targets[0];
                            if (choice.targets.length > 1) {
                                currentNightActionSecondTarget = choice.targets[1];
                            }
                        }
                        
                        // 信息类角色（需要生成信息）：重新渲染整个行动面板
                        const item = gameState.nightOrder[nightIndex];
                        const infoSelectRoles = ['fortune_teller', 'seamstress', 'chambermaid', 'dreamer'];
                        if (item && item.action_type === 'info_select' && infoSelectRoles.includes(item.role_id)) {
                            stopModalChoicePolling();
                            showToast('📱 玩家已提交选择，正在生成信息...');
                            await handleNightAction(nightIndex);
                            return;
                        }
                        
                        const targetNames = choice.target_names?.join(', ') || (choice.skipped ? '跳过' : '无');
                        const extraData = choice.extra_data || {};
                        
                        let extraInfo = '';
                        if (extraData.new_role_name) {
                            extraInfo = `<p style="color: var(--text-primary);">新角色: <strong>${extraData.new_role_name}</strong></p>`;
                        }
                        
                        area.innerHTML = `
                            <div style="padding: var(--spacing-md); background: rgba(52, 152, 219, 0.2); border: 1px solid #3498db; border-radius: var(--radius-md); margin-bottom: var(--spacing-md); animation: fadeIn 0.3s ease;">
                                <p style="color: #3498db; margin-bottom: var(--spacing-sm);">📱 玩家端已提交选择</p>
                                <p style="color: var(--text-primary);">选择目标: <strong>${choice.skipped ? '跳过行动' : targetNames}</strong></p>
                                ${extraInfo}
                                <p style="font-size: 0.8rem; color: var(--text-muted);">提交时间: ${new Date(choice.submitted_at).toLocaleTimeString()}</p>
                                <button class="btn btn-secondary" onclick="usePlayerChoice(${playerId})" style="margin-top: var(--spacing-sm); font-size: 0.85rem;">
                                    使用玩家选择
                                </button>
                            </div>
                        `;
                        
                        // 尝试同步到下拉框
                        const targetSelect = document.getElementById('nightActionTarget');
                        if (targetSelect) targetSelect.value = choice.targets[0];
                        const secondSelect = document.getElementById('nightActionSecondTarget');
                        if (secondSelect && choice.targets[1]) secondSelect.value = choice.targets[1];
                        
                        showToast('📱 玩家已提交选择');
                        stopModalChoicePolling();
                    }
                }
            }
        } catch (e) {
            // 忽略轮询错误
        }
    };
    
    modalChoicePollingTimer = setInterval(poll, 2000);
}

function stopModalChoicePolling() {
    if (modalChoicePollingTimer) {
        clearInterval(modalChoicePollingTimer);
        modalChoicePollingTimer = null;
    }
}

function updateNightActionTarget(value) {
    currentNightActionTarget = value ? parseInt(value) : null;
    
    // 检查是否有保护（仅对击杀类显示警告）
    const item = gameState.nightOrder[currentNightActionIndex];
    if (item.action_type === 'kill' && currentNightActionTarget) {
        const targetPlayer = gameState.players.find(p => p.id === currentNightActionTarget);
        const warning = document.getElementById('protectionWarning');
        if (warning && targetPlayer && targetPlayer.protected) {
            warning.style.display = 'block';
        } else if (warning) {
            warning.style.display = 'none';
        }
    }
}

function updateNightActionSecondTarget(value) {
    currentNightActionSecondTarget = value ? parseInt(value) : null;
}

function updateGrandchildPreview() {
    const preview = document.getElementById('grandchildPreview');
    const info = document.getElementById('grandchildInfo');
    
    if (currentNightActionTarget && preview && info) {
        const targetPlayer = gameState.players.find(p => p.id === currentNightActionTarget);
        if (targetPlayer) {
            preview.style.display = 'block';
            info.innerHTML = `你的孙子是 <strong style="color: var(--color-gold);">${targetPlayer.name}</strong>，` +
                `他的角色是 <strong style="color: var(--color-townsfolk);">${targetPlayer.role?.name || '未知'}</strong>`;
        }
    } else if (preview) {
        preview.style.display = 'none';
    }
}

// 更新日期: 2026-01-05 - 麻脸巫婆预览
function updatePitHagPreview() {
    const preview = document.getElementById('pitHagPreview');
    const previewText = document.getElementById('pitHagPreviewText');
    const demonWarning = document.getElementById('pitHagDemonWarning');
    const roleSelect = document.getElementById('pitHagRoleSelect');
    
    if (currentNightActionTarget && roleSelect && roleSelect.value) {
        const targetPlayer = gameState.players.find(p => p.id === currentNightActionTarget);
        const selectedOption = roleSelect.options[roleSelect.selectedIndex];
        const roleType = selectedOption.dataset.type;
        const roleName = selectedOption.text;
        
        if (targetPlayer && preview && previewText) {
            preview.style.display = 'block';
            previewText.innerHTML = `将把 <strong>${targetPlayer.name}</strong> (${targetPlayer.role?.name || '未知'}) 变为 <strong style="color: ${roleType === 'demon' ? 'var(--color-demon)' : roleType === 'minion' ? 'var(--color-minion)' : 'var(--color-townsfolk)'};">${roleName}</strong>`;
            
            // 检查是否创造恶魔
            if (demonWarning) {
                if (roleType === 'demon' && targetPlayer.role_type !== 'demon') {
                    demonWarning.style.display = 'block';
                } else {
                    demonWarning.style.display = 'none';
                }
            }
        }
    } else {
        if (preview) preview.style.display = 'none';
        if (demonWarning) demonWarning.style.display = 'none';
    }
}

// 水手醉酒选择
let currentSailorDrunkChoice = 'target';

function updateSailorDrunkPreview() {
    const choiceDiv = document.getElementById('sailorDrunkChoice');
    const preview = document.getElementById('sailorDrunkPreview');
    const nameSpan = document.getElementById('sailorDrunkName');
    
    if (currentNightActionTarget && choiceDiv && preview && nameSpan) {
        choiceDiv.style.display = 'block';
        updateSailorDrunkChoice(document.getElementById('sailorDrunkTarget')?.value || 'target');
    } else if (choiceDiv) {
        choiceDiv.style.display = 'none';
        if (preview) preview.style.display = 'none';
    }
}

function updateSailorDrunkChoice(value) {
    currentSailorDrunkChoice = value;
    const preview = document.getElementById('sailorDrunkPreview');
    const nameSpan = document.getElementById('sailorDrunkName');
    const item = gameState.nightOrder[currentNightActionIndex];
    
    if (preview && nameSpan && currentNightActionTarget) {
        preview.style.display = 'block';
        if (value === 'target') {
            const targetPlayer = gameState.players.find(p => p.id === currentNightActionTarget);
            nameSpan.textContent = targetPlayer ? targetPlayer.name : '目标玩家';
        } else {
            const sailorPlayer = gameState.players.find(p => p.id === item.player_id);
            nameSpan.textContent = sailorPlayer ? sailorPlayer.name + ' (水手)' : '水手';
        }
    }
}

async function generateInfoForTarget() {
    const item = gameState.nightOrder[currentNightActionIndex];
    if (!item) return;
    
    // 判断是否需要两个目标
    const needsTwoTargets = ['fortune_teller', 'seamstress', 'chambermaid'].includes(item.role_id);
    
    // 收集目标
    const targets = [];
    if (currentNightActionTarget) {
        targets.push(currentNightActionTarget);
    }
    if (needsTwoTargets && currentNightActionSecondTarget) {
        targets.push(currentNightActionSecondTarget);
    }
    
    // 检查是否满足生成条件
    const requiredTargets = needsTwoTargets ? 2 : 1;
    const infoMessage = document.getElementById('infoMessage');
    const infoMessageBox = document.getElementById('infoMessageBox');
    const generatedInfo = document.getElementById('generatedInfo');
    
    if (!infoMessage || !infoMessageBox || !generatedInfo) return;
    
    if (targets.length < requiredTargets) {
        generatedInfo.textContent = needsTwoTargets ? '请选择两名目标玩家' : '请选择目标玩家';
        generatedInfo.style.display = 'block';
        infoMessageBox.style.display = 'none';
        return;
    }
    
    // 调用API生成信息
    try {
        generatedInfo.textContent = '正在生成信息...';
        generatedInfo.style.display = 'block';
        
        const result = await apiCall(`/api/game/${gameState.gameId}/generate_info`, 'POST', {
            player_id: item.player_id,
            targets: targets
        });
        
        if (result && result.message) {
            generatedInfo.style.display = 'none';
            infoMessage.textContent = result.message;
            infoMessageBox.style.display = 'block';
            
            // 如果有醉酒/中毒标记，添加提示
            if (result.is_drunk_or_poisoned) {
                infoMessage.innerHTML = `${result.message}<br><small style="color: var(--color-drunk);">（玩家处于异常状态，可酌情提供错误信息）</small>`;
            }
        } else {
            generatedInfo.textContent = '无法生成信息，请手动输入';
            generatedInfo.style.display = 'block';
            infoMessageBox.style.display = 'none';
        }
    } catch (error) {
        console.error('生成信息失败:', error);
        generatedInfo.textContent = '生成信息失败，请手动输入';
        generatedInfo.style.display = 'block';
        infoMessageBox.style.display = 'none';
    }
}

async function skipNightAction(index) {
    const item = gameState.nightOrder[index];
    
    stopNightChoicePolling();
    stopModalChoicePolling();
    
    // 记录跳过的行动
    await apiCall(`/api/game/${gameState.gameId}/night_action`, 'POST', {
        player_id: item.player_id,
        action: item.role_name,
        target: null,
        result: '跳过',
        action_type: 'skip'
    });
    
    // 清除该玩家的待处理行动
    await apiCall('/api/storyteller/clear_pending_action', 'POST', {
        game_id: gameState.gameId,
        player_id: item.player_id
    });
    
    gameState.currentNightIndex = index + 1;
    renderNightOrder();
    closeModal('infoModal');
    
    addLogEntry(`${item.player_name} (${item.role_name}) 选择不行动`, 'night');
    
    // 自动通知下一位玩家行动
    await notifyNextPlayerAction(gameState.currentNightIndex);
}

async function completeNightActionWithTarget(index) {
    stopNightChoicePolling();
    stopModalChoicePolling();
    
    const item = gameState.nightOrder[index];
    const target = currentNightActionTarget;
    const secondTarget = currentNightActionSecondTarget;
    const infoText = document.getElementById('infoResultText')?.value || '';
    
    // 构建行动数据
    const actionData = {
        player_id: item.player_id,
        action: item.role_name,
        target: target,
        result: infoText || '已完成',
        action_type: item.action_type
    };
    
    // 如果有第二个目标，添加到结果中
    if (secondTarget) {
        actionData.result = `目标: ${target}, 第二目标: ${secondTarget}. ${infoText}`;
    }
    
    // 如果是醉酒类行动，添加持续时间
    if (item.action_type === 'drunk') {
        const durationSelect = document.getElementById('drunkDuration');
        const duration = durationSelect ? parseInt(durationSelect.value) : 3;
        actionData.extra_data = { duration: duration };
    }
    
    // 水手特殊处理：发送醉酒选择
    if (item.action_type === 'sailor_drunk' && target) {
        actionData.extra_data = { drunk_choice: currentSailorDrunkChoice };
    }
    
    // 旅店老板特殊处理：发送第二个目标和醉酒目标
    if (item.role_id === 'innkeeper' && item.action_type === 'protect' && secondTarget) {
        const drunkTargetSelect = document.getElementById('drunkTarget');
        const drunkChoice = drunkTargetSelect ? drunkTargetSelect.value : 'first';
        const drunkTargetId = drunkChoice === 'first' ? target : secondTarget;
        
        actionData.extra_data = {
            second_target: secondTarget,
            drunk_target: drunkTargetId
        };
    }
    
    // 更新日期: 2026-01-05 - 沙巴洛斯特殊处理：发送第二个目标和复活目标
    if (item.action_type === 'shabaloth_kill') {
        const reviveSelect = document.getElementById('shabalothReviveTarget');
        const reviveTargetId = reviveSelect ? parseInt(reviveSelect.value) || null : null;
        
        actionData.extra_data = {
            second_target: secondTarget,
            revive_target: reviveTargetId
        };
    }
    
    // 更新日期: 2026-01-05 - 珀特殊处理：发送多个目标
    if (item.action_type === 'po_kill') {
        const targets = [];
        if (target) targets.push(target);
        
        const secondTargetSelect = document.getElementById('poSecondTarget');
        const thirdTargetSelect = document.getElementById('poThirdTarget');
        
        if (secondTargetSelect && secondTargetSelect.value) {
            targets.push(parseInt(secondTargetSelect.value));
        }
        if (thirdTargetSelect && thirdTargetSelect.value) {
            targets.push(parseInt(thirdTargetSelect.value));
        }
        
        actionData.extra_data = { targets: targets };
    }
    
    // 更新日期: 2026-01-05 - 麻脸巫婆特殊处理：发送新角色ID
    if (item.action_type === 'pit_hag' && target) {
        const roleSelect = document.getElementById('pitHagRoleSelect');
        const newRoleId = roleSelect ? roleSelect.value : null;
        
        if (newRoleId) {
            actionData.extra_data = { new_role_id: newRoleId };
        }
    }
    
    // 记录夜间行动
    await apiCall(`/api/game/${gameState.gameId}/night_action`, 'POST', actionData);
    
    // 更新日期: 2026-01-05 - 检查莽夫效果
    if (target) {
        const targetPlayer = gameState.players.find(p => p.id === target);
        if (targetPlayer && targetPlayer.role && targetPlayer.role.id === 'goon') {
            // 目标是莽夫，触发效果
            const goonResult = await apiCall(`/api/game/${gameState.gameId}/goon_effect`, 'POST', {
                selector_id: item.player_id,
                goon_id: target
            });
            
            if (goonResult.success && !goonResult.already_chosen) {
                if (goonResult.alignment_changed) {
                    addLogEntry(`💪 ${goonResult.selector_name} 选择了莽夫 ${goonResult.goon_name}，${goonResult.selector_name} 喝醉了，莽夫变为${goonResult.new_alignment}阵营`, 'night');
                    // 更新本地状态
                    const selector = gameState.players.find(p => p.id === item.player_id);
                    if (selector) {
                        selector.drunk = true;
                    }
                    targetPlayer.goon_alignment = goonResult.new_alignment === '善良' ? 'good' : 'evil';
                }
            }
        }
    }
    
    // 更新本地玩家状态
    if (item.action_type === 'protect' && target) {
        const targetPlayer = gameState.players.find(p => p.id === target);
        if (targetPlayer) {
            targetPlayer.protected = true;
        }
        
        // 旅店老板特殊处理：第二个目标也要保护，且其中一人醉酒
        if (item.role_id === 'innkeeper' && secondTarget) {
            const secondTargetPlayer = gameState.players.find(p => p.id === secondTarget);
            if (secondTargetPlayer) {
                secondTargetPlayer.protected = true;
            }
            
            // 处理醉酒
            const drunkTargetSelect = document.getElementById('drunkTarget');
            const drunkChoice = drunkTargetSelect ? drunkTargetSelect.value : 'first';
            const drunkPlayerId = drunkChoice === 'first' ? target : secondTarget;
            const drunkPlayer = gameState.players.find(p => p.id === drunkPlayerId);
            if (drunkPlayer) {
                drunkPlayer.drunk = true;
                drunkPlayer.drunk_until = {
                    day: gameState.dayNumber + 1,
                    night: gameState.nightNumber + 1
                };
            }
        }
    } else if (item.action_type === 'poison' && target) {
        const targetPlayer = gameState.players.find(p => p.id === target);
        if (targetPlayer) {
            targetPlayer.poisoned = true;
        }
    } else if (item.action_type === 'drunk' && target) {
        const targetPlayer = gameState.players.find(p => p.id === target);
        if (targetPlayer) {
            targetPlayer.drunk = true;
            const durationSelect = document.getElementById('drunkDuration');
            const duration = durationSelect ? parseInt(durationSelect.value) : 3;
            targetPlayer.drunk_until = {
                day: gameState.dayNumber + duration,
                night: gameState.nightNumber + duration
            };
        }
        // 标记一次性技能已使用
        const actionPlayer = gameState.players.find(p => p.id === item.player_id);
        if (actionPlayer) {
            actionPlayer.ability_used = true;
        }
    } else if (item.action_type === 'grandchild_select' && target) {
        // 祖母选择孙子
        const targetPlayer = gameState.players.find(p => p.id === target);
        const grandmotherPlayer = gameState.players.find(p => p.id === item.player_id);
        if (targetPlayer) {
            targetPlayer.is_grandchild = true;
            targetPlayer.grandchild_of = item.player_id;
        }
        if (grandmotherPlayer) {
            grandmotherPlayer.grandchild_id = target;
        }
    } else if (item.action_type === 'sailor_drunk' && target) {
        // 水手 - 自己或目标醉酒
        const drunkPlayerId = currentSailorDrunkChoice === 'target' ? target : item.player_id;
        const drunkPlayer = gameState.players.find(p => p.id === drunkPlayerId);
        if (drunkPlayer) {
            drunkPlayer.drunk = true;
            drunkPlayer.drunk_until = {
                day: gameState.dayNumber + 1,
                night: gameState.nightNumber + 1
            };
        }
    } else if (item.action_type === 'pukka_poison' && target) {
        // 普卡 - 前一个目标清除中毒，新目标中毒
        const pukkaPlayer = gameState.players.find(p => p.id === item.player_id);
        
        // 清除前一个目标的中毒状态
        if (pukkaPlayer && pukkaPlayer.pukka_previous_target) {
            const previousTarget = gameState.players.find(p => p.id === pukkaPlayer.pukka_previous_target);
            if (previousTarget) {
                previousTarget.poisoned = false;
                previousTarget.poisoned_by_pukka = false;
            }
        }
        
        // 新目标中毒
        const targetPlayer = gameState.players.find(p => p.id === target);
        if (targetPlayer) {
            targetPlayer.poisoned = true;
            targetPlayer.poisoned_by_pukka = true;
        }
        
        // 记录新目标
        if (pukkaPlayer) {
            pukkaPlayer.pukka_previous_target = target;
        }
    } else if (item.action_type === 'butler_master' && target) {
        // 管家 - 选择主人
        const butlerPlayer = gameState.players.find(p => p.id === item.player_id);
        const targetPlayer = gameState.players.find(p => p.id === target);
        
        // 清除旧主人的标记
        if (butlerPlayer && butlerPlayer.butler_master_id) {
            const oldMaster = gameState.players.find(p => p.id === butlerPlayer.butler_master_id);
            if (oldMaster) {
                oldMaster.is_butler_master = false;
            }
        }
        
        // 设置新主人
        if (butlerPlayer) {
            butlerPlayer.butler_master_id = target;
            butlerPlayer.butler_master_name = targetPlayer?.name || '';
        }
        if (targetPlayer) {
            targetPlayer.is_butler_master = true;
        }
    } else if (item.action_type === 'pit_hag' && target) {
        // 更新日期: 2026-01-05 - 麻脸巫婆 - 更新目标角色
        const roleSelect = document.getElementById('pitHagRoleSelect');
        const newRoleId = roleSelect ? roleSelect.value : null;
        
        if (newRoleId) {
            const targetPlayer = gameState.players.find(p => p.id === target);
            const selectedOption = roleSelect.options[roleSelect.selectedIndex];
            const roleType = selectedOption.dataset.type;
            const roleName = selectedOption.text;
            
            if (targetPlayer) {
                const oldRoleName = targetPlayer.role?.name || '未知';
                const oldRoleType = targetPlayer.role_type;
                
                // 更新角色
                targetPlayer.role = { id: newRoleId, name: roleName };
                targetPlayer.role_type = roleType;
                
                // 检查是否创造了新恶魔
                if (roleType === 'demon' && oldRoleType !== 'demon') {
                    addLogEntry(`🧙‍♀️ 麻脸巫婆将 ${targetPlayer.name} 从 ${oldRoleName} 变为 ${roleName}！⚠️ 创造了新恶魔！`, 'night');
                } else {
                    addLogEntry(`🧙‍♀️ 麻脸巫婆将 ${targetPlayer.name} 从 ${oldRoleName} 变为 ${roleName}`, 'night');
                }
            }
        }
    }
    
    // 清除当前玩家的待处理行动
    await apiCall('/api/storyteller/clear_pending_action', 'POST', {
        game_id: gameState.gameId,
        player_id: item.player_id
    });
    
    gameState.currentNightIndex = index + 1;
    renderNightOrder();
    renderPlayerCircle(); // 更新玩家圈显示状态
    closeModal('infoModal');
    
    // 生成日志
    let logMessage = `${item.player_name} (${item.role_name}) 完成了夜间行动`;
    if (target) {
        const targetPlayer = gameState.players.find(p => p.id === target);
        if (targetPlayer) {
            logMessage += ` -> ${targetPlayer.name}`;
        }
    }
    addLogEntry(logMessage, 'night');
    
    // 更新日期: 2026-01-12 - 自动推送下一位玩家的行动
    await notifyNextPlayerAction(gameState.currentNightIndex);
}

// 自动通知下一位玩家行动（支持跳过离线玩家）
async function notifyNextPlayerAction(nextIndex) {
    if (!gameState.nightOrder || nextIndex >= gameState.nightOrder.length) {
        return;
    }
    
    const nextItem = gameState.nightOrder[nextIndex];
    const nextPlayer = gameState.players.find(p => p.id === nextItem.player_id);
    
    // 确定行动配置
    const actionConfig = {
        max_targets: 1,
        can_skip: true,
        use_alive_only: true,
        description: nextItem.ability || nextPlayer?.role?.ability || ''
    };
    
    // 根据不同角色调整配置
    const roleId = nextItem.role_id;
    const actionType = nextItem.action_type;
    
    if (roleId === 'fortune_teller') {
        actionConfig.max_targets = 2;
        actionConfig.use_alive_only = false;
        actionConfig.description = '选择两名玩家进行占卜，你会得知他们中是否有恶魔';
    } else if (actionType === 'investigate') {
        actionConfig.max_targets = 2;
        actionConfig.description = '选择两名玩家，你会得知他们中是否有恶魔';
    } else if (actionType === 'shabaloth_kill') {
        actionConfig.max_targets = 2;
        actionConfig.description = '选择两名玩家，他们今晚将死亡';
    } else if (actionType === 'po_kill') {
        const poPlayer = gameState.players.find(p => p.id === nextItem.player_id);
        const canKillThree = poPlayer && poPlayer.po_skipped_last_night;
        actionConfig.max_targets = canKillThree ? 3 : 1;
        actionConfig.description = canKillThree ? '选择最多3名玩家击杀' : '选择1名玩家击杀（或跳过以下次击杀3人）';
    } else if (actionType === 'pit_hag') {
        actionConfig.special = 'pit_hag';
        actionConfig.description = '选择一名玩家和一个角色，该玩家将变成那个角色';
    } else if (['empath', 'undertaker', 'oracle', 'flowergirl'].includes(roleId)) {
        actionConfig.is_info = true;
        actionConfig.can_select = false;
    } else if (['washerwoman', 'librarian', 'investigator', 'chef', 'clockmaker'].includes(roleId)) {
        actionConfig.is_info = true;
        actionConfig.can_select = false;
    }
    
    // 即使玩家离线也发送通知（玩家上线后会收到）
    await apiCall('/api/storyteller/notify_action', 'POST', {
        game_id: gameState.gameId,
        player_id: nextItem.player_id,
        action_type: actionType,
        action_config: actionConfig
    });
    
    const onlineStatus = nextPlayer?.online ? '' : ' (离线，等待上线)';
    addLogEntry(`📱 已通知 ${nextPlayer?.name || '玩家'} 进行行动${onlineStatus}`, 'info');
    
    // 启动轮询，等待该玩家提交选择
    startNightChoicePolling(nextItem.player_id, nextIndex);
}

// 夜间选择轮询 - 自动检测玩家提交并通知说书人
let nightChoicePollingTimer = null;
let nightChoicePollingPlayerId = null;

function startNightChoicePolling(playerId, nightIndex) {
    stopNightChoicePolling();
    nightChoicePollingPlayerId = playerId;
    
    const poll = async () => {
        if (!gameState.gameId || gameState.currentPhase !== 'night') {
            stopNightChoicePolling();
            return;
        }
        
        try {
            const result = await apiCall(`/api/storyteller/night_progress/${gameState.gameId}`);
            if (!result || result.error) return;
            
            const submitted = result.submitted_choices || {};
            const choice = submitted[playerId];
            
            if (choice && !choice.confirmed) {
                // 玩家已提交选择 - 更新说书人界面上的提示
                updateNightOrderWithChoice(playerId, nightIndex, choice);
            }
        } catch (e) {
            console.error('轮询玩家选择失败:', e);
        }
    };
    
    poll();
    nightChoicePollingTimer = setInterval(poll, 2000);
}

function stopNightChoicePolling() {
    if (nightChoicePollingTimer) {
        clearInterval(nightChoicePollingTimer);
        nightChoicePollingTimer = null;
    }
    nightChoicePollingPlayerId = null;
}

function updateNightOrderWithChoice(playerId, nightIndex, choice) {
    const item = gameState.nightOrder[nightIndex];
    if (!item || item.player_id !== playerId) return;
    
    // 在夜间顺序列表中标记该玩家已提交
    const orderItems = document.querySelectorAll('.night-order-item');
    const targetItem = orderItems[nightIndex];
    if (targetItem && !targetItem.querySelector('.player-choice-badge')) {
        const badge = document.createElement('div');
        badge.className = 'player-choice-badge';
        badge.style.cssText = 'background: rgba(52,152,219,0.3); border: 1px solid #3498db; border-radius: 4px; padding: 2px 8px; font-size: 0.8rem; color: #3498db; margin-top: 4px;';
        const targetNames = choice.target_names?.join(', ') || (choice.skipped ? '跳过' : '无');
        badge.textContent = `📱 已选择: ${targetNames}`;
        targetItem.querySelector('.night-order-info')?.appendChild(badge);
    }
}

// completeNightAction 已被 completeNightActionWithTarget 替代

async function startDay() {
    stopNightChoicePolling();
    stopModalChoicePolling();
    
    // 检查镇长替死
    const mayorCheck = await checkMayorSubstitute();
    if (mayorCheck === 'cancelled') {
        return; // 用户取消了操作
    }
    
    // 检查守鸦人是否被触发
    await checkRavenkeeperTrigger();
    
    const result = await apiCall(`/api/game/${gameState.gameId}/start_day`, 'POST');
    
    if (!result.success) {
        alert(result.error || '开始白天失败');
        return;
    }
    
    gameState.currentPhase = 'day';
    gameState.dayNumber = result.day_number;
    gameState.nominations = [];
    
    // 重置所有玩家的保护状态（保护只持续一夜）
    gameState.players.forEach(p => {
        p.protected = false;
    });
    
    // 处理小恶魔传刀事件
    if (result.imp_starpass && result.imp_starpass.length > 0) {
        result.imp_starpass.forEach(starpass => {
            addLogEntry(`🗡️ ${starpass.old_imp_name} (小恶魔) 自杀传刀！${starpass.new_imp_name} 成为新的小恶魔！`, 'game_event');
            // 更新本地玩家角色
            const newImp = gameState.players.find(p => p.id === starpass.new_imp_id);
            if (newImp) {
                newImp.role = { id: 'imp', name: '小恶魔' };
                newImp.role_type = 'demon';
            }
        });
    }
    
    // 处理夜间死亡
    if (result.night_deaths && result.night_deaths.length > 0) {
        result.night_deaths.forEach(death => {
            const player = gameState.players.find(p => p.id === death.player_id);
            if (player) {
                player.alive = false;
            }
            addLogEntry(`${death.player_name} 在夜间死亡 (${death.cause})`, 'death');
        });
    } else {
        addLogEntry('今晚无人死亡', 'phase');
    }
    
    // 处理红唇女郎触发
    if (result.scarlet_woman_triggered) {
        addLogEntry(`💋 红唇女郎 ${result.new_demon_name} 继承了恶魔身份！`, 'game_event');
        // 更新本地玩家角色
        const scarletWoman = gameState.players.find(p => p.name === result.new_demon_name);
        if (scarletWoman) {
            scarletWoman.role_type = 'demon';
        }
    }
    
    // 检查游戏结束
    if (result.game_end && result.game_end.ended) {
        showGameEnd(result.game_end);
        return;
    }
    
    // 更新日期: 2026-01-05 - 检查月之子触发（夜间死亡）
    setTimeout(() => checkMoonchildTrigger(), 500);
    
    updatePhaseIndicator('day');
    updateDayNightIndicator();
    renderPlayerCircle();
    updatePlayerSelects();
    
    // 显示提名面板，隐藏夜间面板
    document.getElementById('nightPanel').style.display = 'none';
    document.getElementById('nominationPanel').style.display = 'block';
    
    // 更新按钮状态
    document.getElementById('startNightBtn').disabled = false;
    document.getElementById('startDayBtn').disabled = true;
    
    // 更新日期: 2026-01-05 - 检查并更新杀手能力状态
    await checkSlayerAbility();
    
    addLogEntry(`第 ${gameState.dayNumber} 天开始`, 'phase');
}

// 更新日期: 2026-01-05 - 检查杀手能力状态
// 更新日期: 2026-01-12 - 添加通知玩家行动按钮
async function checkSlayerAbility() {
    const slayerSection = document.getElementById('slayerAbilitySection');
    const slayerTargetSelect = document.getElementById('slayerTargetSelect');
    
    if (!slayerSection || !slayerTargetSelect) return;
    
    const result = await apiCall(`/api/game/${gameState.gameId}/slayer_status`);
    
    if (result.has_slayer && !result.ability_used) {
        // 有杀手且能力未使用
        slayerSection.style.display = 'block';
        
        // 填充目标选择
        const alivePlayers = gameState.players.filter(p => p.alive && p.id !== result.slayer_id);
        slayerTargetSelect.innerHTML = '<option value="">选择目标</option>' + 
            alivePlayers.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        
        // 存储杀手 ID
        slayerSection.dataset.slayerId = result.slayer_id;
        slayerSection.dataset.slayerName = result.slayer_name;
        
        // 检查玩家是否在线
        const slayerPlayer = gameState.players.find(p => p.id === result.slayer_id);
        const isOnline = slayerPlayer?.online || false;
        
        // 添加通知玩家按钮
        let notifyBtn = document.getElementById('notifySlayerBtn');
        if (!notifyBtn) {
            notifyBtn = document.createElement('button');
            notifyBtn.id = 'notifySlayerBtn';
            notifyBtn.className = 'btn btn-outline';
            notifyBtn.style.cssText = 'margin-left: 0.5rem; border-color: #3498db; color: #3498db;';
            notifyBtn.onclick = () => notifySlayerAction(result.slayer_id);
            slayerSection.querySelector('.ability-buttons')?.appendChild(notifyBtn);
        }
        notifyBtn.textContent = `📱 通知杀手行动 ${!isOnline ? '(离线)' : ''}`;
        notifyBtn.disabled = !isOnline;
        
        // 检查是否有玩家提交的选择
        const choicesResult = await apiCall(`/api/storyteller/player_choices/${gameState.gameId}`);
        if (choicesResult.choices && choicesResult.choices[result.slayer_id]) {
            const choice = choicesResult.choices[result.slayer_id];
            if (!choice.confirmed && choice.targets && choice.targets.length > 0) {
                // 显示玩家选择
                let choiceInfo = document.getElementById('slayerChoiceInfo');
                if (!choiceInfo) {
                    choiceInfo = document.createElement('div');
                    choiceInfo.id = 'slayerChoiceInfo';
                    choiceInfo.style.cssText = 'margin-top: 0.5rem; padding: 0.5rem; background: rgba(52, 152, 219, 0.2); border-radius: 4px;';
                    slayerSection.appendChild(choiceInfo);
                }
                choiceInfo.innerHTML = `
                    <span style="color: #3498db;">📱 杀手选择: ${choice.target_names?.join(', ')}</span>
                    <button class="btn btn-secondary" onclick="useSlayerPlayerChoice(${result.slayer_id})" style="margin-left: 0.5rem; font-size: 0.8rem;">
                        使用玩家选择
                    </button>
                `;
            }
        }
    } else {
        // 无杀手或能力已使用
        slayerSection.style.display = 'none';
    }
}

// 通知杀手玩家进行行动
async function notifySlayerAction(slayerId) {
    const slayerPlayer = gameState.players.find(p => p.id === slayerId);
    if (!slayerPlayer) return;
    
    const result = await apiCall('/api/storyteller/notify_day_action', 'POST', {
        game_id: gameState.gameId,
        player_id: slayerId,
        action_config: {
            max_targets: 1,
            can_skip: true,
            description: '🗡️ 杀手能力：公开选择一名玩家，如果该玩家是恶魔，则立即死亡。此能力只能使用一次。',
            action_name: 'slayer'
        }
    });
    
    if (result.success) {
        showToast(`已通知 ${slayerPlayer.name} 进行杀手行动`);
        // 开始轮询玩家选择
        startPollingSlayerChoice(slayerId);
    } else {
        showToast('通知失败: ' + (result.error || '未知错误'));
    }
}

// 轮询杀手的选择
let slayerChoicePollingInterval = null;

function startPollingSlayerChoice(slayerId) {
    if (slayerChoicePollingInterval) {
        clearInterval(slayerChoicePollingInterval);
    }
    
    const poll = async () => {
        try {
            const choicesResult = await apiCall(`/api/storyteller/player_choices/${gameState.gameId}`);
            if (choicesResult.choices && choicesResult.choices[slayerId]) {
                const choice = choicesResult.choices[slayerId];
                if (!choice.confirmed) {
                    clearInterval(slayerChoicePollingInterval);
                    slayerChoicePollingInterval = null;
                    
                    // 刷新杀手面板
                    await checkSlayerAbility();
                    showToast('杀手已提交选择！');
                }
            }
        } catch (e) {
            console.log('轮询杀手选择失败:', e);
        }
    };
    
    slayerChoicePollingInterval = setInterval(poll, 2000);
    
    // 5分钟后停止
    setTimeout(() => {
        if (slayerChoicePollingInterval) {
            clearInterval(slayerChoicePollingInterval);
            slayerChoicePollingInterval = null;
        }
    }, 300000);
}

// 使用杀手玩家的选择
async function useSlayerPlayerChoice(slayerId) {
    const choicesResult = await apiCall(`/api/storyteller/player_choices/${gameState.gameId}`);
    if (choicesResult.choices && choicesResult.choices[slayerId]) {
        const choice = choicesResult.choices[slayerId];
        if (choice.targets && choice.targets.length > 0) {
            const slayerTargetSelect = document.getElementById('slayerTargetSelect');
            if (slayerTargetSelect) {
                slayerTargetSelect.value = choice.targets[0];
                showToast('已应用杀手选择');
            }
        }
    }
}

// ==================== 发送信息给玩家（夜间结果） ====================

// 显示发送信息弹窗（用于夜间结果）
function showSendInfoModal(playerId, playerName) {
    const item = gameState.nightOrder[currentNightActionIndex];
    const player = gameState.players.find(p => p.id === playerId);
    const isDrunkOrPoisoned = player && (player.drunk || player.poisoned);
    
    let modal = document.getElementById('sendInfoModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'sendInfoModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3>📤 发送夜间结果给 ${playerName}</h3>
                <button class="modal-close" onclick="closeModal('sendInfoModal')">&times;</button>
            </div>
            <div class="modal-body">
                ${isDrunkOrPoisoned ? `
                <div style="padding: var(--spacing-sm); background: rgba(243, 156, 18, 0.2); border: 1px solid var(--color-drunk); border-radius: var(--radius-sm); margin-bottom: var(--spacing-md);">
                    <span style="color: var(--color-drunk);">⚠️ 该玩家处于${player.drunk ? '醉酒' : '中毒'}状态</span>
                </div>
                ` : ''}
                
                <div class="target-select-group">
                    <label>信息类型:</label>
                    <select id="infoType" class="form-select" onchange="updateInfoPresets()">
                        <option value="number">数字结果 (如厨师、共情者)</option>
                        <option value="yes_no">是/否结果 (如占卜师)</option>
                        <option value="player">玩家信息 (如洗衣妇、图书管理员)</option>
                        <option value="role">角色信息</option>
                        <option value="custom">自定义信息</option>
                    </select>
                </div>
                
                <div id="infoInputArea" style="margin-top: var(--spacing-md);">
                    <div id="numberInput">
                        <label>数字:</label>
                        <div style="display: flex; gap: var(--spacing-sm); margin-top: var(--spacing-sm);">
                            <button class="btn btn-secondary" onclick="setInfoValue('0')" style="flex: 1;">0</button>
                            <button class="btn btn-secondary" onclick="setInfoValue('1')" style="flex: 1;">1</button>
                            <button class="btn btn-secondary" onclick="setInfoValue('2')" style="flex: 1;">2</button>
                            <button class="btn btn-secondary" onclick="setInfoValue('3')" style="flex: 1;">3</button>
                        </div>
                    </div>
                </div>
                
                <div class="target-select-group" style="margin-top: var(--spacing-md);">
                    <label>最终信息内容:</label>
                    <textarea id="finalInfoContent" class="form-textarea" rows="3" placeholder="输入要发送的信息..."
                        style="width: 100%; margin-top: var(--spacing-sm); background: var(--bg-card-hover); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-sm); color: var(--text-primary); padding: var(--spacing-sm);"></textarea>
                </div>
                
                ${isDrunkOrPoisoned ? `
                <div style="margin-top: var(--spacing-md);">
                    <label>
                        <input type="checkbox" id="sendFakeInfo"> 
                        <span style="color: var(--color-drunk);">发送错误/迷惑信息</span>
                    </label>
                </div>
                ` : ''}
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal('sendInfoModal')">取消</button>
                <button class="btn btn-primary" onclick="sendInfoToPlayer(${playerId})">发送信息</button>
            </div>
        </div>
    `;
    
    modal.dataset.playerId = playerId;
    openModal('sendInfoModal');
    updateInfoPresets();
}

// 更新信息输入区域
function updateInfoPresets() {
    const infoType = document.getElementById('infoType').value;
    const inputArea = document.getElementById('infoInputArea');
    const alivePlayers = gameState.players.filter(p => p.alive);
    
    if (infoType === 'number') {
        inputArea.innerHTML = `
            <label>选择数字:</label>
            <div style="display: flex; gap: var(--spacing-sm); margin-top: var(--spacing-sm); flex-wrap: wrap;">
                <button class="btn btn-secondary" onclick="setInfoValue('0')" style="flex: 1; min-width: 50px;">0</button>
                <button class="btn btn-secondary" onclick="setInfoValue('1')" style="flex: 1; min-width: 50px;">1</button>
                <button class="btn btn-secondary" onclick="setInfoValue('2')" style="flex: 1; min-width: 50px;">2</button>
                <button class="btn btn-secondary" onclick="setInfoValue('3')" style="flex: 1; min-width: 50px;">3</button>
                <button class="btn btn-secondary" onclick="setInfoValue('4')" style="flex: 1; min-width: 50px;">4</button>
            </div>
        `;
    } else if (infoType === 'yes_no') {
        inputArea.innerHTML = `
            <label>选择结果:</label>
            <div style="display: flex; gap: var(--spacing-sm); margin-top: var(--spacing-sm);">
                <button class="btn btn-primary" onclick="setInfoValue('是')" style="flex: 1;">✓ 是</button>
                <button class="btn btn-secondary" onclick="setInfoValue('否')" style="flex: 1;">✗ 否</button>
            </div>
        `;
    } else if (infoType === 'player') {
        inputArea.innerHTML = `
            <label>选择玩家:</label>
            <select id="infoPlayerSelect" class="form-select" style="margin-top: var(--spacing-sm);" onchange="setPlayerInfo()">
                <option value="">-- 选择玩家 --</option>
                ${gameState.players.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
            <div style="margin-top: var(--spacing-sm);">
                <label>第二个玩家（可选）:</label>
                <select id="infoPlayerSelect2" class="form-select" style="margin-top: var(--spacing-sm);" onchange="setPlayerInfo()">
                    <option value="">-- 无 --</option>
                    ${gameState.players.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                </select>
            </div>
        `;
    } else if (infoType === 'role') {
        inputArea.innerHTML = `
            <label>选择角色:</label>
            <select id="infoRoleSelect" class="form-select" style="margin-top: var(--spacing-sm);" onchange="setRoleInfo()">
                <option value="">-- 选择角色 --</option>
                ${gameState.players.map(p => p.role ? `<option value="${p.role.id}">${p.role.name}</option>` : '').join('')}
            </select>
        `;
    } else {
        inputArea.innerHTML = `
            <p style="color: var(--text-muted);">在下方直接输入自定义信息</p>
        `;
    }
}

// 设置信息值
function setInfoValue(value) {
    const infoType = document.getElementById('infoType').value;
    const content = document.getElementById('finalInfoContent');
    
    if (infoType === 'number') {
        content.value = `你得到的数字是: ${value}`;
    } else if (infoType === 'yes_no') {
        content.value = `结果是: ${value}`;
    }
}

// 设置玩家信息
function setPlayerInfo() {
    const player1 = document.getElementById('infoPlayerSelect')?.value;
    const player2 = document.getElementById('infoPlayerSelect2')?.value;
    const content = document.getElementById('finalInfoContent');
    
    const p1 = gameState.players.find(p => p.id === parseInt(player1));
    const p2 = gameState.players.find(p => p.id === parseInt(player2));
    
    if (p1 && p2) {
        content.value = `${p1.name} 和 ${p2.name} 中有一人是 [角色名]`;
    } else if (p1) {
        content.value = `${p1.name} 是 [角色名]`;
    }
}

// 设置角色信息
function setRoleInfo() {
    const roleId = document.getElementById('infoRoleSelect')?.value;
    const content = document.getElementById('finalInfoContent');
    const role = gameState.players.find(p => p.role?.id === roleId)?.role;
    
    if (role) {
        content.value = `涉及的角色是: ${role.name}`;
    }
}

// 发送信息给玩家
async function sendInfoToPlayer(playerId) {
    const content = document.getElementById('finalInfoContent').value;
    const isFake = document.getElementById('sendFakeInfo')?.checked || false;
    
    if (!content.trim()) {
        showToast('请输入信息内容');
        return;
    }
    
    const result = await apiCall('/api/storyteller/send_message', 'POST', {
        game_id: gameState.gameId,
        player_id: playerId,
        type: 'night_result',
        title: '🌙 夜间结果',
        content: content
    });
    
    if (result.success) {
        showToast('信息已发送给玩家');
        
        // 清除玩家的待处理行动
        await apiCall('/api/storyteller/clear_pending_action', 'POST', {
            game_id: gameState.gameId,
            player_id: playerId
        });
        
        closeModal('sendInfoModal');
    } else {
        showToast('发送失败: ' + (result.error || '未知错误'));
    }
}

// ==================== 麻脸巫婆特殊处理 ====================

// 确认麻脸巫婆的行动（非恶魔情况）
async function confirmPitHagAction(pitHagPlayerId) {
    const result = await apiCall('/api/storyteller/confirm_pit_hag', 'POST', {
        game_id: gameState.gameId,
        pit_hag_player_id: pitHagPlayerId
    });
    
    if (result.success) {
        if (result.effect === 'no_effect') {
            showToast('角色已在场，无事发生');
            addLogEntry('🧙‍♀️ 麻脸巫婆的能力无效（选择的角色已在场）', 'ability');
        } else {
            showToast('麻脸巫婆的行动已确认');
            addLogEntry('🧙‍♀️ 麻脸巫婆改变了一名玩家的角色', 'ability');
        }
        
        // 刷新游戏状态
        await refreshGameState();
        
        // 关闭弹窗
        closeModal('infoModal');
    } else {
        showToast('确认失败: ' + (result.error || '未知错误'));
    }
}

// 确认麻脸巫婆创建恶魔
async function confirmPitHagDemon(pitHagPlayerId, allowDemonSurvive) {
    const confirmMsg = allowDemonSurvive ? 
        '确定让新创建的恶魔存活吗？这将改变游戏局势！' :
        '确定让新创建的恶魔今晚死亡吗？';
    
    if (!confirm(confirmMsg)) {
        return;
    }
    
    const result = await apiCall('/api/storyteller/confirm_pit_hag', 'POST', {
        game_id: gameState.gameId,
        pit_hag_player_id: pitHagPlayerId,
        allow_demon_survive: allowDemonSurvive
    });
    
    if (result.success) {
        if (allowDemonSurvive) {
            showToast('新恶魔已存活！');
            addLogEntry('🧙‍♀️ 麻脸巫婆创造了一个新恶魔，说书人决定让其存活', 'ability');
        } else {
            showToast('新恶魔今晚将死亡');
            addLogEntry('🧙‍♀️ 麻脸巫婆创造了一个新恶魔，说书人决定让其死亡', 'ability');
        }
        
        // 刷新游戏状态
        await refreshGameState();
        
        // 关闭弹窗
        closeModal('infoModal');
    } else {
        showToast('确认失败: ' + (result.error || '未知错误'));
    }
}

// 更新日期: 2026-01-05 - 使用杀手能力
async function useSlayerAbility() {
    const slayerSection = document.getElementById('slayerAbilitySection');
    const slayerTargetSelect = document.getElementById('slayerTargetSelect');
    
    const slayerId = parseInt(slayerSection.dataset.slayerId);
    const targetId = parseInt(slayerTargetSelect.value);
    
    if (!targetId) {
        alert('请选择一名目标');
        return;
    }
    
    const slayerName = slayerSection.dataset.slayerName;
    const targetPlayer = gameState.players.find(p => p.id === targetId);
    
    if (!confirm(`确定让 ${slayerName}（杀手）选择 ${targetPlayer.name} 吗？\n\n注意：此能力仅能使用一次！`)) {
        return;
    }
    
    const result = await apiCall(`/api/game/${gameState.gameId}/slayer_ability`, 'POST', {
        slayer_id: slayerId,
        target_id: targetId
    });
    
    if (result.success) {
        if (result.target_died) {
            addLogEntry(`🗡️ ${result.slayer_name}（杀手）选择了 ${result.target_name}，${result.target_name} 是恶魔，立即死亡！`, 'death');
            
            // 更新本地状态
            if (targetPlayer) {
                targetPlayer.alive = false;
            }
            
            // 检查游戏结束
            if (result.game_end && result.game_end.ended) {
                showGameEnd(result.game_end);
                return;
            }
            
            renderPlayerCircle();
            updatePlayerSelects();
        } else {
            addLogEntry(`🗡️ ${result.slayer_name}（杀手）选择了 ${result.target_name}，${result.reason || '目标不是恶魔，无事发生'}`, 'ability');
        }
        
        // 标记本地杀手能力已使用
        const slayer = gameState.players.find(p => p.id === slayerId);
        if (slayer) {
            slayer.ability_used = true;
        }
        
        // 隐藏杀手能力面板
        slayerSection.style.display = 'none';
    } else {
        alert(result.error || '使用能力失败');
    }
}

// 检查镇长替死
async function checkMayorSubstitute() {
    // 检查恶魔击杀目标是否包含镇长
    const mayor = gameState.players.find(p => p.role && p.role.id === 'mayor' && p.alive);
    if (!mayor) return 'continue';
    
    // 检查镇长是否被恶魔选中（需要从后端获取）
    const result = await apiCall(`/api/game/${gameState.gameId}/status`);
    const demonKills = result.demon_kills || [];
    
    const mayorTargeted = demonKills.some(k => k.target_id === mayor.id);
    if (!mayorTargeted) return 'continue';
    
    // 镇长没有中毒或醉酒
    if (mayor.poisoned || mayor.drunk) return 'continue';
    
    // 显示镇长替死选择弹窗
    return new Promise((resolve) => {
        showMayorSubstituteModal(mayor, resolve);
    });
}

function showMayorSubstituteModal(mayor, resolve) {
    let modal = document.getElementById('mayorSubstituteModal');
    if (!modal) {
        const modalHtml = `
            <div class="modal" id="mayorSubstituteModal">
                <div class="modal-content">
                    <h3>🏛️ 镇长能力触发</h3>
                    <p>镇长 <strong>${mayor.name}</strong> 即将被恶魔杀死</p>
                    <p>你可以选择让另一名玩家替镇长死亡，或让镇长自己死亡</p>
                    <div class="form-group">
                        <label>选择替死的玩家：</label>
                        <select id="mayorSubstituteSelect" class="form-select">
                            <option value="">-- 让镇长自己死亡 --</option>
                        </select>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-primary" id="confirmMayorSubstitute">确认</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        modal = document.getElementById('mayorSubstituteModal');
    }
    
    // 更新选项
    const select = document.getElementById('mayorSubstituteSelect');
    const otherPlayers = gameState.players.filter(p => p.id !== mayor.id && p.alive);
    select.innerHTML = '<option value="">-- 让镇长自己死亡 --</option>' + 
        otherPlayers.map(p => `<option value="${p.id}">${p.name} (${p.role?.name || '未知'})</option>`).join('');
    
    modal.classList.add('active');
    
    document.getElementById('confirmMayorSubstitute').onclick = async () => {
        const substituteId = select.value;
        
        const result = await apiCall(`/api/game/${gameState.gameId}/mayor_substitute`, 'POST', {
            substitute_id: substituteId ? parseInt(substituteId) : null
        });
        
        if (result.success) {
            if (result.substitute) {
                addLogEntry(`镇长的能力触发，${result.substitute} 替镇长死亡`, 'night');
            } else {
                addLogEntry(`镇长选择不使用替死能力`, 'night');
            }
        }
        
        modal.classList.remove('active');
        resolve('continue');
    };
}

// 检查守鸦人是否被触发
async function checkRavenkeeperTrigger() {
    const result = await apiCall(`/api/game/${gameState.gameId}/check_ravenkeeper`);
    
    if (result.triggered) {
        if (result.choice_made && result.result) {
            // 玩家已在自己的设备上完成了选择，直接显示结果
            addLogEntry(`🐦 守鸦人 ${result.player_name} 查验了 ${result.result.target_name}，得知角色为 ${result.result.role_name}`, 'night');
        } else {
            // 玩家尚未选择，显示说书人端弹窗（备用方案）
            await showRavenkeeperModal(result.player_id, result.player_name);
        }
    }
}

function showRavenkeeperModal(ravenkeeperPlayerId, ravenkeeperName) {
    return new Promise((resolve) => {
        let modal = document.getElementById('ravenkeeperModal');
        if (!modal) {
            const modalHtml = `
                <div class="modal" id="ravenkeeperModal">
                    <div class="modal-content">
                        <h3>🦅 守鸦人唤醒</h3>
                        <p>守鸦人 <strong id="ravenkeeperPlayerName"></strong> 在夜间死亡，被唤醒选择一名玩家</p>
                        <div class="form-group">
                            <label>选择要查看身份的玩家：</label>
                            <select id="ravenkeeperTargetSelect" class="form-select">
                                <option value="">-- 选择玩家 --</option>
                            </select>
                        </div>
                        <div id="ravenkeeperInfoResult" class="info-message" style="display:none;"></div>
                        <div class="modal-actions">
                            <button class="btn btn-primary" id="confirmRavenkeeper">确认并查看</button>
                            <button class="btn btn-secondary" id="closeRavenkeeper" style="display:none;">关闭</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            modal = document.getElementById('ravenkeeperModal');
        }
        
        document.getElementById('ravenkeeperPlayerName').textContent = ravenkeeperName;
        
        // 更新选项
        const select = document.getElementById('ravenkeeperTargetSelect');
        select.innerHTML = '<option value="">-- 选择玩家 --</option>' + 
            gameState.players.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        
        document.getElementById('ravenkeeperInfoResult').style.display = 'none';
        document.getElementById('closeRavenkeeper').style.display = 'none';
        document.getElementById('confirmRavenkeeper').style.display = 'inline-block';
        
        modal.classList.add('active');
        
        document.getElementById('confirmRavenkeeper').onclick = async () => {
            const targetId = select.value;
            if (!targetId) {
                alert('请选择一名玩家');
                return;
            }
            
            // 生成守鸦人信息
            const info = await apiCall(`/api/game/${gameState.gameId}/generate_info`, 'POST', {
                player_id: ravenkeeperPlayerId,
                targets: [parseInt(targetId)]
            });
            
            document.getElementById('ravenkeeperInfoResult').textContent = info.message;
            document.getElementById('ravenkeeperInfoResult').style.display = 'block';
            
            if (info.is_drunk_or_poisoned) {
                document.getElementById('ravenkeeperInfoResult').innerHTML += 
                    '<br><span class="warning">⚠️ 守鸦人中毒或醉酒，信息可能有误</span>';
            }
            
            document.getElementById('confirmRavenkeeper').style.display = 'none';
            document.getElementById('closeRavenkeeper').style.display = 'inline-block';
            
            addLogEntry(`守鸦人 ${ravenkeeperName} 查看了 ${gameState.players.find(p => p.id == targetId)?.name} 的身份`, 'night');
        };
        
        document.getElementById('closeRavenkeeper').onclick = () => {
            modal.classList.remove('active');
            resolve();
        };
    });
}

function updatePhaseIndicator(phase) {
    const indicator = document.getElementById('phaseIndicator');
    if (phase === 'night') {
        indicator.textContent = `第 ${gameState.nightNumber} 夜`;
        indicator.className = 'phase-indicator night';
    } else if (phase === 'day') {
        indicator.textContent = `第 ${gameState.dayNumber} 天`;
        indicator.className = 'phase-indicator day';
    } else {
        indicator.textContent = '设置中';
        indicator.className = 'phase-indicator';
    }
}

function updateDayNightIndicator() {
    const indicator = document.getElementById('dayNightIndicator');
    if (gameState.currentPhase === 'night') {
        indicator.innerHTML = `
            <span class="indicator-icon">🌙</span>
            <span class="indicator-text">第 ${gameState.nightNumber} 夜</span>
        `;
    } else {
        indicator.innerHTML = `
            <span class="indicator-icon">☀️</span>
            <span class="indicator-text">第 ${gameState.dayNumber} 天</span>
        `;
    }
}

// ===== 提名与投票 =====
async function handleNominate() {
    const nominatorId = parseInt(document.getElementById('nominatorSelect').value);
    const nomineeId = parseInt(document.getElementById('nomineeSelect').value);
    
    if (!nominatorId || !nomineeId) {
        alert('请选择提名者和被提名者');
        return;
    }
    
    const result = await apiCall(`/api/game/${gameState.gameId}/nominate`, 'POST', {
        nominator_id: nominatorId,
        nominee_id: nomineeId
    });
    
    if (!result.success) {
        alert(result.error || '提名失败');
        return;
    }
    
    gameState.nominations.push(result.nomination);
    
    // 检查贞洁者能力是否触发
    if (result.virgin_triggered) {
        // 更新提名者状态为死亡
        const nominator = gameState.players.find(p => p.id === nominatorId);
        if (nominator) {
            nominator.alive = false;
        }
        
        // 更新被提名者（贞洁者）的能力已使用状态
        const nominee = gameState.players.find(p => p.id === nomineeId);
        if (nominee) {
            nominee.virgin_ability_used = true;
        }
        
        renderPlayerCircle();
        renderNominations();
        addLogEntry(`⚡ 贞洁者能力触发！${result.executed_player} 是镇民，立即被处决！`, 'execution');
        
        // 显示贞洁者能力触发提示
        const confirmNight = confirm(
            `⚡ 贞洁者能力触发！\n\n` +
            `${result.executed_player} 提名了贞洁者，由于是镇民，立即被处决！\n\n` +
            `是否立即进入夜晚？`
        );
        
        if (confirmNight) {
            await startNight();
        }
        
        return;
    }
    
    renderNominations();
    
    // 重置选择框
    document.getElementById('nominatorSelect').value = '';
    document.getElementById('nomineeSelect').value = '';
}

function renderNominations() {
    const list = document.getElementById('nominationsList');
    
    if (gameState.nominations.length === 0) {
        list.innerHTML = '<p style="color: var(--text-muted); text-align: center;">暂无提名</p>';
        return;
    }
    
    list.innerHTML = gameState.nominations.map(nom => `
        <div class="nomination-item ${nom.status === 'executed' ? 'executed' : ''} ${nom.status === 'failed' ? 'failed' : ''} ${nom.status === 'virgin_triggered' ? 'virgin-triggered' : ''}">
            <div class="nomination-info">
                <span>${nom.nominator_name}${nom.status === 'virgin_triggered' ? ' 💀' : ''}</span>
                <span style="color: var(--color-blood);">➜</span>
                <span>${nom.nominee_name}${nom.status === 'virgin_triggered' ? ' (贞洁者)' : ''}</span>
            </div>
            <div class="nomination-votes">
                ${nom.status === 'virgin_triggered' ? 
                    '<span style="color: var(--color-blood); font-size: 0.85rem;">⚡ 贞洁者能力触发</span>' :
                    `<span class="vote-count-badge">${nom.vote_count} 票</span>
                    ${nom.status === 'pending' ? `<button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="openVoteModal(${nom.id})">投票</button>` : ''}`
                }
            </div>
        </div>
    `).join('');
}

let currentNominationId = null;

function openVoteModal(nominationId) {
    currentNominationId = nominationId;
    const nomination = gameState.nominations.find(n => n.id === nominationId);
    
    const alivePlayers = gameState.players.filter(p => p.alive);
    const requiredVotes = Math.floor(alivePlayers.length / 2) + 1;
    
    document.getElementById('voteModalTitle').textContent = `投票: ${nomination.nominee_name}`;
    document.getElementById('voteInfo').innerHTML = `
        <p><strong>${nomination.nominator_name}</strong> 提名了 <strong>${nomination.nominee_name}</strong></p>
        <p>需要 <strong>${requiredVotes}</strong> 票才能执行处决</p>
    `;
    
    // 生成投票格子
    const voteGrid = document.getElementById('voteGrid');
    voteGrid.innerHTML = gameState.players.map(player => {
        const voted = nomination.votes?.find(v => v.voter_id === player.id);
        const votedClass = voted ? (voted.vote ? 'voted-yes' : 'voted-no') : '';
        const deadClass = !player.alive ? 'dead' : '';
        const canVote = player.alive || player.vote_token;
        
        return `
            <div class="vote-player ${votedClass} ${deadClass}">
                <span class="vote-player-name">${player.name}</span>
                <div class="vote-buttons">
                    ${voted ? 
                        `<span style="font-size: 0.8rem;">${voted.vote ? '✓' : '✗'}</span>` :
                        `<button class="vote-btn yes" onclick="castVote(${nomination.id}, ${player.id}, true)" ${!canVote ? 'disabled' : ''}>✓</button>
                         <button class="vote-btn no" onclick="castVote(${nomination.id}, ${player.id}, false)" ${!canVote ? 'disabled' : ''}>✗</button>`
                    }
                </div>
            </div>
        `;
    }).join('');
    
    updateVoteCount(nomination);
    showModal('voteModal');
}

async function castVote(nominationId, voterId, vote) {
    const result = await apiCall(`/api/game/${gameState.gameId}/vote`, 'POST', {
        nomination_id: nominationId,
        voter_id: voterId,
        vote: vote
    });
    
    if (!result.success) {
        alert(result.error || '投票失败');
        return;
    }
    
    // 更新本地数据
    const nomination = gameState.nominations.find(n => n.id === nominationId);
    if (!nomination.votes) nomination.votes = [];
    
    const voter = gameState.players.find(p => p.id === voterId);
    nomination.votes.push({
        voter_id: voterId,
        voter_name: voter.name,
        vote: vote
    });
    
    if (vote) {
        nomination.vote_count++;
    }
    
    // 如果是死亡玩家投赞成票，消耗令牌
    if (!voter.alive && vote) {
        voter.vote_token = false;
    }
    
    // 刷新投票界面
    openVoteModal(nominationId);
}

function updateVoteCount(nomination) {
    document.getElementById('yesVotes').textContent = nomination.vote_count || 0;
    const alivePlayers = gameState.players.filter(p => p.alive);
    document.getElementById('requiredVotes').textContent = Math.floor(alivePlayers.length / 2) + 1;
}

// 更新日期: 2026-01-05 - 添加恶魔代言人保护和和平主义者干预
async function handleExecute() {
    if (!currentNominationId) return;
    
    const result = await apiCall(`/api/game/${gameState.gameId}/execute`, 'POST', {
        nomination_id: currentNominationId
    });
    
    if (!result.success) {
        alert(result.error || '处决失败');
        return;
    }
    
    const nomination = gameState.nominations.find(n => n.id === currentNominationId);
    
    // 更新日期: 2026-01-05 - 恶魔代言人保护检查
    if (result.protected_by_devils_advocate) {
        nomination.status = 'protected';
        addLogEntry(`🛡️ ${result.player.name} 被恶魔代言人保护，免于处决！`, 'game_event');
        closeModal('voteModal');
        renderNominations();
        renderPlayerCircle();
        updatePlayerSelects();
        return;
    }
    
    // 更新日期: 2026-01-05 - 弄臣保护检查
    if (result.fool_saved) {
        nomination.status = 'fool_saved';
        addLogEntry(`🃏 ${result.player.name} (弄臣) 首次死亡被避免！`, 'game_event');
        closeModal('voteModal');
        renderNominations();
        renderPlayerCircle();
        updatePlayerSelects();
        return;
    }
    
    // 更新日期: 2026-01-05 - 和平主义者干预
    if (result.pacifist_intervention) {
        // 显示和平主义者干预弹窗
        showPacifistModal(result);
        return;
    }
    
    if (result.executed) {
        nomination.status = 'executed';
        const player = gameState.players.find(p => p.id === nomination.nominee_id);
        if (player && !result.zombuul_fake_death) {
            player.alive = false;
        }
        
        // 更新日期: 2026-01-05 - 僵怖假死显示
        if (result.zombuul_fake_death) {
            const zombuul = gameState.players.find(p => p.id === nomination.nominee_id);
            if (zombuul) {
                zombuul.appears_dead = true;
            }
            addLogEntry(`💀 ${nomination.nominee_name} 被处决（看起来死了...）`, 'execution');
        } else {
            addLogEntry(`${nomination.nominee_name} 被处决`, 'execution');
        }
        
        // 检查圣徒被处决
        if (result.saint_executed) {
            addLogEntry(`⚡ 圣徒 ${nomination.nominee_name} 被处决！邪恶阵营获胜！`, 'game_end');
        }
        
        // 检查红唇女郎触发
        if (result.scarlet_woman_triggered) {
            addLogEntry(`💋 红唇女郎 ${result.new_demon_name} 继承了恶魔身份！游戏继续！`, 'game_event');
            // 更新本地玩家角色
            const scarletWoman = gameState.players.find(p => p.name === result.new_demon_name);
            if (scarletWoman) {
                scarletWoman.role_type = 'demon';
            }
        }
    } else {
        nomination.status = 'failed';
        addLogEntry(`${nomination.nominee_name} 未获得足够票数，逃过一劫`, 'execution');
    }
    
    closeModal('voteModal');
    renderNominations();
    renderPlayerCircle();
    updatePlayerSelects();
    
    // 检查游戏结束（包括圣徒触发）
    const gameEnd = result.game_end || (result.saint_executed ? 
        {ended: true, winner: 'evil', reason: '圣徒被处决'} : null);
    if (gameEnd && gameEnd.ended) {
        showGameEnd(gameEnd);
        return;
    }
    
    // 更新日期: 2026-01-05 - 检查月之子触发
    if (result.moonchild_triggered) {
        setTimeout(() => checkMoonchildTrigger(), 500);
    }
}

// 更新日期: 2026-01-05 - 和平主义者干预弹窗
function showPacifistModal(data) {
    const modal = document.getElementById('pacifistModal') || createPacifistModal();
    
    document.getElementById('pacifistNomineeName').textContent = data.nominee_name;
    document.getElementById('pacifistName').textContent = data.pacifist_name;
    document.getElementById('pacifistVoteInfo').textContent = `票数: ${data.vote_count}/${data.required_votes}`;
    
    // 存储数据供后续使用
    modal.dataset.nominationId = data.nomination_id;
    modal.dataset.nomineeId = data.nominee_id;
    
    openModal('pacifistModal');
}

function createPacifistModal() {
    const modal = document.createElement('div');
    modal.id = 'pacifistModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3>☮️ 和平主义者干预</h3>
                <button class="close-btn" onclick="closePacifistModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div style="text-align: center; margin-bottom: var(--spacing-lg);">
                    <p style="font-size: 1.1rem; margin-bottom: var(--spacing-sm);">
                        <strong id="pacifistNomineeName"></strong> 将被处决
                    </p>
                    <p id="pacifistVoteInfo" style="color: var(--text-muted);"></p>
                </div>
                <div style="padding: var(--spacing-md); background: rgba(39, 174, 96, 0.2); border-radius: var(--radius-md); margin-bottom: var(--spacing-lg);">
                    <p>场上存在 <strong id="pacifistName"></strong>（和平主义者）</p>
                    <p style="color: var(--color-alive); margin-top: var(--spacing-sm);">
                        和平主义者的能力：如果善良玩家因处决而死亡，可能改为他存活。
                    </p>
                </div>
                <p style="text-align: center; margin-bottom: var(--spacing-md);">
                    说书人决定该玩家是否存活：
                </p>
                <div style="display: flex; gap: var(--spacing-md); justify-content: center;">
                    <button class="btn btn-success" onclick="pacifistDecision(true)" style="padding: 12px 24px;">
                        ✓ 玩家存活
                    </button>
                    <button class="btn btn-danger" onclick="pacifistDecision(false)" style="padding: 12px 24px;">
                        ✗ 玩家死亡
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

async function pacifistDecision(survives) {
    const modal = document.getElementById('pacifistModal');
    const nominationId = parseInt(modal.dataset.nominationId);
    
    const result = await apiCall(`/api/game/${gameState.gameId}/pacifist_decision`, 'POST', {
        nomination_id: nominationId,
        survives: survives
    });
    
    if (!result.success) {
        alert(result.error || '操作失败');
        return;
    }
    
    const nomination = gameState.nominations.find(n => n.id === nominationId);
    
    if (survives) {
        nomination.status = 'pacifist_saved';
        addLogEntry(`☮️ ${nomination.nominee_name} 被和平主义者的能力保护，存活下来！`, 'game_event');
    } else {
        nomination.status = 'executed';
        const player = gameState.players.find(p => p.id === nomination.nominee_id);
        if (player) {
            player.alive = false;
        }
        addLogEntry(`${nomination.nominee_name} 被处决（和平主义者未能阻止）`, 'execution');
    }
    
    closePacifistModal();
    closeModal('voteModal');
    renderNominations();
    renderPlayerCircle();
    updatePlayerSelects();
    
    // 检查游戏结束
    if (result.game_end && result.game_end.ended) {
        showGameEnd(result.game_end);
    }
}

function closePacifistModal() {
    closeModal('pacifistModal');
}

// 更新日期: 2026-01-05 - 月之子能力弹窗
async function checkMoonchildTrigger() {
    const result = await apiCall(`/api/game/${gameState.gameId}/check_moonchild`);
    if (result.has_moonchild) {
        showMoonchildModal(result);
    }
}

function showMoonchildModal(data) {
    const modal = document.getElementById('moonchildModal') || createMoonchildModal();
    
    document.getElementById('moonchildName').textContent = data.moonchild_name;
    
    // 生成存活玩家选项
    const selectHtml = data.alive_players.map(p => 
        `<option value="${p.id}">${p.name}</option>`
    ).join('');
    document.getElementById('moonchildTargetSelect').innerHTML = 
        `<option value="">-- 不使用能力 --</option>` + selectHtml;
    
    // 存储数据供后续使用
    modal.dataset.moonchildId = data.moonchild_id;
    
    openModal('moonchildModal');
}

function createMoonchildModal() {
    const modal = document.createElement('div');
    modal.id = 'moonchildModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3>🌙 月之子能力</h3>
                <button class="close-btn" onclick="closeMoonchildModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div style="text-align: center; margin-bottom: var(--spacing-lg);">
                    <p style="font-size: 1.1rem; color: var(--color-outsider);">
                        <strong id="moonchildName"></strong> (月之子) 已死亡
                    </p>
                </div>
                <div style="padding: var(--spacing-md); background: rgba(128, 0, 128, 0.2); border-radius: var(--radius-md); margin-bottom: var(--spacing-lg);">
                    <p style="color: var(--color-outsider);">
                        月之子的能力：当你得知自己死亡时，你可以公开选择一名存活玩家。如果他是善良的，他死亡。
                    </p>
                </div>
                <div class="target-select-group">
                    <label>选择一名存活玩家:</label>
                    <select id="moonchildTargetSelect" class="form-select">
                        <option value="">-- 不使用能力 --</option>
                    </select>
                </div>
                <div style="display: flex; gap: var(--spacing-md); justify-content: center; margin-top: var(--spacing-lg);">
                    <button class="btn btn-primary" onclick="useMoonchildAbility()" style="padding: 12px 24px;">
                        🌙 使用能力
                    </button>
                    <button class="btn btn-secondary" onclick="skipMoonchildAbility()" style="padding: 12px 24px;">
                        跳过
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

async function useMoonchildAbility() {
    const modal = document.getElementById('moonchildModal');
    const moonchildId = parseInt(modal.dataset.moonchildId);
    const targetSelect = document.getElementById('moonchildTargetSelect');
    const targetId = targetSelect.value ? parseInt(targetSelect.value) : null;
    
    const result = await apiCall(`/api/game/${gameState.gameId}/moonchild_ability`, 'POST', {
        moonchild_id: moonchildId,
        target_id: targetId
    });
    
    if (!result.success) {
        alert(result.error || '操作失败');
        return;
    }
    
    if (result.used) {
        if (result.target_died) {
            addLogEntry(`🌙 月之子选择了 ${result.target_name}（善良玩家），${result.target_name} 死亡！`, 'death');
            const target = gameState.players.find(p => p.name === result.target_name);
            if (target) {
                target.alive = false;
            }
        } else {
            addLogEntry(`🌙 月之子选择了 ${result.target_name}（邪恶玩家），目标存活`, 'game_event');
        }
    } else {
        addLogEntry(`🌙 月之子选择不使用能力`, 'game_event');
    }
    
    closeMoonchildModal();
    renderPlayerCircle();
    updatePlayerSelects();
    
    // 检查游戏结束
    if (result.game_end && result.game_end.ended) {
        showGameEnd(result.game_end);
    }
}

async function skipMoonchildAbility() {
    const modal = document.getElementById('moonchildModal');
    const moonchildId = parseInt(modal.dataset.moonchildId);
    
    await apiCall(`/api/game/${gameState.gameId}/moonchild_ability`, 'POST', {
        moonchild_id: moonchildId,
        target_id: null
    });
    
    addLogEntry(`🌙 月之子选择不使用能力`, 'game_event');
    closeMoonchildModal();
}

function closeMoonchildModal() {
    closeModal('moonchildModal');
}

// ===== 角色图片加载 =====
const ROLE_IMG_EXTENSIONS = ['png', 'webp', 'jpg', 'jpeg', 'svg'];

function tryLoadRoleImageIntoAvatar(containerEl, roleId, fallbackEmoji) {
    let extIndex = 0;
    const img = new Image();
    
    function tryNext() {
        if (extIndex >= ROLE_IMG_EXTENSIONS.length) return;
        img.src = `/static/images/roles/${roleId}.${ROLE_IMG_EXTENSIONS[extIndex]}`;
        extIndex++;
    }
    
    img.onload = function() {
        containerEl.textContent = '';
        containerEl.appendChild(img);
    };
    img.onerror = tryNext;
    tryNext();
}

// 为动态生成的 HTML 提供角色图片 <img> 标签（带 onerror 回退）
function getRoleImageHTML(roleId, fallbackEmoji, size) {
    size = size || 80;
    if (!roleId) return `<span style="font-size: ${size * 0.6}px;">${fallbackEmoji || '👤'}</span>`;
    const fallback = (fallbackEmoji || '👤').replace(/'/g, "\\'");
    return `<img src="/static/images/roles/${roleId}.png"
        style="width: ${size}px; height: ${size}px; object-fit: contain;"
        onerror="this.onerror=null; tryRoleImageFallback(this, '${roleId}', '${fallback}', 1);"
        alt="${roleId}">`;
}

function tryRoleImageFallback(imgEl, roleId, fallbackEmoji, extIdx) {
    if (extIdx >= ROLE_IMG_EXTENSIONS.length) {
        const span = document.createElement('span');
        span.style.fontSize = imgEl.style.width ? (parseInt(imgEl.style.width) * 0.6) + 'px' : '2.5rem';
        span.textContent = fallbackEmoji || '👤';
        imgEl.parentNode.replaceChild(span, imgEl);
        return;
    }
    imgEl.onerror = function() {
        tryRoleImageFallback(imgEl, roleId, fallbackEmoji, extIdx + 1);
    };
    imgEl.src = `/static/images/roles/${roleId}.${ROLE_IMG_EXTENSIONS[extIdx]}`;
}

// ===== 玩家详情 =====
function openPlayerDetail(playerId) {
    console.log('openPlayerDetail called with playerId:', playerId); // 调试日志
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
        console.warn('Player not found:', playerId); // 调试日志
        return;
    }
    console.log('Opening player detail for:', player.name); // 调试日志
    
    document.getElementById('playerDetailName').textContent = player.name;
    
    const roleTypeLabels = {
        townsfolk: '镇民',
        outsider: '外来者',
        minion: '爪牙',
        demon: '恶魔'
    };
    
    const avatarClass = player.alive ? '' : 'dead';
    const avatarEmoji = player.alive ? '👤' : '💀';
    const roleId = player.role?.id;
    
    // 角色图片带 emoji 回退：先显示 emoji，JS 异步尝试加载图片
    const avatarId = `avatar_${player.id}_${Date.now()}`;
    
    document.getElementById('playerDetailContent').innerHTML = `
        <div class="player-detail-avatar ${avatarClass}" id="${avatarId}">${avatarEmoji}</div>
        <div class="player-detail-role" style="color: var(--color-${player.role_type || 'text-primary'});">
            ${player.role?.name || '未分配角色'}
        </div>
        <div class="player-detail-type">${roleTypeLabels[player.role_type] || ''}</div>
        <div class="player-detail-ability">
            <strong>能力:</strong><br>
            ${player.role?.ability || '无'}
        </div>
        <div class="player-status-controls">
            <label class="status-toggle ${player.poisoned ? 'active' : ''}" onclick="toggleStatus(${player.id}, 'poisoned')">
                <input type="checkbox" ${player.poisoned ? 'checked' : ''}>
                🧪 中毒
            </label>
            <label class="status-toggle ${player.drunk ? 'active' : ''}" onclick="toggleStatus(${player.id}, 'drunk')">
                <input type="checkbox" ${player.drunk ? 'checked' : ''}>
                🍺 醉酒
            </label>
            <label class="status-toggle ${player.protected ? 'active' : ''}" onclick="toggleStatus(${player.id}, 'protected')">
                <input type="checkbox" ${player.protected ? 'checked' : ''}>
                🛡️ 保护
            </label>
        </div>
        <div style="margin-top: var(--spacing-lg); display: flex; gap: var(--spacing-md); justify-content: center; flex-wrap: wrap;">
            ${player.alive ? 
                `<button class="btn btn-danger" onclick="killPlayer(${player.id})">☠️ 杀死</button>` :
                `<button class="btn btn-primary" onclick="revivePlayer(${player.id})">✨ 复活</button>`
            }
            <button class="btn btn-secondary" onclick="generatePlayerInfo(${player.id})">🔮 生成信息</button>
        </div>
    `;
    
    // 尝试加载角色图片替换 emoji 头像
    if (roleId) {
        const avatarDiv = document.getElementById(avatarId);
        if (avatarDiv) {
            tryLoadRoleImageIntoAvatar(avatarDiv, roleId, avatarEmoji);
        }
    }
    
    showModal('playerDetailModal');
}

async function toggleStatus(playerId, statusType) {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return;
    
    const newValue = !player[statusType];
    
    const result = await apiCall(`/api/game/${gameState.gameId}/player_status`, 'POST', {
        player_id: playerId,
        status_type: statusType,
        value: newValue
    });
    
    if (result.success) {
        player[statusType] = newValue;
        renderPlayerCircle();
        openPlayerDetail(playerId);
    }
}

async function killPlayer(playerId) {
    const result = await apiCall(`/api/game/${gameState.gameId}/kill_player`, 'POST', {
        player_id: playerId,
        cause: '说书人判定'
    });
    
    if (result.success) {
        const player = gameState.players.find(p => p.id === playerId);
        player.alive = false;
        renderPlayerCircle();
        updatePlayerSelects();
        closeModal('playerDetailModal');
        
        addLogEntry(`${player.name} 死亡 (说书人判定)`, 'death');
        
        if (result.game_end && result.game_end.ended) {
            showGameEnd(result.game_end);
        }
    }
}

async function revivePlayer(playerId) {
    const result = await apiCall(`/api/game/${gameState.gameId}/revive_player`, 'POST', {
        player_id: playerId
    });
    
    if (result.success) {
        const player = gameState.players.find(p => p.id === playerId);
        player.alive = true;
        player.vote_token = true;
        renderPlayerCircle();
        updatePlayerSelects();
        closeModal('playerDetailModal');
        
        addLogEntry(`${player.name} 复活了`, 'revive');
    }
}

async function generatePlayerInfo(playerId) {
    const result = await apiCall(`/api/game/${gameState.gameId}/generate_info`, 'POST', {
        player_id: playerId
    });
    
    closeModal('playerDetailModal');
    
    const player = gameState.players.find(p => p.id === playerId);
    document.getElementById('infoContent').innerHTML = `
        <h4 style="margin-bottom: var(--spacing-md); color: var(--color-gold);">${player.name} - ${player.role?.name || '未知角色'}</h4>
        <div class="info-message">
            ${result.message || '无法生成信息'}
        </div>
    `;
    
    showModal('infoModal');
}

// ===== 夜间死亡 =====
async function addNightDeath(playerId, cause = '恶魔击杀') {
    await apiCall(`/api/game/${gameState.gameId}/night_death`, 'POST', {
        player_id: playerId,
        cause: cause
    });
}

// ===== 游戏结束 =====
function showGameEnd(gameEnd) {
    const content = document.getElementById('gameEndContent');
    const winnerText = gameEnd.winner === 'good' ? '善良阵营获胜！' : '邪恶阵营获胜！';
    const winnerClass = gameEnd.winner;
    
    content.innerHTML = `
        <div class="game-end-winner ${winnerClass}">${winnerText}</div>
        <div class="game-end-reason">${gameEnd.reason}</div>
        <div style="margin-top: var(--spacing-xl);">
            <h4 style="color: var(--color-gold); margin-bottom: var(--spacing-md);">角色揭示</h4>
            ${gameState.players.map(p => `
                <div style="display: flex; justify-content: space-between; padding: var(--spacing-sm); border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <span>${p.name} ${p.alive ? '' : '†'}</span>
                    <span style="color: var(--color-${p.role_type});">${p.role?.name || '未知'}</span>
                </div>
            `).join('')}
        </div>
    `;
    
    showModal('gameEndModal');
}

// ===== 日志 =====
function addLogEntry(message, type = 'info') {
    const log = document.getElementById('gameLog');
    const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    log.innerHTML = `
        <div class="log-entry ${type}">
            <span class="log-time">[${time}]</span>
            ${message}
        </div>
    ` + log.innerHTML;
}

// ===== 弹窗控制 =====
function showModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
    if (modalId === 'infoModal') {
        stopModalChoicePolling();
    }
}

// 点击弹窗外部关闭
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
});

// ESC 关闭弹窗
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.show').forEach(modal => {
            modal.classList.remove('show');
        });
    }
});

// ==================== 玩家端同步功能 ====================
// 更新日期: 2026-01-12

// 通知玩家执行行动
// 更新日期: 2026-01-12 - 添加 roleId 参数支持 info_select 类角色
async function notifyPlayerAction(playerId, actionType, roleId = null) {
    const item = gameState.nightOrder[currentNightActionIndex];
    const player = gameState.players.find(p => p.id === playerId);
    
    if (!player) {
        showToast('未找到玩家');
        return;
    }
    
    const actualRoleId = roleId || item?.role_id || player.role?.id;
    
    // 根据行动类型配置
    let actionConfig = {
        max_targets: 1,
        can_skip: true,
        use_alive_only: true,
        description: item?.ability || player.role?.ability || ''
    };
    
    // 根据不同角色调整配置
    // info_select 类角色（玩家选择）
    if (actualRoleId === 'fortune_teller') {
        actionConfig.max_targets = 2;
        actionConfig.use_alive_only = false;  // 可以选择死亡玩家
        actionConfig.description = '选择两名玩家进行占卜';
    } else if (actualRoleId === 'ravenkeeper') {
        actionConfig.max_targets = 1;
        actionConfig.use_alive_only = false;
        actionConfig.description = '选择一名玩家查看其角色';
    } else if (actualRoleId === 'dreamer') {
        actionConfig.max_targets = 1;
        actionConfig.use_alive_only = false;
        actionConfig.description = '选择一名玩家，你会得知两个角色，其中一个是真的';
    } else if (actualRoleId === 'seamstress') {
        actionConfig.max_targets = 2;
        actionConfig.use_alive_only = false;
        actionConfig.description = '选择两名玩家（不包括自己），得知他们是否同一阵营';
    } else if (actualRoleId === 'chambermaid') {
        actionConfig.max_targets = 2;
        actionConfig.use_alive_only = false;
        actionConfig.description = '选择两名玩家，得知他们中有几人今晚因自己的能力被唤醒';
    }
    // 恶魔击杀类
    else if (actionType === 'shabaloth_kill') {
        actionConfig.max_targets = 2;
        actionConfig.description = '选择两名玩家，他们今晚将死亡';
    } else if (actionType === 'po_kill') {
        // 检查珀是否可以杀三人
        const poStatus = await apiCall(`/api/game/${gameState.gameId}/po_status`);
        if (poStatus.can_kill_three) {
            actionConfig.max_targets = 3;
            actionConfig.description = '上一晚未行动，本晚可以选择最多三名玩家使其死亡';
        } else {
            actionConfig.max_targets = 1;
            actionConfig.description = '选择一名玩家，他们今晚将死亡';
        }
    } else if (actionType === 'kill') {
        actionConfig.description = '选择一名玩家作为击杀目标';
    } else if (actionType === 'protect') {
        actionConfig.description = '选择一名玩家进行保护';
    } else if (actionType === 'poison') {
        actionConfig.description = '选择一名玩家进行投毒';
    } else if (actionType === 'pit_hag') {
        // 麻脸巫婆使用特殊端点
        actionConfig.special = 'pit_hag';
        actionConfig.description = '选择一名玩家和一个角色，该玩家将变成那个角色';
    } else if (actionType === 'info_first_night') {
        // 信息角色不需要选择，只需要等待信息
        actionConfig.max_targets = 0;
        actionConfig.is_info = true;
        actionConfig.description = item?.ability || '等待说书人提供信息';
    }
    
    const result = await apiCall('/api/storyteller/notify_action', 'POST', {
        game_id: gameState.gameId,
        player_id: playerId,
        action_type: actionType,
        action_config: actionConfig
    });
    
    if (result.success) {
        showToast(`已通知 ${player.name} 进行行动选择`);
        
        // 开始轮询玩家的选择
        startPollingPlayerChoice(playerId);
    } else {
        showToast('通知失败: ' + (result.error || '未知错误'));
    }
}

// 更新日期: 2026-01-12 - 发送信息结果给玩家（用于信息类角色）
async function sendInfoResultToPlayer(playerId) {
    const infoTextArea = document.getElementById('infoResultText');
    const messageContent = infoTextArea ? infoTextArea.value.trim() : '';
    
    if (!messageContent) {
        showToast('请输入要发送的信息');
        return;
    }
    
    const player = gameState.players.find(p => p.id === playerId);
    const item = gameState.nightOrder[currentNightActionIndex];
    const roleName = item?.role_name || player?.role?.name || '角色';
    
    const result = await apiCall('/api/storyteller/send_night_result', 'POST', {
        game_id: gameState.gameId,
        player_id: playerId,
        result_type: 'info',
        result_data: messageContent
    });
    
    if (result.success) {
        showToast(`已发送信息给 ${player?.name || '玩家'}`);
        
        // 清除玩家的待处理行动
        await apiCall('/api/storyteller/clear_pending_action', 'POST', {
            game_id: gameState.gameId,
            player_id: playerId
        });
        
        // 记录行动
        await apiCall(`/api/game/${gameState.gameId}/night_action`, 'POST', {
            player_id: playerId,
            action: `${roleName}获取信息`,
            target: currentNightActionTarget || null,
            action_type: 'info',
            result: messageContent
        });
    } else {
        showToast('发送失败: ' + (result.error || '未知错误'));
    }
}

// 轮询玩家的选择
let playerChoicePollingInterval = null;
let pollingPlayerId = null;

function startPollingPlayerChoice(playerId) {
    pollingPlayerId = playerId;
    
    // 清除之前的轮询
    if (playerChoicePollingInterval) {
        clearInterval(playerChoicePollingInterval);
    }
    
    const poll = async () => {
        try {
            const choicesResult = await apiCall(`/api/storyteller/player_choices/${gameState.gameId}`);
            if (choicesResult.choices && choicesResult.choices[playerId]) {
                const choice = choicesResult.choices[playerId];
                if (!choice.confirmed) {
                    // 玩家已提交选择
                    clearInterval(playerChoicePollingInterval);
                    playerChoicePollingInterval = null;
                    
                    // 刷新当前行动面板
                    if (currentNightActionIndex !== null) {
                        const item = gameState.nightOrder[currentNightActionIndex];
                        if (item && item.player_id === playerId) {
                            handleNightAction(currentNightActionIndex);
                            showToast('玩家已提交选择！');
                        }
                    }
                }
            }
        } catch (e) {
            console.log('轮询玩家选择失败:', e);
        }
    };
    
    // 每2秒检查一次
    playerChoicePollingInterval = setInterval(poll, 2000);
    
    // 10分钟后自动停止轮询
    setTimeout(() => {
        if (playerChoicePollingInterval) {
            clearInterval(playerChoicePollingInterval);
            playerChoicePollingInterval = null;
        }
    }, 600000);
}

// 使用玩家的选择
async function usePlayerChoice(playerId) {
    const choicesResult = await apiCall(`/api/storyteller/player_choices/${gameState.gameId}`);
    if (choicesResult.choices && choicesResult.choices[playerId]) {
        const choice = choicesResult.choices[playerId];
        if (choice.targets && choice.targets.length > 0) {
            // 设置选择
            currentNightActionTarget = choice.targets[0];
            if (choice.targets.length > 1) {
                currentNightActionSecondTarget = choice.targets[1];
            }
            
            // 更新下拉框
            const targetSelect = document.getElementById('nightActionTarget');
            if (targetSelect) {
                targetSelect.value = currentNightActionTarget;
            }
            const secondTargetSelect = document.getElementById('nightActionSecondTarget') || 
                                       document.getElementById('fortuneTellerTarget2');
            if (secondTargetSelect && currentNightActionSecondTarget) {
                secondTargetSelect.value = currentNightActionSecondTarget;
            }
            
            showToast('已应用玩家选择');
        }
    }
}

// 发送信息给玩家
async function sendMessageToPlayer(playerId, type, title, content) {
    const result = await apiCall('/api/storyteller/send_message', 'POST', {
        game_id: gameState.gameId,
        player_id: playerId,
        type: type,
        title: title,
        content: content
    });
    
    if (result.success) {
        showToast('信息已发送给玩家');
    } else {
        showToast('发送失败: ' + (result.error || '未知错误'));
    }
    
    return result;
}

// 发送夜间结果给玩家
async function sendNightResultToPlayer(playerId, resultType, resultData, isFake = false) {
    const result = await apiCall('/api/storyteller/send_night_result', 'POST', {
        game_id: gameState.gameId,
        player_id: playerId,
        result_type: resultType,
        result_data: resultData,
        is_fake: isFake
    });
    
    if (result.success) {
        showToast('结果已同步给玩家');
        // 确认玩家的夜间行动
        await apiCall('/api/storyteller/confirm_action', 'POST', {
            game_id: gameState.gameId,
            player_id: playerId
        });
    }
    
    return result;
}

// 显示发送信息弹窗
function showSendMessageModal(playerId, playerName) {
    let modal = document.getElementById('sendMessageModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'sendMessageModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>📤 发送信息给玩家</h3>
                    <button class="modal-close" onclick="closeModal('sendMessageModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="margin-bottom: var(--spacing-md);">发送给: <strong id="sendMessagePlayerName"></strong></p>
                    <div class="target-select-group">
                        <label>信息类型:</label>
                        <select id="messageType" class="form-select">
                            <option value="night_result">🌙 夜间结果</option>
                            <option value="info">ℹ️ 一般信息</option>
                            <option value="warning">⚠️ 警告</option>
                        </select>
                    </div>
                    <div class="target-select-group" style="margin-top: var(--spacing-md);">
                        <label>标题:</label>
                        <input type="text" id="messageTitle" class="form-input" placeholder="信息标题" value="来自说书人的信息">
                    </div>
                    <div class="target-select-group" style="margin-top: var(--spacing-md);">
                        <label>内容:</label>
                        <textarea id="messageContent" class="form-textarea" rows="4" placeholder="输入要发送的信息..."></textarea>
                    </div>
                    <div style="margin-top: var(--spacing-md);">
                        <h4 style="margin-bottom: var(--spacing-sm);">快捷结果:</h4>
                        <div style="display: flex; flex-wrap: wrap; gap: var(--spacing-sm);">
                            <button class="btn btn-secondary" onclick="setQuickResult('number', '0')" style="font-size: 0.85rem;">数字: 0</button>
                            <button class="btn btn-secondary" onclick="setQuickResult('number', '1')" style="font-size: 0.85rem;">数字: 1</button>
                            <button class="btn btn-secondary" onclick="setQuickResult('number', '2')" style="font-size: 0.85rem;">数字: 2</button>
                            <button class="btn btn-secondary" onclick="setQuickResult('yes_no', true)" style="font-size: 0.85rem;">是 ✓</button>
                            <button class="btn btn-secondary" onclick="setQuickResult('yes_no', false)" style="font-size: 0.85rem;">否 ✗</button>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal('sendMessageModal')">取消</button>
                    <button class="btn btn-primary" onclick="confirmSendMessage()">发送</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    document.getElementById('sendMessagePlayerName').textContent = playerName;
    modal.dataset.playerId = playerId;
    document.getElementById('messageContent').value = '';
    
    openModal('sendMessageModal');
}

function setQuickResult(type, value) {
    const contentArea = document.getElementById('messageContent');
    if (type === 'number') {
        contentArea.value = `你得到的数字是: ${value}`;
    } else if (type === 'yes_no') {
        contentArea.value = `结果是: ${value ? '是' : '否'}`;
    }
}

async function confirmSendMessage() {
    const modal = document.getElementById('sendMessageModal');
    const playerId = parseInt(modal.dataset.playerId);
    const type = document.getElementById('messageType').value;
    const title = document.getElementById('messageTitle').value;
    const content = document.getElementById('messageContent').value;
    
    if (!content.trim()) {
        showToast('请输入信息内容');
        return;
    }
    
    await sendMessageToPlayer(playerId, type, title, content);
    closeModal('sendMessageModal');
}

// 获取玩家连接状态
async function refreshPlayerStatus() {
    const result = await apiCall(`/api/storyteller/player_status/${gameState.gameId}`);
    if (result.players) {
        result.players.forEach(status => {
            const player = gameState.players.find(p => p.id === status.id);
            if (player) {
                player.connected = status.connected;
                player.online = status.online;
            }
        });
        renderPlayerCircle();
    }
}

// 定期刷新玩家状态（每5秒）
setInterval(() => {
    if (gameState.gameId && gameState.currentPhase !== 'setup') {
        refreshPlayerStatus();
    }
}, 5000);

// 在玩家详情中添加发送消息按钮
function addSendMessageButton(playerId, playerName) {
    return `
        <button class="btn btn-secondary" onclick="showSendMessageModal(${playerId}, '${playerName}')" style="margin-top: var(--spacing-md);">
            📤 发送信息给该玩家
        </button>
    `;
}

// ==================== 说书人端语音接口 ====================

const storytellerVoice = {
    ttsEnabled: false,
    ttsVoice: null,
    speaking: false,
    autoRead: false
};

function initStorytellerVoice() {
    if ('speechSynthesis' in window) {
        storytellerVoice.ttsEnabled = true;
        window.speechSynthesis.onvoiceschanged = () => {
            const voices = window.speechSynthesis.getVoices();
            storytellerVoice.ttsVoice = voices.find(v => v.lang.startsWith('zh')) || voices[0];
        };
    }
}

function storytellerSpeak(text) {
    if (!storytellerVoice.ttsEnabled || storytellerVoice.speaking) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.85;
    utterance.pitch = 0.9;
    if (storytellerVoice.ttsVoice) utterance.voice = storytellerVoice.ttsVoice;

    utterance.onstart = () => { storytellerVoice.speaking = true; };
    utterance.onend = () => { storytellerVoice.speaking = false; };
    utterance.onerror = () => { storytellerVoice.speaking = false; };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
}

function toggleAutoRead() {
    storytellerVoice.autoRead = !storytellerVoice.autoRead;
    const btn = document.getElementById('autoReadBtn');
    if (btn) {
        btn.textContent = storytellerVoice.autoRead ? '🔊 自动朗读: 开' : '🔇 自动朗读: 关';
        btn.style.borderColor = storytellerVoice.autoRead ? '#27ae60' : 'var(--color-blood)';
    }
    showToast(storytellerVoice.autoRead ? '自动朗读已开启' : '自动朗读已关闭');
}

// 增强 addLogEntry，支持自动朗读
const _originalAddLogEntry = typeof addLogEntry === 'function' ? addLogEntry : null;
if (_originalAddLogEntry) {
    const _wrappedAddLogEntry = addLogEntry;
    addLogEntry = function(message, type) {
        _wrappedAddLogEntry(message, type);
        if (storytellerVoice.autoRead && ['phase', 'death', 'execution', 'game_event'].includes(type)) {
            const plainText = message.replace(/<[^>]*>/g, '').replace(/[🌙☀️💀🗡️⚡🔥👹🧙‍♀️📱✓⚠️]/g, '');
            storytellerSpeak(plainText);
        }
    };
}

initStorytellerVoice();

// ==================== 说书人端服务器连接接口 ====================

async function checkServerHealth() {
    try {
        const result = await apiCall('/api/server/health');
        return result;
    } catch (e) {
        return { status: 'error', message: e.message };
    }
}

async function syncToRemoteServer() {
    if (!gameState.gameId) return;
    
    try {
        const result = await apiCall('/api/server/sync_state', 'POST', {
            game_id: gameState.gameId
        });
        if (result.success) {
            showToast('游戏状态已同步');
        } else {
            showToast(result.message || '同步失败');
        }
    } catch (e) {
        showToast('同步失败: ' + e.message);
    }
}
