// levels.js
const levelsData = [];

for (let i = 1; i <= 100; i++) {
    const page = Math.floor((i - 1) / 20);
    const indexInPage = (i - 1) % 20;
    const col = indexInPage % 4;
    const row = Math.floor(indexInPage / 4);

    const x = 240 + (col * 200); 
    const y = 1450 - (row * 240); 

    // --- LOGIQUE FIXE (Fini le hasard total) ---
    
    // La couleur cible est fixée selon l'ID (ex: Niveau 1 = Beige, 2 = Bleu, etc.)
    const targetColor = (i - 1) % 5; 

    // Difficulté progressive mathématique
    // Moves = $25 - (i / 5)$, minimum 10 coups
    const moves = Math.max(10, 25 - Math.floor(i / 5)); 
    
    // Objectif = $15 + (i * 3)$
    const targetAmount = 15 + (i * 3);

    let shieldChance = 0;
    if (i >= 6) shieldChance = Math.min(0.5, 0.1 + (i * 0.005));

    levelsData.push({
        id: i,
        page: page,
        moves: moves,
        targetColor: targetColor, 
        targetAmount: targetAmount,
        x: x, y: y,
        shieldChance: shieldChance
    });
}