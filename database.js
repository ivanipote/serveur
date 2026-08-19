const { Pool } = require('pg');
require('dotenv').config();

// Connexion à PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ========================================================
// CRÉATION DES TABLES
// ========================================================

async function initializeDatabase() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // TABLE ADMINS
        await client.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                merchant_name TEXT NOT NULL,
                logo TEXT,
                contact TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // TABLE PRODUCTS
        await client.query(`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                admin_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                image1 TEXT NOT NULL,
                image2 TEXT,
                description TEXT,
                quantity INTEGER DEFAULT 0,
                price INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (admin_id) REFERENCES admins(id)
            )
        `);

        // TABLE USERS
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                phone TEXT NOT NULL,
                is_verified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // TABLE PANIER
        await client.query(`
            CREATE TABLE IF NOT EXISTS panier (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                quantity INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (product_id) REFERENCES products(id),
                UNIQUE(user_id, product_id)
            )
        `);

       // ========================================================
// TABLE PAYMENTS
// ========================================================
await client.query(`
    CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        product_id INTEGER,
        reference TEXT UNIQUE NOT NULL,
        amount INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        checkout_url TEXT,
        commande_id INTEGER,
        genius_reference TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
`);

// ✅ SUPPRIMER LA FK EXISTANTE
await client.query(`
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'payments_product_id_fkey'
        ) THEN
            ALTER TABLE payments DROP CONSTRAINT payments_product_id_fkey;
            RAISE NOTICE '✅ Contrainte payments_product_id_fkey supprimée';
        END IF;
    END $$;
`);

        // TABLE FRAIS_LIVRAISON
        await client.query(`
            CREATE TABLE IF NOT EXISTS frais_livraison (
                id SERIAL PRIMARY KEY,
                commune TEXT UNIQUE NOT NULL,
                tarif INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // TABLE COMMANDES
        await client.query(`
            CREATE TABLE IF NOT EXISTS commandes (
                id SERIAL PRIMARY KEY,
                reference TEXT UNIQUE NOT NULL,
                user_id INTEGER NOT NULL,
                panier TEXT NOT NULL,
                total INTEGER NOT NULL,
                nom TEXT NOT NULL,
                telephone TEXT NOT NULL,
                code_login TEXT NOT NULL,
                option TEXT NOT NULL,
                commune TEXT,
                frais_livraison INTEGER DEFAULT 0,
                ville TEXT,
                quartier TEXT,
                precision TEXT,
                latitude REAL,
                longitude REAL,
                status TEXT DEFAULT 'en_attente',
                cause_refus TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // TABLE MESSAGES (avec ON DELETE CASCADE)
        await client.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                commande_id INTEGER,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (commande_id) REFERENCES commandes(id) ON DELETE CASCADE
            )
        `);

        // TABLE UPDATES
        await client.query(`
            CREATE TABLE IF NOT EXISTS updates (
                id SERIAL PRIMARY KEY,
                commit_sha TEXT NOT NULL,
                commit_message TEXT NOT NULL,
                commit_date TEXT,
                commit_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // TABLE SESSION
        await client.query(`
            CREATE TABLE IF NOT EXISTS "session" (
                "sid" varchar NOT NULL COLLATE "default",
                "sess" json NOT NULL,
                "expire" timestamp(6) NOT NULL
            )
        `);

        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'session_pkey'
                ) THEN
                    ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid");
                END IF;
            END $$;
        `);

        // INDEX
        await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_commandes_user_id ON commandes(user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_commandes_status ON commandes(status)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_commandes_reference ON commandes(reference)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_commande_id ON payments(commande_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference)`);

        await client.query('COMMIT');

        console.log('✅ Toutes les tables PostgreSQL créées avec succès');
        console.log('   - admins');
        console.log('   - products');
        console.log('   - users');
        console.log('   - panier');
        console.log('   - payments (product_id NULL, sans FK)');
        console.log('   - frais_livraison');
        console.log('   - commandes');
        console.log('   - messages (ON DELETE CASCADE)');
        console.log('   - updates');
        console.log('   - session');
        console.log('   - Index créés');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erreur création tables:', error);
        throw error;
    } finally {
        client.release();
    }
}

initializeDatabase().catch(console.error);

module.exports = {
    pool,
    query: (text, params) => pool.query(text, params),
    get: (text, params) => pool.query(text, params).then(res => res.rows[0]),
    all: (text, params) => pool.query(text, params).then(res => res.rows),
    run: (text, params) => pool.query(text, params),
    initialize: initializeDatabase
};