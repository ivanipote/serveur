const { Pool } = require('pg');
require('dotenv').config();

// Connexion à PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000
});

// ========================================================
// CRÉATION DES TABLES
// ========================================================

async function initializeDatabase() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // ========================================================
        // TABLE ADMINS
        // ========================================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                merchant_name TEXT NOT NULL,
                logo TEXT,
                contact TEXT,
                extra1 TEXT DEFAULT NULL,
                extra2 TEXT DEFAULT NULL,
                extra3 TEXT DEFAULT NULL,
                extra4 TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ========================================================
        // TABLE PRODUCTS
        // ========================================================
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
                categorie TEXT DEFAULT NULL,
                tags TEXT[] DEFAULT NULL,
                poids DECIMAL DEFAULT NULL,
                unite TEXT DEFAULT NULL,
                promotion BOOLEAN DEFAULT FALSE,
                prix_promotion INTEGER DEFAULT NULL,
                stock_min INTEGER DEFAULT NULL,
                fournisseur TEXT DEFAULT NULL,
                date_peremption DATE DEFAULT NULL,
                extra1 TEXT DEFAULT NULL,
                extra2 TEXT DEFAULT NULL,
                extra3 TEXT DEFAULT NULL,
                extra4 TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (admin_id) REFERENCES admins(id)
            )
        `);

        // ========================================================
        // TABLE USERS
        // ========================================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                phone TEXT NOT NULL,
                is_verified BOOLEAN DEFAULT FALSE,
                adresse TEXT DEFAULT NULL,
                ville TEXT DEFAULT NULL,
                code_postal TEXT DEFAULT NULL,
                date_naissance DATE DEFAULT NULL,
                genre TEXT DEFAULT NULL,
                avatar TEXT DEFAULT NULL,
                total_achats INTEGER DEFAULT 0,
                derniere_connexion TIMESTAMP DEFAULT NULL,
                extra1 TEXT DEFAULT NULL,
                extra2 TEXT DEFAULT NULL,
                extra3 TEXT DEFAULT NULL,
                extra4 TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ========================================================
        // TABLE PANIER
        // ========================================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS panier (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                quantity INTEGER DEFAULT 1,
                extra1 TEXT DEFAULT NULL,
                extra2 TEXT DEFAULT NULL,
                extra3 TEXT DEFAULT NULL,
                extra4 TEXT DEFAULT NULL,
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
                genius_reference TEXT,
                amount INTEGER NOT NULL,
                status TEXT DEFAULT 'pending',
                genius_status TEXT,
                checkout_url TEXT,
                payment_url TEXT,
                commande_id INTEGER,
                customer_name TEXT,
                customer_phone TEXT,
                customer_email TEXT,
                gateway TEXT,
                environment TEXT DEFAULT 'live',
                expires_at TIMESTAMP,
                frais_application INTEGER DEFAULT NULL,
                frais_gateway INTEGER DEFAULT NULL,
                net_recu INTEGER DEFAULT NULL,
                date_validation TIMESTAMP DEFAULT NULL,
                validateur_id INTEGER DEFAULT NULL,
                extra1 TEXT DEFAULT NULL,
                extra2 TEXT DEFAULT NULL,
                extra3 TEXT DEFAULT NULL,
                extra4 TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // Supprimer l'ancienne FK si elle existe
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

        // ========================================================
        // TABLE FRAIS_LIVRAISON
        // ========================================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS frais_livraison (
                id SERIAL PRIMARY KEY,
                commune TEXT UNIQUE NOT NULL,
                tarif INTEGER NOT NULL,
                extra1 TEXT DEFAULT NULL,
                extra2 TEXT DEFAULT NULL,
                extra3 TEXT DEFAULT NULL,
                extra4 TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ========================================================
        // TABLE COMMANDES (avec colonnes flexibles)
        // ========================================================
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
                methode_paiement TEXT DEFAULT NULL,
                date_livraison TIMESTAMP DEFAULT NULL,
                date_recuperation TIMESTAMP DEFAULT NULL,
                notes TEXT DEFAULT NULL,
                note_client INTEGER DEFAULT NULL,
                rating INTEGER DEFAULT NULL,
                livreur_id INTEGER DEFAULT NULL,
                zone_livraison TEXT DEFAULT NULL,
                poids DECIMAL DEFAULT NULL,
                volume DECIMAL DEFAULT NULL,
                extra1 TEXT DEFAULT NULL,
                extra2 TEXT DEFAULT NULL,
                extra3 TEXT DEFAULT NULL,
                extra4 TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // ========================================================
        // TABLE MESSAGES
        // ========================================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                commande_id INTEGER,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                extra1 TEXT DEFAULT NULL,
                extra2 TEXT DEFAULT NULL,
                extra3 TEXT DEFAULT NULL,
                extra4 TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (commande_id) REFERENCES commandes(id) ON DELETE CASCADE
            )
        `);

        // ========================================================
        // TABLE UPDATES
        // ========================================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS updates (
                id SERIAL PRIMARY KEY,
                commit_sha TEXT NOT NULL,
                commit_message TEXT NOT NULL,
                commit_date TEXT,
                commit_url TEXT,
                extra1 TEXT DEFAULT NULL,
                extra2 TEXT DEFAULT NULL,
                extra3 TEXT DEFAULT NULL,
                extra4 TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ========================================================
        // TABLE SESSION
        // ========================================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS "session" (
                "sid" varchar NOT NULL COLLATE "default",
                "sess" json NOT NULL,
                "expire" timestamp(6) NOT NULL,
                extra1 TEXT DEFAULT NULL,
                extra2 TEXT DEFAULT NULL,
                extra3 TEXT DEFAULT NULL,
                extra4 TEXT DEFAULT NULL
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

        // ========================================================
        // TABLE WAVE_VERIFICATIONS
        // ========================================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS wave_verifications (
                id SERIAL PRIMARY KEY,
                commande_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                wave_id TEXT NOT NULL,
                code_login TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                cause TEXT,
                verified_by INTEGER,
                date_validation TIMESTAMP DEFAULT NULL,
                validateur_id INTEGER DEFAULT NULL,
                notes_validation TEXT DEFAULT NULL,
                extra1 TEXT DEFAULT NULL,
                extra2 TEXT DEFAULT NULL,
                extra3 TEXT DEFAULT NULL,
                extra4 TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (commande_id) REFERENCES commandes(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // ========================================================
        // INDEX
        // ========================================================
        await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_commandes_user_id ON commandes(user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_commandes_status ON commandes(status)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_commandes_reference ON commandes(reference)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_commande_id ON payments(commande_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_genius_status ON payments(genius_status)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_expires_at ON payments(expires_at)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_wave_verifications_commande_id ON wave_verifications(commande_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_wave_verifications_status ON wave_verifications(status)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_wave_verifications_created_at ON wave_verifications(created_at)`);

        // ✅ Index pour les colonnes flexibles (si besoin un jour)
        await client.query(`CREATE INDEX IF NOT EXISTS idx_commandes_extra1 ON commandes(extra1) WHERE extra1 IS NOT NULL`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_extra1 ON users(extra1) WHERE extra1 IS NOT NULL`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_products_extra1 ON products(extra1) WHERE extra1 IS NOT NULL`);

        await client.query('COMMIT');

        console.log('✅ Toutes les tables PostgreSQL créées avec succès');
        console.log('   - admins (flex: 4)');
        console.log('   - products (flex: 4)');
        console.log('   - users (flex: 4)');
        console.log('   - panier (flex: 4)');
        console.log('   - payments (flex: 4)');
        console.log('   - frais_livraison (flex: 4)');
        console.log('   - commandes (flex: 4)');
        console.log('   - messages (flex: 4)');
        console.log('   - updates (flex: 4)');
        console.log('   - session (flex: 4)');
        console.log('   - wave_verifications (flex: 4)');
        console.log('   - Index créés');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erreur création tables:', error);
        throw error;
    } finally {
        client.release();
    }
}

// ========================================================
// EXPORT
// ========================================================

module.exports = {
    pool,
    query: (text, params) => pool.query(text, params),
    get: (text, params) => pool.query(text, params).then(res => res.rows[0]),
    all: (text, params) => pool.query(text, params).then(res => res.rows),
    run: (text, params) => pool.query(text, params),
    initialize: initializeDatabase
};