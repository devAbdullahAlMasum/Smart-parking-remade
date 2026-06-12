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

#define red_led1 10
#define red_led2 11
#define red_led3 12

const unsigned long gateDelay = 5000;
const unsigned long lockdownBlinkDelay = 300;
const int gateClosedAngle = 10;
const int gateOpenOffset = 90;
const int slotLedPins[5] = { A0, A1, A2, A3, A4 };
const int slotIrPins[5] = { ir_car1, ir_car2, ir_car3, ir_car4, ir_car5 };
const int redLedPins[3] = { red_led1, red_led2, red_led3 };

bool gateOpen = false;
bool lockdownActive = false;
bool lockdownLightsOn = false;
unsigned long gateTimer = 0;
unsigned long lockdownBlinkTimer = 0;
int assignedSlot = -1;

int lastEntryState = -1;
int lastExitState = -1;
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

  for (int i = 0; i < 5; i++) {
    pinMode(slotLedPins[i], OUTPUT);
    digitalWrite(slotLedPins[i], LOW);
  }

  for (int i = 0; i < 3; i++) {
    pinMode(redLedPins[i], OUTPUT);
    digitalWrite(redLedPins[i], LOW);
  }

  gate.attach(servo_pin);
  initializeGateClosed();

  Serial.println("READY");
}

void checkAutoClearSlot() {
  if (assignedSlot != -1) {
    if (digitalRead(slotIrPins[assignedSlot]) == LOW) {
      clearAssignedSlot();
    }
  }
}

void loop() {
  handleSerialCommand();
  handleEntrySensor();
  handleExitSensor();
  publishSlotsIfChanged();
  handleLockdownLights();
  checkAutoClearSlot();
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
    return;
  }

  if (command.startsWith("CMD:ASSIGN_SLOT:")) {
    int slotNumber = command.substring(16).toInt();
    assignSlot(slotNumber);
    return;
  }

  if (command == "CMD:CLEAR_ASSIGNED_SLOT") {
    clearAssignedSlot();
    return;
  }

  if (command == "CMD:LOCKDOWN_ON") {
    setLockdown(true);
    return;
  }

  if (command == "CMD:LOCKDOWN_OFF") {
    setLockdown(false);
  }
}

void handleEntrySensor() {
  int currentState = digitalRead(ir_enter) == LOW ? 1 : 0;
  if (currentState != lastEntryState) {
    Serial.print("ENTRY_SENSOR:");
    Serial.println(currentState);
    lastEntryState = currentState;
  }
}

void handleExitSensor() {
  int currentState = digitalRead(ir_exit) == LOW ? 1 : 0;
  if (currentState != lastExitState) {
    Serial.print("EXIT_SENSOR:");
    Serial.println(currentState);
    lastExitState = currentState;
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

  if (!changed) {
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
}

void readSlots(int slots[5]) {
  slots[0] = digitalRead(ir_car1) == LOW ? 1 : 0;
  slots[1] = digitalRead(ir_car2) == LOW ? 1 : 0;
  slots[2] = digitalRead(ir_car3) == LOW ? 1 : 0;
  slots[3] = digitalRead(ir_car4) == LOW ? 1 : 0;
  slots[4] = digitalRead(ir_car5) == LOW ? 1 : 0;
}

void openGate() {
  if (lockdownActive) {
    closeGate();
    Serial.println("GATE_BLOCKED:LOCKDOWN");
    return;
  }

  gate.write(getOpenAngle());
  gateOpen = true;
  gateTimer = millis();
}

void closeGate() {
  gate.write(gateClosedAngle);
  gateOpen = false;
}

void assignSlot(int slotNumber) {
  if (slotNumber < 1 || slotNumber > 5) {
    Serial.println("ASSIGNED_SLOT:INVALID");
    return;
  }

  assignedSlot = slotNumber - 1;
  updateSlotLeds();

  Serial.print("ASSIGNED_SLOT:");
  Serial.println(slotNumber);
}

void clearAssignedSlot() {
  assignedSlot = -1;
  updateSlotLeds();
  Serial.println("ASSIGNED_SLOT:CLEARED");
}

void updateSlotLeds() {
  for (int i = 0; i < 5; i++) {
    digitalWrite(slotLedPins[i], i == assignedSlot ? HIGH : LOW);
  }
}

void setLockdown(bool active) {
  lockdownActive = active;

  if (lockdownActive) {
    closeGate();
    lockdownBlinkTimer = millis();
    lockdownLightsOn = true;
    setRedLeds(true);
    Serial.println("LOCKDOWN:1");
    return;
  }

  lockdownLightsOn = false;
  setRedLeds(false);
  Serial.println("LOCKDOWN:0");
}

void handleLockdownLights() {
  if (!lockdownActive) {
    return;
  }

  unsigned long now = millis();
  if (now - lockdownBlinkTimer < lockdownBlinkDelay) {
    return;
  }

  lockdownBlinkTimer = now;
  lockdownLightsOn = !lockdownLightsOn;
  setRedLeds(lockdownLightsOn);
}

void setRedLeds(bool on) {
  for (int i = 0; i < 3; i++) {
    digitalWrite(redLedPins[i], on ? HIGH : LOW);
  }
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
