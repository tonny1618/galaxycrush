/**
 * PARTIE 1 : ÉTAT GLOBAL ET SAUVEGARDE
 */
const SAVE_KEY = 'galaxy_crush_v2_save';
let unlockedLevel = parseInt(localStorage.getItem(SAVE_KEY)) || 1;
let currentLevel = {};

/**
 * PARTIE 2 : SCÈNE DE MENU
 */
class MenuScene extends Phaser.Scene {
    constructor() { super('MenuScene'); this.currentSector = 0; }
    preload() { this.load.image('background', 'img/fond.png'); }
    create() {
        this.cameras.main.fadeIn(500);
        unlockedLevel = parseInt(localStorage.getItem(SAVE_KEY)) || 1;
        this.currentSector = Math.floor((unlockedLevel - 1) / 20);
        this.drawMap();
    }
    drawMap() {
        this.children.removeAll();
        this.add.image(540, 960, 'background').setDisplaySize(1080, 1920).setAlpha(0.6);
        this.add.text(540, 120, 'GALAXY CRUSH', { fontFamily: 'Arial Black', fontSize: '90px', fill: '#fff' }).setOrigin(0.5);
        this.add.text(540, 220, `SECTEUR ${this.currentSector + 1}`, { fontFamily: 'Arial Black', fontSize: '50px', fill: '#f1c40f' }).setOrigin(0.5);
        const sectorLevels = levelsData.filter(l => l.page === this.currentSector);
        sectorLevels.forEach(lvl => {
            const isLocked = lvl.id > unlockedLevel;
            const color = isLocked ? 0x7f8c8d : 0xf1c40f;
            const container = this.add.container(lvl.x, lvl.y);
            const circle = this.add.circle(0, 0, 80, color).setStrokeStyle(10, 0xffffff);
            const txt = this.add.text(0, 0, isLocked ? '🔒' : lvl.id, { fontFamily: 'Arial Black', fontSize: '50px', fill: '#2c3e50' }).setOrigin(0.5);
            container.add([circle, txt]);
            if (!isLocked) circle.setInteractive().on('pointerdown', () => {
                this.cameras.main.fadeOut(500);
                this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameScene', { level: lvl }));
            });
        });
        if (this.currentSector > 0) this.add.text(200, 1750, '◀ PRÉC.', { fontFamily: 'Arial Black', fontSize: '50px', fill: '#fff' }).setOrigin(0.5).setInteractive().on('pointerdown', () => { this.currentSector--; this.drawMap(); });
        if (this.currentSector < 4) this.add.text(880, 1750, 'SUIV. ▶', { fontFamily: 'Arial Black', fontSize: '50px', fill: '#fff' }).setOrigin(0.5).setInteractive().on('pointerdown', () => { this.currentSector++; this.drawMap(); });
    }
}

/**
 * PARTIE 3 : SCÈNE DE JEU
 */
class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    init(data) {
        currentLevel = { ...data.level, currentAmount: 0 };
        this.grid = []; this.history = []; this.canMove = true; this.undoLeft = 3;
        this.ROWS = 8; this.COLS = 6;
        this.TILE_SIZE = 160; this.OFFSET_X = 60; this.OFFSET_Y = 400; 
    }

    preload() {
        const c = { mipmapFilter: 'LINEAR_MIPMAP_LINEAR' };
        this.load.image('ship0', 'img/shipBeige_manned.png', c);
        this.load.image('ship1', 'img/shipBlue_manned.png', c);
        this.load.image('ship2', 'img/shipGreen_manned.png', c);
        this.load.image('ship3', 'img/shipPink_manned.png', c);
        this.load.image('ship4', 'img/shipYellow_manned.png', c);
        this.load.image('bombe', 'img/bomb.png', c);
        this.load.image('star', 'img/star.png', c);
        this.load.image('rocket', 'img/rocket.png', c);
        this.load.image('bouclier', 'img/bouclier.png', c);
        this.load.image('background', 'img/fond.png');
    }

    create() {
        this.cameras.main.fadeIn(500);
        this.add.image(540, 960, 'background').setDisplaySize(1080, 1920).setDepth(-10);
        this.initGrid();
        this.createUI();
        this.input.on('pointerup', (p) => {
            if (!this.canMove || this.selectedRow === undefined) return;
            let dx = p.upX - p.downX, dy = p.upY - p.downY;
            if (Math.abs(dx) > 50 || Math.abs(dy) > 50) this.handleSwipe(dx, dy);
            this.selectedRow = undefined;
        });
    }

    initGrid() {
        for (let r = 0; r < this.ROWS; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.COLS; c++) {
                let x = this.OFFSET_X + (c * this.TILE_SIZE) + (this.TILE_SIZE / 2);
                let y = this.OFFSET_Y + (r * this.TILE_SIZE) + (this.TILE_SIZE / 2);
                this.add.graphics().fillStyle(0x000000, 0.5).fillRoundedRect(x - 75, y - 75, 150, 150, 25).setDepth(-2);
                let type; let possible = [0,1,2,3,4];
                do {
                    type = possible[Math.floor(Math.random() * possible.length)];
                    let mH = (c >= 2 && this.grid[r][c-1].type === type && this.grid[r][c-2].type === type);
                    let mV = (r >= 2 && this.grid[r-1][c].type === type && this.grid[r-2][c].type === type);
                    if (mH || mV) possible = possible.filter(t => t !== type); else break;
                } while (possible.length > 0);
                let s = this.add.image(x, y, 'ship' + type).setDisplaySize(130, 130).setInteractive().setDepth(1);
                s.gridRow = r; s.gridCol = c;
                this.grid[r][c] = { type, sprite: s, typePowerUp: null, shield: false, shieldSprite: null };
                s.on('pointerdown', () => { if (this.canMove) { this.selectedRow = s.gridRow; this.selectedCol = s.gridCol; }});
                if (currentLevel.shieldChance && Math.random() < currentLevel.shieldChance) {
                    this.grid[r][c].shield = true;
                    this.grid[r][c].shieldSprite = this.add.image(x, y, 'bouclier').setDisplaySize(160, 160).setAlpha(0.8).setDepth(2);
                }
            }
        }
    }

    createUI() {
        this.add.graphics().fillStyle(0x000000, 0.7).fillRoundedRect(50, 40, 980, 320, 40);
        this.add.text(540, 100, `NIVEAU ${currentLevel.id}`, { fontFamily: 'Arial Black', fontSize: '50px', fill: '#f1c40f' }).setOrigin(0.5);
        this.movesText = this.add.text(250, 230, `COUPS\n${currentLevel.moves}`, { fontFamily: 'Arial Black', fontSize: '60px', fill: '#fff', align: 'center' }).setOrigin(0.5);
        this.add.image(540, 230, 'ship' + currentLevel.targetColor).setDisplaySize(120, 120);
        this.targetText = this.add.text(830, 230, `OBJ.\n0/${currentLevel.targetAmount}`, { fontFamily: 'Arial Black', fontSize: '60px', fill: '#fff', align: 'center' }).setOrigin(0.5);
        
        this.undoBtn = this.add.container(540, 1750);
        this.undoBtn.add([this.add.graphics().fillStyle(0x3498db).fillRoundedRect(-250, -60, 500, 120, 30), this.undoText = this.add.text(0, 0, `↩ ANNULER (${this.undoLeft}/3)`, { fontFamily: 'Arial Black', fontSize: '45px', fill: '#fff' }).setOrigin(0.5)]);
        this.undoBtn.setInteractive(new Phaser.Geom.Rectangle(-250, -60, 500, 120), Phaser.Geom.Rectangle.Contains).on('pointerdown', () => this.undoMove());
        
        this.retryBtn = this.add.container(540, 1050).setVisible(false).setDepth(100);
        this.retryBtn.add([this.add.graphics().fillStyle(0xe67e22).fillRoundedRect(-250, -80, 500, 160, 40), this.add.text(0, 0, 'RÉESSAYER ↻', { fontFamily: 'Arial Black', fontSize: '50px', fill: '#fff' }).setOrigin(0.5)]);
        this.retryBtn.setInteractive(new Phaser.Geom.Rectangle(-250, -80, 500, 160), Phaser.Geom.Rectangle.Contains).on('pointerdown', () => this.scene.restart({ level: levelsData.find(l => l.id === currentLevel.id) }));

        this.nextBtn = this.add.container(540, 1050).setVisible(false).setDepth(100);
        this.nextBtn.add([this.add.graphics().fillStyle(0xf1c40f).fillRoundedRect(-280, -80, 560, 160, 40), this.add.text(0, 0, 'MISSION SUIVANTE ➔', { fontFamily: 'Arial Black', fontSize: '45px', fill: '#2c3e50' }).setOrigin(0.5)]);
        this.nextBtn.setInteractive(new Phaser.Geom.Rectangle(-280, -80, 560, 160), Phaser.Geom.Rectangle.Contains).on('pointerdown', () => {
            const nIdx = levelsData.findIndex(l => l.id === currentLevel.id) + 1;
            this.scene.start('GameScene', { level: levelsData[nIdx] || levelsData[0] });
        });

        this.menuBtn = this.add.container(540, 1250).setVisible(false).setDepth(100);
        this.menuBtn.add([this.add.graphics().fillStyle(0x2ecc71).fillRoundedRect(-250, -60, 500, 120, 30), this.add.text(0, 0, 'RETOUR À LA CARTE', { fontFamily: 'Arial Black', fontSize: '36px', fill: '#fff' }).setOrigin(0.5)]);
        this.menuBtn.setInteractive(new Phaser.Geom.Rectangle(-250, -60, 500, 120), Phaser.Geom.Rectangle.Contains).on('pointerdown', () => this.scene.start('MenuScene'));
        this.statusText = this.add.text(540, 850, '', { fontFamily: 'Arial Black', fontSize: '110px', fill: '#f1c40f', stroke: '#000', strokeThickness: 15 }).setOrigin(0.5).setDepth(110);
    }

    handleSwipe(dx, dy) {
        let r1 = this.selectedRow, c1 = this.selectedCol;
        let r2 = r1, c2 = c1;
        if (Math.abs(dx) > Math.abs(dy)) { if (dx > 0) c2++; else c2--; } else { if (dy > 0) r2++; else r2--; }
        if (r2 >= 0 && r2 < this.ROWS && c2 >= 0 && c2 < this.COLS) {
            if (this.grid[r1][c1].shield || this.grid[r2][c2].shield) { this.cameras.main.shake(100, 0.005); return; }
            this.swapBlocks(r1, c1, r2, c2);
        }
    }

    swapBlocks(r1, c1, r2, c2) {
        this.canMove = false; this.saveState();
        let b1 = this.grid[r1][c1], b2 = this.grid[r2][c2];
        currentLevel.moves--; this.updateUI();
        this.grid[r1][c1] = b2; this.grid[r2][c2] = b1;
        b1.sprite.gridRow = r2; b1.sprite.gridCol = c2;
        b2.sprite.gridRow = r1; b2.sprite.gridCol = c1;
        const getX = (c) => this.OFFSET_X + (c * this.TILE_SIZE) + (this.TILE_SIZE / 2);
        const getY = (r) => this.OFFSET_Y + (r * this.TILE_SIZE) + (this.TILE_SIZE / 2);
        this.tweens.add({ targets: b1.sprite, x: getX(c2), y: getY(r2), duration: 250 });
        this.tweens.add({ targets: b2.sprite, x: getX(c1), y: getY(r1), duration: 250, onComplete: () => {
            if (b1.typePowerUp === 'star' || b2.typePowerUp === 'star') {
                let targetCol = (b1.typePowerUp === 'star') ? b2.type : b1.type;
                let starPos = (b1.typePowerUp === 'star') ? {r:r2, c:c2} : {r:r1, c:c1};
                this.triggerPowerUp(starPos.r, starPos.c, targetCol); 
                this.time.delayedCall(500, () => this.applyGravity());
                return;
            }
            let cl = this.checkMatches();
            if (b1.typePowerUp || b2.typePowerUp || cl.length > 0) {
                if (b1.typePowerUp) this.triggerPowerUp(r2, c2);
                if (b2.typePowerUp) this.triggerPowerUp(r1, c1);
                if (cl.length > 0) this.destroyMatches(cl);
                else this.time.delayedCall(500, () => this.applyGravity());
            } else {
                currentLevel.moves++; this.updateUI(); this.history.pop();
                this.grid[r1][c1] = b1; this.grid[r2][c2] = b2;
                b1.sprite.gridRow = r1; b1.sprite.gridCol = c1; b2.sprite.gridRow = r2; b2.sprite.gridCol = c2;
                this.tweens.add({ targets: b1.sprite, x: getX(c1), y: getY(r1), duration: 200 });
                this.tweens.add({ targets: b2.sprite, x: getX(c2), y: getY(r2), duration: 200, onComplete: () => this.canMove = true });
            }
        }});
    }

    checkMatches() {
        let hLines = [], vLines = [];
        for (let r = 0; r < this.ROWS; r++) {
            let len = 1;
            for (let c = 0; c < this.COLS; c++) {
                if (this.grid[r][c]?.type >= 0 && this.grid[r][c]?.type === this.grid[r][c+1]?.type) len++;
                else { if (len >= 3) { let l = []; for(let i=0; i<len; i++) l.push({r:r, c:c-i}); hLines.push(l); } len = 1; }
            }
        }
        for (let c = 0; c < this.COLS; c++) {
            let len = 1;
            for (let r = 0; r < this.ROWS; r++) {
                if (this.grid[r][c]?.type >= 0 && this.grid[r][c]?.type === this.grid[r+1]?.[c]?.type) len++;
                else { if (len >= 3) { let l = []; for(let i=0; i<len; i++) l.push({r:r-i, c:c}); vLines.push(l); } len = 1; }
            }
        }
        let all = [...hLines, ...vLines], clusters = [];
        while (all.length > 0) {
            let cur = all.pop(), merged = false;
            for (let i=0; i<clusters.length; i++) { if (cur.some(c1 => clusters[i].lines.some(line => line.some(c2 => c1.r === c2.r && c1.c === c2.c)))) { clusters[i].lines.push(cur); merged = true; break; } }
            if (!merged) clusters.push({ lines: [cur] });
        }
        let results = [];
        clusters.forEach(cl => {
            let p = null, cells = [], hasH = false, hasV = false, max = 0;
            cl.lines.forEach(line => {
                if (line.length > max) max = line.length;
                if (line[0].r === line[1].r) hasH = true; else hasV = true;
                line.forEach(pos => { if (!cells.some(c => c.r === pos.r && c.c === pos.c)) cells.push(pos); });
            });
            if (max >= 5) p = 'star'; else if (hasH && hasV) p = 'bombe'; else if (max === 4) p = hasH ? 'rocket_v' : 'rocket_h';
            results.push({ cells, powerUp: p });
        });
        return results;
    }

    destroyMatches(clusters) {
        clusters.forEach(cl => {
            let spawnPos = cl.cells[0];
            if (cl.powerUp) {
                cl.cells.forEach(p => {
                    let cell = this.grid[p.r][p.c];
                    if (p.r === spawnPos.r && p.c === spawnPos.c) {
                        cell.typePowerUp = cl.powerUp; cell.type = -1;
                        let oldX = cell.sprite.x, oldY = cell.sprite.y; cell.sprite.destroy();
                        let key = cl.powerUp.includes('rocket') ? 'rocket' : cl.powerUp;
                        cell.sprite = this.add.image(oldX, oldY, key).setDisplaySize(130, 130).setInteractive().setDepth(1);
                        if (cl.powerUp === 'rocket_h') cell.sprite.setAngle(90);
                        cell.sprite.gridRow = p.r; cell.sprite.gridCol = p.c;
                        cell.sprite.on('pointerdown', () => { if(this.canMove) { this.selectedRow = cell.sprite.gridRow; this.selectedCol = cell.sprite.gridCol; }});
                    } else this.destroyCell(p.r, p.c, 0, false);
                });
            } else cl.cells.forEach(p => this.destroyCell(p.r, p.c, 0, false));
        });
        this.time.delayedCall(400, () => this.applyGravity());
    }

    destroyCell(r, c, delay = 0, isPowerUp = false) {
        if (r < 0 || r >= this.ROWS || c < 0 || c >= this.COLS) return;
        let cell = this.grid[r][c]; if (!cell) return;

        if (cell.shield) {
            if (isPowerUp) {
                cell.shield = false;
                this.tweens.add({ targets: cell.shieldSprite, alpha: 0, scale: 1.8, duration: 400, onComplete: () => cell.shieldSprite.destroy() });
                this.cameras.main.shake(150, 0.01);
            }
            return;
        }

        // Effet de vol si couleur cible
        if (cell.type === currentLevel.targetColor) {
            this.collectEffect(cell.sprite.x, cell.sprite.y, cell.type);
        }

        if (cell.typePowerUp) {
            this.triggerPowerUp(r, c); // Déclenchement immédiat
        } else {
            this.grid[r][c] = null;
            this.tweens.add({ targets: cell.sprite, alpha: 0, scale: 0, duration: 300, delay: delay, onComplete: () => cell.sprite.destroy() });
        }
    }

    collectEffect(startX, startY, type) {
        let ghost = this.add.image(startX, startY, 'ship' + type).setDisplaySize(130, 130).setDepth(20);
        this.tweens.add({ targets: ghost, x: 830, y: 230, scale: 0.4, duration: 600, ease: 'Back.easeIn', onComplete: () => { ghost.destroy(); currentLevel.currentAmount++; this.updateUI(); this.tweens.add({ targets: this.targetText, scale: 1.3, duration: 100, yoyo: true }); } });
    }

    triggerPowerUp(r, c, colorTarget = null) {
        let cell = this.grid[r][c]; 
        if (!cell || !cell.typePowerUp) return;
        
        let p = cell.typePowerUp;
        let sprite = cell.sprite;
        this.grid[r][c] = null; // Libère la case AVANT l'explosion pour éviter les boucles

        this.tweens.add({ targets: sprite, scale: 2, alpha: 0, duration: 300, onComplete: () => sprite.destroy() });
        
        if (p === 'bombe') {
            for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) this.destroyCell(r + i, c + j, 100, true);
        } else if (p.includes('rocket')) {
            if (p === 'rocket_h') { // Détruit la ligne
                for (let i = 0; i < this.COLS; i++) this.destroyCell(r, i, 60, true);
            } else { // Détruit la colonne
                for (let i = 0; i < this.ROWS; i++) this.destroyCell(i, c, 60, true);
            }
        } else if (p === 'star') {
            let tc = (colorTarget !== null) ? colorTarget : Phaser.Math.Between(0, 4);
            this.cameras.main.shake(200, 0.01);
            for(let rr=0; rr<this.ROWS; rr++) for(let cc=0; cc<this.COLS; cc++) {
                if(this.grid[rr][cc]?.type === tc) this.destroyCell(rr, cc, Phaser.Math.Between(50, 400), true);
            }
        }
    }

    applyGravity() {
        for (let c = 0; c < this.COLS; c++) {
            for (let r = this.ROWS - 1; r >= 0; r--) {
                if (this.grid[r][c] === null) {
                    for (let k = r - 1; k >= 0; k--) {
                        if (this.grid[k][c] !== null) {
                            this.grid[r][c] = this.grid[k][c]; this.grid[k][c] = null;
                            this.grid[r][c].sprite.gridRow = r;
                            let tY = this.OFFSET_Y + (r * this.TILE_SIZE) + (this.TILE_SIZE / 2);
                            if (this.grid[r][c].shieldSprite) this.tweens.add({ targets: this.grid[r][c].shieldSprite, y: tY, duration: 400 });
                            this.tweens.add({ targets: this.grid[r][c].sprite, y: tY, duration: 400 });
                            break;
                        }
                    }
                }
            }
        }
        for (let c = 0; c < this.COLS; c++) {
            for (let r = 0; r < this.ROWS; r++) {
                if (this.grid[r][c] === null) {
                    let t = Phaser.Math.Between(0, 4);
                    let s = this.add.image(this.OFFSET_X + (c * this.TILE_SIZE) + (this.TILE_SIZE/2), this.OFFSET_Y - 200, 'ship'+t).setDisplaySize(130, 130).setInteractive();
                    s.gridRow = r; s.gridCol = c;
                    this.grid[r][c] = { type: t, sprite: s, typePowerUp: null, shield: false, shieldSprite: null };
                    this.tweens.add({ targets: s, y: this.OFFSET_Y + (r * this.TILE_SIZE) + (this.TILE_SIZE/2), duration: 500 });
                    s.on('pointerdown', () => { if (this.canMove) { this.selectedRow = s.gridRow; this.selectedCol = s.gridCol; }});
                }
            }
        }
        this.time.delayedCall(600, () => { let cl = this.checkMatches(); if (cl.length > 0) this.destroyMatches(cl); else { this.canMove = true; this.updateUI(); } });
    }

    saveState() {
        let state = [];
        for (let r = 0; r < this.ROWS; r++) {
            state[r] = [];
            for (let c = 0; c < this.COLS; c++) {
                let cell = this.grid[r][c];
                state[r][c] = cell ? { type: cell.type, typePowerUp: cell.typePowerUp, shield: cell.shield } : null;
            }
        }
        this.history.push({ grid: state, moves: currentLevel.moves, amount: currentLevel.currentAmount });
        if (this.history.length > 3) this.history.shift();
    }

    undoMove() {
        if (this.undoLeft <= 0 || this.history.length === 0 || !this.canMove) return;
        this.undoLeft--; this.undoText.setText(`↩ ANNULER (${this.undoLeft}/3)`);
        let last = this.history.pop();
        currentLevel.moves = last.moves; currentLevel.currentAmount = last.amount;
        this.updateUI();
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if (this.grid[r][c]) { if (this.grid[r][c].sprite) this.grid[r][c].sprite.destroy(); if (this.grid[r][c].shieldSprite) this.grid[r][c].shieldSprite.destroy(); }
                let sD = last.grid[r][c];
                if (sD) {
                    let x = this.OFFSET_X + (c * this.TILE_SIZE) + (this.TILE_SIZE / 2);
                    let y = this.OFFSET_Y + (r * this.TILE_SIZE) + (this.TILE_SIZE / 2);
                    let key = sD.typePowerUp ? (sD.typePowerUp.includes('rocket') ? 'rocket' : sD.typePowerUp) : 'ship' + sD.type;
                    let s = this.add.image(x, y, key).setDisplaySize(130, 130).setInteractive();
                    if (sD.typePowerUp === 'rocket_h') s.setAngle(90);
                    s.gridRow = r; s.gridCol = c;
                    this.grid[r][c] = { type: sD.type, sprite: s, typePowerUp: sD.typePowerUp, shield: sD.shield, shieldSprite: null };
                    if (sD.shield) this.grid[r][c].shieldSprite = this.add.image(x, y, 'bouclier').setDisplaySize(160, 160).setAlpha(0.8).setDepth(2);
                    s.on('pointerdown', () => { if(this.canMove) { this.selectedRow = s.gridRow; this.selectedCol = s.gridCol; }});
                } else this.grid[r][c] = null;
            }
        }
    }

    updateUI() {
        this.movesText.setText(`COUPS\n${currentLevel.moves}`);
        this.targetText.setText(`OBJ.\n${currentLevel.currentAmount}/${currentLevel.targetAmount}`);
        if (currentLevel.currentAmount >= currentLevel.targetAmount) { this.statusText.setText("MISSION RÉUSSIE !").setFill('#2ecc71'); this.nextBtn.setVisible(true); this.menuBtn.setVisible(true); this.canMove = false; localStorage.setItem(SAVE_KEY, Number(currentLevel.id) + 1); }
        else if (currentLevel.moves <= 0) { this.statusText.setText("ÉCHEC").setFill('#e74c3c'); this.retryBtn.setVisible(true); this.menuBtn.setVisible(true); this.canMove = false; }
    }
}

/**
 * CONFIGURATION
 */
const config = {
    type: Phaser.AUTO, width: 1080, height: 1920, backgroundColor: '#000',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [MenuScene, GameScene]
};
const game = new Phaser.Game(config);