// ==========================================
// 皇家百家樂 (Royal Baccarat) - 核心遊戲邏輯
// ==========================================

const SUITS = [
    { symbol: '♠', name: 'spade', color: 'black' },
    { symbol: '♥', name: 'heart', color: 'red' },
    { symbol: '♦', name: 'diamond', color: 'red' },
    { symbol: '♣', name: 'club', color: 'black' }
];

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// 遊戲狀態機
const gameState = {
    balance: 1000,
    selectedChip: 10,
    bets: {
        player: 0,
        tie: 0,
        banker: 0
    },
    deck: [],
    playerHand: [],
    bankerHand: [],
    roadHistory: [], // 'P', 'B', 'T'
    playerGameLogs: [], // 玩家實戰歷史資金變化紀錄
    currentRoundNum: 0,
    isPlaying: false
};

// DOM 元素引用
const elBalance = document.getElementById('balanceDisplay');
const elDeckRemaining = document.getElementById('deckRemainingDisplay');
const elBalanceBox = document.getElementById('balanceBox');
const elEditBalanceBtn = document.getElementById('editBalanceBtn');
const elTotalBet = document.getElementById('currentTotalBetDisplay');
const elPlayerScore = document.getElementById('playerScore');
const elBankerScore = document.getElementById('bankerScore');
const elPlayerCards = document.getElementById('playerCards');
const elBankerCards = document.getElementById('bankerCards');
const elGameStatus = document.getElementById('gameStatus');
const elDealBtn = document.getElementById('dealBtn');
const elClearBetBtn = document.getElementById('clearBetBtn');
const elNewRoundBtn = document.getElementById('newRoundBtn');
const elRoadmapGrid = document.getElementById('roadmapGrid');
const elCustomChipBtn = document.getElementById('customChipBtn');
const elCountPlayer = document.getElementById('countPlayer');
const elCountBanker = document.getElementById('countBanker');
const elCountTie = document.getElementById('countTie');
const elPlayerHistoryBody = document.getElementById('playerHistoryBody');
const elExportPlayerChartPngBtn = document.getElementById('exportPlayerChartPngBtn');
const elExportPlayerLogCsvBtn = document.getElementById('exportPlayerLogCsvBtn');
const elClearPlayerLogBtn = document.getElementById('clearPlayerLogBtn');
const elBankruptcyModal = document.getElementById('bankruptcyModal');
const elModalRestartBtn = document.getElementById('modalRestartBtn');
const elModalExportPngBtn = document.getElementById('modalExportPngBtn');

const betAmounts = {
    player: document.getElementById('betAmountPlayer'),
    tie: document.getElementById('betAmountTie'),
    banker: document.getElementById('betAmountBanker')
};

// ------------------------------------------
// 1. 初始化與洗牌演算法 (Fisher-Yates 8 副牌)
// ------------------------------------------
function createShoe(deckCount = 8) {
    const shoe = [];
    for (let i = 0; i < deckCount; i++) {
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                let value = 0;
                if (rank === 'A') value = 1;
                else if (['10', 'J', 'Q', 'K'].includes(rank)) value = 0;
                else value = parseInt(rank, 10);

                shoe.push({ rank, suit, value });
            }
        }
    }
    // 洗牌
    for (let i = shoe.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
    }
    return shoe;
}

// ------------------------------------------
// 2. 籌碼與下注控制
// ------------------------------------------
function setupControls() {
    // 自訂籌碼餘額功能
  const handleEditBalance = () => {
    if (gameState.isPlaying) {
      showStatus('牌局進行中，請等本局結束後再修改餘額！');
      return;
    }
    const input = prompt('請輸入欲設定的總籌碼餘額 ($)：', gameState.balance);
    if (input !== null) {
      const parsed = parseInt(input.trim(), 10);
      if (!isNaN(parsed) && parsed >= 0) {
        gameState.balance = parsed;
        updateUI();
        showStatus(`總籌碼餘額已重設為 $${parsed.toLocaleString()}`);
      } else {
        alert('請輸入大於或等於 0 的有效整數！');
      }
    }
  };

  elBalanceBox.addEventListener('click', handleEditBalance);

  // 籌碼選擇事件
    document.querySelectorAll('.chip:not(#customChipBtn)').forEach(chip => {
        chip.addEventListener('click', () => {
            if (gameState.isPlaying) return;
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected', 'active-allin'));
            chip.classList.add('selected');
            gameState.isAllInMode = false;
            gameState.selectedChip = parseInt(chip.dataset.value, 10);
            showStatus(`已選取 $${gameState.selectedChip} 籌碼`);
        });
    });

    // ALL IN 按鈕
    elCustomChipBtn.addEventListener('click', () => {
        if (gameState.isPlaying) return;
        if (gameState.balance <= 0) {
            showStatus('餘額為 0，無法 ALL IN！');
            return;
        }
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
        elCustomChipBtn.classList.add('selected', 'active-allin');
        gameState.isAllInMode = true;
        showStatus(`已啟用 ALL IN 模式！點擊下注區將押入全部剩餘資產 ($${gameState.balance.toLocaleString()})`);
    });

    // 下注格點擊
    document.querySelectorAll('.bet-spot').forEach(spot => {
        spot.addEventListener('click', () => {
            if (gameState.isPlaying) return;
            const target = spot.dataset.target;

            // 判斷是否為 ALL IN 模式
            if (gameState.isAllInMode) {
                if (gameState.balance <= 0) {
                    showStatus('餘額已全數下注！');
                    return;
                }
                const allinAmount = gameState.balance;
                gameState.balance = 0;
                gameState.bets[target] += allinAmount;
                updateUI();
                showStatus(`🔥 ALL IN！已將 $${allinAmount.toLocaleString()} 全押至 ${target === 'player' ? '閒家' : target === 'banker' ? '莊家' : '和局'}`);
                return;
            }

            const amount = gameState.selectedChip;
            if (gameState.balance >= amount) {
                gameState.balance -= amount;
                gameState.bets[target] += amount;
                updateUI();
            } else {
                showStatus('籌碼不足！請調整下注額或使用 ALL IN');
            }
        });
    });

    // 清除下注
    elClearBetBtn.addEventListener('click', () => {
        if (gameState.isPlaying) return;
        const refunded = gameState.bets.player + gameState.bets.tie + gameState.bets.banker;
        gameState.balance += refunded;
        gameState.bets.player = 0;
        gameState.bets.tie = 0;
        gameState.bets.banker = 0;
        updateUI();
        showStatus('已清除下注');
    });

    // 發牌
    elDealBtn.addEventListener('click', () => {
        startRound();
    });

    // 下一局
    elNewRoundBtn.addEventListener('click', () => {
        resetTableForNextRound();
    });
}

function getTotalBet() {
    return gameState.bets.player + gameState.bets.tie + gameState.bets.banker;
}

function updateUI() {
    elBalance.textContent = `$${Math.round(gameState.balance).toLocaleString()}`;
    if (elDeckRemaining) {
        elDeckRemaining.textContent = `${gameState.deck.length} 張`;
    }
    const totalBet = Math.round(getTotalBet());
    elTotalBet.textContent = `$${totalBet.toLocaleString()}`;

    betAmounts.player.textContent = `$${Math.round(gameState.bets.player).toLocaleString()}`;
    betAmounts.tie.textContent = `$${Math.round(gameState.bets.tie).toLocaleString()}`;
    betAmounts.banker.textContent = `$${Math.round(gameState.bets.banker).toLocaleString()}`;

    elDealBtn.disabled = totalBet === 0 || gameState.isPlaying;
    elClearBetBtn.disabled = totalBet === 0 || gameState.isPlaying;
}

function showStatus(msg) {
    elGameStatus.textContent = msg;
}

// ------------------------------------------
// 3. 牌點計算與補牌規則 (Tableau / Punto Banco)
// ------------------------------------------
function calculateHandValue(hand) {
    const sum = hand.reduce((acc, card) => acc + card.value, 0);
    return sum % 10;
}

function drawCard() {
    if (gameState.deck.length < 20) {
        showStatus('牌靴剩餘少於 20 張，重新洗 8 副新牌！');
        gameState.deck = createShoe(8);
    }
    const card = gameState.deck.pop();
    if (elDeckRemaining) {
        elDeckRemaining.textContent = `${gameState.deck.length} 張`;
    }
    return card;
}

function renderCard(card, container) {
    const cardEl = document.createElement('div');
    cardEl.className = `card ${card.suit.color}`;
    cardEl.innerHTML = `
    <span class="rank-top">${card.rank}</span>
    <span class="suit">${card.suit.symbol}</span>
    <span class="rank-bottom">${card.rank}</span>
  `;
    container.appendChild(cardEl);
}

// 延遲工具函數，用於營造真實賭桌發牌節奏
const delay = ms => new Promise(res => setTimeout(res, ms));

async function startRound() {
    gameState.isPlaying = true;
    updateUI();
    elDealBtn.style.display = 'none';
    elClearBetBtn.style.display = 'none';

    elPlayerCards.innerHTML = '';
    elBankerCards.innerHTML = '';
    elPlayerScore.textContent = '-';
    elBankerScore.textContent = '-';

    showStatus('發牌中...');

    // 發前兩張牌 (閒1 -> 莊1 -> 閒2 -> 莊2)
    await delay(400);
    gameState.playerHand.push(drawCard());
    renderCard(gameState.playerHand[0], elPlayerCards);
    elPlayerScore.textContent = calculateHandValue(gameState.playerHand);

    await delay(400);
    gameState.bankerHand.push(drawCard());
    renderCard(gameState.bankerHand[0], elBankerCards);
    elBankerScore.textContent = calculateHandValue(gameState.bankerHand);

    await delay(400);
    gameState.playerHand.push(drawCard());
    renderCard(gameState.playerHand[1], elPlayerCards);
    let pScore = calculateHandValue(gameState.playerHand);
    elPlayerScore.textContent = pScore;

    await delay(400);
    gameState.bankerHand.push(drawCard());
    renderCard(gameState.bankerHand[1], elBankerCards);
    let bScore = calculateHandValue(gameState.bankerHand);
    elBankerScore.textContent = bScore;

    // 檢查天牌 (Natural 8 或 9)
    if (pScore >= 8 || bScore >= 8) {
        showStatus(`天牌 (Natural)！閒家 ${pScore} 點，莊家 ${bScore} 點`);
        await delay(1000);
        finishRound(pScore, bScore);
        return;
    }

    // 閒家補牌規則 (0~5 補一張，6~7 停牌)
    let playerThirdCard = null;
    if (pScore <= 5) {
        showStatus('閒家補第三張牌...');
        await delay(700);
        playerThirdCard = drawCard();
        gameState.playerHand.push(playerThirdCard);
        renderCard(playerThirdCard, elPlayerCards);
        pScore = calculateHandValue(gameState.playerHand);
        elPlayerScore.textContent = pScore;
    } else {
        showStatus('閒家停牌 (Stand)');
        await delay(500);
    }

    // 莊家補牌規則 (依閒家有無補牌及補牌點數判定)
    let bankerDraws = false;
    if (playerThirdCard === null) {
        // 閒家沒補牌時，莊家 0~5 補牌，6~7 停牌
        if (bScore <= 5) bankerDraws = true;
    } else {
        // 閒家補了第三張牌，精確比對莊家補牌表
        const p3Val = playerThirdCard.value;
        if (bScore <= 2) {
            bankerDraws = true;
        } else if (bScore === 3 && p3Val !== 8) {
            bankerDraws = true;
        } else if (bScore === 4 && [2, 3, 4, 5, 6, 7].includes(p3Val)) {
            bankerDraws = true;
        } else if (bScore === 5 && [4, 5, 6, 7].includes(p3Val)) {
            bankerDraws = true;
        } else if (bScore === 6 && [6, 7].includes(p3Val)) {
            bankerDraws = true;
        }
    }

    if (bankerDraws) {
        showStatus('莊家補第三張牌...');
        await delay(700);
        const b3 = drawCard();
        gameState.bankerHand.push(b3);
        renderCard(b3, elBankerCards);
        bScore = calculateHandValue(gameState.bankerHand);
        elBankerScore.textContent = bScore;
    } else {
        showStatus('莊家停牌 (Stand)');
        await delay(500);
    }

    await delay(800);
    finishRound(pScore, bScore);
}

// ------------------------------------------
// 4. 勝負派彩與路單紀錄
// ------------------------------------------
function finishRound(pScore, bScore) {
    let result = ''; // 'P', 'B', 'T'
    let winAmount = 0;
    const totalBetThisRound = getTotalBet();
    const prevBalance = gameState.balance; // 此時尚未加上本局派彩，本金已在下注時扣除

    if (pScore > bScore) {
        result = 'P';
        showStatus(`【閒贏 Player Win】閒 ${pScore} 點 對 莊 ${bScore} 點！`);
        if (gameState.bets.player > 0) {
            winAmount += gameState.bets.player * 2; // 1:1 回本+派彩
        }
    } else if (bScore > pScore) {
        result = 'B';
        showStatus(`【莊贏 Banker Win】莊 ${bScore} 點 對 閒 ${pScore} 點！`);
        if (gameState.bets.banker > 0) {
            winAmount += gameState.bets.banker + Math.round(gameState.bets.banker * 0.95); // 莊贏 5% 抽水，派彩四捨五入取整
        }
    } else {
        result = 'T';
        showStatus(`【和局 Tie】雙方皆為 ${pScore} 點！`);
        if (gameState.bets.tie > 0) {
            winAmount += gameState.bets.tie + (gameState.bets.tie * 8); // 8:1 派彩
        }
        // 和局退回閒與莊之本金
        winAmount += gameState.bets.player;
        winAmount += gameState.bets.banker;
    }

    const netChange = Math.round(winAmount - totalBetThisRound);
    gameState.balance = Math.round(gameState.balance + winAmount);
    gameState.roadHistory.push(result);
    renderRoadmap();

    // 記錄玩家實戰資金日誌
    gameState.currentRoundNum++;
    recordPlayerHistoryLog({
        round: gameState.currentRoundNum,
        bets: { ...gameState.bets },
        totalBet: Math.round(totalBetThisRound),
        result,
        pScore,
        bScore,
        netChange,
        finalBalance: gameState.balance
    });

    // 清空本局押注
    gameState.bets.player = 0;
    gameState.bets.tie = 0;
    gameState.bets.banker = 0;

    updateUI();
    elNewRoundBtn.style.display = 'inline-block';

    // 檢查破產條件 (餘額小於最低籌碼 10)
    checkBankruptcy();
}

function resetTableForNextRound() {
    gameState.isPlaying = false;
    gameState.isAllInMode = false;
    gameState.playerHand = [];
    gameState.bankerHand = [];

    // 重設所有籌碼選中狀態，確保只高亮 10 號籌碼
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected', 'active-allin'));
    const defaultChip = document.querySelector('.chip-10');
    if (defaultChip) defaultChip.classList.add('selected');
    gameState.selectedChip = 10;

    elPlayerCards.innerHTML = '';
    elBankerCards.innerHTML = '';
    elPlayerScore.textContent = '-';
    elBankerScore.textContent = '-';

    elDealBtn.style.display = 'inline-block';
    elClearBetBtn.style.display = 'inline-block';
    elNewRoundBtn.style.display = 'none';

    updateUI();
    showStatus('請選擇籌碼並在區域下注');
}

// ------------------------------------------
// 5. 珠盤路 (Bead Plate) 繪製
// ------------------------------------------
function renderRoadmap() {
    elRoadmapGrid.innerHTML = '';
    let countP = 0;
    let countB = 0;
    let countT = 0;

    gameState.roadHistory.forEach(res => {
        if (res === 'P') countP++;
        if (res === 'B') countB++;
        if (res === 'T') countT++;

        const cell = document.createElement('div');
        cell.className = `road-cell ${res}`;
        cell.textContent = res === 'P' ? '閒' : res === 'B' ? '莊' : '和';
        elRoadmapGrid.appendChild(cell);
    });

    elCountPlayer.textContent = countP;
    elCountBanker.textContent = countB;
    elCountTie.textContent = countT;

    // 自動捲動到最右側
    elRoadmapGrid.scrollLeft = elRoadmapGrid.scrollWidth;
}

// ------------------------------------------
// 5.1 玩家實戰資產歷史日誌管理與 CSV 匯出
// ------------------------------------------
function recordPlayerHistoryLog(entry) {
    gameState.playerGameLogs.unshift(entry); // 最新局排在最前面
    renderPlayerHistoryTable();
    if (elExportPlayerLogCsvBtn) elExportPlayerLogCsvBtn.disabled = false;
    if (elExportPlayerChartPngBtn) elExportPlayerChartPngBtn.disabled = false;
}

function renderPlayerHistoryTable() {
    if (!elPlayerHistoryBody) return;
    if (gameState.playerGameLogs.length === 0) {
        elPlayerHistoryBody.innerHTML = `
            <tr>
              <td colspan="7" class="no-record">尚未進行實戰牌局，完成一局後將自動記錄</td>
            </tr>
        `;
        return;
    }

    elPlayerHistoryBody.innerHTML = '';
    gameState.playerGameLogs.forEach(log => {
        const tr = document.createElement('tr');

        // 下注摘要描述
        const betsDesc = [];
        if (log.bets.player > 0) betsDesc.push(`閒:$${log.bets.player}`);
        if (log.bets.banker > 0) betsDesc.push(`莊:$${log.bets.banker}`);
        if (log.bets.tie > 0) betsDesc.push(`和:$${log.bets.tie}`);
        const betDetailStr = betsDesc.join(' / ') || '無下注';

        // 開牌字樣
        const resText = log.result === 'P' ? '閒贏' : log.result === 'B' ? '莊贏' : '和局';
        const resClass = log.result === 'P' ? 'p-tag' : log.result === 'B' ? 'b-tag' : 't-tag';

        // 盈虧變化
        const netStr = (log.netChange > 0 ? `+` : ``) + `$${Math.round(log.netChange).toLocaleString()}`;
        const netClass = log.netChange > 0 ? 'change-pos' : log.netChange < 0 ? 'change-neg' : 'change-zero';

        tr.innerHTML = `
            <td>#${log.round}</td>
            <td>${betDetailStr}</td>
            <td>$${log.totalBet.toLocaleString()}</td>
            <td><b class="${resClass}">${resText}</b></td>
            <td>閒 ${log.pScore} vs 莊 ${log.bScore}</td>
            <td class="${netClass}">${netStr}</td>
            <td><strong>$${Math.round(log.finalBalance).toLocaleString()}</strong></td>
        `;
        elPlayerHistoryBody.appendChild(tr);
    });
}

// ------------------------------------------
// 通用下載與手機端相容觸發工具
// ------------------------------------------
function triggerDownloadOrShare(dataUri, fileName, mimeType = 'image/png') {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // 1. 若為手機端，且支援原生 Web Share API（可直接分享/儲存到 iOS 檔案或相簿）
    if (isMobile && navigator.share && navigator.canShare) {
        try {
            fetch(dataUri)
                .then(res => res.blob())
                .then(blob => {
                    const file = new File([blob], fileName, { type: mimeType });
                    if (navigator.canShare({ files: [file] })) {
                        navigator.share({
                            files: [file],
                            title: fileName,
                            text: '皇家百家樂報告'
                        }).catch(e => {
                            // 若使用者取消分享或失敗，退回彈窗長按儲存
                            fallbackMobileDisplay(dataUri, fileName, mimeType);
                        });
                        return;
                    }
                    fallbackMobileDisplay(dataUri, fileName, mimeType);
                })
                .catch(() => fallbackMobileDisplay(dataUri, fileName, mimeType));
            return;
        } catch (e) {
            console.warn('Share error:', e);
        }
    }

    // 2. 一般下載（PC 或支援 download 屬性的環境）
    try {
        const link = document.createElement('a');
        link.href = dataUri;
        link.download = fileName;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            document.body.removeChild(link);
        }, 300);
    } catch (e) {
        fallbackMobileDisplay(dataUri, fileName, mimeType);
    }
}

function fallbackMobileDisplay(dataUri, fileName, mimeType) {
    if (mimeType.startsWith('image/')) {
        const modal = document.getElementById('imagePreviewModal');
        const img = document.getElementById('previewModalImage');
        const closeBtn = document.getElementById('closePreviewModalBtn');
        if (modal && img) {
            img.src = dataUri;
            modal.style.display = 'flex';
            closeBtn.onclick = () => { modal.style.display = 'none'; };
            return;
        }
    }
    // CSV 或其他檔案，直接在分頁中開啟
    window.open(dataUri, '_blank');
}

function setupPlayerHistoryEvents() {
    if (elExportPlayerChartPngBtn) {
        elExportPlayerChartPngBtn.addEventListener('click', exportPlayerChartPNG);
    }
    if (elExportPlayerLogCsvBtn) {
        elExportPlayerLogCsvBtn.addEventListener('click', exportPlayerLogsCSV);
    }
    if (elClearPlayerLogBtn) {
        elClearPlayerLogBtn.addEventListener('click', () => {
            if (confirm('確定要清空實戰資產歷史紀錄嗎？')) {
                gameState.playerGameLogs = [];
                renderPlayerHistoryTable();
                if (elExportPlayerLogCsvBtn) elExportPlayerLogCsvBtn.disabled = true;
                if (elExportPlayerChartPngBtn) elExportPlayerChartPngBtn.disabled = true;
            }
        });
    }

    // 破產彈窗按鈕事件
    if (elModalRestartBtn) {
        elModalRestartBtn.addEventListener('click', () => {
            hideBankruptcyModal();
            restartGameCompletely();
        });
    }

    if (elModalExportPngBtn) {
        elModalExportPngBtn.addEventListener('click', () => {
            exportPlayerChartPNG();
        });
    }
}

function exportPlayerLogsCSV() {
    if (gameState.playerGameLogs.length === 0) return;
    let csvContent = '\uFEFF';
    csvContent += '【皇家百家樂 - 玩家實戰歷史資金變化紀錄】\n';
    csvContent += `匯出時間,${new Date().toLocaleString()}\n`;
    csvContent += `當前總資產,$${gameState.balance}\n\n`;

    csvContent += '局數(#),下注內容,本局總下注,開牌結果,閒家點數,莊家點數,盈虧變化,結算資產\n';
    const chronologicalLogs = [...gameState.playerGameLogs].reverse();
    chronologicalLogs.forEach(log => {
        const betsDesc = [];
        if (log.bets.player > 0) betsDesc.push(`閒:$${log.bets.player}`);
        if (log.bets.banker > 0) betsDesc.push(`莊:$${log.bets.banker}`);
        if (log.bets.tie > 0) betsDesc.push(`和:$${log.bets.tie}`);
        const betDetailStr = `"${betsDesc.join(' / ')}"`;

        const resText = log.result === 'P' ? '閒贏' : log.result === 'B' ? '莊贏' : '和局';
        csvContent += `${log.round},${betDetailStr},${log.totalBet},${resText},${log.pScore},${log.bScore},${log.netChange},${log.finalBalance}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    triggerDownloadOrShare(url, `player_live_baccarat_history_${new Date().getTime()}.csv`, 'text/csv');
}

// 匯出玩家實戰資金走勢圖 (PNG)
function exportPlayerChartPNG() {
    if (gameState.playerGameLogs.length === 0) return;

    // 依局數由小到大排列
    const logs = [...gameState.playerGameLogs].reverse();
    // 找出初始金額（第 1 局前資金 = 第 1 局結算資產 - 第 1 局淨變化）
    const initialBal = logs[0].finalBalance - logs[0].netChange;
    const finalBal = logs[logs.length - 1].finalBalance;
    const netProfit = finalBal - initialBal;

    let peakBal = Math.max(initialBal, ...logs.map(l => l.finalBalance));
    let minBal = Math.min(initialBal, ...logs.map(l => l.finalBalance));
    let maxBet = Math.max(...logs.map(l => l.totalBet));

    // 計算連勝與連敗
    let currentStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    logs.forEach(l => {
        if (l.netChange > 0) {
            currentStreak = currentStreak > 0 ? currentStreak + 1 : 1;
            if (currentStreak > maxWinStreak) maxWinStreak = currentStreak;
        } else if (l.netChange < 0) {
            currentStreak = currentStreak < 0 ? currentStreak - 1 : -1;
            if (Math.abs(currentStreak) > maxLossStreak) maxLossStreak = Math.abs(currentStreak);
        }
    });

    // 建立 2x Retina 高清 Canvas
    const reportCanvas = document.createElement('canvas');
    const dpr = 2;
    const baseW = 1000;
    const baseH = 680;
    reportCanvas.width = baseW * dpr;
    reportCanvas.height = baseH * dpr;
    const ctx = reportCanvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // 1. 深色質感背景與金色外框
    ctx.fillStyle = '#0a140f';
    ctx.fillRect(0, 0, baseW, baseH);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, baseW - 20, baseH - 20);

    // 2. 標題與副標
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 24px -apple-system, sans-serif';
    ctx.fillText('ROYAL BACCARAT 玩家實戰資產報告', 35, 48);

    ctx.fillStyle = '#888';
    ctx.font = '13px -apple-system, sans-serif';
    ctx.fillText(`個人實戰下注歷史走向與統計數據 (產生時間: ${new Date().toLocaleString()})`, 35, 72);

    // 3. 頂部摘要橫幅
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(35, 88, baseW - 70, 36);
    ctx.fillStyle = '#ddd';
    ctx.font = '13px -apple-system, sans-serif';
    const summaryText = `初始資金: $${initialBal.toLocaleString()}    |    當前結算資產: $${finalBal.toLocaleString()}    |    實戰總局數: ${logs.length} 局`;
    ctx.fillText(summaryText, 50, 111);

    // 4. 六大指標卡片
    const stats = [
        { label: '實戰資產 (Current Balance)', val: `$${finalBal.toLocaleString()}`, color: '#fff' },
        { label: '總淨利 / 淨損 (Net Profit)', val: `${netProfit >= 0 ? '+' : ''}$${netProfit.toLocaleString()}`, color: netProfit >= 0 ? '#4ade80' : '#f87171' },
        { label: '最大連勝 (Max Win Streak)', val: `${maxWinStreak} 連勝`, color: '#4ade80' },
        { label: '最大連敗 (Max Loss Streak)', val: `${maxLossStreak} 連敗`, color: '#f87171' },
        { label: '資產最高峰 (Peak Bankroll)', val: `$${peakBal.toLocaleString()}`, color: '#ffd700' },
        { label: '最高單局下注 (Max Bet)', val: `$${maxBet.toLocaleString()}`, color: '#f59e0b' }
    ];

    const cardW = (baseW - 70 - (stats.length - 1) * 10) / stats.length;
    stats.forEach((st, idx) => {
        const x = 35 + idx * (cardW + 10);
        const y = 136;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(x, y, cardW, 64);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cardW, 64);

        ctx.fillStyle = '#999';
        ctx.font = '10px -apple-system, sans-serif';
        ctx.fillText(st.label, x + 8, y + 20);

        ctx.fillStyle = st.color;
        ctx.font = 'bold 15px -apple-system, sans-serif';
        ctx.fillText(st.val, x + 8, y + 48);
    });

    // 5. 繪製圖表區域
    const chartX = 35;
    const chartY = 215;
    const chartW = baseW - 70;
    const chartH = 430;

    // 圖表格底
    ctx.fillStyle = '#090e0c';
    ctx.fillRect(chartX, chartY, chartW, chartH);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.strokeRect(chartX, chartY, chartW, chartH);

    const padLeft = 80;
    const padRight = 30;
    const padTop = 30;
    const padBottom = 40;

    let upperBal = Math.max(peakBal, initialBal * 1.1);
    let lowerBal = Math.min(minBal, 0);
    const range = (upperBal - lowerBal) || 1;

    const getPtX = idx => chartX + padLeft + (idx / Math.max(1, logs.length)) * (chartW - padLeft - padRight);
    const getPtY = val => chartY + padTop + (1 - (val - lowerBal) / range) * (chartH - padTop - padBottom);

    // 格線
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    ctx.lineWidth = 1;

    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
        const val = lowerBal + (range / yTicks) * i;
        const py = getPtY(val);
        ctx.beginPath();
        ctx.moveTo(chartX + padLeft, py);
        ctx.lineTo(chartX + chartW - padRight, py);
        ctx.stroke();
        ctx.fillText(`$${Math.round(val).toLocaleString()}`, chartX + 10, py + 4);
    }

    // 初始基準線
    const baseLineY = getPtY(initialBal);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(chartX + padLeft, baseLineY);
    ctx.lineTo(chartX + chartW - padRight, baseLineY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#d4af37';
    ctx.fillText('初始基準線', chartX + padLeft + 6, baseLineY - 6);

    // 繪製走向曲線
    const isProfit = finalBal >= initialBal;
    const strokeCol = isProfit ? '#4ade80' : '#f87171';
    const fillColTop = isProfit ? 'rgba(74, 222, 128, 0.25)' : 'rgba(248, 113, 113, 0.25)';

    ctx.beginPath();
    ctx.moveTo(getPtX(0), getPtY(initialBal));
    logs.forEach((l, idx) => {
        ctx.lineTo(getPtX(idx + 1), getPtY(l.finalBalance));
    });

    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 面積填色
    const grad = ctx.createLinearGradient(0, chartY + padTop, 0, chartY + chartH - padBottom);
    grad.addColorStop(0, fillColTop);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.lineTo(getPtX(logs.length), chartY + chartH - padBottom);
    ctx.lineTo(getPtX(0), chartY + chartH - padBottom);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // 繪製每個關鍵數據節點圓點
    logs.forEach((l, idx) => {
        const px = getPtX(idx + 1);
        const py = getPtY(l.finalBalance);
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fillStyle = l.netChange >= 0 ? '#4ade80' : '#f87171';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    });

    // 底部局數標示
    ctx.fillStyle = '#aaa';
    ctx.fillText('初始', chartX + padLeft - 10, chartY + chartH - 12);
    ctx.fillText(`第 ${logs.length} 局`, chartX + chartW - padRight - 40, chartY + chartH - 12);

    // 觸發下載或手機端儲存
    const image = reportCanvas.toDataURL('image/png');
    triggerDownloadOrShare(image, `player_baccarat_report_${logs.length}_rounds.png`, 'image/png');
}

// ------------------------------------------
// 5.2 破產偵測、音效合成 (Web Audio API) 與彈窗控制
// ------------------------------------------

// 使用瀏覽器原生 Web Audio API 合成經典電玩失敗低沉和弦音效（無需外部音檔依賴，即開即播）
function playBankruptcySound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        // 模擬經典三段式哀傷下墜音階 (Eb3 -> C3 -> G2)
        const notes = [
            { freq: 155.56, time: 0, duration: 0.35 },    // Eb3
            { freq: 130.81, time: 0.35, duration: 0.4 },  // C3
            { freq: 98.00,  time: 0.75, duration: 0.8 }   // G2 (低沉尾韻)
        ];

        notes.forEach(n => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sawtooth'; // 鋸齒波帶有復古破音失落感
            osc.frequency.setValueAtTime(n.freq, ctx.currentTime + n.time);

            // 音量包絡線 (Fade Out)
            gain.gain.setValueAtTime(0.3, ctx.currentTime + n.time);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.time + n.duration);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(ctx.currentTime + n.time);
            osc.stop(ctx.currentTime + n.time + n.duration);
        });
    } catch (e) {
        console.warn('AudioContext failed:', e);
    }
}

function checkBankruptcy() {
    const minBetRequired = 10;
    if (gameState.balance < minBetRequired) {
        setTimeout(() => {
            showBankruptcyModal();
        }, 800);
    }
}

function showBankruptcyModal() {
    playBankruptcySound();
    if (elBankruptcyModal) {
        elBankruptcyModal.style.display = 'flex';
    }
}

function hideBankruptcyModal() {
    if (elBankruptcyModal) {
        elBankruptcyModal.style.display = 'none';
    }
}

// 徹底重新開始遊戲（重置資產、局數、路單、實戰紀錄與牌桌狀態）
function restartGameCompletely() {
    gameState.balance = 1000;
    gameState.currentRoundNum = 0;
    gameState.roadHistory = [];
    gameState.playerGameLogs = [];
    gameState.deck = createShoe(8); // 重新洗 8 副牌

    // 清空歷史路單
    renderRoadmap();

    // 清空玩家實戰紀錄表格並禁用匯出按鈕
    renderPlayerHistoryTable();
    if (elExportPlayerLogCsvBtn) elExportPlayerLogCsvBtn.disabled = true;
    if (elExportPlayerChartPngBtn) elExportPlayerChartPngBtn.disabled = true;

    // 清空賭桌牌局狀態
    resetTableForNextRound();

    updateUI();
    showStatus('已重新開始！獲得初始資金 $1,000，所有歷史紀錄已重置');
}

// 啟動遊戲
function initGame() {
    try {
        gameState.deck = createShoe(8);
        setupControls();
        setupPlayerHistoryEvents();
        setupSimulation();
        updateUI();
        console.log('Royal Baccarat initialized successfully');
    } catch (err) {
        console.error('Initialization error:', err);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}

// ==========================================
// 6. 蒙地卡羅模擬（馬丁格爾倍投）與資產圖表
// ==========================================

let simResultsData = null; // 儲存最近一次模擬紀錄供 CSV / 圖表匯出

// 單局極速百家樂開牌演算法（專為數萬次快速運算優化）
function simulateOneRound() {
    const drawFastCard = () => {
        const raw = Math.floor(Math.random() * 13) + 1; // 1~13
        return raw >= 10 ? 0 : raw;
    };

    const p1 = drawFastCard();
    const b1 = drawFastCard();
    const p2 = drawFastCard();
    const b2 = drawFastCard();

    let pScore = (p1 + p2) % 10;
    let bScore = (b1 + b2) % 10;

    // 天牌 Natural 8 or 9
    if (pScore >= 8 || bScore >= 8) {
        return pScore > bScore ? 'P' : bScore > pScore ? 'B' : 'T';
    }

    // 閒家補牌
    let p3 = null;
    if (pScore <= 5) {
        p3 = drawFastCard();
        pScore = (pScore + p3) % 10;
    }

    // 莊家補牌
    let bDraws = false;
    if (p3 === null) {
        if (bScore <= 5) bDraws = true;
    } else {
        if (bScore <= 2) bDraws = true;
        else if (bScore === 3 && p3 !== 8) bDraws = true;
        else if (bScore === 4 && [2, 3, 4, 5, 6, 7].includes(p3)) bDraws = true;
        else if (bScore === 5 && [4, 5, 6, 7].includes(p3)) bDraws = true;
        else if (bScore === 6 && [6, 7].includes(p3)) bDraws = true;
    }

    if (bDraws) {
        const b3 = drawFastCard();
        bScore = (bScore + b3) % 10;
    }

    return pScore > bScore ? 'P' : bScore > pScore ? 'B' : 'T';
}

function setupSimulation() {
    const runBtn = document.getElementById('runSimBtn');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const exportChartBtn = document.getElementById('exportChartBtn');
    const noLimitCheckbox = document.getElementById('simNoLimit');
    const maxTableBetInput = document.getElementById('simMaxTableBet');

    if (!runBtn) return;

    if (noLimitCheckbox && maxTableBetInput) {
        noLimitCheckbox.addEventListener('change', () => {
            maxTableBetInput.disabled = noLimitCheckbox.checked;
            if (noLimitCheckbox.checked) {
                maxTableBetInput.style.opacity = '0.4';
            } else {
                maxTableBetInput.style.opacity = '1';
            }
        });
    }

    runBtn.addEventListener('click', runMonteCarloSimulation);
    exportCsvBtn.addEventListener('click', exportSimulationCSV);
    exportChartBtn.addEventListener('click', exportChartPNG);
}

function runMonteCarloSimulation() {
    const initialBalance = parseFloat(document.getElementById('simStartingBalance').value) || 10000;
    const baseBet = parseFloat(document.getElementById('simBaseBet').value) || 100;
    const isNoLimit = document.getElementById('simNoLimit') ? document.getElementById('simNoLimit').checked : false;
    const maxTableBet = isNoLimit ? Infinity : (parseFloat(document.getElementById('simMaxTableBet').value) || 5000); // 賭桌下注上限
    const target = document.getElementById('simBetTarget').value; // 'player' or 'banker'
    const targetResult = target === 'player' ? 'P' : 'B';
    const totalRounds = parseInt(document.getElementById('simRounds').value, 10) || 10000;

    let balance = initialBalance;
    let currentBet = baseBet;
    let peakBalance = initialBalance;
    let maxBet = baseBet;
    let bustRound = null;
    let currentLossStreak = 0;
    let maxLossStreak = 0;
    let tableLimitHitCount = 0; // 觸及賭桌上限次數

    // 取樣紀錄資金走向（最多保留 1,000 個採樣點繪製圖表）
    const step = Math.max(1, Math.floor(totalRounds / 1000));
    const trajectory = [{ round: 0, balance: initialBalance, bet: baseBet, result: 'START' }];

    for (let r = 1; r <= totalRounds; r++) {
        if (balance <= 0) {
            if (bustRound === null) bustRound = r;
            if (r % step === 0 || r === totalRounds) {
                trajectory.push({ round: r, balance: 0, bet: 0, result: 'BUST' });
            }
            continue;
        }

        // 賭桌上限限制：若非無上限模式，且下注額超過 maxTableBet
        let desiredBet = currentBet;
        if (!isNoLimit && desiredBet > maxTableBet) {
            desiredBet = maxTableBet;
            tableLimitHitCount++;
        }
        const actualBet = Math.min(desiredBet, balance);
        if (actualBet > maxBet) maxBet = actualBet;

        balance -= actualBet;
        const outcome = simulateOneRound();

        if (outcome === targetResult) {
            currentLossStreak = 0;
            if (target === 'player') {
                balance += actualBet * 2; // 1:1
            } else {
                balance += actualBet + (actualBet * 0.95); // 莊家 5% 抽水
            }
            currentBet = baseBet;
        } else if (outcome === 'T') {
            balance += actualBet; // 和局退本
        } else {
            currentLossStreak++;
            if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
            currentBet = actualBet * 2; // 馬丁格爾翻倍 (若下局超過上限將受限)
        }

        if (balance > peakBalance) peakBalance = balance;

        if (r % step === 0 || r === totalRounds) {
            trajectory.push({ round: r, balance: Math.round(balance), bet: actualBet, result: outcome });
        }
    }

    simResultsData = {
        initialBalance,
        baseBet,
        isNoLimit,
        maxTableBet: isNoLimit ? '無上限 (No Limit)' : maxTableBet,
        tableLimitHitCount,
        target: target === 'player' ? '閒家 (Player 1:1)' : '莊家 (Banker 1:0.95)',
        finalBalance: Math.round(balance),
        netProfit: Math.round(balance - initialBalance),
        peakBalance: Math.round(peakBalance),
        maxBet: Math.round(maxBet),
        bustRound,
        maxLossStreak,
        totalRounds,
        trajectory
    };

    updateSimStatsUI(simResultsData);
    drawBankrollChart(trajectory, initialBalance);

    document.getElementById('exportCsvBtn').disabled = false;
    document.getElementById('exportChartBtn').disabled = false;
}

function updateSimStatsUI(data) {
    document.getElementById('simStatsGrid').style.display = 'grid';
    document.getElementById('chartPlaceholder').style.display = 'none';

    document.getElementById('statFinalBal').textContent = `$${data.finalBalance.toLocaleString()}`;

    const netEl = document.getElementById('statNetProfit');
    netEl.textContent = `${data.netProfit >= 0 ? '+' : ''}$${data.netProfit.toLocaleString()}`;
    netEl.className = `stat-val ${data.netProfit >= 0 ? 'profit-pos' : 'profit-neg'}`;

    document.getElementById('statBustRound').textContent = data.bustRound ? `第 ${data.bustRound.toLocaleString()} 局` : '未破產';
    document.getElementById('statMaxLossStreak').textContent = `${data.maxLossStreak} 連敗`;
    document.getElementById('statPeakBal').textContent = `$${data.peakBalance.toLocaleString()}`;
    document.getElementById('statMaxBet').textContent = `$${data.maxBet.toLocaleString()}`;
}

// ------------------------------------------
// 7. HTML5 Canvas 資金曲線繪製
// ------------------------------------------
function drawBankrollChart(trajectory, initialBalance) {
    const canvas = document.getElementById('bankrollChart');
    const ctx = canvas.getContext('2d');

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const padLeft = 70;
    const padRight = 20;
    const padTop = 30;
    const padBottom = 35;

    ctx.clearRect(0, 0, w, h);

    let maxBal = initialBalance;
    let minBal = 0;
    trajectory.forEach(pt => {
        if (pt.balance > maxBal) maxBal = pt.balance;
        if (pt.balance < minBal) minBal = pt.balance;
    });
    maxBal = Math.max(maxBal, initialBalance * 1.2);
    const balRange = (maxBal - minBal) || 1;

    const getX = round => padLeft + (round / trajectory[trajectory.length - 1].round) * (w - padLeft - padRight);
    const getY = bal => padTop + (1 - (bal - minBal) / balRange) * (h - padTop - padBottom);

    // 格線與刻度
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    ctx.lineWidth = 1;

    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
        const val = minBal + (balRange / yTicks) * i;
        const y = getY(val);
        ctx.beginPath();
        ctx.moveTo(padLeft, y);
        ctx.lineTo(w - padRight, y);
        ctx.stroke();
        ctx.fillText(`$${Math.round(val).toLocaleString()}`, 10, y + 4);
    }

    // 初始本金基準線
    const initY = getY(initialBalance);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padLeft, initY);
    ctx.lineTo(w - padRight, initY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#d4af37';
    ctx.fillText('初始基準線', padLeft + 6, initY - 6);

    // 資金走向曲線
    const isFinalProfit = trajectory[trajectory.length - 1].balance >= initialBalance;
    const strokeColor = isFinalProfit ? '#4ade80' : '#f87171';
    const fillColorTop = isFinalProfit ? 'rgba(74, 222, 128, 0.25)' : 'rgba(248, 113, 113, 0.25)';

    ctx.beginPath();
    ctx.moveTo(getX(trajectory[0].round), getY(trajectory[0].balance));
    for (let i = 1; i < trajectory.length; i++) {
        ctx.lineTo(getX(trajectory[i].round), getY(trajectory[i].balance));
    }

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // 面積漸層
    const gradient = ctx.createLinearGradient(0, padTop, 0, h - padBottom);
    gradient.addColorStop(0, fillColorTop);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.lineTo(getX(trajectory[trajectory.length - 1].round), h - padBottom);
    ctx.lineTo(getX(trajectory[0].round), h - padBottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // X 軸局數標註
    ctx.fillStyle = '#aaa';
    ctx.fillText('第 0 局', padLeft, h - 10);
    ctx.fillText(`第 ${trajectory[trajectory.length - 1].round.toLocaleString()} 局`, w - padRight - 80, h - 10);
}

// ------------------------------------------
// 8. 匯出完整報表（含參數、統計指標、圖表）
// ------------------------------------------
function exportSimulationCSV() {
    if (!simResultsData) return;
    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';

    // 1. 策略設定與參數
    csvContent += '【蒙地卡羅馬丁格爾倍投模擬分析報告】\n';
    csvContent += `初始本金,$${simResultsData.initialBalance}\n`;
    csvContent += `基礎起注,$${simResultsData.baseBet}\n`;
    csvContent += `賭桌下注上限,$${simResultsData.maxTableBet}\n`;
    csvContent += `觸碰上限次數,${simResultsData.tableLimitHitCount} 次\n`;
    csvContent += `下注目標,${simResultsData.target}\n`;
    csvContent += `模擬總局數,${simResultsData.totalRounds}\n\n`;

    // 2. 核心統計指標
    csvContent += '【統計數據指標】\n';
    csvContent += `最終資產,$${simResultsData.finalBalance}\n`;
    csvContent += `淨利 / 淨損,${simResultsData.netProfit >= 0 ? '+' : ''}$${simResultsData.netProfit}\n`;
    csvContent += `破產局數,${simResultsData.bustRound ? '第 ' + simResultsData.bustRound + ' 局' : '未破產'}\n`;
    csvContent += `最大連續落敗,${simResultsData.maxLossStreak} 連敗\n`;
    csvContent += `資產峰值,$${simResultsData.peakBalance}\n`;
    csvContent += `最高單注下注,$${simResultsData.maxBet}\n\n`;

    // 3. 局數資金走向明細
    csvContent += '【局數資金詳細走向 (Trajectory)】\n';
    csvContent += 'Round,Balance,BetAmount,Outcome\n';
    simResultsData.trajectory.forEach(row => {
        csvContent += `${row.round},${row.balance},${row.bet},${row.result}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    triggerDownloadOrShare(url, `baccarat_martingale_report_${simResultsData.totalRounds}_rounds.csv`, 'text/csv');
}

function exportChartPNG() {
    if (!simResultsData) return;
    const chartCanvas = document.getElementById('bankrollChart');

    // 建立複合報告用高解析度 Canvas
    const reportCanvas = document.createElement('canvas');
    const dpr = 2; // 超清輸出
    const baseW = 1000;
    const baseH = 680;
    reportCanvas.width = baseW * dpr;
    reportCanvas.height = baseH * dpr;
    const ctx = reportCanvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // 1. 深色質感背景
    ctx.fillStyle = '#0a140f';
    ctx.fillRect(0, 0, baseW, baseH);

    // 外框裝飾
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, baseW - 20, baseH - 20);

    // 2. 標題區
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 24px -apple-system, sans-serif';
    ctx.fillText('ROYAL BACCARAT 蒙地卡羅模擬報告', 35, 48);

    ctx.fillStyle = '#888';
    ctx.font = '13px -apple-system, sans-serif';
    ctx.fillText('策略：馬丁格爾倍投法 (Martingale System) 連續模擬', 35, 72);

    // 3. 參數列橫幅
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(35, 88, baseW - 70, 36);
    ctx.fillStyle = '#ddd';
    ctx.font = '13px -apple-system, sans-serif';
    const limitDisplay = simResultsData.isNoLimit ? '無上限' : `$${simResultsData.maxTableBet.toLocaleString()} (觸及${simResultsData.tableLimitHitCount}次)`;
    const paramText = `初始本金: $${simResultsData.initialBalance.toLocaleString()}  |  起注: $${simResultsData.baseBet.toLocaleString()}  |  賭桌上限: ${limitDisplay}  |  目標: ${simResultsData.target}  |  ${simResultsData.totalRounds.toLocaleString()}局`;
    ctx.fillText(paramText, 50, 111);

    // 4. 六大指標卡片 (2x3 或 1x6 排列)
    const stats = [
        { label: '最終資產 (Final Balance)', val: `$${simResultsData.finalBalance.toLocaleString()}`, color: '#fff' },
        { label: '淨利 / 淨損 (Net Profit)', val: `${simResultsData.netProfit >= 0 ? '+' : ''}$${simResultsData.netProfit.toLocaleString()}`, color: simResultsData.netProfit >= 0 ? '#4ade80' : '#f87171' },
        { label: '破產狀態 (Bust At)', val: simResultsData.bustRound ? `第 ${simResultsData.bustRound.toLocaleString()} 局` : '未破產', color: simResultsData.bustRound ? '#f87171' : '#4ade80' },
        { label: '最大連續落敗 (Max Loss)', val: `${simResultsData.maxLossStreak} 連敗`, color: '#fff' },
        { label: '資產峰值 (Peak Bankroll)', val: `$${simResultsData.peakBalance.toLocaleString()}`, color: '#ffd700' },
        { label: '最高單注 (Max Bet)', val: `$${simResultsData.maxBet.toLocaleString()}`, color: '#f59e0b' }
    ];

    const cardW = (baseW - 70 - (stats.length - 1) * 10) / stats.length;
    stats.forEach((st, idx) => {
        const x = 35 + idx * (cardW + 10);
        const y = 136;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(x, y, cardW, 64);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cardW, 64);

        ctx.fillStyle = '#999';
        ctx.font = '10px -apple-system, sans-serif';
        ctx.fillText(st.label, x + 8, y + 20);

        ctx.fillStyle = st.color;
        ctx.font = 'bold 15px -apple-system, sans-serif';
        ctx.fillText(st.val, x + 8, y + 48);
    });

    // 5. 繪製資金走向圖表至報告 Canvas
    const chartY = 215;
    const chartH = 430;
    ctx.drawImage(chartCanvas, 35, chartY, baseW - 70, chartH);

    // 6. 觸發圖片下載或手機端儲存
    const image = reportCanvas.toDataURL('image/png');
    triggerDownloadOrShare(image, `baccarat_full_report_${simResultsData.totalRounds}_rounds.png`, 'image/png');
}


