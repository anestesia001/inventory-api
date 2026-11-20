# Inventory API

Учебное REST API для управления складскими товарами.

**Технологии:** Node.js, Express, MariaDB, Memcached.


## Работа с API

### Получение списка товаров

```bash
curl http://localhost:3000/api/products
```

### Получение товара по ID

```bash
curl http://localhost:3000/api/products/1
```

### Создание товара

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SSD 1TB",
    "price": 7500,
    "quantity": 15
  }'
```

### Обновление товара

```bash
curl -X PUT http://localhost:3000/api/products/1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Gaming Laptop",
    "price": 99000,
    "quantity": 5
  }'
```

### Удаление товара

```bash
curl -X DELETE http://localhost:3000/api/products/1
```

### Статистика склада

```bash
curl http://localhost:3000/api/stats
```

## Проверка Memcached

Выполнить два запроса подряд:

```bash
curl -i http://localhost:3000/api/products
curl -i http://localhost:3000/api/products
```

При исправном кэше первый запрос вернет заголовок:

```text
X-Cache: MISS
```

Второй:

```text
X-Cache: HIT
```

Кэш хранит данные 60 секунд. При создании, обновлении и удалении товаров соответствующие ключи кэша сбрасываются.
