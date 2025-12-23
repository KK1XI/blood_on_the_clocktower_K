from flask import Flask, render_template, request, jsonify, session
import random
import json
from datetime import datetime
from game_data import SCRIPTS, ROLE_TYPES, get_role_distribution, NIGHT_ORDER_PHASES, DAY_PHASES

app = Flask(__name__)
app.secret_key = 'blood_on_the_clocktower_storyteller_secret_key_2024'

# 全局游戏状态存储
games = {}

class Game:
    def __init__(self, game_id, script_id, player_count):
        self.game_id = game_id
        self.script_id = script_id
        self.script = SCRIPTS[script_id]
        self.player_count = player_count
        self.players = []
        self.role_distribution = get_role_distribution(player_count)
        self.current_phase = "setup"  # setup, night, day
        self.day_number = 0
        self.night_number = 0
        self.nominations = []
        self.votes = {}
        self.executions = []
        self.night_actions = []
        self.night_deaths = []
        self.game_log = []
        self.created_at = datetime.now().isoformat()
        
    def to_dict(self):
        return {
            "game_id": self.game_id,
            "script_id": self.script_id,
            "script_name": self.script["name"],
            "player_count": self.player_count,
            "players": self.players,
            "role_distribution": self.role_distribution,
            "current_phase": self.current_phase,
            "day_number": self.day_number,
            "night_number": self.night_number,
            "nominations": self.nominations,
            "votes": self.votes,
            "executions": self.executions,
            "night_deaths": self.night_deaths,
            "game_log": self.game_log
        }
    
    def add_log(self, message, log_type="info"):
        self.game_log.append({
            "time": datetime.now().strftime("%H:%M:%S"),
            "type": log_type,
            "message": message
        })
    
    def get_available_roles(self):
        """获取当前剧本的所有可用角色"""
        roles = {
            "townsfolk": self.script["roles"]["townsfolk"],
            "outsider": self.script["roles"]["outsider"],
            "minion": self.script["roles"]["minion"],
            "demon": self.script["roles"]["demon"]
        }
        return roles
    
    def assign_roles_randomly(self, player_names):
        """随机分配角色"""
        self.players = []
        available_roles = self.get_available_roles()
        distribution = self.role_distribution.copy()  # 复制一份，避免修改原始数据
        
        selected_roles = []
        
        # 首先检查是否会有设置阶段能力的角色（男爵、教父等）
        # 先预选爪牙角色
        minion_roles = available_roles["minion"].copy()
        random.shuffle(minion_roles)
        selected_minions = minion_roles[:distribution.get("minion", 0)]
        
        # 检查是否有男爵（+2外来者，-2镇民）
        has_baron = any(m["id"] == "baron" for m in selected_minions)
        # 检查是否有教父（±1外来者）
        has_godfather = any(m["id"] == "godfather" for m in selected_minions)
        
        # 计算外来者调整
        outsider_adjustment = 0
        
        # 男爵：固定 +2 外来者
        if has_baron:
            outsider_adjustment += 2
            self.add_log(f"男爵在场：外来者 +2，镇民 -2", "setup")
        
        # 教父：±1 外来者（根据当前外来者数量决定）
        if has_godfather:
            current_outsiders = distribution.get("outsider", 0) + outsider_adjustment
            if current_outsiders == 0:
                # 如果没有外来者，必须+1（否则教父无法使用能力）
                outsider_adjustment += 1
                self.add_log(f"教父在场：外来者 +1，镇民 -1（场上无外来者，必须添加）", "setup")
            else:
                # 如果有外来者，随机选择+1或-1
                godfather_choice = random.choice([1, -1])
                outsider_adjustment += godfather_choice
                if godfather_choice == 1:
                    self.add_log(f"教父在场：外来者 +1，镇民 -1", "setup")
                else:
                    self.add_log(f"教父在场：外来者 -1，镇民 +1", "setup")
        
        # 应用调整
        if outsider_adjustment != 0:
            outsider_count = distribution.get("outsider", 0) + outsider_adjustment
            townsfolk_count = distribution.get("townsfolk", 0) - outsider_adjustment
            # 确保不会出现负数
            outsider_count = max(0, outsider_count)
            townsfolk_count = max(0, townsfolk_count)
            distribution["outsider"] = outsider_count
            distribution["townsfolk"] = townsfolk_count
        
        # 选择角色（爪牙已经预选好了）
        selected_roles.extend(selected_minions)
        
        for role_type, count in distribution.items():
            if role_type == "minion":
                continue  # 爪牙已经选好了
            type_roles = available_roles[role_type].copy()
            random.shuffle(type_roles)
            selected_roles.extend(type_roles[:count])
        
        random.shuffle(selected_roles)
        random.shuffle(player_names)
        
        # 为酒鬼准备假的镇民角色列表（排除已选的镇民）
        selected_townsfolk_ids = [r["id"] for r in selected_roles if self._get_role_type(r) == "townsfolk"]
        fake_townsfolk_for_drunk = [r for r in available_roles["townsfolk"] if r["id"] not in selected_townsfolk_ids]
        
        for i, name in enumerate(player_names):
            role = selected_roles[i] if i < len(selected_roles) else None
            
            # 检查是否是酒鬼，如果是则分配假的镇民角色
            is_the_drunk = role and role.get("id") == "drunk"
            displayed_role = role
            true_role = None
            
            if is_the_drunk and fake_townsfolk_for_drunk:
                # 为酒鬼随机选择一个假的镇民角色显示
                random.shuffle(fake_townsfolk_for_drunk)
                displayed_role = fake_townsfolk_for_drunk[0]
                true_role = role  # 保存真实角色（酒鬼）
            
            player = {
                "id": i + 1,
                "name": name,
                "role": displayed_role,
                "role_type": self._get_role_type(role) if role else None,  # 真实角色类型
                "true_role": true_role,  # 如果是酒鬼，存储真实角色
                "is_the_drunk": is_the_drunk,  # 是否是酒鬼
                "alive": True,
                "poisoned": False,
                "poisoned_until": None,  # 中毒结束时间 {"day": x, "night": y}
                "drunk": is_the_drunk,  # 酒鬼永久处于醉酒状态
                "drunk_until": None if not is_the_drunk else {"permanent": True},  # 酒鬼永久醉酒
                "protected": False,
                "vote_token": True,
                "ability_used": False,  # 一次性技能是否已使用
                "notes": ""
            }
            self.players.append(player)
        
        self.add_log(f"已随机分配 {len(player_names)} 名玩家的角色", "setup")
        return self.players
    
    def assign_roles_manually(self, assignments):
        """手动分配角色"""
        self.players = []
        available_roles = self.get_available_roles()
        
        # 检查是否有设置阶段能力的角色
        has_baron = any(a.get("role_id") == "baron" for a in assignments)
        has_godfather = any(a.get("role_id") == "godfather" for a in assignments)
        if has_baron:
            self.add_log(f"男爵在场：请确保外来者数量比标准多2个", "setup")
        if has_godfather:
            self.add_log(f"教父在场：请确保外来者数量比标准 +1 或 -1（由说书人决定）", "setup")
        
        # 收集已分配的镇民角色ID
        assigned_townsfolk_ids = [a["role_id"] for a in assignments if a.get("role_id") and 
                                   self._get_role_type(self._find_role_by_id(a["role_id"])) == "townsfolk"]
        fake_townsfolk_for_drunk = [r for r in available_roles["townsfolk"] if r["id"] not in assigned_townsfolk_ids]
        
        for i, assignment in enumerate(assignments):
            role = self._find_role_by_id(assignment["role_id"]) if assignment.get("role_id") else None
            
            # 检查是否是酒鬼
            is_the_drunk = role and role.get("id") == "drunk"
            displayed_role = role
            true_role = None
            
            # 如果是酒鬼，检查是否指定了假角色，否则随机选择
            if is_the_drunk:
                if assignment.get("drunk_fake_role_id"):
                    displayed_role = self._find_role_by_id(assignment["drunk_fake_role_id"])
                elif fake_townsfolk_for_drunk:
                    random.shuffle(fake_townsfolk_for_drunk)
                    displayed_role = fake_townsfolk_for_drunk[0]
                true_role = role
            
            player = {
                "id": i + 1,
                "name": assignment["name"],
                "role": displayed_role,
                "role_type": self._get_role_type(role) if role else None,  # 真实角色类型
                "true_role": true_role,  # 如果是酒鬼，存储真实角色
                "is_the_drunk": is_the_drunk,  # 是否是酒鬼
                "alive": True,
                "poisoned": False,
                "poisoned_until": None,
                "drunk": is_the_drunk,  # 酒鬼永久处于醉酒状态
                "drunk_until": None if not is_the_drunk else {"permanent": True},
                "protected": False,
                "vote_token": True,
                "ability_used": False,
                "notes": ""
            }
            self.players.append(player)
        
        self.add_log(f"已手动分配 {len(assignments)} 名玩家的角色", "setup")
        return self.players
    
    def _find_role_by_id(self, role_id):
        """根据角色ID查找角色"""
        for role_type in ["townsfolk", "outsider", "minion", "demon"]:
            for role in self.script["roles"][role_type]:
                if role["id"] == role_id:
                    return role
        return None
    
    def _get_role_type(self, role):
        """获取角色类型"""
        if not role:
            return None
        for role_type in ["townsfolk", "outsider", "minion", "demon"]:
            for r in self.script["roles"][role_type]:
                if r["id"] == role["id"]:
                    return role_type
        return None
    
    def start_night(self):
        """开始夜晚"""
        self.night_number += 1
        self.current_phase = "night"
        self.night_deaths = []
        self.night_actions = []
        self.protected_players = []  # 今晚被保护的玩家ID列表
        self.demon_kills = []  # 恶魔选择的击杀目标
        
        # 重置所有玩家的保护状态，并检查状态过期
        for player in self.players:
            player["protected"] = False
            
            # 检查醉酒状态是否过期
            if player.get("drunk") and player.get("drunk_until"):
                until = player["drunk_until"]
                if until.get("night") and self.night_number > until["night"]:
                    player["drunk"] = False
                    player["drunk_until"] = None
                    self.add_log(f"{player['name']} 的醉酒状态已结束", "status")
            
            # 检查中毒状态是否过期（投毒者的毒在新的夜晚会被重新设置）
            # 这里不清除，因为投毒者每晚重新选择目标
            
        self.add_log(f"第 {self.night_number} 个夜晚开始", "phase")
        
    def get_night_order(self):
        """获取夜晚行动顺序"""
        night_roles = []
        is_first_night = self.night_number == 1
        
        # 定义一次性技能角色
        once_per_game_roles = [
            "slayer",       # 杀手
            "virgin",       # 贞洁者
            "courtier",     # 侍臣
            "professor",    # 教授
            "seamstress",   # 女裁缝
            "philosopher",  # 哲学家
            "artist",       # 艺术家
            "assassin"      # 刺客
        ]
        
        for player in self.players:
            if player["alive"] and player["role"]:
                role = player["role"]
                role_id = role.get("id", "")
                
                # 跳过被动触发的角色（如守鸦人、贤者等 - 只在触发时处理）
                if role.get("passive_trigger"):
                    continue
                
                # 跳过说书人控制的角色（如修补匠、造谣者等）
                if role.get("storyteller_controlled"):
                    continue
                
                # 检查是否是一次性技能且已使用
                if role_id in once_per_game_roles and player.get("ability_used", False):
                    continue  # 跳过已使用技能的一次性角色
                
                if is_first_night and role.get("first_night"):
                    night_roles.append({
                        "player": player,
                        "role": role,
                        "order": role.get("night_order", 99)
                    })
                elif not is_first_night and role.get("other_nights"):
                    night_roles.append({
                        "player": player,
                        "role": role,
                        "order": role.get("night_order", 99)
                    })
        
        # 按顺序排序
        night_roles.sort(key=lambda x: x["order"])
        return night_roles
    
    def record_night_action(self, player_id, action, target=None, result=None, action_type=None, extra_data=None):
        """记录夜间行动"""
        player = next((p for p in self.players if p["id"] == player_id), None)
        target_player = next((p for p in self.players if p["id"] == target), None) if target else None
        
        # 一次性技能角色列表
        once_per_game_roles = [
            "slayer", "virgin", "courtier", "professor", 
            "seamstress", "philosopher", "artist", "assassin"
        ]
        
        self.night_actions.append({
            "player_id": player_id,
            "action": action,
            "target": target,
            "result": result,
            "action_type": action_type,
            "time": datetime.now().strftime("%H:%M:%S")
        })
        
        # 处理保护类行动
        if action_type == "protect" and target:
            if not hasattr(self, 'protected_players'):
                self.protected_players = []
            self.protected_players.append(target)
            if target_player:
                target_player["protected"] = True
                self.add_log(f"[夜间] {player['name']} 保护了 {target_player['name']}", "night")
            
            # 旅店老板特殊处理：第二个目标
            if extra_data and extra_data.get("second_target"):
                second_target_id = extra_data["second_target"]
                second_target_player = next((p for p in self.players if p["id"] == second_target_id), None)
                if second_target_player:
                    self.protected_players.append(second_target_id)
                    second_target_player["protected"] = True
                    self.add_log(f"[夜间] {player['name']} 也保护了 {second_target_player['name']}", "night")
                
                # 处理其中一人醉酒
                drunk_target_id = extra_data.get("drunk_target")
                if drunk_target_id:
                    drunk_player = next((p for p in self.players if p["id"] == drunk_target_id), None)
                    if drunk_player:
                        drunk_player["drunk"] = True
                        drunk_player["drunk_until"] = {
                            "day": self.day_number + 1,
                            "night": self.night_number + 1
                        }
                        self.add_log(f"[夜间] {drunk_player['name']} 因旅店老板的能力喝醉了", "night")
        
        # 处理击杀类行动（恶魔）
        elif action_type == "kill" and target:
            if not hasattr(self, 'demon_kills'):
                self.demon_kills = []
            self.demon_kills.append({
                "killer_id": player_id,
                "target_id": target,
                "killer_name": player['name'] if player else '未知',
                "target_name": target_player['name'] if target_player else '未知'
            })
            self.add_log(f"[夜间] {player['name']} 选择击杀 {target_player['name'] if target_player else '未知'}", "night")
        
        # 处理投毒类行动
        elif action_type == "poison" and target:
            if target_player:
                target_player["poisoned"] = True
                # 投毒持续到明天白天结束
                target_player["poisoned_until"] = {"day": self.day_number + 1, "phase": "day_end"}
                self.add_log(f"[夜间] {player['name']} 对 {target_player['name']} 下毒", "night")
        
        # 处理普卡的特殊投毒（选择新目标中毒，前一晚目标死亡）
        elif action_type == "pukka_poison" and target:
            if target_player and player:
                # 获取普卡之前的中毒目标
                previous_victim_id = player.get("pukka_previous_target")
                
                # 前一晚的目标死亡（如果存在且未被保护）
                if previous_victim_id:
                    previous_victim = next((p for p in self.players if p["id"] == previous_victim_id), None)
                    if previous_victim and previous_victim["alive"]:
                        # 检查是否被保护
                        is_protected = previous_victim.get("protected", False)
                        if not is_protected:
                            # 添加到恶魔击杀列表
                            if not hasattr(self, 'demon_kills'):
                                self.demon_kills = []
                            self.demon_kills.append({
                                "killer_id": player_id,
                                "target_id": previous_victim_id,
                                "killer_name": player['name'],
                                "target_name": previous_victim['name'],
                                "kill_type": "pukka_delayed"
                            })
                            self.add_log(f"[夜间] {previous_victim['name']} 因普卡的毒素死亡", "night")
                        else:
                            self.add_log(f"[夜间] {previous_victim['name']} 被保护，免疫普卡的毒杀", "night")
                        
                        # 清除前一个目标的中毒状态（恢复健康）
                        previous_victim["poisoned"] = False
                        previous_victim.pop("poisoned_until", None)
                
                # 新目标中毒
                target_player["poisoned"] = True
                target_player["poisoned_by_pukka"] = True
                # 普卡的毒持续到被新目标取代
                target_player["poisoned_until"] = None  # 无期限，直到被新目标取代
                
                # 记录当前目标为下一晚的前一目标
                player["pukka_previous_target"] = target
                
                self.add_log(f"[夜间] {player['name']} (普卡) 选择 {target_player['name']} 中毒", "night")
        
        # 处理醉酒类行动（如侍臣让目标醉酒3天3夜）
        elif action_type == "drunk" and target:
            if target_player:
                duration = extra_data.get("duration", 3) if extra_data else 3  # 默认3天3夜
                target_player["drunk"] = True
                target_player["drunk_until"] = {
                    "day": self.day_number + duration,
                    "night": self.night_number + duration
                }
                self.add_log(f"[夜间] {player['name']} 使 {target_player['name']} 醉酒 {duration} 天", "night")
        
        # 处理水手的特殊醉酒（水手和目标中一人醉酒）
        elif action_type == "sailor_drunk" and target:
            if target_player and player:
                # 由说书人决定谁醉酒（通过 extra_data.drunk_choice）
                drunk_choice = extra_data.get("drunk_choice", "target") if extra_data else "target"
                drunk_player = target_player if drunk_choice == "target" else player
                
                drunk_player["drunk"] = True
                # 醉酒持续到明天黄昏
                drunk_player["drunk_until"] = {
                    "day": self.day_number + 1,
                    "night": self.night_number + 1
                }
                drunk_name = drunk_player['name']
                self.add_log(f"[夜间] {player['name']} (水手) 选择了 {target_player['name']}，{drunk_name} 喝醉了", "night")
        
        # 处理祖母选择孙子
        elif action_type == "grandchild_select" and target:
            if target_player:
                target_player["is_grandchild"] = True
                target_player["grandchild_of"] = player_id
                # 同时记录祖母知道孙子的角色
                player["grandchild_id"] = target
                self.add_log(f"[夜间] {player['name']} (祖母) 得知 {target_player['name']} 是她的孙子，角色是 {target_player['role']['name'] if target_player.get('role') else '未知'}", "night")
        
        # 处理管家选择主人
        elif action_type == "butler_master" and target:
            if target_player and player:
                player["butler_master_id"] = target
                player["butler_master_name"] = target_player["name"]
                self.add_log(f"[夜间] {player['name']} (管家) 选择 {target_player['name']} 作为主人", "night")
        
        # 处理跳过行动
        elif action_type == "skip":
            self.add_log(f"[夜间] {player['name']} 选择不行动", "night")
        
        # 其他行动
        elif player:
            target_text = f" -> {target_player['name']}" if target_player else ""
            self.add_log(f"[夜间] {player['name']} 执行了行动: {action}{target_text}", "night")
        
        # 标记一次性技能已使用（只要执行了行动且不是跳过）
        if player and action_type != "skip":
            role_id = player.get("role", {}).get("id", "") if player.get("role") else ""
            if role_id in once_per_game_roles:
                player["ability_used"] = True
                self.add_log(f"[系统] {player['name']} 的一次性技能已使用", "info")
    
    def process_night_kills(self):
        """处理夜间击杀，考虑保护效果"""
        if not hasattr(self, 'demon_kills'):
            return []
        
        actual_deaths = []
        protected = getattr(self, 'protected_players', [])
        
        for kill in self.demon_kills:
            target_id = kill["target_id"]
            target_player = next((p for p in self.players if p["id"] == target_id), None)
            
            if not target_player:
                continue
            
            # 检查是否被保护
            if target_id in protected:
                self.add_log(f"{target_player['name']} 被保护，免疫了恶魔的击杀", "night")
                continue
            
            # 检查是否是士兵（恶魔无法杀死）
            if target_player.get("role") and target_player["role"].get("id") == "soldier":
                if not target_player.get("poisoned") and not target_player.get("drunk"):
                    self.add_log(f"{target_player['name']} 是士兵，免疫了恶魔的击杀", "night")
                    continue
            
            # 添加到死亡列表
            actual_deaths.append({
                "player_id": target_id,
                "player_name": target_player["name"],
                "cause": "恶魔击杀"
            })
        
        return actual_deaths
    
    def add_night_death(self, player_id, cause="恶魔击杀"):
        """添加夜间死亡"""
        player = next((p for p in self.players if p["id"] == player_id), None)
        if player:
            self.night_deaths.append({
                "player_id": player_id,
                "player_name": player["name"],
                "cause": cause
            })
    
    def start_day(self):
        """开始白天"""
        self.day_number += 1
        self.current_phase = "day"
        self.nominations = []
        self.votes = {}
        
        # 处理恶魔击杀（考虑保护）
        demon_deaths = self.process_night_kills()
        for death in demon_deaths:
            if death not in self.night_deaths:
                self.night_deaths.append(death)
        
        # 处理夜间死亡
        for death in self.night_deaths:
            player = next((p for p in self.players if p["id"] == death["player_id"]), None)
            if player:
                player["alive"] = False
                self.add_log(f"{player['name']} 在夜间死亡 ({death['cause']})", "death")
        
        self.add_log(f"第 {self.day_number} 天开始", "phase")
    
    def nominate(self, nominator_id, nominee_id):
        """提名"""
        nominator = next((p for p in self.players if p["id"] == nominator_id), None)
        nominee = next((p for p in self.players if p["id"] == nominee_id), None)
        
        if not nominator or not nominee:
            return {"success": False, "error": "无效的玩家"}
        
        if not nominator["alive"]:
            return {"success": False, "error": "死亡玩家不能提名"}
        
        # 检查是否已经提名过
        for nom in self.nominations:
            if nom["nominator_id"] == nominator_id:
                return {"success": False, "error": "该玩家今天已经提名过"}
        
        nomination = {
            "id": len(self.nominations) + 1,
            "nominator_id": nominator_id,
            "nominator_name": nominator["name"],
            "nominee_id": nominee_id,
            "nominee_name": nominee["name"],
            "votes": [],
            "vote_count": 0,
            "status": "pending"
        }
        
        self.nominations.append(nomination)
        self.add_log(f"{nominator['name']} 提名了 {nominee['name']}", "nomination")
        
        # 检查贞洁者能力触发
        virgin_triggered = False
        nominee_role_id = nominee.get("role", {}).get("id") if nominee.get("role") else None
        
        # 如果被提名者是贞洁者，且能力未使用，且提名者是镇民
        if (nominee_role_id == "virgin" and 
            not nominee.get("virgin_ability_used", False) and
            nominator.get("role_type") == "townsfolk"):
            
            # 标记贞洁者能力已使用
            nominee["virgin_ability_used"] = True
            
            # 提名者立即被处决
            nominator["alive"] = False
            
            # 记录处决
            self.executions.append({
                "day": self.day_number,
                "executed_id": nominator_id,
                "executed_name": nominator["name"],
                "reason": "virgin_ability",
                "vote_count": 0,
                "required_votes": 0
            })
            
            virgin_triggered = True
            self.add_log(f"⚡ 贞洁者能力触发！{nominator['name']} 是镇民，立即被处决！", "execution")
            
            # 更新提名状态
            nomination["status"] = "virgin_triggered"
        
        return {
            "success": True, 
            "nomination": nomination,
            "virgin_triggered": virgin_triggered,
            "executed_player": nominator["name"] if virgin_triggered else None
        }
    
    def vote(self, nomination_id, voter_id, vote_value):
        """投票"""
        nomination = next((n for n in self.nominations if n["id"] == nomination_id), None)
        voter = next((p for p in self.players if p["id"] == voter_id), None)
        
        if not nomination or not voter:
            return {"success": False, "error": "无效的提名或玩家"}
        
        # 检查是否已经投过票
        for v in nomination["votes"]:
            if v["voter_id"] == voter_id:
                return {"success": False, "error": "该玩家已经投过票"}
        
        # 死亡玩家只有一次投票机会（弃票令牌）
        if not voter["alive"] and not voter["vote_token"]:
            return {"success": False, "error": "该死亡玩家已经使用过投票令牌"}
        
        # 管家投票限制：只有当主人投票时才能投票
        if voter.get("butler_master_id") and vote_value:
            master_id = voter["butler_master_id"]
            # 检查主人是否已经在这次提名中投了赞成票
            master_voted = False
            for v in nomination["votes"]:
                if v["voter_id"] == master_id and v["vote"]:
                    master_voted = True
                    break
            if not master_voted:
                master_name = voter.get("butler_master_name", "主人")
                return {"success": False, "error": f"管家只能在主人（{master_name}）投赞成票后才能投赞成票"}
        
        vote_record = {
            "voter_id": voter_id,
            "voter_name": voter["name"],
            "vote": vote_value,  # True = 赞成, False = 反对
            "voter_alive": voter["alive"]
        }
        
        nomination["votes"].append(vote_record)
        if vote_value:
            nomination["vote_count"] += 1
            
        # 死亡玩家投票后消耗令牌
        if not voter["alive"] and vote_value:
            voter["vote_token"] = False
        
        vote_text = "赞成" if vote_value else "反对"
        self.add_log(f"{voter['name']} 对 {nomination['nominee_name']} 投了{vote_text}票", "vote")
        return {"success": True}
    
    def execute(self, nomination_id):
        """执行处决"""
        nomination = next((n for n in self.nominations if n["id"] == nomination_id), None)
        if not nomination:
            return {"success": False, "error": "无效的提名"}
        
        nominee = next((p for p in self.players if p["id"] == nomination["nominee_id"]), None)
        if not nominee:
            return {"success": False, "error": "无效的被提名者"}
        
        # 计算需要的票数（存活玩家的一半）
        alive_count = len([p for p in self.players if p["alive"]])
        required_votes = (alive_count // 2) + 1
        
        if nomination["vote_count"] >= required_votes:
            nominee["alive"] = False
            nomination["status"] = "executed"
            self.executions.append({
                "day": self.day_number,
                "player_id": nominee["id"],
                "player_name": nominee["name"],
                "vote_count": nomination["vote_count"],
                "required_votes": required_votes
            })
            self.add_log(f"{nominee['name']} 被处决 (获得 {nomination['vote_count']}/{required_votes} 票)", "execution")
            return {"success": True, "executed": True, "player": nominee}
        else:
            nomination["status"] = "failed"
            self.add_log(f"{nominee['name']} 未被处决 (获得 {nomination['vote_count']}/{required_votes} 票)", "execution")
            return {"success": True, "executed": False}
    
    def check_game_end(self):
        """检查游戏是否结束"""
        alive_players = [p for p in self.players if p["alive"]]
        demons_alive = [p for p in alive_players if p["role_type"] == "demon"]
        evil_alive = [p for p in alive_players if p["role_type"] in ["demon", "minion"]]
        good_alive = [p for p in alive_players if p["role_type"] in ["townsfolk", "outsider"]]
        
        # 恶魔死亡，善良获胜
        if not demons_alive:
            return {"ended": True, "winner": "good", "reason": "恶魔已被消灭"}
        
        # 只剩2名玩家且恶魔存活，邪恶获胜
        if len(alive_players) <= 2 and demons_alive:
            return {"ended": True, "winner": "evil", "reason": "邪恶势力占领了小镇"}
        
        return {"ended": False}
    
    def update_player_status(self, player_id, status_type, value):
        """更新玩家状态"""
        player = next((p for p in self.players if p["id"] == player_id), None)
        if player and status_type in ["poisoned", "drunk", "protected", "alive"]:
            player[status_type] = value
            status_text = "是" if value else "否"
            self.add_log(f"更新 {player['name']} 的 {status_type} 状态为 {status_text}", "status")
            return {"success": True}
        return {"success": False, "error": "无效的玩家或状态"}
    
    def generate_info(self, player_id, info_type, targets=None):
        """生成角色信息"""
        player = next((p for p in self.players if p["id"] == player_id), None)
        if not player or not player["role"]:
            return None
        
        role = player["role"]
        role_id = role["id"]
        
        # 检查玩家是否处于醉酒/中毒状态（信息可能错误）
        is_drunk_or_poisoned = player.get("drunk", False) or player.get("poisoned", False)
        
        # 获取目标玩家
        target_players = []
        if targets:
            for tid in targets:
                tp = next((p for p in self.players if p["id"] == tid), None)
                if tp:
                    target_players.append(tp)
        
        # 根据角色类型生成信息
        if role_id == "washerwoman":
            return self._generate_washerwoman_info(player, is_drunk_or_poisoned)
        elif role_id == "librarian":
            return self._generate_librarian_info(player, is_drunk_or_poisoned)
        elif role_id == "investigator":
            return self._generate_investigator_info(player, is_drunk_or_poisoned)
        elif role_id == "chef":
            return self._generate_chef_info(player, is_drunk_or_poisoned)
        elif role_id == "empath":
            return self._generate_empath_info(player, is_drunk_or_poisoned)
        elif role_id == "fortune_teller":
            return self._generate_fortune_teller_info(player, target_players, is_drunk_or_poisoned)
        elif role_id == "clockmaker":
            return self._generate_clockmaker_info(player, is_drunk_or_poisoned)
        elif role_id == "chambermaid":
            return self._generate_chambermaid_info(player, target_players, is_drunk_or_poisoned)
        elif role_id == "seamstress":
            return self._generate_seamstress_info(player, target_players, is_drunk_or_poisoned)
        elif role_id == "dreamer":
            return self._generate_dreamer_info(player, target_players, is_drunk_or_poisoned)
        elif role_id == "undertaker":
            return self._generate_undertaker_info(player, is_drunk_or_poisoned)
        elif role_id == "ravenkeeper":
            return self._generate_ravenkeeper_info(player, target_players, is_drunk_or_poisoned)
        elif role_id == "oracle":
            return self._generate_oracle_info(player, is_drunk_or_poisoned)
        elif role_id == "flowergirl":
            return self._generate_flowergirl_info(player, is_drunk_or_poisoned)
        
        return {"message": f"请根据 {role['name']} 的能力自行提供信息"}
    
    def _generate_washerwoman_info(self, player, is_drunk_or_poisoned=False):
        """生成洗衣妇信息"""
        townsfolk_players = [p for p in self.players if p["role_type"] == "townsfolk" and p["id"] != player["id"]]
        if not townsfolk_players:
            return {"message": "场上没有其他镇民", "is_drunk_or_poisoned": is_drunk_or_poisoned}
        
        target = random.choice(townsfolk_players)
        other_players = [p for p in self.players if p["id"] not in [player["id"], target["id"]]]
        decoy = random.choice(other_players) if other_players else None
        
        players_shown = [target["name"]]
        if decoy:
            players_shown.append(decoy["name"])
            random.shuffle(players_shown)
        
        return {
            "info_type": "washerwoman",
            "players": players_shown,
            "role": target["role"]["name"],
            "message": f"在 {' 和 '.join(players_shown)} 中，有一人是 {target['role']['name']}",
            "is_drunk_or_poisoned": is_drunk_or_poisoned
        }
    
    def _generate_librarian_info(self, player, is_drunk_or_poisoned=False):
        """生成图书管理员信息"""
        outsider_players = [p for p in self.players if p["role_type"] == "outsider"]
        if not outsider_players:
            return {"message": "场上没有外来者（你得知0个玩家是外来者）", "is_drunk_or_poisoned": is_drunk_or_poisoned}
        
        target = random.choice(outsider_players)
        other_players = [p for p in self.players if p["id"] not in [player["id"], target["id"]]]
        decoy = random.choice(other_players) if other_players else None
        
        players_shown = [target["name"]]
        if decoy:
            players_shown.append(decoy["name"])
            random.shuffle(players_shown)
        
        # 获取目标的真实角色名（如果是酒鬼，显示"酒鬼"而不是假身份）
        if target.get("is_the_drunk") and target.get("true_role"):
            role_name = target["true_role"]["name"]  # 酒鬼的真实角色名
        else:
            role_name = target["role"]["name"]
        
        return {
            "info_type": "librarian",
            "players": players_shown,
            "role": role_name,
            "message": f"在 {' 和 '.join(players_shown)} 中，有一人是 {role_name}",
            "is_drunk_or_poisoned": is_drunk_or_poisoned
        }
    
    def _generate_investigator_info(self, player, is_drunk_or_poisoned=False):
        """生成调查员信息"""
        minion_players = [p for p in self.players if p["role_type"] == "minion"]
        if not minion_players:
            return {"message": "场上没有爪牙", "is_drunk_or_poisoned": is_drunk_or_poisoned}
        
        target = random.choice(minion_players)
        other_players = [p for p in self.players if p["id"] not in [player["id"], target["id"]]]
        decoy = random.choice(other_players) if other_players else None
        
        players_shown = [target["name"]]
        if decoy:
            players_shown.append(decoy["name"])
            random.shuffle(players_shown)
        
        return {
            "info_type": "investigator",
            "players": players_shown,
            "role": target["role"]["name"],
            "message": f"在 {' 和 '.join(players_shown)} 中，有一人是 {target['role']['name']}",
            "is_drunk_or_poisoned": is_drunk_or_poisoned
        }
    
    def _generate_chef_info(self, player, is_drunk_or_poisoned=False):
        """生成厨师信息"""
        evil_players = [p for p in self.players if p["role_type"] in ["minion", "demon"]]
        
        # 计算相邻的邪恶玩家对数
        pairs = 0
        for i, p in enumerate(self.players):
            if p in evil_players:
                next_idx = (i + 1) % len(self.players)
                if self.players[next_idx] in evil_players:
                    pairs += 1
        
        return {
            "info_type": "chef",
            "pairs": pairs,
            "message": f"有 {pairs} 对邪恶玩家相邻",
            "is_drunk_or_poisoned": is_drunk_or_poisoned
        }
    
    def _generate_empath_info(self, player, is_drunk_or_poisoned=False):
        """生成共情者信息"""
        player_idx = next((i for i, p in enumerate(self.players) if p["id"] == player["id"]), -1)
        if player_idx == -1:
            return {"message": "无法确定位置", "is_drunk_or_poisoned": is_drunk_or_poisoned}
        
        # 找到存活的邻居
        evil_neighbors = 0
        
        # 左邻居
        for offset in range(1, len(self.players)):
            idx = (player_idx - offset) % len(self.players)
            neighbor = self.players[idx]
            if neighbor["alive"]:
                if neighbor["role_type"] in ["minion", "demon"]:
                    evil_neighbors += 1
                break
        
        # 右邻居
        for offset in range(1, len(self.players)):
            idx = (player_idx + offset) % len(self.players)
            neighbor = self.players[idx]
            if neighbor["alive"]:
                if neighbor["role_type"] in ["minion", "demon"]:
                    evil_neighbors += 1
                break
        
        return {
            "info_type": "empath",
            "evil_count": evil_neighbors,
            "message": f"你的存活邻居中有 {evil_neighbors} 个是邪恶的",
            "is_drunk_or_poisoned": is_drunk_or_poisoned
        }
    
    def _generate_fortune_teller_info(self, player, target_players, is_drunk_or_poisoned=False):
        """生成占卜师信息"""
        if len(target_players) < 2:
            return {
                "info_type": "fortune_teller",
                "message": "请选择两名玩家进行占卜",
                "is_drunk_or_poisoned": is_drunk_or_poisoned
            }
        
        # 检查目标中是否有恶魔
        has_demon = any(t["role_type"] == "demon" for t in target_players)
        
        # 注意：占卜师有一个"红鲱鱼"玩家，会被误判为恶魔
        # 这里需要说书人在游戏设置时指定红鲱鱼
        red_herring_id = player.get("red_herring_id")
        if red_herring_id and any(t["id"] == red_herring_id for t in target_players):
            has_demon = True
        
        result = "是" if has_demon else "否"
        target_names = " 和 ".join([t["name"] for t in target_players])
        
        return {
            "info_type": "fortune_teller",
            "has_demon": has_demon,
            "message": f"在 {target_names} 中，{'有' if has_demon else '没有'}恶魔",
            "is_drunk_or_poisoned": is_drunk_or_poisoned
        }
    
    def _generate_clockmaker_info(self, player, is_drunk_or_poisoned=False):
        """生成钟表匠信息"""
        demon_player = next((p for p in self.players if p["role_type"] == "demon"), None)
        minion_players = [p for p in self.players if p["role_type"] == "minion"]
        
        if not demon_player or not minion_players:
            return {"message": "无法生成信息", "is_drunk_or_poisoned": is_drunk_or_poisoned}
        
        demon_idx = next((i for i, p in enumerate(self.players) if p["id"] == demon_player["id"]), -1)
        
        min_distance = len(self.players)
        for minion in minion_players:
            minion_idx = next((i for i, p in enumerate(self.players) if p["id"] == minion["id"]), -1)
            # 计算顺时针和逆时针距离
            clockwise = (minion_idx - demon_idx) % len(self.players)
            counter_clockwise = (demon_idx - minion_idx) % len(self.players)
            distance = min(clockwise, counter_clockwise)
            min_distance = min(min_distance, distance)
        
        return {
            "info_type": "clockmaker",
            "distance": min_distance,
            "message": f"恶魔和最近的爪牙之间相隔 {min_distance} 步",
            "is_drunk_or_poisoned": is_drunk_or_poisoned
        }
    
    def _generate_chambermaid_info(self, player, target_players, is_drunk_or_poisoned=False):
        """生成侍女信息 - 选择两名玩家，得知他们中有多少人今晚因自己的能力而被唤醒"""
        if len(target_players) < 2:
            return {
                "info_type": "chambermaid",
                "message": "请选择两名玩家",
                "is_drunk_or_poisoned": is_drunk_or_poisoned
            }
        
        # 检查目标玩家今晚是否因自己的能力被唤醒
        # 需要根据夜间行动顺序判断
        woke_count = 0
        for target in target_players:
            role = target.get("role")
            if not role:
                continue
            
            # 检查角色是否有夜间能力（first_night 或 other_nights）
            role_has_night_ability = role.get("first_night", True) or role.get("other_nights", True)
            
            # 死亡玩家不会被唤醒（除非有特殊能力）
            if not target["alive"]:
                continue
            
            # 醉酒或中毒的玩家仍然会被唤醒，但能力无效
            # 这里我们计算的是"被唤醒"的数量
            if role_has_night_ability:
                woke_count += 1
        
        target_names = " 和 ".join([t["name"] for t in target_players])
        
        return {
            "info_type": "chambermaid",
            "woke_count": woke_count,
            "message": f"在 {target_names} 中，有 {woke_count} 人今晚因自己的能力而被唤醒",
            "is_drunk_or_poisoned": is_drunk_or_poisoned
        }
    
    def _generate_seamstress_info(self, player, target_players, is_drunk_or_poisoned=False):
        """生成女裁缝信息 - 选择两名玩家（非自己），得知他们是否属于同一阵营"""
        if len(target_players) < 2:
            return {
                "info_type": "seamstress",
                "message": "请选择两名玩家",
                "is_drunk_or_poisoned": is_drunk_or_poisoned
            }
        
        # 判断两人是否同一阵营
        target1_evil = target_players[0]["role_type"] in ["minion", "demon"]
        target2_evil = target_players[1]["role_type"] in ["minion", "demon"]
        same_team = target1_evil == target2_evil
        
        target_names = " 和 ".join([t["name"] for t in target_players])
        result_text = "是" if same_team else "不是"
        
        return {
            "info_type": "seamstress",
            "same_team": same_team,
            "message": f"{target_names} {result_text}同一阵营",
            "is_drunk_or_poisoned": is_drunk_or_poisoned
        }
    
    def _generate_dreamer_info(self, player, target_players, is_drunk_or_poisoned=False):
        """生成筑梦师信息 - 选择一名玩家，得知其角色或虚假角色"""
        if not target_players:
            return {
                "info_type": "dreamer",
                "message": "请选择一名玩家",
                "is_drunk_or_poisoned": is_drunk_or_poisoned
            }
        
        target = target_players[0]
        
        # 获取目标的真实角色名（如果是酒鬼，显示"酒鬼"而不是假身份）
        if target.get("is_the_drunk") and target.get("true_role"):
            real_role = target["true_role"]["name"]
        else:
            real_role = target["role"]["name"] if target.get("role") else "未知"
        
        # 筑梦师会得知一个正确角色和一个错误角色
        # 这里随机生成一个不同的角色作为干扰项
        all_roles = []
        for role_type in ["townsfolk", "outsider", "minion", "demon"]:
            all_roles.extend([r["name"] for r in self.script["roles"].get(role_type, [])])
        
        fake_roles = [r for r in all_roles if r != real_role]
        fake_role = random.choice(fake_roles) if fake_roles else "无"
        
        # 随机排序两个角色
        roles_shown = [real_role, fake_role]
        random.shuffle(roles_shown)
        
        return {
            "info_type": "dreamer",
            "roles": roles_shown,
            "message": f"{target['name']} 的角色是 {roles_shown[0]} 或 {roles_shown[1]} 其中之一",
            "is_drunk_or_poisoned": is_drunk_or_poisoned
        }
    
    def _generate_undertaker_info(self, player, is_drunk_or_poisoned=False):
        """生成殡仪馆老板信息 - 得知昨天被处决的玩家的角色"""
        # 查找最近被处决的玩家
        if not self.executions:
            return {
                "info_type": "undertaker",
                "message": "昨天没有人被处决",
                "is_drunk_or_poisoned": is_drunk_or_poisoned
            }
        
        last_execution = self.executions[-1]
        executed_player = next((p for p in self.players if p["id"] == last_execution.get("executed_id")), None)
        
        if executed_player:
            # 获取目标的真实角色名（如果是酒鬼，显示"酒鬼"而不是假身份）
            if executed_player.get("is_the_drunk") and executed_player.get("true_role"):
                role_name = executed_player["true_role"]["name"]
            else:
                role_name = executed_player["role"]["name"] if executed_player.get("role") else "未知"
            return {
                "info_type": "undertaker",
                "executed_role": role_name,
                "message": f"昨天被处决的玩家 {executed_player['name']} 的角色是 {role_name}",
                "is_drunk_or_poisoned": is_drunk_or_poisoned
            }
        
        return {
            "info_type": "undertaker",
            "message": "无法获取处决信息",
            "is_drunk_or_poisoned": is_drunk_or_poisoned
        }
    
    def _generate_ravenkeeper_info(self, player, target_players, is_drunk_or_poisoned=False):
        """生成鸦人保管者信息 - 死亡时选择一名玩家得知其角色"""
        if not target_players:
            return {
                "info_type": "ravenkeeper",
                "message": "请选择一名玩家查看其角色",
                "is_drunk_or_poisoned": is_drunk_or_poisoned
            }
        
        target = target_players[0]
        
        # 获取目标的真实角色名（如果是酒鬼，显示"酒鬼"而不是假身份）
        if target.get("is_the_drunk") and target.get("true_role"):
            role_name = target["true_role"]["name"]
        else:
            role_name = target["role"]["name"] if target.get("role") else "未知"
        
        return {
            "info_type": "ravenkeeper",
            "target_role": role_name,
            "message": f"{target['name']} 的角色是 {role_name}",
            "is_drunk_or_poisoned": is_drunk_or_poisoned
        }
    
    def _generate_oracle_info(self, player, is_drunk_or_poisoned=False):
        """生成神谕者信息 - 得知死亡玩家中有几个是邪恶的"""
        dead_players = [p for p in self.players if not p["alive"]]
        evil_dead = sum(1 for p in dead_players if p["role_type"] in ["minion", "demon"])
        
        return {
            "info_type": "oracle",
            "evil_dead_count": evil_dead,
            "message": f"死亡玩家中有 {evil_dead} 个是邪恶的",
            "is_drunk_or_poisoned": is_drunk_or_poisoned
        }
    
    def _generate_flowergirl_info(self, player, is_drunk_or_poisoned=False):
        """生成卖花女孩信息 - 得知恶魔昨天是否提名"""
        # 检查最近一天恶魔是否提名
        demon_player = next((p for p in self.players if p["role_type"] == "demon"), None)
        demon_nominated = False
        
        if demon_player and self.nominations:
            # 检查今天的提名记录
            for nom in self.nominations:
                if nom.get("nominator_id") == demon_player["id"]:
                    demon_nominated = True
                    break
        
        result = "提名了" if demon_nominated else "没有提名"
        
        return {
            "info_type": "flowergirl",
            "demon_nominated": demon_nominated,
            "message": f"恶魔昨天{result}",
            "is_drunk_or_poisoned": is_drunk_or_poisoned
        }


# 路由
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/scripts', methods=['GET'])
def get_scripts():
    """获取所有剧本"""
    scripts_list = []
    for script_id, script in SCRIPTS.items():
        scripts_list.append({
            "id": script_id,
            "name": script["name"],
            "name_en": script["name_en"],
            "description": script["description"]
        })
    return jsonify(scripts_list)

@app.route('/api/script/<script_id>', methods=['GET'])
def get_script_detail(script_id):
    """获取剧本详情"""
    if script_id not in SCRIPTS:
        return jsonify({"error": "剧本不存在"}), 404
    return jsonify(SCRIPTS[script_id])

@app.route('/api/role_distribution/<int:player_count>', methods=['GET'])
def get_distribution(player_count):
    """获取角色分布"""
    distribution = get_role_distribution(player_count)
    return jsonify(distribution)

@app.route('/api/game/create', methods=['POST'])
def create_game():
    """创建新游戏"""
    data = request.json
    script_id = data.get('script_id')
    player_count = data.get('player_count')
    
    if script_id not in SCRIPTS:
        return jsonify({"error": "无效的剧本"}), 400
    
    if not 5 <= player_count <= 16:
        return jsonify({"error": "玩家数量必须在5-16之间"}), 400
    
    game_id = f"game_{len(games) + 1}_{int(datetime.now().timestamp())}"
    game = Game(game_id, script_id, player_count)
    games[game_id] = game
    
    return jsonify({
        "success": True,
        "game_id": game_id,
        "game": game.to_dict()
    })

@app.route('/api/game/<game_id>', methods=['GET'])
def get_game(game_id):
    """获取游戏状态"""
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    return jsonify(games[game_id].to_dict())

@app.route('/api/game/<game_id>/roles', methods=['GET'])
def get_game_roles(game_id):
    """获取游戏可用角色"""
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    return jsonify(games[game_id].get_available_roles())

@app.route('/api/game/<game_id>/assign_random', methods=['POST'])
def assign_random_roles(game_id):
    """随机分配角色"""
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    data = request.json
    player_names = data.get('player_names', [])
    
    game = games[game_id]
    if len(player_names) != game.player_count:
        return jsonify({"error": f"需要 {game.player_count} 名玩家"}), 400
    
    players = game.assign_roles_randomly(player_names)
    return jsonify({
        "success": True,
        "players": players
    })

@app.route('/api/game/<game_id>/assign_manual', methods=['POST'])
def assign_manual_roles(game_id):
    """手动分配角色"""
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    data = request.json
    assignments = data.get('assignments', [])
    
    game = games[game_id]
    if len(assignments) != game.player_count:
        return jsonify({"error": f"需要 {game.player_count} 名玩家"}), 400
    
    players = game.assign_roles_manually(assignments)
    return jsonify({
        "success": True,
        "players": players
    })

@app.route('/api/game/<game_id>/start_night', methods=['POST'])
def start_night(game_id):
    """开始夜晚"""
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    game = games[game_id]
    game.start_night()
    night_order = game.get_night_order()
    
    # 定义角色的行动类型
    def get_action_type(role_id, role_type):
        # 恶魔类 - 击杀
        demon_roles = ["imp", "zombuul", "shabaloth", "po", "fang_gu", "vigormortis", "no_dashii", "vortox"]
        if role_id in demon_roles:
            return "kill"
        
        # 普卡 - 特殊投毒恶魔（选择目标中毒，前一晚目标死亡）
        if role_id == "pukka":
            return "pukka_poison"
        
        # 保护类
        protect_roles = ["monk", "innkeeper", "tea_lady"]
        if role_id in protect_roles:
            return "protect"
        
        # 爪牙击杀类
        minion_kill_roles = ["godfather", "assassin"]
        if role_id in minion_kill_roles:
            return "kill"
        
        # 投毒类
        poison_roles = ["poisoner"]
        if role_id in poison_roles:
            return "poison"
        
        # 醉酒类（使目标醉酒）
        drunk_roles = ["courtier"]  # 侍臣
        if role_id in drunk_roles:
            return "drunk"
        
        # 水手 - 特殊醉酒（自己或目标醉酒）
        if role_id == "sailor":
            return "sailor_drunk"
        
        # 选择目标获取信息类
        info_select_roles = ["fortune_teller", "empath", "undertaker", "ravenkeeper", 
                            "dreamer", "chambermaid", "seamstress", "oracle", "flowergirl"]
        if role_id in info_select_roles:
            return "info_select"
        
        # 祖母 - 选择孙子
        if role_id == "grandmother":
            return "grandchild_select"
        
        # 管家 - 选择主人
        if role_id == "butler":
            return "butler_master"
        
        # 首夜信息类
        first_night_info = ["washerwoman", "librarian", "investigator", "chef", "clockmaker"]
        if role_id in first_night_info:
            return "info_first_night"
        
        # 选择角色/能力类
        ability_select_roles = ["philosopher", "pit_hag", "cerenovus", "witch"]
        if role_id in ability_select_roles:
            return "ability_select"
        
        return "other"
    
    return jsonify({
        "success": True,
        "night_number": game.night_number,
        "night_order": [{
            "player_id": item["player"]["id"],
            "player_name": item["player"]["name"],
            "role_id": item["role"]["id"],
            "role_name": item["role"]["name"],
            "role_type": game._get_role_type(item["role"]),
            "ability": item["role"]["ability"],
            "order": item["order"],
            "action_type": get_action_type(item["role"]["id"], game._get_role_type(item["role"]))
        } for item in night_order],
        "alive_players": [{"id": p["id"], "name": p["name"]} for p in game.players if p["alive"]]
    })

@app.route('/api/game/<game_id>/night_action', methods=['POST'])
def record_night_action(game_id):
    """记录夜间行动"""
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    data = request.json
    game = games[game_id]
    game.record_night_action(
        data.get('player_id'),
        data.get('action'),
        data.get('target'),
        data.get('result'),
        data.get('action_type'),  # 新增: kill, protect, info, skip, drunk 等
        data.get('extra_data')    # 额外数据，如醉酒持续时间
    )
    
    return jsonify({"success": True})

@app.route('/api/game/<game_id>/night_death', methods=['POST'])
def add_night_death(game_id):
    """添加夜间死亡"""
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    data = request.json
    game = games[game_id]
    game.add_night_death(data.get('player_id'), data.get('cause', '恶魔击杀'))
    
    return jsonify({"success": True})

@app.route('/api/game/<game_id>/start_day', methods=['POST'])
def start_day(game_id):
    """开始白天"""
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    game = games[game_id]
    game.start_day()
    
    return jsonify({
        "success": True,
        "day_number": game.day_number,
        "night_deaths": game.night_deaths,
        "game_end": game.check_game_end()
    })

@app.route('/api/game/<game_id>/nominate', methods=['POST'])
def nominate(game_id):
    """提名"""
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    data = request.json
    game = games[game_id]
    result = game.nominate(data.get('nominator_id'), data.get('nominee_id'))
    
    return jsonify(result)

@app.route('/api/game/<game_id>/vote', methods=['POST'])
def vote(game_id):
    """投票"""
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    data = request.json
    game = games[game_id]
    result = game.vote(
        data.get('nomination_id'),
        data.get('voter_id'),
        data.get('vote')
    )
    
    return jsonify(result)

@app.route('/api/game/<game_id>/execute', methods=['POST'])
def execute(game_id):
    """处决"""
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    data = request.json
    game = games[game_id]
    result = game.execute(data.get('nomination_id'))
    
    if result.get("success"):
        result["game_end"] = game.check_game_end()
    
    return jsonify(result)

@app.route('/api/game/<game_id>/player_status', methods=['POST'])
def update_player_status(game_id):
    """更新玩家状态"""
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    data = request.json
    game = games[game_id]
    result = game.update_player_status(
        data.get('player_id'),
        data.get('status_type'),
        data.get('value')
    )
    
    return jsonify(result)

@app.route('/api/game/<game_id>/generate_info', methods=['POST'])
def generate_info(game_id):
    """生成角色信息"""
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    data = request.json
    game = games[game_id]
    
    # 支持传入目标玩家
    targets = data.get('targets', [])
    info = game.generate_info(
        data.get('player_id'), 
        data.get('info_type'),
        targets=targets
    )
    
    return jsonify(info if info else {"message": "无法生成信息"})

@app.route('/api/game/<game_id>/kill_player', methods=['POST'])
def kill_player(game_id):
    """直接杀死玩家（用于特殊情况）"""
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    data = request.json
    game = games[game_id]
    player_id = data.get('player_id')
    cause = data.get('cause', '说书人判定')
    
    player = next((p for p in game.players if p["id"] == player_id), None)
    if player:
        player["alive"] = False
        game.add_log(f"{player['name']} 死亡 ({cause})", "death")
        return jsonify({
            "success": True,
            "game_end": game.check_game_end()
        })
    
    return jsonify({"success": False, "error": "无效的玩家"})

@app.route('/api/game/<game_id>/revive_player', methods=['POST'])
def revive_player(game_id):
    """复活玩家"""
    if game_id not in games:
        return jsonify({"error": "游戏不存在"}), 404
    
    data = request.json
    game = games[game_id]
    player_id = data.get('player_id')
    
    player = next((p for p in game.players if p["id"] == player_id), None)
    if player:
        player["alive"] = True
        player["vote_token"] = True
        game.add_log(f"{player['name']} 复活了", "revive")
        return jsonify({"success": True})
    
    return jsonify({"success": False, "error": "无效的玩家"})


if __name__ == '__main__':
    app.run(debug=True, port=5000)

