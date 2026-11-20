CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO products (name, price, quantity)
VALUES
    ('Laptop', 85000.00, 10),
    ('Keyboard', 3500.00, 50),
    ('Mouse', 1500.00, 100),
    ('Monitor', 22000.00, 25),
    ('Headphones', 5000.00, 40);
