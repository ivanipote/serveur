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
// FONCTION : AJOUTER LES COLONNES FLEX SI ELLES MANQUENT
// ========================================================

async function ensureFlexColumns(tableName) {
    const client = await pool.connect();
    try {
        // Vérifier si la table existe
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = $1
            )
        `, [tableName]);

        if (!tableCheck.rows[0].exists) {
            console.log(`   ⚠️ Table ${tableName} n'existe pas encore`);
            return;
        }

        // Vérifier les colonnes flex1-8
        for (let i = 1; i <= 8; i++) {
            const colName = `flex${i}`;
            const colCheck = await client.query(`
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = $1 AND column_name = $2
                )
            `, [tableName, colName]);

            if (!colCheck.rows[0].exists) {
                await client.query(`ALTER TABLE ${tableName} ADD COLUMN ${colName} TEXT`);
                console.log(`   ✅ Colonne ${colName} ajoutée à ${tableName}`);
            }
        }
    } catch (error) {
        console.log(`   ⚠️ Erreur vérification ${tableName}:`, error.message);
    } finally {
        client.release();
    }
}

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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // ========================================================
        // TABLE FRAIS_LIVRAISON
        // ========================================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS frais_livraison (
                id SERIAL PRIMARY KEY,
                commune TEXT UNIQUE NOT NULL,
                tarif INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ========================================================
        // TABLE COMMANDES
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (commande_id) REFERENCES commandes(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // ========================================================
        // ✅ TABLE SELLERS
        // ========================================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS sellers (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                phone TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ========================================================
        // ✅ TABLE SHOPS
        // ========================================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS shops (
                id SERIAL PRIMARY KEY,
                seller_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                location TEXT NOT NULL,
                description TEXT,
                logo TEXT,
                status TEXT DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
            )
        `);

        // ========================================================
        // ✅ TABLE SELLER_PRODUCTS
        // ========================================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS seller_products (
                id SERIAL PRIMARY KEY,
                shop_id INTEGER NOT NULL,
                seller_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                price INTEGER NOT NULL,
                image TEXT,
                description TEXT,
                stock INTEGER DEFAULT 0,
                category TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
                FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
            )
        `);

        // ========================================================
        // ✅ TABLE SELLER_ORDERS
        // ========================================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS seller_orders (
                id SERIAL PRIMARY KEY,
                seller_id INTEGER NOT NULL,
                shop_id INTEGER NOT NULL,
                product_id INTEGER,
                user_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                total INTEGER NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE,
                FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // ========================================================
        // ✅ TABLE SELLER_MESSAGES
        // ========================================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS seller_messages (
                id SERIAL PRIMARY KEY,
                seller_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                shop_id INTEGER NOT NULL,
                message TEXT NOT NULL,
                is_from_seller BOOLEAN DEFAULT FALSE,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
            )
        `);

        await client.query('COMMIT');

        console.log('✅ Toutes les tables PostgreSQL créées avec succès');

        // ========================================================
        // ✅ AJOUTER LES COLONNES FLEX1-8 À TOUTES LES TABLES
        // ========================================================
        console.log('🔄 Vérification des colonnes flex...');

        const tables = [
            'admins', 'products', 'users', 'panier', 'payments',
            'frais_livraison', 'commandes', 'messages', 'updates',
            'session', 'wave_verifications',
            'sellers', 'shops', 'seller_products', 'seller_orders', 'seller_messages'
        ];

        for (const table of tables) {
            await ensureFlexColumns(table);
        }

        console.log('✅ Toutes les colonnes flex vérifiées');

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

        // ✅ Index pour les tables vendeur
        await client.query(`CREATE INDEX IF NOT EXISTS idx_sellers_email ON sellers(email)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_sellers_status ON sellers(status)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_shops_seller_id ON shops(seller_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_shops_status ON shops(status)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_seller_products_shop_id ON seller_products(shop_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_seller_products_seller_id ON seller_products(seller_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_seller_orders_seller_id ON seller_orders(seller_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_seller_orders_shop_id ON seller_orders(shop_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_seller_orders_user_id ON seller_orders(user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_seller_messages_seller_id ON seller_messages(seller_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_seller_messages_user_id ON seller_messages(user_id)`);

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