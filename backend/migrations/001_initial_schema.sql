-- 001_initial_schema.sql
-- Khởi tạo CSDL 9 bảng cho Hệ thống giám sát Kho hàng

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) NOT NULL DEFAULT 'MONITOR', -- 'ADMIN' hoặc 'MONITOR'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE nodes (
    id VARCHAR(50) PRIMARY KEY, -- NODE_ENV_01, NODE_SEC_01
    name VARCHAR(100) NOT NULL,
    location VARCHAR(100),
    type VARCHAR(20) NOT NULL, -- 'ENVIRONMENT', 'SECURITY'
    status VARCHAR(20) DEFAULT 'OFFLINE', -- 'ONLINE', 'OFFLINE'
    last_heartbeat TIMESTAMP
);

CREATE TABLE sensors (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(50) REFERENCES nodes(id) ON DELETE CASCADE,
    sensor_type VARCHAR(50) NOT NULL, -- 'DHT22_TEMP', 'DHT22_HUM', 'MQ2', 'MC38', 'PIR'
    unit VARCHAR(20)
);

CREATE TABLE telemetry (
    id BIGSERIAL PRIMARY KEY,
    node_id VARCHAR(50) REFERENCES nodes(id) ON DELETE CASCADE,
    temperature NUMERIC(5, 2),
    humidity NUMERIC(5, 2),
    smoke_level NUMERIC(7, 2),
    door_open BOOLEAN,
    motion_detected BOOLEAN,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE actuators (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(50) REFERENCES nodes(id) ON DELETE CASCADE,
    actuator_type VARCHAR(50) NOT NULL, -- 'RELAY_FAN', 'BUZZER'
    state BOOLEAN DEFAULT FALSE
);

CREATE TABLE alert_rules (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(50) NOT NULL, -- 'temperature', 'smoke_level'
    threshold_value NUMERIC(7, 2) NOT NULL,
    comparison_operator VARCHAR(5) NOT NULL, -- '>', '<', '>='
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(50) REFERENCES nodes(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL, -- 'INFO', 'WARNING', 'CRITICAL'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE device_controls (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    actuator_id INT REFERENCES actuators(id),
    command VARCHAR(50) NOT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Audit Log ghi vết thao tác bảo mật và quản trị
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- 'USER_LOGIN', 'CHANGE_THRESHOLD', 'TOGGLE_RELAY'
    ip_address VARCHAR(45),
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);