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
// FONCTION : AJOUTER LES COLONNES EXTRA1-4 À WAVE_VERIFICATIONS
// ========================================================

async function ensureExtraColumns() {
    const client = await pool.connect();
    try {
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'wave_verifications'
            )
        `);

        if (!tableCheck.rows[0].exists) {
            console.log('   ⚠️ Table wave_verifications n\'existe pas encore');
            return;
        }

        const extraColumns = ['extra1', 'extra2', 'extra3', 'extra4'];
        for (const colName of extraColumns) {
            const colCheck = await client.query(`
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'wave_verifications' AND column_name = $1
                )
            `, [colName]);

            if (!colCheck.rows[0].exists) {
                await client.query(`ALTER TABLE wave_verifications ADD COLUMN ${colName} TEXT`);
                console.log(`   ✅ Colonne ${colName} ajoutée à wave_verifications`);
            }
        }

        // ✅ Vérifier extra1 dans admins (solde)
        const colCheckAdmin = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'admins' AND column_name = 'extra1'
            )
        `);

        if (!colCheckAdmin.rows[0].exists) {
            await client.query(`ALTER TABLE admins ADD COLUMN extra1 TEXT DEFAULT '0'`);
            console.log('   ✅ Colonne extra1 ajoutée à admins (solde)');
        }

    } catch (error) {
        console.log(`   ⚠️ Erreur vérification extra columns:`, error.message);
    } finally {
        client.release();
    }
}

// ========================================================
// FONCTION : AJOUTER LA COLONNE FCM_TOKEN À ADMINS
// ========================================================

async function ensureFcmTokenColumn() {
    const client = await pool.connect();
    try {
        const colCheck = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'admins' AND column_name = 'fcm_token'
            )
        `);

        if (!colCheck.rows[0].exists) {
            await client.query(`ALTER TABLE admins ADD COLUMN fcm_token TEXT`);
            console.log('   ✅ Colonne fcm_token ajoutée à admins');
        } else {
            console.log('   ✅ Colonne fcm_token existe déjà');
        }
    } catch (error) {
        console.log(`   ⚠️ Erreur vérification fcm_token:`, error.message);
    } finally {
        client.release();
    }
}

// ========================================================
// CRÉATION DES TABLES (avec la nouvelle table payments_jeko)
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
                description TEXT,
                categorie TEXT DEFAULT NULL,
                tags TEXT[] DEFAULT NULL,
                price INTEGER NOT NULL,
                quantity INTEGER DEFAULT 0,
                stock_min INTEGER DEFAULT NULL,
                image1 TEXT NOT NULL,
                image2 TEXT,
                poids DECIMAL DEFAULT NULL,
                unite TEXT DEFAULT NULL,
                is_new BOOLEAN DEFAULT FALSE,
                promo_price INTEGER DEFAULT NULL,
                promo_end_date DATE DEFAULT NULL,
                flex1 TEXT DEFAULT NULL,
                flex2 TEXT DEFAULT NULL,
                flex3 TEXT DEFAULT NULL,
                flex4 TEXT DEFAULT NULL,
                flex5 TEXT DEFAULT NULL,
                flex6 TEXT DEFAULT NULL,
                flex7 TEXT DEFAULT NULL,
                flex8 TEXT DEFAULT NULL,
                fournisseur TEXT DEFAULT NULL,
                date_peremption DATE DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (admin_id) REFERENCES admins(id)
            )
        `);
        console.log('   ✅ Table products créée');

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
        // TABLE PAYMENTS (Genius Pay)
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
                precision TEXT DEFAULT NULL,
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
        console.log('   ✅ Table wave_verifications créée');

        // ========================================================
        // TABLE COMMITS
        // ========================================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS commits (
                id SERIAL PRIMARY KEY,
                sha TEXT UNIQUE NOT NULL,
                message TEXT NOT NULL,
                author TEXT,
                date TIMESTAMP,
                url TEXT,
                branch TEXT DEFAULT 'master',
                deployed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('   ✅ Table commits créée');

        // ========================================================
        // ✅ NOUVELLE TABLE : payments_jeko (pour Jèko)
        // ========================================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS payments_jeko (
                id SERIAL PRIMARY KEY,
                transaction_id TEXT UNIQUE NOT NULL,
                amount INTEGER NOT NULL,
                currency TEXT DEFAULT 'XOF',
                status TEXT DEFAULT 'pending',
                counterpart_phone TEXT,
                payment_method TEXT,
                store_id TEXT,
                store_name TEXT,
                payment_link_id TEXT,
                executed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('   ✅ Table payments_jeko créée pour les paiements Jèko');

        await client.query('COMMIT');

        console.log('✅ Toutes les tables PostgreSQL créées avec succès');

        // ========================================================
        // AJOUTER LES COLONNES FLEX
        // ========================================================
        console.log('🔄 Vérification des colonnes flex...');

        const tables = [
            'admins', 'products', 'users', 'panier', 'payments',
            'frais_livraison', 'commandes', 'messages', 'updates',
            'session', 'wave_verifications', 'payments_jeko'
        ];

        for (const table of tables) {
            await ensureFlexColumns(table);
        }

        console.log('✅ Toutes les colonnes flex vérifiées');

        // ========================================================
        // AJOUTER LES COLONNES EXTRA
        // ========================================================
        console.log('🔄 Vérification des colonnes extra...');
        await ensureExtraColumns();
        console.log('✅ Colonnes extra vérifiées');

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
        await client.query(`CREATE INDEX IF NOT EXISTS idx_commits_sha ON commits(sha)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_commits_date ON commits(date)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_jeko_transaction_id ON payments_jeko(transaction_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_jeko_status ON payments_jeko(status)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_jeko_created_at ON payments_jeko(created_at)`);

        console.log('   - Index créés');

        // ========================================================
        // AJOUTER LA COLONNE FCM_TOKEN À ADMINS
        // ========================================================
        console.log('🔄 Vérification de la colonne fcm_token...');
        await ensureFcmTokenColumn();
        console.log('✅ Colonne fcm_token vérifiée');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erreur création tables:', error);
        throw error;
    } finally {
        client.release();
    }
}

// ========================================================
// ✅ NOUVELLES FONCTIONS POUR PAYMENTS_JEKO
// ========================================================

// Sauvegarder un paiement Jèko
async function saveJekoPayment(data) {
    const query = `
        INSERT INTO payments_jeko (
            transaction_id, amount, currency, status,
            counterpart_phone, payment_method, store_id,
            store_name, payment_link_id, executed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (transaction_id) DO NOTHING
        RETURNING id
    `;

    const values = [
        data.id,
        data.amount?.amount || 0,
        data.amount?.currency || 'XOF',
        data.status || 'pending',
        data.counterpartIdentifier || null,
        data.paymentMethod || null,
        data.storeId || null,
        data.storeName || null,
        data.transactionDetails?.paymentLinkId || null,
        data.executedAt ? new Date(data.executedAt) : null
    ];

    try {
        const result = await pool.query(query, values);
        if (result.rowCount > 0) {
            console.log(`✅ Paiement Jèko ${data.id} enregistré (ID: ${result.rows[0].id})`);
        } else {
            console.log(`ℹ️ Paiement Jèko ${data.id} déjà existant`);
        }
        return result.rows[0]?.id || null;
    } catch (error) {
        console.error('❌ Erreur sauvegarde paiement Jèko:', error);
        return null;
    }
}

// Récupérer tous les paiements Jèko
async function getJekoPayments() {
    try {
        const result = await pool.query(
            'SELECT * FROM payments_jeko ORDER BY created_at DESC'
        );
        return result.rows;
    } catch (error) {
        console.error('❌ Erreur récupération paiements Jèko:', error);
        return [];
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
    initialize: initializeDatabase,
    ensureFcmTokenColumn,
    // ✅ NOUVELLES FONCTIONS
    saveJekoPayment,
    getJekoPayments
};