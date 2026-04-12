/**
 * PARTIE 1 : DONNÉES ET PROGRESSION
 */
const levelsData = [
    { id: 1, moves: 20, targetColor: 0, targetAmount: 15, x: 100, y: 550 },
    { id: 2, moves: 15, targetColor: 1, targetAmount: 20, x: 300, y: 450 },
    { id: 3, moves: 12, targetColor: 2, targetAmount: 20, x: 100, y: 350 },
    { id: 4, moves: 10, targetColor: 3, targetAmount: 25, x: 300, y: 250 },
    { id: 5, moves: 8,  targetColor: 4, targetAmount: 30, x: 200, y: 150 }
];

// On récupère le niveau atteint dans la mémoire du navigateur (par défaut : 1)
let unlockedLevel = parseInt(localStorage.getItem('galaxyCrush_reached')) || 1;
let currentLevel = {};

/**
 * PARTIE 2 : SCÈNE DE MENU (Carte du monde)
 */
class MenuScene extends Phaser.Scene {
    constructor() { super('MenuScene'); }

    preload() {
        this.load.image('background', 'img/fond.png');
    }

    create() {
        // Rafraîchir la mémoire à chaque retour au menu
        unlockedLevel = parseInt(localStorage.getItem('galaxyCrush_reached')) || 1;

        this.add.image(200, 350, 'background').setDisplaySize(400, 700).setAlpha(0.6);
        this.add.text(200, 60, 'GALAXY CRUSH', { 
            fontFamily: 'Arial Black', fontSize: '32px', fill: '#fff', stroke: '#2c3e50', strokeThickness: 6 
        }).setOrigin(0.5);

        const graphics = this.add.graphics();
        graphics.lineStyle(6, 0xffffff, 0.3);
        graphics.beginPath();
        graphics.moveTo(levelsData[0].x, levelsData[0].y);
        levelsData.forEach(lvl => graphics.lineTo(lvl.x, lvl.y));
        graphics.strokePath();

        levelsData.forEach(lvl => {
            const isLocked = lvl.id > unlockedLevel; // Est-ce que ce niveau est bloqué ?
            const color = isLocked ? 0x7f8c8d : 0xf1c40f; // Gris si bloqué, Jaune si ouvert

            const container = this.add.container(lvl.x, lvl.y);
            const circle = this.add.circle(0, 0, 30, color).setStrokeStyle(4, 0xffffff);
            const txt = this.add.text(0, 0, isLocked ? '🔒' : lvl.id, { 
                fontFamily: 'Arial Black', fontSize: '20px', fill: '#2c3e50' 
            }).setOrigin(0.5);
            
            container.add([circle, txt]);

            // On ne rend interactif que si le niveau est débloqué
            if (!isLocked) {
                circle.setInteractive();
                circle.on('pointerdown', () => {
                    this.tweens.add({
                        targets: container, scale: 0.9, duration: 80, yoyo: true,
                        onComplete: () => this.scene.start('GameScene', { level: lvl })
                    });
                });
            }
        });
    }
}

/**
 * PARTIE 3 : SCÈNE DE JEU */
class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    init(data) {
        currentLevel = { ...data.level, currentAmount: 0 };
        this.grid = []; this.history = []; this.canMove = true;
        this.ROWS = 8; this.COLS = 6; this.TILE_SIZE = 50;
        this.OFFSET_X = 75; this.OFFSET_Y = 150;
    }

    preload() {
        this.load.image('ship0', 'img/shipBeige_manned.png');
        this.load.image('ship1', 'img/shipBlue_manned.png');
        this.load.image('ship2', 'img/shipGreen_manned.png');
        this.load.image('ship3', 'img/shipPink_manned.png');
        this.load.image('ship4', 'img/shipYellow_manned.png');
        this.load.image('bombe', 'img/bomb.png');
        this.load.image('arcenciel', 'img/star.png');
        this.load.image('fusée', 'img/rocket.png');
    }

    create() {
        // On assombrit un peu le fond pour que les vaisseaux ressortent mieux
        this.add.image(200, 350, 'background').setDisplaySize(400, 700).setDepth(-2).setAlpha(0.8);
        
        this.initGrid();
        this.createUI();

        this.input.on('pointerup', (p) => {
            if (!this.canMove || this.selectedRow === undefined) return;
            let dx = p.upX - p.downX, dy = p.upY - p.downY;
            if (Math.abs(dx) > 20 || Math.abs(dy) > 20) this.handleSwipe(dx, dy);
            this.selectedRow = undefined;
        });
    }

    createUI() {
        const hudBg = this.add.graphics().fillStyle(0x000000, 0.6).fillRoundedRect(20, 20, 360, 100, 15);
        this.movesText = this.add.text(80, 70, `COUPS\n${currentLevel.moves}`, { fontFamily: 'Arial Black', fontSize: '20px', fill: '#fff', align: 'center' }).setOrigin(0.5);
        this.add.image(210, 70, 'ship' + currentLevel.targetColor).setDisplaySize(40, 40);
        this.targetText = this.add.text(300, 70, `OBJ.\n0/${currentLevel.targetAmount}`, { fontFamily: 'Arial Black', fontSize: '20px', fill: '#fff', align: 'center' }).setOrigin(0.5);

        // Bouton Annuler
        this.undoBtn = this.add.container(200, 640);
        const bg = this.add.graphics().fillStyle(0x3498db).fillRoundedRect(-80, -25, 160, 50, 10);
        const txt = this.add.text(0, 0, '↩ ANNULER', { fontFamily: 'Arial Black', fontSize: '18px', fill: '#fff' }).setOrigin(0.5);
        this.undoBtn.add([bg, txt]).setInteractive(new Phaser.Geom.Rectangle(-80, -25, 160, 50), Phaser.Geom.Rectangle.Contains);
        this.undoBtn.on('pointerdown', () => this.undoMove());

        // Bouton MENU (Caché au début)
        this.menuBtn = this.add.container(200, 450).setVisible(false).setDepth(20);
        const mBg = this.add.graphics().fillStyle(0x2ecc71).fillRoundedRect(-100, -30, 200, 60, 15);
        const mTxt = this.add.text(0, 0, 'RETOUR CARTE', { fontFamily: 'Arial Black', fontSize: '18px', fill: '#fff' }).setOrigin(0.5);
        this.menuBtn.add([mBg, mTxt]).setInteractive(new Phaser.Geom.Rectangle(-100, -30, 200, 60), Phaser.Geom.Rectangle.Contains);
        this.menuBtn.on('pointerdown', () => this.scene.start('MenuScene'));

        this.statusText = this.add.text(200, 350, '', { fontFamily: 'Arial Black', fontSize: '40px', fill: '#f1c40f', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(10);
    }

    // CORRECTION : On affiche les boutons ici
    updateUI() {
        this.movesText.setText(`COUPS\n${currentLevel.moves}`);
        this.targetText.setText(`OBJ.\n${currentLevel.currentAmount}/${currentLevel.targetAmount}`);
        
        if (currentLevel.currentAmount >= currentLevel.targetAmount) {
            this.statusText.setText("GAGNÉ !");
            this.canMove = false;
            this.undoBtn.setVisible(false);
            this.menuBtn.setVisible(true); // <--- Affiche le bouton
            
            if (currentLevel.id >= unlockedLevel) {
                unlockedLevel = currentLevel.id + 1;
                localStorage.setItem('galaxyCrush_reached', unlockedLevel);
            }
        } 
        else if (currentLevel.moves <= 0 && this.canMove) {
            this.statusText.setText("PERDU");
            this.canMove = false;
            this.undoBtn.setVisible(false);
            this.menuBtn.setVisible(true); // <--- Affiche le bouton aussi ici
        }
    }

    initGrid() {
    for (let r = 0; r < this.ROWS; r++) {
        this.grid[r] = [];
        for (let c = 0; c < this.COLS; c++) {
            let x = this.OFFSET_X + c * this.TILE_SIZE + 25, y = this.OFFSET_Y + r * this.TILE_SIZE + 25;
            
            // On met le fond de case en profondeur -2 (tout en bas)
            this.add.graphics()
                .fillStyle(0x000000, 0.5)
                .fillRoundedRect(x - 23, y - 23, 46, 46, 8)
                .setDepth(-2); 

            let type = Phaser.Math.Between(0, 4);
            let s = this.add.image(x, y, 'ship' + type)
                .setDisplaySize(40, 40)
                .setInteractive()
                .setAlpha(1)    // Force l'opacité
                .setDepth(1);   // Force le premier plan
                
            s.gridRow = r; s.gridCol = c;
            this.grid[r][c] = { type, sprite: s, typePowerUp: null };
            s.on('pointerdown', () => { if (this.canMove) { this.selectedRow = s.gridRow; this.selectedCol = s.gridCol; }});
        }
    }
}


    handleSwipe(dx, dy) {
        let tr = this.selectedRow, tc = this.selectedCol;
        if (Math.abs(dx) > Math.abs(dy)) { if (dx > 0) tc++; else tc--; } else { if (dy > 0) tr++; else tr--; }
        if (tr >= 0 && tr < this.ROWS && tc >= 0 && tc < this.COLS) this.swapBlocks(this.selectedRow, this.selectedCol, tr, tc);
    }

    swapBlocks(r1, c1, r2, c2) {
        this.canMove = false; this.saveState();
        let b1 = this.grid[r1][c1], b2 = this.grid[r2][c2];
        currentLevel.moves--; this.updateUI();
        this.grid[r1][c1] = b2; this.grid[r2][c2] = b1;
        b1.sprite.gridRow = r2; b1.sprite.gridCol = c2;
        b2.sprite.gridRow = r1; b2.sprite.gridCol = c1;

        this.tweens.add({ targets: b1.sprite, x: this.OFFSET_X + c2*50+25, y: this.OFFSET_Y + r2*50+25, duration: 200 });
        this.tweens.add({ targets: b2.sprite, x: this.OFFSET_X + c1*50+25, y: this.OFFSET_Y + r1*50+25, duration: 200, onComplete: () => {
            let cl = this.checkMatches();
            if (b1.typePowerUp || b2.typePowerUp || cl.length > 0) {
                if (b1.typePowerUp) this.triggerPowerUp(r2, c2);
                if (b2.typePowerUp) this.triggerPowerUp(r1, c1);
                if (cl.length > 0) this.destroyMatches(cl, [{r:r1,c:c1},{r:r2,c:c2}]);
                else this.time.delayedCall(500, () => this.applyGravity());
            } else {
                currentLevel.moves++; this.updateUI(); this.history.pop();
                this.grid[r1][c1] = b1; this.grid[r2][c2] = b2;
                b1.sprite.gridRow = r1; b1.sprite.gridCol = c1;
                b2.sprite.gridRow = r2; b2.sprite.gridCol = c2;
                this.tweens.add({ targets: b1.sprite, x: this.OFFSET_X+c1*50+25, y: this.OFFSET_Y+r1*50+25, duration: 200 });
                this.tweens.add({ targets: b2.sprite, x: this.OFFSET_X+c2*50+25, y: this.OFFSET_Y+r2*50+25, duration: 200, onComplete: () => this.canMove = true });
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
            for (let i=0; i<clusters.length; i++) {
                if (cur.some(c1 => clusters[i].lines.some(line => line.some(c2 => c1.r === c2.r && c1.c === c2.c)))) { clusters[i].lines.push(cur); merged = true; break; }
            }
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
            if (max >= 5) p = 'arcenciel'; else if (hasH && hasV) p = 'bombe'; 
            else if (max === 4) p = hasH ? 'fusée_v' : 'fusée_h';
            results.push({ cells, powerUp: p });
        });
        return results;
    }

    destroyMatches(clusters, swaps = []) {
        clusters.forEach(cl => {
            let spawnPos = cl.cells[0];
            cl.cells.forEach(p => { if (swaps.some(s => s.r === p.r && s.c === p.c)) spawnPos = p; });
            cl.cells.forEach(p => {
                let cell = this.grid[p.r][p.c]; if (!cell) return;
                if (cl.powerUp && p.r === spawnPos.r && p.c === spawnPos.c) {
                    cell.typePowerUp = cl.powerUp; cell.type = -1;
                    let oldX = cell.sprite.x, oldY = cell.sprite.y; cell.sprite.destroy();
                    let key = (cl.powerUp.includes('fusée')) ? 'fusée' : cl.powerUp;
                    cell.sprite = this.add.image(oldX, oldY, key).setDisplaySize(40, 40).setInteractive();
                    if (cl.powerUp === 'fusée_h') cell.sprite.setAngle(90);
                    cell.sprite.gridRow = p.r; cell.sprite.gridCol = p.c;
                    cell.sprite.on('pointerdown', () => { if(this.canMove){this.selectedRow=cell.sprite.gridRow; this.selectedCol=cell.sprite.gridCol;}});
                } else { this.destroyCell(p.r, p.c); }
            });
        });
        this.time.delayedCall(400, () => this.applyGravity());
    }

    destroyCell(r, c, delay = 0) {
        if (r < 0 || r >= this.ROWS || c < 0 || c >= this.COLS) return;
        let cell = this.grid[r][c]; if (!cell) return;
        if (cell.type === currentLevel.targetColor) { currentLevel.currentAmount++; this.updateUI(); }
        if (cell.typePowerUp) this.time.delayedCall(delay, () => this.triggerPowerUp(r, c));
        else {
            this.grid[r][c] = null;
            this.tweens.add({ targets: cell.sprite, alpha: 0, scale: 0, duration: 300, delay, onComplete: () => cell.sprite.destroy() });
        }
    }

    triggerPowerUp(r, c, color = null) {
        let cell = this.grid[r][c]; if (!cell) return;
        let p = cell.typePowerUp; this.grid[r][c] = null;
        this.tweens.add({ targets: cell.sprite, scale: 2, alpha: 0, duration: 300, onComplete: () => cell.sprite.destroy() });
        if (p === 'bombe') {
            for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) this.destroyCell(r + i, c + j, 100);
        } else if (p === 'fusée_h') {
            for (let i = 0; i < this.COLS; i++) this.destroyCell(r, i, Math.abs(c - i) * 60);
        } else if (p === 'fusée_v') {
            for (let i = 0; i < this.ROWS; i++) this.destroyCell(i, c, Math.abs(r - i) * 60);
        } else if (p === 'arcenciel') {
            let tc = (color !== null) ? color : Phaser.Math.Between(0, 4);
            for(let rr=0; rr<this.ROWS; rr++) for(let cc=0; cc<this.COLS; cc++) if(this.grid[rr][cc]?.type === tc) this.destroyCell(rr, cc, Phaser.Math.Between(50, 400));
        }
    }

    applyGravity() {
       // Trouve cette partie dans ta fonction applyGravity
for (let c = 0; c < this.COLS; c++) {
    for (let r = 0; r < this.ROWS; r++) {
        if (this.grid[r][c] === null) {
            let type = Phaser.Math.Between(0, 4);
            let x = this.OFFSET_X + c * 50 + 25, y = this.OFFSET_Y + r * 50 + 25;
            
            let s = this.add.image(x, this.OFFSET_Y - 50, 'ship' + type)
                .setDisplaySize(40, 40)
                .setInteractive()
                .setAlpha(1)   // AJOUT : Bien visible
                .setDepth(1);  // AJOUT : Par-dessus le fond
            
            s.gridRow = r; s.gridCol = c;
            this.grid[r][c] = { type, sprite: s, typePowerUp: null };
            
            s.on('pointerdown', () => { if(this.canMove){this.selectedRow=s.gridRow; this.selectedCol=s.gridCol;}});
            this.tweens.add({ targets: s, y: y, duration: 400, ease: 'Bounce.easeOut' });
        }
    }
}
        for (let c = 0; c < this.COLS; c++) {
            for (let r = 0; r < this.ROWS; r++) {
                if (this.grid[r][c] === null) {
                    let type = Phaser.Math.Between(0, 4);
                    let x = this.OFFSET_X + c*50+25, y = this.OFFSET_Y + r*50+25;
                    let s = this.add.image(x, this.OFFSET_Y - 50, 'ship' + type).setDisplaySize(40, 40).setInteractive();
                    s.gridRow = r; s.gridCol = c;
                    this.grid[r][c] = { type, sprite: s, typePowerUp: null };
                    s.on('pointerdown', () => { if(this.canMove){this.selectedRow=s.gridRow; this.selectedCol=s.gridCol;}});
                    this.tweens.add({ targets: s, y: y, duration: 400, ease: 'Bounce.easeOut' });
                }
            }
        }
        this.time.delayedCall(500, () => { if (this.checkMatches().length > 0) this.destroyMatches(this.checkMatches()); else if(currentLevel.moves > 0) this.canMove = true; });
    }

    saveState() {
        let state = [];
        for(let r=0; r<this.ROWS; r++) {
            state[r] = [];
            for(let c=0; c<this.COLS; c++) state[r][c] = this.grid[r][c] ? { type: this.grid[r][c].type, typePowerUp: this.grid[r][c].typePowerUp } : null;
        }
        this.history.push({ state, moves: currentLevel.moves + 1, amount: currentLevel.currentAmount });
    }

    undoMove() {
        // 1. On vérifie si on a le droit d'annuler (pas si gagné/perdu ou historique vide)
        let isGameOver = (currentLevel.currentAmount >= currentLevel.targetAmount) || (currentLevel.moves <= 0);
        if (!this.canMove || this.history.length === 0 || isGameOver) return;

        // 2. On récupère la sauvegarde et on met à jour les scores
        let d = this.history.pop();
        currentLevel.moves = d.moves; 
        currentLevel.currentAmount = d.amount; 
        this.updateUI();

        // 3. On détruit physiquement TOUS les vaisseaux à l'écran pour les recréer proprement
        for(let r=0; r<this.ROWS; r++) {
            for(let c=0; c<this.COLS; c++) {
                if(this.grid[r][c]?.sprite) this.grid[r][c].sprite.destroy();
            }
        }

        // 4. On boucle sur les données de l'historique pour replacer les vaisseaux
        for(let r=0; r<this.ROWS; r++) {
            for(let c=0; c<this.COLS; c++) {
                let st = d.state[r][c]; // st contient les infos de la case
                
                if (st) {
                    // On définit si c'est un vaisseau normal ou un bonus
                    let key = st.typePowerUp ? (st.typePowerUp.includes('fusée') ? 'fusée' : st.typePowerUp) : 'ship'+st.type;
                    
                    // --- LE CORRECTIF EST ICI ---
                    let s = this.add.image(this.OFFSET_X + c * 50 + 25, this.OFFSET_Y + r * 50 + 25, key)
                        .setDisplaySize(40, 40)
                        .setInteractive()
                        .setAlpha(1)   // Force l'opacité au maximum
                        .setDepth(1);  // Force le vaisseau à être AU-DESSUS du fond de case
                    
                    // Si c'était une fusée horizontale, on lui remet son angle
                    if (st.typePowerUp === 'fusée_h') s.setAngle(90);

                    // On lui redonne ses coordonnées de grille et son écouteur de clic
                    s.gridRow = r; 
                    s.gridCol = c;
                    s.on('pointerdown', () => { 
                        if(this.canMove){
                            this.selectedRow = s.gridRow; 
                            this.selectedCol = s.gridCol;
                        }
                    });

                    // On réenregistre le tout dans notre grille de données
                    this.grid[r][c] = { type: st.type, sprite: s, typePowerUp: st.typePowerUp };
                } else {
                    this.grid[r][c] = null;
                }
            }
        }
    }

updateUI() {
        this.movesText.setText(`COUPS\n${currentLevel.moves}`);
        this.targetText.setText(`OBJ.\n${currentLevel.currentAmount}/${currentLevel.targetAmount}`);
        
        // --- CAS DE VICTOIRE ---
        if (currentLevel.currentAmount >= currentLevel.targetAmount) {
            this.statusText.setText("GAGNÉ !");
            this.canMove = false; // On bloque le jeu
            
            this.undoBtn.setVisible(false); // On cache le bouton annuler
            this.menuBtn.setVisible(true);  // ON AFFICHE LE BOUTON RETOUR CARTE
            this.menuBtn.setDepth(20);      // On s'assure qu'il est au-dessus de tout

            // LOGIQUE DE DÉBLOCAGE ET SAUVEGARDE
            if (currentLevel.id >= unlockedLevel) {
                unlockedLevel = currentLevel.id + 1;
                localStorage.setItem('galaxyCrush_reached', unlockedLevel);
            }
        } 
        // --- CAS DE DÉFAITE ---
        else if (currentLevel.moves <= 0 && this.canMove) {
            this.statusText.setText("PERDU");
            this.canMove = false;
            
            this.undoBtn.setVisible(false);
            this.menuBtn.setVisible(true); // On le montre aussi en cas de défaite
            this.menuBtn.setDepth(20);
        }
    }
}

/**
 * PARTIE 4 : LANCEMENT DU JEU
 */
const config = {
    type: Phaser.AUTO,
    width: 400,
    height: 700,
    backgroundColor: '#9bb2c9',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [MenuScene, GameScene]
};
const game = new Phaser.Game(config);