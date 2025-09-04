package main

import (
    "context"
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "os"
    "os/signal"
    "sync"
    "syscall"
    "time"

    "github.com/gin-gonic/gin"
    "github.com/gorilla/websocket"
    mqtt "github.com/eclipse/paho.mqtt.golang"
    "github.com/go-redis/redis/v8"
    "github.com/nats-io/nats.go"
    "github.com/segmentio/kafka-go"
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promhttp"
    "go.uber.org/zap"
    "gorm.io/gorm"
    "gorm.io/driver/postgres"
    
    "krishimitra/iot-gateway/internal/config"
    "krishimitra/iot-gateway/internal/models"
    "krishimitra/iot-gateway/internal/handlers"
    "krishimitra/iot-gateway/internal/processors"
    "krishimitra/iot-gateway/internal/protocols"
)

// IoTGateway represents the main IoT gateway service
type IoTGateway struct {
    config          *config.Config
    logger          *zap.Logger
    db              *gorm.DB
    redis           *redis.Client
    nats            *nats.Conn
    kafka           *kafka.Writer
    mqtt            mqtt.Client
    httpServer      *http.Server
    wsUpgrader      websocket.Upgrader
    processors      map[string]processors.DataProcessor
    protocols       map[string]protocols.Protocol
    deviceRegistry  *DeviceRegistry
    metrics         *Metrics
    shutdownChan    chan os.Signal
    wg              sync.WaitGroup
}

// DeviceRegistry manages connected IoT devices
type DeviceRegistry struct {
    devices     map[string]*models.Device
    connections map[string]*websocket.Conn
    mutex       sync.RWMutex
}

// Metrics for monitoring
type Metrics struct {
    MessagesReceived    prometheus.Counter
    MessagesProcessed   prometheus.Counter
    MessagesFailed      prometheus.Counter
    DevicesConnected    prometheus.Gauge
    DataProcessingTime  prometheus.Histogram
    ProtocolConnections prometheus.CounterVec
}

func NewIoTGateway(cfg *config.Config) *IoTGateway {
    logger, _ := zap.NewProduction()
    
    gateway := &IoTGateway{
        config:         cfg,
        logger:         logger,
        processors:     make(map[string]processors.DataProcessor),
        protocols:      make(map[string]protocols.Protocol),
        deviceRegistry: &DeviceRegistry{
            devices:     make(map[string]*models.Device),
            connections: make(map[string]*websocket.Conn),
        },
        shutdownChan:   make(chan os.Signal, 1),
        wsUpgrader: websocket.Upgrader{
            CheckOrigin: func(r *http.Request) bool {
                return true // Configure based on requirements
            },
        },
    }
    
    gateway.initMetrics()
    return gateway
}

func (g *IoTGateway) initMetrics() {
    g.metrics = &Metrics{
        MessagesReceived: prometheus.NewCounter(prometheus.CounterOpts{
            Name: "iot_messages_received_total",
            Help: "Total number of IoT messages received",
        }),
        MessagesProcessed: prometheus.NewCounter(prometheus.CounterOpts{
            Name: "iot_messages_processed_total",
            Help: "Total number of IoT messages processed successfully",
        }),
        MessagesFailed: prometheus.NewCounter(prometheus.CounterOpts{
            Name: "iot_messages_failed_total",
            Help: "Total number of IoT messages that failed processing",
        }),
        DevicesConnected: prometheus.NewGauge(prometheus.GaugeOpts{
            Name: "iot_devices_connected",
            Help: "Number of currently connected IoT devices",
        }),
        DataProcessingTime: prometheus.NewHistogram(prometheus.HistogramOpts{
            Name:    "iot_data_processing_duration_seconds",
            Help:    "Duration of IoT data processing",
            Buckets: []float64{0.001, 0.01, 0.1, 1, 5, 10, 30},
        }),
        ProtocolConnections: *prometheus.NewCounterVec(prometheus.CounterOpts{
            Name: "iot_protocol_connections_total",
            Help: "Total number of connections by protocol",
        }, []string{"protocol"}),
    }
    
    prometheus.MustRegister(
        g.metrics.MessagesReceived,
        g.metrics.MessagesProcessed,
        g.metrics.MessagesFailed,
        g.metrics.DevicesConnected,
        g.metrics.DataProcessingTime,
        &g.metrics.ProtocolConnections,
    )
}

func (g *IoTGateway) Initialize() error {
    g.logger.Info("Initializing IoT Gateway")
    
    // Initialize database
    if err := g.initDatabase(); err != nil {
        return fmt.Errorf("failed to initialize database: %w", err)
    }
    
    // Initialize Redis
    if err := g.initRedis(); err != nil {
        return fmt.Errorf("failed to initialize Redis: %w", err)
    }
    
    // Initialize NATS
    if err := g.initNATS(); err != nil {
        return fmt.Errorf("failed to initialize NATS: %w", err)
    }
    
    // Initialize Kafka
    if err := g.initKafka(); err != nil {
        return fmt.Errorf("failed to initialize Kafka: %w", err)
    }
    
    // Initialize MQTT
    if err := g.initMQTT(); err != nil {
        return fmt.Errorf("failed to initialize MQTT: %w", err)
    }
    
    // Initialize protocols
    g.initProtocols()
    
    // Initialize data processors
    g.initProcessors()
    
    // Setup HTTP server
    g.setupHTTPServer()
    
    g.logger.Info("IoT Gateway initialized successfully")
    return nil
}

func (g *IoTGateway) initDatabase() error {
    dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable",
        g.config.Database.Host,
        g.config.Database.User,
        g.config.Database.Password,
        g.config.Database.Name,
        g.config.Database.Port,
    )
    
    db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
    if err != nil {
        return err
    }
    
    // Auto-migrate models
    err = db.AutoMigrate(
        &models.Device{},
        &models.SensorData{},
        &models.DeviceStatus{},
        &models.Alert{},
    )
    if err != nil {
        return err
    }
    
    g.db = db
    return nil
}

func (g *IoTGateway) initRedis() error {
    g.redis = redis.NewClient(&redis.Options{
        Addr:     g.config.Redis.Addr,
        Password: g.config.Redis.Password,
        DB:       g.config.Redis.DB,
    })
    
    _, err := g.redis.Ping(context.Background()).Result()
    return err
}

func (g *IoTGateway) initNATS() error {
    nc, err := nats.Connect(g.config.NATS.URL)
    if err != nil {
        return err
    }
    g.nats = nc
    return nil
}

func (g *IoTGateway) initKafka() error {
    g.kafka = &kafka.Writer{
        Addr:         kafka.TCP(g.config.Kafka.Brokers...),
        Topic:        g.config.Kafka.Topic,
        Balancer:     &kafka.LeastBytes{},
        RequiredAcks: kafka.RequireOne,
        Async:        true,
    }
    return nil
}

func (g *IoTGateway) initMQTT() error {
    opts := mqtt.NewClientOptions()
    opts.AddBroker(g.config.MQTT.Broker)
    opts.SetClientID(g.config.MQTT.ClientID)
    opts.SetUsername(g.config.MQTT.Username)
    opts.SetPassword(g.config.MQTT.Password)
    opts.SetDefaultPublishHandler(g.mqttMessageHandler)
    opts.SetOnConnectHandler(func(client mqtt.Client) {
        g.logger.Info("Connected to MQTT broker")
        g.metrics.ProtocolConnections.WithLabelValues("mqtt").Inc()
    })
    opts.SetConnectionLostHandler(func(client mqtt.Client, err error) {
        g.logger.Error("Lost connection to MQTT broker", zap.Error(err))
    })
    
    g.mqtt = mqtt.NewClient(opts)
    
    if token := g.mqtt.Connect(); token.Wait() && token.Error() != nil {
        return token.Error()
    }
    
    // Subscribe to device topics
    topics := []string{
        "krishimitra/sensors/+/data",
        "krishimitra/devices/+/status",
        "krishimitra/alerts/+",
    }
    
    for _, topic := range topics {
        if token := g.mqtt.Subscribe(topic, 0, nil); token.Wait() && token.Error() != nil {
            g.logger.Error("Failed to subscribe to topic", zap.String("topic", topic), zap.Error(token.Error()))
        }
    }
    
    return nil
}

func (g *IoTGateway) initProtocols() {
    g.protocols["lorawan"] = protocols.NewLoRaWAN(g.config.LoRaWAN)
    g.protocols["nbiot"] = protocols.NewNBIoT(g.config.NBIoT)
    g.protocols["wifi"] = protocols.NewWiFi(g.config.WiFi)
    g.protocols["bluetooth"] = protocols.NewBluetooth(g.config.Bluetooth)
    g.protocols["zigbee"] = protocols.NewZigbee(g.config.Zigbee)
}

func (g *IoTGateway) initProcessors() {
    g.processors["sensor"] = processors.NewSensorDataProcessor(g.db, g.redis)
    g.processors["weather"] = processors.NewWeatherDataProcessor(g.db, g.redis)
    g.processors["soil"] = processors.NewSoilDataProcessor(g.db, g.redis)
    g.processors["irrigation"] = processors.NewIrrigationProcessor(g.db, g.redis)
    g.processors["camera"] = processors.NewCameraDataProcessor(g.db, g.redis)
    g.processors["drone"] = processors.NewDroneDataProcessor(g.db, g.redis)
}

func (g *IoTGateway) setupHTTPServer() {
    gin.SetMode(gin.ReleaseMode)
    router := gin.New()
    router.Use(gin.Logger(), gin.Recovery())
    
    // Metrics endpoint
    router.GET("/metrics", gin.WrapH(promhttp.Handler()))
    
    // Health check
    router.GET("/health", g.healthCheck)
    
    // Device management
    api := router.Group("/api/v1")
    {
        api.POST("/devices/register", g.registerDevice)
        api.PUT("/devices/:id/status", g.updateDeviceStatus)
        api.GET("/devices", g.listDevices)
        api.GET("/devices/:id", g.getDevice)
        api.DELETE("/devices/:id", g.unregisterDevice)
        
        // WebSocket endpoint for real-time data
        api.GET("/ws", g.handleWebSocket)
        
        // Data endpoints
        api.POST("/data", g.receiveData)
        api.GET("/data/:deviceId", g.getDeviceData)
        
        // Commands
        api.POST("/devices/:id/commands", g.sendCommand)
        
        // Alerts
        api.GET("/alerts", g.getAlerts)
        api.PUT("/alerts/:id/acknowledge", g.acknowledgeAlert)
    }
    
    g.httpServer = &http.Server{
        Addr:    fmt.Sprintf(":%d", g.config.Server.Port),
        Handler: router,
    }
}

func (g *IoTGateway) mqttMessageHandler(client mqtt.Client, msg mqtt.Message) {
    g.metrics.MessagesReceived.Inc()
    start := time.Now()
    
    defer func() {
        g.metrics.DataProcessingTime.Observe(time.Since(start).Seconds())
    }()
    
    topic := msg.Topic()
    payload := msg.Payload()
    
    g.logger.Info("Received MQTT message",
        zap.String("topic", topic),
        zap.Int("payload_size", len(payload)),
    )
    
    // Parse message and route to appropriate processor
    var message models.IoTMessage
    if err := json.Unmarshal(payload, &message); err != nil {
        g.logger.Error("Failed to unmarshal MQTT message", zap.Error(err))
        g.metrics.MessagesFailed.Inc()
        return
    }
    
    if err := g.processMessage(&message); err != nil {
        g.logger.Error("Failed to process MQTT message", zap.Error(err))
        g.metrics.MessagesFailed.Inc()
        return
    }
    
    g.metrics.MessagesProcessed.Inc()
}

func (g *IoTGateway) processMessage(message *models.IoTMessage) error {
    // Validate device
    device, err := g.getDeviceFromRegistry(message.DeviceID)
    if err != nil {
        return fmt.Errorf("device not found: %w", err)
    }
    
    // Update device last seen
    device.LastSeen = time.Now()
    g.updateDeviceInRegistry(device)
    
    // Route to appropriate processor based on message type
    processor, exists := g.processors[message.Type]
    if !exists {
        processor = g.processors["sensor"] // Default processor
    }
    
    processedData, err := processor.Process(message)
    if err != nil {
        return fmt.Errorf("failed to process message: %w", err)
    }
    
    // Store processed data
    if err := g.storeProcessedData(processedData); err != nil {
        g.logger.Error("Failed to store processed data", zap.Error(err))
    }
    
    // Publish to message queue for downstream processing
    if err := g.publishToMessageQueue(processedData); err != nil {
        g.logger.Error("Failed to publish to message queue", zap.Error(err))
    }
    
    // Check for alerts
    alerts := g.checkAlerts(processedData)
    for _, alert := range alerts {
        g.processAlert(alert)
    }
    
    // Broadcast to connected WebSocket clients
    g.broadcastToWebSocketClients(processedData)
    
    return nil
}

func (g *IoTGateway) getDeviceFromRegistry(deviceID string) (*models.Device, error) {
    g.deviceRegistry.mutex.RLock()
    defer g.deviceRegistry.mutex.RUnlock()
    
    device, exists := g.deviceRegistry.devices[deviceID]
    if !exists {
        return nil, fmt.Errorf("device %s not found in registry", deviceID)
    }
    
    return device, nil
}

func (g *IoTGateway) updateDeviceInRegistry(device *models.Device) {
    g.deviceRegistry.mutex.Lock()
    defer g.deviceRegistry.mutex.Unlock()
    
    g.deviceRegistry.devices[device.ID] = device
    
    // Update database
    g.db.Save(device)
    
    // Update Redis cache
    deviceJSON, _ := json.Marshal(device)
    g.redis.Set(context.Background(), fmt.Sprintf("device:%s", device.ID), deviceJSON, time.Hour)
}

func (g *IoTGateway) storeProcessedData(data interface{}) error {
    // Store in database
    if sensorData, ok := data.(*models.SensorData); ok {
        return g.db.Create(sensorData).Error
    }
    
    // Store in time-series database (InfluxDB) for analytics
    // Implementation depends on specific data type
    
    return nil
}

func (g *IoTGateway) publishToMessageQueue(data interface{}) error {
    // Publish to Kafka
    dataJSON, err := json.Marshal(data)
    if err != nil {
        return err
    }
    
    return g.kafka.WriteMessages(context.Background(),
        kafka.Message{
            Key:   []byte("iot-data"),
            Value: dataJSON,
        },
    )
}

func (g *IoTGateway) checkAlerts(data interface{}) []*models.Alert {
    // Implement alert checking logic based on data type and thresholds
    var alerts []*models.Alert
    
    if sensorData, ok := data.(*models.SensorData); ok {
        // Check temperature alerts
        if sensorData.Temperature > 40 || sensorData.Temperature < 5 {
            alert := &models.Alert{
                DeviceID:    sensorData.DeviceID,
                Type:        "temperature",
                Severity:    "warning",
                Message:     fmt.Sprintf("Temperature out of range: %.2f°C", sensorData.Temperature),
                Timestamp:   time.Now(),
                Acknowledged: false,
            }
            alerts = append(alerts, alert)
        }
        
        // Check soil moisture alerts
        if sensorData.SoilMoisture < 30 {
            alert := &models.Alert{
                DeviceID:    sensorData.DeviceID,
                Type:        "soil_moisture",
                Severity:    "critical",
                Message:     fmt.Sprintf("Low soil moisture: %.2f%%", sensorData.SoilMoisture),
                Timestamp:   time.Now(),
                Acknowledged: false,
            }
            alerts = append(alerts, alert)
        }
    }
    
    return alerts
}

func (g *IoTGateway) processAlert(alert *models.Alert) {
    // Store alert in database
    g.db.Create(alert)
    
    // Send notification via various channels
    g.sendAlertNotification(alert)
    
    // Publish alert to message queue
    alertJSON, _ := json.Marshal(alert)
    g.nats.Publish("krishimitra.alerts", alertJSON)
}

func (g *IoTGateway) sendAlertNotification(alert *models.Alert) {
    // Implementation for sending notifications via:
    // - SMS
    // - Email  
    // - WhatsApp
    // - Push notifications
    // - WebSocket to connected clients
}

func (g *IoTGateway) broadcastToWebSocketClients(data interface{}) {
    g.deviceRegistry.mutex.RLock()
    defer g.deviceRegistry.mutex.RUnlock()
    
    dataJSON, _ := json.Marshal(data)
    
    for deviceID, conn := range g.deviceRegistry.connections {
        if err := conn.WriteMessage(websocket.TextMessage, dataJSON); err != nil {
            g.logger.Error("Failed to send WebSocket message",
                zap.String("device_id", deviceID),
                zap.Error(err),
            )
            conn.Close()
            delete(g.deviceRegistry.connections, deviceID)
        }
    }
}

// HTTP Handlers
func (g *IoTGateway) healthCheck(c *gin.Context) {
    status := map[string]interface{}{
        "status":    "healthy",
        "timestamp": time.Now(),
        "version":   "1.0.0",
        "services": map[string]bool{
            "database": g.db != nil,
            "redis":    g.redis != nil,
            "nats":     g.nats != nil,
            "kafka":    g.kafka != nil,
            "mqtt":     g.mqtt != nil && g.mqtt.IsConnected(),
        },
        "metrics": map[string]interface{}{
            "connected_devices": len(g.deviceRegistry.devices),
            "active_connections": len(g.deviceRegistry.connections),
        },
    }
    
    c.JSON(http.StatusOK, status)
}

func (g *IoTGateway) registerDevice(c *gin.Context) {
    var device models.Device
    if err := c.ShouldBindJSON(&device); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    device.ID = generateDeviceID()
    device.RegisteredAt = time.Now()
    device.LastSeen = time.Now()
    device.Status = "active"
    
    if err := g.db.Create(&device).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to register device"})
        return
    }
    
    g.deviceRegistry.mutex.Lock()
    g.deviceRegistry.devices[device.ID] = &device
    g.deviceRegistry.mutex.Unlock()
    
    g.metrics.DevicesConnected.Inc()
    
    c.JSON(http.StatusCreated, device)
}

func (g *IoTGateway) handleWebSocket(c *gin.Context) {
    conn, err := g.wsUpgrader.Upgrade(c.Writer, c.Request, nil)
    if err != nil {
        g.logger.Error("Failed to upgrade WebSocket connection", zap.Error(err))
        return
    }
    defer conn.Close()
    
    deviceID := c.Query("device_id")
    if deviceID == "" {
        conn.WriteMessage(websocket.CloseMessage, []byte("device_id required"))
        return
    }
    
    g.deviceRegistry.mutex.Lock()
    g.deviceRegistry.connections[deviceID] = conn
    g.deviceRegistry.mutex.Unlock()
    
    defer func() {
        g.deviceRegistry.mutex.Lock()
        delete(g.deviceRegistry.connections, deviceID)
        g.deviceRegistry.mutex.Unlock()
    }()
    
    // Keep connection alive
    for {
        _, _, err := conn.ReadMessage()
        if err != nil {
            break
        }
    }
}

func (g *IoTGateway) Start() error {
    g.logger.Info("Starting IoT Gateway server", zap.Int("port", g.config.Server.Port))
    
    // Start protocol listeners
    g.wg.Add(1)
    go func() {
        defer g.wg.Done()
        g.startProtocolListeners()
    }()
    
    // Start HTTP server
    g.wg.Add(1)
    go func() {
        defer g.wg.Done()
        if err := g.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            g.logger.Fatal("Failed to start HTTP server", zap.Error(err))
        }
    }()
    
    // Start background workers
    g.wg.Add(1)
    go func() {
        defer g.wg.Done()
        g.startBackgroundWorkers()
    }()
    
    // Handle shutdown signals
    signal.Notify(g.shutdownChan, os.Interrupt, syscall.SIGTERM)
    
    return nil
}

func (g *IoTGateway) startProtocolListeners() {
    for name, protocol := range g.protocols {
        g.wg.Add(1)
        go func(name string, protocol protocols.Protocol) {
            defer g.wg.Done()
            g.logger.Info("Starting protocol listener", zap.String("protocol", name))
            if err := protocol.Start(); err != nil {
                g.logger.Error("Failed to start protocol", zap.String("protocol", name), zap.Error(err))
            }
        }(name, protocol)
    }
}

func (g *IoTGateway) startBackgroundWorkers() {
    // Device health monitoring
    ticker := time.NewTicker(30 * time.Second)
    defer ticker.Stop()
    
    for {
        select {
        case <-ticker.C:
            g.monitorDeviceHealth()
        case <-g.shutdownChan:
            return
        }
    }
}

func (g *IoTGateway) monitorDeviceHealth() {
    g.deviceRegistry.mutex.RLock()
    defer g.deviceRegistry.mutex.RUnlock()
    
    now := time.Now()
    for _, device := range g.deviceRegistry.devices {
        if now.Sub(device.LastSeen) > 5*time.Minute {
            // Mark device as offline
            device.Status = "offline"
            g.db.Save(device)
            
            // Create alert
            alert := &models.Alert{
                DeviceID:     device.ID,
                Type:         "device_offline",
                Severity:     "warning",
                Message:      fmt.Sprintf("Device %s has been offline for %v", device.Name, now.Sub(device.LastSeen)),
                Timestamp:    now,
                Acknowledged: false,
            }
            g.processAlert(alert)
        }
    }
}

func (g *IoTGateway) Shutdown() error {
    g.logger.Info("Shutting down IoT Gateway")
    
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    
    // Shutdown HTTP server
    if err := g.httpServer.Shutdown(ctx); err != nil {
        g.logger.Error("Failed to shutdown HTTP server", zap.Error(err))
    }
    
    // Close protocol connections
    for name, protocol := range g.protocols {
        g.logger.Info("Stopping protocol", zap.String("protocol", name))
        protocol.Stop()
    }
    
    // Close message queue connections
    if g.mqtt != nil {
        g.mqtt.Disconnect(250)
    }
    
    if g.nats != nil {
        g.nats.Close()
    }
    
    if g.kafka != nil {
        g.kafka.Close()
    }
    
    if g.redis != nil {
        g.redis.Close()
    }
    
    // Wait for goroutines
    g.wg.Wait()
    
    g.logger.Info("IoT Gateway shutdown completed")
    return nil
}

func generateDeviceID() string {
    return fmt.Sprintf("device_%d", time.Now().UnixNano())
}

func main() {
    cfg := config.Load()
    
    gateway := NewIoTGateway(cfg)
    
    if err := gateway.Initialize(); err != nil {
        log.Fatalf("Failed to initialize IoT Gateway: %v", err)
    }
    
    if err := gateway.Start(); err != nil {
        log.Fatalf("Failed to start IoT Gateway: %v", err)
    }
    
    // Wait for shutdown signal
    <-gateway.shutdownChan
    
    if err := gateway.Shutdown(); err != nil {
        log.Fatalf("Failed to shutdown IoT Gateway: %v", err)
    }
}
