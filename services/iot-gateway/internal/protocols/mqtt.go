package protocols

import (
    "encoding/json"
    "fmt"
    "log"
    "time"

    mqtt "github.com/eclipse/paho.mqtt.golang"
    "krishimitra/iot-gateway/internal/models"
)

type MQTTProtocol struct {
    client   mqtt.Client
    config   *MQTTConfig
    handlers map[string]MessageHandler
}

type MQTTConfig struct {
    Broker   string
    Port     int
    Username string
    Password string
    ClientID string
    Topics   []string
}

type MessageHandler func(*models.IoTMessage) error

func NewMQTTProtocol(config *MQTTConfig) *MQTTProtocol {
    return &MQTTProtocol{
        config:   config,
        handlers: make(map[string]MessageHandler),
    }
}

func (m *MQTTProtocol) Start() error {
    opts := mqtt.NewClientOptions()
    opts.AddBroker(fmt.Sprintf("tcp://%s:%d", m.config.Broker, m.config.Port))
    opts.SetClientID(m.config.ClientID)
    opts.SetUsername(m.config.Username)
    opts.SetPassword(m.config.Password)
    opts.SetKeepAlive(60 * time.Second)
    opts.SetDefaultPublishHandler(m.messageHandler)
    opts.SetPingTimeout(1 * time.Second)
    opts.SetConnectTimeout(5 * time.Second)
    opts.SetAutoReconnect(true)
    opts.SetMaxReconnectInterval(10 * time.Second)
    
    opts.SetOnConnectHandler(func(c mqtt.Client) {
        log.Println("MQTT: Connected to broker")
        
        // Subscribe to topics
        for _, topic := range m.config.Topics {
            if token := c.Subscribe(topic, 0, nil); token.Wait() && token.Error() != nil {
                log.Printf("MQTT: Failed to subscribe to topic %s: %v", topic, token.Error())
            } else {
                log.Printf("MQTT: Subscribed to topic: %s", topic)
            }
        }
    })

    opts.SetConnectionLostHandler(func(c mqtt.Client, err error) {
        log.Printf("MQTT: Connection lost: %v", err)
    })

    m.client = mqtt.NewClient(opts)
    
    if token := m.client.Connect(); token.Wait() && token.Error() != nil {
        return fmt.Errorf("failed to connect to MQTT broker: %w", token.Error())
    }

    log.Println("MQTT Protocol started successfully")
    return nil
}

func (m *MQTTProtocol) Stop() error {
    if m.client != nil && m.client.IsConnected() {
        m.client.Disconnect(250)
    }
    log.Println("MQTT Protocol stopped")
    return nil
}

func (m *MQTTProtocol) RegisterHandler(messageType string, handler MessageHandler) {
    m.handlers[messageType] = handler
}

func (m *MQTTProtocol) messageHandler(client mqtt.Client, msg mqtt.Message) {
    log.Printf("MQTT: Received message on topic %s: %s", msg.Topic(), string(msg.Payload()))

    var iotMessage models.IoTMessage
    if err := json.Unmarshal(msg.Payload(), &iotMessage); err != nil {
        log.Printf("MQTT: Failed to unmarshal message: %v", err)
        return
    }

    // Set additional metadata
    iotMessage.Protocol = "MQTT"
    iotMessage.Topic = msg.Topic()
    iotMessage.Timestamp = time.Now()

    // Route to appropriate handler
    if handler, exists := m.handlers[iotMessage.Type]; exists {
        if err := handler(&iotMessage); err != nil {
            log.Printf("MQTT: Handler error for message type %s: %v", iotMessage.Type, err)
        }
    } else if handler, exists := m.handlers["default"]; exists {
        if err := handler(&iotMessage); err != nil {
            log.Printf("MQTT: Default handler error: %v", err)
        }
    } else {
        log.Printf("MQTT: No handler found for message type: %s", iotMessage.Type)
    }
}

func (m *MQTTProtocol) PublishMessage(topic string, message interface{}) error {
    if !m.client.IsConnected() {
        return fmt.Errorf("MQTT client not connected")
    }

    payload, err := json.Marshal(message)
    if err != nil {
        return fmt.Errorf("failed to marshal message: %w", err)
    }

    token := m.client.Publish(topic, 0, false, payload)
    token.Wait()
    
    if token.Error() != nil {
        return fmt.Errorf("failed to publish message: %w", token.Error())
    }

    log.Printf("MQTT: Published message to topic %s", topic)
    return nil
}

func (m *MQTTProtocol) Subscribe(topic string, handler MessageHandler) error {
    if !m.client.IsConnected() {
        return fmt.Errorf("MQTT client not connected")
    }

    token := m.client.Subscribe(topic, 0, func(client mqtt.Client, msg mqtt.Message) {
        var iotMessage models.IoTMessage
        if err := json.Unmarshal(msg.Payload(), &iotMessage); err != nil {
            log.Printf("MQTT: Failed to unmarshal subscription message: %v", err)
            return
        }

        iotMessage.Protocol = "MQTT"
        iotMessage.Topic = msg.Topic()
        iotMessage.Timestamp = time.Now()

        if err := handler(&iotMessage); err != nil {
            log.Printf("MQTT: Subscription handler error: %v", err)
        }
    })

    token.Wait()
    if token.Error() != nil {
        return fmt.Errorf("failed to subscribe to topic %s: %w", topic, token.Error())
    }

    log.Printf("MQTT: Subscribed to topic: %s", topic)
    return nil
}

func (m *MQTTProtocol) IsConnected() bool {
    return m.client != nil && m.client.IsConnected()
}

func (m *MQTTProtocol) GetProtocolName() string {
    return "MQTT"
}
