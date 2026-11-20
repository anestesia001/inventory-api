const Memcached = require('memcached');

const cache = new Memcached(
    process.env.MEMCACHED_HOST || 'memcached:11211',
    {
        retries: 2,
        retry: 1000,
        timeout: 1000
    }
);

function getCache(key) {
    return new Promise((resolve, reject) => {
        cache.get(key, (err, data) => {
            if (err) return reject(err);
            resolve(data);
        });
    });
}

function setCache(key, value, ttl = 60) {
    return new Promise((resolve, reject) => {
        cache.set(key, value, ttl, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

function deleteCache(key) {
    return new Promise((resolve, reject) => {
        cache.del(key, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

module.exports = {
    cache,
    getCache,
    setCache,
    deleteCache
};
