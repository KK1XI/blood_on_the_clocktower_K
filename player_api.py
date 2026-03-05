"""
血染钟楼 - 玩家端 API
更新日期: 2026-01-12

此模块包含所有玩家端相关的API端点，实现玩家与说书人的双向通信。
"""

from flask import Blueprint, request, jsonify, render_template
from datetime import datetime

# 创建蓝图
player_bp = Blueprint('player', __name__)

# games 字典将从主应用传入
games = None

def init_player_api(games_dict):
    """初始化玩家API，传入games字典"""
    global games
    games = games_dict


# ==================== 页面路由 ====================

@player_bp.route('/player')
def player_page():
    """玩家端页面"""
    return render_template('player.html')


# ==================== 游戏连接 API ====================

@player_bp.route('/api/player/find_game/<game_code>', methods=['GET'])
def find_game_by_code(game_code):
    """通过游戏代码查找游戏"""
    game_code = game_code.strip()
    
    # 尝试直接匹配
    if game_code in games:
        game = games[game_code]
        players = [{
            "id": p["id"],
            "name": p["name"],
            "connected": p.get("connected", False)
        } for p in game.players]
        
        return jsonify({
            "found": True,
            "game_id": game_code,
            "script_name": game.script["name"],
            "players": players,
            "player_count": game.player_count
        })
    
    # 尝试部分匹配（游戏ID的后半部分）
    for gid, game in games.items():
        if game_code in gid or gid.endswith(game_code):
            players = [{
                "id": p["id"],
                "name": p["name"],
                "connected": p.get("connected", False)
            } for p in game.players]
            
            return jsonify({
                "found": True,
                "game_id": gid,
                "script_name": game.script["name"],
                "players": players,
                "player_count": game.player_count
            })
    
    return jsonify({"found": False})


@player_bp.route('/api/player/join_game', methods=['POST'])
def player_join_game():
    """玩家加入游戏"""
    data = request.json
    game_id = data.get('game_id')
    player_id = data.get('player_id')
    
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    game = games[game_id]
    player = next((p for p in game.players if p["id"] == player_id), None)
    
    if not player:
        return jsonify({"error": "无效的玩家"}), 400
    
    if player.get("connected"):
        return jsonify({"error": "该座位已被占用"}), 400
    
    # 标记玩家已连接
    player["connected"] = True
    player["last_seen"] = datetime.now().isoformat()
    
    # 初始化玩家消息队列
    if "messages" not in player:
        player["messages"] = []
    
    return jsonify({
        "success": True,
        "player_name": player["name"],
        "role": player.get("role"),
        "role_type": player.get("role_type"),
        "alive": player.get("alive", True)
    })


@player_bp.route('/api/player/reconnect', methods=['POST'])
def player_reconnect():
    """玩家重新连接"""
    data = request.json
    game_id = data.get('game_id')
    player_id = data.get('player_id')
    
    if game_id not in games:
        return jsonify({"error": "游戏不存在", "success": False}), 404
    
    game = games[game_id]
    player = next((p for p in game.players if p["id"] == player_id), None)
    
    if not player:
        return jsonify({"error": "无效的玩家", "success": False}), 400
    
    # 重新标记连接
    player["connected"] = True
    player["last_seen"] = datetime.now().isoformat()
    
    # 返回完整游戏状态
    players_public = [{
        "id": p["id"],
        "name": p["name"],
        "alive": p.get("alive", True),
        "appears_dead": p.get("appears_dead", False)
    } for p in game.players]
    
    return jsonify({
        "success": True,
        "player_name": player["name"],
        "role": player.get("role"),
        "role_type": player.get("role_type"),
        "alive": player.get("alive", True),
        "current_phase": game.current_phase,
        "day_number": game.day_number,
        "night_number": game.night_number,
        "players": players_public
    })


# ==================== 游戏状态 API ====================

@player_bp.route('/api/player/game_state/<game_id>/<int:player_id>', methods=['GET'])
def get_player_game_state(game_id, player_id):
    """获取玩家视角的游戏状态（包含同步信息）"""
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    game = games[game_id]
    player = next((p for p in game.players if p["id"] == player_id), None)
    
    if not player:
        return jsonify({"error": "无效的玩家"}), 400
    
    # 更新最后在线时间
    player["last_seen"] = datetime.now().isoformat()
    
    # 公开的玩家信息
    players_public = [{
        "id": p["id"],
        "name": p["name"],
        "alive": p.get("alive", True) and not p.get("appears_dead", False),
        "connected": p.get("connected", False)
    } for p in game.players]
    
    # 公开日志
    public_log = [
        log for log in game.game_log 
        if log["type"] in ["phase", "death", "execution", "game_end", "game_event", "vote"]
    ]
    
    # 当前活跃的提名
    active_nomination = None
    for nom in game.nominations:
        if nom.get("status") == "voting":
            active_nomination = {
                "id": nom["id"],
                "nominator_id": nom.get("nominator_id"),
                "nominator_name": nom["nominator_name"],
                "nominee_id": nom.get("nominee_id"),
                "nominee_name": nom["nominee_name"],
                "vote_count": nom.get("vote_count", 0),
                "voters": nom.get("voters", []),
                "votes_detail": nom.get("votes_detail", {})  # 每个玩家的投票详情
            }
            break
    
    # 获取玩家的未读消息（来自说书人的信息）
    messages = player.get("messages", [])
    unread_messages = [m for m in messages if not m.get("read")]
    
    # 检查夜间行动
    my_turn = False
    night_action = None
    waiting_for_action = False
    
    if game.current_phase == "night":
        night_order = game.get_night_order()
        current_index = getattr(game, 'current_night_index', 0)
        
        # 检查是否在夜间行动序列中
        for i, action in enumerate(night_order):
            if action["player"]["id"] == player_id:
                if i == current_index:
                    my_turn = True
                elif i > current_index:
                    waiting_for_action = True
                break
        
        if my_turn:
            role_id = player.get("role", {}).get("id", "")
            role_type = player.get("role_type", "")
            
            # 确定行动类型和可选目标
            action_config = get_night_action_config(role_id, role_type, game, player_id)
            night_action = action_config
    
    # 检查玩家是否已提交夜间选择
    player_choice = None
    if hasattr(game, 'player_night_choices') and player_id in game.player_night_choices:
        player_choice = game.player_night_choices[player_id]
    
    # 检查游戏结束
    game_end = game.check_game_end() if hasattr(game, 'check_game_end') else None
    
    return jsonify({
        "players": players_public,
        "current_phase": game.current_phase,
        "day_number": game.day_number,
        "night_number": game.night_number,
        "nominations": [{
            "id": n["id"],
            "nominator_name": n["nominator_name"],
            "nominee_name": n["nominee_name"],
            "nominee_id": n.get("nominee_id"),
            "status": n.get("status", "pending"),
            "vote_count": n.get("vote_count", 0),
            "voters": n.get("voters", [])
        } for n in game.nominations],
        "active_nomination": active_nomination,
        "my_status": {
            "alive": player.get("alive", True),
            "vote_token": player.get("vote_token", True),
            "role": player.get("role"),
            "role_type": player.get("role_type"),
            "drunk": player.get("drunk", False),
            "poisoned": player.get("poisoned", False)
        },
        "my_turn": my_turn,
        "waiting_for_action": waiting_for_action,
        "night_action": night_action,
        "player_choice": player_choice,
        "messages": unread_messages,
        "public_log": public_log[-30:],  # 最近30条
        "game_end": game_end
    })


def get_night_action_config(role_id, role_type, game, player_id):
    """获取夜间行动配置"""
    alive_players = [p for p in game.players if p.get("alive", True) and p["id"] != player_id]
    all_players = [p for p in game.players if p["id"] != player_id]
    
    # 基础配置
    config = {
        "type": "other",
        "role_id": role_id,
        "can_select": False,
        "targets": [],
        "max_targets": 1,
        "description": ""
    }
    
    # 根据角色类型配置
    if role_type == "demon":
        config["type"] = "kill"
        config["can_select"] = True
        config["targets"] = [{"id": p["id"], "name": p["name"]} for p in alive_players]
        config["description"] = "选择一名玩家击杀"
    
    elif role_id == "monk":
        config["type"] = "protect"
        config["can_select"] = True
        config["targets"] = [{"id": p["id"], "name": p["name"]} for p in alive_players]
        config["description"] = "选择一名玩家保护"
    
    elif role_id == "poisoner":
        config["type"] = "poison"
        config["can_select"] = True
        config["targets"] = [{"id": p["id"], "name": p["name"]} for p in alive_players]
        config["description"] = "选择一名玩家下毒"
    
    elif role_id == "fortune_teller":
        config["type"] = "fortune_tell"
        config["can_select"] = True
        config["targets"] = [{"id": p["id"], "name": p["name"]} for p in all_players]
        config["max_targets"] = 2
        config["description"] = "选择两名玩家查验是否有恶魔"
    
    elif role_id == "empath":
        config["type"] = "info"
        config["can_select"] = False
        config["description"] = "等待说书人告知你邻座的邪恶玩家数量"
    
    elif role_id == "undertaker":
        config["type"] = "info"
        config["can_select"] = False
        config["description"] = "等待说书人告知昨天被处决玩家的角色"
    
    elif role_id == "ravenkeeper":
        config["type"] = "investigate"
        config["can_select"] = True
        config["targets"] = [{"id": p["id"], "name": p["name"]} for p in all_players]
        config["description"] = "选择一名玩家查验其角色"
    
    elif role_id == "slayer":
        config["type"] = "day_ability"
        config["can_select"] = False
        config["description"] = "你的能力在白天使用"
    
    elif role_id == "butler":
        config["type"] = "choose_master"
        config["can_select"] = True
        config["targets"] = [{"id": p["id"], "name": p["name"]} for p in alive_players]
        config["description"] = "选择你的主人（只能跟随主人投票）"
    
    elif role_id == "spy":
        config["type"] = "info"
        config["can_select"] = False
        config["description"] = "你可以查看魔典（说书人会告知信息）"
    
    elif role_id in ["washerwoman", "librarian", "investigator", "chef", "clockmaker"]:
        config["type"] = "info"
        config["can_select"] = False
        config["description"] = "等待说书人提供首夜信息"
    
    else:
        config["type"] = "no_action"
        config["description"] = "你今晚没有行动"
    
    return config


# ==================== 玩家行动 API ====================

@player_bp.route('/api/player/night_action', methods=['POST'])
def player_night_action():
    """玩家提交夜间行动选择（同步到说书人端）"""
    data = request.json
    game_id = data.get('game_id')
    player_id = data.get('player_id')
    targets = data.get('targets', [])  # 可以是单个目标或多个目标
    action_type = data.get('action_type')
    extra_data = data.get('extra_data', {})
    
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    game = games[game_id]
    player = next((p for p in game.players if p["id"] == player_id), None)
    
    if not player:
        return jsonify({"error": "无效的玩家"}), 400
    
    # 初始化玩家夜间选择存储
    if not hasattr(game, 'player_night_choices'):
        game.player_night_choices = {}
    
    # 记录玩家的选择
    choice = {
        "player_id": player_id,
        "player_name": player["name"],
        "role_id": player.get("role", {}).get("id", ""),
        "role_name": player.get("role", {}).get("name", ""),
        "targets": targets,
        "action_type": action_type,
        "extra_data": extra_data,
        "submitted_at": datetime.now().isoformat(),
        "confirmed": False  # 等待说书人确认
    }
    
    # 添加目标名称
    target_names = []
    for tid in targets:
        target_player = next((p for p in game.players if p["id"] == tid), None)
        if target_player:
            target_names.append(target_player["name"])
    choice["target_names"] = target_names
    
    game.player_night_choices[player_id] = choice
    
    # 添加日志（仅对说书人可见）
    if targets:
        game.add_log(f"[玩家选择] {player['name']} ({choice['role_name']}) 选择了 {', '.join(target_names)}", "player_action")
    
    return jsonify({
        "success": True,
        "message": "选择已提交，等待说书人处理",
        "choice": choice
    })


@player_bp.route('/api/player/vote', methods=['POST'])
def player_vote():
    """玩家投票（同步到说书人端）"""
    data = request.json
    game_id = data.get('game_id')
    player_id = data.get('player_id')
    nomination_id = data.get('nomination_id')
    vote_value = data.get('vote')
    
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    game = games[game_id]
    player = next((p for p in game.players if p["id"] == player_id), None)
    
    if not player:
        return jsonify({"error": "无效的玩家"}), 400
    
    # 检查是否可以投票
    if not player.get("alive", True) and not player.get("vote_token", False):
        return jsonify({"error": "你已死亡且没有投票令牌"}), 400
    
    # 找到提名
    nomination = next((n for n in game.nominations if n["id"] == nomination_id), None)
    if not nomination:
        return jsonify({"error": "无效的提名"}), 400
    
    # 初始化投票记录
    if "voters" not in nomination:
        nomination["voters"] = []
    if "votes_detail" not in nomination:
        nomination["votes_detail"] = {}
    
    # 检查是否已投票
    if player_id in nomination["voters"]:
        return jsonify({"error": "你已经投过票了"}), 400
    
    # 记录投票
    nomination["voters"].append(player_id)
    nomination["votes_detail"][player_id] = {
        "player_name": player["name"],
        "vote": vote_value,
        "is_alive": player.get("alive", True),
        "time": datetime.now().isoformat()
    }
    
    if vote_value:
        nomination["vote_count"] = nomination.get("vote_count", 0) + 1
    
    # 如果死亡玩家投赞成票，消耗令牌
    if not player.get("alive", True) and vote_value:
        player["vote_token"] = False
    
    vote_text = "赞成" if vote_value else "反对"
    game.add_log(f"{player['name']} 投了{vote_text}票", "vote")
    
    return jsonify({
        "success": True,
        "vote_count": nomination.get("vote_count", 0),
        "total_voters": len(nomination["voters"])
    })


# ==================== 消息同步 API ====================

@player_bp.route('/api/player/messages/<game_id>/<int:player_id>', methods=['GET'])
def get_player_messages(game_id, player_id):
    """获取玩家的消息（来自说书人）"""
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    game = games[game_id]
    player = next((p for p in game.players if p["id"] == player_id), None)
    
    if not player:
        return jsonify({"error": "无效的玩家"}), 400
    
    messages = player.get("messages", [])
    
    return jsonify({
        "messages": messages,
        "unread_count": len([m for m in messages if not m.get("read")])
    })


@player_bp.route('/api/player/messages/<game_id>/<int:player_id>/read', methods=['POST'])
def mark_messages_read(game_id, player_id):
    """标记消息为已读"""
    data = request.json
    message_ids = data.get('message_ids', [])
    
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    game = games[game_id]
    player = next((p for p in game.players if p["id"] == player_id), None)
    
    if not player:
        return jsonify({"error": "无效的玩家"}), 400
    
    messages = player.get("messages", [])
    for msg in messages:
        if msg.get("id") in message_ids or not message_ids:
            msg["read"] = True
    
    return jsonify({"success": True})


# ==================== 说书人发送消息 API ====================

@player_bp.route('/api/storyteller/send_message', methods=['POST'])
def send_message_to_player():
    """说书人向玩家发送信息（如角色信息、查验结果等）"""
    data = request.json
    game_id = data.get('game_id')
    player_id = data.get('player_id')
    message_type = data.get('type', 'info')  # info, night_result, warning, etc.
    content = data.get('content', '')
    title = data.get('title', '来自说书人的信息')
    
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    game = games[game_id]
    player = next((p for p in game.players if p["id"] == player_id), None)
    
    if not player:
        return jsonify({"error": "无效的玩家"}), 400
    
    # 初始化消息队列
    if "messages" not in player:
        player["messages"] = []
    
    # 创建消息
    message = {
        "id": f"msg_{datetime.now().timestamp()}",
        "type": message_type,
        "title": title,
        "content": content,
        "time": datetime.now().isoformat(),
        "read": False
    }
    
    player["messages"].append(message)
    
    # 保留最近50条消息
    if len(player["messages"]) > 50:
        player["messages"] = player["messages"][-50:]
    
    return jsonify({
        "success": True,
        "message_id": message["id"]
    })


@player_bp.route('/api/storyteller/send_night_result', methods=['POST'])
def send_night_result():
    """说书人发送夜间行动结果"""
    data = request.json
    game_id = data.get('game_id')
    player_id = data.get('player_id')
    result_type = data.get('result_type')  # number, role, yes_no, players, etc.
    result_data = data.get('result_data')
    is_fake = data.get('is_fake', False)  # 是否是假信息（醉酒/中毒时）
    
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    game = games[game_id]
    player = next((p for p in game.players if p["id"] == player_id), None)
    
    if not player:
        return jsonify({"error": "无效的玩家"}), 400
    
    # 初始化消息队列
    if "messages" not in player:
        player["messages"] = []
    
    # 根据结果类型生成描述
    role_name = player.get("role", {}).get("name", "你的角色")
    
    if result_type == "info":
        # 直接使用传入的信息文本
        content = str(result_data)
    elif result_type == "number":
        content = f"你得到的数字是: {result_data}"
    elif result_type == "yes_no":
        content = f"结果是: {'是' if result_data else '否'}"
    elif result_type == "role":
        content = f"该玩家的角色是: {result_data}"
    elif result_type == "players":
        if isinstance(result_data, list):
            content = f"相关玩家: {', '.join(result_data)}"
        else:
            content = str(result_data)
    else:
        content = str(result_data)
    
    message = {
        "id": f"result_{datetime.now().timestamp()}",
        "type": "night_result",
        "title": f"🌙 {role_name}的夜间信息",
        "content": content,
        "result_type": result_type,
        "result_data": result_data,
        "time": datetime.now().isoformat(),
        "read": False
    }
    
    player["messages"].append(message)
    
    # 清除玩家的夜间选择（已处理）
    if hasattr(game, 'player_night_choices') and player_id in game.player_night_choices:
        game.player_night_choices[player_id]["confirmed"] = True
    
    # 同时清除待处理行动，防止玩家端轮询时重新显示等待面板覆盖消息
    if hasattr(game, 'pending_actions') and player_id in game.pending_actions:
        game.pending_actions[player_id]["status"] = "confirmed"
    
    return jsonify({
        "success": True,
        "message_id": message["id"]
    })


# ==================== 说书人获取玩家选择 API ====================

@player_bp.route('/api/storyteller/player_choices/<game_id>', methods=['GET'])
def get_player_choices(game_id):
    """获取所有玩家的夜间选择（供说书人查看）"""
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    game = games[game_id]
    choices = getattr(game, 'player_night_choices', {})
    
    return jsonify({
        "choices": choices
    })


@player_bp.route('/api/storyteller/confirm_action', methods=['POST'])
def confirm_player_action():
    """说书人确认玩家的夜间行动"""
    data = request.json
    game_id = data.get('game_id')
    player_id = data.get('player_id')
    
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    game = games[game_id]
    
    if hasattr(game, 'player_night_choices') and player_id in game.player_night_choices:
        game.player_night_choices[player_id]["confirmed"] = True
        return jsonify({"success": True})
    
    return jsonify({"error": "未找到该玩家的选择"}), 400


# ==================== 玩家连接状态 API ====================

@player_bp.route('/api/player/heartbeat', methods=['POST'])
def player_heartbeat():
    """玩家心跳，保持连接状态"""
    data = request.json
    game_id = data.get('game_id')
    player_id = data.get('player_id')
    
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    game = games[game_id]
    player = next((p for p in game.players if p["id"] == player_id), None)
    
    if not player:
        return jsonify({"error": "无效的玩家"}), 400
    
    player["connected"] = True
    player["last_seen"] = datetime.now().isoformat()
    
    return jsonify({"success": True})


@player_bp.route('/api/storyteller/player_status/<game_id>', methods=['GET'])
def get_players_connection_status(game_id):
    """获取所有玩家的连接状态"""
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    game = games[game_id]
    
    players_status = []
    for p in game.players:
        last_seen = p.get("last_seen")
        is_online = False
        
        if last_seen:
            try:
                last_dt = datetime.fromisoformat(last_seen)
                # 10秒内有心跳认为在线
                is_online = (datetime.now() - last_dt).total_seconds() < 10
            except:
                pass
        
        players_status.append({
            "id": p["id"],
            "name": p["name"],
            "connected": p.get("connected", False),
            "online": is_online,
            "last_seen": last_seen
        })
    
    return jsonify({
        "players": players_status
    })


# ==================== 行动通知 API ====================
# 更新日期: 2026-01-12 - 说书人推送行动请求给玩家

@player_bp.route('/api/storyteller/notify_action', methods=['POST'])
def notify_player_action():
    """说书人通知玩家执行行动"""
    data = request.json
    game_id = data.get('game_id')
    player_id = data.get('player_id')
    action_type = data.get('action_type')  # night_action, day_action
    action_config = data.get('action_config', {})  # 行动配置
    
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    game = games[game_id]
    player = next((p for p in game.players if p["id"] == player_id), None)
    
    if not player:
        return jsonify({"error": "无效的玩家"}), 400
    
    # 初始化待处理行动
    if not hasattr(game, 'pending_actions'):
        game.pending_actions = {}
    
    # 获取存活玩家列表作为可选目标
    alive_players = [
        {"id": p["id"], "name": p["name"]} 
        for p in game.players 
        if p.get("alive", True) and p["id"] != player_id
    ]
    
    all_players = [
        {"id": p["id"], "name": p["name"]} 
        for p in game.players 
        if p["id"] != player_id
    ]
    
    # 占卜师等角色可以选择包括自己在内的所有玩家
    all_players_with_self = [
        {"id": p["id"], "name": p["name"]} 
        for p in game.players
    ]
    
    # 构建行动请求
    role = player.get("role", {})
    role_id = role.get("id", "")
    role_name = role.get("name", "未知角色")
    
    # 占卜师可以选择包括自己在内的任何玩家
    include_self_roles = ["fortune_teller"]
    if role_id in include_self_roles and not action_config.get("use_alive_only", True):
        target_list = all_players_with_self
    elif action_config.get("use_alive_only", True):
        target_list = alive_players
    else:
        target_list = all_players
    
    pending_action = {
        "player_id": player_id,
        "player_name": player["name"],
        "role_id": role_id,
        "role_name": role_name,
        "action_type": action_type,
        "phase": game.current_phase,
        "config": action_config,
        "targets": target_list,
        "max_targets": action_config.get("max_targets", 1),
        "can_skip": action_config.get("can_skip", True),
        "description": action_config.get("description", role.get("ability", "")),
        "created_at": datetime.now().isoformat(),
        "status": "pending",  # pending, submitted, confirmed
        "choice": None
    }
    
    game.pending_actions[player_id] = pending_action
    
    # 清除之前的选择
    if hasattr(game, 'player_night_choices') and player_id in game.player_night_choices:
        del game.player_night_choices[player_id]
    
    game.add_log(f"[系统] 等待 {player['name']} ({role_name}) 进行行动选择", "info")
    
    return jsonify({
        "success": True,
        "pending_action": pending_action
    })


@player_bp.route('/api/player/pending_action/<game_id>/<int:player_id>', methods=['GET'])
def get_pending_action(game_id, player_id):
    """玩家获取待处理的行动请求"""
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    game = games[game_id]
    player = next((p for p in game.players if p["id"] == player_id), None)
    
    if not player:
        return jsonify({"error": "无效的玩家"}), 400
    
    pending_actions = getattr(game, 'pending_actions', {})
    pending = pending_actions.get(player_id)
    
    if pending and pending.get("status") == "pending":
        return jsonify({
            "has_pending": True,
            "action": pending
        })
    
    if pending and pending.get("status") == "submitted":
        return jsonify({
            "has_pending": False,
            "action": pending
        })
    
    return jsonify({"has_pending": False})


@player_bp.route('/api/player/submit_action', methods=['POST'])
def submit_player_action():
    """玩家提交行动选择"""
    data = request.json
    game_id = data.get('game_id')
    player_id = data.get('player_id')
    targets = data.get('targets', [])
    extra_data = data.get('extra_data', {})
    skipped = data.get('skipped', False)
    
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    game = games[game_id]
    player = next((p for p in game.players if p["id"] == player_id), None)
    
    if not player:
        return jsonify({"error": "无效的玩家"}), 400
    
    pending_actions = getattr(game, 'pending_actions', {})
    pending = pending_actions.get(player_id)
    
    if not pending or pending.get("status") != "pending":
        return jsonify({"error": "没有待处理的行动"}), 400
    
    # 获取目标名称
    target_names = []
    for tid in targets:
        target_player = next((p for p in game.players if p["id"] == tid), None)
        if target_player:
            target_names.append(target_player["name"])
    
    # 更新行动状态
    pending["status"] = "submitted"
    pending["choice"] = {
        "targets": targets,
        "target_names": target_names,
        "extra_data": extra_data,
        "skipped": skipped,
        "submitted_at": datetime.now().isoformat()
    }
    
    # 同时存储到player_night_choices供说书人查看
    if not hasattr(game, 'player_night_choices'):
        game.player_night_choices = {}
    
    game.player_night_choices[player_id] = {
        "player_id": player_id,
        "player_name": player["name"],
        "role_id": pending["role_id"],
        "role_name": pending["role_name"],
        "targets": targets,
        "target_names": target_names,
        "extra_data": extra_data,
        "skipped": skipped,
        "submitted_at": datetime.now().isoformat(),
        "confirmed": False
    }
    
    if skipped:
        game.add_log(f"[玩家选择] {player['name']} ({pending['role_name']}) 选择跳过行动", "player_action")
    else:
        game.add_log(f"[玩家选择] {player['name']} ({pending['role_name']}) 选择了 {', '.join(target_names)}", "player_action")
    
    return jsonify({
        "success": True,
        "message": "选择已提交"
    })


# ==================== 守鸦人玩家端 API ====================

@player_bp.route('/api/player/ravenkeeper_status/<game_id>/<int:player_id>', methods=['GET'])
def get_ravenkeeper_status(game_id, player_id):
    """检查守鸦人玩家是否在本夜被触发（死亡后需要选择查验目标）"""
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404

    game = games[game_id]
    player = next((p for p in game.players if p["id"] == player_id), None)

    if not player:
        return jsonify({"error": "无效的玩家"}), 400

    # 检查是否是守鸦人且已被触发
    is_ravenkeeper = (player.get("role") and player["role"].get("id") == "ravenkeeper")
    triggered = player.get("ravenkeeper_triggered", False)
    already_chosen = player.get("ravenkeeper_choice_made", False)

    if is_ravenkeeper and triggered and not already_chosen:
        all_players = [
            {"id": p["id"], "name": p["name"]}
            for p in game.players if p["id"] != player_id
        ]
        return jsonify({
            "triggered": True,
            "already_chosen": False,
            "targets": all_players,
            "description": "你在夜间死亡！请选择一名玩家，你将得知他的角色。"
        })

    if is_ravenkeeper and triggered and already_chosen:
        return jsonify({
            "triggered": True,
            "already_chosen": True,
            "result": player.get("ravenkeeper_result")
        })

    return jsonify({"triggered": False})


@player_bp.route('/api/player/ravenkeeper_choose', methods=['POST'])
def ravenkeeper_choose():
    """守鸦人玩家提交查验选择，立即返回目标角色"""
    data = request.json
    game_id = data.get('game_id')
    player_id = data.get('player_id')
    target_id = data.get('target_id')

    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404

    game = games[game_id]
    player = next((p for p in game.players if p["id"] == player_id), None)
    target = next((p for p in game.players if p["id"] == target_id), None)

    if not player or not target:
        return jsonify({"error": "无效的玩家"}), 400

    if not player.get("ravenkeeper_triggered"):
        return jsonify({"error": "守鸦人未被触发"}), 400

    if player.get("ravenkeeper_choice_made"):
        return jsonify({"error": "已经做出选择", "result": player.get("ravenkeeper_result")}), 400

    # 判断守鸦人是否中毒/醉酒
    is_drunk_or_poisoned = player.get("drunk", False) or player.get("poisoned", False)

    # 获取目标真实角色
    if is_drunk_or_poisoned:
        # 醉酒/中毒时给假信息：随机选一个不同的角色
        import random
        all_roles = []
        for role_type in ["townsfolk", "outsider", "minion", "demon"]:
            all_roles.extend(game.script["roles"].get(role_type, []))
        real_role_id = target["role"]["id"] if target.get("role") else None
        fake_roles = [r for r in all_roles if r["id"] != real_role_id]
        if fake_roles:
            fake_role = random.choice(fake_roles)
            role_name = fake_role["name"]
        else:
            role_name = target["role"]["name"] if target.get("role") else "未知"
    else:
        # 正常情况：显示真实角色（酒鬼显示"酒鬼"）
        if target.get("is_the_drunk") and target.get("true_role"):
            role_name = target["true_role"]["name"]
        else:
            role_name = target["role"]["name"] if target.get("role") else "未知"

    result_data = {
        "target_id": target_id,
        "target_name": target["name"],
        "role_name": role_name,
        "message": f"{target['name']} 的角色是 {role_name}"
    }

    # 记录选择
    player["ravenkeeper_choice_made"] = True
    player["ravenkeeper_result"] = result_data

    game.add_log(
        f"[守鸦人] {player['name']} 查验了 {target['name']}，得知角色为 {role_name}",
        "night"
    )

    return jsonify({
        "success": True,
        "result": result_data
    })


@player_bp.route('/api/storyteller/clear_pending_action', methods=['POST'])
def clear_pending_action():
    """说书人清除玩家的待处理行动"""
    data = request.json
    game_id = data.get('game_id')
    player_id = data.get('player_id')
    
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    game = games[game_id]
    
    if hasattr(game, 'pending_actions') and player_id in game.pending_actions:
        del game.pending_actions[player_id]
    
    return jsonify({"success": True})


@player_bp.route('/api/storyteller/night_progress/<game_id>', methods=['GET'])
def get_night_progress(game_id):
    """获取夜间行动进度（说书人用，包含所有玩家提交状态）"""
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404

    game = games[game_id]
    choices = getattr(game, 'player_night_choices', {})
    pending = getattr(game, 'pending_actions', {})

    submitted = {}
    for pid, choice in choices.items():
        submitted[pid] = {
            "player_name": choice.get("player_name"),
            "role_name": choice.get("role_name"),
            "targets": choice.get("targets", []),
            "target_names": choice.get("target_names", []),
            "extra_data": choice.get("extra_data", {}),
            "skipped": choice.get("skipped", False),
            "confirmed": choice.get("confirmed", False),
            "submitted_at": choice.get("submitted_at")
        }

    pending_status = {}
    for pid, action in pending.items():
        pending_status[pid] = {
            "status": action.get("status", "pending"),
            "role_name": action.get("role_name"),
            "player_name": action.get("player_name"),
            "has_choice": action.get("choice") is not None
        }

    return jsonify({
        "submitted_choices": submitted,
        "pending_actions": pending_status,
        "phase": game.current_phase,
        "night_number": game.night_number
    })


# ==================== 白天行动 API ====================

@player_bp.route('/api/storyteller/notify_day_action', methods=['POST'])
def notify_day_action():
    """说书人通知玩家执行白天行动（如杀手）"""
    data = request.json
    game_id = data.get('game_id')
    player_id = data.get('player_id')
    action_config = data.get('action_config', {})
    
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    game = games[game_id]
    player = next((p for p in game.players if p["id"] == player_id), None)
    
    if not player:
        return jsonify({"error": "无效的玩家"}), 400
    
    # 初始化待处理行动
    if not hasattr(game, 'pending_actions'):
        game.pending_actions = {}
    
    # 获取存活玩家列表
    alive_players = [
        {"id": p["id"], "name": p["name"]} 
        for p in game.players 
        if p.get("alive", True) and p["id"] != player_id
    ]
    
    role = player.get("role", {})
    role_id = role.get("id", "")
    role_name = role.get("name", "未知角色")
    
    pending_action = {
        "player_id": player_id,
        "player_name": player["name"],
        "role_id": role_id,
        "role_name": role_name,
        "action_type": "day_action",
        "phase": "day",
        "config": action_config,
        "targets": alive_players,
        "max_targets": action_config.get("max_targets", 1),
        "can_skip": action_config.get("can_skip", True),
        "description": action_config.get("description", role.get("ability", "")),
        "created_at": datetime.now().isoformat(),
        "status": "pending",
        "choice": None
    }
    
    game.pending_actions[player_id] = pending_action
    
    game.add_log(f"[系统] {player['name']} ({role_name}) 正在进行白天行动", "info")
    
    return jsonify({
        "success": True,
        "pending_action": pending_action
    })


@player_bp.route('/api/player/day_action/<game_id>/<int:player_id>', methods=['GET'])
def get_day_action(game_id, player_id):
    """玩家获取待处理的白天行动"""
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    game = games[game_id]
    player = next((p for p in game.players if p["id"] == player_id), None)
    
    if not player:
        return jsonify({"error": "无效的玩家"}), 400
    
    pending_actions = getattr(game, 'pending_actions', {})
    pending = pending_actions.get(player_id)
    
    if pending and pending.get("status") == "pending" and pending.get("action_type") == "day_action":
        return jsonify({
            "has_pending": True,
            "action": pending
        })
    
    return jsonify({"has_pending": False})


# ==================== 麻脸巫婆特殊处理 API ====================

@player_bp.route('/api/player/pit_hag_roles/<game_id>', methods=['GET'])
def get_pit_hag_all_roles(game_id):
    """获取麻脸巫婆可选的所有角色（玩家端用，不过滤）"""
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    game = games[game_id]
    
    # 获取当前场上的角色
    current_role_ids = set()
    for p in game.players:
        if p.get("role"):
            current_role_ids.add(p["role"].get("id"))
    
    # 获取剧本中所有角色
    all_roles = []
    for role_type in ["townsfolk", "outsider", "minion", "demon"]:
        for role in game.script["roles"].get(role_type, []):
            all_roles.append({
                "id": role["id"],
                "name": role["name"],
                "type": role_type,
                "ability": role.get("ability", ""),
                "in_play": role["id"] in current_role_ids  # 标记是否在场
            })
    
    return jsonify({
        "roles": all_roles,
        "current_role_ids": list(current_role_ids)
    })


@player_bp.route('/api/player/submit_pit_hag_action', methods=['POST'])
def submit_pit_hag_action():
    """玩家提交麻脸巫婆的行动"""
    data = request.json
    game_id = data.get('game_id')
    player_id = data.get('player_id')
    target_player_id = data.get('target_player_id')
    new_role_id = data.get('new_role_id')
    
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    game = games[game_id]
    player = next((p for p in game.players if p["id"] == player_id), None)
    target = next((p for p in game.players if p["id"] == target_player_id), None)
    
    if not player or not target:
        return jsonify({"error": "无效的玩家"}), 400
    
    # 检查角色是否在场
    current_role_ids = set()
    for p in game.players:
        if p.get("role"):
            current_role_ids.add(p["role"].get("id"))
    
    role_in_play = new_role_id in current_role_ids
    
    # 获取角色信息
    new_role = None
    new_role_type = None
    for role_type in ["townsfolk", "outsider", "minion", "demon"]:
        for role in game.script["roles"].get(role_type, []):
            if role["id"] == new_role_id:
                new_role = role
                new_role_type = role_type
                break
        if new_role:
            break
    
    # 存储选择
    if not hasattr(game, 'player_night_choices'):
        game.player_night_choices = {}
    
    game.player_night_choices[player_id] = {
        "player_id": player_id,
        "player_name": player["name"],
        "role_id": "pit_hag",
        "role_name": "麻脸巫婆",
        "targets": [target_player_id],
        "target_names": [target["name"]],
        "extra_data": {
            "new_role_id": new_role_id,
            "new_role_name": new_role["name"] if new_role else "未知",
            "new_role_type": new_role_type,
            "role_in_play": role_in_play,
            "is_demon": new_role_type == "demon",
            "target_old_role": target.get("role", {}).get("name", "未知")
        },
        "submitted_at": datetime.now().isoformat(),
        "confirmed": False,
        "requires_storyteller_decision": new_role_type == "demon"  # 恶魔需要说书人决定
    }
    
    # 更新pending_actions状态
    if hasattr(game, 'pending_actions') and player_id in game.pending_actions:
        game.pending_actions[player_id]["status"] = "submitted"
        game.pending_actions[player_id]["choice"] = game.player_night_choices[player_id]
    
    if role_in_play:
        game.add_log(f"[玩家选择] 麻脸巫婆选择将 {target['name']} 变为 {new_role['name']}（角色在场，无事发生）", "player_action")
    else:
        game.add_log(f"[玩家选择] 麻脸巫婆选择将 {target['name']} 变为 {new_role['name']}", "player_action")
    
    return jsonify({
        "success": True,
        "role_in_play": role_in_play,
        "is_demon": new_role_type == "demon",
        "message": "角色已在场，无事发生" if role_in_play else "选择已提交，等待说书人处理"
    })


# ==================== 语音接口 API ====================

@player_bp.route('/api/voice/tts', methods=['POST'])
def voice_tts():
    """文本转语音接口（TTS）- 将说书人的文本信息转为语音"""
    data = request.json
    text = data.get('text', '')
    language = data.get('language', 'zh-CN')
    voice_id = data.get('voice_id', 'storyteller')
    speed = data.get('speed', 1.0)

    if not text:
        return jsonify({"error": "文本不能为空"}), 400

    voice_config = getattr(voice_tts, '_config', None)
    if voice_config and voice_config.get('enabled'):
        provider = voice_config.get('provider', 'local')
        api_url = voice_config.get('api_url', '')
        api_key = voice_config.get('api_key', '')

        return jsonify({
            "success": True,
            "provider": provider,
            "request": {
                "text": text,
                "language": language,
                "voice_id": voice_id,
                "speed": speed,
                "api_url": api_url
            },
            "message": "TTS请求已准备，需要前端调用实际TTS服务"
        })

    return jsonify({
        "success": True,
        "provider": "stub",
        "text": text,
        "language": language,
        "message": "TTS服务未配置，返回文本供前端使用Web Speech API"
    })


@player_bp.route('/api/voice/stt', methods=['POST'])
def voice_stt():
    """语音转文本接口（STT）- 将玩家语音转为文本指令"""
    data = request.json
    audio_data = data.get('audio_data')
    language = data.get('language', 'zh-CN')
    context = data.get('context', 'game_action')

    voice_config = getattr(voice_stt, '_config', None)
    if voice_config and voice_config.get('enabled'):
        provider = voice_config.get('provider', 'local')
        return jsonify({
            "success": True,
            "provider": provider,
            "message": "STT请求已准备，需要前端调用实际STT服务"
        })

    return jsonify({
        "success": True,
        "provider": "stub",
        "message": "STT服务未配置，建议前端使用Web Speech API的SpeechRecognition"
    })


@player_bp.route('/api/voice/config', methods=['GET'])
def get_voice_config():
    """获取语音服务配置"""
    return jsonify({
        "tts": {
            "enabled": False,
            "provider": "web_speech_api",
            "supported_providers": ["web_speech_api", "azure", "google_cloud", "openai"],
            "description": "文本转语音，用于说书人自动朗读信息"
        },
        "stt": {
            "enabled": False,
            "provider": "web_speech_api",
            "supported_providers": ["web_speech_api", "azure", "google_cloud", "openai_whisper"],
            "description": "语音转文本，用于玩家语音操作"
        }
    })


@player_bp.route('/api/voice/config', methods=['POST'])
def update_voice_config():
    """更新语音服务配置"""
    data = request.json
    tts_config = data.get('tts', {})
    stt_config = data.get('stt', {})

    if tts_config:
        voice_tts._config = tts_config
    if stt_config:
        voice_stt._config = stt_config

    return jsonify({"success": True, "message": "语音配置已更新"})


# ==================== 服务器连接接口 API ====================

_server_config = {
    "mode": "local",
    "remote_url": None,
    "api_key": None,
    "sync_enabled": False,
    "websocket_url": None
}


@player_bp.route('/api/server/config', methods=['GET'])
def get_server_config():
    """获取服务器连接配置"""
    return jsonify({
        "mode": _server_config["mode"],
        "remote_url": _server_config["remote_url"],
        "sync_enabled": _server_config["sync_enabled"],
        "websocket_url": _server_config["websocket_url"],
        "supported_modes": ["local", "remote", "hybrid"],
        "description": {
            "local": "本地模式 - 所有玩家连接到同一局域网",
            "remote": "远程模式 - 通过远程服务器中转",
            "hybrid": "混合模式 - 本地优先，远程备份"
        }
    })


@player_bp.route('/api/server/config', methods=['POST'])
def update_server_config():
    """更新服务器连接配置"""
    global _server_config
    data = request.json

    if 'mode' in data:
        _server_config["mode"] = data["mode"]
    if 'remote_url' in data:
        _server_config["remote_url"] = data["remote_url"]
    if 'api_key' in data:
        _server_config["api_key"] = data["api_key"]
    if 'sync_enabled' in data:
        _server_config["sync_enabled"] = data["sync_enabled"]
    if 'websocket_url' in data:
        _server_config["websocket_url"] = data["websocket_url"]

    return jsonify({"success": True, "config": _server_config})


@player_bp.route('/api/server/sync_state', methods=['POST'])
def sync_game_state_to_server():
    """将游戏状态同步到远程服务器（未来用）"""
    if _server_config["mode"] == "local":
        return jsonify({"success": False, "message": "当前为本地模式，无需同步"})

    data = request.json
    game_id = data.get('game_id')

    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404

    game = games[game_id]
    state = game.to_dict()

    remote_url = _server_config.get("remote_url")
    if not remote_url:
        return jsonify({
            "success": False,
            "message": "远程服务器URL未配置",
            "state_snapshot": state
        })

    return jsonify({
        "success": True,
        "message": "状态已准备同步（需实现远程推送）",
        "remote_url": remote_url,
        "state_snapshot": state
    })


@player_bp.route('/api/server/pull_state', methods=['POST'])
def pull_game_state_from_server():
    """从远程服务器拉取游戏状态（未来用）"""
    if _server_config["mode"] == "local":
        return jsonify({"success": False, "message": "当前为本地模式"})

    remote_url = _server_config.get("remote_url")
    if not remote_url:
        return jsonify({"success": False, "message": "远程服务器URL未配置"})

    return jsonify({
        "success": True,
        "message": "远程拉取接口已就绪（需实现远程请求）",
        "remote_url": remote_url
    })


@player_bp.route('/api/server/health', methods=['GET'])
def server_health():
    """服务器健康检查"""
    active_games = len(games) if games else 0
    total_players = 0
    online_players = 0

    if games:
        for game in games.values():
            total_players += len(game.players)
            for p in game.players:
                if p.get("connected"):
                    online_players += 1

    return jsonify({
        "status": "healthy",
        "mode": _server_config["mode"],
        "active_games": active_games,
        "total_players": total_players,
        "online_players": online_players,
        "version": "1.0.0"
    })


@player_bp.route('/api/storyteller/confirm_pit_hag', methods=['POST'])
def confirm_pit_hag_action():
    """说书人确认麻脸巫婆的行动（特别是创造恶魔时）"""
    data = request.json
    game_id = data.get('game_id')
    pit_hag_player_id = data.get('pit_hag_player_id')
    allow_demon_survive = data.get('allow_demon_survive', False)  # 是否让新恶魔存活
    
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    game = games[game_id]
    
    if not hasattr(game, 'player_night_choices') or pit_hag_player_id not in game.player_night_choices:
        return jsonify({"error": "未找到麻脸巫婆的选择"}), 400
    
    choice = game.player_night_choices[pit_hag_player_id]
    extra = choice.get("extra_data", {})
    
    if extra.get("role_in_play"):
        # 角色在场，无事发生
        choice["confirmed"] = True
        game.add_log(f"[夜间] 麻脸巫婆的能力无效（选择的角色已在场）", "night")
        return jsonify({
            "success": True,
            "effect": "no_effect",
            "message": "角色已在场，无事发生"
        })
    
    # 执行角色转换
    target_id = choice["targets"][0]
    target = next((p for p in game.players if p["id"] == target_id), None)
    
    if target:
        old_role_name = target.get("role", {}).get("name", "未知")
        new_role_id = extra.get("new_role_id")
        new_role_name = extra.get("new_role_name")
        new_role_type = extra.get("new_role_type")
        
        # 获取完整角色信息
        new_role = None
        for role_type in ["townsfolk", "outsider", "minion", "demon"]:
            for role in game.script["roles"].get(role_type, []):
                if role["id"] == new_role_id:
                    new_role = role
                    break
            if new_role:
                break
        
        if new_role:
            target["role"] = new_role
            target["role_type"] = new_role_type
            
            if extra.get("is_demon"):
                game.add_log(f"[夜间] 麻脸巫婆将 {target['name']} 从 {old_role_name} 变为 {new_role_name}（新恶魔）", "night")
                if not allow_demon_survive:
                    # 说书人选择让新恶魔死亡
                    # 这里不直接杀死，而是标记需要处理
                    choice["demon_killed"] = True
                    game.add_log(f"[夜间] 说书人决定：新恶魔今晚死亡", "night")
            else:
                game.add_log(f"[夜间] 麻脸巫婆将 {target['name']} 从 {old_role_name} 变为 {new_role_name}", "night")
    
    choice["confirmed"] = True
    
    return jsonify({
        "success": True,
        "effect": "role_changed",
        "is_demon": extra.get("is_demon", False),
        "demon_survives": allow_demon_survive if extra.get("is_demon") else None
    })
