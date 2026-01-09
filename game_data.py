# 血染钟楼游戏数据
# Blood on the Clocktower Game Data

# 角色类型
ROLE_TYPES = {
    "townsfolk": "镇民",
    "outsider": "外来者", 
    "minion": "爪牙",
    "demon": "恶魔"
}

# 剧本数据
SCRIPTS = {
    "trouble_brewing": {
        "name": "暗流涌动",
        "name_en": "Trouble Brewing",
        "description": "入门级剧本，适合新手玩家",
        "roles": {
            "townsfolk": [
                {
                    "id": "washerwoman",
                    "name": "洗衣妇",
                    "ability": "在你的首个夜晚，你会得知两名玩家中有一名特定的镇民角色。",
                    "first_night": True,
                    "other_nights": False,
                    "night_order": 32
                },
                {
                    "id": "librarian", 
                    "name": "图书管理员",
                    "ability": "在你的首个夜晚，你会得知两名玩家中有一名特定的外来者角色。（如果没有外来者，你会得知0个玩家是外来者。）",
                    "first_night": True,
                    "other_nights": False,
                    "night_order": 33
                },
                {
                    "id": "investigator",
                    "name": "调查员", 
                    "ability": "在你的首个夜晚，你会得知两名玩家中有一名特定的爪牙角色。",
                    "first_night": True,
                    "other_nights": False,
                    "night_order": 34
                },
                {
                    "id": "chef",
                    "name": "厨师",
                    "ability": "在你的首个夜晚，你会得知有多少对邪恶玩家相邻。",
                    "first_night": True,
                    "other_nights": False,
                    "night_order": 35
                },
                {
                    "id": "empath",
                    "name": "共情者",
                    "ability": "每个夜晚，你会得知你存活的邻居中有多少个是邪恶的。",
                    "first_night": True,
                    "other_nights": True,
                    "night_order": 36
                },
                {
                    "id": "fortune_teller",
                    "name": "占卜师",
                    "ability": "每个夜晚，选择两名玩家：你会得知他们之中是否有恶魔。有一名善良玩家始终会被你的能力误认为是恶魔。",
                    "first_night": True,
                    "other_nights": True,
                    "night_order": 37
                },
                {
                    "id": "undertaker",
                    "name": "送葬者",
                    "ability": "每个夜晚*，你会得知今天白天被处决死亡的玩家的角色。",
                    "first_night": False,
                    "other_nights": True,
                    "night_order": 52
                },
                {
                    "id": "monk",
                    "name": "僧侣",
                    "ability": "每个夜晚*，选择一名玩家（不包括你自己）：今晚恶魔无法杀死他。",
                    "first_night": False,
                    "other_nights": True,
                    "night_order": 12
                },
                {
                    "id": "ravenkeeper",
                    "name": "守鸦人",
                    "ability": "如果你在夜晚死亡，你会被唤醒来选择一名玩家：你会得知他的角色。",
                    "first_night": False,
                    "other_nights": False,
                    "night_order": 51,
                    "passive_trigger": True
                },
                {
                    "id": "virgin",
                    "name": "贞洁者",
                    "ability": "第一个成功提名你的镇民玩家会立即被处决。",
                    "first_night": False,
                    "other_nights": False,
                    "night_order": 0
                },
                {
                    "id": "slayer",
                    "name": "杀手",
                    "ability": "游戏中仅一次，在白天时，你可以公开选择一名玩家：如果他是恶魔，他死亡。",
                    "first_night": False,
                    "other_nights": False,
                    "night_order": 0
                },
                {
                    "id": "soldier",
                    "name": "士兵",
                    "ability": "恶魔的能力对你无效。",
                    "first_night": False,
                    "other_nights": False,
                    "night_order": 0
                },
                {
                    "id": "mayor",
                    "name": "镇长",
                    "ability": "如果只剩下3名玩家存活且没有玩家被处决，你的阵营获胜。如果你在夜晚即将死亡，可能会有一名其他玩家代替你死亡。",
                    "first_night": False,
                    "other_nights": False,
                    "night_order": 0
                }
            ],
            "outsider": [
                {
                    "id": "butler",
                    "name": "管家",
                    "ability": "每个夜晚，选择一名玩家（不包括你自己）：明天只有他投票时你才可以投票。",
                    "first_night": True,
                    "other_nights": True,
                    "night_order": 38
                },
                {
                    "id": "drunk",
                    "name": "酒鬼",
                    "ability": "你不知道自己是酒鬼。你以为自己是某个镇民角色，但实际上不是。",
                    "first_night": False,
                    "other_nights": False,
                    "night_order": 0
                },
                {
                    "id": "recluse",
                    "name": "陌客",
                    "ability": "你可能会被错误地识别为邪恶玩家，甚至恶魔。",
                    "first_night": False,
                    "other_nights": False,
                    "night_order": 0
                },
                {
                    "id": "saint",
                    "name": "圣徒",
                    "ability": "如果你因处决而死亡，邪恶阵营获胜。",
                    "first_night": False,
                    "other_nights": False,
                    "night_order": 0
                }
            ],
            "minion": [
                {
                    "id": "poisoner",
                    "name": "投毒者",
                    "ability": "每个夜晚，选择一名玩家：他在当晚和明天白天处于中毒状态。",
                    "first_night": True,
                    "other_nights": True,
                    "night_order": 17
                },
                {
                    "id": "spy",
                    "name": "间谍",
                    "ability": "每个夜晚，你能查看魔典。你可能会被当作善良阵营、镇民角色或外来者角色，即使你已死亡。",
                    "first_night": True,
                    "other_nights": True,
                    "night_order": 49
                },
                {
                    "id": "scarlet_woman",
                    "name": "红唇女郎",
                    "ability": "如果大于等于五名玩家存活时（旅行者不计算在内）恶魔死亡，你变成那个恶魔。",
                    "first_night": False,
                    "other_nights": False,
                    "night_order": 0
                },
                {
                    "id": "baron",
                    "name": "男爵",
                    "ability": "会有额外的外来者在场。[+2 外来者]",
                    "first_night": False,
                    "other_nights": False,
                    "night_order": 0,
                    "setup": True
                }
            ],
            "demon": [
                {
                    "id": "imp",
                    "name": "小恶魔",
                    "ability": "每个夜晚*，选择一名玩家：他死亡。如果你这样自杀，一名爪牙会成为小恶魔。",
                    "first_night": False,
                    "other_nights": True,
                    "night_order": 24
                }
            ]
        }
    },
    "bad_moon_rising": {
        "name": "黯月初升",
        "name_en": "Bad Moon Rising",
        "description": "中级剧本，更多死亡和复杂机制",
        "roles": {
            "townsfolk": [
                {
                    "id": "grandmother",
                    "name": "祖母",
                    "ability": "在你的首个夜晚，你会得知你的孙子是谁以及他的角色。如果恶魔杀死了你的孙子，你也会死亡。",
                    "first_night": True,
                    "other_nights": False,
                    "night_order": 39
                },
                {
                    "id": "sailor",
                    "name": "水手",
                    "ability": "每个夜晚，选择一名存活玩家：你们之一会喝醉到明天黄昏。你无法死亡。",
                    "first_night": True,
                    "other_nights": True,
                    "night_order": 10
                },
                {
                    "id": "chambermaid",
                    "name": "侍女",
                    "ability": "每个夜晚，你要选择除你以外的两名存活的玩家：你会得知他们中有几人在当晚因其自身能力而被唤醒。",
                    "first_night": True,
                    "other_nights": True,
                    "night_order": 50
                },
                {
                    "id": "exorcist",
                    "name": "驱魔人",
                    "ability": "每个夜晚*，你要选择一名玩家（与上个夜晚不同）：如果你选中了恶魔，他会得知你是驱魔人，但他当晚不会因其自身能力而被唤醒。",
                    "first_night": False,
                    "other_nights": True,
                    "night_order": 21
                },
                {
                    "id": "innkeeper",
                    "name": "旅店老板",
                    "ability": "每个夜晚*，选择两名玩家：今晚他们无法死亡，但其中一人会喝醉到明天黄昏。",
                    "first_night": False,
                    "other_nights": True,
                    "night_order": 9
                },
                {
                    "id": "gambler",
                    "name": "赌徒",
                    "ability": "每个夜晚*，选择一名玩家并猜测他的角色：如果你猜错了，你死亡。",
                    "first_night": False,
                    "other_nights": True,
                    "night_order": 3
                },
                {
                    "id": "gossip",
                    "name": "造谣者",
                    "ability": "每个白天，你可以公开发表一个声明。如果该声明正确，在当晚会有一名玩家死亡。",
                    "first_night": False,
                    "other_nights": False,
                    "night_order": 46,
                    "storyteller_controlled": True
                },
                {
                    "id": "courtier",
                    "name": "侍臣",
                    "ability": "每局游戏限一次，在夜晚时，你可以选择一个角色：如果该角色在场，该角色从当晚开始醉酒三天三夜。",
                    "first_night": True,
                    "other_nights": True,
                    "night_order": 18
                },
                {
                    "id": "professor",
                    "name": "教授",
                    "ability": "每局游戏限一次，在夜晚时*，你可以选择一名死亡的玩家：如果他是镇民，你会将他起死回生。",
                    "first_night": False,
                    "other_nights": True,
                    "night_order": 43
                },
                {
                    "id": "minstrel",
                    "name": "吟游诗人",
                    "ability": "当一名爪牙死于处决时，除了你和旅行者以外的所有其他玩家醉酒直到明天黄昏。",
                    "first_night": False,
                    "other_nights": False,
                    "night_order": 0
                },
                {
                    "id": "tea_lady",
                    "name": "茶艺师",
                    "ability": "如果与你邻近的两名存活的玩家是善良的，他们不会死亡。",
                    "first_night": False,
                    "other_nights": False,
                    "night_order": 0
                },
                {
                    "id": "pacifist",
                    "name": "和平主义者",
                    "ability": "被处决的善良玩家可能不会死亡。",
                    "first_night": False,
                    "other_nights": False,
                    "night_order": 0
                },
                {
                    "id": "fool",
                    "name": "弄臣",
                    "ability": "你第一次将要死亡时，你不会死亡。",
                    "first_night": False,
                    "other_nights": False,
                    "night_order": 0
                }
            ],
            "outsider": [
                {
                    "id": "tinker",
                    "name": "修补匠",
                    "ability": "你可能在任何时候死亡。",
                    "first_night": False,
                    "other_nights": False,
                    "night_order": 47,
                    "storyteller_controlled": True
                },
                {
                    "id": "moonchild",
                    "name": "月之子",
                    "ability": "当你得知你死亡时，你要公开选择一名存活的玩家。如果他是善良的，在当晚他会死亡。",
                    "first_night": False,
                    "other_nights": False,
                    "night_order": 48,
                    "passive_trigger": True
                },
                {
                    "id": "goon",
                    "name": "莽夫",
                    "ability": "每个夜晚，首个使用其自身能力选择了你的玩家会醉酒直到下个黄昏。你会转变为他的阵营。",
                    "first_night": False,
                    "other_nights": False,
                    "night_order": 4,
                    "passive_trigger": True
                },
                {
                    "id": "lunatic",
                    "name": "疯子",
                    "ability": "你以为自己是恶魔，但你不是。恶魔知道你是谁以及你的夜间选择。",
                    "first_night": True,
                    "other_nights": True,
                    "night_order": 2,
                    "special_setup": True
                }
            ],
            "minion": [
                {
                    "id": "godfather",
                    "name": "教父",
                    "ability": "在你的首个夜晚，你会得知有哪些外来者角色在场。如果有外来者在白天死亡，你会在当晚被唤醒并且你要选择一名玩家：他死亡。[-1或+1外来者]",
                    "first_night": False,
                    "other_nights": True,
                    "night_order": 40,
                    "setup": True
                },
                {
                    "id": "devils_advocate",
                    "name": "恶魔代言人",
                    "ability": "每个夜晚，你要选择一名存活的玩家（与上个夜晚不同）：如果明天白天他被处决，他不会死亡。",
                    "first_night": True,
                    "other_nights": True,
                    "night_order": 15
                },
                {
                    "id": "assassin",
                    "name": "刺客",
                    "ability": "游戏中仅一次，在夜晚*，选择一名玩家：他死亡，即使他受到保护。",
                    "first_night": False,
                    "other_nights": True,
                    "night_order": 36
                },
                {
                    "id": "mastermind",
                    "name": "主谋",
                    "ability": "如果恶魔因为死于处决而因此导致游戏结束时，再额外进行一个夜晚和一个白天。在那个白天如果有玩家被处决，他的阵营落败。",
                    "first_night": False,
                    "other_nights": False,
                    "night_order": 0
                }
            ],
            "demon": [
                {
                    "id": "zombuul",
                    "name": "僵怖",
                    "ability": "每个夜晚*，如果今天白天没有人死亡，你会被唤醒并要选择一名玩家：他死亡。当你首次死亡后，你仍存活，但会被当作死亡。",
                    "first_night": False,
                    "other_nights": True,
                    "night_order": 25
                },
                {
                    "id": "pukka",
                    "name": "普卡",
                    "ability": "每个夜晚，选择一名玩家：他中毒。上个因你的能力中毒的玩家会死亡并恢复健康。",
                    "first_night": True,
                    "other_nights": True,
                    "night_order": 26
                },
                {
                    "id": "shabaloth",
                    "name": "沙巴洛斯",
                    "ability": "每个夜晚*，选择两名玩家：他们死亡。你上个夜晚选择过且当前死亡的玩家之一可能会被你反刍。",
                    "first_night": False,
                    "other_nights": True,
                    "night_order": 27
                },
                {
                    "id": "po",
                    "name": "珀",
                    "ability": "每个夜晚*，你可以选择一名玩家：他死亡。如果你上次选择时没有选择任何玩家，当晚你要选择三名玩家：他们死亡。",
                    "first_night": False,
                    "other_nights": True,
                    "night_order": 28
                }
            ]
        }
    },
    "sects_and_violets": {
        "name": "梦殒春宵",
        "name_en": "Sects & Violets",
        "description": "高级剧本，更多信息操纵和疯狂机制",
        "roles": {
            "townsfolk": [
                {
                    "id": "clockmaker",
                    "name": "钟表匠",
                    "ability": "在你的首个夜晚，你会得知恶魔与爪牙之间最近的距离。（邻座的玩家距离为1）",
                    "first_night": True,
                    "other_nights": False,
                    "night_order": 31
                },
                {
                    "id": "dreamer",
                    "name": "筑梦师",
                    "ability": "每个夜晚，你要选择除你及旅行者以外的一名玩家：你会得知一个善良角色和一个邪恶角色，该玩家是其中一个角色。",
                    "first_night": True,
                    "other_nights": True,
                    "night_order": 41
                },
                {
                    "id": "snake_charmer",
                    "name": "舞蛇人",
                    "ability": "每个夜晚，你要选择一名存活的玩家：如果你选中了恶魔，你和他交换角色和阵营，然后他中毒。",
                    "first_night": True,
                    "other_nights": True,
                    "night_order": 19
                },
                {
                    "id": "mathematician",
                    "name": "数学家",
                    "ability": "每个夜晚，你会得知从你上次醒来至今有多少玩家的能力运作不正常。",
                    "first_night": True,
                    "other_nights": True,
                    "night_order": 51
                },
                {
                    "id": "flowergirl",
                    "name": "卖花女孩",
                    "ability": "每个夜晚*，你会得知恶魔是否在今天投票。",
                    "first_night": False,
                    "other_nights": True,
                    "night_order": 56
                },
                {
                    "id": "town_crier",
                    "name": "城镇公告员",
                    "ability": "每个夜晚*，你会得知今天是否有爪牙提名。",
                    "first_night": False,
                    "other_nights": True,
                    "night_order": 55
                },
                {
                    "id": "oracle",
                    "name": "神谕者",
                    "ability": "每个夜晚*，你会得知死亡玩家中有多少是邪恶的。",
                    "first_night": False,
                    "other_nights": True,
                    "night_order": 58
                },
                {
                    "id": "savant",
                    "name": "博学者",
                    "ability": "每个白天，你可以私下询问说书人以得知两条信息：一个是正确的，一个是错误的。",
                    "first_night": False,
                    "other_nights": False,
                    "night_order": 0
                },
                {
                    "id": "seamstress",
                    "name": "女裁缝",
                    "ability": "每局游戏限一次，在夜晚时，你可以选择除你以外的两名玩家：你会得知他们是否为同一阵营。",
                    "first_night": True,
                    "other_nights": True,
                    "night_order": 42
                },
                {
                    "id": "philosopher",
                    "name": "哲学家",
                    "ability": "每局游戏限一次，在夜晚时，你可以选择一个善良角色：你获得该角色的能力。如果这个角色在场，他醉酒。",
                    "first_night": True,
                    "other_nights": True,
                    "night_order": 1
                },
                {
                    "id": "artist",
                    "name": "艺术家",
                    "ability": "每局游戏限一次，在白天时，你可以私下询问说书人一个是非问题，你会得知该问题的答案。",
                    "first_night": False,
                    "other_nights": False,
                    "night_order": 0
                },
                {
                    "id": "juggler",
                    "name": "杂耍艺人",
                    "ability": "在你的首个白天，你可以公开猜测任意玩家的角色最多五次。在当晚，你会得知猜测正确的角色数量。",
                    "first_night": True,
                    "other_nights": False,
                    "night_order": 59
                },
                {
                    "id": "sage",
                    "name": "贤者",
                    "ability": "如果恶魔杀死了你，在当晚你会被唤醒并得知两名玩家，其中一名是杀死你的那个恶魔。",
                    "first_night": False,
                    "other_nights": False,
                    "night_order": 42,
                    "passive_trigger": True
                }
            ],
            "outsider": [
                {
                    "id": "mutant",
                    "name": "畸形秀演员",
                    "ability": "如果你“疯狂”地证明自己是外来者，你可能被处决。",
                    "first_night": False,
                    "other_nights": False,
                    "night_order": 0
                },
                {
                    "id": "sweetheart",
                    "name": "心上人",
                    "ability": "当你死亡时，会有一名玩家开始醉酒，从现在一直到游戏结束。",
                    "first_night": False,
                    "other_nights": False,
                    "night_order": 0
                },
                {
                    "id": "barber",
                    "name": "理发师",
                    "ability": "如果你在夜晚死亡，在当晚恶魔可以选择两名玩家（不能选择其他恶魔）交换角色。",
                    "first_night": False,
                    "other_nights": False,
                    "night_order": 45,
                    "passive_trigger": True
                },
                {
                    "id": "klutz",
                    "name": "呆瓜",
                    "ability": "当你得知你死亡时，你要公开选择一名存活的玩家：如果他是邪恶的，你的阵营落败。",
                    "first_night": False,
                    "other_nights": False,
                    "night_order": 0
                }
            ],
            "minion": [
                {
                    "id": "evil_twin",
                    "name": "邪恶双子",
                    "ability": "你和一名善良玩家都知道对方是谁。如果善良的双胞胎因处决而死亡，邪恶获胜。如果你们都存活，善良阵营无法获胜。",
                    "first_night": True,
                    "other_nights": False,
                    "night_order": 23
                },
                {
                    "id": "cerenovus",
                    "name": "洗脑师",
                    "ability": "每个夜晚，你要选择一名玩家和一个善良角色。他明天白天和夜晚需要“疯狂”地证明自己是这个角色，不然他可能被处决。",
                    "first_night": True,
                    "other_nights": True,
                    "night_order": 20
                },
                {
                    "id": "pit_hag",
                    "name": "麻脸巫婆",
                    "ability": "每个夜晚*，你要选择一名玩家和一个角色，如果该角色不在场，他变成该角色。如果因此创造了一个恶魔，当晚的死亡由说书人决定。",
                    "first_night": False,
                    "other_nights": True,
                    "night_order": 16
                },
                {
                    "id": "witch",
                    "name": "女巫",
                    "ability": "每个夜晚，你要选择一名玩家：如果他明天白天发起提名，他死亡。如果只有三名存活的玩家，你失去此能力。",
                    "first_night": True,
                    "other_nights": True,
                    "night_order": 14
                }
            ],
            "demon": [
                {
                    "id": "fang_gu",
                    "name": "方古",
                    "ability": "每个夜晚*，选择一名玩家：他死亡。被该能力杀死的外来者改为变成邪恶的方古且你代替他死亡，但每局游戏仅能成功转化一次。[+1外来者]",
                    "first_night": False,
                    "other_nights": True,
                    "night_order": 29
                },
                {
                    "id": "vigormortis",
                    "name": "亡骨魔",
                    "ability": "每个夜晚*，选择一名玩家：他死亡。被你杀死的爪牙保留他的能力，且与他邻近的两名镇民之一中毒。[-1外来者]",
                    "first_night": False,
                    "other_nights": True,
                    "night_order": 30
                },
                {
                    "id": "no_dashii",
                    "name": "诺-达鲺",
                    "ability": "每个夜晚*，选择一名玩家：他死亡。与你邻近的两名镇民中毒。",
                    "first_night": False,
                    "other_nights": True,
                    "night_order": 31
                },
                {
                    "id": "vortox",
                    "name": "涡流",
                    "ability": "每个夜晚*，选择一名玩家：他死亡。镇民玩家的能力都会产生错误信息。如果白天没人被处决，邪恶阵营获胜。",
                    "first_night": False,
                    "other_nights": True,
                    "night_order": 32
                }
            ]
        }
    }
}

# 根据玩家数量计算角色分布
def get_role_distribution(player_count):
    """根据玩家数量返回角色分布"""
    distributions = {
        5: {"townsfolk": 3, "outsider": 0, "minion": 1, "demon": 1},
        6: {"townsfolk": 3, "outsider": 1, "minion": 1, "demon": 1},
        7: {"townsfolk": 5, "outsider": 0, "minion": 1, "demon": 1},
        8: {"townsfolk": 5, "outsider": 1, "minion": 1, "demon": 1},
        9: {"townsfolk": 5, "outsider": 2, "minion": 1, "demon": 1},
        10: {"townsfolk": 7, "outsider": 0, "minion": 2, "demon": 1},
        11: {"townsfolk": 7, "outsider": 1, "minion": 2, "demon": 1},
        12: {"townsfolk": 7, "outsider": 2, "minion": 2, "demon": 1},
        13: {"townsfolk": 9, "outsider": 0, "minion": 3, "demon": 1},
        14: {"townsfolk": 9, "outsider": 1, "minion": 3, "demon": 1},
        15: {"townsfolk": 9, "outsider": 2, "minion": 3, "demon": 1},
        16: {"townsfolk": 9, "outsider": 3, "minion": 3, "demon": 1},  # 需要旅行者或特殊规则
    }
    return distributions.get(player_count, distributions[15])

# 夜晚行动顺序
NIGHT_ORDER_PHASES = [
    {"phase": "dusk", "name": "黄昏", "description": "一天结束，夜晚开始"},
    {"phase": "minion_info", "name": "爪牙信息", "description": "爪牙和恶魔互相确认身份（仅首夜）"},
    {"phase": "demon_info", "name": "恶魔信息", "description": "恶魔获得伪装信息（仅首夜）"},
    {"phase": "night_abilities", "name": "夜间能力", "description": "按顺序执行夜间能力"},
    {"phase": "dawn", "name": "黎明", "description": "宣布夜间死亡"}
]

# 白天阶段
DAY_PHASES = [
    {"phase": "announcement", "name": "公告", "description": "宣布夜间死亡情况"},
    {"phase": "discussion", "name": "讨论", "description": "玩家自由讨论"},
    {"phase": "nomination", "name": "提名", "description": "玩家可以提名其他玩家"},
    {"phase": "vote", "name": "投票", "description": "对被提名者进行投票"},
    {"phase": "execution", "name": "处决", "description": "执行获得足够票数的玩家"}
]

