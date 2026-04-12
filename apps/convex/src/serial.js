import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";

const SERIAL_PORT = process.env.SERIAL_PORT || "COM3";
const SERIAL_BAUD_RATE = Number(process.env.SERIAL_BAUD_RATE || 9600);

export function createSerialManager({ onLine }) {
  let port = null;
  let isConnected = false;

  try {
    port = new SerialPort({
      path: SERIAL_PORT,
      baudRate: SERIAL_BAUD_RATE,
      autoOpen: true,
    });

    const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));
    parser.on("data", (line) => onLine(line.trim()));

    port.on("open", () => {
      isConnected = true;
      console.log(`[serial] connected to ${SERIAL_PORT}`);
    });

    port.on("close", () => {
      isConnected = false;
      console.log("[serial] disconnected");
    });

    port.on("error", (error) => {
      isConnected = false;
      console.error("[serial] error:", error.message);
    });
  } catch (error) {
    console.error("[serial] failed to open port:", error.message);
  }

  function send(command) {
    if (!port || !isConnected) {
      console.warn(`[serial] skipped send while disconnected: ${command}`);
      return false;
    }
    port.write(`${command}\n`);
    return true;
  }

  return {
    send,
    isConnected: () => isConnected,
  };
}
