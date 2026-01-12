/**
 * 血染钟楼 - 玩家端
 * 更新日期: 2026-01-12
 * 支持双向同步：玩家选择 ↔ 说书人
 */

// ==================== 状态管理 ====================
const playerState = {
    gameId: null,
    playerId: null,
    playerName: null,
    role: null,
    roleType: null,
    alive: true,
    players: [],
    currentPhase: 'setup',
    dayNumber: 0,
    nightNumber: 0,
    nominations: [],
    myVotes: {},
    hasVoteToken: true,
    pollInterval: null,
    heartbeatInterval: null,
    messages: [],
    nightAction: null,
    playerChoice: null
};

// ==================== API 调用 ====================
async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(endpoint, options);
        const result = await response.json();
        updateConnectionStatus(true);
        return result;
    } catch (error) {
        console.error('API调用失败:', error);
        updateConnectionStatus(false);
        return { error: '网络连接失败' };
    }
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
    initBackground();
    initEventListeners();
    
    // 检查是否有保存的游戏状态
    const savedState = localStorage.getItem('playerState');
    if (savedState) {
        try {
            const state = JSON.parse(savedState);
            if (state.gameId && state.playerId) {
                reconnectToGame(state.gameId, state.playerId);
            }
        } catch (e) {
            localStorage.removeItem('playerState');
        }
    }
});

function initEventListeners() {
    document.getElementById('findGameBtn').addEventListener('click', findGame);
    document.getElementById('gameCodeInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') findGame();
    });
    document.getElementById('joinGameBtn').addEventListener('click', joinGame);
    document.getElementById('voteYesBtn').addEventListener('click', () => vote(true));
    document.getElementById('voteNoBtn').addEventListener('click', () => vote(false));
}

// ==================== 背景效果 ====================
function initBackground() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const particles = [];
    for (let i = 0; i < 50; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2 + 1,
            speedX: (Math.random() - 0.5) * 0.5,
            speedY: (Math.random() - 0.5) * 0.5,
            opacity: Math.random() * 0.5 + 0.2
        });
    }
    
    function animate() {
        ctx.fillStyle = 'rgba(10, 10, 15, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        particles.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(139, 0, 0, ${p.opacity})`;
            ctx.fill();
            
            p.x += p.speedX;
            p.y += p.speedY;
            
            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;
            if (p.y < 0) p.y = canvas.height;
            if (p.y > canvas.height) p.y = 0;
        });
        
        requestAnimationFrame(animate);
    }
    
    animate();
    
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
}

// ==================== 游戏连接 ====================
async function findGame() {
    const gameCode = document.getElementById('gameCodeInput').value.trim();
    if (!gameCode) {
        showInfo('请输入游戏代码');
        return;
    }
    
    const result = await apiCall(`/api/player/find_game/${gameCode}`);
    
    if (result.error) {
        showInfo(result.error);
        return;
    }
    
    if (!result.found) {
        showInfo('未找到该游戏，请检查游戏代码');
        return;
    }
    
    playerState.gameId = result.game_id;
    displayPlayerSelection(result.players);
}

function displayPlayerSelection(players) {
    const grid = document.getElementById('playerSelectGrid');
    const section = document.getElementById('playerSelectSection');
    
    let html = '';
    players.forEach((player, index) => {
        const taken = player.connected;
        html += `
            <div class="player-select-card ${taken ? 'taken' : ''}" 
                 data-player-id="${player.id}"
                 onclick="${taken ? '' : `selectPlayer(${player.id})`}">
                <div class="seat-number">${index + 1}</div>
                <div class="player-name">${player.name}</div>
                ${taken ? '<div style="color: var(--color-drunk); font-size: 0.8rem;">已加入</div>' : ''}
            </div>
        `;
    });
    
    grid.innerHTML = html;
    section.style.display = 'block';
}

let selectedPlayerId = null;

function selectPlayer(playerId) {
    document.querySelectorAll('.player-select-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    const card = document.querySelector(`[data-player-id="${playerId}"]`);
    if (card && !card.classList.contains('taken')) {
        card.classList.add('selected');
        selectedPlayerId = playerId;
        document.getElementById('joinGameBtn').disabled = false;
    }
}

async function joinGame() {
    if (!selectedPlayerId || !playerState.gameId) {
        showInfo('请选择你的座位');
        return;
    }
    
    const result = await apiCall('/api/player/join_game', 'POST', {
        game_id: playerState.gameId,
        player_id: selectedPlayerId
    });
    
    if (result.error) {
        showInfo(result.error);
        return;
    }
    
    playerState.playerId = selectedPlayerId;
    playerState.playerName = result.player_name;
    playerState.role = result.role;
    playerState.roleType = result.role_type;
    playerState.alive = result.alive;
    
    saveState();
    showGamePanel();
    startPolling();
    startHeartbeat();
}

async function reconnectToGame(gameId, playerId) {
    const result = await apiCall('/api/player/reconnect', 'POST', {
        game_id: gameId,
        player_id: playerId
    });
    
    if (result.error || !result.success) {
        localStorage.removeItem('playerState');
        return;
    }
    
    playerState.gameId = gameId;
    playerState.playerId = playerId;
    playerState.playerName = result.player_name;
    playerState.role = result.role;
    playerState.roleType = result.role_type;
    playerState.alive = result.alive;
    playerState.currentPhase = result.current_phase;
    playerState.dayNumber = result.day_number;
    playerState.nightNumber = result.night_number;
    playerState.players = result.players;
    
    showGamePanel();
    startPolling();
    startHeartbeat();
}

function saveState() {
    localStorage.setItem('playerState', JSON.stringify({
        gameId: playerState.gameId,
        playerId: playerState.playerId
    }));
}

// ==================== 游戏面板 ====================
function showGamePanel() {
    document.getElementById('joinPanel').style.display = 'none';
    document.getElementById('gamePanel').style.display = 'block';
    document.getElementById('gameInfo').style.display = 'flex';
    document.getElementById('playerNameDisplay').textContent = playerState.playerName;
    
    updateRoleCard();
    updateGameState();
}

function updateRoleCard() {
    const role = playerState.role;
    const roleType = playerState.roleType;
    
    if (!role) {
        document.getElementById('roleIcon').textContent = '❓';
        document.getElementById('roleName').textContent = '等待分配';
        document.getElementById('roleType').textContent = '未知';
        document.getElementById('roleType').className = 'role-type';
        document.getElementById('roleAbility').textContent = '说书人正在分配角色...';
        return;
    }
    
    const roleIcons = {
        'washerwoman': '👗', 'librarian': '📚', 'investigator': '🔍', 'chef': '👨‍🍳',
        'empath': '💓', 'fortune_teller': '🔮', 'undertaker': '⚰️', 'monk': '🧘',
        'ravenkeeper': '🐦', 'virgin': '👰', 'slayer': '🗡️', 'soldier': '🛡️',
        'mayor': '👔', 'exorcist': '✝️', 'innkeeper': '🏨', 'gambler': '🎰',
        'gossip': '🗣️', 'courtier': '👑', 'professor': '🎓', 'minstrel': '🎵',
        'tea_lady': '🍵', 'pacifist': '☮️', 'fool': '🃏', 'grandmother': '👵',
        'sailor': '⚓', 'chambermaid': '🛏️', 'clockmaker': '⏰',
        'butler': '🎩', 'drunk': '🍺', 'recluse': '🏚️', 'saint': '😇',
        'moonchild': '🌙', 'goon': '💪', 'lunatic': '🤪', 'tinker': '🔧',
        'poisoner': '☠️', 'spy': '🕵️', 'scarlet_woman': '💋', 'baron': '🎭',
        'assassin': '🗡️', 'devils_advocate': '😈', 'mastermind': '🧠',
        'godfather': '🤵', 'witch': '🧹', 'cerenovus': '👻', 'pit_hag': '🧙‍♀️',
        'imp': '👿', 'zombuul': '🧟', 'pukka': '🐍', 'shabaloth': '🦑',
        'po': '💀', 'vigormortis': '💉', 'fang_gu': '🦇', 'no_dashii': '🐙'
    };
    
    const roleTypeNames = {
        'townsfolk': '镇民',
        'outsider': '外来者',
        'minion': '爪牙',
        'demon': '恶魔'
    };
    
    document.getElementById('roleIcon').textContent = roleIcons[role.id] || '👤';
    document.getElementById('roleName').textContent = role.name;
    document.getElementById('roleType').textContent = roleTypeNames[roleType] || roleType;
    document.getElementById('roleType').className = `role-type ${roleType}`;
    document.getElementById('roleAbility').textContent = role.ability || '无特殊能力';
}

// ==================== 轮询更新 ====================
function startPolling() {
    playerState.pollInterval = setInterval(pollGameState, 2000);
    pollGameState();
}

function stopPolling() {
    if (playerState.pollInterval) {
        clearInterval(playerState.pollInterval);
        playerState.pollInterval = null;
    }
}

function startHeartbeat() {
    playerState.heartbeatInterval = setInterval(() => {
        apiCall('/api/player/heartbeat', 'POST', {
            game_id: playerState.gameId,
            player_id: playerState.playerId
        });
    }, 5000);
}

async function pollGameState() {
    if (!playerState.gameId || !playerState.playerId) return;
    
    const result = await apiCall(`/api/player/game_state/${playerState.gameId}/${playerState.playerId}`);
    
    if (result.error) {
        console.error('获取游戏状态失败:', result.error);
        return;
    }
    
    // 更新状态
    playerState.players = result.players;
    playerState.currentPhase = result.current_phase;
    playerState.dayNumber = result.day_number;
    playerState.nightNumber = result.night_number;
    playerState.nominations = result.nominations || [];
    playerState.alive = result.my_status?.alive ?? true;
    playerState.hasVoteToken = result.my_status?.vote_token ?? true;
    playerState.nightAction = result.night_action;
    
    // 检查是否有说书人发送的待处理行动（夜间或白天）
    await checkPendingAction();
    
    // 白天也检查是否有行动
    if (playerState.currentPhase === 'day') {
        await checkDayAction();
    }
    playerState.playerChoice = result.player_choice;
    
    // 更新角色信息
    if (result.my_status?.role) {
        playerState.role = result.my_status.role;
        playerState.roleType = result.my_status.role_type;
        updateRoleCard();
    }
    
    // 处理新消息
    if (result.messages && result.messages.length > 0) {
        handleNewMessages(result.messages);
    }
    
    // 更新UI
    updateGameState();
    updatePlayerCircle();
    updatePublicLog(result.public_log || []);
    
    // 处理投票
    if (result.active_nomination) {
        showVotingPanel(result.active_nomination);
    } else {
        hideVotingPanel();
    }
    
    // 处理夜间
    if (playerState.currentPhase === 'night') {
        if (result.my_turn && result.night_action) {
            showNightAction(result.night_action);
        } else if (result.waiting_for_action) {
            showNightWaiting('等待轮到你的行动...');
        } else {
            showNightWaiting();
        }
    } else {
        hideNightPanels();
    }
    
    // 检查游戏结束
    if (result.game_end && result.game_end.ended) {
        showGameEnd(result.game_end);
    }
}

// 更新日期: 2026-01-12 - 消息统一显示在夜间行动面板中
function handleNewMessages(messages) {
    messages.forEach(msg => {
        if (!msg.read) {
            // 夜间结果信息显示在夜间行动面板中
            if (msg.type === 'night_result' || msg.type === 'info') {
                displayMessageInNightPanel(msg);
            } else {
                // 其他类型信息用弹窗显示
                showMessageModal(msg);
            }
            // 标记为已读
            apiCall(`/api/player/messages/${playerState.gameId}/${playerState.playerId}/read`, 'POST', {
                message_ids: [msg.id]
            });
        }
    });
}

// 更新日期: 2026-01-12 - 在夜间行动面板中显示信息
function displayMessageInNightPanel(msg) {
    const nightPanel = document.getElementById('nightActionPanel');
    const nightContent = document.getElementById('nightActionContent');
    const nightWaiting = document.getElementById('nightWaiting');
    
    if (!nightPanel || !nightContent) return;
    
    // 确保夜间面板可见
    nightPanel.style.display = 'block';
    nightWaiting.style.display = 'none';
    
    const typeIcons = {
        'info': 'ℹ️',
        'night_result': '🌙',
        'warning': '⚠️',
        'success': '✅'
    };
    const icon = typeIcons[msg.type] || '📜';
    
    // 更新夜间行动面板内容
    nightContent.innerHTML = `
        <div class="info-received" style="background: linear-gradient(135deg, rgba(52, 152, 219, 0.2), rgba(0,0,0,0.3)); border: 2px solid #3498db; border-radius: 12px; padding: 1.5rem; text-align: center;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">${icon}</div>
            <h4 style="color: var(--color-gold); margin-bottom: 1rem;">${msg.title || '来自说书人的信息'}</h4>
            <div style="font-size: 1.3rem; color: var(--text-primary); line-height: 1.8; padding: 1rem; background: rgba(0,0,0,0.3); border-radius: 8px;">
                ${msg.content}
            </div>
            <p style="color: var(--text-muted); margin-top: 1rem; font-size: 0.9rem;">
                ${new Date(msg.time).toLocaleTimeString()}
            </p>
        </div>
        <p style="color: var(--text-muted); margin-top: 1rem; text-align: center;">
            等待说书人进入下一阶段...
        </p>
    `;
    
    // 更新标题
    document.getElementById('nightActionTitle').textContent = '📜 说书人的信息';
    
    // 显示一个简短的提示弹窗
    showToast(`${icon} 收到新信息`);
}

function showMessageModal(msg) {
    const typeIcons = {
        'info': 'ℹ️',
        'night_result': '🌙',
        'warning': '⚠️',
        'success': '✅'
    };

    const icon = typeIcons[msg.type] || 'ℹ️';

    showInfo(`
        <div style="text-align: center;">
            <div style="font-size: 2rem; margin-bottom: 1rem;">${icon}</div>
            <div style="font-size: 1.1rem; color: var(--color-gold); margin-bottom: 1rem;">
                ${msg.content}
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">
                ${new Date(msg.time).toLocaleTimeString()}
            </div>
        </div>
    `, msg.title);
}

// 简单的toast提示
function showToast(message) {
    // 创建toast元素
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.cssText = `
            position: fixed;
            top: 1rem;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: var(--color-gold);
            padding: 1rem 2rem;
            border-radius: 8px;
            border: 1px solid var(--color-gold);
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
    }, 3000);
}

function updateGameState() {
    const phaseBadge = document.getElementById('phaseBadge');
    const phaseIndicator = document.getElementById('phaseIndicator');
    
    if (playerState.currentPhase === 'day') {
        phaseBadge.className = 'phase-badge day';
        phaseBadge.innerHTML = '☀️ 白天';
        if (phaseIndicator) phaseIndicator.textContent = `第 ${playerState.dayNumber} 天`;
    } else if (playerState.currentPhase === 'night') {
        phaseBadge.className = 'phase-badge night';
        phaseBadge.innerHTML = '🌙 夜晚';
        if (phaseIndicator) phaseIndicator.textContent = `第 ${playerState.nightNumber} 夜`;
    } else {
        phaseBadge.className = 'phase-badge';
        phaseBadge.innerHTML = '⏳ 准备中';
        if (phaseIndicator) phaseIndicator.textContent = '准备阶段';
    }
    
    document.getElementById('dayNumber').textContent = playerState.dayNumber || 0;
    const aliveCount = playerState.players.filter(p => p.alive).length;
    document.getElementById('aliveCount').textContent = aliveCount;
}

function updatePlayerCircle() {
    const container = document.getElementById('playerViewCircle');
    const players = playerState.players;
    const count = players.length;
    
    if (count === 0) return;
    
    const containerRect = container.getBoundingClientRect();
    const size = Math.min(containerRect.width, containerRect.height) || 300;
    const radius = size * 0.38;
    const centerX = size / 2;
    const centerY = size / 2;
    
    let html = '';
    players.forEach((player, index) => {
        const angle = (index / count) * 2 * Math.PI - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        
        const isSelf = player.id === playerState.playerId;
        const isDead = !player.alive;
        const isOnline = player.connected;
        
        html += `
            <div class="player-seat-view ${isSelf ? 'self' : ''} ${isDead ? 'dead' : ''}"
                 style="left: ${x}px; top: ${y}px;"
                 title="${player.name}${isSelf ? ' (你)' : ''}${isOnline ? '' : ' (离线)'}">
                <div class="seat-status">${isDead ? '💀' : (isSelf ? '⭐' : (isOnline ? '👤' : '👻'))}</div>
                <div class="seat-name">${player.name}</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function updatePublicLog(logs) {
    const container = document.getElementById('publicLog');
    
    if (logs.length === 0) {
        container.innerHTML = '<div class="public-log-entry">暂无公开信息</div>';
        return;
    }
    
    let html = '';
    logs.slice(-20).reverse().forEach(log => {
        let className = 'public-log-entry';
        if (log.type === 'death') className += ' death';
        if (log.type === 'execution') className += ' execution';
        if (log.type === 'phase') className += ' phase';
        
        html += `<div class="${className}">${log.message}</div>`;
    });
    
    container.innerHTML = html;
}

// ==================== 投票 ====================
function showVotingPanel(nomination) {
    const panel = document.getElementById('votingPanel');
    const target = document.getElementById('voteTarget');
    const status = document.getElementById('voteStatus');
    const yesBtn = document.getElementById('voteYesBtn');
    const noBtn = document.getElementById('voteNoBtn');
    
    target.textContent = nomination.nominee_name;
    
    const hasVoted = nomination.voters?.includes(playerState.playerId);
    const myVote = nomination.votes_detail?.[playerState.playerId];
    
    if (hasVoted) {
        const voteText = myVote?.vote ? '赞成' : '反对';
        status.textContent = `你已投${voteText}票 (当前${nomination.vote_count}票赞成)`;
        yesBtn.disabled = true;
        noBtn.disabled = true;
    } else if (!playerState.alive && !playerState.hasVoteToken) {
        status.textContent = '你已死亡且没有投票令牌';
        yesBtn.disabled = true;
        noBtn.disabled = true;
    } else {
        status.textContent = playerState.alive ? `当前${nomination.vote_count}票赞成` : '你已死亡，使用投票令牌';
        yesBtn.disabled = false;
        noBtn.disabled = false;
    }
    
    panel.style.display = 'block';
    panel.dataset.nominationId = nomination.id;
}

function hideVotingPanel() {
    document.getElementById('votingPanel').style.display = 'none';
}

async function vote(value) {
    const panel = document.getElementById('votingPanel');
    const nominationId = parseInt(panel.dataset.nominationId);
    
    if (!nominationId) return;
    
    const result = await apiCall('/api/player/vote', 'POST', {
        game_id: playerState.gameId,
        player_id: playerState.playerId,
        nomination_id: nominationId,
        vote: value
    });
    
    if (result.error) {
        showInfo(result.error);
        return;
    }
    
    document.getElementById('voteStatus').textContent = `你投了${value ? '赞成' : '反对'}票 (当前${result.vote_count}票赞成)`;
    document.getElementById('voteYesBtn').disabled = true;
    document.getElementById('voteNoBtn').disabled = true;
    
    if (!playerState.alive) {
        playerState.hasVoteToken = false;
    }
}

// ==================== 夜间行动 ====================

// 当前待处理行动
let currentPendingAction = null;

// ==================== 白天行动 ====================

// 检查白天行动（如杀手）
async function checkDayAction() {
    if (!playerState.gameId || !playerState.playerId) return;
    
    const result = await apiCall(`/api/player/day_action/${playerState.gameId}/${playerState.playerId}`);
    
    if (result.has_pending && result.action) {
        showDayActionPanel(result.action);
    }
}

// 显示白天行动面板
function showDayActionPanel(action) {
    // 创建白天行动面板（如果不存在）
    let panel = document.getElementById('dayActionPanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'dayActionPanel';
        panel.className = 'card';
        panel.style.cssText = 'margin-top: 1rem; background: linear-gradient(135deg, rgba(52, 152, 219, 0.2), rgba(0,0,0,0.3)); border: 1px solid #3498db;';
        
        const gamePanel = document.getElementById('gamePanel');
        if (gamePanel) {
            gamePanel.insertBefore(panel, gamePanel.querySelector('.card:nth-child(2)'));
        }
    }
    
    const targets = action.targets || [];
    const actionName = action.config?.action_name || action.role_name;
    
    panel.innerHTML = `
        <div class="card-header" style="background: rgba(52, 152, 219, 0.3);">
            <h3>🎯 白天行动</h3>
        </div>
        <div class="card-body">
            <div class="action-notice" style="background: rgba(52, 152, 219, 0.2); border: 1px solid #3498db; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                <p style="color: #3498db; font-weight: bold; margin-bottom: 0.5rem;">📱 说书人请你进行白天行动</p>
                <p style="color: var(--text-secondary); font-size: 0.9rem;">${action.description || action.config?.description || '请选择目标'}</p>
            </div>
            
            <div class="target-select-group">
                <label>选择目标:</label>
                <select id="dayActionTarget" class="form-select">
                    <option value="">-- 选择玩家 --</option>
                    ${targets.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                </select>
            </div>
            
            <button class="btn btn-primary" onclick="submitDayAction()" style="margin-top: 1rem; width: 100%;">
                ✓ 确认选择
            </button>
            ${action.can_skip ? `
            <button class="btn btn-secondary" onclick="submitDayAction(true)" style="margin-top: 0.5rem; width: 100%;">
                跳过 / 不使用能力
            </button>
            ` : ''}
        </div>
    `;
    
    panel.style.display = 'block';
}

// 提交白天行动
async function submitDayAction(skip = false) {
    let targets = [];
    
    if (!skip) {
        const target = document.getElementById('dayActionTarget')?.value;
        if (target) {
            targets.push(parseInt(target));
        } else {
            showInfo('请选择目标');
            return;
        }
    }
    
    const result = await apiCall('/api/player/submit_action', 'POST', {
        game_id: playerState.gameId,
        player_id: playerState.playerId,
        targets: targets,
        skipped: skip
    });
    
    if (result.error) {
        showInfo(result.error);
        return;
    }
    
    // 更新面板显示
    const panel = document.getElementById('dayActionPanel');
    if (panel) {
        const targetNames = targets.map(id => playerState.players.find(p => p.id === id)?.name).filter(Boolean).join(', ');
        
        panel.innerHTML = `
            <div class="card-header" style="background: rgba(39, 174, 96, 0.3);">
                <h3>✓ 行动已提交</h3>
            </div>
            <div class="card-body">
                <div class="info-banner" style="background: rgba(39, 174, 96, 0.2); border-color: var(--color-alive);">
                    <span class="icon">✓</span>
                    <span>${skip ? '你选择跳过' : `你选择了: ${targetNames}`}</span>
                </div>
                <p style="color: var(--text-muted); margin-top: 1rem;">选择已同步到说书人端，等待处理...</p>
            </div>
        `;
    }
}

// 检查是否有说书人发送的待处理行动
async function checkPendingAction() {
    if (!playerState.gameId || !playerState.playerId) return;
    
    const result = await apiCall(`/api/player/pending_action/${playerState.gameId}/${playerState.playerId}`);
    
    if (result.has_pending && result.action) {
        currentPendingAction = result.action;
        
        // 根据行动类型显示不同界面
        if (result.action.config?.special === 'pit_hag') {
            showPitHagAction(result.action);
        } else if (result.action.config?.is_info) {
            showInfoWaitingAction(result.action);
        } else {
            showPendingAction(result.action);
        }
    } else if (result.action && result.action.status === 'submitted') {
        // 已提交，显示等待状态
        showSubmittedState(result.action);
    }
}

// 显示待处理行动界面
function showPendingAction(action) {
    document.getElementById('nightWaiting').style.display = 'none';
    document.getElementById('nightActionPanel').style.display = 'block';
    document.getElementById('nightActionTitle').textContent = `${action.role_name || playerState.role?.name || '你'} 的回合`;
    
    const content = document.getElementById('nightActionContent');
    const maxTargets = action.max_targets || 1;
    const targets = action.targets || [];
    
    let html = `
        <div class="action-notice" style="background: rgba(52, 152, 219, 0.2); border: 1px solid #3498db; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
            <p style="color: #3498db; font-weight: bold; margin-bottom: 0.5rem;">📱 说书人请你进行行动</p>
            <p style="color: var(--text-secondary); font-size: 0.9rem;">${action.description || action.config?.description || '请选择目标'}</p>
        </div>
    `;
    
    if (targets.length > 0) {
        if (maxTargets === 1) {
            html += `
                <div class="target-select-group">
                    <label>选择目标:</label>
                    <select id="pendingTarget" class="form-select">
                        <option value="">-- 选择玩家 --</option>
                        ${targets.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                </div>
            `;
        } else if (maxTargets === 2) {
            html += `
                <div class="target-select-group">
                    <label>选择第一个目标:</label>
                    <select id="pendingTarget1" class="form-select">
                        <option value="">-- 选择玩家 --</option>
                        ${targets.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                </div>
                <div class="target-select-group" style="margin-top: 1rem;">
                    <label>选择第二个目标:</label>
                    <select id="pendingTarget2" class="form-select">
                        <option value="">-- 选择玩家 --</option>
                        ${targets.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                </div>
            `;
        } else if (maxTargets >= 3) {
            html += `
                <div class="target-select-group">
                    <label>选择目标 (最多${maxTargets}人):</label>
                    ${[1,2,3].slice(0, maxTargets).map(i => `
                        <select id="pendingTarget${i}" class="form-select" style="margin-top: ${i > 1 ? '0.5rem' : '0'};">
                            <option value="">-- 目标${i} (${i === 1 ? '必选' : '可选'}) --</option>
                            ${targets.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                        </select>
                    `).join('')}
                </div>
            `;
        }
        
        html += `
            <button class="btn btn-primary" onclick="submitPendingAction()" style="margin-top: 1rem; width: 100%;">
                ✓ 确认选择
            </button>
        `;
    }
    
    if (action.can_skip) {
        html += `
            <button class="btn btn-secondary" onclick="submitPendingAction(true)" style="margin-top: 0.5rem; width: 100%;">
                跳过 / 不选择
            </button>
        `;
    }
    
    content.innerHTML = html;
}

// 显示信息等待界面
function showInfoWaitingAction(action) {
    document.getElementById('nightWaiting').style.display = 'none';
    document.getElementById('nightActionPanel').style.display = 'block';
    document.getElementById('nightActionTitle').textContent = `${action.role_name || playerState.role?.name || '你'} 的回合`;
    
    const content = document.getElementById('nightActionContent');
    content.innerHTML = `
        <div class="action-notice" style="background: rgba(52, 152, 219, 0.2); border: 1px solid #3498db; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
            <p style="color: #3498db; font-weight: bold; margin-bottom: 0.5rem;">📱 轮到你了</p>
            <p style="color: var(--text-secondary); font-size: 0.9rem;">${action.description || '等待说书人告知信息'}</p>
        </div>
        <div class="info-banner">
            <span class="icon">⏳</span>
            <span>等待说书人发送信息...</span>
        </div>
    `;
}

// 显示已提交状态
function showSubmittedState(action) {
    document.getElementById('nightWaiting').style.display = 'none';
    document.getElementById('nightActionPanel').style.display = 'block';
    document.getElementById('nightActionTitle').textContent = `${action.role_name || playerState.role?.name || '你'} 的回合`;
    
    const content = document.getElementById('nightActionContent');
    const targetNames = action.choice?.target_names?.join(', ') || '无';
    
    content.innerHTML = `
        <div class="info-banner" style="background: rgba(39, 174, 96, 0.2); border-color: var(--color-alive);">
            <span class="icon">✓</span>
            <span>${action.choice?.skipped ? '你选择跳过' : `你已选择: ${targetNames}`}</span>
        </div>
        <p style="color: var(--text-muted); margin-top: 1rem;">选择已同步到说书人端，等待处理...</p>
    `;
}

// 提交待处理行动
async function submitPendingAction(skip = false) {
    let targets = [];
    
    if (!skip) {
        // 收集所有选择的目标
        const target1 = document.getElementById('pendingTarget')?.value || document.getElementById('pendingTarget1')?.value;
        const target2 = document.getElementById('pendingTarget2')?.value;
        const target3 = document.getElementById('pendingTarget3')?.value;
        
        if (target1) targets.push(parseInt(target1));
        if (target2) targets.push(parseInt(target2));
        if (target3) targets.push(parseInt(target3));
        
        // 验证必选目标
        if (currentPendingAction && !currentPendingAction.can_skip && targets.length === 0) {
            showInfo('请至少选择一个目标');
            return;
        }
    }
    
    const result = await apiCall('/api/player/submit_action', 'POST', {
        game_id: playerState.gameId,
        player_id: playerState.playerId,
        targets: targets,
        skipped: skip
    });
    
    if (result.error) {
        showInfo(result.error);
        return;
    }
    
    // 显示已提交状态
    const content = document.getElementById('nightActionContent');
    const targetNames = result.choice?.target_names?.join(', ') || 
        targets.map(id => playerState.players.find(p => p.id === id)?.name).filter(Boolean).join(', ') || '无';
    
    content.innerHTML = `
        <div class="info-banner" style="background: rgba(39, 174, 96, 0.2); border-color: var(--color-alive);">
            <span class="icon">✓</span>
            <span>${skip ? '你选择跳过' : `你已选择: ${targetNames}`}</span>
        </div>
        <p style="color: var(--text-muted); margin-top: 1rem;">选择已同步到说书人端，等待处理...</p>
    `;
    
    currentPendingAction = null;
}

// ==================== 麻脸巫婆特殊行动 ====================
let pitHagRoles = [];

async function showPitHagAction(action) {
    document.getElementById('nightWaiting').style.display = 'none';
    document.getElementById('nightActionPanel').style.display = 'block';
    document.getElementById('nightActionTitle').textContent = '🧙‍♀️ 麻脸巫婆的回合';
    
    // 获取所有可选角色
    const rolesResult = await apiCall(`/api/player/pit_hag_roles/${playerState.gameId}`);
    pitHagRoles = rolesResult.roles || [];
    const currentRoleIds = rolesResult.current_role_ids || [];
    
    const targets = action.targets || [];
    
    // 按类型分组
    const townsfolkRoles = pitHagRoles.filter(r => r.type === 'townsfolk');
    const outsiderRoles = pitHagRoles.filter(r => r.type === 'outsider');
    const minionRoles = pitHagRoles.filter(r => r.type === 'minion');
    const demonRoles = pitHagRoles.filter(r => r.type === 'demon');
    
    const content = document.getElementById('nightActionContent');
    content.innerHTML = `
        <div class="action-notice" style="background: rgba(139, 0, 139, 0.2); border: 1px solid #8b008b; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
            <p style="color: #da70d6; font-weight: bold; margin-bottom: 0.5rem;">🧙‍♀️ 麻脸巫婆的能力</p>
            <p style="color: var(--text-secondary); font-size: 0.9rem;">选择一名玩家和一个角色，该玩家将变成那个角色。</p>
            <p style="color: var(--text-muted); font-size: 0.8rem; margin-top: 0.5rem;">
                注意：你可以选择任何角色，但如果选择的角色已在场，则无事发生。
            </p>
        </div>
        
        <div class="target-select-group">
            <label>选择目标玩家:</label>
            <select id="pitHagTarget" class="form-select" onchange="updatePitHagPlayerPreview()">
                <option value="">-- 选择玩家 --</option>
                ${targets.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
        </div>
        
        <div class="target-select-group" style="margin-top: 1rem;">
            <label>选择新角色:</label>
            <select id="pitHagRole" class="form-select" onchange="updatePitHagPlayerPreview()">
                <option value="">-- 选择角色 --</option>
                ${townsfolkRoles.length > 0 ? `
                <optgroup label="镇民">
                    ${townsfolkRoles.map(r => `
                        <option value="${r.id}" data-type="townsfolk" data-in-play="${r.in_play}">
                            ${r.name} ${r.in_play ? '(在场)' : ''}
                        </option>
                    `).join('')}
                </optgroup>
                ` : ''}
                ${outsiderRoles.length > 0 ? `
                <optgroup label="外来者">
                    ${outsiderRoles.map(r => `
                        <option value="${r.id}" data-type="outsider" data-in-play="${r.in_play}">
                            ${r.name} ${r.in_play ? '(在场)' : ''}
                        </option>
                    `).join('')}
                </optgroup>
                ` : ''}
                ${minionRoles.length > 0 ? `
                <optgroup label="爪牙">
                    ${minionRoles.map(r => `
                        <option value="${r.id}" data-type="minion" data-in-play="${r.in_play}">
                            ${r.name} ${r.in_play ? '(在场)' : ''}
                        </option>
                    `).join('')}
                </optgroup>
                ` : ''}
                ${demonRoles.length > 0 ? `
                <optgroup label="恶魔">
                    ${demonRoles.map(r => `
                        <option value="${r.id}" data-type="demon" data-in-play="${r.in_play}">
                            ${r.name} ${r.in_play ? '(在场)' : ''}
                        </option>
                    `).join('')}
                </optgroup>
                ` : ''}
            </select>
        </div>
        
        <div id="pitHagPreview" style="margin-top: 1rem; padding: 1rem; background: rgba(0,0,0,0.3); border-radius: 8px; display: none;">
            <p id="pitHagPreviewText" style="color: var(--color-gold);"></p>
        </div>
        
        <div id="pitHagInPlayWarning" style="display: none; margin-top: 1rem; padding: 1rem; background: rgba(243, 156, 18, 0.2); border: 1px solid #f39c12; border-radius: 8px;">
            <p style="color: #f39c12;">⚠️ 该角色已在场，选择后将无事发生</p>
        </div>
        
        <div id="pitHagDemonWarning" style="display: none; margin-top: 1rem; padding: 1rem; background: rgba(139, 0, 0, 0.3); border: 1px solid #8b0000; border-radius: 8px;">
            <p style="color: #ff6b6b;">⚠️ 你正在选择恶魔角色！说书人将决定后续处理。</p>
        </div>
        
        <button class="btn btn-primary" onclick="submitPitHagAction()" style="margin-top: 1rem; width: 100%;">
            ✓ 确认选择
        </button>
        <button class="btn btn-secondary" onclick="submitPendingAction(true)" style="margin-top: 0.5rem; width: 100%;">
            跳过 / 不选择
        </button>
    `;
}

function updatePitHagPlayerPreview() {
    const targetSelect = document.getElementById('pitHagTarget');
    const roleSelect = document.getElementById('pitHagRole');
    const preview = document.getElementById('pitHagPreview');
    const previewText = document.getElementById('pitHagPreviewText');
    const inPlayWarning = document.getElementById('pitHagInPlayWarning');
    const demonWarning = document.getElementById('pitHagDemonWarning');
    
    const targetId = targetSelect.value;
    const roleId = roleSelect.value;
    
    if (!targetId || !roleId) {
        preview.style.display = 'none';
        inPlayWarning.style.display = 'none';
        demonWarning.style.display = 'none';
        return;
    }
    
    const targetPlayer = playerState.players.find(p => p.id === parseInt(targetId));
    const selectedRole = pitHagRoles.find(r => r.id === roleId);
    const selectedOption = roleSelect.options[roleSelect.selectedIndex];
    
    if (targetPlayer && selectedRole) {
        preview.style.display = 'block';
        previewText.textContent = `将 ${targetPlayer.name} 变为 ${selectedRole.name}`;
        
        // 检查是否在场
        const inPlay = selectedOption.dataset.inPlay === 'true';
        inPlayWarning.style.display = inPlay ? 'block' : 'none';
        
        // 检查是否是恶魔
        const isDemon = selectedOption.dataset.type === 'demon';
        demonWarning.style.display = isDemon ? 'block' : 'none';
    }
}

async function submitPitHagAction() {
    const targetId = document.getElementById('pitHagTarget').value;
    const roleId = document.getElementById('pitHagRole').value;
    
    if (!targetId) {
        showInfo('请选择目标玩家');
        return;
    }
    
    if (!roleId) {
        showInfo('请选择新角色');
        return;
    }
    
    const result = await apiCall('/api/player/submit_pit_hag_action', 'POST', {
        game_id: playerState.gameId,
        player_id: playerState.playerId,
        target_player_id: parseInt(targetId),
        new_role_id: roleId
    });
    
    if (result.error) {
        showInfo(result.error);
        return;
    }
    
    // 显示结果
    const content = document.getElementById('nightActionContent');
    const targetPlayer = playerState.players.find(p => p.id === parseInt(targetId));
    const selectedRole = pitHagRoles.find(r => r.id === roleId);
    
    let resultMessage = '';
    if (result.role_in_play) {
        resultMessage = `你选择将 ${targetPlayer?.name} 变为 ${selectedRole?.name}，但该角色已在场，无事发生`;
    } else if (result.is_demon) {
        resultMessage = `你选择将 ${targetPlayer?.name} 变为 ${selectedRole?.name}（恶魔），等待说书人处理`;
    } else {
        resultMessage = `你选择将 ${targetPlayer?.name} 变为 ${selectedRole?.name}`;
    }
    
    content.innerHTML = `
        <div class="info-banner" style="background: rgba(39, 174, 96, 0.2); border-color: var(--color-alive);">
            <span class="icon">✓</span>
            <span>${resultMessage}</span>
        </div>
        <p style="color: var(--text-muted); margin-top: 1rem;">选择已同步到说书人端，等待处理...</p>
    `;
    
    currentPendingAction = null;
}

function showNightWaiting(text) {
    document.getElementById('nightWaiting').style.display = 'block';
    document.getElementById('nightActionPanel').style.display = 'none';
    document.getElementById('nightWaitingText').textContent = text || '请闭上眼睛，等待说书人的指示...';
}

function showNightAction(action) {
    if (!action || action.type === 'no_action') {
        showNightWaiting(action?.description || '你今晚没有行动');
        return;
    }
    
    document.getElementById('nightWaiting').style.display = 'none';
    document.getElementById('nightActionPanel').style.display = 'block';
    document.getElementById('nightActionTitle').textContent = `${playerState.role?.name || '你'} 的回合`;
    
    const content = document.getElementById('nightActionContent');
    
    // 检查是否已提交选择
    if (playerState.playerChoice && !playerState.playerChoice.confirmed) {
        content.innerHTML = `
            <div class="info-banner" style="background: rgba(39, 174, 96, 0.2); border-color: var(--color-alive);">
                <span class="icon">✓</span>
                <span>你已选择: ${playerState.playerChoice.target_names?.join(', ') || '无'}</span>
            </div>
            <p style="color: var(--text-muted); margin-top: 1rem;">等待说书人处理...</p>
        `;
        return;
    }
    
    let html = `
        <p style="color: var(--text-muted); margin-bottom: 1rem;">
            ${action.description || playerState.role?.ability || '请执行你的夜间行动'}
        </p>
    `;
    
    if (action.can_select && action.targets && action.targets.length > 0) {
        const maxTargets = action.max_targets || 1;
        
        if (maxTargets === 1) {
            html += `
                <div class="target-select-group">
                    <label>选择目标:</label>
                    <select id="nightTarget" class="form-select">
                        <option value="">-- 选择玩家 --</option>
                        ${action.targets.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                </div>
            `;
        } else {
            html += `
                <div class="target-select-group">
                    <label>选择第一个目标:</label>
                    <select id="nightTarget1" class="form-select">
                        <option value="">-- 选择玩家 --</option>
                        ${action.targets.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                </div>
                <div class="target-select-group" style="margin-top: 1rem;">
                    <label>选择第二个目标:</label>
                    <select id="nightTarget2" class="form-select">
                        <option value="">-- 选择玩家 --</option>
                        ${action.targets.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                </div>
            `;
        }
        
        html += `
            <button class="btn btn-primary" onclick="submitNightAction('${action.type}')" style="margin-top: 1rem; width: 100%;">
                ✓ 确认选择
            </button>
            <button class="btn btn-secondary" onclick="submitNightAction('${action.type}', true)" style="margin-top: 0.5rem; width: 100%;">
                跳过 / 不选择
            </button>
        `;
    } else if (action.type === 'info') {
        html += `
            <div class="info-banner">
                <span class="icon">⏳</span>
                <span>等待说书人告知信息...</span>
            </div>
        `;
    } else {
        html += `
            <div class="info-banner">
                <span class="icon">⏳</span>
                <span>等待说书人处理...</span>
            </div>
        `;
    }
    
    content.innerHTML = html;
}

async function submitNightAction(actionType, skip = false) {
    let targets = [];
    
    if (!skip) {
        const target1 = document.getElementById('nightTarget')?.value || document.getElementById('nightTarget1')?.value;
        const target2 = document.getElementById('nightTarget2')?.value;
        
        if (target1) targets.push(parseInt(target1));
        if (target2) targets.push(parseInt(target2));
    }
    
    const result = await apiCall('/api/player/night_action', 'POST', {
        game_id: playerState.gameId,
        player_id: playerState.playerId,
        targets: targets,
        action_type: actionType,
        extra_data: { skipped: skip }
    });
    
    if (result.error) {
        showInfo(result.error);
        return;
    }
    
    // 显示已提交状态
    const content = document.getElementById('nightActionContent');
    const targetNames = result.choice?.target_names?.join(', ') || '无';
    
    content.innerHTML = `
        <div class="info-banner" style="background: rgba(39, 174, 96, 0.2); border-color: var(--color-alive);">
            <span class="icon">✓</span>
            <span>${skip ? '你选择跳过' : `你已选择: ${targetNames}`}</span>
        </div>
        <p style="color: var(--text-muted); margin-top: 1rem;">选择已同步到说书人端，等待处理...</p>
    `;
}

function hideNightPanels() {
    document.getElementById('nightWaiting').style.display = 'none';
    document.getElementById('nightActionPanel').style.display = 'none';
}

// ==================== 游戏结束 ====================
function showGameEnd(gameEnd) {
    stopPolling();
    
    const isGood = playerState.roleType === 'townsfolk' || playerState.roleType === 'outsider';
    const won = (isGood && gameEnd.winner === 'good') || (!isGood && gameEnd.winner === 'evil');
    
    showInfo(`
        <div style="text-align: center;">
            <div style="font-size: 4rem; margin-bottom: 1rem;">${won ? '🎉' : '😢'}</div>
            <h2 style="color: ${won ? 'var(--color-alive)' : 'var(--color-dead)'}; margin-bottom: 1rem;">
                ${won ? '胜利！' : '失败...'}
            </h2>
            <p style="font-size: 1.2rem; margin-bottom: 0.5rem;">
                ${gameEnd.winner === 'good' ? '善良阵营' : '邪恶阵营'} 获胜
            </p>
            <p style="color: var(--text-muted);">${gameEnd.reason}</p>
        </div>
    `, '游戏结束');
    
    localStorage.removeItem('playerState');
}

// ==================== 工具函数 ====================
function updateConnectionStatus(connected) {
    const status = document.getElementById('connectionStatus');
    const text = document.getElementById('connectionText');
    
    if (connected) {
        status.className = 'connection-status connected';
        text.textContent = '已连接';
    } else {
        status.className = 'connection-status disconnected';
        text.textContent = '连接断开';
    }
}

function showInfo(message, title = '提示') {
    document.getElementById('infoModalTitle').textContent = title;
    document.getElementById('infoModalBody').innerHTML = message;
    openModal('infoModal');
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// 暴露给HTML调用
window.selectPlayer = selectPlayer;
window.submitNightAction = submitNightAction;
window.closeModal = closeModal;
