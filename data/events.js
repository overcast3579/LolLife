/**
 * LoLLife - 40+ 寫實事件資料庫
 * 涵蓋 6 大維度：訓練 (TRAINING)、隊內 (TEAM)、比賽 (MATCH)、健康 (HEALTH)、公關 (PR)、人生 (LIFE)
 */

export const EVENT_CATEGORIES = {
  TRAINING: { name: '訓練與成長', icon: '🎯', color: '#00f2fe' },
  TEAM: { name: '隊內互動', icon: '🤝', color: '#4facfe' },
  MATCH: { name: '賽場博弈', icon: '⚔️', color: '#ff4d4f' },
  HEALTH: { name: '身心健康', icon: '🩺', color: '#52c41a' },
  PR: { name: '公關與人氣', icon: '🎙️', color: '#f5a623' },
  LIFE: { name: '生涯與人生', icon: '☕', color: '#b37feb' },
};

export const EVENTS = [
  // ==================== 1. 訓練 (TRAINING) ====================
  {
    id: 'TR_01',
    category: 'TRAINING',
    title: '韓服千分衝刺夜',
    desc: '賽季即將結算，今晚韓服天梯高分段眾神雲集，你排到了多位頂級 LCK 職業選手。',
    minAge: 16,
    choices: [
      {
        text: '通宵鏖戰，全力用招牌英雄衝分爭取前十',
        type: 'RISKY',
        effect: {
          mechanicsExp: 15,
          mentalExp: 5,
          fatigue: 20,
          wristHealth: -4,
          popularity: 3,
          log: '你在韓服頂分局連續單殺知名選手，剪輯在各大論壇爆紅！但熬夜讓你的手腕隱隱作痛。',
        },
      },
      {
        text: '保持專注打完 4 場高質量局，準時休息',
        type: 'BALANCED',
        effect: {
          mechanicsExp: 8,
          disciplineExp: 6,
          fatigue: 5,
          log: '你維持了極佳的競技狀態與規律作息，技術與專注度穩定提升。',
        },
      },
      {
        text: '轉為觀戰錄影，細緻研究對手走位與眼位習慣',
        type: 'CONSERVATIVE',
        effect: {
          macroExp: 10,
          disciplineExp: 4,
          fatigue: -5,
          stress: -5,
          log: '你記錄了大量頂級選手的眼位路線與換血習慣，戰術視野更加宏觀。',
        },
      },
    ],
  },
  {
    id: 'TR_02',
    category: 'TRAINING',
    title: '冷門黑科技開發',
    desc: '你在排位中發現某個冷門英雄在特定對局有奇效，但在當前版本完全無人使用。',
    minAge: 16,
    choices: [
      {
        text: '投入大量團練時間深入鑽研，準備作為賽場奇兵',
        type: 'RISKY',
        effect: {
          championPoolExp: 14,
          coachTrust: -5,
          fatigue: 10,
          log: '你在團練中嘗試黑科技，教練一臉凝重，但你確實摸索出了極具威脅的絕活機制。',
        },
      },
      {
        text: '僅在私人天梯中練習，不影響常規隊伍訓練',
        type: 'BALANCED',
        effect: {
          championPoolExp: 8,
          mechanicsExp: 5,
          fatigue: 5,
          log: '你低調擴充了英雄底牌，沒有引起隊伍節奏的動盪。',
        },
      },
      {
        text: '放棄該英雄，老老實實練習版本 T0 角色',
        type: 'CONSERVATIVE',
        effect: {
          coachTrust: 5,
          disciplineExp: 8,
          log: '教練對你踏實穩健的態度非常滿意，你對版本強勢角色的理解更加純熟。',
        },
      },
    ],
  },
  {
    id: 'TR_03',
    category: 'TRAINING',
    title: '跨位置深度理解',
    desc: '分析師建議你偶爾打幾場其他位置，以換位思考敵方打野與輔助的動線。',
    minAge: 16,
    choices: [
      {
        text: '接受建議，連續三天打其他位置體驗節奏',
        type: 'BALANCED',
        effect: {
          macroExp: 12,
          communicationExp: 6,
          fatigue: 8,
          log: '你深刻體會到了打野的路線壓力與輔助的視野困境，團隊指揮觀念大幅躍進！',
        },
      },
      {
        text: '專注本職，堅信把本位置個人能力拉滿才是正道',
        type: 'CONSERVATIVE',
        effect: {
          laningExp: 10,
          mechanicsExp: 6,
          log: '你的對線細節與換血壓制力更上一層樓。',
        },
      },
    ],
  },
  {
    id: 'TR_04',
    category: 'TRAINING',
    title: '高強度防守反擊團練',
    desc: '隊伍在練習賽中連續五把被對手前期入侵打崩，隊內氣氛沉重。',
    minAge: 17,
    choices: [
      {
        text: '主動要求加練 3 場一級團防守與視野插眼模擬',
        type: 'BALANCED',
        effect: {
          macroExp: 8,
          communicationExp: 8,
          fatigue: 12,
          coachTrust: 6,
          log: '隊伍建立了一套嚴密的一級團防守眼位鏈，防入侵能力顯著提升。',
        },
      },
      {
        text: '提議提早結束團練，大家出門吃宵夜放鬆調整心態',
        type: 'CONSERVATIVE',
        effect: {
          stress: -15,
          teamAffinity: 8,
          fatigue: -5,
          log: '一頓熱騰騰的火鍋舒緩了全隊緊繃的神經，隊友間的氣氛變得更加融洽。',
        },
      },
    ],
  },
  {
    id: 'TR_05',
    category: 'TRAINING',
    title: '賽前 VOD 顯微鏡分析',
    desc: '明天的對手在邊線單帶上極具侵略性，你決定在賽前最後一夜進行研究。',
    minAge: 17,
    choices: [
      {
        text: '熬夜逐幀看完了對手最近 10 場第一視角',
        type: 'RISKY',
        effect: {
          macroExp: 12,
          laningExp: 6,
          fatigue: 15,
          sleepHealth: -8,
          log: '你摸清了對手每波回城與插眼的微小習慣，但隔天起床眼睛佈滿血絲。',
        },
      },
      {
        text: '與分析師快速過一遍重點剪輯，維持 8 小時飽滿睡眠',
        type: 'BALANCED',
        effect: {
          macroExp: 7,
          disciplineExp: 6,
          stress: -5,
          log: '你在養精蓄銳的同時掌握了核心情報，以滿格狀態迎接比賽。',
        },
      },
    ],
  },

  // ==================== 2. 隊內 (TEAM) ====================
  {
    id: 'TM_01',
    category: 'TEAM',
    title: '誰來擔任主指揮 (Shotcaller)？',
    desc: '近期團戰指揮聲音過於雜亂，教練在會議上詢問誰願意在中後期承擔核心決策責任。',
    minAge: 17,
    choices: [
      {
        text: '挺身而出，接下主指揮重擔',
        type: 'RISKY',
        effect: {
          communicationExp: 15,
          macroExp: 8,
          stress: 12,
          coachTrust: 8,
          log: '你成為了隊伍的場上大腦，雖然肩上的勝負壓力倍增，但全隊戰術執行更加果斷！',
        },
      },
      {
        text: '專注個人對線與會戰輸出，輔助報資訊即可',
        type: 'CONSERVATIVE',
        effect: {
          mechanicsExp: 8,
          stress: -5,
          log: '你卸下了指揮包袱，能夠在會戰中打出最純粹的極限操作。',
        },
      },
    ],
  },
  {
    id: 'TM_02',
    category: 'TEAM',
    title: '復盤室的激烈爭執',
    desc: '因為昨天的惜敗，打野與雙人組在會議室爆發激烈口角，互怪沒有及時支援。',
    minAge: 17,
    choices: [
      {
        text: '冷靜用數據與重播客觀指出雙方的盲點，居中調解',
        type: 'BALANCED',
        effect: {
          communicationExp: 10,
          teamAffinity: 6,
          coachTrust: 6,
          log: '你的成熟與理性化解了更衣室危機，全隊對你的信任度大幅提升。',
        },
      },
      {
        text: '力挺對線打得好的一方，嚴厲批評失誤者',
        type: 'RISKY',
        effect: {
          mentalExp: 6,
          teamAffinity: -10,
          stress: 10,
          log: '爭吵雖然平息，但被你批評的隊友對你產生了芥蒂。',
        },
      },
      {
        text: '戴上耳機默默打自訂練習補刀，置身事外',
        type: 'CONSERVATIVE',
        effect: {
          laningExp: 4,
          teamAffinity: -2,
          log: '你沒有被捲入風波，但隊內的冰冷氛圍依然籠罩著基地。',
        },
      },
    ],
  },
  {
    id: 'TM_03',
    category: 'TEAM',
    title: '替補新秀的強勢挑戰',
    desc: '二隊提拔上來的天才新人最近在團練表現極其亮眼，教練開始考慮進行輪換。',
    minAge: 18,
    choices: [
      {
        text: '主動找新人和教練交流，互相切磋英雄理解與對局思路',
        type: 'BALANCED',
        effect: {
          championPoolExp: 8,
          mentalExp: 8,
          teamAffinity: 8,
          coachTrust: 6,
          log: '你展現了頂級大將風度，良性競爭讓你們雙方的實力都得到了躍升！',
        },
      },
      {
        text: '發狠加練，用絕對的排位分與團練戰績捍衛主力先發',
        type: 'RISKY',
        effect: {
          mechanicsExp: 12,
          fatigue: 16,
          wristHealth: -4,
          coachTrust: 8,
          log: '你在隨後的訓練賽中展現出統治級發揮，穩穩坐牢主力位置！',
        },
      },
    ],
  },
  {
    id: 'TM_04',
    category: 'TEAM',
    title: '教練組的嚴格戰術要求',
    desc: '教練要求你在下一場關鍵賽事犧牲個人發育，全場選用純坦克/工具人角色抗壓。',
    minAge: 17,
    choices: [
      {
        text: '完全服從戰術安排，專注練習保排與開戰',
        type: 'CONSERVATIVE',
        effect: {
          teamfightExp: 10,
          coachTrust: 10,
          disciplineExp: 8,
          log: '教練對你的團隊精神讚不絕口，隊伍體系變得更加立體。',
        },
      },
      {
        text: '委婉向教練爭取拿強勢 Carry 角的機會',
        type: 'RISKY',
        effect: {
          mechanicsExp: 8,
          coachTrust: -4,
          mentalExp: 5,
          log: '教練答應給你一把 Carry 嘗試，但警告你若打不出效果將面臨後果。',
        },
      },
    ],
  },
  {
    id: 'TM_05',
    category: 'TEAM',
    title: '隊友陷入自閉連敗心魔',
    desc: '隊上的核心輸出最近比賽接連失誤，深夜一個人在訓練室發呆嘆氣。',
    minAge: 17,
    choices: [
      {
        text: '買兩杯手搖飲陪他聊心事，分享自己克服低潮的經驗',
        type: 'BALANCED',
        effect: {
          teamAffinity: 12,
          communicationExp: 8,
          mentalExp: 6,
          stress: -5,
          log: '你的陪伴與開導幫助隊友走出了心理陰霾，兩人的默契更深一層。',
        },
      },
      {
        text: '拉他雙排韓服連打 5 場，用連勝幫他找回自信',
        type: 'RISKY',
        effect: {
          teamAffinity: 8,
          mechanicsExp: 8,
          fatigue: 10,
          log: '你們在韓服砍下五連勝，隊友的臉上終於重新浮現了笑容。',
        },
      },
    ],
  },

  // ==================== 3. 比賽 (MATCH) ====================
  {
    id: 'MC_01',
    category: 'MATCH',
    title: '對手絕活三連 Ban 針對',
    desc: '進入 BO5 決勝局，對手教練組在前三手直接封鎖了你近期的最強招牌英雄。',
    minAge: 17,
    choices: [
      {
        text: '自信秒鎖鮮少在賽場亮相的秘密武器，打對手一個措手不及',
        type: 'RISKY',
        effect: {
          mentalExp: 12,
          championPoolExp: 10,
          popularity: 8,
          log: '全場觀眾與主播為你的自信選角驚呼！你在決勝局打出了極高上限！',
        },
      },
      {
        text: '聽從教練推薦，拿版本常規萬金油英雄穩定發揮',
        type: 'CONSERVATIVE',
        effect: {
          teamfightExp: 8,
          coachTrust: 5,
          stress: -4,
          log: '你紮實地扛住了對局壓力，團戰發揮滴水不漏。',
        },
      },
    ],
  },
  {
    id: 'MC_02',
    category: 'MATCH',
    title: '絕境 22 分鐘巴龍決策',
    desc: '局面落後 5000 經濟，敵方主力回城補給，地圖上巴龍區視野全黑。',
    minAge: 17,
    choices: [
      {
        text: '大膽指揮全員偷打巴龍，孤注一擲賭生死',
        type: 'RISKY',
        effect: {
          macroExp: 14,
          mentalExp: 10,
          stress: 15,
          log: '這波極限偷龍直接扭轉了戰局，全網盛讚你的大心臟決策！',
        },
      },
      {
        text: '穩守高地清線，等待敵方失誤再尋求反打',
        type: 'CONSERVATIVE',
        effect: {
          disciplineExp: 8,
          teamfightExp: 6,
          stress: -5,
          log: '你們穩紮穩打拖到了 35 分鐘六神裝，在遠古龍團一決勝負。',
        },
      },
    ],
  },
  {
    id: 'MC_03',
    category: 'MATCH',
    title: '邊線單帶 1v2 極限操作機會',
    desc: '四人正面拉扯，敵方中野兩人突然包抄你帶線的下路二塔。',
    minAge: 17,
    choices: [
      {
        text: '利用草叢與防禦塔極限走位反打，嘗試雙殺',
        type: 'RISKY',
        effect: {
          mechanicsExp: 15,
          popularity: 10,
          mentalExp: 6,
          log: '你憑藉著神級反應與技能規避完成了驚天反殺，現場爆發震耳欲聾的歡呼！',
        },
      },
      {
        text: '果斷交出雙召喚師技能與位移逃生，替隊友爭取巴龍時間',
        type: 'BALANCED',
        effect: {
          macroExp: 10,
          coachTrust: 6,
          log: '你冷靜保全性命並拖住了兩人，正面隊友順利拿下巴龍大獲全勝。',
        },
      },
    ],
  },
  {
    id: 'MC_04',
    category: 'MATCH',
    title: '讓二追三的心態考驗',
    desc: '季後賽 BO5 前兩把慘遭碾壓，全隊士氣跌入冰點，只差一局就要被淘汰。',
    minAge: 17,
    choices: [
      {
        text: '在休息室大聲鼓勵隊友，帶頭調整戰術喊出「讓二追三！」',
        type: 'BALANCED',
        effect: {
          mentalExp: 15,
          communicationExp: 10,
          stress: -10,
          coachTrust: 8,
          log: '你的吶喊重新點燃了全隊的鬥志，這場系列賽成為了賽區經典戰役！',
        },
      },
      {
        text: '閉目冥想，專注在自己第三把的對線細節上',
        type: 'CONSERVATIVE',
        effect: {
          mentalExp: 8,
          laningExp: 8,
          log: '你保持了絕對的心如止水，在第三局砍下 MVP 吹響反攻號角。',
        },
      },
    ],
  },

  // ==================== 4. 健康 (HEALTH) ====================
  {
    id: 'HL_01',
    category: 'HEALTH',
    title: '手腕腱鞘炎初現徵兆',
    desc: '長時間高強度點擊滑鼠，你的手腕在訓練後出現劇烈酸痛與微麻感。',
    minAge: 17,
    choices: [
      {
        text: '戴上護腕並吃止痛藥，瞞著隊醫繼續完成今晚所有團練',
        type: 'RISKY',
        effect: {
          mechanicsExp: 8,
          wristHealth: -15,
          fatigue: 12,
          log: '你咬牙堅持完成了訓練，但手腕傷勢明顯惡化，醫生警告必須小心。',
        },
      },
      {
        text: '主動向領隊請假，前往醫院做物理治療與電療復健',
        type: 'CONSERVATIVE',
        effect: {
          wristHealth: 15,
          fatigue: -10,
          stress: -5,
          coachTrust: -2,
          log: '及時的醫療干預穩住了你的手腕狀態，避免了職業生涯的致命傷病。',
        },
      },
      {
        text: '減少操作型天梯訓練，改為每天做手部伸展操與肌力訓練',
        type: 'BALANCED',
        effect: {
          wristHealth: 8,
          disciplineExp: 10,
          fatigue: -5,
          log: '你養成良好的熱身習慣，大幅提升了身體的抗疲勞能力。',
        },
      },
    ],
  },
  {
    id: 'HL_02',
    category: 'HEALTH',
    title: '長期失眠與日夜顛倒',
    desc: '長期在凌晨三點入睡，你的生物鐘嚴重混亂，躺在床上輾轉反側無法入眠。',
    minAge: 17,
    choices: [
      {
        text: '睡不著就起床繼續打 Rank，直到筋疲力竭倒頭就睡',
        type: 'RISKY',
        effect: {
          mechanicsExp: 6,
          sleepHealth: -15,
          fatigue: 20,
          stress: 10,
          log: '極度缺煞讓你隔天在賽場上出現了注意力不集中的離譜失誤。',
        },
      },
      {
        text: '尋求運動心理師與睡眠門診協助，強制調整正常作息',
        type: 'BALANCED',
        effect: {
          sleepHealth: 16,
          fatigue: -15,
          stress: -10,
          disciplineExp: 8,
          log: '規律的作息讓你的大腦思維重回清晰敏銳狀態！',
        },
      },
    ],
  },
  {
    id: 'HL_03',
    category: 'HEALTH',
    title: '職業倦怠 (Burnout)',
    desc: '連月無休的高壓賽事與訓練，讓你突然對開遊戲感到強烈的厭煩與麻木。',
    minAge: 19,
    choices: [
      {
        text: '向戰隊申請兩天完全不碰電腦的休假，到戶外爬山放空',
        type: 'BALANCED',
        effect: {
          stress: -25,
          fatigue: -15,
          mentalExp: 8,
          log: '大自然的空氣洗滌了身心，重回基地後你找回了最初熱愛這款遊戲的熱情！',
        },
      },
      {
        text: '把電競當成工作，機械化地繼續執行每天的日程',
        type: 'CONSERVATIVE',
        effect: {
          disciplineExp: 6,
          stress: 8,
          log: '你靠著強大的職業紀律撐過了低潮，但眼中的靈性似乎少了一絲光芒。',
        },
      },
    ],
  },
  {
    id: 'HL_04',
    category: 'HEALTH',
    title: '久坐引起的腰背疼痛',
    desc: '長時間不良坐姿讓你的腰椎發出抗議，在長局比賽中難以維持專注。',
    minAge: 20,
    choices: [
      {
        text: '更換人體工學椅並加入每天 30 分鐘的核心肌群訓練',
        type: 'BALANCED',
        effect: {
          disciplineExp: 10,
          fatigue: -8,
          stress: -5,
          log: '體能的增強讓你在長達 50 分鐘的持久戰中依然能保持端正坐姿與頂級專注。',
        },
      },
      {
        text: '貼上痠痛貼布，能拖一天是一天',
        type: 'RISKY',
        effect: {
          fatigue: 5,
          log: '腰部隱約的不適感依然在長盤比賽中困擾著你。',
        },
      },
    ],
  },

  // ==================== 5. 公關 (PR) ====================
  {
    id: 'PR_01',
    category: 'PR',
    title: '賽後勝者採訪環節',
    desc: '在直落二擊敗宿敵戰隊後，你受邀站上主舞台接受官方主持人的現場採訪。',
    minAge: 17,
    choices: [
      {
        text: '自信放話：「我們目標只有冠軍，對手今天打得像人機。」',
        type: 'RISKY',
        effect: {
          popularity: 20,
          stress: 10,
          mentalExp: 8,
          log: '你的垃圾話瞬間引爆各大社群，有人封你為狂妄之神，也有黑粉開始放大鏡檢視你！',
        },
      },
      {
        text: '謙遜歸功全隊：「對手很強，是我們教練團的 BP 與隊友發揮得好。」',
        type: 'CONSERVATIVE',
        effect: {
          popularity: 8,
          coachTrust: 6,
          teamAffinity: 6,
          log: '得體大方的回答贏得了所有觀眾與管理層的一致好評。',
        },
      },
      {
        text: '玩社群流行迷因梗，幽默逗樂現場觀眾',
        type: 'BALANCED',
        effect: {
          popularity: 14,
          communicationExp: 6,
          stress: -5,
          log: '你的幽默發言被做成無數表情包，圈粉無數！',
        },
      },
    ],
  },
  {
    id: 'PR_02',
    category: 'PR',
    title: '實況直播時的黑粉挑釁',
    desc: '你在合約規定的實況直播時，彈幕大量黑粉刷屏嘲諷你上一場的閃現失誤。',
    minAge: 17,
    choices: [
      {
        text: '當場回嗆並封鎖黑粉，用實況開庭對線',
        type: 'RISKY',
        effect: {
          popularity: -5,
          stress: 15,
          mentalExp: 6,
          log: '切片被傳上 YouTube 引發爭議，戰隊管理層私下提醒你注意公眾形象。',
        },
      },
      {
        text: '自嘲幽默化解：「對啊那個閃現撞牆我自己看都想笑」，接著秀一波操作',
        type: 'BALANCED',
        effect: {
          popularity: 15,
          mentalExp: 10,
          stress: -5,
          log: '高情商的幽默應對化敵為友，路人觀眾紛紛轉粉！',
        },
      },
      {
        text: '關閉彈幕視窗，專心排位不給任何眼神',
        type: 'CONSERVATIVE',
        effect: {
          disciplineExp: 6,
          stress: 2,
          log: '你沒有被負面言論干擾，穩穩打完了當天的排位。',
        },
      },
    ],
  },
  {
    id: 'PR_03',
    category: 'PR',
    title: '知名運動飲料代言商務拍攝',
    desc: '贊助商看中你的高人氣，開出豐厚報酬邀請你拍攝一支電視廣告。',
    minAge: 18,
    choices: [
      {
        text: '接受代言，全力配合劇組拍攝一整天',
        type: 'BALANCED',
        effect: {
          popularity: 18,
          money: 50000,
          fatigue: 10,
          log: '廣告在大街小巷播出，你的商業價值與身價水漲船高！',
        },
      },
      {
        text: '以備戰季後賽為由婉拒，專注訓練',
        type: 'CONSERVATIVE',
        effect: {
          coachTrust: 8,
          disciplineExp: 8,
          log: '你的純粹與職業態度贏得了教練與隊友的絕對敬重。',
        },
      },
    ],
  },

  // ==================== 6. 人生 (LIFE) ====================
  {
    id: 'LF_01',
    category: 'LIFE',
    title: '家庭與學業的十字路口 (16-17歲起步)',
    desc: '收到第一份職業二隊試訓邀請，但父母強烈反對，要求你至少先把高中念完考上大學。',
    minAge: 16,
    choices: [
      {
        text: '毅然決然簽約休學，全力背水一戰追逐職業電競夢',
        type: 'RISKY',
        effect: {
          mentalExp: 15,
          stress: 15,
          popularity: 5,
          log: '你扛著巨大的家庭阻力踏入基地，這份破釜沉舟的決心讓你在訓練中格外拼命！',
        },
      },
      {
        text: '與父母簽下「一年之約」，承諾若一年內未打進一隊便回學校讀書',
        type: 'BALANCED',
        effect: {
          disciplineExp: 12,
          mentalExp: 10,
          stress: 5,
          log: '父母勉強同意了你的約定，你給自己設定了清晰嚴格的目標日程。',
        },
      },
      {
        text: '選擇半工半讀，白天在校上課、晚上與週末打業餘賽',
        type: 'CONSERVATIVE',
        effect: {
          fatigue: 20,
          stress: 10,
          disciplineExp: 10,
          log: '兩頭奔波讓你極其疲憊，但你維持了家庭的和睦與學業的退路。',
        },
      },
    ],
  },
  {
    id: 'LF_02',
    category: 'LIFE',
    title: '南韓/中國賽區的旅外天價合約誘惑',
    desc: '你在國際賽上的亮眼發揮吸引了海外豪門關注，經紀人帶來了一份薪水翻三倍但需要適應全新語言環境的合約。',
    minAge: 19,
    choices: [
      {
        text: '接受挑戰，前往頂級賽區證明自己的世界級身手',
        type: 'RISKY',
        effect: {
          popularity: 25,
          stress: 20,
          money: 200000,
          mentalExp: 12,
          log: '你登上了飛機展開旅外征程！全新的環境充滿了挑戰與榮耀！',
        },
      },
      {
        text: '留在 LCP 作為當家台柱，立志帶領賽區挑戰世界冠軍',
        type: 'CONSERVATIVE',
        effect: {
          popularity: 20,
          teamAffinity: 15,
          coachTrust: 15,
          stress: -5,
          log: '你的忠誠讓本土粉絲感動不已，你成為了 LCP 的標誌性圖騰人物！',
        },
      },
    ],
  },
  {
    id: 'LF_03',
    category: 'LIFE',
    title: '感情生活與職業平衡',
    desc: '你在朋友聚會上認識了一位心儀的女孩，她希望你能多撥出時間陪伴她約會。',
    minAge: 18,
    choices: [
      {
        text: '大方談戀愛，在休假時陪伴女友放鬆生活',
        type: 'BALANCED',
        effect: {
          stress: -20,
          fatigue: -5,
          disciplineExp: -4,
          log: '甜蜜的戀情讓你的生活有了溫暖的避風港，心理壓力大幅減輕。',
        },
      },
      {
        text: '向對方坦白現階段必須把 100% 精力投入在電競事業上',
        type: 'CONSERVATIVE',
        effect: {
          disciplineExp: 10,
          mechanicsExp: 6,
          log: '你保持了純粹的修道士式專注，全心全意投身召喚峽谷。',
        },
      },
    ],
  },
  {
    id: 'LF_04',
    category: 'LIFE',
    title: '老將的生涯抉擇 (25歲以上)',
    desc: '年過 25，看著身邊同期的選手一個個轉行轉型，你感受到了年齡帶來的反應下滑與心境變化。',
    minAge: 25,
    choices: [
      {
        text: '轉型為經驗型老將與主指揮，用極致觀念與心態帶領年輕隊友',
        type: 'BALANCED',
        effect: {
          macroExp: 15,
          communicationExp: 15,
          mentalExp: 15,
          coachTrust: 12,
          log: '你的成熟與智慧成為了戰隊最寶貴的財富，成功延續了傳奇生涯！',
        },
      },
      {
        text: '堅持極限訓練，每天額外進行 2 小時反應速度特訓抗衡衰老',
        type: 'RISKY',
        effect: {
          mechanicsExp: 10,
          wristHealth: -10,
          fatigue: 18,
          disciplineExp: 15,
          log: '你的堅韌讓所有人肅然起敬，老兵不死，只是繼續燃燒！',
        },
      },
    ],
  },
];

export function getEventsByCategory(category) {
  return EVENTS.filter(e => e.category === category);
}

export function getRandomEvent(rng, playerAge = 16, category = null) {
  let pool = EVENTS.filter(e => (!e.minAge || playerAge >= e.minAge));
  if (category) {
    pool = pool.filter(e => e.category === category);
  }
  if (pool.length === 0) return EVENTS[0];
  return rng.choice(pool);
}
