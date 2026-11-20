require('dotenv').config();

const express = require('express');
const db = require('./db');

const {
    cache,
    getCache,
    setCache,
    deleteCache
} = require('./cache');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json());

// Логирование HTTP-запросов
app.use((req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            duration_ms: Date.now() - start
        }));
    });

    next();
});

// Работа с кэшем не должна ломать API
async function safeCache(operation) {
    try {
        return await operation();
    } catch (err) {
        console.error('Cache error:', err.message);
        return null;
    }
}

// Проверка здоровья приложения
app.get('/health', async (req, res) => {
    let database = 'down';
    let memcached = 'down';

    try {
        await db.query('SELECT 1');
        database = 'up';
    } catch (err) {
        console.error('DB health error:', err.message);
    }

    try {
        await new Promise((resolve, reject) => {
            cache.stats((err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        memcached = 'up';
    } catch (err) {
        console.error('Cache health error:', err.message);
    }

    res.status(database === 'up' ? 200 : 503).json({
        status: database === 'up' ? 'ok' : 'degraded',
        database,
        memcached
    });
});

// Получение всех товаров
app.get('/api/products', async (req, res) => {
    try {
        const cached = await safeCache(
            () => getCache('products:all')
        );

        if (cached !== null && cached !== undefined) {
            res.set('X-Cache', 'HIT');
            return res.json(cached);
        }

        const [rows] = await db.query(
            'SELECT * FROM products ORDER BY id'
        );

        await safeCache(
            () => setCache('products:all', rows, 60)
        );

        res.set('X-Cache', 'MISS');
        res.json(rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Database error'
        });
    }
});

// Получение товара по ID
app.get('/api/products/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id < 1) {
            return res.status(400).json({
                error: 'Invalid product ID'
            });
        }

        const key = `product:${id}`;

        const cached = await safeCache(
            () => getCache(key)
        );

        if (cached !== null && cached !== undefined) {
            res.set('X-Cache', 'HIT');
            return res.json(cached);
        }

        const [rows] = await db.execute(
            'SELECT * FROM products WHERE id = ?',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                error: 'Product not found'
            });
        }

        await safeCache(
            () => setCache(key, rows[0], 60)
        );

        res.set('X-Cache', 'MISS');
        res.json(rows[0]);

    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Database error'
        });
    }
});

// Создание товара
app.post('/api/products', async (req, res) => {
    try {
        const { name, price, quantity } = req.body;

        if (
            typeof name !== 'string' ||
            !name.trim() ||
            !Number.isFinite(price) ||
            price < 0 ||
            !Number.isSafeInteger(quantity) ||
            quantity < 0
        ) {
            return res.status(400).json({
                error: 'Invalid product data'
            });
        }

        const [result] = await db.execute(
            `INSERT INTO products (name, price, quantity)
             VALUES (?, ?, ?)`,
            [name.trim(), price, quantity]
        );

        await safeCache(
            () => deleteCache('products:all')
        );

        res.status(201).json({
            id: result.insertId,
            name: name.trim(),
            price,
            quantity
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Database error'
        });
    }
});

// Обновление товара
app.put('/api/products/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { name, price, quantity } = req.body;

        if (!Number.isSafeInteger(id) || id < 1) {
            return res.status(400).json({
                error: 'Invalid product ID'
            });
        }

        if (
            typeof name !== 'string' ||
            !name.trim() ||
            !Number.isFinite(price) ||
            price < 0 ||
            !Number.isSafeInteger(quantity) ||
            quantity < 0
        ) {
            return res.status(400).json({
                error: 'Invalid product data'
            });
        }

        const [result] = await db.execute(
            `UPDATE products
             SET name = ?, price = ?, quantity = ?
             WHERE id = ?`,
            [name.trim(), price, quantity, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: 'Product not found'
            });
        }

        await safeCache(
            () => deleteCache('products:all')
        );

        await safeCache(
            () => deleteCache(`product:${id}`)
        );

        res.json({
            id,
            name: name.trim(),
            price,
            quantity
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Database error'
        });
    }
});

// Удаление товара
app.delete('/api/products/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id < 1) {
            return res.status(400).json({
                error: 'Invalid product ID'
            });
        }

        const [result] = await db.execute(
            'DELETE FROM products WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: 'Product not found'
            });
        }

        await safeCache(
            () => deleteCache('products:all')
        );

        await safeCache(
            () => deleteCache(`product:${id}`)
        );

        res.json({
            message: 'Product deleted'
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Database error'
        });
    }
});

// Статистика склада
app.get('/api/stats', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                COUNT(*) AS total_products,
                COALESCE(SUM(quantity), 0) AS total_items,
                COALESCE(SUM(price * quantity), 0)
                    AS total_value
            FROM products
        `);

        res.json(rows[0]);

    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Database error'
        });
    }
});

// Запуск HTTP-сервера
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Inventory API listening on port ${PORT}`);
});

// Корректное завершение
async function shutdown() {
    console.log('Shutting down...');

    server.close(async () => {
        try {
            await db.end();
            cache.end();
            process.exit(0);
        } catch (err) {
            console.error(err);
            process.exit(1);
        }
    });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
