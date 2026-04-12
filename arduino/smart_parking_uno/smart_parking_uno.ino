#include <Servo.h>

Servo gate;

#define ir_enter 2
#define servo_pin 3
#define ir_exit 4

#define ir_car1 5
#define ir_car2 6
#define ir_car3 7
#define ir_car4 8
#define ir_car5 9

const unsigned long debounceDelay = 800;
const unsigned long gateDelay = 5000;
const unsigned long slotPublishInterval = 500;
const int gateClosedAngle = 10;
const int gateOpenOffset = 90;

bool gateOpen = false;
unsigned long gateTimer = 0;
unsigned long lastEntryTrigger = 0;
unsigned long lastExitTrigger = 0;
unsigned long lastSlotPublish = 0;

int lastSlots[5] = { -1, -1, -1, -1, -1 };

void setup() {
  Serial.begin(9600);

  pinMode(ir_enter, INPUT);
  pinMode(ir_exit, INPUT);

  pinMode(ir_car1, INPUT);
  pinMode(ir_car2, INPUT);
  pinMode(ir_car3, INPUT);
  pinMode(ir_car4, INPUT);
  pinMode(ir_car5, INPUT);

  gate.attach(servo_pin);
  initializeGateClosed();

  Serial.println("READY");
}

void loop() {
  handleSerialCommand();
  handleEntrySensor();
  handleExitSensor();
  publishSlotsIfChanged();
  autoCloseGate();
  delay(30);
}

void handleSerialCommand() {
  if (!Serial.available()) {
    return;
  }

  String command = Serial.readStringUntil('\n');
  command.trim();

  if (command == "CMD:OPEN_GATE") {
    openGate();
  }
}

void handleEntrySensor() {
  if (digitalRead(ir_enter) == LOW && millis() - lastEntryTrigger > debounceDelay) {
    Serial.println("EVENT:ENTRY_SENSOR");
    lastEntryTrigger = millis();
  }
}

void handleExitSensor() {
  if (digitalRead(ir_exit) == LOW && millis() - lastExitTrigger > debounceDelay) {
    Serial.println("EVENT:EXIT_SENSOR");
    lastExitTrigger = millis();
  }
}

void publishSlotsIfChanged() {
  int currentSlots[5];
  readSlots(currentSlots);
  bool changed = false;

  for (int i = 0; i < 5; i++) {
    if (currentSlots[i] != lastSlots[i]) {
      changed = true;
      lastSlots[i] = currentSlots[i];
    }
  }

  if (!changed && millis() - lastSlotPublish < slotPublishInterval) {
    return;
  }

  Serial.print("SLOTS:");
  for (int i = 0; i < 5; i++) {
    Serial.print(currentSlots[i]);
    if (i < 4) {
      Serial.print(",");
    }
  }
  Serial.println();

  lastSlotPublish = millis();
}

void readSlots(int slots[5]) {
  slots[0] = digitalRead(ir_car1) == LOW ? 1 : 0;
  slots[1] = digitalRead(ir_car2) == LOW ? 1 : 0;
  slots[2] = digitalRead(ir_car3) == LOW ? 1 : 0;
  slots[3] = digitalRead(ir_car4) == LOW ? 1 : 0;
  slots[4] = digitalRead(ir_car5) == LOW ? 1 : 0;
}

void openGate() {
  gate.write(getOpenAngle());
  gateOpen = true;
  gateTimer = millis();
}

void closeGate() {
  gate.write(gateClosedAngle);
  gateOpen = false;
}

void initializeGateClosed() {
  // Force a known startup position so the gate always begins fully closed.
  gate.write(gateClosedAngle);
  delay(700);
  gate.write(gateClosedAngle);
  gateOpen = false;
}

int getOpenAngle() {
  return constrain(gateClosedAngle + gateOpenOffset, 0, 180);
}

void autoCloseGate() {
  if (gateOpen && millis() - gateTimer > gateDelay) {
    closeGate();
  }
}
