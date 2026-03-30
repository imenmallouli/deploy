import paho.mqtt.client as mqtt
import json
import time

MQTT_HOST = "127.0.0.1"
MQTT_PORT = 1883
DEVICE_ID = "car1"
VEHICLE_ID = 1

client = mqtt.Client()

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Connecté au broker MQTT")
    else:
        print(f"❌ Erreur connexion: {rc}")

client.on_connect = on_connect
client.connect(MQTT_HOST, MQTT_PORT, 60)
client.loop_start()

def publish_telemetry():
    data = {
        "vehicle_id": VEHICLE_ID,
        "speed": 72,
        "rpm": 2100,
        "fuel_level": 50,
        "engine_temp": 90,
        "battery_voltage": 12.5
    }
    topic = f"autodiag/devices/{DEVICE_ID}/telemetry"
    client.publish(topic, json.dumps(data))
    print(f"📤 Publié: {topic}")

def publish_dtc():
    data = {
        "vehicle_id": VEHICLE_ID,
        "code": "P0101",
        "description": "Mass or Volume Air Flow (MAF) Circuit Range/Performance",
        "severity": "warning"
    }
    topic = f"autodiag/devices/{DEVICE_ID}/dtc"
    client.publish(topic, json.dumps(data))
    print(f"📤 Publié: {topic}")

if __name__ == "__main__":
    print("🚀 Démarrage client MQTT...")
    time.sleep(2)
    
    while True:
        publish_telemetry()
        time.sleep(5)
        publish_dtc()
        time.sleep(10)
