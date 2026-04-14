/**
 * PARTIE 1 : ÉTAT GLOBAL ET SAUVEGARDE
 */
const SAVE_KEY = 'galaxy_crush_v2_save';
let unlockedLevel = parseInt(localStorage.getItem(SAVE_KEY)) || 1;
let currentLevel = {};

/**
 * PARTIE 2 : SCÈNE DE MENU (ADAPTATIVE)
 */
class MenuScene extends Phaser.Scene {
    constructor() { super('MenuScene'); this.currentSector = 0; }
    preload() { this.load.image('background', 'img/fond.png'); }
    
    create() {
        const { width, height } = this.cameras.main;
        const centerX = width / 2;
        this.cameras.main.fadeIn(500);
        
        unlockedLevel = parseInt(localStorage.getItem(SAVE_KEY)) || 1;
        this.currentSector = Math.floor((unlockedLevel - 1) / 20);

        // Fond plein écran parfait
        let bg = this.add.image(centerX, height / 2, 'background');
        let scale = Math.max(width / bg.width, height / bg.height);
        bg.setScale(scale).setAlpha(0.6);

        // Titres 
        this.add.text(centerX, 180, 'GALAXY CRUSH', { fontFamily: 'Arial Black', fontSize: '85px', fill: '#fff' }).setOrigin(0.5);
        this.add.text(centerX, 280, `SECTEUR ${this.currentSector + 1}`, { fontFamily: 'Arial Black', fontSize: '50px', fill: '#f1c40f' }).setOrigin(0.5);

        this.drawMap(centerX, height);
    }

    drawMap(centerX, height) {
        this.children.list.filter(c => c.type === 'Container' || (c.type === 'Text' && c.y > 500)).forEach(c => c.destroy());
        
        const sectorLevels = levelsData.filter(l => l.page === this.currentSector);
        sectorLevels.forEach(lvl => {
            const isLocked = lvl.id > unlockedLevel;
            const color = isLocked ? 0x7f8c8d : 0xf1c40f;
            
            // Adaptation des positions
            let posX = (lvl.x / 1080) * this.cameras.main.width;
            let posY = (lvl.y / 1920) * this.cameras.main.height;

            const container = this.add.container(posX, posY);
            const circle = this.add.circle(0, 0, 80, color).setStrokeStyle(10, 0xffffff);
            const txt = this.add.text(0, 0, isLocked ? '🔒' : lvl.id, { fontFamily: 'Arial Black', fontSize: '50px', fill: '#2c3e50' }).setOrigin(0.5);
            container.add([circle, txt]);

            if (!isLocked) circle.setInteractive().on('pointerdown', () => {
                this.cameras.main.fadeOut(500);
                this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameScene', { level: lvl }));
            });
        });

        // Navigation
        let navY = height - 130;
        if (this.currentSector > 0) this.add.text(centerX - 300, navY, '◀ PRÉC.', { fontFamily: 'Arial Black', fontSize: '50px', fill: '#fff' }).setOrigin(0.5).setInteractive().on('pointerdown', () => { this.currentSector--; this.scene.restart(); });
        if (this.currentSector < 4) this.add.text(centerX + 300, navY, 'SUIV. ▶', { fontFamily: 'Arial Black', fontSize: '50px', fill: '#fff' }).setOrigin(0.5).setInteractive().on('pointerdown', () => { this.currentSector++; this.scene.restart(); });
    }
}

/**
 * PARTIE 3 : SCÈNE DE JEU (MÉTHODE INFAILLIBLE POUR LE SWIPE)
 */
class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    init(data) {
        currentLevel = { ...data.level, currentAmount: 0 };
        this.grid = []; this.history = []; this.canMove = true; this.undoLeft = 3;
        this.ROWS = 8; this.COLS = 6;
        this.TILE_SIZE = 160; 
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
        const { width, height } = this.cameras.main;
        const centerX = width / 2;
        const centerY = height / 2;

        this.cameras.main.fadeIn(500);

        let bg = this.add.image(centerX, centerY, 'background');
        let scale = Math.max(width / bg.width, height / bg.height);
        bg.setScale(scale).setDepth(-10);

        // Offsets pour centrer la grille
        this.OFFSET_X = centerX - (this.COLS * this.TILE_SIZE) / 2;
        this.OFFSET_Y = centerY - (this.ROWS * this.TILE_SIZE) / 2 + 80;

        this.initGrid();
        this.createUI(width, height, centerX);

        // NOUVEAU SYSTÈME DE GESTION DU DOIGT (Mathématique au lieu de Hitbox)
        this.input.on('pointerdown', (p) => {
            if (!this.canMove) return;
            
            // On calcule mathématiquement quelle case a été touchée
            let c = Math.floor((p.downX - this.OFFSET_X) / this.TILE_SIZE);
            let r = Math.floor((p.downY - this.OFFSET_Y) / this.TILE_SIZE);
            
            // Si le doigt est bien tombé dans les limites de la grille
            if (r >= 0 && r < this.ROWS && c >= 0 && c < this.COLS) {
                this.selectedRow = r;
                this.selectedCol = c;
            } else {
                this.selectedRow = undefined;
            }
        });

        this.input.on('pointerup', (p) => {
            if (!this.canMove || this.selectedRow === undefined) return;
            
            let dx = p.upX - p.downX;
            let dy = p.upY - p.downY;
            
            // Tolérance de swipe (40 pixels minimum pour valider le mouvement)
            if (Math.abs(dx) > 40 || Math.abs(dy) > 40) {
                this.handleSwipe(dx, dy);
            }
            this.selectedRow = undefined; // On réinitialise
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
                    
                    // Ligne de sécurité 
                    if (possible.length === 0) { type = 0; break; } 
                    
                } while (possible.length > 0);
                
                let s = this.add.image(x, y, 'ship' + type).setDisplaySize(130, 130).setDepth(1);
                s.gridRow = r; s.gridCol = c;
                this.grid[r][c] = { type, sprite: s, typePowerUp: null, shield: false, shieldSprite: null };
                
                if (currentLevel.shieldChance && Math.random() < currentLevel.shieldChance) {
                    this.grid[r][c].shield = true;
                    this.grid[r][c].shieldSprite = this.add.image(x, y, 'bouclier').setDisplaySize(160, 160).setAlpha(0.8).setDepth(2);
                }
            }
        }
    }

    createUI(width, height, centerX) {
        const topMargin = 100;
        this.add.graphics().fillStyle(0x000000, 0.7).fillRoundedRect(width * 0.05, topMargin, width * 0.9, 250, 40).setDepth(10);
        this.add.text(centerX, topMargin + 50, `NIVEAU ${currentLevel.id}`, { fontFamily: 'Arial Black', fontSize: '50px', fill: '#f1c40f' }).setOrigin(0.5).setDepth(11);
        this.movesText = this.add.text(width * 0.25, topMargin + 160, `COUPS\n${currentLevel.moves}`, { fontFamily: 'Arial Black', fontSize: '60px', fill: '#fff', align: 'center' }).setOrigin(0.5).setDepth(11);
        this.targetIcon = this.add.image(centerX, topMargin + 160, 'ship' + currentLevel.targetColor).setDisplaySize(120, 120).setDepth(11);
        this.targetText = this.add.text(width * 0.75, topMargin + 160, `OBJ.\n0/${currentLevel.targetAmount}`, { fontFamily: 'Arial Black', fontSize: '60px', fill: '#fff', align: 'center' }).setOrigin(0.5).setDepth(11);

        // Footer
        this.undoBtn = this.add.container(centerX, height - 160).setDepth(100);
        this.undoBtn.add([
            this.add.graphics().fillStyle(0x3498db).fillRoundedRect(-250, -60, 500, 120, 30),
            this.undoText = this.add.text(0, 0, `↩ ANNULER (${this.undoLeft}/3)`, { fontFamily: 'Arial Black', fontSize: '45px', fill: '#fff' }).setOrigin(0.5)
        ]);
        this.undoBtn.setInteractive(new Phaser.Geom.Rectangle(-250, -60, 500, 120), Phaser.Geom.Rectangle.Contains).on('pointerdown', () => this.undoMove());

        this.statusText = this.add.text(centerX, height / 2, '', { fontFamily: 'Arial Black', fontSize: '100px', fill: '#f1c40f', stroke: '#000', strokeThickness: 15 }).setOrigin(0.5).setDepth(110).setVisible(false);
        this.retryBtn = this.createEndBtn(centerX, height / 2 + 200, 'RÉESSAYER ↻', 0xe67e22, () => this.scene.restart());
        
        // CORRECTION ICI : Fermeture correcte du bouton "Suivant"
        this.nextBtn = this.createEndBtn(centerX, height / 2 + 200, 'SUIVANT ➔', 0xf1c40f, () => {
            const nIdx = levelsData.findIndex(l => l.id === currentLevel.id) + 1;
            this.scene.start('GameScene', { level: levelsData[nIdx] || levelsData[0] });
        }); 

        // CRÉATION SÉPARÉE : Le bouton Menu est maintenant indépendant
        this.menuBtn = this.createEndBtn(centerX, height / 2 + 380, 'MENU PRINCIPAL', 0x2ecc71, () => {
            this.scene.start('MenuScene');
        });
    }

    createEndBtn(x, y, label, color, cb) {
        let b = this.add.container(x, y).setVisible(false).setDepth(100);
        b.add([this.add.graphics().fillStyle(color).fillRoundedRect(-250, -80, 500, 160, 40), this.add.text(0, 0, label, { fontFamily: 'Arial Black', fontSize: '50px', fill: '#fff' }).setOrigin(0.5)]);
        b.setInteractive(new Phaser.Geom.Rectangle(-250, -80, 500, 160), Phaser.Geom.Rectangle.Contains).on('pointerdown', cb);
        return b;
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
                this.triggerPowerUp((b1.typePowerUp === 'star' ? r2 : r1), (b1.typePowerUp === 'star' ? c2 : c1), targetCol);
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
            cl.cells.forEach(p => {
                let cell = this.grid[p.r][p.c];
                if (cl.powerUp && p.r === spawnPos.r && p.c === spawnPos.c) {
                    cell.typePowerUp = cl.powerUp; cell.type = -1;
                    let oldX = cell.sprite.x, oldY = cell.sprite.y; cell.sprite.destroy();
                    let key = cl.powerUp.includes('rocket') ? 'rocket' : cl.powerUp;
                    cell.sprite = this.add.image(oldX, oldY, key).setDisplaySize(130, 130).setDepth(1);
                    if (cl.powerUp === 'rocket_h') cell.sprite.setAngle(90);
                    cell.sprite.gridRow = p.r; cell.sprite.gridCol = p.c;
                } else this.destroyCell(p.r, p.c, 0, false);
            });
        });
        this.time.delayedCall(400, () => this.applyGravity());
    }

    destroyCell(r, c, delay = 0, isPowerUp = false) {
        if (r < 0 || r >= this.ROWS || c < 0 || c >= this.COLS || !this.grid[r] || !this.grid[r][c]) return;
        
        let cell = this.grid[r][c];
        if (cell.shield) {
            if (isPowerUp) { cell.shield = false; this.tweens.add({ targets: cell.shieldSprite, alpha: 0, scale: 2, duration: 400, onComplete: () => cell.shieldSprite.destroy() }); }
            return;
        }
        if (cell.type === currentLevel.targetColor) this.collectEffect(cell.sprite.x, cell.sprite.y, cell.type);
        if (cell.typePowerUp) this.triggerPowerUp(r, c);
        else { this.grid[r][c] = null; this.tweens.add({ targets: cell.sprite, alpha: 0, scale: 0, duration: 300, delay, onComplete: () => cell.sprite.destroy() }); }
    }

    collectEffect(startX, startY, type) {
        let ghost = this.add.image(startX, startY, 'ship' + type).setDisplaySize(130, 130).setDepth(20);
        this.tweens.add({ targets: ghost, x: this.targetIcon.x, y: this.targetIcon.y, scale: 0.4, duration: 600, ease: 'Back.easeIn', onComplete: () => { ghost.destroy(); currentLevel.currentAmount++; this.updateUI(); } });
    }

    triggerPowerUp(r, c, colorTarget = null) {
        if (r < 0 || r >= this.ROWS || c < 0 || c >= this.COLS || !this.grid[r] || !this.grid[r][c]) return;
        
        let cell = this.grid[r][c]; 
        if (!cell.typePowerUp) return;
        
        let p = cell.typePowerUp; let sprite = cell.sprite; this.grid[r][c] = null;
        this.tweens.add({ targets: sprite, scale: 2, alpha: 0, duration: 300, onComplete: () => sprite.destroy() });
        
        if (p === 'bombe') { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) this.destroyCell(r + i, c + j, 100, true); }
        else if (p.includes('rocket')) { if (p === 'rocket_h') { for (let i = 0; i < this.COLS; i++) this.destroyCell(r, i, 60, true); } else { for (let i = 0; i < this.ROWS; i++) this.destroyCell(i, c, 60, true); } }
        else if (p === 'star') { let tc = (colorTarget !== null) ? colorTarget : Phaser.Math.Between(0, 4); for(let rr=0; rr<this.ROWS; rr++) for(let cc=0; cc<this.COLS; cc++) if(this.grid[rr][cc]?.type === tc) this.destroyCell(rr, cc, Phaser.Math.Between(50, 400), true); }
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
                    let s = this.add.image(this.OFFSET_X + (c * this.TILE_SIZE) + (this.TILE_SIZE/2), this.OFFSET_Y - 200, 'ship'+t).setDisplaySize(130, 130).setDepth(1);
                    s.gridRow = r; s.gridCol = c;
                    this.grid[r][c] = { type: t, sprite: s, typePowerUp: null, shield: false };
                    this.tweens.add({ targets: s, y: this.OFFSET_Y + (r * this.TILE_SIZE) + (this.TILE_SIZE/2), duration: 500 });
                }
            }
        }
        this.time.delayedCall(600, () => { let cl = this.checkMatches(); if (cl.length > 0) this.destroyMatches(cl); else { this.canMove = true; this.updateUI(); } });
    }

    saveState() {
        let state = this.grid.map(row => row.map(cell => cell ? { type: cell.type, typePowerUp: cell.typePowerUp, shield: cell.shield } : null));
        this.history.push({ grid: state, moves: currentLevel.moves, amount: currentLevel.currentAmount });
        if (this.history.length > 3) this.history.shift();
    }

    undoMove() {
        if (this.undoLeft <= 0 || this.history.length === 0 || !this.canMove) return;
        this.undoLeft--; this.undoText.setText(`↩ ANNULER (${this.undoLeft}/3)`);
        let last = this.history.pop(); currentLevel.moves = last.moves; currentLevel.currentAmount = last.amount;
        this.updateUI();
        this.grid.forEach(row => row.forEach(c => { if(c){ if(c.sprite) c.sprite.destroy(); if(c.shieldSprite) c.shieldSprite.destroy(); }}));
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                let sD = last.grid[r][c];
                if (sD) {
                    let x = this.OFFSET_X + (c * this.TILE_SIZE) + (this.TILE_SIZE/2), y = this.OFFSET_Y + (r * this.TILE_SIZE) + (this.TILE_SIZE/2);
                    let key = sD.typePowerUp ? (sD.typePowerUp.includes('rocket') ? 'rocket' : sD.typePowerUp) : 'ship' + sD.type;
                    let s = this.add.image(x, y, key).setDisplaySize(130, 130).setDepth(1);
                    if (sD.typePowerUp === 'rocket_h') s.setAngle(90);
                    s.gridRow = r; s.gridCol = c;
                    this.grid[r][c] = { type: sD.type, sprite: s, typePowerUp: sD.typePowerUp, shield: sD.shield };
                    if (sD.shield) this.grid[r][c].shieldSprite = this.add.image(x, y, 'bouclier').setDisplaySize(160, 160).setAlpha(0.8).setDepth(2);
                } else this.grid[r][c] = null;
            }
        }
    }

    updateUI() {
        this.movesText.setText(`COUPS\n${currentLevel.moves}`);
        this.targetText.setText(`OBJ.\n${currentLevel.currentAmount}/${currentLevel.targetAmount}`);
        
        if (currentLevel.currentAmount >= currentLevel.targetAmount) { 
            // VICTOIRE
            this.statusText.setText("GAGNÉ !").setVisible(true).setFill('#2ecc71'); 
            this.nextBtn.setVisible(true); 
            this.menuBtn.setVisible(true); // 🟢 Bouton Menu affiché
            this.canMove = false; 
            localStorage.setItem(SAVE_KEY, Number(currentLevel.id) + 1); 
            
        } else if (currentLevel.moves <= 0) { 
            // DÉFAITE
            this.statusText.setText("ÉCHEC").setVisible(true).setFill('#e74c3c'); 
            this.retryBtn.setVisible(true); 
            this.menuBtn.setVisible(true); // 🟢 Bouton Menu affiché
            this.canMove = false; 
        }
    }
}

/**
 * CONFIGURATION FINALE 
 */
const VIRTUAL_WIDTH = 1080;
const VIRTUAL_HEIGHT = VIRTUAL_WIDTH * (window.innerHeight / window.innerWidth);

const config = {
    type: Phaser.AUTO,
    width: VIRTUAL_WIDTH,
    height: VIRTUAL_HEIGHT,
    backgroundColor: '#000000',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, parent: 'game-container' },
    scene: [MenuScene, GameScene]
};
const game = new Phaser.Game(config);