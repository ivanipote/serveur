const { Pool } = require('pg');

// ✅ URL en dur (temporaire)
const DATABASE_URL = 'postgresql://nature_plus_db_user:qV0Ee2jQNaSEX1n8GUKkzT12iUz8PpZc@dpg-da2cssk9v7es73dcfn40-a.oregon-postgres.render.com/nature_plus_db';

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function cleanDatabase() {
    try {
        console.log('🧹 Nettoyage de la base de données...');
        await pool.query('TRUNCATE TABLE admins, products, users, panier, payments, commandes, messages, updates, session RESTART IDENTITY CASCADE;');
        console.log('✅ Tables vidées avec succès');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur:', error);
        process.exit(1);
    }
}

cleanDatabase();