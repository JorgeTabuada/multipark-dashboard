-- MultiPark Dashboard - Initial Schema
-- Created: 2025-07-11

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Bookings table
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    license_plate VARCHAR(20) NOT NULL,
    checkout_timestamp TIMESTAMP WITH TIME ZONE,
    checkout_formatted VARCHAR(50),
    price_delivery DECIMAL(10,2) DEFAULT 0.00,
    park_brand VARCHAR(50),
    payment_method VARCHAR(50),
    name VARCHAR(100),
    lastname VARCHAR(100),
    extra_services TEXT,
    parking_type VARCHAR(50),
    campaign VARCHAR(100),
    alocation VARCHAR(100),
    campaign_pay BOOLEAN,
    booking_date VARCHAR(50),
    check_in VARCHAR(50),
    booking_price DECIMAL(10,2),
    has_online_payment BOOLEAN,
    stats VARCHAR(50),
    row VARCHAR(50),
    delivery_price DECIMAL(10,2),
    payment_intent_id VARCHAR(100),
    
    -- Calculated fields
    date_difference_days INTEGER DEFAULT 0,
    needs_approval BOOLEAN DEFAULT FALSE,
    status_approved BOOLEAN DEFAULT FALSE,
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Financial splits table
CREATE TABLE financial_splits (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
    partner_amount_60 DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    multipark_amount_40 DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_bookings_license_plate ON bookings(license_plate);
CREATE INDEX idx_bookings_park_brand ON bookings(park_brand);
CREATE INDEX idx_bookings_payment_method ON bookings(payment_method);
CREATE INDEX idx_bookings_status_approved ON bookings(status_approved);
CREATE INDEX idx_bookings_needs_approval ON bookings(needs_approval);
CREATE INDEX idx_bookings_created_at ON bookings(created_at);
CREATE INDEX idx_financial_splits_booking_id ON financial_splits(booking_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bookings_updated_at 
    BEFORE UPDATE ON bookings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) - opcional
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_splits ENABLE ROW LEVEL SECURITY;

-- Policies (adjust as needed)
CREATE POLICY "Allow all operations for authenticated users" ON bookings
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users" ON financial_splits
    FOR ALL USING (auth.role() = 'authenticated');

-- Views for reporting
CREATE VIEW booking_summary AS
SELECT 
    park_brand,
    payment_method,
    COUNT(*) as total_bookings,
    SUM(price_delivery) as total_amount,
    SUM(CASE WHEN status_approved THEN 1 ELSE 0 END) as approved_count,
    SUM(CASE WHEN needs_approval AND NOT status_approved THEN 1 ELSE 0 END) as pending_count,
    AVG(date_difference_days) as avg_date_difference
FROM bookings
GROUP BY park_brand, payment_method
ORDER BY total_amount DESC;

CREATE VIEW financial_summary AS
SELECT 
    b.park_brand,
    b.payment_method,
    COUNT(*) as booking_count,
    SUM(fs.total_amount) as total_amount,
    SUM(fs.partner_amount_60) as partner_total,
    SUM(fs.multipark_amount_40) as multipark_total
FROM bookings b
JOIN financial_splits fs ON b.id = fs.booking_id
GROUP BY b.park_brand, b.payment_method
ORDER BY total_amount DESC;

-- Insert some test data (optional)
INSERT INTO bookings (
    license_plate, checkout_timestamp, checkout_formatted, 
    price_delivery, park_brand, payment_method, name, lastname,
    date_difference_days, needs_approval, status_approved
) VALUES 
    ('TEST123', '2025-07-11 14:30:00+00', '11/07/2025, 14:30', 35.00, 'skypark', 'Multibanco', 'João', 'Silva', 0, FALSE, TRUE),
    ('TEST456', '2025-07-10 16:45:00+00', '12/07/2025, 18:00', 28.50, 'airpark', 'Credit Card', 'Maria', 'Santos', 2, TRUE, FALSE);

-- Insert corresponding financial splits
INSERT INTO financial_splits (booking_id, partner_amount_60, multipark_amount_40, total_amount)
SELECT 
    id,
    ROUND(price_delivery * 0.60, 2),
    ROUND(price_delivery * 0.40, 2),
    price_delivery
FROM bookings;

-- Function to automatically create financial split on booking insert
CREATE OR REPLACE FUNCTION create_financial_split()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO financial_splits (
        booking_id, 
        partner_amount_60, 
        multipark_amount_40, 
        total_amount
    ) VALUES (
        NEW.id,
        ROUND(NEW.price_delivery * 0.60, 2),
        ROUND(NEW.price_delivery * 0.40, 2),
        NEW.price_delivery
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_financial_split_trigger
    AFTER INSERT ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION create_financial_split();
